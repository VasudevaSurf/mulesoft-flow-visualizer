import { PositionedNode, PositionedFlow } from './types';
import { MeasuredNode, MeasuredChain, MeasuredFlow } from './measure';
export declare class PlaceEngine {
    /**
     * Places a measured flow at (flowX, flowY) and produces a PositionedFlow.
     */
    static placeFlow(mFlow: MeasuredFlow, flowX: number, flowY: number): PositionedFlow;
    /**
     * Places a chain of nodes horizontally along a shared lane line.
     */
    static placeChain(mChain: MeasuredChain, startX: number, laneLineY: number): PositionedNode[];
    /**
     * Places an individual node and any nested sub-chains / routes.
     */
    static placeNode(mNode: MeasuredNode, nodeX: number, nodeY: number, parentLaneY: number): PositionedNode;
}
//# sourceMappingURL=place.d.ts.map