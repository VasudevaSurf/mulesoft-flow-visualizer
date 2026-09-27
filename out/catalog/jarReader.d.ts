import JSZip from 'jszip';
import { ComponentDescriptor } from '../parser/types';
import { ExtensionModel } from './extensionModelReader';
export interface JarExtensionMetadata {
    groupId: string;
    artifactId: string;
    version: string;
    name?: string;
    namespaceUri?: string;
    iconId: string;
    descriptors: ComponentDescriptor[];
    extensionModel?: ExtensionModel | null;
}
export declare class JarReader {
    private static jarReadCount;
    /**
     * Opens and loads a JAR file using JSZip.
     */
    static openJar(jarPath: string): Promise<JSZip | null>;
    static getJarReadCount(): number;
    static resetJarReadCount(): void;
    /**
     * Reads a mule-plugin jar file and extracts its XSD descriptors, icon, and artifact metadata.
     */
    static readJar(jarPath: string, groupId: string, artifactId: string, version: string, zipOrPath?: JSZip): Promise<JarExtensionMetadata | null>;
}
//# sourceMappingURL=jarReader.d.ts.map