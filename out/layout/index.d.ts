import { SemanticModel } from '../parser/types';
import { PositionedScene, LayoutOptions } from './types';
export * from './types';
export * from './constants';
export * from './measure';
export * from './place';
/**
 * Pure synchronous layout function: SemanticModel -> PositionedScene.
 * Has zero DOM dependencies, deterministic, fully testable in Node.
 */
export declare function layout(model: SemanticModel, opts?: LayoutOptions): PositionedScene;
//# sourceMappingURL=index.d.ts.map