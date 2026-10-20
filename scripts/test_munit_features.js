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
    createOutputChannel: () => ({ appendLine: () => { } }),
    onDidChangeTextEditorSelection: () => ({ dispose: () => { } }),
    onDidChangeActiveTextEditor: () => ({ dispose: () => { } }),
  },
  workspace: {
    onDidChangeTextDocument: () => ({ dispose: () => { } }),
    getConfiguration: () => ({ get: () => undefined }),
    openTextDocument: async (uri) => {
      const filePath = uri.fsPath || uri;
      const text = mockDocuments.get(filePath) || fs.readFileSync(filePath, 'utf-8');
      const lines = text.split('\n');
      return {
        getText: (range) => {
          if (!range) return text;
          const startOffset = getOffset(lines, range.start);
          const endOffset = getOffset(lines, range.end);
          return text.slice(startOffset, endOffset);
        },
        offsetAt: (pos) => getOffset(lines, pos),
        positionAt: (offset) => getPosition(lines, offset),
        lineCount: lines.length,
        lineAt: (line) => ({
          text: lines[line] || '',
          range: {
            start: { line, character: 0 },
            end: { line, character: (lines[line] || '').length },
          },
        }),
        save: async () => true,
      };
    },
    applyEdit: async (edit) => {
      for (const e of edit.edits) {
        const filePath = e.uri.fsPath || e.uri;
        let content = mockDocuments.get(filePath) || fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        if (e.type === 'replace') {
          const start = getOffset(lines, e.range.start);
          const end = getOffset(lines, e.range.end);
          content = content.slice(0, start) + e.text + content.slice(end);
        } else if (e.type === 'insert') {
          const off = getOffset(lines, e.pos);
          content = content.slice(0, off) + e.text + content.slice(off);
        } else if (e.type === 'delete') {
          const start = getOffset(lines, e.range.start);
          const end = getOffset(lines, e.range.end);
          content = content.slice(0, start) + content.slice(end);
        }
        mockDocuments.set(filePath, content);
      }
      return true;
    },
  },
};

function getOffset(lines, pos) {
  let off = 0;
  for (let i = 0; i < pos.line && i < lines.length; i++) {
    off += lines[i].length + 1;
  }
  return off + pos.character;
}

function getPosition(lines, offset) {
  let running = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineLen = lines[i].length + 1;
    if (running + lineLen > offset) {
      return { line: i, character: offset - running };
    }
    running += lineLen;
  }
  return { line: lines.length - 1, character: (lines[lines.length - 1] || '').length };
}

// Intercept 'vscode' require
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'vscode') {
    return mockVscode;
  }
  return originalRequire.apply(this, arguments);
};

// Now import compiled modules
const { MuleXmlParser } = require('../out/parser/xmlParser');
const { SemanticModelBuilder } = require('../out/parser/semanticModel');
const { layout } = require('../out/layout');
const { ExtensionCatalog } = require('../out/catalog');
const { WebviewHtmlBuilder } = require('../out/webview/html');
const { FlowVisualizerPanel } = require('../out/webview/panel');

console.log('Testing MUnit Test Rendering & Editing Features...\n');

