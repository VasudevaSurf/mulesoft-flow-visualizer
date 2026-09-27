import { RawElement, SemanticModel, FlowModel, Node, Route, ComponentDescriptor } from './types';
import { ExtensionCatalog } from '../catalog';
import { isLikelySourceElement } from '../catalog/xsdClassifier';
import { generateNodeId } from './nodeId';

export class SemanticModelBuilder {
  /**
   * Transforms a RawElement XML tree into a SemanticModel ready for layout and rendering.
   */
  public static build(root: RawElement, filePath: string): SemanticModel {
    const flows: FlowModel[] = [];
    const globalConfigs: Node[] = [];
    const unresolvedNamespaces = new Set<string>();

    if (root && root.children) {
      for (const child of root.children) {
        const local = child.localName;
        const ns = child.namespaceUri || '';

        if (local === 'flow') {
          flows.push(this.buildFlow(child, 'flow', unresolvedNamespaces));
        } else if (local === 'sub-flow') {
          flows.push(this.buildFlow(child, 'sub-flow', unresolvedNamespaces));
        } else if (local === 'error-handler' && (child.attributes['name'] || child.attributes['id'])) {
          flows.push(this.buildGlobalErrorHandler(child, unresolvedNamespaces));
        } else {
          // Global configs, connectors, properties
          const node = this.buildNode(child, 'global', 'global', unresolvedNamespaces);
          if (node.descriptor.kind === 'global-config' || !local.endsWith('flow')) {
            globalConfigs.push(node);
          }
        }
      }
    }

    return {
      filePath,
      flows,
      globalConfigs,
      unresolvedNamespaces: Array.from(unresolvedNamespaces),
      catalogStatus: unresolvedNamespaces.size === 0 ? 'complete' : 'partial',
    };
  }

  private static isKnownProcessor(localName: string, prefix?: string | null): boolean {
    const pfx = (prefix || '').toLowerCase();
    const local = localName.toLowerCase();

    // Built-in core message processors / routers / scopes
    const coreNames = new Set([
      'logger', 'set-payload', 'set-variable', 'remove-variable',
      'transform', 'choice', 'scatter-gather', 'round-robin',
      'first-successful', 'flow-ref', 'async', 'try', 'until-successful',
      'foreach', 'parallel-foreach', 'batch:job', 'batch:execute',
      'raise-error', 'error-handler', 'on-error-propagate', 'on-error-continue',
      'parse-template', 'load-static-resource', 'idempotent-message-validator'
    ]);

    if (coreNames.has(local) || coreNames.has(`${pfx}:${local}`)) {
      return true;
    }

    if (pfx === 'ee' && local === 'transform') {
      return true;
    }

    // Common outbound operations that should never be treated as a source
    if (
      local.startsWith('request') ||
      local.endsWith('-request') ||
      local === 'request' ||
      local === 'select' ||
      local === 'insert' ||
      local === 'update' ||
      local === 'delete' ||
      local === 'publish' ||
      local === 'publish-consume' ||
      local === 'send' ||
      (local === 'consume' && pfx === 'wsc')
    ) {
      return true;
    }

    return false;
  }

  private static isMessageSource(element: RawElement, descriptor: ComponentDescriptor): boolean {
    // 1. Explicitly classified as source by catalog or XSD/SDK model
    if (descriptor.kind === 'source') {
      return true;
    }

    // 2. Known source naming patterns (listener, subscriber, scheduler, trigger, on-new-*, poll, etc.)
    if (isLikelySourceElement(element.localName)) {
      return true;
    }

    // 3. Known processors, routers, scopes, configs, or outbound operations cannot be sources
    if (this.isKnownProcessor(element.localName, element.prefix)) {
      return false;
    }

    if (descriptor.kind === 'router' || descriptor.kind === 'scope' || descriptor.kind === 'global-config') {
      return false;
    }

    if (element.localName === 'error-handler') {
      return false;
    }

    // 4. Default: per Mule specification, the first child of <flow> is an inbound message source
    return true;
  }

