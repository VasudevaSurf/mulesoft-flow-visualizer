import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { XMLParser } from 'fast-xml-parser';
import { MavenDependency } from './pomParser';

export class MavenRepo {
  private localRepoPath: string;

  constructor(customPath?: string | null) {
    this.localRepoPath = this.detectLocalRepo(customPath);
  }

  /**
   * Returns the resolved local repository path.
   */
  public getLocalRepoPath(): string {
    return this.localRepoPath;
  }

  /**
   * Resolves the full path to the jar for a given Maven dependency.
   * Format: <localRepo>/<groupId as path>/<artifactId>/<version>/<artifactId>-<version>-<classifier>.jar
   * or <artifactId>-<version>.jar
   */
  public resolveJarPath(dep: MavenDependency): string | null {
    const groupPath = dep.groupId.replace(/\./g, path.sep);
    const artifactDir = path.join(this.localRepoPath, groupPath, dep.artifactId, dep.version);

    if (!fs.existsSync(artifactDir)) {
      return null;
    }

    // Try with classifier first, e.g. artifactId-version-mule-plugin.jar
    if (dep.classifier) {
      const jarWithClassifier = path.join(artifactDir, `${dep.artifactId}-${dep.version}-${dep.classifier}.jar`);
      if (fs.existsSync(jarWithClassifier)) {
        return jarWithClassifier;
      }
    }

    // Fall back to standard jar name: artifactId-version.jar
    const standardJar = path.join(artifactDir, `${dep.artifactId}-${dep.version}.jar`);
    if (fs.existsSync(standardJar)) {
      return standardJar;
    }

    return null;
  }

  /**
   * Discovers installed Mule plugin jars in the local repository under org/mule/connectors and org/mule/modules.
   */
  public findInstalledMulePlugins(): { dep: MavenDependency; jarPath: string }[] {
    const results: { dep: MavenDependency; jarPath: string }[] = [];
    const searchRoots = [
      path.join(this.localRepoPath, 'org', 'mule', 'connectors'),
      path.join(this.localRepoPath, 'org', 'mule', 'modules'),
    ];

    for (const root of searchRoots) {
      if (!fs.existsSync(root)) continue;
      this.scanDirectoryForPlugins(root, results);
    }

    return results;
  }

  private scanDirectoryForPlugins(
    dir: string,
    results: { dep: MavenDependency; jarPath: string }[],
    depth = 0
  ): void {
    if (depth > 4) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.scanDirectoryForPlugins(fullPath, results, depth + 1);
        } else if (entry.name.endsWith('-mule-plugin.jar')) {
          // e.g. mule-http-connector-1.11.1-mule-plugin.jar
          const match = entry.name.match(/^(.+)-(\d+\.\d+[\w.-]*)-mule-plugin\.jar$/);
          if (match) {
            const artifactId = match[1];
            const version = match[2];
            const isModule = fullPath.includes(`${path.sep}modules${path.sep}`);
            const groupId = isModule ? 'org.mule.modules' : 'org.mule.connectors';

            results.push({
              dep: {
                groupId,
                artifactId,
                version,
                classifier: 'mule-plugin',
              },
              jarPath: fullPath,
            });
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  private detectLocalRepo(customPath?: string | null): string {
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }

    // Check MAVEN_REPO or M2_REPO environment variable
    if (process.env.M2_REPO && fs.existsSync(process.env.M2_REPO)) {
      return process.env.M2_REPO;
    }
    if (process.env.MAVEN_REPO && fs.existsSync(process.env.MAVEN_REPO)) {
      return process.env.MAVEN_REPO;
    }

    const homeDir = os.homedir();
    const settingsPath = path.join(homeDir, '.m2', 'settings.xml');

    if (fs.existsSync(settingsPath)) {
      try {
        const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
        const parsed = parser.parse(fs.readFileSync(settingsPath, 'utf-8'));
        const configuredRepo = parsed.settings?.localRepository;
        if (configuredRepo && typeof configuredRepo === 'string' && fs.existsSync(configuredRepo)) {
          return configuredRepo;
        }
      } catch {
        // Fallback to default
      }
    }

    return path.join(homeDir, '.m2', 'repository');
  }
}
