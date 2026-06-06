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

import { XMLParser } from "fast-xml-parser";

// ─── Intermediate Representation Types ────────────────────────────────────────

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
}

/** Top-level result returned by parseMuleXml */
export interface ParseResult {
  flows: ParsedFlow[];
  /** Non-fatal warnings to surface in the UI */
  warnings: string[];
}

// ─── Tag → Label / Shape mapping ──────────────────────────────────────────────

interface TagMeta {
  label: string;
  shape: FlowStep["shape"];
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
const TAG_META: Record<string, TagMeta> = {
  // HTTP / HTTPS
  "http:listener": { label: "HTTP Listener", shape: "stadium" },
  "http:request": { label: "HTTP Request", shape: "rect" },
  "https:listener": { label: "HTTPS Listener", shape: "stadium" },
  "https:request": { label: "HTTPS Request", shape: "rect" },

  // Core
  "flow-ref": { label: "Flow Reference", shape: "subroutine" },
  logger: { label: "Logger", shape: "rect" },
  "set-payload": { label: "Set Payload", shape: "rect" },
  "set-variable": { label: "Set Variable", shape: "rect" },
  "set-property": { label: "Set Property", shape: "rect" },
  choice: { label: "Choice Router", shape: "diamond" },
  "first-successful": { label: "First Successful", shape: "diamond" },
  "round-robin": { label: "Round Robin", shape: "diamond" },
  scatter_gather: { label: "Scatter-Gather", shape: "diamond" },
  "scatter-gather": { label: "Scatter-Gather", shape: "diamond" },
  foreach: { label: "For Each", shape: "diamond" },
  "until-successful": { label: "Until Successful", shape: "diamond" },
  "async": { label: "Async Scope", shape: "rect" },
  "try": { label: "Try Scope", shape: "rect" },
  "raise-error": { label: "Raise Error", shape: "rect" },

  // DataWeave / Transform
  "ee:transform": { label: "Transform Message", shape: "rect" },
  "dw:transform-message": { label: "Transform Message", shape: "rect" },

  // Database
  "db:select": { label: "DB Select", shape: "cylinder" },
  "db:insert": { label: "DB Insert", shape: "cylinder" },
  "db:update": { label: "DB Update", shape: "cylinder" },
  "db:delete": { label: "DB Delete", shape: "cylinder" },
  "db:stored-procedure": { label: "DB Stored Procedure", shape: "cylinder" },
  "db:bulk-insert": { label: "DB Bulk Insert", shape: "cylinder" },
  "db:bulk-update": { label: "DB Bulk Update", shape: "cylinder" },

  // Messaging
  "jms:publish": { label: "JMS Publish", shape: "rect" },
  "jms:consume": { label: "JMS Consume", shape: "stadium" },
  "jms:publish-consume": { label: "JMS Publish-Consume", shape: "rect" },
  "amqp:publish": { label: "AMQP Publish", shape: "rect" },
  "amqp:consume": { label: "AMQP Consume", shape: "stadium" },
  "vm:publish": { label: "VM Publish", shape: "rect" },
  "vm:consume": { label: "VM Consume", shape: "stadium" },

  // File / FTP / SFTP
  "file:read": { label: "File Read", shape: "cylinder" },
  "file:write": { label: "File Write", shape: "cylinder" },
  "ftp:read": { label: "FTP Read", shape: "cylinder" },
  "ftp:write": { label: "FTP Write", shape: "cylinder" },
  "sftp:read": { label: "SFTP Read", shape: "cylinder" },
  "sftp:write": { label: "SFTP Write", shape: "cylinder" },

  // Salesforce
  "salesforce:query": { label: "Salesforce Query", shape: "cylinder" },
  "salesforce:create": { label: "Salesforce Create", shape: "rect" },
  "salesforce:update": { label: "Salesforce Update", shape: "rect" },
  "salesforce:upsert": { label: "Salesforce Upsert", shape: "rect" },
  "salesforce:delete": { label: "Salesforce Delete", shape: "rect" },

  // Validation / Error
  "validation:is-true": { label: "Validate: Is True", shape: "diamond" },
  "validation:is-not-null": { label: "Validate: Not Null", shape: "diamond" },
  "on-error-propagate": { label: "On Error Propagate", shape: "rect" },
  "on-error-continue": { label: "On Error Continue", shape: "rect" },

  // Scheduler / Triggers
  scheduler: { label: "Scheduler", shape: "stadium" },

  // APIkit
  "apikit:router": { label: "APIkit Router", shape: "rect" },

  // Crypto / Security
  "crypto:encrypt": { label: "Encrypt", shape: "rect" },
  "crypto:decrypt": { label: "Decrypt", shape: "rect" },

  // Cache
  "ee:cache": { label: "Cache Scope", shape: "rect" },

  // OAuth
  "oauth2:validate-token": { label: "Validate OAuth Token", shape: "diamond" },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Sanitise a string so it can be used as a Mermaid node identifier */
function toNodeId(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^([0-9])/, "_$1"); // must not start with digit
}

/** 
 * Sanitise a label for safe embedding inside Mermaid node brackets.
 * Mermaid is very sensitive to parentheses, brackets, quotes, and angle
 * brackets inside labels — we strip or replace every problematic character.
 */
function escapeMermaidLabel(text: string): string {
  return text
    // Remove parentheses entirely — these break stadium/cylinder syntax
    .replace(/[()]/g, "")
    // Remove square brackets — conflict with rect node syntax
    .replace(/[\[\]]/g, "")
    // Remove curly braces — conflict with diamond syntax
    .replace(/[{}]/g, "")
    // Replace angle brackets
    .replace(/</g, "lt ")
    .replace(/>/g, " gt")
    // Replace double quotes with single quotes
    .replace(/"/g, "'")
    // Replace backticks
    .replace(/`/g, "'")
    // Collapse multiple spaces
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Produce a Mermaid node declaration based on the step's shape.
 *  All shapes use plain rect brackets ["label"] to maximise compatibility.
 *  Mermaid v10 is stricter about special chars inside shape delimiters,
 *  so we keep it simple and rely only on the label text for visual meaning.
 */
function mermaidNode(step: FlowStep): string {
  const lbl = escapeMermaidLabel(step.label);
  // Use only rect syntax — safest across all Mermaid v10 builds
  return `${step.nodeId}["${lbl}"]`;
}

/** Determine if a tag is a known "container" / config-only element we should skip */
const SKIP_TAGS = new Set([
  "mule",
  "flow",
  "sub-flow",
  "error-handler",
  "ee:variables",
  "ee:set-variable",
  "ee:set-payload",
  "ee:message",
  "when",
  "otherwise",
  "configuration",
  "http:listener-config",
  "http:request-config",
  "db:config",
  "jms:config",
  "file:config",
  "ftp:config",
  "sftp:config",
  "salesforce:sfdc-config",
  "ee:transform",    // handled separately — don't double-count children
  "doc:documentation",
]);

/** Derive a FlowStep from an XML tag name + attributes object */
function tagToStep(
  tagName: string,
  attrs: Record<string, unknown>,
  flowId: string,
  index: number
): FlowStep {
  const meta = TAG_META[tagName];

  // Build a human-readable label.
  // sanitiseAttr strips characters that break Mermaid node syntax
  // (parentheses, brackets, quotes) from raw XML attribute values.
  const sanitiseAttr = (val: unknown): string =>
    String(val)
      .replace(/[()[\]{}"'`]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

  let label: string;
  if (tagName === "flow-ref") {
    const target = sanitiseAttr(attrs["@_name"] || "unknown");
    label = `Flow Ref to ${target}`;
  } else if (meta) {
    label = meta.label;
    // Prefer doc:name for context, then plain name — never config-ref (too noisy)
    const docName = attrs["@_doc:name"] as string | undefined;
    const attrName = attrs["@_name"] as string | undefined;
    if (docName) {
      label += ` - ${sanitiseAttr(docName)}`;
    } else if (attrName) {
      label += ` - ${sanitiseAttr(attrName)}`;
    }
  } else {
    // Unknown tag — generic label from the local tag name
    const localName = tagName.includes(":") ? tagName.split(":")[1] : tagName;
    label = localName
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const docName = attrs["@_doc:name"] as string | undefined;
    const attrName = attrs["@_name"] as string | undefined;
    if (docName) {
      label += ` - ${sanitiseAttr(docName)}`;
    } else if (attrName) {
      label += ` - ${sanitiseAttr(attrName)}`;
    }
  }

  const nodeId = toNodeId(`${flowId}_step_${index}_${tagName}`);

  return {
    label,
    nodeId,
    tagName,
    flowRefTarget:
      tagName === "flow-ref"
        ? (attrs["@_name"] as string | undefined)
        : undefined,
    shape: meta?.shape ?? "rect",
  };
}

// ─── Line-number tracking ──────────────────────────────────────────────────────

/**
 * Scan the raw XML text and return a map of { tagName+name → 1-based line }.
 * We do this with a simple regex pass because fast-xml-parser (v4) does not
 * expose line numbers in its parsed output.
 */
function buildLineMap(xml: string): Map<string, number> {
  const map = new Map<string, number>();
  const lines = xml.split("\n");

  // Match opening tags for flow and sub-flow, capturing the name attribute
  const flowPattern =
    /<(flow|sub-flow)\b[^>]*name\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let lineIndex = 0;
  let charOffset = 0;

  // Walk the raw string character by character to track lines
  // Re-stringify line positions from regex .index
  const fullText = xml;

  let match: RegExpExecArray | null;
  // Reset lastIndex before each use
  flowPattern.lastIndex = 0;

  while ((match = flowPattern.exec(fullText)) !== null) {
    const charPos = match.index;
    // Count newlines up to charPos
    const upTo = fullText.substring(0, charPos);
    const line = upTo.split("\n").length; // 1-based
    const key = `${match[1]}::${match[2]}`;
    map.set(key, line);
  }

  return map;
}

// ─── Core recursive step extractor ────────────────────────────────────────────

/**
 * Walk the parsed JSON node and collect direct-child processor steps.
 * We intentionally stay shallow (depth 1) to keep the diagram readable;
 * nested containers (choice, foreach, etc.) appear as a single diamond node.
 */
function extractSteps(
  node: Record<string, unknown>,
  flowId: string,
  counter: { value: number }
): FlowStep[] {
  const steps: FlowStep[] = [];

  for (const [key, value] of Object.entries(node)) {
    // Skip attribute keys and metadata
    if (key.startsWith("@_") || key === "#text" || key === ":@") {
      continue;
    }
    if (SKIP_TAGS.has(key)) {
      continue;
    }

    // value may be a single object or an array (fast-xml-parser isArray option)
    const items = Array.isArray(value) ? value : [value];

    for (const item of items) {
      if (item === null || item === undefined) {
        continue;
      }

      const attrs: Record<string, unknown> =
        typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};

      const step = tagToStep(key, attrs, flowId, counter.value++);
      steps.push(step);
    }
  }

  return steps;
}

// ─── Main parser ───────────────────────────────────────────────────────────────

/**
 * Parse a Mule XML string into a ParseResult.
 *
 * @param xmlText - Raw content of the .xml file
 */
export function parseMuleXml(xmlText: string): ParseResult {
  const warnings: string[] = [];
  const flows: ParsedFlow[] = [];

  // ── 1. Parse XML to JSON ──────────────────────────────────────────────────
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (tagName) => {
      // Always treat these as arrays so we never lose duplicates
      const alwaysArray = [
        "flow",
        "sub-flow",
        "error-handler",
        "flow-ref",
        "logger",
        "set-payload",
        "set-variable",
        "ee:transform",
        "db:select",
        "db:insert",
        "db:update",
        "db:delete",
        "http:request",
        "choice",
        "foreach",
        "scatter-gather",
        "try",
        "async",
        "on-error-propagate",
        "on-error-continue",
      ];
      return alwaysArray.includes(tagName);
    },
    parseAttributeValue: false,
    trimValues: true,
    parseTagValue: false,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xmlText) as Record<string, unknown>;
  } catch (err) {
    warnings.push(`XML parse error: ${(err as Error).message}`);
    return { flows, warnings };
  }

  // ── 2. Find the <mule> root ───────────────────────────────────────────────
  const muleRoot = parsed["mule"] as Record<string, unknown> | undefined;
  if (!muleRoot) {
    warnings.push(
      "No <mule> root element found. Is this a valid Mule XML file?"
    );
    return { flows, warnings };
  }

  // ── 3. Build line-number map ──────────────────────────────────────────────
  const lineMap = buildLineMap(xmlText);

  // ── 4. Collect flows & sub-flows ──────────────────────────────────────────
  const flowElements = (muleRoot["flow"] as unknown[]) || [];
  const subFlowElements = (muleRoot["sub-flow"] as unknown[]) || [];
  const errorHandlerElements = (muleRoot["error-handler"] as unknown[]) || [];

  const processFlowLike = (
    elements: unknown[],
    kind: ParsedFlow["kind"]
  ): void => {
    for (const el of elements) {
      if (!el || typeof el !== "object") {
        continue;
      }
      const elem = el as Record<string, unknown>;
      const name =
        (elem["@_name"] as string) ||
        (elem["@_doc:name"] as string) ||
        `Unnamed ${kind}`;

      const lineKey = `${kind}::${name}`;
      const lineNumber = lineMap.get(lineKey) ?? 1;

      const subgraphId = toNodeId(`${kind}_${name}`);
      const counter = { value: 0 };
      const steps = extractSteps(elem, subgraphId, counter);

      flows.push({ kind, name, lineNumber, steps, subgraphId });
    }
  };

  processFlowLike(flowElements, "flow");
  processFlowLike(subFlowElements, "sub-flow");

  // Error handlers (only if the setting is respected by the caller)
  processFlowLike(errorHandlerElements, "error-handler");

  if (flows.length === 0) {
    warnings.push("No flows or sub-flows found in this Mule XML file.");
  }

  return { flows, warnings };
}

