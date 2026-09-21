"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.layout = layout;
const measure_1 = require("./measure");
const place_1 = require("./place");
const constants_1 = require("./constants");
__exportStar(require("./types"), exports);
__exportStar(require("./constants"), exports);
__exportStar(require("./measure"), exports);
__exportStar(require("./place"), exports);
/**
 * Pure synchronous layout function: SemanticModel -> PositionedScene.
 * Has zero DOM dependencies, deterministic, fully testable in Node.
 */
function layout(model, opts = {}) {
    const collapseOption = opts.collapseErrorHandlers || 'auto';
    const totalFlows = model.flows.length;
    const positionedFlows = [];
    let currentY = constants_1.L.canvasPad;
    let maxFlowW = 0;
    for (const flow of model.flows) {
        // 1. Measure bottom-up
        const measuredFlow = measure_1.MeasureEngine.measureFlow(flow, collapseOption, totalFlows);
        if (measuredFlow.w > maxFlowW) {
            maxFlowW = measuredFlow.w;
        }
        // 2. Place top-down
        const posFlow = place_1.PlaceEngine.placeFlow(measuredFlow, constants_1.L.canvasPad, currentY);
        positionedFlows.push(posFlow);
        currentY += posFlow.height + constants_1.L.flowGapY;
    }
    const totalWidth = maxFlowW + constants_1.L.canvasPad * 2;
    const totalHeight = currentY - constants_1.L.flowGapY + constants_1.L.canvasPad;
    return {
        flows: positionedFlows,
        totalWidth: Math.max(totalWidth, 800),
        totalHeight: Math.max(totalHeight, 600),
    };
}
//# sourceMappingURL=index.js.map