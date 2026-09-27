import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { JarReader } from './jarReader';

/**
 * Standard Mule 4 parameter data types.
 */
export type ParameterDataType = 'string' | 'number' | 'boolean' | 'enum' | 'complex-object' | 'list';

/**
 * Refined parameter model capturing UI labels, typing, expressions, and configuration references.
 */
export interface ParameterModel {
  name: string;
  label: string;
  description: string;
  dataType: ParameterDataType;
  required: boolean;
  defaultValue?: any;
  group: string;
  supportsExpression: boolean;
  isReference: boolean;
  referenceType?: 'configuration' | 'connection-provider';
  allowedValues?: string[];
  use?: 'required' | 'optional' | string;
  configOptions?: string[];
  configModel?: ConfigurationModel;
  configXmlTag?: string;
  expressionSupport?: 'NOT_SUPPORTED' | 'SUPPORTED' | 'REQUIRED' | string;
  defaultExpressionMode?: boolean;
}

/**
 * A named tab + its parameter list.
 */
export interface ParameterGroupModel {
  name: string;
  parameters: ParameterModel[];
}

/**
 * Operation Model with id, display name, icon id, and list of parameter groups.
 */
export interface OperationModel {
  id: string;
  displayName: string;
  iconId?: string;
  groups: ParameterGroupModel[];
  // Convenience & backward-compatibility aliases
  name?: string;
  xmlTag?: string;
  parameters?: ParameterModel[];
}

/**
 * Message Source Model with id, display name, icon id, and list of parameter groups.
 */
export interface SourceModel {
  id: string;
  displayName: string;
  iconId?: string;
  groups: ParameterGroupModel[];
  // Convenience & backward-compatibility aliases
  name?: string;
  xmlTag?: string;
  parameters?: ParameterModel[];
}

/**
 * Connection Provider Model with id, display name, and own groups.
 */
export interface ConnectionProviderModel {
  id: string;
  displayName: string;
  groups: ParameterGroupModel[];
  // Convenience aliases
  name?: string;
  type?: string;
  parameters?: ParameterModel[];
}

/**
 * Configuration Model with id, display name, own groups, and link to its ConnectionProviderModel.
 */
export interface ConfigurationModel {
  id: string;
  displayName: string;
  groups: ParameterGroupModel[];
  connectionProvider?: ConnectionProviderModel;
  connectionProviders?: ConnectionProviderModel[];
  // Convenience & backward-compatibility aliases
  name?: string;
  description?: string;
  parameters?: ParameterModel[];
}

/**
 * Full Mule SDK Extension Model representation.
 */
export interface ExtensionModel {
  name: string;
  version?: string;
  namespaceUri?: string;
  prefix?: string;
  sourceType: 'json' | 'xsd' | 'descriptions-xml' | 'xml';
  sourceFile: string;
  configurations: ConfigurationModel[];
  operations: OperationModel[];
  sources: SourceModel[];
}

/**
 * Backward compatibility aliases for Phase 1 code.
 */
export type ExtensionModelParameter = ParameterModel;
export type ExtensionModelConfiguration = ConfigurationModel;
export type ExtensionModelOperation = OperationModel;
export type ExtensionModelSource = SourceModel;
export type ExtensionModelConnectionProvider = ConnectionProviderModel;

/**
 * Formats parameter/component names into human-readable display labels.
 */
