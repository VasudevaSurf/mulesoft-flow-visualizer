import { JarExtensionMetadata } from './jarReader';
import { ExtensionModel } from './extensionModelReader';
export interface CacheEntry {
    key: string;
    jarPath?: string;
    mtime: number;
    size: number;
    metadata: JarExtensionMetadata;
    iconSymbol?: string;
    extensionModel?: ExtensionModel | null;
}
export declare class CatalogCache {
    private cacheDir;
    private memoryCache;
    constructor(storageDir?: string);
    private ensureDir;
    private getCacheFilePath;
    private loadFromDisk;
    saveToDisk(): void;
    get(key: string, jarPath: string): JarExtensionMetadata | null;
    getEntry(key: string, jarPath: string): CacheEntry | null;
    getExtensionModel(key: string, jarPath: string): ExtensionModel | null;
    set(key: string, jarPath: string, metadata: JarExtensionMetadata, extensionModel?: ExtensionModel | null): void;
}
//# sourceMappingURL=catalogCache.d.ts.map