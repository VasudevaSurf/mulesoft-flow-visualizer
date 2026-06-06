/**
 * webviewContent.ts
 *
 * Custom SVG renderer matching Anypoint Studio layout:
 * - Flows stacked vertically; nodes left-to-right
 * - Error-handler section docked below parent flow
 * - Pan: drag OR plain scroll  |  Zoom: Ctrl+scroll / toolbar / keyboard
 * - Properties panel (bottom slide-up) on node click — shows real XML attrs
 *   with a rich connector schema registry (auto-discovered, not hardcoded per-field)
 */
import * as vscode from "vscode";
import { ParsedFlow } from "./muleParser";
export interface WebviewContentOptions {
    mermaidSrc: string;
    flows: ParsedFlow[];
    nonce: string;
    webview: vscode.Webview;
    warnings: string[];
    theme: string;
}
export declare function getNonce(): string;
export declare function getWebviewContent(opts: WebviewContentOptions): string;
//# sourceMappingURL=webviewContent.d.ts.map