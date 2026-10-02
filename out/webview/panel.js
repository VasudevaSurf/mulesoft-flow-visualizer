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
const coreCatalog_1 = require("../catalog/coreCatalog");
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
                    message: root
                        ? `XML Syntax Notice: ${error}`
                        : `XML Parse Notice: ${error}. Showing last valid layout.`,
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
                this.revealXmlRange(msg.range, msg.focusEditor);
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
            case 'addChoiceRoute':
                this.handleAddChoiceRoute(msg.nodeId);
                break;
            case 'deleteRoute':
                this.handleDeleteRoute(msg.routeId);
                break;
            case 'reorderChoiceRoutes':
                this.handleReorderChoiceRoutes(msg.nodeId, msg.fromIndex, msg.toIndex);
                break;
        }
    }
    async handleShowProperties(msg) {
        // Compute static-only autocomplete context (variables declared earlier, preceding transform output shape)
        let autocompleteContext = { variables: [] };
        if (this.currentDocUri && this.lastModel) {
            try {
                const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
                autocompleteContext = this.computeStaticAutocompleteContext(this.lastModel, msg.nodeId, curDoc.getText());
            }
            catch (err) {
                console.warn('Failed to compute static autocomplete context:', err);
            }
        }
        // 0. Check if the clicked node is a Transform Message (ee:transform or dw:transform-message)
        const isTransform = (msg.localName === 'transform' && (msg.namespaceUri === 'http://www.mulesoft.org/schema/mule/ee/core' || msg.namespaceUri?.includes('ee') || !msg.namespaceUri)) ||
            msg.localName === 'transform-message';
        if (isTransform) {
            let payloadScript = '%dw 2.0\noutput application/json\n---\n{\n}';
            let payloadResource = undefined;
            let hasPayload = false;
            let attributesScript = undefined;
            let attributesResource = undefined;
            const targetVariables = [];
            let outputType = 'application/json';
            const node = this.lastModel ? this.findNodeInModel(this.lastModel, msg.nodeId) : null;
            if (node) {
                const bodyContent = FlowVisualizerPanel.extractComponentBody(node, this.currentDocUri);
                hasPayload = !!bodyContent.hasPayload;
                if (bodyContent.primaryScript !== undefined) {
                    payloadScript = bodyContent.primaryScript;
                }
                payloadResource = bodyContent.payloadResource;
                if (bodyContent.hasAttributes || bodyContent.attributesScript !== undefined) {
                    attributesScript = bodyContent.attributesScript ?? '';
                }
                attributesResource = bodyContent.attributesResource;
                if (bodyContent.variables && bodyContent.variables.length > 0) {
                    targetVariables.push(...bodyContent.variables);
                }
                const outMatch = payloadScript.match(/output\s+([a-zA-Z0-9_\-\/]+)/);
                if (outMatch) {
                    outputType = outMatch[1];
                }
            }
            const coreTransform = coreCatalog_1.CORE_CATALOG[`${msg.namespaceUri}:${msg.localName}`] ||
                coreCatalog_1.CORE_CATALOG[msg.localName] ||
                coreCatalog_1.CORE_CATALOG['transform'];
            const transformGroups = (coreTransform?.groups || []).map((group) => ({
                name: group.name,
                parameters: group.parameters.map((p) => {
                    const actualVal = msg.attributes[p.name];
                    return {
                        ...p,
                        defaultValue: actualVal !== undefined ? actualVal : p.defaultValue,
                    };
                }),
            }));
            this.postMessage({
                type: 'updatePropertiesPanel',
                nodeId: msg.nodeId,
                displayName: 'Transform Message',
                iconId: 'core:transform',
                groups: transformGroups,
                currentValues: msg.attributes,
                isTransform: true,
                transformData: {
                    script: payloadScript,
                    payloadResource,
                    hasPayload,
                    attributesScript,
                    attributesResource,
                    targetVariables,
                    outputType,
                },
                autocompleteContext,
            });
            return;
        }
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
                    autocompleteContext,
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
                    autocompleteContext,
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
        const targetNode = this.lastModel ? this.findNodeInModel(this.lastModel, msg.nodeId) : null;
        const bodyContent = FlowVisualizerPanel.extractComponentBody(targetNode, this.currentDocUri);
        const combinedAttributes = {
            ...bodyContent.childValues,
            ...msg.attributes,
        };
        if (componentModel) {
            displayName = componentModel.displayName;
            iconId = componentModel.iconId;
            // Deep clone groups and merge in node's actual current attribute values
            groups = componentModel.groups.map((group) => ({
                name: group.name,
                parameters: group.parameters.map((p) => {
                    const actualVal = combinedAttributes[p.name];
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
            // Also append any extra attributes present in XML that weren't declared in the schema
            const coveredKeys = new Set(groups.flatMap((g) => g.parameters.map((p) => p.name)));
            const extraParams = [];
            for (const [k, v] of Object.entries(combinedAttributes)) {
                if (!coveredKeys.has(k) && k !== 'doc:id') {
                    extraParams.push({
                        ...(0, extensionModelReader_1.buildParameterModel)({ name: k, defaultValue: v, required: false, group: 'General' }),
                        defaultValue: v,
                    });
                }
            }
            if (extraParams.length > 0) {
                let generalGroup = groups.find((g) => g.name === 'General');
                if (!generalGroup) {
                    generalGroup = { name: 'General', parameters: [] };
                    groups.unshift(generalGroup);
                }
                generalGroup.parameters.push(...extraParams);
            }
        }
        else {
            // Fallback for core components or unknown elements
            displayName = (0, extensionModelReader_1.toDisplayLabel)(msg.localName);
            const params = Object.entries(combinedAttributes).map(([k, v]) => {
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
        // Ensure every component has a Documentation / Notes tab with doc:name and doc:description
        const hasNotes = groups.some(g => g.name.toLowerCase() === 'notes' || g.name.toLowerCase() === 'documentation');
        if (!hasNotes) {
            groups.push({
                name: 'Documentation',
                parameters: [
                    {
                        name: 'doc:name',
                        label: 'Display Name',
                        description: 'Display name for this component.',
                        dataType: 'string',
                        required: false,
                        group: 'Documentation',
                        supportsExpression: false,
                        isReference: false,
                        expressionSupport: 'NOT_SUPPORTED',
                        defaultValue: combinedAttributes['doc:name'] || displayName,
                    },
                    {
                        name: 'doc:description',
                        label: 'Description',
                        description: 'Component documentation and notes.',
                        dataType: 'string',
                        required: false,
                        group: 'Documentation',
                        supportsExpression: false,
                        isReference: false,
                        expressionSupport: 'NOT_SUPPORTED',
                        defaultValue: combinedAttributes['doc:description'] || '',
                    },
                ],
            });
        }
        const isRouter = targetNode?.descriptor?.kind === 'router' ||
            targetNode?.descriptor?.localName === 'choice' ||
            Boolean(targetNode?.routes && targetNode.routes.length > 0);
        const routerRoutes = isRouter && targetNode?.routes
            ? targetNode.routes.map((r) => ({
                id: r.id,
                kind: r.kind,
                expression: r.attributes?.['expression'] || r.attributes?.['when'] || '',
                label: r.label,
            }))
            : undefined;
        this.postMessage({
            type: 'updatePropertiesPanel',
            nodeId: msg.nodeId,
            displayName,
            iconId,
            groups,
            currentValues: combinedAttributes,
            isRouter,
            routerRoutes,
            autocompleteContext,
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
    static getProjectRoot(docFsPath) {
        let cur = path.dirname(path.resolve(docFsPath));
        const root = cur;
        while (cur && cur !== path.dirname(cur)) {
            if (fs.existsSync(path.join(cur, 'pom.xml')) ||
                fs.existsSync(path.join(cur, 'mule-artifact.json')) ||
                fs.existsSync(path.join(cur, '.project'))) {
                return cur;
            }
            cur = path.dirname(cur);
        }
        const match = docFsPath.match(/(.*?)[\\\/]src[\\\/]/i);
        if (match) {
            return path.resolve(match[1]);
        }
        return root;
    }
    static resolveDwlResourcePath(resPath, currentDocUri) {
        if (!resPath)
            return null;
        let clean = resPath.trim();
        if (clean.toLowerCase().startsWith('classpath:')) {
            clean = clean.slice('classpath:'.length).trim();
        }
        while (clean.startsWith('/') || clean.startsWith('\\')) {
            clean = clean.slice(1);
        }
        if (!clean)
            return null;
        const normalizedClean = clean.replace(/\\/g, '/');
        const docFsPath = currentDocUri?.fsPath;
        const xmlDir = docFsPath ? path.dirname(path.resolve(docFsPath)) : process.cwd();
        const projectRoot = docFsPath ? FlowVisualizerPanel.getProjectRoot(docFsPath) : xmlDir;
        // Ordered candidate locations:
        // 1. relative to the XML file
        // 2. <project>/src/main/resources/
        // 3. <project>/src/main/mule/
        // 4. <project>/src/test/resources/
        // 5. <project>/src/test/munit/
        const candidates = [
            path.resolve(xmlDir, normalizedClean),
            path.resolve(projectRoot, 'src', 'main', 'resources', normalizedClean),
            path.resolve(projectRoot, 'src', 'main', 'mule', normalizedClean),
            path.resolve(projectRoot, 'src', 'test', 'resources', normalizedClean),
            path.resolve(projectRoot, 'src', 'test', 'munit', normalizedClean),
        ];
        for (const cand of candidates) {
            try {
                if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
                    return cand;
                }
            }
            catch {
                // Continue checking next candidate
            }
        }
        return null;
    }
    static loadDwlResource(resPath, currentDocUri) {
        if (!resPath)
            return '';
        const resolvedPath = FlowVisualizerPanel.resolveDwlResourcePath(resPath, currentDocUri);
        if (resolvedPath) {
            try {
                return fs.readFileSync(resolvedPath, 'utf-8');
            }
            catch (err) {
                console.warn('Failed to read DWL file at:', resolvedPath, err);
            }
        }
        return `Resource not found: ${resPath}`;
    }
    /**
     * Generic reader that walks a component's Node.body structure to extract
     * payload script, target variables, and child element values without regex re-scraping.
     */
    static extractComponentBody(node, currentDocUri) {
        const result = {
            variables: [],
            childValues: {},
        };
        if (!node) {
            return result;
        }
        if (node.text && node.text.trim()) {
            result.primaryScript = node.text.trim();
            result.hasPayload = true;
        }
        const traverse = (elements) => {
            for (const el of elements) {
                const local = (el.localName || '').toLowerCase();
                // 1. Target variables: <set-variable variableName="..." ...> or <variable name="..." ...>
                if (local === 'set-variable' || local === 'variable') {
                    const varName = el.attributes['variableName'] ||
                        el.attributes['name'] ||
                        el.attributes['key'] ||
                        'variable';
                    const resource = el.attributes['resource'];
                    let script = '';
                    if (resource) {
                        script = FlowVisualizerPanel.loadDwlResource(resource, currentDocUri);
                    }
                    else if (el.text !== null && el.text !== undefined) {
                        script = el.text.trim();
                    }
                    result.variables.push({ name: varName, script, resource });
                }
                // 2. Primary payload script: <set-payload> or <payload>
                else if (local === 'set-payload' || local === 'payload') {
                    result.hasPayload = true;
                    const resource = el.attributes['resource'];
                    if (resource) {
                        result.payloadResource = resource;
                        result.primaryScript = FlowVisualizerPanel.loadDwlResource(resource, currentDocUri);
                    }
                    else if (el.text !== null && el.text !== undefined && el.text.trim().length > 0) {
                        result.primaryScript = el.text.trim();
                    }
                    else {
                        result.primaryScript = '';
                    }
                }
                // 3. Attributes script: <set-attributes>
                else if (local === 'set-attributes' || local === 'attributes') {
                    result.hasAttributes = true;
                    const resource = el.attributes['resource'];
                    if (resource) {
                        result.attributesResource = resource;
                        result.attributesScript = FlowVisualizerPanel.loadDwlResource(resource, currentDocUri);
                    }
                    else if (el.text !== null && el.text !== undefined && el.text.trim().length > 0) {
                        result.attributesScript = el.text.trim();
                    }
                    else {
                        result.attributesScript = '';
                    }
                }
                // 4. Child elements with text/CDATA content
                else if (el.text !== null && el.text !== undefined && el.text.trim().length > 0) {
                    result.childValues[el.localName] = el.text.trim();
                    if (!result.primaryScript && (local === 'sql' || local === 'body' || local === 'content')) {
                        result.primaryScript = el.text.trim();
                        result.hasPayload = true;
                    }
                }
                // Recurse into nested children (e.g. <ee:message> -> <ee:set-payload>, <ee:variables> -> <ee:set-variable>)
                if (el.children && el.children.length > 0) {
                    traverse(el.children);
                }
            }
        };
        if (node.body && node.body.length > 0) {
            traverse(node.body);
        }
        // Fallback for primaryScript if not explicitly in set-payload / direct text
        if (!result.primaryScript && Object.keys(result.childValues).length > 0) {
            const firstKey = Object.keys(result.childValues)[0];
            result.primaryScript = result.childValues[firstKey];
            result.hasPayload = true;
        }
        return result;
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
        // Handle Transform Message script write-back (replacing CDATA/child element content)
        if (msg.paramName === '__transform_payload__' ||
            msg.paramName === '__transform_attributes__' ||
            msg.paramName.startsWith('__transform_var:') ||
            msg.paramName === '__transform_delete_attributes__' ||
            msg.paramName.startsWith('__transform_delete_var:')) {
            await this.handleTransformScriptUpdate(node, msg.paramName, String(msg.value));
            return;
        }
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
    async handleTransformScriptUpdate(node, paramName, newScript) {
        if (!this.currentDocUri)
            return;
        const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
        const nodeStartPos = new vscode.Position(node.range.startLine, node.range.startCol);
        const nodeEndPos = new vscode.Position(node.range.endLine, node.range.endCol);
        const nodeRange = new vscode.Range(nodeStartPos, nodeEndPos);
        const nodeText = curDoc.getText(nodeRange);
        // Helper: write to DWL resource file if present
        const writeToDwlResource = (resPath) => {
            let targetPath = FlowVisualizerPanel.resolveDwlResourcePath(resPath, this.currentDocUri);
            if (!targetPath && this.currentDocUri) {
                let clean = resPath.trim();
                if (clean.toLowerCase().startsWith('classpath:')) {
                    clean = clean.slice('classpath:'.length).trim();
                }
                while (clean.startsWith('/') || clean.startsWith('\\')) {
                    clean = clean.slice(1);
                }
                const projectRoot = FlowVisualizerPanel.getProjectRoot(this.currentDocUri.fsPath);
                targetPath = path.resolve(projectRoot, 'src', 'main', 'resources', clean);
            }
            if (targetPath) {
                try {
                    const dir = path.dirname(targetPath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(targetPath, newScript, 'utf-8');
                    return true;
                }
                catch (err) {
                    console.error('Failed to write DWL resource file:', targetPath, err);
                }
            }
            return false;
        };
        // First check if target comes from a resource="..." file
        const bodyContent = FlowVisualizerPanel.extractComponentBody(node, this.currentDocUri);
        if (paramName === '__transform_payload__') {
            if (bodyContent.payloadResource) {
                writeToDwlResource(bodyContent.payloadResource);
                return;
            }
        }
        else if (paramName === '__transform_attributes__') {
            if (bodyContent.attributesResource) {
                writeToDwlResource(bodyContent.attributesResource);
                return;
            }
        }
        else if (paramName.startsWith('__transform_var:')) {
            const varName = paramName.slice('__transform_var:'.length);
            const targetVar = bodyContent.variables.find((v) => v.name === varName);
            if (targetVar?.resource) {
                writeToDwlResource(targetVar.resource);
                return;
            }
        }
        // Double check regex in nodeText for resource attribute in case body was out of sync
        if (paramName === '__transform_payload__') {
            const resMatch = nodeText.match(/<([a-zA-Z0-9_-]+:)?(?:set-payload|payload)\b[^>]*\bresource="([^"]+)"/);
            if (resMatch && resMatch[2]) {
                writeToDwlResource(resMatch[2]);
                return;
            }
        }
        else if (paramName === '__transform_attributes__') {
            const resMatch = nodeText.match(/<([a-zA-Z0-9_-]+:)?(?:set-attributes|attributes)\b[^>]*\bresource="([^"]+)"/);
            if (resMatch && resMatch[2]) {
                writeToDwlResource(resMatch[2]);
                return;
            }
        }
        else if (paramName.startsWith('__transform_var:')) {
            const varName = paramName.slice('__transform_var:'.length);
            const resMatch1 = nodeText.match(new RegExp(`<([a-zA-Z0-9_-]+:)?(?:set-variable|variable)\\b[^>]*\\bvariableName="${varName}"[^>]*\\bresource="([^"]+)"`));
            const resMatch2 = nodeText.match(new RegExp(`<([a-zA-Z0-9_-]+:)?(?:set-variable|variable)\\b[^>]*\\bresource="([^"]+)"[^>]*\\bvariableName="${varName}"`));
            const resVal = resMatch1?.[2] || resMatch2?.[2];
            if (resVal) {
                writeToDwlResource(resVal);
                return;
            }
        }
        const workspaceEdit = new vscode.WorkspaceEdit();
        if (paramName === '__transform_delete_var:' || paramName.startsWith('__transform_delete_var:')) {
            const varName = paramName.slice('__transform_delete_var:'.length);
            const varRegex = new RegExp(`\\s*<([a-zA-Z0-9_-]+:)?set-variable\\b[^>]*variableName="${varName}"[^>]*>[\\s\\S]*?<\\/([a-zA-Z0-9_-]+:)?set-variable>|\\s*<([a-zA-Z0-9_-]+:)?set-variable\\b[^>]*variableName="${varName}"[^>]*\\/>`);
            const match = nodeText.match(varRegex);
            if (match && match.index !== undefined) {
                const startOffset = curDoc.offsetAt(nodeStartPos) + match.index;
                const endOffset = startOffset + match[0].length;
                workspaceEdit.delete(this.currentDocUri, new vscode.Range(curDoc.positionAt(startOffset), curDoc.positionAt(endOffset)));
            }
        }
        else if (paramName === '__transform_delete_attributes__') {
            const attrRegex = /\s*<([a-zA-Z0-9_-]+:)?set-attributes\b[^>]*>[\s\S]*?<\/([a-zA-Z0-9_-]+:)?set-attributes>|\s*<([a-zA-Z0-9_-]+:)?set-attributes\b[^>]*\/>/;
            const match = nodeText.match(attrRegex);
            if (match && match.index !== undefined) {
                const startOffset = curDoc.offsetAt(nodeStartPos) + match.index;
                const endOffset = startOffset + match[0].length;
                workspaceEdit.delete(this.currentDocUri, new vscode.Range(curDoc.positionAt(startOffset), curDoc.positionAt(endOffset)));
            }
        }
        else if (paramName === '__transform_attributes__') {
            const setAttrPairRegex = /<([a-zA-Z0-9_-]+:)?set-attributes\b[^>]*>([\s\S]*?)<\/([a-zA-Z0-9_-]+:)?set-attributes>/;
            const setAttrSelfClosingRegex = /<([a-zA-Z0-9_-]+:)?set-attributes\b[^>]*\/>/;
            const match = nodeText.match(setAttrPairRegex);
            const selfMatch = nodeText.match(setAttrSelfClosingRegex);
            const prefix = nodeText.match(/<([a-zA-Z0-9_-]+):transform/)?.[1] || 'ee';
            if (match && match.index !== undefined) {
                const fullInner = match[2];
                const innerOffset = match.index + match[0].indexOf(fullInner);
                const cdataMatch = fullInner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
                if (cdataMatch && cdataMatch.index !== undefined) {
                    const cdataStartOffset = curDoc.offsetAt(nodeStartPos) + innerOffset + cdataMatch.index + 9;
                    const cdataEndOffset = cdataStartOffset + cdataMatch[1].length;
                    workspaceEdit.replace(this.currentDocUri, new vscode.Range(curDoc.positionAt(cdataStartOffset), curDoc.positionAt(cdataEndOffset)), newScript);
                }
                else {
                    const innerStartOffset = curDoc.offsetAt(nodeStartPos) + innerOffset;
                    const innerEndOffset = innerStartOffset + fullInner.length;
                    workspaceEdit.replace(this.currentDocUri, new vscode.Range(curDoc.positionAt(innerStartOffset), curDoc.positionAt(innerEndOffset)), `<![CDATA[${newScript}]]>`);
                }
            }
            else if (selfMatch && selfMatch.index !== undefined) {
                const startOffset = curDoc.offsetAt(nodeStartPos) + selfMatch.index;
                const endOffset = startOffset + selfMatch[0].length;
                workspaceEdit.replace(this.currentDocUri, new vscode.Range(curDoc.positionAt(startOffset), curDoc.positionAt(endOffset)), `<${prefix}:set-attributes><![CDATA[${newScript}]]></${prefix}:set-attributes>`);
            }
            else {
                const messageRegex = /<([a-zA-Z0-9_-]+:)?message\b[^>]*>([\s\S]*?)<\/([a-zA-Z0-9_-]+:)?message>/;
                const msgMatch = nodeText.match(messageRegex);
                if (msgMatch && msgMatch.index !== undefined) {
                    const insertOffset = curDoc.offsetAt(nodeStartPos) + msgMatch.index + msgMatch[0].lastIndexOf('</');
                    workspaceEdit.insert(this.currentDocUri, curDoc.positionAt(insertOffset), `\t<${prefix}:set-attributes><![CDATA[${newScript}]]></${prefix}:set-attributes>\n\t\t`);
                }
                else {
                    const openTagMatch = nodeText.match(/<([a-zA-Z0-9_-]+:)?transform\b[^>]*>/);
                    if (openTagMatch && openTagMatch.index !== undefined) {
                        const insertOffset = curDoc.offsetAt(nodeStartPos) + openTagMatch.index + openTagMatch[0].length;
                        workspaceEdit.insert(this.currentDocUri, curDoc.positionAt(insertOffset), `\n\t<${prefix}:message>\n\t\t<${prefix}:set-attributes><![CDATA[${newScript}]]></${prefix}:set-attributes>\n\t</${prefix}:message>`);
                    }
                }
            }
        }
        else if (paramName === '__transform_payload__') {
            const setPayloadPairRegex = /<([a-zA-Z0-9_-]+:)?set-payload\b[^>]*>([\s\S]*?)<\/([a-zA-Z0-9_-]+:)?set-payload>/;
            const setPayloadSelfClosingRegex = /<([a-zA-Z0-9_-]+:)?set-payload\b[^>]*\/>/;
            const match = nodeText.match(setPayloadPairRegex);
            const selfMatch = nodeText.match(setPayloadSelfClosingRegex);
            const prefix = nodeText.match(/<([a-zA-Z0-9_-]+):transform/)?.[1] || 'ee';
            if (match && match.index !== undefined) {
                const fullInner = match[2];
                const innerOffset = match.index + match[0].indexOf(fullInner);
                const cdataMatch = fullInner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
                if (cdataMatch && cdataMatch.index !== undefined) {
                    const cdataStartOffset = curDoc.offsetAt(nodeStartPos) + innerOffset + cdataMatch.index + 9;
                    const cdataEndOffset = cdataStartOffset + cdataMatch[1].length;
                    const replaceRange = new vscode.Range(curDoc.positionAt(cdataStartOffset), curDoc.positionAt(cdataEndOffset));
                    workspaceEdit.replace(this.currentDocUri, replaceRange, newScript);
                }
                else {
                    const innerStartOffset = curDoc.offsetAt(nodeStartPos) + innerOffset;
                    const innerEndOffset = innerStartOffset + fullInner.length;
                    const replaceRange = new vscode.Range(curDoc.positionAt(innerStartOffset), curDoc.positionAt(innerEndOffset));
                    workspaceEdit.replace(this.currentDocUri, replaceRange, `<![CDATA[${newScript}]]>`);
                }
            }
            else if (selfMatch && selfMatch.index !== undefined) {
                const startOffset = curDoc.offsetAt(nodeStartPos) + selfMatch.index;
                const endOffset = startOffset + selfMatch[0].length;
                workspaceEdit.replace(this.currentDocUri, new vscode.Range(curDoc.positionAt(startOffset), curDoc.positionAt(endOffset)), `<${prefix}:set-payload><![CDATA[${newScript}]]></${prefix}:set-payload>`);
            }
            else {
                const messageRegex = /<([a-zA-Z0-9_-]+:)?message\b[^>]*>([\s\S]*?)<\/([a-zA-Z0-9_-]+:)?message>/;
                const msgMatch = nodeText.match(messageRegex);
                if (msgMatch && msgMatch.index !== undefined) {
                    const insertOffset = curDoc.offsetAt(nodeStartPos) + msgMatch.index + msgMatch[0].indexOf(msgMatch[2]);
                    const insertPos = curDoc.positionAt(insertOffset);
                    workspaceEdit.insert(this.currentDocUri, insertPos, `\n\t\t<${prefix}:set-payload><![CDATA[${newScript}]]></${prefix}:set-payload>`);
                }
                else {
                    const openTagMatch = nodeText.match(/<([a-zA-Z0-9_-]+:)?transform\b[^>]*>/);
                    if (openTagMatch && openTagMatch.index !== undefined) {
                        const insertOffset = curDoc.offsetAt(nodeStartPos) + openTagMatch.index + openTagMatch[0].length;
                        const insertPos = curDoc.positionAt(insertOffset);
                        workspaceEdit.insert(this.currentDocUri, insertPos, `\n\t<${prefix}:message>\n\t\t<${prefix}:set-payload><![CDATA[${newScript}]]></${prefix}:set-payload>\n\t</${prefix}:message>`);
                    }
                }
            }
        }
        else if (paramName.startsWith('__transform_var:')) {
            const varName = paramName.slice('__transform_var:'.length);
            const prefix = nodeText.match(/<([a-zA-Z0-9_-]+):transform/)?.[1] || 'ee';
            const setVarPairRegex = new RegExp(`<([a-zA-Z0-9_-]+:)?set-variable\\b[^>]*variableName="${varName}"[^>]*>([\\s\\S]*?)<\\/([a-zA-Z0-9_-]+:)?set-variable>`);
            const setVarSelfClosingRegex = new RegExp(`<([a-zA-Z0-9_-]+:)?set-variable\\b[^>]*variableName="${varName}"[^>]*\\/>`);
            const match = nodeText.match(setVarPairRegex);
            const selfMatch = nodeText.match(setVarSelfClosingRegex);
            if (match && match.index !== undefined) {
                const fullInner = match[2];
                const innerOffset = match.index + match[0].indexOf(fullInner);
                const cdataMatch = fullInner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
                if (cdataMatch && cdataMatch.index !== undefined) {
                    const cdataStartOffset = curDoc.offsetAt(nodeStartPos) + innerOffset + cdataMatch.index + 9;
                    const cdataEndOffset = cdataStartOffset + cdataMatch[1].length;
                    const replaceRange = new vscode.Range(curDoc.positionAt(cdataStartOffset), curDoc.positionAt(cdataEndOffset));
                    workspaceEdit.replace(this.currentDocUri, replaceRange, newScript);
                }
                else {
                    const innerStartOffset = curDoc.offsetAt(nodeStartPos) + innerOffset;
                    const innerEndOffset = innerStartOffset + fullInner.length;
                    const replaceRange = new vscode.Range(curDoc.positionAt(innerStartOffset), curDoc.positionAt(innerEndOffset));
                    workspaceEdit.replace(this.currentDocUri, replaceRange, `<![CDATA[${newScript}]]>`);
                }
            }
            else if (selfMatch && selfMatch.index !== undefined) {
                const startOffset = curDoc.offsetAt(nodeStartPos) + selfMatch.index;
                const endOffset = startOffset + selfMatch[0].length;
                workspaceEdit.replace(this.currentDocUri, new vscode.Range(curDoc.positionAt(startOffset), curDoc.positionAt(endOffset)), `<${prefix}:set-variable variableName="${varName}"><![CDATA[${newScript}]]></${prefix}:set-variable>`);
            }
            else {
                const varsRegex = /<([a-zA-Z0-9_-]+:)?variables\b[^>]*>([\s\S]*?)<\/([a-zA-Z0-9_-]+:)?variables>/;
                const varsMatch = nodeText.match(varsRegex);
                if (varsMatch && varsMatch.index !== undefined) {
                    const insertOffset = curDoc.offsetAt(nodeStartPos) + varsMatch.index + varsMatch[0].indexOf(varsMatch[2]);
                    const insertPos = curDoc.positionAt(insertOffset);
                    workspaceEdit.insert(this.currentDocUri, insertPos, `\n\t\t<${prefix}:set-variable variableName="${varName}"><![CDATA[${newScript}]]></${prefix}:set-variable>`);
                }
                else {
                    const closeTagMatch = nodeText.match(/<\/([a-zA-Z0-9_-]+:)?transform>/);
                    if (closeTagMatch && closeTagMatch.index !== undefined) {
                        const insertOffset = curDoc.offsetAt(nodeStartPos) + closeTagMatch.index;
                        const insertPos = curDoc.positionAt(insertOffset);
                        workspaceEdit.insert(this.currentDocUri, insertPos, `\t<${prefix}:variables>\n\t\t<${prefix}:set-variable variableName="${varName}"><![CDATA[${newScript}]]></${prefix}:set-variable>\n\t</${prefix}:variables>\n`);
                    }
                }
            }
        }
        const applied = await vscode.workspace.applyEdit(workspaceEdit);
        if (applied) {
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
    async handleAddChoiceRoute(nodeId) {
        if (!this.currentDocUri || !this.lastModel)
            return;
        const node = this.findNodeInModel(this.lastModel, nodeId);
        if (!node)
            return;
        const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
        const nodeStartPos = new vscode.Position(node.range.startLine, node.range.startCol);
        const nodeEndPos = new vscode.Position(node.range.endLine, node.range.endCol);
        const nodeText = curDoc.getText(new vscode.Range(nodeStartPos, nodeEndPos));
        // Determine insertion position: before <otherwise> if exists, else before </choice>
        const otherwiseMatch = nodeText.match(/<([a-zA-Z0-9_-]+:)?otherwise\b/);
        const closeChoiceMatch = nodeText.match(/<\/([a-zA-Z0-9_-]+:)?choice>/);
        const targetOffsetInNode = otherwiseMatch && otherwiseMatch.index !== undefined
            ? otherwiseMatch.index
            : (closeChoiceMatch && closeChoiceMatch.index !== undefined ? closeChoiceMatch.index : nodeText.length - 1);
        const insertOffset = curDoc.offsetAt(nodeStartPos) + targetOffsetInNode;
        const insertPos = curDoc.positionAt(insertOffset);
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.insert(this.currentDocUri, insertPos, `<when expression="#[true]">\n\t\t\t<!-- route -->\n\t\t</when>\n\t\t`);
        const applied = await vscode.workspace.applyEdit(workspaceEdit);
        if (applied)
            await curDoc.save();
    }
    async handleDeleteRoute(routeId) {
        if (!this.currentDocUri || !this.lastModel)
            return;
        const node = this.findNodeInModel(this.lastModel, routeId);
        if (!node)
            return;
        const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
        const startPos = new vscode.Position(node.range.startLine, node.range.startCol);
        const endPos = new vscode.Position(node.range.endLine, node.range.endCol);
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.delete(this.currentDocUri, new vscode.Range(startPos, endPos));
        const applied = await vscode.workspace.applyEdit(workspaceEdit);
        if (applied)
            await curDoc.save();
    }
    async handleReorderChoiceRoutes(nodeId, fromIndex, toIndex) {
        if (!this.currentDocUri || !this.lastModel)
            return;
        const node = this.findNodeInModel(this.lastModel, nodeId);
        if (!node || !node.routes || fromIndex < 0 || toIndex < 0 || fromIndex >= node.routes.length || toIndex >= node.routes.length)
            return;
        const routeA = node.routes[fromIndex];
        const routeB = node.routes[toIndex];
        if (!routeA || !routeB)
            return;
        const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
        const rangeA = new vscode.Range(new vscode.Position(routeA.range.startLine, routeA.range.startCol), new vscode.Position(routeA.range.endLine, routeA.range.endCol));
        const rangeB = new vscode.Range(new vscode.Position(routeB.range.startLine, routeB.range.startCol), new vscode.Position(routeB.range.endLine, routeB.range.endCol));
        const textA = curDoc.getText(rangeA);
        const textB = curDoc.getText(rangeB);
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.replace(this.currentDocUri, rangeA, textB);
        workspaceEdit.replace(this.currentDocUri, rangeB, textA);
        const applied = await vscode.workspace.applyEdit(workspaceEdit);
        if (applied)
            await curDoc.save();
    }
    static findNodeInModel(model, id) {
        const routeToNode = (r) => ({
            id: r.id,
            range: r.range,
            attributes: r.attributes || {},
            descriptor: r.descriptor || {
                namespaceUri: coreCatalog_1.MULE_CORE_NAMESPACE,
                localName: r.kind,
                kind: 'scope',
                displayName: r.label,
                iconId: r.kind.startsWith('on-error') ? 'core:on-error-propagate' : 'core:choice',
                groups: [],
            },
            label: r.label,
            subtitle: null,
            chain: r.chain || [],
            routes: [],
            body: r.body,
            collapsed: false,
            diagnostics: [],
        });
        const searchNode = (n, flowName) => {
            if (n.id === id)
                return n;
            for (const c of n.chain) {
                const found = searchNode(c, flowName);
                if (found)
                    return found;
            }
            for (const r of n.routes) {
                if (r.id === id)
                    return routeToNode(r);
                for (const c of r.chain) {
                    const found = searchNode(c, flowName);
                    if (found)
                        return found;
                }
            }
            return null;
        };
        for (const g of model.globalConfigs) {
            const found = searchNode(g, 'global');
            if (found)
                return found;
        }
        for (const flow of model.flows) {
            if (flow.source) {
                const found = searchNode(flow.source, flow.name);
                if (found)
                    return found;
            }
            for (const c of flow.chain) {
                const found = searchNode(c, flow.name);
                if (found)
                    return found;
            }
            for (const r of flow.errorHandler) {
                if (r.id === id)
                    return routeToNode(r);
                for (const c of r.chain) {
                    const found = searchNode(c, flow.name);
                    if (found)
                        return found;
                }
            }
        }
        return null;
    }
    findNodeInModel(model, id) {
        return FlowVisualizerPanel.findNodeInModel(model, id);
    }
    parseObjectKeys(objContent) {
        const keys = [];
        let depth = 0;
        let inString = false;
        let stringChar = '';
        let i = 0;
        while (i < objContent.length) {
            const ch = objContent[i];
            if (inString) {
                if (ch === '\\') {
                    i += 2;
                    continue;
                }
                if (ch === stringChar) {
                    inString = false;
                }
                i++;
                continue;
            }
            if (ch === '"' || ch === "'") {
                inString = true;
                stringChar = ch;
                i++;
                continue;
            }
            if (ch === '{' || ch === '[' || ch === '(') {
                depth++;
                i++;
                continue;
            }
            if (ch === '}' || ch === ']' || ch === ')') {
                depth--;
                i++;
                continue;
            }
            if (depth === 0) {
                if (ch === ':') {
                    const textBefore = objContent.slice(0, i);
                    const match = textBefore.match(/(?:^|[,{\n\r])\s*(?:([a-zA-Z0-9_\-]+)|["']([^"']+)["'])\s*$/);
                    if (match) {
                        const keyName = match[1] || match[2];
                        if (keyName && !keys.some((k) => k.name === keyName)) {
                            let childKeys = [];
                            const afterColon = objContent.slice(i + 1).trimStart();
                            if (afterColon.startsWith('{')) {
                                let subDepth = 0;
                                let endSub = -1;
                                for (let j = 0; j < afterColon.length; j++) {
                                    if (afterColon[j] === '{')
                                        subDepth++;
                                    else if (afterColon[j] === '}') {
                                        subDepth--;
                                        if (subDepth === 0) {
                                            endSub = j;
                                            break;
                                        }
                                    }
                                }
                                if (endSub > 0) {
                                    const subContent = afterColon.slice(1, endSub);
                                    childKeys = this.parseObjectKeys(subContent).map((k) => k.name);
                                }
                            }
                            keys.push({ name: keyName, children: childKeys });
                        }
                    }
                }
            }
            i++;
        }
        return keys;
    }
    extractDataWeaveShape(script) {
        if (!script)
            return undefined;
        const outMatch = script.match(/output\s+([a-zA-Z0-9_\-\/]+)/);
        const outputType = outMatch ? outMatch[1] : undefined;
        const separatorIndex = script.indexOf('---');
        let body = separatorIndex >= 0 ? script.slice(separatorIndex + 3).trim() : script.trim();
        body = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        let fields = [];
        const xmlRootMatch = body.match(/^([a-zA-Z0-9_-]+)\s*:\s*\{([\s\S]*)\}\s*$/);
        if (xmlRootMatch) {
            const rootPrefix = xmlRootMatch[1];
            const topKeys = this.parseObjectKeys(xmlRootMatch[2]);
            fields.push({
                name: rootPrefix,
                children: topKeys.map((k) => k.name),
            });
        }
        else {
            const firstBrace = body.indexOf('{');
            const lastBrace = body.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
                fields = this.parseObjectKeys(body.slice(firstBrace + 1, lastBrace));
            }
        }
        if (fields.length > 0 || outputType) {
            return { outputType, fields };
        }
        return undefined;
    }
    computeStaticAutocompleteContext(model, targetNodeId, docText) {
        const nodesBefore = [];
        let found = false;
        const traverseNode = (node) => {
            if (node.id === targetNodeId) {
                found = true;
                return true;
            }
            nodesBefore.push(node);
            if (node.chain && node.chain.length > 0) {
                for (const child of node.chain) {
                    if (traverseNode(child))
                        return true;
                }
            }
            if (node.routes && node.routes.length > 0) {
                for (const route of node.routes) {
                    if (route.chain) {
                        for (const child of route.chain) {
                            if (traverseNode(child))
                                return true;
                        }
                    }
                }
            }
            return false;
        };
        for (const flow of model.flows) {
            nodesBefore.length = 0;
            found = false;
            if (flow.source && traverseNode(flow.source)) {
                break;
            }
            if (flow.chain) {
                for (const node of flow.chain) {
                    if (traverseNode(node))
                        break;
                }
                if (found)
                    break;
            }
            if (flow.errorHandler) {
                for (const route of flow.errorHandler) {
                    if (route.chain) {
                        for (const child of route.chain) {
                            if (traverseNode(child))
                                break;
                        }
                        if (found)
                            break;
                    }
                }
                if (found)
                    break;
            }
        }
        if (!found) {
            return { variables: [] };
        }
        // 1. Variables declared earlier in this flow
        const variables = [];
        const seenVarNames = new Set();
        for (const n of nodesBefore) {
            if (n.descriptor && (n.descriptor.localName === 'set-variable' || n.descriptor.localName.includes('set-variable'))) {
                const varName = n.attributes['variableName'] || n.attributes['name'];
                if (varName && !seenVarNames.has(varName)) {
                    seenVarNames.add(varName);
                    const type = n.attributes['mimeType'] || n.attributes['dataType'];
                    variables.push({ name: varName, type });
                }
            }
            if (n.descriptor && (n.descriptor.localName === 'transform' || n.descriptor.localName === 'transform-message')) {
                const bodyContent = FlowVisualizerPanel.extractComponentBody(n, this.currentDocUri);
                for (const v of bodyContent.variables) {
                    if (!seenVarNames.has(v.name)) {
                        seenVarNames.add(v.name);
                        variables.push({ name: v.name });
                    }
                }
            }
        }
        // 2. Preceding component payload shape (ONLY if immediately preceding component in same chain is a Transform Message)
        let precedingPayloadShape;
        const prevNode = nodesBefore.length > 0 ? nodesBefore[nodesBefore.length - 1] : undefined;
        if (prevNode && prevNode.descriptor && (prevNode.descriptor.localName === 'transform' || prevNode.descriptor.localName === 'transform-message')) {
            try {
                const bodyContent = FlowVisualizerPanel.extractComponentBody(prevNode, this.currentDocUri);
                if (bodyContent.primaryScript) {
                    precedingPayloadShape = this.extractDataWeaveShape(bodyContent.primaryScript);
                }
            }
            catch { }
        }
        return {
            variables,
            precedingPayloadShape,
        };
    }
    async revealXmlRange(range, focusEditor) {
        if (!this.currentDocUri)
            return;
        this.isSyncingFromWebview = true;
        try {
            const editor = await vscode.window.showTextDocument(this.currentDocUri, {
                viewColumn: vscode.ViewColumn.One,
                preserveFocus: !focusEditor,
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