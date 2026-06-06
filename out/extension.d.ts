/**
 * extension.ts
 *
 * Main entry point for the "MuleSoft Multi-Flow Visualizer" VS Code extension.
 *
 * Responsibilities:
 *  - Register commands: openVisualizer, refreshVisualizer
 *  - Manage a singleton WebviewPanel instance
 *  - Listen to document changes (auto-refresh) and active editor switches
 *  - Orchestrate XML parsing → Mermaid generation → Webview update pipeline
 *  - Handle postMessages from the Webview (e.g., jump-to-line navigation)
 */
import * as vscode from "vscode";
/**
 * Called once by VS Code when the extension is first activated.
 * Activation is triggered by `activationEvents` in package.json.
 */
export declare function activate(context: vscode.ExtensionContext): void;
export declare function deactivate(): void;
//# sourceMappingURL=extension.d.ts.map