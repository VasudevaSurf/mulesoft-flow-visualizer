"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHILD_SCHEMA = exports.TAG_META = void 0;
exports.parseMuleXml = parseMuleXml;
exports.generateMermaidDiagram = generateMermaidDiagram;
const fast_xml_parser_1 = require("fast-xml-parser");
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
exports.TAG_META = {
    // HTTP / HTTPS
    "http:listener": { label: "HTTP Listener", shape: "stadium", defaultAttrs: { path: "", allowedMethods: "", "config-ref": "" }, requiredAttrs: ["path", "config-ref"] },
    "http:request": { label: "HTTP Request", shape: "rect", defaultAttrs: { method: "GET", path: "", "config-ref": "" }, requiredAttrs: ["path", "config-ref"] },
    "https:listener": { label: "HTTPS Listener", shape: "stadium", defaultAttrs: { path: "", "config-ref": "" }, requiredAttrs: ["path", "config-ref"] },
    "https:request": { label: "HTTPS Request", shape: "rect", defaultAttrs: { method: "GET", path: "", "config-ref": "" }, requiredAttrs: ["path", "config-ref"] },
    // Core
    "flow-ref": { label: "Flow Reference", shape: "subroutine", defaultAttrs: { name: "" }, requiredAttrs: ["name"] },
    logger: { label: "Logger", shape: "rect", defaultAttrs: { level: "INFO", message: "#[]" } },
    "set-payload": { label: "Set Payload", shape: "rect", defaultAttrs: { value: "#[]", mimeType: "" } },
    "set-variable": { label: "Set Variable", shape: "rect", defaultAttrs: { value: "#[]", variableName: "" }, requiredAttrs: ["value", "variableName"] },
    "set-property": { label: "Set Property", shape: "rect", defaultAttrs: { value: "#[]", propertyName: "" }, requiredAttrs: ["value", "propertyName"] },
    choice: { label: "Choice Router", shape: "diamond", defaultAttrs: { "doc:name": "" } },
    "first-successful": { label: "First Successful", shape: "diamond", defaultAttrs: { "doc:name": "" } },
    "round-robin": { label: "Round Robin", shape: "diamond", defaultAttrs: { "doc:name": "" } },
    scatter_gather: { label: "Scatter-Gather", shape: "diamond", defaultAttrs: { "doc:name": "" } },
    "scatter-gather": { label: "Scatter-Gather", shape: "diamond", defaultAttrs: { "doc:name": "" } },
    foreach: { label: "For Each", shape: "diamond", defaultAttrs: { collection: "#[]", batchSize: "1" } },
    "until-successful": { label: "Until Successful", shape: "diamond", defaultAttrs: { maxRetries: "5", millisBetweenRetries: "1000" } },
    async: { label: "Async Scope", shape: "rect", defaultAttrs: { "doc:name": "" } },
    try: { label: "Try Scope", shape: "rect", defaultAttrs: { "doc:name": "" } },
    "raise-error": { label: "Raise Error", shape: "rect", defaultAttrs: { type: "", description: "" }, requiredAttrs: ["type"] },
    // DataWeave / Transform
    "ee:transform": { label: "Transform Message", shape: "rect", defaultAttrs: { "doc:name": "" } },
    "dw:transform-message": { label: "Transform Message", shape: "rect", defaultAttrs: { "doc:name": "" } },
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
    "on-error-propagate": { label: "On Error Propagate", shape: "rect", defaultAttrs: { type: "", logException: "true" } },
    "on-error-continue": { label: "On Error Continue", shape: "rect", defaultAttrs: { type: "", logException: "true" } },
    // Scheduler / Triggers
    scheduler: { label: "Scheduler", shape: "stadium", defaultAttrs: { "doc:name": "" } },
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
exports.CHILD_SCHEMA = {
    "ee:transform": [
        { key: "ee:message>ee:set-payload", label: "Set Payload", type: "cdata", default: "%dw 2.0\\noutput application/json\\n---\\npayload" },
        { key: "ee:variables>ee:set-variable", label: "Set Variables", type: "cdata", default: "" }
    ],
    "dw:transform-message": [
        { key: "ee:message>ee:set-payload", label: "Set Payload", type: "cdata", default: "%dw 2.0\\noutput application/json\\n---\\npayload" },
        { key: "ee:variables>ee:set-variable", label: "Set Variables", type: "cdata", default: "" }
    ],
    "db:select": [
        { key: "db:sql", label: "SQL Query", type: "cdata", default: "" },
        { key: "db:input-parameters", label: "Input Parameters", type: "cdata", default: "" }
    ],
    "scheduler": [
        {
            key: "scheduling-strategy>fixed-frequency",
            label: "Fixed Frequency Strategy",
            type: "attrs",
            subfields: [
                { name: "frequency", type: "string" },
                { name: "timeUnit", type: "enum", options: ["MILLISECONDS", "SECONDS", "MINUTES", "HOURS", "DAYS"] }
            ],
            default: ""
        }
    ]
};
// ─── Helpers ───────────────────────────────────────────────────────────────────
/** Sanitise a string so it can be used as a Mermaid node identifier */
function toNodeId(raw) {
    return raw
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .replace(/^([0-9])/, "_$1"); // must not start with digit
}
/**
 * Sanitise a label for safe embedding inside Mermaid node brackets.
 * Mermaid is very sensitive to parentheses, brackets, quotes, and angle
 * brackets inside labels — we strip or replace every problematic character.
 */
function escapeMermaidLabel(text) {
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
function mermaidNode(step) {
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
    "route",
    "doc:documentation",
]);
const RECURSIVE_TAGS = new Set([
    "choice",
    "foreach",
    "scatter-gather",
    "try",
    "async",
    "first-successful",
    "round-robin",
    "until-successful",
    "when",
    "otherwise",
    "route",
]);
/**
 * Recursively walk the parsed XML object and flatten nested child elements
 * into dot-notation keys in the rawAttrs map.
 * e.g. <http:response statusCode="#[...]"><http:headers>expr</http:headers></http:response>
 * becomes: { "http:response.statusCode": "#[...]", "http:response > http:headers": "expr" }
 */
function flattenChildren(obj, prefix, out, depth = 0) {
    if (depth > 6)
        return; // prevent infinite recursion on deeply nested XML
    for (const [key, value] of Object.entries(obj)) {
        // Skip attribute keys (already handled), text nodes, and metadata
        if (key.startsWith("@_") || key === "#text" || key === ":@")
            continue;
        // Skip known container/config tags that aren't properties
        if (key === "error-handler" || key === "on-error-propagate" || key === "on-error-continue")
            continue;
        const items = Array.isArray(value) ? value : [value];
        for (const item of items) {
            if (item === null || item === undefined)
                continue;
            const childPath = prefix ? `${prefix}>${key}` : key;
            if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
                // Leaf text content
                const text = String(item).trim();
                if (text.length > 0) {
                    out[childPath] = text;
                }
            }
            else if (typeof item === "object") {
                const child = item;
                // Extract child's own attributes
                for (const [ck, cv] of Object.entries(child)) {
                    if (ck.startsWith("@_")) {
                        const attrKey = `${childPath}.${ck.slice(2)}`;
                        if (typeof cv === "string" || typeof cv === "number" || typeof cv === "boolean") {
                            out[attrKey] = String(cv);
                        }
                    }
                    else if (ck === "#text" && (typeof cv === "string" || typeof cv === "number")) {
                        // Text content of the child element
                        const text = String(cv).trim();
                        if (text.length > 0 && text.length < 50000) {
                            out[childPath] = text;
                        }
                    }
                }
                // Recurse into child's children
                flattenChildren(child, childPath, out, depth + 1);
            }
        }
    }
}
/** Derive a FlowStep from an XML tag name + attributes object */
function tagToStep(tagName, attrs, flowId, index) {
    const meta = exports.TAG_META[tagName];
    // Build a human-readable label.
    // sanitiseAttr strips characters that break Mermaid node syntax
    // (parentheses, brackets, quotes) from raw XML attribute values.
    const sanitiseAttr = (val) => String(val)
        .replace(/[()[\]{}"'`]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    let label;
    if (tagName === "flow-ref") {
        const target = sanitiseAttr(attrs["@_name"] || "unknown");
        label = `Flow Ref to ${target}`;
    }
    else if (meta) {
        label = meta.label;
        // Prefer doc:name for context, then plain name — never config-ref (too noisy)
        const docName = attrs["@_doc:name"];
        const attrName = attrs["@_name"];
        if (docName) {
            label += ` - ${sanitiseAttr(docName)}`;
        }
        else if (attrName) {
            label += ` - ${sanitiseAttr(attrName)}`;
        }
    }
    else {
        // Unknown tag — generic label from the local tag name
        const localName = tagName.includes(":") ? tagName.split(":")[1] : tagName;
        label = localName
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
        const docName = attrs["@_doc:name"];
        const attrName = attrs["@_name"];
        if (docName) {
            label += ` - ${sanitiseAttr(docName)}`;
        }
        else if (attrName) {
            label += ` - ${sanitiseAttr(attrName)}`;
        }
    }
    const nodeId = toNodeId(`${flowId}_step_${index}_${tagName}`);
    // Build clean rawAttrs: strip fast-xml-parser "@_" prefix, keep string values only
    const rawAttrs = {};
    for (const [k, v] of Object.entries(attrs)) {
        if (k.startsWith('@_')) {
            const cleanKey = k.slice(2); // remove "@_" prefix
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                rawAttrs[cleanKey] = String(v);
            }
        }
    }
    // Also extract nested child element properties (MuleSoft config lives here)
    // e.g. <http:response statusCode="..."><http:headers>expr</http:headers></http:response>
    flattenChildren(attrs, '', rawAttrs);
    if (tagName === "ee:transform" || tagName === "dw:transform-message") {
        console.log('[MuleViz] flattenChildren ee:transform keys:', Object.keys(rawAttrs));
    }
    return {
        label,
        nodeId,
        tagName,
        flowRefTarget: tagName === "flow-ref"
            ? attrs["@_name"]
            : undefined,
        shape: meta?.shape ?? "rect",
        rawAttrs,
    };
}
function buildTagOccurrenceList(xml) {
    const occurrences = [];
    const lines = xml.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        const regex = /<([a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+)\b([^>]*)/g;
        let match;
        while ((match = regex.exec(lineText)) !== null) {
            const tagName = match[1];
            const attrsText = match[2];
            if (tagName.startsWith('!') || tagName.startsWith('?'))
                continue;
            const docNameMatch = attrsText.match(/doc:name\s*=\s*["']([^"']+)["']/);
            const nameMatch = attrsText.match(/\bname\s*=\s*["']([^"']+)["']/);
            occurrences.push({
                tagName,
                lineNumber: i + 1,
                docName: docNameMatch ? docNameMatch[1] : undefined,
                name: nameMatch ? nameMatch[1] : undefined,
            });
        }
    }
    return occurrences;
}
// ─── Line-number tracking ──────────────────────────────────────────────────────
/**
 * Scan the raw XML text and return a map of { tagName+name → 1-based line }.
 * We do this with a simple regex pass because fast-xml-parser (v4) does not
 * expose line numbers in its parsed output.
 */
function buildLineMap(xml) {
    const map = new Map();
    // Match opening tags for flow and sub-flow, capturing the name attribute
    const flowPattern = /<(flow|sub-flow)\b[^>]*name\s*=\s*["']([^"']+)["'][^>]*>/gi;
    const fullText = xml;
    flowPattern.lastIndex = 0;
    let match;
    while ((match = flowPattern.exec(fullText)) !== null) {
        const charPos = match.index;
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
function extractSteps(node, flowId, counter, occurrences, flowStartLine, lastMatchIndex) {
    const steps = [];
    function walk(n) {
        if (!n || typeof n !== "object")
            return;
        for (const [key, value] of Object.entries(n)) {
            if (key.startsWith("@_") || key === "#text" || key === ":@") {
                continue;
            }
            // If it's a global config, skip it entirely (do not add, do not recurse)
            if (key.endsWith("-config") || key.endsWith("config") || key === "configuration") {
                continue;
            }
            // If it's a structural container we want to ignore (like error-handler, doc info, etc.)
            if (key === "error-handler" || key === "doc:documentation") {
                continue;
            }
            const items = Array.isArray(value) ? value : [value];
            for (const item of items) {
                if (!item || typeof item !== "object")
                    continue;
                // Check if this tag represents a step we should display
                const shouldShow = !SKIP_TAGS.has(key);
                if (shouldShow) {
                    // Find matching tag occurrence to get the line number
                    let matchedLine = flowStartLine;
                    const docName = item["@_doc:name"];
                    const name = item["@_name"];
                    for (let i = lastMatchIndex.value; i < occurrences.length; i++) {
                        const occ = occurrences[i];
                        if (occ.lineNumber >= flowStartLine && occ.tagName === key) {
                            if (docName && occ.docName !== docName)
                                continue;
                            if (name && occ.name !== name)
                                continue;
                            matchedLine = occ.lineNumber;
                            lastMatchIndex.value = i + 1;
                            break;
                        }
                    }
                    const step = tagToStep(key, item, flowId, counter.value++);
                    step.lineNumber = matchedLine;
                    steps.push(step);
                }
                // Recurse ONLY if it's a recursive structural element (like choice, foreach, when, etc.)
                if (RECURSIVE_TAGS.has(key)) {
                    let matchedLine = flowStartLine;
                    for (let i = lastMatchIndex.value; i < occurrences.length; i++) {
                        const occ = occurrences[i];
                        if (occ.lineNumber >= flowStartLine && occ.tagName === key) {
                            lastMatchIndex.value = i + 1;
                            break;
                        }
                    }
                    walk(item);
                }
            }
        }
    }
    walk(node);
    return steps;
}
// ─── Main parser ───────────────────────────────────────────────────────────────
/**
 * Parse a Mule XML string into a ParseResult.
 *
 * @param xmlText - Raw content of the .xml file
 */
function parseMuleXml(xmlText) {
    const warnings = [];
    const flows = [];
    // ── 1. Parse XML to JSON ──────────────────────────────────────────────────
    const parser = new fast_xml_parser_1.XMLParser({
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
    let parsed;
    try {
        parsed = parser.parse(xmlText);
    }
    catch (err) {
        warnings.push(`XML parse error: ${err.message}`);
        return { flows, warnings };
    }
    // ── 2. Find the <mule> root ───────────────────────────────────────────────
    const muleRoot = parsed["mule"];
    if (!muleRoot) {
        warnings.push("No <mule> root element found. Is this a valid Mule XML file?");
        return { flows, warnings };
    }
    // ── 3. Build line-number and occurrences maps ──────────────────────────────
    const lineMap = buildLineMap(xmlText);
    const occurrences = buildTagOccurrenceList(xmlText);
    // ── 4. Collect flows & sub-flows ──────────────────────────────────────────
    const flowElements = muleRoot["flow"] || [];
    const subFlowElements = muleRoot["sub-flow"] || [];
    const errorHandlerElements = muleRoot["error-handler"] || [];
    const processFlowLike = (elements, kind) => {
        for (const el of elements) {
            if (!el || typeof el !== "object") {
                continue;
            }
            const elem = el;
            const name = elem["@_name"] ||
                elem["@_doc:name"] ||
                `Unnamed ${kind}`;
            const lineKey = `${kind}::${name}`;
            const lineNumber = lineMap.get(lineKey) ?? 1;
            const subgraphId = toNodeId(`${kind}_${name}`);
            const counter = { value: 0 };
            const lastMatchIndex = { value: 0 };
            const steps = extractSteps(elem, subgraphId, counter, occurrences, lineNumber, lastMatchIndex);
            // ── Extract inline <error-handler> nested inside this flow ──────────
            let errorHandler;
            if (kind === "flow" || kind === "sub-flow") {
                const ehRaw = elem["error-handler"];
                const ehList = Array.isArray(ehRaw) ? ehRaw : ehRaw ? [ehRaw] : [];
                for (const eh of ehList) {
                    if (!eh || typeof eh !== "object")
                        continue;
                    const ehElem = eh;
                    if (!errorHandler)
                        errorHandler = [];
                    // Each error-handler can contain multiple on-error-propagate / on-error-continue
                    for (const stratKey of ["on-error-propagate", "on-error-continue"]) {
                        const stratRaw = ehElem[stratKey];
                        const stratList = Array.isArray(stratRaw)
                            ? stratRaw
                            : stratRaw
                                ? [stratRaw]
                                : [];
                        for (const strat of stratList) {
                            if (!strat || typeof strat !== "object")
                                continue;
                            const stratElem = strat;
                            const stratType = stratKey;
                            const docName = stratElem["@_doc:name"];
                            const errType = stratElem["@_type"];
                            const stratLabel = docName ||
                                (errType ? `${stratKey} (${errType})` : stratKey
                                    .replace(/-/g, " ")
                                    .replace(/\b\w/g, (c) => c.toUpperCase()));
                            const stratCounter = { value: counter.value };
                            const stratLastMatch = { value: 0 };
                            const stratSteps = extractSteps(stratElem, `${subgraphId}_err`, stratCounter, occurrences, lineNumber, stratLastMatch);
                            counter.value = stratCounter.value;
                            errorHandler.push({
                                type: stratType,
                                label: stratLabel,
                                steps: stratSteps,
                            });
                        }
                    }
                }
            }
            flows.push({ kind, name, lineNumber, steps, subgraphId, errorHandler });
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
function generateMermaidDiagram(flows, theme = "default") {
    if (flows.length === 0) {
        return "graph TD\n  EMPTY[No flows found]";
    }
    const lines = [];
    // Global graph declaration
    lines.push("graph TD");
    lines.push("  %% Auto-generated by MuleSoft Multi-Flow Visualizer");
    lines.push("");
    for (const flow of flows) {
        const kindLabel = flow.kind === "flow"
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
        }
        else {
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
                const targetFlow = flows.find((f) => f.name === step.flowRefTarget);
                if (targetFlow && targetFlow.steps.length > 0) {
                    const targetFirstNode = targetFlow.steps[0].nodeId;
                    lines.push(`  ${step.nodeId} -.->|calls| ${targetFirstNode}`);
                }
            }
        }
    }
    return lines.join("\n");
}
//# sourceMappingURL=muleParser.js.map