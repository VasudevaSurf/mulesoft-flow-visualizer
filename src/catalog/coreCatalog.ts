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
import { ParameterGroupModel, ParameterModel } from "./extensionModelReader";

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
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "name",
            label: "Flow Name",
            description: "The name used to identify this flow construct.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "initialState",
            label: "Initial State",
            description: "The initial state of the flow. Usually a flow is started automatically (started), but this attribute can be used to disable initial startup (stopped).",
            dataType: "enum",
            required: false,
            defaultValue: "started",
            allowedValues: ["started", "stopped"],
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "maxConcurrency",
            label: "Max Concurrency",
            description: "The maximum concurrency. This value determines the maximum level of parallelism that the Flow can use to optimize its performance when processing messages.",
            dataType: "number",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:description",
            label: "Description",
            description: "Human-readable description for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "sub-flow": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "sub-flow",
    kind: "sub-flow",
    displayName: "Sub-Flow",
    iconId: "core:sub-flow",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "name",
            label: "Sub-Flow Name",
            description: "Identifies the sub-flow in the registry.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:description",
            label: "Description",
            description: "Human-readable description for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "error-handler": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "error-handler",
    kind: "error-handler",
    displayName: "Error Handler",
    iconId: "core:error-handler",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "name",
            label: "Name",
            description: "Name of the error handler that will be used in ref attribute of other error-handler elements.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "ref",
            label: "Reference",
            description: "The name of the error handler to reuse.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },

  // ── Error Handling Cases ───────────────────────────────────────────────────
  "on-error-propagate": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "on-error-propagate",
    kind: "error-handler-case",
    displayName: "On Error Propagate",
    iconId: "core:on-error-propagate",
    subtitleAttribute: "type",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "type",
            label: "Type",
            description: "The full name of the error type to match against or a comma separated list of full names.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "when",
            label: "Condition Expression",
            description: "A boolean expression that determines if this error handler should be executed.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED",
            defaultExpressionMode: true
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      },
      {
        name: "Advanced",
        parameters: [
          {
            name: "enableNotifications",
            label: "Enable Notifications",
            description: "Whether to publish notifications for errors caught by this handler.",
            dataType: "boolean",
            required: false,
            defaultValue: true,
            group: "Advanced",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "logException",
            label: "Log Exception",
            description: "Whether to log the exception when an error occurs.",
            dataType: "boolean",
            required: false,
            defaultValue: true,
            group: "Advanced",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "on-error-continue": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "on-error-continue",
    kind: "error-handler-case",
    displayName: "On Error Continue",
    iconId: "core:on-error-continue",
    subtitleAttribute: "type",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "type",
            label: "Type",
            description: "The full name of the error type to match against or a comma separated list of full names.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "when",
            label: "Condition Expression",
            description: "A boolean expression that determines if this error handler should be executed.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED",
            defaultExpressionMode: true
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      },
      {
        name: "Advanced",
        parameters: [
          {
            name: "enableNotifications",
            label: "Enable Notifications",
            description: "Whether to publish notifications for errors caught by this handler.",
            dataType: "boolean",
            required: false,
            defaultValue: true,
            group: "Advanced",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "logException",
            label: "Log Exception",
            description: "Whether to log the exception when an error occurs.",
            dataType: "boolean",
            required: false,
            defaultValue: true,
            group: "Advanced",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },

  // ── Scopes ─────────────────────────────────────────────────────────────────
  "try": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "try",
    kind: "scope",
    displayName: "Try",
    iconId: "core:try",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "transactionalAction",
            label: "Transactional Action",
            description: "The type of action to take regarding transactions (INDIFFERENT, ALWAYS_BEGIN, BEGIN_OR_JOIN).",
            dataType: "enum",
            required: false,
            defaultValue: "INDIFFERENT",
            allowedValues: ["INDIFFERENT", "ALWAYS_BEGIN", "BEGIN_OR_JOIN"],
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "transactionType",
            label: "Transaction Type",
            description: "The type of transaction (LOCAL or XA).",
            dataType: "enum",
            required: false,
            defaultValue: "LOCAL",
            allowedValues: ["LOCAL", "XA"],
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:description",
            label: "Description",
            description: "Human-readable description for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "foreach": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "foreach",
    kind: "scope",
    displayName: "For Each",
    iconId: "core:foreach",
    subtitleAttribute: "collection",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "collection",
            label: "Collection",
            description: "Expression that defines the collection to iterate over.",
            dataType: "string",
            required: false,
            defaultValue: "#[payload]",
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED",
            defaultExpressionMode: true
          },
          {
            name: "batchSize",
            label: "Batch Size",
            description: "Partitions the collection in sub-collections of the specified size.",
            dataType: "number",
            required: false,
            defaultValue: 1,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      },
      {
        name: "Advanced",
        parameters: [
          {
            name: "rootMessageVariableName",
            label: "Root Message Variable Name",
            description: "Variable name for the original message.",
            dataType: "string",
            required: false,
            defaultValue: "rootMessage",
            group: "Advanced",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "counterVariableName",
            label: "Counter Variable Name",
            description: "Variable name for the item number being processed.",
            dataType: "string",
            required: false,
            defaultValue: "counter",
            group: "Advanced",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "parallel-foreach": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "parallel-foreach",
    kind: "scope",
    displayName: "Parallel For Each",
    iconId: "core:parallel-foreach",
    subtitleAttribute: "collection",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "collection",
            label: "Collection",
            description: "Expression that defines the collection of parts to be processed in parallel.",
            dataType: "string",
            required: false,
            defaultValue: "#[payload]",
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED",
            defaultExpressionMode: true
          },
          {
            name: "timeout",
            label: "Timeout (ms)",
            description: "Sets a timeout in milliseconds for each route. The default behaviour is no timeout.",
            dataType: "number",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "maxConcurrency",
            label: "Max Concurrency",
            description: "The maximum level of parallelism that will be used by this router.",
            dataType: "number",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      },
      {
        name: "Advanced",
        parameters: [
          {
            name: "target",
            label: "Target Variable",
            description: "Variable where to save processed payload.",
            dataType: "string",
            required: false,
            group: "Advanced",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "targetValue",
            label: "Target Value",
            description: "An expression that will be evaluated against the operation's output and stored in the target variable.",
            dataType: "string",
            required: false,
            defaultValue: "#[payload]",
            group: "Advanced",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED"
          }
        ]
      }
    ]
  },
  "until-successful": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "until-successful",
    kind: "scope",
    displayName: "Until Successful",
    iconId: "core:until-successful",
    subtitleAttribute: "maxRetries",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "maxRetries",
            label: "Max Retries",
            description: "Specifies the maximum number of processing retries that will be performed. Embedded expressions can be used.",
            dataType: "number",
            required: false,
            defaultValue: 5,
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED"
          },
          {
            name: "millisBetweenRetries",
            label: "Millis Between Retries",
            description: "Specifies the minimum time interval between two process retries in milliseconds. Embedded expressions can be used.",
            dataType: "number",
            required: false,
            defaultValue: 60000,
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "async": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "async",
    kind: "scope",
    displayName: "Async",
    iconId: "core:async",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "name",
            label: "Async Name",
            description: "Name that will be used to identify the async scheduling tasks.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "maxConcurrency",
            label: "Max Concurrency",
            description: "The maximum concurrency. This value determines the maximum level of parallelism that this async router can use.",
            dataType: "number",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "cache": {
    namespaceUri: MULE_EE_NAMESPACE,
    localName: "cache",
    kind: "scope",
    displayName: "Cache",
    iconId: "core:cache",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "cachingStrategy-ref",
            label: "Caching Strategy Reference",
            description: "Reference to the caching strategy object.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: true,
            referenceType: "configuration",
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "filterExpression",
            label: "Filter Expression",
            description: "The expression used to filter which messages should be processed using the caching strategy.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "batch:job": {
    namespaceUri: MULE_BATCH_NAMESPACE,
    localName: "job",
    kind: "scope",
    displayName: "Batch Job",
    iconId: "core:batch-job",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "jobName",
            label: "Job Name",
            description: "The unique name of the batch job.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "maxFailedRecords",
            label: "Max Failed Records",
            description: "Maximum number of failed records allowed before terminating the job.",
            dataType: "number",
            required: false,
            defaultValue: 0,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "blockSize",
            label: "Block Size",
            description: "Size of the block of records queued and scheduled together.",
            dataType: "number",
            required: false,
            defaultValue: 100,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "maxConcurrency",
            label: "Max Concurrency",
            description: "The maximum level of parallelism that the Job can use when processing blocks.",
            dataType: "number",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "schedulingStrategy",
            label: "Scheduling Strategy",
            description: "Strategy for scheduling across batch job instances.",
            dataType: "enum",
            required: false,
            defaultValue: "ORDERED_SEQUENTIAL",
            allowedValues: ["ORDERED_SEQUENTIAL", "ROUND_ROBIN"],
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      },
      {
        name: "Advanced",
        parameters: [
          {
            name: "jobInstanceId",
            label: "Job Instance ID",
            description: "An optional expression which allows giving each spawned JobInstance a friendly name.",
            dataType: "string",
            required: false,
            group: "Advanced",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED"
          },
          {
            name: "target",
            label: "Target Variable",
            description: "The name of a variable on which the operation's output will be placed.",
            dataType: "string",
            required: false,
            group: "Advanced",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "targetValue",
            label: "Target Value",
            description: "An expression that will be evaluated against the operation's output and stored in the target variable.",
            dataType: "string",
            required: false,
            defaultValue: "#[payload]",
            group: "Advanced",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED"
          }
        ]
      }
    ]
  },
  "batch:step": {
    namespaceUri: MULE_BATCH_NAMESPACE,
    localName: "step",
    kind: "scope",
    displayName: "Batch Step",
    iconId: "core:batch-step",
    subtitleAttribute: "acceptExpression",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "name",
            label: "Step Name",
            description: "The name of the batch step.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "acceptPolicy",
            label: "Accept Policy",
            description: "Criteria for accepting records to process in this step.",
            dataType: "enum",
            required: false,
            defaultValue: "NO_FAILURES",
            allowedValues: ["ALL", "ONLY_FAILURES", "NO_FAILURES"],
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "acceptExpression",
            label: "Accept Expression",
            description: "Expression to filter which records are processed by this step.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED",
            defaultExpressionMode: true
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "batch:process-records": {
    namespaceUri: MULE_BATCH_NAMESPACE,
    localName: "process-records",
    kind: "router",
    displayName: "Process Records",
    iconId: "core:batch-step",
    routeElementNames: ["step", "batch:step"],
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "batch:on-complete": {
    namespaceUri: MULE_BATCH_NAMESPACE,
    localName: "on-complete",
    kind: "scope",
    displayName: "On Complete",
    iconId: "core:batch-step",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "expression",
            label: "Expression",
            description: "Expression executed when the batch job finishes.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },

  // ── Routers ────────────────────────────────────────────────────────────────
  "choice": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "choice",
    kind: "router",
    displayName: "Choice",
    iconId: "core:choice",
    routeElementNames: ["when", "otherwise"],
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:description",
            label: "Description",
            description: "Human-readable description for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "scatter-gather": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "scatter-gather",
    kind: "router",
    displayName: "Scatter-Gather",
    iconId: "core:scatter-gather",
    routeElementNames: ["route"],
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "timeout",
            label: "Timeout (ms)",
            description: "Sets a timeout in milliseconds for each route. The default behaviour is that of no timeout.",
            dataType: "number",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "maxConcurrency",
            label: "Max Concurrency",
            description: "The maximum level of parallelism that will be used by this router.",
            dataType: "number",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      },
      {
        name: "Advanced",
        parameters: [
          {
            name: "target",
            label: "Target Variable",
            description: "Variable where to save processed payload.",
            dataType: "string",
            required: false,
            group: "Advanced",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "targetValue",
            label: "Target Value",
            description: "An expression that will be evaluated against the operation's output and stored in the target variable.",
            dataType: "string",
            required: false,
            defaultValue: "#[payload]",
            group: "Advanced",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED"
          }
        ]
      }
    ]
  },
  "round-robin": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "round-robin",
    kind: "router",
    displayName: "Round Robin",
    iconId: "core:round-robin",
    routeElementNames: ["route"],
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "first-successful": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "first-successful",
    kind: "router",
    displayName: "First Successful",
    iconId: "core:first-successful",
    routeElementNames: ["route"],
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },

  // ── Route Wrappers ─────────────────────────────────────────────────────────
  "when": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "when",
    kind: "route",
    displayName: "When",
    iconId: "core:choice",
    subtitleAttribute: "expression",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "expression",
            label: "Expression",
            description: "The expression condition to evaluate.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "REQUIRED",
            defaultExpressionMode: true
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "otherwise": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "otherwise",
    kind: "route",
    displayName: "Otherwise",
    iconId: "core:choice",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "route": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "route",
    kind: "route",
    displayName: "Route",
    iconId: "core:scatter-gather",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "name",
            label: "Route Name",
            description: "Identifies the route in the registry.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },

  // ── Common Core Operations (Leaves) ────────────────────────────────────────
  "logger": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "logger",
    kind: "operation",
    displayName: "Logger",
    iconId: "core:logger",
    subtitleAttribute: "message",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "message",
            label: "Message",
            description: "Message that will be logged. Embedded expressions can be used to extract value from the current message. If no message is specified then the current message is used.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED",
            defaultExpressionMode: false
          },
          {
            name: "level",
            label: "Level",
            description: "The logging level to be used. Default is INFO.",
            dataType: "enum",
            required: false,
            defaultValue: "INFO",
            allowedValues: ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"],
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "category",
            label: "Category",
            description: "Sets the logger category.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:description",
            label: "Description",
            description: "Human-readable description for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "set-payload": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "set-payload",
    kind: "operation",
    displayName: "Set Payload",
    iconId: "core:set-payload",
    subtitleAttribute: "value",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "value",
            label: "Value",
            description: "The value to be set on the payload. Supports expressions.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED",
            defaultExpressionMode: true
          },
          {
            name: "encoding",
            label: "Encoding",
            description: "The encoding of the value assigned to the payload.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "mimeType",
            label: "MIME Type",
            description: "The mime type of the value assigned to the payload.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "set-variable": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "set-variable",
    kind: "operation",
    displayName: "Set Variable",
    iconId: "core:set-variable",
    subtitleAttribute: "variableName",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "variableName",
            label: "Variable Name",
            description: "The name of the variable to set.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "value",
            label: "Value",
            description: "The value or expression to assign to the variable.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED",
            defaultExpressionMode: true
          },
          {
            name: "encoding",
            label: "Encoding",
            description: "The encoding of the value assigned to the property.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "mimeType",
            label: "MIME Type",
            description: "The mime type of the value assigned to the variable.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "remove-variable": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "remove-variable",
    kind: "operation",
    displayName: "Remove Variable",
    iconId: "core:remove-variable",
    subtitleAttribute: "variableName",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "variableName",
            label: "Variable Name",
            description: "A processor that removes variables by name or a wildcard expression.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "raise-error": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "raise-error",
    kind: "operation",
    displayName: "Raise Error",
    iconId: "core:raise-error",
    subtitleAttribute: "type",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "type",
            label: "Type",
            description: "The error type to raise.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "description",
            label: "Description",
            description: "The description of this error.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "flow-ref": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "flow-ref",
    kind: "operation",
    displayName: "Flow Reference",
    iconId: "core:flow-ref",
    subtitleAttribute: "name",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "name",
            label: "Flow Name",
            description: "Allows a 'flow' to be referenced such that the message processing will continue in the referenced flow before returning.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      },
      {
        name: "Advanced",
        parameters: [
          {
            name: "target",
            label: "Target Variable",
            description: "Variable where to save processed payload.",
            dataType: "string",
            required: false,
            group: "Advanced",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "targetValue",
            label: "Target Value",
            description: "An expression that will be evaluated against the operation's output and the outcome of that expression will be stored in the target variable.",
            dataType: "string",
            required: false,
            defaultValue: "#[payload]",
            group: "Advanced",
            supportsExpression: true,
            isReference: false,
            expressionSupport: "SUPPORTED"
          }
        ]
      }
    ]
  },
  "transform": {
    namespaceUri: MULE_EE_NAMESPACE,
    localName: "transform",
    kind: "operation",
    displayName: "Transform Message",
    iconId: "core:transform",
    subtitleAttribute: "doc:name",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:description",
            label: "Description",
            description: "Human-readable description for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "scheduler": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "scheduler",
    kind: "source",
    displayName: "Scheduler",
    iconId: "core:scheduler",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "disallowConcurrentExecution",
            label: "Disallow Concurrent Execution",
            description: "If set to 'true', executions triggered while the flow is still running from a previous trigger will be ignored, effectively avoiding different triggers of the flow to run concurrently.",
            dataType: "boolean",
            required: false,
            defaultValue: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },

  // ── Global Configs (never shown on canvas) ──────────────────────────────────
  "configuration": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "configuration",
    kind: "global-config",
    displayName: "Global Configuration",
    iconId: "core:generic-config",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "name",
            label: "Configuration Name",
            description: "Name of the global configuration.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "defaultResponseTimeout",
            label: "Default Response Timeout",
            description: "The default response timeout.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "configuration-properties": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "configuration-properties",
    kind: "global-config",
    displayName: "Configuration Properties",
    iconId: "core:generic-config",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "file",
            label: "Properties File",
            description: "The location of the file with the configuration properties to use. It may be a location in the classpath or an absolute location.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "encoding",
            label: "File Encoding",
            description: "The encoding of the file with the configuration properties to use.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  },
  "global-property": {
    namespaceUri: MULE_CORE_NAMESPACE,
    localName: "global-property",
    kind: "global-config",
    displayName: "Global Property",
    iconId: "core:generic-config",
    groups: [
      {
        name: "General",
        parameters: [
          {
            name: "name",
            label: "Property Name",
            description: "The name of the property. This is used inside Spring placeholders.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "value",
            label: "Property Value",
            description: "The value of the property. This replaces each occurence of a Spring placeholder.",
            dataType: "string",
            required: true,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          },
          {
            name: "doc:name",
            label: "Display Name",
            description: "Display name for this component.",
            dataType: "string",
            required: false,
            group: "General",
            supportsExpression: false,
            isReference: false,
            expressionSupport: "NOT_SUPPORTED"
          }
        ]
      }
    ]
  }
};
