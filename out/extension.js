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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const panel_1 = require("./webview/panel");
const scanner_1 = require("./workspace/scanner");
const catalog_1 = require("./catalog");
function activate(context) {
    // Initialize on-disk catalog cache
    try {
        catalog_1.ExtensionCatalog.initCache(context.globalStorageUri.fsPath);
    }
    catch (e) {
        console.warn('Failed to initialize catalog cache directory:', e);
    }
    // Command: Open Flow Diagram
    const openCommand = vscode.commands.registerCommand('mulesoft-flow-visualizer.openVisualizer', (uri) => {
        const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
        panel_1.FlowVisualizerPanel.createOrShow(context.extensionUri, targetUri);
    });
    // Alias Command: muleFlow.openDiagram
    const openAliasCommand = vscode.commands.registerCommand('muleFlow.openDiagram', (uri) => {
        const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
        panel_1.FlowVisualizerPanel.createOrShow(context.extensionUri, targetUri);
    });
    // Command: Refresh Visualizer
    const refreshCommand = vscode.commands.registerCommand('mulesoft-flow-visualizer.refreshVisualizer', () => {
        if (panel_1.FlowVisualizerPanel.currentPanel) {
            panel_1.FlowVisualizerPanel.currentPanel.updateView();
        }
    });
    // CodeLens Provider: "Open Flow Diagram" at line 0 of any Mule XML file
    const codeLensProvider = vscode.languages.registerCodeLensProvider({ language: 'xml', scheme: 'file' }, {
        provideCodeLenses(document) {
            const text = document.getText();
            if (!scanner_1.WorkspaceScanner.isMuleXml(text)) {
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
    });
    context.subscriptions.push(openCommand, openAliasCommand, refreshCommand, codeLensProvider);
}
function deactivate() {
    if (panel_1.FlowVisualizerPanel.currentPanel) {
        panel_1.FlowVisualizerPanel.currentPanel.dispose();
    }
}
//# sourceMappingURL=extension.js.map