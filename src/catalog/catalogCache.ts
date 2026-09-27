import * as fs from 'fs';
import * as path from 'path';
import { JarExtensionMetadata } from './jarReader';
import { IconStore } from './iconStore';

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

export class CatalogCache {
  private cacheDir: string;
  private memoryCache = new Map<string, CacheEntry>();

  constructor(storageDir?: string) {
    this.cacheDir = storageDir || path.join(process.cwd(), '.mule-catalog-cache');
    this.ensureDir(this.cacheDir);
    this.loadFromDisk();
  }

  private ensureDir(dir: string): void {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      // Ignore
    }
  }

  private getCacheFilePath(): string {
    return path.join(this.cacheDir, 'descriptors.json');
  }

  private loadFromDisk(): void {
    const filePath = this.getCacheFilePath();
    if (!fs.existsSync(filePath)) {
      return;
    }

    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const entries: CacheEntry[] = JSON.parse(data);
      for (const entry of entries) {
        this.memoryCache.set(entry.key, entry);
        if (entry.extensionModel && !entry.metadata.extensionModel) {
          entry.metadata.extensionModel = entry.extensionModel;
        }
        if (entry.iconSymbol && entry.metadata.iconId) {
          IconStore.registerSymbol(entry.metadata.iconId, entry.iconSymbol);
        }
      }
    } catch (e) {
      console.warn('Failed loading catalog cache from disk:', e);
    }
  }

  public saveToDisk(): void {
    const filePath = this.getCacheFilePath();
    try {
      const entries = Array.from(this.memoryCache.values());
      fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed writing catalog cache to disk:', e);
    }
  }

  public get(key: string, jarPath: string): JarExtensionMetadata | null {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    // Verify mtime and size if jar exists
    try {
      if (fs.existsSync(jarPath)) {
        const stats = fs.statSync(jarPath);
        if (stats.mtimeMs !== entry.mtime || stats.size !== entry.size) {
          this.memoryCache.delete(key);
          return null;
        }
      }
    } catch {
      // If stat fails, continue with cache or return null
    }

    if (entry.extensionModel && !entry.metadata.extensionModel) {
      entry.metadata.extensionModel = entry.extensionModel;
    }

    if (entry.iconSymbol && entry.metadata.iconId) {
      IconStore.registerSymbol(entry.metadata.iconId, entry.iconSymbol);
    }
    return entry.metadata;
  }

  public getEntry(key: string, jarPath: string): CacheEntry | null {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    try {
      if (fs.existsSync(jarPath)) {
        const stats = fs.statSync(jarPath);
        if (stats.mtimeMs !== entry.mtime || stats.size !== entry.size) {
          this.memoryCache.delete(key);
          return null;
        }
      }
    } catch {
      // Ignore
    }

    if (entry.extensionModel && !entry.metadata.extensionModel) {
      entry.metadata.extensionModel = entry.extensionModel;
    }

    return entry;
  }

  public getExtensionModel(key: string, jarPath: string): ExtensionModel | null {
    const metadata = this.get(key, jarPath);
    return metadata?.extensionModel || null;
  }

  public set(
    key: string,
    jarPath: string,
    metadata: JarExtensionMetadata,
    extensionModel?: ExtensionModel | null
  ): void {
    let mtime = 0;
    let size = 0;
    try {
      if (fs.existsSync(jarPath)) {
        const stats = fs.statSync(jarPath);
        mtime = stats.mtimeMs;
        size = stats.size;
      }
    } catch {
      // Ignore
    }

    const extModel = extensionModel !== undefined ? extensionModel : metadata.extensionModel;
    metadata.extensionModel = extModel;

    const iconSymbol = metadata.iconId ? IconStore.getSymbol(metadata.iconId) : undefined;
    this.memoryCache.set(key, {
      key,
      jarPath,
      mtime,
      size,
      metadata,
      iconSymbol,
      extensionModel: extModel,
    });

    this.saveToDisk();
  }
}
