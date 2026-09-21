import { JarExtensionMetadata } from './jarReader';
export interface CacheEntry {
    key: string;
    mtime: number;
    size: number;
    metadata: JarExtensionMetadata;
    iconSymbol?: string;
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
    set(key: string, jarPath: string, metadata: JarExtensionMetadata): void;
}
//# sourceMappingURL=catalogCache.d.ts.map