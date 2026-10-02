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
    createOutputChannel: () => ({ appendLine: () => {} }),
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
        lineCount: text.split('\n').length,
        lineAt: (lineNum) => {
          const lines = text.split('\n');
          const lineText = lines[lineNum] || '';
          return {
            text: lineText,
            range: {
              start: { line: lineNum, character: 0 },
              end: { line: lineNum, character: lineText.length },
            },
          };
        },
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
        } else if (op.type === 'insert') {
          const lines = text.split('\n');
          let off = 0;
          for (let i = 0; i < op.pos.line; i++) off += lines[i].length + 1;
          off += op.pos.character;
          text = text.slice(0, off) + op.text + text.slice(off);
        } else if (op.type === 'delete') {
          const lines = text.split('\n');
          let startOff = 0;
          for (let i = 0; i < op.range.start.line; i++) startOff += lines[i].length + 1;
          startOff += op.range.start.character;
          let endOff = 0;
          for (let i = 0; i < op.range.end.line; i++) endOff += lines[i].length + 1;
          endOff += op.range.end.character;
          text = text.slice(0, startOff) + text.slice(endOff);
        }
        mockDocuments.set(uri, text);
        fs.writeFileSync(uri, text, 'utf-8');
      }
      return true;
    },
  },
};

const origRequire = Module.prototype.require;
Module.prototype.require = function(mod) {
  if (mod === 'vscode') {
    return mockVscode;
  }
  return origRequire.apply(this, arguments);
};

const { MuleXmlParser } = require('../out/parser/xmlParser');
const { SemanticModelBuilder } = require('../out/parser/semanticModel');
const { FlowVisualizerPanel } = require('../out/webview/panel');
const { ExtensionCatalog } = require('../out/catalog');

