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
      searchCount.textContent = \`\${matches} match\${matches === 1 ? '' : 'es'}\`;
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

      const target = document.querySelector(\`[data-node-id="\${nodeId}"]\`);
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
        li.innerHTML = \`<span class="flow-item-icon">\${flow.flowModel.type === 'sub-flow' ? '⚡' : '⮞'}</span> \${escapeHtml(flow.flowModel.name)}\`;
        li.onclick = () => {
          document.querySelectorAll('.flow-item').forEach(i => i.classList.remove('active'));
          li.classList.add('active');
          panX = 40;
          panY = 40 - flow.y * scale;
          updateTransform();
        };
        flowList.appendChild(li);
      });

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
      if (flow.sourceBox) {
        const dividerX = flow.sourceBox.x + flow.sourceBox.width + 6;
        html += \`<line class="source-divider" x1="\${dividerX}" y1="\${flow.sourceBox.y}" x2="\${dividerX}" y2="\${flow.sourceBox.y + flow.sourceBox.height}" />\`;
        if (flow.source) {
          html += renderNode(flow.source);
        }
      }

      // Process Lane Line
      if (flow.chain.length > 0) {
        const first = flow.chain[0];
        const last = flow.chain[flow.chain.length - 1];
        const laneY = first.laneY;
        const startX = flow.sourceBox ? (flow.sourceBox.x + flow.sourceBox.width + 12) : flow.processBox.x;
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

          // Incoming lane to spine
          html += \`<line class="lane-line" x1="\${pNode.x}" y1="\${firstLaneY}" x2="\${spineX}" y2="\${firstLaneY}" marker-end="url(#arrow)" />\`;
          // Vertical spine
          html += \`<line class="router-spine" x1="\${spineX}" y1="\${firstLaneY}" x2="\${spineX}" y2="\${lastLaneY}" />\`;

          for (const route of pNode.routes) {
            html += renderRoute(route, true, spineX);
          }

          // Rejoin bracket on the right
          const rejoinX = pNode.x + pNode.width - 20;
          html += \`<line class="router-spine" x1="\${rejoinX}" y1="\${firstLaneY}" x2="\${rejoinX}" y2="\${lastLaneY}" />\`;
          html += \`<line class="lane-line" x1="\${rejoinX}" y1="\${firstLaneY}" x2="\${pNode.x + pNode.width}" y2="\${firstLaneY}" marker-end="url(#arrow)" />\`;
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