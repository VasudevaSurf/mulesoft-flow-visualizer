import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { MuleXmlParser } from '../src/parser/xmlParser';
import { SemanticModelBuilder } from '../src/parser/semanticModel';
import { FlowVisualizerPanel } from '../src/webview/panel';
import { ExtensionCatalog } from '../src/catalog';

describe('Transform Message & DWL Resource Tests', () => {
  let tempDir: string;
  let xmlFilePath: string;
  let currentDocUri: vscode.Uri;
  let xmlRelativeDwl: string;
  let mainResDwl: string;
  let classpathDwl: string;
  let inMuleDwl: string;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mule-transform-test-'));
    fs.writeFileSync(path.join(tempDir, 'pom.xml'), '<project></project>');

    const muleDir = path.join(tempDir, 'src', 'main', 'mule');
    const flowsDir = path.join(muleDir, 'flows');
    const mainResDir = path.join(tempDir, 'src', 'main', 'resources');
    const mainModulesDir = path.join(mainResDir, 'modules');
    const mainTransformsDir = path.join(mainResDir, 'transforms');
    const testResDir = path.join(tempDir, 'src', 'test', 'resources');
    const testMunitDir = path.join(tempDir, 'src', 'test', 'munit');

    fs.mkdirSync(flowsDir, { recursive: true });
    fs.mkdirSync(mainModulesDir, { recursive: true });
    fs.mkdirSync(mainTransformsDir, { recursive: true });
    fs.mkdirSync(testResDir, { recursive: true });
    fs.mkdirSync(testMunitDir, { recursive: true });

    xmlRelativeDwl = path.join(flowsDir, 'relative.dwl');
    fs.writeFileSync(xmlRelativeDwl, '%dw 2.0\noutput application/json\n---\n{ location: "relative-to-xml" }');

    mainResDwl = path.join(mainModulesDir, 'main-res.dwl');
    fs.writeFileSync(mainResDwl, '%dw 2.0\noutput application/json\n---\n{ location: "src/main/resources" }');

    classpathDwl = path.join(mainTransformsDir, 'mapping.dwl');
    fs.writeFileSync(classpathDwl, '%dw 2.0\noutput application/xml\n---\n{ result: "classpath-loaded" }');

    inMuleDwl = path.join(muleDir, 'in-mule.dwl');
    fs.writeFileSync(inMuleDwl, '%dw 2.0\noutput application/java\n---\n{ location: "src/main/mule" }');

    xmlFilePath = path.join(flowsDir, 'my-flow.xml');
    currentDocUri = vscode.Uri.file(xmlFilePath);
  });

  after(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('1. Inline script: extracts full multi-line DataWeave script without truncation', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core">
    <flow name="flow-inline">
        <ee:transform>
            <ee:message>
                <ee:set-payload>%dw 2.0
output application/json
---
{ "type": "inline", "value": 100 }</ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>
</mule>`;
    const parseResult = MuleXmlParser.parse(xml);
    assert(parseResult.root, 'XML root should be parsed');
    const model = SemanticModelBuilder.build(parseResult.root, (ns, localName, prefix) =>
      ExtensionCatalog.resolveComponent(ns, localName, prefix)
    );
    const flow = model.flows[0];
    const node = flow.chain[0];
    const body = FlowVisualizerPanel.extractComponentBody(node, currentDocUri);
    assert.strictEqual(body.hasPayload, true);
    assert(body.primaryScript && body.primaryScript.includes('"type": "inline"'));
  });

  it('2. CDATA script: extracts CDATA payload script correctly', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core">
    <flow name="flow-cdata">
        <ee:transform>
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{ "type": "cdata", "name": "MuleSoft" }]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>
</mule>`;
    const parseResult = MuleXmlParser.parse(xml);
    assert(parseResult.root, 'XML root should be parsed');
    const model = SemanticModelBuilder.build(parseResult.root, (ns, localName, prefix) =>
      ExtensionCatalog.resolveComponent(ns, localName, prefix)
    );
    const flow = model.flows[0];
    const node = flow.chain[0];
    const body = FlowVisualizerPanel.extractComponentBody(node, currentDocUri);
    assert.strictEqual(body.hasPayload, true);
    assert(body.primaryScript && body.primaryScript.includes('"type": "cdata"'));
  });

  it('3. resource="x.dwl": resolves relative to XML and in src/main/resources/', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core">
    <flow name="flow-res">
        <ee:transform>
            <ee:message>
                <ee:set-payload resource="modules/main-res.dwl" />
            </ee:message>
        </ee:transform>
    </flow>
</mule>`;
    const parseResult = MuleXmlParser.parse(xml);
    assert(parseResult.root, 'XML root should be parsed');
    const model = SemanticModelBuilder.build(parseResult.root, (ns, localName, prefix) =>
      ExtensionCatalog.resolveComponent(ns, localName, prefix)
    );
    const flow = model.flows[0];
    const node = flow.chain[0];
    const body = FlowVisualizerPanel.extractComponentBody(node, currentDocUri);
    assert.strictEqual(body.payloadResource, 'modules/main-res.dwl');
    assert(body.primaryScript && body.primaryScript.includes('src/main/resources'));
  });

  it('4. resource="classpath:x.dwl": strips classpath: prefix and leading slash', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core">
    <flow name="flow-cp">
        <ee:transform>
            <ee:message>
                <ee:set-payload resource="classpath:transforms/mapping.dwl" />
            </ee:message>
        </ee:transform>
    </flow>
</mule>`;
    const parseResult = MuleXmlParser.parse(xml);
    assert(parseResult.root, 'XML root should be parsed');
    const model = SemanticModelBuilder.build(parseResult.root, (ns, localName, prefix) =>
      ExtensionCatalog.resolveComponent(ns, localName, prefix)
    );
    const flow = model.flows[0];
    const node = flow.chain[0];
    const body = FlowVisualizerPanel.extractComponentBody(node, currentDocUri);
    assert.strictEqual(body.payloadResource, 'classpath:transforms/mapping.dwl');
    assert(body.primaryScript && body.primaryScript.includes('classpath-loaded'));
  });

  it('5. Missing resource shows "Resource not found: <path>"', () => {
    const missing = FlowVisualizerPanel.loadDwlResource('nonexistent.dwl', currentDocUri);
    assert.strictEqual(missing, 'Resource not found: nonexistent.dwl');

    const missingCp = FlowVisualizerPanel.loadDwlResource('classpath:nonexistent.dwl', currentDocUri);
    assert.strictEqual(missingCp, 'Resource not found: classpath:nonexistent.dwl');
  });

  it('6. Several variables: parses multiple ee:set-variable tags with inline, CDATA, and resources', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core">
    <flow name="flow-vars">
        <ee:transform>
            <ee:message>
                <ee:set-payload resource="relative.dwl" />
                <ee:set-attributes><![CDATA[%dw 2.0
output application/java
---
{ statusCode: 200 }]]></ee:set-attributes>
            </ee:message>
            <ee:variables>
                <ee:set-variable variableName="varInline">%dw 2.0
output application/java
---
"inline-var-value"</ee:set-variable>
                <ee:set-variable variableName="varCdata"><![CDATA[%dw 2.0
output application/json
---
{ "varId": 123 }]]></ee:set-variable>
                <ee:set-variable variableName="varResource" resource="in-mule.dwl" />
                <ee:set-variable variableName="varClasspath" resource="classpath:transforms/mapping.dwl" />
            </ee:variables>
        </ee:transform>
    </flow>
</mule>`;
    const parseResult = MuleXmlParser.parse(xml);
    assert(parseResult.root, 'XML root should be parsed');
    const model = SemanticModelBuilder.build(parseResult.root, (ns, localName, prefix) =>
      ExtensionCatalog.resolveComponent(ns, localName, prefix)
    );
    const flow = model.flows[0];
    const node = flow.chain[0];
    const body = FlowVisualizerPanel.extractComponentBody(node, currentDocUri);

    assert.strictEqual(body.hasPayload, true);
    assert.strictEqual(body.payloadResource, 'relative.dwl');
    assert.strictEqual(body.hasAttributes, true);
    assert.strictEqual(body.variables.length, 4);

    const v1 = body.variables.find((v) => v.name === 'varInline');
    assert(v1 && v1.script.includes('inline-var-value'));

    const v2 = body.variables.find((v) => v.name === 'varCdata');
    assert(v2 && v2.script.includes('varId'));

    const v3 = body.variables.find((v) => v.name === 'varResource');
    assert(v3 && v3.resource === 'in-mule.dwl');
    assert(v3 && v3.script.includes('src/main/mule'));

    const v4 = body.variables.find((v) => v.name === 'varClasspath');
    assert(v4 && v4.resource === 'classpath:transforms/mapping.dwl');
    assert(v4 && v4.script.includes('classpath-loaded'));
  });
});
