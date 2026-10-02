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
export declare const MULE_MUNIT_NAMESPACE = "http://www.mulesoft.org/schema/mule/munit";
export declare const MULE_MUNIT_TOOLS_NAMESPACE = "http://www.mulesoft.org/schema/mule/munit-tools";
export declare const MULE_COMPRESSION_NAMESPACE = "http://www.mulesoft.org/schema/mule/compression";
export declare const MULE_APIKIT_NAMESPACE = "http://www.mulesoft.org/schema/mule/mule-apikit";
export declare const MULE_JSON_NAMESPACE = "http://www.mulesoft.org/schema/mule/json";
export declare const MULE_XML_NAMESPACE = "http://www.mulesoft.org/schema/mule/xml-module";
export declare const MULE_SCRIPTING_NAMESPACE = "http://www.mulesoft.org/schema/mule/scripting";
export declare const MULE_JAVA_NAMESPACE = "http://www.mulesoft.org/schema/mule/java";
export declare const CORE_CATALOG: Record<string, ComponentDescriptor>;
//# sourceMappingURL=coreCatalog.d.ts.map