// ─── Mermaid diagram generator ────────────────────────────────────────────────

/**
 * Convert a list of ParsedFlow objects into a complete Mermaid diagram string.
 *
 * @param flows   - The flows to render
 * @param theme   - Mermaid theme name
 */
export function generateMermaidDiagram(
  flows: ParsedFlow[],
  theme: string = "default"
): string {
  if (flows.length === 0) {
    return "graph TD\n  EMPTY[No flows found]";
  }

  const lines: string[] = [];

  // Global graph declaration
  lines.push("graph TD");
  lines.push("  %% Auto-generated by MuleSoft Multi-Flow Visualizer");
  lines.push("");

  for (const flow of flows) {
    const kindLabel =
      flow.kind === "flow"
        ? "Flow"
        : flow.kind === "sub-flow"
        ? "Sub-Flow"
        : "Error Handler";

    const subgraphLabel = `${kindLabel}: ${flow.name}`;

    // Open subgraph
    lines.push(`  subgraph ${flow.subgraphId}["${escapeMermaidLabel(subgraphLabel)}"]`);
    lines.push(`    direction LR`);

    if (flow.steps.length === 0) {
      // Empty flow placeholder
      const emptyId = `${flow.subgraphId}_empty`;
      lines.push(`    ${emptyId}[Empty flow]`);
    } else {
      // Declare each node
      for (const step of flow.steps) {
        lines.push(`    ${mermaidNode(step)}`);
      }

      // Chain nodes with arrows
      if (flow.steps.length > 1) {
        const chain = flow.steps.map((s) => s.nodeId).join(" --> ");
        lines.push(`    ${chain}`);
      }
    }

    // Close subgraph
    lines.push("  end");
    lines.push("");
  }

  // ── Cross-flow edges for flow-ref links ──────────────────────────────────
  lines.push("  %% Cross-flow references");
  for (const flow of flows) {
    for (const step of flow.steps) {
      if (step.flowRefTarget) {
        const targetFlow = flows.find(
          (f) => f.name === step.flowRefTarget
        );
        if (targetFlow && targetFlow.steps.length > 0) {
          const targetFirstNode = targetFlow.steps[0].nodeId;
          lines.push(
            `  ${step.nodeId} -.->|calls| ${targetFirstNode}`
          );
        }
      }
    }
  }

  return lines.join("\n");
}