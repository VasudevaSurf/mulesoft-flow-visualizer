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
        const kind = node.descriptor.kind;
        // Scope: exactly one nested chain
        if (kind === 'scope' || (node.chain.length > 0 && node.routes.length === 0)) {
            const inner = this.measureChain(node.chain, depth + 1);
            const headerTitleW = Math.ceil((node.label ? node.label.length * 7.5 : 0) + 75);
            const scopeW = Math.max(inner.w + constants_1.L.scopePad.left + constants_1.L.scopePad.right, headerTitleW + constants_1.L.scopePad.right + 24);
            return {
                node,
                w: scopeW,
                h: inner.h + constants_1.L.scopePad.top + constants_1.L.scopePad.bottom,
                laneY: constants_1.L.scopePad.top + inner.laneY,
                innerChain: inner,
            };
        }
        // Router or Error Handler
        if (kind === 'router' || kind === 'error-handler' || node.routes.length > 0) {
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
                totalLanesH += routeH;
                if (i < node.routes.length - 1) {
                    totalLanesH += constants_1.L.routeGapY;
                }
                measuredRoutes.push({
                    route: r,
                    w: routeW,
                    h: routeH,
                    laneY: constants_1.L.routeLabelH + inner.laneY,
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
            const firstRouteLaneY = measuredRoutes[0].laneY;
            return {
                node,
                w: totalRouterW,
                h: totalLanesH + constants_1.L.routerPad.top + constants_1.L.routerPad.bottom,
                laneY: constants_1.L.routerPad.top + firstRouteLaneY,
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
        const processInner = this.measureChain(flow.chain, 0);
        let sourceMeasured = null;
        let sourceW = 0;
        if (flow.type === 'flow') {
            sourceW = constants_1.L.sourceCompartmentW + constants_1.L.sourceDividerW;
            if (flow.source) {
                sourceMeasured = this.measureNode(flow.source, 0);
            }
        }
        const sourceH = flow.source ? constants_1.L.tile.h : 0;
        const bodyH = Math.max(processInner.h, sourceH, constants_1.L.laneMinH);
        let errH = 0;
        const errorLanes = [];
        let errorCollapsed = false;
        if (flow.errorHandler.length > 0) {
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
            else {
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
                const effectiveErrLaneW = Math.max(maxErrLaneW, processInner.w);
                for (const el of errorLanes) {
                    el.w = effectiveErrLaneW;
                }
                errH = constants_1.L.errorBandHeaderH + totalErrH + constants_1.L.flowPad.bottom;
            }
        }
        const flowTitleW = Math.ceil((flow.name ? flow.name.length * 8 : 0) + 200);
        const contentW = constants_1.L.flowPad.left + sourceW + Math.max(processInner.w, constants_1.L.emptyPlaceholder.w) + constants_1.L.flowPad.right;
        const totalW = Math.max(contentW, flowTitleW + constants_1.L.flowPad.right + 24);
        const totalH = constants_1.L.flowHeaderH + constants_1.L.flowPad.top + bodyH + errH + constants_1.L.flowPad.bottom;
        return {
            flow,
            w: totalW,
            h: totalH,
            laneY: constants_1.L.flowHeaderH + constants_1.L.flowPad.top + processInner.laneY,
            sourceMeasured,
            processChain: processInner,
            errorLanes,
            errorCollapsed,
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