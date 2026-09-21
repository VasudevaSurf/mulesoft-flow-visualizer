/**
 * src/parser/nodeId.ts
 *
 * Generates stable IDs for Nodes:
 * - doc:id if present
 * - otherwise sha1(flowName + "/" + structuralPath)
 */
export declare function generateNodeId(attributes: Record<string, string>, flowName: string, structuralPath: string): string;
//# sourceMappingURL=nodeId.d.ts.map