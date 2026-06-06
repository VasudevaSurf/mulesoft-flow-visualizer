"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const muleParser_1 = require("./muleParser");
const webviewContent_1 = require("./webviewContent");
const connectorRegistry_1 = require("./connectorRegistry");
// ─── Module-level state ────────────────────────────────────────────────────────
let panel;
let currentFileUri;
let currentFlows = [];
let debounceTimer;
/** Cache: prefix → ops (per open XML file) */
let currentNamespaces = new Map();
let currentPomDeps = [];
let currentPomRepoUrls = [];
let currentXmlText = "";
// ─── Activation ───────────────────────────────────────────────────────────────
function activate(context) {
    console.log("[MuleViz] Extension activated");
    const openCmd = vscode.commands.registerCommand("mulesoft-flow-visualizer.openVisualizer", () => openOrRevealPanel(context));
    const refreshCmd = vscode.commands.registerCommand("mulesoft-flow-visualizer.refreshVisualizer", () => {
        if (panel) {
            updatePanelFromActiveEditor(true);
        }
        else {
            openOrRevealPanel(context);
        }
    });
    const onChangeDoc = vscode.workspace.onDidChangeTextDocument((e) => {
        const cfg = vscode.workspace.getConfiguration("mulesoftFlowVisualizer");
        if (!cfg.get("autoRefresh", true))
            return;
        if (!panel)
            return;
        if (currentFileUri && e.document.uri.toString() !== currentFileUri.toString())
            return;
        if (!isMuleXml(e.document))
            return;
        if (debounceTimer)
            clearTimeout(debounceTimer);
        const delay = cfg.get("refreshDebounceMs", 800);
        debounceTimer = setTimeout(() => updatePanel(e.document), delay);
    });
    const onChangeEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!panel)
            return;
        if (editor && isMuleXml(editor.document)) {
            currentFileUri = editor.document.uri;
            updatePanel(editor.document);
        }
    });
    context.subscriptions.push(openCmd, refreshCmd, onChangeDoc, onChangeEditor);
}
function deactivate() {
    if (panel)
        panel.dispose();
}
// ─── Panel lifecycle ───────────────────────────────────────────────────────────
function openOrRevealPanel(context) {
    if (panel) {
        panel.reveal(vscode.ViewColumn.Beside);
        updatePanelFromActiveEditor();
        return;
    }
    panel = vscode.window.createWebviewPanel("mulesoftFlowVisualizer", "MuleSoft Flow Visualizer", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri],
    });
    void vscode.commands.executeCommand("setContext", "mulesoft-flow-visualizer.panelOpen", true);
    // ── Message handler ────────────────────────────────────────────────────────
    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case "jumpToLine":
                if (typeof message.line === "number")
                    jumpToLine(message.line);
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
    }, undefined, context.subscriptions);
    panel.onDidDispose(() => {
        panel = undefined;
        currentFileUri = undefined;
        currentFlows = [];
        // ── FIX: reset lastRenderedUri so next open always does a full render ──
        lastRenderedUri = "";
        void vscode.commands.executeCommand("setContext", "mulesoft-flow-visualizer.panelOpen", false);
    }, undefined, context.subscriptions);
    updatePanelFromActiveEditor();
}
// ─── Schema lookup handler ─────────────────────────────────────────────────────
async function handleSchemaRequest(context, tagName, prefix, rawAttrs, lineNumber) {
    if (!panel)
        return;
    // 1. Get pom.xml deps (cached per-session in currentPomDeps)
    const pomDeps = await ensurePomDeps();
    // 2. Fetch operations for this connector (downloads JAR once, then caches)
    let operations = [];
    let matched = null;
    let error;
    try {
        if (prefix) {
            operations = await (0, connectorRegistry_1.getConnectorOperations)(prefix, currentNamespaces, pomDeps, context.globalStorageUri, currentPomRepoUrls);
            matched = (0, connectorRegistry_1.findOperation)(operations, tagName) ?? null;
        }
    }
    catch (err) {
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
async function ensurePomDeps() {
    if (currentPomDeps.length > 0)
        return currentPomDeps;
    if (!currentFileUri)
        return [];
    const pomPath = await findPomXml(currentFileUri);
    if (!pomPath)
        return [];
    try {
        const pomText = fs.readFileSync(pomPath, "utf8");
        const result = (0, connectorRegistry_1.parsePomDependencies)(pomText);
        currentPomDeps = result.deps;
        currentPomRepoUrls = result.repoUrls;
        console.log(`[MuleViz] Found ${currentPomDeps.length} mule-plugin deps, ${currentPomRepoUrls.length} repos in ${pomPath}`);
    }
    catch (e) {
        console.warn("[MuleViz] Could not read pom.xml:", e);
    }
    return currentPomDeps;
}
/** Walk up the directory tree from xmlUri to find the nearest pom.xml */
async function findPomXml(xmlUri) {
    let dir = path.dirname(xmlUri.fsPath);
    const root = path.parse(dir).root;
    for (let i = 0; i < 8; i++) {
        const candidate = path.join(dir, "pom.xml");
        if (fs.existsSync(candidate))
            return candidate;
        const parent = path.dirname(dir);
        if (parent === dir || dir === root)
            break;
        dir = parent;
    }
    return null;
}
// ─── Content update helpers ────────────────────────────────────────────────────
function updatePanelFromActiveEditor(force = false) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        showNoFileMessage();
        return;
    }
    if (!isMuleXml(editor.document)) {
        showNoFileMessage();
        return;
    }
    const newUri = editor.document.uri.toString();
    // ── FIX: if the file changed (or panel was just created), force a full
    //         re-render so the webview gets the baked-in FLOWS, not a postMessage
    //         to an empty webview that has no FLOWS variable yet. ────────────────
    if (newUri !== lastRenderedUri) {
        lastRenderedUri = ""; // forces isFirstRender() → true
        currentPomDeps = []; // reset per-file pom cache
        currentPomRepoUrls = []; // reset per-file repo cache
        currentNamespaces = new Map(); // reset per-file namespace cache
    }
    currentFileUri = editor.document.uri;
    updatePanel(editor.document, force);
}
function updatePanel(doc, _force = false) {
    if (!panel)
        return;
    const cfg = vscode.workspace.getConfiguration("mulesoftFlowVisualizer");
    const theme = cfg.get("theme", "default");
    const showErrorHandlers = cfg.get("showErrorHandlers", true);
    const xmlText = doc.getText();
    currentXmlText = xmlText;
    // Update namespace map for this file
    currentNamespaces = (0, connectorRegistry_1.extractNamespaces)(xmlText);
    const { flows: allFlows, warnings } = (0, muleParser_1.parseMuleXml)(xmlText);
    const flows = showErrorHandlers
        ? allFlows
        : allFlows.filter((f) => f.kind !== "error-handler");
    currentFlows = flows;
    const serializeStep = (s) => ({
        label: s.label,
        nodeId: s.nodeId,
        tagName: s.tagName,
        shape: s.shape,
        flowRefTarget: s.flowRefTarget || null,
        rawAttrs: s.rawAttrs || {},
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
        panel.webview.html = (0, webviewContent_1.getWebviewContent)({
            mermaidSrc: "",
            flows,
            nonce: (0, webviewContent_1.getNonce)(),
            webview: panel.webview,
            warnings,
            theme,
        });
        markRendered();
    }
    else {
        panel.title = buildPanelTitle(doc);
        void panel.webview.postMessage({ command: "updateFlows", flows: serializedFlows });
    }
}
// ─── First-render tracking ─────────────────────────────────────────────────────
let lastRenderedUri = "";
function isFirstRender() { return (currentFileUri?.toString() ?? "") !== lastRenderedUri; }
function markRendered() { lastRenderedUri = currentFileUri?.toString() ?? ""; }
// ─── Jump-to-line ─────────────────────────────────────────────────────────────
function jumpToLine(line) {
    const editors = vscode.window.visibleTextEditors;
    const targetEditor = editors.find((e) => currentFileUri && e.document.uri.toString() === currentFileUri.toString());
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
function buildRange(line) {
    const z = Math.max(0, line - 1);
    const p = new vscode.Position(z, 0);
    return new vscode.Range(p, p);
}
// ─── Utilities ────────────────────────────────────────────────────────────────
function isMuleXml(doc) {
    if (doc.languageId !== "xml" && !doc.fileName.endsWith(".xml"))
        return false;
    const text = doc.getText(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(50, 0)));
    return text.includes("<mule") || text.includes("xmlns:mule");
}
function buildPanelTitle(doc) {
    const fileName = doc.fileName.split(/[\\\/]/).pop() ?? "unknown.xml";
    return `Flows — ${fileName}`;
}
function showNoFileMessage() {
    if (!panel)
        return;
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
//# sourceMappingURL=extension.js.map