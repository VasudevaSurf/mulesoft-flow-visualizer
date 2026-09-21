import { SaxesParser } from 'saxes';
import { RawElement, SourceRange } from './types';

interface ElementFrame {
  prefix: string | null;
  localName: string;
  namespaceUri: string | null;
  attributes: Record<string, string>;
  children: RawElement[];
  range: SourceRange;
  nameRange: SourceRange;
  text: string | null;
  namespaces: Record<string, string>;
}

export class MuleXmlParser {
  private static lastGoodResult: RawElement | null = null;

  /**
   * Parses Mule XML text into a hierarchical RawElement tree with accurate source ranges.
   * On parse errors (e.g. while user is typing), returns the last good tree if available.
   */
  public static parse(xmlContent: string): { root: RawElement | null; error: string | null } {
    if (!xmlContent || !xmlContent.trim()) {
      return { root: null, error: null };
    }

    try {
      const root = this.doParse(xmlContent);
      if (root) {
        this.lastGoodResult = root;
        return { root, error: null };
      }
      return { root: this.lastGoodResult, error: 'Empty XML document' };
    } catch (e: any) {
      // Auto-recover if error was caused by unescaped '<' inside DataWeave expressions in attributes (e.g. #[a <= b])
      try {
        const sanitized = this.sanitizeAttributes(xmlContent);
        if (sanitized !== xmlContent) {
          const root = this.doParse(sanitized);
          if (root) {
            this.lastGoodResult = root;
            return { root, error: null };
          }
        }
      } catch {
        // Ignore fallback error and report original
      }

      const errorMessage = e?.message || String(e);
      return {
        root: this.lastGoodResult,
        error: errorMessage,
      };
    }
  }

  /**
   * Sanitizes unescaped '<' characters inside quoted attribute values (e.g. #[amount <= 0])
   * without affecting XML tags.
   */
  private static sanitizeAttributes(xml: string): string {
    return xml.replace(/=("[^"]*"|'[^']*')/g, (match) => {
      if (match.includes('<')) {
        return match.replace(/</g, '&lt;');
      }
      return match;
    });
  }

  private static doParse(xmlContent: string): RawElement | null {
    const parser = new SaxesParser();
    const stack: ElementFrame[] = [];
    const nsStack: Record<string, string>[] = [
      {
        '': 'http://www.mulesoft.org/schema/mule/core',
        'core': 'http://www.mulesoft.org/schema/mule/core',
        'doc': 'http://www.mulesoft.org/schema/mule/documentation',
      }
    ];

    let rootElement: RawElement | null = null;
    let pendingStartCol = 0;
    let pendingNameStartCol = 0;
    let pendingNameEndCol = 0;

    parser.on('opentagstart', (tag) => {
      // Line is 1-based, column is 1-based at the end of the tag name
      const line = parser.line - 1;
      const col = parser.column;
      const nameLen = tag.name.length;
      // Tag starts at '<', which is col - nameLen - 1 (1-based), so col - nameLen - 2 in 0-based
      pendingStartCol = Math.max(0, col - nameLen - 2);
      pendingNameStartCol = Math.max(0, col - nameLen - 1);
      pendingNameEndCol = Math.max(0, col - 1);
    });

    parser.on('opentag', (tag) => {
      const startLine = parser.line - 1;
      const rawName = tag.name;
      const colonIndex = rawName.indexOf(':');
      const prefix = colonIndex > 0 ? rawName.slice(0, colonIndex) : null;
      const localName = colonIndex > 0 ? rawName.slice(colonIndex + 1) : rawName;

      // Current active namespaces
      const currentNs: Record<string, string> = Object.assign({}, nsStack[nsStack.length - 1]);
      const attributes: Record<string, string> = {};

      for (const [attrName, attrVal] of Object.entries(tag.attributes)) {
        const valStr = typeof attrVal === 'string' ? attrVal : String(attrVal);
        attributes[attrName] = valStr;

        if (attrName === 'xmlns') {
          currentNs[''] = valStr;
        } else if (attrName.startsWith('xmlns:')) {
          const nsPrefix = attrName.slice(6);
          currentNs[nsPrefix] = valStr;
        }
      }

      nsStack.push(currentNs);

      const namespaceUri = prefix !== null ? (currentNs[prefix] || null) : (currentNs[''] || null);

      const frame: ElementFrame = {
        prefix,
        localName,
        namespaceUri,
        attributes,
        children: [],
        range: {
          startLine,
          startCol: pendingStartCol,
          endLine: startLine,
          endCol: Math.max(0, parser.column - 1),
        },
        nameRange: {
          startLine,
          startCol: pendingNameStartCol,
          endLine: startLine,
          endCol: pendingNameEndCol,
        },
        text: null,
        namespaces: currentNs,
      };

      stack.push(frame);
    });

    parser.on('text', (text) => {
      if (stack.length > 0 && text.trim()) {
        const top = stack[stack.length - 1];
        top.text = (top.text || '') + text.trim();
      }
    });

    parser.on('closetag', () => {
      if (stack.length === 0) {
        return;
      }

      const frame = stack.pop()!;
      nsStack.pop();

      // Update full element end range
      frame.range.endLine = Math.max(0, parser.line - 1);
      frame.range.endCol = Math.max(0, parser.column - 1);

      const element: RawElement = {
        prefix: frame.prefix,
        localName: frame.localName,
        namespaceUri: frame.namespaceUri,
        attributes: frame.attributes,
        children: frame.children,
        range: frame.range,
        nameRange: frame.nameRange,
        text: frame.text,
      };

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(element);
      } else {
        rootElement = element;
      }
    });

    parser.write(xmlContent);
    parser.close();

    return rootElement;
  }
}
