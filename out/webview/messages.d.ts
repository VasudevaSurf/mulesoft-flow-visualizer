import { SemanticModel, SourceRange } from '../parser/types';
import { PositionedScene } from '../layout/types';
import { ParameterGroupModel } from '../catalog/extensionModelReader';
/**
 * Host to Webview messages
 */
export type HostToWebviewMessage = {
    type: 'updateModel';
    model: SemanticModel;
    scene: PositionedScene;
    symbolsSvg: string;
    theme: 'vscode' | 'studio';
} | {
    type: 'selectNode';
    nodeId: string;
    range: SourceRange;
} | {
    type: 'setTheme';
    theme: 'vscode' | 'studio';
} | {
    type: 'showWarning';
    message: string;
} | {
    type: 'updatePropertiesPanel';
    nodeId: string;
    displayName: string;
    iconId?: string;
    groups: ParameterGroupModel[];
    currentValues: Record<string, any>;
    isConfiguration?: boolean;
    testConnectionAvailable?: boolean;
    namespaceUri?: string;
    localName?: string;
    isTransform?: boolean;
    transformData?: {
        script: string;
        attributesScript?: string;
        targetVariables: Array<{
            name: string;
            script: string;
            resource?: string;
        }>;
        outputType?: string;
    };
    isRouter?: boolean;
    routerRoutes?: Array<{
        id: string;
        kind: string;
        expression?: string;
        label: string;
    }>;
    autocompleteContext?: {
        variables: Array<{
            name: string;
            type?: string;
        }>;
        precedingPayloadShape?: {
            outputType?: string;
            fields: Array<{
                name: string;
                children?: string[];
            }>;
        };
    };
} | {
    type: 'testConnectionResult';
    success: boolean;
    message: string;
    durationMs?: number;
};
/**
 * Webview to Host messages
 */
export type WebviewToHostMessage = {
    type: 'ready';
} | {
    type: 'revealXml';
    range: SourceRange;
    focusEditor?: boolean;
} | {
    type: 'showProperties';
    nodeId: string;
    namespaceUri: string;
    localName: string;
    attributes: Record<string, string>;
    isConfiguration?: boolean;
} | {
    type: 'navigateFlowRef';
    flowName: string;
} | {
    type: 'toggleCollapse';
    nodeId: string;
} | {
    type: 'exportScene';
    format: 'svg' | 'png';
} | {
    type: 'createConfiguration';
    targetNodeId: string;
    configRefParamName: string;
    configXmlTag: string;
    configName: string;
    attributes: Record<string, string>;
} | {
    type: 'updateConfigRef';
    targetNodeId: string;
    configRefParamName: string;
    configName: string;
} | {
    type: 'testConnection';
    nodeId: string;
    namespaceUri: string;
    localName: string;
    attributes: Record<string, any>;
} | {
    type: 'updateParameterValue';
    nodeId: string;
    paramName: string;
    value: any;
    dataType?: string;
} | {
    type: 'addChoiceRoute';
    nodeId: string;
} | {
    type: 'deleteRoute';
    routeId: string;
} | {
    type: 'reorderChoiceRoutes';
    nodeId: string;
    fromIndex: number;
    toIndex: number;
};
//# sourceMappingURL=messages.d.ts.map