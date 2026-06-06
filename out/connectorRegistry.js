"use strict";
/**
 * connectorRegistry.ts
 *
 * Pipeline:
 *  1. Parse the workspace pom.xml → extract mule-plugin dependencies and repository URLs.
 *  2. Match XML namespace prefixes to pom dependencies.
 *  3. Fetch schema (first via downloading Maven JARs in-memory and parsing XSDs,
 *     falling back to Anypoint Exchange API v2 REST descriptors).
 *  4. Expose OperationDef[] for each connector so the webview can render a real properties panel.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractNamespaces = extractNamespaces;
exports.parsePomDependencies = parsePomDependencies;
exports.matchDepToPrefix = matchDepToPrefix;
exports.httpGet = httpGet;
exports.fetchSchemaFromExchange = fetchSchemaFromExchange;
exports.getConnectorOperations = getConnectorOperations;
exports.findOperation = findOperation;
const fs = __importStar(require("fs"));
const fsp = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const fast_xml_parser_1 = require("fast-xml-parser");
const JSZip = require("jszip");
// ─── Module-level caches & state ──────────────────────────────────────────────
/** Memory cache: "groupId:artifactId:version" -> OperationDef[] or Promise of it */
const exchangeCache = new Map();
const CACHE_VERSION = 3; // increment this to bust all disk caches
/** Stores pom.xml repositories across sessions */
let lastPomRepoUrls = [];
// ─── Namespace extraction ─────────────────────────────────────────────────────
/** Scan the raw Mule XML for xmlns declarations. */
function extractNamespaces(xmlText) {
    const map = new Map();
    const re = /xmlns(?::([a-zA-Z][\w-]*))?="([^"]+)"/g;
    let m;
    while ((m = re.exec(xmlText)) !== null) {
        const prefix = m[1] ?? "";
        map.set(prefix, m[2]);
    }
    return map;
}
// ─── pom.xml parsing ──────────────────────────────────────────────────────────
/** Parse pom.xml and return mule-plugin dependencies + repository URLs. */
function parsePomDependencies(pomText) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        isArray: (n) => ["dependency", "repository"].includes(n),
    });
    let pom;
    try {
        pom = parser.parse(pomText);
    }
    catch {
        return { deps: [], repoUrls: [] };
    }
    const project = pom["project"];
    if (!project)
        return { deps: [], repoUrls: [] };
    // Extract repositories
    const repoUrls = [];
    const reposNode = project["repositories"];
    const rawRepos = reposNode?.["repository"] ?? [];
    for (const r of rawRepos) {
        if (!r || typeof r !== "object")
            continue;
        const url = String(r["url"] ?? "").trim();
        if (url)
            repoUrls.push(url.endsWith("/") ? url : url + "/");
    }
    // Extract dependencies
    const depsNode = project["dependencies"];
    const rawDeps = depsNode?.["dependency"] ?? [];
    const deps = [];
    for (const d of rawDeps) {
        if (!d || typeof d !== "object")
            continue;
        const dep = d;
        if (dep["classifier"] !== "mule-plugin")
            continue;
        const groupId = String(dep["groupId"] ?? "").trim();
        const artifactId = String(dep["artifactId"] ?? "").trim();
        let version = String(dep["version"] ?? "").trim();
        // Resolve simple Maven properties
        if (version.startsWith("${")) {
            const propName = version.slice(2, -1);
            const props = project["properties"] ?? {};
            version = String(props[propName] ?? version).trim();
        }
        if (groupId && artifactId && version) {
            deps.push({ groupId, artifactId, version });
        }
    }
    return { deps, repoUrls };
}
// ─── Namespace → dependency matching ─────────────────────────────────────────
function matchDepToPrefix(prefix, namespaceUri, deps) {
    if (!prefix)
        return undefined;
    const pfxLower = prefix.toLowerCase();
    console.log(`[MuleViz] matchDepToPrefix: prefix="${prefix}" uri="${namespaceUri}"`);
    console.log(`[MuleViz] matchDepToPrefix: available deps = ${deps.map(d => d.artifactId).join(', ')}`);
    // Pass 1 — namespace URI contains the prefix as a distinct word segment
    // e.g. URI "http://www.mulesoft.org/schema/mule/http" → last segment "http"
    const uriLastSegment = namespaceUri.split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
    for (const dep of deps) {
        const aid = dep.artifactId.toLowerCase();
        // Exact: URI last segment matches prefix exactly AND artifactId contains it
        if (uriLastSegment === pfxLower && aid.includes(pfxLower)) {
            console.log(`[MuleViz] matchDepToPrefix: matched via URI last segment → ${dep.artifactId}`);
            return dep;
        }
    }
    // Pass 2 — artifactId contains prefix as a hyphen-bounded word
    // e.g. prefix "http" matches "mule-http-connector" (word boundary)
    for (const dep of deps) {
        const aid = dep.artifactId.toLowerCase();
        const aidParts = aid.split('-');
        if (aidParts.includes(pfxLower)) {
            console.log(`[MuleViz] matchDepToPrefix: matched via artifactId word boundary → ${dep.artifactId}`);
            return dep;
        }
    }
    // Pass 3 — URI segments contain prefix as a distinct segment
    const uriParts = namespaceUri.split(/[/.]/).filter(Boolean).map(s => s.toLowerCase());
    for (const dep of deps) {
        const aid = dep.artifactId.toLowerCase();
        const aidParts = aid.split('-');
        if (uriParts.includes(pfxLower) && aidParts.includes(pfxLower)) {
            console.log(`[MuleViz] matchDepToPrefix: matched via URI parts → ${dep.artifactId}`);
            return dep;
        }
    }
    console.log(`[MuleViz] matchDepToPrefix: no match found for prefix="${prefix}"`);
    return undefined;
}
// ─── XSD Parser Helpers ───────────────────────────────────────────────────────
function ensureArray(val) {
    if (val === undefined || val === null)
        return [];
    if (Array.isArray(val))
        return val;
    return [val];
}
function getXsdChild(node, localName) {
    if (!node)
        return undefined;
    for (const key of Object.keys(node)) {
        const local = key.includes(":") ? key.split(":")[1] : key;
        if (local === localName) {
            return node[key];
        }
    }
    return undefined;
}
function shouldSkipElement(name) {
    if (!name)
        return true;
    const lower = name.toLowerCase();
    return (lower.endsWith("-config") ||
        lower.endsWith("-connection") ||
        lower.endsWith("config") ||
        lower.endsWith("connection") ||
        lower.startsWith("abstract-"));
}
function findNamedComplexType(name, schema) {
    const list = ensureArray(getXsdChild(schema, "complexType"));
    return list.find((ct) => ct && ct["@_name"] === name);
}
function findNamedSimpleType(name, schema) {
    const list = ensureArray(getXsdChild(schema, "simpleType"));
    return list.find((st) => st && st["@_name"] === name);
}
function findNamedAttributeGroup(name, schema) {
    const list = ensureArray(getXsdChild(schema, "attributeGroup"));
    return list.find((ag) => ag && ag["@_name"] === name);
}
function parseXsdAttribute(attr, schema) {
    if (!attr)
        return null;
    const name = attr["@_name"];
    if (!name)
        return null;
    const rawType = attr["@_type"] || "xs:string";
    const type = rawType.includes(":") ? rawType.split(":")[1] : rawType;
    const use = attr["@_use"] || "optional";
    const required = use === "required";
    const defaultValue = attr["@_default"];
    // Extract description
    let description;
    const annotation = getXsdChild(attr, "annotation");
    if (annotation) {
        const doc = getXsdChild(ensureArray(annotation)[0], "documentation");
        if (doc) {
            const docVal = ensureArray(doc)[0];
            description = typeof docVal === "string" ? docVal : docVal["#text"] || "";
        }
    }
    // Extract allowedValues (enums)
    let allowedValues;
    const inlineSimpleType = getXsdChild(attr, "simpleType");
    if (inlineSimpleType) {
        const st = ensureArray(inlineSimpleType)[0];
        const restriction = getXsdChild(st, "restriction");
        if (restriction) {
            const enums = getXsdChild(ensureArray(restriction)[0], "enumeration");
            if (enums) {
                allowedValues = ensureArray(enums)
                    .map((en) => en && en["@_value"])
                    .filter((v) => typeof v === "string");
            }
        }
    }
    else {
        const localType = rawType.includes(":") ? rawType.split(":")[1] : rawType;
        const st = findNamedSimpleType(localType, schema);
        if (st) {
            const restriction = getXsdChild(st, "restriction");
            if (restriction) {
                const enums = getXsdChild(ensureArray(restriction)[0], "enumeration");
                if (enums) {
                    allowedValues = ensureArray(enums)
                        .map((en) => en && en["@_value"])
                        .filter((v) => typeof v === "string");
                }
            }
        }
    }
    return {
        name,
        type,
        required,
        defaultValue,
        description: description ? description.trim() : undefined,
        allowedValues: allowedValues && allowedValues.length > 0 ? allowedValues : undefined,
    };
}
function gatherAttributesFromComplexType(ct, schema) {
    const params = [];
    if (!ct)
        return params;
    // 1. Direct attributes
    const directAttrs = ensureArray(getXsdChild(ct, "attribute"));
    for (const attr of directAttrs) {
        const p = parseXsdAttribute(attr, schema);
        if (p)
            params.push(p);
    }
    // 2. Inherited attributes
    const contentKeys = ["complexContent", "simpleContent"];
    for (const cKey of contentKeys) {
        const content = ensureArray(getXsdChild(ct, cKey));
        for (const item of content) {
            const extension = ensureArray(getXsdChild(item, "extension") || getXsdChild(item, "restriction"));
            for (const ext of extension) {
                const extAttrs = ensureArray(getXsdChild(ext, "attribute"));
                for (const attr of extAttrs) {
                    const p = parseXsdAttribute(attr, schema);
                    if (p)
                        params.push(p);
                }
                const baseType = ext["@_base"];
                if (baseType) {
                    const localBaseName = baseType.includes(":") ? baseType.split(":")[1] : baseType;
                    const baseCt = findNamedComplexType(localBaseName, schema);
                    if (baseCt) {
                        params.push(...gatherAttributesFromComplexType(baseCt, schema));
                    }
                }
            }
        }
    }
    // 3. AttributeGroup references
    const attributeGroups = ensureArray(getXsdChild(ct, "attributeGroup"));
    for (const groupRef of attributeGroups) {
        const refName = groupRef["@_ref"];
        if (refName) {
            const localRefName = refName.includes(":") ? refName.split(":")[1] : refName;
            const attrGroup = findNamedAttributeGroup(localRefName, schema);
            if (attrGroup) {
                const groupAttrs = ensureArray(getXsdChild(attrGroup, "attribute"));
                for (const attr of groupAttrs) {
                    const p = parseXsdAttribute(attr, schema);
                    if (p)
                        params.push(p);
                }
            }
        }
    }
    return params;
}
function parseXsd(content) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        isArray: (name) => {
            const local = name.includes(":") ? name.split(":")[1] : name;
            return [
                "element",
                "attribute",
                "enumeration",
                "complexType",
                "extension",
                "sequence",
                "choice",
                "group",
                "attributeGroup",
                "simpleType",
                "restriction",
            ].includes(local);
        },
    });
    let parsed;
    try {
        parsed = parser.parse(content);
    }
    catch (err) {
        console.warn(`[MuleViz] Failed to parse XSD content:`, err);
        return [];
    }
    let schema = null;
    for (const key of Object.keys(parsed)) {
        const local = key.includes(":") ? key.split(":")[1] : key;
        if (local === "schema") {
            schema = parsed[key];
            break;
        }
    }
    if (!schema)
        return [];
    const elements = ensureArray(getXsdChild(schema, "element"));
    const ops = [];
    for (const el of elements) {
        if (!el || typeof el !== "object")
            continue;
        const name = el["@_name"];
        if (!name || shouldSkipElement(name))
            continue;
        let parameters = [];
        const inlineComplexType = getXsdChild(el, "complexType");
        if (inlineComplexType) {
            parameters = gatherAttributesFromComplexType(ensureArray(inlineComplexType)[0], schema);
        }
        else {
            const typeRef = el["@_type"];
            if (typeRef) {
                const localTypeName = typeRef.includes(":") ? typeRef.split(":")[1] : typeRef;
                const ct = findNamedComplexType(localTypeName, schema);
                if (ct) {
                    parameters = gatherAttributesFromComplexType(ct, schema);
                }
            }
        }
        let description;
        const annotation = getXsdChild(el, "annotation");
        if (annotation) {
            const doc = getXsdChild(ensureArray(annotation)[0], "documentation");
            if (doc) {
                const docVal = ensureArray(doc)[0];
                description = typeof docVal === "string" ? docVal : docVal["#text"] || "";
            }
        }
        ops.push({
            name,
            description: description ? description.trim() : undefined,
            parameters,
        });
    }
    return ops;
}
function parseExtensionDescriptionsXml(content) {
    const parser = new fast_xml_parser_1.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        isArray: (name) => {
            const local = name.includes(':') ? name.split(':')[1] : name;
            return ['config', 'operation', 'source', 'parameter'].includes(local);
        },
        cdataPropName: "__cdata",
        // Parse CDATA sections
    });
    let parsed;
    try {
        parsed = parser.parse(content);
    }
    catch (e) {
        console.warn('[MuleViz] Failed to parse extension-documentation XML:', e);
        return [];
    }
    function getLocalChild(node, localName) {
        if (!node)
            return undefined;
        for (const key of Object.keys(node)) {
            const local = key.includes(':') ? key.split(':')[1] : key;
            if (local === localName) {
                return node[key];
            }
        }
        return undefined;
    }
    let root = null;
    for (const key of Object.keys(parsed)) {
        const local = key.includes(':') ? key.split(':')[1] : key;
        if (local === 'extension-documentation') {
            root = parsed[key];
            break;
        }
    }
    if (!root) {
        console.warn('[MuleViz] No extension-documentation root found');
        return [];
    }
    const ops = [];
    // Helper to extract parameters from a node's <parameters> child
    function extractParams(node) {
        const params = [];
        const parametersNode = getLocalChild(node, 'parameters');
        if (!parametersNode)
            return params;
        const rawParams = getLocalChild(parametersNode, 'parameter');
        const paramList = Array.isArray(rawParams) ? rawParams : rawParams ? [rawParams] : [];
        for (const p of paramList) {
            if (!p || !p['@_name'])
                continue;
            const descNode = getLocalChild(p, 'description');
            let description = '';
            if (typeof descNode === 'string')
                description = descNode;
            else if (descNode && descNode['__cdata'])
                description = descNode['__cdata'];
            else if (descNode && descNode['#text'])
                description = descNode['#text'];
            params.push({
                name: p['@_name'],
                type: 'String', // descriptions XML has no type info
                required: false, // descriptions XML has no required info
                description: description.trim() || undefined,
            });
        }
        return params;
    }
    // Parse <operations>
    const operationsNode = getLocalChild(root, 'operations');
    if (operationsNode) {
        const rawOps = getLocalChild(operationsNode, 'operation');
        const opList = Array.isArray(rawOps) ? rawOps : rawOps ? [rawOps] : [];
        for (const op of opList) {
            if (!op || !op['@_name'])
                continue;
            const descNode = getLocalChild(op, 'description');
            let description = '';
            if (typeof descNode === 'string')
                description = descNode;
            else if (descNode?.['__cdata'])
                description = descNode['__cdata'];
            else if (descNode?.['#text'])
                description = descNode['#text'];
            ops.push({
                name: op['@_name'],
                description: description.trim() || undefined,
                parameters: extractParams(op),
            });
        }
    }
    // Parse <sources> (these are message sources like "listener")
    const sourcesNode = getLocalChild(root, 'sources');
    if (sourcesNode) {
        const rawSources = getLocalChild(sourcesNode, 'source');
        const sourceList = Array.isArray(rawSources) ? rawSources : rawSources ? [rawSources] : [];
        for (const src of sourceList) {
            if (!src || !src['@_name'])
                continue;
            const descNode = getLocalChild(src, 'description');
            let description = '';
            if (typeof descNode === 'string')
                description = descNode;
            else if (descNode?.['__cdata'])
                description = descNode['__cdata'];
            else if (descNode?.['#text'])
                description = descNode['#text'];
            ops.push({
                name: src['@_name'],
                description: description.trim() || undefined,
                parameters: extractParams(src),
            });
        }
    }
    console.log(`[MuleViz] parseExtensionDescriptionsXml: found ${ops.length} ops/sources`);
    ops.forEach(o => console.log(`  [MuleViz]   op="${o.name}" params=${o.parameters.map(p => p.name).join(',')}`));
    return ops;
}
// ─── Network Downloader Helpers ───────────────────────────────────────────────
function httpGet(url, headers = {}, redirectCount = 0) {
    if (redirectCount > 5) {
        return Promise.reject(new Error("Too many redirects"));
    }
    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith("https");
        const client = isHttps ? https : http;
        const req = client.get(url, { headers, timeout: 15000 }, (res) => {
            const status = res.statusCode || 0;
            if (status >= 300 && status < 400 && res.headers.location) {
                res.resume();
                const nextUrl = new URL(res.headers.location, url).toString();
                httpGet(nextUrl, headers, redirectCount + 1).then(resolve, reject);
                return;
            }
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
                resolve({
                    status,
                    body: Buffer.concat(chunks).toString("utf8"),
                });
            });
        });
        req.on("error", (err) => {
            reject(err);
        });
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Timeout"));
        });
    });
}
function downloadJar(url) {
    return new Promise((resolve, reject) => {
        const attempt = (currentUrl, hops = 0) => {
            if (hops > 5) {
                reject(new Error("Too many redirects"));
                return;
            }
            const isHttps = currentUrl.startsWith("https");
            const client = isHttps ? https : http;
            const req = client.get(currentUrl, { timeout: 15000 }, (res) => {
                const status = res.statusCode || 0;
                if (status >= 300 && status < 400 && res.headers.location) {
                    res.resume();
                    const nextUrl = new URL(res.headers.location, currentUrl).toString();
                    attempt(nextUrl, hops + 1);
                    return;
                }
                if (status !== 200) {
                    res.resume();
                    reject(new Error(`Bad status ${status}`));
                    return;
                }
                const chunks = [];
                res.on("data", (chunk) => chunks.push(chunk));
                res.on("end", () => {
                    resolve(Buffer.concat(chunks));
                });
            });
            req.on("error", (err) => {
                reject(err);
            });
            req.on("timeout", () => {
                req.destroy();
                reject(new Error("Timeout"));
            });
        };
        attempt(url);
    });
}
// ─── Descriptor Parser ────────────────────────────────────────────────────────
function parseDescriptor(descriptor) {
    if (!descriptor)
        return [];
    let rawOps;
    let description;
    if (descriptor.extension) {
        rawOps = descriptor.extension.operations;
        description = descriptor.extension.description;
    }
    if (!Array.isArray(rawOps)) {
        rawOps = descriptor.operations;
    }
    if (!Array.isArray(rawOps)) {
        return [];
    }
    const ops = [];
    for (const op of rawOps) {
        if (!op || typeof op !== "object" || !op.name)
            continue;
        const parameters = [];
        if (Array.isArray(op.parameterGroupModels)) {
            for (const group of op.parameterGroupModels) {
                if (group && Array.isArray(group.parameters)) {
                    for (const param of group.parameters) {
                        if (param && param.name) {
                            parameters.push({
                                name: param.name,
                                type: param.type || "String",
                                required: !!param.required,
                                defaultValue: param.defaultValue !== undefined ? String(param.defaultValue) : undefined,
                                description: param.description,
                                allowedValues: Array.isArray(param.allowedValues) ? param.allowedValues.map(String) : undefined,
                            });
                        }
                    }
                }
            }
        }
        ops.push({
            name: op.name,
            description: op.description || description,
            parameters,
        });
    }
    return ops;
}
// ─── Fetch Schema Orchestrator ────────────────────────────────────────────────
function fetchSchemaFromExchange(dep, storageUri) {
    const key = `${dep.groupId}:${dep.artifactId}:${dep.version}`;
    const existing = exchangeCache.get(key);
    if (existing) {
        return Promise.resolve(existing);
    }
    const schemaFile = storageUri
        ? path.join(storageUri.fsPath, `v${CACHE_VERSION}_${dep.groupId}_${dep.artifactId}_${dep.version}_schema.json`)
        : "";
    const promise = (async () => {
        // 1. Try disk cache first
        if (storageUri && schemaFile && fs.existsSync(schemaFile)) {
            try {
                const stats = fs.statSync(schemaFile);
                const ageInMs = Date.now() - stats.mtime.getTime();
                const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
                if (ageInDays < 7) {
                    console.log(`[MuleViz] Found valid cached schema on disk: ${schemaFile}`);
                    const cachedContent = fs.readFileSync(schemaFile, "utf8");
                    const parsed = JSON.parse(cachedContent);
                    if (Array.isArray(parsed)) {
                        return parsed;
                    }
                }
                else {
                    console.log(`[MuleViz] Cached schema on disk is older than 7 days, invalidating: ${schemaFile}`);
                }
            }
            catch (err) {
                console.warn(`[MuleViz] Failed to read disk cached schema:`, err);
            }
        }
        // 2. Try Maven JAR download strategy
        const gPath = dep.groupId.replace(/\./g, "/");
        const bases = [
            ...lastPomRepoUrls,
            "https://repository.mulesoft.org/nexus/content/repositories/releases/",
            "https://repo1.maven.org/maven2/",
            "https://repository.mulesoft.org/nexus/content/repositories/public/",
        ];
        const seenBases = new Set();
        const uniqueBases = [];
        for (const b of bases) {
            if (!b)
                continue;
            const normalized = b.endsWith("/") ? b : b + "/";
            if (!seenBases.has(normalized)) {
                seenBases.add(normalized);
                uniqueBases.push(normalized);
            }
        }
        const candidateUrls = [];
        for (const base of uniqueBases) {
            candidateUrls.push(`${base}${gPath}/${dep.artifactId}/${dep.version}/${dep.artifactId}-${dep.version}-mule-plugin.jar`);
            candidateUrls.push(`${base}${gPath}/${dep.artifactId}/${dep.version}/${dep.artifactId}-${dep.version}.jar`);
        }
        let jarBuffer = null;
        for (const url of candidateUrls) {
            try {
                console.log(`[MuleViz] Attempting download from: ${url}`);
                jarBuffer = await downloadJar(url);
                console.log(`[MuleViz] Downloaded JAR successfully from: ${url}`);
                break;
            }
            catch (e) {
                // Continue trying other URLs
            }
        }
        if (jarBuffer) {
            try {
                console.log(`[MuleViz] Unzipping JAR in memory...`);
                const zip = await JSZip.loadAsync(jarBuffer);
                // DIAGNOSTIC: log every file path in the JAR
                console.log('[MuleViz] All files in JAR:');
                Object.keys(zip.files).forEach(filePath => {
                    console.log(`  [JAR FILE] ${filePath}`);
                });
                // Parse mule-artifact.json if it exists (for logging / metadata check)
                const artifactJsonPath = Object.keys(zip.files).find(f => f.endsWith('mule-artifact.json') && !zip.files[f].dir);
                if (artifactJsonPath) {
                    try {
                        const artContent = await zip.files[artifactJsonPath].async("string");
                        const artJson = JSON.parse(artContent);
                        console.log(`[MuleViz] Found mule-artifact.json at ${artifactJsonPath}: name="${artJson.name}"`);
                    }
                    catch (e) {
                        // ignore
                    }
                }
                // Look for any JSON files that might contain operation definitions
                const extensionModelFiles = Object.keys(zip.files).filter(f => (f.endsWith('.json') || f.endsWith('-extension-model.json')) &&
                    !zip.files[f].dir);
                console.log('[MuleViz] JSON files in JAR:', extensionModelFiles);
                for (const jsonPath of extensionModelFiles) {
                    try {
                        const content = await zip.files[jsonPath].async('string');
                        const parsed = JSON.parse(content);
                        // Check if it has operations or extensionModel structure
                        if (parsed.operations || parsed.extensionModel || parsed.extension) {
                            console.log(`[MuleViz] Found extension model at: ${jsonPath}`);
                            console.log('[MuleViz] Keys:', Object.keys(parsed));
                            const ops = parseDescriptor(parsed);
                            if (ops.length > 0) {
                                console.log(`[MuleViz] Extracted ${ops.length} ops from ${jsonPath}`);
                                return ops;
                            }
                        }
                    }
                    catch (e) {
                        // skip unparseable files
                    }
                }
                const schemaFiles = Object.keys(zip.files).filter(f => !zip.files[f].dir && (f.endsWith('.xsd') ||
                    f.endsWith('-descriptions.xml') ||
                    f.endsWith('-extension-descriptions.xml') ||
                    f.endsWith('-extension-model.xml') ||
                    (f.startsWith('META-INF/') && f.endsWith('.xml') &&
                        !f.endsWith('mule-artifact.json') &&
                        !f.includes('spring') &&
                        !f.includes('maven') &&
                        !f.includes('services') &&
                        !f.includes('registry-bootstrap'))));
                console.log(`[MuleViz] Found ${schemaFiles.length} schema candidate files in JAR:`, schemaFiles);
                // Preview logging
                for (const sf of schemaFiles) {
                    try {
                        const preview = await zip.files[sf].async('string');
                        console.log(`[MuleViz] Schema file preview (first 500 chars) for ${sf}:`);
                        console.log(preview.substring(0, 500));
                    }
                    catch (e) { }
                }
                const ops = [];
                for (const schemaFile of schemaFiles) {
                    try {
                        console.log(`[MuleViz] Parsing schema file: ${schemaFile}`);
                        const content = await zip.files[schemaFile].async("string");
                        let parsedOps;
                        if (schemaFile.endsWith('.xsd')) {
                            parsedOps = parseXsd(content);
                        }
                        else {
                            // Try extension descriptions XML format
                            parsedOps = parseExtensionDescriptionsXml(content);
                            // If that returns nothing, also try XSD parser as fallback
                            if (parsedOps.length === 0) {
                                parsedOps = parseXsd(content);
                            }
                        }
                        console.log(`[MuleViz] Extracted ${parsedOps.length} operations from ${schemaFile}`);
                        ops.push(...parsedOps);
                    }
                    catch (e) {
                        console.warn(`[MuleViz] Error parsing schema ${schemaFile}:`, e);
                    }
                }
                if (ops.length > 0) {
                    console.log(`[MuleViz] Successfully retrieved ${ops.length} operations from Maven JAR parsing.`);
                    return ops;
                }
            }
            catch (zipErr) {
                console.warn(`[MuleViz] Failed to unzip or parse downloaded JAR:`, zipErr);
            }
        }
        // 3. Fallback: Query Exchange API
        console.log(`[MuleViz] Maven JAR strategy failed. Falling back to Exchange API for ${key}`);
        try {
            const assetUrl = `https://anypoint.mulesoft.com/exchange/api/v2/assets/${dep.groupId}/${dep.artifactId}/${dep.version}`;
            console.log(`[MuleViz] Fetching connector asset from Exchange fallback: ${assetUrl}`);
            const assetRes = await httpGet(assetUrl, { Accept: "application/json" });
            if (assetRes.status === 404 || assetRes.status === 401) {
                console.log(`[MuleViz] Exchange API fallback returned status ${assetRes.status} for ${key}`);
                return [];
            }
            if (assetRes.status !== 200) {
                console.warn(`[MuleViz] Exchange API fallback unexpected status ${assetRes.status} for ${key}`);
                return [];
            }
            let assetData;
            try {
                assetData = JSON.parse(assetRes.body);
            }
            catch (e) {
                console.warn(`[MuleViz] Failed to parse Exchange fallback asset JSON:`, e);
                return [];
            }
            let descriptorData = null;
            let foundDescriptor = false;
            if (assetData && Array.isArray(assetData.files)) {
                const fileEntry = assetData.files.find((f) => f && (f.classifier === "connector-descriptor" || f.packaging === "json"));
                if (fileEntry && fileEntry.externalLink) {
                    try {
                        console.log(`[MuleViz] Fetching fallback descriptor from: ${fileEntry.externalLink}`);
                        const descRes = await httpGet(fileEntry.externalLink);
                        if (descRes.status === 200) {
                            descriptorData = JSON.parse(descRes.body);
                            foundDescriptor = true;
                        }
                    }
                    catch (e) {
                        console.warn(`[MuleViz] Failed to fetch externalLink fallback descriptor:`, e);
                    }
                }
            }
            let ops = [];
            if (foundDescriptor && descriptorData) {
                ops = parseDescriptor(descriptorData);
            }
            if (ops.length === 0) {
                ops = parseDescriptor(assetData);
            }
            console.log(`[MuleViz] Successfully parsed ${ops.length} operations from Exchange fallback for ${key}`);
            return ops;
        }
        catch (err) {
            console.error(`[MuleViz] fetchSchemaFromExchange fallback error for ${key}:`, err);
            return [];
        }
    })();
    exchangeCache.set(key, promise);
    promise.then(async (res) => {
        exchangeCache.set(key, res);
        if (storageUri && schemaFile && res && res.length > 0) {
            try {
                await fsp.mkdir(storageUri.fsPath, { recursive: true });
                await fsp.writeFile(schemaFile, JSON.stringify(res, null, 2), "utf8");
                console.log(`[MuleViz] Wrote schema to disk cache: ${schemaFile}`);
            }
            catch (err) {
                console.warn(`[MuleViz] Failed to write disk cache for ${key}:`, err);
            }
        }
    }, () => exchangeCache.delete(key));
    return promise;
}
async function getConnectorOperations(prefix, namespaces, pomDeps, storageUri, pomRepoUrls = []) {
    lastPomRepoUrls = pomRepoUrls;
    const nsUri = namespaces.get(prefix) ?? "";
    const dep = matchDepToPrefix(prefix, nsUri, pomDeps);
    if (!dep) {
        console.log(`[MuleViz] getConnectorOperations: no dep matched for prefix="${prefix}"`);
        return [];
    }
    // Safety check: warn if the match looks suspicious
    const depParts = dep.artifactId.toLowerCase().split('-');
    const uriLastSeg = nsUri.split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
    if (!depParts.includes(prefix.toLowerCase()) && uriLastSeg !== prefix.toLowerCase()) {
        console.warn(`[MuleViz] WARNING: dep "${dep.artifactId}" matched for prefix "${prefix}" looks suspicious. URI="${nsUri}"`);
        return [];
    }
    console.log(`[MuleViz] getConnectorOperations: prefix="${prefix}" → dep="${dep.artifactId}:${dep.version}"`);
    return fetchSchemaFromExchange(dep, storageUri);
}
function findOperation(ops, tagName) {
    const localName = tagName.includes(':')
        ? tagName.split(':')[1].toLowerCase()
        : tagName.toLowerCase();
    console.log(`[MuleViz] findOperation: looking for "${localName}" in [${ops.map(o => o.name).join(', ')}]`);
    // 1. Exact match
    const exact = ops.find(o => o.name === localName);
    if (exact)
        return exact;
    // 2. Case-insensitive exact
    const ci = ops.find(o => o.name.toLowerCase() === localName);
    if (ci)
        return ci;
    // 3. localName starts with op name (e.g. "listener-connection" matches "listener")
    const startsWith = ops.find(o => localName.startsWith(o.name.toLowerCase()));
    if (startsWith)
        return startsWith;
    // 4. op name starts with localName
    const opStartsWith = ops.find(o => o.name.toLowerCase().startsWith(localName));
    if (opStartsWith)
        return opStartsWith;
    return undefined;
}
//# sourceMappingURL=connectorRegistry.js.map