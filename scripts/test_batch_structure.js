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
      return {
        uri: typeof uri === 'string' ? mockVscode.Uri.file(uri) : uri,
        getText: (range) => {
          if (!range) return text;
          const lines = text.split(/\r?\n/);
          if (range.start.line === range.end.line) {
            return lines[range.start.line].substring(range.start.character, range.end.character);
          }
          let res = lines[range.start.line].substring(range.start.character) + '\n';
          for (let l = range.start.line + 1; l < range.end.line; l++) {
            res += lines[l] + '\n';
          }
          res += lines[range.end.line].substring(0, range.end.character);
          return res;
        },
        positionAt: (offset) => {
          const lines = text.substring(0, offset).split(/\r?\n/);
          return new mockVscode.Position(lines.length - 1, lines[lines.length - 1].length);
        },
        offsetAt: (pos) => {
          const lines = text.split(/\r?\n/);
          let offset = 0;
          for (let l = 0; l < pos.line; l++) {
            offset += lines[l].length + 1;
          }
          return offset + pos.character;
        },
      };
    },
    applyEdit: async (edit) => {
      for (const e of edit.edits) {
        const filePath = e.uri.fsPath || e.uri;
        let docText = mockDocuments.get(filePath) || fs.readFileSync(filePath, 'utf-8');
        const lines = docText.split(/\r?\n/);
        const getOffset = (pos) => {
          let off = 0;
          for (let l = 0; l < pos.line; l++) off += lines[l].length + 1;
          return off + pos.character;
        };

        if (e.type === 'replace') {
          const start = getOffset(e.range.start);
          const end = getOffset(e.range.end);
          docText = docText.substring(0, start) + e.text + docText.substring(end);
        } else if (e.type === 'insert') {
          const pos = getOffset(e.pos);
          docText = docText.substring(0, pos) + e.text + docText.substring(pos);
        }
        mockDocuments.set(filePath, docText);
      }
      return true;
    },
  },
};

// Hook require for vscode
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'vscode') {
    return mockVscode;
  }
  return origRequire.apply(this, arguments);
};

