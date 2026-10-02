import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { MuleXmlParser } from '../src/parser/xmlParser';
import { SemanticModelBuilder } from '../src/parser/semanticModel';
import { FlowVisualizerPanel } from '../src/webview/panel';
import { ExtensionCatalog } from '../src/catalog';

describe('Choice Router & When Expression Tests', () => {
  let tempDir: string;
  let xmlFilePath: string;
  let currentDocUri: vscode.Uri;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mule-choice-test-'));
    xmlFilePath = path.join(tempDir, 'choice-flow.xml');
    currentDocUri = vscode.Uri.file(xmlFilePath);
  });

  after(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  function parseAndBuild(xml: string) {
    const parseResult = MuleXmlParser.parse(xml);
    assert(parseResult.root, 'XML root should be parsed');
    return SemanticModelBuilder.build(parseResult.root, (ns, localName, prefix) =>
      ExtensionCatalog.resolveComponent(ns, localName, prefix)
    );
  }

  it('1. XML escaping correctly handles <, >, &&, quotes and prevents double escaping', () => {
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
  });

  it('2. Edit when expression: rewrites only that attribute in XML, keeping #[ ] wrapping and other formatting', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation">
    <flow name="testFlow">
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

    const model = parseAndBuild(xml);
    const choiceNode = model.flows[0].chain[0];
    assert.strictEqual(choiceNode.descriptor.localName, 'choice');
    assert.strictEqual(choiceNode.routes.length, 2);

    const whenRoute = choiceNode.routes[0];
    assert.strictEqual(whenRoute.kind, 'when');
    assert.strictEqual(whenRoute.attributes['expression'], '#[payload != null]');

    // Edit expression with a new expression that does not have #[ ]
    const newExprRaw = 'payload.status == "OK"';
    const updatedXml = FlowVisualizerPanel.updateExpressionInXml(xml, whenRoute.range, newExprRaw);

    assert(
      updatedXml.includes('expression="#[payload.status == &quot;OK&quot;]"'),
      'Expression must be wrapped in #[] and quotes escaped'
    );
    assert(updatedXml.includes('<logger level="INFO" message="Payload is not null" />'), 'Inner elements must be preserved');
    assert(updatedXml.includes('<otherwise>'), 'Otherwise route must be preserved');

    // Re-parse and verify model
    const newModel = parseAndBuild(updatedXml);
    const updatedWhen = newModel.flows[0].chain[0].routes[0];
    assert.strictEqual(updatedWhen.attributes['expression'], '#[payload.status == "OK"]');
    assert(updatedWhen.label.includes('payload.status == "OK"'));
  });

  it('3. Expressions containing <, >, and &&: properly escaped in XML and preserved upon re-parse', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core">
    <flow name="flowExprs">
        <choice>
            <when expression="#[true]">
                <set-payload value="test" />
            </when>
            <otherwise>
                <set-payload value="other" />
            </otherwise>
        </choice>
    </flow>
</mule>`;

    const model = parseAndBuild(xml);
    const whenRoute = model.flows[0].chain[0].routes[0];

    // Compound condition with <, >, &&
    const complexExpr = 'payload.age > 21 && payload.age < 65 && payload.active == true';
    const updatedXml = FlowVisualizerPanel.updateExpressionInXml(xml, whenRoute.range, complexExpr);

    assert(
      updatedXml.includes('expression="#[payload.age &gt; 21 &amp;&amp; payload.age &lt; 65 &amp;&amp; payload.active == true]"'),
      'All <, >, and && must be escaped as &lt;, &gt;, and &amp;&amp;'
    );

    // Re-parse and verify semantic model decodes correctly
    const reloadedModel = parseAndBuild(updatedXml);
    const reloadedWhen = reloadedModel.flows[0].chain[0].routes[0];
    assert.strictEqual(
      reloadedWhen.attributes['expression'],
      '#[payload.age > 21 && payload.age < 65 && payload.active == true]'
    );
  });

  it('4. Delete route: deletes the targeted when branch and preserves remaining routes', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
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

    const model = parseAndBuild(xml);
    const choiceNode = model.flows[0].chain[0];
    assert.strictEqual(choiceNode.routes.length, 3);

    const routeToDelete = choiceNode.routes[0];
    const xmlAfterDelete = FlowVisualizerPanel.deleteRouteInXml(xml, routeToDelete.range);

    assert(!xmlAfterDelete.includes("payload == 'toDelete'"), 'Deleted route must be removed');
    assert(xmlAfterDelete.includes("payload == 'keep'"), 'Remaining when route must be preserved');
    assert(xmlAfterDelete.includes('<otherwise>'), 'Otherwise route must be preserved');

    const modelAfterDelete = parseAndBuild(xmlAfterDelete);
    const choiceAfter = modelAfterDelete.flows[0].chain[0];
    assert.strictEqual(choiceAfter.routes.length, 2);
    assert.strictEqual(choiceAfter.routes[0].attributes['expression'], "#[payload == 'keep']");
    assert.strictEqual(choiceAfter.routes[1].kind, 'otherwise');
  });

  it('5. Reorder route: moves routes up/down and keeps otherwise route intact', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
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

    const model = parseAndBuild(xml);
    const choiceNode = model.flows[0].chain[0];
    assert.strictEqual(choiceNode.routes.length, 4);

    const routeA = choiceNode.routes[0];
    const routeB = choiceNode.routes[1];

    // Swap Route 0 (A) and Route 1 (B)
    const xmlSwapped = FlowVisualizerPanel.reorderChoiceRoutesInXml(xml, routeA.range, routeB.range);
    const modelSwapped = parseAndBuild(xmlSwapped);
    const choiceSwapped = modelSwapped.flows[0].chain[0];

    assert.strictEqual(choiceSwapped.routes[0].attributes['expression'], "#[payload == 'B']");
    assert.strictEqual(choiceSwapped.routes[1].attributes['expression'], "#[payload == 'A']");
    assert.strictEqual(choiceSwapped.routes[2].attributes['expression'], "#[payload == 'C']");
    assert.strictEqual(choiceSwapped.routes[3].kind, 'otherwise');

    // Next swap Route 1 (A) and Route 2 (C)
    const routeA2 = choiceSwapped.routes[1];
    const routeC2 = choiceSwapped.routes[2];
    const xmlSwapped2 = FlowVisualizerPanel.reorderChoiceRoutesInXml(xmlSwapped, routeA2.range, routeC2.range);
    const modelSwapped2 = parseAndBuild(xmlSwapped2);
    const choiceSwapped2 = modelSwapped2.flows[0].chain[0];

    assert.strictEqual(choiceSwapped2.routes[0].attributes['expression'], "#[payload == 'B']");
    assert.strictEqual(choiceSwapped2.routes[1].attributes['expression'], "#[payload == 'C']");
    assert.strictEqual(choiceSwapped2.routes[2].attributes['expression'], "#[payload == 'A']");
    assert.strictEqual(choiceSwapped2.routes[3].kind, 'otherwise');
  });
});
