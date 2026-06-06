/**
 * extension.ts
 *
 * Main entry point for the "MuleSoft Multi-Flow Visualizer" VS Code extension.
 *
 * Message protocol (webview ↔ extension):
 *   webview → extension:
 *     { command: "jumpToLine",        line: number }
 *     { command: "refresh" }
 *     { command: "getConnectorSchema", tagName: string, rawAttrs: Record<string,string>, lineNumber: number }
 *
 *   extension → webview:
 *     { command: "updateFlows",   flows: [...] }
 *     { command: "connectorSchema", tagName, lineNumber, rawAttrs,
 *                                   operations: OperationDef[], matched: OperationDef|null }
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { parseMuleXml, ParsedFlow } from "./muleParser";
import { getWebviewContent, getNonce } from "./webviewContent";
import {
  extractNamespaces,
  parsePomDependencies,
  getConnectorOperations,
  findOperation,
  ConnectorDep,
  OperationDef,
} from "./connectorRegistry";

// ─── Module-level state ────────────────────────────────────────────────────────

let panel: vscode.WebviewPanel | undefined;
let currentFileUri: vscode.Uri | undefined;
let currentFlows: ParsedFlow[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

/** Cache: prefix → ops (per open XML file) */
let currentNamespaces = new Map<string, string>();
let currentPomDeps: ConnectorDep[] = [];
let currentXmlText = "";

// ─── Activation ───────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  console.log("[MuleViz] Extension activated");

  const openCmd = vscode.commands.registerCommand(
    "mulesoft-flow-visualizer.openVisualizer",
    () => openOrRevealPanel(context)
  );

  const refreshCmd = vscode.commands.registerCommand(
    "mulesoft-flow-visualizer.refreshVisualizer",
    () => {
      if (panel) {
        updatePanelFromActiveEditor(true);
      } else {
        openOrRevealPanel(context);
      }
    }
  );

  const onChangeDoc = vscode.workspace.onDidChangeTextDocument((e) => {
    const cfg = vscode.workspace.getConfiguration("mulesoftFlowVisualizer");
    if (!cfg.get<boolean>("autoRefresh", true)) return;
    if (!panel) return;
    if (currentFileUri && e.document.uri.toString() !== currentFileUri.toString()) return;
    if (!isMuleXml(e.document)) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    const delay = cfg.get<number>("refreshDebounceMs", 800);
    debounceTimer = setTimeout(() => updatePanel(e.document), delay);
  });

  const onChangeEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!panel) return;
    if (editor && isMuleXml(editor.document)) {
      currentFileUri = editor.document.uri;
      updatePanel(editor.document);
    }
  });

  context.subscriptions.push(openCmd, refreshCmd, onChangeDoc, onChangeEditor);
}

export function deactivate(): void {
  if (panel) panel.dispose();
}

// ─── Panel lifecycle ───────────────────────────────────────────────────────────

function openOrRevealPanel(context: vscode.ExtensionContext): void {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
    updatePanelFromActiveEditor();
    return;
  }

  panel = vscode.window.createWebviewPanel(
    "mulesoftFlowVisualizer",
    "MuleSoft Flow Visualizer",
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [context.extensionUri],
    }
  );

  void vscode.commands.executeCommand("setContext", "mulesoft-flow-visualizer.panelOpen", true);

  // ── Message handler ────────────────────────────────────────────────────────
  panel.webview.onDidReceiveMessage(
    async (message: {
      command: string;
      line?: number;
      tagName?: string;
      rawAttrs?: Record<string, string>;
      lineNumber?: number;
    }) => {
      switch (message.command) {
        case "jumpToLine":
          if (typeof message.line === "number") jumpToLine(message.line);
          break;

        case "refresh":
          updatePanelFromActiveEditor(true);
          break;

        // ── Connector schema lookup ──────────────────────────────────────────
        case "getConnectorSchema": {
          const { tagName = "", rawAttrs = {}, lineNumber = 0 } = message;
          const prefix = tagName.includes(":") ? tagName.split(":")[0] : "";

          // Fire-and-forget async lookup
          void handleSchemaRequest(context, tagName, prefix, rawAttrs, lineNumber);
          break;
        }

        default:
          console.warn("[MuleViz] Unknown message from webview:", message);
      }
    },
    undefined,
    context.subscriptions
  );

  panel.onDidDispose(
    () => {
      panel = undefined;
      currentFileUri = undefined;
      currentFlows = [];
      void vscode.commands.executeCommand("setContext", "mulesoft-flow-visualizer.panelOpen", false);
    },
    undefined,
    context.subscriptions
  );

  updatePanelFromActiveEditor();
}

