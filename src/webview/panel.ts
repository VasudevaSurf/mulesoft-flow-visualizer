import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MuleXmlParser } from '../parser/xmlParser';
import { SemanticModelBuilder } from '../parser/semanticModel';
import { layout } from '../layout';
import { IconStore } from '../catalog/iconStore';
import { ExtensionCatalog } from '../catalog';
import { WorkspaceScanner } from '../workspace/scanner';
import { MavenRepo } from '../workspace/mavenRepo';
import { ConnectionTester } from '../workspace/connectionTester';
import { WebviewHtmlBuilder } from './html';
import { HostToWebviewMessage, WebviewToHostMessage } from './messages';
import { SourceRange, SemanticModel, Node, FlowModel } from '../parser/types';
import { PositionedScene } from '../layout/types';
import {
  toDisplayLabel,
  buildParameterModel,
  groupParameters,
  ParameterModel,
  ParameterGroupModel,
  ConnectionProviderModel,
} from '../catalog/extensionModelReader';

export class FlowVisualizerPanel {
  public static currentPanel: FlowVisualizerPanel | undefined;
  private static readonly viewType = 'mulesoftFlowVisualizer';

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private currentDocUri: vscode.Uri | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isSyncingFromWebview = false;
  private lastModel: SemanticModel | null = null;
  private lastScene: PositionedScene | null = null;
  private collapsedNodeIds = new Set<string>();

  public static createOrShow(extensionUri: vscode.Uri, xmlUri?: vscode.Uri): FlowVisualizerPanel {
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

    const panel = vscode.window.createWebviewPanel(
      FlowVisualizerPanel.viewType,
      'Mule Flow Visualizer',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    FlowVisualizerPanel.currentPanel = new FlowVisualizerPanel(panel, extensionUri, xmlUri);
    return FlowVisualizerPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, xmlUri?: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    // Set HTML content
    this.panel.webview.html = WebviewHtmlBuilder.build(this.panel.webview, extensionUri);

    // Message handler from Webview
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewToHostMessage) => this.handleWebviewMessage(message),
      null,
      this.disposables
    );

