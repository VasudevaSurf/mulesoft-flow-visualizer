import assert from 'assert';
import { MuleXmlParser } from '../src/parser/xmlParser';
import { SemanticModelBuilder } from '../src/parser/semanticModel';
import { layout } from '../src/layout';
import { ExtensionCatalog } from '../src/catalog';

describe('MUnit Test Files Rendering and Editing Tests', () => {
  const munitTestXml = `<?xml version="1.0" encoding="UTF-8"?>
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

  it('1. Parses MUnit test with 3 zones (behavior, execution, validation) and lifecycle suites', () => {
    const parseResult = MuleXmlParser.parse(munitTestXml);
    assert(parseResult.root, 'XML root should be parsed');
    const model = SemanticModelBuilder.build(parseResult.root!, 'test/fixtures/order-munit.xml');

    assert.strictEqual(model.flows.length, 5, 'Should contain 5 flows: before-suite, before-test, test, after-test, after-suite');

    // Lifecycle flows
    const beforeSuite = model.flows.find(f => f.name === 'my-before-suite');
    assert(beforeSuite, 'before-suite should be found');
    assert.strictEqual(beforeSuite!.type, 'before-suite');
    assert.strictEqual(beforeSuite!.chain.length, 1);

    const beforeTest = model.flows.find(f => f.name === 'my-before-test');
    assert(beforeTest, 'before-test should be found');
    assert.strictEqual(beforeTest!.type, 'before-test');
    assert.strictEqual(beforeTest!.chain.length, 1);

    const afterTest = model.flows.find(f => f.name === 'my-after-test');
    assert(afterTest, 'after-test should be found');
    assert.strictEqual(afterTest!.type, 'after-test');

    const afterSuite = model.flows.find(f => f.name === 'my-after-suite');
    assert(afterSuite, 'after-suite should be found');
    assert.strictEqual(afterSuite!.type, 'after-suite');

    // MUnit test flow
    const testFlow = model.flows.find(f => f.name === 'order-service-test');
    assert(testFlow, 'MUnit test flow should be found');
    assert.strictEqual(testFlow!.type, 'munit-test');
    assert(testFlow!.munitZones, 'testFlow must have munitZones defined');

    // Zone 1: Behavior
    const behavior = testFlow!.munitZones!.behavior;
    assert.strictEqual(behavior.label, 'Behavior');
    assert.strictEqual(behavior.chain.length, 2, 'Behavior should have mock-when and set-event');
    assert.strictEqual(behavior.chain[0].descriptor.localName, 'mock-when');
    assert.strictEqual(behavior.chain[1].descriptor.localName, 'set-event');

    // Zone 2: Execution
    const execution = testFlow!.munitZones!.execution;
    assert.strictEqual(execution.label, 'Execution');
    assert.strictEqual(execution.chain.length, 1, 'Execution should have flow-ref');
    assert.strictEqual(execution.chain[0].descriptor.localName, 'flow-ref');

    // Zone 3: Validation
    const validation = testFlow!.munitZones!.validation;
    assert.strictEqual(validation.label, 'Validation');
    assert.strictEqual(validation.chain.length, 3, 'Validation should have assert-equals, assert-that, verify-call');
    assert.strictEqual(validation.chain[0].descriptor.localName, 'assert-equals');
    assert.strictEqual(validation.chain[1].descriptor.localName, 'assert-that');
    assert.strictEqual(validation.chain[2].descriptor.localName, 'verify-call');

    // Error Handler in test
    assert.strictEqual(testFlow!.errorHandler.length, 1, 'Test flow should have 1 on-error-continue route');
    assert.strictEqual(testFlow!.errorHandler[0].kind, 'on-error-continue');
  });

  it('2. Layout engine positions MUnit test with 3 zones horizontally and harmonizes heights', () => {
    const parseResult = MuleXmlParser.parse(munitTestXml);
    const model = SemanticModelBuilder.build(parseResult.root!, 'test/fixtures/order-munit.xml');
    const scene = layout(model);

    assert(scene.flows.length === 5, 'Scene should contain 5 positioned flows');

    const munitPosFlow = scene.flows.find(f => f.flowModel.name === 'order-service-test');
    assert(munitPosFlow, 'Positioned MUnit test flow should exist');
    assert(munitPosFlow!.munitZones, 'Positioned flow must have munitZones');

    const { behavior, execution, validation } = munitPosFlow!.munitZones!;

    // Verify horizontal arrangement: Behavior -> Execution -> Validation
    assert(behavior.x < execution.x, `Behavior x (${behavior.x}) must be to the left of Execution x (${execution.x})`);
    assert(execution.x < validation.x, `Execution x (${execution.x}) must be to the left of Validation x (${validation.x})`);

    // Verify heights and lane alignment
    assert.strictEqual(behavior.height, execution.height, 'Zone heights should be harmonized');
    assert.strictEqual(execution.height, validation.height, 'Zone heights should be harmonized');
    assert.strictEqual(behavior.laneY, execution.laneY, 'Zone lane lines should align');
    assert.strictEqual(execution.laneY, validation.laneY, 'Zone lane lines should align');

    // Processors inside zones
    assert.strictEqual(behavior.children.length, 2, 'Behavior zone has 2 positioned nodes');
    assert.strictEqual(execution.children.length, 1, 'Execution zone has 1 positioned node');
    assert.strictEqual(validation.children.length, 3, 'Validation zone has 3 positioned nodes');

    // Error handler band positioned below the zones
    assert(munitPosFlow!.errorBandBox, 'MUnit test errorBandBox must be present');
    assert(munitPosFlow!.errorBandBox!.y >= behavior.y + behavior.height, 'Error band must be placed below the test zones');
    assert.strictEqual(munitPosFlow!.errorHandlers.length, 1);
  });

  it('3. Catalog defines all 11 required MUnit and MUnit-Tools components with editable properties', () => {
    const checkComponent = (key: string, expectedParams: string[]) => {
      const comp = ExtensionCatalog.resolveComponent(
        key.startsWith('munit-tools:') ? 'http://www.mulesoft.org/schema/mule/munit-tools' : 'http://www.mulesoft.org/schema/mule/munit',
        key.split(':')[1],
        key.split(':')[0]
      );
      assert(comp, `Catalog entry for ${key} must exist`);
      assert(comp.groups && comp.groups.length > 0, `${key} must have parameter groups`);
      const allParamNames = comp.groups!.flatMap(g => g.parameters.map(p => p.name));
      for (const ep of expectedParams) {
        assert(allParamNames.includes(ep), `${key} must contain parameter "${ep}". Found: ${allParamNames.join(', ')}`);
      }
    };

    // 1. munit:set-event
    checkComponent('munit:set-event', ['payload', 'mediaType', 'encoding', 'attributes', 'cloneOriginalEvent', 'doc:name']);

    // 2. munit-tools:mock-when (with where / with-attributes / then-return)
    checkComponent('munit-tools:mock-when', ['processor', 'doc:name', 'where', 'attributeName', 'whereValue', 'payload', 'mediaType', 'encoding', 'attributes', 'errorType']);

    // 3. munit-tools:assert-that
    checkComponent('munit-tools:assert-that', ['expression', 'is', 'message', 'doc:name']);

    // 4. munit-tools:assert-equals
    checkComponent('munit-tools:assert-equals', ['actual', 'expected', 'message', 'doc:name']);

    // 5. munit-tools:verify-call
    checkComponent('munit-tools:verify-call', ['processor', 'times', 'atLeast', 'atMost', 'doc:name']);

    // 6. munit-tools:spy
    checkComponent('munit-tools:spy', ['processor', 'doc:name']);

    // 7. munit-tools:sleep
    checkComponent('munit-tools:sleep', ['time', 'timeUnit', 'doc:name']);

    // 8. munit-tools:fail
    checkComponent('munit-tools:fail', ['message', 'doc:name']);

    // 9. munit-tools:store
    checkComponent('munit-tools:store', ['key', 'value', 'doc:name']);

    // 10. munit-tools:retrieve
    checkComponent('munit-tools:retrieve', ['key', 'target', 'defaultValue', 'doc:name']);

    // 11. munit-tools:clear-stored-data
    checkComponent('munit-tools:clear-stored-data', ['doc:name']);
  });

  it('4. DataWeave editor flags (supportsExpression and defaultExpressionMode) are set for all payload and expression fields', () => {
    const getParam = (componentKey: string, paramName: string) => {
      const comp = ExtensionCatalog.resolveComponent(
        componentKey.startsWith('munit-tools:') ? 'http://www.mulesoft.org/schema/mule/munit-tools' : 'http://www.mulesoft.org/schema/mule/munit',
        componentKey.split(':')[1],
        componentKey.split(':')[0]
      );
      const params = comp?.groups?.flatMap(g => g.parameters) || [];
      return params.find(p => p.name === paramName);
    };

    // munit:set-event payload & attributes
    const setEventPayload = getParam('munit:set-event', 'payload');
    assert(setEventPayload?.supportsExpression, 'set-event payload must support expressions');
    assert(setEventPayload?.defaultExpressionMode, 'set-event payload must default to expression mode (DataWeave)');

    const setEventAttributes = getParam('munit:set-event', 'attributes');
    assert(setEventAttributes?.supportsExpression, 'set-event attributes must support expressions');
    assert(setEventAttributes?.defaultExpressionMode, 'set-event attributes must default to expression mode (DataWeave)');

    // munit-tools:mock-when payload & attributes & where
    const mockPayload = getParam('munit-tools:mock-when', 'payload');
    assert(mockPayload?.supportsExpression, 'mock-when payload must support expressions');
    assert(mockPayload?.defaultExpressionMode, 'mock-when payload must default to expression mode (DataWeave)');

    const mockWhere = getParam('munit-tools:mock-when', 'where');
    assert(mockWhere?.supportsExpression, 'mock-when where must support expressions');
    assert(mockWhere?.defaultExpressionMode, 'mock-when where must default to expression mode (DataWeave)');

    // munit-tools:assert-equals actual & expected
    const assertEqualsActual = getParam('munit-tools:assert-equals', 'actual');
    assert(assertEqualsActual?.supportsExpression, 'assert-equals actual must support expressions');
    assert(assertEqualsActual?.defaultExpressionMode, 'assert-equals actual must default to expression mode');

    const assertEqualsExpected = getParam('munit-tools:assert-equals', 'expected');
    assert(assertEqualsExpected?.supportsExpression, 'assert-equals expected must support expressions');
    assert(assertEqualsExpected?.defaultExpressionMode, 'assert-equals expected must default to expression mode');

    // munit-tools:assert-that expression & is
    const assertThatExpr = getParam('munit-tools:assert-that', 'expression');
    assert(assertThatExpr?.supportsExpression, 'assert-that expression must support expressions');
    assert(assertThatExpr?.defaultExpressionMode, 'assert-that expression must default to expression mode');

    const assertThatIs = getParam('munit-tools:assert-that', 'is');
    assert(assertThatIs?.supportsExpression, 'assert-that is must support expressions');
    assert(assertThatIs?.defaultExpressionMode, 'assert-that is must default to expression mode');
  });
});
