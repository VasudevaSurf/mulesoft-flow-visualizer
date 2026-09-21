"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaceEngine = void 0;
const constants_1 = require("./constants");
class PlaceEngine {
    /**
     * Places a measured flow at (flowX, flowY) and produces a PositionedFlow.
     */
    static placeFlow(mFlow, flowX, flowY) {
        if (mFlow.flow.collapsed) {
            return {
                flowId: mFlow.flow.id,
                flowModel: mFlow.flow,
                x: flowX,
                y: flowY,
                width: mFlow.w,
                height: mFlow.h,
                headerBox: {
                    x: flowX,
                    y: flowY,
                    width: mFlow.w,
                    height: mFlow.h,
                },
                sourceBox: null,
                processBox: { x: flowX, y: flowY, width: 0, height: 0 },
                errorBandBox: null,
                source: null,
                chain: [],
                errorHandlers: [],
            };
        }
        const headerBox = {
            x: flowX,
            y: flowY,
            width: mFlow.w,
            height: constants_1.L.flowHeaderH,
        };
        let sourceBox = null;
        let positionedSource = null;
        const isFullFlow = mFlow.flow.type === 'flow';
        const sourceW = isFullFlow ? constants_1.L.sourceCompartmentW + constants_1.L.sourceDividerW : 0;
        const bodyY = flowY + constants_1.L.flowHeaderH + constants_1.L.flowPad.top;
        const bodyH = Math.max(mFlow.processChain.h, mFlow.sourceMeasured ? constants_1.L.tile.h : 0, constants_1.L.laneMinH);
        const processX = flowX + constants_1.L.flowPad.left + sourceW;
        const processBox = {
            x: processX,
            y: bodyY,
            width: Math.max(mFlow.processChain.w, constants_1.L.emptyPlaceholder.w),
            height: bodyH,
        };
        const processLaneY = bodyY + mFlow.processChain.laneY;
        if (isFullFlow) {
            sourceBox = {
                x: flowX + constants_1.L.flowPad.left,
                y: bodyY,
                width: constants_1.L.sourceCompartmentW,
                height: bodyH,
            };
            if (mFlow.sourceMeasured) {
                const srcX = sourceBox.x + (constants_1.L.sourceCompartmentW - mFlow.sourceMeasured.w) / 2;
                const srcY = processLaneY - mFlow.sourceMeasured.laneY;
                positionedSource = this.placeNode(mFlow.sourceMeasured, srcX, srcY, processLaneY);
            }
        }
        // Place process chain
        const positionedChain = this.placeChain(mFlow.processChain, processX, processLaneY);
        // Error band
        let errorBandBox = null;
        const positionedErrorHandlers = [];
        if (mFlow.flow.errorHandler.length > 0) {
            const errBandY = bodyY + bodyH + 16;
            let errBandH = constants_1.L.errorBandHeaderH;
            if (!mFlow.errorCollapsed) {
                let routeCursorY = errBandY + constants_1.L.errorBandHeaderH + 8;
                const errX = flowX + constants_1.L.flowPad.left;
                for (const mRoute of mFlow.errorLanes) {
                    const routeBox = {
                        x: errX,
                        y: routeCursorY,
                        width: mRoute.w,
                        height: mRoute.h,
                    };
                    const routeLaneY = routeBox.y + mRoute.laneY;
                    const routeChildren = this.placeChain(mRoute.innerChain, errX + constants_1.L.routerPad.left, routeLaneY);
                    positionedErrorHandlers.push({
                        routeId: mRoute.route.id,
                        route: mRoute.route,
                        x: routeBox.x,
                        y: routeBox.y,
                        width: routeBox.width,
                        height: routeBox.height,
                        laneY: routeLaneY,
                        children: routeChildren,
                    });
                    routeCursorY += mRoute.h + constants_1.L.routeGapY;
                }
                errBandH = routeCursorY - errBandY;
            }
            errorBandBox = {
                x: flowX + constants_1.L.flowPad.left,
                y: errBandY,
                width: mFlow.w - constants_1.L.flowPad.left - constants_1.L.flowPad.right,
                height: errBandH,
            };
        }
        return {
            flowId: mFlow.flow.id,
            flowModel: mFlow.flow,
            x: flowX,
            y: flowY,
            width: mFlow.w,
            height: mFlow.h,
            headerBox,
            sourceBox,
            processBox,
            errorBandBox,
            source: positionedSource,
            chain: positionedChain,
            errorHandlers: positionedErrorHandlers,
            errorCollapsed: mFlow.errorCollapsed,
        };
    }
    /**
     * Places a chain of nodes horizontally along a shared lane line.
     */
    static placeChain(mChain, startX, laneLineY) {
        const positioned = [];
        let cursorX = startX;
        for (const mNode of mChain.items) {
            const nodeY = laneLineY - mNode.laneY;
            const posNode = this.placeNode(mNode, cursorX, nodeY, laneLineY);
            positioned.push(posNode);
            cursorX += mNode.w + constants_1.L.tileGapX;
        }
        return positioned;
    }
    /**
     * Places an individual node and any nested sub-chains / routes.
     */
    static placeNode(mNode, nodeX, nodeY, parentLaneY) {
        const positionedChildren = [];
        const positionedRoutes = [];
        // Scope: place inner chain
        if (mNode.innerChain) {
            const innerStartX = nodeX + constants_1.L.scopePad.left;
            const innerLaneY = nodeY + constants_1.L.scopePad.top + mNode.innerChain.laneY;
            const innerNodes = this.placeChain(mNode.innerChain, innerStartX, innerLaneY);
            positionedChildren.push(...innerNodes);
        }
        // Router: place routes vertically
        if (mNode.innerRoutes && mNode.innerRoutes.length > 0) {
            let routeCursorY = nodeY + constants_1.L.routerPad.top;
            const routeX = nodeX + constants_1.L.routerPad.left;
            for (const mRoute of mNode.innerRoutes) {
                const routeLaneY = routeCursorY + mRoute.laneY;
                const innerChainNodes = this.placeChain(mRoute.innerChain, routeX, routeLaneY);
                positionedRoutes.push({
                    routeId: mRoute.route.id,
                    route: mRoute.route,
                    x: routeX,
                    y: routeCursorY,
                    width: mRoute.w,
                    height: mRoute.h,
                    laneY: routeLaneY,
                    children: innerChainNodes,
                });
                routeCursorY += mRoute.h + constants_1.L.routeGapY;
            }
        }
        return {
            nodeId: mNode.node.id,
            node: mNode.node,
            x: nodeX,
            y: nodeY,
            width: mNode.w,
            height: mNode.h,
            laneY: nodeY + mNode.laneY,
            children: positionedChildren,
            routes: positionedRoutes,
            collapsedBadgeCount: mNode.collapsedBadgeCount,
        };
    }
}
exports.PlaceEngine = PlaceEngine;
//# sourceMappingURL=place.js.map