export function toDisplayLabel(name: string): string {
  const specialMap: Record<string, string> = {
    'config-ref': 'Configuration',
    url: 'URL',
    uri: 'URI',
    uriParams: 'URI Parameters',
    queryParams: 'Query Parameters',
    tlsContext: 'TLS Context',
    outputMimeType: 'Output MIME Type',
    outputEncoding: 'Output Encoding',
    sendBodyMode: 'Send Body Mode',
    requestStreamingMode: 'Request Streaming Mode',
    responseTimeout: 'Response Timeout',
    streamingStrategy: 'Streaming Strategy',
    responseValidator: 'Response Validator',
    followRedirects: 'Follow Redirects',
    enableCookies: 'Enable Cookies',
    defaultHeaders: 'Default Headers',
    defaultQueryParams: 'Default Query Parameters',
    sendCorrelationId: 'Send Correlation ID',
    correlationId: 'Correlation ID',
    preserveHeadersCase: 'Preserve Headers Case',
    primaryNodeOnly: 'Primary Node Only',
    redeliveryPolicy: 'Redelivery Policy',
    reconnectionStrategy: 'Reconnection Strategy',
    frequency: 'Frequency (ms)',
    count: 'Reconnection Attempts',
    blocking: 'Blocking Reconnection',
    maxInMemorySize: 'Max In-Memory Size (KB)',
    bufferUnit: 'Buffer Unit',
    initialBufferSize: 'Initial Buffer Size',
    enabledProtocols: 'Enabled Protocols',
    insecure: 'Insecure (Trust All)',
    trustStorePath: 'Truststore Path',
    trustStorePassword: 'Truststore Password',
    keyStorePath: 'Keystore Path',
    keyStorePassword: 'Keystore Password',
    maxActive: 'Max Active Connections',
    maxIdle: 'Max Idle Connections',
    minIdle: 'Min Idle Connections',
    maxWait: 'Max Wait (ms)',
    exhaustedAction: 'Exhausted Action',
    initialisationPolicy: 'Initialization Policy',
    proxyConfig: 'Proxy Configuration',
    authentication: 'Authentication',
    statusCode: 'Status Code',
    reasonPhrase: 'Reason Phrase',
    allowedMethods: 'Allowed Methods',
    host: 'Host',
    port: 'Port',
    protocol: 'Protocol',
    basePath: 'Base Path',
    path: 'Path',
    method: 'Method',
    body: 'Body',
    headers: 'Headers',
    sql: 'SQL Query',
    inputParameters: 'Input Parameters',
    parameterTypes: 'Parameter Types',
    queryTimeout: 'Query Timeout',
    queryTimeoutUnit: 'Query Timeout Unit',
    fetchSize: 'Fetch Size',
    maxRows: 'Max Rows',
    transactionalAction: 'Transactional Action',
    target: 'Target Variable',
    targetValue: 'Target Value',
    listenerConfig: 'HTTP Listener Configuration',
    requestConfig: 'HTTP Request Configuration',
  };

  if (specialMap[name]) return specialMap[name];

  const cleanName = name.includes('.') ? name.split('.').pop()! : name;
  if (specialMap[cleanName]) return specialMap[cleanName];

  return cleanName
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLowerCase();
      if (lower === 'url') return 'URL';
      if (lower === 'uri') return 'URI';
      if (lower === 'id') return 'ID';
      if (lower === 'sql') return 'SQL';
      if (lower === 'tls') return 'TLS';
      if (lower === 'http') return 'HTTP';
      if (lower === 'mime') return 'MIME';
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

/**
 * Assigns parameters to their respective tabs/groups based on explicit tab metadata,
 * structural complex sections (TLS, Reconnection, Streaming, Pooling, Transactions, Error Mapping),
 * or categorizes low-level tuning into "Advanced" and regular parameters into "General".
 */
export function inferParameterGroup(name: string, description?: string, explicitGroup?: string): string {
  const lowerName = name.toLowerCase();
  const lowerDesc = (description || '').toLowerCase();

  // 1. Structural sections that are nested complex objects MUST be extracted as their OWN tabs,
  // even if the raw model placed them in General or Advanced!
  // (Requirement: "Structural sections that are nested complex objects (TLS, Reconnection, Pooling,
  // Streaming) are extracted as their OWN tabs with their own nested parameter forms, not flattened into Advanced.")

  // TLS Context
  if (
    lowerName === 'tlscontext' ||
    lowerName === 'tls-context' ||
    lowerName === 'tls' ||
    lowerName.startsWith('tlscontext.') ||
    lowerName.startsWith('tls.') ||
    lowerName.includes('keystore') ||
    lowerName.includes('truststore') ||
    lowerDesc.includes('tls context') ||
    lowerDesc.includes('tls configuration')
  ) {
    return 'TLS Context';
  }

  // Reconnection Strategy
  if (
    lowerName === 'reconnectionstrategy' ||
    lowerName === 'reconnection' ||
    lowerName.startsWith('reconnection.') ||
    lowerName.startsWith('reconnect.') ||
    lowerName.includes('reconnection') ||
    lowerDesc.includes('reconnection strategy') ||
    lowerDesc.includes('retry strategy in case of connectivity errors')
  ) {
    return 'Reconnection Strategy';
  }

  // Streaming Strategy
  if (
    lowerName === 'streamingstrategy' ||
    lowerName.startsWith('streaming.') ||
    lowerDesc.includes('streaming strategy') ||
    lowerDesc.includes('repeatable stream') ||
    lowerDesc.includes('repeatable streams')
  ) {
    return 'Streaming Strategy';
  }

  // Pooling Profile
  if (
    lowerName === 'poolingprofile' ||
    lowerName === 'pooling' ||
    lowerName === 'connectionpooling' ||
    lowerName.startsWith('poolingprofile.') ||
    lowerDesc.includes('pooling profile') ||
    lowerDesc.includes('connection pool')
  ) {
    return 'Pooling Profile';
  }

  // Transactional Action
  if (
    lowerName === 'transactionalaction' ||
    lowerName === 'transactionaction' ||
    lowerName === 'transactiontype' ||
    lowerDesc.includes('joining action that operations can take regarding transactions')
  ) {
    return 'Transactional Action';
  }

  // Response Validator / Error Mapping
  if (
    lowerName === 'responsevalidator' ||
    lowerName === 'errormapping' ||
    lowerDesc.includes('configures error handling of the response')
  ) {
    return 'Response Validator';
  }

  // Redelivery Policy
  if (lowerName.includes('redelivery')) {
    return 'Redelivery Policy';
  }

  // 2. Real tab/placement metadata found in the raw model is read correctly, not defaulted to General/Advanced
  if (explicitGroup && explicitGroup.trim().length > 0 && explicitGroup.trim() !== 'General') {
    const trimmed = explicitGroup.trim();
    if (trimmed.toUpperCase() === 'TLS' || trimmed.toUpperCase() === 'SECURITY') {
      return 'TLS Context';
    }
    return trimmed;
  }

  // 3. Low-level socket, timeouts, buffer sizes, concurrency limits, cluster execution -> Advanced
  if (
    lowerName.endsWith('timeout') ||
    lowerName.endsWith('timeoutunit') ||
    lowerName === 'fetchsize' ||
    lowerName === 'maxrows' ||
    lowerName === 'maxconnections' ||
    lowerName === 'responsebuffersize' ||
    lowerName === 'clientsocketproperties' ||
    lowerName === 'primarynodeonly' ||
    lowerName === 'deferredresponse' ||
    lowerName === 'connectivitytest' ||
    lowerName === 'usepersistentconnections' ||
    lowerName === 'connectionidletimeout' ||
    lowerName === 'readtimeout' ||
    lowerName.includes('expiration') ||
    lowerName.includes('validator')
  ) {
    return 'Advanced';
  }

  return 'General';
}

/**
 * Builds a refined ParameterModel from raw metadata.
 */
export function buildParameterModel(raw: {
  name: string;
  label?: string;
  description?: string;
  type?: string | any;
  required?: boolean;
  defaultValue?: any;
  group?: string;
  tab?: string;
  tabName?: string;
  layoutModel?: { tabName?: string; order?: number; password?: boolean; text?: boolean; query?: boolean };
  displayModel?: { displayName?: string; summary?: string; example?: string };
  use?: string;
  allowedValues?: string[];
  expressionSupport?: string;
  'expression-support'?: string;
  '@_expressionSupport'?: string;
  '@_expression-support'?: string;
}): ParameterModel {
  const name = raw.name;
  const description = (raw.description || raw.displayModel?.summary || '').trim();
  const label = raw.label || raw.displayModel?.displayName || toDisplayLabel(name);

  // Reference detection (config-ref or connection-ref)
  const isConfigRef =
    name === 'config-ref' ||
    name.toLowerCase().endsWith('configref') ||
    name.toLowerCase().endsWith('-config-ref');
  const isConnRef =
    name.toLowerCase().includes('connectionref') ||
    name.toLowerCase().includes('connection-ref');
  const isReference = isConfigRef || isConnRef;
  const referenceType: 'configuration' | 'connection-provider' | undefined = isConfigRef
    ? 'configuration'
    : isConnRef
    ? 'connection-provider'
    : undefined;

  // Real tab/placement metadata priority:
  // 1. raw.layoutModel?.tabName
  // 2. raw.tabName
  // 3. raw.tab
  // 4. raw.group
  const explicitTab = raw.layoutModel?.tabName || raw.tabName || raw.tab || raw.group;
  const group = inferParameterGroup(name, description, explicitTab);

  // DataWeave expression support resolution:
  // Read authentic expressionSupport field from real extension model
  // Expected enum values: 'NOT_SUPPORTED', 'SUPPORTED', 'REQUIRED'
  // When absent (e.g. *-extension-descriptions.xml or XSD format), default to false rather than guessing true.
  const rawExprSupport =
    raw.expressionSupport ||
    raw['expression-support'] ||
    raw['@_expressionSupport'] ||
    raw['@_expression-support'];
  const normalizedExprSupport = typeof rawExprSupport === 'string'
    ? rawExprSupport.trim().toUpperCase()
    : undefined;

  let supportsExpression = false;
  let isExpressionRequired = false;

  if (isReference) {
    // References never support DataWeave expressions
    supportsExpression = false;
  } else if (normalizedExprSupport === 'NOT_SUPPORTED') {
    supportsExpression = false;
  } else if (normalizedExprSupport === 'SUPPORTED') {
    supportsExpression = true;
  } else if (normalizedExprSupport === 'REQUIRED') {
    supportsExpression = true;
    isExpressionRequired = true;
  } else {
    // Field is entirely absent (e.g. older *-extension-descriptions.xml or XSD format):
    // Default supportsExpression to false rather than guessing true.
    supportsExpression = false;
  }

  // Extract raw type string if type is an object (e.g. { format: 'java', type: 'String' })
  const rawTypeStr = typeof raw.type === 'string'
    ? raw.type
    : (raw.type && typeof raw.type === 'object' ? (raw.type.type || raw.type.format) : undefined);

  // Infer data type and allowed values
  const { dataType, allowedValues, inferredDefault } = inferParameterDetails(
    name,
    description,
    rawTypeStr,
    raw.allowedValues
  );

  let defaultValue =
    raw.defaultValue !== undefined && raw.defaultValue !== null
      ? raw.defaultValue
      : inferredDefault;

  // REQUIRED specifically means the field should default to expression mode ON.
  // In the webview, expression mode is initialized ON when the initial value starts with #[
  if (isExpressionRequired) {
    if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
      const defStr = String(defaultValue).trim();
      defaultValue = defStr.startsWith('#[') ? defaultValue : `#[${defStr}]`;
    } else {
      defaultValue = '#[]';
    }
  }

  const required = raw.required === true || raw.use?.toLowerCase() === 'required';

  return {
    name,
    label,
    description,
    dataType,
    required,
    defaultValue: defaultValue !== undefined ? defaultValue : null,
    group,
    supportsExpression,
    isReference,
    referenceType,
    allowedValues: allowedValues && allowedValues.length > 0 ? allowedValues : undefined,
    use: required ? 'required' : 'optional',
    expressionSupport: normalizedExprSupport,
    defaultExpressionMode: isExpressionRequired ? true : undefined,
  };
}

