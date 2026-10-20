import { RawElement, SemanticModel, FlowModel, Node } from './types';
export declare class SemanticModelBuilder {
    /**
     * Transforms a RawElement XML tree into a SemanticModel ready for layout and rendering.
     */
    static build(root: RawElement, filePath: string): SemanticModel;
    private static isKnownProcessor;
    private static isMessageSource;
    private static buildFlow;
    private static buildGlobalErrorHandler;
    private static buildErrorRoute;
    private static buildNode;
    private static resolveSubtitle;
    static buildBatchJobNode(el: RawElement, flowName: string, path: string, unresolvedNs: Set<string>): Node;
    static buildBatchStepNode(el: RawElement, flowName: string, path: string, unresolvedNs: Set<string>): Node;
    static buildBatchAggregatorNode(el: RawElement, flowName: string, path: string, unresolvedNs: Set<string>): Node;
    static buildMunitTestFlow(flowEl: RawElement, unresolvedNs: Set<string>): FlowModel;
}
//# sourceMappingURL=semanticModel.d.ts.map