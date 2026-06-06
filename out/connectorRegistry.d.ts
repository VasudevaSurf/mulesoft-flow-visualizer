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
/** Fetch connector descriptor schema dynamically from Anypoint Exchange API */
export declare function fetchSchemaFromExchange(dep: ConnectorDep): Promise<OperationDef[]>;
/** Orchestrate getting connector operations (signature remains identical for extension.ts compatibility) */
export declare function getConnectorOperations(prefix: string, namespaces: Map<string, string>, pomDeps: ConnectorDep[], storageUri: vscode.Uri, pomRepoUrls?: string[]): Promise<OperationDef[]>;
/** Find the matching OperationDef for a clicked XML tag (e.g. "http:request"). */
export declare function findOperation(ops: OperationDef[], tagName: string): OperationDef | undefined;
//# sourceMappingURL=connectorRegistry.d.ts.map