/**
 * Extracts nested parameter forms for structural complex objects (TLS, Reconnection, Pooling, Streaming)
 * so they render as rich, dedicated forms in their own tabs.
 */
export function expandStructuralSections(params: ParameterModel[]): ParameterModel[] {
  const existingNames = new Set(params.map((p) => p.name));
  const result: ParameterModel[] = [];

  for (const p of params) {
    result.push(p);

    // 1. Expand Reconnection Strategy nested form
    if (
      (p.name === 'reconnectionStrategy' || p.name === 'reconnection') &&
      !existingNames.has('reconnection.frequency')
    ) {
      existingNames.add('reconnection.frequency');
      result.push(
        buildParameterModel({
          name: 'reconnection.frequency',
          label: 'Frequency (ms)',
          description: 'How often in milliseconds to reconnect.',
          type: 'number',
          defaultValue: 2000,
          group: 'Reconnection Strategy',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'reconnection.count',
          label: 'Reconnection Attempts',
          description: 'How many reconnection attempts to make.',
          type: 'number',
          defaultValue: 2,
          group: 'Reconnection Strategy',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'reconnection.blocking',
          label: 'Blocking Reconnection',
          description: 'Whether reconnection attempts should block execution.',
          type: 'boolean',
          defaultValue: false,
          group: 'Reconnection Strategy',
          required: false,
          use: 'optional',
        })
      );
    }

    // 2. Expand Streaming Strategy nested form
    if (
      p.name === 'streamingStrategy' &&
      !existingNames.has('streaming.maxInMemorySize')
    ) {
      existingNames.add('streaming.maxInMemorySize');
      result.push(
        buildParameterModel({
          name: 'streaming.maxInMemorySize',
          label: 'Max In Memory Size (KB)',
          description: 'Maximum amount of memory the stream can consume before buffering to disk.',
          type: 'number',
          defaultValue: 1024,
          group: 'Streaming Strategy',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'streaming.bufferUnit',
          label: 'Buffer Unit',
          description: 'The unit of measurement for memory size.',
          type: 'enum',
          allowedValues: ['KB', 'MB', 'BYTE'],
          defaultValue: 'KB',
          group: 'Streaming Strategy',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'streaming.initialBufferSize',
          label: 'Initial Buffer Size',
          description: 'Initial amount of memory allocated for the stream buffer.',
          type: 'number',
          defaultValue: 512,
          group: 'Streaming Strategy',
          required: false,
          use: 'optional',
        })
      );
    }

    // 3. Expand TLS Context nested form
    if (
      (p.name === 'tlsContext' || p.name === 'tls-context') &&
      !existingNames.has('tlsContext.insecure')
    ) {
      existingNames.add('tlsContext.insecure');
      result.push(
        buildParameterModel({
          name: 'tlsContext.enabledProtocols',
          label: 'Enabled Protocols',
          description: 'Comma-separated list of enabled TLS protocols (e.g. TLSv1.2, TLSv1.3).',
          type: 'string',
          defaultValue: 'TLSv1.2,TLSv1.3',
          group: 'TLS Context',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'tlsContext.insecure',
          label: 'Insecure (Trust All)',
          description: 'Whether to trust certificates without verification.',
          type: 'boolean',
          defaultValue: false,
          group: 'TLS Context',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'tlsContext.trustStorePath',
          label: 'Truststore Path',
          description: 'The path to the truststore file.',
          type: 'string',
          defaultValue: null,
          group: 'TLS Context',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'tlsContext.trustStorePassword',
          label: 'Truststore Password',
          description: 'The password to open the truststore file.',
          type: 'string',
          defaultValue: null,
          group: 'TLS Context',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'tlsContext.keyStorePath',
          label: 'Keystore Path',
          description: 'The path to the keystore file.',
          type: 'string',
          defaultValue: null,
          group: 'TLS Context',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'tlsContext.keyStorePassword',
          label: 'Keystore Password',
          description: 'The password to open the keystore file.',
          type: 'string',
          defaultValue: null,
          group: 'TLS Context',
          required: false,
          use: 'optional',
        })
      );
    }

    // 4. Expand Pooling Profile nested form
    if (
      (p.name === 'poolingProfile' || p.name === 'pooling' || p.name === 'connectionPooling') &&
      !existingNames.has('poolingProfile.maxActive')
    ) {
      existingNames.add('poolingProfile.maxActive');
      result.push(
        buildParameterModel({
          name: 'poolingProfile.maxActive',
          label: 'Max Active Connections',
          description: 'The maximum number of active connections that can be allocated.',
          type: 'number',
          defaultValue: 5,
          group: 'Pooling Profile',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'poolingProfile.maxIdle',
          label: 'Max Idle Connections',
          description: 'The maximum number of connections that can remain idle in the pool.',
          type: 'number',
          defaultValue: 5,
          group: 'Pooling Profile',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'poolingProfile.minIdle',
          label: 'Min Idle Connections',
          description: 'The minimum number of connections that can remain idle in the pool.',
          type: 'number',
          defaultValue: 0,
          group: 'Pooling Profile',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'poolingProfile.maxWait',
          label: 'Max Wait (ms)',
          description: 'The maximum time in milliseconds to wait for a connection before failing.',
          type: 'number',
          defaultValue: 10000,
          group: 'Pooling Profile',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'poolingProfile.exhaustedAction',
          label: 'Exhausted Action',
          description: 'Action to take when connection pool is exhausted.',
          type: 'enum',
          allowedValues: ['GROW', 'BLOCK', 'FAIL'],
          defaultValue: 'BLOCK',
          group: 'Pooling Profile',
          required: false,
          use: 'optional',
        }),
        buildParameterModel({
          name: 'poolingProfile.initialisationPolicy',
          label: 'Initialisation Policy',
          description: 'Determines how connections in pool are initialized.',
          type: 'enum',
          allowedValues: ['INITIALISE_ONE', 'INITIALISE_ALL', 'INITIALISE_NONE'],
          defaultValue: 'INITIALISE_ONE',
          group: 'Pooling Profile',
          required: false,
          use: 'optional',
        })
      );
    }
  }

  return result;
}

