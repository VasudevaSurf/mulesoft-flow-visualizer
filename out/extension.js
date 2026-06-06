"use strict";
/**
 * extension.ts
 *
 * Main entry point for the "MuleSoft Multi-Flow Visualizer" VS Code extension.
 *
 * Responsibilities:
 *  - Register commands: openVisualizer, refreshVisualizer
 *  - Manage a singleton WebviewPanel instance
 *  - Listen to document changes (auto-refresh) and active editor switches
 *  - Orchestrate XML parsing → Mermaid generation → Webview update pipeline
 *  - Handle postMessages from the Webview (e.g., jump-to-line navigation)
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
const muleParser_1 = require("./muleParser");
const webviewContent_1 = require("./webviewContent");
// ─── Module-level state ────────────────────────────────────────────────────────
/** Singleton Webview panel; undefined when not open */
let panel;
/** The URI of the Mule XML file currently visualised in the panel */
let currentFileUri;
/** Parsed flow metadata — needed to re-inject line-number data on update */
let currentFlows = [];
/** Debounce timer handle for auto-refresh */
let debounceTimer;
// ─── Activation ───────────────────────────────────────────────────────────────
/**
 * Called once by VS Code when the extension is first activated.
 * Activation is triggered by `activationEvents` in package.json.
 */
function activate(context) {
    console.log("[MuleViz] Extension activated");
    // ── Register: Open Visualizer ────────────────────────────────────────────
    const openCmd = vscode.commands.registerCommand("mulesoft-flow-visualizer.openVisualizer", () => openOrRevealPanel(context));
    // ── Register: Refresh Visualizer ────────────────────────────────────────
    const refreshCmd = vscode.commands.registerCommand("mulesoft-flow-visualizer.refreshVisualizer", () => {
        if (panel) {
            updatePanelFromActiveEditor(/* force */ true);
        }
        else {
            openOrRevealPanel(context);
        }
    });
    // ── Listener: Auto-refresh on text document change ───────────────────────
    const onChangeDoc = vscode.workspace.onDidChangeTextDocument((e) => {
        const cfg = vscode.workspace.getConfiguration("mulesoftFlowVisualizer");
        if (!cfg.get("autoRefresh", true)) {
            return;
        }
        if (!panel) {
            return;
        }
        // Only react to the file that is currently visualised
        if (currentFileUri && e.document.uri.toString() !== currentFileUri.toString()) {
            return;
        }
        if (!isMuleXml(e.document)) {
            return;
        }
        // Debounce to avoid re-rendering on every keystroke
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        const delay = cfg.get("refreshDebounceMs", 800);
        debounceTimer = setTimeout(() => {
            updatePanel(e.document);
        }, delay);
    });
    // ── Listener: Switch to a different XML file in the editor ───────────────
    const onChangeEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!panel) {
            return;
        }
        if (editor && isMuleXml(editor.document)) {
            currentFileUri = editor.document.uri;
            updatePanel(editor.document);
        }
    });
    context.subscriptions.push(openCmd, refreshCmd, onChangeDoc, onChangeEditor);
}
// ─── Deactivation ─────────────────────────────────────────────────────────────
function deactivate() {
    if (panel) {
        panel.dispose();
    }
}
// ─── Panel lifecycle ───────────────────────────────────────────────────────────
/**
 * Open the Webview panel (or bring it to focus if already open).
 * Then immediately populate it from the active editor.
 */
function openOrRevealPanel(context) {
    if (panel) {
        // Bring existing panel to front
        panel.reveal(vscode.ViewColumn.Beside);
        updatePanelFromActiveEditor();
        return;
    }
    // Create a new panel in a split view beside the editor
    panel = vscode.window.createWebviewPanel("mulesoftFlowVisualizer", "MuleSoft Flow Visualizer", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, {
        enableScripts: true,
        retainContextWhenHidden: true, // keep diagram state when panel is not visible
        localResourceRoots: [context.extensionUri],
    });
    // Set context key so menu contributions can show/hide the refresh button
    void vscode.commands.executeCommand("setContext", "mulesoft-flow-visualizer.panelOpen", true);
    // ── Handle messages from the Webview ──────────────────────────────────
    panel.webview.onDidReceiveMessage((message) => {
        switch (message.command) {
            case "jumpToLine":
                if (typeof message.line === "number") {
                    jumpToLine(message.line);
                }
                break;
            case "refresh":
                updatePanelFromActiveEditor(true);
                break;
            default:
                console.warn("[MuleViz] Unknown message from webview:", message);
        }
    }, undefined, context.subscriptions);
    // ── Clean up when the panel is closed ────────────────────────────────
    panel.onDidDispose(() => {
        panel = undefined;
        currentFileUri = undefined;
        currentFlows = [];
        void vscode.commands.executeCommand("setContext", "mulesoft-flow-visualizer.panelOpen", false);
    }, undefined, context.subscriptions);
    // Populate the panel immediately
    updatePanelFromActiveEditor();
}
// ─── Content update helpers ────────────────────────────────────────────────────
/**
 * Convenience wrapper: look up the active editor and update if it is a Mule XML file.
 */
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
    currentFileUri = editor.document.uri;
    updatePanel(editor.document, force);
}
/**
 * Parse the given document and push fresh content to the Webview.
 */
