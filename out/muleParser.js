"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHILD_SCHEMA = exports.TAG_META = void 0;
exports.parseMuleXml = parseMuleXml;
exports.countAllNodes = countAllNodes;
const fast_xml_parser_1 = require("fast-xml-parser");
/**
 * Maps well-known Mule XML tag names to a friendly label and Mermaid shape.
 * This is used as a HINT for display — structural layout is inferred dynamically.
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
function toNodeId(raw) {
    return raw
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .replace(/^([0-9])/, "_$1");
}
function escapeMermaidLabel(text) {
    return text
        .replace(/[()]/g, "")
        .replace(/[\[\]]/g, "")
        .replace(/[{}]/g, "")
        .replace(/</g, "lt ")
        .replace(/>/g, " gt")
        .replace(/"/g, "'")
        .replace(/`/g, "'")
        .replace(/\s{2,}/g, " ")
        .trim();
}
// ─── Non-processor tags (config / structural wrappers, never shown as nodes) ──
/**
 * Tags that are NEVER rendered as processor nodes. They are either:
 * - Config sub-elements of a parent processor
 * - Structural wrappers (branches, error handling)
 * - XML metadata
 */
const NON_PROCESSOR_TAGS = new Set([
    // XML / top-level structural
    "mule", "flow", "sub-flow",
    // Branch wrappers (become FlowBranch objects, not FlowNode)
    "when", "otherwise", "route",
    // Error handling (handled separately)
    "error-handler", "on-error-propagate", "on-error-continue",
    // EE config sub-elements
    "ee:variables", "ee:set-variable", "ee:set-payload", "ee:message",
    // Documentation
    "doc:documentation",
]);
function getTagAndChildren(elem) {
    let tagName = "";
    let children = [];
    let attrs = {};
    let text;
    for (const [k, v] of Object.entries(elem)) {
        if (k === ":@") {
            attrs = v || {};
        }
        else if (k === "#text") {
            text = String(v);
        }
        else if (k.startsWith("?")) {
            continue;
        }
        else {
            tagName = k;
            if (Array.isArray(v)) {
                children = v;
            }
        }
    }
    if (!tagName)
        return null;
    return { tagName, children, attrs, text };
}
/**
 * Determine if a child XML tag should be treated as a processor node in the tree.
 */
function shouldProcessAsNode(key, parentTag, children) {
    if (key.startsWith("@_") || key === "#text" || key === ":@")
        return false;
    if (NON_PROCESSOR_TAGS.has(key))
        return false;
    if (key.endsWith("-config") || key.endsWith("config") || key === "configuration")
        return false;
    if (key.endsWith("-connection"))
        return false;
    if (exports.TAG_META[key])
        return true;
    const parentPrefix = parentTag.includes(":") ? parentTag.split(":")[0] : "";
    const childPrefix = key.includes(":") ? key.split(":")[0] : "";
    if (childPrefix && childPrefix === parentPrefix)
        return false;
    return true;
}
/**
 * Dynamically detect the layout role of an element by inspecting its children.
 */
