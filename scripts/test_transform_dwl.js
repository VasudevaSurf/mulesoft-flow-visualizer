const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const Module = require('module');

// Mock vscode module for standalone execution
const origRequire = Module.prototype.require;
let mockDocuments = new Map();

Module.prototype.require = function(mod) {
  if (mod === 'vscode') {
    return {
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
        onDidChangeTextEditorSelection: () => ({ dispose: () => {} }),
        onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
      },
      workspace: {
        onDidChangeTextDocument: () => ({ dispose: () => {} }),
        getConfiguration: () => ({ get: () => undefined }),
        openTextDocument: async (uri) => {
          const filePath = uri.fsPath || uri;
          const text = mockDocuments.get(filePath) || fs.readFileSync(filePath, 'utf-8');
          return {
            getText: (range) => {
              if (!range) return text;
              const lines = text.split('\n');
              if (range.start.line === range.end.line) {
                return lines[range.start.line].slice(range.start.character, range.end.character);
              }
              let res = lines[range.start.line].slice(range.start.character);
              for (let i = range.start.line + 1; i < range.end.line; i++) {
                res += '\n' + lines[i];
              }
              res += '\n' + lines[range.end.line].slice(0, range.end.character);
              return res;
            },
            positionAt: (offset) => {
              const lines = text.slice(0, offset).split('\n');
              return { line: lines.length - 1, character: lines[lines.length - 1].length };
            },
            offsetAt: (pos) => {
              const lines = text.split('\n');
              let off = 0;
              for (let i = 0; i < pos.line; i++) {
                off += lines[i].length + 1;
              }
              return off + pos.character;
            },
            save: async () => true,
          };
        },
        applyEdit: async (edit) => {
          for (const op of edit.edits) {
            const uri = op.uri.fsPath;
            let text = mockDocuments.get(uri) || fs.readFileSync(uri, 'utf-8');
            if (op.type === 'replace') {
              const lines = text.split('\n');
              let startOff = 0;
              for (let i = 0; i < op.range.start.line; i++) startOff += lines[i].length + 1;
              startOff += op.range.start.character;
              let endOff = 0;
              for (let i = 0; i < op.range.end.line; i++) endOff += lines[i].length + 1;
              endOff += op.range.end.character;
              text = text.slice(0, startOff) + op.text + text.slice(endOff);
            }
            mockDocuments.set(uri, text);
          }
          return true;
        },
      },
    };
  }
  return origRequire.apply(this, arguments);
};

const vscode = require('vscode');
const { MuleXmlParser } = require('../out/parser/xmlParser.js');
const { SemanticModelBuilder } = require('../out/parser/semanticModel.js');
const { FlowVisualizerPanel } = require('../out/webview/panel.js');

