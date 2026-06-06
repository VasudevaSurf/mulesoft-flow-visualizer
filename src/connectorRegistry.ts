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

import * as vscode from "vscode";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { XMLParser } from "fast-xml-parser";
import JSZip = require("jszip");

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface ParameterDef {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
  allowedValues?: string[];
  expressionSupport?: string;
}

export interface OperationDef {
  name: string;
  description?: string;
  parameters: ParameterDef[];
}

export interface ConnectorDep {
  groupId: string;
  artifactId: string;
  version: string;
}

export interface PomParseResult {
  deps: ConnectorDep[];
  repoUrls: string[];
}

// ─── Module-level caches & state ──────────────────────────────────────────────

/** Memory cache: "groupId:artifactId:version" -> OperationDef[] or Promise of it */
const exchangeCache = new Map<string, Promise<OperationDef[]> | OperationDef[]>();

const CACHE_VERSION = 3; // increment this to bust all disk caches

/** Stores pom.xml repositories across sessions */
let lastPomRepoUrls: string[] = [];

// ─── Namespace extraction ─────────────────────────────────────────────────────

/** Scan the raw Mule XML for xmlns declarations. */
export function extractNamespaces(xmlText: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /xmlns(?::([a-zA-Z][\w-]*))?="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xmlText)) !== null) {
    const prefix = m[1] ?? "";
    map.set(prefix, m[2]);
  }
  return map;
}

// ─── pom.xml parsing ──────────────────────────────────────────────────────────

/** Parse pom.xml and return mule-plugin dependencies + repository URLs. */
export function parsePomDependencies(pomText: string): PomParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (n) => ["dependency", "repository"].includes(n),
  });

  let pom: Record<string, unknown>;
  try {
    pom = parser.parse(pomText) as Record<string, unknown>;
  } catch {
    return { deps: [], repoUrls: [] };
  }

  const project = pom["project"] as Record<string, unknown> | undefined;
  if (!project) return { deps: [], repoUrls: [] };

  // Extract repositories
  const repoUrls: string[] = [];
  const reposNode = project["repositories"] as Record<string, unknown> | undefined;
  const rawRepos = (reposNode?.["repository"] as unknown[]) ?? [];
  for (const r of rawRepos) {
    if (!r || typeof r !== "object") continue;
    const url = String((r as Record<string, unknown>)["url"] ?? "").trim();
    if (url) repoUrls.push(url.endsWith("/") ? url : url + "/");
  }

  // Extract dependencies
  const depsNode = project["dependencies"] as Record<string, unknown> | undefined;
  const rawDeps = (depsNode?.["dependency"] as unknown[]) ?? [];

  const deps: ConnectorDep[] = [];
  for (const d of rawDeps) {
    if (!d || typeof d !== "object") continue;
    const dep = d as Record<string, unknown>;
    if (dep["classifier"] !== "mule-plugin") continue;

    const groupId = String(dep["groupId"] ?? "").trim();
    const artifactId = String(dep["artifactId"] ?? "").trim();
    let version = String(dep["version"] ?? "").trim();

    // Resolve simple Maven properties
    if (version.startsWith("${")) {
      const propName = version.slice(2, -1);
      const props = (project["properties"] as Record<string, unknown>) ?? {};
      version = String(props[propName] ?? version).trim();
    }

    if (groupId && artifactId && version) {
      deps.push({ groupId, artifactId, version });
    }
  }
  return { deps, repoUrls };
}

// ─── Namespace → dependency matching ─────────────────────────────────────────

