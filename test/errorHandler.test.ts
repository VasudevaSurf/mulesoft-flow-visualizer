import * as assert from 'assert';
import { MuleXmlParser } from '../src/parser/xmlParser';
import { SemanticModelBuilder } from '../src/parser/semanticModel';
import { layout } from '../src/layout';
import { FlowVisualizerPanel } from '../src/webview/panel';
import { ExtensionCatalog } from '../src/catalog';

describe('Error Handling Layout & Properties Tests', () => {
  const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation"
      xmlns:http="http://www.mulesoft.org/schema/mule/http"
      xmlns:munit="http://www.mulesoft.org/schema/mule/munit"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/munit http://www.mulesoft.org/schema/mule/munit/current/mule-munit.xsd">

    <!-- Global Error Handler -->
    <error-handler name="globalErrorHandler" doc:id="geh-1">
        <on-error-continue type="HTTP:NOT_FOUND, CONNECTIVITY" enableNotifications="true" logException="true">
            <set-payload value="Resource Not Found" doc:name="Set Not Found Payload" />
            <logger level="WARN" message="Caught by global handler" doc:name="Log Global Warn" />
        </on-error-continue>
        <on-error-propagate type="ANY" enableNotifications="false" logException="true">
            <logger level="ERROR" message="Global propagate error" doc:name="Log Global Error" />
        </on-error-propagate>
    </error-handler>

    <!-- Main Flow with Try Scope and Global Error Handler Ref -->
    <flow name="orderProcessingFlow" doc:id="flow-1">
        <http:listener path="/orders" config-ref="HTTP_Listener_config" doc:name="Order Listener" />
        <try doc:name="Try Database Insert">
            <logger level="INFO" message="Attempting DB insert" doc:name="Log Pre-Insert" />
            <error-handler>
                <on-error-continue type="DB:CONNECTIVITY" when="#[error.description contains 'timeout']" enableNotifications="true" logException="true">
                    <set-payload value="Database Timeout" doc:name="Set Fallback Payload" />
                    <logger level="WARN" message="DB connection failed, falling back" doc:name="Log Fallback" />
                </on-error-continue>
                <on-error-propagate type="DB:BAD_SQL_SYNTAX" enableNotifications="false" logException="false">
                    <logger level="ERROR" message="Fatal SQL Syntax error" doc:name="Log Fatal SQL" />
                </on-error-propagate>
            </error-handler>
        </try>
        <logger level="INFO" message="Order processing complete" doc:name="Log Success" />
        <error-handler ref="globalErrorHandler" />
    </flow>

    <!-- Sub-Flow with its own Error Handler -->
    <sub-flow name="validationSubFlow" doc:id="subflow-1">
        <logger level="DEBUG" message="Validating payload" doc:name="Validate Logger" />
        <error-handler>
            <on-error-continue type="VALIDATION:NULL" enableNotifications="true" logException="true">
                <set-payload value="Validation Failed" doc:name="Set Validation Payload" />
            </on-error-continue>
        </error-handler>
    </sub-flow>

    <!-- MUnit Test with Error Handler -->
    <munit:test name="orderProcessingTest" doc:id="test-1">
        <munit:execution>
            <logger level="INFO" message="Running test execution" doc:name="Test Execution Log" />
        </munit:execution>
        <munit:error-handler>
            <on-error-continue type="MUNIT:ASSERTION" enableNotifications="true" logException="true">
                <logger level="INFO" message="Assertion handled" doc:name="Log Assertion" />
            </on-error-continue>
        </munit:error-handler>
    </munit:test>

</mule>`;

  it('1. Parses and asserts all error handlers, routes, refs, and scopes appear in layout', () => {
    const { root, error } = MuleXmlParser.parse(testXml);
    assert(!error, `Parse error: ${error}`);
    assert(root, 'Root should be defined');

    const model = SemanticModelBuilder.build(root, 'test.xml');
    assert.strictEqual(model.flows.length, 4, 'Should parse 4 flows (global-error-handler, flow, sub-flow, munit:test)');

    // 1. Verify Global Error Handler in model
    const globalEhFlow = model.flows.find((f) => f.name === 'globalErrorHandler');
    assert(globalEhFlow, 'Global Error Handler should exist in semantic model');
    assert.strictEqual(globalEhFlow.type, 'global-error-handler');
    assert.strictEqual(globalEhFlow.errorHandler.length, 2, 'Global Error Handler should have 2 routes');
    assert.strictEqual(globalEhFlow.errorHandler[0].kind, 'on-error-continue');
    assert.strictEqual(globalEhFlow.errorHandler[0].attributes['type'], 'HTTP:NOT_FOUND, CONNECTIVITY');
    assert.strictEqual(globalEhFlow.errorHandler[0].chain.length, 2, 'First global route should have 2 child components');
    assert.strictEqual(globalEhFlow.errorHandler[1].kind, 'on-error-propagate');
    assert.strictEqual(globalEhFlow.errorHandler[1].chain.length, 1, 'Second global route should have 1 child component');

    // 2. Verify Main Flow and Try Scope in model
    const mainFlow = model.flows.find((f) => f.name === 'orderProcessingFlow');
    assert(mainFlow, 'Main flow should exist');
    assert.strictEqual(mainFlow.errorHandlerRef, 'globalErrorHandler', 'Main flow should reference global error handler');

    const tryNode = mainFlow.chain.find((n) => n.descriptor.localName === 'try' || n.label === 'Try Database Insert');
    assert(tryNode, 'Try scope should exist in main flow chain');
    assert.strictEqual(tryNode.chain.length, 1, 'Try scope should have 1 inner process chain node');
    assert.strictEqual(tryNode.routes.length, 2, 'Try scope should have 2 inner error handler routes');
    assert.strictEqual(tryNode.routes[0].kind, 'on-error-continue');
    assert.strictEqual(tryNode.routes[0].attributes['type'], 'DB:CONNECTIVITY');
    assert.strictEqual(tryNode.routes[0].attributes['when'], "#[error.description contains 'timeout']");
    assert.strictEqual(tryNode.routes[0].chain.length, 2, 'Try scope route 0 should have 2 child processors');
    assert.strictEqual(tryNode.routes[1].kind, 'on-error-propagate');
    assert.strictEqual(tryNode.routes[1].chain.length, 1, 'Try scope route 1 should have 1 child processor');

    // 3. Verify Sub-flow with error handler in model
    const subFlow = model.flows.find((f) => f.name === 'validationSubFlow');
    assert(subFlow, 'Sub-flow should exist');
    assert.strictEqual(subFlow.errorHandler.length, 1, 'Sub-flow should have 1 error handler route');
    assert.strictEqual(subFlow.errorHandler[0].chain.length, 1, 'Sub-flow route should have 1 child processor');

    // 4. Verify MUnit test with error handler in model
    const munitTest = model.flows.find((f) => f.name === 'orderProcessingTest');
    assert(munitTest, 'MUnit test should exist');
    assert.strictEqual(munitTest.errorHandler.length, 1, 'MUnit test should have 1 error handler route');

    // 5. Run Layout Engine
    const scene = layout(model, { collapseErrorHandlers: 'never' });
    assert.strictEqual(scene.flows.length, 4, 'Scene should contain 4 positioned flows');

    // 5a. Global Error Handler in Layout
    const pGlobalEh = scene.flows.find((f) => f.flowModel.name === 'globalErrorHandler');
    assert(pGlobalEh, 'Positioned Global Error Handler should exist');
    assert(pGlobalEh.errorBandBox, 'Global error handler must have an errorBandBox');
    assert.strictEqual(pGlobalEh.errorHandlers.length, 2, 'Global error handler must have 2 positioned routes');
    assert(pGlobalEh.errorHandlers[0].children.length === 2, 'Positioned route 0 must have 2 child nodes');
    assert(pGlobalEh.errorHandlers[1].children.length === 1, 'Positioned route 1 must have 1 child node');

    // 5b. Main Flow in Layout
    const pMainFlow = scene.flows.find((f) => f.flowModel.name === 'orderProcessingFlow');
    assert(pMainFlow, 'Positioned Main Flow should exist');
    assert(pMainFlow.errorBandBox, 'Main flow referencing global error handler must have an errorBandBox');
    assert.strictEqual(pMainFlow.flowModel.errorHandlerRef, 'globalErrorHandler');

    // 5c. Try Scope in Layout
    const pTryNode = pMainFlow.chain.find((n) => n.node.descriptor.localName === 'try' || n.node.label === 'Try Database Insert');
    assert(pTryNode, 'Positioned Try node should exist');
    assert(pTryNode.errorBandBox, 'Try scope must have its own errorBandBox');
    assert(pTryNode.errorHandlers, 'Try scope must have errorHandlers positioned');
    assert.strictEqual(pTryNode.errorHandlers!.length, 2, 'Try scope must have 2 positioned error routes');
    assert.strictEqual(pTryNode.errorHandlers![0].children.length, 2, 'Try error route 0 must have 2 positioned children');
    assert.strictEqual(pTryNode.errorHandlers![1].children.length, 1, 'Try error route 1 must have 1 positioned children');
    assert.strictEqual(pTryNode.children.length, 1, 'Try scope must have 1 positioned execution child');

    // 5d. Sub-Flow in Layout
    const pSubFlow = scene.flows.find((f) => f.flowModel.name === 'validationSubFlow');
    assert(pSubFlow, 'Positioned Sub-flow should exist');
    assert(pSubFlow.errorBandBox, 'Sub-flow must have an errorBandBox');
    assert.strictEqual(pSubFlow.errorHandlers.length, 1, 'Sub-flow must have 1 positioned error route');

    // 5e. MUnit test in Layout
    const pMunit = scene.flows.find((f) => f.flowModel.name === 'orderProcessingTest');
    assert(pMunit, 'Positioned MUnit test should exist');
    assert(pMunit.errorBandBox, 'MUnit test must have an errorBandBox');
    assert.strictEqual(pMunit.errorHandlers.length, 1, 'MUnit test must have 1 positioned error route');
  });

  it('2. Asserts catalog descriptor has type, when, enableNotifications, logException for error handlers', async () => {
    const propagateModel = await ExtensionCatalog.getOperationOrSourceModel('http://www.mulesoft.org/schema/mule/core', 'on-error-propagate');
    assert(propagateModel, 'on-error-propagate model should exist');
    const generalGroup = propagateModel.groups.find((g) => g.name === 'General');
    assert(generalGroup, 'General group should exist');

    const paramNames = generalGroup.parameters.map((p) => p.name);
    assert(paramNames.includes('type'), 'General group must include type parameter');
    assert(paramNames.includes('when'), 'General group must include when parameter');
    assert(paramNames.includes('enableNotifications'), 'General group must include enableNotifications parameter');
    assert(paramNames.includes('logException'), 'General group must include logException parameter');

    const whenParam = generalGroup.parameters.find((p) => p.name === 'when')!;
    assert.strictEqual(whenParam.supportsExpression, true, 'when parameter must support expression');
    assert.strictEqual(whenParam.defaultExpressionMode, true, 'when parameter must default to expression mode');

    const continueModel = await ExtensionCatalog.getOperationOrSourceModel('http://www.mulesoft.org/schema/mule/core', 'on-error-continue');
    assert(continueModel, 'on-error-continue model should exist');
    const contGeneralGroup = continueModel.groups.find((g) => g.name === 'General');
    assert(contGeneralGroup, 'General group should exist on on-error-continue');
    const contParamNames = contGeneralGroup.parameters.map((p) => p.name);
    assert(contParamNames.includes('type'));
    assert(contParamNames.includes('when'));
    assert(contParamNames.includes('enableNotifications'));
    assert(contParamNames.includes('logException'));
  });

  it('3. Asserts XML escaping helper works correctly for when expressions with <, >, &&, and quotes', () => {
    assert.strictEqual(
      FlowVisualizerPanel.escapeXml("error.cause.message contains 'timeout' && error.errorType.identifier == 'NOT_FOUND'"),
      "error.cause.message contains 'timeout' &amp;&amp; error.errorType.identifier == 'NOT_FOUND'"
    );
    assert.strictEqual(
      FlowVisualizerPanel.escapeXml('vars.retryCount < 3 && vars.total > 0'),
      'vars.retryCount &lt; 3 &amp;&amp; vars.total &gt; 0'
    );
  });
});
