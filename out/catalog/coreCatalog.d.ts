/**
 * src/catalog/coreCatalog.ts
 *
 * Catalog for Mule runtime core components with real parameter definitions
 * extracted from official Mule runtime schemas:
 * - mule-core-common.xsd (Core runtime schemas)
 * - mule-ee.xsd (Enterprise Edition schemas: transform, cache)
 * - mule-batch.xsd (Batch processing schemas)
 */
import { ComponentDescriptor } from "../parser/types";
export declare const MULE_CORE_NAMESPACE = "http://www.mulesoft.org/schema/mule/core";
export declare const MULE_EE_NAMESPACE = "http://www.mulesoft.org/schema/mule/ee/core";
export declare const MULE_BATCH_NAMESPACE = "http://www.mulesoft.org/schema/mule/batch";
export declare const MULE_VALIDATION_NAMESPACE = "http://www.mulesoft.org/schema/mule/validation";
export declare const MULE_HTTP_NAMESPACE = "http://www.mulesoft.org/schema/mule/http";
export declare const CORE_CATALOG: Record<string, ComponentDescriptor>;
//# sourceMappingURL=coreCatalog.d.ts.map