/**
 * connectorRegistry.ts
 *
 * Pipeline:
 *  1. Parse the workspace pom.xml → extract mule-plugin dependencies
 *  2. Match XML namespace prefixes to pom dependencies
 *  3. Fetch connector descriptor schema dynamically from Anypoint Exchange API
 *  4. Expose OperationDef[] for each connector so the webview can render
 *     a real properties panel.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { XMLParser } from "fast-xml-parser";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ParameterDef {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
  allowedValues?: string[];
  expressionSupport?: string; // SUPPORTED | NOT_SUPPORTED | REQUIRED
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

// ─── Module-level caches ──────────────────────────────────────────────────────

/** Exchange API result cache: groupId:artifactId:version -> Promise<OperationDef[]> or OperationDef[] */
const exchangeCache = new Map<string, Promise<OperationDef[]> | OperationDef[]>();


// ─── Namespace extraction ─────────────────────────────────────────────────────

/**
 * Scan the raw Mule XML for xmlns: declarations.
 * Returns prefix → full namespace URI.
 * e.g.  "http" → "http://www.mulesoft.org/schema/mule/http"
 */
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

  // ── Extract repositories ──
  const repoUrls: string[] = [];
  const reposNode = project["repositories"] as Record<string, unknown> | undefined;
  const rawRepos = (reposNode?.["repository"] as unknown[]) ?? [];
  for (const r of rawRepos) {
    if (!r || typeof r !== "object") continue;
    const url = String((r as Record<string, unknown>)["url"] ?? "").trim();
    if (url) repoUrls.push(url.endsWith("/") ? url : url + "/");
  }

  // ── Extract dependencies ──
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

    // Resolve simple Maven property references like ${http.version}
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

/**
 * Try to link a namespace prefix + URI to one of the pom.xml deps.
 * Heuristic: namespace URI last-segment or prefix word appears in artifactId.
 */
export function matchDepToPrefix(
  prefix: string,
  namespaceUri: string,
  deps: ConnectorDep[]
): ConnectorDep | undefined {
  if (!prefix) return undefined;

  // Segments from the namespace URI for matching
  const uriParts = namespaceUri.split(/[/.]/).filter(Boolean).map((s) => s.toLowerCase());
  const pfxLower = prefix.toLowerCase();

  for (const dep of deps) {
    const aid = dep.artifactId.toLowerCase();
    // Direct: prefix appears in artifactId  (e.g. "http" in "mule-http-connector")
    if (aid.includes(pfxLower)) return dep;
    // URI-based: any uri segment in artifactId
    if (uriParts.some((seg) => seg.length > 2 && aid.includes(seg))) return dep;
  }
  return undefined;
}

// ─── Anypoint Exchange API integration ───────────────────────────────────────

/** Helper to perform GET request, follow redirects, and handle timeouts. */
function httpGet(
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
    const req = client.get(url, { headers, timeout: 8000 }, (res) => {
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

/** Parse connector-descriptor JSON structure into OperationDef[] */
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

/** Fetch connector descriptor schema dynamically from Anypoint Exchange API */
export function fetchSchemaFromExchange(dep: ConnectorDep): Promise<OperationDef[]> {
  const key = `${dep.groupId}:${dep.artifactId}:${dep.version}`;
  const existing = exchangeCache.get(key);
  if (existing) {
    return Promise.resolve(existing);
  }

  const promise = (async () => {
    try {
      const assetUrl = `https://anypoint.mulesoft.com/exchange/api/v2/assets/${dep.groupId}/${dep.artifactId}/${dep.version}`;
      console.log(`[MuleViz] Fetching connector asset from: ${assetUrl}`);
      const assetRes = await httpGet(assetUrl, { Accept: "application/json" });

      if (assetRes.status === 404 || assetRes.status === 401) {
        console.log(`[MuleViz] Exchange API returned status ${assetRes.status} for ${key}`);
        return [];
      }

      if (assetRes.status !== 200) {
        console.warn(`[MuleViz] Exchange API unexpected status ${assetRes.status} for ${key}`);
        return [];
      }

      let assetData: any;
      try {
        assetData = JSON.parse(assetRes.body);
      } catch (e) {
        console.warn(`[MuleViz] Failed to parse Exchange asset JSON:`, e);
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
            console.log(`[MuleViz] Fetching descriptor from: ${fileEntry.externalLink}`);
            const descRes = await httpGet(fileEntry.externalLink);
            if (descRes.status === 200) {
              descriptorData = JSON.parse(descRes.body);
              foundDescriptor = true;
            }
          } catch (e) {
            console.warn(`[MuleViz] Failed to fetch externalLink descriptor:`, e);
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

      console.log(`[MuleViz] Successfully parsed ${ops.length} operations for ${key}`);
      return ops;
    } catch (err) {
      console.error(`[MuleViz] fetchSchemaFromExchange error for ${key}:`, err);
      return [];
    }
  })();

  exchangeCache.set(key, promise);

  promise.then(
    (res) => exchangeCache.set(key, res),
    () => exchangeCache.delete(key)
  );

  return promise;
}

/** Orchestrate getting connector operations (signature remains identical for extension.ts compatibility) */
export async function getConnectorOperations(
  prefix: string,
  namespaces: Map<string, string>,
  pomDeps: ConnectorDep[],
  storageUri: vscode.Uri,
  pomRepoUrls: string[] = []
): Promise<OperationDef[]> {
  const nsUri = namespaces.get(prefix) ?? "";
  const dep = matchDepToPrefix(prefix, nsUri, pomDeps);
  if (!dep) return [];

  return fetchSchemaFromExchange(dep);
}


/** Find the matching OperationDef for a clicked XML tag (e.g. "http:request"). */
export function findOperation(
  ops: OperationDef[],
  tagName: string
): OperationDef | undefined {
  // tagName is like "http:request" — the local-name is the operation name
  const localName = tagName.includes(":") ? tagName.split(":")[1] : tagName;
  // Try exact match first, then case-insensitive
  return (
    ops.find((o) => o.name === localName) ??
    ops.find((o) => o.name.toLowerCase() === localName.toLowerCase())
  );
}