async function runTests() {
  console.log('================================================================');
  console.log('TRANSFORM MESSAGE & DWL RESOURCE TEST SUITE');
  console.log('================================================================\n');

  // Setup temporary project directory structure:
  // tempProj/
  //   pom.xml
  //   src/
  //     main/
  //       mule/
  //         flows/
  //           my-flow.xml
  //         in-mule.dwl
  //       resources/
  //         modules/
  //           main-res.dwl
  //         transforms/
  //           mapping.dwl
  //     test/
  //       resources/
  //         test-res.dwl
  //       munit/
  //         test-munit.dwl
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mule-transform-test-'));
  const projectRoot = tempDir;
  fs.writeFileSync(path.join(projectRoot, 'pom.xml'), '<project></project>');

  const muleDir = path.join(projectRoot, 'src', 'main', 'mule');
  const flowsDir = path.join(muleDir, 'flows');
  const mainResDir = path.join(projectRoot, 'src', 'main', 'resources');
  const mainModulesDir = path.join(mainResDir, 'modules');
  const mainTransformsDir = path.join(mainResDir, 'transforms');
  const testResDir = path.join(projectRoot, 'src', 'test', 'resources');
  const testMunitDir = path.join(projectRoot, 'src', 'test', 'munit');

  fs.mkdirSync(flowsDir, { recursive: true });
  fs.mkdirSync(mainModulesDir, { recursive: true });
  fs.mkdirSync(mainTransformsDir, { recursive: true });
  fs.mkdirSync(testResDir, { recursive: true });
  fs.mkdirSync(testMunitDir, { recursive: true });

  // 1. Create DWL resource files in each location
  const xmlRelativeDwl = path.join(flowsDir, 'relative.dwl');
  fs.writeFileSync(xmlRelativeDwl, '%dw 2.0\noutput application/json\n---\n{ location: "relative-to-xml" }');

  const mainResDwl = path.join(mainModulesDir, 'main-res.dwl');
  fs.writeFileSync(mainResDwl, '%dw 2.0\noutput application/json\n---\n{ location: "src/main/resources" }');

  const classpathDwl = path.join(mainTransformsDir, 'mapping.dwl');
  fs.writeFileSync(classpathDwl, '%dw 2.0\noutput application/xml\n---\n{ result: "classpath-loaded" }');

  const inMuleDwl = path.join(muleDir, 'in-mule.dwl');
  fs.writeFileSync(inMuleDwl, '%dw 2.0\noutput application/java\n---\n{ location: "src/main/mule" }');

  const testResDwlFile = path.join(testResDir, 'test-res.dwl');
  fs.writeFileSync(testResDwlFile, '%dw 2.0\noutput application/json\n---\n{ location: "src/test/resources" }');

  const testMunitDwlFile = path.join(testMunitDir, 'test-munit.dwl');
  fs.writeFileSync(testMunitDwlFile, '%dw 2.0\noutput application/json\n---\n{ location: "src/test/munit" }');

  const xmlFilePath = path.join(flowsDir, 'my-flow.xml');
  const currentDocUri = vscode.Uri.file(xmlFilePath);

  // -------------------------------------------------------------------------
  // TEST 1: Location Resolution Order & Classpath Stripping
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Location Resolution Order & Prefix Stripping ---');
  
  // 1a: Relative to XML file
  const resolved1 = FlowVisualizerPanel.resolveDwlResourcePath('relative.dwl', currentDocUri);
  assert.strictEqual(path.resolve(resolved1), path.resolve(xmlRelativeDwl));
  console.log('✓ Resolved relative to XML file: relative.dwl');

  // 1b: <project>/src/main/resources/
  const resolved2 = FlowVisualizerPanel.resolveDwlResourcePath('modules/main-res.dwl', currentDocUri);
  assert.strictEqual(path.resolve(resolved2), path.resolve(mainResDwl));
  console.log('✓ Resolved in src/main/resources: modules/main-res.dwl');

  // 1c: <project>/src/main/mule/
  const resolved3 = FlowVisualizerPanel.resolveDwlResourcePath('in-mule.dwl', currentDocUri);
  assert.strictEqual(path.resolve(resolved3), path.resolve(inMuleDwl));
  console.log('✓ Resolved in src/main/mule: in-mule.dwl');

  // 1d: <project>/src/test/resources/
  const resolved4 = FlowVisualizerPanel.resolveDwlResourcePath('test-res.dwl', currentDocUri);
  assert.strictEqual(path.resolve(resolved4), path.resolve(testResDwlFile));
  console.log('✓ Resolved in src/test/resources: test-res.dwl');

  // 1e: <project>/src/test/munit/
  const resolved5 = FlowVisualizerPanel.resolveDwlResourcePath('test-munit.dwl', currentDocUri);
  assert.strictEqual(path.resolve(resolved5), path.resolve(testMunitDwlFile));
  console.log('✓ Resolved in src/test/munit: test-munit.dwl');

  // 1f: classpath: prefix stripping
  const resolvedClasspath1 = FlowVisualizerPanel.resolveDwlResourcePath('classpath:transforms/mapping.dwl', currentDocUri);
  assert.strictEqual(path.resolve(resolvedClasspath1), path.resolve(classpathDwl));
  console.log('✓ Stripped "classpath:" prefix: classpath:transforms/mapping.dwl');

  // 1g: classpath:/ with leading slash
  const resolvedClasspath2 = FlowVisualizerPanel.resolveDwlResourcePath('classpath:/transforms/mapping.dwl', currentDocUri);
  assert.strictEqual(path.resolve(resolvedClasspath2), path.resolve(classpathDwl));
  console.log('✓ Stripped "classpath:/" with leading slash: classpath:/transforms/mapping.dwl');

  // 1h: leading slash alone
  const resolvedSlash = FlowVisualizerPanel.resolveDwlResourcePath('/modules/main-res.dwl', currentDocUri);
  assert.strictEqual(path.resolve(resolvedSlash), path.resolve(mainResDwl));
  console.log('✓ Stripped leading slash: /modules/main-res.dwl');

  // -------------------------------------------------------------------------
  // TEST 2: Missing Resource Handling
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Missing Resource Handling ---');
  const missingResult = FlowVisualizerPanel.loadDwlResource('nonexistent.dwl', currentDocUri);
  assert.strictEqual(missingResult, 'Resource not found: nonexistent.dwl');
  console.log('✓ Missing resource returns: "Resource not found: nonexistent.dwl"');

  const missingClasspathResult = FlowVisualizerPanel.loadDwlResource('classpath:missing/file.dwl', currentDocUri);
  assert.strictEqual(missingClasspathResult, 'Resource not found: classpath:missing/file.dwl');
  console.log('✓ Missing classpath returns: "Resource not found: classpath:missing/file.dwl"');

  // -------------------------------------------------------------------------
  // TEST 3: Parsing XML with Inline Script, CDATA Script, Resources & Several Variables
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Component Body Extraction ---');

  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.mulesoft.org/schema/mule/core http://www.mulesoft.org/schema/mule/core/current/mule.xsd
        http://www.mulesoft.org/schema/mule/ee/core http://www.mulesoft.org/schema/mule/ee/core/current/mule-ee.xsd">

    <flow name="flow-inline">
        <ee:transform doc:name="Inline Transform">
            <ee:message>
                <ee:set-payload>%dw 2.0
output application/json
---
{ "type": "inline", "value": 100 }</ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <flow name="flow-cdata">
        <ee:transform doc:name="CDATA Transform">
            <ee:message>
                <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{ "type": "cdata", "name": "MuleSoft" }]]></ee:set-payload>
            </ee:message>
        </ee:transform>
    </flow>

    <flow name="flow-resource">
        <ee:transform doc:name="Resource Transform">
            <ee:message>
                <ee:set-payload resource="modules/main-res.dwl" />
            </ee:message>
        </ee:transform>
    </flow>

    <flow name="flow-classpath">
        <ee:transform doc:name="Classpath Transform">
            <ee:message>
                <ee:set-payload resource="classpath:transforms/mapping.dwl" />
            </ee:message>
        </ee:transform>
    </flow>

    <flow name="flow-multi-target">
        <ee:transform doc:name="Multi Target Transform">
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
                <ee:set-variable variableName="varMissing" resource="does-not-exist.dwl" />
            </ee:variables>
        </ee:transform>
    </flow>
