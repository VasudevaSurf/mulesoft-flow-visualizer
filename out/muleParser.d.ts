/**
 * muleParser.ts
 *
 * Responsible for:
 *  1. Parsing a raw Mule XML string into a structured intermediate representation (IR).
 *  2. Converting that IR into a Mermaid.js flowchart string.
 *
 * The IR is designed to be serialisation-friendly so it can be passed directly
 * to the Webview via postMessage without any circular references.
 */
/** A single processor step inside a flow */
export interface FlowStep {
    /** Human-readable label shown in the diagram node */
    label: string;
    /** Unique node ID used in Mermaid syntax (no spaces, no special chars) */
    nodeId: string;
    /** The raw XML tag name, e.g. "http:listener", "ee:transform" */
    tagName: string;
    /** Optional target when the step is a <flow-ref> */
    flowRefTarget?: string;
    /** Shape hint for Mermaid rendering */
    shape: "stadium" | "rect" | "diamond" | "subroutine" | "cylinder";
    /**
     * Raw XML attributes from the element (stripped of fast-xml-parser @ prefix).
     * Keys are attribute names (e.g. "config-ref", "doc:name", "path").
     * Values are always strings.
     */
    rawAttrs: Record<string, string>;
    /** 1-based line number of the tag inside the XML document */
    lineNumber?: number;
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
    /** "flow" | "sub-flow" | "error-handler" */
    kind: "flow" | "sub-flow" | "error-handler";
    name: string;
    /** 1-based line number of the opening tag in the source XML */
    lineNumber: number;
    steps: FlowStep[];
    /** Unique Mermaid subgraph ID */
    subgraphId: string;
    /**
     * Inline error-handler block nested inside this flow (if any).
     * Each entry represents one error-handling strategy
     * (on-error-propagate / on-error-continue) with its own child steps.
     */
    errorHandler?: {
        type: string;
        label: string;
        steps: FlowStep[];
    }[];
}
/** Top-level result returned by parseMuleXml */
export interface ParseResult {
    flows: ParsedFlow[];
    /** Non-fatal warnings to surface in the UI */
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
 * Maps well-known Mule XML tag names (namespace:localName) to a friendly
 * display label and a Mermaid node shape.
 *
 * "stadium"    → rounded pill  ([text])
 * "rect"       → rectangle     [text]
 * "diamond"    → decision      {text}
 * "subroutine" → subprocess    [[text]]
 * "cylinder"   → DB / store    [(text)]
 */
export declare const TAG_META: Record<string, TagMeta>;
export declare const CHILD_SCHEMA: Record<string, ChildFieldDef[]>;
/**
 * Parse a Mule XML string into a ParseResult.
 *
 * @param xmlText - Raw content of the .xml file
 */
export declare function parseMuleXml(xmlText: string): ParseResult;
/**
 * Convert a list of ParsedFlow objects into a complete Mermaid diagram string.
 *
 * @param flows   - The flows to render
 * @param theme   - Mermaid theme name
 */
export declare function generateMermaidDiagram(flows: ParsedFlow[], theme?: string): string;
export {};
//# sourceMappingURL=muleParser.d.ts.map