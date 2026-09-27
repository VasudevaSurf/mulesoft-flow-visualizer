import * as vscode from 'vscode';
import { Node } from '../parser/types';
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
    private handleShowProperties;
    private handleCreateConfiguration;
    private handleUpdateConfigRef;
    /**
     * Generic reader that walks a component's Node.body structure to extract
     * payload script, target variables, and child element values without regex re-scraping.
     */
    static extractComponentBody(node?: Node | null): {
        primaryScript?: string;
        variables: Array<{
            name: string;
            script: string;
        }>;
        childValues: Record<string, string>;
    };
    private static escapeXml;
    private handleUpdateParameterValue;
    private handleTransformScriptUpdate;
    private handleTestConnection;
    private findNodeInModel;
    private parseObjectKeys;
    private extractDataWeaveShape;
    private computeStaticAutocompleteContext;
    private revealXmlRange;
    private syncEditorCursorToWebview;
    private handleFlowRefNavigation;
    private handleExport;
    private postMessage;
    dispose(): void;
}
//# sourceMappingURL=panel.d.ts.map