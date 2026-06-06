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
        debounceTimer = setTimeout(() => {
            if (e.document.isClosed)
                return;
            updatePanel(e.document);
        }, delay);
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
                const { tagName, lineNumber, attributeName, newValue, docId, docName } = message;
                if (currentFileUri && typeof lineNumber === "number" && tagName && attributeName) {
                    try {
                        const document = await vscode.workspace.openTextDocument(currentFileUri);
                        const success = await updateXmlAttributeInEditor(document, tagName, lineNumber, attributeName, newValue, docId, docName);
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
            case "addFlow": {
                const { kind, name } = message;
                console.log(`[MuleViz] addFlow received: kind=${kind} name=${name}`);
                if (currentFileUri) {
                    try {
                        const document = await vscode.workspace.openTextDocument(currentFileUri);
                        const success = await insertFlowInXml(document, kind, name);
                        console.log(`[MuleViz] insertFlowInXml result: ${success}`);
                        if (success) {
                            updatePanel(document, true);
                        }
                    }
                    catch (err) {
                        console.error("[MuleViz] Failed to add flow:", err);
                    }
                }
                break;
            }
            case "addErrorHandler": {
                const { flowName: ehFlowName, flowLineNumber: ehFlowLine, flowKind: ehFlowKind } = message;
                console.log(`[MuleViz] addErrorHandler received: flowName=${ehFlowName} flowLine=${ehFlowLine}`);
                if (currentFileUri && typeof ehFlowLine === "number") {
                    try {
                        const document = await vscode.workspace.openTextDocument(currentFileUri);
                        const success = await insertErrorHandlerInXml(document, ehFlowLine, ehFlowName, ehFlowKind);
                        console.log(`[MuleViz] insertErrorHandlerInXml result: ${success}`);
                        if (success) {
                            updatePanel(document, true);
                        }
                    }
                    catch (err) {
                        console.error("[MuleViz] Failed to add error handler:", err);
                    }
                }
                break;
            }
            case "addErrorStrategy": {
                const { flowName: esFlowName, flowLineNumber: esFlowLine, strategyTag } = message;
                console.log(`[MuleViz] addErrorStrategy received: flowName=${esFlowName} strategy=${strategyTag}`);
                if (currentFileUri && typeof esFlowLine === "number" && strategyTag) {
                    try {
                        const document = await vscode.workspace.openTextDocument(currentFileUri);
                        const success = await insertErrorStrategyInXml(document, esFlowLine, esFlowName, strategyTag);
                        console.log(`[MuleViz] insertErrorStrategyInXml result: ${success}`);
                        if (success) {
                            updatePanel(document, true);
                        }
                    }
                    catch (err) {
                        console.error("[MuleViz] Failed to add error strategy:", err);
                    }
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
    const nsUri = currentNamespaces.get(prefix) ?? "";
    const dep = (0, connectorRegistry_1.matchDepToPrefix)(prefix, nsUri, pomDeps);
    const localName = tagName.includes(":") ? tagName.split(":")[1] : tagName;
    let operations = [];
    let matched = null;
    let error;
    let isBuiltIn = false;
    // STEP 1 — Try matchDepToPrefix()
    if (dep) {
        try {
            operations = await (0, connectorRegistry_1.getConnectorOperations)(prefix, currentNamespaces, pomDeps, context.globalStorageUri, currentPomRepoUrls);
            matched = (0, connectorRegistry_1.findOperation)(operations, tagName) ?? null;
            if (operations && operations.length > 0) {
                console.log(`[MuleViz] Loaded schema for "${tagName}" from Exchange JAR/cache`);
            }
            else {
                isBuiltIn = true;
            }
        }
        catch (err) {
            error = String(err);
            console.error(`[MuleViz] FAIL: Schema lookup failed for tag "${tagName}" (prefix "${prefix}"). Error:`, err);
            isBuiltIn = true;
        }
    }
    else {
        isBuiltIn = true;
    }
    // STEP 2 — Only if matchDepToPrefix() returns undefined (or we fell back to built-in)
    if (isBuiltIn) {
        const meta = muleParser_1.TAG_META[tagName] || muleParser_1.TAG_META[localName];
        if (meta) {
            const defaultAttrs = meta.defaultAttrs || {};
            const requiredAttrs = meta.requiredAttrs || [];
            const parameters = Object.entries(defaultAttrs).map(([key, val]) => {
                let type = "string";
                if (val.startsWith("#[")) {
                    type = "expression";
                }
                else if (val === "true" || val === "false") {
                    type = "boolean";
                }
                return {
                    name: key,
                    type,
                    required: requiredAttrs.includes(key),
                    defaultValue: val || undefined
                };
            });
            operations = [{
                    name: localName,
                    parameters
                }];
            matched = operations[0];
            console.log(`[MuleViz] Resolved built-in schema for "${tagName}" from TAG_META (runtime component, not in pom.xml)`);
        }
        else {
            // Generic fallback
            operations = [{
                    name: localName,
                    parameters: []
                }];
            matched = operations[0];
            console.log(`[MuleViz] Resolved built-in schema for "${tagName}" from TAG_META (runtime component, not in pom.xml)`);
        }
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
        success: isBuiltIn ? true : (!error && operations.length > 0),
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
    try {
        if (doc.isClosed)
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
    catch (err) {
        console.warn("[MuleViz] Failed to update panel (document may have been closed or disposed):", err);
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
async function updateXmlAttributeInEditor(document, tagName, lineNumber, attributeName, newValue, docId, docName) {
    const schema = muleParser_1.CHILD_SCHEMA[tagName] || [];
    const matchedField = schema.find(f => f.key === attributeName || attributeName.startsWith(f.key + '.'));
    if (matchedField || attributeName.includes(">")) {
        const fieldDef = matchedField || {
            key: attributeName,
            label: attributeName,
            type: attributeName.includes(".") ? "attrs" : "cdata"
        };
        const xmlText = document.getText();
        const updatedXml = updateChildElementInXml(xmlText, tagName, docId, docName, fieldDef, newValue, lineNumber, attributeName);
        if (updatedXml !== xmlText) {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(xmlText.length));
            edit.replace(document.uri, fullRange, updatedXml);
            return vscode.workspace.applyEdit(edit);
        }
        return false;
    }
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
function findElementEnd(xmlText, startIdx, tagName) {
    let idx = startIdx;
    let inDoubleQuote = false;
    let inSingleQuote = false;
    let foundOpeningEnd = false;
    let isSelfClosing = false;
    while (idx < xmlText.length) {
        const char = xmlText[idx];
        if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        }
        else if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        }
        else if (char === '>') {
            foundOpeningEnd = true;
            isSelfClosing = xmlText.substring(Math.max(0, idx - 1), idx).startsWith("/");
            idx++;
            break;
        }
        idx++;
    }
    if (!foundOpeningEnd)
        return -1;
    if (isSelfClosing)
        return idx;
    let depth = 1;
    let tempIdx = idx;
    const openTagPattern = `<${tagName}`;
    const closeTagPattern = `</${tagName}>`;
    while (tempIdx < xmlText.length) {
        const nextOpen = xmlText.indexOf(openTagPattern, tempIdx);
        const nextClose = xmlText.indexOf(closeTagPattern, tempIdx);
        if (nextOpen === -1 && nextClose === -1) {
            break;
        }
        if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
            depth++;
            tempIdx = nextOpen + openTagPattern.length;
        }
        else {
            depth--;
            if (depth === 0) {
                return nextClose + closeTagPattern.length;
            }
            tempIdx = nextClose + closeTagPattern.length;
        }
    }
    return -1;
}
function findParentElementBounds(xmlText, parentTag, docId, docName, lineNumber) {
    if (docId) {
        let idIdx = xmlText.indexOf(`doc:id="${docId}"`);
        if (idIdx === -1)
            idIdx = xmlText.indexOf(`doc:id='${docId}'`);
        if (idIdx !== -1) {
            const beforeId = xmlText.substring(0, idIdx);
            const tagOpenIdx = beforeId.lastIndexOf(`<${parentTag}`);
            if (tagOpenIdx !== -1) {
                const endIdx = findElementEnd(xmlText, tagOpenIdx, parentTag);
                if (endIdx !== -1) {
                    return { startIdx: tagOpenIdx, endIdx };
                }
            }
        }
    }
    if (docName) {
        let nameIdx = xmlText.indexOf(`doc:name="${docName}"`);
        if (nameIdx === -1)
            nameIdx = xmlText.indexOf(`doc:name='${docName}'`);
        if (nameIdx !== -1) {
            const beforeName = xmlText.substring(0, nameIdx);
            const tagOpenIdx = beforeName.lastIndexOf(`<${parentTag}`);
            if (tagOpenIdx !== -1) {
                const between = beforeName.substring(tagOpenIdx, nameIdx);
                if (!between.includes(">")) {
                    const endIdx = findElementEnd(xmlText, tagOpenIdx, parentTag);
                    if (endIdx !== -1) {
                        return { startIdx: tagOpenIdx, endIdx };
                    }
                }
            }
        }
    }
    const lines = xmlText.split("\n");
    const targetLineIdx = lineNumber - 1;
    let foundLineIdx = -1;
    let foundCharIdx = -1;
    for (let offset = 0; offset <= 5; offset++) {
        for (const sign of [1, -1]) {
            const idx = targetLineIdx + sign * offset;
            if (idx >= 0 && idx < lines.length) {
                const checkIndex = lines[idx].indexOf(`<${parentTag}`);
                if (checkIndex !== -1) {
                    foundLineIdx = idx;
                    foundCharIdx = checkIndex;
                    break;
                }
            }
        }
        if (foundLineIdx !== -1)
            break;
    }
    if (foundLineIdx !== -1) {
        let tagOpenIdx = 0;
        for (let i = 0; i < foundLineIdx; i++) {
            tagOpenIdx += lines[i].length + 1;
        }
        tagOpenIdx += foundCharIdx;
        const endIdx = findElementEnd(xmlText, tagOpenIdx, parentTag);
        if (endIdx !== -1) {
            return { startIdx: tagOpenIdx, endIdx };
        }
    }
    return null;
}
function updateNestedSegments(innerXml, segments, segIdx, newValue, type, baseIndent, indentStep) {
    const currentTag = segments[segIdx];
    const isLeaf = segIdx === segments.length - 1;
    const openPattern = `<${currentTag}\\b`;
    const openIdx = innerXml.search(new RegExp(openPattern, 'i'));
    if (openIdx !== -1) {
        let depth = 1;
        let idx = openIdx;
        let foundOpeningEnd = false;
        let isSelfClosing = false;
        while (idx < innerXml.length) {
            const char = innerXml[idx];
            if (char === '"') {
                idx = innerXml.indexOf('"', idx + 1);
                if (idx === -1)
                    idx = innerXml.length;
            }
            else if (char === "'") {
                idx = innerXml.indexOf("'", idx + 1);
                if (idx === -1)
                    idx = innerXml.length;
            }
            else if (char === '>') {
                foundOpeningEnd = true;
                isSelfClosing = innerXml.substring(Math.max(0, idx - 1), idx).startsWith("/");
                idx++;
                break;
            }
            idx++;
        }
        if (!foundOpeningEnd) {
            return insertNewNestedSegments(innerXml, segments.slice(segIdx), newValue, type, baseIndent, indentStep);
        }
        if (isSelfClosing) {
            const tagHeader = innerXml.substring(openIdx, idx - 2);
            if (isLeaf) {
                const content = type === "cdata" ? `<![CDATA[${newValue}]]>` : newValue;
                const expanded = `${tagHeader}>\n${baseIndent}${indentStep}${content}\n${baseIndent}</${currentTag}>`;
                return innerXml.substring(0, openIdx) + expanded + innerXml.substring(idx);
            }
            else {
                const innerContent = insertNewNestedSegments("", segments.slice(segIdx + 1), newValue, type, baseIndent + indentStep, indentStep);
                const expanded = `${tagHeader}>\n${innerContent.trimStart()}\n${baseIndent}</${currentTag}>`;
                return innerXml.substring(0, openIdx) + expanded + innerXml.substring(idx);
            }
        }
        const openTagPattern = `<${currentTag}`;
        const closeTagPattern = `</${currentTag}>`;
        let tempIdx = idx;
        let closeIdx = -1;
        while (tempIdx < innerXml.length) {
            const nextOpen = innerXml.indexOf(openTagPattern, tempIdx);
            const nextClose = innerXml.indexOf(closeTagPattern, tempIdx);
            if (nextOpen === -1 && nextClose === -1)
                break;
            if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
                depth++;
                tempIdx = nextOpen + openTagPattern.length;
            }
            else {
                depth--;
                if (depth === 0) {
                    closeIdx = nextClose;
                    break;
                }
                tempIdx = nextClose + closeTagPattern.length;
            }
        }
        if (closeIdx === -1) {
            return insertNewNestedSegments(innerXml, segments.slice(segIdx), newValue, type, baseIndent, indentStep);
        }
        const tagContentStart = idx;
        const tagContentEnd = closeIdx;
        if (isLeaf) {
            const content = type === "cdata" ? `<![CDATA[${newValue}]]>` : newValue;
            const updatedTag = innerXml.substring(openIdx, tagContentStart) + content + innerXml.substring(tagContentEnd, closeIdx + closeTagPattern.length);
            return innerXml.substring(0, openIdx) + updatedTag + innerXml.substring(closeIdx + closeTagPattern.length);
        }
        else {
            const childInnerXml = innerXml.substring(tagContentStart, tagContentEnd);
            const updatedChildInner = updateNestedSegments(childInnerXml, segments, segIdx + 1, newValue, type, baseIndent + indentStep, indentStep);
            return innerXml.substring(0, tagContentStart) + updatedChildInner + innerXml.substring(tagContentEnd);
        }
    }
    else {
        return insertNewNestedSegments(innerXml, segments.slice(segIdx), newValue, type, baseIndent, indentStep);
    }
}
function insertNewNestedSegments(innerXml, segments, newValue, type, baseIndent, indentStep) {
    let block = "";
    let currentIndent = baseIndent;
    for (let i = 0; i < segments.length; i++) {
        const tag = segments[i];
        block += `${currentIndent}<${tag}>`;
        if (i === segments.length - 1) {
            const content = type === "cdata" ? `<![CDATA[${newValue}]]>` : newValue;
            block += `${content}</${tag}>`;
        }
        else {
            block += "\n";
            currentIndent += indentStep;
        }
    }
    for (let i = segments.length - 2; i >= 0; i--) {
        currentIndent = currentIndent.substring(0, currentIndent.length - indentStep.length);
        block += `\n${currentIndent}</${segments[i]}>`;
    }
    const trimmed = innerXml.trim();
    if (trimmed.length === 0) {
        return "\n" + block;
    }
    else {
        return innerXml.trimEnd() + "\n" + block;
    }
}
function updateChildAttributeInXmlBlock(innerXml, segments, attrName, newValue, baseIndent, indentStep) {
    const currentTag = segments[0];
    if (segments.length === 1) {
        const openPattern = `<${currentTag}\\b`;
        const openIdx = innerXml.search(new RegExp(openPattern, 'i'));
        if (openIdx !== -1) {
            let idx = openIdx;
            let foundEnd = false;
            while (idx < innerXml.length) {
                const char = innerXml[idx];
                if (char === '"') {
                    idx = innerXml.indexOf('"', idx + 1);
                    if (idx === -1)
                        idx = innerXml.length;
                }
                else if (char === "'") {
                    idx = innerXml.indexOf("'", idx + 1);
                    if (idx === -1)
                        idx = innerXml.length;
                }
                else if (char === '>') {
                    foundEnd = true;
                    idx++;
                    break;
                }
                idx++;
            }
            if (!foundEnd)
                return innerXml;
            const tagContent = innerXml.substring(openIdx, idx);
            const escapedName = attrName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const attrRegex = new RegExp(`(\\b${escapedName}\\s*=\\s*)(["'])(.*?)\\2`, 'i');
            let newTagString = "";
            if (attrRegex.test(tagContent)) {
                newTagString = tagContent.replace(attrRegex, `$1$2${newValue}$2`);
            }
            else {
                const isSelfClosing = tagContent.trim().endsWith("/>");
                const closingPattern = isSelfClosing ? /\s*\/>$/ : /\s*>$/;
                const insertStr = ` ${attrName}="${newValue}"`;
                newTagString = tagContent.replace(closingPattern, (match) => {
                    return insertStr + (match.trim() === "/>" ? " />" : ">");
                });
            }
            return innerXml.substring(0, openIdx) + newTagString + innerXml.substring(idx);
        }
        else {
            const tag = `${baseIndent}<${currentTag} ${attrName}="${newValue}"/>`;
            const trimmed = innerXml.trim();
            if (trimmed.length === 0) {
                return "\n" + tag;
            }
            else {
                return innerXml.trimEnd() + "\n" + tag;
            }
        }
    }
    else {
        const openPattern = `<${currentTag}\\b`;
        const openIdx = innerXml.search(new RegExp(openPattern, 'i'));
        if (openIdx !== -1) {
            let depth = 1;
            let idx = openIdx;
            let foundOpeningEnd = false;
            let isSelfClosing = false;
            while (idx < innerXml.length) {
                const char = innerXml[idx];
                if (char === '"') {
                    idx = innerXml.indexOf('"', idx + 1);
                    if (idx === -1)
                        idx = innerXml.length;
                }
                else if (char === "'") {
                    idx = innerXml.indexOf("'", idx + 1);
                    if (idx === -1)
                        idx = innerXml.length;
                }
                else if (char === '>') {
                    foundOpeningEnd = true;
                    isSelfClosing = innerXml.substring(Math.max(0, idx - 1), idx).startsWith("/");
                    idx++;
                    break;
                }
                idx++;
            }
            if (!foundOpeningEnd)
                return innerXml;
            if (isSelfClosing) {
                const tagHeader = innerXml.substring(openIdx, idx - 2);
                const innerContent = updateChildAttributeInXmlBlock("", segments.slice(1), attrName, newValue, baseIndent + indentStep, indentStep);
                const expanded = `${tagHeader}>\n${innerContent.trimStart()}\n${baseIndent}</${currentTag}>`;
                return innerXml.substring(0, openIdx) + expanded + innerXml.substring(idx);
            }
            const openTagPattern = `<${currentTag}`;
            const closeTagPattern = `</${currentTag}>`;
            let tempIdx = idx;
            let closeIdx = -1;
            while (tempIdx < innerXml.length) {
                const nextOpen = innerXml.indexOf(openTagPattern, tempIdx);
                const nextClose = innerXml.indexOf(closeTagPattern, tempIdx);
                if (nextOpen === -1 && nextClose === -1)
                    break;
                if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
                    depth++;
                    tempIdx = nextOpen + openTagPattern.length;
                }
                else {
                    depth--;
                    if (depth === 0) {
                        closeIdx = nextClose;
                        break;
                    }
                    tempIdx = nextClose + closeTagPattern.length;
                }
            }
            if (closeIdx === -1)
                return innerXml;
            const tagContentStart = idx;
            const tagContentEnd = closeIdx;
            const childInnerXml = innerXml.substring(tagContentStart, tagContentEnd);
            const updatedChildInner = updateChildAttributeInXmlBlock(childInnerXml, segments.slice(1), attrName, newValue, baseIndent + indentStep, indentStep);
            return innerXml.substring(0, tagContentStart) + updatedChildInner + innerXml.substring(tagContentEnd);
        }
        else {
            let block = `${baseIndent}<${currentTag}>`;
            const innerContent = updateChildAttributeInXmlBlock("", segments.slice(1), attrName, newValue, baseIndent + indentStep, indentStep);
            block += innerContent;
            block += `\n${baseIndent}</${currentTag}>`;
            const trimmed = innerXml.trim();
            if (trimmed.length === 0) {
                return "\n" + block;
            }
            else {
                return innerXml.trimEnd() + "\n" + block;
            }
        }
    }
}
function validateXmlBlock(tagName, block) {
    const openCount = (block.match(new RegExp(`<${tagName}\\b`, 'g')) || []).length;
    const selfCloseCount = (block.match(new RegExp(`<${tagName}\\b[^>]*?\\/>`, 'g')) || []).length;
    const closeCount = (block.match(new RegExp(`</${tagName}>`, 'g')) || []).length;
    return openCount === (selfCloseCount + closeCount);
}
function updateChildElementInXml(xmlText, parentTag, docId, docName, fieldDef, newValue, lineNumber, attributeName) {
    const bounds = findParentElementBounds(xmlText, parentTag, docId, docName, lineNumber);
    if (!bounds) {
        console.error(`[MuleViz] Parent element bounds not found for ${parentTag}`);
        return xmlText;
    }
    const parentBlock = xmlText.substring(bounds.startIdx, bounds.endIdx);
    const parentLine = xmlText.substring(0, bounds.startIdx).split("\n").pop() || "";
    const parentIndent = parentLine.match(/^([ \t]*)/)?.[1] || "";
    let indentStep = "    ";
    let childIndent = parentIndent + indentStep;
    const siblingIndentMatch = parentBlock.match(/\n([ \t]+)</);
    if (siblingIndentMatch) {
        childIndent = siblingIndentMatch[1];
        if (childIndent.startsWith(parentIndent)) {
            indentStep = childIndent.substring(parentIndent.length);
        }
    }
    let openingEnd = 0;
    let inDoubleQuote = false;
    let inSingleQuote = false;
    while (openingEnd < parentBlock.length) {
        const char = parentBlock[openingEnd];
        if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        }
        else if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
        }
        else if (char === '>' && !inDoubleQuote && !inSingleQuote) {
            openingEnd++;
            break;
        }
        openingEnd++;
    }
    const isSelfClosing = parentBlock.substring(0, openingEnd).trim().endsWith("/>");
    const closingStart = parentBlock.lastIndexOf(`</${parentTag}>`);
    let innerXml = "";
    let tagHeader = parentBlock.substring(0, openingEnd);
    if (isSelfClosing) {
        tagHeader = tagHeader.trim().replace(/\/?>$/, ">");
    }
    else if (closingStart !== -1) {
        innerXml = parentBlock.substring(openingEnd, closingStart);
    }
    else {
        tagHeader = tagHeader.trim().replace(/>$/, ">");
    }
    let updatedInnerXml = "";
    if (fieldDef.type === "attrs") {
        const dotIdx = attributeName.indexOf(".");
        const pathKey = dotIdx !== -1 ? attributeName.substring(0, dotIdx) : fieldDef.key;
        const attrName = dotIdx !== -1 ? attributeName.substring(dotIdx + 1) : "";
        const pathSegments = pathKey.split(">");
        updatedInnerXml = updateChildAttributeInXmlBlock(innerXml, pathSegments, attrName, newValue, childIndent, indentStep);
    }
    else {
        const pathSegments = fieldDef.key.split(">");
        updatedInnerXml = updateNestedSegments(innerXml, pathSegments, 0, newValue, fieldDef.type, childIndent, indentStep);
    }
    let newBlock = tagHeader + updatedInnerXml;
    if (isSelfClosing || closingStart === -1) {
        newBlock += `\n${parentIndent}</${parentTag}>`;
    }
    else {
        newBlock += parentBlock.substring(closingStart);
    }
    if (!validateXmlBlock(parentTag, newBlock)) {
        console.error(`[MuleViz] Writeback aborted — XML validation failed for ${parentTag}`);
        return xmlText;
    }
    console.log(`[MuleViz] Writeback success: ${parentTag} field ${fieldDef.key} updated`);
    return xmlText.substring(0, bounds.startIdx) + newBlock + xmlText.substring(bounds.endIdx);
}
async function sendConnectorCatalog(context) {
    if (!panel)
        return;
    // PHASE 1: Group all TAG_META entries by namespace prefix (synchronous)
    const allowedPrefixes = [
        "http", "ee", "db", "jms", "vm", "ftp", "sftp",
        "amqp", "file", "salesforce", "validation",
        "crypto", "oauth2", "apikit", "scheduler"
    ];
    const groups = new Map();
    groups.set("", new Set()); // Mule Core
    for (const p of allowedPrefixes) {
        groups.set(p, new Set());
    }
    for (const tag of Object.keys(muleParser_1.TAG_META)) {
        let prefix = "";
        let localName = tag;
        if (tag.includes(":")) {
            const parts = tag.split(":");
            prefix = parts[0];
            localName = parts[1];
        }
        if (prefix === "https") {
            prefix = "http";
        }
        if (groups.has(prefix)) {
            groups.get(prefix).add(localName);
        }
    }
    const catalog = [];
    // 0. Add Mule Structure (top-level structural elements)
    catalog.push({
        prefix: "",
        connector: "Mule Structure",
        operations: ["flow", "sub-flow", "error-handler", "on-error-propagate", "on-error-continue"],
    });
    // 1. Add Mule Core
    catalog.push({
        prefix: "",
        connector: "Mule Core",
        operations: Array.from(groups.get("")),
    });
    // 2. Add other static groups
    for (const prefix of allowedPrefixes) {
        catalog.push({
            prefix,
            connector: `${prefix}-connector`,
            operations: Array.from(groups.get(prefix)),
        });
    }
    // Send static catalog immediately (instant)
    void panel.webview.postMessage({
        command: "connectorCatalog",
        catalog,
    });
    // PHASE 2 (async, enrichment only)
    void (async () => {
        try {
            const pomDeps = await ensurePomDeps();
            for (const prefix of currentNamespaces.keys()) {
                if (prefix === "mule" || prefix === "xsi" || prefix === "doc" || prefix === "") {
                    continue;
                }
                const nsUri = currentNamespaces.get(prefix) ?? "";
                const dep = (0, connectorRegistry_1.matchDepToPrefix)(prefix, nsUri, pomDeps);
                if (!dep) {
                    continue; // No matching POM dep, skip JAR fetch
                }
                // Fetch operations asynchronously
                (0, connectorRegistry_1.getConnectorOperations)(prefix, currentNamespaces, pomDeps, context.globalStorageUri, currentPomRepoUrls).then((ops) => {
                    if (panel && ops && ops.length > 0) {
                        const connectorName = dep.artifactId;
                        const opNames = ops.map(o => o.name);
                        const existingIndex = catalog.findIndex(c => c.prefix === prefix);
                        if (existingIndex !== -1) {
                            catalog[existingIndex] = {
                                prefix,
                                connector: connectorName,
                                operations: opNames,
                            };
                        }
                        else {
                            catalog.push({
                                prefix,
                                connector: connectorName,
                                operations: opNames,
                            });
                        }
                        // Send updated catalog to the webview
                        void panel.webview.postMessage({
                            command: "connectorCatalog",
                            catalog: [...catalog],
                        });
                    }
                }).catch((err) => {
                    console.warn(`[MuleViz] Silent failure fetching operations for prefix "${prefix}":`, err);
                });
            }
        }
        catch (err) {
            console.warn("[MuleViz] Phase 2 POM dependency resolution failed silently:", err);
        }
    })();
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
    // If anchor is a flow/sub-flow container, insert INSIDE it (after opening tag)
    // not after the closing tag
    const isFlowAnchor = insertAfterTagName === "flow" || insertAfterTagName === "sub-flow";
    if (isFlowAnchor) {
        // For empty flows, insert right after the opening <flow>...</flow> start tag
        // currentLineIdx/charIdx already point to just past the > of the opening tag
        endLineIdx = currentLineIdx;
        endCharIdx = charIdx;
    }
    // Reconstruct insertion text with proper indent
    const startLineText = lines[lineIdx];
    const indentMatch = startLineText.match(/^([ \t]*)/);
    const baseIndent = indentMatch ? indentMatch[1] : "  ";
    // If inserting inside a flow container, go one level deeper
    const indent = isFlowAnchor ? baseIndent + "    " : baseIndent;
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
// ── Insert a new Flow or Sub-Flow ─────────────────────────────────────────────
async function insertFlowInXml(document, kind, name) {
    const xmlText = document.getText();
    const lines = xmlText.split("\n");
    // Find existing flows to generate a unique name
    const existingNames = [];
    for (const line of lines) {
        const m = line.match(/<(?:flow|sub-flow)\s[^>]*name="([^"]*)"/);
        if (m)
            existingNames.push(m[1]);
    }
    let finalName = name;
    let counter = 1;
    while (existingNames.includes(finalName)) {
        finalName = `${name}-${counter}`;
        counter++;
    }
    // Find the closing </mule> tag
    let muleCloseIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes("</mule>")) {
            muleCloseIdx = i;
            break;
        }
    }
    if (muleCloseIdx === -1) {
        console.error("[MuleViz] Cannot find </mule> closing tag");
        return false;
    }
    // Detect indentation from existing flows
    let indent = "    "; // default 4 spaces
    for (const line of lines) {
        const fm = line.match(/^(\s+)<(?:flow|sub-flow)\s/);
        if (fm) {
            indent = fm[1];
            break;
        }
    }
    const tag = kind === "sub-flow" ? "sub-flow" : "flow";
    const docName = finalName.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const insertText = `${indent}<${tag} name="${finalName}" doc:name="${docName}">\n${indent}</${tag}>\n`;
    const insertPos = new vscode.Position(muleCloseIdx, 0);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, insertPos, insertText);
    return vscode.workspace.applyEdit(edit);
}
// ── Insert error-handler block into a flow ────────────────────────────────────
async function insertErrorHandlerInXml(document, flowLineNumber, flowName, flowKind) {
    const xmlText = document.getText();
    const lines = xmlText.split("\n");
    const tag = flowKind === "sub-flow" ? "sub-flow" : "flow";
    // Find the closing </flow> or </sub-flow> for the target flow
    const flowOpenIdx = flowLineNumber - 1;
    let closeIdx = -1;
    let depth = 0;
    for (let i = flowOpenIdx; i < lines.length; i++) {
        const line = lines[i];
        // Count opening tags for this flow type
        const openMatch = line.match(new RegExp(`<${tag}[\\s>]`));
        const closeMatch = line.match(new RegExp(`</${tag}>`));
        if (openMatch)
            depth++;
        if (closeMatch) {
            depth--;
            if (depth === 0) {
                closeIdx = i;
                break;
            }
        }
    }
    if (closeIdx === -1) {
        console.error(`[MuleViz] Cannot find closing </${tag}> for flow at line ${flowLineNumber}`);
        return false;
    }
    // Detect indentation
    const flowLine = lines[flowOpenIdx];
    const indentMatch = flowLine.match(/^(\s*)/);
    const baseIndent = indentMatch ? indentMatch[1] : "";
    const stepIndent = baseIndent + "    "; // one level deeper
    const stratIndent = stepIndent + "    "; // two levels deeper
    const insertText = `${stepIndent}<error-handler>\n` +
        `${stratIndent}<on-error-propagate enableNotifications="true" logException="true" doc:name="On Error Propagate" type="ANY">\n` +
        `${stratIndent}    <logger level="ERROR" doc:name="Log Error" message="Error: #[error.description]" />\n` +
        `${stratIndent}</on-error-propagate>\n` +
        `${stepIndent}</error-handler>\n`;
    const insertPos = new vscode.Position(closeIdx, 0);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, insertPos, insertText);
    return vscode.workspace.applyEdit(edit);
}
// ── Insert error strategy into existing error-handler ─────────────────────────
async function insertErrorStrategyInXml(document, flowLineNumber, flowName, strategyTag) {
    const xmlText = document.getText();
    const lines = xmlText.split("\n");
    // Find the <error-handler> within this flow
    const flowOpenIdx = flowLineNumber - 1;
    let errorHandlerCloseIdx = -1;
    let insideTargetFlow = false;
    let flowDepth = 0;
    // First, determine the flow's tag
    const flowLine = lines[flowOpenIdx];
    const flowTagMatch = flowLine.match(/<(flow|sub-flow)[\s>]/);
    const flowTag = flowTagMatch ? flowTagMatch[1] : "flow";
    for (let i = flowOpenIdx; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(new RegExp(`<${flowTag}[\\s>]`)))
            flowDepth++;
        if (line.match(new RegExp(`</${flowTag}>`))) {
            flowDepth--;
            if (flowDepth === 0)
                break; // exited the flow
        }
        if (line.includes("</error-handler>") && flowDepth === 1) {
            errorHandlerCloseIdx = i;
            break;
        }
    }
    if (errorHandlerCloseIdx === -1) {
        console.error(`[MuleViz] Cannot find </error-handler> within flow at line ${flowLineNumber}`);
        return false;
    }
    // Detect indentation from the </error-handler> line
    const ehCloseLine = lines[errorHandlerCloseIdx];
    const ehIndentMatch = ehCloseLine.match(/^(\s*)/);
    const ehIndent = ehIndentMatch ? ehIndentMatch[1] : "";
    const stratIndent = ehIndent + "    ";
    const labelParts = strategyTag.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const insertText = `${stratIndent}<${strategyTag} enableNotifications="true" logException="true" doc:name="${labelParts}" type="ANY">\n` +
        `${stratIndent}</${strategyTag}>\n`;
    const insertPos = new vscode.Position(errorHandlerCloseIdx, 0);
    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, insertPos, insertText);
    return vscode.workspace.applyEdit(edit);
}
//# sourceMappingURL=extension.js.map