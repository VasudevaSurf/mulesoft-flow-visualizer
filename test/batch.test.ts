import assert from 'assert';
import { MuleXmlParser } from '../src/parser/xmlParser';
import { SemanticModelBuilder } from '../src/parser/semanticModel';
import { layout } from '../src/layout';
import { ExtensionCatalog } from '../src/catalog';

describe('Batch Job Structure & Layout Tests', () => {
  const batchTestXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation"
      xmlns:batch="http://www.mulesoft.org/schema/mule/batch"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="
        http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/batch http://www.mulesoft.org/schema/mule/batch/current/mule-batch.xsd">

  <flow name="CustomerBatchProcessingFlow" doc:id="flow-batch-1">
    <batch:job jobName="Customer_Batch_Job" blockSize="200" maxFailedRecords="5" jobInstanceId="#[payload.batchId]" doc:name="Process Customers">
      <batch:input>
        <logger message="Starting customer batch load" doc:name="Log Input Start" />
      </batch:input>
      <batch:process-records>
        <batch:step name="Step1" acceptPolicy="NO_FAILURES" doc:name="Enrich Customer Step">
          <logger message="Enriching customer record" doc:name="Log Step 1" />
          <batch:aggregator size="250" streaming="true" doc:name="Bulk Database Aggregator">
            <logger message="Bulk inserting 250 records" doc:name="Log Aggregated Records" />
          </batch:aggregator>
        </batch:step>
        <batch:step name="Step2" acceptExpression="#[payload.isActive == true]" doc:name="Active Filter Step">
          <logger message="Processing active customer" doc:name="Log Step 2" />
        </batch:step>
        <batch:step name="Step3" acceptPolicy="ONLY_FAILURES" doc:name="Error Handling Step">
          <logger message="Handling failed customer record" doc:name="Log Step 3 Error" />
        </batch:step>
      </batch:process-records>
      <batch:on-complete>
        <logger message="Customer batch finished" doc:name="Log Completion Report" />
      </batch:on-complete>
    </batch:job>
  </flow>
</mule>`;

  it('1. Parses XML with 1 job, 3 steps, 1 aggregator, and on-complete into SemanticModel', () => {
    const parseResult = MuleXmlParser.parse(batchTestXml);
    assert(parseResult.root, 'XML root should be parsed');
    const model = SemanticModelBuilder.build(parseResult.root!, 'test/fixtures/batch-flow.xml');

    assert.strictEqual(model.flows.length, 1, 'Should contain 1 flow');
    const flow = model.flows[0];
    assert.strictEqual(flow.chain.length, 1, 'Flow chain should contain batch:job');

    const job = flow.chain[0];
    assert.strictEqual(job.descriptor.localName, 'job', 'Node should be batch:job');
    assert.strictEqual(job.attributes['jobName'], 'Customer_Batch_Job');
    assert.strictEqual(job.attributes['blockSize'], '200');
    assert.strictEqual(job.attributes['maxFailedRecords'], '5');
    assert.strictEqual(job.attributes['jobInstanceId'], '#[payload.batchId]');

    // Check three zones
    assert(job.batchZones, 'batchZones should be defined on batch:job');
    const { input, processRecords, onComplete } = job.batchZones!;

    // Input zone
    assert(input, 'Input zone should exist');
    assert.strictEqual(input.chain.length, 1, 'Input zone should have 1 child logger');
    assert.strictEqual(input.chain[0].descriptor.localName, 'logger');

    // Process Records zone
    assert(processRecords, 'Process Records zone should exist');
    assert.strictEqual(processRecords.chain.length, 3, 'Process Records should contain all 3 steps');

    // Step 1
    const step1 = processRecords.chain[0];
    assert.strictEqual(step1.attributes['name'], 'Step1');
    assert.strictEqual(step1.attributes['acceptPolicy'], 'NO_FAILURES');
    assert.strictEqual(step1.chain.length, 1, 'Step 1 should have 1 processor');
    assert(step1.aggregator, 'Step 1 should contain an aggregator');
    assert.strictEqual(step1.aggregator!.attributes['size'], '250');
    assert.strictEqual(step1.aggregator!.attributes['streaming'], 'true');
    assert.strictEqual(step1.aggregator!.chain.length, 1, 'Aggregator should have 1 child processor');
    assert.strictEqual(step1.aggregator!.chain[0].descriptor.localName, 'logger');

    // Step 2
    const step2 = processRecords.chain[1];
    assert.strictEqual(step2.attributes['name'], 'Step2');
    assert.strictEqual(step2.attributes['acceptExpression'], '#[payload.isActive == true]');
    assert.strictEqual(step2.chain.length, 1, 'Step 2 should have 1 processor');
    assert.strictEqual(step2.aggregator, null, 'Step 2 should not have an aggregator');

    // Step 3
    const step3 = processRecords.chain[2];
    assert.strictEqual(step3.attributes['name'], 'Step3');
    assert.strictEqual(step3.attributes['acceptPolicy'], 'ONLY_FAILURES');
    assert.strictEqual(step3.chain.length, 1, 'Step 3 should have 1 processor');
    assert.strictEqual(step3.aggregator, null, 'Step 3 should not have an aggregator');

    // On Complete zone
    assert(onComplete, 'On Complete zone should exist');
    assert.strictEqual(onComplete.chain.length, 1, 'On Complete zone should have 1 child logger');
    assert.strictEqual(onComplete.chain[0].descriptor.localName, 'logger');
  });

  it('2. Layout contains all three steps and the aggregator with valid geometry', () => {
    const parseResult = MuleXmlParser.parse(batchTestXml);
    const model = SemanticModelBuilder.build(parseResult.root!, 'test/fixtures/batch-flow.xml');
    const scene = layout(model);

    assert(scene, 'Scene should be produced');
    assert.strictEqual(scene.flows.length, 1, 'Scene should have 1 flow');

    const posFlow = scene.flows[0];
    assert.strictEqual(posFlow.chain.length, 1, 'Flow should have 1 child node');

    const posJob = posFlow.chain[0];
    assert(posJob.batchZones, 'Positioned batch job must have batchZones');

    const { input, processRecords, onComplete } = posJob.batchZones!;
    assert(input && processRecords && onComplete, 'All three zones must be positioned');

    // Assert layout contains all three steps
    assert.strictEqual(processRecords.children.length, 3, 'Process Records layout must contain all three steps');

    const [posStep1, posStep2, posStep3] = processRecords.children;
    assert.strictEqual(posStep1.node.attributes['name'], 'Step1');
    assert.strictEqual(posStep2.node.attributes['name'], 'Step2');
    assert.strictEqual(posStep3.node.attributes['name'], 'Step3');

    // Verify all steps have non-zero geometry
    for (const step of [posStep1, posStep2, posStep3]) {
      assert(step.width > 0, `Step ${step.node.label} width should be > 0`);
      assert(step.height > 0, `Step ${step.node.label} height should be > 0`);
    }

    // Verify sequential horizontal layout: step 1 before step 2 before step 3
    assert(posStep1.x < posStep2.x, 'Step 1 should be positioned before Step 2');
    assert(posStep2.x < posStep3.x, 'Step 2 should be positioned before Step 3');

    // Assert aggregator in step 1
    assert(posStep1.aggregator, 'Step 1 must contain the aggregator in layout');
    const posAgg = posStep1.aggregator!;
    assert.strictEqual(posAgg.node.descriptor.localName, 'aggregator');
    assert.strictEqual(posAgg.node.attributes['size'], '250');
    assert.strictEqual(posAgg.node.attributes['streaming'], 'true');
    assert(posAgg.width > 0, 'Aggregator width should be > 0');
    assert(posAgg.height > 0, 'Aggregator height should be > 0');
    assert(posAgg.x >= posStep1.x, 'Aggregator x position should be within Step 1');
    assert.strictEqual(posAgg.children.length, 1, 'Aggregator should contain its child logger');

    // Assert input and on-complete zones have valid geometry
    assert(input.width > 0 && input.height > 0, 'Input zone should have positive dimensions');
    assert.strictEqual(input.children.length, 1, 'Input zone should contain child logger');
    assert(onComplete.width > 0 && onComplete.height > 0, 'On-Complete zone should have positive dimensions');
    assert.strictEqual(onComplete.children.length, 1, 'On-Complete zone should contain child logger');

    // Assert horizontal zone layout: input -> process records -> on complete
    assert(input.x < processRecords.x, 'Input zone must be positioned before Process Records zone');
    assert(processRecords.x < onComplete.x, 'Process Records zone must be positioned before On Complete zone');
  });

  it('3. Properties panel parameters: batch:job, batch:step, and batch:aggregator', async () => {
    // 1. batch:job parameters: name, blockSize, maxFailedRecords, jobInstanceId
    const jobModel = await ExtensionCatalog.getOperationOrSourceModel(
      'http://www.mulesoft.org/schema/mule/batch',
      'job'
    );
    assert(jobModel, 'batch:job model should be found in catalog');
    const jobParamNames = jobModel!.groups.flatMap((g) => g.parameters.map((p) => p.name));
    assert(jobParamNames.includes('name'), 'batch:job should have name parameter');
    assert(jobParamNames.includes('blockSize'), 'batch:job should have blockSize parameter');
    assert(jobParamNames.includes('maxFailedRecords'), 'batch:job should have maxFailedRecords parameter');
    assert(jobParamNames.includes('jobInstanceId'), 'batch:job should have jobInstanceId parameter');

    // 2. batch:step parameters: name, acceptExpression, acceptPolicy
    const stepModel = await ExtensionCatalog.getOperationOrSourceModel(
      'http://www.mulesoft.org/schema/mule/batch',
      'step'
    );
    assert(stepModel, 'batch:step model should be found in catalog');
    const stepParamNames = stepModel!.groups.flatMap((g) => g.parameters.map((p) => p.name));
    assert(stepParamNames.includes('name'), 'batch:step should have name parameter');
    assert(stepParamNames.includes('acceptExpression'), 'batch:step should have acceptExpression parameter');
    assert(stepParamNames.includes('acceptPolicy'), 'batch:step should have acceptPolicy parameter');

    // 3. batch:aggregator parameters: size, streaming
    const aggModel = await ExtensionCatalog.getOperationOrSourceModel(
      'http://www.mulesoft.org/schema/mule/batch',
      'aggregator'
    );
    assert(aggModel, 'batch:aggregator model should be found in catalog');
    const aggParamNames = aggModel!.groups.flatMap((g) => g.parameters.map((p) => p.name));
    assert(aggParamNames.includes('size'), 'batch:aggregator should have size parameter');
    assert(aggParamNames.includes('streaming'), 'batch:aggregator should have streaming parameter');
  });
});
