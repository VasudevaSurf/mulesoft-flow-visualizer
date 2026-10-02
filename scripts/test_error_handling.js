const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const Module = require('module');

// Mock vscode module for standalone execution
let mockDocuments = new Map();

const mockVscode = {
  Uri: {
    file: (f) => ({
      fsPath: path.resolve(f),
      toString: () => path.resolve(f),
    }),
    joinPath: (base, ...parts) => ({
      fsPath: path.resolve(base.fsPath || base, ...parts),
      toString: () => path.resolve(base.fsPath || base, ...parts),
    }),
  },
  Range: class {
    constructor(start, end) {
      this.start = start;
      this.end = end;
    }
  },
  Position: class {
    constructor(line, character) {
      this.line = line;
      this.character = character;
    }
  },
  WorkspaceEdit: class {
    constructor() {
      this.edits = [];
    }
    replace(uri, range, text) {
      this.edits.push({ type: 'replace', uri, range, text });
    }
    insert(uri, pos, text) {
      this.edits.push({ type: 'insert', uri, pos, text });
    }
    delete(uri, range) {
      this.edits.push({ type: 'delete', uri, range });
    }
  },
  window: {
    showErrorMessage: console.error,
    showInformationMessage: console.log,
    showWarningMessage: console.warn,
    createOutputChannel: () => ({ appendLine: () => {} }),
    onDidChangeTextEditorSelection: () => ({ dispose: () => {} }),
    onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
  },
  workspace: {
    onDidChangeTextDocument: () => ({ dispose: () => {} }),
    getConfiguration: () => ({ get: () => undefined }),
    openTextDocument: async (uri) => {
      const filePath = uri.fsPath || uri;
      const text = mockDocuments.get(filePath) || fs.readFileSync(filePath, 'utf-8');
      return {
        getText: (range) => {
          if (!range) return text;
          const lines = text.split('\n');
          if (range.start.line === range.end.line) {
            return lines[range.start.line].slice(range.start.character, range.end.character);
          }
          let res = lines[range.start.line].slice(range.start.character);
          for (let i = range.start.line + 1; i < range.end.line; i++) {
            res += '\n' + lines[i];
          }
          res += '\n' + lines[range.end.line].slice(0, range.end.character);
          return res;
        },
        offsetAt: (pos) => {
          const lines = text.split('\n');
          let offset = 0;
          for (let i = 0; i < pos.line; i++) {
            offset += lines[i].length + 1;
          }
          return offset + pos.character;
        },
        positionAt: (offset) => {
          const lines = text.split('\n');
          let current = 0;
          for (let i = 0; i < lines.length; i++) {
            if (current + lines[i].length + 1 > offset) {
              return new mockVscode.Position(i, offset - current);
            }
            current += lines[i].length + 1;
          }
          return new mockVscode.Position(lines.length - 1, (lines[lines.length - 1] || '').length);
        },
        save: async () => true,
      };
    },
    applyEdit: async (edit) => {
      for (const e of edit.edits) {
        const filePath = e.uri.fsPath || e.uri;
        let text = mockDocuments.get(filePath) || fs.readFileSync(filePath, 'utf-8');
        const lines = text.split('\n');
        const offsetAt = (pos) => {
          let o = 0;
          for (let i = 0; i < pos.line; i++) o += lines[i].length + 1;
          return o + pos.character;
        };

        if (e.type === 'replace') {
          const start = offsetAt(e.range.start);
          const end = offsetAt(e.range.end);
          text = text.slice(0, start) + e.text + text.slice(end);
        } else if (e.type === 'insert') {
          const pos = offsetAt(e.pos);
          text = text.slice(0, pos) + e.text + text.slice(pos);
        } else if (e.type === 'delete') {
          const start = offsetAt(e.range.start);
          const end = offsetAt(e.range.end);
          text = text.slice(0, start) + text.slice(end);
        }
        mockDocuments.set(filePath, text);
        fs.writeFileSync(filePath, text, 'utf-8');
      }
      return true;
    },
  },
};

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'vscode') {
    return mockVscode;
  }
  return originalRequire.apply(this, arguments);
};

// Import compiled visualizer components
const { MuleXmlParser } = require('../out/parser/xmlParser');
const { SemanticModelBuilder } = require('../out/parser/semanticModel');
const { layout } = require('../out/layout');
const { FlowVisualizerPanel } = require('../out/webview/panel');
const { ExtensionCatalog } = require('../out/catalog');
const { WebviewHtmlBuilder } = require('../out/webview/html');

