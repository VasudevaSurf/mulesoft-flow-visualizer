import * as vscode from 'vscode';
import { ComponentDescriptor } from '../parser/types';
import { CORE_CATALOG } from './coreCatalog';
import { MavenRepo } from '../workspace/mavenRepo';
import { PomParser, MavenDependency } from '../workspace/pomParser';
import { JarReader } from './jarReader';
import { CatalogCache } from './catalogCache';
import { XsdClassifier, isLikelySourceElement } from './xsdClassifier';
import { IconStore } from './iconStore';
import {
  ExtensionModelReader,
  ExtensionModel,
  OperationModel,
  SourceModel,
  ConfigurationModel,
} from './extensionModelReader';

export class ExtensionCatalog {
  private static dynamicDescriptors = new Map<string, ComponentDescriptor>(); // namespaceUri + ':' + localName -> descriptor
  private static prefixToIconId = new Map<string, string>(); // prefix -> iconId
  private static extensionModels = new Map<string, ExtensionModel>(); // namespaceUri or prefix or artifactId -> ExtensionModel
  private static cache: CatalogCache | null = null;
  private static loadedPomPaths = new Set<string>();

  public static initCache(storageDir?: string): void {
    if (!this.cache) {
      this.cache = new CatalogCache(storageDir);
    }
  }

  public static getCache(): CatalogCache {
    if (!this.cache) {
      this.cache = new CatalogCache();
    }
    return this.cache;
  }

  private static registerExtensionModel(artifactId: string, extModel: ExtensionModel): void {
    if (extModel.namespaceUri) this.extensionModels.set(extModel.namespaceUri.toLowerCase(), extModel);
    if (extModel.prefix) this.extensionModels.set(extModel.prefix.toLowerCase(), extModel);
    this.extensionModels.set(artifactId.toLowerCase(), extModel);
    const shortArt = artifactId.toLowerCase().replace(/^mule-/, '').replace(/-connector$/, '').replace(/-module$/, '');
    this.extensionModels.set(shortArt, extModel);
  }