  private static buildFlow(
    flowEl: RawElement,
    type: 'flow' | 'sub-flow',
    unresolvedNs: Set<string>
  ): FlowModel {
    const flowName = flowEl.attributes['name'] || 'Unnamed Flow';
    const flowId = flowEl.attributes['doc:id'] || flowName;

    let sourceNode: Node | null = null;
    const chain: Node[] = [];
    const errorHandler: Route[] = [];
    let errorHandlerRef: string | null = null;

    const children = flowEl.children || [];
    let childIndex = 0;

    // For standard flow: check if first child is a Source
    if (type === 'flow' && children.length > 0) {
      const firstChild = children[0];
      const descriptor = ExtensionCatalog.resolveComponent(firstChild.namespaceUri, firstChild.localName, firstChild.prefix);

      if (this.isMessageSource(firstChild, descriptor)) {
        sourceNode = this.buildNode(firstChild, flowName, 'source', unresolvedNs);
        sourceNode.descriptor.kind = 'source';
        if (sourceNode.descriptor.iconId === 'core:unknown') {
          sourceNode.descriptor.iconId = 'core:generic-source';
        }
        childIndex = 1;
      }
    }

    // Process remaining children
    for (let i = childIndex; i < children.length; i++) {
      const child = children[i];
      const local = child.localName;

      if (type === 'flow' && local === 'error-handler') {
        if (child.attributes['ref']) {
          errorHandlerRef = child.attributes['ref'];
        } else {
          for (let rIdx = 0; rIdx < child.children.length; rIdx++) {
            const ehChild = child.children[rIdx];
            const route = this.buildErrorRoute(ehChild, flowName, `err[${rIdx}]`, unresolvedNs);
            if (route) {
              errorHandler.push(route);
            }
          }
        }
      } else {
        const node = this.buildNode(child, flowName, `chain[${chain.length}]`, unresolvedNs);
        chain.push(node);
      }
    }

    return {
      id: flowId,
      name: flowName,
      type,
      source: sourceNode,
      chain,
      errorHandler,
      errorHandlerRef,
      range: flowEl.range,
      collapsed: false,
    };
  }

  private static buildGlobalErrorHandler(
    ehEl: RawElement,
    unresolvedNs: Set<string>
  ): FlowModel {
    const name = ehEl.attributes['name'] || 'Global Error Handler';
    const id = ehEl.attributes['doc:id'] || name;
    const routes: Route[] = [];

    for (let i = 0; i < ehEl.children.length; i++) {
      const child = ehEl.children[i];
      const route = this.buildErrorRoute(child, name, `err[${i}]`, unresolvedNs);
      if (route) {
        routes.push(route);
      }
    }

    return {
      id,
      name,
      type: 'global-error-handler',
      source: null,
      chain: [],
      errorHandler: routes,
      errorHandlerRef: null,
      range: ehEl.range,
      collapsed: false,
    };
  }

  private static buildErrorRoute(
    el: RawElement,
    flowName: string,
    path: string,
    unresolvedNs: Set<string>
  ): Route | null {
    const local = el.localName;
    if (local !== 'on-error-propagate' && local !== 'on-error-continue') {
      return null;
    }

    const typeAttr = el.attributes['type'] || 'ANY';
    const kind = local === 'on-error-propagate' ? 'on-error-propagate' : 'on-error-continue';
    const prefix = local === 'on-error-propagate' ? 'ON ERROR PROPAGATE' : 'ON ERROR CONTINUE';
    const label = `${prefix} (${typeAttr})`;

    const chain: Node[] = [];
    const consumed = new Set<RawElement>();
    for (let i = 0; i < el.children.length; i++) {
      consumed.add(el.children[i]);
      chain.push(this.buildNode(el.children[i], flowName, `${path}/chain[${i}]`, unresolvedNs));
    }

    const body = (el.children || []).filter((c) => !consumed.has(c));

    return {
      id: generateNodeId(el.attributes, flowName, path),
      label,
      kind,
      chain,
      body,
      range: el.range,
    };
  }

