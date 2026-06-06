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
let extensionContext;
// ─── Activation ───────────────────────────────────────────────────────────────
function activate(context) {
    console.log("[MuleViz] Extension activated");
    extensionContext = context;
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
            case "updateAttribute": {
                const { tagName, lineNumber, attributeName, newValue } = message;
                if (currentFileUri && typeof lineNumber === "number" && tagName && attributeName) {
                    try {
                        const document = await vscode.workspace.openTextDocument(currentFileUri);
                        const success = await updateXmlAttributeInEditor(document, tagName, lineNumber, attributeName, newValue);
                        if (success) {
                            updatePanel(document, true);
                        }
                    }
                    catch (err) {
                        console.error("[MuleViz] Failed to update attribute:", err);
                    }
                }
                break;
            }
            case "addComponent": {
                const { insertAfterLine, insertAfterTagName, newTagName } = message;
                console.log(`[MuleViz] addComponent received:`, { insertAfterLine, insertAfterTagName, newTagName });
                if (currentFileUri && typeof insertAfterLine === "number" && insertAfterTagName && newTagName) {
                    try {
                        const document = await vscode.workspace.openTextDocument(currentFileUri);
                        console.log(`[MuleViz] Invoking insertComponentInXml...`);
                        const success = await insertComponentInXml(document, insertAfterLine, insertAfterTagName, newTagName);
                        console.log(`[MuleViz] insertComponentInXml result: ${success}`);
                        if (success) {
                            updatePanel(document, true);
                        }
                    }
                    catch (err) {
                        console.error("[MuleViz] Failed to add component:", err);
                    }
                }
                break;
            }
            // ── Connector schema lookup ──────────────────────────────────────────
            case "getConnectorSchema": {
                const { tagName = "", rawAttrs = {}, lineNumber = 0 } = message;
                const prefix = tagName.includes(":") ? tagName.split(":")[0] : "";
                // Fire-and-forget async lookup
                void handleSchemaRequest(context, tagName, prefix, rawAttrs, lineNumber);
                break;
            }
            case "searchExchange": {
                const { query } = message;
                const activePanel = panel;
                if (activePanel && typeof query === "string" && query.trim()) {
                    try {
                        const url = `https://anypoint.mulesoft.com/exchange/api/v2/assets?search=${encodeURIComponent(query)}&classifier=mule-plugin&limit=15`;
                        console.log(`[MuleViz] Querying Exchange: ${url}`);
                        (0, connectorRegistry_1.httpGet)(url, { Accept: "application/json" }).then((res) => {
                            try {
                                const results = JSON.parse(res.body);
                                void activePanel.webview.postMessage({
                                    command: "exchangeSearchResults",
                                    results: Array.isArray(results) ? results.map((r) => ({
                                        groupId: r.groupId,
                                        artifactId: r.artifactId,
                                        version: r.version,
                                        name: r.name,
                                    })) : [],
                                });
                            }
                            catch (jsonErr) {
                                void activePanel.webview.postMessage({
                                    command: "exchangeSearchResults",
                                    results: [],
                                    error: "Failed to parse Exchange response: " + String(jsonErr),
                                });
                            }
                        }).catch((httpErr) => {
                            void activePanel.webview.postMessage({
                                command: "exchangeSearchResults",
                                results: [],
                                error: "Exchange HTTP error: " + String(httpErr),
                            });
                        });
                    }
                    catch (err) {
                        console.error("[MuleViz] Exchange search setup failed:", err);
                    }
                }
                break;
            }
            case "addDependency": {
                const { groupId, artifactId, version } = message;
                if (groupId && artifactId && version) {
                    void addPomDependency(groupId, artifactId, version);
                }
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
        lineNumber: s.lineNumber,
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
    if (extensionContext) {
        void sendConnectorCatalog(extensionContext);
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
async function updateXmlAttributeInEditor(document, tagName, lineNumber, attributeName, newValue) {
    const xmlText = document.getText();
    const lines = xmlText.split("\n");
    const targetLineIdx = lineNumber - 1;
    let lineIdx = targetLineIdx;
    let lineText = lines[lineIdx];
    if (!lineText)
        return false;
    let tagStartIdx = lineText.indexOf(`<${tagName}`);
    if (tagStartIdx === -1) {
        for (let offset = -3; offset <= 3; offset++) {
            const idx = targetLineIdx + offset;
            if (idx >= 0 && idx < lines.length) {
                const checkIndex = lines[idx].indexOf(`<${tagName}`);
                if (checkIndex !== -1) {
                    lineIdx = idx;
                    lineText = lines[lineIdx];
                    tagStartIdx = checkIndex;
                    break;
                }
            }
        }
    }
    if (tagStartIdx === -1) {
        return false;
    }
    let currentLineIdx = lineIdx;
    let charIdx = tagStartIdx;
    let inDoubleQuote = false;
    let inSingleQuote = false;
    let foundEnd = false;
    let tagContent = "";
    while (currentLineIdx < lines.length) {
        const line = lines[currentLineIdx];
        while (charIdx < line.length) {
            const char = line[charIdx];
            tagContent += char;
            if (char === '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
            }
            else if (char === "'" && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
            }
            else if (char === '>' && !inDoubleQuote && !inSingleQuote) {
                foundEnd = true;
                charIdx++; // consume the '>'
                break;
            }
            charIdx++;
        }
        if (foundEnd) {
            break;
        }
        currentLineIdx++;
        charIdx = 0;
        tagContent += "\n";
    }
    if (!foundEnd) {
        return false;
    }
    // Reconstruct tag text and replace attribute
    const escapedName = attributeName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const attrRegex = new RegExp(`(\\b${escapedName}\\s*=\\s*)(["'])(.*?)\\2`, 'i');
    let newTagString = "";
    if (attrRegex.test(tagContent)) {
        newTagString = tagContent.replace(attrRegex, `$1$2${newValue}$2`);
    }
    else {
        const isSelfClosing = tagContent.trim().endsWith("/>");
        const closingPattern = isSelfClosing ? /\s*\/>$/ : /\s*>$/;
        const insertStr = ` ${attributeName}="${newValue}"`;
        newTagString = tagContent.replace(closingPattern, (match) => {
            return insertStr + (match.trim() === "/>" ? " />" : ">");
        });
    }
    const startPos = new vscode.Position(lineIdx, tagStartIdx);
    const endPos = new vscode.Position(currentLineIdx, charIdx);
    const range = new vscode.Range(startPos, endPos);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, range, newTagString);
    return vscode.workspace.applyEdit(edit);
}
async function sendConnectorCatalog(context) {
    if (!panel)
        return;
    const pomDeps = await ensurePomDeps();
    const catalog = [];
    // 1. Add core scopes
    catalog.push({
        prefix: "",
        connector: "Mule Core",
        operations: [
            "logger",
            "set-payload",
            "set-variable",
            "flow-ref",
            "choice",
            "foreach",
            "try",
            "async",
            "scatter-gather",
        ],
    });
    // 2. Fetch operations for each namespace prefix in the document
    for (const prefix of currentNamespaces.keys()) {
        if (prefix === "mule" || prefix === "xsi" || prefix === "doc" || prefix === "") {
            continue;
        }
        try {
            const ops = await (0, connectorRegistry_1.getConnectorOperations)(prefix, currentNamespaces, pomDeps, context.globalStorageUri, currentPomRepoUrls);
            if (ops && ops.length > 0) {
                const nsUri = currentNamespaces.get(prefix) ?? "";
                const dep = (0, connectorRegistry_1.matchDepToPrefix)(prefix, nsUri, pomDeps);
                const connectorName = dep ? dep.artifactId : `${prefix}-connector`;
                catalog.push({
                    prefix,
                    connector: connectorName,
                    operations: ops.map(o => o.name),
                });
            }
        }
        catch (err) {
            console.warn(`[MuleViz] Failed to load catalog for prefix "${prefix}":`, err);
        }
    }
    void panel.webview.postMessage({
        command: "connectorCatalog",
        catalog,
    });
}
async function insertComponentInXml(document, insertAfterLine, insertAfterTagName, newTagName) {
    const xmlText = document.getText();
    const lines = xmlText.split("\n");
    const targetLineIdx = insertAfterLine - 1;
    let lineIdx = targetLineIdx;
    let lineText = lines[lineIdx];
    if (!lineText)
        return false;
    let tagStartIdx = lineText.indexOf(`<${insertAfterTagName}`);
    if (tagStartIdx === -1) {
        for (let offset = -3; offset <= 3; offset++) {
            const idx = targetLineIdx + offset;
            if (idx >= 0 && idx < lines.length) {
                const checkIndex = lines[idx].indexOf(`<${insertAfterTagName}`);
                if (checkIndex !== -1) {
                    lineIdx = idx;
                    lineText = lines[lineIdx];
                    tagStartIdx = checkIndex;
                    break;
                }
            }
        }
    }
    if (tagStartIdx === -1) {
        return false;
    }
    // Find end of the opening tag
    let currentLineIdx = lineIdx;
    let charIdx = tagStartIdx;
    let inDoubleQuote = false;
    let inSingleQuote = false;
    let foundOpeningEnd = false;
    let isSelfClosing = false;
    while (currentLineIdx < lines.length) {
        const line = lines[currentLineIdx];
        while (charIdx < line.length) {
            const char = line[charIdx];
            if (char === '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
            }
            else if (char === "'" && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
            }
            else if (char === '>' && !inDoubleQuote && !inSingleQuote) {
                foundOpeningEnd = true;
                isSelfClosing = line.substring(Math.max(0, charIdx - 1), charIdx).startsWith("/");
                charIdx++; // move past '>'
                break;
            }
            charIdx++;
        }
        if (foundOpeningEnd) {
            break;
        }
        currentLineIdx++;
        charIdx = 0;
    }
    if (!foundOpeningEnd) {
        return false;
    }
    let endLineIdx = currentLineIdx;
    let endCharIdx = charIdx;
    if (!isSelfClosing) {
        // Search forward for the matching </insertAfterTagName>
        let depth = 1;
        let foundClosing = false;
        for (let i = currentLineIdx; i < lines.length; i++) {
            let lineText = lines[i];
            let startSearchFrom = (i === currentLineIdx) ? charIdx : 0;
            let tempIdx = startSearchFrom;
            while (tempIdx < lineText.length) {
                const nextOpen = lineText.indexOf(`<${insertAfterTagName}`, tempIdx);
                const nextClose = lineText.indexOf(`</${insertAfterTagName}>`, tempIdx);
                if (nextOpen === -1 && nextClose === -1) {
                    break;
                }
                if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
                    depth++;
                    tempIdx = nextOpen + insertAfterTagName.length + 1;
                }
                else {
                    depth--;
                    if (depth === 0) {
                        endLineIdx = i;
                        endCharIdx = nextClose + `</${insertAfterTagName}>`.length;
                        foundClosing = true;
                        break;
                    }
                    tempIdx = nextClose + `</${insertAfterTagName}>`.length;
                }
            }
            if (foundClosing) {
                break;
            }
        }
    }
    // Reconstruct insertion text with proper indent
    const startLineText = lines[lineIdx];
    const indentMatch = startLineText.match(/^([ \t]*)/);
    const indent = indentMatch ? indentMatch[1] : "  ";
    let insertText = "";
    if (newTagName === "choice") {
        insertText = `\n${indent}<choice doc:name="Choice Router">\n${indent}  <when expression="">\n${indent}  </when>\n${indent}  <otherwise>\n${indent}  </otherwise>\n${indent}</choice>`;
    }
    else if (newTagName === "foreach") {
        insertText = `\n${indent}<foreach doc:name="For Each">\n${indent}</foreach>`;
    }
    else if (newTagName === "try") {
        insertText = `\n${indent}<try doc:name="Try Scope">\n${indent}</try>`;
    }
    else if (newTagName === "async") {
        insertText = `\n${indent}<async doc:name="Async Scope">\n${indent}</async>`;
    }
    else if (newTagName === "scatter-gather") {
        insertText = `\n${indent}<scatter-gather doc:name="Scatter-Gather">\n${indent}  <route>\n${indent}  </route>\n${indent}  <route>\n${indent}  </route>\n${indent}</scatter-gather>`;
    }
    else if (newTagName === "logger") {
        insertText = `\n${indent}<logger level="INFO" doc:name="Logger" />`;
    }
    else if (newTagName === "set-payload") {
        insertText = `\n${indent}<set-payload value="#[]" doc:name="Set Payload" />`;
    }
    else if (newTagName === "set-variable") {
        insertText = `\n${indent}<set-variable value="#[]" variableName="" doc:name="Set Variable" />`;
    }
    else if (newTagName === "flow-ref") {
        insertText = `\n${indent}<flow-ref name="" doc:name="Flow Reference" />`;
    }
    else {
        const localName = newTagName.includes(':') ? newTagName.split(':')[1] : newTagName;
        const docName = localName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        insertText = `\n${indent}<${newTagName} doc:name="${docName}" />`;
    }
    const insertPos = new vscode.Position(endLineIdx, endCharIdx);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, insertPos, insertText);
    return vscode.workspace.applyEdit(edit);
}
async function addPomDependency(groupId, artifactId, version) {
    if (!currentFileUri)
        return;
    const pomPath = await findPomXml(currentFileUri);
    if (!pomPath) {
        vscode.window.showErrorMessage("Could not locate project pom.xml");
        return;
    }
    try {
        const pomText = fs.readFileSync(pomPath, "utf8");
        if (pomText.includes(`<artifactId>${artifactId}</artifactId>`) && pomText.includes(`<groupId>${groupId}</groupId>`)) {
            vscode.window.showInformationMessage(`Dependency ${artifactId} already exists in pom.xml`);
            return;
        }
        const depsCloseTag = "</dependencies>";
        const index = pomText.indexOf(depsCloseTag);
        if (index === -1) {
            vscode.window.showErrorMessage("Could not find <dependencies> section in pom.xml");
            return;
        }
        const linesBefore = pomText.substring(0, index).split("\n");
        const lastLine = linesBefore[linesBefore.length - 1];
        const indentMatch = lastLine.match(/^([ \t]*)/);
        const indent = indentMatch ? indentMatch[1] : "    ";
        const depXml = `\n${indent}<dependency>\n${indent}    <groupId>${groupId}</groupId>\n${indent}    <artifactId>${artifactId}</artifactId>\n${indent}    <version>${version}</version>\n${indent}    <classifier>mule-plugin</classifier>\n${indent}</dependency>`;
        const newPomText = pomText.substring(0, index) + depXml + pomText.substring(index);
        fs.writeFileSync(pomPath, newPomText, "utf8");
        vscode.window.showInformationMessage(`Successfully added dependency ${artifactId} to pom.xml`);
        currentPomDeps = [];
        currentPomRepoUrls = [];
        const editors = vscode.window.visibleTextEditors;
        const targetEditor = editors.find((e) => currentFileUri && e.document.uri.toString() === currentFileUri.toString());
        if (targetEditor) {
            updatePanel(targetEditor.document, true);
        }
    }
    catch (err) {
        vscode.window.showErrorMessage(`Failed to edit pom.xml: ${err.message}`);
    }
}
//# sourceMappingURL=extension.js.map