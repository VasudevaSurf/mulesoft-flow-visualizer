"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNonce = getNonce;
exports.getWebviewContent = getWebviewContent;
function getNonce() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function getWebviewContent(opts) {
    const { flows, nonce, warnings } = opts;
    const serializeStep = (s) => ({
        label: s.label,
        nodeId: s.nodeId,
        tagName: s.tagName,
        shape: s.shape,
        flowRefTarget: s.flowRefTarget || null,
        rawAttrs: s.rawAttrs || {},
        lineNumber: s.lineNumber,
    });
    const flowsJson = JSON.stringify(flows.map((f) => ({
        kind: f.kind,
        name: f.name,
        lineNumber: f.lineNumber,
        subgraphId: f.subgraphId,
        steps: f.steps.map(serializeStep),
        errorHandler: f.errorHandler
            ? f.errorHandler.map((eh) => ({
                type: eh.type,
                label: eh.label,
                steps: eh.steps.map(serializeStep),
            }))
            : null,
    })));
    const flowListItems = flows
        .map((f) => {
        const icon = f.kind === "flow" ? "🔵" : f.kind === "sub-flow" ? "🟡" : "🔴";
        const kindLabel = f.kind === "flow" ? "Flow" : f.kind === "sub-flow" ? "Sub-Flow" : "Error Handler";
        return `<li class="flow-item" data-line="${f.lineNumber}" data-subgraph="${f.subgraphId}" title="Jump to line ${f.lineNumber}">
        <span class="fi">${icon}</span>
        <div class="fd">
          <span class="fk">${kindLabel}</span>
          <span class="fn">${escapeHtml(f.name)}</span>
        </div>
        <span class="fs">${f.steps.length}s</span>
      </li>`;
    })
        .join("\n");
    const warningBanner = warnings.length > 0
        ? `<div class="warn-bar">⚠️ ${warnings.map((w) => escapeHtml(w)).join(" | ")}</div>`
        : "";
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}' 'unsafe-inline'; img-src data:;"/>
<title>MuleSoft Flow Visualizer</title>
<style nonce="${nonce}">
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{display:flex;flex-direction:column;height:100vh;overflow:hidden;
  font-family:var(--vscode-font-family,Consolas,monospace);
  font-size:var(--vscode-font-size,12px);
  color:var(--vscode-foreground,#ccc);
  background:var(--vscode-editor-background,#1e1e1e)}

/* ── TOOLBAR ── */
#toolbar{display:flex;align-items:center;gap:6px;padding:5px 10px;
  background:var(--vscode-tab-activeBackground,#252526);
  border-bottom:1px solid var(--vscode-panel-border,#3c3c3c);flex-shrink:0}
#toolbar h1{font-size:12px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--vscode-titleBar-activeForeground,#ccc)}
.tbtn{background:var(--vscode-button-secondaryBackground,#3c3c3c);
  color:var(--vscode-button-secondaryForeground,#ccc);
  border:1px solid transparent;border-radius:3px;padding:3px 8px;cursor:pointer;font-size:11px;
  transition:background .12s}
.tbtn:hover{background:var(--vscode-button-secondaryHoverBackground,#505050)}
#zlabel{font-size:11px;color:var(--vscode-descriptionForeground,#888);min-width:42px;text-align:center}

/* ── WARN ── */
.warn-bar{padding:4px 12px;background:#452a00;border-bottom:1px solid #b89500;font-size:11px;flex-shrink:0}

/* ── LAYOUT ── */
#main{display:flex;flex:1;overflow:hidden;flex-direction:column}
#canvas-row{display:flex;flex:1;overflow:hidden;min-height:0}

/* ── SIDEBAR ── */
#sidebar{width:210px;min-width:130px;background:var(--vscode-sideBar-background,#252526);
  border-right:1px solid var(--vscode-panel-border,#3c3c3c);
  display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;height:100%;min-height:0}
#palette-sidebar{width:210px;min-width:130px;background:var(--vscode-sideBar-background,#252526);
  border-left:1px solid var(--vscode-panel-border,#3c3c3c);
  display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;height:100%;min-height:0}
#sh{padding:7px 9px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--vscode-sideBarSectionHeader-foreground,#bbb);
  background:var(--vscode-sideBarSectionHeader-background,#2d2d2d);
  border-bottom:1px solid var(--vscode-panel-border,#3c3c3c)}
#fl{list-style:none;overflow-y:auto;flex:1}
.flow-item{display:flex;align-items:center;gap:5px;padding:4px 9px;cursor:pointer;
  border-bottom:1px solid rgba(255,255,255,.04);font-size:11px;transition:background .08s}
.flow-item:hover{background:var(--vscode-list-hoverBackground,#2a2d2e)}
.flow-item.active{background:var(--vscode-list-activeSelectionBackground,#094771)}
.fi{font-size:9px;flex-shrink:0}
.fd{flex:1;overflow:hidden;display:flex;flex-direction:column;gap:1px}
.fk{font-size:9px;color:var(--vscode-descriptionForeground,#888)}
.fn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.fs{font-size:9px;color:var(--vscode-descriptionForeground,#666);flex-shrink:0}
#sf{padding:5px 9px;font-size:10px;color:var(--vscode-descriptionForeground,#777);
  border-top:1px solid var(--vscode-panel-border,#3c3c3c)}

/* ── CANVAS ── */
#cw{flex:1;overflow:hidden;position:relative;cursor:grab;background:var(--vscode-editor-background,#1e1e1e)}
#cw.panning{cursor:grabbing}
#main-svg{display:block;width:100%;height:100%}

/* ── PROPERTIES PANEL ── */
#props-panel{
  flex-shrink:0;
  background:var(--vscode-sideBar-background,#252526);
  border-top:2px solid var(--vscode-panel-border,#3c3c3c);
  display:flex;flex-direction:column;overflow:hidden;
  height:0;
  transition:height .2s ease;
}
#props-panel.open{height:260px}
#props-header{
  display:flex;align-items:center;gap:8px;
  padding:6px 12px;
  background:var(--vscode-sideBarSectionHeader-background,#2d2d2d);
  border-bottom:1px solid var(--vscode-panel-border,#3c3c3c);
  flex-shrink:0;cursor:ns-resize;user-select:none
}
#props-icon{font-size:14px}
#props-title{font-size:11px;font-weight:700;flex:1;color:var(--vscode-foreground,#ccc)}
#props-tag{font-size:10px;font-family:monospace;color:#569cd6;
  background:#1e1e1e;padding:1px 6px;border-radius:3px;border:1px solid #3c3c3c}
#props-close{background:none;border:none;color:var(--vscode-descriptionForeground,#888);
  cursor:pointer;font-size:14px;padding:0 2px;line-height:1}
#props-close:hover{color:var(--vscode-foreground,#ccc)}
#props-body{flex:1;overflow-y:auto;padding:8px 0}
.prop-group{margin-bottom:2px}
.prop-group-hdr{
  padding:3px 12px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--vscode-descriptionForeground,#888);
  background:var(--vscode-editor-background,#1e1e1e);
  border-bottom:1px solid rgba(255,255,255,.04);
  display:flex;align-items:center;gap:6px;cursor:pointer;
  user-select:none
}
.prop-group-hdr::before{content:'▾';font-size:10px;transition:transform .15s}
.prop-group-hdr.collapsed::before{transform:rotate(-90deg)}
.prop-rows{overflow:hidden}
.prop-row{
  display:grid;grid-template-columns:160px 1fr;
  padding:4px 12px;border-bottom:1px solid rgba(255,255,255,.03);
  align-items:start;font-size:11px
}
.prop-row:hover{background:rgba(255,255,255,.03)}
.prop-key{color:var(--vscode-descriptionForeground,#999);font-size:10px;padding-top:1px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.prop-val{color:var(--vscode-foreground,#d4d4d4);word-break:break-all;font-family:monospace;font-size:10px}
.prop-val.expr{color:#4ec9b0}
.prop-val.empty{color:#555;font-style:italic}
#props-empty{padding:20px 12px;font-size:11px;color:var(--vscode-descriptionForeground,#666);text-align:center}
#props-goto{margin:8px 12px 0;padding:4px 10px;font-size:11px;cursor:pointer;
  background:var(--vscode-button-background,#007acc);
  color:var(--vscode-button-foreground,#fff);
  border:none;border-radius:3px}
#props-goto:hover{background:var(--vscode-button-hoverBackground,#0098ff)}
/* resize handle */
#resize-handle{height:4px;cursor:ns-resize;background:transparent;flex-shrink:0}
#resize-handle:hover{background:var(--vscode-focusBorder,#007acc)}
/* schema badges */
.type-badge{font-size:8px;padding:0 4px;background:#1e3a5f;color:#9cdcfe;
  border-radius:3px;margin-left:3px;vertical-align:middle;font-family:monospace}
.req-badge{color:#f48771;font-weight:700;margin-left:2px}
.prop-val.default-val{color:#888;font-style:italic}
.row-missing{background:rgba(200,50,50,.08)!important}
.row-missing .prop-key{color:#f48771}
/* select dropdowns and text inputs */
.prop-select, .prop-input{
  background:var(--vscode-dropdown-background,#252526);
  color:var(--vscode-foreground,#ccc);
  border:1px solid var(--vscode-dropdown-border,#3c3c3c);
  border-radius:2px;
  padding:2px 4px;
  font-family:monospace;
  font-size:10px;
  outline:none;
  width:100%;
  max-width:300px;
}
.prop-select:focus, .prop-input:focus{
  border-color:var(--vscode-focusBorder,#007acc);
}
/* TOOLTIP */
#tip{position:fixed;background:var(--vscode-editorHoverWidget-background,#252526);
  border:1px solid var(--vscode-editorHoverWidget-border,#454545);
  color:var(--vscode-editorHoverWidget-foreground,#d4d4d4);
  padding:3px 7px;border-radius:3px;font-size:10px;pointer-events:none;
  opacity:0;transition:opacity .12s;z-index:100}
#tip.show{opacity:1}

/* Palette styling */
.pal-group {
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
.pal-hdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 600;
  color: var(--vscode-sideBarSectionHeader-foreground, #ccc);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}
.pal-hdr:hover {
  background: rgba(255, 255, 255, 0.05);
}
.pal-hdr::before {
  content: '▼';
  font-size: 8px;
  margin-right: 6px;
  transition: transform 0.15s ease;
  display: inline-block;
}
.pal-hdr.collapsed::before {
  transform: rotate(-90deg);
}
.pal-count {
  font-size: 9px;
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 5px;
  border-radius: 10px;
  color: var(--vscode-descriptionForeground, #888);
}
.pal-list {
  overflow: hidden;
  padding: 2px 0;
}
.pal-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px 5px 22px;
  font-size: 11px;
  font-family: var(--vscode-font-family, monospace);
  color: var(--vscode-foreground, #ccc);
  cursor: pointer;
  transition: all 0.15s ease;
  border-left: 2px solid transparent;
}
.pal-item:hover {
  background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
  color: var(--vscode-list-activeSelectionForeground, #fff);
  border-left-color: var(--vscode-focusBorder, #007acc);
  padding-left: 24px;
}
.pal-item-icon {
  font-size: 8px;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: #fff;
  background: #4a5568;
  flex-shrink: 0;
  text-transform: uppercase;
}
.pal-item-icon.core { background: #3182ce; }
.pal-item-icon.http { background: #319795; }
.pal-item-icon.ee { background: #dd6b20; }
.pal-item-icon.db { background: #38a169; }
.pal-item-icon.apikit { background: #805ad5; }
.pal-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
</style>
</head>
<body>
<div id="toolbar">
  <h1>🔀 MuleSoft Multi-Flow Visualizer</h1>
  <button class="tbtn" id="b-out" title="Zoom out (Ctrl -)">－</button>
  <span id="zlabel">100%</span>
  <button class="tbtn" id="b-in" title="Zoom in (Ctrl +)">＋</button>
  <button class="tbtn" id="b-fit" title="Fit all (Ctrl 0)">⊡ Fit</button>
  <button class="tbtn" id="b-ref" title="Refresh">↻ Refresh</button>
  <button class="tbtn" id="b-svg" title="Export SVG">⬇ SVG</button>
</div>
${warningBanner}
<div id="main">
  <div id="canvas-row">
    <div id="sidebar">
      <div class="sidebar-sec" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 80px;">
        <div id="sh">Flows &amp; Sub-Flows</div>
        <ul id="fl" style="min-height: 0;">${flowListItems || '<li style="padding:10px;color:#888;font-size:11px">No flows found</li>'}</ul>
        <div id="sf">${flows.length} flow${flows.length !== 1 ? "s" : ""} detected</div>
      </div>
      <div class="sidebar-sec" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 80px; border-top: 1px solid var(--vscode-panel-border,#3c3c3c);">
        <div id="exchange-hdr" style="padding:7px 9px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--vscode-sideBarSectionHeader-foreground,#bbb);background:var(--vscode-sideBarSectionHeader-background,#2d2d2d);border-bottom:1px solid var(--vscode-panel-border,#3c3c3c)">Search Exchange</div>
        <div id="exchange-search-container" style="padding: 6px 9px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; gap: 4px;">
          <input type="text" id="exchange-search" placeholder="Search Exchange..." style="flex: 1; padding:3px 6px; font-size:10px; background:var(--vscode-input-background,#1e1e1e); color:var(--vscode-input-foreground,#ccc); border:1px solid var(--vscode-input-border,#3c3c3c); border-radius:2px; outline:none;" />
          <button id="exchange-btn" class="tbtn" style="padding: 2px 6px;">Go</button>
        </div>
        <div id="exchange-body" style="flex: 1; overflow-y: auto; padding: 4px 0; min-height: 0;">
          <div style="padding: 10px 12px; color: #666; font-style: italic;">Enter query to search connectors...</div>
        </div>
      </div>
    </div>
    <div id="cw">
      <svg id="main-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#5a9fd4"/>
          </marker>
          <marker id="arr-dash" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#9b59b6"/>
          </marker>
        </defs>
        <g id="viewport"></g>
      </svg>
    </div>
    <div id="palette-sidebar">
      <div id="palette-hdr" style="padding:7px 9px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--vscode-sideBarSectionHeader-foreground,#bbb);background:var(--vscode-sideBarSectionHeader-background,#2d2d2d);border-bottom:1px solid var(--vscode-panel-border,#3c3c3c)">Palette</div>
      <div id="palette-search-container" style="padding: 6px 9px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <input type="text" id="palette-search" placeholder="Filter operations..." style="width:100%; padding:3px 6px; font-size:10px; background:var(--vscode-input-background,#1e1e1e); color:var(--vscode-input-foreground,#ccc); border:1px solid var(--vscode-input-border,#3c3c3c); border-radius:2px; outline:none;" />
      </div>
      <div id="palette-body" style="flex: 1; overflow-y: auto; padding: 4px 0; min-height: 0;">
        <div class="palette-loading" style="padding: 10px 12px; color: #888; font-style: italic;">Loading operations...</div>
      </div>
    </div>
  </div>
  <!-- Properties Panel (Studio-style, bottom) -->
  <div id="resize-handle"></div>
  <div id="props-panel">
    <div id="props-header">
      <span id="props-icon">📋</span>
      <span id="props-title">Properties</span>
      <span id="props-tag"></span>
      <button id="props-goto" title="Jump to source line" style="display:none">↗ Go to Source</button>
      <button id="props-close">✕</button>
    </div>
    <div id="props-body">
      <div id="props-empty">Click a node to view its properties</div>
    </div>
  </div>
</div>
<div id="tip"></div>
<div id="add-menu" style="display:none; position:fixed; z-index:1000; background:var(--vscode-sideBar-background,#252526); border:1px solid var(--vscode-panel-border,#3c3c3c); border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.5); width:200px; max-height:250px; overflow-y:auto; font-family:var(--vscode-font-family,sans-serif); font-size:11px;">
  <div style="padding:4px; border-bottom:1px solid rgba(255,255,255,0.05);">
    <input type="text" id="add-menu-search" placeholder="Search operations..." style="width:100%; padding:3px 6px; font-size:10px; background:var(--vscode-input-background,#1e1e1e); color:var(--vscode-input-foreground,#ccc); border:1px solid var(--vscode-input-border,#3c3c3c); border-radius:2px; outline:none;" />
  </div>
  <div id="add-menu-list"></div>
</div>
<div id="toast" style="display:none; position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.85); color:#fff; padding:8px 16px; border-radius:4px; font-size:11px; z-index:2000; box-shadow:0 2px 8px rgba(0,0,0,0.4); pointer-events:none;"></div>

<script nonce="${nonce}">
(function(){
'use strict';

// ── Show errors on canvas instead of failing silently ─────────────────────────
window.onerror = function(msg, src, line, col, err){
  var c = document.getElementById('cw') || document.body;
  var d = document.createElement('div');
  d.style.cssText = 'position:absolute;top:8px;left:8px;right:8px;padding:12px;background:#4a1010;color:#f48771;font-family:monospace;font-size:11px;z-index:999;white-space:pre-wrap;border:1px solid #c0392b;border-radius:4px';
  d.textContent = 'MuleViz Error (line ' + line + '): ' + msg;
  c.appendChild(d);
  return true;
};

// ── Parse FLOWS from base64-encoded JSON ──────────────────────────────────────
var FLOWS;
try {
  FLOWS = JSON.parse(atob('${Buffer.from(flowsJson).toString("base64")}'));
} catch(e) {
  FLOWS = [];
}
var vscode = acquireVsCodeApi();

const collapsedFlows = new Set();
const collapsedPaletteGroups = new Set();


// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_W      = 120;
const NODE_H      = 64;
const NODE_GAP    = 36;
const FLOW_PAD_H  = 18;
const FLOW_PAD_V  = 14;
const FLOW_HDR    = 26;
const FLOW_GAP    = 24;
const CANVAS_PAD  = 32;
const EH_DIVIDER  = 10;
const EH_HDR      = 22;
const EH_PAD_V    = 10;
const EH_STRAT_GAP= 6;
const MINI_W      = 100;
const MINI_GAP    = 20;
const MINI_H      = 48;

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  flowBg:'#2d2d30', flowBorder:'#3e3e42',
  flowHdr:'#007acc', subFlowHdr:'#68217a', errHdr:'#c0392b',
  errSectionBorder:'#6b2929',
  errStratProp:'#c0392b', errStratCont:'#d35400',
  hdrText:'#ffffff',
  nodeBg:'#1e1e1e', nodeHover:'#0e3a5c',
  nodeText:'#d4d4d4', nodeSubText:'#888888',
  arrow:'#5a9fd4', arrowDash:'#9b59b6',
  nodeSelected:'#1a3a5c', nodeSelectedBorder:'#007acc',
  stadium:'#4ec9b0', cylinder:'#ce9178', diamond:'#dcdcaa',
  subroutine:'#c586c0', rect:'#569cd6',
};

// ── Pretty-print attribute key ─────────────────────────────────────────────────
function friendlyKey(k){
  // Strip namespace prefixes (e.g. 'http:response' → 'response', 'ee:set-payload' → 'set-payload')
  var cleaned = k.replace(/[a-z]+:/g, '');
  // Convert separators: ' > ' → ' ', '.' → ' '
  cleaned = cleaned.replace(/\s*>\s*/g, ' ').replace(/\./g, ' ');
  // Convert camelCase + kebab-case to Title Case
  return cleaned
    .replace(/([a-z])([A-Z])/g,'$1 $2')
    .replace(/[-]/g,' ')
    .replace(/\b\w/g,function(c){return c.toUpperCase()})
    .trim();
}

// ── Build grouped property sections from rawAttrs ────────────────────────────
function buildPropGroups(tagName, rawAttrs){
  const groups = [];
  const rows = [];
  for (const [k, v] of Object.entries(rawAttrs)) {
    if (k !== 'name' && v !== undefined && v !== '') {
      rows.push({ k, v });
    }
  }
  if (rows.length) {
    groups.push({ label: 'General', rows });
  }
  return groups;
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent){
  const e = document.createElementNS(NS, tag);
  if(attrs) for(const [k,v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if(parent) parent.appendChild(e);
  return e;
}
function trunc(s, maxPx){ const mc=Math.max(3,Math.floor(maxPx/6.5)); return s&&s.length>mc?s.slice(0,mc-1)+'…':s||''; }

// ── Properties Panel DOM refs ─────────────────────────────────────────────────
const propsPanel  = document.getElementById('props-panel');
const propsTitle  = document.getElementById('props-title');
const propsTag    = document.getElementById('props-tag');
const propsBody   = document.getElementById('props-body');
const propsIcon   = document.getElementById('props-icon');
const propsGoto   = document.getElementById('props-goto');
let propLineNo    = 0;

const ICONS_MAP = {
  stadium:'\uD83D\uDFE2', cylinder:'\uD5D9\uFE0F', diamond:'\uD83D\uDD00', subroutine:'\uD83D\uDCE4', rect:'\u2699\uFE0F'
};

// ── Currently selected node ───────────────────────────────────────────────────
let selectedNodeEl = null;

function selectNode(nodeEl, step, flowLineNumber){
  // Deselect previous
  if(selectedNodeEl){
    const nb = selectedNodeEl.querySelector('.nb');
    if(nb){ nb.setAttribute('fill', C.nodeBg); nb.setAttribute('stroke', C[selectedNodeEl._acColor]||C.rect); }
  }
  selectedNodeEl = nodeEl;
  nodeEl._acColor = nodeEl._acColor || 'rect';
  const nb = nodeEl.querySelector('.nb');
  if(nb){ nb.setAttribute('fill', C.nodeSelected); nb.setAttribute('stroke', C.nodeSelectedBorder); }

  // 1. Show rawAttrs immediately for instant feedback
  showProperties(step, flowLineNumber);

  // 2. Ask extension to resolve the full connector schema from the JAR
  const prefix = step.tagName.includes(':') ? step.tagName.split(':')[0] : '';
  if(prefix && prefix !== 'doc'){
    setSchemaLoading(true);
    vscode.postMessage({
      command: 'getConnectorSchema',
      tagName: step.tagName,
      rawAttrs: step.rawAttrs || {},
      lineNumber: flowLineNumber,
    });
  }
}

function setSchemaLoading(on){
  let badge = document.getElementById('schema-badge');
  if(on){
    if(!badge){
      badge = document.createElement('span');
      badge.id = 'schema-badge';
      badge.style.cssText = 'font-size:10px;color:var(--vscode-descriptionForeground,#888);margin-left:6px;vertical-align:middle';
      propsTag.insertAdjacentElement('afterend', badge);
    }
    badge.textContent = '· loading schema';
    badge.style.display = '';
  } else {
    if(badge) badge.style.display = 'none';
  }
}

function showProperties(step, lineNumber){
  propLineNo = lineNumber;
  propsPanel.classList.add('open');
  propsIcon.textContent = ICONS_MAP[step.shape] || '\u2699\ufe0f';
  const docName = step.rawAttrs['doc:name'] || step.rawAttrs['name'] || '';
  propsTitle.textContent = docName || friendlyKey(step.tagName);
  propsTag.textContent   = step.tagName;
  propsGoto.style.display = lineNumber > 0 ? '' : 'none';
  renderRawAttrGroups(step.tagName, step.rawAttrs);
}

function renderRawAttrGroups(tagName, rawAttrs){
  const groups = buildPropGroups(tagName, rawAttrs);
  propsBody.innerHTML = '';
  if(!groups.length){
    propsBody.innerHTML = '<div style="padding:16px 12px;color:#666;font-size:11px;text-align:center">No attributes — loading schema…</div>';
    return;
  }
  for(const grp of groups) appendPropGroup(propsBody, grp.label, grp.rows, tagName);
}

function renderSchemaGroups(tagName, rawAttrs, matchedOp){
  propsBody.innerHTML = '';
  if(!matchedOp || !matchedOp.parameters || !matchedOp.parameters.length){
    renderRawAttrGroups(tagName, rawAttrs); return;
  }
  const generalRows=[], advRows=[];
  for(const param of matchedOp.parameters){
    const v = rawAttrs[param.name] || '';
    const row = {k:param.name, v, param};
    if(param.required || ['doc:name','config-ref','name'].includes(param.name)) generalRows.push(row);
    else advRows.push(row);
  }
  if(generalRows.length) appendSchemaGroup(propsBody, 'General', generalRows, tagName);
  if(advRows.length)     appendSchemaGroup(propsBody, 'Advanced', advRows, tagName);
  const knownKeys = new Set(matchedOp.parameters.map(p=>p.name));
  const extraRows = Object.entries(rawAttrs).filter(([k,v])=>!knownKeys.has(k)&&v!=='').map(([k,v])=>({k,v}));
  if(extraRows.length) appendPropGroup(propsBody, 'XML Extras', extraRows, tagName);
}

function appendPropGroup(container, label, rows, tagName){
  const g=document.createElement('div'); g.className='prop-group';
  const hdr=document.createElement('div'); hdr.className='prop-group-hdr'; hdr.textContent=label;
  const body=document.createElement('div'); body.className='prop-rows';
  hdr.addEventListener('click',()=>{ hdr.classList.toggle('collapsed'); body.style.display=hdr.classList.contains('collapsed')?'none':''; });
  g.appendChild(hdr);
  for(const {k,v} of rows) body.appendChild(makeRawRow(k, v, tagName));
  g.appendChild(body); container.appendChild(g);
}

function appendSchemaGroup(container, label, rows, tagName){
  const g=document.createElement('div'); g.className='prop-group';
  const hdr=document.createElement('div'); hdr.className='prop-group-hdr'; hdr.textContent=label;
  const body=document.createElement('div'); body.className='prop-rows';
  hdr.addEventListener('click',()=>{ hdr.classList.toggle('collapsed'); body.style.display=hdr.classList.contains('collapsed')?'none':''; });
  g.appendChild(hdr);
  for(const r of rows) body.appendChild(makeSchemaRow(r.k, r.v, r.param, tagName));
  g.appendChild(body); container.appendChild(g);
}

function makeRawRow(k, v, tagName){
  const row=document.createElement('div'); row.className='prop-row';
  const kEl=document.createElement('div'); kEl.className='prop-key'; kEl.textContent=friendlyKey(k); kEl.title=k;
  row.appendChild(kEl); row.appendChild(makeValueEl(v, null, k, tagName)); return row;
}

function makeSchemaRow(k, v, param, tagName){
  const isEmpty=!v||!v.trim();
  const row=document.createElement('div');
  row.className='prop-row'+(param&&param.required&&isEmpty?' row-missing':'');
  const kEl=document.createElement('div'); kEl.className='prop-key';
  kEl.innerHTML=friendlyKey(k)
    +(param&&param.type?' <span class="type-badge">'+escHtml(param.type)+'</span>':'')
    +(param&&param.required?' <span class="req-badge">*</span>':'');
  kEl.title=k+(param&&param.allowedValues?'\\nAllowed: '+param.allowedValues.join(', '):'');
  row.appendChild(kEl); row.appendChild(makeValueEl(v, param, k, tagName)); return row;
}

function makeValueEl(v, param, k, tagName){
  const allowedVals = param && (param.allowedValues || (param.type === 'boolean' ? ['true', 'false'] : null));
  if(allowedVals && allowedVals.length > 0) {
    const select = document.createElement('select');
    select.className = 'prop-select';
    
    if(!param.required && !v){
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '(not set)';
      emptyOpt.selected = true;
      select.appendChild(emptyOpt);
    }
    
    const valTrim = (v || '').trim();
    let matched = false;
    
    for(const optVal of allowedVals){
      const opt = document.createElement('option');
      opt.value = optVal;
      opt.textContent = optVal;
      if(optVal === valTrim || (!valTrim && optVal === param.defaultValue)){
        opt.selected = true;
        matched = true;
      }
      select.appendChild(opt);
    }
    
    if(valTrim && !matched){
      const opt = document.createElement('option');
      opt.value = valTrim;
      opt.textContent = valTrim;
      opt.selected = true;
      select.insertBefore(opt, select.firstChild);
    }

    select.addEventListener('change', () => {
      vscode.postMessage({
        command: 'updateAttribute',
        tagName: tagName,
        lineNumber: propLineNo,
        attributeName: k,
        newValue: select.value
      });
    });
    
    return select;
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'prop-input';
  input.value = v || '';
  if(param && param.defaultValue){
    input.placeholder = param.defaultValue;
  } else {
    input.placeholder = '(not set)';
  }

  const commitChange = () => {
    const newValue = input.value;
    if (newValue === v) return;
    vscode.postMessage({
      command: 'updateAttribute',
      tagName: tagName,
      lineNumber: propLineNo,
      attributeName: k,
      newValue: newValue
    });
  };

  input.addEventListener('change', commitChange);
  input.addEventListener('blur', commitChange);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });

  return input;
}

function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.getElementById('props-close').addEventListener('click',()=>{
  propsPanel.classList.remove('open');
  if(selectedNodeEl){
    const nb = selectedNodeEl.querySelector('.nb');
    if(nb) nb.setAttribute('fill', C.nodeBg);
    selectedNodeEl = null;
  }
});

propsGoto.addEventListener('click',()=>{
  if(propLineNo > 0) vscode.postMessage({command:'jumpToLine',line:propLineNo});
});

// ── Resizable panel (drag resize handle) ─────────────────────────────────────
const resizeHandle = document.getElementById('resize-handle');
let resizing=false, resizeStartY=0, resizeStartH=0;
resizeHandle.addEventListener('mousedown',e=>{
  resizing=true; resizeStartY=e.clientY;
  resizeStartH = propsPanel.classList.contains('open') ? propsPanel.offsetHeight : 0;
  e.preventDefault();
});
window.addEventListener('mousemove',e=>{
  if(!resizing) return;
  const delta = resizeStartY - e.clientY;
  const newH  = Math.max(0, Math.min(500, resizeStartH + delta));
  if(newH < 40){ propsPanel.classList.remove('open'); propsPanel.style.height=''; }
  else { propsPanel.classList.add('open'); propsPanel.style.height = newH+'px'; }
});
window.addEventListener('mouseup',()=>{ resizing=false; });

// ── Draw a single node ────────────────────────────────────────────────────────
function drawNode(parent, step, x, y, flowLineNumber){
  const g = svgEl('g',{transform:\`translate(\${x},\${y})\`,cursor:'pointer','data-nodeid':step.nodeId},parent);
  g._acColor = step.shape;
  const ac = C[step.shape]||C.rect;
  const ih = NODE_H;

  const nb = svgEl('rect',{x:0,y:0,width:NODE_W,height:ih,rx:3,fill:C.nodeBg,stroke:ac,'stroke-width':1.5,class:'nb'},g);
  svgEl('rect',{x:0,y:0,width:NODE_W,height:4,rx:2,fill:ac},g);
  svgEl('rect',{x:0,y:2,width:NODE_W,height:2,fill:ac},g);
  svgEl('rect',{x:0,y:4,width:24,height:ih-4,fill:ac+'18'},g);

  const ICONS={stadium:'⬭',cylinder:'⊕',diamond:'⬡',subroutine:'⤵',rect:'▬'};
  const ico = svgEl('text',{x:12,y:ih/2+4,'text-anchor':'middle','font-size':14,fill:ac,style:'pointer-events:none'},g);
  ico.textContent = ICONS[step.shape]||'▬';

  const tagShort = step.tagName.includes(':') ? step.tagName.split(':')[1] : step.tagName;
  const tl = svgEl('text',{x:28,y:15,'font-size':8,'font-family':'monospace',fill:ac+'99',style:'pointer-events:none'},g);
  tl.textContent = trunc(tagShort.toUpperCase(), NODE_W-32);

  const parts = step.label.split(' - ');
  const ml = svgEl('text',{x:28,y:32,'font-size':10,'font-weight':'600',fill:C.nodeText,style:'pointer-events:none'},g);
  ml.textContent = trunc(parts[0], NODE_W-32);
  if(parts[1]){
    const sl = svgEl('text',{x:28,y:47,'font-size':9,fill:C.nodeSubText,style:'pointer-events:none'},g);
    sl.textContent = trunc(parts[1], NODE_W-32);
  }

  // Click → show properties panel (NOT jumping to code directly)
  g.addEventListener('click',e=>{
    e.stopPropagation();
    const line = step.lineNumber || flowLineNumber;
    highlightSidebar(null, line);
    selectNode(g, step, line);
  });
  g.addEventListener('mouseenter',e=>{
    if(selectedNodeEl!==g) nb.setAttribute('fill', C.nodeHover);
    showTip(e, step.tagName + (step.rawAttrs['doc:name'] ? ' — '+step.rawAttrs['doc:name'] : ''));
  });
  g.addEventListener('mouseleave',()=>{
    if(selectedNodeEl!==g) nb.setAttribute('fill', C.nodeBg);
    hideTip();
  });
  return g;
}

// ── Mini node (error-handler strategy) ───────────────────────────────────────
function drawMiniNode(parent, step, x, y, flowLineNumber){
  const g = svgEl('g',{transform:\`translate(\${x},\${y})\`,cursor:'pointer'},parent);
  g._acColor = step.shape;
  const ac = C[step.shape]||C.rect;

  const nb = svgEl('rect',{x:0,y:0,width:MINI_W,height:MINI_H,rx:3,fill:C.nodeBg,stroke:ac,'stroke-width':1.2,class:'nb'},g);
  svgEl('rect',{x:0,y:0,width:MINI_W,height:3,rx:2,fill:ac},g);
  svgEl('rect',{x:0,y:2,width:MINI_W,height:2,fill:ac},g);
  svgEl('rect',{x:0,y:3,width:18,height:MINI_H-3,fill:ac+'18'},g);

  const tagShort = step.tagName.includes(':') ? step.tagName.split(':')[1] : step.tagName;
  const tl = svgEl('text',{x:22,y:13,'font-size':7,'font-family':'monospace',fill:ac+'99',style:'pointer-events:none'},g);
  tl.textContent = trunc(tagShort.toUpperCase(), MINI_W-26);

  const parts = step.label.split(' - ');
  const ml = svgEl('text',{x:22,y:28,'font-size':9,'font-weight':'600',fill:C.nodeText,style:'pointer-events:none'},g);
  ml.textContent = trunc(parts[0], MINI_W-26);
  if(parts[1]){
    const sl = svgEl('text',{x:22,y:40,'font-size':8,fill:C.nodeSubText,style:'pointer-events:none'},g);
    sl.textContent = trunc(parts[1], MINI_W-26);
  }

  g.addEventListener('click',e=>{
    e.stopPropagation();
    selectNode(g, step, step.lineNumber || flowLineNumber);
  });
  g.addEventListener('mouseenter',e=>{if(selectedNodeEl!==g)nb.setAttribute('fill',C.nodeHover);showTip(e,step.tagName);});
  g.addEventListener('mouseleave',()=>{if(selectedNodeEl!==g)nb.setAttribute('fill',C.nodeBg);hideTip();});
  return g;
}

// ── drawPlusButton and canvas dimensions ─────────────────────────────────────
function drawPlusButton(parent, cx, cy, flow, step) {
  const g = svgEl('g', { class: 'plus-btn', cursor: 'pointer' }, parent);
  
  const circle = svgEl('circle', { cx, cy, r: 8, fill: C.nodeBg, stroke: C.arrow, 'stroke-width': 1.2 }, g);
  
  const text = svgEl('text', { x: cx, y: cy + 3, 'text-anchor': 'middle', 'font-size': 10, fill: C.arrow, 'font-weight': 'bold', style: 'pointer-events:none' }, g);
  text.textContent = '+';
  
  g.addEventListener('mouseenter', () => {
    circle.setAttribute('fill', C.nodeHover);
    circle.setAttribute('stroke', C.nodeSelectedBorder);
    text.setAttribute('fill', C.hdrText);
  });
  
  g.addEventListener('mouseleave', () => {
    circle.setAttribute('fill', C.nodeBg);
    circle.setAttribute('stroke', C.arrow);
    text.setAttribute('fill', C.arrow);
  });
  
  g.addEventListener('click', (e) => {
    e.stopPropagation();
    showAddMenu(e.clientX, e.clientY, flow, step);
  });
}

// ── Error-section sizing ──────────────────────────────────────────────────────
function errorSectionHeight(flow){
  if(!flow.errorHandler||!flow.errorHandler.length) return 0;
  if(collapsedFlows.has(flow.subgraphId + '_err')) {
    return EH_DIVIDER + EH_HDR;
  }
  let h = EH_DIVIDER + EH_HDR;
  for(const s of flow.errorHandler) h += EH_HDR + EH_PAD_V + MINI_H + EH_PAD_V + EH_STRAT_GAP;
  return h;
}

function flowSize(flow){
  if(collapsedFlows.has(flow.subgraphId)){
    return {w:200, h:FLOW_HDR};
  }
  const n = Math.max(flow.steps.length,1);
  const mainW = n*NODE_W + Math.max(0,n-1)*NODE_GAP + FLOW_PAD_H*2 + (flow.steps.length ? 40 : 0);
  let errW = 0;
  if(flow.errorHandler && !collapsedFlows.has(flow.subgraphId + '_err')){
    for(const strat of flow.errorHandler){
      const m = Math.max(strat.steps.length,1);
      errW = Math.max(errW, FLOW_PAD_H + m*MINI_W + Math.max(0,m-1)*MINI_GAP + FLOW_PAD_H + (strat.steps.length ? 30 : 0));
    }
  }
  const cw = Math.max(mainW, errW, 200);
  const mainH = FLOW_HDR + FLOW_PAD_V + NODE_H + FLOW_PAD_V;
  return {w:cw, h:mainH + errorSectionHeight(flow)};
}

// ── Draw error-handler section ────────────────────────────────────────────────
function drawErrorSection(parent, flow, flowW, mainH){
  if(!flow.errorHandler||!flow.errorHandler.length) return;
  let curY = mainH + EH_DIVIDER;

  const isErrCollapsed = collapsedFlows.has(flow.subgraphId + '_err');

  svgEl('rect',{x:0,y:curY,width:flowW,height:EH_HDR,fill:C.errHdr+'33',rx:0},parent);
  svgEl('rect',{x:0,y:curY,width:4,height:EH_HDR,fill:C.errHdr},parent);
  
  const toggleBtn = svgEl('text', {
    x: 10, y: curY+EH_HDR/2+2, 'dominant-baseline': 'middle',
    fill: C.errHdr, 'font-size': 9, cursor: 'pointer'
  }, parent);
  toggleBtn.textContent = isErrCollapsed ? '▶' : '▼';
  
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isErrCollapsed) {
      collapsedFlows.delete(flow.subgraphId + '_err');
    } else {
      collapsedFlows.add(flow.subgraphId + '_err');
    }
    render();
  });

  const ehl = svgEl('text',{x:24,y:curY+EH_HDR/2+1,'dominant-baseline':'middle',
    fill:C.errHdr,'font-size':10,'font-weight':700,style:'pointer-events:none'},parent);
  ehl.textContent = '⚠ Error Handler';

  const errHit = svgEl('rect', { x: 0, y: curY, width: flowW, height: EH_HDR, fill: 'transparent', cursor: 'pointer' }, parent);
  errHit.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isErrCollapsed) {
      collapsedFlows.delete(flow.subgraphId + '_err');
    } else {
      collapsedFlows.add(flow.subgraphId + '_err');
    }
    render();
  });

  curY += EH_HDR;

  if (!isErrCollapsed) {
    for(const strat of flow.errorHandler){
      const isProp = strat.type==='on-error-propagate';
      const sc2 = isProp ? C.errStratProp : C.errStratCont;
      svgEl('rect',{x:4,y:curY,width:flowW-4,height:EH_HDR,fill:sc2+'22'},parent);
      svgEl('rect',{x:4,y:curY,width:3,height:EH_HDR,fill:sc2},parent);
      const sl = svgEl('text',{x:14,y:curY+EH_HDR/2+1,'dominant-baseline':'middle',
        fill:sc2,'font-size':9,'font-weight':600,style:'pointer-events:none'},parent);
      sl.textContent = trunc(strat.label, flowW-20);
      curY += EH_HDR;

      const nodesY = curY + EH_PAD_V;
      if(!strat.steps.length){
        const ep = svgEl('text',{x:FLOW_PAD_H,y:nodesY+MINI_H/2,'dominant-baseline':'middle',
          fill:'#555','font-size':10,style:'pointer-events:none'},parent);
        ep.textContent='Empty handler';
      } else {
        strat.steps.forEach((step,i)=>{
          const nx = FLOW_PAD_H + i*(MINI_W+MINI_GAP);
          drawMiniNode(parent, step, nx, nodesY, flow.lineNumber);
          if(i<strat.steps.length-1){
            const ay = nodesY+MINI_H/2;
            svgEl('line',{x1:nx+MINI_W,y1:ay,x2:FLOW_PAD_H+(i+1)*(MINI_W+MINI_GAP)-2,y2:ay,
              stroke:C.errHdr,'stroke-width':1.2,'marker-end':'url(#arr)'},parent);
            
            const cx = nx + MINI_W + MINI_GAP / 2;
            drawPlusButton(parent, cx, ay, flow, step);
          }
          
          if (i === strat.steps.length - 1) {
            const ay = nodesY + MINI_H / 2;
            const lx1 = nx + MINI_W;
            const lx2 = lx1 + MINI_GAP / 2;
            svgEl('line', { x1: lx1, y1: ay, x2: lx2 - 2, y2: ay, stroke: C.errHdr, 'stroke-width': 1.2, 'marker-end': 'url(#arr)' }, parent);
            
            const cx = lx2 + 8;
            drawPlusButton(parent, cx, ay, flow, step);
          }
        });
      }
      curY += EH_PAD_V + MINI_H + EH_PAD_V + EH_STRAT_GAP;
    }
  }
}

// ── Draw one flow ─────────────────────────────────────────────────────────────
function drawFlow(parent, flow, x, y){
  const {w,h} = flowSize(flow);
  const hc = flow.kind==='flow'?C.flowHdr:flow.kind==='sub-flow'?C.subFlowHdr:C.errHdr;
  const mainH = FLOW_HDR+FLOW_PAD_V+NODE_H+FLOW_PAD_V;

  const g = svgEl('g',{transform:"translate(" + x + "," + y + ")",'data-subgraph':flow.subgraphId,'data-line':flow.lineNumber},parent);
  svgEl('rect',{x:0,y:0,width:w,height:h,rx:4,fill:C.flowBg,stroke:C.flowBorder,'stroke-width':1},g);
  svgEl('rect',{x:0,y:0,width:w,height:FLOW_HDR,rx:4,fill:hc},g);
  svgEl('rect',{x:0,y:FLOW_HDR-4,width:w,height:4,fill:hc},g);

  const kindPfx = flow.kind==='flow'?'Flow':flow.kind==='sub-flow'?'Sub-Flow':'Error Handler';
  
  const isCollapsed = collapsedFlows.has(flow.subgraphId);

  const hit = svgEl('rect',{x:22,y:0,width:Math.max(10, w-22),height:FLOW_HDR,fill:'transparent',cursor:'pointer'},g);
  hit.addEventListener('click',()=>{
    highlightSidebar(flow.subgraphId, flow.lineNumber);
    vscode.postMessage({command:'jumpToLine',line:flow.lineNumber});
  });

  const toggleBtn = svgEl('text', {
    x: 9, y: FLOW_HDR/2+2, 'dominant-baseline': 'middle',
    fill: C.hdrText, 'font-size': 10, cursor: 'pointer',
    class: 'flow-toggle-btn'
  }, g);
  toggleBtn.textContent = isCollapsed ? '▶' : '▼';
  
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isCollapsed) {
      collapsedFlows.delete(flow.subgraphId);
    } else {
      collapsedFlows.add(flow.subgraphId);
    }
    render();
  });

  const hl = svgEl('text',{x:24,y:FLOW_HDR/2+1,'dominant-baseline':'middle',
    fill:C.hdrText,'font-size':11,'font-weight':700,style:'pointer-events:none'},g);
  hl.textContent = trunc(kindPfx + ": " + flow.name, w - 35);

  if(!isCollapsed){
    if(!flow.steps.length){
      const ep = svgEl('text',{x:w/2,y:FLOW_HDR+FLOW_PAD_V+NODE_H/2,
        'text-anchor':'middle','dominant-baseline':'middle',fill:'#555','font-size':11,style:'pointer-events:none'},g);
      ep.textContent='Empty Flow';
    } else {
      flow.steps.forEach((step,i)=>{
        const nx = FLOW_PAD_H + i*(NODE_W+NODE_GAP);
        const ny = FLOW_HDR + FLOW_PAD_V;
        drawNode(g, step, nx, ny, flow.lineNumber);
        if(i<flow.steps.length-1){
          const ay = FLOW_HDR+FLOW_PAD_V+NODE_H/2;
          svgEl('line',{x1:nx+NODE_W,y1:ay,x2:FLOW_PAD_H+(i+1)*(NODE_W+NODE_GAP)-2,y2:ay,
            stroke:C.arrow,'stroke-width':1.5,'marker-end':'url(#arr)'},g);
          
          const cx = nx + NODE_W + NODE_GAP / 2;
          drawPlusButton(g, cx, ay, flow, step);
        }
        
        if (i === flow.steps.length - 1) {
          const ay = FLOW_HDR + FLOW_PAD_V + NODE_H / 2;
          const lx1 = nx + NODE_W;
          const lx2 = lx1 + NODE_GAP / 2;
          svgEl('line', { x1: lx1, y1: ay, x2: lx2 - 2, y2: ay, stroke: C.arrow, 'stroke-width': 1.5, 'marker-end': 'url(#arr)' }, g);
          
          const cx = lx2 + 8;
          drawPlusButton(g, cx, ay, flow, step);
        }
      });
    }
    drawErrorSection(g, flow, w, mainH);
  }

  return {w,h};
}

// ── Full render ───────────────────────────────────────────────────────────────
let canvasW=0, canvasH=0;
function render(){
  const vp = document.getElementById('viewport');
  vp.innerHTML='';
  selectedNodeEl=null;
  canvasW=0; canvasH=0;
  if(!FLOWS.length){
    svgEl('text',{x:200,y:200,'text-anchor':'middle',fill:'#555','font-size':14},vp).textContent='No flows found';
    return;
  }
  let curY=CANVAS_PAD;
  const rects=[];
  FLOWS.forEach(flow=>{
    const {w,h}=drawFlow(vp,flow,CANVAS_PAD,curY);
    rects.push({flow,x:CANVAS_PAD,y:curY,w,h});
    canvasW=Math.max(canvasW,CANVAS_PAD+w+CANVAS_PAD);
    curY+=h+FLOW_GAP;
  });
  canvasH=curY-FLOW_GAP+CANVAS_PAD;
  canvasW=Math.max(canvasW,400);

  // cross-flow ref arrows
  const flowByName=new Map(FLOWS.map(f=>[f.name,f]));
  const rectBySg=new Map(rects.map(r=>[r.flow.subgraphId,r]));
  rects.forEach(src=>{
    if (collapsedFlows.has(src.flow.subgraphId)) return;
    src.flow.steps.forEach((step,si)=>{
      if(!step.flowRefTarget) return;
      const tgt=flowByName.get(step.flowRefTarget);
      if(!tgt) return;
      const dst=rectBySg.get(tgt.subgraphId);
      if(!dst) return;
      const sx=src.x+FLOW_PAD_H+si*(NODE_W+NODE_GAP)+NODE_W/2;
      const sy=src.y+src.h;
      const dstCollapsed = collapsedFlows.has(tgt.subgraphId);
      const dx = dstCollapsed ? dst.x + 100 : dst.x+FLOW_PAD_H+NODE_W/2;
      const dy = dstCollapsed ? dst.y+FLOW_HDR/2 : dst.y;
      svgEl('path',{d:"M" + sx + "," + sy + " C" + sx + "," + (sy+40) + " " + dx + "," + (dy-40) + " " + dx + "," + dy,
        stroke:C.arrowDash,'stroke-width':1.5,fill:'none','stroke-dasharray':'5,3',
        'marker-end':'url(#arr-dash)',opacity:.8},vp);
    });
  });
  fitToWindow();
}

// ── Pan & Zoom ────────────────────────────────────────────────────────────────
const mainSvg=document.getElementById('main-svg');
const vp=document.getElementById('viewport');
const zl=document.getElementById('zlabel');
const cw=document.getElementById('cw');
let tx=0,ty=0,sc=1;

function applyT(){
  vp.setAttribute('transform',\`translate(\${tx},\${ty}) scale(\${sc})\`);
  zl.textContent=Math.round(sc*100)+'%';
}
function clampScale(s){ return Math.max(0.08,Math.min(6,s)); }
function zoomAt(factor,cx,cy){
  const ns=clampScale(sc*factor);
  tx=cx-(cx-tx)*(ns/sc); ty=cy-(cy-ty)*(ns/sc); sc=ns; applyT();
}
function fitToWindow(){
  if(!canvasW||!canvasH) return;
  const W=cw.clientWidth||600, H=cw.clientHeight||400;
  sc=clampScale(Math.min(W/canvasW,H/canvasH)*0.92);
  tx=(W-canvasW*sc)/2; ty=(H-canvasH*sc)/2;
  if(tx<8)tx=8; if(ty<8)ty=8; applyT();
}

document.getElementById('b-in').onclick  = ()=>zoomAt(1.25,cw.clientWidth/2,cw.clientHeight/2);
document.getElementById('b-out').onclick = ()=>zoomAt(1/1.25,cw.clientWidth/2,cw.clientHeight/2);
document.getElementById('b-fit').onclick = fitToWindow;
document.getElementById('b-ref').onclick = ()=>vscode.postMessage({command:'refresh'});
document.getElementById('b-svg').onclick = exportSvg;

// Plain scroll = pan; Ctrl+scroll = zoom  (Anypoint Studio behaviour)
cw.addEventListener('wheel',e=>{
  e.preventDefault();
  if(e.ctrlKey||e.metaKey){
    const r=cw.getBoundingClientRect();
    const zoomIntensity = 0.0015;
    const factor = Math.exp(-e.deltaY * zoomIntensity);
    zoomAt(factor, e.clientX-r.left, e.clientY-r.top);
  } else {
    tx-=e.deltaX; ty-=e.deltaY; applyT();
  }
},{passive:false});

document.addEventListener('keydown',e=>{
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key==='='){e.preventDefault();zoomAt(1.2,cw.clientWidth/2,cw.clientHeight/2);}
  if(mod&&e.key==='-'){e.preventDefault();zoomAt(1/1.2,cw.clientWidth/2,cw.clientHeight/2);}
  if(mod&&e.key==='0'){e.preventDefault();fitToWindow();}
  if(!mod){
    const S=40;
    if(e.key==='ArrowUp'){e.preventDefault();ty+=S;applyT();}
    if(e.key==='ArrowDown'){e.preventDefault();ty-=S;applyT();}
    if(e.key==='ArrowLeft'){e.preventDefault();tx+=S;applyT();}
    if(e.key==='ArrowRight'){e.preventDefault();tx-=S;applyT();}
  }
});

let panning=false,px0=0,py0=0,tx0=0,ty0=0;
cw.addEventListener('mousedown',e=>{
  if(e.button!==0) return;
  if(e.target.closest('[cursor="pointer"]')) return;
  panning=true; px0=e.clientX; py0=e.clientY; tx0=tx; ty0=ty;
  cw.classList.add('panning');
});
window.addEventListener('mousemove',e=>{if(!panning)return;tx=tx0+(e.clientX-px0);ty=ty0+(e.clientY-py0);applyT();});
window.addEventListener('mouseup',()=>{panning=false;cw.classList.remove('panning');});

// ── Sidebar & Palette state ───────────────────────────────────────────────────
let ALL_CATALOG = [];
const paletteBody = document.getElementById('palette-body');
const paletteSearch = document.getElementById('palette-search');
const addMenu = document.getElementById('add-menu');
const addMenuSearch = document.getElementById('add-menu-search');
const addMenuList = document.getElementById('add-menu-list');
const toast = document.getElementById('toast');

let activeInsertFlow = null;
let activeInsertStep = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function renderPalette(filterText = '') {
  paletteBody.innerHTML = '';
  if (!ALL_CATALOG || !ALL_CATALOG.length) {
    paletteBody.innerHTML = '<div style="padding:10px 12px;color:#888;font-style:italic;">No operations found</div>';
    return;
  }
  
  const query = filterText.toLowerCase().trim();
  
  ALL_CATALOG.forEach(group => {
    const matchingOps = group.operations.filter(op => {
      const fullTag = group.prefix ? group.prefix + ':' + op : op;
      return fullTag.toLowerCase().includes(query) || group.connector.toLowerCase().includes(query);
    });
    
    if (!matchingOps.length) return;
    
    const sec = document.createElement('div');
    sec.className = 'pal-group';
    
    const isCollapsed = collapsedPaletteGroups.has(group.connector);
    
    const hdr = document.createElement('div');
    hdr.className = 'pal-hdr' + (isCollapsed ? ' collapsed' : '');
    
    const titleSpan = document.createElement('span');
    titleSpan.textContent = group.connector;
    hdr.appendChild(titleSpan);
    
    const countBadge = document.createElement('span');
    countBadge.className = 'pal-count';
    countBadge.textContent = matchingOps.length;
    hdr.appendChild(countBadge);
    
    hdr.addEventListener('click', () => {
      if (isCollapsed) {
        collapsedPaletteGroups.delete(group.connector);
      } else {
        collapsedPaletteGroups.add(group.connector);
      }
      renderPalette(filterText);
    });
    
    sec.appendChild(hdr);
    
    if (!isCollapsed) {
      const list = document.createElement('div');
      list.className = 'pal-list';
      
      matchingOps.forEach(op => {
        const item = document.createElement('div');
        item.className = 'pal-item';
        
        const fullTag = group.prefix ? group.prefix + ':' + op : op;
        item.title = 'Click and then select a (+) button on the canvas to insert "' + fullTag + '"';
        
        // Icon badge
        const icon = document.createElement('div');
        icon.className = 'pal-item-icon';
        const pfx = group.prefix || 'core';
        icon.classList.add(pfx);
        icon.textContent = pfx.charAt(0);
        item.appendChild(icon);
        
        // Name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'pal-item-name';
        nameSpan.textContent = fullTag;
        item.appendChild(nameSpan);
        
        item.addEventListener('click', () => {
          showToast('Now select any (+) button on the canvas to insert "' + fullTag + '"');
          document.querySelectorAll('.plus-btn circle').forEach(c => {
            c.setAttribute('stroke', '#ffcc00');
            c.setAttribute('stroke-width', '2');
          });
          window._pendingInsertTag = fullTag;
        });
        
        list.appendChild(item);
      });
      sec.appendChild(list);
    }
    
    paletteBody.appendChild(sec);
  });
}

paletteSearch.addEventListener('input', e => {
  renderPalette(e.target.value);
});

// ── Add Component popup menu ──────────────────────────────────────────────────
function showAddMenu(clientX, clientY, flow, step) {
  if (window._pendingInsertTag) {
    const tagToInsert = window._pendingInsertTag;
    window._pendingInsertTag = null;
    document.querySelectorAll('.plus-btn circle').forEach(c => {
      c.setAttribute('stroke', C.arrow);
      c.setAttribute('stroke-width', '1.2');
    });
    
    vscode.postMessage({
      command: 'addComponent',
      insertAfterLine: step.lineNumber || flow.lineNumber,
      insertAfterTagName: step.tagName,
      newTagName: tagToInsert
    });
    return;
  }

  activeInsertFlow = flow;
  activeInsertStep = step;
  
  addMenu.style.left = clientX + 'px';
  addMenu.style.top = Math.min(window.innerHeight - 260, clientY) + 'px';
  addMenu.style.display = 'block';
  
  addMenuSearch.value = '';
  renderAddMenuList('');
  addMenuSearch.focus();
}

function renderAddMenuList(filterText = '') {
  addMenuList.innerHTML = '';
  const query = filterText.toLowerCase().trim();
  
  ALL_CATALOG.forEach(group => {
    const matchingOps = group.operations.filter(op => {
      const fullTag = group.prefix ? group.prefix + ':' + op : op;
      return fullTag.toLowerCase().includes(query) || group.connector.toLowerCase().includes(query);
    });
    
    if (!matchingOps.length) return;
    
    matchingOps.forEach(op => {
      const fullTag = group.prefix ? group.prefix + ':' + op : op;
      const item = document.createElement('div');
      item.className = 'pal-item';
      item.style.paddingLeft = '12px'; // slightly smaller indent for popup
      
      const icon = document.createElement('div');
      icon.className = 'pal-item-icon';
      const pfx = group.prefix || 'core';
      icon.classList.add(pfx);
      icon.textContent = pfx.charAt(0);
      item.appendChild(icon);
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'pal-item-name';
      nameSpan.textContent = fullTag;
      item.appendChild(nameSpan);
      
      item.addEventListener('click', () => {
        addMenu.style.display = 'none';
        if (activeInsertStep && activeInsertFlow) {
          vscode.postMessage({
            command: 'addComponent',
            insertAfterLine: activeInsertStep.lineNumber || activeInsertFlow.lineNumber,
            insertAfterTagName: activeInsertStep.tagName,
            newTagName: fullTag
          });
        }
      });
      addMenuList.appendChild(item);
    });
  });
}

addMenuSearch.addEventListener('input', e => {
  renderAddMenuList(e.target.value);
});

document.addEventListener('click', e => {
  if (!e.target.closest('#add-menu') && !e.target.closest('.plus-btn')) {
    addMenu.style.display = 'none';
  }
});

// ── Sidebar navigation ────────────────────────────────────────────────────────
document.querySelectorAll('.flow-item').forEach(item=>{
  item.addEventListener('click',()=>{
    const line=parseInt(item.dataset.line||'0',10);
    if(line>0){ highlightSidebar(item.dataset.subgraph,line); vscode.postMessage({command:'jumpToLine',line}); }
  });
});
function highlightSidebar(sgId,line){
  document.querySelectorAll('.flow-item').forEach(el=>{
    const active = (sgId&&el.dataset.subgraph===sgId)||parseInt(el.dataset.line,10)===line;
    el.classList.toggle('active',active);
    if(active) el.scrollIntoView({block:'nearest'});
  });
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const tip=document.getElementById('tip');
function showTip(e,msg){tip.textContent=msg;tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY+14)+'px';tip.classList.add('show');}
function hideTip(){tip.classList.remove('show');}
document.addEventListener('mousemove',e=>{
  if(tip.classList.contains('show')){tip.style.left=(e.clientX+14)+'px';tip.style.top=(e.clientY+14)+'px';}
});

// ── SVG Export ────────────────────────────────────────────────────────────────
function exportSvg(){
  const clone=mainSvg.cloneNode(true);
  clone.setAttribute('width',canvasW); clone.setAttribute('height',canvasH);
  clone.querySelector('#viewport').setAttribute('transform','');
  const blob=new Blob([clone.outerHTML],{type:'image/svg+xml'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='mule-flows.svg'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

// ── Hot update + connector schema response ────────────────────────────────────
window.addEventListener('message',e=>{
  const msg=e.data;
  if(msg.command==='updateFlows'){
    FLOWS.splice(0,FLOWS.length,...msg.flows); render();
  } else if(msg.command==='update'){
    render();
  } else if(msg.command==='connectorCatalog'){
    ALL_CATALOG = msg.catalog || [];
    renderPalette(paletteSearch.value);
  } else if(msg.command==='exchangeSearchResults'){
    renderExchangeResults(msg.results, msg.error);
  } else if(msg.command==='connectorSchema'){
    setSchemaLoading(false);
    if(propsPanel.classList.contains('open')){
      const oldScroll = propsBody.scrollTop;
      if(msg.matched){
        renderSchemaGroups(msg.tagName, msg.rawAttrs, msg.matched);
      } else if(msg.operations && msg.operations.length > 0){
        const localName = msg.tagName.includes(':') 
          ? msg.tagName.split(':')[1].toLowerCase() 
          : msg.tagName.toLowerCase();
        const fuzzy = msg.operations.find(op => 
          op.name.toLowerCase().includes(localName) || 
          localName.includes(op.name.toLowerCase())
        );
        if(fuzzy){
          renderSchemaGroups(msg.tagName, msg.rawAttrs, fuzzy);
        } else {
          renderSchemaGroups(msg.tagName, msg.rawAttrs, msg.operations[0]);
        }
      } else {
        renderRawAttrGroups(msg.tagName, msg.rawAttrs);
      }
      propsBody.scrollTop = oldScroll;
    }
  }
});

// ── Search Exchange event listeners and DOM refs ──────────────────────────────
const exchangeSearch = document.getElementById('exchange-search');
const exchangeBtn = document.getElementById('exchange-btn');
const exchangeBody = document.getElementById('exchange-body');

const doExchangeSearch = () => {
  const query = exchangeSearch.value.trim();
  if (!query) return;
  exchangeBody.innerHTML = '<div style="padding:10px 12px;color:#888;font-style:italic;">Searching Exchange...</div>';
  vscode.postMessage({
    command: 'searchExchange',
    query: query
  });
};

exchangeBtn.addEventListener('click', doExchangeSearch);
exchangeSearch.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    doExchangeSearch();
  }
});

function renderExchangeResults(results, error = null) {
  exchangeBody.innerHTML = '';
  
  if (error) {
    exchangeBody.innerHTML = '<div style="padding:10px 12px;color:#f48771;font-size:10px;">' + error + '</div>';
    return;
  }
  
  if (!results || !results.length) {
    exchangeBody.innerHTML = '<div style="padding:10px 12px;color:#888;font-style:italic;">No plugins found</div>';
    return;
  }
  
  results.forEach(res => {
    const item = document.createElement('div');
    item.style.cssText = 'padding:6px 9px;border-bottom:1px solid rgba(255,255,255,0.03);display:flex;flex-direction:column;gap:3px;';
    
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:bold;color:var(--vscode-foreground,#ccc);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    title.textContent = res.name || res.artifactId;
    
    const details = document.createElement('div');
    details.style.cssText = 'font-size:9px;color:var(--vscode-descriptionForeground,#888);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    details.textContent = 'v' + res.version;
    
    const addBtn = document.createElement('button');
    addBtn.className = 'tbtn';
    addBtn.style.cssText = 'align-self:start;padding:2px 6px;margin-top:2px;font-size:9px;background:var(--vscode-button-background,#007acc);color:var(--vscode-button-foreground,#fff);';
    addBtn.textContent = 'Add to Project';
    addBtn.addEventListener('click', () => {
      addBtn.disabled = true;
      addBtn.textContent = 'Adding...';
      vscode.postMessage({
        command: 'addDependency',
        groupId: res.groupId,
        artifactId: res.artifactId,
        version: res.version
      });
    });
    
    item.appendChild(title);
    item.appendChild(details);
    item.appendChild(addBtn);
    exchangeBody.appendChild(item);
  });
}

try { render(); } catch(e) {
  var c = document.getElementById('cw') || document.body;
  var d = document.createElement('div');
  d.style.cssText = 'position:absolute;top:8px;left:8px;right:8px;padding:12px;background:#4a1010;color:#f48771;font-family:monospace;font-size:11px;z-index:999;white-space:pre-wrap;border:1px solid #c0392b;border-radius:4px';
  d.textContent = 'render() crashed: ' + (e.stack || e.message || e);
  c.appendChild(d);
}
window.addEventListener('resize',fitToWindow);

})();
</script>
</body>
</html>`;
}
//# sourceMappingURL=webviewContent.js.map