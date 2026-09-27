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
const connectionTester_1 = require("../workspace/connectionTester");
const html_1 = require("./html");
const extensionModelReader_1 = require("../catalog/extensionModelReader");
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
            case 'showProperties':
                this.handleShowProperties(msg);
                break;
            case 'createConfiguration':
                this.handleCreateConfiguration(msg);
                break;
            case 'updateConfigRef':
                this.handleUpdateConfigRef(msg);
                break;
            case 'testConnection':
                this.handleTestConnection(msg);
                break;
            case 'updateParameterValue':
                this.handleUpdateParameterValue(msg);
                break;
        }
    }
    async handleShowProperties(msg) {
        // 1. Check if the clicked node is itself a Configuration element
        const isConfig = msg.isConfiguration ||
            msg.localName.endsWith('-config') ||
            msg.localName.endsWith('config') ||
            msg.localName.includes('configuration');
        if (isConfig) {
            // Find the gNode in lastModel to merge child connection attributes (e.g. <http:listener-connection>)
            const mergedAttributes = { ...msg.attributes };
            const gNode = this.lastModel?.globalConfigs.find((g) => g.id === msg.nodeId);
            let childConnectionTag;
            if (gNode && gNode.chain) {
                for (const childNode of gNode.chain) {
                    if (childNode.attributes) {
                        Object.assign(mergedAttributes, childNode.attributes);
                    }
                    if (childNode.descriptor?.localName) {
                        childConnectionTag = childNode.descriptor.localName.toLowerCase();
                    }
                }
            }
            const configModel = await catalog_1.ExtensionCatalog.getConfigurationModel(msg.namespaceUri, msg.localName);
            if (configModel) {
                const displayName = configModel.displayName || (0, extensionModelReader_1.toDisplayLabel)(msg.localName);
                const iconId = undefined;
                // Configuration's own parameter groups (without connection tab)
                const groups = configModel.groups
                    .filter((g) => g.name.toLowerCase() !== 'connection')
                    .map((group) => ({
                    name: group.name,
                    parameters: group.parameters.map((p) => {
                        const actualVal = mergedAttributes[p.name];
                        return {
                            ...p,
                            defaultValue: actualVal !== undefined ? actualVal : p.defaultValue,
                        };
                    }),
                }));
                // ADD Connection tab (ONLY when clicked node is itself a Configuration element)
                let matchedProvider;
                if (configModel.connectionProviders && configModel.connectionProviders.length > 0) {
                    if (childConnectionTag) {
                        matchedProvider = configModel.connectionProviders.find((p) => {
                            const pId = (p.id || p.name || '').toLowerCase().replace(/[-_]/g, '');
                            const tagNormalized = childConnectionTag.replace(/[-_]/g, '');
                            return tagNormalized.includes(pId) || pId.includes(tagNormalized.replace(/connection$/, ''));
                        });
                    }
                    if (!matchedProvider) {
                        matchedProvider = configModel.connectionProviders.find((p) => {
                            const pParams = p.parameters || (p.groups ? p.groups.flatMap((grp) => grp.parameters) : []);
                            return pParams.some((param) => mergedAttributes[param.name] !== undefined);
                        }) || configModel.connectionProviders[0];
                    }
                }
                else if (configModel.connectionProvider) {
                    matchedProvider = configModel.connectionProvider;
                }
                let connectionParams = [];
                if (matchedProvider) {
                    if (matchedProvider.parameters && matchedProvider.parameters.length > 0) {
                        connectionParams = matchedProvider.parameters;
                    }
                    else if (matchedProvider.groups) {
                        connectionParams = matchedProvider.groups.flatMap((grp) => grp.parameters);
                    }
                }
                if (connectionParams.length > 0) {
                    const clonedConnParams = connectionParams.map((p) => {
                        const actualVal = mergedAttributes[p.name];
                        return {
                            ...p,
                            defaultValue: actualVal !== undefined ? actualVal : p.defaultValue,
                        };
                    });
                    groups.push({
                        name: 'Connection',
                        parameters: clonedConnParams,
                    });
                }
                const canTest = connectionTester_1.ConnectionTester.canTest(mergedAttributes, msg.namespaceUri, msg.localName);
                this.postMessage({
                    type: 'updatePropertiesPanel',
                    nodeId: msg.nodeId,
                    displayName,
                    iconId,
                    groups,
                    currentValues: mergedAttributes,
                    isConfiguration: true,
                    testConnectionAvailable: canTest,
                    namespaceUri: msg.namespaceUri,
                    localName: msg.localName,
                });
                return;
            }
            else {
                // Fallback for Configuration elements when connector JAR model isn't available
                const connKeys = new Set(['host', 'port', 'protocol', 'basePath', 'url', 'user', 'password', 'database']);
                const configParams = [];
                const connParams = [];
                for (const [k, v] of Object.entries(mergedAttributes)) {
                    if (k === 'name' || k === 'doc:name' || k === 'doc:id')
                        continue;
                    const param = {
                        ...(0, extensionModelReader_1.buildParameterModel)({ name: k, defaultValue: v, required: false, group: 'General' }),
                        defaultValue: v,
                    };
                    if (connKeys.has(k)) {
                        connParams.push(param);
                    }
                    else {
                        configParams.push(param);
                    }
                }
                const groups = [];
                if (configParams.length > 0) {
                    groups.push({ name: 'General', parameters: configParams });
                }
                if (connParams.length > 0) {
                    groups.push({ name: 'Connection', parameters: connParams });
                }
                const canTest = connectionTester_1.ConnectionTester.canTest(mergedAttributes, msg.namespaceUri, msg.localName);
                this.postMessage({
                    type: 'updatePropertiesPanel',
                    nodeId: msg.nodeId,
                    displayName: (0, extensionModelReader_1.toDisplayLabel)(msg.localName),
                    iconId: undefined,
                    groups,
                    currentValues: mergedAttributes,
                    isConfiguration: true,
                    testConnectionAvailable: canTest,
                    namespaceUri: msg.namespaceUri,
                    localName: msg.localName,
                });
                return;
            }
        }
        // 2. Regular operations and message sources (Connection tab is NOT shown)
        const componentModel = await catalog_1.ExtensionCatalog.getOperationOrSourceModel(msg.namespaceUri, msg.localName);
        // Look up configuration model for this component
        const configInfo = await catalog_1.ExtensionCatalog.getConfigurationModelForComponent(msg.namespaceUri, msg.localName);
        let configOptions = [];
        if (configInfo) {
            configOptions = await scanner_1.WorkspaceScanner.findConfigurationNames(configInfo.configXmlTag, this.currentDocUri);
        }
        let displayName = msg.localName;
        let iconId;
        let groups = [];
        if (componentModel) {
            displayName = componentModel.displayName;
            iconId = componentModel.iconId;
            // Deep clone groups and merge in node's actual current attribute values
            groups = componentModel.groups.map((group) => ({
                name: group.name,
                parameters: group.parameters.map((p) => {
                    const actualVal = msg.attributes[p.name];
                    const isConfigRef = p.isReference && p.referenceType === 'configuration';
                    let opts;
                    if (isConfigRef) {
                        opts = [...configOptions];
                        if (actualVal && !opts.includes(actualVal)) {
                            opts.unshift(actualVal);
                        }
                    }
                    return {
                        ...p,
                        defaultValue: actualVal !== undefined ? actualVal : p.defaultValue,
                        configOptions: opts,
                        configModel: isConfigRef && configInfo ? configInfo.configModel : undefined,
                        configXmlTag: isConfigRef && configInfo ? configInfo.configXmlTag : undefined,
                    };
                }),
            }));
        }
        else {
            // Fallback for core components or unknown elements
            displayName = (0, extensionModelReader_1.toDisplayLabel)(msg.localName);
            const params = Object.entries(msg.attributes).map(([k, v]) => {
                const isConfigRef = k === 'config-ref' ||
                    k.toLowerCase().endsWith('configref') ||
                    k.toLowerCase().endsWith('-config-ref');
                let opts;
                if (isConfigRef) {
                    opts = [...configOptions];
                    if (v && !opts.includes(v)) {
                        opts.unshift(v);
                    }
                }
                return {
                    ...(0, extensionModelReader_1.buildParameterModel)({
                        name: k,
                        defaultValue: v,
                        required: false,
                        group: 'General',
                    }),
                    configOptions: opts,
                    configModel: isConfigRef && configInfo ? configInfo.configModel : undefined,
                    configXmlTag: isConfigRef && configInfo ? configInfo.configXmlTag : undefined,
                };
            });
            groups = (0, extensionModelReader_1.groupParameters)(params);
        }
        this.postMessage({
            type: 'updatePropertiesPanel',
            nodeId: msg.nodeId,
            displayName,
            iconId,
            groups,
            currentValues: msg.attributes,
        });
    }
    async handleCreateConfiguration(msg) {
        const targetUri = await scanner_1.WorkspaceScanner.findTargetConfigFile(this.currentDocUri);
        if (!targetUri) {
            vscode.window.showErrorMessage('Unable to locate a Mule XML file in the project to insert configuration.');
            return;
        }
        // Build the configuration XML element string
        let attrsStr = `name="${FlowVisualizerPanel.escapeXml(msg.configName)}"`;
        for (const [k, v] of Object.entries(msg.attributes)) {
            if (k === 'name' || k.startsWith('_'))
                continue;
            if (v !== undefined && v !== null && String(v).trim() !== '') {
                attrsStr += ` ${k}="${FlowVisualizerPanel.escapeXml(String(v))}"`;
            }
        }
        const elementXml = `<${msg.configXmlTag} ${attrsStr} />`;
        const workspaceEdit = new vscode.WorkspaceEdit();
        // 1. Insert configuration into target file
        const targetDoc = await vscode.workspace.openTextDocument(targetUri);
        const targetText = targetDoc.getText();
        const muleTagMatch = targetText.match(/<([a-zA-Z0-9_-]+:)?mule\b[^>]*>/);
        if (muleTagMatch && muleTagMatch.index !== undefined) {
            const insertOffset = muleTagMatch.index + muleTagMatch[0].length;
            const insertPos = targetDoc.positionAt(insertOffset);
            workspaceEdit.insert(targetUri, insertPos, `\n\t${elementXml}\n`);
        }
        else {
            const closingMuleMatch = targetText.match(/<\/([a-zA-Z0-9_-]+:)?mule>/);
            if (closingMuleMatch && closingMuleMatch.index !== undefined) {
                const insertPos = targetDoc.positionAt(closingMuleMatch.index);
                workspaceEdit.insert(targetUri, insertPos, `\t${elementXml}\n`);
            }
        }
        // 2. Set the original config-ref field to the newly created element's name attribute
        if (this.currentDocUri && this.lastModel) {
            const node = this.findNodeInModel(this.lastModel, msg.targetNodeId);
            if (node) {
                const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
                const nodeStartPos = new vscode.Position(node.range.startLine, node.range.startCol);
                const nodeEndPos = new vscode.Position(node.range.endLine, node.range.endCol);
                const nodeRange = new vscode.Range(nodeStartPos, nodeEndPos);
                const nodeText = curDoc.getText(nodeRange);
                const refAttr = msg.configRefParamName || 'config-ref';
                const regex = new RegExp(`\\b${refAttr}=("[^"]*"|'[^']*')`);
                const match = nodeText.match(regex);
                if (match && match.index !== undefined) {
                    const matchStartOffset = curDoc.offsetAt(nodeStartPos) + match.index;
                    const matchEndOffset = matchStartOffset + match[0].length;
                    const matchRange = new vscode.Range(curDoc.positionAt(matchStartOffset), curDoc.positionAt(matchEndOffset));
                    workspaceEdit.replace(this.currentDocUri, matchRange, `${refAttr}="${msg.configName}"`);
                }
                else {
                    const tagMatch = nodeText.match(/^<([a-zA-Z0-9_-]+:)?([a-zA-Z0-9_-]+)/);
                    if (tagMatch) {
                        const insertOffset = curDoc.offsetAt(nodeStartPos) + tagMatch[0].length;
                        const insertPos = curDoc.positionAt(insertOffset);
                        workspaceEdit.insert(this.currentDocUri, insertPos, ` ${refAttr}="${msg.configName}"`);
                    }
                }
            }
        }
        const applied = await vscode.workspace.applyEdit(workspaceEdit);
        if (applied) {
            vscode.window.showInformationMessage(`Created configuration "${msg.configName}" in ${path.basename(targetUri.fsPath)}.`);
            await targetDoc.save();
            if (this.currentDocUri && this.currentDocUri.toString() !== targetUri.toString()) {
                const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
                await curDoc.save();
            }
        }
    }
    async handleUpdateConfigRef(msg) {
        if (!this.currentDocUri || !this.lastModel)
            return;
        const node = this.findNodeInModel(this.lastModel, msg.targetNodeId);
        if (!node)
            return;
        const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
        const nodeStartPos = new vscode.Position(node.range.startLine, node.range.startCol);
        const nodeEndPos = new vscode.Position(node.range.endLine, node.range.endCol);
        const nodeRange = new vscode.Range(nodeStartPos, nodeEndPos);
        const nodeText = curDoc.getText(nodeRange);
        const refAttr = msg.configRefParamName || 'config-ref';
        const regex = new RegExp(`\\b${refAttr}=("[^"]*"|'[^']*')`);
        const match = nodeText.match(regex);
        const workspaceEdit = new vscode.WorkspaceEdit();
        if (match && match.index !== undefined) {
            const matchStartOffset = curDoc.offsetAt(nodeStartPos) + match.index;
            const matchEndOffset = matchStartOffset + match[0].length;
            const matchRange = new vscode.Range(curDoc.positionAt(matchStartOffset), curDoc.positionAt(matchEndOffset));
            workspaceEdit.replace(this.currentDocUri, matchRange, `${refAttr}="${msg.configName}"`);
        }
        else {
            const tagMatch = nodeText.match(/^<([a-zA-Z0-9_-]+:)?([a-zA-Z0-9_-]+)/);
            if (tagMatch) {
                const insertOffset = curDoc.offsetAt(nodeStartPos) + tagMatch[0].length;
                const insertPos = curDoc.positionAt(insertOffset);
                workspaceEdit.insert(this.currentDocUri, insertPos, ` ${refAttr}="${msg.configName}"`);
            }
        }
        await vscode.workspace.applyEdit(workspaceEdit);
        await curDoc.save();
    }
    static escapeXml(unsafe) {
        return String(unsafe || '')
            .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }
    async handleUpdateParameterValue(msg) {
        if (!this.currentDocUri || !this.lastModel)
            return;
        const node = this.findNodeInModel(this.lastModel, msg.nodeId);
        if (!node)
            return;
        // Check if the parameter belongs to a child element (e.g. child connection element in config)
        let targetNode = node;
        if (node.chain && node.chain.length > 0) {
            const childWithAttr = node.chain.find((c) => c.attributes && c.attributes[msg.paramName] !== undefined);
            if (childWithAttr) {
                targetNode = childWithAttr;
            }
            else {
                const isConfig = node.descriptor?.kind === 'global-config' ||
                    (node.descriptor?.localName || '').endsWith('config');
                if (isConfig) {
                    const connChild = node.chain.find((c) => (c.descriptor?.localName || '').endsWith('connection') ||
                        (c.descriptor?.localName || '').includes('connection'));
                    if (connChild) {
                        const connKeys = new Set([
                            'host',
                            'port',
                            'protocol',
                            'user',
                            'password',
                            'database',
                            'url',
                            'usePersistentConnections',
                            'connectionIdleTimeout',
                            'readTimeout',
                            'streamResponse',
                            'responseBufferSize',
                            'maxConnections',
                            'clientSocketProperties',
                            'proxyConfig',
                            'tlsContext',
                            'reconnection',
                        ]);
                        if (connKeys.has(msg.paramName)) {
                            targetNode = connChild;
                        }
                    }
                }
            }
        }
        const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
        const nodeStartPos = new vscode.Position(targetNode.range.startLine, targetNode.range.startCol);
        const nodeEndPos = new vscode.Position(targetNode.range.endLine, targetNode.range.endCol);
        const nodeRange = new vscode.Range(nodeStartPos, nodeEndPos);
        const nodeText = curDoc.getText(nodeRange);
        // Locate the opening tag boundary in nodeText
        let openTagEnd = nodeText.length;
        let isSelfClosing = false;
        let inDouble = false;
        let inSingle = false;
        for (let i = 0; i < nodeText.length; i++) {
            const ch = nodeText[i];
            if (ch === '"' && !inSingle)
                inDouble = !inDouble;
            else if (ch === "'" && !inDouble)
                inSingle = !inSingle;
            else if (!inDouble && !inSingle) {
                if (ch === '>') {
                    isSelfClosing = i > 0 && nodeText[i - 1] === '/';
                    openTagEnd = i + 1;
                    break;
                }
            }
        }
        const openTag = nodeText.slice(0, openTagEnd);
        const workspaceEdit = new vscode.WorkspaceEdit();
        const escapedParam = msg.paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 1. Check if the attribute already exists on the opening tag
        const attrRegex = new RegExp(`\\b${escapedParam}\\s*=\\s*("[^"]*"|'[^']*')`);
        const match = openTag.match(attrRegex);
        if (match && match.index !== undefined) {
            if (msg.value === null || msg.value === undefined) {
                // Remove attribute
                const fullAttrRegex = new RegExp(`\\s+\\b${escapedParam}\\s*=\\s*("[^"]*"|'[^']*')`);
                const fullMatch = openTag.match(fullAttrRegex) || match;
                const startOffset = curDoc.offsetAt(nodeStartPos) + (fullMatch.index ?? match.index);
                const endOffset = startOffset + fullMatch[0].length;
                const matchRange = new vscode.Range(curDoc.positionAt(startOffset), curDoc.positionAt(endOffset));
                workspaceEdit.delete(this.currentDocUri, matchRange);
            }
            else {
                // Targeted replacement of just this one attribute
                const matchStartOffset = curDoc.offsetAt(nodeStartPos) + match.index;
                const matchEndOffset = matchStartOffset + match[0].length;
                const matchRange = new vscode.Range(curDoc.positionAt(matchStartOffset), curDoc.positionAt(matchEndOffset));
                const escapedVal = FlowVisualizerPanel.escapeXml(String(msg.value));
                workspaceEdit.replace(this.currentDocUri, matchRange, `${msg.paramName}="${escapedVal}"`);
            }
        }
        else {
            // 2. Attribute does not exist. Check if a child element exists for complex/list types
            const childRegex = new RegExp(`<([a-zA-Z0-9_-]+:)?${escapedParam}\\b[^>]*>[\\s\\S]*?<\\/([a-zA-Z0-9_-]+:)?${escapedParam}>|<([a-zA-Z0-9_-]+:)?${escapedParam}\\b[^>]*\\/>`);
            const childMatch = nodeText.match(childRegex);
            if (childMatch && childMatch.index !== undefined) {
                // Scoped replacement of existing child element
                const childStartOffset = curDoc.offsetAt(nodeStartPos) + childMatch.index;
                const childEndOffset = childStartOffset + childMatch[0].length;
                const childRange = new vscode.Range(curDoc.positionAt(childStartOffset), curDoc.positionAt(childEndOffset));
                const prefixMatch = childMatch[0].match(/^<([a-zA-Z0-9_-]+:)/);
                const prefix = prefixMatch ? prefixMatch[1] : '';
                let childContent = '';
                if (msg.dataType === 'list' && Array.isArray(msg.value)) {
                    childContent = msg.value
                        .map((v) => `<value>${FlowVisualizerPanel.escapeXml(String(v))}</value>`)
                        .join('');
                }
                else {
                    childContent = String(msg.value || '');
                }
                const newChildXml = `<${prefix}${msg.paramName}>${childContent}</${prefix}${msg.paramName}>`;
                workspaceEdit.replace(this.currentDocUri, childRange, newChildXml);
            }
            else if ((msg.dataType === 'complex-object' || msg.dataType === 'list') &&
                msg.value !== null &&
                msg.value !== undefined &&
                String(msg.value).trim() !== '') {
                // Scoped insertion of new child element
                const closingTagMatch = nodeText.match(/<\/([a-zA-Z0-9_-]+:)?([a-zA-Z0-9_-]+)>\s*$/);
                const tagPrefixMatch = openTag.match(/^<([a-zA-Z0-9_-]+:)/);
                const prefix = tagPrefixMatch ? tagPrefixMatch[1] : '';
                let childContent = '';
                if (msg.dataType === 'list' && Array.isArray(msg.value)) {
                    childContent = msg.value
                        .map((v) => `<value>${FlowVisualizerPanel.escapeXml(String(v))}</value>`)
                        .join('');
                }
                else {
                    childContent = String(msg.value || '');
                }
                if (closingTagMatch && closingTagMatch.index !== undefined) {
                    const insertOffset = curDoc.offsetAt(nodeStartPos) + closingTagMatch.index;
                    const insertPos = curDoc.positionAt(insertOffset);
                    const childXml = `\t<${prefix}${msg.paramName}>${childContent}</${prefix}${msg.paramName}>\n\t`;
                    workspaceEdit.insert(this.currentDocUri, insertPos, childXml);
                }
                else if (isSelfClosing) {
                    // Convert self-closing tag to open/close pair with child element
                    const closeOffset = curDoc.offsetAt(nodeStartPos) + (openTagEnd - 2);
                    const closePos = curDoc.positionAt(closeOffset);
                    const tagNameMatch = openTag.match(/^<(([a-zA-Z0-9_-]+:)?[a-zA-Z0-9_-]+)/);
                    const fullTagName = tagNameMatch ? tagNameMatch[1] : 'element';
                    const childXml = `>\n\t\t<${prefix}${msg.paramName}>${childContent}</${prefix}${msg.paramName}>\n\t</${fullTagName}>`;
                    const endPos = curDoc.positionAt(curDoc.offsetAt(nodeStartPos) + openTagEnd);
                    workspaceEdit.replace(this.currentDocUri, new vscode.Range(closePos, endPos), childXml);
                }
            }
            else if (msg.value !== null && msg.value !== undefined && String(msg.value) !== '') {
                // 3. Standard attribute insertion: insert into opening tag right before closing > or />
                const escapedVal = FlowVisualizerPanel.escapeXml(String(msg.value));
                if (isSelfClosing) {
                    const beforeSlash = openTag.slice(0, openTagEnd - 2);
                    const trailingWsMatch = beforeSlash.match(/\s+$/);
                    if (trailingWsMatch && trailingWsMatch.index !== undefined) {
                        const insertOffset = curDoc.offsetAt(nodeStartPos) + trailingWsMatch.index;
                        const insertPos = curDoc.positionAt(insertOffset);
                        workspaceEdit.insert(this.currentDocUri, insertPos, ` ${msg.paramName}="${escapedVal}"`);
                    }
                    else {
                        const insertOffset = curDoc.offsetAt(nodeStartPos) + (openTagEnd - 2);
                        const insertPos = curDoc.positionAt(insertOffset);
                        workspaceEdit.insert(this.currentDocUri, insertPos, ` ${msg.paramName}="${escapedVal}" `);
                    }
                }
                else {
                    const beforeGt = openTag.slice(0, openTagEnd - 1);
                    const trailingWsMatch = beforeGt.match(/\s+$/);
                    if (trailingWsMatch && trailingWsMatch.index !== undefined) {
                        const insertOffset = curDoc.offsetAt(nodeStartPos) + trailingWsMatch.index;
                        const insertPos = curDoc.positionAt(insertOffset);
                        workspaceEdit.insert(this.currentDocUri, insertPos, ` ${msg.paramName}="${escapedVal}"`);
                    }
                    else {
                        const insertOffset = curDoc.offsetAt(nodeStartPos) + (openTagEnd - 1);
                        const insertPos = curDoc.positionAt(insertOffset);
                        workspaceEdit.insert(this.currentDocUri, insertPos, ` ${msg.paramName}="${escapedVal}"`);
                    }
                }
            }
        }
        const applied = await vscode.workspace.applyEdit(workspaceEdit);
        if (applied) {
            if (targetNode.attributes) {
                if (msg.value === null || msg.value === undefined) {
                    delete targetNode.attributes[msg.paramName];
                }
                else {
                    targetNode.attributes[msg.paramName] = String(msg.value);
                }
            }
            if (node !== targetNode && node.attributes) {
                if (msg.value === null || msg.value === undefined) {
                    delete node.attributes[msg.paramName];
                }
                else {
                    node.attributes[msg.paramName] = String(msg.value);
                }
            }
            await curDoc.save();
        }
    }
    async handleTestConnection(msg) {
        try {
            const result = await connectionTester_1.ConnectionTester.test(msg.attributes, msg.namespaceUri, msg.localName);
            this.postMessage({
                type: 'testConnectionResult',
                success: result.success,
                message: result.message,
                durationMs: result.durationMs,
            });
        }
        catch (e) {
            this.postMessage({
                type: 'testConnectionResult',
                success: false,
                message: `Connection test error: ${e.message || String(e)}`,
            });
        }
    }
    findNodeInModel(model, id) {
        const searchNode = (n) => {
            if (n.id === id)
                return n;
            for (const c of n.chain) {
                const found = searchNode(c);
                if (found)
                    return found;
            }
            for (const r of n.routes) {
                for (const c of r.chain) {
                    const found = searchNode(c);
                    if (found)
                        return found;
                }
            }
            return null;
        };
        for (const g of model.globalConfigs) {
            const found = searchNode(g);
            if (found)
                return found;
        }
        for (const flow of model.flows) {
            if (flow.source) {
                const found = searchNode(flow.source);
                if (found)
                    return found;
            }
            for (const c of flow.chain) {
                const found = searchNode(c);
                if (found)
                    return found;
            }
            for (const r of flow.errorHandler) {
                for (const c of r.chain) {
                    const found = searchNode(c);
                    if (found)
                        return found;
                }
            }
        }
        return null;
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