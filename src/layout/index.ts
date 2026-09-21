import { SemanticModel } from '../parser/types';
import { PositionedScene, PositionedFlow, LayoutOptions } from './types';
import { MeasureEngine } from './measure';
import { PlaceEngine } from './place';
import { L } from './constants';

export * from './types';
export * from './constants';
export * from './measure';
export * from './place';

/**
 * Pure synchronous layout function: SemanticModel -> PositionedScene.
 * Has zero DOM dependencies, deterministic, fully testable in Node.
 */
export function layout(model: SemanticModel, opts: LayoutOptions = {}): PositionedScene {
  const collapseOption = opts.collapseErrorHandlers || 'auto';
  const totalFlows = model.flows.length;

  const positionedFlows: PositionedFlow[] = [];
  let currentY = L.canvasPad;
  let maxFlowW = 0;

  for (const flow of model.flows) {
    // 1. Measure bottom-up
    const measuredFlow = MeasureEngine.measureFlow(flow, collapseOption, totalFlows);

    if (measuredFlow.w > maxFlowW) {
      maxFlowW = measuredFlow.w;
    }

    // 2. Place top-down
    const posFlow = PlaceEngine.placeFlow(measuredFlow, L.canvasPad, currentY);
    positionedFlows.push(posFlow);

    currentY += posFlow.height + L.flowGapY;
  }

  const totalWidth = maxFlowW + L.canvasPad * 2;
  const totalHeight = currentY - L.flowGapY + L.canvasPad;

  return {
    flows: positionedFlows,
    totalWidth: Math.max(totalWidth, 800),
    totalHeight: Math.max(totalHeight, 600),
  };
}
