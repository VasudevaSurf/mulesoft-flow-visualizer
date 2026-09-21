/**
 * src/parser/nodeId.ts
 *
 * Generates stable IDs for Nodes:
 * - doc:id if present
 * - otherwise sha1(flowName + "/" + structuralPath)
 */

import * as crypto from "crypto";

export function generateNodeId(
  attributes: Record<string, string>,
  flowName: string,
  structuralPath: string
): string {
  const docId = attributes["doc:id"] || attributes["id"];
  if (docId && docId.trim()) {
    return docId.trim();
  }

  const raw = `${flowName}/${structuralPath}`;
  return crypto.createHash("sha1").update(raw).digest("hex").substring(0, 16);
}
