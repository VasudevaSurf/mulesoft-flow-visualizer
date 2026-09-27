import JSZip from 'jszip';
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
export declare function toDisplayLabel(name: string): string;
/**
 * Assigns parameters to their respective tabs/groups based on explicit tab metadata,
 * structural complex sections (TLS, Reconnection, Streaming, Pooling, Transactions, Error Mapping),
 * or categorizes low-level tuning into "Advanced" and regular parameters into "General".
 */
export declare function inferParameterGroup(name: string, description?: string, explicitGroup?: string): string;
/**
 * Builds a refined ParameterModel from raw metadata.
 */
export declare function buildParameterModel(raw: {
    name: string;
    label?: string;
    description?: string;
    type?: string | any;
    required?: boolean;
    defaultValue?: any;
    group?: string;
    tab?: string;
    tabName?: string;
    layoutModel?: {
        tabName?: string;
        order?: number;
        password?: boolean;
        text?: boolean;
        query?: boolean;
    };
    displayModel?: {
        displayName?: string;
        summary?: string;
        example?: string;
    };
    use?: string;
    allowedValues?: string[];
}): ParameterModel;
/**
 * Extracts nested parameter forms for structural complex objects (TLS, Reconnection, Pooling, Streaming)
 * so they render as rich, dedicated forms in their own tabs.
 */
export declare function expandStructuralSections(params: ParameterModel[]): ParameterModel[];
/**
 * Groups parameters into named tabs/groups.
 * General is always first, Advanced is always second, followed by all other real tabs
 * in whatever order the model itself declares them.
 */
export declare function groupParameters(params: ParameterModel[]): ParameterGroupModel[];
export declare class ExtensionModelReader {
    private static xmlParser;
    /**
     * Reads a Mule plugin JAR and extracts the Extension Model.
     */
    static readFromJar(jarPathOrZip: string | JSZip): Promise<ExtensionModel | null>;
    /**
     * Parses an authentic Mule SDK Extension Model JSON descriptor.
     */
    private static parseExtensionModelJson;
    /**
     * Parses official Mule SDK *-extension-descriptions.xml descriptors.
     */
    private static parseExtensionDescriptionsXml;
    /**
     * Normalizes raw parameter objects from JSON descriptors.
     */
    private static extractRawParametersFromJson;
    /**
     * Fallback XSD parser: extracts elements, complexTypes, and xsd:attributes.
     * Completely separate from xsdClassifier.ts.
     */
    private static parseExtensionModelXsd;
    /**
     * Helper to extract attributes from a complexType, including extended base types.
     */
    private static extractAttributesFromXsd;
    private static collectAttributesFromContainer;
    /**
     * Finds connection provider definitions inside an XSD configuration complexType.
     */
    private static extractConnectionProvidersFromXsd;
}
//# sourceMappingURL=extensionModelReader.d.ts.map