async function runTests() {
  console.log('=== Running Error Handling Tests ===\n');

  const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation"
      xmlns:http="http://www.mulesoft.org/schema/mule/http"
      xmlns:munit="http://www.mulesoft.org/schema/mule/munit">

    <error-handler name="globalErrorHandler" doc:id="geh-1">
        <on-error-continue type="HTTP:NOT_FOUND, CONNECTIVITY" enableNotifications="true" logException="true">
            <set-payload value="Resource Not Found" doc:name="Set Not Found Payload" />
            <logger level="WARN" message="Caught by global handler" doc:name="Log Global Warn" />
        </on-error-continue>
    </error-handler>

    <flow name="orderProcessingFlow" doc:id="flow-1">
        <try doc:name="Try Database Insert">
            <logger level="INFO" message="Attempting DB insert" doc:name="Log Pre-Insert" />
            <error-handler>
                <on-error-propagate type="DB:CONNECTIVITY" when="#[error.description contains 'timeout']" enableNotifications="false" logException="true">
                    <logger level="ERROR" message="DB connection failed" doc:name="Log DB Error" />
                </on-error-propagate>
            </error-handler>
        </try>
        <error-handler ref="globalErrorHandler" />
    </flow>
</mule>`;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mule-eh-test-'));
  const xmlFilePath = path.join(tempDir, 'flow.xml');
  fs.writeFileSync(xmlFilePath, initialXml, 'utf-8');
  mockDocuments.set(xmlFilePath, initialXml);

  const docUri = mockVscode.Uri.file(xmlFilePath);

  // 1. Test Parsing & Layout
  console.log('Test 1: Verify semantic model and layout structure');
  const { root, error } = MuleXmlParser.parse(initialXml);
  assert(!error, 'Parse should have no error');
  const model = SemanticModelBuilder.build(root, xmlFilePath);

  assert.strictEqual(model.flows.length, 2, 'Should have 2 flows (global-error-handler and main flow)');
  const globalEh = model.flows.find(f => f.name === 'globalErrorHandler');
  assert(globalEh, 'Global error handler must exist');
  assert.strictEqual(globalEh.type, 'global-error-handler');
  assert.strictEqual(globalEh.errorHandler.length, 1);
  assert.strictEqual(globalEh.errorHandler[0].chain.length, 2, 'Global error route has 2 children');

  const mainFlow = model.flows.find(f => f.name === 'orderProcessingFlow');
  assert(mainFlow, 'Main flow must exist');
  assert.strictEqual(mainFlow.errorHandlerRef, 'globalErrorHandler');

  const tryNode = mainFlow.chain.find(n => n.descriptor.localName === 'try');
  assert(tryNode, 'Try scope must exist');
  assert.strictEqual(tryNode.routes.length, 1, 'Try scope has 1 error route');
  assert.strictEqual(tryNode.routes[0].kind, 'on-error-propagate');
  assert.strictEqual(tryNode.routes[0].attributes['type'], 'DB:CONNECTIVITY');
  assert.strictEqual(tryNode.routes[0].attributes['when'], "#[error.description contains 'timeout']");
  assert.strictEqual(tryNode.routes[0].chain.length, 1, 'Try error route has 1 child');

  const scene = layout(model, { collapseErrorHandlers: 'never' });
  const pGlobal = scene.flows.find(f => f.flowModel.name === 'globalErrorHandler');
  assert(pGlobal.errorBandBox, 'Global error handler has errorBandBox in layout');
  assert.strictEqual(pGlobal.errorHandlers.length, 1);
  assert.strictEqual(pGlobal.errorHandlers[0].children.length, 2);

  const pMain = scene.flows.find(f => f.flowModel.name === 'orderProcessingFlow');
  assert(pMain.errorBandBox, 'Main flow referencing global error handler has errorBandBox in layout');
  const pTry = pMain.chain.find(n => n.node.descriptor.localName === 'try');
  assert(pTry.errorBandBox, 'Try scope has its own errorBandBox in layout');
  assert.strictEqual(pTry.errorHandlers.length, 1, 'Try scope has 1 positioned error route in layout');
  assert.strictEqual(pTry.errorHandlers[0].children.length, 1, 'Try error route has 1 child in layout');
  console.log('✓ Test 1 passed: All error handlers, routes, refs, and scopes appear in layout\n');

  // 2. Test Editing Properties Panel parameters on on-error-propagate
  console.log('Test 2: Properties panel edits for type, when, enableNotifications, logException');
  function createMockPanel() {
    return {
      webview: {
        html: '',
        asWebviewUri: (u) => u,
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        postMessage: () => {},
      },
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeViewState: () => ({ dispose: () => {} }),
      dispose: () => {},
    };
  }

  const panel = new FlowVisualizerPanel(createMockPanel(), docUri, docUri);
  panel.currentDocUri = docUri;
  panel.lastModel = model;

  const tryErrorRouteId = tryNode.routes[0].id;

  // 2a. Update `type` to comma-separated list: "DB:CONNECTIVITY, DB:RETRY_EXHAUSTED"
  await panel.handleUpdateParameterValue({
    nodeId: tryErrorRouteId,
    paramName: 'type',
    value: 'DB:CONNECTIVITY, DB:RETRY_EXHAUSTED',
    dataType: 'string',
  });
  let updatedXml = mockDocuments.get(xmlFilePath);
  assert(updatedXml.includes('type="DB:CONNECTIVITY, DB:RETRY_EXHAUSTED"'), 'type attribute should be updated in XML');
  console.log('✓ 2a passed: type updated to comma-separated list');

  // Re-parse model with updated XML
  let parsed = MuleXmlParser.parse(updatedXml);
  panel.lastModel = SemanticModelBuilder.build(parsed.root, xmlFilePath);

  // 2b. Update `when` expression: error.description contains 'abort' && vars.attempt > 2
  await panel.handleUpdateParameterValue({
    nodeId: tryErrorRouteId,
    paramName: 'when',
    value: "error.description contains 'abort' && vars.attempt > 2",
    dataType: 'string',
  });
  updatedXml = mockDocuments.get(xmlFilePath);
  assert(
    updatedXml.includes('when="#[error.description contains &apos;abort&apos; &amp;&amp; vars.attempt &gt; 2]"') ||
    updatedXml.includes('when="#[error.description contains \'abort\' &amp;&amp; vars.attempt &gt; 2]"'),
    'when attribute should be wrapped in #[ ] and XML-escaped: ' + updatedXml
  );
  console.log('✓ 2b passed: when expression editor updated with #[ ] wrapping and XML escaping');

  // Re-parse model
  parsed = MuleXmlParser.parse(updatedXml);
  panel.lastModel = SemanticModelBuilder.build(parsed.root, xmlFilePath);

  // 2c. Update `enableNotifications` to "true"
  await panel.handleUpdateParameterValue({
    nodeId: tryErrorRouteId,
    paramName: 'enableNotifications',
    value: 'true',
    dataType: 'boolean',
  });
  updatedXml = mockDocuments.get(xmlFilePath);
  assert(updatedXml.includes('enableNotifications="true"'), 'enableNotifications attribute should be updated to true');
  console.log('✓ 2c passed: enableNotifications updated');

  // Re-parse model
  parsed = MuleXmlParser.parse(updatedXml);
  panel.lastModel = SemanticModelBuilder.build(parsed.root, xmlFilePath);

  // 2d. Update `logException` to "false"
  await panel.handleUpdateParameterValue({
    nodeId: tryErrorRouteId,
    paramName: 'logException',
    value: 'false',
    dataType: 'boolean',
  });
  updatedXml = mockDocuments.get(xmlFilePath);
  assert(updatedXml.includes('logException="false"'), 'logException attribute should be updated to false');
  console.log('✓ 2d passed: logException updated');

  // Test 3: Collapse and Expand Error Handlers (Try Scope & Flow)
  console.log('\nTest 3: Minimize / Expand Error Handling blocks');
  const tryNodeInChain = mainFlow.chain.find((n) => n.descriptor.localName === 'try');
  assert(tryNodeInChain, 'Try node should exist in mainFlow chain');

  // Baseline: expanded height
  const sceneExpanded = layout(model);
  const pTryExpanded = sceneExpanded.flows.find(f => f.flowModel.name === 'orderProcessingFlow').chain.find((n) => n.node.descriptor.localName === 'try');
  assert(pTryExpanded.errorBandBox, 'Expanded try scope must have errorBandBox');
  assert.strictEqual(pTryExpanded.errorCollapsed, false, 'Try scope error band should be expanded by default');
  assert.strictEqual(pTryExpanded.routes.length, 1, 'Try scope should have 1 route placed');
  const expandedH = pTryExpanded.height;

  // Collapse try error band
  tryNodeInChain.errorBandCollapsed = true;
  const sceneCollapsed = layout(model);
  const pTryCollapsed = sceneCollapsed.flows.find(f => f.flowModel.name === 'orderProcessingFlow').chain.find((n) => n.node.descriptor.localName === 'try');
  assert.strictEqual(pTryCollapsed.errorCollapsed, true, 'Try scope error band should now be collapsed');
  assert.strictEqual(pTryCollapsed.routes.length, 0, 'Try scope should have 0 routes placed when error band is collapsed');
  assert(pTryCollapsed.height < expandedH, `Collapsed height (${pTryCollapsed.height}) should be less than expanded (${expandedH})`);
  console.log('✓ 3a passed: Try scope error band minimizes correctly');

  // Collapse flow error band (with errorHandlerRef)
  mainFlow.errorBandCollapsed = true;
  const sceneFlowCollapsed = layout(model);
  const pFlowCollapsed = sceneFlowCollapsed.flows.find(f => f.flowModel.name === 'orderProcessingFlow');
  assert.strictEqual(pFlowCollapsed.errorCollapsed, true, 'Flow error band should be collapsed');
  console.log('✓ 3b passed: Flow error band minimizes correctly');

  // Check HTML generation contains the toggle chevron and dropdown button
  const webviewHtml = WebviewHtmlBuilder.build({ asWebviewUri: (u) => u.toString(), cspSource: '' }, docUri);
  assert(webviewHtml.includes('error-band-toggle'), 'HTML should contain error-band-toggle');
  assert(webviewHtml.includes('error-band-chevron-bg'), 'HTML should contain error-band-chevron-bg');
  assert(webviewHtml.includes('error-band-chevron-text'), 'HTML should contain error-band-chevron-text');
  console.log('✓ 3c passed: HTML includes drop down chevron and toggle for error handling blocks');

  // Cleanup
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  console.log('\n=== ALL ERROR HANDLING TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
