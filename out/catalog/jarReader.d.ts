import { ComponentDescriptor } from '../parser/types';
export interface JarExtensionMetadata {
    groupId: string;
    artifactId: string;
    version: string;
    name?: string;
    namespaceUri?: string;
    iconId: string;
    descriptors: ComponentDescriptor[];
}
export declare class JarReader {
    /**
     * Reads a mule-plugin jar file and extracts its XSD descriptors, icon, and artifact metadata.
     */
    static readJar(jarPath: string, groupId: string, artifactId: string, version: string): Promise<JarExtensionMetadata | null>;
}
//# sourceMappingURL=jarReader.d.ts.map