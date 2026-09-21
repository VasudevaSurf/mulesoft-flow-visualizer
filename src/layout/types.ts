/**
 * src/layout/types.ts
 *
 * Positioned scene and layout geometry types per Section 3 of the specification.
 */

import { Node, Route, FlowModel } from "../parser/types";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedNode extends Box {
  nodeId: string;
  node: Node;
  /** y of the horizontal lane line passing through this node. */
  laneY: number;
  children: PositionedNode[];
  routes: PositionedRoute[];
  collapsedBadgeCount?: number;
}

export interface PositionedRoute extends Box {
  routeId: string;
  route: Route;
  laneY: number;
  children: PositionedNode[];
}

export interface PositionedFlow extends Box {
  flowId: string;
  flowModel: FlowModel;
  headerBox: Box;
  sourceBox: Box | null;
  processBox: Box;
  errorBandBox: Box | null;
  source: PositionedNode | null;
  chain: PositionedNode[];
  errorHandlers: PositionedRoute[];
  errorCollapsed?: boolean;
}

export interface PositionedScene {
  flows: PositionedFlow[];
  totalWidth: number;
  totalHeight: number;
}

export interface LayoutOptions {
  showSubtitles?: boolean;
  collapseErrorHandlers?: "never" | "always" | "auto";
}
