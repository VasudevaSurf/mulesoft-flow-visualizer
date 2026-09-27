const fs = require('fs');
const path = require('path');
const Module = require('module');

// Mock vscode module before requiring out/
const origRequire = Module.prototype.require;
Module.prototype.require = function(mod) {
  if (mod === 'vscode') {
    return {
      Uri: {
        file: (f) => ({ fsPath: f, toString: () => f }),
        joinPath: (...args) => ({ fsPath: args.join('/'), toString: () => args.join('/') }),
      },
      Range: class { constructor(a, b, c, d) {} },
      Position: class { constructor(a, b) {} },
      window: {},
      workspace: {},
    };
  }
  return origRequire.apply(this, arguments);
};

const { MuleXmlParser } = require('../out/parser/xmlParser.js');
const { SemanticModelBuilder } = require('../out/parser/semanticModel.js');
const { FlowVisualizerPanel } = require('../out/webview/panel.js');

const xmlPath = path.join(__dirname, '../test/fixtures/transform-test.xml');
const xmlContent = fs.readFileSync(xmlPath, 'utf-8');

console.log('================================================================');
console.log('VERIFICATION SUITE: Transform Message Node.body Architectural Fix');
console.log('================================================================\n');

// 1. XML PARSING & RawElement TREE
const parseResult = MuleXmlParser.parse(xmlContent);
if (!parseResult.root) {
  console.error('FAIL: XML parse failed:', parseResult.error);
  process.exit(1);
}

function findRawElement(el, predicate) {
  if (predicate(el)) return el;
  for (const child of el.children || []) {
    const found = findRawElement(child, predicate);
    if (found) return found;
  }
  return null;
}

const rawTransform = findRawElement(parseResult.root, (el) => el.localName === 'transform');
if (!rawTransform) {
  console.error('FAIL: Could not locate <ee:transform> in parsed RawElement tree');
  process.exit(1);
}

console.log('--- CHECK 1: Parsed RawElement tree for <ee:transform> ---');
console.log(JSON.stringify(rawTransform, null, 2));

const rawMessage = (rawTransform.children || []).find((c) => c.localName === 'message');
const rawSetPayload = rawMessage ? (rawMessage.children || []).find((c) => c.localName === 'set-payload') : null;
const cdataCapturedAtSetPayload = rawSetPayload && typeof rawSetPayload.text === 'string' && rawSetPayload.text.includes('%dw 2.0');
console.log('\n[Check 1 Confirmation] CDATA text captured at ee:set-payload level:', cdataCapturedAtSetPayload);
if (!cdataCapturedAtSetPayload) {
  console.error('FAIL on Check 1: CDATA text was NOT captured at ee:set-payload level!');
}

// 2. SEMANTIC MODEL & Node.body
const model = SemanticModelBuilder.build(parseResult.root, new Set());
let transformNode = null;
for (const flow of model.flows) {
  for (const n of flow.chain) {
    if (n.descriptor && (n.descriptor.localName === 'transform' || n.descriptor.localName === 'transform-message')) {
      transformNode = n;
      break;
    }
  }
}

if (!transformNode) {
  console.error('FAIL: Transform node not found in semantic model flow chain!');
  process.exit(1);
}

console.log('\n--- CHECK 2: Node.body produced in Semantic Model ---');
console.log('Node ID:', transformNode.id);
console.log('Node Descriptor:', transformNode.descriptor);
console.log('Node.body:');
console.log(JSON.stringify(transformNode.body, null, 2));

const bodyCarriedThrough = Array.isArray(transformNode.body) && transformNode.body.length > 0 &&
  transformNode.body.some(c => c.localName === 'message' && (c.children || []).some(sub => sub.localName === 'set-payload' && sub.text && sub.text.includes('%dw 2.0')));
console.log('\n[Check 2 Confirmation] Node.body carried through to semantic model:', bodyCarriedThrough);
if (!bodyCarriedThrough) {
  console.error('FAIL on Check 2: Node.body was NOT carried through to the semantic model!');
}

// 3. GENERIC READER (FlowVisualizerPanel.extractComponentBody)
console.log("\n--- CHECK 3: Generic reader (FlowVisualizerPanel.extractComponentBody) ---");
const extracted = FlowVisualizerPanel.extractComponentBody(transformNode);
console.log('Extracted primaryScript:');
console.log(extracted.primaryScript);

const expectedScript = `%dw 2.0
output application/json

var request = payload

---
{
    orderId: request.orderId default null,
    customerId: request.customerId default null,
    amount: request.amount default 0,
    currency: request.currency default "INR",
    items: request.items default []
}`;

// Normalize line endings for exact comparison across OS
const normalizedExtracted = extracted.primaryScript ? extracted.primaryScript.replace(/\r\n/g, '\n').trim() : '';
const normalizedExpected = expectedScript.replace(/\r\n/g, '\n').trim();

const isExactMatch = normalizedExtracted === normalizedExpected;
console.log('\n[Check 3 Confirmation] Matches exact %%dw 2.0 script character-for-character: ' + isExactMatch);
if (!isExactMatch) {
  console.error('FAIL on Check 3: Extracted script does not match expected script!');
  console.log('Expected length:', normalizedExpected.length, 'Extracted length:', normalizedExtracted.length);
  for (let i = 0; i < Math.max(normalizedExpected.length, normalizedExtracted.length); i++) {
    if (normalizedExpected[i] !== normalizedExtracted[i]) {
      console.log(`Mismatch at index ${i}: expected ${JSON.stringify(normalizedExpected[i])}, got ${JSON.stringify(normalizedExtracted[i])}`);
      break;
    }
  }
}

// 4. findNodeInModel LOOKUP BY ID
console.log('\n--- CHECK 4: findNodeInModel lookup by id ---');
const lookupResult = FlowVisualizerPanel.findNodeInModel(model, transformNode.id);
const lookupSucceeded = lookupResult !== null && lookupResult.id === transformNode.id;
console.log('Lookup ID queried:', transformNode.id);
console.log('Lookup returned Node:', lookupResult ? { id: lookupResult.id, label: lookupResult.label } : null);
console.log('[Check 4 Confirmation] findNodeInModel succeeds:', lookupSucceeded);
if (!lookupSucceeded) {
  console.error('FAIL on Check 4: findNodeInModel returned null or mismatched node!');
}

console.log('\n================================================================');
console.log(`SUMMARY: All 4 checks ${cdataCapturedAtSetPayload && bodyCarriedThrough && isExactMatch && lookupSucceeded ? 'PASSED' : 'FAILED'}`);
console.log('================================================================');
