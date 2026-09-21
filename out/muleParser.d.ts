/**
 * muleParser.ts
 *
 * Responsible for:
 *  1. Parsing a raw Mule XML string into a structured intermediate representation (IR).
 *  2. The IR is a TREE — each FlowNode can have children (scopes) or branches
 *     (routers / parallel routes), all inferred dynamically from the XML structure.
 *
 * Layout detection is DYNAMIC:
 *  - Element has <when>/<otherwise> children → "router" (e.g. choice)
 *  - Element has <route> children → "parallel" (e.g. scatter-gather)
 *  - Element has processor children → "scope" (e.g. try, foreach, async)
 *  - Otherwise → "leaf" (e.g. logger, http:request)
 */
/** A single processor step inside a flow (base fields) */
export interface FlowStep {
    label: string;
    nodeId: string;
    tagName: string;
    flowRefTarget?: string;
    shape: "stadium" | "rect" | "diamond" | "subroutine" | "cylinder";
    rawAttrs: Record<string, string>;
    lineNumber?: number;
}
/** A branch inside a router or parallel container */
export interface FlowBranch {
    /** Display label for the branch (e.g. "when: #[payload.type == 'A']" or "Route 1") */
    label: string;
    /** The expression/condition for when elements */
    condition?: string;
    /** Processor children inside this branch */
    children: FlowNode[];
}
/** A node in the flow tree — extends FlowStep with tree structure */
export interface FlowNode extends FlowStep {
    /**
     * How this node should be laid out, inferred dynamically:
     *  - "leaf"     → simple node box
     *  - "scope"    → container with children laid out horizontally inside
     *  - "router"   → has when/otherwise branches stacked vertically
     *  - "parallel" → has route branches rendered as parallel lanes
     */
    layoutHint: "leaf" | "scope" | "router" | "parallel";
    /** Child processor nodes (for scopes) */
    children: FlowNode[];
    /** Branches (for routers and parallel containers) */
    branches?: FlowBranch[];
}
export interface ChildFieldDef {
    key: string;
    label: string;
    type: "cdata" | "text" | "attrs";
    subfields?: {
        name: string;
        type: "string" | "enum";
        options?: string[];
    }[];
    default?: string;
}
/** One complete flow/sub-flow/error-handler block */
export interface ParsedFlow {
    kind: "flow" | "sub-flow" | "error-handler";
    name: string;
    lineNumber: number;
    /** Tree of processor nodes — replaces the old flat steps array */
    rootNodes: FlowNode[];
    /** Alias for rootNodes for backwards compatibility */
    steps?: FlowNode[];
    subgraphId: string;
    errorHandler?: {
        type: string;
        label: string;
        steps: FlowNode[];
    }[];
}
/** Top-level result returned by parseMuleXml */
export interface ParseResult {
    flows: ParsedFlow[];
    warnings: string[];
}
interface TagMeta {
    label: string;
    shape: FlowStep["shape"];
    icon?: string;
    color?: string;
    defaultAttrs?: Record<string, string>;
    requiredAttrs?: string[];
}
/**
 * Maps well-known Mule XML tag names to a friendly label and Mermaid shape.
 * This is used as a HINT for display — structural layout is inferred dynamically.
 */
export declare const TAG_META: Record<string, TagMeta>;
export declare const CHILD_SCHEMA: Record<string, ChildFieldDef[]>;
export declare function parseMuleXml(xmlText: string): ParseResult;
/** Recursively count all FlowNodes in a tree (for display in the sidebar) */
export declare function countAllNodes(nodes: FlowNode[]): number;
export {};
//# sourceMappingURL=muleParser.d.ts.map