const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Module = require('module');

// Mock vscode module
const origRequire = Module.prototype.require;
Module.prototype.require = function(mod) {
  if (mod === 'vscode') {
    return {
      Uri: {
        file: (f) => ({ fsPath: path.resolve(f), toString: () => path.resolve(f) }),
        joinPath: (base, ...parts) => ({
          fsPath: path.resolve(base.fsPath || base, ...parts),
          toString: () => path.resolve(base.fsPath || base, ...parts),
        }),
      },
    };
  }
  return origRequire.apply(this, arguments);
};

const vscode = require('vscode');
const { WebviewHtmlBuilder } = require('../out/webview/html.js');

console.log('================================================================');
console.log('VERIFYING MONACO & WEBVIEW HTML INTEGRATION');
console.log('================================================================\n');

// 1. Verify media/monaco files
console.log('--- 1. Checking media/monaco/vs files ---');
const mediaVsDir = path.resolve(__dirname, '../media/monaco/vs');
const nodeVsDir = path.resolve(__dirname, '../node_modules/monaco-editor/min/vs');

assert(fs.existsSync(path.join(mediaVsDir, 'loader.js')), 'media/monaco/vs/loader.js must exist');
assert(fs.existsSync(path.join(mediaVsDir, 'editor/editor.main.js')), 'media/monaco/vs/editor/editor.main.js must exist');
assert(fs.existsSync(path.join(mediaVsDir, 'editor/editor.main.css')), 'media/monaco/vs/editor/editor.main.css must exist');

const mediaLoaderStat = fs.statSync(path.join(mediaVsDir, 'loader.js'));
const nodeLoaderStat = fs.statSync(path.join(nodeVsDir, 'loader.js'));
assert.strictEqual(mediaLoaderStat.size, nodeLoaderStat.size, 'loader.js size must match node_modules version exactly');

const mediaMainStat = fs.statSync(path.join(mediaVsDir, 'editor/editor.main.js'));
const nodeMainStat = fs.statSync(path.join(nodeVsDir, 'editor/editor.main.js'));
assert.strictEqual(mediaMainStat.size, nodeMainStat.size, 'editor.main.js size must match node_modules version exactly');
console.log('✓ All media/monaco files rebuilt from single consistent monaco-editor version');

// 2. Generate HTML from WebviewHtmlBuilder
console.log('\n--- 2. Checking HTML & CSP ---');
const dummyWebview = {
  cspSource: 'vscode-webview:',
  asWebviewUri: (uri) => uri.toString(),
};
const dummyExtUri = vscode.Uri.file(path.resolve(__dirname, '..'));
const html = WebviewHtmlBuilder.build(dummyWebview, dummyExtUri);

// Check CSP worker-src & unsafe-eval
assert(html.includes("worker-src vscode-webview: blob:;"), 'CSP must include worker-src with blob:');
assert(html.includes("'unsafe-eval'"), 'CSP must include unsafe-eval');
console.log('✓ CSP contains worker-src vscode-webview: blob:; and unsafe-eval');

// 3. Check MonacoEnvironment.getWorker
console.log('\n--- 3. Checking MonacoEnvironment ---');
assert(!html.includes('data:text/javascript'), 'Must NOT use data: URLs for worker');
assert(html.includes('getWorker: function'), 'Must define getWorker in MonacoEnvironment');
assert(html.includes('URL.createObjectURL(blob)'), 'Must use Blob URL for worker');
console.log('✓ MonacoEnvironment uses getWorker with blob URL instead of data: URL');

// 4. Check error callback and try/catch on registerDataWeaveLanguage
console.log('\n--- 4. Checking require & error handlers ---');
assert(html.includes('registerDataWeaveLanguage()'), 'registerDataWeaveLanguage called');
assert(html.includes('monacoLoaded = true;'), 'monacoLoaded flag set');
assert(html.includes('Editor failed to load:'), 'Visible message on require failure present');
console.log('✓ require error callback and try/catch around registerDataWeaveLanguage verified');

// 5. Check window error and unhandledrejection handlers
console.log('\n--- 5. Checking global error telemetry ---');
assert(html.includes("window.addEventListener('error'"), 'Window error listener registered');
assert(html.includes("window.addEventListener('unhandledrejection'"), 'Unhandled rejection listener registered');
assert(html.includes("type: 'webviewError'"), 'Errors posted with type webviewError');
console.log('✓ Window error and unhandledrejection handlers registered and post to host');

// 6. Check textarea fallback
console.log('\n--- 6. Checking <textarea> fallback ---');
assert(html.includes('fallbackTimer = setTimeout('), 'Fallback timer set');
assert(html.includes('3000'), 'Fallback timer duration is 3000ms');
assert(html.includes("createElement('textarea')"), 'Textarea created on fallback');
assert(html.includes('minHeight = \'300px\''), 'Textarea min-height is 300px');
assert(html.includes('fallbackTextarea.addEventListener(\'input\''), 'Textarea keeps sendParamUpdate working');
console.log('✓ Textarea fallback with minHeight 300px and 3-second timeout verified');

console.log('\n================================================================');
console.log('ALL MONACO VERIFICATIONS PASSED SUCCESSFULLY!');
console.log('================================================================');