async function runTests() {
  console.log('--- Starting Batch Job Structure & Layout Tests ---');

  const { MuleXmlParser } = require('../out/parser/xmlParser');
  const { SemanticModelBuilder } = require('../out/parser/semanticModel');
  const { layout } = require('../out/layout');
  const { ExtensionCatalog } = require('../out/catalog');

  const testXml = `<?xml version="1.0" encoding="UTF-8"?>
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

  // Test 1: XML Parsing & Semantic Model Construction
  console.log('Test 1: Parsing batch XML into SemanticModel...');
  const { root, error } = MuleXmlParser.parse(testXml);
  assert(!error, `XML parser returned error: ${error}`);
  assert(root, 'Root element should exist');

  const model = SemanticModelBuilder.build(root, 'test-batch.xml');
  assert.strictEqual(model.flows.length, 1, 'Should have 1 flow');
  const flow = model.flows[0];
  assert.strictEqual(flow.chain.length, 1, 'Flow should have batch:job node');

  const job = flow.chain[0];
  assert.strictEqual(job.descriptor.localName, 'job', 'Node should be job');
  assert.strictEqual(job.attributes['jobName'], 'Customer_Batch_Job');
  assert.strictEqual(job.attributes['blockSize'], '200');
  assert.strictEqual(job.attributes['maxFailedRecords'], '5');
  assert.strictEqual(job.attributes['jobInstanceId'], '#[payload.batchId]');

  assert(job.batchZones, 'batchZones must exist on job node');
  const { input, processRecords, onComplete } = job.batchZones;
  assert(input, 'Input zone must exist');
  assert.strictEqual(input.chain.length, 1, 'Input zone should have 1 child logger');
  assert.strictEqual(input.chain[0].descriptor.localName, 'logger');

  assert(processRecords, 'Process Records zone must exist');
  assert.strictEqual(processRecords.chain.length, 3, 'Process Records should contain exactly 3 steps');

  // Step 1 check
  const step1 = processRecords.chain[0];
  assert.strictEqual(step1.attributes['name'], 'Step1');
  assert.strictEqual(step1.attributes['acceptPolicy'], 'NO_FAILURES');
  assert.strictEqual(step1.chain.length, 1, 'Step 1 should have 1 processor');
  assert(step1.aggregator, 'Step 1 must have an aggregator node');
  assert.strictEqual(step1.aggregator.attributes['size'], '250');
  assert.strictEqual(step1.aggregator.attributes['streaming'], 'true');
  assert.strictEqual(step1.aggregator.chain.length, 1, 'Aggregator should contain child logger');

  // Step 2 check
  const step2 = processRecords.chain[1];
  assert.strictEqual(step2.attributes['name'], 'Step2');
  assert.strictEqual(step2.attributes['acceptExpression'], '#[payload.isActive == true]');

  // Step 3 check
  const step3 = processRecords.chain[2];
  assert.strictEqual(step3.attributes['name'], 'Step3');
  assert.strictEqual(step3.attributes['acceptPolicy'], 'ONLY_FAILURES');

  // On Complete check
  assert(onComplete, 'On Complete zone must exist');
  assert.strictEqual(onComplete.chain.length, 1, 'On Complete should contain child logger');
  console.log('✓ Test 1 Passed: Semantic Model successfully constructed with real batch hierarchy!');

  // Test 2: Layout Engine Verification
  console.log('Test 2: Verifying Positioned Layout for batch:job...');
  const scene = layout(model);
  assert(scene, 'Scene must be returned');
  assert.strictEqual(scene.flows.length, 1);
  const posJob = scene.flows[0].chain[0];
  assert(posJob.batchZones, 'Positioned job node must have batchZones');

  const posInput = posJob.batchZones.input;
  const posProc = posJob.batchZones.processRecords;
  const posOnComp = posJob.batchZones.onComplete;

  assert(posInput.width > 0 && posInput.height > 0, 'Input zone geometry must be positive');
  assert(posProc.width > 0 && posProc.height > 0, 'Process Records zone geometry must be positive');
  assert(posOnComp.width > 0 && posOnComp.height > 0, 'On Complete zone geometry must be positive');

  // Assert all three steps are in the layout
  assert.strictEqual(posProc.children.length, 3, 'Process Records layout must contain all three steps');
  const [lStep1, lStep2, lStep3] = posProc.children;
  assert.strictEqual(lStep1.node.attributes['name'], 'Step1');
  assert.strictEqual(lStep2.node.attributes['name'], 'Step2');
  assert.strictEqual(lStep3.node.attributes['name'], 'Step3');

  // Assert sequential step positioning
  assert(lStep1.x < lStep2.x, 'Step 1 must be placed before Step 2');
  assert(lStep2.x < lStep3.x, 'Step 2 must be placed before Step 3');
  console.log(`  Step 1: x=${lStep1.x}, y=${lStep1.y}, w=${lStep1.width}, h=${lStep1.height}`);
  console.log(`  Step 2: x=${lStep2.x}, y=${lStep2.y}, w=${lStep2.width}, h=${lStep2.height}`);
  console.log(`  Step 3: x=${lStep3.x}, y=${lStep3.y}, w=${lStep3.width}, h=${lStep3.height}`);

  // Assert aggregator is present in Step 1
  assert(lStep1.aggregator, 'Step 1 must contain positioned aggregator');
  const lAgg = lStep1.aggregator;
  assert.strictEqual(lAgg.node.attributes['size'], '250');
  assert.strictEqual(lAgg.node.attributes['streaming'], 'true');
  assert(lAgg.width > 0 && lAgg.height > 0, 'Aggregator geometry must be positive');
  assert(lAgg.x >= lStep1.x, 'Aggregator must be placed inside/after Step 1 processors');
  assert.strictEqual(lAgg.children.length, 1, 'Aggregator contains its child logger in layout');
  console.log(`  Aggregator: x=${lAgg.x}, y=${lAgg.y}, w=${lAgg.width}, h=${lAgg.height}`);

  // Assert input and on-complete
  assert.strictEqual(posInput.children.length, 1, 'Input zone layout contains child logger');
  assert.strictEqual(posOnComp.children.length, 1, 'On-Complete zone layout contains child logger');
  assert(posInput.x < posProc.x, 'Input zone placed before Process Records zone');
  assert(posProc.x < posOnComp.x, 'Process Records zone placed before On Complete zone');
  console.log('✓ Test 2 Passed: Layout engine contains all 3 steps and aggregator with correct spatial alignment!');

  // Test 3: Properties Panel Parameters
  console.log('Test 3: Checking Properties Panel Parameters in ExtensionCatalog...');

  // batch:job parameters: name, blockSize, maxFailedRecords, jobInstanceId
  const jobOp = await ExtensionCatalog.getOperationOrSourceModel('http://www.mulesoft.org/schema/mule/batch', 'job');
  assert(jobOp, 'batch:job model must be found');
  const jobParams = jobOp.groups.flatMap(g => g.parameters.map(p => p.name));
  assert(jobParams.includes('name'), 'job should have name');
  assert(jobParams.includes('blockSize'), 'job should have blockSize');
  assert(jobParams.includes('maxFailedRecords'), 'job should have maxFailedRecords');
  assert(jobParams.includes('jobInstanceId'), 'job should have jobInstanceId');
  console.log('  batch:job parameters verified:', jobParams);

  // batch:step parameters: name, acceptExpression, acceptPolicy
  const stepOp = await ExtensionCatalog.getOperationOrSourceModel('http://www.mulesoft.org/schema/mule/batch', 'step');
  assert(stepOp, 'batch:step model must be found');
  const stepParams = stepOp.groups.flatMap(g => g.parameters.map(p => p.name));
  assert(stepParams.includes('name'), 'step should have name');
  assert(stepParams.includes('acceptExpression'), 'step should have acceptExpression');
  assert(stepParams.includes('acceptPolicy'), 'step should have acceptPolicy');
  console.log('  batch:step parameters verified:', stepParams);

  // batch:aggregator parameters: size, streaming
  const aggOp = await ExtensionCatalog.getOperationOrSourceModel('http://www.mulesoft.org/schema/mule/batch', 'aggregator');
  assert(aggOp, 'batch:aggregator model must be found');
  const aggParams = aggOp.groups.flatMap(g => g.parameters.map(p => p.name));
  assert(aggParams.includes('size'), 'aggregator should have size');
  assert(aggParams.includes('streaming'), 'aggregator should have streaming');
  console.log('  batch:aggregator parameters verified:', aggParams);
  console.log('✓ Test 3 Passed: All required properties panel parameters are defined and accessible!');

  // Test 4: Top-Level batch:job XML handling
  console.log('Test 4: Verifying top-level <batch:job> under <mule>...');
  const topLevelXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:batch="http://www.mulesoft.org/schema/mule/batch">
  <batch:job jobName="TopLevelBatchJob">
    <batch:process-records>
      <batch:step name="StandaloneStep" />
    </batch:process-records>
  </batch:job>
</mule>`;
  const topParsed = MuleXmlParser.parse(topLevelXml);
  const topModel = SemanticModelBuilder.build(topParsed.root, 'top-batch.xml');
  assert.strictEqual(topModel.flows.length, 1, 'Top-level batch:job should be wrapped into a FlowModel');
  const topScene = layout(topModel);
  assert.strictEqual(topScene.flows.length, 1);
  assert.strictEqual(topScene.flows[0].chain[0].batchZones.processRecords.children.length, 1);
  console.log('✓ Test 4 Passed: Top-level batch:job renders cleanly as a visual canvas flow!');

  console.log('\n=============================================');
  console.log('ALL BATCH TESTS PASSED PERFECTLY!');
  console.log('=============================================\n');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
