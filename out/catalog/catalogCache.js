"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogCache = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const iconStore_1 = require("./iconStore");
class CatalogCache {
    constructor(storageDir) {
        this.memoryCache = new Map();
        this.cacheDir = storageDir || path.join(process.cwd(), '.mule-catalog-cache');
        this.ensureDir(this.cacheDir);
        this.loadFromDisk();
    }
    ensureDir(dir) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
        catch {
            // Ignore
        }
    }
    getCacheFilePath() {
        return path.join(this.cacheDir, 'descriptors.json');
    }
    loadFromDisk() {
        const filePath = this.getCacheFilePath();
        if (!fs.existsSync(filePath)) {
            return;
        }
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            const entries = JSON.parse(data);
            for (const entry of entries) {
                this.memoryCache.set(entry.key, entry);
                if (entry.iconSymbol && entry.metadata.iconId) {
                    iconStore_1.IconStore.registerSymbol(entry.metadata.iconId, entry.iconSymbol);
                }
            }
        }
        catch (e) {
            console.warn('Failed loading catalog cache from disk:', e);
        }
    }
    saveToDisk() {
        const filePath = this.getCacheFilePath();
        try {
            const entries = Array.from(this.memoryCache.values());
            fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
        }
        catch (e) {
            console.warn('Failed writing catalog cache to disk:', e);
        }
    }
    get(key, jarPath) {
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
        }
        catch {
            // If stat fails, continue with cache or return null
        }
        if (entry.iconSymbol && entry.metadata.iconId) {
            iconStore_1.IconStore.registerSymbol(entry.metadata.iconId, entry.iconSymbol);
        }
        return entry.metadata;
    }
    set(key, jarPath, metadata) {
        let mtime = 0;
        let size = 0;
        try {
            if (fs.existsSync(jarPath)) {
                const stats = fs.statSync(jarPath);
                mtime = stats.mtimeMs;
                size = stats.size;
            }
        }
        catch {
            // Ignore
        }
        const iconSymbol = metadata.iconId ? iconStore_1.IconStore.getSymbol(metadata.iconId) : undefined;
        this.memoryCache.set(key, {
            key,
            mtime,
            size,
            metadata,
            iconSymbol,
        });
        this.saveToDisk();
    }
}
exports.CatalogCache = CatalogCache;
//# sourceMappingURL=catalogCache.js.map