import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MuleXmlParser } from '../parser/xmlParser';

/**
 * Scans the workspace to find Mule XML files and locate the nearest pom.xml for a given Mule XML file.
 */
export class WorkspaceScanner {
  /**
   * Checks if a file is a Mule XML file by checking for <mule root element.
   */
  public static isMuleXml(content: string): boolean {
    const trimmed = content.trim();
    // Quick regex check for <mule or <mule:mule with xml namespace
    return (
      /<([a-zA-Z0-9_-]+:)?mule[\s>]/.test(trimmed) &&
      (trimmed.includes('http://www.mulesoft.org/schema/mule/core') ||
        trimmed.includes('http://www.mulesoft.org/schema/mule/munit') ||
        trimmed.includes('http://www.mulesoft.org/schema/mule/munit-tools') ||
        trimmed.includes('xmlns="http://www.mulesoft.org/schema/mule/core"'))
    );
  }

  /**
   * Finds all Mule XML files in the workspace.
   */
  public static async findMuleXmlFiles(): Promise<vscode.Uri[]> {
    const xmlUris = await vscode.workspace.findFiles('**/*.xml', '**/target/**');
    const muleFiles: vscode.Uri[] = [];

    for (const uri of xmlUris) {
      try {
        const doc = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(doc).toString('utf-8');
        if (this.isMuleXml(text)) {
          muleFiles.push(uri);
        }
      } catch {
        // Skip unreadable files
      }
    }
    return muleFiles;
  }

  /**
   * Scans all Mule XML files in the project for top-level XML elements matching the configuration tag.
   * Returns a list of unique 'name' attribute values.
   */
  public static async findConfigurationNames(
    configXmlTag: string,
    currentDocUri?: vscode.Uri | null
  ): Promise<string[]> {
    const muleFiles = await this.findMuleXmlFiles();
    if (currentDocUri && !muleFiles.some((u) => u.toString() === currentDocUri.toString())) {
      muleFiles.push(currentDocUri);
    }

    const tagParts = configXmlTag.split(':');
    const expectedPrefix = tagParts.length > 1 ? tagParts[0].toLowerCase() : null;
    const expectedLocal = tagParts.length > 1 ? tagParts[1].toLowerCase() : tagParts[0].toLowerCase();
    const expectedLocalNormalized = expectedLocal.replace(/[-_]/g, '');

    const names = new Set<string>();

    for (const uri of muleFiles) {
      try {
        const docBytes = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(docBytes).toString('utf-8');

        // 1. Structural Parse
        const parsed = MuleXmlParser.parse(text);
        if (parsed.root && parsed.root.children) {
          for (const child of parsed.root.children) {
            const childLocal = child.localName.toLowerCase();
            const childPrefix = (child.prefix || '').toLowerCase();
            const childLocalNormalized = childLocal.replace(/[-_]/g, '');

            const matchesLocal =
              childLocal === expectedLocal ||
              childLocalNormalized === expectedLocalNormalized ||
              (expectedLocal.endsWith('config') && childLocalNormalized.includes(expectedLocalNormalized));
            const matchesPrefix = !expectedPrefix || !childPrefix || childPrefix === expectedPrefix;

            if (matchesLocal && matchesPrefix) {
              const nameAttr = child.attributes['name'] || child.attributes['id'];
              if (nameAttr) {
                names.add(nameAttr);
              }
            }
          }
        }

        // 2. Regex fallback for resilient discovery
        const escapedPrefix = expectedPrefix ? `(?:${expectedPrefix}:|[a-zA-Z0-9_-]+:)?` : '(?:[a-zA-Z0-9_-]+:)?';
        const regexStr = `<${escapedPrefix}${expectedLocal}\\b[^>]*\\bname=["']([^"']+)["']`;
        const regex = new RegExp(regexStr, 'gi');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          if (match[1]) {
            names.add(match[1]);
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return Array.from(names);
  }

  /**
   * Finds the best target XML file to insert global configurations.
   * Checks whether the project has a convention of a dedicated global config file like global.xml or config.xml.
   */
  public static async findTargetConfigFile(currentDocUri: vscode.Uri | null): Promise<vscode.Uri | null> {
    const muleFiles = await this.findMuleXmlFiles();
    if (currentDocUri && !muleFiles.some((u) => u.toString() === currentDocUri.toString())) {
      muleFiles.push(currentDocUri);
    }

    const conventionNames = [
      'global.xml',
      'globals.xml',
      'global-config.xml',
      'global-configs.xml',
      'config.xml',
      'configs.xml',
      'configuration.xml',
    ];

    for (const name of conventionNames) {
      const match = muleFiles.find((uri) => path.basename(uri.fsPath).toLowerCase() === name);
      if (match) {
        return match;
      }
    }

    return currentDocUri;
  }

  /**
   * Finds the nearest pom.xml by walking up the directory tree from the given Mule XML file path.
   */
  public static findNearestPom(xmlFilePath: string): string | null {
    let currentDir = path.dirname(xmlFilePath);
    const root = path.parse(currentDir).root;

    while (currentDir && currentDir !== root) {
      const pomPath = path.join(currentDir, 'pom.xml');
      if (fs.existsSync(pomPath)) {
        return pomPath;
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    return null;
  }
}

