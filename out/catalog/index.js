"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionCatalog = void 0;
const coreCatalog_1 = require("./coreCatalog");
const pomParser_1 = require("../workspace/pomParser");
const jarReader_1 = require("./jarReader");
const catalogCache_1 = require("./catalogCache");
const xsdClassifier_1 = require("./xsdClassifier");
const iconStore_1 = require("./iconStore");
class ExtensionCatalog {
    static initCache(storageDir) {
        if (!this.cache) {
            this.cache = new catalogCache_1.CatalogCache(storageDir);
        }
    }
    /**
     * Resolves a component descriptor by namespace URI, local name, and optional prefix.
     * Checks core catalog first, then dynamic descriptors, then prefix mapping, then falls back gracefully.
     */
    static resolveComponent(namespaceUri, localName, prefix) {
        const ns = namespaceUri || '';
        const key = `${ns}:${localName}`;
        // 1. Check core catalog
        const coreMatch = coreCatalog_1.CORE_CATALOG[key] || coreCatalog_1.CORE_CATALOG[localName];
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
            };
            const candidateIconId = knownConnectorMap[prefix.toLowerCase()];
            if (candidateIconId && iconStore_1.IconStore.hasIcon(candidateIconId)) {
                resolvedIconId = candidateIconId;
            }
        }
        const lowerName = localName.toLowerCase();
        const isSource = lowerName.includes('listener') || lowerName.includes('scheduler');
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
        // Check cache
        if (this.cache) {
            const cached = this.cache.get(cacheKey, jarPath);
            if (cached) {
                for (const desc of cached.descriptors) {
                    this.dynamicDescriptors.set(`${desc.namespaceUri}:${desc.localName}`, desc);
                }
                return;
            }
        }
        // Read jar
        try {
            const metadata = await jarReader_1.JarReader.readJar(jarPath, dep.groupId, dep.artifactId, dep.version);
            if (metadata) {
                for (const desc of metadata.descriptors) {
                    this.dynamicDescriptors.set(`${desc.namespaceUri}:${desc.localName}`, desc);
                }
                if (this.cache) {
                    this.cache.set(cacheKey, jarPath, metadata);
                }
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
ExtensionCatalog.cache = null;
ExtensionCatalog.loadedPomPaths = new Set();
//# sourceMappingURL=index.js.map