async function runChoiceTests() {
  console.log('================================================================');
  console.log('STARTING CHOICE ROUTER & WHEN EXPRESSION TESTS');
  console.log('================================================================');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mule-choice-test-'));
  const testXmlPath = path.join(tempDir, 'choice-flow.xml');
  const testDocUri = mockVscode.Uri.file(testXmlPath);

  // Helper to build model
  function parseAndBuild(xml) {
    const parseResult = MuleXmlParser.parse(xml);
    assert(parseResult.root, 'XML root should parse');
    return SemanticModelBuilder.build(parseResult.root, (ns, localName, prefix) =>
      ExtensionCatalog.resolveComponent(ns, localName, prefix)
    );
  }

  // -------------------------------------------------------------------------
  // TEST 1: XML escaping for <, >, &&, and quotes
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 1: XML Escaping of <, >, &&, and quotes ---');
  {
    assert.strictEqual(FlowVisualizerPanel.escapeXml('payload < 10'), 'payload &lt; 10');
    assert.strictEqual(FlowVisualizerPanel.escapeXml('payload > 10'), 'payload &gt; 10');
    assert.strictEqual(FlowVisualizerPanel.escapeXml('payload.a && payload.b'), 'payload.a &amp;&amp; payload.b');
    assert.strictEqual(
      FlowVisualizerPanel.escapeXml('payload.age > 21 && payload.age < 65 && payload.name == "admin"'),
      'payload.age &gt; 21 &amp;&amp; payload.age &lt; 65 &amp;&amp; payload.name == &quot;admin&quot;'
    );
    // Already escaped entities should not be double-escaped
    assert.strictEqual(
      FlowVisualizerPanel.escapeXml('payload.age &gt; 21 &amp;&amp; payload.age &lt; 65'),
      'payload.age &gt; 21 &amp;&amp; payload.age &lt; 65'
    );
    console.log('✓ escapeXml correctly handles <, >, &&, quotes and prevents double escaping');
  }

  // -------------------------------------------------------------------------
  // TEST 2: Edit when expression in XML (keeping #[ ] wrapping, quotes escaping)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Edit When Expression in XML ---');
  {
    const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation">
    <flow name="choiceFlow">
        <choice doc:name="Choice">
            <when expression="#[payload != null]">
                <logger level="INFO" message="Payload is not null" />
            </when>
            <otherwise>
                <logger level="INFO" message="Default" />
            </otherwise>
        </choice>
    </flow>
</mule>`;

    fs.writeFileSync(testXmlPath, initialXml, 'utf-8');
    mockDocuments.set(testXmlPath, initialXml);

    let model = parseAndBuild(initialXml);
    const choiceNode = model.flows[0].chain[0];
    assert.strictEqual(choiceNode.descriptor.localName, 'choice');
    assert.strictEqual(choiceNode.routes.length, 2);
    const whenRoute = choiceNode.routes[0];
    assert.strictEqual(whenRoute.kind, 'when');
    assert.strictEqual(whenRoute.attributes['expression'], '#[payload != null]');

    // Edit expression with expression containing <, >, and && without #[ ] wrapper
    const newExprRaw = 'payload.amount > 100 && payload.discount < 50 && payload.type == "VIP"';
    const updatedXml = FlowVisualizerPanel.updateExpressionInXml(initialXml, whenRoute.range, newExprRaw);

    // Verify it updated only that attribute, kept #[ ] wrapping, escaped <, >, &&, quotes
    assert(updatedXml.includes('expression="#[payload.amount &gt; 100 &amp;&amp; payload.discount &lt; 50 &amp;&amp; payload.type == &quot;VIP&quot;]"'),
      'Expression attribute should be rewritten with #[ ] wrapping and XML escaping');
    assert(updatedXml.includes('<logger level="INFO" message="Payload is not null" />'), 'Inner logger preserved');
    assert(updatedXml.includes('<otherwise>'), 'Otherwise route preserved');

    // Re-parse updated XML and verify semantic model
    const newModel = parseAndBuild(updatedXml);
    const updatedChoice = newModel.flows[0].chain[0];
    const updatedWhen = updatedChoice.routes[0];
    assert.strictEqual(updatedWhen.kind, 'when');
    // Parser decodes entities, so attribute value in model has unescaped characters
    assert(updatedWhen.attributes['expression'].includes('payload.amount > 100'));
    assert(updatedWhen.attributes['expression'].includes('&&'));
    assert(updatedWhen.attributes['expression'].includes('payload.discount < 50'));
    assert(updatedWhen.attributes['expression'].startsWith('#['));
    assert(updatedWhen.attributes['expression'].endsWith(']'));
    console.log('✓ Editing expression rewrites only the attribute in XML, preserving #[ ] wrapping and escaping <, >, &&');
  }

  function createMockPanel() {
    return {
      webview: {
        html: '',
        asWebviewUri: (u) => u,
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        postMessage: () => {},
      },
      onDidDispose: () => ({ dispose: () => {} }),
      onDidChangeViewState: () => ({ dispose: () => {} }),
      dispose: () => {},
    };
  }

  // -------------------------------------------------------------------------
  // TEST 3: Edit expression via FlowVisualizerPanel instance (workspace edit)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Edit Expression via handleUpdateParameterValue ---');
  {
    const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core">
    <flow name="flow1">
        <choice>
            <when expression="#[payload == 1]">
                <set-payload value="one" />
            </when>
            <otherwise>
                <set-payload value="default" />
            </otherwise>
        </choice>
    </flow>
</mule>`;

    fs.writeFileSync(testXmlPath, initialXml, 'utf-8');
    mockDocuments.set(testXmlPath, initialXml);

    const panelInstance = new FlowVisualizerPanel(createMockPanel(), mockVscode.Uri.file(tempDir), testDocUri);
    panelInstance.currentDocUri = testDocUri;
    panelInstance.lastModel = parseAndBuild(initialXml);

    const choiceNode = panelInstance.lastModel.flows[0].chain[0];
    const whenRoute = choiceNode.routes[0];

    // Send update with complex condition containing < and &&
    await panelInstance.handleUpdateParameterValue({
      nodeId: whenRoute.id,
      paramName: 'expression',
      value: 'payload.val < 10 && payload.active == true',
      dataType: 'dataweave',
    });

    const savedXml = fs.readFileSync(testXmlPath, 'utf-8');
    assert(savedXml.includes('expression="#[payload.val &lt; 10 &amp;&amp; payload.active == true]"'),
      'Saved XML should contain escaped expression wrapped in #[]');
    console.log('✓ handleUpdateParameterValue correctly modifies XML document and saves it');
  }

  // -------------------------------------------------------------------------
  // TEST 4: Delete route in choice router
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Delete Route in Choice Router ---');
  {
    const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core">
    <flow name="flowDelete">
        <choice>
            <when expression="#[payload == 'toDelete']">
                <logger message="delete me" />
            </when>
            <when expression="#[payload == 'keep']">
                <logger message="keep me" />
            </when>
            <otherwise>
                <logger message="default" />
            </otherwise>
        </choice>
    </flow>
</mule>`;

    fs.writeFileSync(testXmlPath, initialXml, 'utf-8');
    mockDocuments.set(testXmlPath, initialXml);

    let model = parseAndBuild(initialXml);
    let choiceNode = model.flows[0].chain[0];
    assert.strictEqual(choiceNode.routes.length, 3);
    const routeToDelete = choiceNode.routes[0];

    // 1. Test pure function deleteRouteInXml
    const xmlAfterDelete = FlowVisualizerPanel.deleteRouteInXml(initialXml, routeToDelete.range);
    assert(!xmlAfterDelete.includes("payload == 'toDelete'"), 'Deleted route must not appear in XML');
    assert(xmlAfterDelete.includes("payload == 'keep'"), 'Remaining route must appear in XML');
    assert(xmlAfterDelete.includes('<otherwise>'), 'Otherwise route must appear in XML');

    const modelAfterDelete = parseAndBuild(xmlAfterDelete);
    assert.strictEqual(modelAfterDelete.flows[0].chain[0].routes.length, 2);
    assert.strictEqual(modelAfterDelete.flows[0].chain[0].routes[0].attributes['expression'], "#[payload == 'keep']");

    // 2. Test panelInstance.handleDeleteRoute
    const panelInstance = new FlowVisualizerPanel(createMockPanel(), mockVscode.Uri.file(tempDir), testDocUri);
    panelInstance.currentDocUri = testDocUri;
    panelInstance.lastModel = model;

    await panelInstance.handleDeleteRoute(routeToDelete.id);
    const savedXml = fs.readFileSync(testXmlPath, 'utf-8');
    assert(!savedXml.includes("payload == 'toDelete'"), 'Workspace edit delete should remove when branch');
    assert(savedXml.includes("payload == 'keep'"), 'Kept route preserved');
    console.log('✓ Delete route removes targeted when branch and preserves remaining routes');
  }

  // -------------------------------------------------------------------------
  // TEST 5: Reorder routes (move up / down)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Reorder Routes (Move Up/Down) ---');
  {
    const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core">
    <flow name="flowReorder">
        <choice>
            <when expression="#[payload == 'A']">
                <logger message="A" />
            </when>
            <when expression="#[payload == 'B']">
                <logger message="B" />
            </when>
            <when expression="#[payload == 'C']">
                <logger message="C" />
            </when>
            <otherwise>
                <logger message="default" />
            </otherwise>
        </choice>
    </flow>
</mule>`;

    fs.writeFileSync(testXmlPath, initialXml, 'utf-8');
    mockDocuments.set(testXmlPath, initialXml);

    let model = parseAndBuild(initialXml);
    let choiceNode = model.flows[0].chain[0];
    assert.strictEqual(choiceNode.routes.length, 4);

    const routeA = choiceNode.routes[0];
    const routeB = choiceNode.routes[1];

    // 1. Test pure function reorderChoiceRoutesInXml (swap 0 and 1)
    const xmlAfterSwap = FlowVisualizerPanel.reorderChoiceRoutesInXml(initialXml, routeA.range, routeB.range);
    const modelAfterSwap = parseAndBuild(xmlAfterSwap);
    const swappedChoice = modelAfterSwap.flows[0].chain[0];

    assert.strictEqual(swappedChoice.routes[0].attributes['expression'], "#[payload == 'B']");
    assert.strictEqual(swappedChoice.routes[1].attributes['expression'], "#[payload == 'A']");
    assert.strictEqual(swappedChoice.routes[2].attributes['expression'], "#[payload == 'C']");
    assert.strictEqual(swappedChoice.routes[3].kind, 'otherwise');

    // 2. Test panelInstance.handleReorderChoiceRoutes (move Route 1 down -> swap with Route 2)
    const panelInstance = new FlowVisualizerPanel(createMockPanel(), mockVscode.Uri.file(tempDir), testDocUri);
    panelInstance.currentDocUri = testDocUri;
    panelInstance.lastModel = model;

    // Swap index 1 (B) with index 2 (C)
    await panelInstance.handleReorderChoiceRoutes(choiceNode.id, 1, 2);
    const savedXml = fs.readFileSync(testXmlPath, 'utf-8');
    const finalModel = parseAndBuild(savedXml);
    const finalChoice = finalModel.flows[0].chain[0];

    assert.strictEqual(finalChoice.routes[0].attributes['expression'], "#[payload == 'A']");
    assert.strictEqual(finalChoice.routes[1].attributes['expression'], "#[payload == 'C']");
    assert.strictEqual(finalChoice.routes[2].attributes['expression'], "#[payload == 'B']");
    assert.strictEqual(finalChoice.routes[3].kind, 'otherwise');
    console.log('✓ Reorder route swaps branches correctly and keeps otherwise route intact');
  }

  // Cleanup
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n================================================================');
  console.log('ALL CHOICE ROUTER TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runChoiceTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
