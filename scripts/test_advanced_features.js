const fs = require('fs');
const path = require('path');
const Module = require('module');

// Mock vscode module
const origRequire = Module.prototype.require;
Module.prototype.require = function(mod) {
  if (mod === 'vscode') {
    return {
      Uri: {
        file: (f) => ({ fsPath: f, toString: () => f }),
        joinPath: (...args) => ({ fsPath: args.join('/'), toString: () => args.join('/') }),
      },
      Range: class { constructor(a, b, c, d) { this.start = { line: a, character: b }; this.end = { line: c, character: d }; } },
      Position: class { constructor(a, b) { this.line = a; this.character = b; } },
      SnippetString: class { constructor(s) { this.value = s; } },
      WorkspaceEdit: class {
        constructor() { this.edits = []; }
        replace(uri, range, text) { this.edits.push({ type: 'replace', range, text }); }
        insert(uri, pos, text) { this.edits.push({ type: 'insert', pos, text }); }
        delete(uri, range) { this.edits.push({ type: 'delete', range }); }
      },
      window: { showErrorMessage: console.error, showInformationMessage: console.log },
      workspace: { applyEdit: async () => true },
    };
  }
  return origRequire.apply(this, arguments);
};

const { MuleXmlParser } = require('../out/parser/xmlParser.js');
const { SemanticModelBuilder } = require('../out/parser/semanticModel.js');
const { FlowVisualizerPanel } = require('../out/webview/panel.js');
const { CORE_CATALOG } = require('../out/catalog/coreCatalog.js');
const { ExtensionCatalog } = require('../out/catalog/index.js');
const { MeasureEngine } = require('../out/layout/measure.js');
const { PlaceEngine } = require('../out/layout/place.js');

console.log('================================================================');
console.log('ADVANCED FEATURES TEST SUITE');
console.log('================================================================\n');

// 1. Verify Core Catalog Descriptors
console.log('--- TEST 1: Core Catalog Descriptors ---');
const componentsToCheck = [
  'munit:test',
  'munit:behavior',
  'munit:execution',
  'munit:validation',
  'munit-tools:assert-that',
  'munit-tools:mock-when',
  'batch:job',
  'batch:process-records',
  'batch:step',
  'batch:aggregator',
  'apikit:router',
  'java:invoke',
  'scripting:execute',
  'compression:compress',
  'compression:decompress',
  'validation:is-not-null'
];

let catalogErrors = 0;
for (const comp of componentsToCheck) {
  const [prefix, localName] = comp.split(':');
  const desc = ExtensionCatalog.resolveComponent(null, localName, prefix);
  if (!desc) {
    console.error(`FAIL: ${comp} not resolved from catalog!`);
    catalogErrors++;
  } else {
    console.log(`✓ Resolved ${comp}: [${desc.displayName}], kind: ${desc.kind}`);
  }
}
if (catalogErrors > 0) process.exit(1);

// 2. Parse Mule XML with Choice Router, Subflow with Error Handler, and MUnit Test
console.log('\n--- TEST 2: Parsing Complex Flow XML ---');
const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:munit="http://www.mulesoft.org/schema/mule/munit"
      xmlns:munit-tools="http://www.mulesoft.org/schema/mule/munit-tools"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd
        http://www.mulesoft.org/schema/mule/munit http://www.mulesoft.org/schema/mule/munit/current/mule-munit.xsd
        http://www.mulesoft.org/schema/mule/munit-tools http://www.mulesoft.org/schema/mule/munit-tools/current/mule-munit-tools.xsd">

    <flow name="main-order-flow" errorHandler-ref="global-error-handler">
        <scheduler doc:name="Daily Trigger" />
        <choice doc:name="Evaluate Priority">
            <when expression="#[payload.priority == 'HIGH']" doc:name="High Priority">
                <logger level="INFO" message="High priority order" />
            </when>
            <when expression="#[payload.priority == 'MED']" doc:name="Medium Priority">
                <logger level="INFO" message="Medium priority order" />
            </when>
            <otherwise doc:name="Normal Priority">
                <logger level="INFO" message="Standard order" />
            </otherwise>
        </choice>
        <flow-ref name="sub-processing-flow" />
    </flow>

    <sub-flow name="sub-processing-flow">
        <ee:transform doc:name="Map Request">
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{ status: "PROCESSED" }]]></ee:set-payload>
                <ee:set-attributes><![CDATA[%dw 2.0
output application/java
---
{ httpStatus: 200 }]]></ee:set-attributes>
            </ee:message>
            <ee:variables>
                <ee:set-variable variableName="auditRecord"><![CDATA[%dw 2.0
output application/json
---
{ timestamp: now() }]]></ee:set-variable>
            </ee:variables>
        </ee:transform>
        <error-handler>
            <on-error-continue type="ANY" doc:name="Subflow On Error">
                <logger level="ERROR" message="Subflow error handled" />
            </on-error-continue>
        </error-handler>
    </sub-flow>

    <munit:test name="main-order-flow-test" description="Test flow execution">
        <munit:behavior>
            <munit-tools:mock-when processor="flow-ref" doc:name="Mock Subflow">
                <munit-tools:then-return>
                    <munit-tools:payload value="#['SUCCESS']" />
                </munit-tools:then-return>
            </munit-tools:mock-when>
        </munit:behavior>
        <munit:execution>
            <flow-ref name="main-order-flow" />
        </munit:execution>
        <munit:validation>
            <munit-tools:assert-that expression="#[payload]" is="#[MunitTools::notNullValue()]" />
        </munit:validation>
    </munit:test>
