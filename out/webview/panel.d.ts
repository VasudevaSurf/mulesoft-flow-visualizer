import * as vscode from 'vscode';
export declare class FlowVisualizerPanel {
    static currentPanel: FlowVisualizerPanel | undefined;
    private static readonly viewType;
    private readonly panel;
    private readonly extensionUri;
    private disposables;
    private currentDocUri;
    private debounceTimer;
    private isSyncingFromWebview;
    private lastModel;
    private lastScene;
    private collapsedNodeIds;
    static createOrShow(extensionUri: vscode.Uri, xmlUri?: vscode.Uri): FlowVisualizerPanel;
    private constructor();
    loadDocument(uri: vscode.Uri): Promise<void>;
    private triggerUpdateDebounced;
    updateView(): Promise<void>;
    private handleWebviewMessage;
    private revealXmlRange;
    private syncEditorCursorToWebview;
    private handleFlowRefNavigation;
    private handleExport;
    private postMessage;
    dispose(): void;
}
//# sourceMappingURL=panel.d.ts.map