"use strict";
/**
 * connectorRegistry.ts
 *
 * Pipeline:
 *  1. Parse the workspace pom.xml → extract mule-plugin dependencies
 *  2. Match XML namespace prefixes to pom dependencies
 *  3. Download the connector's -mule-plugin.jar from Maven Central (cached)
 *  4. Unzip the JAR with JSZip and extract:
 *       a) META-INF/*.xsd  (primary – most complete parameter info)
 *       b) META-INF/mule-artifact/annotations.json  (fallback)
 *  5. Expose OperationDef[] for each connector so the webview can render
 *     a real properties panel.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractNamespaces = extractNamespaces;
exports.parsePomDependencies = parsePomDependencies;
exports.matchDepToPrefix = matchDepToPrefix;
exports.getOrDownloadJar = getOrDownloadJar;
exports.extractOperations = extractOperations;
exports.getConnectorOperations = getConnectorOperations;
exports.findOperation = findOperation;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const fsp = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const jszip_1 = __importDefault(require("jszip"));
const fast_xml_parser_1 = require("fast-xml-parser");
// ─── Module-level caches ──────────────────────────────────────────────────────
/** prefix → OperationDef[] (populated after JAR extraction) */
const opsByPrefix = new Map();
/** dep key → in-progress or resolved download path */
const dlPromises = new Map();
// ─── Namespace extraction ─────────────────────────────────────────────────────
/**
 * Scan the raw Mule XML for xmlns: declarations.
 * Returns prefix → full namespace URI.
 * e.g.  "http" → "http://www.mulesoft.org/schema/mule/http"
 */
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
    // ── Extract repositories ──
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
    // ── Extract dependencies ──
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
        // Resolve simple Maven property references like ${http.version}
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
/**
 * Try to link a namespace prefix + URI to one of the pom.xml deps.
 * Heuristic: namespace URI last-segment or prefix word appears in artifactId.
 */
function matchDepToPrefix(prefix, namespaceUri, deps) {
    if (!prefix)
        return undefined;
    // Segments from the namespace URI for matching
    const uriParts = namespaceUri.split(/[/.]/).filter(Boolean).map((s) => s.toLowerCase());
    const pfxLower = prefix.toLowerCase();
    for (const dep of deps) {
        const aid = dep.artifactId.toLowerCase();
        // Direct: prefix appears in artifactId  (e.g. "http" in "mule-http-connector")
        if (aid.includes(pfxLower))
            return dep;
        // URI-based: any uri segment in artifactId
        if (uriParts.some((seg) => seg.length > 2 && aid.includes(seg)))
            return dep;
    }
    return undefined;
}
// ─── Maven repository download ────────────────────────────────────────────────
/** Build the JAR URL for a given Maven repo base URL. */
function mavenJarUrl(repoBase, dep) {
    const g = dep.groupId.replace(/\./g, "/");
    const base = repoBase.endsWith("/") ? repoBase : repoBase + "/";
    return `${base}${g}/${dep.artifactId}/${dep.version}/${dep.artifactId}-${dep.version}-mule-plugin.jar`;
}
/** Well-known MuleSoft Maven repositories (tried as fallbacks). */
const MULESOFT_REPOS = [
    "https://repository.mulesoft.org/releases/",
    "https://repository.mulesoft.org/nexus/content/repositories/public/",
    "https://maven.anypoint.mulesoft.com/api/v3/maven/",
];
/** Download url → dest file, following redirects. Returns false on HTTP error. */
function downloadToFile(url, dest) {
    return new Promise((resolve) => {
        const attempt = (u, hops = 0) => {
            if (hops > 6) {
                resolve(false);
                return;
            }
            const mod = u.startsWith("https") ? https : http;
            mod.get(u, (res) => {
                if ([301, 302, 307, 308].includes(res.statusCode ?? 0)) {
                    res.resume();
                    attempt(res.headers.location ?? u, hops + 1);
                    return;
                }
                if ((res.statusCode ?? 0) !== 200) {
                    res.resume();
                    resolve(false);
                    return;
                }
                const ws = fs.createWriteStream(dest);
                res.pipe(ws);
                ws.on("finish", () => resolve(true));
                ws.on("error", () => resolve(false));
            }).on("error", () => resolve(false));
        };
        attempt(url);
    });
}
/** Return local JAR path (downloading + caching if needed).
 *  Tries Maven Central first, then pom.xml repos, then well-known MuleSoft repos. */
