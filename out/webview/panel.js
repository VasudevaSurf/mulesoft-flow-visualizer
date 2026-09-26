"use strict";
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
exports.FlowVisualizerPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const xmlParser_1 = require("../parser/xmlParser");
const semanticModel_1 = require("../parser/semanticModel");
const layout_1 = require("../layout");
const iconStore_1 = require("../catalog/iconStore");
const catalog_1 = require("../catalog");
const scanner_1 = require("../workspace/scanner");
const mavenRepo_1 = require("../workspace/mavenRepo");
const html_1 = require("./html");
class FlowVisualizerPanel {
    static createOrShow(extensionUri, xmlUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.ViewColumn.Beside
            : vscode.ViewColumn.One;
        if (FlowVisualizerPanel.currentPanel) {
            FlowVisualizerPanel.currentPanel.panel.reveal(column);
            if (xmlUri) {
                FlowVisualizerPanel.currentPanel.loadDocument(xmlUri);
            }
            return FlowVisualizerPanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel(FlowVisualizerPanel.viewType, 'Mule Flow Visualizer', column, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [extensionUri],
        });
        FlowVisualizerPanel.currentPanel = new FlowVisualizerPanel(panel, extensionUri, xmlUri);
        return FlowVisualizerPanel.currentPanel;
    }
    constructor(panel, extensionUri, xmlUri) {
        this.disposables = [];
        this.currentDocUri = null;
        this.debounceTimer = null;
        this.isSyncingFromWebview = false;
        this.lastModel = null;
        this.lastScene = null;
        this.collapsedNodeIds = new Set();
        this.panel = panel;
        this.extensionUri = extensionUri;
        // Set HTML content
        this.panel.webview.html = html_1.WebviewHtmlBuilder.build(this.panel.webview, extensionUri);
        // Message handler from Webview
        this.panel.webview.onDidReceiveMessage((message) => this.handleWebviewMessage(message), null, this.disposables);
        // Watch for document changes (live update with 250ms debounce)
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (this.currentDocUri && e.document.uri.fsPath === this.currentDocUri.fsPath) {
                this.triggerUpdateDebounced();
            }
        }, null, this.disposables);
        // Watch cursor selection in active editor for selection sync
        vscode.window.onDidChangeTextEditorSelection((e) => {
            if (this.isSyncingFromWebview) {
                return;
            }
            if (this.currentDocUri && e.textEditor.document.uri.fsPath === this.currentDocUri.fsPath) {
                this.syncEditorCursorToWebview(e.selections[0].active);
            }
        }, null, this.disposables);
        // Watch active editor switch
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.languageId === 'xml') {
                const text = editor.document.getText();
                if (scanner_1.WorkspaceScanner.isMuleXml(text)) {
                    this.loadDocument(editor.document.uri);
                }
            }
        }, null, this.disposables);
        // Cleanup on dispose
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        // Initial load
        if (xmlUri) {
            this.loadDocument(xmlUri);
        }
        else if (vscode.window.activeTextEditor) {
            this.loadDocument(vscode.window.activeTextEditor.document.uri);
        }
    }
    async loadDocument(uri) {
        this.currentDocUri = uri;
        this.panel.title = `Flow: ${path.basename(uri.fsPath)}`;
        // Resolve Maven dependencies for this project asynchronously
        const pomPath = scanner_1.WorkspaceScanner.findNearestPom(uri.fsPath);
        if (pomPath) {
            const config = vscode.workspace.getConfiguration('muleFlow');
            const customM2 = config.get('mavenLocalRepository');
            const mavenRepo = new mavenRepo_1.MavenRepo(customM2);
            catalog_1.ExtensionCatalog.loadProjectConnectors(pomPath, mavenRepo)
                .then(() => {
                // Re-render once connector descriptors and official icons are loaded
                this.updateView();
            })
                .catch((e) => {
                console.warn('Connector resolution encountered error:', e);
            });
        }
        await this.updateView();
    }
    triggerUpdateDebounced() {
        const config = vscode.workspace.getConfiguration('muleFlow');
        const debounceMs = config.get('debounceMs') ?? 250;
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.updateView();
        }, debounceMs);
    }
    async updateView() {
        if (!this.currentDocUri) {
            return;
        }
        try {
            const document = await vscode.workspace.openTextDocument(this.currentDocUri);
            const text = document.getText();
            const { root, error } = xmlParser_1.MuleXmlParser.parse(text);
            if (error) {
                this.postMessage({
                    type: 'showWarning',
                    message: `XML Parse Notice: ${error}. Showing last valid layout.`,
                });
            }
            if (!root) {
                return;
            }
            const model = semanticModel_1.SemanticModelBuilder.build(root, this.currentDocUri.fsPath);
            const config = vscode.workspace.getConfiguration('muleFlow');
            const collapseOption = config.get('collapseErrorHandlers') || 'auto';
            const theme = config.get('theme') || 'vscode';
            // Restore collapse state recursively for flows, containers, and error bands
            const applyCollapseState = (node) => {
                if (this.collapsedNodeIds.has(node.id)) {
                    node.collapsed = true;
                }
                for (const child of node.chain) {
                    applyCollapseState(child);
                }
                for (const route of node.routes) {
                    for (const child of route.chain) {
                        applyCollapseState(child);
                    }
                }
            };
            const defaultErrCollapsed = (collapseOption === 'always' || (collapseOption === 'auto' && model.flows.length > 8));
            for (const f of model.flows) {
                if (this.collapsedNodeIds.has(f.id)) {
                    f.collapsed = true;
                }
                const errBandId = `${f.id}:errorBand`;
                if (this.collapsedNodeIds.has(errBandId)) {
                    f.errorBandCollapsed = !defaultErrCollapsed;
                }
                else {
                    f.errorBandCollapsed = defaultErrCollapsed;
                }
                if (f.source) {
                    applyCollapseState(f.source);
                }
                for (const child of f.chain) {
                    applyCollapseState(child);
                }
                for (const route of f.errorHandler) {
                    for (const child of route.chain) {
                        applyCollapseState(child);
                    }
                }
            }
            const scene = (0, layout_1.layout)(model, { collapseErrorHandlers: collapseOption });
            this.lastModel = model;
            this.lastScene = scene;
            this.postMessage({
                type: 'updateModel',
                model,
                scene,
                symbolsSvg: iconStore_1.IconStore.getAllSymbols(),
                theme,
            });
        }
        catch (e) {
            console.error('Failed to update Mule Flow view:', e);
        }
    }
    handleWebviewMessage(msg) {
        switch (msg.type) {
            case 'ready':
                this.updateView();
                break;
            case 'revealXml':
                this.revealXmlRange(msg.range);
                break;
            case 'toggleCollapse':
                if (this.collapsedNodeIds.has(msg.nodeId)) {
                    this.collapsedNodeIds.delete(msg.nodeId);
                }
                else {
                    this.collapsedNodeIds.add(msg.nodeId);
                }
                this.updateView();
                break;
            case 'navigateFlowRef':
                this.handleFlowRefNavigation(msg.flowName);
                break;
            case 'exportScene':
                this.handleExport(msg.format);
                break;
        }
    }
    async revealXmlRange(range) {
        if (!this.currentDocUri)
            return;
        this.isSyncingFromWebview = true;
        try {
            const editor = await vscode.window.showTextDocument(this.currentDocUri, {
                viewColumn: vscode.ViewColumn.One,
                preserveFocus: false,
            });
            const vsRange = new vscode.Range(new vscode.Position(range.startLine, range.startCol), new vscode.Position(range.endLine, range.endCol));
            editor.selection = new vscode.Selection(vsRange.start, vsRange.end);
            editor.revealRange(vsRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        }
        finally {
            setTimeout(() => {
                this.isSyncingFromWebview = false;
            }, 100);
        }
    }
    async syncEditorCursorToWebview(pos) {
        if (!this.lastModel)
            return;
        const line = pos.line;
        const col = pos.character;
        // Search for the innermost node enclosing this position
        let bestNode = null;
        let minSpan = Number.MAX_VALUE;
        const checkNode = (node) => {
            const r = node.range;
            if ((line > r.startLine || (line === r.startLine && col >= r.startCol)) &&
                (line < r.endLine || (line === r.endLine && col <= r.endCol))) {
                const span = (r.endLine - r.startLine) * 1000 + (r.endCol - r.startCol);
                if (span < minSpan) {
                    minSpan = span;
                    bestNode = node;
                }
            }
            for (const child of node.chain) {
                checkNode(child);
            }
            for (const route of node.routes) {
                for (const child of route.chain) {
                    checkNode(child);
                }
            }
        };
        for (const flow of this.lastModel.flows) {
            if (flow.source) {
                checkNode(flow.source);
            }
            for (const node of flow.chain) {
                checkNode(node);
            }
            for (const r of flow.errorHandler) {
                for (const child of r.chain) {
                    checkNode(child);
                }
            }
        }
        if (bestNode) {
            this.postMessage({
                type: 'selectNode',
                nodeId: bestNode.id,
                range: bestNode.range,
            });
        }
    }
    async handleFlowRefNavigation(flowName) {
        // Check if target is in another XML file in workspace
        const allFiles = await scanner_1.WorkspaceScanner.findMuleXmlFiles();
        for (const fileUri of allFiles) {
            try {
                const doc = await vscode.workspace.openTextDocument(fileUri);
                const text = doc.getText();
                if (text.includes(`name="${flowName}"`)) {
                    // Open diagram for this file
                    FlowVisualizerPanel.createOrShow(this.extensionUri, fileUri);
                    return;
                }
            }
            catch {
                // Skip
            }
        }
        vscode.window.showInformationMessage(`Flow "${flowName}" not found in workspace.`);
    }
    async handleExport(format) {
        if (!this.lastScene)
            return;
        const saveUri = await vscode.window.showSaveDialog({
            filters: format === 'svg' ? { SVG: ['svg'] } : { PNG: ['png'] },
            saveLabel: `Export as ${format.toUpperCase()}`,
        });
        if (!saveUri)
            return;
        // We can export SVG directly
        const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${this.lastScene.totalWidth}" height="${this.lastScene.totalHeight}" viewBox="0 0 ${this.lastScene.totalWidth} ${this.lastScene.totalHeight}">`;
        const symbols = iconStore_1.IconStore.getAllSymbols();
        const arrowMarker = `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#90a4ae"/></marker>`;
        const defs = `<defs>${arrowMarker}\n${symbols}</defs>`;
        const fullSvg = `${svgHeader}\n${defs}\n<rect width="100%" height="100%" fill="#1e1e1e"/>\n<!-- Scene -->\n</svg>`;
        fs.writeFileSync(saveUri.fsPath, fullSvg, 'utf-8');
        vscode.window.showInformationMessage(`Exported flow diagram to ${path.basename(saveUri.fsPath)}`);
    }
    postMessage(message) {
        this.panel.webview.postMessage(message);
    }
    dispose() {
        FlowVisualizerPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d)
                d.dispose();
        }
    }
}
exports.FlowVisualizerPanel = FlowVisualizerPanel;
FlowVisualizerPanel.viewType = 'mulesoftFlowVisualizer';
//# sourceMappingURL=panel.js.map