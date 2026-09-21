import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

export interface MavenDependency {
  groupId: string;
  artifactId: string;
  version: string;
  classifier?: string;
  type?: string;
}

export class PomParser {
  private static parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
  });

  /**
   * Parses a pom.xml and extracts all dependencies with <classifier>mule-plugin</classifier>.
   */
  public static parse(pomPath: string): MavenDependency[] {
    if (!fs.existsSync(pomPath)) {
      return [];
    }

    try {
      const xmlContent = fs.readFileSync(pomPath, 'utf-8');
      const parsed = this.parser.parse(xmlContent);
      const project = parsed.project;
      if (!project) {
        return [];
      }

      // Collect properties
      const properties: Record<string, string> = {};
      if (project.properties && typeof project.properties === 'object') {
        for (const [key, val] of Object.entries(project.properties)) {
          if (typeof val === 'string' || typeof val === 'number') {
            properties[key] = String(val);
          }
        }
      }

      // Built-in / project properties
      if (project.groupId) {
        properties['project.groupId'] = String(project.groupId);
      }
      if (project.artifactId) {
        properties['project.artifactId'] = String(project.artifactId);
      }
      if (project.version) {
        properties['project.version'] = String(project.version);
      } else if (project.parent?.version) {
        properties['project.version'] = String(project.parent.version);
      }

      // Collect managed dependencies from dependencyManagement
      const managedDeps = new Map<string, string>(); // key: groupId:artifactId -> version
      const depMgmt = project.dependencyManagement?.dependencies?.dependency;
      if (depMgmt) {
        const rawList = Array.isArray(depMgmt) ? depMgmt : [depMgmt];
        for (const d of rawList) {
          if (d.groupId && d.artifactId && d.version) {
            const gid = this.resolveValue(String(d.groupId), properties);
            const aid = this.resolveValue(String(d.artifactId), properties);
            const ver = this.resolveValue(String(d.version), properties);
            managedDeps.set(`${gid}:${aid}`, ver);
          }
        }
      }

      // Collect project dependencies
      const rawDeps = project.dependencies?.dependency;
      if (!rawDeps) {
        return [];
      }

      const depList = Array.isArray(rawDeps) ? rawDeps : [rawDeps];
      const mulePlugins: MavenDependency[] = [];

      for (const d of depList) {
        const classifier = d.classifier ? this.resolveValue(String(d.classifier), properties) : undefined;
        // In Mule 4, connectors are declared with <classifier>mule-plugin</classifier>
        if (classifier !== 'mule-plugin') {
          continue;
        }

        const groupId = this.resolveValue(String(d.groupId || ''), properties);
        const artifactId = this.resolveValue(String(d.artifactId || ''), properties);
        let version = d.version ? this.resolveValue(String(d.version), properties) : undefined;

        if (!version) {
          version = managedDeps.get(`${groupId}:${artifactId}`);
        }

        if (groupId && artifactId && version) {
          mulePlugins.push({
            groupId,
            artifactId,
            version,
            classifier: 'mule-plugin',
            type: d.type ? this.resolveValue(String(d.type), properties) : 'jar'
          });
        }
      }

      return mulePlugins;
    } catch (e) {
      console.error(`Failed to parse pom.xml at ${pomPath}:`, e);
      return [];
    }
  }

  private static resolveValue(val: string, properties: Record<string, string>): string {
    return val.replace(/\$\{([^}]+)\}/g, (match, propName) => {
      return properties[propName] ?? match;
    });
  }
}
