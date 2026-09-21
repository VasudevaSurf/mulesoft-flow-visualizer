import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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
    return /<([a-zA-Z0-9_-]+:)?mule[\s>]/.test(trimmed) &&
      (trimmed.includes('http://www.mulesoft.org/schema/mule/core') || trimmed.includes('xmlns="http://www.mulesoft.org/schema/mule/core"'));
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
