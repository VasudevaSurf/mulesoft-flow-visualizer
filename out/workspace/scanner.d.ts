import * as vscode from 'vscode';
/**
 * Scans the workspace to find Mule XML files and locate the nearest pom.xml for a given Mule XML file.
 */
export declare class WorkspaceScanner {
    /**
     * Checks if a file is a Mule XML file by checking for <mule root element.
     */
    static isMuleXml(content: string): boolean;
    /**
     * Finds all Mule XML files in the workspace.
     */
    static findMuleXmlFiles(): Promise<vscode.Uri[]>;
    /**
     * Finds the nearest pom.xml by walking up the directory tree from the given Mule XML file path.
     */
    static findNearestPom(xmlFilePath: string): string | null;
}
//# sourceMappingURL=scanner.d.ts.map