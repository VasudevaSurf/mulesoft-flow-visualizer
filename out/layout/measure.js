"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeasureEngine = void 0;
const constants_1 = require("./constants");
class MeasureEngine {
    /**
     * Measures a single Node bottom-up.
     */
    static measureNode(node, depth = 0) {
        if (depth > 50) {
            // Guard against deep nesting
            return {
                node,
                w: constants_1.L.tile.w,
                h: constants_1.L.tile.h,
                laneY: constants_1.L.tile.h / 2,
            };
        }
        if (node.collapsed) {
            const count = this.countDescendantProcessors(node);
            return {
                node,
                w: constants_1.L.tile.w,
                h: constants_1.L.tile.h,
                laneY: constants_1.L.tile.h / 2,
                collapsedBadgeCount: count,
            };
        }
        if (node.batchZones) {
            // 1. Measure Input Zone
            const inputChain = this.measureChain(node.batchZones.input.chain, depth + 1);
            const inputHeaderW = Math.ceil((node.batchZones.input.label.length * 7.5) + 60);
            const inputW = Math.max(inputChain.w + 32, inputHeaderW, 140);
            const inputH = inputChain.h + 30 + 16;
            const measuredInput = {
                node: node.batchZones.input,
                w: inputW,
                h: inputH,
                laneY: 30 + inputChain.laneY,
                innerChain: inputChain,
            };
            // 2. Measure Steps in Process Records Zone
            const stepNodes = node.batchZones.processRecords.chain;
            const measuredSteps = [];
            let totalStepsW = 0;
            let maxStepH = 0;
            for (let sIdx = 0; sIdx < stepNodes.length; sIdx++) {
                const step = stepNodes[sIdx];
                const stepChain = this.measureChain(step.chain, depth + 1);
                let aggMeasured = null;
                if (step.aggregator) {
                    const aggChain = this.measureChain(step.aggregator.chain, depth + 1);
                    const aggHeaderW = Math.ceil((step.aggregator.label.length * 7.5) + 60);
                    const aggW = Math.max(aggChain.w + 24, aggHeaderW, 140);
                    const aggH = aggChain.h + 28 + 14;
                    aggMeasured = {
                        node: step.aggregator,
                        w: aggW,
                        h: aggH,
                        laneY: 28 + aggChain.laneY,
                        innerChain: aggChain,
                    };
                }
                const stepHeaderW = Math.ceil((step.label.length * 7.5) + (step.subtitle ? step.subtitle.length * 6.5 : 0) + 70);
                const stepInnerContentW = stepChain.w + (aggMeasured ? (aggMeasured.w + 20) : 0);
                const stepW = Math.max(stepInnerContentW + 32, stepHeaderW, 160);
                const stepInnerContentH = Math.max(stepChain.h, aggMeasured ? aggMeasured.h : 0);
                const stepH = stepInnerContentH + 32 + 16;
                if (stepH > maxStepH)
                    maxStepH = stepH;
                measuredSteps.push({
                    node: step,
                    w: stepW,
                    h: stepH,
                    laneY: 32 + stepChain.laneY,
                    innerChain: stepChain,
                    aggregator: aggMeasured,
                });
                totalStepsW += stepW;
                if (sIdx < stepNodes.length - 1)
                    totalStepsW += 24;
            }
            const procRecsHeaderW = Math.ceil((node.batchZones.processRecords.label.length * 7.5) + 60);
            const procRecsW = Math.max(totalStepsW + 36, procRecsHeaderW, 220);
            const procRecsH = maxStepH + 30 + 20;
            const measuredProcRecords = {
                node: node.batchZones.processRecords,
                w: procRecsW,
                h: procRecsH,
                laneY: 30 + (maxStepH > 0 ? (32 + constants_1.L.tile.h / 2) : constants_1.L.laneMinH / 2),
                innerChain: {
                    w: totalStepsW,
                    h: maxStepH,
                    laneY: 32 + constants_1.L.tile.h / 2,
                    items: measuredSteps,
                },
            };
            // 3. Measure On-Complete Zone
            const onCompChain = this.measureChain(node.batchZones.onComplete.chain, depth + 1);
            const onCompHeaderW = Math.ceil((node.batchZones.onComplete.label.length * 7.5) + 60);
            const onCompW = Math.max(onCompChain.w + 32, onCompHeaderW, 140);
            const onCompH = onCompChain.h + 30 + 16;
            const measuredOnComplete = {
                node: node.batchZones.onComplete,
                w: onCompW,
                h: onCompH,
                laneY: 30 + onCompChain.laneY,
                innerChain: onCompChain,
            };
            // Harmonize height across the 3 zones
            const commonZonesH = Math.max(measuredInput.h, measuredProcRecords.h, measuredOnComplete.h, constants_1.L.laneMinH + 46);
            measuredInput.h = commonZonesH;
            measuredProcRecords.h = commonZonesH;
            measuredOnComplete.h = commonZonesH;
            for (const mStep of measuredSteps) {
                mStep.h = Math.max(mStep.h, commonZonesH - 30 - 20);
            }
            const jobHeaderW = Math.ceil((node.label.length * 7.5) + 120);
            const interZoneGap = 28;
            const totalZonesW = measuredInput.w + interZoneGap + measuredProcRecords.w + interZoneGap + measuredOnComplete.w;
            const jobW = Math.max(totalZonesW + constants_1.L.scopePad.left + constants_1.L.scopePad.right, jobHeaderW + 40);
            const jobH = commonZonesH + constants_1.L.scopePad.top + constants_1.L.scopePad.bottom;
            return {
                node,
                w: jobW,
                h: jobH,
                laneY: constants_1.L.scopePad.top + commonZonesH / 2,
                batchZones: {
                    input: measuredInput,
                    processRecords: measuredProcRecords,
                    onComplete: measuredOnComplete,
                },
            };
        }
        const kind = node.descriptor.kind;
        const isScope = kind === 'scope' || node.descriptor.localName === 'try';
        // Scope: nested chain with optional error-handler
        if (isScope) {
            const inner = this.measureChain(node.chain, depth + 1);
            const measuredRoutes = [];
            let maxErrLaneW = 0;
            let totalErrH = 0;
            const isErrCollapsed = node.errorBandCollapsed ?? false;
            if (node.routes.length > 0 && !isErrCollapsed) {
                for (let i = 0; i < node.routes.length; i++) {
                    const r = node.routes[i];
                    const rInner = this.measureChain(r.chain, depth + 1);
                    const routeH = rInner.h + constants_1.L.routeLabelH;
                    const routeLabelW = Math.ceil((r.label ? r.label.length * 7.4 : 0) + 24);
                    const routeW = Math.max(rInner.w, routeLabelW);
                    if (routeW > maxErrLaneW) {
                        maxErrLaneW = routeW;
                    }
                    totalErrH += routeH;
                    if (i < node.routes.length - 1) {
                        totalErrH += constants_1.L.routeGapY;
                    }
                    measuredRoutes.push({
                        route: r,
                        w: routeW,
                        h: routeH,
                        laneY: constants_1.L.routeLabelH + rInner.laneY,
                        innerChain: rInner,
                    });
                }
            }
            let errBandH = 0;
            if (node.routes.length > 0 || node.errorHandlerRef) {
                if (isErrCollapsed) {
                    errBandH = constants_1.L.errorBandHeaderH;
                }
                else if (node.routes.length > 0) {
                    errBandH = constants_1.L.errorBandHeaderH + totalErrH + 12;
                }
                else if (node.errorHandlerRef) {
                    errBandH = constants_1.L.errorBandHeaderH + 38;
                }
            }
            const headerTitleW = Math.ceil((node.label ? node.label.length * 7.5 : 0) + 75);
            const innerW = Math.max(inner.w, isErrCollapsed ? 200 : maxErrLaneW, (!isErrCollapsed && node.errorHandlerRef) ? 260 : 0);
            const scopeW = Math.max(innerW + constants_1.L.scopePad.left + constants_1.L.scopePad.right, headerTitleW + constants_1.L.scopePad.right + 24);
            const finalLaneW = scopeW - constants_1.L.scopePad.left - constants_1.L.scopePad.right;
            for (const mr of measuredRoutes) {
                mr.w = finalLaneW;
            }
            const totalH = inner.h + constants_1.L.scopePad.top + (errBandH > 0 ? (12 + errBandH) : 0) + constants_1.L.scopePad.bottom;
            return {
                node,
                w: scopeW,
                h: totalH,
                laneY: constants_1.L.scopePad.top + inner.laneY,
                innerChain: inner,
                innerRoutes: measuredRoutes.length > 0 ? measuredRoutes : undefined,
                errorCollapsed: isErrCollapsed,
            };
        }
        // Router, Error Handler, or any node with multiple branches stacked vertically
        if (node.routes.length > 0 || kind === 'router' || kind === 'error-handler') {
            if (node.routes.length === 0) {
                // Degenerate router with 0 routes: render container with one empty lane
                const emptyChain = this.measureChain([], depth + 1);
                const headerTitleW = Math.ceil((node.label ? node.label.length * 7.5 : 0) + 75);
                const innerW = Math.max(emptyChain.w, headerTitleW);
                const innerH = emptyChain.h + constants_1.L.routeLabelH;
                return {
                    node,
                    w: innerW + constants_1.L.routerPad.left + constants_1.L.routerPad.right,
                    h: innerH + constants_1.L.routerPad.top + constants_1.L.routerPad.bottom,
                    laneY: constants_1.L.routerPad.top + constants_1.L.routeLabelH + emptyChain.laneY,
                    innerRoutes: [],
                };
            }
            const measuredRoutes = [];
            let maxLaneW = 0;
            let totalLanesH = 0;
            let runningY = 0;
            let firstBranchLaneOffset = 0;
            let lastBranchLaneOffset = 0;
            for (let i = 0; i < node.routes.length; i++) {
                const r = node.routes[i];
                const inner = this.measureChain(r.chain, depth + 1);
                const routeH = inner.h + constants_1.L.routeLabelH;
                // Ensure lane width accommodates both the processors chain AND the route label text
                const routeLabelW = Math.ceil((r.label ? r.label.length * 7.4 : 0) + 24);
                const routeW = Math.max(inner.w, routeLabelW);
                if (routeW > maxLaneW) {
                    maxLaneW = routeW;
                }
                const branchInternalLaneY = constants_1.L.routeLabelH + inner.laneY;
                const branchAbsoluteLaneOffset = runningY + branchInternalLaneY;
                if (i === 0) {
                    firstBranchLaneOffset = branchAbsoluteLaneOffset;
                }
                if (i === node.routes.length - 1) {
                    lastBranchLaneOffset = branchAbsoluteLaneOffset;
                }
                totalLanesH += routeH;
                runningY += routeH;
                if (i < node.routes.length - 1) {
                    totalLanesH += constants_1.L.routeGapY;
                    runningY += constants_1.L.routeGapY;
                }
                measuredRoutes.push({
                    route: r,
                    w: routeW,
                    h: routeH,
                    laneY: branchInternalLaneY,
                    innerChain: inner,
                });
            }
            // Ensure router container is also wide enough for its own header title
            const headerTitleW = Math.ceil((node.label ? node.label.length * 7.5 : 0) + 75);
            const totalRouterW = Math.max(maxLaneW + constants_1.L.routerPad.left + constants_1.L.routerPad.right, headerTitleW + constants_1.L.routerPad.right + 24);
            const finalLaneW = totalRouterW - constants_1.L.routerPad.left - constants_1.L.routerPad.right;
            // All routes share the final widest route width
            for (const mr of measuredRoutes) {
                mr.w = finalLaneW;
            }
            // Midpoint between the first branch's absolute lane position and the last branch's absolute lane position
            const midpointBranchLaneOffset = (firstBranchLaneOffset + lastBranchLaneOffset) / 2;
            return {
                node,
                w: totalRouterW,
                h: totalLanesH + constants_1.L.routerPad.top + constants_1.L.routerPad.bottom,
                laneY: constants_1.L.routerPad.top + midpointBranchLaneOffset,
                innerRoutes: measuredRoutes,
            };
        }
        // Leaf: operation, source, unknown
        return {
            node,
            w: constants_1.L.tile.w,
            h: constants_1.L.tile.h,
            laneY: constants_1.L.tile.h / 2,
        };
    }
    /**
     * Measures a sequential chain of nodes.
     * All siblings align vertically on max(sibling.laneY).
     */
    static measureChain(chain, depth = 0) {
        if (chain.length === 0) {
            return {
                w: constants_1.L.emptyPlaceholder.w,
                h: constants_1.L.laneMinH,
                laneY: constants_1.L.laneMinH / 2,
                items: [],
            };
        }
        const items = chain.map((node) => this.measureNode(node, depth));
        let totalW = 0;
        let maxH = constants_1.L.laneMinH;
        let maxLaneY = constants_1.L.laneMinH / 2;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            totalW += item.w;
            if (i < items.length - 1) {
                totalW += constants_1.L.tileGapX;
            }
            if (item.h > maxH) {
                maxH = item.h;
            }
            if (item.laneY > maxLaneY) {
                maxLaneY = item.laneY;
            }
        }
        // Ensure container height accommodates the deepest lane alignment
        const maxBelowLane = Math.max(...items.map((it) => it.h - it.laneY));
        const alignedH = Math.max(maxH, maxLaneY + maxBelowLane);
        return {
            w: totalW,
            h: alignedH,
            laneY: maxLaneY,
            items,
        };
    }
    /**
     * Measures a full Flow container.
     */
    static measureFlow(flow, collapseErrorHandlersOption = 'auto', totalFlowsInFile = 1) {
        if (flow.collapsed) {
            return {
                flow,
                w: 500,
                h: constants_1.L.flowHeaderH + 12,
                laneY: (constants_1.L.flowHeaderH + 12) / 2,
                sourceMeasured: null,
                processChain: { w: 0, h: 0, laneY: 0, items: [] },
                errorLanes: [],
                errorCollapsed: true,
            };
        }
        let munitZonesMeasured;
        let processInner;
        if (flow.munitZones) {
            const measureZone = (zoneNode) => {
                const innerChain = this.measureChain(zoneNode.chain, 0);
                const headerW = Math.ceil((zoneNode.label.length * 8) + 60);
                const w = Math.max(innerChain.w + 32, headerW, 160);
                const h = innerChain.h + 30 + 16;
                return {
                    node: zoneNode,
                    w,
                    h,
                    laneY: 30 + innerChain.laneY,
                    innerChain,
                };
            };
            const mBehavior = measureZone(flow.munitZones.behavior);
            const mExecution = measureZone(flow.munitZones.execution);
            const mValidation = measureZone(flow.munitZones.validation);
            // Harmonize heights & lane lines
            const maxZoneH = Math.max(mBehavior.h, mExecution.h, mValidation.h, constants_1.L.laneMinH);
            const maxZoneLaneY = Math.max(mBehavior.laneY, mExecution.laneY, mValidation.laneY);
            mBehavior.h = maxZoneH;
            mExecution.h = maxZoneH;
            mValidation.h = maxZoneH;
            mBehavior.laneY = maxZoneLaneY;
            mExecution.laneY = maxZoneLaneY;
            mValidation.laneY = maxZoneLaneY;
            munitZonesMeasured = {
                behavior: mBehavior,
                execution: mExecution,
                validation: mValidation,
            };
            const zonesGap = 28;
            const totalZonesW = mBehavior.w + zonesGap + mExecution.w + zonesGap + mValidation.w;
            processInner = {
                w: totalZonesW,
                h: maxZoneH,
                laneY: maxZoneLaneY,
                items: [mBehavior, mExecution, mValidation],
            };
        }
        else {
            processInner = this.measureChain(flow.chain, 0);
        }
        let sourceMeasured = null;
        let sourceW = 0;
        if (flow.type === 'flow' && flow.source) {
            sourceW = constants_1.L.sourceCompartmentW + constants_1.L.sourceDividerW;
            sourceMeasured = this.measureNode(flow.source, 0);
        }
        const isGlobalEH = flow.type === 'global-error-handler';
        const sourceH = flow.source ? constants_1.L.tile.h : 0;
        const bodyH = isGlobalEH ? 0 : Math.max(processInner.h, sourceH, constants_1.L.laneMinH);
        let errH = 0;
        const errorLanes = [];
        let errorCollapsed = false;
        if (flow.errorHandler.length > 0 || flow.errorHandlerRef) {
            if (flow.errorBandCollapsed !== undefined) {
                errorCollapsed = flow.errorBandCollapsed;
            }
            else if (collapseErrorHandlersOption === 'always') {
                errorCollapsed = true;
            }
            else if (collapseErrorHandlersOption === 'auto' && totalFlowsInFile > 8) {
                errorCollapsed = true;
            }
            if (errorCollapsed) {
                errH = constants_1.L.errorBandHeaderH;
            }
            else if (flow.errorHandler.length > 0) {
                let maxErrLaneW = 0;
                let totalErrH = 0;
                for (let i = 0; i < flow.errorHandler.length; i++) {
                    const r = flow.errorHandler[i];
                    const inner = this.measureChain(r.chain, 0);
                    const routeH = inner.h + constants_1.L.routeLabelH;
                    const routeLabelW = Math.ceil((r.label ? r.label.length * 7.4 : 0) + 24);
                    const routeW = Math.max(inner.w, routeLabelW);
                    if (routeW > maxErrLaneW) {
                        maxErrLaneW = routeW;
                    }
                    totalErrH += routeH;
                    if (i < flow.errorHandler.length - 1) {
                        totalErrH += constants_1.L.routeGapY;
                    }
                    errorLanes.push({
                        route: r,
                        w: routeW,
                        h: routeH,
                        laneY: constants_1.L.routeLabelH + inner.laneY,
                        innerChain: inner,
                    });
                }
                const effectiveErrLaneW = isGlobalEH ? Math.max(maxErrLaneW, 300) : Math.max(maxErrLaneW, processInner.w);
                for (const el of errorLanes) {
                    el.w = effectiveErrLaneW;
                }
                errH = constants_1.L.errorBandHeaderH + totalErrH + constants_1.L.flowPad.bottom;
            }
            else if (flow.errorHandlerRef) {
                errH = constants_1.L.errorBandHeaderH + 38;
            }
        }
        const maxLane = errorLanes.length > 0 ? Math.max(...errorLanes.map(el => el.w)) : 300;
        const flowTitleW = Math.ceil((flow.name ? flow.name.length * 8 : 0) + 200);
        const contentW = isGlobalEH
            ? constants_1.L.flowPad.left + maxLane + constants_1.L.flowPad.right
            : constants_1.L.flowPad.left + sourceW + Math.max(processInner.w, constants_1.L.emptyPlaceholder.w) + constants_1.L.flowPad.right;
        const totalW = Math.max(contentW, flowTitleW + constants_1.L.flowPad.right + 24);
        const totalH = constants_1.L.flowHeaderH + (isGlobalEH ? 8 : (constants_1.L.flowPad.top + bodyH)) + errH + constants_1.L.flowPad.bottom;
        return {
            flow,
            w: totalW,
            h: totalH,
            laneY: isGlobalEH ? (constants_1.L.flowHeaderH + 8) : (constants_1.L.flowHeaderH + constants_1.L.flowPad.top + processInner.laneY),
            sourceMeasured,
            processChain: processInner,
            errorLanes,
            errorCollapsed,
            munitZones: munitZonesMeasured,
        };
    }
    static countDescendantProcessors(node) {
        let count = 1;
        for (const c of node.chain) {
            count += this.countDescendantProcessors(c);
        }
        for (const r of node.routes) {
            for (const c of r.chain) {
                count += this.countDescendantProcessors(c);
            }
        }
        return count;
    }
}
exports.MeasureEngine = MeasureEngine;
//# sourceMappingURL=measure.js.map