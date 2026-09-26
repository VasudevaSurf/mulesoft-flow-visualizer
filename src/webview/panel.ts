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
import { WebviewHtmlBuilder } from './html';
import { HostToWebviewMessage, WebviewToHostMessage } from './messages';
import { SourceRange, SemanticModel, Node, FlowModel } from '../parser/types';
import { PositionedScene } from '../layout/types';

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
          message: `XML Parse Notice: ${error}. Showing last valid layout.`,
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
        this.revealXmlRange(msg.range);
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
    }
  }

  private async revealXmlRange(range: SourceRange): Promise<void> {
    if (!this.currentDocUri) return;

    this.isSyncingFromWebview = true;
    try {
      const editor = await vscode.window.showTextDocument(this.currentDocUri, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
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
