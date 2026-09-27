import { ComponentDescriptor } from '../parser/types';
import { MavenRepo } from '../workspace/mavenRepo';
import { CatalogCache } from './catalogCache';
import { OperationModel, SourceModel, ConfigurationModel } from './extensionModelReader';
export declare class ExtensionCatalog {
    private static dynamicDescriptors;
    private static prefixToIconId;
    private static extensionModels;
    private static cache;
    private static loadedPomPaths;
    static initCache(storageDir?: string): void;
    static getCache(): CatalogCache;
    private static registerExtensionModel;
    /**
     * Resolves a component descriptor by namespace URI, local name, and optional prefix.
     * Checks core catalog first, then dynamic descriptors, then prefix mapping, then falls back gracefully.
     */
    static resolveComponent(namespaceUri: string | null, localName: string, prefix?: string | null): ComponentDescriptor;
    /**
     * Retrieves an OperationModel or SourceModel by namespace URI and local element name.
     */
    static getOperationOrSourceModel(namespaceUri: string | null, localName: string, prefix?: string | null): Promise<OperationModel | SourceModel | null>;
    /**
     * Retrieves the matching ConfigurationModel and XML tag for a component (operation or source).
     */
    static getConfigurationModelForComponent(namespaceUri: string | null, localName: string, prefix?: string | null): Promise<{
        configModel: ConfigurationModel;
        configXmlTag: string;
        prefix: string;
    } | null>;
    /**
     * Retrieves a ConfigurationModel directly by its tag or configuration name (e.g. "listener-config", "request-config", "config").
     */
    static getConfigurationModel(namespaceUri: string | null, configLocalName: string, prefix?: string | null): Promise<ConfigurationModel | null>;
    /**
     * Scans dependencies in pom.xml and discovers installed Mule connectors in ~/.m2
     */
    static loadProjectConnectors(pomPath: string, mavenRepo: MavenRepo): Promise<void>;
    private static loadDependency;
    private static loadDependencyWithJar;
}
//# sourceMappingURL=index.d.ts.map