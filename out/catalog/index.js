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
exports.ExtensionCatalog = void 0;
const vscode = __importStar(require("vscode"));
const coreCatalog_1 = require("./coreCatalog");
const mavenRepo_1 = require("../workspace/mavenRepo");
const pomParser_1 = require("../workspace/pomParser");
const jarReader_1 = require("./jarReader");
const catalogCache_1 = require("./catalogCache");
const xsdClassifier_1 = require("./xsdClassifier");
const iconStore_1 = require("./iconStore");
const extensionModelReader_1 = require("./extensionModelReader");
class ExtensionCatalog {
    static initCache(storageDir) {
        if (!this.cache) {
            this.cache = new catalogCache_1.CatalogCache(storageDir);
        }
    }
    static getCache() {
        if (!this.cache) {
            this.cache = new catalogCache_1.CatalogCache();
        }
        return this.cache;
    }
    static registerExtensionModel(artifactId, extModel) {
        if (extModel.namespaceUri)
            this.extensionModels.set(extModel.namespaceUri.toLowerCase(), extModel);
        if (extModel.prefix)
            this.extensionModels.set(extModel.prefix.toLowerCase(), extModel);
        this.extensionModels.set(artifactId.toLowerCase(), extModel);
        const shortArt = artifactId.toLowerCase().replace(/^mule-/, '').replace(/-connector$/, '').replace(/-module$/, '');
        this.extensionModels.set(shortArt, extModel);
    }
    /**
     * Resolves a component descriptor by namespace URI, local name, and optional prefix.
     * Checks core catalog first, then dynamic descriptors, then prefix mapping, then falls back gracefully.
     */
    static resolveComponent(namespaceUri, localName, prefix) {
        const ns = namespaceUri || '';
        const key = `${ns}:${localName}`;
        // 1. Check core catalog
        const coreMatch = coreCatalog_1.CORE_CATALOG[key] ||
            (prefix ? coreCatalog_1.CORE_CATALOG[`${prefix}:${localName}`] : undefined) ||
            coreCatalog_1.CORE_CATALOG[localName];
        if (coreMatch) {
            return coreMatch;
        }
        // 2. Check dynamic catalog from Maven jars
        const dynamicMatch = this.dynamicDescriptors.get(key);
        if (dynamicMatch) {
            return dynamicMatch;
        }
        // 3. Check matching descriptor by localName across dynamic descriptors
        for (const [descKey, desc] of this.dynamicDescriptors.entries()) {
            if (descKey.endsWith(`:${localName}`) && prefix && descKey.includes(prefix)) {
                return desc;
            }
        }
        // 4. Prefix to connector icon mapping
        let resolvedIconId;
        if (prefix && this.prefixToIconId.has(prefix)) {
            resolvedIconId = this.prefixToIconId.get(prefix);
        }
        // Fallback known connector icons from local repo
        if (!resolvedIconId && prefix) {
            const knownConnectorMap = {
                'http': 'org.mule.connectors:mule-http-connector',
                'db': 'org.mule.connectors:mule-db-connector',
                'vm': 'org.mule.connectors:mule-vm-connector',
                'validation': 'org.mule.modules:mule-validation-module',
                'os': 'org.mule.connectors:mule-objectstore-connector',
                'file': 'org.mule.connectors:mule-file-connector',
                'sftp': 'org.mule.connectors:mule-sftp-connector',
                'ftp': 'org.mule.connectors:mule-ftp-connector',
                'email': 'org.mule.connectors:mule-email-connector',
                'java': 'org.mule.modules:mule-java-module',
                'wsc': 'org.mule.connectors:mule-wsc-connector',
                'sockets': 'org.mule.connectors:mule-sockets-connector',
                'jms': 'org.mule.connectors:mule-jms-connector',
                'ibm-mq': 'com.mulesoft.connectors:mule-ibm-mq-connector',
                'ibmmq': 'com.mulesoft.connectors:mule-ibm-mq-connector',
                'anypoint-mq': 'com.mulesoft.connectors:anypoint-mq-connector',
                'kafka': 'com.mulesoft.connectors:mule-kafka-connector',
                'salesforce': 'com.mulesoft.connectors:mule-salesforce-connector',
                'sap': 'com.mulesoft.connectors:mule-sap-connector',
            };
            const candidateIconId = knownConnectorMap[prefix.toLowerCase()];
            if (candidateIconId && iconStore_1.IconStore.hasIcon(candidateIconId)) {
                resolvedIconId = candidateIconId;
            }
        }
        const lowerName = localName.toLowerCase();
        const isSource = (0, xsdClassifier_1.isLikelySourceElement)(localName);
        const isConfig = lowerName.endsWith('-config') || lowerName.endsWith('config') || lowerName.includes('connection');
        return {
            namespaceUri: ns,
            localName,
            kind: isConfig ? 'global-config' : (isSource ? 'source' : 'operation'),
            displayName: xsdClassifier_1.XsdClassifier.formatDisplayName(localName),
            iconId: resolvedIconId || (isSource ? 'core:generic-source' : 'core:unknown'),
            subtitleAttribute: isSource ? 'path' : 'config-ref',
        };
    }
    /**
     * Retrieves an OperationModel or SourceModel by namespace URI and local element name.
     */
    static async getOperationOrSourceModel(namespaceUri, localName, prefix) {
        const ns = (namespaceUri || '').toLowerCase();
        const lowerLocal = localName.toLowerCase();
        // 0. Check core catalog
        const key = `${namespaceUri || ''}:${localName}`;
        const coreMatch = coreCatalog_1.CORE_CATALOG[key] ||
            (prefix ? coreCatalog_1.CORE_CATALOG[`${prefix}:${localName}`] : null) ||
            coreCatalog_1.CORE_CATALOG[localName];
        if (coreMatch && coreMatch.groups && coreMatch.groups.length > 0) {
            return {
                id: coreMatch.localName,
                displayName: coreMatch.displayName,
                iconId: coreMatch.iconId,
                groups: coreMatch.groups,
            };
        }
        // Helper to find in a given ExtensionModel
        const findInModel = (model) => {
            const op = model.operations.find((o) => (o.id || o.name || o.xmlTag || '').toLowerCase() === lowerLocal);
            if (op)
                return op;
            const src = model.sources.find((s) => (s.id || s.name || s.xmlTag || '').toLowerCase() === lowerLocal);
            if (src)
                return src;
            return null;
        };
        // 1. Search in cached extensionModels
        for (const [key, model] of this.extensionModels.entries()) {
            if (ns.includes(key) || key.includes(ns) || (prefix && key === prefix.toLowerCase())) {
                const found = findInModel(model);
                if (found)
                    return found;
            }
        }
        // 2. On-demand search from ~/.m2 repository
        try {
            const config = vscode.workspace.getConfiguration('muleFlow');
            const customM2 = config.get('mavenLocalRepository');
            const mavenRepo = new mavenRepo_1.MavenRepo(customM2);
            const installed = mavenRepo.findInstalledMulePlugins();
            // Extract short name from namespace or prefix (e.g. "http" or "db")
            const candidateTokens = [prefix, ns.replace(/\/$/, '').split('/').pop()].filter(Boolean);
            for (const item of installed) {
                const art = item.dep.artifactId.toLowerCase();
                const shortArt = art.replace(/^mule-/, '').replace(/-connector$/, '').replace(/-module$/, '');
                const matches = candidateTokens.some((t) => t && (art.includes(t.toLowerCase()) || shortArt === t.toLowerCase()));
                if (matches) {
                    let extModel = this.extensionModels.get(art) || this.extensionModels.get(shortArt);
                    if (!extModel) {
                        await this.loadDependencyWithJar(item.dep, item.jarPath);
                        extModel = this.extensionModels.get(art) || this.extensionModels.get(shortArt);
                    }
                    if (extModel) {
                        const found = findInModel(extModel);
                        if (found)
                            return found;
                    }
                }
            }
        }
        catch (e) {
            console.warn('Error during on-demand ExtensionModel resolution:', e);
        }
        return null;
    }
    /**
     * Retrieves the matching ConfigurationModel and XML tag for a component (operation or source).
     */
    static async getConfigurationModelForComponent(namespaceUri, localName, prefix) {
        const ns = (namespaceUri || '').toLowerCase();
        const lowerLocal = localName.toLowerCase();
        // Helper to find matching ConfigurationModel in a given ExtensionModel
        const findConfigInModel = (model) => {
            if (!model.configurations || model.configurations.length === 0)
                return null;
            let matchedConfig = null;
            if (model.configurations.length === 1) {
                matchedConfig = model.configurations[0];
            }
            else {
                matchedConfig =
                    model.configurations.find((c) => {
                        const cId = (c.id || c.name || '').toLowerCase();
                        return cId.includes(lowerLocal) || lowerLocal.includes(cId.replace(/config$/, ''));
                    }) || model.configurations[0];
            }
            const pfx = prefix || model.prefix || 'mule';
            let cfgTag = matchedConfig.id || matchedConfig.name || 'config';
            cfgTag = cfgTag.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
            if (!cfgTag.endsWith('config') && !cfgTag.endsWith('-config')) {
                cfgTag = `${cfgTag}-config`;
            }
            const configXmlTag = `${pfx}:${cfgTag}`;
            return {
                configModel: matchedConfig,
                configXmlTag,
                prefix: pfx,
            };
        };
        // 1. Search in cached extensionModels
        for (const [key, model] of this.extensionModels.entries()) {
            if (ns.includes(key) || key.includes(ns) || (prefix && key === prefix.toLowerCase())) {
                const found = findConfigInModel(model);
                if (found)
                    return found;
            }
        }
        // 2. On-demand search from ~/.m2 repository
        try {
            const config = vscode.workspace.getConfiguration('muleFlow');
            const customM2 = config.get('mavenLocalRepository');
            const mavenRepo = new mavenRepo_1.MavenRepo(customM2);
            const installed = mavenRepo.findInstalledMulePlugins();
            const candidateTokens = [prefix, ns.replace(/\/$/, '').split('/').pop()].filter(Boolean);
            for (const item of installed) {
                const art = item.dep.artifactId.toLowerCase();
                const shortArt = art.replace(/^mule-/, '').replace(/-connector$/, '').replace(/-module$/, '');
                const matches = candidateTokens.some((t) => t && (art.includes(t.toLowerCase()) || shortArt === t.toLowerCase()));
                if (matches) {
                    let extModel = this.extensionModels.get(art) || this.extensionModels.get(shortArt);
                    if (!extModel) {
                        await this.loadDependencyWithJar(item.dep, item.jarPath);
                        extModel = this.extensionModels.get(art) || this.extensionModels.get(shortArt);
                    }
                    if (extModel) {
                        const found = findConfigInModel(extModel);
                        if (found)
                            return found;
                    }
                }
            }
        }
        catch (e) {
            console.warn('Error resolving ConfigurationModel:', e);
        }
        return null;
    }
    /**
     * Retrieves a ConfigurationModel directly by its tag or configuration name (e.g. "listener-config", "request-config", "config").
     */
    static async getConfigurationModel(namespaceUri, configLocalName, prefix) {
        const ns = (namespaceUri || '').toLowerCase();
        const lowerLocal = configLocalName.toLowerCase();
        const normalizedLocal = lowerLocal.replace(/[-_]/g, '');
        const findConfigInModel = (model) => {
            if (!model.configurations || model.configurations.length === 0)
                return null;
            // 1. Direct match on id, name, or toKebabCase
            for (const c of model.configurations) {
                const cId = (c.id || c.name || '').toLowerCase();
                const cNormalized = cId.replace(/[-_]/g, '');
                const cKebab = cId.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
                if (cId === lowerLocal || cNormalized === normalizedLocal || cKebab === lowerLocal) {
                    return c;
                }
                if (cNormalized.includes(normalizedLocal) || normalizedLocal.includes(cNormalized)) {
                    return c;
                }
            }
            // 2. If single configuration in extension model, it's that one
            if (model.configurations.length === 1) {
                return model.configurations[0];
            }
            return null;
        };
        // 1. Check cached models
        for (const [key, model] of this.extensionModels.entries()) {
            if (ns.includes(key) || key.includes(ns) || (prefix && key === prefix.toLowerCase())) {
                const found = findConfigInModel(model);
                if (found)
                    return found;
            }
        }
        // 2. On-demand search from ~/.m2 repository
        try {
            const config = vscode.workspace.getConfiguration('muleFlow');
            const customM2 = config.get('mavenLocalRepository');
            const mavenRepo = new mavenRepo_1.MavenRepo(customM2);
            const installed = mavenRepo.findInstalledMulePlugins();
            const candidateTokens = [prefix, ns.replace(/\/$/, '').split('/').pop()].filter(Boolean);
            for (const item of installed) {
                const art = item.dep.artifactId.toLowerCase();
                const shortArt = art.replace(/^mule-/, '').replace(/-connector$/, '').replace(/-module$/, '');
                const matches = candidateTokens.some((t) => t && (art.includes(t.toLowerCase()) || shortArt === t.toLowerCase()));
                if (matches) {
                    let extModel = this.extensionModels.get(art) || this.extensionModels.get(shortArt);
                    if (!extModel) {
                        await this.loadDependencyWithJar(item.dep, item.jarPath);
                        extModel = this.extensionModels.get(art) || this.extensionModels.get(shortArt);
                    }
                    if (extModel) {
                        const found = findConfigInModel(extModel);
                        if (found)
                            return found;
                    }
                }
            }
        }
        catch (e) {
            console.warn('Error resolving ConfigurationModel:', e);
        }
        return null;
    }
    /**
     * Scans dependencies in pom.xml and discovers installed Mule connectors in ~/.m2
     */
    static async loadProjectConnectors(pomPath, mavenRepo) {
        if (this.loadedPomPaths.has(pomPath)) {
            return;
        }
        this.loadedPomPaths.add(pomPath);
        // 1. Direct dependencies from pom.xml
        const pomDependencies = pomParser_1.PomParser.parse(pomPath);
        await Promise.all(pomDependencies.map(dep => this.loadDependency(dep, mavenRepo)));
        // 2. Auto-discover installed connectors from ~/.m2/repository
        const installed = mavenRepo.findInstalledMulePlugins();
        await Promise.all(installed.map(item => this.loadDependencyWithJar(item.dep, item.jarPath)));
    }
    static async loadDependency(dep, mavenRepo) {
        const jarPath = mavenRepo.resolveJarPath(dep);
        if (!jarPath) {
            return;
        }
        await this.loadDependencyWithJar(dep, jarPath);
    }
    static async loadDependencyWithJar(dep, jarPath) {
        const cacheKey = `${dep.groupId}:${dep.artifactId}:${dep.version}`;
        // Record prefix hint (e.g. mule-http-connector -> prefix "http")
        const artifactShort = dep.artifactId.replace(/^mule-/, '').replace(/-connector$/, '').replace(/-module$/, '');
        this.prefixToIconId.set(artifactShort, `${dep.groupId}:${dep.artifactId}`);
        const cache = this.getCache();
        // 1. Check cache: keyed the same way (groupId:artifactId:version + jar path)
        const cached = cache.get(cacheKey, jarPath);
        if (cached) {
            for (const desc of cached.descriptors) {
                this.dynamicDescriptors.set(`${desc.namespaceUri}:${desc.localName}`, desc);
            }
            if (cached.extensionModel) {
                this.registerExtensionModel(dep.artifactId, cached.extensionModel);
                return; // Full cache hit! Jar file is NOT opened.
            }
        }
        // 2. Cache miss: Open jar ONCE for both XSD classification & extension model extraction
        try {
            const zip = await jarReader_1.JarReader.openJar(jarPath);
            if (!zip) {
                return;
            }
            // Read both XSD metadata and extension model using the SAME open JSZip instance
            const metadata = await jarReader_1.JarReader.readJar(jarPath, dep.groupId, dep.artifactId, dep.version, zip);
            const extModel = await extensionModelReader_1.ExtensionModelReader.readFromJar(zip);
            if (metadata) {
                for (const desc of metadata.descriptors) {
                    this.dynamicDescriptors.set(`${desc.namespaceUri}:${desc.localName}`, desc);
                }
            }
            if (extModel) {
                this.registerExtensionModel(dep.artifactId, extModel);
            }
            if (metadata) {
                metadata.extensionModel = extModel || undefined;
                cache.set(cacheKey, jarPath, metadata, extModel || undefined);
            }
        }
        catch (e) {
            console.warn(`Failed loading connector metadata for ${cacheKey}:`, e);
        }
    }
}
exports.ExtensionCatalog = ExtensionCatalog;
ExtensionCatalog.dynamicDescriptors = new Map(); // namespaceUri + ':' + localName -> descriptor
ExtensionCatalog.prefixToIconId = new Map(); // prefix -> iconId
ExtensionCatalog.extensionModels = new Map(); // namespaceUri or prefix or artifactId -> ExtensionModel
ExtensionCatalog.cache = null;
ExtensionCatalog.loadedPomPaths = new Set();
//# sourceMappingURL=index.js.map