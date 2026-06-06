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
/** Scan the raw Mule XML for xmlns declarations. */
export declare function extractNamespaces(xmlText: string): Map<string, string>;
/** Parse pom.xml and return mule-plugin dependencies + repository URLs. */
export declare function parsePomDependencies(pomText: string): PomParseResult;
export declare function matchDepToPrefix(prefix: string, namespaceUri: string, deps: ConnectorDep[]): ConnectorDep | undefined;
export declare function httpGet(url: string, headers?: Record<string, string>, redirectCount?: number): Promise<{
    status: number;
    body: string;
}>;
export declare function fetchSchemaFromExchange(dep: ConnectorDep, storageUri?: vscode.Uri): Promise<OperationDef[]>;
export declare function getConnectorOperations(prefix: string, namespaces: Map<string, string>, pomDeps: ConnectorDep[], storageUri: vscode.Uri, pomRepoUrls?: string[]): Promise<OperationDef[]>;
export declare function findOperation(ops: OperationDef[], tagName: string): OperationDef | undefined;
//# sourceMappingURL=connectorRegistry.d.ts.map