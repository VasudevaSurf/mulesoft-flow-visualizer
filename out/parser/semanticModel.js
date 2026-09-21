"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticModelBuilder = void 0;
const catalog_1 = require("../catalog");
const nodeId_1 = require("./nodeId");
class SemanticModelBuilder {
    /**
     * Transforms a RawElement XML tree into a SemanticModel ready for layout and rendering.
     */
    static build(root, filePath) {
        const flows = [];
        const globalConfigs = [];
        const unresolvedNamespaces = new Set();
        if (root && root.children) {
            for (const child of root.children) {
                const local = child.localName;
                const ns = child.namespaceUri || '';
                if (local === 'flow') {
                    flows.push(this.buildFlow(child, 'flow', unresolvedNamespaces));
                }
                else if (local === 'sub-flow') {
                    flows.push(this.buildFlow(child, 'sub-flow', unresolvedNamespaces));
                }
                else if (local === 'error-handler' && (child.attributes['name'] || child.attributes['id'])) {
                    flows.push(this.buildGlobalErrorHandler(child, unresolvedNamespaces));
                }
                else {
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
    static buildFlow(flowEl, type, unresolvedNs) {
        const flowName = flowEl.attributes['name'] || 'Unnamed Flow';
        const flowId = flowEl.attributes['doc:id'] || flowName;
        let sourceNode = null;
        const chain = [];
        const errorHandler = [];
        let errorHandlerRef = null;
        const children = flowEl.children || [];
        let childIndex = 0;
        // For standard flow: check if first child is a Source
        if (type === 'flow' && children.length > 0) {
            const firstChild = children[0];
            const descriptor = catalog_1.ExtensionCatalog.resolveComponent(firstChild.namespaceUri, firstChild.localName, firstChild.prefix);
            if (descriptor.kind === 'source' || firstChild.localName.includes('listener')) {
                sourceNode = this.buildNode(firstChild, flowName, 'source', unresolvedNs);
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
                }
                else {
                    for (let rIdx = 0; rIdx < child.children.length; rIdx++) {
                        const ehChild = child.children[rIdx];
                        const route = this.buildErrorRoute(ehChild, flowName, `err[${rIdx}]`, unresolvedNs);
                        if (route) {
                            errorHandler.push(route);
                        }
                    }
                }
            }
            else {
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
    static buildGlobalErrorHandler(ehEl, unresolvedNs) {
        const name = ehEl.attributes['name'] || 'Global Error Handler';
        const id = ehEl.attributes['doc:id'] || name;
        const routes = [];
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
    static buildErrorRoute(el, flowName, path, unresolvedNs) {
        const local = el.localName;
        if (local !== 'on-error-propagate' && local !== 'on-error-continue') {
            return null;
        }
        const typeAttr = el.attributes['type'] || 'ANY';
        const kind = local === 'on-error-propagate' ? 'on-error-propagate' : 'on-error-continue';
        const prefix = local === 'on-error-propagate' ? 'ON ERROR PROPAGATE' : 'ON ERROR CONTINUE';
        const label = `${prefix} (${typeAttr})`;
        const chain = [];
        for (let i = 0; i < el.children.length; i++) {
            chain.push(this.buildNode(el.children[i], flowName, `${path}/chain[${i}]`, unresolvedNs));
        }
        return {
            id: (0, nodeId_1.generateNodeId)(el.attributes, flowName, path),
            label,
            kind,
            chain,
            range: el.range,
        };
    }
    static buildNode(el, flowName, path, unresolvedNs) {
        const descriptor = catalog_1.ExtensionCatalog.resolveComponent(el.namespaceUri, el.localName, el.prefix);
        const id = (0, nodeId_1.generateNodeId)(el.attributes, flowName, path);
        const label = el.attributes['doc:name'] || descriptor.displayName;
        const subtitle = this.resolveSubtitle(el, descriptor);
        const chain = [];
        const routes = [];
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
                collapsed: false,
                diagnostics: [],
            };
        }
        // 3. Router components: choice, scatter-gather, round-robin, first-successful
        if (descriptor.kind === 'router' || el.localName === 'choice' || el.localName === 'scatter-gather' || el.localName === 'round-robin' || el.localName === 'first-successful') {
            if (el.localName === 'choice') {
                // choice has <when> and <otherwise>
                let whenIdx = 0;
                let otherwiseEl = null;
                for (const child of el.children) {
                    if (child.localName === 'when') {
                        const expr = child.attributes['expression'] || '';
                        const cleanedExpr = expr.startsWith('#[') && expr.endsWith(']') ? expr.slice(2, -1).trim() : expr;
                        const truncated = cleanedExpr.length > 25 ? cleanedExpr.slice(0, 22) + '...' : cleanedExpr;
                        const routeLabel = cleanedExpr ? `when #[${truncated}]` : 'when';
                        const routeChain = [];
                        for (let c = 0; c < child.children.length; c++) {
                            routeChain.push(this.buildNode(child.children[c], flowName, `${path}/when[${whenIdx}]/chain[${c}]`, unresolvedNs));
                        }
                        routes.push({
                            id: (0, nodeId_1.generateNodeId)(child.attributes, flowName, `${path}/when[${whenIdx}]`),
                            label: routeLabel,
                            kind: 'when',
                            chain: routeChain,
                            range: child.range,
                        });
                        whenIdx++;
                    }
                    else if (child.localName === 'otherwise') {
                        otherwiseEl = child;
                    }
                }
                // otherwise is always rendered last
                if (otherwiseEl) {
                    const routeChain = [];
                    for (let c = 0; c < otherwiseEl.children.length; c++) {
                        routeChain.push(this.buildNode(otherwiseEl.children[c], flowName, `${path}/otherwise/chain[${c}]`, unresolvedNs));
                    }
                    routes.push({
                        id: (0, nodeId_1.generateNodeId)(otherwiseEl.attributes, flowName, `${path}/otherwise`),
                        label: 'otherwise',
                        kind: 'otherwise',
                        chain: routeChain,
                        range: otherwiseEl.range,
                    });
                }
            }
            else {
                // scatter-gather / round-robin / first-successful / custom routers
                for (let r = 0; r < el.children.length; r++) {
                    const child = el.children[r];
                    const routeChain = [];
                    // child can be <route> or direct processors if wrapper is omitted
                    if (child.localName === 'route' || child.localName === 'step') {
                        for (let c = 0; c < child.children.length; c++) {
                            routeChain.push(this.buildNode(child.children[c], flowName, `${path}/route[${r}]/chain[${c}]`, unresolvedNs));
                        }
                    }
                    else {
                        routeChain.push(this.buildNode(child, flowName, `${path}/route[${r}]/chain[0]`, unresolvedNs));
                    }
                    routes.push({
                        id: (0, nodeId_1.generateNodeId)(child.attributes, flowName, `${path}/route[${r}]`),
                        label: `Route ${r + 1}`,
                        kind: 'route',
                        chain: routeChain,
                        range: child.range,
                    });
                }
            }
        }
        else if (descriptor.kind === 'scope') {
            // Scopes: try, foreach, parallel-foreach, until-successful, async, cache, batch:job
            for (let c = 0; c < el.children.length; c++) {
                const child = el.children[c];
                if (child.localName === 'error-handler') {
                    // If a try block has an inner error-handler
                    for (let ehIdx = 0; ehIdx < child.children.length; ehIdx++) {
                        const ehChild = child.children[ehIdx];
                        const route = this.buildErrorRoute(ehChild, flowName, `${path}/tryErr[${ehIdx}]`, unresolvedNs);
                        if (route) {
                            routes.push(route);
                        }
                    }
                }
                else {
                    chain.push(this.buildNode(child, flowName, `${path}/chain[${c}]`, unresolvedNs));
                }
            }
        }
        return {
            id,
            descriptor,
            label,
            subtitle,
            attributes: el.attributes,
            range: el.range,
            chain,
            routes,
            collapsed: false,
            diagnostics: [],
        };
    }
    static resolveSubtitle(el, descriptor) {
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
exports.SemanticModelBuilder = SemanticModelBuilder;
//# sourceMappingURL=semanticModel.js.map