  private static buildNode(
    el: RawElement,
    flowName: string,
    path: string,
    unresolvedNs: Set<string>
  ): Node {
    const descriptor = ExtensionCatalog.resolveComponent(el.namespaceUri, el.localName, el.prefix);
    const id = generateNodeId(el.attributes, flowName, path);

    const label = el.attributes['doc:name'] || descriptor.displayName;
    const subtitle = this.resolveSubtitle(el, descriptor);

    const chain: Node[] = [];
    const routes: Route[] = [];
    const consumedChildren = new Set<RawElement>();

    // Special cases:
    // 1. flow-ref is a leaf tile
    // 2. ee:transform is a leaf tile (its children are configuration, not processors)
    if (el.localName === 'flow-ref' || (el.prefix === 'ee' && el.localName === 'transform')) {
      return {
        id,
        descriptor,
        label,
        subtitle,
        attributes: el.attributes,
        range: el.range,
        chain: [],
        routes: [],
        body: el.children ? [...el.children] : [],
        text: el.text,
        collapsed: false,
        diagnostics: [],
      };
    }

    // 3. Router components: choice, scatter-gather, round-robin, first-successful
    if (descriptor.kind === 'router' || el.localName === 'choice' || el.localName === 'scatter-gather' || el.localName === 'round-robin' || el.localName === 'first-successful') {
      if (el.localName === 'choice') {
        // choice has <when> and <otherwise>
        let whenIdx = 0;
        let otherwiseEl: RawElement | null = null;

        for (const child of el.children) {
          if (child.localName === 'when') {
            consumedChildren.add(child);
            const expr = child.attributes['expression'] || '';
            const cleanedExpr = expr.startsWith('#[') && expr.endsWith(']') ? expr.slice(2, -1).trim() : expr;
            const truncated = cleanedExpr.length > 25 ? cleanedExpr.slice(0, 22) + '...' : cleanedExpr;
            const routeLabel = cleanedExpr ? `when #[${truncated}]` : 'when';
            const routeChain: Node[] = [];
            const whenConsumed = new Set<RawElement>();
            for (let c = 0; c < child.children.length; c++) {
              whenConsumed.add(child.children[c]);
              routeChain.push(this.buildNode(child.children[c], flowName, `${path}/when[${whenIdx}]/chain[${c}]`, unresolvedNs));
            }
            routes.push({
              id: generateNodeId(child.attributes, flowName, `${path}/when[${whenIdx}]`),
              label: routeLabel,
              kind: 'when',
              chain: routeChain,
              body: (child.children || []).filter((c) => !whenConsumed.has(c)),
              range: child.range,
            });
            whenIdx++;
          } else if (child.localName === 'otherwise') {
            consumedChildren.add(child);
            otherwiseEl = child;
          }
        }

        // otherwise is always rendered last
        if (otherwiseEl) {
          const routeChain: Node[] = [];
          const otherwiseConsumed = new Set<RawElement>();
          for (let c = 0; c < otherwiseEl.children.length; c++) {
            otherwiseConsumed.add(otherwiseEl.children[c]);
            routeChain.push(this.buildNode(otherwiseEl.children[c], flowName, `${path}/otherwise/chain[${c}]`, unresolvedNs));
          }
          routes.push({
            id: generateNodeId(otherwiseEl.attributes, flowName, `${path}/otherwise`),
            label: 'otherwise',
            kind: 'otherwise',
            chain: routeChain,
            body: (otherwiseEl.children || []).filter((c) => !otherwiseConsumed.has(c)),
            range: otherwiseEl.range,
          });
        }
      } else {
        // scatter-gather / round-robin / first-successful / custom routers
        for (let r = 0; r < el.children.length; r++) {
          const child = el.children[r];
          consumedChildren.add(child);
          const routeChain: Node[] = [];
          const routeConsumed = new Set<RawElement>();
          // child can be <route> or direct processors if wrapper is omitted
          if (child.localName === 'route' || child.localName === 'step') {
            for (let c = 0; c < child.children.length; c++) {
              routeConsumed.add(child.children[c]);
              routeChain.push(this.buildNode(child.children[c], flowName, `${path}/route[${r}]/chain[${c}]`, unresolvedNs));
            }
          } else {
            routeChain.push(this.buildNode(child, flowName, `${path}/route[${r}]/chain[0]`, unresolvedNs));
          }
          routes.push({
            id: generateNodeId(child.attributes, flowName, `${path}/route[${r}]`),
            label: `Route ${r + 1}`,
            kind: 'route',
            chain: routeChain,
            body: (child.children || []).filter((c) => !routeConsumed.has(c)),
            range: child.range,
          });
        }
      }
    } else if (descriptor.kind === 'scope') {
      // Scopes: try, foreach, parallel-foreach, until-successful, async, cache, batch:job
      for (let c = 0; c < el.children.length; c++) {
        const child = el.children[c];
        if (child.localName === 'error-handler') {
          consumedChildren.add(child);
          // If a try block has an inner error-handler
          for (let ehIdx = 0; ehIdx < child.children.length; ehIdx++) {
            const ehChild = child.children[ehIdx];
            const route = this.buildErrorRoute(ehChild, flowName, `${path}/tryErr[${ehIdx}]`, unresolvedNs);
            if (route) {
              routes.push(route);
            }
          }
        } else {
          consumedChildren.add(child);
          chain.push(this.buildNode(child, flowName, `${path}/chain[${c}]`, unresolvedNs));
        }
      }
    }

    const body = (el.children || []).filter((c) => !consumedChildren.has(c));

    return {
      id,
      descriptor,
      label,
      subtitle,
      attributes: el.attributes,
      range: el.range,
      chain,
      routes,
      body,
      text: el.text,
      collapsed: false,
      diagnostics: [],
    };
  }

  private static resolveSubtitle(el: RawElement, descriptor: ComponentDescriptor): string | null {
    if (el.localName === 'flow-ref') {
      return el.attributes['name'] || null;
    }
    if (descriptor.subtitleAttribute && el.attributes[descriptor.subtitleAttribute]) {
      return el.attributes[descriptor.subtitleAttribute];
    }
    if (el.attributes['config-ref']) {
      return el.attributes['config-ref'];
    }
    if (el.attributes['path']) {
      return el.attributes['path'];
    }
    if (el.attributes['expression']) {
      return el.attributes['expression'];
    }
    return null;
  }
}
