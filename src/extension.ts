import * as vscode from 'vscode';
import { FlowVisualizerPanel } from './webview/panel';
import { WorkspaceScanner } from './workspace/scanner';
import { ExtensionCatalog } from './catalog';

export function activate(context: vscode.ExtensionContext) {
  // Initialize on-disk catalog cache
  try {
    ExtensionCatalog.initCache(context.globalStorageUri.fsPath);
  } catch (e) {
    console.warn('Failed to initialize catalog cache directory:', e);
  }

  // Command: Open Flow Diagram
  const openCommand = vscode.commands.registerCommand(
    'mulesoft-flow-visualizer.openVisualizer',
    (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      FlowVisualizerPanel.createOrShow(context.extensionUri, targetUri);
    }
  );

  // Alias Command: muleFlow.openDiagram
  const openAliasCommand = vscode.commands.registerCommand(
    'muleFlow.openDiagram',
    (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      FlowVisualizerPanel.createOrShow(context.extensionUri, targetUri);
    }
  );

  // Command: Refresh Visualizer
  const refreshCommand = vscode.commands.registerCommand(
    'mulesoft-flow-visualizer.refreshVisualizer',
    () => {
      if (FlowVisualizerPanel.currentPanel) {
        FlowVisualizerPanel.currentPanel.updateView();
      }
    }
  );

  // CodeLens Provider: "Open Flow Diagram" at line 0 of any Mule XML file
  const codeLensProvider = vscode.languages.registerCodeLensProvider(
    { language: 'xml', scheme: 'file' },
    {
      provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const text = document.getText();
        if (!WorkspaceScanner.isMuleXml(text)) {
          return [];
        }

        const topRange = new vscode.Range(0, 0, 0, 0);
        return [
          new vscode.CodeLens(topRange, {
            title: '$(graph) Open Flow Diagram (Anypoint Studio Layout)',
            command: 'mulesoft-flow-visualizer.openVisualizer',
            arguments: [document.uri],
          }),
        ];
      },
    }
  );

  context.subscriptions.push(
    openCommand,
    openAliasCommand,
    refreshCommand,
    codeLensProvider
  );
}

export function deactivate() {
  if (FlowVisualizerPanel.currentPanel) {
    FlowVisualizerPanel.currentPanel.dispose();
  }
}