</mule>`;

const parseRes = MuleXmlParser.parse(testXml);
if (!parseRes.root) {
  console.error('FAIL: Parse error:', parseRes.error);
  process.exit(1);
}

const semanticModel = SemanticModelBuilder.build(parseRes.root, (ns, localName, prefix) => ExtensionCatalog.resolveComponent(ns, localName, prefix));

console.log(`✓ Parsed ${semanticModel.flows.length} flows / test suites`);
if (semanticModel.flows.length !== 3) {
  console.error(`FAIL: Expected 3 flows (flow, sub-flow, munit:test), got ${semanticModel.flows.length}`);
  process.exit(1);
}

const mainFlow = semanticModel.flows.find(f => f.name === 'main-order-flow');
const subFlow = semanticModel.flows.find(f => f.name === 'sub-processing-flow');
const munitTest = semanticModel.flows.find(f => f.name === 'main-order-flow-test');

// Check main flow error handler ref
if (mainFlow.errorHandlerRef !== 'global-error-handler') {
  console.error(`FAIL: mainFlow errorHandlerRef expected "global-error-handler", got ${mainFlow.errorHandlerRef}`);
  process.exit(1);
}
console.log('✓ mainFlow.errorHandlerRef captured:', mainFlow.errorHandlerRef);

// Check choice router in main flow
const choiceNode = mainFlow.chain.find(n => n.descriptor.localName === 'choice');
if (!choiceNode) {
  console.error('FAIL: Choice node not found in main flow chain!');
  process.exit(1);
}
console.log(`✓ Choice router found with ${choiceNode.routes.length} routes:`);
choiceNode.routes.forEach((r, i) => {
  const rName = r.descriptor ? r.descriptor.localName : 'route';
  console.log(`  Route ${i}: [${rName}] label="${r.label}", children=${r.chain.length}, attrs=`, r.attributes);
});
if (choiceNode.routes.length !== 3) {
  console.error(`FAIL: Expected 3 choice routes, got ${choiceNode.routes.length}`);
  process.exit(1);
}

// Check sub-flow error handler
if (!subFlow.errorHandler || subFlow.errorHandler.length === 0) {
  console.error('FAIL: Sub-flow error-handler not parsed!');
  process.exit(1);
}
console.log('✓ Sub-flow error handler parsed:', subFlow.errorHandler[0].label);

// Check Transform Message body extraction (payload, attributes, variables)
const transformNode = subFlow.chain.find(n => n.descriptor.localName === 'transform');
if (!transformNode) {
  console.error('FAIL: Transform node not found in sub-flow!');
  process.exit(1);
}
const tfData = FlowVisualizerPanel.extractComponentBody(transformNode, '/mock/path.xml');
console.log('✓ Transform primaryScript extracted:\n', tfData.primaryScript.trim());
console.log('✓ Transform attributesScript extracted:\n', tfData.attributesScript ? tfData.attributesScript.trim() : 'NONE');
console.log('✓ Transform variables extracted:', tfData.variables);

if (!tfData.attributesScript || !tfData.attributesScript.includes('httpStatus: 200')) {
  console.error('FAIL: attributesScript was not extracted!');
  process.exit(1);
}
if (!tfData.variables || tfData.variables.length !== 1 || tfData.variables[0].name !== 'auditRecord') {
  console.error('FAIL: variables auditRecord was not extracted!');
  process.exit(1);
}

// Check MUnit Test: source should be null (not slicing first child into sourceBox)
if (munitTest.source !== null) {
  console.error('FAIL: MUnit test should have source === null, but got:', munitTest.source.label);
  process.exit(1);
}
console.log(`✓ MUnit test has source === null, and ${munitTest.chain.length} processor chains/scopes in execution body`);

// 3. Layout measurement & placement
console.log('\n--- TEST 3: Layout Measurement and Placement ---');
let curY = 40;
const placedFlows = [];
for (const flow of semanticModel.flows) {
  const mFlow = MeasureEngine.measureFlow(flow);
  const pFlow = PlaceEngine.placeFlow(mFlow, 40, curY);
  placedFlows.push(pFlow);
  curY += pFlow.height + 40;
}
console.log(`✓ Placed ${placedFlows.length} flows. Canvas total height: ${curY}`);

const placedMainFlow = placedFlows.find(f => f.flowId === mainFlow.id);
if (!placedMainFlow.errorBandBox) {
  console.error('FAIL: placedMainFlow should have errorBandBox for errorHandlerRef!');
  process.exit(1);
}
console.log(`✓ Placed mainFlow errorBandBox: y=${placedMainFlow.errorBandBox.y}, height=${placedMainFlow.errorBandBox.height}`);

console.log('\n================================================================');
console.log('ALL ADVANCED TESTS PASSED PERFECTLY!');
console.log('================================================================');
