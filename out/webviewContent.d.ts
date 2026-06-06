/**
 * webviewContent.ts
 *
 * Factory that produces the complete HTML document injected into the
 * VS Code WebviewPanel. It:
 *   - Loads Mermaid.js from a CDN (the webview nonce allows this)
 *   - Renders the supplied Mermaid diagram string
 *   - Handles click events on diagram nodes and posts them back to the extension
 *   - Provides a toolbar with zoom controls and a refresh button
 *   - Adapts to the VS Code colour theme automatically
 */
import * as vscode from "vscode";
import { ParsedFlow } from "./muleParser";
export interface WebviewContentOptions {
    /** The Mermaid diagram source string */
    mermaidSrc: string;
    /** Parsed flows — used to build the click→line-number mapping */
    flows: ParsedFlow[];
    /** Security nonce for inline scripts */
    nonce: string;
    /** Webview-safe URI for any bundled local assets (unused here but good practice) */
    webview: vscode.Webview;
    /** Non-fatal warnings from the parser */
    warnings: string[];
    /** Mermaid theme name */
    theme: string;
}
/**
 * Generate a cryptographically random nonce for Content-Security-Policy.
 */
export declare function getNonce(): string;
/**
 * Produce the complete HTML string for the WebviewPanel.
 */
export declare function getWebviewContent(opts: WebviewContentOptions): string;
//# sourceMappingURL=webviewContent.d.ts.map