async function getOrDownloadJar(dep, storageUri, pomRepoUrls = []) {
    const key = `${dep.groupId}:${dep.artifactId}:${dep.version}`;
    if (dlPromises.has(key))
        return dlPromises.get(key);
    const doDownload = async () => {
        const dir = storageUri.fsPath;
        await fsp.mkdir(dir, { recursive: true });
        const jarName = `${dep.artifactId}-${dep.version}-mule-plugin.jar`;
        const jarPath = path.join(dir, jarName);
        if (fs.existsSync(jarPath))
            return jarPath; // already cached
        // Build ordered list of repo URLs to try:
        // 1. Maven Central  2. pom.xml repos  3. Well-known MuleSoft repos
        const allRepos = [
            "https://repo1.maven.org/maven2/",
            ...pomRepoUrls,
            ...MULESOFT_REPOS,
        ];
        // Deduplicate
        const seen = new Set();
        const uniqueRepos = allRepos.filter((r) => {
            const norm = r.replace(/\/+$/, "");
            if (seen.has(norm))
                return false;
            seen.add(norm);
            return true;
        });
        for (const repoUrl of uniqueRepos) {
            const url = mavenJarUrl(repoUrl, dep);
            const repoName = repoUrl.includes("mulesoft") || repoUrl.includes("anypoint")
                ? "MuleSoft repo" : repoUrl.includes("maven.org") ? "Maven Central" : repoUrl;
            const bar = vscode.window.setStatusBarMessage(`⬇ Downloading ${dep.artifactId} ${dep.version} from ${repoName}…`);
            console.log(`[MuleViz] Trying: ${url}`);
            const ok = await downloadToFile(url, jarPath);
            bar.dispose();
            if (ok) {
                vscode.window.setStatusBarMessage(`✓ ${dep.artifactId} cached from ${repoName}`, 4000);
                return jarPath;
            }
            // Clean up partial file before trying next repo
            if (fs.existsSync(jarPath)) {
                try {
                    fs.unlinkSync(jarPath);
                }
                catch { /* ignore */ }
            }
        }
        // All repos failed
        vscode.window.showWarningMessage(`[MuleViz] Could not download ${dep.artifactId} ${dep.version} from any repository. ` +
            `Tried ${uniqueRepos.length} repos.`);
        return null;
    };
    const p = doDownload();
    dlPromises.set(key, p);
    return p;
}
// ─── JAR extraction & parsing ─────────────────────────────────────────────────
/** Extract OperationDef[] from a cached JAR file for the given namespace prefix. */
async function extractOperations(jarPath, prefix) {
    const cacheKey = `${jarPath}§${prefix}`;
    if (opsByPrefix.has(cacheKey))
        return opsByPrefix.get(cacheKey);
    let data;
    try {
        data = await fsp.readFile(jarPath);
    }
    catch {
        return [];
    }
    const zip = await jszip_1.default.loadAsync(data);
    let ops = [];
    // ── Strategy A: XSD (most complete, contains allowed values + types) ──────
    ops = await extractFromXsd(zip, prefix);
    // ── Strategy B: annotations.json / extension-model.json ──────────────────
    if (ops.length === 0) {
        ops = await extractFromAnnotations(zip);
    }
    opsByPrefix.set(cacheKey, ops);
    return ops;
}
// ── Strategy A: XSD ──────────────────────────────────────────────────────────
async function extractFromXsd(zip, prefix) {
    // Collect XSD candidates — prefer files whose name contains the prefix
    const candidates = [];
    zip.forEach((rel) => {
        if (!rel.endsWith(".xsd"))
            return;
        if (rel.toLowerCase().includes(prefix.toLowerCase())) {
            candidates.unshift(rel); // priority
        }
        else if (rel.startsWith("META-INF/")) {
            candidates.push(rel);
        }
    });
    for (const rel of [...new Set(candidates)]) {
        const file = zip.file(rel);
        if (!file)
            continue;
        const content = await file.async("string");
        const ops = parseXsd(content);
        if (ops.length > 0)
            return ops;
    }
    return [];
}
const XSD_PARSER = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (n) => [
        "xs:element", "xs:attribute", "xs:complexType", "xs:enumeration",
        "xs:extension", "xs:restriction", "xs:sequence", "xs:choice",
        "element", "attribute", "complexType", "enumeration",
    ].includes(n),
});
function parseXsd(xsd) {
    let doc;
    try {
        doc = XSD_PARSER.parse(xsd);
    }
    catch {
        return [];
    }
    // Support xs:schema / xsd:schema / schema
    const schema = (doc["xs:schema"] || doc["xsd:schema"] || doc["schema"]) ?? {};
    // Index all named complexTypes
    const namedTypes = new Map();
    const rawCts = (schema["xs:complexType"] || schema["complexType"] || []);
    for (const ct of rawCts) {
        if (!ct || typeof ct !== "object")
            continue;
        const c = ct;
        const name = c["@_name"];
        if (name)
            namedTypes.set(name, gatherAttrs(c));
    }
    // Build operations from top-level xs:element declarations
    const ops = [];
    const rawEls = (schema["xs:element"] || schema["element"] || []);
    for (const el of rawEls) {
        if (!el || typeof el !== "object")
            continue;
        const e = el;
        const opName = e["@_name"]?.trim();
        if (!opName)
            continue;
        // Skip config/connection elements — not operations
        const lop = opName.toLowerCase();
        if (lop.includes("config") || lop.includes("connection") || lop.includes("pool"))
            continue;
        // Resolve params from inline complexType or $type reference
        let params = [];
        const inlineCt = e["xs:complexType"] || e["complexType"];
        if (inlineCt) {
            const ct = Array.isArray(inlineCt) ? inlineCt[0] : inlineCt;
            params = gatherAttrs(ct);
        }
        const typeRef = e["@_type"];
        if (!params.length && typeRef) {
            const local = typeRef.includes(":") ? typeRef.split(":")[1] : typeRef;
            params = namedTypes.get(local) ?? namedTypes.get(typeRef) ?? [];
        }
        // Skip empty elements (likely abstract base types)
        ops.push({ name: opName, parameters: params });
    }
    return ops;
}
/** Recursively collect xs:attribute from a complexType node */
function gatherAttrs(ct) {
    if (!ct)
        return [];
    const params = [];
    // Direct attributes
    const rawAttrs = (ct["xs:attribute"] || ct["attribute"] || []);
    for (const a of rawAttrs) {
        const param = parseXsdAttr(a);
        if (param)
            params.push(param);
    }
    // Attributes inside xs:complexContent / xs:extension (inheritance)
    for (const key of ["xs:complexContent", "xs:simpleContent", "complexContent", "simpleContent"]) {
        const cc = ct[key];
        if (!cc)
            continue;
        for (const extKey of ["xs:extension", "xs:restriction", "extension", "restriction"]) {
            const ext = cc[extKey];
            if (!ext)
                continue;
            const node = Array.isArray(ext) ? ext[0] : ext;
            if (node && typeof node === "object") {
                params.push(...gatherAttrs(node));
            }
        }
    }
    return params;
}
function parseXsdAttr(a) {
    const name = a["@_name"]?.trim();
    if (!name)
        return null;
    const rawType = a["@_type"] ?? "xs:string";
    const type = xsdTypeToFriendly(rawType);
    const use = a["@_use"] ?? "optional";
    const defaultValue = a["@_default"];
    // Collect allowed values from inline xs:simpleType > xs:restriction > xs:enumeration
    const allowedValues = [];
    const st = a["xs:simpleType"] || a["simpleType"];
    if (st) {
        const stNode = Array.isArray(st) ? st[0] : st;
        if (stNode && typeof stNode === "object") {
            const rest = stNode["xs:restriction"] ||
                stNode["restriction"];
            if (rest && typeof rest === "object") {
                const restNode = Array.isArray(rest) ? rest[0] : rest;
                const enums = restNode["xs:enumeration"] ||
                    restNode["enumeration"] || [];
                for (const en of enums) {
                    const val = en?.["@_value"];
                    if (val)
                        allowedValues.push(val);
                }
            }
        }
    }
    return {
        name,
        type,
        required: use === "required",
        defaultValue,
        allowedValues: allowedValues.length ? allowedValues : undefined,
    };
}
function xsdTypeToFriendly(t) {
    const local = t.includes(":") ? t.split(":")[1] : t;
    const map = {
        string: "String", token: "String", normalizedString: "String",
        integer: "Integer", int: "Integer", long: "Long", short: "Short",
        decimal: "Decimal", double: "Double", float: "Float",
        boolean: "Boolean",
        dateTime: "DateTime", date: "Date", time: "Time", duration: "Duration",
        anyURI: "URI", base64Binary: "Base64", hexBinary: "HexBinary",
        nonNegativeInteger: "Integer", positiveInteger: "Integer",
        NMTOKEN: "String",
    };
    return map[local] ?? local;
}
// ── Strategy B: annotations.json / extension-model.json ──────────────────────
async function extractFromAnnotations(zip) {
    const paths = [
        "META-INF/mule-artifact/annotations.json",
        "META-INF/mule-artifact/extension-model.json",
        "META-INF/annotations.json",
    ];
    for (const p of paths) {
        const f = zip.file(p);
        if (!f)
            continue;
        const text = await f.async("string");
        try {
            const json = JSON.parse(text);
            const ops = parseAnnotationsJson(json);
            if (ops.length)
                return ops;
        }
        catch {
            /* ignore malformed JSON */
        }
    }
    return [];
}
function parseAnnotationsJson(json) {
    if (!json || typeof json !== "object")
        return [];
    const j = json;
    // Handle { extensions: [...] } or root array
    const extList = j["extensions"] ??
        j["extension"] ??
        (Array.isArray(json) ? json : null) ??
        [];
    const ops = [];
    for (const ext of extList) {
        if (!ext || typeof ext !== "object")
            continue;
        const e = ext;
        const rawOps = (e["operations"] ?? e["operation"] ?? []);
        for (const o of rawOps) {
            if (!o || typeof o !== "object")
                continue;
            const op = o;
            const name = String(op["name"] ?? "").trim();
            if (!name)
                continue;
            const rawParams = (op["parameters"] ?? op["parameter"] ?? []);
            const params = [];
            for (const p of rawParams) {
                if (!p || typeof p !== "object")
                    continue;
                const pm = p;
                const pName = String(pm["name"] ?? "").trim();
                if (!pName)
                    continue;
                const typeVal = pm["type"];
                const type = typeof typeVal === "string" ? typeVal
                    : typeof typeVal === "object" && typeVal
                        ? String(typeVal["name"] ?? "String")
                        : "String";
                params.push({
                    name: pName,
                    type,
                    required: Boolean(pm["required"]),
                    defaultValue: pm["defaultValue"],
                    description: pm["description"],
                    expressionSupport: pm["expressionSupport"],
                });
            }
            ops.push({ name, description: op["description"], parameters: params });
        }
    }
    return ops;
}
// ─── High-level orchestration ─────────────────────────────────────────────────
/**
 * Full pipeline: given a namespace prefix and all context, return OperationDef[].
 * Downloads and caches the JAR the first time.
 */
async function getConnectorOperations(prefix, namespaces, pomDeps, storageUri, pomRepoUrls = []) {
    if (opsByPrefix.has(prefix))
        return opsByPrefix.get(prefix);
    const nsUri = namespaces.get(prefix) ?? "";
    const dep = matchDepToPrefix(prefix, nsUri, pomDeps);
    if (!dep)
        return [];
    const jarPath = await getOrDownloadJar(dep, storageUri, pomRepoUrls);
    if (!jarPath)
        return [];
    return extractOperations(jarPath, prefix);
}
/** Find the matching OperationDef for a clicked XML tag (e.g. "http:request"). */
function findOperation(ops, tagName) {
    // tagName is like "http:request" — the local-name is the operation name
    const localName = tagName.includes(":") ? tagName.split(":")[1] : tagName;
    // Try exact match first, then case-insensitive
    return (ops.find((o) => o.name === localName) ??
        ops.find((o) => o.name.toLowerCase() === localName.toLowerCase()));
}
//# sourceMappingURL=connectorRegistry.js.map