  /**
   * Resolves a component descriptor by namespace URI, local name, and optional prefix.
   * Checks core catalog first, then dynamic descriptors, then prefix mapping, then falls back gracefully.
   */
  public static resolveComponent(
    namespaceUri: string | null,
    localName: string,
    prefix?: string | null
  ): ComponentDescriptor {
    const ns = namespaceUri || '';
    const key = `${ns}:${localName}`;

    // 1. Check core catalog
    const coreMatch = CORE_CATALOG[key] || CORE_CATALOG[localName];
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
    let resolvedIconId: string | undefined;
    if (prefix && this.prefixToIconId.has(prefix)) {
      resolvedIconId = this.prefixToIconId.get(prefix);
    }

    // Fallback known connector icons from local repo
    if (!resolvedIconId && prefix) {
      const knownConnectorMap: Record<string, string> = {
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
      if (candidateIconId && IconStore.hasIcon(candidateIconId)) {
        resolvedIconId = candidateIconId;
      }
    }

    const lowerName = localName.toLowerCase();
    const isSource = isLikelySourceElement(localName);
    const isConfig = lowerName.endsWith('-config') || lowerName.endsWith('config') || lowerName.includes('connection');

    return {
      namespaceUri: ns,
      localName,
      kind: isConfig ? 'global-config' : (isSource ? 'source' : 'operation'),
      displayName: XsdClassifier.formatDisplayName(localName),
      iconId: resolvedIconId || (isSource ? 'core:generic-source' : 'core:unknown'),
      subtitleAttribute: isSource ? 'path' : 'config-ref',
    };
  }

  /**
   * Retrieves an OperationModel or SourceModel by namespace URI and local element name.
   */
  public static async getOperationOrSourceModel(
    namespaceUri: string | null,
    localName: string,
    prefix?: string | null
  ): Promise<OperationModel | SourceModel | null> {
    const ns = (namespaceUri || '').toLowerCase();
    const lowerLocal = localName.toLowerCase();

    // Helper to find in a given ExtensionModel
    const findInModel = (model: ExtensionModel): OperationModel | SourceModel | null => {
      const op = model.operations.find(
        (o) => (o.id || o.name || o.xmlTag || '').toLowerCase() === lowerLocal
      );
      if (op) return op;

      const src = model.sources.find(
        (s) => (s.id || s.name || s.xmlTag || '').toLowerCase() === lowerLocal
      );
      if (src) return src;

      return null;
    };

    // 1. Search in cached extensionModels
    for (const [key, model] of this.extensionModels.entries()) {
      if (ns.includes(key) || key.includes(ns) || (prefix && key === prefix.toLowerCase())) {
        const found = findInModel(model);
        if (found) return found;
      }
    }

    // 2. On-demand search from ~/.m2 repository
    try {
      const config = vscode.workspace.getConfiguration('muleFlow');
      const customM2 = config.get<string>('mavenLocalRepository');
      const mavenRepo = new MavenRepo(customM2);
      const installed = mavenRepo.findInstalledMulePlugins();

      // Extract short name from namespace or prefix (e.g. "http" or "db")
      const candidateTokens = [prefix, ns.replace(/\/$/, '').split('/').pop()].filter(Boolean) as string[];

      for (const item of installed) {
        const art = item.dep.artifactId.toLowerCase();
        const shortArt = art.replace(/^mule-/, '').replace(/-connector$/, '').replace(/-module$/, '');

        const matches = candidateTokens.some(
          (t) => t && (art.includes(t.toLowerCase()) || shortArt === t.toLowerCase())
        );

        if (matches) {
          let extModel = this.extensionModels.get(art) || this.extensionModels.get(shortArt);
          if (!extModel) {
            await this.loadDependencyWithJar(item.dep, item.jarPath);
            extModel = this.extensionModels.get(art) || this.extensionModels.get(shortArt);
          }
          if (extModel) {
            const found = findInModel(extModel);
            if (found) return found;
          }
        }
      }
    } catch (e) {
      console.warn('Error during on-demand ExtensionModel resolution:', e);
    }

    return null;
  }

  /**
   * Retrieves the matching ConfigurationModel and XML tag for a component (operation or source).
   */
  public static async getConfigurationModelForComponent(
    namespaceUri: string | null,
    localName: string,
    prefix?: string | null
  ): Promise<{ configModel: ConfigurationModel; configXmlTag: string; prefix: string } | null> {
    const ns = (namespaceUri || '').toLowerCase();
    const lowerLocal = localName.toLowerCase();

    // Helper to find matching ConfigurationModel in a given ExtensionModel
    const findConfigInModel = (
      model: ExtensionModel
    ): { configModel: ConfigurationModel; configXmlTag: string; prefix: string } | null => {
      if (!model.configurations || model.configurations.length === 0) return null;

      let matchedConfig: ConfigurationModel | null = null;
      if (model.configurations.length === 1) {
        matchedConfig = model.configurations[0];
      } else {
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
        if (found) return found;
      }
    }

    // 2. On-demand search from ~/.m2 repository
    try {
      const config = vscode.workspace.getConfiguration('muleFlow');
      const customM2 = config.get<string>('mavenLocalRepository');
      const mavenRepo = new MavenRepo(customM2);
      const installed = mavenRepo.findInstalledMulePlugins();

      const candidateTokens = [prefix, ns.replace(/\/$/, '').split('/').pop()].filter(Boolean) as string[];

      for (const item of installed) {
        const art = item.dep.artifactId.toLowerCase();
        const shortArt = art.replace(/^mule-/, '').replace(/-connector$/, '').replace(/-module$/, '');

        const matches = candidateTokens.some(
          (t) => t && (art.includes(t.toLowerCase()) || shortArt === t.toLowerCase())
        );

        if (matches) {
          let extModel = this.extensionModels.get(art) || this.extensionModels.get(shortArt);
          if (!extModel) {
            await this.loadDependencyWithJar(item.dep, item.jarPath);
            extModel = this.extensionModels.get(art) || this.extensionModels.get(shortArt);
          }
          if (extModel) {
            const found = findConfigInModel(extModel);
            if (found) return found;
          }
        }
      }
    } catch (e) {
      console.warn('Error resolving ConfigurationModel:', e);
    }

    return null;
  }

  /**
   * Retrieves a ConfigurationModel directly by its tag or configuration name (e.g. "listener-config", "request-config", "config").
   */
  public static async getConfigurationModel(
    namespaceUri: string | null,
    configLocalName: string,
    prefix?: string | null
  ): Promise<ConfigurationModel | null> {
    const ns = (namespaceUri || '').toLowerCase();
    const lowerLocal = configLocalName.toLowerCase();
    const normalizedLocal = lowerLocal.replace(/[-_]/g, '');

    const findConfigInModel = (model: ExtensionModel): ConfigurationModel | null => {
      if (!model.configurations || model.configurations.length === 0) return null;

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
        if (found) return found;
      }
    }

    // 2. On-demand search from ~/.m2 repository
    try {
      const config = vscode.workspace.getConfiguration('muleFlow');
      const customM2 = config.get<string>('mavenLocalRepository');
      const mavenRepo = new MavenRepo(customM2);
      const installed = mavenRepo.findInstalledMulePlugins();

      const candidateTokens = [prefix, ns.replace(/\/$/, '').split('/').pop()].filter(Boolean) as string[];

      for (const item of installed) {
        const art = item.dep.artifactId.toLowerCase();
        const shortArt = art.replace(/^mule-/, '').replace(/-connector$/, '').replace(/-module$/, '');

        const matches = candidateTokens.some(
          (t) => t && (art.includes(t.toLowerCase()) || shortArt === t.toLowerCase())
        );

        if (matches) {
          let extModel = this.extensionModels.get(art) || this.extensionModels.get(shortArt);
          if (!extModel) {
            await this.loadDependencyWithJar(item.dep, item.jarPath);
            extModel = this.extensionModels.get(art) || this.extensionModels.get(shortArt);
          }
          if (extModel) {
            const found = findConfigInModel(extModel);
            if (found) return found;
          }
        }
      }
    } catch (e) {
      console.warn('Error resolving ConfigurationModel:', e);
    }

    return null;
  }