/**
 * Groups parameters into named tabs/groups.
 * General is always first, Advanced is always second, followed by all other real tabs
 * in whatever order the model itself declares them.
 */
export function groupParameters(params: ParameterModel[]): ParameterGroupModel[] {
  const expandedParams = expandStructuralSections(params);

  const groupMap = new Map<string, ParameterModel[]>();
  for (const p of expandedParams) {
    const groupName = p.group || 'General';
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, []);
    }
    groupMap.get(groupName)!.push(p);
  }

  const result: ParameterGroupModel[] = [];
  // Ensure "General" is first if present
  if (groupMap.has('General')) {
    result.push({
      name: 'General',
      parameters: groupMap.get('General')!,
    });
    groupMap.delete('General');
  }

  // Ensure "Advanced" is second if present
  if (groupMap.has('Advanced')) {
    result.push({
      name: 'Advanced',
      parameters: groupMap.get('Advanced')!,
    });
    groupMap.delete('Advanced');
  }

  // All other real tabs after, in whatever order the model itself declares them
  for (const [name, parameters] of groupMap.entries()) {
    result.push({ name, parameters });
  }

  return result;
}

/**
 * Details deduction helper for data types, enumerations, and defaults.
 */
function inferParameterDetails(
  name: string,
  description: string,
  rawType?: string,
  explicitAllowedValues?: string[]
): {
  dataType: ParameterDataType;
  allowedValues?: string[];
  inferredDefault?: any;
} {
  const lowerName = name.toLowerCase();
  const lowerDesc = description.toLowerCase();
  let dataType: ParameterDataType = 'string';
  let allowedValues: string[] | undefined = explicitAllowedValues;
  let inferredDefault: any = null;

  // Extract default value from description if present
  const defaultMatch = description.match(/default\s+value\s+is\s+["']?([^"'.\s,]+)["']?/i);
  if (defaultMatch) {
    const val = defaultMatch[1].trim();
    if (val.toLowerCase() === 'true') inferredDefault = true;
    else if (val.toLowerCase() === 'false') inferredDefault = false;
    else if (!isNaN(Number(val))) inferredDefault = Number(val);
    else inferredDefault = val;
  }

  // 1. Enum types
  if (explicitAllowedValues && explicitAllowedValues.length > 0) {
    dataType = 'enum';
  } else if (lowerName === 'method') {
    dataType = 'enum';
    allowedValues = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (inferredDefault === null) inferredDefault = 'GET';
  } else if (lowerName === 'protocol') {
    dataType = 'enum';
    allowedValues = ['HTTP', 'HTTPS'];
    if (inferredDefault === null) inferredDefault = 'HTTP';
  } else if (lowerName === 'sendbodymode' || lowerName === 'requeststreamingmode') {
    dataType = 'enum';
    allowedValues = ['AUTO', 'ALWAYS', 'NEVER'];
    if (inferredDefault === null) inferredDefault = 'AUTO';
  } else if (lowerName === 'transactiontype' || lowerName === 'transactionalaction' || lowerName === 'transactionaction') {
    dataType = 'enum';
    allowedValues = ['ALWAYS_JOIN', 'JOIN_IF_POSSIBLE', 'NOT_SUPPORTED', 'ALWAYS_BEGIN'];
    if (inferredDefault === null) inferredDefault = 'JOIN_IF_POSSIBLE';
  } else if (lowerName === 'querytimeoutunit') {
    dataType = 'enum';
    allowedValues = ['MILLISECONDS', 'SECONDS', 'MINUTES', 'HOURS', 'DAYS'];
    if (inferredDefault === null) inferredDefault = 'SECONDS';
  } else if (lowerDesc.includes('valid values are')) {
    const validMatch = description.match(/valid values are\s+([^.]+)/i);
    if (validMatch) {
      const parts = validMatch[1]
        .split(/,|\band\b|\bor\b/i)
        .map((s) => s.replace(/["'.]/g, '').trim())
        .filter(Boolean);
      if (parts.length > 1) {
        dataType = 'enum';
        allowedValues = parts;
      }
    }
  }

  if (dataType === 'enum') {
    return { dataType, allowedValues, inferredDefault };
  }

  // 2. Numbers
  if (
    rawType === 'integer' ||
    rawType === 'int' ||
    rawType === 'number' ||
    rawType === 'long' ||
    rawType === 'float' ||
    rawType === 'double' ||
    lowerName === 'port' ||
    lowerName.endsWith('port') ||
    lowerName.endsWith('timeout') ||
    lowerName.endsWith('interval') ||
    lowerName.endsWith('size') ||
    lowerName.endsWith('count') ||
    lowerName.endsWith('limit') ||
    lowerName.endsWith('ttl') ||
    lowerName.endsWith('buffer') ||
    lowerName.endsWith('buffersize') ||
    lowerName.endsWith('maxconnections') ||
    lowerName === 'fetchsize' ||
    lowerName === 'maxrows'
  ) {
    dataType = 'number';
    if (lowerName === 'port' && inferredDefault === null) {
      inferredDefault = 80;
    }
    return { dataType, inferredDefault };
  }

  // 3. Booleans
  if (
    rawType === 'boolean' ||
    lowerName.startsWith('is') ||
    lowerName.startsWith('use') ||
    lowerName.startsWith('enable') ||
    lowerName.startsWith('follow') ||
    lowerName.startsWith('send') ||
    lowerName.startsWith('stream') ||
    lowerName.includes('support') ||
    lowerName === 'primarynodeonly'
  ) {
    dataType = 'boolean';
    if (inferredDefault === null) {
      if (lowerName === 'followredirects' || lowerName === 'usepersistentconnections') {
        inferredDefault = true;
      } else {
        inferredDefault = false;
      }
    }
    return { dataType, inferredDefault };
  }

  // 4. Lists
  if (
    rawType === 'list' ||
    rawType === 'array' ||
    rawType === 'collection' ||
    lowerName.endsWith('list') ||
    lowerName.endsWith('interceptors') ||
    lowerName.endsWith('indexes') ||
    lowerName.endsWith('names')
  ) {
    dataType = 'list';
    return { dataType, inferredDefault };
  }

  // 5. Complex objects (maps, objects, headers, body, parameters)
  if (
    rawType === 'map' ||
    rawType === 'object' ||
    rawType === 'complex-object' ||
    lowerName === 'body' ||
    lowerName === 'headers' ||
    lowerName === 'queryparams' ||
    lowerName === 'uriparams' ||
    lowerName === 'defaultheaders' ||
    lowerName === 'defaultqueryparams' ||
    lowerName === 'inputparameters' ||
    lowerName === 'parametertypes' ||
    lowerName === 'tlscontext' ||
    lowerName === 'proxyconfig' ||
    lowerName === 'authentication'
  ) {
    dataType = 'complex-object';
    return { dataType, inferredDefault };
  }

  // 6. Strings (default)
  return { dataType: 'string', inferredDefault };
}

export class ExtensionModelReader {
  private static xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
  });

  /**
   * Reads a Mule plugin JAR and extracts the Extension Model.
   */
  public static async readFromJar(jarPathOrZip: string | JSZip): Promise<ExtensionModel | null> {
    const zip = typeof jarPathOrZip === 'string'
      ? await JarReader.openJar(jarPathOrZip)
      : jarPathOrZip;

    if (!zip) {
      return null;
    }

    try {
      // 1. Scan META-INF/ inside the jar for any .json file with configurations/operations/sources
      const metaInfJsonEntries = Object.keys(zip.files).filter(
        (name) => name.startsWith('META-INF/') && name.endsWith('.json')
      );

      for (const entryName of metaInfJsonEntries) {
        const file = zip.file(entryName);
        if (!file) continue;

        try {
          const content = await file.async('string');
          const parsed = JSON.parse(content);

          const root = parsed.extension || parsed;
          const hasConfigs = Array.isArray(root.configurations) && root.configurations.length > 0;
          const hasOps = Array.isArray(root.operations) && root.operations.length > 0;
          const hasSources = Array.isArray(root.sources) && root.sources.length > 0;

          if (hasConfigs || hasOps || hasSources) {
            return this.parseExtensionModelJson(root, entryName);
          }
        } catch {
          // Continue checking next JSON file
        }
      }

      // 2. Scan META-INF/ for Mule SDK *-extension-descriptions.xml or any XML containing <extension-documentation>
      const metaInfXmlEntries = Object.keys(zip.files).filter(
        (name) => name.startsWith('META-INF/') && name.endsWith('.xml') && !name.endsWith('pom.xml')
      );

      for (const entryName of metaInfXmlEntries) {
        const file = zip.file(entryName);
        if (!file) continue;

        try {
          const xmlContent = await file.async('string');
          if (xmlContent.includes('<extension-documentation') || entryName.endsWith('-extension-descriptions.xml')) {
            const model = await this.parseExtensionDescriptionsXml(xmlContent, entryName, zip);
            if (model && (model.configurations.length > 0 || model.operations.length > 0 || model.sources.length > 0)) {
              return model;
            }
          }
        } catch (e) {
          console.warn(`Failed parsing extension descriptions XML ${entryName}:`, e);
        }
      }

      // 3. Fallback: Parse XSD files in META-INF/ to extract attributes and components
      const xsdEntries = Object.keys(zip.files).filter(
        (name) => name.startsWith('META-INF/') && name.endsWith('.xsd')
      );

      for (const entryName of xsdEntries) {
        const file = zip.file(entryName);
        if (!file) continue;

        try {
          const xsdContent = await file.async('string');
          const model = this.parseExtensionModelXsd(xsdContent, entryName);
          if (model && (model.configurations.length > 0 || model.operations.length > 0 || model.sources.length > 0)) {
            return model;
          }
        } catch (e) {
          console.warn(`Failed parsing fallback XSD ${entryName}:`, e);
        }
      }

      return null;
    } catch (e) {
      console.error('Error reading extension model from jar:', e);
      return null;
    }
  }

  /**
   * Parses an authentic Mule SDK Extension Model JSON descriptor.
   */
  private static parseExtensionModelJson(root: any, sourceFile: string): ExtensionModel {
    const name = root.name || 'UnknownExtension';
    const version = root.version;
    const prefix = root.prefix || name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const namespaceUri = root.namespace || root.namespaceUri || `http://www.mulesoft.org/schema/mule/${prefix}`;

    // Parse Configurations & ConnectionProviders
    const configurations: ConfigurationModel[] = [];
    if (Array.isArray(root.configurations)) {
      for (const config of root.configurations) {
        if (!config || typeof config !== 'object') continue;

        const rawParams = this.extractRawParametersFromJson(config.parameters || config.parameterGroupModels);
        const configParams = rawParams.map((p) => buildParameterModel(p));

        const connectionProviders: ConnectionProviderModel[] = [];
        const rawProviders = config.connectionProviders || config.connectionProviderModels || [];
        if (Array.isArray(rawProviders)) {
          for (const prov of rawProviders) {
            if (!prov || typeof prov !== 'object') continue;
            const provId = prov.name || 'connection';
            const provRawParams = this.extractRawParametersFromJson(prov.parameters || prov.parameterGroupModels);
            const provParams = provRawParams.map((p) => buildParameterModel(p));
            const provGroups = groupParameters(provParams);
            connectionProviders.push({
              id: provId,
              name: provId,
              displayName: toDisplayLabel(provId),
              type: typeof prov.type === 'string' ? prov.type : prov.type?.format,
              groups: provGroups,
              parameters: provGroups.flatMap((g) => g.parameters),
            });
          }
        }

        const cfgId = config.name || 'config';
        const configGroups = groupParameters(configParams);
        configurations.push({
          id: cfgId,
          name: cfgId,
          displayName: toDisplayLabel(cfgId),
          description: config.description,
          groups: configGroups,
          parameters: configGroups.flatMap((g) => g.parameters),
          connectionProvider: connectionProviders[0],
          connectionProviders,
        });
      }
    }

    // Parse Operations
    const operations: OperationModel[] = [];
    if (Array.isArray(root.operations)) {
      for (const op of root.operations) {
        if (!op || typeof op !== 'object') continue;
        const opId = op.name || '';
        const rawParams = this.extractRawParametersFromJson(op.parameters || op.parameterGroupModels);

        if (configurations.length > 0 && !rawParams.some((p) => p.name === 'config-ref')) {
          rawParams.unshift({
            name: 'config-ref',
            description: 'Reference to the configuration to use for this operation.',
            type: 'string',
            required: false,
            defaultValue: null,
            use: 'optional',
          });
        }

        const params = rawParams.map((p) => buildParameterModel(p));
        const groups = groupParameters(params);
        operations.push({
          id: opId,
          name: opId,
          xmlTag: op.xmlTag || opId,
          displayName: toDisplayLabel(opId),
          iconId: `${prefix}-${opId}`,
          groups,
          parameters: groups.flatMap((g) => g.parameters),
        });
      }
    }

    // Parse Sources
    const sources: SourceModel[] = [];
    if (Array.isArray(root.sources)) {
      for (const src of root.sources) {
        if (!src || typeof src !== 'object') continue;
        const srcId = src.name || '';
        const rawParams = this.extractRawParametersFromJson(src.parameters || src.parameterGroupModels);

        if (configurations.length > 0 && !rawParams.some((p) => p.name === 'config-ref')) {
          rawParams.unshift({
            name: 'config-ref',
            description: 'Reference to the configuration to use for this message source.',
            type: 'string',
            required: false,
            defaultValue: null,
            use: 'optional',
          });
        }

        const params = rawParams.map((p) => buildParameterModel(p));
        const groups = groupParameters(params);
        sources.push({
          id: srcId,
          name: srcId,
          xmlTag: src.xmlTag || srcId,
          displayName: toDisplayLabel(srcId),
          iconId: `${prefix}-${srcId}`,
          groups,
          parameters: groups.flatMap((g) => g.parameters),
        });
      }
    }

    return {
      name,
      version,
      namespaceUri,
      prefix,
      sourceType: 'json',
      sourceFile,
      configurations,
      operations,
      sources,
    };
  }

  /**
   * Parses official Mule SDK *-extension-descriptions.xml descriptors.
   */
  private static async parseExtensionDescriptionsXml(
    xmlContent: string,
    sourceFile: string,
    zip?: JSZip
  ): Promise<ExtensionModel | null> {
    const parsed = this.xmlParser.parse(xmlContent);
    const root = parsed['extension-documentation'];
    if (!root) return null;

    const extObj = root.extension || {};
    const extName: string = extObj['@_name'] || 'MuleExtension';
    const prefix = extName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const namespaceUri = `http://www.mulesoft.org/schema/mule/${prefix}`;

    // Read version from mule-artifact.json if available
    let version: string | undefined;
    if (zip) {
      try {
        const artifactFile = zip.file('META-INF/mule-artifact/mule-artifact.json');
        if (artifactFile) {
          const artifactJson = JSON.parse(await artifactFile.async('string'));
          version = artifactJson.extensionModelLoaderDescriptor?.attributes?.version || artifactJson.minMuleVersion;
        }
      } catch {
        // Ignore
      }
    }

    // 1. Collect Connections so configs can bind to their respective providers
    const rawConns = root.connections?.connection || [];
    const connList = Array.isArray(rawConns) ? rawConns : [rawConns];
    const connections: ConnectionProviderModel[] = [];

    for (const c of connList) {
      if (!c || !c['@_name']) continue;
      const cId: string = c['@_name'];
      const rawParams = c.parameters?.parameter || [];
      const paramList = Array.isArray(rawParams) ? rawParams : [rawParams];

      const params: ParameterModel[] = paramList
        .filter((p: any) => p && p['@_name'])
        .map((p: any) => {
          return buildParameterModel({
            name: p['@_name'],
            description: typeof p.description === 'string' ? p.description : '',
            required: false,
            group: 'General',
          });
        });

      const connGroups = groupParameters(params);
      connections.push({
        id: cId,
        name: cId,
        displayName: toDisplayLabel(cId),
        groups: connGroups,
        parameters: connGroups.flatMap((g) => g.parameters),
      });
    }

    // 2. Collect Configs
    const rawConfigs = root.configs?.config || [];
    const configList = Array.isArray(rawConfigs) ? rawConfigs : [rawConfigs];
    const configurations: ConfigurationModel[] = [];

    for (const cfg of configList) {
      if (!cfg || !cfg['@_name']) continue;
      const cfgId: string = cfg['@_name'];
      const cfgDesc: string = typeof cfg.description === 'string' ? cfg.description : '';
      const rawParams = cfg.parameters?.parameter || [];
      const paramList = Array.isArray(rawParams) ? rawParams : [rawParams];

      const params: ParameterModel[] = paramList
        .filter((p: any) => p && p['@_name'])
        .map((p: any) => {
          return buildParameterModel({
            name: p['@_name'],
            description: typeof p.description === 'string' ? p.description : '',
            required: false,
            group: 'General',
          });
        });

      // Match connections to this config: e.g. "listenerConfig" -> connection "listener"
      const matchedProviders = connections.filter((conn) => {
        const cLower = conn.id.toLowerCase();
        const cfgLower = cfgId.toLowerCase();
        return cfgLower.includes(cLower) || cLower.includes(cfgLower.replace(/config$/, ''));
      });
      const providersToAttach = matchedProviders.length > 0 ? matchedProviders : connections;

      // Ensure connection parameters (host, port, protocol, etc.) are also represented in config.parameters
      const existingParamNames = new Set(params.map((p) => p.name));
      for (const prov of providersToAttach) {
        if (prov.parameters) {
          for (const provParam of prov.parameters) {
            if (!existingParamNames.has(provParam.name)) {
              existingParamNames.add(provParam.name);
              params.push(provParam);
            }
          }
        }
      }

      const configGroups = groupParameters(params);
      configurations.push({
        id: cfgId,
        name: cfgId,
        displayName: toDisplayLabel(cfgId),
        description: cfgDesc,
        groups: configGroups,
        parameters: configGroups.flatMap((g) => g.parameters),
        connectionProvider: providersToAttach[0],
        connectionProviders: providersToAttach,
      });
    }

    // 3. Collect Operations
    const rawOps = root.operations?.operation || [];
    const opList = Array.isArray(rawOps) ? rawOps : [rawOps];
    const operations: OperationModel[] = [];

    for (const op of opList) {
      if (!op || !op['@_name']) continue;
      const opId: string = op['@_name'];
      const rawParams = op.parameters?.parameter || [];
      const paramList = Array.isArray(rawParams) ? rawParams : [rawParams];

      const params: ParameterModel[] = paramList
        .filter((p: any) => p && p['@_name'])
        .map((p: any) => {
          return buildParameterModel({
            name: p['@_name'],
            description: typeof p.description === 'string' ? p.description : '',
            required: false,
            group: 'General',
          });
        });

      // Inject config-ref if not explicitly present and configurations exist
      if (configurations.length > 0 && !params.some((p) => p.name === 'config-ref')) {
        params.unshift(
          buildParameterModel({
            name: 'config-ref',
            description: 'Reference to the configuration to use for this operation.',
            required: false,
            group: 'General',
          })
        );
      }

      const opGroups = groupParameters(params);
      operations.push({
        id: opId,
        name: opId,
        xmlTag: opId,
        displayName: toDisplayLabel(opId),
        iconId: `${prefix}-${opId}`,
        groups: opGroups,
        parameters: opGroups.flatMap((g) => g.parameters),
      });
    }

    // 4. Collect Sources
    const rawSources = root.sources?.source || [];
    const sourceList = Array.isArray(rawSources) ? rawSources : [rawSources];
    const sources: SourceModel[] = [];

    for (const src of sourceList) {
      if (!src || !src['@_name']) continue;
      const srcId: string = src['@_name'];
      const rawParams = src.parameters?.parameter || [];
      const paramList = Array.isArray(rawParams) ? rawParams : [rawParams];

      const params: ParameterModel[] = paramList
        .filter((p: any) => p && p['@_name'])
        .map((p: any) => {
          return buildParameterModel({
            name: p['@_name'],
            description: typeof p.description === 'string' ? p.description : '',
            required: false,
            group: 'General',
          });
        });

      // Inject config-ref if not explicitly present and configurations exist
      if (configurations.length > 0 && !params.some((p) => p.name === 'config-ref')) {
        params.unshift(
          buildParameterModel({
            name: 'config-ref',
            description: 'Reference to the configuration to use for this message source.',
            required: false,
            group: 'General',
          })
        );
      }

      const srcGroups = groupParameters(params);
      sources.push({
        id: srcId,
        name: srcId,
        xmlTag: srcId,
        displayName: toDisplayLabel(srcId),
        iconId: `${prefix}-${srcId}`,
        groups: srcGroups,
        parameters: srcGroups.flatMap((g) => g.parameters),
      });
    }

    return {
      name: extName,
      version,
      namespaceUri,
      prefix,
      sourceType: 'descriptions-xml',
      sourceFile,
      configurations,
      operations,
      sources,
    };
  }

  /**
   * Normalizes raw parameter objects from JSON descriptors.
   */
  private static extractRawParametersFromJson(rawParams: any): any[] {
    const result: any[] = [];
    if (!rawParams) return result;

    const list = Array.isArray(rawParams) ? rawParams : [rawParams];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;

      const subList = item.parameters || item.parameterModels;
      if (Array.isArray(subList)) {
        const itemTab = item.layoutModel?.tabName || item.tabName || item.tab;
        const groupName = itemTab || item.name || item.group || 'General';
        for (const sub of subList) {
          if (sub && typeof sub === 'object') {
            const subTab = sub.layoutModel?.tabName || sub.tabName || sub.tab || itemTab;
            result.push({
              ...sub,
              tabName: subTab,
              layoutModel: sub.layoutModel || (subTab ? { tabName: subTab } : undefined),
              group: subTab || groupName,
            });
          }
        }
        continue;
      }

      if (item.name) {
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Fallback XSD parser: extracts elements, complexTypes, and xsd:attributes.
   * Completely separate from xsdClassifier.ts.
   */
  private static parseExtensionModelXsd(xsdContent: string, sourceFile: string): ExtensionModel {
    const parsed = this.xmlParser.parse(xsdContent);
    const schema = parsed['xsd:schema'] || parsed['xs:schema'] || parsed['schema'] || {};
    const targetNamespace = schema['@_targetNamespace'] || '';

    // Collect all global complexTypes by name for type resolution
    const complexTypeMap = new Map<string, any>();
    const rawComplexTypes = schema['xsd:complexType'] || schema['xs:complexType'] || schema['complexType'] || [];
    const complexTypeList = Array.isArray(rawComplexTypes) ? rawComplexTypes : [rawComplexTypes];
    for (const ct of complexTypeList) {
      if (ct && ct['@_name']) {
        complexTypeMap.set(ct['@_name'], ct);
      }
    }

    // Collect global elements
    const rawElements = schema['xsd:element'] || schema['xs:element'] || schema['element'] || [];
    const elementList = Array.isArray(rawElements) ? rawElements : [rawElements];

    const configurations: ConfigurationModel[] = [];
    const operations: OperationModel[] = [];
    const sources: SourceModel[] = [];

    // Determine extension name and prefix
    let name = 'MuleExtension';
    if (targetNamespace) {
      const parts = targetNamespace.replace(/\/$/, '').split('/');
      name = parts[parts.length - 1] || 'MuleExtension';
    }
    const prefix = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const el of elementList) {
      if (!el || !el['@_name']) continue;
      const elName: string = el['@_name'];
      const subGroup: string = el['@_substitutionGroup'] || '';
      const elType: string = el['@_type'] || '';

      // Resolve complexType definition (inline or referenced)
      const typeNameWithoutPrefix = elType.includes(':') ? elType.split(':')[1] : elType;
      const resolvedCt =
        complexTypeMap.get(typeNameWithoutPrefix) ||
        el['xsd:complexType'] ||
        el['xs:complexType'] ||
        el['complexType'];

      const params = this.extractAttributesFromXsd(resolvedCt, complexTypeMap);

      // Classify based on XSD names and substitution groups
      const lowerName = elName.toLowerCase();
      const lowerSubGroup = subGroup.toLowerCase();

      if (lowerName.endsWith('-config') || lowerName.endsWith('config') || lowerName.includes('configuration')) {
        const connectionProviders = this.extractConnectionProvidersFromXsd(resolvedCt, complexTypeMap);
        const configGroups = groupParameters(params);
        configurations.push({
          id: elName,
          name: elName,
          displayName: toDisplayLabel(elName),
          description: el['xsd:annotation']?.['xsd:documentation'] || el['xs:annotation']?.['xs:documentation'],
          groups: configGroups,
          parameters: configGroups.flatMap((g) => g.parameters),
          connectionProvider: connectionProviders[0],
          connectionProviders,
        });
      } else if (
        lowerSubGroup.includes('abstract-message-source') ||
        lowerName.includes('listener') ||
        lowerName.includes('source') ||
        lowerName.includes('inbound') ||
        lowerName.includes('trigger')
      ) {
        const srcGroups = groupParameters(params);
        sources.push({
          id: elName,
          name: elName,
          xmlTag: elName,
          displayName: toDisplayLabel(elName),
          iconId: `${prefix}-${elName}`,
          groups: srcGroups,
          parameters: srcGroups.flatMap((g) => g.parameters),
        });
      } else if (
        lowerSubGroup.includes('abstract-message-processor') ||
        lowerSubGroup.includes('abstract-extension-operation') ||
        (!lowerName.startsWith('abstract-') && !lowerName.includes('connection'))
      ) {
        const opGroups = groupParameters(params);
        operations.push({
          id: elName,
          name: elName,
          xmlTag: elName,
          displayName: toDisplayLabel(elName),
          iconId: `${prefix}-${elName}`,
          groups: opGroups,
          parameters: opGroups.flatMap((g) => g.parameters),
        });
      }
    }

    return {
      name,
      namespaceUri: targetNamespace,
      prefix,
      sourceType: 'xsd',
      sourceFile,
      configurations,
      operations,
      sources,
    };
  }

  /**
   * Helper to extract attributes from a complexType, including extended base types.
   */
  private static extractAttributesFromXsd(
    ct: any,
    complexTypeMap: Map<string, any>,
    visited = new Set<string>()
  ): ParameterModel[] {
    const rawAttrs: any[] = [];
    if (!ct || typeof ct !== 'object') return [];

    // Check complexContent extension
    const complexContent = ct['xsd:complexContent'] || ct['xs:complexContent'] || ct['complexContent'];
    if (complexContent) {
      const ext = complexContent['xsd:extension'] || complexContent['xs:extension'] || complexContent['extension'];
      if (ext) {
        const baseType = ext['@_base'];
        if (baseType) {
          const baseTypeName = baseType.includes(':') ? baseType.split(':')[1] : baseType;
          if (!visited.has(baseTypeName)) {
            visited.add(baseTypeName);
            const parentCt = complexTypeMap.get(baseTypeName);
            if (parentCt) {
              rawAttrs.push(...this.extractAttributesFromXsd(parentCt, complexTypeMap, visited));
            }
          }
        }
        rawAttrs.push(...this.collectAttributesFromContainer(ext));
      }
    }

    // Direct attributes on complexType
    rawAttrs.push(...this.collectAttributesFromContainer(ct));

    // Deduplicate parameters by name and build ParameterModel
    const unique = new Map<string, ParameterModel>();
    for (const p of rawAttrs) {
      if (!unique.has(p.name)) {
        unique.set(p.name, p);
      }
    }
    return Array.from(unique.values());
  }

  private static collectAttributesFromContainer(container: any): ParameterModel[] {
    const result: ParameterModel[] = [];
    const rawAttrs = container['xsd:attribute'] || container['xs:attribute'] || container['attribute'] || [];
    const attrList = Array.isArray(rawAttrs) ? rawAttrs : [rawAttrs];

    for (const a of attrList) {
      if (!a || !a['@_name']) continue;
      const attrName: string = a['@_name'];
      const useVal: string = a['@_use'] || 'optional';
      const isRequired = useVal.toLowerCase() === 'required';
      const defaultValue = a['@_default'] ?? null;
      const attrType: string = attrName === 'config-ref' ? 'config-ref' : a['@_type'] || 'xsd:string';

      result.push(
        buildParameterModel({
          name: attrName,
          type: attrType,
          required: isRequired,
          defaultValue,
          use: useVal,
          description: a['xsd:annotation']?.['xsd:documentation'] || a['xs:annotation']?.['xs:documentation'],
        })
      );
    }

    return result;
  }

  /**
   * Finds connection provider definitions inside an XSD configuration complexType.
   */
  private static extractConnectionProvidersFromXsd(
    ct: any,
    complexTypeMap: Map<string, any>
  ): ConnectionProviderModel[] {
    const providers: ConnectionProviderModel[] = [];
    if (!ct || typeof ct !== 'object') return providers;

    const container =
      ct['xsd:complexContent']?.['xsd:extension'] ||
      ct['xs:complexContent']?.['xs:extension'] ||
      ct;

    const sequence = container['xsd:sequence'] || container['xs:sequence'] || container['sequence'];
    const choice = container['xsd:choice'] || container['xs:choice'] || container['choice'];
    const elementsContainer = sequence || choice;

    if (elementsContainer) {
      const rawElements =
        elementsContainer['xsd:element'] || elementsContainer['xs:element'] || elementsContainer['element'] || [];
      const elements = Array.isArray(rawElements) ? rawElements : [rawElements];

      for (const el of elements) {
        if (!el || !el['@_name']) continue;
        const elName: string = el['@_name'];
        if (elName.toLowerCase().includes('connection')) {
          const elType: string = el['@_type'] || '';
          const typeName = elType.includes(':') ? elType.split(':')[1] : elType;
          const providerCt = complexTypeMap.get(typeName) || el['xsd:complexType'] || el['xs:complexType'];
          const params = this.extractAttributesFromXsd(providerCt, complexTypeMap);

          providers.push({
            id: elName,
            name: elName,
            displayName: toDisplayLabel(elName),
            type: elType,
            groups: groupParameters(params),
            parameters: params,
          });
        }
      }
    }

    return providers;
  }
}