    // Watch for document changes (live update with 250ms debounce)
    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (this.currentDocUri && e.document.uri.fsPath === this.currentDocUri.fsPath) {
          this.triggerUpdateDebounced();
        }
      },
      null,
      this.disposables
    );

    // Watch cursor selection in active editor for selection sync
    vscode.window.onDidChangeTextEditorSelection(
      (e) => {
        if (this.isSyncingFromWebview) {
          return;
        }
        if (this.currentDocUri && e.textEditor.document.uri.fsPath === this.currentDocUri.fsPath) {
          this.syncEditorCursorToWebview(e.selections[0].active);
        }
      },
      null,
      this.disposables
    );

    // Watch active editor switch
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor && editor.document.languageId === 'xml') {
          const text = editor.document.getText();
          if (WorkspaceScanner.isMuleXml(text)) {
            this.loadDocument(editor.document.uri);
          }
        }
      },
      null,
      this.disposables
    );

    // Cleanup on dispose
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Initial load
    if (xmlUri) {
      this.loadDocument(xmlUri);
    } else if (vscode.window.activeTextEditor) {
      this.loadDocument(vscode.window.activeTextEditor.document.uri);
    }
  }

  public async loadDocument(uri: vscode.Uri): Promise<void> {
    this.currentDocUri = uri;
    this.panel.title = `Flow: ${path.basename(uri.fsPath)}`;

    // Resolve Maven dependencies for this project asynchronously
    const pomPath = WorkspaceScanner.findNearestPom(uri.fsPath);
    if (pomPath) {
      const config = vscode.workspace.getConfiguration('muleFlow');
      const customM2 = config.get<string>('mavenLocalRepository');
      const mavenRepo = new MavenRepo(customM2);
      ExtensionCatalog.loadProjectConnectors(pomPath, mavenRepo)
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

  private triggerUpdateDebounced(): void {
    const config = vscode.workspace.getConfiguration('muleFlow');
    const debounceMs = config.get<number>('debounceMs') ?? 250;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.updateView();
    }, debounceMs);
  }

  public async updateView(): Promise<void> {
    if (!this.currentDocUri) {
      return;
    }

    try {
      const document = await vscode.workspace.openTextDocument(this.currentDocUri);
      const text = document.getText();

      const { root, error } = MuleXmlParser.parse(text);
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

      const model = SemanticModelBuilder.build(root, this.currentDocUri.fsPath);

      const config = vscode.workspace.getConfiguration('muleFlow');
      const collapseOption = config.get<'never' | 'always' | 'auto'>('collapseErrorHandlers') || 'auto';
      const theme = config.get<'vscode' | 'studio'>('theme') || 'vscode';

      // Restore collapse state recursively for flows, containers, and error bands
      const applyCollapseState = (node: Node) => {
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
        } else {
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

      const scene = layout(model, { collapseErrorHandlers: collapseOption });
      this.lastModel = model;
      this.lastScene = scene;

      this.postMessage({
        type: 'updateModel',
        model,
        scene,
        symbolsSvg: IconStore.getAllSymbols(),
        theme,
      });
    } catch (e: any) {
      console.error('Failed to update Mule Flow view:', e);
    }
  }

  private handleWebviewMessage(msg: WebviewToHostMessage): void {
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
        } else {
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

  private async handleShowProperties(msg: {
    nodeId: string;
    namespaceUri: string;
    localName: string;
    attributes: Record<string, string>;
    isConfiguration?: boolean;
  }): Promise<void> {
    // Compute static-only autocomplete context (variables declared earlier, preceding transform output shape)
    let autocompleteContext: {
      variables: Array<{ name: string; type?: string }>;
      precedingPayloadShape?: { outputType?: string; fields: Array<{ name: string; children?: string[] }> };
    } = { variables: [] };

    if (this.currentDocUri && this.lastModel) {
      try {
        const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
        autocompleteContext = this.computeStaticAutocompleteContext(this.lastModel, msg.nodeId, curDoc.getText());
      } catch (err) {
        console.warn('Failed to compute static autocomplete context:', err);
      }
    }

    // 0. Check if the clicked node is a Transform Message (ee:transform or dw:transform-message)
    const isTransform =
      (msg.localName === 'transform' && (msg.namespaceUri === 'http://www.mulesoft.org/schema/mule/ee/core' || msg.namespaceUri?.includes('ee') || !msg.namespaceUri)) ||
      msg.localName === 'transform-message';

    if (isTransform) {
      let payloadScript = '%dw 2.0\noutput application/json\n---\n{\n}';
      const targetVariables: Array<{ name: string; script: string }> = [];
      let outputType = 'application/json';

      if (this.currentDocUri && this.lastModel) {
        const node = this.findNodeInModel(this.lastModel, msg.nodeId);
        if (node) {
          const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
          const nodeStartPos = new vscode.Position(node.range.startLine, node.range.startCol);
          const nodeEndPos = new vscode.Position(node.range.endLine, node.range.endCol);
          const nodeText = curDoc.getText(new vscode.Range(nodeStartPos, nodeEndPos));

          // 1. Extract payload script
          const payloadMatch = nodeText.match(/<([a-zA-Z0-9_-]+:)?set-payload\b[^>]*>([\s\S]*?)<\/([a-zA-Z0-9_-]+:)?set-payload>/);
          if (payloadMatch) {
            const rawInner = payloadMatch[2];
            const cdataMatch = rawInner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
            payloadScript = cdataMatch ? cdataMatch[1] : rawInner.trim();
          } else {
            const cdataMatch = nodeText.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
            if (cdataMatch) {
              payloadScript = cdataMatch[1];
            }
          }

          // 2. Extract target variables
          const varRegex = /<([a-zA-Z0-9_-]+:)?set-variable\b([^>]*)>([\s\S]*?)<\/([a-zA-Z0-9_-]+:)?set-variable>/g;
          let vMatch: RegExpExecArray | null;
          while ((vMatch = varRegex.exec(nodeText)) !== null) {
            const attrStr = vMatch[2];
            const nameMatch = attrStr.match(/variableName="([^"]+)"/) || attrStr.match(/name="([^"]+)"/);
            const varName = nameMatch ? nameMatch[1] : 'variable';
            const rawInner = vMatch[3];
            const cdataMatch = rawInner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
            const varScript = cdataMatch ? cdataMatch[1] : rawInner.trim();
            targetVariables.push({ name: varName, script: varScript });
          }

          // 3. Extract outputType from payloadScript
          const outMatch = payloadScript.match(/output\s+([a-zA-Z0-9_\-\/]+)/);
          if (outMatch) {
            outputType = outMatch[1];
          }
        }
      }

      this.postMessage({
        type: 'updatePropertiesPanel',
        nodeId: msg.nodeId,
        displayName: 'Transform Message',
        iconId: 'core:transform',
        groups: [],
        currentValues: msg.attributes,
        isTransform: true,
        transformData: {
          script: payloadScript,
          targetVariables,
          outputType,
        },
        autocompleteContext,
      });
      return;
    }

    // 1. Check if the clicked node is itself a Configuration element
    const isConfig =
      msg.isConfiguration ||
      msg.localName.endsWith('-config') ||
      msg.localName.endsWith('config') ||
      msg.localName.includes('configuration');

    if (isConfig) {
      // Find the gNode in lastModel to merge child connection attributes (e.g. <http:listener-connection>)
      const mergedAttributes: Record<string, string> = { ...msg.attributes };
      const gNode = this.lastModel?.globalConfigs.find((g) => g.id === msg.nodeId);
      let childConnectionTag: string | undefined;
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

      const configModel = await ExtensionCatalog.getConfigurationModel(
        msg.namespaceUri,
        msg.localName
      );

      if (configModel) {
        const displayName = configModel.displayName || toDisplayLabel(msg.localName);
        const iconId = undefined;

        // Configuration's own parameter groups (without connection tab)
        const groups: ParameterGroupModel[] = configModel.groups
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
        let matchedProvider: ConnectionProviderModel | undefined;
        if (configModel.connectionProviders && configModel.connectionProviders.length > 0) {
          if (childConnectionTag) {
            matchedProvider = configModel.connectionProviders.find((p) => {
              const pId = (p.id || p.name || '').toLowerCase().replace(/[-_]/g, '');
              const tagNormalized = childConnectionTag!.replace(/[-_]/g, '');
              return tagNormalized.includes(pId) || pId.includes(tagNormalized.replace(/connection$/, ''));
            });
          }
          if (!matchedProvider) {
            matchedProvider = configModel.connectionProviders.find((p) => {
              const pParams = p.parameters || (p.groups ? p.groups.flatMap((grp: ParameterGroupModel) => grp.parameters) : []);
              return pParams.some((param) => mergedAttributes[param.name] !== undefined);
            }) || configModel.connectionProviders[0];
          }
        } else if (configModel.connectionProvider) {
          matchedProvider = configModel.connectionProvider;
        }

        let connectionParams: ParameterModel[] = [];
        if (matchedProvider) {
          if (matchedProvider.parameters && matchedProvider.parameters.length > 0) {
            connectionParams = matchedProvider.parameters;
          } else if (matchedProvider.groups) {
            connectionParams = matchedProvider.groups.flatMap((grp: ParameterGroupModel) => grp.parameters);
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

        const canTest = ConnectionTester.canTest(mergedAttributes, msg.namespaceUri, msg.localName);

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
      } else {
        // Fallback for Configuration elements when connector JAR model isn't available
        const connKeys = new Set(['host', 'port', 'protocol', 'basePath', 'url', 'user', 'password', 'database']);
        const configParams: ParameterModel[] = [];
        const connParams: ParameterModel[] = [];
        for (const [k, v] of Object.entries(mergedAttributes)) {
          if (k === 'name' || k === 'doc:name' || k === 'doc:id') continue;
          const param = {
            ...buildParameterModel({ name: k, defaultValue: v, required: false, group: 'General' }),
            defaultValue: v,
          };
          if (connKeys.has(k)) {
            connParams.push(param);
          } else {
            configParams.push(param);
          }
        }
        const groups: ParameterGroupModel[] = [];
        if (configParams.length > 0) {
          groups.push({ name: 'General', parameters: configParams });
        }
        if (connParams.length > 0) {
          groups.push({ name: 'Connection', parameters: connParams });
        }
        const canTest = ConnectionTester.canTest(mergedAttributes, msg.namespaceUri, msg.localName);
        this.postMessage({
          type: 'updatePropertiesPanel',
          nodeId: msg.nodeId,
          displayName: toDisplayLabel(msg.localName),
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
    const componentModel = await ExtensionCatalog.getOperationOrSourceModel(
      msg.namespaceUri,
      msg.localName
    );

    // Look up configuration model for this component
    const configInfo = await ExtensionCatalog.getConfigurationModelForComponent(
      msg.namespaceUri,
      msg.localName
    );

    let configOptions: string[] = [];
    if (configInfo) {
      configOptions = await WorkspaceScanner.findConfigurationNames(
        configInfo.configXmlTag,
        this.currentDocUri
      );
    }

    let displayName = msg.localName;
    let iconId: string | undefined;
    let groups: ParameterGroupModel[] = [];

    if (componentModel) {
      displayName = componentModel.displayName;
      iconId = componentModel.iconId;

      // Deep clone groups and merge in node's actual current attribute values
      groups = componentModel.groups.map((group) => ({
        name: group.name,
        parameters: group.parameters.map((p) => {
          const actualVal = msg.attributes[p.name];
          const isConfigRef = p.isReference && p.referenceType === 'configuration';
          let opts: string[] | undefined;
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
    } else {
      // Fallback for core components or unknown elements
      displayName = toDisplayLabel(msg.localName);
      const params: ParameterModel[] = Object.entries(msg.attributes).map(([k, v]) => {
        const isConfigRef =
          k === 'config-ref' ||
          k.toLowerCase().endsWith('configref') ||
          k.toLowerCase().endsWith('-config-ref');
        let opts: string[] | undefined;
        if (isConfigRef) {
          opts = [...configOptions];
          if (v && !opts.includes(v)) {
            opts.unshift(v);
          }
        }
        return {
          ...buildParameterModel({
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
      groups = groupParameters(params);
    }

    this.postMessage({
      type: 'updatePropertiesPanel',
      nodeId: msg.nodeId,
      displayName,
      iconId,
      groups,
      currentValues: msg.attributes,
      autocompleteContext,
    });
  }

  private async handleCreateConfiguration(msg: {
    targetNodeId: string;
    configRefParamName: string;
    configXmlTag: string;
    configName: string;
    attributes: Record<string, string>;
  }): Promise<void> {
    const targetUri = await WorkspaceScanner.findTargetConfigFile(this.currentDocUri);
    if (!targetUri) {
      vscode.window.showErrorMessage('Unable to locate a Mule XML file in the project to insert configuration.');
      return;
    }

    // Build the configuration XML element string
    let attrsStr = `name="${FlowVisualizerPanel.escapeXml(msg.configName)}"`;
    for (const [k, v] of Object.entries(msg.attributes)) {
      if (k === 'name' || k.startsWith('_')) continue;
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
    } else {
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
          const matchRange = new vscode.Range(
            curDoc.positionAt(matchStartOffset),
            curDoc.positionAt(matchEndOffset)
          );
          workspaceEdit.replace(this.currentDocUri, matchRange, `${refAttr}="${msg.configName}"`);
        } else {
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
      vscode.window.showInformationMessage(
        `Created configuration "${msg.configName}" in ${path.basename(targetUri.fsPath)}.`
      );
      await targetDoc.save();
      if (this.currentDocUri && this.currentDocUri.toString() !== targetUri.toString()) {
        const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
        await curDoc.save();
      }
    }
  }

  private async handleUpdateConfigRef(msg: {
    targetNodeId: string;
    configRefParamName: string;
    configName: string;
  }): Promise<void> {
    if (!this.currentDocUri || !this.lastModel) return;
    const node = this.findNodeInModel(this.lastModel, msg.targetNodeId);
    if (!node) return;

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
      const matchRange = new vscode.Range(
        curDoc.positionAt(matchStartOffset),
        curDoc.positionAt(matchEndOffset)
      );
      workspaceEdit.replace(this.currentDocUri, matchRange, `${refAttr}="${msg.configName}"`);
    } else {
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

  private static escapeXml(unsafe: string): string {
    return String(unsafe || '')
      .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  private async handleUpdateParameterValue(msg: {
    nodeId: string;
    paramName: string;
    value: any;
    dataType?: string;
  }): Promise<void> {
    if (!this.currentDocUri || !this.lastModel) return;
    const node = this.findNodeInModel(this.lastModel, msg.nodeId);
    if (!node) return;

    // Handle Transform Message script write-back (replacing CDATA/child element content)
    if (msg.paramName === '__transform_payload__' || msg.paramName.startsWith('__transform_var:')) {
      await this.handleTransformScriptUpdate(node, msg.paramName, String(msg.value));
      return;
    }

    // Check if the parameter belongs to a child element (e.g. child connection element in config)
    let targetNode: Node = node;
    if (node.chain && node.chain.length > 0) {
      const childWithAttr = node.chain.find(
        (c) => c.attributes && c.attributes[msg.paramName] !== undefined
      );
      if (childWithAttr) {
        targetNode = childWithAttr;
      } else {
        const isConfig =
          node.descriptor?.kind === 'global-config' ||
          (node.descriptor?.localName || '').endsWith('config');
        if (isConfig) {
          const connChild = node.chain.find(
            (c) =>
              (c.descriptor?.localName || '').endsWith('connection') ||
              (c.descriptor?.localName || '').includes('connection')
          );
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
      if (ch === '"' && !inSingle) inDouble = !inDouble;
      else if (ch === "'" && !inDouble) inSingle = !inSingle;
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
        const matchRange = new vscode.Range(
          curDoc.positionAt(startOffset),
          curDoc.positionAt(endOffset)
        );
        workspaceEdit.delete(this.currentDocUri, matchRange);
      } else {
        // Targeted replacement of just this one attribute
        const matchStartOffset = curDoc.offsetAt(nodeStartPos) + match.index;
        const matchEndOffset = matchStartOffset + match[0].length;
        const matchRange = new vscode.Range(
          curDoc.positionAt(matchStartOffset),
          curDoc.positionAt(matchEndOffset)
        );
        const escapedVal = FlowVisualizerPanel.escapeXml(String(msg.value));
        workspaceEdit.replace(this.currentDocUri, matchRange, `${msg.paramName}="${escapedVal}"`);
      }
    } else {
      // 2. Attribute does not exist. Check if a child element exists for complex/list types
      const childRegex = new RegExp(
        `<([a-zA-Z0-9_-]+:)?${escapedParam}\\b[^>]*>[\\s\\S]*?<\\/([a-zA-Z0-9_-]+:)?${escapedParam}>|<([a-zA-Z0-9_-]+:)?${escapedParam}\\b[^>]*\\/>`
      );
      const childMatch = nodeText.match(childRegex);

      if (childMatch && childMatch.index !== undefined) {
        // Scoped replacement of existing child element
        const childStartOffset = curDoc.offsetAt(nodeStartPos) + childMatch.index;
        const childEndOffset = childStartOffset + childMatch[0].length;
        const childRange = new vscode.Range(
          curDoc.positionAt(childStartOffset),
          curDoc.positionAt(childEndOffset)
        );
        const prefixMatch = childMatch[0].match(/^<([a-zA-Z0-9_-]+:)/);
        const prefix = prefixMatch ? prefixMatch[1] : '';
        let childContent = '';
        if (msg.dataType === 'list' && Array.isArray(msg.value)) {
          childContent = msg.value
            .map((v: any) => `<value>${FlowVisualizerPanel.escapeXml(String(v))}</value>`)
            .join('');
        } else {
          childContent = String(msg.value || '');
        }
        const newChildXml = `<${prefix}${msg.paramName}>${childContent}</${prefix}${msg.paramName}>`;
        workspaceEdit.replace(this.currentDocUri, childRange, newChildXml);
      } else if (
        (msg.dataType === 'complex-object' || msg.dataType === 'list') &&
        msg.value !== null &&
        msg.value !== undefined &&
        String(msg.value).trim() !== ''
      ) {
        // Scoped insertion of new child element
        const closingTagMatch = nodeText.match(/<\/([a-zA-Z0-9_-]+:)?([a-zA-Z0-9_-]+)>\s*$/);
        const tagPrefixMatch = openTag.match(/^<([a-zA-Z0-9_-]+:)/);
        const prefix = tagPrefixMatch ? tagPrefixMatch[1] : '';
        let childContent = '';
        if (msg.dataType === 'list' && Array.isArray(msg.value)) {
          childContent = msg.value
            .map((v: any) => `<value>${FlowVisualizerPanel.escapeXml(String(v))}</value>`)
            .join('');
        } else {
          childContent = String(msg.value || '');
        }

        if (closingTagMatch && closingTagMatch.index !== undefined) {
          const insertOffset = curDoc.offsetAt(nodeStartPos) + closingTagMatch.index;
          const insertPos = curDoc.positionAt(insertOffset);
          const childXml = `\t<${prefix}${msg.paramName}>${childContent}</${prefix}${msg.paramName}>\n\t`;
          workspaceEdit.insert(this.currentDocUri, insertPos, childXml);
        } else if (isSelfClosing) {
          // Convert self-closing tag to open/close pair with child element
          const closeOffset = curDoc.offsetAt(nodeStartPos) + (openTagEnd - 2);
          const closePos = curDoc.positionAt(closeOffset);
          const tagNameMatch = openTag.match(/^<(([a-zA-Z0-9_-]+:)?[a-zA-Z0-9_-]+)/);
          const fullTagName = tagNameMatch ? tagNameMatch[1] : 'element';
          const childXml = `>\n\t\t<${prefix}${msg.paramName}>${childContent}</${prefix}${msg.paramName}>\n\t</${fullTagName}>`;
          const endPos = curDoc.positionAt(curDoc.offsetAt(nodeStartPos) + openTagEnd);
          workspaceEdit.replace(this.currentDocUri, new vscode.Range(closePos, endPos), childXml);
        }
      } else if (msg.value !== null && msg.value !== undefined && String(msg.value) !== '') {
        // 3. Standard attribute insertion: insert into opening tag right before closing > or />
        const escapedVal = FlowVisualizerPanel.escapeXml(String(msg.value));
        if (isSelfClosing) {
          const beforeSlash = openTag.slice(0, openTagEnd - 2);
          const trailingWsMatch = beforeSlash.match(/\s+$/);
          if (trailingWsMatch && trailingWsMatch.index !== undefined) {
            const insertOffset = curDoc.offsetAt(nodeStartPos) + trailingWsMatch.index;
            const insertPos = curDoc.positionAt(insertOffset);
            workspaceEdit.insert(this.currentDocUri, insertPos, ` ${msg.paramName}="${escapedVal}"`);
          } else {
            const insertOffset = curDoc.offsetAt(nodeStartPos) + (openTagEnd - 2);
            const insertPos = curDoc.positionAt(insertOffset);
            workspaceEdit.insert(this.currentDocUri, insertPos, ` ${msg.paramName}="${escapedVal}" `);
          }
        } else {
          const beforeGt = openTag.slice(0, openTagEnd - 1);
          const trailingWsMatch = beforeGt.match(/\s+$/);
          if (trailingWsMatch && trailingWsMatch.index !== undefined) {
            const insertOffset = curDoc.offsetAt(nodeStartPos) + trailingWsMatch.index;
            const insertPos = curDoc.positionAt(insertOffset);
            workspaceEdit.insert(this.currentDocUri, insertPos, ` ${msg.paramName}="${escapedVal}"`);
          } else {
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
        } else {
          targetNode.attributes[msg.paramName] = String(msg.value);
        }
      }
      if (node !== targetNode && node.attributes) {
        if (msg.value === null || msg.value === undefined) {
          delete node.attributes[msg.paramName];
        } else {
          node.attributes[msg.paramName] = String(msg.value);
        }
      }
      await curDoc.save();
    }
  }

  private async handleTransformScriptUpdate(
    node: Node,
    paramName: string,
    newScript: string
  ): Promise<void> {
    if (!this.currentDocUri) return;
    const curDoc = await vscode.workspace.openTextDocument(this.currentDocUri);
    const nodeStartPos = new vscode.Position(node.range.startLine, node.range.startCol);
    const nodeEndPos = new vscode.Position(node.range.endLine, node.range.endCol);
    const nodeRange = new vscode.Range(nodeStartPos, nodeEndPos);
    const nodeText = curDoc.getText(nodeRange);

    const workspaceEdit = new vscode.WorkspaceEdit();

    if (paramName === '__transform_payload__') {
      const setPayloadRegex = /<([a-zA-Z0-9_-]+:)?set-payload\b[^>]*>([\s\S]*?)<\/([a-zA-Z0-9_-]+:)?set-payload>/;
      const match = nodeText.match(setPayloadRegex);

      if (match && match.index !== undefined) {
        const fullInner = match[2];
        const innerOffset = match.index + match[0].indexOf(fullInner);
        const cdataMatch = fullInner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);

        if (cdataMatch && cdataMatch.index !== undefined) {
          const cdataStartOffset = curDoc.offsetAt(nodeStartPos) + innerOffset + cdataMatch.index + 9;
          const cdataEndOffset = cdataStartOffset + cdataMatch[1].length;
          const replaceRange = new vscode.Range(
            curDoc.positionAt(cdataStartOffset),
            curDoc.positionAt(cdataEndOffset)
          );
          workspaceEdit.replace(this.currentDocUri, replaceRange, newScript);
        } else {
          const innerStartOffset = curDoc.offsetAt(nodeStartPos) + innerOffset;
          const innerEndOffset = innerStartOffset + fullInner.length;
          const replaceRange = new vscode.Range(
            curDoc.positionAt(innerStartOffset),
            curDoc.positionAt(innerEndOffset)
          );
          workspaceEdit.replace(this.currentDocUri, replaceRange, `<![CDATA[${newScript}]]>`);
        }
      } else {
        const messageRegex = /<([a-zA-Z0-9_-]+:)?message\b[^>]*>([\s\S]*?)<\/([a-zA-Z0-9_-]+:)?message>/;
        const msgMatch = nodeText.match(messageRegex);
        const prefix = nodeText.match(/<([a-zA-Z0-9_-]+):transform/)?.[1] || 'ee';

        if (msgMatch && msgMatch.index !== undefined) {
          const insertOffset = curDoc.offsetAt(nodeStartPos) + msgMatch.index + msgMatch[0].indexOf(msgMatch[2]);
          const insertPos = curDoc.positionAt(insertOffset);
          workspaceEdit.insert(
            this.currentDocUri,
            insertPos,
            `\n\t\t<${prefix}:set-payload><![CDATA[${newScript}]]></${prefix}:set-payload>`
          );
        } else {
          const openTagMatch = nodeText.match(/<([a-zA-Z0-9_-]+:)?transform\b[^>]*>/);
          if (openTagMatch && openTagMatch.index !== undefined) {
            const insertOffset = curDoc.offsetAt(nodeStartPos) + openTagMatch.index + openTagMatch[0].length;
            const insertPos = curDoc.positionAt(insertOffset);
            workspaceEdit.insert(
              this.currentDocUri,
              insertPos,
              `\n\t<${prefix}:message>\n\t\t<${prefix}:set-payload><![CDATA[${newScript}]]></${prefix}:set-payload>\n\t</${prefix}:message>`
            );
          }
        }
      }
    } else if (paramName.startsWith('__transform_var:')) {
      const varName = paramName.slice('__transform_var:'.length);
      const prefix = nodeText.match(/<([a-zA-Z0-9_-]+):transform/)?.[1] || 'ee';
      const varRegex = new RegExp(
        `<([a-zA-Z0-9_-]+:)?set-variable\\b[^>]*variableName="${varName}"[^>]*>([\\s\\S]*?)<\\/([a-zA-Z0-9_-]+:)?set-variable>`
      );
      const match = nodeText.match(varRegex);

      if (match && match.index !== undefined) {
        const fullInner = match[2];
        const innerOffset = match.index + match[0].indexOf(fullInner);
        const cdataMatch = fullInner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);

        if (cdataMatch && cdataMatch.index !== undefined) {
          const cdataStartOffset = curDoc.offsetAt(nodeStartPos) + innerOffset + cdataMatch.index + 9;
          const cdataEndOffset = cdataStartOffset + cdataMatch[1].length;
          const replaceRange = new vscode.Range(
            curDoc.positionAt(cdataStartOffset),
            curDoc.positionAt(cdataEndOffset)
          );
          workspaceEdit.replace(this.currentDocUri, replaceRange, newScript);
        } else {
          const innerStartOffset = curDoc.offsetAt(nodeStartPos) + innerOffset;
          const innerEndOffset = innerStartOffset + fullInner.length;
          const replaceRange = new vscode.Range(
            curDoc.positionAt(innerStartOffset),
            curDoc.positionAt(innerEndOffset)
          );
          workspaceEdit.replace(this.currentDocUri, replaceRange, `<![CDATA[${newScript}]]>`);
        }
      } else {
        const varsRegex = /<([a-zA-Z0-9_-]+:)?variables\b[^>]*>([\s\S]*?)<\/([a-zA-Z0-9_-]+:)?variables>/;
        const varsMatch = nodeText.match(varsRegex);

        if (varsMatch && varsMatch.index !== undefined) {
          const insertOffset = curDoc.offsetAt(nodeStartPos) + varsMatch.index + varsMatch[0].indexOf(varsMatch[2]);
          const insertPos = curDoc.positionAt(insertOffset);
          workspaceEdit.insert(
            this.currentDocUri,
            insertPos,
            `\n\t\t<${prefix}:set-variable variableName="${varName}"><![CDATA[${newScript}]]></${prefix}:set-variable>`
          );
        } else {
          const closeTagMatch = nodeText.match(/<\/([a-zA-Z0-9_-]+:)?transform>/);
          if (closeTagMatch && closeTagMatch.index !== undefined) {
            const insertOffset = curDoc.offsetAt(nodeStartPos) + closeTagMatch.index;
            const insertPos = curDoc.positionAt(insertOffset);
            workspaceEdit.insert(
              this.currentDocUri,
              insertPos,
              `\t<${prefix}:variables>\n\t\t<${prefix}:set-variable variableName="${varName}"><![CDATA[${newScript}]]></${prefix}:set-variable>\n\t</${prefix}:variables>\n`
            );
          }
        }
      }
    }

    const applied = await vscode.workspace.applyEdit(workspaceEdit);
    if (applied) {
      await curDoc.save();
    }
  }

  private async handleTestConnection(msg: {
    nodeId: string;
    namespaceUri: string;
    localName: string;
    attributes: Record<string, any>;
  }): Promise<void> {
    try {
      const result = await ConnectionTester.test(msg.attributes, msg.namespaceUri, msg.localName);
      this.postMessage({
        type: 'testConnectionResult',
        success: result.success,
        message: result.message,
        durationMs: result.durationMs,
      });
    } catch (e: any) {
      this.postMessage({
        type: 'testConnectionResult',
        success: false,
        message: `Connection test error: ${e.message || String(e)}`,
      });
    }
  }

  private findNodeInModel(model: SemanticModel, id: string): Node | null {
    const searchNode = (n: Node): Node | null => {
      if (n.id === id) return n;
      for (const c of n.chain) {
        const found = searchNode(c);
        if (found) return found;
      }
      for (const r of n.routes) {
        for (const c of r.chain) {
          const found = searchNode(c);
          if (found) return found;
        }
      }
      return null;
    };

    for (const g of model.globalConfigs) {
      const found = searchNode(g);
      if (found) return found;
    }

    for (const flow of model.flows) {
      if (flow.source) {
        const found = searchNode(flow.source);
        if (found) return found;
      }
      for (const c of flow.chain) {
        const found = searchNode(c);
        if (found) return found;
      }
      for (const r of flow.errorHandler) {
        for (const c of r.chain) {
          const found = searchNode(c);
          if (found) return found;
        }
      }
    }

    return null;
  }

  private parseObjectKeys(objContent: string): Array<{ name: string; children?: string[] }> {
    const keys: Array<{ name: string; children?: string[] }> = [];
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
              let childKeys: string[] = [];
              const afterColon = objContent.slice(i + 1).trimStart();
              if (afterColon.startsWith('{')) {
                let subDepth = 0;
                let endSub = -1;
                for (let j = 0; j < afterColon.length; j++) {
                  if (afterColon[j] === '{') subDepth++;
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

  private extractDataWeaveShape(script: string): { outputType?: string; fields: Array<{ name: string; children?: string[] }> } | undefined {
    if (!script) return undefined;

    const outMatch = script.match(/output\s+([a-zA-Z0-9_\-\/]+)/);
    const outputType = outMatch ? outMatch[1] : undefined;

    const separatorIndex = script.indexOf('---');
    let body = separatorIndex >= 0 ? script.slice(separatorIndex + 3).trim() : script.trim();
    body = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    let fields: Array<{ name: string; children?: string[] }> = [];
    const xmlRootMatch = body.match(/^([a-zA-Z0-9_-]+)\s*:\s*\{([\s\S]*)\}\s*$/);
    if (xmlRootMatch) {
      const rootPrefix = xmlRootMatch[1];
      const topKeys = this.parseObjectKeys(xmlRootMatch[2]);
      fields.push({
        name: rootPrefix,
        children: topKeys.map((k) => k.name),
      });
    } else {
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

  private computeStaticAutocompleteContext(
    model: SemanticModel,
    targetNodeId: string,
    docText: string
  ): {
    variables: Array<{ name: string; type?: string }>;
    precedingPayloadShape?: { outputType?: string; fields: Array<{ name: string; children?: string[] }> };
  } {
    const nodesBefore: Node[] = [];
    let found = false;

    const traverseNode = (node: Node): boolean => {
      if (node.id === targetNodeId) {
        found = true;
        return true;
      }
      nodesBefore.push(node);

      if (node.chain && node.chain.length > 0) {
        for (const child of node.chain) {
          if (traverseNode(child)) return true;
        }
      }
      if (node.routes && node.routes.length > 0) {
        for (const route of node.routes) {
          if (route.chain) {
            for (const child of route.chain) {
              if (traverseNode(child)) return true;
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
          if (traverseNode(node)) break;
        }
        if (found) break;
      }
      if (flow.errorHandler) {
        for (const route of flow.errorHandler) {
          if (route.chain) {
            for (const child of route.chain) {
              if (traverseNode(child)) break;
            }
            if (found) break;
          }
        }
        if (found) break;
      }
    }

    if (!found) {
      return { variables: [] };
    }

    // 1. Variables declared earlier in this flow
    const variables: Array<{ name: string; type?: string }> = [];
    const seenVarNames = new Set<string>();

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
        try {
          const lines = docText.split('\n');
          const nodeSlice = lines.slice(n.range.startLine, n.range.endLine + 1).join('\n');
          const vRegex = /<([a-zA-Z0-9_-]+:)?set-variable\b([^>]*)>/g;
          let vm: RegExpExecArray | null;
          while ((vm = vRegex.exec(nodeSlice)) !== null) {
            const attrStr = vm[2];
            const nm = attrStr.match(/variableName="([^"]+)"/) || attrStr.match(/name="([^"]+)"/);
            if (nm && nm[1] && !seenVarNames.has(nm[1])) {
              seenVarNames.add(nm[1]);
              variables.push({ name: nm[1] });
            }
          }
        } catch {}
      }
    }

    // 2. Preceding component payload shape (ONLY if immediately preceding component in same chain is a Transform Message)
    let precedingPayloadShape: { outputType?: string; fields: Array<{ name: string; children?: string[] }> } | undefined;
    const prevNode = nodesBefore.length > 0 ? nodesBefore[nodesBefore.length - 1] : undefined;
    if (prevNode && prevNode.descriptor && (prevNode.descriptor.localName === 'transform' || prevNode.descriptor.localName === 'transform-message')) {
      try {
        const lines = docText.split('\n');
        const prevSlice = lines.slice(prevNode.range.startLine, prevNode.range.endLine + 1).join('\n');
        let payloadScript = '';
        const payloadMatch = prevSlice.match(/<([a-zA-Z0-9_-]+:)?set-payload\b[^>]*>([\s\S]*?)<\/([a-zA-Z0-9_-]+:)?set-payload>/);
        if (payloadMatch) {
          const rawInner = payloadMatch[2];
          const cdataMatch = rawInner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
          payloadScript = cdataMatch ? cdataMatch[1] : rawInner.trim();
        } else {
          const cdataMatch = prevSlice.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
          if (cdataMatch) {
            payloadScript = cdataMatch[1];
          }
        }

        if (payloadScript) {
          precedingPayloadShape = this.extractDataWeaveShape(payloadScript);
        }
      } catch {}
    }

    return {
      variables,
      precedingPayloadShape,
    };
  }

  private async revealXmlRange(range: SourceRange, focusEditor?: boolean): Promise<void> {
    if (!this.currentDocUri) return;

    this.isSyncingFromWebview = true;
    try {
      const editor = await vscode.window.showTextDocument(this.currentDocUri, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: !focusEditor,
      });

      const vsRange = new vscode.Range(
        new vscode.Position(range.startLine, range.startCol),
        new vscode.Position(range.endLine, range.endCol)
      );

      editor.selection = new vscode.Selection(vsRange.start, vsRange.end);
      editor.revealRange(vsRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    } finally {
      setTimeout(() => {
        this.isSyncingFromWebview = false;
      }, 100);
    }
  }

  private async syncEditorCursorToWebview(pos: vscode.Position): Promise<void> {
    if (!this.lastModel) return;

    const line = pos.line;
    const col = pos.character;

    // Search for the innermost node enclosing this position
    let bestNode: Node | null = null;
    let minSpan = Number.MAX_VALUE;

    const checkNode = (node: Node) => {
      const r = node.range;
      if (
        (line > r.startLine || (line === r.startLine && col >= r.startCol)) &&
        (line < r.endLine || (line === r.endLine && col <= r.endCol))
      ) {
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
        nodeId: (bestNode as Node).id,
        range: (bestNode as Node).range,
      });
    }
  }

  private async handleFlowRefNavigation(flowName: string): Promise<void> {
    // Check if target is in another XML file in workspace
    const allFiles = await WorkspaceScanner.findMuleXmlFiles();
    for (const fileUri of allFiles) {
      try {
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const text = doc.getText();
        if (text.includes(`name="${flowName}"`)) {
          // Open diagram for this file
          FlowVisualizerPanel.createOrShow(this.extensionUri, fileUri);
          return;
        }
      } catch {
        // Skip
      }
    }

    vscode.window.showInformationMessage(`Flow "${flowName}" not found in workspace.`);
  }

  private async handleExport(format: 'svg' | 'png'): Promise<void> {
    if (!this.lastScene) return;

    const saveUri = await vscode.window.showSaveDialog({
      filters: format === 'svg' ? { SVG: ['svg'] } : { PNG: ['png'] },
      saveLabel: `Export as ${format.toUpperCase()}`,
    });

    if (!saveUri) return;

    // We can export SVG directly
    const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${this.lastScene.totalWidth}" height="${this.lastScene.totalHeight}" viewBox="0 0 ${this.lastScene.totalWidth} ${this.lastScene.totalHeight}">`;
    const symbols = IconStore.getAllSymbols();
    const arrowMarker = `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#90a4ae"/></marker>`;
    const defs = `<defs>${arrowMarker}\n${symbols}</defs>`;

    const fullSvg = `${svgHeader}\n${defs}\n<rect width="100%" height="100%" fill="#1e1e1e"/>\n<!-- Scene -->\n</svg>`;
    fs.writeFileSync(saveUri.fsPath, fullSvg, 'utf-8');
    vscode.window.showInformationMessage(`Exported flow diagram to ${path.basename(saveUri.fsPath)}`);
  }

  private postMessage(message: HostToWebviewMessage): void {
    this.panel.webview.postMessage(message);
  }

  public dispose(): void {
    FlowVisualizerPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }
}