const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation"
      xmlns:munit="http://www.mulesoft.org/schema/mule/munit"
      xmlns:munit-tools="http://www.mulesoft.org/schema/mule/munit-tools"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/munit http://www.mulesoft.org/schema/mule/munit/current/mule-munit.xsd
        http://www.mulesoft.org/schema/mule/munit-tools http://www.mulesoft.org/schema/mule/munit-tools/current/mule-munit-tools.xsd">

  <munit:config name="munit" doc:name="MUnit configuration" />

  <munit:before-suite name="my-before-suite" doc:name="Before Suite Hook">
    <logger message="Running Before Suite" doc:name="Log Before Suite" />
  </munit:before-suite>

  <munit:before-test name="my-before-test" doc:name="Before Test Hook">
    <logger message="Running Before Test" doc:name="Log Before Test" />
  </munit:before-test>

  <munit:test name="order-service-test" description="Full test for order processing" doc:id="test-order-1">
    <munit:behavior>
      <munit-tools:mock-when processor="http:request" doc:name="Mock HTTP Inventory Call">
        <munit-tools:with-attributes>
          <munit-tools:with-attribute attributeName="path" whereValue="#['/api/inventory']" />
        </munit-tools:with-attributes>
        <munit-tools:then-return>
          <munit-tools:payload value="#[{ 'inStock': true, 'qty': 50 }]" mediaType="application/json" encoding="UTF-8" />
          <munit-tools:attributes value="#[{ 'statusCode': 200 }]" />
        </munit-tools:then-return>
      </munit-tools:mock-when>
      <munit:set-event doc:name="Set Initial Event">
        <munit:payload value="#[{ 'orderId': 'ORD-9876', 'item': 'Widget', 'units': 2 }]" mediaType="application/json" encoding="UTF-8" />
        <munit:attributes value="#[{ 'headers': { 'Content-Type': 'application/json' } }]" />
      </munit:set-event>
    </munit:behavior>

    <munit:execution>
      <flow-ref name="process-order-flow" doc:name="Call Flow Under Test" />
    </munit:execution>

    <munit:validation>
      <munit-tools:assert-equals actual="#[payload.status]" expected="#['CONFIRMED']" message="Order status must be confirmed" doc:name="Assert Status Confirmed" />
      <munit-tools:assert-that expression="#[payload.orderId]" is="#[MunitTools::notNullValue()]" message="Order ID must exist" doc:name="Assert Order ID Exists" />
      <munit-tools:verify-call processor="http:request" times="1" doc:name="Verify Inventory Called Once" />
    </munit:validation>

    <error-handler>
      <on-error-continue type="ANY" doc:name="Catch Test Errors">
        <logger message="Caught error in MUnit test" doc:name="Log Error" />
      </on-error-continue>
    </error-handler>
  </munit:test>

  <munit:after-test name="my-after-test" doc:name="After Test Hook">
    <logger message="Running After Test" doc:name="Log After Test" />
  </munit:after-test>

  <munit:after-suite name="my-after-suite" doc:name="After Suite Hook">
    <logger message="Running After Suite" doc:name="Log After Suite" />
  </munit:after-suite>