function detectLayout(children, parentTag) {
    let hasWhenOrOtherwise = false;
    let hasRoute = false;
    let hasProcessor = false;
    for (const c of children) {
        const info = getTagAndChildren(c);
        if (!info)
            continue;
        if (info.tagName === "when" || info.tagName === "otherwise") {
            hasWhenOrOtherwise = true;
        }
        else if (info.tagName === "route") {
            hasRoute = true;
        }
        else if (shouldProcessAsNode(info.tagName, parentTag, info.children)) {
            hasProcessor = true;
        }
    }
    if (hasWhenOrOtherwise)
        return "router";
    if (hasRoute)
        return "parallel";
    if (hasProcessor)
        return "scope";
    return "leaf";
}
// ─── flattenOrderedChildren (extracts config sub-elements into rawAttrs) ───────
function flattenOrderedChildren(children, prefix, out, depth = 0) {
    if (depth > 6)
        return;
    for (const child of children) {
        const info = getTagAndChildren(child);
        if (!info)
            continue;
        const { tagName, children: subChildren, attrs, text } = info;
        if (NON_PROCESSOR_TAGS.has(tagName))
            continue;
        if (exports.TAG_META[tagName])
            continue;
        const childPath = prefix ? `${prefix}>${tagName}` : tagName;
        for (const [k, v] of Object.entries(attrs)) {
            if (k.startsWith("@_")) {
                out[`${childPath}.${k.slice(2)}`] = String(v);
            }
        }
        if (text) {
            const trimmed = text.trim();
            if (trimmed.length > 0 && trimmed.length < 50000) {
                out[childPath] = trimmed;
            }
        }
        flattenOrderedChildren(subChildren, childPath, out, depth + 1);
    }
}
// ─── tagToStep: create a FlowStep from an XML tag ────────────────────────────
function tagToStep(tagName, attrs, children, flowId, index) {
    const meta = exports.TAG_META[tagName];
    const sanitiseAttr = (val) => String(val)
        .replace(/[()[\]{}\"'`]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    let label;
    if (tagName === "flow-ref") {
        const target = sanitiseAttr(attrs["@_name"] || "unknown");
        label = `Flow Ref to ${target}`;
    }
    else if (meta) {
        label = meta.label;
        const docName = attrs["@_doc:name"];
        const attrName = attrs["@_name"];
        if (docName) {
            const s = sanitiseAttr(docName);
            if (s.toLowerCase() !== meta.label.toLowerCase()) {
                label += ` - ${s}`;
            }
        }
        else if (attrName) {
            const s = sanitiseAttr(attrName);
            if (s.toLowerCase() !== meta.label.toLowerCase()) {
                label += ` - ${s}`;
            }
        }
    }
    else {
        const localName = tagName.includes(":") ? tagName.split(":")[1] : tagName;
        label = localName
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
        const docName = attrs["@_doc:name"];
        const attrName = attrs["@_name"];
        if (docName) {
            const s = sanitiseAttr(docName);
            if (s.toLowerCase() !== label.toLowerCase()) {
                label += ` - ${s}`;
            }
        }
        else if (attrName) {
            const s = sanitiseAttr(attrName);
            if (s.toLowerCase() !== label.toLowerCase()) {
                label += ` - ${s}`;
            }
        }
    }
    const nodeId = toNodeId(`${flowId}_step_${index}_${tagName}`);
    const rawAttrs = {};
    for (const [k, v] of Object.entries(attrs)) {
        if (k.startsWith("@_")) {
            rawAttrs[k.slice(2)] = String(v);
        }
    }
    flattenOrderedChildren(children, "", rawAttrs);
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
    const lines = xml.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        const regex = /<([a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+)\b([^>]*)/g;
        let match;
        while ((match = regex.exec(lineText)) !== null) {
            const tagName = match[1];
            const attrsText = match[2];
            if (tagName.startsWith("!") || tagName.startsWith("?"))
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
function buildLineMap(xml) {
    const map = new Map();
    const flowPattern = /<(flow|sub-flow)\b[^>]*name\s*=\s*["']([^"']+)["'][^>]*>/gi;
    const fullText = xml;
    flowPattern.lastIndex = 0;
    let match;
    while ((match = flowPattern.exec(fullText)) !== null) {
        const charPos = match.index;
        const upTo = fullText.substring(0, charPos);
        const line = upTo.split("\n").length;
        const key = `${match[1]}::${match[2]}`;
        map.set(key, line);
    }
    return map;
}
// ─── Core tree extraction in exact document order ─────────────────────────────
function matchLineNumber(tagName, attrs, occurrences, flowStartLine, lastMatchIndex) {
    let matchedLine = flowStartLine;
    const docName = attrs["@_doc:name"];
    const name = attrs["@_name"];
    for (let i = lastMatchIndex.value; i < occurrences.length; i++) {
        const occ = occurrences[i];
        if (occ.lineNumber >= flowStartLine && occ.tagName === tagName) {
            if (docName && occ.docName !== docName)
                continue;
            if (name && occ.name !== name)
                continue;
            matchedLine = occ.lineNumber;
            lastMatchIndex.value = i + 1;
            break;
        }
    }
    return matchedLine;
}
function extractNodesFromOrdered(orderedChildren, flowId, counter, occurrences, flowStartLine, lastMatchIndex) {
    const nodes = [];
    for (const item of orderedChildren) {
        const info = getTagAndChildren(item);
        if (!info)
            continue;
        const { tagName, children, attrs } = info;
        if (!shouldProcessAsNode(tagName, "", children))
            continue;
        const matchedLine = matchLineNumber(tagName, attrs, occurrences, flowStartLine, lastMatchIndex);
        const step = tagToStep(tagName, attrs, children, flowId, counter.value++);
        step.lineNumber = matchedLine;
        const layoutHint = detectLayout(children, tagName);
        const flowNode = {
            ...step,
            layoutHint,
            children: [],
        };
        if (layoutHint === "router") {
            flowNode.branches = extractRouterBranchesFromOrdered(children, flowId, counter, occurrences, flowStartLine, lastMatchIndex);
        }
        else if (layoutHint === "parallel") {
            flowNode.branches = extractParallelRoutesFromOrdered(children, flowId, counter, occurrences, flowStartLine, lastMatchIndex);
        }
        else if (layoutHint === "scope") {
            flowNode.children = extractNodesFromOrdered(children, flowId, counter, occurrences, flowStartLine, lastMatchIndex);
        }
        nodes.push(flowNode);
    }
    return nodes;
}
function extractRouterBranchesFromOrdered(children, flowId, counter, occurrences, flowStartLine, lastMatchIndex) {
    const branches = [];
    for (const child of children) {
        const info = getTagAndChildren(child);
        if (!info)
            continue;
        const { tagName, children: branchChildren, attrs } = info;
        if (tagName === "when") {
            matchLineNumber("when", attrs, occurrences, flowStartLine, lastMatchIndex);
            const expression = attrs["@_expression"] || "";
            const displayExpr = expression.length > 50
                ? expression.substring(0, 47) + "..."
                : expression;
            const branchNodes = extractNodesFromOrdered(branchChildren, flowId, counter, occurrences, flowStartLine, lastMatchIndex);
            branches.push({
                label: expression ? `when: ${displayExpr}` : "when",
                condition: expression,
                children: branchNodes,
            });
        }
        else if (tagName === "otherwise") {
            matchLineNumber("otherwise", attrs, occurrences, flowStartLine, lastMatchIndex);
            const branchNodes = extractNodesFromOrdered(branchChildren, flowId, counter, occurrences, flowStartLine, lastMatchIndex);
            branches.push({
                label: "otherwise",
                children: branchNodes,
            });
        }
    }
    return branches;
}
function extractParallelRoutesFromOrdered(children, flowId, counter, occurrences, flowStartLine, lastMatchIndex) {
    const branches = [];
    let routeIndex = 1;
    for (const child of children) {
        const info = getTagAndChildren(child);
        if (!info)
            continue;
        const { tagName, children: routeChildren, attrs } = info;
        if (tagName === "route") {
            matchLineNumber("route", attrs, occurrences, flowStartLine, lastMatchIndex);
            const routeNodes = extractNodesFromOrdered(routeChildren, flowId, counter, occurrences, flowStartLine, lastMatchIndex);
            branches.push({
                label: `Route ${routeIndex++}`,
                children: routeNodes,
            });
        }
    }
    return branches;
}
// ─── Main parser ───────────────────────────────────────────────────────────────
function parseMuleXml(xmlText) {
    const warnings = [];
    const flows = [];
    const parser = new fast_xml_parser_1.XMLParser({
        preserveOrder: true,
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
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
    if (!Array.isArray(parsed) || parsed.length === 0) {
        warnings.push("XML file appears to be empty.");
        return { flows, warnings };
    }
    // Find <mule> root
    let muleChildren;
    for (const item of parsed) {
        if ("mule" in item) {
            muleChildren = item["mule"];
            break;
        }
    }
    if (!muleChildren) {
        warnings.push("No <mule> root element found. Is this a valid Mule XML file?");
        return { flows, warnings };
    }
    const lineMap = buildLineMap(xmlText);
    const occurrences = buildTagOccurrenceList(xmlText);
    for (const child of muleChildren) {
        const info = getTagAndChildren(child);
        if (!info)
            continue;
        const { tagName, children, attrs } = info;
        if (tagName === "flow" || tagName === "sub-flow" || tagName === "error-handler") {
            const kind = tagName;
            const name = attrs["@_name"] || attrs["@_doc:name"] || `Unnamed ${kind}`;
            const lineKey = `${kind}::${name}`;
            const lineNumber = lineMap.get(lineKey) ?? 1;
            const subgraphId = toNodeId(`${kind}_${name}`);
            const counter = { value: 0 };
            const lastMatchIndex = { value: 0 };
            // Separate processor children from inline <error-handler>
            const flowProcChildren = [];
            let errorHandler;
            for (const flowChild of children) {
                const cInfo = getTagAndChildren(flowChild);
                if (!cInfo)
                    continue;
                if (cInfo.tagName === "error-handler") {
                    if (!errorHandler)
                        errorHandler = [];
                    for (const ehChild of cInfo.children) {
                        const ehInfo = getTagAndChildren(ehChild);
                        if (!ehInfo)
                            continue;
                        const stratKey = ehInfo.tagName;
                        if (stratKey === "on-error-propagate" || stratKey === "on-error-continue") {
                            const docName = ehInfo.attrs["@_doc:name"];
                            const errType = ehInfo.attrs["@_type"];
                            const stratLabel = docName ||
                                (errType ? `${stratKey} (${errType})` : stratKey
                                    .replace(/-/g, " ")
                                    .replace(/\b\w/g, (c) => c.toUpperCase()));
                            const stratCounter = { value: counter.value };
                            const stratLastMatch = { value: 0 };
                            const stratSteps = extractNodesFromOrdered(ehInfo.children, `${subgraphId}_err`, stratCounter, occurrences, lineNumber, stratLastMatch);
                            counter.value = stratCounter.value;
                            errorHandler.push({
                                type: stratKey,
                                label: stratLabel,
                                steps: stratSteps,
                            });
                        }
                    }
                }
                else {
                    flowProcChildren.push(flowChild);
                }
            }
            const rootNodes = extractNodesFromOrdered(flowProcChildren, subgraphId, counter, occurrences, lineNumber, lastMatchIndex);
            flows.push({
                kind,
                name,
                lineNumber,
                rootNodes,
                steps: rootNodes,
                subgraphId,
                errorHandler,
            });
        }
    }
    if (flows.length === 0) {
        warnings.push("No flows or sub-flows found in this Mule XML file.");
    }
    return { flows, warnings };
}
// ─── Utility: count all nodes in a tree ───────────────────────────────────────
/** Recursively count all FlowNodes in a tree (for display in the sidebar) */
function countAllNodes(nodes) {
    let count = 0;
    for (const n of nodes) {
        count++;
        if (n.children && n.children.length > 0) {
            count += countAllNodes(n.children);
        }
        if (n.branches) {
            for (const b of n.branches) {
                count += countAllNodes(b.children);
            }
        }
    }
    return count;
}
//# sourceMappingURL=muleParser.js.map