export function matchDepToPrefix(
  prefix: string,
  namespaceUri: string,
  deps: ConnectorDep[]
): ConnectorDep | undefined {
  if (!prefix) return undefined;

  const pfxLower = prefix.toLowerCase();
  
  console.log(`[MuleViz] matchDepToPrefix: prefix="${prefix}" uri="${namespaceUri}"`);
  console.log(`[MuleViz] matchDepToPrefix: available deps = ${deps.map(d=>d.artifactId).join(', ')}`);

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

function ensureArray(val: any): any[] {
  if (val === undefined || val === null) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

function getXsdChild(node: any, localName: string): any {
  if (!node) return undefined;
  for (const key of Object.keys(node)) {
    const local = key.includes(":") ? key.split(":")[1] : key;
    if (local === localName) {
      return node[key];
    }
  }
  return undefined;
}

function shouldSkipElement(name: string): boolean {
  if (!name) return true;
  const lower = name.toLowerCase();
  return (
    lower.endsWith("-config") ||
    lower.endsWith("-connection") ||
    lower.endsWith("config") ||
    lower.endsWith("connection") ||
    lower.startsWith("abstract-")
  );
}

function findNamedComplexType(name: string, schema: any): any {
  const list = ensureArray(getXsdChild(schema, "complexType"));
  return list.find((ct: any) => ct && ct["@_name"] === name);
}

function findNamedSimpleType(name: string, schema: any): any {
  const list = ensureArray(getXsdChild(schema, "simpleType"));
  return list.find((st: any) => st && st["@_name"] === name);
}

function findNamedAttributeGroup(name: string, schema: any): any {
  const list = ensureArray(getXsdChild(schema, "attributeGroup"));
  return list.find((ag: any) => ag && ag["@_name"] === name);
}

function parseXsdAttribute(attr: any, schema: any): ParameterDef | null {
  if (!attr) return null;
  const name = attr["@_name"];
  if (!name) return null;

  const rawType = attr["@_type"] || "xs:string";
  const type = rawType.includes(":") ? rawType.split(":")[1] : rawType;
  const use = attr["@_use"] || "optional";
  const required = use === "required";
  const defaultValue = attr["@_default"];

  // Extract description
  let description: string | undefined;
  const annotation = getXsdChild(attr, "annotation");
  if (annotation) {
    const doc = getXsdChild(ensureArray(annotation)[0], "documentation");
    if (doc) {
      const docVal = ensureArray(doc)[0];
      description = typeof docVal === "string" ? docVal : docVal["#text"] || "";
    }
  }

  // Extract allowedValues (enums)
  let allowedValues: string[] | undefined;
  const inlineSimpleType = getXsdChild(attr, "simpleType");
  if (inlineSimpleType) {
    const st = ensureArray(inlineSimpleType)[0];
    const restriction = getXsdChild(st, "restriction");
    if (restriction) {
      const enums = getXsdChild(ensureArray(restriction)[0], "enumeration");
      if (enums) {
        allowedValues = ensureArray(enums)
          .map((en: any) => en && en["@_value"])
          .filter((v: any) => typeof v === "string");
      }
    }
  } else {
    const localType = rawType.includes(":") ? rawType.split(":")[1] : rawType;
    const st = findNamedSimpleType(localType, schema);
    if (st) {
      const restriction = getXsdChild(st, "restriction");
      if (restriction) {
        const enums = getXsdChild(ensureArray(restriction)[0], "enumeration");
        if (enums) {
          allowedValues = ensureArray(enums)
            .map((en: any) => en && en["@_value"])
            .filter((v: any) => typeof v === "string");
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

function gatherAttributesFromComplexType(ct: any, schema: any): ParameterDef[] {
  const params: ParameterDef[] = [];
  if (!ct) return params;

  // 1. Direct attributes
  const directAttrs = ensureArray(getXsdChild(ct, "attribute"));
  for (const attr of directAttrs) {
    const p = parseXsdAttribute(attr, schema);
    if (p) params.push(p);
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
          if (p) params.push(p);
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
          if (p) params.push(p);
        }
      }
    }
  }

  return params;
}

function parseXsd(content: string): OperationDef[] {
  const parser = new XMLParser({
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

  let parsed: any;
  try {
    parsed = parser.parse(content);
  } catch (err) {
    console.warn(`[MuleViz] Failed to parse XSD content:`, err);
    return [];
  }

  let schema: any = null;
  for (const key of Object.keys(parsed)) {
    const local = key.includes(":") ? key.split(":")[1] : key;
    if (local === "schema") {
      schema = parsed[key];
      break;
    }
  }
  if (!schema) return [];

  const elements = ensureArray(getXsdChild(schema, "element"));
  const ops: OperationDef[] = [];

  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const name = el["@_name"];
    if (!name || shouldSkipElement(name)) continue;

    let parameters: ParameterDef[] = [];

    const inlineComplexType = getXsdChild(el, "complexType");
    if (inlineComplexType) {
      parameters = gatherAttributesFromComplexType(ensureArray(inlineComplexType)[0], schema);
    } else {
      const typeRef = el["@_type"];
      if (typeRef) {
        const localTypeName = typeRef.includes(":") ? typeRef.split(":")[1] : typeRef;
        const ct = findNamedComplexType(localTypeName, schema);
        if (ct) {
          parameters = gatherAttributesFromComplexType(ct, schema);
        }
      }
    }

    let description: string | undefined;
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

function parseExtensionDescriptionsXml(content: string): OperationDef[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => {
      const local = name.includes(':') ? name.split(':')[1] : name;
      return ['config', 'operation', 'source', 'parameter'].includes(local);
    },
    cdataPropName: "__cdata",
    // Parse CDATA sections
  });

  let parsed: any;
  try {
    parsed = parser.parse(content);
  } catch(e) {
    console.warn('[MuleViz] Failed to parse extension-documentation XML:', e);
    return [];
  }

  function getLocalChild(node: any, localName: string): any {
    if (!node) return undefined;
    for (const key of Object.keys(node)) {
      const local = key.includes(':') ? key.split(':')[1] : key;
      if (local === localName) {
        return node[key];
      }
    }
    return undefined;
  }

  let root: any = null;
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

  const ops: OperationDef[] = [];

  // Helper to extract parameters from a node's <parameters> child
  function extractParams(node: any): ParameterDef[] {
    const params: ParameterDef[] = [];
    const parametersNode = getLocalChild(node, 'parameters');
    if (!parametersNode) return params;
    
    const rawParams = getLocalChild(parametersNode, 'parameter');
    const paramList = Array.isArray(rawParams) ? rawParams : rawParams ? [rawParams] : [];
    
    for (const p of paramList) {
      if (!p || !p['@_name']) continue;
      const descNode = getLocalChild(p, 'description');
      let description = '';
      if (typeof descNode === 'string') description = descNode;
      else if (descNode && descNode['__cdata']) description = descNode['__cdata'];
      else if (descNode && descNode['#text']) description = descNode['#text'];
      
      params.push({
        name: p['@_name'],
        type: 'String',       // descriptions XML has no type info
        required: false,       // descriptions XML has no required info
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
      if (!op || !op['@_name']) continue;
      const descNode = getLocalChild(op, 'description');
      let description = '';
      if (typeof descNode === 'string') description = descNode;
      else if (descNode?.['__cdata']) description = descNode['__cdata'];
      else if (descNode?.['#text']) description = descNode['#text'];
      
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
      if (!src || !src['@_name']) continue;
      const descNode = getLocalChild(src, 'description');
      let description = '';
      if (typeof descNode === 'string') description = descNode;
      else if (descNode?.['__cdata']) description = descNode['__cdata'];
      else if (descNode?.['#text']) description = descNode['#text'];

      ops.push({
        name: src['@_name'],
        description: description.trim() || undefined,
        parameters: extractParams(src),
      });
    }
  }

  console.log(`[MuleViz] parseExtensionDescriptionsXml: found ${ops.length} ops/sources`);
  ops.forEach(o => console.log(`  [MuleViz]   op="${o.name}" params=${o.parameters.map(p=>p.name).join(',')}`));
  return ops;
}

// ─── Network Downloader Helpers ───────────────────────────────────────────────

export function httpGet(
  url: string,
  headers: Record<string, string> = {},
  redirectCount = 0
): Promise<{ status: number; body: string }> {
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
      const chunks: Buffer[] = [];
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

function downloadJar(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const attempt = (currentUrl: string, hops = 0) => {
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
        const chunks: Buffer[] = [];
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

function parseDescriptor(descriptor: any): OperationDef[] {
  if (!descriptor) return [];

  let rawOps: any[] | undefined;
  let description: string | undefined;

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

  const ops: OperationDef[] = [];
  for (const op of rawOps) {
    if (!op || typeof op !== "object" || !op.name) continue;
    const parameters: ParameterDef[] = [];
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

export function fetchSchemaFromExchange(dep: ConnectorDep, storageUri?: vscode.Uri): Promise<OperationDef[]> {
  const key = `${dep.groupId}:${dep.artifactId}:${dep.version}`;
  const existing = exchangeCache.get(key);
  if (existing) {
    return Promise.resolve(existing);
  }

  const schemaFile = storageUri
    ? path.join(storageUri.fsPath, `v${CACHE_VERSION}_${dep.groupId}_${dep.artifactId}_${dep.version}_schema.json`)
    : "";

  const promise = (async (): Promise<OperationDef[]> => {
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
        } else {
          console.log(`[MuleViz] Cached schema on disk is older than 7 days, invalidating: ${schemaFile}`);
        }
      } catch (err) {
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

    const seenBases = new Set<string>();
    const uniqueBases: string[] = [];
    for (const b of bases) {
      if (!b) continue;
      const normalized = b.endsWith("/") ? b : b + "/";
      if (!seenBases.has(normalized)) {
        seenBases.add(normalized);
        uniqueBases.push(normalized);
      }
    }

    const candidateUrls: string[] = [];
    for (const base of uniqueBases) {
      candidateUrls.push(
        `${base}${gPath}/${dep.artifactId}/${dep.version}/${dep.artifactId}-${dep.version}-mule-plugin.jar`
      );
      candidateUrls.push(`${base}${gPath}/${dep.artifactId}/${dep.version}/${dep.artifactId}-${dep.version}.jar`);
    }

    let jarBuffer: Buffer | null = null;
    for (const url of candidateUrls) {
      try {
        console.log(`[MuleViz] Attempting download from: ${url}`);
        jarBuffer = await downloadJar(url);
        console.log(`[MuleViz] Downloaded JAR successfully from: ${url}`);
        break;
      } catch (e) {
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
        const artifactJsonPath = Object.keys(zip.files).find(f => 
          f.endsWith('mule-artifact.json') && !zip.files[f].dir
        );
        if (artifactJsonPath) {
          try {
            const artContent = await zip.files[artifactJsonPath].async("string");
            const artJson = JSON.parse(artContent);
            console.log(`[MuleViz] Found mule-artifact.json at ${artifactJsonPath}: name="${artJson.name}"`);
          } catch (e) {
            // ignore
          }
        }

        // Look for any JSON files that might contain operation definitions
        const extensionModelFiles = Object.keys(zip.files).filter(f =>
          (f.endsWith('.json') || f.endsWith('-extension-model.json')) && 
          !zip.files[f].dir
        );
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
          } catch(e) {
            // skip unparseable files
          }
        }

        const schemaFiles = Object.keys(zip.files).filter(f => 
          !zip.files[f].dir && (
            f.endsWith('.xsd') ||
            f.endsWith('-descriptions.xml') ||
            f.endsWith('-extension-descriptions.xml') ||
            f.endsWith('-extension-model.xml') ||
            (f.startsWith('META-INF/') && f.endsWith('.xml') && 
             !f.endsWith('mule-artifact.json') &&
             !f.includes('spring') &&
             !f.includes('maven') &&
             !f.includes('services') &&
             !f.includes('registry-bootstrap'))
          )
        );
        console.log(`[MuleViz] Found ${schemaFiles.length} schema candidate files in JAR:`, schemaFiles);

        // Preview logging
        for (const sf of schemaFiles) {
          try {
            const preview = await zip.files[sf].async('string');
            console.log(`[MuleViz] Schema file preview (first 500 chars) for ${sf}:`);
            console.log(preview.substring(0, 500));
          } catch(e) {}
        }

        const ops: OperationDef[] = [];
        for (const schemaFile of schemaFiles) {
          try {
            console.log(`[MuleViz] Parsing schema file: ${schemaFile}`);
            const content = await zip.files[schemaFile].async("string");
            let parsedOps: OperationDef[];
            
            if (schemaFile.endsWith('.xsd')) {
              parsedOps = parseXsd(content);
            } else {
              // Try extension descriptions XML format
              parsedOps = parseExtensionDescriptionsXml(content);
              // If that returns nothing, also try XSD parser as fallback
              if (parsedOps.length === 0) {
                parsedOps = parseXsd(content);
              }
            }
            
            console.log(`[MuleViz] Extracted ${parsedOps.length} operations from ${schemaFile}`);
            ops.push(...parsedOps);
          } catch (e) {
            console.warn(`[MuleViz] Error parsing schema ${schemaFile}:`, e);
          }
        }

        if (ops.length > 0) {
          console.log(`[MuleViz] Successfully retrieved ${ops.length} operations from Maven JAR parsing.`);
          return ops;
        }
      } catch (zipErr) {
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

      let assetData: any;
      try {
        assetData = JSON.parse(assetRes.body);
      } catch (e) {
        console.warn(`[MuleViz] Failed to parse Exchange fallback asset JSON:`, e);
        return [];
      }

      let descriptorData: any = null;
      let foundDescriptor = false;

      if (assetData && Array.isArray(assetData.files)) {
        const fileEntry = assetData.files.find(
          (f: any) => f && (f.classifier === "connector-descriptor" || f.packaging === "json")
        );
        if (fileEntry && fileEntry.externalLink) {
          try {
            console.log(`[MuleViz] Fetching fallback descriptor from: ${fileEntry.externalLink}`);
            const descRes = await httpGet(fileEntry.externalLink);
            if (descRes.status === 200) {
              descriptorData = JSON.parse(descRes.body);
              foundDescriptor = true;
            }
          } catch (e) {
            console.warn(`[MuleViz] Failed to fetch externalLink fallback descriptor:`, e);
          }
        }
      }

      let ops: OperationDef[] = [];
      if (foundDescriptor && descriptorData) {
        ops = parseDescriptor(descriptorData);
      }
      if (ops.length === 0) {
        ops = parseDescriptor(assetData);
      }

      console.log(`[MuleViz] Successfully parsed ${ops.length} operations from Exchange fallback for ${key}`);
      return ops;
    } catch (err) {
      console.error(`[MuleViz] fetchSchemaFromExchange fallback error for ${key}:`, err);
      return [];
    }
  })();

  exchangeCache.set(key, promise);

  promise.then(
    async (res) => {
      exchangeCache.set(key, res);
      if (storageUri && schemaFile && res && res.length > 0) {
        try {
          await fsp.mkdir(storageUri.fsPath, { recursive: true });
          await fsp.writeFile(schemaFile, JSON.stringify(res, null, 2), "utf8");
          console.log(`[MuleViz] Wrote schema to disk cache: ${schemaFile}`);
        } catch (err) {
          console.warn(`[MuleViz] Failed to write disk cache for ${key}:`, err);
        }
      }
    },
    () => exchangeCache.delete(key)
  );

  return promise;
}

export async function getConnectorOperations(
  prefix: string,
  namespaces: Map<string, string>,
  pomDeps: ConnectorDep[],
  storageUri: vscode.Uri,
  pomRepoUrls: string[] = []
): Promise<OperationDef[]> {
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

export function findOperation(
  ops: OperationDef[],
  tagName: string
): OperationDef | undefined {
  const localName = tagName.includes(':') 
    ? tagName.split(':')[1].toLowerCase() 
    : tagName.toLowerCase();
  
  console.log(`[MuleViz] findOperation: looking for "${localName}" in [${ops.map(o=>o.name).join(', ')}]`);
  
  // 1. Exact match
  const exact = ops.find(o => o.name === localName);
  if(exact) return exact;
  
  // 2. Case-insensitive exact
  const ci = ops.find(o => o.name.toLowerCase() === localName);
  if(ci) return ci;
  
  // 3. localName starts with op name (e.g. "listener-connection" matches "listener")
  const startsWith = ops.find(o => localName.startsWith(o.name.toLowerCase()));
  if(startsWith) return startsWith;
  
  // 4. op name starts with localName
  const opStartsWith = ops.find(o => o.name.toLowerCase().startsWith(localName));
  if(opStartsWith) return opStartsWith;
  
  return undefined;
}