</mule>`;

// Test 1: Parser & SemanticModel
console.log('1. Testing Semantic Model Builder with MUnit Test & Zones...');
const parseResult = MuleXmlParser.parse(testXml);
assert(parseResult.root, 'XML root should be parsed');
const model = SemanticModelBuilder.build(parseResult.root, 'dummy/order-munit.xml');

assert.strictEqual(model.flows.length, 5, 'Should have 5 flows (before-suite, before-test, test, after-test, after-suite)');
const testFlow = model.flows.find(f => f.name === 'order-service-test');
assert(testFlow, 'MUnit test flow must exist');
assert.strictEqual(testFlow.type, 'munit-test', 'Flow type should be munit-test');
assert(testFlow.munitZones, 'MUnit zones must be defined on flow');

// Zones
assert.strictEqual(testFlow.munitZones.behavior.chain.length, 2, 'Behavior zone must have 2 processors');
assert.strictEqual(testFlow.munitZones.execution.chain.length, 1, 'Execution zone must have 1 processor');
assert.strictEqual(testFlow.munitZones.validation.chain.length, 3, 'Validation zone must have 3 processors');
assert.strictEqual(testFlow.errorHandler.length, 1, 'Error handler must have 1 route');
console.log('   ✓ Semantic model parsed 5 flows and 3 MUnit zones correctly.');

// Test 2: Layout Engine
console.log('2. Testing Layout Engine with MUnit zones...');
const scene = layout(model);
assert(scene.flows.length === 5, 'Scene should contain 5 positioned flows');

const munitPosFlow = scene.flows.find(f => f.flowModel.name === 'order-service-test');
assert(munitPosFlow, 'Positioned MUnit test flow should exist');
assert(munitPosFlow.munitZones, 'Positioned flow must have munitZones');

const { behavior, execution, validation } = munitPosFlow.munitZones;
assert(behavior.x < execution.x, 'Behavior must be to the left of Execution');
assert(execution.x < validation.x, 'Execution must be to the left of Validation');
assert.strictEqual(behavior.height, execution.height, 'Zone heights must match');
assert.strictEqual(execution.height, validation.height, 'Zone heights must match');
assert.strictEqual(behavior.laneY, execution.laneY, 'Zone lane lines must align');
assert.strictEqual(execution.laneY, validation.laneY, 'Zone lane lines must align');
assert(munitPosFlow.errorBandBox, 'Error band box must exist');
assert(munitPosFlow.errorBandBox.y >= behavior.y + behavior.height, 'Error band box must be below zones');
console.log('   ✓ Layout engine arranged Behavior, Execution, Validation side-by-side with harmonized heights.');

// Test 3: Catalog entries & DataWeave flags
console.log('3. Testing Catalog entries & DataWeave flags...');
const components = [
  'munit:set-event',
  'munit-tools:mock-when',
  'munit-tools:assert-that',
  'munit-tools:assert-equals',
  'munit-tools:verify-call',
  'munit-tools:spy',
  'munit-tools:sleep',
  'munit-tools:fail',
  'munit-tools:store',
  'munit-tools:retrieve',
  'munit-tools:clear-stored-data',
];

for (const compKey of components) {
  const comp = ExtensionCatalog.resolveComponent(
    compKey.startsWith('munit-tools:') ? 'http://www.mulesoft.org/schema/mule/munit-tools' : 'http://www.mulesoft.org/schema/mule/munit',
    compKey.split(':')[1],
    compKey.split(':')[0]
  );
  assert(comp, `Component ${compKey} must be registered in ExtensionCatalog`);
  assert(comp.groups && comp.groups.length > 0, `Component ${compKey} must have groups`);
}

// Check expression parameters
const setEvent = ExtensionCatalog.resolveComponent('http://www.mulesoft.org/schema/mule/munit', 'set-event', 'munit');
const setEventPayload = setEvent.groups.flatMap(g => g.parameters).find(p => p.name === 'payload');
assert(setEventPayload.supportsExpression && setEventPayload.defaultExpressionMode, 'set-event payload must support expression & default to expression mode');

const mockWhen = ExtensionCatalog.resolveComponent('http://www.mulesoft.org/schema/mule/munit-tools', 'mock-when', 'munit-tools');
const mockPayload = mockWhen.groups.flatMap(g => g.parameters).find(p => p.name === 'payload');
assert(mockPayload.supportsExpression && mockPayload.defaultExpressionMode, 'mock-when payload must support expression & default to expression mode');

const mockWhere = mockWhen.groups.flatMap(g => g.parameters).find(p => p.name === 'where');
assert(mockWhere.supportsExpression && mockWhere.defaultExpressionMode, 'mock-when where must support expression & default to expression mode');
console.log('   ✓ All 11 components are registered with DataWeave editor expression flags.');

// Test 4: Body extraction
console.log('4. Testing extractComponentBody for MUnit components...');
const setEventNode = testFlow.munitZones.behavior.chain[1];
const setEventBody = FlowVisualizerPanel.extractComponentBody(setEventNode);
assert(setEventBody.childValues['payload'], 'payload should be extracted from munit:set-event');
assert(setEventBody.childValues['attributes'], 'attributes should be extracted from munit:set-event');

const mockWhenNode = testFlow.munitZones.behavior.chain[0];
const mockBody = FlowVisualizerPanel.extractComponentBody(mockWhenNode);
assert(mockBody.childValues['payload'], 'payload should be extracted from mock-when then-return');
assert(mockBody.childValues['attributes'], 'attributes should be extracted from mock-when then-return');
assert(mockBody.childValues['where'], 'where should be extracted from mock-when with-attributes');
console.log('   ✓ extractComponentBody extracted payload, attributes, where values correctly.');

// Test 5: Webview HTML generation
console.log('5. Testing Webview HTML generation...');
const fakeWebview = {
  cspSource: 'vscode-webview:',
  asWebviewUri: (uri) => uri.toString(),
};
const html = WebviewHtmlBuilder.build(fakeWebview, mockVscode.Uri.file(__dirname));
assert(html.includes('munit-zone-behavior'), 'HTML should contain munit-zone-behavior CSS');
assert(html.includes('munit-zone-execution'), 'HTML should contain munit-zone-execution CSS');
assert(html.includes('munit-zone-validation'), 'HTML should contain munit-zone-validation CSS');
assert(html.includes('MUNIT TEST'), 'HTML should support MUNIT TEST badge');
assert(html.includes('BEFORE TEST'), 'HTML should support BEFORE TEST badge');
assert(html.includes('BEFORE SUITE'), 'HTML should support BEFORE SUITE badge');
assert(html.includes('AFTER TEST'), 'HTML should support AFTER TEST badge');
assert(html.includes('AFTER SUITE'), 'HTML should support AFTER SUITE badge');
console.log('   ✓ Webview HTML contains all MUnit CSS and rendering templates.');

console.log('\nAll MUnit feature tests PASSED successfully!\n');
