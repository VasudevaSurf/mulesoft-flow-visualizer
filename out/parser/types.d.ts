/**
 * src/parser/types.ts
 *
 * Core domain types specified in Section 3 of the specification.
 */
export interface SourceRange {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
}
export interface RawElement {
    prefix: string | null;
    localName: string;
    namespaceUri: string | null;
    attributes: Record<string, string>;
    children: RawElement[];
    range: SourceRange;
    nameRange: SourceRange;
    text: string | null;
}
export type ComponentKind = 'source' | 'operation' | 'scope' | 'router' | 'error-handler' | 'error-handler-case' | 'route' | 'flow' | 'sub-flow' | 'global-config' | 'unknown';
export interface ComponentDescriptor {
    namespaceUri: string;
    localName: string;
    kind: ComponentKind;
    displayName: string;
    iconId: string;
    /** For routers: which child element names are route wrappers. */
    routeElementNames?: string[];
    /** For scopes: which child element wraps the chain, if any (often none). */
    chainWrapperName?: string;
    /** Attribute to prefer for the secondary label under the name. */
    subtitleAttribute?: string;
}
export interface ModelDiagnostic {
    message: string;
    severity: 'warning' | 'error' | 'info';
    range?: SourceRange;
    elementName?: string;
}
export interface Node {
    id: string;
    descriptor: ComponentDescriptor;
    label: string;
    subtitle: string | null;
    attributes: Record<string, string>;
    range: SourceRange;
    /** Sequential children (a chain). Empty for leaf operations. */
    chain: Node[];
    /** Route lanes. Non-empty only for routers and error handlers. */
    routes: Route[];
    collapsed: boolean;
    diagnostics: ModelDiagnostic[];
}
export interface Route {
    id: string;
    label: string;
    kind: 'when' | 'otherwise' | 'route' | 'on-error-propagate' | 'on-error-continue';
    chain: Node[];
    range: SourceRange;
}
export interface FlowModel {
    id: string;
    name: string;
    type: 'flow' | 'sub-flow' | 'global-error-handler';
    source: Node | null;
    chain: Node[];
    errorHandler: Route[];
    errorHandlerRef: string | null;
    range: SourceRange;
    collapsed: boolean;
    errorBandCollapsed?: boolean;
}
export interface SemanticModel {
    filePath: string;
    flows: FlowModel[];
    globalConfigs: Node[];
    unresolvedNamespaces: string[];
    catalogStatus: 'complete' | 'partial' | 'unavailable';
}
//# sourceMappingURL=types.d.ts.map