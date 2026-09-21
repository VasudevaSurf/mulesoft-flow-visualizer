import { ComponentDescriptor } from '../parser/types';
import { MavenRepo } from '../workspace/mavenRepo';
export declare class ExtensionCatalog {
    private static dynamicDescriptors;
    private static prefixToIconId;
    private static cache;
    private static loadedPomPaths;
    static initCache(storageDir?: string): void;
    /**
     * Resolves a component descriptor by namespace URI, local name, and optional prefix.
     * Checks core catalog first, then dynamic descriptors, then prefix mapping, then falls back gracefully.
     */
    static resolveComponent(namespaceUri: string | null, localName: string, prefix?: string | null): ComponentDescriptor;
    /**
     * Scans dependencies in pom.xml and discovers installed Mule connectors in ~/.m2
     */
    static loadProjectConnectors(pomPath: string, mavenRepo: MavenRepo): Promise<void>;
    private static loadDependency;
    private static loadDependencyWithJar;
}
//# sourceMappingURL=index.d.ts.map