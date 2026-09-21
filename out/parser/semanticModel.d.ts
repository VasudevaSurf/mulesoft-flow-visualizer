import { RawElement, SemanticModel } from './types';
export declare class SemanticModelBuilder {
    /**
     * Transforms a RawElement XML tree into a SemanticModel ready for layout and rendering.
     */
    static build(root: RawElement, filePath: string): SemanticModel;
    private static buildFlow;
    private static buildGlobalErrorHandler;
    private static buildErrorRoute;
    private static buildNode;
    private static resolveSubtitle;
}
//# sourceMappingURL=semanticModel.d.ts.map