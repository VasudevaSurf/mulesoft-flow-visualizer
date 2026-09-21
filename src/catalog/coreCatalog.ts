/**
 * src/catalog/coreCatalog.ts
 *
 * Hardcoded catalog for Mule runtime core components per Section 4.1 of the specification.
 * Core components are built into the Mule runtime, not in Maven plugin jars.
 */

import { ComponentDescriptor } from "../parser/types";

export const MULE_CORE_NAMESPACE = "http://www.mulesoft.org/schema/mule/core";
export const MULE_EE_NAMESPACE = "http://www.mulesoft.org/schema/mule/ee/core";
export const MULE_BATCH_NAMESPACE = "http://www.mulesoft.org/schema/mule/batch";
export const MULE_VALIDATION_NAMESPACE = "http://www.mulesoft.org/schema/mule/validation";
export const MULE_HTTP_NAMESPACE = "http://www.mulesoft.org/schema/mule/http";

export const CORE_CATALOG: Record<string, ComponentDescriptor> = {
  // ── Containers ───────────────────────────────────────────────────────────────
  "flow": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "flow",
    kind: "flow",
    displayName: "Flow",
    iconId: "core:flow",
  },
  "sub-flow": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "sub-flow",
    kind: "sub-flow",
    displayName: "Sub-Flow",
    iconId: "core:sub-flow",
  },
  "error-handler": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "error-handler",
    kind: "error-handler",
    displayName: "Error Handler",
    iconId: "core:error-handler",
  },

  // ── Error Handling Cases ───────────────────────────────────────────────────
  "on-error-propagate": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "on-error-propagate",
    kind: "error-handler-case",
    displayName: "On Error Propagate",
    iconId: "core:on-error-propagate",
    subtitleAttribute: "type",
  },
  "on-error-continue": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "on-error-continue",
    kind: "error-handler-case",
    displayName: "On Error Continue",
    iconId: "core:on-error-continue",
    subtitleAttribute: "type",
  },

  // ── Scopes ─────────────────────────────────────────────────────────────────
  "try": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "try",
    kind: "scope",
    displayName: "Try",
    iconId: "core:try",
  },
  "foreach": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "foreach",
    kind: "scope",
    displayName: "For Each",
    iconId: "core:foreach",
    subtitleAttribute: "collection",
  },
  "parallel-foreach": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "parallel-foreach",
    kind: "scope",
    displayName: "Parallel For Each",
    iconId: "core:parallel-foreach",
    subtitleAttribute: "collection",
  },
  "until-successful": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "until-successful",
    kind: "scope",
    displayName: "Until Successful",
    iconId: "core:until-successful",
    subtitleAttribute: "maxRetries",
  },
  "async": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "async",
    kind: "scope",
    displayName: "Async",
    iconId: "core:async",
  },
  "cache": {
    namespaceUri: MULE_EE_NAMESPACE,
    localName: "cache",
    kind: "scope",
    displayName: "Cache",
    iconId: "core:cache",
  },
  "batch:job": {
    namespaceUri: MULE_BATCH_NAMESPACE,
    localName: "job",
    kind: "scope",
    displayName: "Batch Job",
    iconId: "core:batch-job",
  },
  "batch:step": {
    namespaceUri: MULE_BATCH_NAMESPACE,
    localName: "step",
    kind: "scope",
    displayName: "Batch Step",
    iconId: "core:batch-step",
    subtitleAttribute: "acceptExpression",
  },
  "batch:process-records": {
    namespaceUri: MULE_BATCH_NAMESPACE,
    localName: "process-records",
    kind: "router",
    displayName: "Process Records",
    iconId: "core:batch-step",
    routeElementNames: ["step", "batch:step"],
  },
  "batch:on-complete": {
    namespaceUri: MULE_BATCH_NAMESPACE,
    localName: "on-complete",
    kind: "scope",
    displayName: "On Complete",
    iconId: "core:batch-step",
  },

  // ── Routers ────────────────────────────────────────────────────────────────
  "choice": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "choice",
    kind: "router",
    displayName: "Choice",
    iconId: "core:choice",
    routeElementNames: ["when", "otherwise"],
  },
  "scatter-gather": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "scatter-gather",
    kind: "router",
    displayName: "Scatter-Gather",
    iconId: "core:scatter-gather",
    routeElementNames: ["route"],
  },
  "round-robin": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "round-robin",
    kind: "router",
    displayName: "Round Robin",
    iconId: "core:round-robin",
    routeElementNames: ["route"],
  },
  "first-successful": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "first-successful",
    kind: "router",
    displayName: "First Successful",
    iconId: "core:first-successful",
    routeElementNames: ["route"],
  },

  // ── Route Wrappers ─────────────────────────────────────────────────────────
  "when": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "when",
    kind: "route",
    displayName: "When",
    iconId: "core:choice",
    subtitleAttribute: "expression",
  },
  "otherwise": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "otherwise",
    kind: "route",
    displayName: "Otherwise",
    iconId: "core:choice",
  },
  "route": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "route",
    kind: "route",
    displayName: "Route",
    iconId: "core:scatter-gather",
  },

  // ── Common Core Operations (Leaves) ────────────────────────────────────────
  "logger": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "logger",
    kind: "operation",
    displayName: "Logger",
    iconId: "core:logger",
    subtitleAttribute: "message",
  },
  "set-payload": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "set-payload",
    kind: "operation",
    displayName: "Set Payload",
    iconId: "core:set-payload",
    subtitleAttribute: "value",
  },
  "set-variable": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "set-variable",
    kind: "operation",
    displayName: "Set Variable",
    iconId: "core:set-variable",
    subtitleAttribute: "variableName",
  },
  "remove-variable": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "remove-variable",
    kind: "operation",
    displayName: "Remove Variable",
    iconId: "core:remove-variable",
    subtitleAttribute: "variableName",
  },
  "raise-error": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "raise-error",
    kind: "operation",
    displayName: "Raise Error",
    iconId: "core:raise-error",
    subtitleAttribute: "type",
  },
  "flow-ref": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "flow-ref",
    kind: "operation",
    displayName: "Flow Reference",
    iconId: "core:flow-ref",
    subtitleAttribute: "name",
  },
  "transform": {
    namespaceUri: MULE_EE_NAMESPACE,
    localName: "transform",
    kind: "operation",
    displayName: "Transform Message",
    iconId: "core:transform",
    subtitleAttribute: "doc:name",
  },
  "scheduler": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "scheduler",
    kind: "source",
    displayName: "Scheduler",
    iconId: "core:scheduler",
  },

  // ── Global Configs (never shown on canvas) ──────────────────────────────────
  "configuration": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "configuration",
    kind: "global-config",
    displayName: "Global Configuration",
    iconId: "core:generic-config",
  },
  "configuration-properties": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "configuration-properties",
    kind: "global-config",
    displayName: "Configuration Properties",
    iconId: "core:generic-config",
  },
  "global-property": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "global-property",
    kind: "global-config",
    displayName: "Global Property",
    iconId: "core:generic-config",
  },
};
