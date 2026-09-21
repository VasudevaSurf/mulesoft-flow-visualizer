import * as assert from 'assert';
import { layout } from '../src/layout';
import { L } from '../src/layout/constants';
import { SemanticModel, FlowModel, Node, Route, ComponentDescriptor } from '../src/parser/types';

function createDummyDescriptor(kind: any, localName: string): ComponentDescriptor {
  return {
    namespaceUri: 'http://www.mulesoft.org/schema/mule/core',
    localName,
    kind,
    displayName: localName,
    iconId: `core:${localName}`,
  };
}

function createDummyNode(localName: string, kind: any = 'operation', chain: Node[] = [], routes: Route[] = []): Node {
  return {
    id: `id-${localName}-${Math.random()}`,
    descriptor: createDummyDescriptor(kind, localName),
    label: localName,
    subtitle: null,
    attributes: {},
    range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
    chain,
    routes,
    collapsed: false,
    diagnostics: [],
  };
}

function createDummyRoute(label: string, chain: Node[]): Route {
  return {
    id: `route-${Math.random()}`,
    label,
    kind: 'route',
    chain,
    range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
  };
}

describe('Layout Engine Specification Tests (§10)', () => {
  it('1. A 3-operation chain: assert x positions are p, p+110+28, p+2*(110+28) and all three y are equal', () => {
    const chain = [
      createDummyNode('op1'),
      createDummyNode('op2'),
      createDummyNode('op3'),
    ];

    const flow: FlowModel = {
      id: 'f1',
      name: 'testFlow',
      type: 'sub-flow',
      source: null,
      chain,
      errorHandler: [],
      errorHandlerRef: null,
      range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
      collapsed: false,
    };

    const model: SemanticModel = {
      filePath: 'test.xml',
      flows: [flow],
      globalConfigs: [],
      unresolvedNamespaces: [],
      catalogStatus: 'complete',
    };

    const scene = layout(model);
    assert.strictEqual(scene.flows.length, 1);
    const pFlow = scene.flows[0];
    assert.strictEqual(pFlow.chain.length, 3);

    const n0 = pFlow.chain[0];
    const n1 = pFlow.chain[1];
    const n2 = pFlow.chain[2];

    const startX = pFlow.processBox.x;
    assert.strictEqual(n0.x, startX);
    assert.strictEqual(n1.x, startX + L.tile.w + L.tileGapX);
    assert.strictEqual(n2.x, startX + 2 * (L.tile.w + L.tileGapX));

    assert.strictEqual(n0.y, n1.y);
    assert.strictEqual(n1.y, n2.y);
  });

  it('2. A choice with 2 when + 1 otherwise: assert 3 lanes, lane y increases monotonically, all share width, container laneY aligns with lane 0', () => {
    const r1 = createDummyRoute('when 1', [createDummyNode('log1')]);
    const r2 = createDummyRoute('when 2', [createDummyNode('log2'), createDummyNode('log3')]);
    const r3 = createDummyRoute('otherwise', [createDummyNode('log4')]);

    const choiceNode = createDummyNode('choice', 'router', [], [r1, r2, r3]);

    const flow: FlowModel = {
      id: 'f1',
      name: 'choiceFlow',
      type: 'sub-flow',
      source: null,
      chain: [choiceNode],
      errorHandler: [],
      errorHandlerRef: null,
      range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
      collapsed: false,
    };

    const scene = layout({
      filePath: 'test.xml',
      flows: [flow],
      globalConfigs: [],
      unresolvedNamespaces: [],
      catalogStatus: 'complete',
    });

    const pChoice = scene.flows[0].chain[0];
    assert.strictEqual(pChoice.routes.length, 3);

    // Assert lane y increases monotonically
    assert.ok(pChoice.routes[0].y < pChoice.routes[1].y);
    assert.ok(pChoice.routes[1].y < pChoice.routes[2].y);

    // Assert all lanes share the same width (matching the widest route r2)
    const expectedW = pChoice.routes[1].width;
    assert.strictEqual(pChoice.routes[0].width, expectedW);
    assert.strictEqual(pChoice.routes[2].width, expectedW);

    // Assert the container's laneY aligns with lane 0
    assert.strictEqual(pChoice.laneY, pChoice.routes[0].laneY);
  });

  it('3. A scatter-gather next to a logger: assert the logger centre aligns with the scatter-gather first route, not its centre', () => {
    const r1 = createDummyRoute('r1', [createDummyNode('w1')]);
    const r2 = createDummyRoute('r2', [createDummyNode('w2')]);
    const scatter = createDummyNode('scatter-gather', 'router', [], [r1, r2]);
    const logger = createDummyNode('logger');

    const flow: FlowModel = {
      id: 'f1',
      name: 'alignFlow',
      type: 'sub-flow',
      source: null,
      chain: [scatter, logger],
      errorHandler: [],
      errorHandlerRef: null,
      range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
      collapsed: false,
    };

    const scene = layout({
      filePath: 'test.xml',
      flows: [flow],
      globalConfigs: [],
      unresolvedNamespaces: [],
      catalogStatus: 'complete',
    });

    const pScatter = scene.flows[0].chain[0];
    const pLogger = scene.flows[0].chain[1];

    // Assert logger's laneY connects on the same horizontal line as scatter-gather's first route
    assert.strictEqual(pLogger.laneY, pScatter.laneY);
    assert.strictEqual(pScatter.laneY, pScatter.routes[0].laneY);
    // Scatter total height is larger than tile height
    assert.ok(pScatter.height > pLogger.height);
    // Logger is NOT aligned with scatter's vertical midpoint
    const scatterMidY = pScatter.y + pScatter.height / 2;
    assert.notStrictEqual(pLogger.laneY, scatterMidY);
  });

  it('4. A flow with an error handler with 2 handlers: assert error band below process, handlers stack vertically, processors in handler 1 horizontal', () => {
    const err1 = createDummyRoute('on-error-continue', [createDummyNode('log1'), createDummyNode('log2')]);
    const err2 = createDummyRoute('on-error-propagate', [createDummyNode('log3')]);

    const flow: FlowModel = {
      id: 'f1',
      name: 'errFlow',
      type: 'flow',
      source: createDummyNode('listener', 'source'),
      chain: [createDummyNode('set-payload')],
      errorHandler: [err1, err2],
      errorHandlerRef: null,
      range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
      collapsed: false,
    };

    const scene = layout({
      filePath: 'test.xml',
      flows: [flow],
      globalConfigs: [],
      unresolvedNamespaces: [],
      catalogStatus: 'complete',
    }, { collapseErrorHandlers: 'never' });

    const pFlow = scene.flows[0];
    assert.ok(pFlow.errorBandBox !== null);
    // Error band sits below the process area
    assert.ok(pFlow.errorBandBox!.y > pFlow.processBox.y + pFlow.processBox.height);
    assert.strictEqual(pFlow.errorHandlers.length, 2);

    // Handlers stack vertically
    assert.ok(pFlow.errorHandlers[0].y < pFlow.errorHandlers[1].y);

    // Processors inside handler 1 run horizontally
    const h1Nodes = pFlow.errorHandlers[0].children;
    assert.strictEqual(h1Nodes.length, 2);
    assert.ok(h1Nodes[0].x < h1Nodes[1].x);
    assert.strictEqual(h1Nodes[0].y, h1Nodes[1].y);
  });

  it('5. A sub-flow: assert no source compartment is allocated (total width equals process width + padding only)', () => {
    const flow: FlowModel = {
      id: 'f1',
      name: 'subFlow',
      type: 'sub-flow',
      source: null,
      chain: [createDummyNode('logger')],
      errorHandler: [],
      errorHandlerRef: null,
      range: { startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
      collapsed: false,
    };

    const scene = layout({
      filePath: 'test.xml',
      flows: [flow],
      globalConfigs: [],
      unresolvedNamespaces: [],
      catalogStatus: 'complete',
    });

    const pFlow = scene.flows[0];
    assert.strictEqual(pFlow.sourceBox, null);
    assert.strictEqual(pFlow.errorBandBox, null);
    const expectedW = L.flowPad.left + pFlow.processBox.width + L.flowPad.right;
    assert.strictEqual(pFlow.width, expectedW);
  });
});