// ─── Schema lookup handler ─────────────────────────────────────────────────────

async function handleSchemaRequest(
  context: vscode.ExtensionContext,
  tagName: string,
  prefix: string,
  rawAttrs: Record<string, string>,
  lineNumber: number
): Promise<void> {
  if (!panel) return;

  // 1. Get pom.xml deps (cached per-session in currentPomDeps)
  const pomDeps = await ensurePomDeps();

  // 2. Fetch operations for this connector (downloads JAR once, then caches)
  let operations: OperationDef[] = [];
  let matched: OperationDef | null = null;
  let error: string | undefined;

  try {
    if (prefix) {
      operations = await getConnectorOperations(
        prefix,
        currentNamespaces,
        pomDeps,
        context.globalStorageUri
      );
      matched = findOperation(operations, tagName) ?? null;
    }
  } catch (err) {
    error = String(err);
    console.error("[MuleViz] Schema lookup failed:", err);
  }

  // 3. Post the result back to the webview
  void panel.webview.postMessage({
    command: "connectorSchema",
    tagName,
    lineNumber,
    rawAttrs,
    operations,
    matched,
    error,
  });
}

// ─── pom.xml helpers ──────────────────────────────────────────────────────────

async function ensurePomDeps(): Promise<ConnectorDep[]> {
  if (currentPomDeps.length > 0) return currentPomDeps;
  if (!currentFileUri) return [];

  const pomPath = await findPomXml(currentFileUri);
  if (!pomPath) return [];

  try {
    const pomText = fs.readFileSync(pomPath, "utf8");
    currentPomDeps = parsePomDependencies(pomText);
    console.log(
      `[MuleViz] Found ${currentPomDeps.length} mule-plugin deps in ${pomPath}`
    );
  } catch (e) {
    console.warn("[MuleViz] Could not read pom.xml:", e);
  }
  return currentPomDeps;
}

/** Walk up the directory tree from xmlUri to find the nearest pom.xml */
async function findPomXml(xmlUri: vscode.Uri): Promise<string | null> {
  let dir = path.dirname(xmlUri.fsPath);
  const root = path.parse(dir).root;

  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "pom.xml");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir || dir === root) break;
    dir = parent;
  }
  return null;
}

// ─── Content update helpers ────────────────────────────────────────────────────

function updatePanelFromActiveEditor(force = false): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) { showNoFileMessage(); return; }
  if (!isMuleXml(editor.document)) { showNoFileMessage(); return; }
  currentFileUri = editor.document.uri;
  // Reset per-file caches when file changes
  currentPomDeps = [];
  updatePanel(editor.document, force);
}

