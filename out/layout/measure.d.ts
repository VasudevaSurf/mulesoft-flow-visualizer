import { Node, Route, FlowModel } from '../parser/types';
export interface MeasuredBox {
    w: number;
    h: number;
    laneY: number;
}
export interface MeasuredNode extends MeasuredBox {
    node: Node;
    innerChain?: MeasuredChain;
    innerRoutes?: MeasuredRoute[];
    collapsedBadgeCount?: number;
}
export interface MeasuredRoute extends MeasuredBox {
    route: Route;
    innerChain: MeasuredChain;
}
export interface MeasuredChain extends MeasuredBox {
    items: MeasuredNode[];
}
export interface MeasuredFlow extends MeasuredBox {
    flow: FlowModel;
    sourceMeasured: MeasuredNode | null;
    processChain: MeasuredChain;
    errorLanes: MeasuredRoute[];
    errorCollapsed: boolean;
}
export declare class MeasureEngine {
    /**
     * Measures a single Node bottom-up.
     */
    static measureNode(node: Node, depth?: number): MeasuredNode;
    /**
     * Measures a sequential chain of nodes.
     * All siblings align vertically on max(sibling.laneY).
     */
    static measureChain(chain: Node[], depth?: number): MeasuredChain;
    /**
     * Measures a full Flow container.
     */
    static measureFlow(flow: FlowModel, collapseErrorHandlersOption?: 'never' | 'always' | 'auto', totalFlowsInFile?: number): MeasuredFlow;
    private static countDescendantProcessors;
}
//# sourceMappingURL=measure.d.ts.map