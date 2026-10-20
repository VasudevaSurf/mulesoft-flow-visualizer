import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { MuleXmlParser } from '../src/parser/xmlParser';
import { SemanticModelBuilder } from '../src/parser/semanticModel';
import { FlowVisualizerPanel } from '../src/webview/panel';
import { mockDocuments } from './setup';

describe('Edit Round Trip Tests (Properties Panel Code Path)', () => {
  let tempDir: string;
  let xmlFilePath: string;
  let fileUri: vscode.Uri;
  let extensionUri: vscode.Uri;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mule-roundtrip-test-'));
    xmlFilePath = path.join(tempDir, 'roundtrip-flow.xml');
    fileUri = vscode.Uri.file(xmlFilePath);
    extensionUri = vscode.Uri.file(path.resolve(__dirname, '..'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
    mockDocuments.clear();
  });

  it('1. Updates standard attribute through panel code path and asserts XML differs only in that value', async () => {
    const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd">
    <flow name="sampleFlow" doc:id="flow-101">
        <logger level="INFO" message="Original greeting message" doc:name="My Logger" />
    </flow>
</mule>`;

    fs.writeFileSync(xmlFilePath, initialXml, 'utf-8');
    mockDocuments.set(xmlFilePath, initialXml);

    const panel = FlowVisualizerPanel.createOrShow(extensionUri, fileUri);
    await panel.loadDocument(fileUri);

    assert(panel.lastModel, 'Semantic model should be built');
    const flow = panel.lastModel!.flows[0];
    const loggerNode = flow.chain[0];
    assert.strictEqual(loggerNode.descriptor.localName, 'logger');
    assert.strictEqual(loggerNode.attributes['message'], 'Original greeting message');

    const updatedValue = 'Updated greeting message for test';

    // Dispatch update through the exact same code path the Properties panel uses
    await panel.handleWebviewMessage({
      type: 'updateParameterValue',
      nodeId: loggerNode.id,
      paramName: 'message',
      value: updatedValue,
    });

    // Read updated XML content
    const updatedDoc = await vscode.workspace.openTextDocument(fileUri);
    const updatedXml = updatedDoc.getText();

    // 1. Assert updated XML contains new value
    assert(
      updatedXml.includes(`message="${updatedValue}"`),
      `Updated XML should contain new message attribute: ${updatedXml}`
    );

    // 2. Assert replacing the edited value in updatedXml recovers original XML 100% byte-for-byte
    const revertedXml = updatedXml.replace(
      `message="${updatedValue}"`,
      `message="Original greeting message"`
    );
    assert.strictEqual(
      revertedXml,
      initialXml,
      'XML must differ ONLY in the updated value; all other tags, attributes, and whitespace must be identical'
    );
  });

  it('2. Updates expression attribute with <, >, &&, and quotes, asserting exact escaping and minimal diff', async () => {
    const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation">
    <flow name="choiceFlow" doc:id="flow-choice-1">
        <choice doc:name="Choice Router">
            <when expression="#[payload != null]">
                <set-payload value="OK" doc:name="Set OK" />
            </when>
            <otherwise>
                <set-payload value="Fallback" doc:name="Set Fallback" />
            </otherwise>
        </choice>
    </flow>
</mule>`;

    fs.writeFileSync(xmlFilePath, initialXml, 'utf-8');
    mockDocuments.set(xmlFilePath, initialXml);

    const panel = FlowVisualizerPanel.createOrShow(extensionUri, fileUri);
    await panel.loadDocument(fileUri);

    const choiceNode = panel.lastModel!.flows[0].chain[0];
    const whenRoute = choiceNode.routes[0];
    assert.strictEqual(whenRoute.kind, 'when');

    // User types in DataWeave expression containing <, >, &&, and quotes without #[ ] wrapper
    const newExpr = 'payload.score > 50 && payload.score < 100 && payload.tier == "GOLD"';

    await panel.handleWebviewMessage({
      type: 'updateParameterValue',
      nodeId: whenRoute.id,
      paramName: 'expression',
      value: newExpr,
    });

    const updatedDoc = await vscode.workspace.openTextDocument(fileUri);
    const updatedXml = updatedDoc.getText();

    const expectedEscapedAttr = 'expression="#[payload.score &gt; 50 &amp;&amp; payload.score &lt; 100 &amp;&amp; payload.tier == &quot;GOLD&quot;]"';
    assert(
      updatedXml.includes(expectedEscapedAttr),
      `Updated XML must have properly escaped & wrapped expression: ${updatedXml}`
    );

    // Reverting only that expression attribute yields original XML exactly
    const revertedXml = updatedXml.replace(expectedEscapedAttr, 'expression="#[payload != null]"');
    assert.strictEqual(
      revertedXml,
      initialXml,
      'XML must differ ONLY in the updated expression attribute'
    );
  });

  it('3. Updates MUnit child element value (<munit:payload>) through panel code path', async () => {
    const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:munit="http://www.mulesoft.org/schema/mule/munit"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation">
    <munit:test name="orderTest" doc:id="test-1">
        <munit:behavior>
            <munit:set-event doc:name="Set Initial Event">
                <munit:payload value="#['old_data']" mediaType="application/json" />
            </munit:set-event>
        </munit:behavior>
    </munit:test>
</mule>`;

    fs.writeFileSync(xmlFilePath, initialXml, 'utf-8');
    mockDocuments.set(xmlFilePath, initialXml);

    const panel = FlowVisualizerPanel.createOrShow(extensionUri, fileUri);
    await panel.loadDocument(fileUri);

    const testFlow = panel.lastModel!.flows[0];
    const setEventNode = testFlow.munitZones!.behavior.chain[0];
    assert.strictEqual(setEventNode.descriptor.localName, 'set-event');

    const newPayloadExpr = "{ 'orderId': 'ORD-12345' }";

    await panel.handleWebviewMessage({
      type: 'updateParameterValue',
      nodeId: setEventNode.id,
      paramName: 'payload',
      value: newPayloadExpr,
    });

    const updatedDoc = await vscode.workspace.openTextDocument(fileUri);
    const updatedXml = updatedDoc.getText();

    assert(
      updatedXml.includes(`value="#[{ 'orderId': 'ORD-12345' }]"`),
      `Updated XML should have updated munit:payload value: ${updatedXml}`
    );

    // Reverting that single value recovers the initial XML
    const revertedXml = updatedXml.replace(`value="#[{ 'orderId': 'ORD-12345' }]"`, `value="#['old_data']"`);
    assert.strictEqual(
      revertedXml,
      initialXml,
      'XML must differ ONLY in the edited munit payload value'
    );
  });
});
