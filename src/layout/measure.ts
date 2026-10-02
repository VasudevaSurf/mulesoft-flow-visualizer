import { Node, Route, FlowModel } from '../parser/types';
import { L } from './constants';

export interface MeasuredBox {
  w: number;
  h: number;
  laneY: number;
}

export interface MeasuredNode extends MeasuredBox {
  node: Node;
  innerChain?: MeasuredChain;
  innerRoutes?: MeasuredRoute[];
  collapsedBadgeCount?: number;
  errorCollapsed?: boolean;
}

export interface MeasuredRoute extends MeasuredBox {
  route: Route;
  innerChain: MeasuredChain;
}

export interface MeasuredChain extends MeasuredBox {
  items: MeasuredNode[];
}

export interface MeasuredFlow extends MeasuredBox {
  flow: FlowModel;
  sourceMeasured: MeasuredNode | null;
  processChain: MeasuredChain;
  errorLanes: MeasuredRoute[];
  errorCollapsed: boolean;
}

export class MeasureEngine {
  /**
   * Measures a single Node bottom-up.
   */
  public static measureNode(node: Node, depth = 0): MeasuredNode {
    if (depth > 50) {
      // Guard against deep nesting
      return {
        node,
        w: L.tile.w,
        h: L.tile.h,
        laneY: L.tile.h / 2,
      };
    }

    if (node.collapsed) {
      const count = this.countDescendantProcessors(node);
      return {
        node,
        w: L.tile.w,
        h: L.tile.h,
        laneY: L.tile.h / 2,
        collapsedBadgeCount: count,
      };
    }

    const kind = node.descriptor.kind;
    const isScope = kind === 'scope' || node.descriptor.localName === 'try';

    // Scope: nested chain with optional error-handler
    if (isScope) {
      const inner = this.measureChain(node.chain, depth + 1);
      const measuredRoutes: MeasuredRoute[] = [];
      let maxErrLaneW = 0;
      let totalErrH = 0;
      const isErrCollapsed = node.errorBandCollapsed ?? false;

      if (node.routes.length > 0 && !isErrCollapsed) {
        for (let i = 0; i < node.routes.length; i++) {
          const r = node.routes[i];
          const rInner = this.measureChain(r.chain, depth + 1);
          const routeH = rInner.h + L.routeLabelH;
          const routeLabelW = Math.ceil((r.label ? r.label.length * 7.4 : 0) + 24);
          const routeW = Math.max(rInner.w, routeLabelW);

          if (routeW > maxErrLaneW) {
            maxErrLaneW = routeW;
          }
          totalErrH += routeH;
          if (i < node.routes.length - 1) {
            totalErrH += L.routeGapY;
          }

          measuredRoutes.push({
            route: r,
            w: routeW,
            h: routeH,
            laneY: L.routeLabelH + rInner.laneY,
            innerChain: rInner,
          });
        }
      }

      let errBandH = 0;
      if (node.routes.length > 0 || node.errorHandlerRef) {
        if (isErrCollapsed) {
          errBandH = L.errorBandHeaderH;
        } else if (node.routes.length > 0) {
          errBandH = L.errorBandHeaderH + totalErrH + 12;
        } else if (node.errorHandlerRef) {
          errBandH = L.errorBandHeaderH + 38;
        }
      }

      const headerTitleW = Math.ceil((node.label ? node.label.length * 7.5 : 0) + 75);
      const innerW = Math.max(inner.w, isErrCollapsed ? 200 : maxErrLaneW, (!isErrCollapsed && node.errorHandlerRef) ? 260 : 0);
      const scopeW = Math.max(innerW + L.scopePad.left + L.scopePad.right, headerTitleW + L.scopePad.right + 24);

      const finalLaneW = scopeW - L.scopePad.left - L.scopePad.right;
      for (const mr of measuredRoutes) {
        mr.w = finalLaneW;
      }

      const totalH = inner.h + L.scopePad.top + (errBandH > 0 ? (12 + errBandH) : 0) + L.scopePad.bottom;

      return {
        node,
        w: scopeW,
        h: totalH,
        laneY: L.scopePad.top + inner.laneY,
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
        const innerH = emptyChain.h + L.routeLabelH;
        return {
          node,
          w: innerW + L.routerPad.left + L.routerPad.right,
          h: innerH + L.routerPad.top + L.routerPad.bottom,
          laneY: L.routerPad.top + L.routeLabelH + emptyChain.laneY,
          innerRoutes: [],
        };
      }

      const measuredRoutes: MeasuredRoute[] = [];
      let maxLaneW = 0;
      let totalLanesH = 0;
      let runningY = 0;
      let firstBranchLaneOffset = 0;
      let lastBranchLaneOffset = 0;

      for (let i = 0; i < node.routes.length; i++) {
        const r = node.routes[i];
        const inner = this.measureChain(r.chain, depth + 1);
        const routeH = inner.h + L.routeLabelH;

        // Ensure lane width accommodates both the processors chain AND the route label text
        const routeLabelW = Math.ceil((r.label ? r.label.length * 7.4 : 0) + 24);
        const routeW = Math.max(inner.w, routeLabelW);

        if (routeW > maxLaneW) {
          maxLaneW = routeW;
        }

        const branchInternalLaneY = L.routeLabelH + inner.laneY;
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
          totalLanesH += L.routeGapY;
          runningY += L.routeGapY;
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
      const totalRouterW = Math.max(maxLaneW + L.routerPad.left + L.routerPad.right, headerTitleW + L.routerPad.right + 24);
      const finalLaneW = totalRouterW - L.routerPad.left - L.routerPad.right;

      // All routes share the final widest route width
      for (const mr of measuredRoutes) {
        mr.w = finalLaneW;
      }

      // Midpoint between the first branch's absolute lane position and the last branch's absolute lane position
      const midpointBranchLaneOffset = (firstBranchLaneOffset + lastBranchLaneOffset) / 2;

      return {
        node,
        w: totalRouterW,
        h: totalLanesH + L.routerPad.top + L.routerPad.bottom,
        laneY: L.routerPad.top + midpointBranchLaneOffset,
        innerRoutes: measuredRoutes,
      };
    }

    // Leaf: operation, source, unknown
    return {
      node,
      w: L.tile.w,
      h: L.tile.h,
      laneY: L.tile.h / 2,
    };
  }

  /**
   * Measures a sequential chain of nodes.
   * All siblings align vertically on max(sibling.laneY).
   */
  public static measureChain(chain: Node[], depth = 0): MeasuredChain {
    if (chain.length === 0) {
      return {
        w: L.emptyPlaceholder.w,
        h: L.laneMinH,
        laneY: L.laneMinH / 2,
        items: [],
      };
    }

    const items: MeasuredNode[] = chain.map((node) => this.measureNode(node, depth));
    let totalW = 0;
    let maxH: number = L.laneMinH;
    let maxLaneY: number = L.laneMinH / 2;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      totalW += item.w;
      if (i < items.length - 1) {
        totalW += L.tileGapX;
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
  public static measureFlow(
    flow: FlowModel,
    collapseErrorHandlersOption: 'never' | 'always' | 'auto' = 'auto',
    totalFlowsInFile = 1
  ): MeasuredFlow {
    if (flow.collapsed) {
      return {
        flow,
        w: 500,
        h: L.flowHeaderH + 12,
        laneY: (L.flowHeaderH + 12) / 2,
        sourceMeasured: null,
        processChain: { w: 0, h: 0, laneY: 0, items: [] },
        errorLanes: [],
        errorCollapsed: true,
      };
    }

    const processInner = this.measureChain(flow.chain, 0);

    let sourceMeasured: MeasuredNode | null = null;
    let sourceW = 0;
    if (flow.type === 'flow' && flow.source) {
      sourceW = L.sourceCompartmentW + L.sourceDividerW;
      sourceMeasured = this.measureNode(flow.source, 0);
    }

    const isGlobalEH = flow.type === 'global-error-handler';
    const sourceH = flow.source ? L.tile.h : 0;
    const bodyH = isGlobalEH ? 0 : Math.max(processInner.h, sourceH, L.laneMinH);

    let errH = 0;
    const errorLanes: MeasuredRoute[] = [];
    let errorCollapsed = false;

    if (flow.errorHandler.length > 0 || flow.errorHandlerRef) {
      if (flow.errorBandCollapsed !== undefined) {
        errorCollapsed = flow.errorBandCollapsed;
      } else if (collapseErrorHandlersOption === 'always') {
        errorCollapsed = true;
      } else if (collapseErrorHandlersOption === 'auto' && totalFlowsInFile > 8) {
        errorCollapsed = true;
      }

      if (errorCollapsed) {
        errH = L.errorBandHeaderH;
      } else if (flow.errorHandler.length > 0) {
        let maxErrLaneW = 0;
        let totalErrH = 0;

        for (let i = 0; i < flow.errorHandler.length; i++) {
          const r = flow.errorHandler[i];
          const inner = this.measureChain(r.chain, 0);
          const routeH = inner.h + L.routeLabelH;
          const routeLabelW = Math.ceil((r.label ? r.label.length * 7.4 : 0) + 24);
          const routeW = Math.max(inner.w, routeLabelW);

          if (routeW > maxErrLaneW) {
            maxErrLaneW = routeW;
          }
          totalErrH += routeH;
          if (i < flow.errorHandler.length - 1) {
            totalErrH += L.routeGapY;
          }

          errorLanes.push({
            route: r,
            w: routeW,
            h: routeH,
            laneY: L.routeLabelH + inner.laneY,
            innerChain: inner,
          });
        }

        const effectiveErrLaneW = isGlobalEH ? Math.max(maxErrLaneW, 300) : Math.max(maxErrLaneW, processInner.w);
        for (const el of errorLanes) {
          el.w = effectiveErrLaneW;
        }

        errH = L.errorBandHeaderH + totalErrH + L.flowPad.bottom;
      } else if (flow.errorHandlerRef) {
        errH = L.errorBandHeaderH + 38;
      }
    }

    const maxLane = errorLanes.length > 0 ? Math.max(...errorLanes.map(el => el.w)) : 300;
    const flowTitleW = Math.ceil((flow.name ? flow.name.length * 8 : 0) + 200);
    const contentW = isGlobalEH
      ? L.flowPad.left + maxLane + L.flowPad.right
      : L.flowPad.left + sourceW + Math.max(processInner.w, L.emptyPlaceholder.w) + L.flowPad.right;
    const totalW = Math.max(contentW, flowTitleW + L.flowPad.right + 24);
    const totalH = L.flowHeaderH + (isGlobalEH ? 8 : (L.flowPad.top + bodyH)) + errH + L.flowPad.bottom;

    return {
      flow,
      w: totalW,
      h: totalH,
      laneY: isGlobalEH ? (L.flowHeaderH + 8) : (L.flowHeaderH + L.flowPad.top + processInner.laneY),
      sourceMeasured,
      processChain: processInner,
      errorLanes,
      errorCollapsed,
    };
  }

  private static countDescendantProcessors(node: Node): number {
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