  /**
   * Scans dependencies in pom.xml and discovers installed Mule connectors in ~/.m2
   */
  public static async loadProjectConnectors(pomPath: string, mavenRepo: MavenRepo): Promise<void> {
    if (this.loadedPomPaths.has(pomPath)) {
      return;
    }
    this.loadedPomPaths.add(pomPath);

    // 1. Direct dependencies from pom.xml
    const pomDependencies = PomParser.parse(pomPath);
    await Promise.all(pomDependencies.map(dep => this.loadDependency(dep, mavenRepo)));

    // 2. Auto-discover installed connectors from ~/.m2/repository
    const installed = mavenRepo.findInstalledMulePlugins();
    await Promise.all(
      installed.map(item => this.loadDependencyWithJar(item.dep, item.jarPath))
    );
  }

  private static async loadDependency(dep: MavenDependency, mavenRepo: MavenRepo): Promise<void> {
    const jarPath = mavenRepo.resolveJarPath(dep);
    if (!jarPath) {
      return;
    }
    await this.loadDependencyWithJar(dep, jarPath);
  }

  private static async loadDependencyWithJar(dep: MavenDependency, jarPath: string): Promise<void> {
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
      const zip = await JarReader.openJar(jarPath);
      if (!zip) {
        return;
      }

      // Read both XSD metadata and extension model using the SAME open JSZip instance
      const metadata = await JarReader.readJar(jarPath, dep.groupId, dep.artifactId, dep.version, zip);
      const extModel = await ExtensionModelReader.readFromJar(zip);

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
    } catch (e) {
      console.warn(`Failed loading connector metadata for ${cacheKey}:`, e);
    }
  }
}