function updatePanel(doc, _force = false) {
    if (!panel) {
        return;
    }
    const cfg = vscode.workspace.getConfiguration("mulesoftFlowVisualizer");
    const theme = cfg.get("theme", "default");
    const showErrorHandlers = cfg.get("showErrorHandlers", true);
    const xmlText = doc.getText();
    const { flows: allFlows, warnings } = (0, muleParser_1.parseMuleXml)(xmlText);
    // Filter error-handlers based on user setting
    const flows = showErrorHandlers
        ? allFlows
        : allFlows.filter((f) => f.kind !== "error-handler");
    currentFlows = flows;
    const mermaidSrc = (0, muleParser_1.generateMermaidDiagram)(flows, theme);
    const nonce = (0, webviewContent_1.getNonce)();
    // On the very first render, send the full HTML document.
    // On subsequent updates, only send a lightweight "update" message so the
    // Webview can re-render without a full page reload (preserving zoom level).
    if (isFirstRender()) {
        panel.title = buildPanelTitle(doc);
        panel.webview.html = (0, webviewContent_1.getWebviewContent)({
            mermaidSrc,
            flows,
            nonce,
            webview: panel.webview,
            warnings,
            theme,
        });
        markRendered();
    }
    else {
        panel.title = buildPanelTitle(doc);
        void panel.webview.postMessage({
            command: "update",
            mermaidSrc,
        });
    }
}
// ─── First-render tracking ────────────────────────────────────────────────────
// We track this by comparing the previous file URI. When the URI changes
// (user switched files) we do a full HTML reload; otherwise we do a delta update.
let lastRenderedUri = "";
function isFirstRender() {
    const uri = currentFileUri?.toString() ?? "";
    return uri !== lastRenderedUri;
}
function markRendered() {
    lastRenderedUri = currentFileUri?.toString() ?? "";
}
// ─── Jump-to-line navigation ──────────────────────────────────────────────────
/**
 * Reveal the source line in the XML editor, bringing it into view.
 * The line parameter is 1-based (as reported by the parser).
 */
function jumpToLine(line) {
    const editors = vscode.window.visibleTextEditors;
    // Find the editor that has the currently visualised file open
    let targetEditor = editors.find((e) => currentFileUri && e.document.uri.toString() === currentFileUri.toString());
    if (!targetEditor) {
        // Try to open the file if not visible
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
    // Bring the editor window to focus
    void vscode.window.showTextDocument(targetEditor.document, {
        viewColumn: targetEditor.viewColumn,
        preserveFocus: false,
        selection: range,
    });
}
/** Build a single-line Range from a 1-based line number */
function buildRange(line) {
    const zeroBasedLine = Math.max(0, line - 1);
    const pos = new vscode.Position(zeroBasedLine, 0);
    return new vscode.Range(pos, pos);
}
// ─── Utilities ────────────────────────────────────────────────────────────────
/**
 * Heuristically determine if a text document is a Mule XML file.
 * We check the language ID, the file extension, and whether the content
 * contains a <mule ...> root element.
 */
function isMuleXml(doc) {
    if (doc.languageId !== "xml" && !doc.fileName.endsWith(".xml")) {
        return false;
    }
    const text = doc.getText(new vscode.Range(new vscode.Position(0, 0), new vscode.Position(50, 0)));
    return text.includes("<mule") || text.includes("xmlns:mule");
}
function buildPanelTitle(doc) {
    const fileName = doc.fileName.split(/[\\/]/).pop() ?? "unknown.xml";
    return `Flows — ${fileName}`;
}
/**
 * Show a placeholder HTML page when there is no Mule XML file active.
 */
function showNoFileMessage() {
    if (!panel) {
        return;
    }
    lastRenderedUri = ""; // force full reload next time
    panel.title = "MuleSoft Flow Visualizer";
    panel.webview.html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    body {
      display: flex; align-items: center; justify-content: center;
      height: 100vh; margin: 0;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: 14px;
      color: var(--vscode-descriptionForeground, #999);
      background: var(--vscode-editor-background, #1e1e1e);
      flex-direction: column;
      gap: 12px;
      text-align: center;
      padding: 24px;
    }
    .icon { font-size: 48px; }
    p { max-width: 320px; line-height: 1.6; }
    code {
      background: var(--vscode-textBlockQuote-background, #2d2d2d);
      padding: 1px 4px; border-radius: 3px; font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="icon">🔀</div>
  <strong>MuleSoft Multi-Flow Visualizer</strong>
  <p>
    Open a Mule XML file (one that contains a <code>&lt;mule&gt;</code> root element)
    in the editor, then click the visualizer icon in the editor toolbar — or run
    <code>MuleSoft: Open Multi-Flow Visualizer</code> from the Command Palette.
  </p>
</body>
</html>`;
}
//# sourceMappingURL=extension.js.map