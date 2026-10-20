import assert from 'assert';
import { MuleXmlParser } from '../src/parser/xmlParser';
import { SemanticModelBuilder } from '../src/parser/semanticModel';
import { WorkspaceScanner } from '../src/workspace/scanner';
import { layout } from '../src/layout';

describe('Large Mule API and Fault Tolerance Tests', () => {
  it('1. WorkspaceScanner.isMuleXml recognizes Mule files with https, apikit, and standard roots', () => {
    const httpsXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="https://www.mulesoft.org/schema/mule/core"
      xmlns:doc="https://www.mulesoft.org/schema/mule/documentation">
  <flow name="testFlow"><logger/></flow>
</mule>`;
    assert.strictEqual(WorkspaceScanner.isMuleXml(httpsXml), true);

    const apikitXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns:apikit="http://www.mulesoft.org/schema/mule/mule-apikit">
  <flow name="get:\\users:api-config"><logger/></flow>
</mule>`;
    assert.strictEqual(WorkspaceScanner.isMuleXml(apikitXml), true);

    const nonMuleXml = `<project><modelVersion>4.0.0</modelVersion></project>`;
    assert.strictEqual(WorkspaceScanner.isMuleXml(nonMuleXml), false);
  });

  it('2. MuleXmlParser parses attributes with unescaped &, &&, and query strings', () => {
    const xml = `
<mule xmlns="http://www.mulesoft.org/schema/mule/core">
  <flow name="apiFlow">
    <logger message="Sales & Marketing & Finance" doc:name="Log & Audit"/>
    <choice>
      <when expression="#[payload != null && vars.count > 0]">
        <http:request path="/api/v1/orders?active=true&limit=10" doc:name="Fetch & Return"/>
      </when>
    </choice>
  </flow>
</mule>`;
    const { root, error } = MuleXmlParser.parse(xml);
    assert.strictEqual(error, null);
    assert.notStrictEqual(root, null);
    assert.strictEqual(root!.children.length, 1);
  });

  it('3. Successfully parses a 1500+ line Mule API implementation file with multiple flows and DW expressions', () => {
    const flowCount = 20;
    const flowSnippets: string[] = [];

    // Main APIKit router flow
    flowSnippets.push(`
  <flow name="api-main">
    <http:listener path="/api/*" config-ref="api-httpListenerConfig">
      <http:response statusCode="#[vars.httpStatus default 200]"/>
    </http:listener>
    <apikit:router config-ref="api-config"/>
    <error-handler>
      <on-error-propagate type="APIKIT:BAD_REQUEST">
        <set-payload value='{"message": "Bad request"}'/>
      </on-error-propagate>
      <on-error-propagate type="APIKIT:NOT_FOUND">
        <set-payload value='{"message": "Resource not found"}'/>
      </on-error-propagate>
    </error-handler>
  </flow>
    `);

    // 19 API resource implementation flows with lots of processors and DataWeave expressions
    for (let i = 1; i < flowCount; i++) {
      const isPost = i % 2 === 0;
      const method = isPost ? 'post' : 'get';
      const resource = `users_${i}`;
      flowSnippets.push(`
  <flow name="${method}:\\${resource}:api-config">
    <logger message="Entering ${resource} flow & initializing" doc:name="Start & Log"/>
    <set-variable variableName="flowId" value="#['FLW-${i}-' ++ uuid()]"/>
    <choice doc:name="Validate Input & Route">
      <when expression="#[payload != null && payload.id != null && vars.flowId != null]">
        <logger message="Validated user ${i}"/>
        <ee:transform doc:name="Transform Entity & Response">
          <ee:message>
            <ee:set-payload><![CDATA[%dw 2.0
output application/json
---
{
  id: "${i}",
  name: "User ${i}",
  active: true,
  timestamp: now()
}]]></ee:set-payload>
          </ee:message>
        </ee:transform>
        <flow-ref name="sub_audit_flow" doc:name="Call Audit"/>
      </when>
      <otherwise>
        <logger message="Invalid payload for user ${i}" level="WARN"/>
        <raise-error type="CUSTOM:VALIDATION" description="Missing user payload & params"/>
      </otherwise>
    </choice>
    <logger message="Finished ${resource} flow successfully" doc:name="End & Exit"/>
    <error-handler>
      <on-error-continue type="ANY" enableNotifications="true" logException="true">
        <logger message="Handled error in flow ${i}"/>
      </on-error-continue>
    </error-handler>
  </flow>
      `);
    }

    // Add padding lines to easily exceed 1500 lines like a real enterprise API
    const extraPadding = Array.from({ length: 900 }, (_, idx) => `  <!-- Enterprise Mule API config line ${idx + 1}: standard metadata & properties -->`).join('\n');

    const bigXml = `<?xml version="1.0" encoding="UTF-8"?>
<mule xmlns="http://www.mulesoft.org/schema/mule/core"
      xmlns:doc="http://www.mulesoft.org/schema/mule/documentation"
      xmlns:http="http://www.mulesoft.org/schema/mule/http"
      xmlns:ee="http://www.mulesoft.org/schema/mule/ee/core"
      xmlns:apikit="http://www.mulesoft.org/schema/mule/mule-apikit"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
${flowSnippets.join('\n')}
${extraPadding}
</mule>`;

    const lineCount = bigXml.split('\n').length;
    assert.ok(lineCount > 1500, `Expected > 1500 lines, got ${lineCount}`);

    const { root, error } = MuleXmlParser.parse(bigXml);
    assert.strictEqual(error, null);
    assert.notStrictEqual(root, null);

    const model = SemanticModelBuilder.build(root!, 'C:/app/api.xml');
    assert.strictEqual(model.flows.length, flowCount);

    const scene = layout(model);
    assert.strictEqual(scene.flows.length, flowCount);
    assert.ok(scene.totalHeight > 1000);
  });

  it('4. Fault-tolerant stack recovery parses remaining flows when a trailing flow has an unclosed tag', () => {
    const brokenXml = `
<mule xmlns="http://www.mulesoft.org/schema/mule/core">
  <flow name="flowOne">
    <logger message="Flow 1 is completely valid"/>
  </flow>
  <flow name="flowTwo">
    <logger message="Flow 2 is also valid"/>
  </flow>
  <flow name="brokenFlow">
    <logger message="Unclosed tag missing slash"
</mule>
    `;
    const { root } = MuleXmlParser.parse(brokenXml);
    assert.notStrictEqual(root, null);
    const model = SemanticModelBuilder.build(root!, 'test.xml');
    assert.ok(model.flows.length >= 2);
    assert.strictEqual(model.flows[0].name, 'flowOne');
    assert.strictEqual(model.flows[1].name, 'flowTwo');
  });
});
