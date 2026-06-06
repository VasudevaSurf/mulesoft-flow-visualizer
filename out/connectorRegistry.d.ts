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
import * as vscode from "vscode";
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
/**
 * Scan the raw Mule XML for xmlns: declarations.
 * Returns prefix → full namespace URI.
 * e.g.  "http" → "http://www.mulesoft.org/schema/mule/http"
 */
export declare function extractNamespaces(xmlText: string): Map<string, string>;
/** Parse pom.xml and return mule-plugin dependencies + repository URLs. */
export declare function parsePomDependencies(pomText: string): PomParseResult;
/**
 * Try to link a namespace prefix + URI to one of the pom.xml deps.
 * Heuristic: namespace URI last-segment or prefix word appears in artifactId.
 */
export declare function matchDepToPrefix(prefix: string, namespaceUri: string, deps: ConnectorDep[]): ConnectorDep | undefined;
/** Return local JAR path (downloading + caching if needed).
 *  Tries Maven Central first, then pom.xml repos, then well-known MuleSoft repos. */
export declare function getOrDownloadJar(dep: ConnectorDep, storageUri: vscode.Uri, pomRepoUrls?: string[]): Promise<string | null>;
/** Extract OperationDef[] from a cached JAR file for the given namespace prefix. */
export declare function extractOperations(jarPath: string, prefix: string): Promise<OperationDef[]>;
/**
 * Full pipeline: given a namespace prefix and all context, return OperationDef[].
 * Downloads and caches the JAR the first time.
 */
export declare function getConnectorOperations(prefix: string, namespaces: Map<string, string>, pomDeps: ConnectorDep[], storageUri: vscode.Uri, pomRepoUrls?: string[]): Promise<OperationDef[]>;
/** Find the matching OperationDef for a clicked XML tag (e.g. "http:request"). */
export declare function findOperation(ops: OperationDef[], tagName: string): OperationDef | undefined;
//# sourceMappingURL=connectorRegistry.d.ts.map