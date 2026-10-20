import assert from 'assert';
import { MuleXmlParser } from '../src/parser/xmlParser';
import { SemanticModelBuilder } from '../src/parser/semanticModel';
import { layout } from '../src/layout';
import { ExtensionCatalog } from '../src/catalog';

describe('Prompts 1 to 5 Fixture Parser Tests', () => {

  // =========================================================================
  // FIXTURE 1: Choice Router with when expressions, otherwise, and special characters
  // =========================================================================
  const prompt1ChoiceFixtureXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation">
    <flow name="choiceRouterFlow" doc:id="f-choice-1">
        <choice doc:name="Payment Choice">
            <when expression="#[payload.amount &gt; 1000 &amp;&amp; payload.currency == &quot;USD&quot;]">
                <logger level="INFO" message="High value USD payment" doc:name="Log High Value" />
            </when>
            <when expression="#[payload.status &lt; 0 || payload.flag == false]">
                <logger level="WARN" message="Negative or inactive" doc:name="Log Warning" />
            </when>
            <otherwise>
                <logger level="INFO" message="Default processing" doc:name="Log Default" />
            </otherwise>
        </choice>
    </flow>
</mule>`;

  it('Prompt 1: Parses Choice Router fixture with multiple when expressions and otherwise', () => {
    const parseResult = MuleXmlParser.parse(prompt1ChoiceFixtureXml);
    assert(parseResult.root, 'XML root should parse successfully');
    const model = SemanticModelBuilder.build(parseResult.root!, 'choice.xml');

    assert.strictEqual(model.flows.length, 1);
    const flow = model.flows[0];
    assert.strictEqual(flow.name, 'choiceRouterFlow');

    const choiceNode = flow.chain[0];
    assert.strictEqual(choiceNode.descriptor.localName, 'choice');
    assert.strictEqual(choiceNode.routes.length, 3, 'Choice router must contain 3 routes');

    // Route 1: when with > and && and quotes
    const route1 = choiceNode.routes[0];
    assert.strictEqual(route1.kind, 'when');
    assert.strictEqual(route1.attributes['expression'], '#[payload.amount > 1000 && payload.currency == "USD"]');
    assert.strictEqual(route1.chain.length, 1);
    assert.strictEqual(route1.chain[0].descriptor.localName, 'logger');

    // Route 2: when with <
    const route2 = choiceNode.routes[1];
    assert.strictEqual(route2.kind, 'when');
    assert.strictEqual(route2.attributes['expression'], '#[payload.status < 0 || payload.flag == false]');
    assert.strictEqual(route2.chain.length, 1);

    // Route 3: otherwise
    const route3 = choiceNode.routes[2];
    assert.strictEqual(route3.kind, 'otherwise');
    assert.strictEqual(route3.chain.length, 1);
  });

  // =========================================================================
  // FIXTURE 2: Error Handling in flow, sub-flow, try scope, and munit:test
  // =========================================================================
  const prompt2ErrorFixtureXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation"
      xmlns:munit="http://www.mulesoft.org/schema/mule/munit">

    <error-handler name="globalErrorHandler" doc:id="geh-100">
        <on-error-continue type="HTTP:TIMEOUT, HTTP:CONNECTIVITY" enableNotifications="true" logException="true">
            <set-payload value="Global Timeout Fallback" doc:name="Set Fallback" />
        </on-error-continue>
        <on-error-propagate type="ANY" enableNotifications="false" logException="true">
            <logger level="ERROR" message="Global propagate" doc:name="Log Propagate" />
        </on-error-propagate>
    </error-handler>

    <flow name="flowWithTryAndRef" doc:id="flow-try-1">
        <try doc:name="Database Transaction">
            <logger message="Querying DB" doc:name="Log Query" />
            <error-handler>
                <on-error-continue type="DB:CONNECTIVITY" when="#[error.description contains 'timeout']" enableNotifications="true" logException="true">
                    <set-payload value="DB Retry Fallback" />
                </on-error-continue>
                <on-error-propagate type="DB:BAD_SQL" enableNotifications="false" logException="false">
                    <logger level="ERROR" message="Fatal SQL Error" />
                </on-error-propagate>
            </error-handler>
        </try>
        <error-handler ref="globalErrorHandler" />
    </flow>

    <sub-flow name="subflowWithError" doc:id="subflow-101">
        <logger message="Subflow start" />
        <error-handler>
            <on-error-continue type="VALIDATION:INVALID_BOOLEAN">
                <set-payload value="Validation Failed" />
            </on-error-continue>
        </error-handler>
    </sub-flow>

    <munit:test name="munitTestWithError" doc:id="munit-err-1">
        <munit:execution>
            <flow-ref name="flowWithTryAndRef" />
        </munit:execution>
        <error-handler>
            <on-error-continue type="MUNIT:ASSERTION">
                <logger message="MUnit assertion handled" />
            </on-error-continue>
        </error-handler>
    </munit:test>
</mule>`;

  it('Prompt 2: Parses Error Handling fixture across flow, sub-flow, try scope, and munit:test', () => {
    const parseResult = MuleXmlParser.parse(prompt2ErrorFixtureXml);
    assert(parseResult.root, 'XML root should parse successfully');
    const model = SemanticModelBuilder.build(parseResult.root!, 'error.xml');

    assert.strictEqual(model.flows.length, 4);

    // 1. Global error handler
    const geh = model.flows.find(f => f.name === 'globalErrorHandler');
    assert(geh, 'globalErrorHandler flow must exist');
    assert.strictEqual(geh!.type, 'global-error-handler');
    assert.strictEqual(geh!.errorHandler.length, 2);
    assert.strictEqual(geh!.errorHandler[0].kind, 'on-error-continue');
    assert.strictEqual(geh!.errorHandler[0].attributes['type'], 'HTTP:TIMEOUT, HTTP:CONNECTIVITY');
    assert.strictEqual(geh!.errorHandler[1].kind, 'on-error-propagate');

    // 2. Flow with Try scope and error-handler ref
    const flow = model.flows.find(f => f.name === 'flowWithTryAndRef');
    assert(flow, 'flowWithTryAndRef must exist');
    assert.strictEqual(flow!.errorHandlerRef, 'globalErrorHandler');

    const tryNode = flow!.chain[0];
    assert.strictEqual(tryNode.descriptor.localName, 'try');
    assert.strictEqual(tryNode.routes.length, 2, 'Try scope should have 2 on-error routes');
    assert.strictEqual(tryNode.routes[0].kind, 'on-error-continue');
    assert.strictEqual(tryNode.routes[0].attributes['type'], 'DB:CONNECTIVITY');
    assert.strictEqual(tryNode.routes[0].attributes['when'], "#[error.description contains 'timeout']");
    assert.strictEqual(tryNode.routes[1].kind, 'on-error-propagate');

    // 3. Sub-flow with error handler
    const subflow = model.flows.find(f => f.name === 'subflowWithError');
    assert(subflow, 'subflowWithError must exist');
    assert.strictEqual(subflow!.errorHandler.length, 1);
    assert.strictEqual(subflow!.errorHandler[0].kind, 'on-error-continue');

    // 4. MUnit test with error handler
    const munitFlow = model.flows.find(f => f.name === 'munitTestWithError');
    assert(munitFlow, 'munitTestWithError must exist');
    assert.strictEqual(munitFlow!.errorHandler.length, 1);
  });

  // =========================================================================
  // FIXTURE 3: Error Handler Dropdown & Minimizable State
  // =========================================================================
  it('Prompt 3: Asserts Error Handler dropdown / minimize collapse state is represented in model & layout', () => {
    const parseResult = MuleXmlParser.parse(prompt2ErrorFixtureXml);
    const model = SemanticModelBuilder.build(parseResult.root!, 'error.xml');

    // 1. Layout with error handlers expanded ('never')
    const sceneExpanded = layout(model, { collapseErrorHandlers: 'never' });
    const flowExpanded = sceneExpanded.flows.find(f => f.flowModel.name === 'flowWithTryAndRef')!;
    const tryExpanded = flowExpanded.chain[0];
    assert(tryExpanded.errorBandBox, 'Try scope must have errorBandBox');
    assert.strictEqual(tryExpanded.errorCollapsed, false);

    // 2. Layout with error handlers collapsed
    const tryScopeNode = model.flows.find(f => f.name === 'flowWithTryAndRef')!.chain[0];
    tryScopeNode.errorBandCollapsed = true;

    const sceneCollapsed = layout(model, { collapseErrorHandlers: 'always' });
    const flowCollapsed = sceneCollapsed.flows.find(f => f.flowModel.name === 'flowWithTryAndRef')!;
    const tryCollapsed = flowCollapsed.chain[0];
    assert(tryCollapsed.errorBandBox, 'Try scope must have errorBandBox even when collapsed');
    assert.strictEqual(tryCollapsed.errorCollapsed, true);
    // Collapsed band has standard minimized header height
    assert.ok(tryCollapsed.errorBandBox!.height < tryExpanded.errorBandBox!.height);

    // Global error handler collapsed state
    const gehCollapsed = sceneCollapsed.flows.find(f => f.flowModel.name === 'globalErrorHandler')!;
    assert.strictEqual(gehCollapsed.errorCollapsed, true);
  });

  // =========================================================================
  // FIXTURE 4: Real Batch Structure (input, process-records, steps, aggregator, on-complete)
  // =========================================================================
  const prompt4BatchFixtureXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:batch="http://www.mulesoft.org/schema/mule/batch"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation">
    <flow name="invoiceBatchFlow" doc:id="f-batch-1">
        <batch:job jobName="InvoiceBatchJob" blockSize="150" maxFailedRecords="10" jobInstanceId="#[vars.batchInstanceId]" doc:name="Batch Invoices">
            <batch:input>
                <logger message="Batch Input: Fetching records" doc:name="Log Input" />
            </batch:input>
            <batch:process-records>
                <batch:step name="ValidateStep" acceptPolicy="NO_FAILURES" doc:name="Validate Invoice">
                    <logger message="Validating invoice" doc:name="Log Validate" />
                    <batch:aggregator size="100" streaming="true" doc:name="Batch Aggregator">
                        <logger message="Aggregated 100 invoices" doc:name="Log Aggregated" />
                    </batch:aggregator>
                </batch:step>
                <batch:step name="FilterStep" acceptExpression="#[payload.isProcessed == false]" doc:name="Filter Step">
                    <logger message="Filtering invoice" doc:name="Log Filter" />
                </batch:step>
                <batch:step name="FailureStep" acceptPolicy="ONLY_FAILURES" doc:name="Handle Failures">
                    <logger level="ERROR" message="Failed invoice" doc:name="Log Failure" />
                </batch:step>
            </batch:process-records>
            <batch:on-complete>
                <logger message="Batch Complete: Invoices processed" doc:name="Log Complete" />
            </batch:on-complete>
        </batch:job>
    </flow>
</mule>`;

  it('Prompt 4: Parses Real Batch Structure with 3 zones, steps, aggregator, and attributes', () => {
    const parseResult = MuleXmlParser.parse(prompt4BatchFixtureXml);
    assert(parseResult.root, 'XML root should parse successfully');
    const model = SemanticModelBuilder.build(parseResult.root!, 'batch.xml');

    assert.strictEqual(model.flows.length, 1);
    const jobNode = model.flows[0].chain[0];
    assert.strictEqual(jobNode.descriptor.localName, 'job');
    assert.strictEqual(jobNode.attributes['jobName'], 'InvoiceBatchJob');
    assert.strictEqual(jobNode.attributes['blockSize'], '150');
    assert.strictEqual(jobNode.attributes['maxFailedRecords'], '10');
    assert.strictEqual(jobNode.attributes['jobInstanceId'], '#[vars.batchInstanceId]');

    assert(jobNode.batchZones, 'batchZones must exist on batch:job');
    const { input, processRecords, onComplete } = jobNode.batchZones!;

    // 1. batch:input
    assert.strictEqual(input.chain.length, 1);
    assert.strictEqual(input.chain[0].descriptor.localName, 'logger');

    // 2. batch:process-records (3 steps)
    assert.strictEqual(processRecords.chain.length, 3);
    const [step1, step2, step3] = processRecords.chain;

    // Step 1 + aggregator
    assert.strictEqual(step1.attributes['name'], 'ValidateStep');
    assert.strictEqual(step1.attributes['acceptPolicy'], 'NO_FAILURES');
    assert(step1.aggregator, 'Step 1 must have aggregator');
    assert.strictEqual(step1.aggregator!.attributes['size'], '100');
    assert.strictEqual(step1.aggregator!.attributes['streaming'], 'true');

    // Step 2
    assert.strictEqual(step2.attributes['name'], 'FilterStep');
    assert.strictEqual(step2.attributes['acceptExpression'], '#[payload.isProcessed == false]');

    // Step 3
    assert.strictEqual(step3.attributes['name'], 'FailureStep');
    assert.strictEqual(step3.attributes['acceptPolicy'], 'ONLY_FAILURES');

    // 3. batch:on-complete
    assert.strictEqual(onComplete.chain.length, 1);
    assert.strictEqual(onComplete.chain[0].descriptor.localName, 'logger');
  });

  // =========================================================================
  // FIXTURE 5: MUnit Test (behavior, execution, validation, before/after suites, catalog)
  // =========================================================================
  const prompt5MunitFixtureXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:munit="http://www.mulesoft.org/schema/mule/munit"
      xmlns:munit-tools="http://www.mulesoft.org/schema/mule/munit-tools"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation">

    <munit:before-suite name="testBeforeSuite" doc:name="Before Suite Hook">
        <logger message="Setup before suite" />
    </munit:before-suite>

    <munit:before-test name="testBeforeTest" doc:name="Before Test Hook">
        <logger message="Setup before test" />
    </munit:before-test>

    <munit:test name="fullMunitTest" description="Full test coverage" doc:id="munit-test-1">
        <munit:behavior>
            <munit-tools:mock-when processor="http:request" doc:name="Mock HTTP">
                <munit-tools:with-attributes>
                    <munit-tools:with-attribute attributeName="method" whereValue="#['GET']" />
                </munit-tools:with-attributes>
                <munit-tools:then-return>
                    <munit-tools:payload value="#[{ 'status': 'OK' }]" mediaType="application/json" />
                    <munit-tools:attributes value="#[{ 'statusCode': 200 }]" />
                </munit-tools:then-return>
            </munit-tools:mock-when>
            <munit:set-event doc:name="Set Event">
                <munit:payload value="#[{ 'orderId': '123' }]" mediaType="application/json" encoding="UTF-8" />
                <munit:attributes value="#[{ 'headers': { 'Content-Type': 'application/json' } }]" />
            </munit:set-event>
        </munit:behavior>

        <munit:execution>
            <flow-ref name="processOrderFlow" doc:name="Execute flow" />
        </munit:execution>

        <munit:validation>
            <munit-tools:assert-that expression="#[payload.status]" is="#[MunitTools::equalTo('OK')]" message="Status must be OK" />
            <munit-tools:assert-equals actual="#[payload.status]" expected="#['OK']" message="Exact match" />
            <munit-tools:verify-call processor="http:request" times="1" />
        </munit:validation>
    </munit:test>

    <munit:after-test name="testAfterTest" doc:name="After Test Hook">
        <logger message="Teardown after test" />
    </munit:after-test>

    <munit:after-suite name="testAfterSuite" doc:name="After Suite Hook">
        <logger message="Teardown after suite" />
    </munit:after-suite>
</mule>`;

  it('Prompt 5: Parses MUnit Test fixture with behavior, execution, validation zones & lifecycle flows', () => {
    const parseResult = MuleXmlParser.parse(prompt5MunitFixtureXml);
    assert(parseResult.root, 'XML root should parse successfully');
    const model = SemanticModelBuilder.build(parseResult.root!, 'munit.xml');

    assert.strictEqual(model.flows.length, 5);

    // Lifecycle hooks
    assert.strictEqual(model.flows.find(f => f.name === 'testBeforeSuite')!.type, 'before-suite');
    assert.strictEqual(model.flows.find(f => f.name === 'testBeforeTest')!.type, 'before-test');
    assert.strictEqual(model.flows.find(f => f.name === 'testAfterTest')!.type, 'after-test');
    assert.strictEqual(model.flows.find(f => f.name === 'testAfterSuite')!.type, 'after-suite');

    // Test flow
    const testFlow = model.flows.find(f => f.name === 'fullMunitTest')!;
    assert.strictEqual(testFlow.type, 'munit-test');
    assert(testFlow.munitZones, 'testFlow must have munitZones');

    // Behavior zone
    const behavior = testFlow.munitZones!.behavior;
    assert.strictEqual(behavior.chain.length, 2);
    assert.strictEqual(behavior.chain[0].descriptor.localName, 'mock-when');
    assert.strictEqual(behavior.chain[1].descriptor.localName, 'set-event');

    // Execution zone
    const execution = testFlow.munitZones!.execution;
    assert.strictEqual(execution.chain.length, 1);
    assert.strictEqual(execution.chain[0].descriptor.localName, 'flow-ref');

    // Validation zone
    const validation = testFlow.munitZones!.validation;
    assert.strictEqual(validation.chain.length, 3);
    assert.strictEqual(validation.chain[0].descriptor.localName, 'assert-that');
    assert.strictEqual(validation.chain[1].descriptor.localName, 'assert-equals');
    assert.strictEqual(validation.chain[2].descriptor.localName, 'verify-call');
  });
});
