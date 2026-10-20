import * as vscode from 'vscode';
import { WebviewToHostMessage } from './messages';
import { SourceRange, SemanticModel, Node } from '../parser/types';
export declare class FlowVisualizerPanel {
    static currentPanel: FlowVisualizerPanel | undefined;
    private static readonly viewType;
    private readonly panel;
    private readonly extensionUri;
    private disposables;
    currentDocUri: vscode.Uri | null;
    private debounceTimer;
    private isSyncingFromWebview;
    lastModel: SemanticModel | null;
    private lastScene;
    private collapsedNodeIds;
    static createOrShow(extensionUri: vscode.Uri, xmlUri?: vscode.Uri): FlowVisualizerPanel;
    private constructor();
    loadDocument(uri: vscode.Uri): Promise<void>;
    private triggerUpdateDebounced;
    updateView(): Promise<void>;
    handleWebviewMessage(msg: WebviewToHostMessage): Promise<void>;
    private static outputChannel;
    static getOutputChannel(): vscode.OutputChannel;
    private handleShowProperties;
    private handleCreateConfiguration;
    private handleUpdateConfigRef;
    static getProjectRoot(docFsPath: string): string;
    static resolveDwlResourcePath(resPath: string, currentDocUri?: vscode.Uri | null): string | null;
    static loadDwlResource(resPath: string, currentDocUri?: vscode.Uri | null): string;
    /**
     * Generic reader that walks a component's Node.body structure to extract
     * payload script, target variables, and child element values without regex re-scraping.
     */
    static extractComponentBody(node?: Node | null, currentDocUri?: vscode.Uri | null): {
        primaryScript?: string;
        payloadResource?: string;
        hasPayload?: boolean;
        attributesScript?: string;
        attributesResource?: string;
        hasAttributes?: boolean;
        variables: Array<{
            name: string;
            script: string;
            resource?: string;
        }>;
        childValues: Record<string, string>;
    };
    static escapeXml(unsafe: string): string;
    handleUpdateParameterValue(msg: {
        nodeId: string;
        paramName: string;
        value: any;
        dataType?: string;
    }): Promise<void>;
    private handleTransformScriptUpdate;
    private handleTestConnection;
    private handleAddChoiceRoute;
    handleDeleteRoute(routeId: string): Promise<void>;
    handleReorderChoiceRoutes(nodeId: string, fromIndex: number, toIndex: number): Promise<void>;
    private handleMunitChildElementUpdate;
    static updateExpressionInXml(xmlContent: string, routeRange: SourceRange, newExpr: string): string;
    static deleteRouteInXml(xmlContent: string, routeRange: SourceRange): string;
    static reorderChoiceRoutesInXml(xmlContent: string, routeRangeA: SourceRange, routeRangeB: SourceRange): string;
    static findNodeInModel(model: SemanticModel, id: string): Node | null;
    findNodeInModel(model: SemanticModel, id: string): Node | null;
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