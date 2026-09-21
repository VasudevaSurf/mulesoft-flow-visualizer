import { ComponentDescriptor } from '../parser/types';
import { CORE_CATALOG } from './coreCatalog';
import { MavenRepo } from '../workspace/mavenRepo';
import { PomParser, MavenDependency } from '../workspace/pomParser';
import { JarReader } from './jarReader';
import { CatalogCache } from './catalogCache';
import { XsdClassifier } from './xsdClassifier';
import { IconStore } from './iconStore';

export class ExtensionCatalog {
  private static dynamicDescriptors = new Map<string, ComponentDescriptor>(); // namespaceUri + ':' + localName -> descriptor
  private static prefixToIconId = new Map<string, string>(); // prefix -> iconId
  private static cache: CatalogCache | null = null;
  private static loadedPomPaths = new Set<string>();

  public static initCache(storageDir?: string): void {
    if (!this.cache) {
      this.cache = new CatalogCache(storageDir);
    }
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
      };
      const candidateIconId = knownConnectorMap[prefix.toLowerCase()];
      if (candidateIconId && IconStore.hasIcon(candidateIconId)) {
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
      displayName: XsdClassifier.formatDisplayName(localName),
      iconId: resolvedIconId || (isSource ? 'core:generic-source' : 'core:unknown'),
      subtitleAttribute: isSource ? 'path' : 'config-ref',
    };
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
      const metadata = await JarReader.readJar(jarPath, dep.groupId, dep.artifactId, dep.version);
      if (metadata) {
        for (const desc of metadata.descriptors) {
          this.dynamicDescriptors.set(`${desc.namespaceUri}:${desc.localName}`, desc);
        }

        if (this.cache) {
          this.cache.set(cacheKey, jarPath, metadata);
        }
      }
    } catch (e) {
      console.warn(`Failed loading connector metadata for ${cacheKey}:`, e);
    }
  }
}
