import { Box, PositionedNode, PositionedRoute, PositionedFlow } from './types';
import { MeasuredNode, MeasuredRoute, MeasuredChain, MeasuredFlow } from './measure';
import { L } from './constants';

export class PlaceEngine {
  /**
   * Places a measured flow at (flowX, flowY) and produces a PositionedFlow.
   */
  public static placeFlow(mFlow: MeasuredFlow, flowX: number, flowY: number): PositionedFlow {
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

    const headerBox: Box = {
      x: flowX,
      y: flowY,
      width: mFlow.w,
      height: L.flowHeaderH,
    };

    let sourceBox: Box | null = null;
    let positionedSource: PositionedNode | null = null;

    const isFullFlow = mFlow.flow.type === 'flow';
    const sourceW = isFullFlow ? L.sourceCompartmentW + L.sourceDividerW : 0;
    const bodyY = flowY + L.flowHeaderH + L.flowPad.top;
    const bodyH = Math.max(mFlow.processChain.h, mFlow.sourceMeasured ? L.tile.h : 0, L.laneMinH);

    const processX = flowX + L.flowPad.left + sourceW;
    const processBox: Box = {
      x: processX,
      y: bodyY,
      width: Math.max(mFlow.processChain.w, L.emptyPlaceholder.w),
      height: bodyH,
    };

    const processLaneY = bodyY + mFlow.processChain.laneY;

    if (isFullFlow) {
      sourceBox = {
        x: flowX + L.flowPad.left,
        y: bodyY,
        width: L.sourceCompartmentW,
        height: bodyH,
      };

      if (mFlow.sourceMeasured) {
        const srcX = sourceBox.x + (L.sourceCompartmentW - mFlow.sourceMeasured.w) / 2;
        const srcY = processLaneY - mFlow.sourceMeasured.laneY;
        positionedSource = this.placeNode(mFlow.sourceMeasured, srcX, srcY, processLaneY);
      }
    }

    // Place process chain
    const positionedChain = this.placeChain(mFlow.processChain, processX, processLaneY);

    // Error band
    let errorBandBox: Box | null = null;
    const positionedErrorHandlers: PositionedRoute[] = [];

    if (mFlow.flow.errorHandler.length > 0) {
      const errBandY = bodyY + bodyH + 16;
      let errBandH = L.errorBandHeaderH;

      if (!mFlow.errorCollapsed) {
        let routeCursorY = errBandY + L.errorBandHeaderH + 8;
        const errX = flowX + L.flowPad.left;

        for (const mRoute of mFlow.errorLanes) {
          const routeBox: Box = {
            x: errX,
            y: routeCursorY,
            width: mRoute.w,
            height: mRoute.h,
          };
          const routeLaneY = routeBox.y + mRoute.laneY;
          const routeChildren = this.placeChain(mRoute.innerChain, errX + L.routerPad.left, routeLaneY);

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

          routeCursorY += mRoute.h + L.routeGapY;
        }

        errBandH = routeCursorY - errBandY;
      }

      errorBandBox = {
        x: flowX + L.flowPad.left,
        y: errBandY,
        width: mFlow.w - L.flowPad.left - L.flowPad.right,
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
  public static placeChain(
    mChain: MeasuredChain,
    startX: number,
    laneLineY: number
  ): PositionedNode[] {
    const positioned: PositionedNode[] = [];
    let cursorX = startX;

    for (const mNode of mChain.items) {
      const nodeY = laneLineY - mNode.laneY;
      const posNode = this.placeNode(mNode, cursorX, nodeY, laneLineY);
      positioned.push(posNode);
      cursorX += mNode.w + L.tileGapX;
    }

    return positioned;
  }

  /**
   * Places an individual node and any nested sub-chains / routes.
   */
  public static placeNode(
    mNode: MeasuredNode,
    nodeX: number,
    nodeY: number,
    parentLaneY: number
  ): PositionedNode {
    const positionedChildren: PositionedNode[] = [];
    const positionedRoutes: PositionedRoute[] = [];

    // Scope: place inner chain
    if (mNode.innerChain) {
      const innerStartX = nodeX + L.scopePad.left;
      const innerLaneY = nodeY + L.scopePad.top + mNode.innerChain.laneY;
      const innerNodes = this.placeChain(mNode.innerChain, innerStartX, innerLaneY);
      positionedChildren.push(...innerNodes);
    }

    // Router: place routes vertically
    if (mNode.innerRoutes && mNode.innerRoutes.length > 0) {
      let routeCursorY = nodeY + L.routerPad.top;
      const routeX = nodeX + L.routerPad.left;

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

        routeCursorY += mRoute.h + L.routeGapY;
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