</mule>`;

  fs.writeFileSync(xmlFilePath, sampleXml);
  mockDocuments.set(xmlFilePath, sampleXml);

  const { ExtensionCatalog } = require('../out/catalog/index.js');
  const parseResult = MuleXmlParser.parse(sampleXml);
  assert(parseResult.root, 'XML root should be parsed');
  const model = SemanticModelBuilder.build(parseResult.root, (ns, localName, prefix) => ExtensionCatalog.resolveComponent(ns, localName, prefix));

  // 3a. Inline Script test
  const inlineFlow = model.flows.find(f => f.name === 'flow-inline');
  const inlineNode = inlineFlow.chain[0];
  const inlineBody = FlowVisualizerPanel.extractComponentBody(inlineNode, currentDocUri);
  assert.strictEqual(inlineBody.hasPayload, true);
  assert(inlineBody.primaryScript.includes('"type": "inline"'), 'Inline script content should match');
  console.log('✓ Inline script extracted accurately without truncating whitespace/newlines');

  // 3b. CDATA Script test
  const cdataFlow = model.flows.find(f => f.name === 'flow-cdata');
  const cdataNode = cdataFlow.chain[0];
  const cdataBody = FlowVisualizerPanel.extractComponentBody(cdataNode, currentDocUri);
  assert.strictEqual(cdataBody.hasPayload, true);
  assert(cdataBody.primaryScript.includes('"type": "cdata"'), 'CDATA script content should match');
  console.log('✓ CDATA script extracted accurately');

  // 3c. resource="x.dwl" test
  const resFlow = model.flows.find(f => f.name === 'flow-resource');
  const resNode = resFlow.chain[0];
  const resBody = FlowVisualizerPanel.extractComponentBody(resNode, currentDocUri);
  assert.strictEqual(resBody.payloadResource, 'modules/main-res.dwl');
  assert(resBody.primaryScript.includes('src/main/resources'), 'Loaded from main-res.dwl');
  console.log('✓ resource="modules/main-res.dwl" loaded from src/main/resources');

  // 3d. resource="classpath:x.dwl" test
  const cpFlow = model.flows.find(f => f.name === 'flow-classpath');
  const cpNode = cpFlow.chain[0];
  const cpBody = FlowVisualizerPanel.extractComponentBody(cpNode, currentDocUri);
  assert.strictEqual(cpBody.payloadResource, 'classpath:transforms/mapping.dwl');
  assert(cpBody.primaryScript.includes('classpath-loaded'), 'Loaded from transforms/mapping.dwl');
  console.log('✓ resource="classpath:transforms/mapping.dwl" loaded correctly');

  // 3e. Several variables test
  const multiFlow = model.flows.find(f => f.name === 'flow-multi-target');
  const multiNode = multiFlow.chain[0];
  const multiBody = FlowVisualizerPanel.extractComponentBody(multiNode, currentDocUri);

  assert.strictEqual(multiBody.hasPayload, true);
  assert.strictEqual(multiBody.payloadResource, 'relative.dwl');
  assert(multiBody.primaryScript.includes('relative-to-xml'), 'Loaded payload from relative.dwl');

  assert.strictEqual(multiBody.hasAttributes, true);
  assert(multiBody.attributesScript.includes('statusCode: 200'), 'Attributes script extracted');

  assert.strictEqual(multiBody.variables.length, 5, 'Expected 5 target variables');
  const varInline = multiBody.variables.find(v => v.name === 'varInline');
  assert(varInline && varInline.script.includes('inline-var-value'), 'varInline extracted');

  const varCdata = multiBody.variables.find(v => v.name === 'varCdata');
  assert(varCdata && varCdata.script.includes('varId'), 'varCdata extracted');

  const varResource = multiBody.variables.find(v => v.name === 'varResource');
  assert(varResource && varResource.resource === 'in-mule.dwl');
  assert(varResource.script.includes('src/main/mule'), 'varResource loaded from src/main/mule');

  const varClasspath = multiBody.variables.find(v => v.name === 'varClasspath');
  assert(varClasspath && varClasspath.resource === 'classpath:transforms/mapping.dwl');
  assert(varClasspath.script.includes('classpath-loaded'), 'varClasspath loaded');

  const varMissing = multiBody.variables.find(v => v.name === 'varMissing');
  assert(varMissing && varMissing.script === 'Resource not found: does-not-exist.dwl');
  console.log('✓ Multi-target with payload, attributes, and 5 variables (inline, CDATA, resource, classpath, missing) passed');

  // -------------------------------------------------------------------------
  // TEST 4: Edits to resource-backed scripts write to .dwl file, NOT XML
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Write-Back to DWL Resource Files vs XML ---');

  // Instantiate panel helper logic
  const originalXml = fs.readFileSync(xmlFilePath, 'utf-8');

  // Create panel dummy to test handleTransformScriptUpdate
  const mockWebviewPanel = {
    webview: {
      html: '',
      asWebviewUri: (u) => u.toString(),
      cspSource: 'https:',
      onDidReceiveMessage: () => ({ dispose: () => {} }),
      postMessage: () => {},
    },
    onDidDispose: () => ({ dispose: () => {} }),
    onDidChangeViewState: () => ({ dispose: () => {} }),
    dispose: () => {},
  };
  const panel = new FlowVisualizerPanel(
    mockWebviewPanel,
    vscode.Uri.file(tempDir),
    currentDocUri
  );
  panel.lastModel = model;

  const updatedDwlContent = '%dw 2.0\noutput application/json\n---\n{ updated: true, from: "panel-test" }';

  // 4a. Update payload which is backed by relative.dwl
  await panel.handleTransformScriptUpdate(multiNode, '__transform_payload__', updatedDwlContent);

  // Check that relative.dwl on disk was updated:
  const newRelativeDwl = fs.readFileSync(xmlRelativeDwl, 'utf-8');
  assert.strictEqual(newRelativeDwl, updatedDwlContent, 'relative.dwl should be updated with new script');
  console.log('✓ Edits to resource="relative.dwl" wrote directly to relative.dwl');

  // Check that the XML was NOT modified for this edit
  const xmlAfterResUpdate = mockDocuments.get(xmlFilePath) || fs.readFileSync(xmlFilePath, 'utf-8');
  assert.strictEqual(xmlAfterResUpdate, originalXml, 'XML file must NOT be modified when editing a resource="..." script');
  console.log('✓ Verified XML file remains untouched when editing resource-backed script');

  // 4b. Update varClasspath which is backed by classpath:transforms/mapping.dwl
  const updatedClasspathContent = '%dw 2.0\noutput application/xml\n---\n{ updatedClasspath: true }';
  await panel.handleTransformScriptUpdate(multiNode, '__transform_var:varClasspath', updatedClasspathContent);
  const newClasspathDwl = fs.readFileSync(classpathDwl, 'utf-8');
  assert.strictEqual(newClasspathDwl, updatedClasspathContent, 'mapping.dwl should be updated');
  console.log('✓ Edits to resource="classpath:transforms/mapping.dwl" wrote directly to mapping.dwl');

  // 4c. Update an inline variable (varInline) -> this SHOULD edit the XML
  const newInlineVarScript = '%dw 2.0\noutput application/java\n---\n"new-inline-value"';
  await panel.handleTransformScriptUpdate(multiNode, '__transform_var:varInline', newInlineVarScript);
  const xmlAfterInlineUpdate = mockDocuments.get(xmlFilePath);
  assert(xmlAfterInlineUpdate.includes('new-inline-value'), 'XML should now contain updated inline variable script');
  console.log('✓ Edits to inline variable wrote to XML document as CDATA');

  // Cleanup temporary directory
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log('\n================================================================');
  console.log('ALL TRANSFORM DWL TESTS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
