/**
 * src/catalog/coreCatalog.ts
 *
 * Hardcoded catalog for Mule runtime core components per Section 4.1 of the specification.
 * Core components are built into the Mule runtime, not in Maven plugin jars.
 */
import { ComponentDescriptor } from "../parser/types";
export declare const MULE_CORE_NAMESPACE = "http://www.mulesoft.org/schema/mule/core";
export declare const MULE_EE_NAMESPACE = "http://www.mulesoft.org/schema/mule/ee/core";
export declare const MULE_BATCH_NAMESPACE = "http://www.mulesoft.org/schema/mule/batch";
export declare const MULE_VALIDATION_NAMESPACE = "http://www.mulesoft.org/schema/mule/validation";
export declare const MULE_HTTP_NAMESPACE = "http://www.mulesoft.org/schema/mule/http";
export declare const CORE_CATALOG: Record<string, ComponentDescriptor>;
//# sourceMappingURL=coreCatalog.d.ts.map