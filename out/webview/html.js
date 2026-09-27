"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebviewHtmlBuilder = void 0;
const vscode = __importStar(require("vscode"));
class WebviewHtmlBuilder {
    static build(webview, extensionUri) {
        const nonce = this.getNonce();
        const monacoBaseUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'monaco', 'vs'));
        const monacoLoaderUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'monaco', 'vs', 'loader.js'));
        const monacoCssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'monaco', 'vs', 'editor', 'editor.main.css'));
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mule Flow Visualizer</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #cccccc);
      --border: var(--vscode-panel-border, #333333);
      --flow-bg: var(--vscode-sideBar-background, #252526);
      --flow-header: var(--vscode-titleBar-activeBackground, #2d2d2d);
      --flow-border: var(--vscode-widget-border, #3c3c3c);
      --container-bg: rgba(255, 255, 255, 0.03);
      --container-border: rgba(255, 255, 255, 0.12);
      --lane-line: rgba(255, 255, 255, 0.25);
      --tile-bg: var(--vscode-editorWidget-background, #2a2d2e);
      --tile-border: rgba(255, 255, 255, 0.15);
      --tile-hover-border: var(--vscode-focusBorder, #007acc);
      --tile-selected-border: var(--vscode-focusBorder, #007acc);
      --tile-selected-glow: rgba(0, 122, 204, 0.4);
      --text-muted: var(--vscode-descriptionForeground, #8c8c8c);
      --chip-bg: transparent;
      --accent: #007acc;
      --error-band-bg: rgba(229, 57, 53, 0.05);
      --error-band-border: rgba(229, 57, 53, 0.25);
    }

    body.theme-studio {
      --bg: #f5f6f8;
      --fg: #2c3e50;
      --border: #dcdfe6;
      --flow-bg: #ffffff;
      --flow-header: #ebf1f6;
      --flow-border: #b8c4ce;
      --container-bg: #fafbfc;
      --container-border: #cfd8dc;
      --lane-line: #90a4ae;
      --tile-bg: #ffffff;
      --tile-border: #b0bec5;
      --tile-hover-border: #0288d1;
      --tile-selected-border: #0288d1;
      --tile-selected-glow: rgba(2, 136, 209, 0.35);
      --text-muted: #546e7a;
      --chip-bg: transparent;
      --accent: #0288d1;
      --error-band-bg: #fff5f5;
      --error-band-border: #ffcdd2;
    }

    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      user-select: none;
    }

    #app-container {
      display: flex;
      width: 100%;
      height: 100%;
      position: relative;
    }

    /* ── Toolbar ────────────────────────────────────── */
    #toolbar {
      position: absolute;
      top: 12px;
      right: 16px;
      z-index: 100;
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--flow-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 4px 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    }

    .tool-btn {
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      color: var(--fg);
      cursor: pointer;
      padding: 4px 8px;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }
    .tool-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.1));
      border-color: var(--border);
    }
    .tool-btn:active {
      transform: scale(0.96);
    }

    /* ── Search Bar ─────────────────────────────────── */
    #search-box {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-right: 8px;
      border-right: 1px solid var(--border);
      padding-right: 8px;
    }
    #search-input {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--fg);
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      outline: none;
      width: 130px;
      transition: width 0.2s ease;
    }
    #search-input:focus {
      width: 180px;
      border-color: var(--accent);
    }
    #search-count {
      font-size: 11px;
      color: var(--text-muted);
      min-width: 32px;
    }

    /* ── Flow Index Sidebar ─────────────────────────── */
    #sidebar {
      width: 220px;
      height: 100%;
      background: var(--flow-bg);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      z-index: 50;
      transition: transform 0.2s ease, width 0.2s ease;
    }
    #sidebar.collapsed {
      transform: translateX(-100%);
      position: absolute;
    }
    #sidebar-header {
      padding: 12px;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #flow-list {
      flex: 1;
      overflow-y: auto;
      padding: 6px 0;
      list-style: none;
      margin: 0;
    }
    .flow-item {
      padding: 8px 12px;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-left: 3px solid transparent;
    }
    .flow-item:hover {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.05));
    }
    .flow-item.active {
      background: var(--vscode-list-activeSelectionBackground, rgba(0, 122, 204, 0.2));
      border-left-color: var(--accent);
      color: var(--fg);
      font-weight: 500;
    }
    .flow-item-icon {
      font-size: 14px;
      opacity: 0.8;
    }

    /* ── Main Content Area (Canvas + Bottom Properties) ── */
    #main-area {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
      min-width: 0;
    }

    /* ── Canvas Viewport ────────────────────────────── */
    #viewport {
      flex: 1;
      width: 100%;
      min-height: 0;
      position: relative;
      overflow: hidden;
      cursor: grab;
    }
    #viewport.dragging {
      cursor: grabbing;
    }

    #canvas-svg {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      will-change: transform;
    }

    /* ── SVG Component Styles ───────────────────────── */
    .flow-box {
      fill: var(--flow-bg);
      stroke: var(--flow-border);
      stroke-width: 1.5;
      rx: 8;
      filter: drop-shadow(0 4px 16px rgba(0,0,0,0.12));
    }
    .flow-header-rect {
      fill: var(--flow-header);
      rx: 8;
    }
    .flow-title {
      font-size: 13px;
      font-weight: 600;
      fill: var(--fg);
      dominant-baseline: central;
    }
    .flow-badge {
      font-size: 10px;
      fill: var(--text-muted);
      font-weight: 500;
      text-transform: uppercase;
      dominant-baseline: central;
    }
    .flow-header-toggle:hover .flow-header-rect {
      fill: var(--vscode-list-hoverBackground, rgba(255,255,255,0.08));
    }
    .flow-chevron-btn:hover rect {
      fill: var(--accent);
    }
    .flow-collapsed-badge {
      font-size: 11px;
      fill: var(--accent);
      font-weight: 600;
      dominant-baseline: central;
    }
    .flow-box-collapsed {
      opacity: 0.95;
    }

    .source-divider {
      stroke: var(--flow-border);
      stroke-width: 1.5;
      stroke-dasharray: 4 4;
    }

    .error-band-rect {
      fill: var(--error-band-bg);
      stroke: var(--error-band-border);
      stroke-width: 1;
      rx: 6;
    }
    .error-band-title {
      font-size: 11px;
      font-weight: 600;
      fill: #e53935;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      dominant-baseline: central;
    }
    .error-band-header-rect {
      rx: 6;
      transition: fill 0.15s ease;
    }
    .error-band-toggle:hover rect.error-band-header-rect {
      fill: rgba(229, 57, 53, 0.12);
    }
    .error-band-toggle:hover rect.error-band-chevron-bg {
      fill: #e53935;
    }
    .error-band-toggle:hover text.error-band-chevron-text {
      fill: #ffffff;
    }
    .error-band-collapsed-badge {
      font-size: 10px;
      fill: #e53935;
      font-weight: 500;
      dominant-baseline: central;
    }
    .error-band-badge {
      font-size: 10px;
      fill: var(--text-muted);
      font-weight: 500;
      dominant-baseline: central;
    }

    .container-box {
      fill: var(--container-bg);
      stroke: var(--container-border);
      stroke-width: 1.2;
      rx: 6;
    }
    .container-header-rect {
      rx: 6;
      transition: fill 0.15s ease;
    }
    .container-header-toggle:hover rect.container-header-rect {
      fill: var(--vscode-list-hoverBackground, rgba(255,255,255,0.08));
    }
    .container-header-toggle:hover rect.container-chevron-bg {
      fill: var(--accent);
    }
    .container-header-toggle:hover text.container-chevron-text {
      fill: #ffffff;
    }
    .container-header-title {
      font-size: 11px;
      font-weight: 600;
      fill: var(--text-muted);
      dominant-baseline: central;
      transition: fill 0.15s ease;
    }
    .container-header-toggle:hover .container-header-title {
      fill: var(--fg);
    }
    .container-collapsed-rect {
      stroke-dasharray: 4 3;
      stroke: var(--container-border);
      fill: var(--container-bg);
    }
    .container-collapsed-tile:hover .container-collapsed-rect {
      stroke: var(--accent);
    }

    .lane-line {
      stroke: var(--lane-line);
      stroke-width: 2;
      fill: none;
      stroke-linecap: round;
    }
    .router-spine {
      stroke: var(--lane-line);
      stroke-width: 2;
      fill: none;
      stroke-linejoin: round;
    }
    #arrow path {
      fill: var(--lane-line);
    }

    /* ── Processor Tile ─────────────────────────────── */
    .tile-group {
      cursor: pointer;
      transition: transform 0.1s ease;
    }
    .tile-group:hover .tile-rect {
      stroke: var(--tile-hover-border);
      stroke-width: 2;
    }
    .tile-group.selected .tile-rect {
      stroke: var(--tile-selected-border);
      stroke-width: 2.5;
      filter: drop-shadow(0 0 8px var(--tile-selected-glow));
    }
    .tile-rect {
      fill: var(--tile-bg);
      stroke: var(--tile-border);
      stroke-width: 1.2;
      rx: 6;
      transition: stroke 0.15s ease, filter 0.15s ease;
    }
    .tile-icon-chip {
      fill: var(--chip-bg);
      rx: 22;
      border-radius: 50%;
    }
    .tile-title {
      font-size: 10.5px;
      font-weight: 600;
      fill: var(--fg);
      text-anchor: middle;
      dominant-baseline: central;
      pointer-events: none;
    }
    .tile-subtitle {
      font-size: 9px;
      fill: var(--text-muted);
      text-anchor: middle;
      dominant-baseline: central;
      pointer-events: none;
    }
    .route-header-label {
      font-size: 10.5px;
      font-weight: 600;
      fill: var(--text-muted);
      dominant-baseline: central;
      white-space: nowrap;
    }

    /* Dimmed non-matches in search */
    .dimmed {
      opacity: 0.2 !important;
      transition: opacity 0.2s ease;
    }
    .search-match .tile-rect {
      stroke: #ffb74d !important;
      stroke-width: 2.5 !important;
      filter: drop-shadow(0 0 8px rgba(255, 183, 77, 0.7)) !important;
    }

    /* ── Warning Banner ─────────────────────────────── */
    #warning-banner {
      position: absolute;
      top: 12px;
      left: 236px;
      z-index: 100;
      background: #fff3cd;
      color: #856404;
      border: 1px solid #ffeeba;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      display: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    /* ── Properties Docked Bottom Panel ─────────────── */
    #properties-panel {
      width: 100%;
      height: 280px;
      min-height: 80px;
      background: var(--flow-bg);
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      z-index: 60;
      position: relative;
      flex-shrink: 0;
      transition: transform 0.2s ease, height 0.2s ease;
      box-shadow: 0 -4px 16px rgba(0,0,0,0.15);
    }
    #properties-panel.collapsed {
      transform: translateY(100%);
      height: 0 !important;
      min-height: 0 !important;
      border-top-color: transparent !important;
      overflow: hidden !important;
      pointer-events: none;
    }
    .properties-resizer {
      position: absolute;
      top: -4px;
      left: 0;
      right: 0;
      height: 8px;
      cursor: ns-resize;
      background: transparent;
      z-index: 100;
      transition: background 0.15s ease;
    }
    .properties-resizer:hover,
    .properties-resizer.resizing {
      background: var(--accent);
    }
    .properties-header {
      padding: 12px 14px;
      background: var(--flow-header);
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .properties-header-title {
      display: flex;
      align-items: center;
      gap: 10px;
      overflow: hidden;
    }
    .properties-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .properties-icon-chip {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }
    .properties-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--fg);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .properties-subtitle {
      font-size: 11px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .properties-tabs {
      display: flex;
      background: rgba(0,0,0,0.12);
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
      padding: 0 8px;
    }
    .prop-tab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    .prop-tab-btn:hover {
      color: var(--fg);
    }
    .prop-tab-btn.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
      font-weight: 600;
    }
    .properties-content {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .properties-empty-state {
      padding: 40px 20px;
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
      line-height: 1.6;
    }
    .prop-tab-pane {
      display: none;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 14px 24px;
      align-items: start;
    }
    .prop-tab-pane.active {
      display: grid;
    }
    .test-connection-section,
    .prop-list-group {
      grid-column: 1 / -1;
    }
    .prop-form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .prop-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--fg);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .prop-required {
      color: #e53935;
      font-weight: bold;
    }
    .prop-type-badge {
      font-size: 10px;
      background: rgba(255,255,255,0.08);
      color: var(--text-muted);
      padding: 1px 5px;
      border-radius: 3px;
      text-transform: uppercase;
      font-weight: normal;
      margin-left: auto;
    }
    .prop-input, .prop-select, .prop-textarea {
      width: 100%;
      background: var(--vscode-input-background, #2a2d2e);
      color: var(--vscode-input-foreground, #cccccc);
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 12px;
      font-family: inherit;
      outline: none;
      box-sizing: border-box;
    }
    .prop-input:focus, .prop-select:focus, .prop-textarea:focus {
      border-color: var(--accent);
    }
    .prop-readonly {
      opacity: 0.85;
      background: rgba(0,0,0,0.15);
      cursor: default;
    }
    .prop-widget-row {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
    }
    .prop-widget-container {
      flex: 1;
      min-width: 0;
      position: relative;
    }
    .prop-normal-widget {
      width: 100%;
    }
    .prop-fx-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border);
      border-radius: 4px;
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 700;
      font-family: var(--vscode-editor-font-family, monospace);
      padding: 0 6px;
      height: 28px;
      line-height: 26px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .prop-fx-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: var(--fg);
      border-color: var(--accent);
    }
    .prop-fx-btn.active {
      background: var(--accent);
      color: #ffffff;
      border-color: var(--accent);
      box-shadow: 0 0 6px rgba(0, 122, 204, 0.4);
    }
    .prop-monaco-wrapper {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--vscode-input-background, rgba(0, 0, 0, 0.2));
      overflow: hidden;
      box-sizing: border-box;
      transition: border-color 0.15s ease;
      position: relative;
    }
    body.theme-studio .prop-monaco-wrapper {
      background: #ffffff;
      border-color: var(--border);
    }
    .prop-monaco-wrapper:focus-within {
      border-color: var(--accent);
    }
    .prop-monaco-single {
      height: 28px;
    }
    .prop-monaco-multi {
      height: 90px;
    }
    .prop-monaco-editor {
      width: 100%;
      height: 100%;
    }
    .prop-monaco-wrapper, .prop-monaco-editor, .prop-monaco-editor * {
      user-select: text !important;
    }
    .transform-editor-layout {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 260px;
      gap: 8px;
    }
    .dw-header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 12px;
    }
    body.theme-studio .dw-header-bar {
      background: #f0f4f8;
    }
    .dw-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dw-badge-version {
      font-family: var(--vscode-editor-font-family, monospace);
      font-weight: 700;
      color: #c586c0;
      background: rgba(197, 134, 192, 0.15);
      padding: 2px 6px;
      border-radius: 3px;
    }
    .dw-header-sep {
      color: var(--text-muted);
    }
    .dw-header-label {
      font-family: var(--vscode-editor-font-family, monospace);
      color: #4fc1ff;
      font-weight: 600;
    }
    .dw-output-select {
      background: var(--vscode-dropdown-background, #252526);
      color: var(--fg);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 2px 8px;
      font-size: 11px;
      font-family: var(--vscode-editor-font-family, monospace);
      outline: none;
    }
    .dw-target-badge {
      font-size: 11px;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.05);
      padding: 2px 8px;
      border-radius: 10px;
    }
    .dw-main-editor-wrapper {
      flex: 1;
      min-height: 170px;
      height: 200px;
      border: 1px solid var(--border);
      border-radius: 4px;
      overflow: hidden;
      background: var(--vscode-editor-background, #1e1e1e);
      position: relative;
    }
    .dw-monaco-editor {
      width: 100%;
      height: 100%;
      min-height: 170px;
    }
    .dw-variables-section {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dw-variables-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .dw-variables-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dw-var-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
    }
    .dw-var-name {
      width: 130px;
      flex-shrink: 0;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
    }
    .dw-var-val {
      flex: 1;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
    }
    .prop-desc {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.35;
    }
    .prop-form-checkbox {
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }
    .prop-checkbox-label {
      font-size: 12px;
      color: var(--fg);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .prop-checkbox-label input[type="checkbox"] {
      cursor: pointer;
      accent-color: var(--accent);
    }
    /* Repeatable + Add list */
    .prop-list-group {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px;
      background: rgba(0,0,0,0.08);
    }
    .prop-list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .prop-btn-add {
      background: var(--accent);
      color: #ffffff;
      border: none;
      border-radius: 3px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }
    .prop-btn-add:hover {
      opacity: 0.9;
    }
    .prop-list-items {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .prop-list-item-row {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    /* Collapsible complex object */
    .prop-complex-group {
      border: 1px solid var(--border);
      border-radius: 6px;
      background: rgba(0,0,0,0.06);
      padding: 6px 10px;
    }
    .prop-complex-summary {
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: var(--fg);
      display: flex;
      align-items: center;
      gap: 6px;
      outline: none;
      user-select: none;
    }
    .prop-complex-body {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid var(--border);
    }
    /* Modal dialog */
    .config-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.65);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(2px);
    }
    .config-modal-overlay.hidden {
      display: none !important;
    }
    .config-modal-box {
      background: var(--vscode-editor-background, #1e1e1e);
      border: 1px solid var(--vscode-widget-border, #454545);
      border-radius: 6px;
      width: 520px;
      max-width: 90vw;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }
    .config-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .config-modal-title {
      font-weight: 600;
      font-size: 13px;
      color: var(--fg);
    }
    .config-modal-body {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .config-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--border);
    }
    .tool-btn-primary {
      background: var(--vscode-button-background, #0e639c) !important;
      color: var(--vscode-button-foreground, #ffffff) !important;
      border: none !important;
      padding: 5px 14px !important;
      border-radius: 3px !important;
      cursor: pointer !important;
      font-weight: 600 !important;
    }
    .tool-btn-primary:hover {
      background: var(--vscode-button-hoverBackground, #1177bb) !important;
    }
    /* Test Connection button and results */
    .test-connection-section {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .btn-test-connection {
      align-self: flex-start;
      background: var(--vscode-button-secondaryBackground, #3a3d41) !important;
      color: var(--vscode-button-secondaryForeground, #ffffff) !important;
      border: 1px solid var(--vscode-widget-border, #454545) !important;
      padding: 6px 14px !important;
      border-radius: 3px !important;
      cursor: pointer !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      transition: all 0.15s ease;
    }
    .btn-test-connection:hover:not(:disabled) {
      background: var(--vscode-button-secondaryHoverBackground, #45494e) !important;
    }
    .btn-test-connection:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .test-conn-result {
      font-size: 11px;
      line-height: 1.4;
      padding: 8px 12px;
      border-radius: 4px;
      display: none;
    }
    .test-conn-result.test-conn-success {
      display: block;
      background: rgba(46, 125, 50, 0.18);
      color: #81c784;
      border: 1px solid rgba(76, 175, 80, 0.4);
    }
    .test-conn-result.test-conn-error {
      display: block;
      background: rgba(198, 40, 40, 0.18);
      color: #e57373;
      border: 1px solid rgba(229, 115, 115, 0.4);
    }
  </style>
  <link rel="stylesheet" href="${monacoCssUri}">
</head>
<body>
  <div id="app-container">
    <!-- Flow Index Sidebar -->
    <div id="sidebar">
      <div id="sidebar-header">
        <span>Flows (<span id="flow-count">0</span>)</span>
      </div>
      <ul id="flow-list"></ul>
      <div id="sidebar-global-header" style="border-top: 1px solid var(--border); padding: 8px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: flex; justify-content: space-between; margin-top: 8px;">
        <span>Configurations (<span id="global-config-count">0</span>)</span>
      </div>
      <ul id="global-config-list" style="list-style: none; margin: 0; padding: 0;"></ul>
    </div>

    <!-- Main Content Area: Diagram Canvas above, Bottom Docked Properties below -->
    <div id="main-area">
      <!-- Main Canvas Viewport -->
      <div id="viewport">
        <div id="warning-banner"></div>

        <!-- Floating Toolbar -->
        <div id="toolbar">
          <div id="search-box">
            <input type="text" id="search-input" placeholder="Search (Ctrl+F)..." spellcheck="false" />
            <span id="search-count"></span>
          </div>
          <button class="tool-btn" id="btn-zoom-in" title="Zoom In (+)">+</button>
          <button class="tool-btn" id="btn-zoom-out" title="Zoom Out (−)">−</button>
          <button class="tool-btn" id="btn-zoom-reset" title="Reset Zoom (100%)">100%</button>
          <button class="tool-btn" id="btn-fit" title="Fit to View">Fit</button>
          <button class="tool-btn" id="btn-export-svg" title="Export as SVG">SVG</button>
          <button class="tool-btn" id="btn-export-png" title="Export as PNG">PNG</button>
          <button class="tool-btn" id="btn-toggle-sidebar" title="Toggle Flow List">☰</button>
          <button class="tool-btn" id="btn-toggle-properties" title="Toggle Properties Panel">⚙ Properties</button>
        </div>

        <!-- SVG Rendering Canvas -->
        <svg id="canvas-svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          <defs id="svg-defs">
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--lane-line)"/>
            </marker>
          </defs>
          <g id="scene-root"></g>
        </svg>
      </div>

      <!-- Docked Properties Bottom Panel -->
      <div id="properties-panel" class="properties-dock collapsed">
        <div id="properties-resizer" class="properties-resizer" title="Drag to resize"></div>
        <div class="properties-header">
          <div class="properties-header-title">
            <span class="properties-icon-chip" id="prop-icon">⚙</span>
            <div>
              <div class="properties-title" id="prop-title">Properties</div>
              <div class="properties-subtitle" id="prop-subtitle">Select a component</div>
            </div>
          </div>
          <div class="properties-header-actions">
            <button class="tool-btn" id="btn-goto-xml" title="Go to XML source (or double-click tile)">↗ XML</button>
            <button class="tool-btn" id="btn-close-properties" title="Close Properties">✕</button>
          </div>
        </div>
        
        <div class="properties-tabs" id="prop-tabs-header"></div>

        <div class="properties-content" id="prop-tabs-content">
          <div class="properties-empty-state" id="prop-empty">
            Click any processor or message source on the canvas to inspect its configuration and attributes.
          </div>
        </div>
      </div>
    </div>

    <!-- Create Configuration Modal -->
    <div id="config-modal-overlay" class="config-modal-overlay hidden">
      <div class="config-modal-box">
        <div class="config-modal-header">
          <span class="config-modal-title" id="config-modal-title">Create Configuration</span>
          <button type="button" class="tool-btn" id="config-modal-close" title="Close">✕</button>
        </div>
        <div class="config-modal-body">
          <div class="prop-form-group">
            <label class="prop-label">Configuration Name <span class="prop-required">*</span></label>
            <input type="text" id="config-new-name" class="prop-input" placeholder="e.g. HTTP_Listener_config" />
          </div>
          <div class="properties-tabs" id="config-modal-tabs-header"></div>
          <div class="properties-content" id="config-modal-tabs-content" style="padding: 10px 0;"></div>
        </div>
        <div class="config-modal-footer">
          <button type="button" class="tool-btn" id="config-modal-cancel">Cancel</button>
          <button type="button" class="tool-btn tool-btn-primary" id="config-modal-submit">Create Configuration</button>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    window.MonacoEnvironment = {
      getWorkerUrl: function(workerId, label) {
        return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(
          'self.MonacoEnvironment = { baseUrl: "' + '${monacoBaseUri}' + '/" };' +
          'try { importScripts("' + '${monacoBaseUri}' + '/editor/editor.worker.js"); } catch(e){}'
        );
      }
    };
  </script>
  <script nonce="${nonce}" src="${monacoLoaderUri}"></script>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let currentModel = null;
    let currentScene = null;
    let selectedNodeId = null;

    let monacoLoaded = false;
    const monacoReadyQueue = [];
    const activeMonacoEditors = new Map();

    let currentAutocompleteContext = {
      variables: [],
      precedingPayloadShape: null
    };

    if (typeof require !== 'undefined' && require.config) {
      require.config({
        paths: {
          'vs': '${monacoBaseUri}'
        }
      });
      require(['vs/editor/editor.main'], function() {
        registerDataWeaveLanguage();
        monacoLoaded = true;
        while (monacoReadyQueue.length > 0) {
          const fn = monacoReadyQueue.shift();
          try { fn(); } catch(e) { console.error('Error executing monaco callback', e); }
        }
      });
    }

    function getMonacoTheme() {
      return (document.body.classList.contains('vscode-light') || document.body.classList.contains('theme-studio'))
        ? 'dw-light'
        : 'dw-dark';
    }

    // Viewport transform state
    let scale = 1;
    let panX = 40;
    let panY = 40;
    let isDragging = false;
    let startDragX = 0;
    let startDragY = 0;

    const viewport = document.getElementById('viewport');
    const sceneRoot = document.getElementById('scene-root');
    const svgDefs = document.getElementById('svg-defs');
    const canvasSvg = document.getElementById('canvas-svg');
    const flowList = document.getElementById('flow-list');
    const flowCount = document.getElementById('flow-count');
    const searchInput = document.getElementById('search-input');
    const searchCount = document.getElementById('search-count');
    const sidebar = document.getElementById('sidebar');

    function updateTransform() {
      sceneRoot.setAttribute('transform', \`translate(\${panX}, \${panY}) scale(\${scale})\`);
    }

    // Zoom and Pan Handlers
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const mouseX = e.clientX - viewport.getBoundingClientRect().left;
      const mouseY = e.clientY - viewport.getBoundingClientRect().top;

      const newScale = Math.min(Math.max(0.15, scale * zoomFactor), 3);
      panX = mouseX - (mouseX - panX) * (newScale / scale);
      panY = mouseY - (mouseY - panY) * (newScale / scale);
      scale = newScale;
      updateTransform();
    }, { passive: false });

    viewport.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tile-group') || e.target.closest('#toolbar')) return;
      isDragging = true;
      viewport.classList.add('dragging');
      startDragX = e.clientX - panX;
      startDragY = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panX = e.clientX - startDragX;
      panY = e.clientY - startDragY;
      updateTransform();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      viewport.classList.remove('dragging');
    });

    document.getElementById('btn-zoom-in').onclick = () => {
      scale = Math.min(3, scale * 1.2);
      updateTransform();
    };
    document.getElementById('btn-zoom-out').onclick = () => {
      scale = Math.max(0.15, scale * 0.8);
      updateTransform();
    };
    document.getElementById('btn-zoom-reset').onclick = () => {
      scale = 1;
      panX = 40;
      panY = 40;
      updateTransform();
    };
    document.getElementById('btn-fit').onclick = () => {
      if (!currentScene) return;
      const vRect = viewport.getBoundingClientRect();
      const scaleX = (vRect.width - 80) / currentScene.totalWidth;
      const scaleY = (vRect.height - 80) / currentScene.totalHeight;
      scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.15), 1.2);
      panX = 40;
      panY = 40;
      updateTransform();
    };
    document.getElementById('btn-toggle-sidebar').onclick = () => {
      sidebar.classList.toggle('collapsed');
    };

    const propertiesPanel = document.getElementById('properties-panel');
    const propertiesResizer = document.getElementById('properties-resizer');
    document.getElementById('btn-toggle-properties').onclick = () => {
      propertiesPanel.classList.toggle('collapsed');
    };
    document.getElementById('btn-close-properties').onclick = () => {
      propertiesPanel.classList.add('collapsed');
    };

    // Draggable resize handle for bottom properties panel
    if (propertiesResizer && propertiesPanel) {
      let isResizing = false;
      let startY = 0;
      let startHeight = 0;

      propertiesResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = propertiesPanel.getBoundingClientRect().height;
        propertiesResizer.classList.add('resizing');
        propertiesPanel.style.transition = 'none';
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
      });

      window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const deltaY = e.clientY - startY;
        const newHeight = Math.max(100, Math.min(window.innerHeight - 80, startHeight - deltaY));
        propertiesPanel.style.height = newHeight + 'px';
      });

      window.addEventListener('mouseup', () => {
        if (isResizing) {
          isResizing = false;
          propertiesResizer.classList.remove('resizing');
          propertiesPanel.style.transition = '';
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }

    function findNodeById(id) {
      if (!currentModel || !id) return null;
      function searchNode(node) {
        if (!node) return null;
        if (node.id === id) return node;
        if (node.chain) {
          for (const c of node.chain) {
            const found = searchNode(c);
            if (found) return found;
          }
        }
        if (node.routes) {
          for (const r of node.routes) {
            if (r.chain) {
              for (const c of r.chain) {
                const found = searchNode(c);
                if (found) return found;
              }
            }
          }
        }
        return null;
      }
      for (const f of currentModel.flows) {
        if (f.source) {
          const found = searchNode(f.source);
          if (found) return found;
        }
        for (const c of f.chain) {
          const found = searchNode(c);
          if (found) return found;
        }
        if (f.errorHandler) {
          for (const r of f.errorHandler) {
            if (r.chain) {
              for (const c of r.chain) {
                const found = searchNode(c);
                if (found) return found;
              }
            }
          }
        }
      }
      if (currentModel && currentModel.globalConfigs) {
        for (const g of currentModel.globalConfigs) {
          const found = searchNode(g);
          if (found) return found;
        }
      }
      return null;
    }

    // ── Search Handling ─────────────────────────────────
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      const tiles = document.querySelectorAll('.tile-group');
      if (!q) {
        tiles.forEach(t => {
          t.classList.remove('dimmed', 'search-match');
        });
        searchCount.textContent = '';
        return;
      }

      let matches = 0;
      tiles.forEach(t => {
        const text = (t.getAttribute('data-search') || '').toLowerCase();
        if (text.includes(q)) {
          t.classList.remove('dimmed');
          t.classList.add('search-match');
          matches++;
        } else {
          t.classList.add('dimmed');
          t.classList.remove('search-match');
        }
      });
      searchCount.textContent = matches + ' match' + (matches === 1 ? '' : 'es');
    });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    // ── Export Handling ─────────────────────────────────
    document.getElementById('btn-export-svg').onclick = () => {
      vscode.postMessage({ type: 'exportScene', format: 'svg' });
    };
    document.getElementById('btn-export-png').onclick = () => {
      vscode.postMessage({ type: 'exportScene', format: 'png' });
    };

    // ── Message Protocol ─────────────────────────────────
    window.addEventListener('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'updateModel':
          currentModel = msg.model;
          currentScene = msg.scene;
          if (msg.theme === 'studio') {
            document.body.classList.add('theme-studio');
          } else {
            document.body.classList.remove('theme-studio');
          }
          if (window.monaco && monaco.editor) {
            monaco.editor.setTheme(getMonacoTheme());
          }
          const arrowMarker = '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--lane-line)"/></marker>';
          if (msg.symbolsSvg) {
            svgDefs.innerHTML = arrowMarker + msg.symbolsSvg;
          } else {
            svgDefs.innerHTML = arrowMarker;
          }
          renderScene(msg.scene, msg.model);
          break;

        case 'selectNode':
          highlightNode(msg.nodeId, true);
          const selNode = findNodeById(msg.nodeId);
          if (selNode && selNode.descriptor) {
            vscode.postMessage({
              type: 'showProperties',
              nodeId: selNode.id,
              namespaceUri: selNode.descriptor.namespaceUri,
              localName: selNode.descriptor.localName,
              attributes: selNode.attributes || {},
              isConfiguration: selNode.descriptor.kind === 'global-config',
            });
          }
          break;

        case 'updatePropertiesPanel':
          currentAutocompleteContext = msg.autocompleteContext || { variables: [], precedingPayloadShape: null };
          renderPropertiesPanel(msg);
          break;

        case 'testConnectionResult':
          handleTestConnectionResult(msg);
          break;

        case 'showWarning':
          const banner = document.getElementById('warning-banner');
          banner.textContent = msg.message;
          banner.style.display = 'block';
          setTimeout(() => { banner.style.display = 'none'; }, 6000);
          break;
      }
    });

    function highlightNode(nodeId, scrollTo) {
      document.querySelectorAll('.tile-group').forEach(t => t.classList.remove('selected'));
      selectedNodeId = nodeId;
      if (!nodeId) return;

      const target = document.querySelector('[data-node-id="' + nodeId + '"]');
      if (target) {
        target.classList.add('selected');
        if (scrollTo) {
          const bbox = target.getBBox();
          const targetX = bbox.x * scale + panX;
          const targetY = bbox.y * scale + panY;
          const vRect = viewport.getBoundingClientRect();
          if (targetX < 50 || targetX > vRect.width - 150 || targetY < 50 || targetY > vRect.height - 150) {
            panX = vRect.width / 2 - (bbox.x + bbox.width / 2) * scale;
            panY = vRect.height / 2 - (bbox.y + bbox.height / 2) * scale;
            updateTransform();
          }
        }
      }
    }

    // ── Scene Renderer ──────────────────────────────────
    function renderScene(scene, model) {
      // 1. Update Flow Index Sidebar
      flowList.innerHTML = '';
      flowCount.textContent = scene.flows.length;

      scene.flows.forEach((flow, idx) => {
        const li = document.createElement('li');
        li.className = 'flow-item';
        li.innerHTML = '<span class="flow-item-icon">' + (flow.flowModel.type === 'sub-flow' ? '⚡' : '⮞') + '</span> ' + escapeHtml(flow.flowModel.name);
        li.onclick = () => {
          document.querySelectorAll('.flow-item').forEach(i => i.classList.remove('active'));
          li.classList.add('active');
          panX = 40;
          panY = 40 - flow.y * scale;
          updateTransform();
        };
        flowList.appendChild(li);
      });

      // 1b. Update Global Configurations in Sidebar
      const globalList = document.getElementById('global-config-list');
      const globalCount = document.getElementById('global-config-count');
      const globalHeader = document.getElementById('sidebar-global-header');
      if (globalList) {
        globalList.innerHTML = '';
        const gConfigs = (model && model.globalConfigs) ? model.globalConfigs : [];
        if (globalCount) globalCount.textContent = gConfigs.length;
        if (globalHeader) globalHeader.style.display = gConfigs.length > 0 ? 'flex' : 'none';

        gConfigs.forEach(gNode => {
          const li = document.createElement('li');
          li.className = 'flow-item';
          const name = gNode.attributes['name'] || gNode.label || gNode.descriptor.displayName;
          li.innerHTML = '<span class="flow-item-icon">⚙</span> ' + escapeHtml(name);
          li.title = gNode.descriptor.localName + (gNode.attributes['name'] ? ' (' + gNode.attributes['name'] + ')' : '');
          li.onclick = () => {
            document.querySelectorAll('.flow-item').forEach(i => i.classList.remove('active'));
            li.classList.add('active');
            vscode.postMessage({
              type: 'showProperties',
              nodeId: gNode.id,
              namespaceUri: gNode.descriptor.namespaceUri,
              localName: gNode.descriptor.localName,
              attributes: gNode.attributes || {},
              isConfiguration: true
            });
          };
          globalList.appendChild(li);
        });
      }

      // 2. Render SVG Scene
      let svgHtml = '';

      for (const flow of scene.flows) {
        svgHtml += renderFlow(flow);
      }

      sceneRoot.innerHTML = svgHtml;
      updateTransform();

      // Bind tile clicks — single click only opens Properties
      document.querySelectorAll('.tile-group').forEach(tile => {
        tile.addEventListener('click', (e) => {
          e.stopPropagation();
          const nodeId = tile.getAttribute('data-node-id');
          const flowRefTarget = tile.getAttribute('data-flow-ref');

          highlightNode(nodeId, false);

          if (flowRefTarget) {
            // Scroll to local flow target if present
            const targetFlow = scene.flows.find(f => f.flowModel.name === flowRefTarget);
            if (targetFlow) {
              panX = 40;
              panY = 40 - targetFlow.y * scale;
              updateTransform();
            } else {
              vscode.postMessage({ type: 'navigateFlowRef', flowName: flowRefTarget });
            }
          }

          // Send showProperties message to host
          const clickedNode = findNodeById(nodeId);
          if (clickedNode && clickedNode.descriptor) {
            vscode.postMessage({
              type: 'showProperties',
              nodeId: clickedNode.id,
              namespaceUri: clickedNode.descriptor.namespaceUri,
              localName: clickedNode.descriptor.localName,
              attributes: clickedNode.attributes || {},
            });
          }
        });

        // Double-click navigates to XML source
        tile.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const rangeJson = tile.getAttribute('data-range');
          if (rangeJson) {
            try {
              const range = JSON.parse(rangeJson);
              vscode.postMessage({ type: 'revealXml', range, focusEditor: true });
            } catch {}
          }
        });
      });

      // Bind flow header collapse toggles
      document.querySelectorAll('.flow-header-toggle').forEach(header => {
        header.addEventListener('click', (e) => {
          e.stopPropagation();
          const flowId = header.getAttribute('data-flow-id');
          vscode.postMessage({ type: 'toggleCollapse', nodeId: flowId });
        });
      });

      // Bind error band collapse toggles
      document.querySelectorAll('.error-band-toggle').forEach(header => {
        header.addEventListener('click', (e) => {
          e.stopPropagation();
          const errBandId = header.getAttribute('data-node-id');
          vscode.postMessage({ type: 'toggleCollapse', nodeId: errBandId });
        });
      });

      // Bind container header collapse toggles
      document.querySelectorAll('.container-header-toggle').forEach(header => {
        header.addEventListener('click', (e) => {
          e.stopPropagation();
          const nodeId = header.getAttribute('data-node-id');
          vscode.postMessage({ type: 'toggleCollapse', nodeId });
        });
      });

      // Bind collapsed container tiles (expand on click + show properties, no XML reveal)
      document.querySelectorAll('.container-collapsed-tile').forEach(tile => {
        tile.addEventListener('click', (e) => {
          e.stopPropagation();
          const nodeId = tile.getAttribute('data-node-id');
          const clickedNode = findNodeById(nodeId);
          if (clickedNode && clickedNode.descriptor) {
            vscode.postMessage({
              type: 'showProperties',
              nodeId: clickedNode.id,
              namespaceUri: clickedNode.descriptor.namespaceUri,
              localName: clickedNode.descriptor.localName,
              attributes: clickedNode.attributes || {},
            });
          }
          vscode.postMessage({ type: 'toggleCollapse', nodeId });
        });

        // Double-click navigates to XML source
        tile.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const rangeJson = tile.getAttribute('data-range');
          if (rangeJson) {
            try {
              const range = JSON.parse(rangeJson);
              vscode.postMessage({ type: 'revealXml', range, focusEditor: true });
            } catch {}
          }
        });
      });
    }

    function renderFlow(flow) {
      const isSubFlow = flow.flowModel.type === 'sub-flow';
      const isCollapsed = flow.flowModel.collapsed;
      const chevron = isCollapsed ? '▶' : '▼';
      const processorCount = flow.flowModel.chain.length + (flow.flowModel.source ? 1 : 0);

      let html = \`<g class="flow-group" id="flow-\${flow.flowId}">
        <!-- Flow Box -->
        <rect class="flow-box \${isCollapsed ? 'flow-box-collapsed' : ''}" x="\${flow.x}" y="\${flow.y}" width="\${flow.width}" height="\${flow.height}" />

        <!-- Header Strip with Dropdown Icon -->
        <g class="flow-header-toggle" data-flow-id="\${flow.flowId}" style="cursor: pointer;" title="\${isCollapsed ? 'Click to expand flow' : 'Click to minimize flow'}">
          <path class="flow-header-rect" d="M \${flow.x} \${flow.y + 8} A 8 8 0 0 1 \${flow.x + 8} \${flow.y} L \${flow.x + flow.width - 8} \${flow.y} A 8 8 0 0 1 \${flow.x + flow.width} \${flow.y + 8} L \${flow.x + flow.width} \${flow.y + 32} L \${flow.x} \${flow.y + 32} Z" />

          <!-- Dropdown Chevron Button -->
          <g class="flow-chevron-btn" data-flow-id="\${flow.flowId}">
            <rect x="\${flow.x + 10}" y="\${flow.y + 6}" width="20" height="20" rx="4" fill="rgba(255,255,255,0.08)" />
            <text class="flow-chevron-text" x="\${flow.x + 20}" y="\${flow.y + 17}" text-anchor="middle" dominant-baseline="central" font-size="11" fill="var(--fg)">\${chevron}</text>
          </g>

          <text class="flow-title" x="\${flow.x + 38}" y="\${flow.y + 16}">\${escapeHtml(flow.flowModel.name)}</text>
          \${isCollapsed 
            ? \`<text class="flow-collapsed-badge" x="\${flow.x + flow.width - 16}" y="\${flow.y + 16}" text-anchor="end">\${processorCount} processors (minimized - click to expand)</text>\`
            : \`<text class="flow-badge" x="\${flow.x + flow.width - 16}" y="\${flow.y + 16}" text-anchor="end">\${isSubFlow ? 'SUB-FLOW' : 'FLOW'}</text>\`
          }
        </g>
      \`;

      if (isCollapsed) {
        html += \`</g>\`;
        return html;
      }

      // Source Compartment & Divider
      if (flow.sourceBox && flow.source) {
        const dividerX = flow.sourceBox.x + flow.sourceBox.width + 6;
        html += \`<line class="source-divider" x1="\${dividerX}" y1="\${flow.sourceBox.y}" x2="\${dividerX}" y2="\${flow.sourceBox.y + flow.sourceBox.height}" />\`;
        html += renderNode(flow.source);
      }

      // Process Lane Line
      if (flow.chain.length > 0) {
        const first = flow.chain[0];
        const last = flow.chain[flow.chain.length - 1];
        const laneY = first.laneY;
        const startX = (flow.sourceBox && flow.source) ? (flow.sourceBox.x + flow.sourceBox.width + 12) : flow.processBox.x;
        const endX = last.x + last.width;
        html += \`<line class="lane-line" x1="\${startX}" y1="\${laneY}" x2="\${endX}" y2="\${laneY}" marker-end="url(#arrow)" />\`;

        // Inbound and inter-node connectors with arrowheads
        html += \`<line class="lane-line" x1="\${startX}" y1="\${laneY}" x2="\${first.x}" y2="\${laneY}" marker-end="url(#arrow)" />\`;
        for (let i = 0; i < flow.chain.length - 1; i++) {
          const fromNode = flow.chain[i];
          const toNode = flow.chain[i + 1];
          html += \`<line class="lane-line" x1="\${fromNode.x + fromNode.width}" y1="\${laneY}" x2="\${toNode.x}" y2="\${laneY}" marker-end="url(#arrow)" />\`;
        }
      }

      // Process Chain Nodes
      for (const node of flow.chain) {
        html += renderNode(node);
      }

      // Error Handling Band with Dropdown Toggle
      if (flow.errorBandBox) {
        const isErrCollapsed = flow.errorCollapsed ?? false;
        const errChevron = isErrCollapsed ? '▶' : '▼';
        const errCount = flow.flowModel.errorHandler.length;
        const errBandId = \`\${flow.flowId}:errorBand\`;

        html += \`
          <rect class="error-band-rect" x="\${flow.errorBandBox.x}" y="\${flow.errorBandBox.y}" width="\${flow.errorBandBox.width}" height="\${flow.errorBandBox.height}" />

          <!-- Header Strip with Dropdown Icon -->
          <g class="error-band-toggle" data-node-id="\${errBandId}" style="cursor: pointer;" title="\${isErrCollapsed ? 'Click to expand error handling' : 'Click to minimize error handling'}">
            <rect class="error-band-header-rect" x="\${flow.errorBandBox.x}" y="\${flow.errorBandBox.y}" width="\${flow.errorBandBox.width}" height="28" rx="6" fill="rgba(229,57,53,0.06)" />

            <!-- Dropdown Chevron Button -->
            <rect class="error-band-chevron-bg" x="\${flow.errorBandBox.x + 8}" y="\${flow.errorBandBox.y + 5}" width="18" height="18" rx="3" fill="rgba(229,57,53,0.15)" />
            <text class="error-band-chevron-text" x="\${flow.errorBandBox.x + 17}" y="\${flow.errorBandBox.y + 15}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="#e53935">\${errChevron}</text>

            <text class="error-band-title" x="\${flow.errorBandBox.x + 34}" y="\${flow.errorBandBox.y + 15}">Error Handling</text>
            \${isErrCollapsed 
              ? \`<text class="error-band-collapsed-badge" x="\${flow.errorBandBox.x + flow.errorBandBox.width - 12}" y="\${flow.errorBandBox.y + 15}" text-anchor="end">\${errCount} handler\${errCount === 1 ? '' : 's'} (minimized - click to expand)</text>\`
              : \`<text class="error-band-badge" x="\${flow.errorBandBox.x + flow.errorBandBox.width - 12}" y="\${flow.errorBandBox.y + 15}" text-anchor="end">\${errCount} handler\${errCount === 1 ? '' : 's'}</text>\`
            }
          </g>
        \`;

        if (!isErrCollapsed && flow.errorHandlers.length > 0) {
          for (const ehRoute of flow.errorHandlers) {
            html += renderRoute(ehRoute, false);
          }
        }
      }

      html += \`</g>\`;
      return html;
    }

    function renderNode(pNode) {
      let html = '';
      const kind = pNode.node.descriptor.kind;

      // 1. Collapsed Container Node (Scope or Router)
      if (pNode.node.collapsed) {
        const rangeStr = escapeHtml(JSON.stringify(pNode.node.range));
        const searchData = escapeHtml(\`\${pNode.node.label} \${pNode.node.subtitle || ''} \${pNode.node.descriptor.displayName}\`);
        const badgeCount = pNode.collapsedBadgeCount || (pNode.node.chain.length + pNode.node.routes.length) || 1;

        html += \`
          <g class="tile-group container-collapsed-tile" data-node-id="\${pNode.nodeId}" data-range="\${rangeStr}" data-search="\${searchData}" style="cursor: pointer;" title="Click to expand \${escapeHtml(pNode.node.label)} (\${badgeCount} processors)">
            <!-- Tile Box with dashed container outline -->
            <rect class="tile-rect container-collapsed-rect" x="\${pNode.x}" y="\${pNode.y}" width="\${pNode.width}" height="\${pNode.height}" />

            <!-- Dropdown Chevron Button (Expand ▶) -->
            <g class="container-chevron-btn" data-node-id="\${pNode.nodeId}">
              <rect class="container-chevron-bg" x="\${pNode.x + 6}" y="\${pNode.y + 6}" width="18" height="18" rx="3" fill="rgba(255,255,255,0.08)" />
              <text class="container-chevron-text" x="\${pNode.x + 15}" y="\${pNode.y + 16}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="var(--fg)">▶</text>
            </g>

            <!-- +N Badge -->
            <rect x="\${pNode.x + pNode.width - 34}" y="\${pNode.y + 6}" width="28" height="18" rx="9" fill="var(--accent)" fill-opacity="0.25" />
            <text x="\${pNode.x + pNode.width - 20}" y="\${pNode.y + 16}" text-anchor="middle" dominant-baseline="central" font-size="9.5" font-weight="700" fill="var(--accent)">+\${badgeCount}</text>

            <!-- Icon -->
            <use xlink:href="#\${pNode.node.descriptor.iconId}" x="\${pNode.x + 41}" y="\${pNode.y + 24}" width="38" height="38" />

            <!-- Labels -->
            <text class="tile-title" x="\${pNode.x + 60}" y="\${pNode.y + 70}">\${escapeHtml(truncate(pNode.node.label, 15))}</text>
            <text class="tile-subtitle" x="\${pNode.x + 60}" y="\${pNode.y + 82}">(minimized)</text>
          </g>
        \`;
        return html;
      }

      // 2. Expanded Scope or Router Container
      if (pNode.children.length > 0 || pNode.routes.length > 0) {
        html += \`
          <rect class="container-box" x="\${pNode.x}" y="\${pNode.y}" width="\${pNode.width}" height="\${pNode.height}" />

          <!-- Header Strip with Dropdown Chevron Button -->
          <g class="container-header-toggle" data-node-id="\${pNode.nodeId}" style="cursor: pointer;" title="Click to minimize \${escapeHtml(pNode.node.label)}">
            <rect class="container-header-rect" x="\${pNode.x}" y="\${pNode.y}" width="\${pNode.width}" height="28" rx="6" fill="rgba(255, 255, 255, 0.04)" />

            <!-- Dropdown Chevron Button (Minimize ▼) -->
            <g class="container-chevron-btn" data-node-id="\${pNode.nodeId}">
              <rect class="container-chevron-bg" x="\${pNode.x + 8}" y="\${pNode.y + 5}" width="18" height="18" rx="3" fill="rgba(255,255,255,0.08)" />
              <text class="container-chevron-text" x="\${pNode.x + 17}" y="\${pNode.y + 15}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="var(--fg)">▼</text>
            </g>

            <use xlink:href="#\${pNode.node.descriptor.iconId}" x="\${pNode.x + 32}" y="\${pNode.y + 6}" width="16" height="16" />
            <text class="container-header-title" x="\${pNode.x + 52}" y="\${pNode.y + 15}">\${escapeHtml(pNode.node.label)}</text>
          </g>
        \`;

        // Scopes: horizontal lane line through children
        if (pNode.children.length > 0) {
          const first = pNode.children[0];
          const last = pNode.children[pNode.children.length - 1];
          html += \`<line class="lane-line" x1="\${pNode.x + 8}" y1="\${first.laneY}" x2="\${last.x + last.width}" y2="\${first.laneY}" marker-end="url(#arrow)" />\`;
          html += \`<line class="lane-line" x1="\${pNode.x + 8}" y1="\${first.laneY}" x2="\${first.x}" y2="\${first.laneY}" marker-end="url(#arrow)" />\`;
          for (let i = 0; i < pNode.children.length - 1; i++) {
            const fromChild = pNode.children[i];
            const toChild = pNode.children[i + 1];
            html += \`<line class="lane-line" x1="\${fromChild.x + fromChild.width}" y1="\${first.laneY}" x2="\${toChild.x}" y2="\${first.laneY}" marker-end="url(#arrow)" />\`;
          }
          for (const child of pNode.children) {
            html += renderNode(child);
          }
        }

        // Routers: vertical spine bracket and routes
        if (pNode.routes.length > 0) {
          const spineX = pNode.x + 20;
          const firstLaneY = pNode.routes[0].laneY;
          const lastLaneY = pNode.routes[pNode.routes.length - 1].laneY;
          const centerLaneY = pNode.laneY;

          // Incoming lane to spine (enters at the exact vertical center of the spine)
          html += \`<line class="lane-line" x1="\${pNode.x}" y1="\${centerLaneY}" x2="\${spineX}" y2="\${centerLaneY}" marker-end="url(#arrow)" />\`;
          // Vertical spine
          html += \`<line class="router-spine" x1="\${spineX}" y1="\${firstLaneY}" x2="\${spineX}" y2="\${lastLaneY}" />\`;

          for (const route of pNode.routes) {
            html += renderRoute(route, true, spineX);
          }

          // Rejoin bracket on the right
          const rejoinX = pNode.x + pNode.width - 20;
          html += \`<line class="router-spine" x1="\${rejoinX}" y1="\${firstLaneY}" x2="\${rejoinX}" y2="\${lastLaneY}" />\`;
          // Outgoing lane from spine (exits at the exact vertical center of the spine)
          html += \`<line class="lane-line" x1="\${rejoinX}" y1="\${centerLaneY}" x2="\${pNode.x + pNode.width}" y2="\${centerLaneY}" marker-end="url(#arrow)" />\`;
          for (const route of pNode.routes) {
            const rLastNode = route.children.length > 0 ? route.children[route.children.length - 1] : null;
            const rEndX = rLastNode ? (rLastNode.x + rLastNode.width) : (route.x + 60);
            html += \`<line class="lane-line" x1="\${rEndX}" y1="\${route.laneY}" x2="\${rejoinX}" y2="\${route.laneY}" marker-end="url(#arrow)" />\`;
          }
        }

        return html;
      }

      // 3. Leaf Tile (Operation, Source, flow-ref, ee:transform)
      const rangeStr = escapeHtml(JSON.stringify(pNode.node.range));
      const searchData = escapeHtml(\`\${pNode.node.label} \${pNode.node.subtitle || ''} \${pNode.node.descriptor.displayName}\`);
      const isFlowRef = pNode.node.localName === 'flow-ref' || pNode.node.descriptor.localName === 'flow-ref';
      const flowRefTarget = isFlowRef ? (pNode.node.attributes['name'] || '') : '';
      const fullTitle = pNode.node.label + (pNode.node.subtitle ? ' (' + pNode.node.subtitle + ')' : '');

      const displayTitle = truncate(pNode.node.label, 15);
      const displaySubtitle = pNode.node.subtitle ? truncate(pNode.node.subtitle, 16) : '';

      html += \`
        <g class="tile-group" data-node-id="\${pNode.nodeId}" data-range="\${rangeStr}" data-search="\${searchData}" \${flowRefTarget ? \`data-flow-ref="\${escapeHtml(flowRefTarget)}"\` : ''} title="\${escapeHtml(fullTitle)}">
          <!-- Tile Box -->
          <rect class="tile-rect" x="\${pNode.x}" y="\${pNode.y}" width="\${pNode.width}" height="\${pNode.height}" />

          <!-- Icon Chip & SVG Icon -->
          <rect class="tile-icon-chip" x="\${pNode.x + 38}" y="\${pNode.y + 6}" width="44" height="44" rx="22" />
          <use xlink:href="#\${pNode.node.descriptor.iconId}" x="\${pNode.x + 38}" y="\${pNode.y + 6}" width="44" height="44" />
          
          <!-- Labels with safe width fitting -->
          <text class="tile-title" x="\${pNode.x + 60}" y="\${pNode.y + 65}">\${escapeHtml(displayTitle)}</text>
          \${displaySubtitle ? \`<text class="tile-subtitle" x="\${pNode.x + 60}" y="\${pNode.y + 78}">\${escapeHtml(displaySubtitle)}</text>\` : ''}

          \${isFlowRef ? \`<text x="\${pNode.x + pNode.width - 12}" y="\${pNode.y + 14}" font-size="11" fill="var(--accent)">↗</text>\` : ''}
        </g>
      \`;

      return html;
    }

    function renderRoute(route, isRouterBranch, spineX = 0) {
      let html = '';
      if (isRouterBranch) {
        // Horizontal stub from spine into route
        html += \`<line class="lane-line" x1="\${spineX}" y1="\${route.laneY}" x2="\${route.x}" y2="\${route.laneY}" marker-end="url(#arrow)" />\`;
      }

      // Route Label with max-width protection so it NEVER extends past route.width
      const maxChars = Math.max(12, Math.floor((route.width - 24) / 7));
      const displayLabel = truncate(route.route.label, maxChars);

      html += \`
        <g class="route-label-group" title="\${escapeHtml(route.route.label)}">
          <text class="container-header-title route-header-label" x="\${route.x + 6}" y="\${route.y + 14}">\${escapeHtml(displayLabel)}</text>
        </g>
      \`;

      // Lane line across route
      if (route.children.length > 0) {
        const first = route.children[0];
        const last = route.children[route.children.length - 1];
        html += \`<line class="lane-line" x1="\${route.x + 4}" y1="\${route.laneY}" x2="\${last.x + last.width}" y2="\${route.laneY}" marker-end="url(#arrow)" />\`;
        html += \`<line class="lane-line" x1="\${route.x + 4}" y1="\${route.laneY}" x2="\${first.x}" y2="\${route.laneY}" marker-end="url(#arrow)" />\`;
        for (let i = 0; i < route.children.length - 1; i++) {
          const fromChild = route.children[i];
          const toChild = route.children[i + 1];
          html += \`<line class="lane-line" x1="\${fromChild.x + fromChild.width}" y1="\${route.laneY}" x2="\${toChild.x}" y2="\${route.laneY}" marker-end="url(#arrow)" />\`;
        }
        for (const child of route.children) {
          html += renderNode(child);
        }
      }

      return html;
    }

    function renderTransformEditor(data) {
      const tabsHeader = document.getElementById('prop-tabs-header');
      const tabsContent = document.getElementById('prop-tabs-content');
      tabsHeader.style.display = 'none';
      tabsContent.innerHTML = '';

      const transformData = data.transformData || {
        script: '%dw 2.0\\noutput application/json\\n---\\n{\\n}',
        targetVariables: [],
        outputType: 'application/json'
      };

      const container = document.createElement('div');
      container.className = 'transform-editor-layout';

      // Header Bar: %dw 2.0 / output [select]
      const headerBar = document.createElement('div');
      headerBar.className = 'dw-header-bar';

      const leftDiv = document.createElement('div');
      leftDiv.className = 'dw-header-left';
      leftDiv.innerHTML = 
        '<span class="dw-badge-version">%dw 2.0</span>' +
        '<span class="dw-header-sep">/</span>' +
        '<label class="dw-header-label">output</label>' +
        '<select class="dw-output-select" id="dw-output-type">' +
          '<option value="application/json">application/json</option>' +
          '<option value="application/xml">application/xml</option>' +
          '<option value="application/java">application/java</option>' +
          '<option value="application/csv">application/csv</option>' +
          '<option value="text/plain">text/plain</option>' +
          '<option value="application/octet-stream">application/octet-stream</option>' +
        '</select>';

      const outputSelect = leftDiv.querySelector('#dw-output-type');
      if (outputSelect) {
        outputSelect.value = transformData.outputType || 'application/json';
        if (!outputSelect.value) {
          const opt = document.createElement('option');
          opt.value = transformData.outputType;
          opt.textContent = transformData.outputType;
          opt.selected = true;
          outputSelect.appendChild(opt);
        }
      }

      const rightDiv = document.createElement('div');
      rightDiv.className = 'dw-header-right';
      rightDiv.innerHTML = '<span class="dw-target-badge">Payload (Target: payload)</span>';

      headerBar.appendChild(leftDiv);
      headerBar.appendChild(rightDiv);
      container.appendChild(headerBar);

      // Main Monaco Editor Wrapper
      const editorWrapper = document.createElement('div');
      editorWrapper.className = 'dw-main-editor-wrapper';

      const editorHost = document.createElement('div');
      editorHost.className = 'dw-monaco-editor';
      editorWrapper.appendChild(editorHost);
      container.appendChild(editorWrapper);

      let mainEditor = null;

      function createMainTransformEditor() {
        // ── DIAGNOSTIC 1: guard conditions ──
        console.log('[DW-DIAG] createMainTransformEditor called');
        console.log('[DW-DIAG]   window.monaco exists:', !!window.monaco);
        console.log('[DW-DIAG]   monacoLoaded:', monacoLoaded);
        if (!window.monaco || !monacoLoaded) {
          console.log('[DW-DIAG]   → queued (monaco not ready)');
          monacoReadyQueue.push(createMainTransformEditor);
          return;
        }
        console.log('[DW-DIAG]   mainEditor already set:', !!mainEditor);
        console.log('[DW-DIAG]   editorWrapper.isConnected:', editorWrapper.isConnected);
        if (mainEditor || !editorWrapper.isConnected) {
          console.log('[DW-DIAG]   → short-circuited (mainEditor=' + !!mainEditor + ', isConnected=' + editorWrapper.isConnected + ')');
          return;
        }

        // ── DIAGNOSTIC 2: container dimensions before creation ──
        const hostRect = editorHost.getBoundingClientRect();
        const wrapRect = editorWrapper.getBoundingClientRect();
        console.log('[DW-DIAG]   editorHost rect BEFORE create:', JSON.stringify({w: hostRect.width, h: hostRect.height, t: hostRect.top, l: hostRect.left}));
        console.log('[DW-DIAG]   editorWrapper rect BEFORE create:', JSON.stringify({w: wrapRect.width, h: wrapRect.height, t: wrapRect.top, l: wrapRect.left}));
        console.log('[DW-DIAG]   editorHost offsetParent:', editorHost.offsetParent ? editorHost.offsetParent.tagName + '#' + editorHost.offsetParent.id : 'null');

        mainEditor = monaco.editor.create(editorHost, {
          value: transformData.script || '',
          language: 'dataweave',
          theme: getMonacoTheme(),
          automaticLayout: true,
          lineNumbers: 'on',
          glyphMargin: false,
          folding: true,
          overviewRulerLanes: 0,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          minimap: { enabled: false },
          fixedOverflowWidgets: true,
          tabSize: 2,
          fontSize: 12,
          fontFamily: 'var(--vscode-editor-font-family, Consolas, "Courier New", monospace)'
        });

        console.log('[DW-DIAG]   mainEditor created successfully:', !!mainEditor);

        // ── DIAGNOSTIC 2b: container dimensions AFTER creation ──
        const hostRect2 = editorHost.getBoundingClientRect();
        console.log('[DW-DIAG]   editorHost rect AFTER create:', JSON.stringify({w: hostRect2.width, h: hostRect2.height}));

        // ── DIAGNOSTIC 3: pointer-event / focus / overlay check ──
        const domNode = mainEditor.getDomNode();
        console.log('[DW-DIAG]   editor domNode:', domNode ? domNode.tagName + '.' + domNode.className.split(' ').slice(0,2).join('.') : 'null');
        if (domNode) {
          const cs = window.getComputedStyle(domNode);
          console.log('[DW-DIAG]   editor domNode pointer-events:', cs.pointerEvents);
          console.log('[DW-DIAG]   editor domNode visibility:', cs.visibility);
          console.log('[DW-DIAG]   editor domNode display:', cs.display);
          console.log('[DW-DIAG]   editor domNode overflow:', cs.overflow);

          // Check if the textarea that Monaco uses for input exists and is reachable
          const ta = domNode.querySelector('textarea.inputarea');
          if (ta) {
            const taRect = ta.getBoundingClientRect();
            console.log('[DW-DIAG]   Monaco inputarea textarea found, rect:', JSON.stringify({w: taRect.width, h: taRect.height, t: taRect.top, l: taRect.left}));
            const taCS = window.getComputedStyle(ta);
            console.log('[DW-DIAG]   textarea pointer-events:', taCS.pointerEvents, 'opacity:', taCS.opacity, 'position:', taCS.position);
          } else {
            console.log('[DW-DIAG]   ⚠ Monaco inputarea textarea NOT FOUND');
          }
        }

        // ── DIAGNOSTIC 3b: check what element is at the center of the editor ──
        setTimeout(function() {
          const r = editorHost.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const topEl = document.elementFromPoint(cx, cy);
          console.log('[DW-DIAG]   elementFromPoint at editor center:', topEl ? topEl.tagName + '.' + (topEl.className || '').toString().split(' ').slice(0,3).join('.') : 'null');
          if (topEl && !editorHost.contains(topEl)) {
            console.log('[DW-DIAG]   ⚠ TOP ELEMENT IS NOT INSIDE EDITOR HOST — something is overlaying the editor');
          } else {
            console.log('[DW-DIAG]   ✓ Top element is inside editor host');
          }
        }, 100);

        // ── DIAGNOSTIC 3c: add click/focus listeners for tracing ──
        editorHost.addEventListener('mousedown', function(ev) {
          console.log('[DW-DIAG] editorHost mousedown, target:', ev.target.tagName + '.' + (ev.target.className || '').toString().split(' ').slice(0,2).join('.'));
        }, true);
        editorHost.addEventListener('focusin', function(ev) {
          console.log('[DW-DIAG] editorHost focusin, target:', ev.target.tagName + '.' + (ev.target.className || '').toString().split(' ').slice(0,2).join('.'));
        }, true);
        editorHost.addEventListener('keydown', function(ev) {
          console.log('[DW-DIAG] editorHost keydown, key:', ev.key, 'target:', ev.target.tagName);
        }, true);

        let scriptTimer;
        mainEditor.onDidChangeModelContent(function() {
          console.log('[DW-DIAG] onDidChangeModelContent fired! new length:', mainEditor.getValue().length);
          clearTimeout(scriptTimer);
          scriptTimer = setTimeout(function() {
            const raw = mainEditor.getValue();
            sendParamUpdate(data.nodeId, '__transform_payload__', raw, 'dataweave');
          }, 400);
        });

        activeMonacoEditors.set(data.nodeId + '::__transform_main__', mainEditor);
        setTimeout(function() {
          if (mainEditor) {
            mainEditor.layout();
            // ── DIAGNOSTIC 2c: dimensions after layout() ──
            const hostRect3 = editorHost.getBoundingClientRect();
            console.log('[DW-DIAG]   editorHost rect AFTER layout():', JSON.stringify({w: hostRect3.width, h: hostRect3.height}));
          }
        }, 30);

        // ── DIAGNOSTIC 4: check if MonacoEnvironment worker creation causes errors ──
        console.log('[DW-DIAG]   MonacoEnvironment:', window.MonacoEnvironment ? 'set' : 'NOT SET');
        if (window.MonacoEnvironment && window.MonacoEnvironment.getWorkerUrl) {
          try {
            const workerUrl = window.MonacoEnvironment.getWorkerUrl('', 'editorWorkerService');
            console.log('[DW-DIAG]   worker URL starts with:', (workerUrl || '').slice(0, 80));
          } catch(wErr) {
            console.log('[DW-DIAG]   ⚠ getWorkerUrl threw:', wErr.message);
          }
        }
      }

      // Sync output directive with output dropdown
      if (outputSelect) {
        outputSelect.onchange = function() {
          const newType = outputSelect.value;
          if (mainEditor) {
            let cur = mainEditor.getValue();
            if (/output\\s+[a-zA-Z0-9_\\-\\/]+/.test(cur)) {
              cur = cur.replace(/output\\s+[a-zA-Z0-9_\\-\\/]+/, 'output ' + newType);
            } else if (cur.startsWith('%dw')) {
              const lines = cur.split('\\n');
              lines.splice(1, 0, 'output ' + newType);
              cur = lines.join('\\n');
            } else {
              cur = '%dw 2.0\\noutput ' + newType + '\\n---\\n' + cur;
            }
            mainEditor.setValue(cur);
            sendParamUpdate(data.nodeId, '__transform_payload__', cur, 'dataweave');
          }
        };
      }

      // Target Variables Section
      const varsSection = document.createElement('div');
      varsSection.className = 'dw-variables-section';

      const varsHeader = document.createElement('div');
      varsHeader.className = 'dw-variables-header';
      varsHeader.innerHTML = 
        '<span>Target Variables (<span id="dw-var-count">' + (transformData.targetVariables ? transformData.targetVariables.length : 0) + '</span>)</span>' +
        '<button type="button" class="prop-btn-add" id="dw-btn-add-var">+ Add Variable</button>';

      const varsList = document.createElement('div');
      varsList.className = 'dw-variables-list';

      function addVariableRow(varName, varScript) {
        const row = document.createElement('div');
        row.className = 'dw-var-row';

        const nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.className = 'prop-input dw-var-name';
        nameInp.value = varName || '';
        nameInp.placeholder = 'variableName';

        const valInp = document.createElement('input');
        valInp.type = 'text';
        valInp.className = 'prop-input dw-var-val';
        valInp.value = varScript || '';
        valInp.placeholder = 'DataWeave expression or value...';

        let vTimer;
        valInp.oninput = function() {
          clearTimeout(vTimer);
          vTimer = setTimeout(function() {
            if (nameInp.value.trim()) {
              sendParamUpdate(data.nodeId, '__transform_var:' + nameInp.value.trim(), valInp.value, 'dataweave');
            }
          }, 400);
        };
        valInp.onchange = function() {
          clearTimeout(vTimer);
          if (nameInp.value.trim()) {
            sendParamUpdate(data.nodeId, '__transform_var:' + nameInp.value.trim(), valInp.value, 'dataweave');
          }
        };

        nameInp.onchange = function() {
          if (nameInp.value.trim()) {
            sendParamUpdate(data.nodeId, '__transform_var:' + nameInp.value.trim(), valInp.value, 'dataweave');
          }
        };

        row.appendChild(nameInp);
        row.appendChild(valInp);
        varsList.appendChild(row);
      }

      if (transformData.targetVariables && transformData.targetVariables.length > 0) {
        for (let i = 0; i < transformData.targetVariables.length; i++) {
          const v = transformData.targetVariables[i];
          addVariableRow(v.name, v.script);
        }
      }

      varsHeader.querySelector('#dw-btn-add-var').onclick = function() {
        const count = varsList.children.length + 1;
        addVariableRow('variable' + count, '%dw 2.0\\noutput application/java\\n---\\npayload');
        const countEl = varsHeader.querySelector('#dw-var-count');
        if (countEl) countEl.textContent = String(varsList.children.length);
      };

      varsSection.appendChild(varsHeader);
      varsSection.appendChild(varsList);
      container.appendChild(varsSection);

      tabsContent.appendChild(container);

      createMainTransformEditor();
    }

    function renderPropertiesPanel(data) {
      selectedNodeId = data.nodeId;
      const panel = document.getElementById('properties-panel');
      const titleEl = document.getElementById('prop-title');
      const subEl = document.getElementById('prop-subtitle');
      const tabsHeader = document.getElementById('prop-tabs-header');
      const tabsContent = document.getElementById('prop-tabs-content');
      const emptyEl = document.getElementById('prop-empty');
      const gotoXmlBtn = document.getElementById('btn-goto-xml');

      if (!panel) return;
      panel.classList.remove('collapsed');

      activeMonacoEditors.forEach(function(editor) {
        try { editor.dispose(); } catch(e) {}
      });
      activeMonacoEditors.clear();

      if (emptyEl) emptyEl.style.display = 'none';

      titleEl.textContent = data.displayName || 'Component Properties';
      subEl.textContent = 'ID: ' + (data.nodeId || '');

      // Wire the "Go to XML" button to reveal this node's source range
      if (gotoXmlBtn) {
        const selNode = findNodeById(data.nodeId);
        if (selNode && selNode.range) {
          gotoXmlBtn.style.display = '';
          gotoXmlBtn.onclick = function() {
            vscode.postMessage({ type: 'revealXml', range: selNode.range, focusEditor: true });
          };
        } else {
          gotoXmlBtn.style.display = 'none';
        }
      }

      tabsHeader.innerHTML = '';
      tabsContent.innerHTML = '';
      tabsHeader.style.display = '';

      if (data.isTransform) {
        renderTransformEditor(data);
        return;
      }

      if (!data.groups || data.groups.length === 0) {
        tabsContent.innerHTML = '<div class="properties-empty-state">No configurable parameters found.</div>';
        return;
      }

      data.groups.forEach((group, idx) => {
        const btn = document.createElement('button');
        btn.className = 'prop-tab-btn' + (idx === 0 ? ' active' : '');
        btn.textContent = group.name + ' (' + group.parameters.length + ')';

        const pane = document.createElement('div');
        pane.className = 'prop-tab-pane' + (idx === 0 ? ' active' : '');
        pane.id = 'tab-pane-' + idx;

        btn.onclick = () => {
          tabsHeader.querySelectorAll('.prop-tab-btn').forEach(b => b.classList.remove('active'));
          tabsContent.querySelectorAll('.prop-tab-pane').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          pane.classList.add('active');
          setTimeout(() => {
            activeMonacoEditors.forEach(ed => {
              if (ed.getDomNode() && ed.getDomNode().offsetParent !== null) {
                ed.layout();
              }
            });
          }, 30);
        };

        tabsHeader.appendChild(btn);

        for (const param of group.parameters) {
          pane.appendChild(renderFormControl(param, data.currentValues));
        }

        // Show Test Connection button ONLY when clicked node is a Configuration element and genuine test is available
        if (data.isConfiguration && data.testConnectionAvailable && group.name.toLowerCase() === 'connection') {
          const testSec = document.createElement('div');
          testSec.className = 'test-connection-section';
          testSec.innerHTML = 
            '<button type="button" class="btn-test-connection" id="btn-test-conn">⚡ Test Connection</button>' +
            '<div class="test-conn-result" id="test-conn-result"></div>';

          const btn = testSec.querySelector('#btn-test-conn');
          btn.onclick = function() {
            btn.disabled = true;
            btn.textContent = 'Testing connection...';
            const resDiv = testSec.querySelector('#test-conn-result');
            resDiv.className = 'test-conn-result';
            resDiv.style.display = 'none';
            resDiv.textContent = '';

            const currentAttrs = Object.assign({}, data.currentValues);
            const parentPanel = document.getElementById('properties-panel');
            if (parentPanel) {
              parentPanel.querySelectorAll('[data-param-name]').forEach(function(input) {
                const pName = input.getAttribute('data-param-name');
                if (!pName) return;
                if (input.style.display === 'none' || (input.parentElement && input.parentElement.style.display === 'none')) {
                  return;
                }
                const nodeKey = (selectedNodeId || 'global') + '::' + pName;
                if (activeMonacoEditors.has(nodeKey)) {
                  currentAttrs[pName] = activeMonacoEditors.get(nodeKey).getValue();
                } else if (input.getAttribute('data-pending-val') !== null) {
                  currentAttrs[pName] = input.getAttribute('data-pending-val');
                } else if (input.type === 'checkbox') {
                  currentAttrs[pName] = input.checked ? 'true' : 'false';
                } else if (input.value !== undefined && input.value !== null && input.value !== '') {
                  currentAttrs[pName] = input.value;
                }
              });
            }

            vscode.postMessage({
              type: 'testConnection',
              nodeId: data.nodeId,
              namespaceUri: data.namespaceUri,
              localName: data.localName || data.displayName,
              attributes: currentAttrs
            });
          };

          pane.appendChild(testSec);
        }

        tabsContent.appendChild(pane);
      });
    }

    function handleTestConnectionResult(msg) {
      const btn = document.getElementById('btn-test-conn');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Test Connection';
      }
      const resDiv = document.getElementById('test-conn-result');
      if (resDiv) {
        resDiv.className = 'test-conn-result ' + (msg.success ? 'test-conn-success' : 'test-conn-error');
        resDiv.textContent = (msg.success ? '✓ ' : '✕ ') + msg.message;
        resDiv.style.display = 'block';
      }
    }

    const fieldExpressionModes = {};
    const lastNonExpressionValues = {};

    function wrapExpression(val) {
      if (val === undefined || val === null) return '#[]';
      let s;
      if (Array.isArray(val)) {
        s = '[' + val.map(function(item) { return typeof item === 'string' ? "'" + item + "'" : String(item); }).join(', ') + ']';
      } else if (typeof val === 'object') {
        s = JSON.stringify(val);
      } else {
        s = String(val).trim();
      }
      if (!s) return '#[]';
      if (s.startsWith('#[') && s.endsWith(']')) return s;
      if (s.startsWith('#[')) return s + ']';
      return '#[' + s + ']';
    }

    function unwrapExpression(val) {
      if (val === undefined || val === null) return '';
      const s = String(val).trim();
      if (s.startsWith('#[') && s.endsWith(']')) {
        return s.slice(2, -1).trim();
      }
      return s;
    }

    function registerDataWeaveLanguage() {
      if (!window.monaco || !monaco.languages) return;

      monaco.languages.register({ id: 'dataweave', extensions: ['.dwl'] });

      monaco.languages.setLanguageConfiguration('dataweave', {
        comments: {
          lineComment: '//',
          blockComment: ['/*', '*/']
        },
        brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')']
        ],
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ],
        surroundingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ]
      });

      monaco.languages.setMonarchTokensProvider('dataweave', {
        defaultToken: '',
        tokenPostfix: '.dw',

        keywords: [
          'var', 'fun', 'import', 'ns', 'type',
          'if', 'else', 'match', 'case', 'default',
          'as', 'is', 'do', 'using', 'unless',
          'true', 'false', 'null'
        ],

        directives: [
          'output', 'input', 'ns', 'type'
        ],

        operators: [
          '---', '->', ':=', '==', '~=', '!=', '<=', '>=',
          '++', '--', '>>', '<<',
          '+', '-', '*', '/', '%', '=', '<', '>', '?', '!', '~'
        ],

        symbols: /[=><!~?:&|+\\-*\\/\\^%]+/,

        tokenizer: {
          root: [
            // %dw header directive
            [/^%dw\\b.*$/, 'keyword.header'],

            // Output/input directives
            [/^\\s*(output|input|ns|type)\\b/, 'keyword.directive'],

            // Body separator
            [/^---$/, 'operator.separator'],

            // Mule expression brackets #[ and ]
            [/^#\\[/, 'delimiter.bracket'],
            [/\\]$/, 'delimiter.bracket'],

            // Whitespace & comments
            { include: '@whitespace' },

            // Keywords and identifiers
            [/[a-zA-Z_]\\w*/, {
              cases: {
                '@keywords': 'keyword',
                '@directives': 'keyword.directive',
                '@default': 'identifier'
              }
            }],

            // Delimiters and operators
            [/---/, 'operator.separator'],
            [/@symbols/, {
              cases: {
                '@operators': 'operator',
                '@default': ''
              }
            }],

            // Numbers
            [/\\d*\\.\\d+([eE][\\-+]?\\d+)?/, 'number.float'],
            [/\\d+/, 'number'],

            // Strings
            [/"([^"\\\\]|\\\\.)*$/, 'string.invalid'],
            [/"/, { token: 'string.quote', bracket: '@open', next: '@string_double' }],
            [/'([^'\\\\]|\\\\.)*'/, 'string'],

            // Brackets & delimiters
            [/[{}()\\[\\]]/, '@brackets'],
            [/[,.:]/, 'delimiter'],
          ],

          whitespace: [
            [/[ \\t\\r\\n]+/, 'white'],
            [/\\/\\*/, 'comment', '@comment'],
            [/\\/\\/.*$/, 'comment'],
          ],

          comment: [
            [/[^\\/*]+/, 'comment'],
            [/\\/\\*/, 'comment.invalid'],
            ["\\*/", 'comment', '@pop'],
            [/[\\/*]/, 'comment']
          ],

          string_double: [
            [/[^\\"$]+/, 'string'],
            [/\\\\./, 'string.escape'],
            [/[\\$]\\(/, { token: 'variable.predefined', bracket: '@open', next: '@interpolation' }],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
            [/[\\$]/, 'string']
          ],

          interpolation: [
            [/\\)/, { token: 'variable.predefined', bracket: '@close', next: '@pop' }],
            { include: 'root' }
          ]
        }
      });

      monaco.editor.defineTheme('dw-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'keyword.header', foreground: 'C586C0', fontStyle: 'bold' },
          { token: 'keyword.directive', foreground: '4FC1FF', fontStyle: 'bold' },
          { token: 'operator.separator', foreground: 'DCDCAA', fontStyle: 'bold' },
          { token: 'variable.predefined', foreground: '4EC9B0' },
          { token: 'delimiter.bracket', foreground: 'FFD700', fontStyle: 'bold' }
        ],
        colors: {
          'editor.background': '#1e1e1e00',
          'editorGutter.background': '#1e1e1e00'
        }
      });

      monaco.editor.defineTheme('dw-light', {
        base: 'vs',
        inherit: true,
        rules: [
          { token: 'keyword.header', foreground: 'AF00DB', fontStyle: 'bold' },
          { token: 'keyword.directive', foreground: '0000FF', fontStyle: 'bold' },
          { token: 'operator.separator', foreground: '795E26', fontStyle: 'bold' },
          { token: 'variable.predefined', foreground: '267F99' },
          { token: 'delimiter.bracket', foreground: '00008B', fontStyle: 'bold' }
        ],
        colors: {
          'editor.background': '#ffffff00',
          'editorGutter.background': '#ffffff00'
        }
      });

      monaco.languages.registerCompletionItemProvider('dataweave', {
        triggerCharacters: ['.', ' ', '#', '['],
        provideCompletionItems: function(model, position) {
          const textUntilPosition = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          });

          const wordInfo = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: wordInfo.startColumn,
            endColumn: wordInfo.endColumn
          };

          const suggestions = [];

          // 1. Dot completions on vars (e.g. vars. or vars.foo)
          const varsMatch = textUntilPosition.match(/vars\\.([a-zA-Z0-9_]*)$/);
          if (varsMatch) {
            if (currentAutocompleteContext && currentAutocompleteContext.variables) {
              currentAutocompleteContext.variables.forEach(function(v) {
                suggestions.push({
                  label: v.name,
                  kind: monaco.languages.CompletionItemKind.Variable,
                  documentation: v.type
                    ? 'Variable defined earlier in flow via Set Variable (' + v.type + ')'
                    : 'Variable defined earlier in flow via Set Variable',
                  detail: v.type || 'Variable',
                  insertText: v.name,
                  range: range
                });
              });
            }
            return { suggestions: suggestions };
          }

          // 2. Dot completions on payload sub-object (e.g. payload.customer.id)
          const payloadSubMatch = textUntilPosition.match(/payload\\.([a-zA-Z0-9_]+)\\.([a-zA-Z0-9_]*)$/);
          if (payloadSubMatch) {
            const parentName = payloadSubMatch[1];
            if (currentAutocompleteContext && currentAutocompleteContext.precedingPayloadShape && currentAutocompleteContext.precedingPayloadShape.fields) {
              const parentField = currentAutocompleteContext.precedingPayloadShape.fields.find(function(f) {
                return f.name === parentName;
              });
              if (parentField && parentField.children && parentField.children.length > 0) {
                parentField.children.forEach(function(childName) {
                  suggestions.push({
                    label: childName,
                    kind: monaco.languages.CompletionItemKind.Field,
                    documentation: 'Sub-field of payload.' + parentName + ' from preceding Transform Message',
                    detail: 'Field',
                    insertText: childName,
                    range: range
                  });
                });
              }
            }
            return { suggestions: suggestions };
          }

          // 3. Dot completions on payload (e.g. payload. or payload.orderId)
          const payloadMatch = textUntilPosition.match(/payload\\.([a-zA-Z0-9_]*)$/);
          if (payloadMatch) {
            if (currentAutocompleteContext && currentAutocompleteContext.precedingPayloadShape && currentAutocompleteContext.precedingPayloadShape.fields) {
              const outType = currentAutocompleteContext.precedingPayloadShape.outputType;
              currentAutocompleteContext.precedingPayloadShape.fields.forEach(function(f) {
                suggestions.push({
                  label: f.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  documentation: outType
                    ? 'Field declared by immediately preceding Transform Message (' + outType + ')'
                    : 'Field declared by immediately preceding Transform Message',
                  detail: outType ? outType + ' field' : 'Field',
                  insertText: f.name,
                  range: range
                });
              });
            }
            // Explicitly return empty suggestions if no static information is available for payload
            return { suggestions: suggestions };
          }

          // 4. General / Top-level context roots and variables
          const muleRoots = [
            { label: 'payload', detail: 'Current message payload', kind: monaco.languages.CompletionItemKind.Keyword, doc: 'The main data content of the Mule message.' },
            { label: 'vars', detail: 'Mule flow variables', kind: monaco.languages.CompletionItemKind.Keyword, doc: 'Map of variables defined in the current flow.' },
            { label: 'attributes', detail: 'Message attributes', kind: monaco.languages.CompletionItemKind.Keyword, doc: 'Metadata associated with the message (headers, query params, etc.).' },
            { label: 'message', detail: 'Mule message', kind: monaco.languages.CompletionItemKind.Keyword, doc: 'Container representing payload and attributes.' },
            { label: 'error', detail: 'Error object', kind: monaco.languages.CompletionItemKind.Keyword, doc: 'Current error object during error handling.' }
          ];

          muleRoots.forEach(function(r) {
            suggestions.push({
              label: r.label,
              kind: r.kind,
              detail: r.detail,
              documentation: r.doc,
              insertText: r.label,
              range: range
            });
          });

          if (currentAutocompleteContext && currentAutocompleteContext.variables) {
            currentAutocompleteContext.variables.forEach(function(v) {
              suggestions.push({
                label: 'vars.' + v.name,
                kind: monaco.languages.CompletionItemKind.Variable,
                detail: v.type || 'Variable',
                documentation: 'Flow variable: ' + v.name,
                insertText: 'vars.' + v.name,
                range: range
              });
            });
          }

          if (!textUntilPosition.includes('---')) {
            const dollar = String.fromCharCode(36);
            const directives = [
              { label: '%dw 2.0', detail: 'Header directive', insert: '%dw 2.0\\n' },
              { label: 'output application/json', detail: 'JSON output', insert: 'output application/json\\n' },
              { label: 'output application/xml', detail: 'XML output', insert: 'output application/xml\\n' },
              { label: 'output application/java', detail: 'Java output', insert: 'output application/java\\n' },
              { label: 'var', detail: 'Variable declaration', insert: 'var ' + dollar + '{1:name} = ' + dollar + '{2:value}' },
              { label: 'fun', detail: 'Function declaration', insert: 'fun ' + dollar + '{1:name}(' + dollar + '{2:param}) = ' + dollar + '{3:body}' },
              { label: 'import', detail: 'Module import', insert: 'import * from dw::core::' + dollar + '{1:Strings}' }
            ];
            directives.forEach(function(d) {
              suggestions.push({
                label: d.label,
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: d.detail,
                insertText: d.insert,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range: range
              });
            });
          }

          return { suggestions: suggestions };
        }
      });
    }

    function attachExpressionToggle(opts) {
      const formGroup = opts.formGroup;
      const param = opts.param;
      const val = opts.val;
      const normalWidget = opts.normalWidget;
      const isMultiLine = opts.isMultiLine;
      const getNormalVal = opts.getNormalVal;
      const setNormalVal = opts.setNormalVal;

      if (!param || !param.supportsExpression) {
        formGroup.appendChild(normalWidget);
        return formGroup;
      }

      const nodeKey = (selectedNodeId || 'global') + '::' + param.name;
      let isFx = false;
      if (fieldExpressionModes[nodeKey] !== undefined) {
        isFx = fieldExpressionModes[nodeKey] === true;
      } else if (typeof val === 'string' && val.trim().startsWith('#[')) {
        isFx = true;
        fieldExpressionModes[nodeKey] = true;
      } else {
        isFx = false;
        fieldExpressionModes[nodeKey] = false;
      }

      if (!isFx && val !== undefined && val !== null) {
        lastNonExpressionValues[nodeKey] = val;
      }

      const row = document.createElement('div');
      row.className = 'prop-widget-row';
      if (isMultiLine) {
        row.style.alignItems = 'flex-start';
      }

      const container = document.createElement('div');
      container.className = 'prop-widget-container';

      const expWrapper = document.createElement('div');
      expWrapper.className = 'prop-monaco-wrapper ' + (isMultiLine ? 'prop-monaco-multi' : 'prop-monaco-single');
      expWrapper.setAttribute('data-param-name', param.name);

      const monacoHost = document.createElement('div');
      monacoHost.className = 'prop-monaco-editor';
      expWrapper.appendChild(monacoHost);

      let monacoEditorInstance = null;

      function getEditorVal() {
        if (monacoEditorInstance) {
          return monacoEditorInstance.getValue();
        }
        return expWrapper.getAttribute('data-pending-val') || '';
      }

      function setEditorVal(newVal) {
        expWrapper.setAttribute('data-pending-val', newVal);
        if (monacoEditorInstance) {
          if (monacoEditorInstance.getValue() !== newVal) {
            monacoEditorInstance.setValue(newVal);
          }
        }
      }

      function createEditor() {
        if (!window.monaco || !monacoLoaded) {
          monacoReadyQueue.push(createEditor);
          return;
        }
        if (monacoEditorInstance) return;
        if (!expWrapper.isConnected) return;

        const initVal = expWrapper.getAttribute('data-pending-val') !== null
          ? expWrapper.getAttribute('data-pending-val')
          : (isFx ? wrapExpression(val) : '');

        monacoEditorInstance = monaco.editor.create(monacoHost, {
          value: initVal,
          language: 'dataweave',
          theme: getMonacoTheme(),
          automaticLayout: true,
          lineNumbers: 'off',
          glyphMargin: false,
          folding: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 0,
          overviewRulerLanes: 0,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollbar: isMultiLine ? { vertical: 'auto', horizontal: 'auto' } : { vertical: 'hidden', horizontal: 'hidden', handleMouseWheel: false },
          scrollBeyondLastLine: false,
          wordWrap: isMultiLine ? 'on' : 'off',
          minimap: { enabled: false },
          renderLineHighlight: 'none',
          contextmenu: false,
          fixedOverflowWidgets: true,
          tabSize: 2,
          fontSize: 12,
          lineHeight: isMultiLine ? 18 : 20,
          padding: { top: isMultiLine ? 4 : 3, bottom: isMultiLine ? 4 : 3 },
          fontFamily: 'var(--vscode-editor-font-family, Consolas, "Courier New", monospace)'
        });

        if (!isMultiLine) {
          monacoEditorInstance.addCommand(monaco.KeyCode.Enter, function() {});
        }

        let editTimer;
        monacoEditorInstance.onDidChangeModelContent(function() {
          clearTimeout(editTimer);
          editTimer = setTimeout(function() {
            const raw = monacoEditorInstance.getValue();
            expWrapper.setAttribute('data-pending-val', raw);
            sendParamUpdate(selectedNodeId, param.name, raw, 'string');
          }, 400);
        });

        activeMonacoEditors.set(nodeKey, monacoEditorInstance);

        if (isFx) {
          setTimeout(function() {
            if (monacoEditorInstance) monacoEditorInstance.layout();
          }, 20);
        }
      }

      if (isFx) {
        setEditorVal(wrapExpression(val));
        normalWidget.style.display = 'none';
        expWrapper.style.display = '';
        createEditor();
      } else {
        setEditorVal('');
        normalWidget.style.display = '';
        expWrapper.style.display = 'none';
      }

      const fxBtn = document.createElement('button');
      fxBtn.type = 'button';
      fxBtn.className = 'prop-fx-btn' + (isFx ? ' active' : '');
      fxBtn.title = isFx ? 'Switch to literal mode' : 'Switch to expression mode (#[...])';
      fxBtn.textContent = 'fx';

      fxBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        const currentlyFx = fieldExpressionModes[nodeKey] === true;
        const newFx = !currentlyFx;
        fieldExpressionModes[nodeKey] = newFx;

        if (newFx) {
          const curVal = getNormalVal();
          lastNonExpressionValues[nodeKey] = curVal;
          const wrapped = wrapExpression(curVal);
          setEditorVal(wrapped);
          normalWidget.style.display = 'none';
          expWrapper.style.display = '';
          fxBtn.classList.add('active');
          fxBtn.title = 'Switch to literal mode';
          if (!monacoEditorInstance) {
            createEditor();
          } else {
            setTimeout(function() {
              monacoEditorInstance.layout();
              monacoEditorInstance.focus();
            }, 20);
          }
          sendParamUpdate(selectedNodeId, param.name, wrapped, 'string');
        } else {
          const currentExp = getEditorVal();
          const stripped = unwrapExpression(currentExp);
          let targetVal = stripped;
          if (param.dataType === 'boolean') {
            if (stripped === 'true' || stripped === 'false') {
              targetVal = stripped;
            } else if (lastNonExpressionValues[nodeKey] !== undefined) {
              targetVal = lastNonExpressionValues[nodeKey];
            }
          } else if (param.dataType === 'number') {
            if (stripped !== '' && !isNaN(Number(stripped))) {
              targetVal = stripped;
            } else if (lastNonExpressionValues[nodeKey] !== undefined) {
              targetVal = lastNonExpressionValues[nodeKey];
            }
          } else if (param.dataType === 'enum') {
            const allowed = param.allowedValues || [];
            const matches = allowed.some(function(a) { return a.toUpperCase() === stripped.toUpperCase(); });
            if (matches) {
              targetVal = stripped;
            } else if (lastNonExpressionValues[nodeKey] !== undefined) {
              targetVal = lastNonExpressionValues[nodeKey];
            }
          } else if (param.dataType === 'list') {
            if (lastNonExpressionValues[nodeKey] !== undefined && stripped.startsWith('[')) {
              targetVal = lastNonExpressionValues[nodeKey];
            }
          }
          lastNonExpressionValues[nodeKey] = targetVal;
          setNormalVal(targetVal);
          expWrapper.style.display = 'none';
          normalWidget.style.display = '';
          fxBtn.classList.remove('active');
          fxBtn.title = 'Switch to expression mode (#[...])';
          const finalVal = getNormalVal();
          sendParamUpdate(selectedNodeId, param.name, finalVal, param.dataType);
        }
      };

      container.appendChild(normalWidget);
      container.appendChild(expWrapper);
      row.appendChild(container);
      row.appendChild(fxBtn);

      formGroup.appendChild(row);
      return formGroup;
    }

    function renderFormControl(param, currentValues) {
      const div = document.createElement('div');
      div.className = 'prop-form-group';

      const val = (currentValues && currentValues[param.name] !== undefined)
        ? currentValues[param.name]
        : (param.defaultValue !== undefined && param.defaultValue !== null ? param.defaultValue : '');

      const reqAsterisk = param.required ? '<span class="prop-required" title="Required">*</span>' : '';

      // 1. Config-Ref Dropdown (Configuration Reference)
      if (param.isReference && (param.referenceType === 'configuration' || param.name === 'config-ref' || param.configOptions !== undefined)) {
        const options = (param.configOptions && param.configOptions.length > 0)
          ? param.configOptions.slice()
          : [];

        if (val && !options.includes(val)) {
          options.unshift(val);
        }

        let selectHtml = '<option value="">-- Select Configuration --</option>';
        for (const opt of options) {
          const isSel = (String(val) === String(opt)) ? ' selected' : '';
          selectHtml += '<option value="' + escapeHtml(opt) + '"' + isSel + '>' + escapeHtml(opt) + '</option>';
        }
        selectHtml += '<option value="__create_new__" style="font-weight: 600; color: var(--vscode-textLink-foreground, #3794ff);">+ Create new...</option>';

        div.innerHTML = 
          '<label class="prop-label">' +
            escapeHtml(param.label) + ' ' + reqAsterisk +
            '<span class="prop-type-badge">config-ref</span>' +
          '</label>' +
          '<select class="prop-select prop-config-select" data-param-name="' + escapeHtml(param.name) + '">' +
            selectHtml +
          '</select>' +
          (param.description ? '<div class="prop-desc">' + escapeHtml(param.description) + '</div>' : '');

        const selectEl = div.querySelector('select');
        if (selectEl) {
          selectEl.onchange = function() {
            if (this.value === '__create_new__') {
              this.value = val || '';
              openCreateConfigModal(param, selectedNodeId);
            } else {
              vscode.postMessage({
                type: 'updateConfigRef',
                targetNodeId: selectedNodeId,
                configRefParamName: param.name,
                configName: this.value
              });
            }
          };
        }

        return div;
      }

      // 2. Generic Reference (Connection-Ref / other references) - Read-only display
      if (param.isReference) {
        div.innerHTML = 
          '<label class="prop-label">' +
            escapeHtml(param.label) + ' ' + reqAsterisk +
            '<span class="prop-type-badge">' + escapeHtml(param.referenceType || 'reference') + '</span>' +
          '</label>' +
          '<input type="text" readonly class="prop-input prop-readonly" data-param-name="' + escapeHtml(param.name) + '" value="' + escapeHtml(String(val)) + '" placeholder="None" />' +
          (param.description ? '<div class="prop-desc">' + escapeHtml(param.description) + '</div>' : '');
        return div;
      }

      // 3. Boolean - Checkbox
      if (param.dataType === 'boolean') {
        const isChecked = val === true || val === 'true';

        div.innerHTML = 
          '<label class="prop-label">' +
            escapeHtml(param.label) + ' ' + reqAsterisk +
            '<span class="prop-type-badge">boolean</span>' +
          '</label>';

        const normalWidget = document.createElement('div');
        normalWidget.className = 'prop-normal-widget';
        normalWidget.innerHTML = 
          '<label class="prop-checkbox-label" style="margin: 0; padding: 4px 0; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">' +
            '<input type="checkbox" data-param-name="' + escapeHtml(param.name) + '" ' + (isChecked ? 'checked' : '') + ' />' +
            '<span class="prop-bool-status" style="font-family: var(--vscode-editor-font-family, monospace); font-size: 11px;">' + (isChecked ? 'true' : 'false') + '</span>' +
          '</label>';

        const cb = normalWidget.querySelector('input[type="checkbox"]');
        const statusSpan = normalWidget.querySelector('.prop-bool-status');
        if (cb) {
          cb.onchange = function() {
            const curVal = cb.checked ? 'true' : 'false';
            if (statusSpan) statusSpan.textContent = curVal;
            const nodeKey = (selectedNodeId || 'global') + '::' + param.name;
            lastNonExpressionValues[nodeKey] = curVal;
            sendParamUpdate(selectedNodeId, param.name, curVal, 'boolean');
          };
        }

        attachExpressionToggle({
          formGroup: div,
          param: param,
          val: val,
          normalWidget: normalWidget,
          isMultiLine: false,
          getNormalVal: function() { return cb && cb.checked ? 'true' : 'false'; },
          setNormalVal: function(v) {
            if (cb) {
              cb.checked = (v === true || v === 'true');
              if (statusSpan) statusSpan.textContent = cb.checked ? 'true' : 'false';
            }
          }
        });

        if (param.description) {
          const desc = document.createElement('div');
          desc.className = 'prop-desc';
          desc.textContent = param.description;
          div.appendChild(desc);
        }
        return div;
      }

      // 4. Enum - <select>
      if (param.dataType === 'enum') {
        div.innerHTML = 
          '<label class="prop-label">' +
            escapeHtml(param.label) + ' ' + reqAsterisk +
            '<span class="prop-type-badge">enum</span>' +
          '</label>';

        const allowed = param.allowedValues || ['DEFAULT'];
        const normalWidget = document.createElement('select');
        normalWidget.className = 'prop-select prop-normal-widget';
        normalWidget.setAttribute('data-param-name', param.name);
        let optionsHtml = '';
        for (let i = 0; i < allowed.length; i++) {
          const opt = allowed[i];
          const isSel = (String(val).toUpperCase() === opt.toUpperCase()) ? ' selected' : '';
          optionsHtml += '<option value="' + escapeHtml(opt) + '"' + isSel + '>' + escapeHtml(opt) + '</option>';
        }
        normalWidget.innerHTML = optionsHtml;

        normalWidget.onchange = function() {
          const curVal = normalWidget.value;
          const nodeKey = (selectedNodeId || 'global') + '::' + param.name;
          lastNonExpressionValues[nodeKey] = curVal;
          sendParamUpdate(selectedNodeId, param.name, curVal, 'enum');
        };

        attachExpressionToggle({
          formGroup: div,
          param: param,
          val: val,
          normalWidget: normalWidget,
          isMultiLine: false,
          getNormalVal: function() { return normalWidget.value; },
          setNormalVal: function(v) {
            if (v !== undefined && v !== null) {
              normalWidget.value = v;
              if (!normalWidget.value) {
                for (let i = 0; i < normalWidget.options.length; i++) {
                  if (normalWidget.options[i].value.toUpperCase() === String(v).toUpperCase()) {
                    normalWidget.selectedIndex = i;
                    break;
                  }
                }
              }
            }
          }
        });

        if (param.description) {
          const desc = document.createElement('div');
          desc.className = 'prop-desc';
          desc.textContent = param.description;
          div.appendChild(desc);
        }
        return div;
      }

      // 5. List - Repeatable "+ Add" block
      if (param.dataType === 'list') {
        div.className = 'prop-form-group prop-list-group';
        const items = Array.isArray(val) ? val : (val ? [val] : []);

        div.innerHTML = 
          '<label class="prop-label">' +
            escapeHtml(param.label) + ' ' + reqAsterisk +
            '<span class="prop-type-badge">list</span>' +
          '</label>';

        const normalWidget = document.createElement('div');
        normalWidget.className = 'prop-normal-widget';

        const listHeader = document.createElement('div');
        listHeader.className = 'prop-list-header';
        listHeader.innerHTML = 
          '<span style="font-size: 11px; color: var(--text-muted);">Items</span>' +
          '<button type="button" class="prop-btn-add">+ Add</button>';

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'prop-list-items';

        function getListValues() {
          const vals = [];
          itemsContainer.querySelectorAll('.prop-input').forEach(function(inp) {
            if (inp.value.trim() !== '') vals.push(inp.value.trim());
          });
          return vals;
        }

        function notifyListChange() {
          const vals = getListValues();
          const nodeKey = (selectedNodeId || 'global') + '::' + param.name;
          lastNonExpressionValues[nodeKey] = vals;
          sendParamUpdate(selectedNodeId, param.name, vals, 'list');
        }

        const addItemRow = function(itemVal) {
          if (itemVal === undefined) itemVal = '';
          const row = document.createElement('div');
          row.className = 'prop-list-item-row';
          row.innerHTML = 
            '<input type="text" class="prop-input" value="' + escapeHtml(String(itemVal)) + '" placeholder="Item value..." />' +
            '<button type="button" class="tool-btn" style="padding: 2px 6px;" title="Remove">✕</button>';
          const rowInp = row.querySelector('input');
          let timer;
          rowInp.oninput = function() {
            clearTimeout(timer);
            timer = setTimeout(notifyListChange, 400);
          };
          rowInp.onchange = function() {
            clearTimeout(timer);
            notifyListChange();
          };
          row.querySelector('button').onclick = function() {
            row.remove();
            notifyListChange();
          };
          itemsContainer.appendChild(row);
        };

        if (items.length > 0) {
          items.forEach(function(it) { addItemRow(it); });
        } else {
          addItemRow();
        }

        listHeader.querySelector('.prop-btn-add').onclick = function() {
          addItemRow();
          notifyListChange();
        };

        normalWidget.appendChild(listHeader);
        normalWidget.appendChild(itemsContainer);

        attachExpressionToggle({
          formGroup: div,
          param: param,
          val: val,
          normalWidget: normalWidget,
          isMultiLine: true,
          getNormalVal: function() { return getListValues(); },
          setNormalVal: function(v) {
            itemsContainer.innerHTML = '';
            const newItems = Array.isArray(v) ? v : (v ? [v] : []);
            if (newItems.length > 0) {
              newItems.forEach(function(it) { addItemRow(it); });
            } else {
              addItemRow();
            }
          }
        });

        if (param.description) {
          const desc = document.createElement('div');
          desc.className = 'prop-desc';
          desc.textContent = param.description;
          div.appendChild(desc);
        }
        return div;
      }

      // 6. Complex Object - Collapsible nested sub-form
      if (param.dataType === 'complex-object') {
        const details = document.createElement('details');
        details.className = 'prop-complex-group';
        const strVal = typeof val === 'object' && val !== null ? JSON.stringify(val, null, 2) : String(val || '');
        if (strVal.trim()) details.open = true;

        details.innerHTML = 
          '<summary class="prop-complex-summary">' +
            '<span>' + escapeHtml(param.label) + '</span> ' + reqAsterisk +
            '<span class="prop-type-badge">object</span>' +
          '</summary>';

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'prop-complex-body';

        const normalWidget = document.createElement('textarea');
        normalWidget.className = 'prop-textarea prop-normal-widget';
        normalWidget.setAttribute('data-param-name', param.name);
        normalWidget.rows = 3;
        normalWidget.placeholder = 'key: value or DataWeave expression...';
        normalWidget.value = strVal;

        let objTimer;
        normalWidget.oninput = function() {
          clearTimeout(objTimer);
          objTimer = setTimeout(function() {
            const curVal = normalWidget.value;
            const nodeKey = (selectedNodeId || 'global') + '::' + param.name;
            lastNonExpressionValues[nodeKey] = curVal;
            sendParamUpdate(selectedNodeId, param.name, curVal, 'complex-object');
          }, 500);
        };
        normalWidget.onchange = function() {
          clearTimeout(objTimer);
          const curVal = normalWidget.value;
          const nodeKey = (selectedNodeId || 'global') + '::' + param.name;
          lastNonExpressionValues[nodeKey] = curVal;
          sendParamUpdate(selectedNodeId, param.name, curVal, 'complex-object');
        };

        attachExpressionToggle({
          formGroup: bodyDiv,
          param: param,
          val: strVal,
          normalWidget: normalWidget,
          isMultiLine: true,
          getNormalVal: function() { return normalWidget.value; },
          setNormalVal: function(v) { normalWidget.value = (v !== undefined && v !== null) ? String(v) : ''; }
        });

        details.appendChild(bodyDiv);

        if (param.description) {
          const desc = document.createElement('div');
          desc.className = 'prop-desc';
          desc.style.marginTop = '6px';
          desc.textContent = param.description;
          details.appendChild(desc);
        }
        return details;
      }

      // 7. Text input for string or number (default)
      const inputType = param.dataType === 'number' ? 'number' : 'text';
      div.innerHTML = 
        '<label class="prop-label">' +
          escapeHtml(param.label) + ' ' + reqAsterisk +
          (param.dataType === 'number' ? '<span class="prop-type-badge">number</span>' : '') +
        '</label>';

      const normalWidget = document.createElement('input');
      normalWidget.type = inputType;
      normalWidget.className = 'prop-input prop-normal-widget';
      normalWidget.setAttribute('data-param-name', param.name);
      normalWidget.value = String(val !== undefined && val !== null ? val : '');
      normalWidget.placeholder = String(param.defaultValue !== undefined && param.defaultValue !== null ? param.defaultValue : '');

      let normalTimer;
      normalWidget.oninput = function() {
        clearTimeout(normalTimer);
        normalTimer = setTimeout(function() {
          const curVal = normalWidget.value;
          const nodeKey = (selectedNodeId || 'global') + '::' + param.name;
          lastNonExpressionValues[nodeKey] = curVal;
          sendParamUpdate(selectedNodeId, param.name, curVal, param.dataType);
        }, 400);
      };
      normalWidget.onchange = function() {
        clearTimeout(normalTimer);
        const curVal = normalWidget.value;
        const nodeKey = (selectedNodeId || 'global') + '::' + param.name;
        lastNonExpressionValues[nodeKey] = curVal;
        sendParamUpdate(selectedNodeId, param.name, curVal, param.dataType);
      };

      attachExpressionToggle({
        formGroup: div,
        param: param,
        val: val,
        normalWidget: normalWidget,
        isMultiLine: false,
        getNormalVal: function() { return normalWidget.value; },
        setNormalVal: function(v) { normalWidget.value = (v !== undefined && v !== null) ? String(v) : ''; }
      });

      if (param.description) {
        const desc = document.createElement('div');
        desc.className = 'prop-desc';
        desc.textContent = param.description;
        div.appendChild(desc);
      }
      return div;
    }

    function sendParamUpdate(nodeId, paramName, value, dataType) {
      if (!nodeId || !paramName) return;
      vscode.postMessage({
        type: 'updateParameterValue',
        nodeId: nodeId,
        paramName: paramName,
        value: value,
        dataType: dataType || 'string'
      });
    }

    function openCreateConfigModal(param, nodeId) {
      const overlay = document.getElementById('config-modal-overlay');
      const titleEl = document.getElementById('config-modal-title');
      const nameInput = document.getElementById('config-new-name');
      const tabsHeader = document.getElementById('config-modal-tabs-header');
      const tabsContent = document.getElementById('config-modal-tabs-content');
      const closeBtn = document.getElementById('config-modal-close');
      const cancelBtn = document.getElementById('config-modal-cancel');
      const submitBtn = document.getElementById('config-modal-submit');

      if (!overlay) return;

      const cfgModel = param.configModel;
      const displayName = (cfgModel && cfgModel.displayName) ? cfgModel.displayName : (param.label || 'Configuration');
      titleEl.textContent = 'New ' + displayName;

      // Suggest unique default name
      const prefixTag = (param.configXmlTag || 'config').replace(':', '_');
      nameInput.value = prefixTag + '_' + (Math.floor(Math.random() * 900) + 100);
      nameInput.style.borderColor = '';

      tabsHeader.innerHTML = '';
      tabsContent.innerHTML = '';

      // Filter out connection tabs for this phase
      const groups = (cfgModel && cfgModel.groups && cfgModel.groups.length > 0)
        ? cfgModel.groups.filter(function(g) { return g.name.toLowerCase() !== 'connection'; })
        : [{ name: 'General', parameters: (cfgModel && cfgModel.parameters) ? cfgModel.parameters : [] }];

      if (groups.length === 0 || (groups.length === 1 && groups[0].parameters.length === 0)) {
        tabsContent.innerHTML = '<div class="properties-empty-state">No additional parameters required for this configuration.</div>';
      } else {
        groups.forEach(function(group, idx) {
          const btn = document.createElement('button');
          btn.className = 'prop-tab-btn' + (idx === 0 ? ' active' : '');
          btn.textContent = group.name + ' (' + group.parameters.length + ')';

          const pane = document.createElement('div');
          pane.className = 'prop-tab-pane' + (idx === 0 ? ' active' : '');
          pane.id = 'modal-tab-pane-' + idx;

          btn.onclick = function() {
            tabsHeader.querySelectorAll('.prop-tab-btn').forEach(function(b) { b.classList.remove('active'); });
            tabsContent.querySelectorAll('.prop-tab-pane').forEach(function(p) { p.classList.remove('active'); });
            btn.classList.add('active');
            pane.classList.add('active');
          };

          tabsHeader.appendChild(btn);

          for (const p of group.parameters) {
            pane.appendChild(renderFormControl(p, {}));
          }

          tabsContent.appendChild(pane);
        });
      }

      overlay.classList.remove('hidden');
      nameInput.focus();

      const hideModal = function() {
        overlay.classList.add('hidden');
      };

      closeBtn.onclick = hideModal;
      cancelBtn.onclick = hideModal;

      submitBtn.onclick = function() {
        const configName = nameInput.value.trim();
        if (!configName) {
          nameInput.style.borderColor = '#e53935';
          nameInput.focus();
          return;
        }

        const collectedAttrs = {};
        tabsContent.querySelectorAll('[data-param-name]').forEach(function(input) {
          const pName = input.getAttribute('data-param-name');
          if (!pName) return;
          if (input.type === 'checkbox') {
            collectedAttrs[pName] = input.checked ? 'true' : 'false';
          } else if (input.value !== undefined && input.value !== null && input.value !== '') {
            collectedAttrs[pName] = input.value;
          }
        });

        vscode.postMessage({
          type: 'createConfiguration',
          targetNodeId: nodeId,
          configRefParamName: param.name,
          configXmlTag: param.configXmlTag || (param.name === 'config-ref' ? 'http:listener-config' : 'config'),
          configName: configName,
          attributes: collectedAttrs
        });

        // Add to the current select dropdown and pre-select it
        const currentSelect = document.querySelector('.prop-config-select[data-param-name="' + param.name + '"]');
        if (currentSelect) {
          const opt = document.createElement('option');
          opt.value = configName;
          opt.textContent = configName;
          opt.selected = true;
          currentSelect.insertBefore(opt, currentSelect.lastElementChild);
          currentSelect.value = configName;
        }

        hideModal();
      };
    }

    function truncate(str, max) {
      if (!str) return '';
      return str.length > max ? str.slice(0, max - 1) + '…' : str;
    }

    function escapeHtml(unsafe) {
      return String(unsafe || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
      }[m]));
    }

    // Signal ready to host
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
    }
    static getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
exports.WebviewHtmlBuilder = WebviewHtmlBuilder;
//# sourceMappingURL=html.js.map