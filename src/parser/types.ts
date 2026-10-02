/**
 * src/parser/types.ts
 *
 * Core domain types specified in Section 3 of the specification.
 */

// ---------- Parsing layer ----------

export interface SourceRange {
  startLine: number;   // 0-based, VS Code convention
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface RawElement {
  prefix: string | null;        // "db", "ee", null for core
  localName: string;            // "select", "transform", "flow"
  namespaceUri: string | null;
  attributes: Record<string, string>;
  children: RawElement[];
  range: SourceRange;           // full element span
  nameRange: SourceRange;       // just the tag name, for precise reveal
  text: string | null;          // trimmed text content if leaf-with-text
}

// ---------- Catalog layer ----------

export type ComponentKind =
  | 'source'
  | 'operation'
  | 'scope'
  | 'router'
  | 'error-handler'
  | 'error-handler-case'
  | 'route'          // a <when>/<otherwise>/<route> wrapper
  | 'flow'
  | 'sub-flow'
  | 'global-config'  // never rendered on the canvas
  | 'unknown';

import { ParameterGroupModel } from '../catalog/extensionModelReader';

export interface ComponentDescriptor {
  namespaceUri: string;
  localName: string;
  kind: ComponentKind;
  displayName: string;          // "Select", "Transform Message", "Scatter-Gather"
  iconId: string;               // key into the icon store
  /** For routers: which child element names are route wrappers. */
  routeElementNames?: string[];
  /** For scopes: which child element wraps the chain, if any (often none). */
  chainWrapperName?: string;
  /** Attribute to prefer for the secondary label under the name. */
  subtitleAttribute?: string;   // e.g. "config-ref", "path", "expression"
  /** Parameter groups for properties panel */
  groups?: ParameterGroupModel[];
}

// ---------- Diagnostic layer ----------

export interface ModelDiagnostic {
  message: string;
  severity: 'warning' | 'error' | 'info';
  range?: SourceRange;
  elementName?: string;
}

// ---------- Semantic layer (what gets laid out) ----------

export interface Node {
  id: string;                   // stable: doc:id if present, else structural path hash
  descriptor: ComponentDescriptor;
  label: string;                // doc:name, else descriptor.displayName
  subtitle: string | null;      // resolved from subtitleAttribute
  attributes: Record<string, string>;
  range: SourceRange;
  /** Sequential children (a chain). Empty for leaf operations. */
  chain: Node[];
  /** Route lanes. Non-empty only for routers and error handlers. */
  routes: Route[];
  /** Optional reference to a global error handler for scopes like Try. */
  errorHandlerRef?: string | null;
  /** Real nested XML child elements not represented as flow-processing chain or route entries. */
  body?: RawElement[];
  /** Direct text or CDATA content of this element if leaf-with-text. */
  text?: string | null;
  collapsed: boolean;
  errorBandCollapsed?: boolean;
  diagnostics: ModelDiagnostic[];
}

export interface Route {
  id: string;
  label: string;                // "when #[...]", "otherwise", "route 1", "ON ERROR PROPAGATE APP:BAD"
  kind: 'when' | 'otherwise' | 'route' | 'on-error-propagate' | 'on-error-continue';
  chain: Node[];
  /** XML attributes of this route element (expression, type, when, etc.). */
  attributes: Record<string, string>;
  /** Catalog descriptor for this route element, if available. */
  descriptor?: ComponentDescriptor;
  /** Real nested XML child elements not represented as flow-processing chain entries. */
  body?: RawElement[];
  range: SourceRange;
}

export interface FlowModel {
  id: string;
  name: string;                 // the name= attribute
  type: 'flow' | 'sub-flow' | 'global-error-handler';
  source: Node | null;          // null for sub-flow, and for flows with no source
  chain: Node[];
  errorHandler: Route[];        // empty if none
  errorHandlerRef: string | null; // if <error-handler ref="globalHandler"/>
  range: SourceRange;
  collapsed: boolean;
  errorBandCollapsed?: boolean;
}

export interface SemanticModel {
  filePath: string;
  flows: FlowModel[];
  globalConfigs: Node[];        // shown in a side list, not on the canvas
  unresolvedNamespaces: string[];
  catalogStatus: 'complete' | 'partial' | 'unavailable';
}
