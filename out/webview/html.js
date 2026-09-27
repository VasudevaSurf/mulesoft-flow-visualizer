"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebviewHtmlBuilder = void 0;
class WebviewHtmlBuilder {
    static build(webview, extensionUri) {
        const nonce = this.getNonce();
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

    /* ── Canvas Viewport ────────────────────────────── */
    #viewport {
      flex: 1;
      height: 100%;
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

    /* ── Properties Docked Side Panel ──────────────── */
    #properties-panel {
      width: 360px;
      height: 100%;
      background: var(--flow-bg);
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      z-index: 60;
      transition: transform 0.2s ease, width 0.2s ease;
      box-shadow: -4px 0 16px rgba(0,0,0,0.15);
    }
    #properties-panel.collapsed {
      display: none;
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
      flex-direction: column;
      gap: 14px;
    }
    .prop-tab-pane.active {
      display: flex;
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

    <!-- Docked Properties Side Panel -->
    <div id="properties-panel" class="properties-dock collapsed">
      <div class="properties-header">
        <div class="properties-header-title">
          <span class="properties-icon-chip" id="prop-icon">⚙</span>
          <div>
            <div class="properties-title" id="prop-title">Properties</div>
            <div class="properties-subtitle" id="prop-subtitle">Select a component</div>
          </div>
        </div>
        <button class="tool-btn" id="btn-close-properties" title="Close Properties">✕</button>
      </div>
      
      <div class="properties-tabs" id="prop-tabs-header"></div>

      <div class="properties-content" id="prop-tabs-content">
        <div class="properties-empty-state" id="prop-empty">
          Click any processor or message source on the canvas to inspect its configuration and attributes.
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
    const vscode = acquireVsCodeApi();
    let currentModel = null;
    let currentScene = null;
    let selectedNodeId = null;

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
    document.getElementById('btn-toggle-properties').onclick = () => {
      propertiesPanel.classList.toggle('collapsed');
    };
    document.getElementById('btn-close-properties').onclick = () => {
      propertiesPanel.classList.add('collapsed');
    };

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
            if (gNode.range) {
              vscode.postMessage({ type: 'revealXml', range: gNode.range });
            }
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

      // Bind tile clicks
      document.querySelectorAll('.tile-group').forEach(tile => {
        tile.addEventListener('click', (e) => {
          e.stopPropagation();
          const nodeId = tile.getAttribute('data-node-id');
          const rangeJson = tile.getAttribute('data-range');
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

          if (rangeJson) {
            try {
              const range = JSON.parse(rangeJson);
              vscode.postMessage({ type: 'revealXml', range });
            } catch {}
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

      // Bind collapsed container tiles (expand on click + reveal XML)
      document.querySelectorAll('.container-collapsed-tile').forEach(tile => {
        tile.addEventListener('click', (e) => {
          e.stopPropagation();
          const nodeId = tile.getAttribute('data-node-id');
          const rangeJson = tile.getAttribute('data-range');
          if (rangeJson) {
            try {
              const range = JSON.parse(rangeJson);
              vscode.postMessage({ type: 'revealXml', range });
            } catch {}
          }
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

    function renderPropertiesPanel(data) {
      selectedNodeId = data.nodeId;
      const panel = document.getElementById('properties-panel');
      const titleEl = document.getElementById('prop-title');
      const subEl = document.getElementById('prop-subtitle');
      const tabsHeader = document.getElementById('prop-tabs-header');
      const tabsContent = document.getElementById('prop-tabs-content');
      const emptyEl = document.getElementById('prop-empty');

      if (!panel) return;
      panel.classList.remove('collapsed');

      if (emptyEl) emptyEl.style.display = 'none';

      titleEl.textContent = data.displayName || 'Component Properties';
      subEl.textContent = 'ID: ' + (data.nodeId || '');

      tabsHeader.innerHTML = '';
      tabsContent.innerHTML = '';

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
                if (input.type === 'checkbox') {
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
        div.className = 'prop-form-group prop-form-checkbox';
        const isChecked = val === true || val === 'true';
        div.innerHTML = 
          '<label class="prop-checkbox-label">' +
            '<input type="checkbox" data-param-name="' + escapeHtml(param.name) + '" ' + (isChecked ? 'checked' : '') + ' />' +
            '<span>' + escapeHtml(param.label) + '</span>' +
            reqAsterisk +
          '</label>' +
          (param.description ? '<div class="prop-desc">' + escapeHtml(param.description) + '</div>' : '');
        const cb = div.querySelector('input[type="checkbox"]');
        if (cb) {
          cb.onchange = function() {
            sendParamUpdate(selectedNodeId, param.name, cb.checked ? 'true' : 'false', 'boolean');
          };
        }
        return div;
      }

      // 4. Enum - <select>
      if (param.dataType === 'enum') {
        const allowed = param.allowedValues || ['DEFAULT'];
        const optionsHtml = allowed
          .map(function(opt) {
            return '<option value="' + escapeHtml(opt) + '" ' + (String(val).toUpperCase() === opt.toUpperCase() ? 'selected' : '') + '>' + escapeHtml(opt) + '</option>';
          })
          .join('');

        div.innerHTML = 
          '<label class="prop-label">' +
            escapeHtml(param.label) + ' ' + reqAsterisk +
            '<span class="prop-type-badge">enum</span>' +
          '</label>' +
          '<select class="prop-select" data-param-name="' + escapeHtml(param.name) + '">' +
            optionsHtml +
          '</select>' +
          (param.description ? '<div class="prop-desc">' + escapeHtml(param.description) + '</div>' : '');
        const sel = div.querySelector('select');
        if (sel) {
          sel.onchange = function() {
            sendParamUpdate(selectedNodeId, param.name, sel.value, 'enum');
          };
        }
        return div;
      }

      // 5. List - Repeatable "+ Add" block
      if (param.dataType === 'list') {
        div.className = 'prop-form-group prop-list-group';
        const items = Array.isArray(val) ? val : (val ? [val] : []);

        const headerDiv = document.createElement('div');
        headerDiv.className = 'prop-list-header';
        headerDiv.innerHTML = 
          '<label class="prop-label">' +
            escapeHtml(param.label) + ' ' + reqAsterisk +
            '<span class="prop-type-badge">list</span>' +
          '</label>' +
          '<button type="button" class="prop-btn-add">+ Add</button>';

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'prop-list-items';

        function notifyListChange() {
          const vals = [];
          itemsContainer.querySelectorAll('.prop-input').forEach(function(inp) {
            if (inp.value.trim() !== '') vals.push(inp.value.trim());
          });
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

        headerDiv.querySelector('.prop-btn-add').onclick = function() {
          addItemRow();
          notifyListChange();
        };

        div.appendChild(headerDiv);
        div.appendChild(itemsContainer);
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
          '</summary>' +
          '<div class="prop-complex-body">' +
            '<textarea class="prop-textarea" data-param-name="' + escapeHtml(param.name) + '" rows="3" placeholder="key: value or DataWeave expression...">' + escapeHtml(strVal) + '</textarea>' +
          '</div>' +
          (param.description ? '<div class="prop-desc" style="margin-top: 6px;">' + escapeHtml(param.description) + '</div>' : '');
        const ta = details.querySelector('textarea');
        if (ta) {
          let timer;
          ta.oninput = function() {
            clearTimeout(timer);
            timer = setTimeout(function() {
              sendParamUpdate(selectedNodeId, param.name, ta.value, 'complex-object');
            }, 500);
          };
          ta.onchange = function() {
            clearTimeout(timer);
            sendParamUpdate(selectedNodeId, param.name, ta.value, 'complex-object');
          };
        }
        return details;
      }

      // 7. Text input for string or number (default)
      const inputType = param.dataType === 'number' ? 'number' : 'text';
      div.innerHTML = 
        '<label class="prop-label">' +
          escapeHtml(param.label) + ' ' + reqAsterisk +
          (param.dataType === 'number' ? '<span class="prop-type-badge">number</span>' : '') +
        '</label>' +
        '<input type="' + inputType + '" class="prop-input" data-param-name="' + escapeHtml(param.name) + '" value="' + escapeHtml(String(val)) + '" placeholder="' + escapeHtml(param.defaultValue !== undefined && param.defaultValue !== null ? String(param.defaultValue) : '') + '" />' +
        (param.description ? '<div class="prop-desc">' + escapeHtml(param.description) + '</div>' : '');
      const inp = div.querySelector('input');
      if (inp) {
        let timer;
        inp.oninput = function() {
          clearTimeout(timer);
          timer = setTimeout(function() {
            sendParamUpdate(selectedNodeId, param.name, inp.value, param.dataType);
          }, 400);
        };
        inp.onchange = function() {
          clearTimeout(timer);
          sendParamUpdate(selectedNodeId, param.name, inp.value, param.dataType);
        };
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