function updatePanel(doc: vscode.TextDocument, _force = false): void {
  if (!panel) return;

  const cfg = vscode.workspace.getConfiguration("mulesoftFlowVisualizer");
  const theme = cfg.get<string>("theme", "default");
  const showErrorHandlers = cfg.get<boolean>("showErrorHandlers", true);

  const xmlText = doc.getText();
  currentXmlText = xmlText;

  // Update namespace map for this file
  currentNamespaces = extractNamespaces(xmlText);

  const { flows: allFlows, warnings } = parseMuleXml(xmlText);
  const flows = showErrorHandlers
    ? allFlows
    : allFlows.filter((f) => f.kind !== "error-handler");

  currentFlows = flows;

  const serializeStep = (s: typeof flows[0]["steps"][0]) => ({
    label: s.label,
    nodeId: s.nodeId,
    tagName: s.tagName,
    shape: s.shape,
    flowRefTarget: s.flowRefTarget || null,
    rawAttrs: (s as any).rawAttrs || {},
  });

  const serializedFlows = flows.map((f) => ({
    kind: f.kind,
    name: f.name,
    lineNumber: f.lineNumber,
    subgraphId: f.subgraphId,
    steps: f.steps.map(serializeStep),
    errorHandler: f.errorHandler
      ? f.errorHandler.map((eh) => ({
          type: eh.type,
          label: eh.label,
          steps: eh.steps.map(serializeStep),
        }))
      : null,
  }));

  if (isFirstRender()) {
    panel.title = buildPanelTitle(doc);
    panel.webview.html = getWebviewContent({
      mermaidSrc: "",
      flows,
      nonce: getNonce(),
      webview: panel.webview,
      warnings,
      theme,
    });
    markRendered();
  } else {
    panel.title = buildPanelTitle(doc);
    void panel.webview.postMessage({ command: "updateFlows", flows: serializedFlows });
  }
}

// ─── First-render tracking ─────────────────────────────────────────────────────

let lastRenderedUri = "";
function isFirstRender() { return (currentFileUri?.toString() ?? "") !== lastRenderedUri; }
function markRendered()   { lastRenderedUri = currentFileUri?.toString() ?? ""; }

// ─── Jump-to-line ─────────────────────────────────────────────────────────────

function jumpToLine(line: number): void {
  const editors = vscode.window.visibleTextEditors;
  const targetEditor = editors.find(
    (e) => currentFileUri && e.document.uri.toString() === currentFileUri.toString()
  );

  if (!targetEditor) {
    if (currentFileUri) {
      void vscode.workspace.openTextDocument(currentFileUri).then((doc) => {
        void vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.One,
          preserveFocus: false,
          selection: buildRange(line),
        });
      });
    }
    return;
  }

  const range = buildRange(line);
  targetEditor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  targetEditor.selection = new vscode.Selection(range.start, range.start);
  void vscode.window.showTextDocument(targetEditor.document, {
    viewColumn: targetEditor.viewColumn,
    preserveFocus: false,
    selection: range,
  });
}

function buildRange(line: number): vscode.Range {
  const z = Math.max(0, line - 1);
  const p = new vscode.Position(z, 0);
  return new vscode.Range(p, p);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function isMuleXml(doc: vscode.TextDocument): boolean {
  if (doc.languageId !== "xml" && !doc.fileName.endsWith(".xml")) return false;
  const text = doc.getText(
    new vscode.Range(new vscode.Position(0, 0), new vscode.Position(50, 0))
  );
  return text.includes("<mule") || text.includes("xmlns:mule");
}

function buildPanelTitle(doc: vscode.TextDocument): string {
  const fileName = doc.fileName.split(/[\\\/]/).pop() ?? "unknown.xml";
  return `Flows — ${fileName}`;
}

function showNoFileMessage(): void {
  if (!panel) return;
  lastRenderedUri = "";
  panel.title = "MuleSoft Flow Visualizer";
  panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    body {
      display:flex;align-items:center;justify-content:center;
      height:100vh;margin:0;flex-direction:column;gap:12px;text-align:center;padding:24px;
      font-family:var(--vscode-font-family,sans-serif);font-size:14px;
      color:var(--vscode-descriptionForeground,#999);
      background:var(--vscode-editor-background,#1e1e1e);
    }
    .icon{font-size:48px}
    p{max-width:320px;line-height:1.6}
    code{background:var(--vscode-textBlockQuote-background,#2d2d2d);
      padding:1px 4px;border-radius:3px;font-size:12px}
  </style>
</head>
<body>
  <div class="icon">🔀</div>
  <strong>MuleSoft Multi-Flow Visualizer</strong>
  <p>Open a Mule XML file (containing a <code>&lt;mule&gt;</code> root element)
  then click the visualizer icon in the editor toolbar, or run
  <code>MuleSoft: Open Multi-Flow Visualizer</code> from the Command Palette.</p>
</body>
</html>`;
}