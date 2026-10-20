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
        const isGlobalEH = mFlow.flow.type === 'global-error-handler';
        const hasSource = mFlow.flow.type === 'flow' && !!mFlow.sourceMeasured;
        const sourceW = hasSource ? constants_1.L.sourceCompartmentW + constants_1.L.sourceDividerW : 0;
        const bodyY = flowY + constants_1.L.flowHeaderH + constants_1.L.flowPad.top;
        const bodyH = isGlobalEH ? 0 : Math.max(mFlow.processChain.h, mFlow.sourceMeasured ? constants_1.L.tile.h : 0, constants_1.L.laneMinH);
        const processX = flowX + constants_1.L.flowPad.left + sourceW;
        const processBox = {
            x: processX,
            y: bodyY,
            width: isGlobalEH ? 0 : Math.max(mFlow.processChain.w, constants_1.L.emptyPlaceholder.w),
            height: bodyH,
        };
        const processLaneY = bodyY + mFlow.processChain.laneY;
        if (hasSource && mFlow.sourceMeasured) {
            sourceBox = {
                x: flowX + constants_1.L.flowPad.left,
                y: bodyY,
                width: constants_1.L.sourceCompartmentW,
                height: bodyH,
            };
            const srcX = sourceBox.x + (constants_1.L.sourceCompartmentW - mFlow.sourceMeasured.w) / 2;
            const srcY = processLaneY - mFlow.sourceMeasured.laneY;
            positionedSource = this.placeNode(mFlow.sourceMeasured, srcX, srcY, processLaneY);
        }
        // Place process chain or MUnit zones
        let positionedMunitZones;
        let positionedChain = [];
        if (mFlow.munitZones) {
            const zonesGap = 28;
            const mBehav = mFlow.munitZones.behavior;
            const mExec = mFlow.munitZones.execution;
            const mValid = mFlow.munitZones.validation;
            // 1. Behavior zone
            const behavX = processX;
            const behavY = bodyY;
            const behavLaneY = bodyY + mBehav.laneY;
            const behavChildren = mBehav.innerChain
                ? this.placeChain(mBehav.innerChain, behavX + 16, behavLaneY)
                : [];
            const posBehavior = {
                nodeId: mBehav.node.id,
                node: mBehav.node,
                x: behavX,
                y: behavY,
                width: mBehav.w,
                height: mBehav.h,
                laneY: behavLaneY,
                children: behavChildren,
                routes: [],
            };
            // 2. Execution zone
            const execX = behavX + mBehav.w + zonesGap;
            const execY = bodyY;
            const execLaneY = bodyY + mExec.laneY;
            const execChildren = mExec.innerChain
                ? this.placeChain(mExec.innerChain, execX + 16, execLaneY)
                : [];
            const posExecution = {
                nodeId: mExec.node.id,
                node: mExec.node,
                x: execX,
                y: execY,
                width: mExec.w,
                height: mExec.h,
                laneY: execLaneY,
                children: execChildren,
                routes: [],
            };
            // 3. Validation zone
            const validX = execX + mExec.w + zonesGap;
            const validY = bodyY;
            const validLaneY = bodyY + mValid.laneY;
            const validChildren = mValid.innerChain
                ? this.placeChain(mValid.innerChain, validX + 16, validLaneY)
                : [];
            const posValidation = {
                nodeId: mValid.node.id,
                node: mValid.node,
                x: validX,
                y: validY,
                width: mValid.w,
                height: mValid.h,
                laneY: validLaneY,
                children: validChildren,
                routes: [],
            };
            positionedMunitZones = {
                behavior: posBehavior,
                execution: posExecution,
                validation: posValidation,
            };
            positionedChain = [posBehavior, posExecution, posValidation];
        }
        else {
            positionedChain = isGlobalEH ? [] : this.placeChain(mFlow.processChain, processX, processLaneY);
        }
        // Error band
        let errorBandBox = null;
        const positionedErrorHandlers = [];
        if (mFlow.flow.errorHandler.length > 0) {
            const errBandY = isGlobalEH ? (flowY + constants_1.L.flowHeaderH + 8) : (bodyY + bodyH + 16);
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
        else if (mFlow.flow.errorHandlerRef) {
            const errBandY = isGlobalEH ? (flowY + constants_1.L.flowHeaderH + 8) : (bodyY + bodyH + 16);
            const errBandH = mFlow.errorCollapsed ? constants_1.L.errorBandHeaderH : (constants_1.L.errorBandHeaderH + 38);
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
            munitZones: positionedMunitZones,
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
        let errorBandBox = null;
        const positionedErrorHandlers = [];
        if (mNode.batchZones) {
            const jobX = nodeX;
            const jobY = nodeY;
            const zonesY = jobY + constants_1.L.scopePad.top;
            const interZoneGap = 28;
            // 1. Place Input Zone
            const inputX = jobX + constants_1.L.scopePad.left;
            const mInput = mNode.batchZones.input;
            const posInputChain = mInput.innerChain
                ? this.placeChain(mInput.innerChain, inputX + 16, zonesY + mInput.laneY)
                : [];
            const posInput = {
                nodeId: mInput.node.id,
                node: mInput.node,
                x: inputX,
                y: zonesY,
                width: mInput.w,
                height: mInput.h,
                laneY: zonesY + mInput.laneY,
                children: posInputChain,
                routes: [],
            };
            // 2. Place Process Records Zone
            const procX = inputX + mInput.w + interZoneGap;
            const mProc = mNode.batchZones.processRecords;
            const posSteps = [];
            let stepCursorX = procX + 18;
            if (mProc.innerChain && mProc.innerChain.items) {
                for (const mStep of mProc.innerChain.items) {
                    const stepY = zonesY + 30 + 10;
                    const stepLaneY = zonesY + mStep.laneY;
                    const stepChainNodes = mStep.innerChain
                        ? this.placeChain(mStep.innerChain, stepCursorX + 16, stepLaneY)
                        : [];
                    let posAgg = null;
                    if (mStep.aggregator) {
                        const mAgg = mStep.aggregator;
                        const lastStepNode = stepChainNodes.length > 0 ? stepChainNodes[stepChainNodes.length - 1] : null;
                        const aggX = lastStepNode ? (lastStepNode.x + lastStepNode.width + 16) : (stepCursorX + 16);
                        const aggY = stepY + 32;
                        const aggLaneY = aggY + mAgg.laneY;
                        const aggChainNodes = mAgg.innerChain
                            ? this.placeChain(mAgg.innerChain, aggX + 12, aggLaneY)
                            : [];
                        posAgg = {
                            nodeId: mAgg.node.id,
                            node: mAgg.node,
                            x: aggX,
                            y: aggY,
                            width: mAgg.w,
                            height: mAgg.h,
                            laneY: aggLaneY,
                            children: aggChainNodes,
                            routes: [],
                        };
                    }
                    const posStep = {
                        nodeId: mStep.node.id,
                        node: mStep.node,
                        x: stepCursorX,
                        y: stepY,
                        width: mStep.w,
                        height: mStep.h,
                        laneY: stepLaneY,
                        children: stepChainNodes,
                        aggregator: posAgg,
                        routes: [],
                    };
                    posSteps.push(posStep);
                    stepCursorX += mStep.w + 24;
                }
            }
            const posProcRecords = {
                nodeId: mProc.node.id,
                node: mProc.node,
                x: procX,
                y: zonesY,
                width: mProc.w,
                height: mProc.h,
                laneY: zonesY + mProc.laneY,
                children: posSteps,
                routes: [],
            };
            // 3. Place On Complete Zone
            const onCompX = procX + mProc.w + interZoneGap;
            const mOnComp = mNode.batchZones.onComplete;
            const posOnCompChain = mOnComp.innerChain
                ? this.placeChain(mOnComp.innerChain, onCompX + 16, zonesY + mOnComp.laneY)
                : [];
            const posOnComplete = {
                nodeId: mOnComp.node.id,
                node: mOnComp.node,
                x: onCompX,
                y: zonesY,
                width: mOnComp.w,
                height: mOnComp.h,
                laneY: zonesY + mOnComp.laneY,
                children: posOnCompChain,
                routes: [],
            };
            return {
                nodeId: mNode.node.id,
                node: mNode.node,
                x: jobX,
                y: jobY,
                width: mNode.w,
                height: mNode.h,
                laneY: jobY + mNode.laneY,
                children: [posInput, posProcRecords, posOnComplete],
                routes: [],
                batchZones: {
                    input: posInput,
                    processRecords: posProcRecords,
                    onComplete: posOnComplete,
                },
                collapsedBadgeCount: mNode.collapsedBadgeCount,
            };
        }
        // Scope: place inner chain
        if (mNode.innerChain) {
            const innerStartX = nodeX + constants_1.L.scopePad.left;
            const innerLaneY = nodeY + constants_1.L.scopePad.top + mNode.innerChain.laneY;
            const innerNodes = this.placeChain(mNode.innerChain, innerStartX, innerLaneY);
            positionedChildren.push(...innerNodes);
        }
        const isScope = mNode.node.descriptor.kind === 'scope' || mNode.node.descriptor.localName === 'try';
        if (isScope && (mNode.node.routes.length > 0 || mNode.node.errorHandlerRef)) {
            // Scope with error handling (e.g. Try scope)
            const errBandY = nodeY + constants_1.L.scopePad.top + (mNode.innerChain ? mNode.innerChain.h : 0) + 12;
            const errBandW = mNode.w - constants_1.L.scopePad.left - constants_1.L.scopePad.right;
            let errBandH = constants_1.L.errorBandHeaderH;
            if (!mNode.errorCollapsed) {
                if (mNode.innerRoutes && mNode.innerRoutes.length > 0) {
                    let routeCursorY = errBandY + constants_1.L.errorBandHeaderH + 8;
                    const errX = nodeX + constants_1.L.scopePad.left;
                    for (const mRoute of mNode.innerRoutes) {
                        const routeLaneY = routeCursorY + mRoute.laneY;
                        const innerChainNodes = this.placeChain(mRoute.innerChain, errX + constants_1.L.routerPad.left, routeLaneY);
                        const posRoute = {
                            routeId: mRoute.route.id,
                            route: mRoute.route,
                            x: errX,
                            y: routeCursorY,
                            width: mRoute.w,
                            height: mRoute.h,
                            laneY: routeLaneY,
                            children: innerChainNodes,
                        };
                        positionedRoutes.push(posRoute);
                        positionedErrorHandlers.push(posRoute);
                        routeCursorY += mRoute.h + constants_1.L.routeGapY;
                    }
                    errBandH = routeCursorY - errBandY;
                }
                else if (mNode.node.errorHandlerRef) {
                    errBandH = constants_1.L.errorBandHeaderH + 38;
                }
            }
            errorBandBox = {
                x: nodeX + constants_1.L.scopePad.left,
                y: errBandY,
                width: errBandW,
                height: errBandH,
            };
        }
        else if (mNode.innerRoutes && mNode.innerRoutes.length > 0) {
            // Router: place routes vertically
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
            errorBandBox,
            errorHandlers: positionedErrorHandlers,
            errorCollapsed: mNode.errorCollapsed,
        };
    }
}
exports.PlaceEngine = PlaceEngine;
//# sourceMappingURL=place.js.map