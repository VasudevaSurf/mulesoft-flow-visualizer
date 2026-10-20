"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MuleXmlParser = void 0;
const saxes_1 = require("saxes");
class MuleXmlParser {
    /**
     * Parses Mule XML text into a hierarchical RawElement tree with accurate source ranges.
     * On parse errors (e.g. while user is typing), returns the last good tree if available.
     */
    static parse(xmlContent) {
        if (!xmlContent || !xmlContent.trim()) {
            return { root: null, error: null };
        }
        try {
            const cleanXml = this.sanitizeXml(xmlContent);
            const { root, errors } = this.doParse(cleanXml);
            if (root) {
                this.lastGoodResult = root;
                return { root, error: errors.length > 0 ? errors[0] : null };
            }
            return { root: this.lastGoodResult, error: errors.length > 0 ? errors[0] : 'Empty XML document' };
        }
        catch (e) {
            const errorMessage = e?.message || String(e);
            return {
                root: this.lastGoodResult,
                error: errorMessage,
            };
        }
    }
    /**
     * Sanitizes XML content before parsing with strict XML parser:
     * - Preserves CDATA sections and comments without alteration
     * - Sanitizes unescaped '<' inside quoted attribute values
     * - Sanitizes unescaped '&' characters (e.g. '&&' in DataWeave expressions, '&' in URLs/doc:names)
     */
    static sanitizeXml(xml) {
        const preservedTokens = [];
        // 1. Preserve CDATA sections and comments
        let tokenized = xml.replace(/(<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->)/g, (match) => {
            preservedTokens.push(match);
            return `___PRESERVED_XML_TOKEN_${preservedTokens.length - 1}___`;
        });
        // 2. Sanitize unescaped '<' in attribute values (e.g. #[amount < 100])
        tokenized = tokenized.replace(/=("[^"]*"|'[^']*')/g, (match) => {
            if (match.includes('<')) {
                return match.replace(/</g, '&lt;');
            }
            return match;
        });
        // 3. Sanitize unescaped '&' everywhere outside CDATA/comments (e.g. && in expressions, & in urls/labels)
        tokenized = tokenized.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
        // 4. Restore preserved CDATA and comments
        if (preservedTokens.length > 0) {
            tokenized = tokenized.replace(/___PRESERVED_XML_TOKEN_(\d+)___/g, (_, idx) => preservedTokens[Number(idx)]);
        }
        return tokenized;
    }
    static doParse(xmlContent) {
        const parser = new saxes_1.SaxesParser();
        const stack = [];
        const nsStack = [
            {
                '': 'http://www.mulesoft.org/schema/mule/core',
                'core': 'http://www.mulesoft.org/schema/mule/core',
                'doc': 'http://www.mulesoft.org/schema/mule/documentation',
            }
        ];
        let rootElement = null;
        let pendingStartCol = 0;
        let pendingNameStartCol = 0;
        let pendingNameEndCol = 0;
        const errors = [];
        parser.on('error', (err) => {
            errors.push(err.message);
        });
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
            const currentNs = Object.assign({}, nsStack[nsStack.length - 1]);
            const attributes = {};
            for (const [attrName, attrVal] of Object.entries(tag.attributes)) {
                const valStr = typeof attrVal === 'string' ? attrVal : String(attrVal);
                attributes[attrName] = valStr;
                if (attrName === 'xmlns') {
                    currentNs[''] = valStr;
                }
                else if (attrName.startsWith('xmlns:')) {
                    const nsPrefix = attrName.slice(6);
                    currentNs[nsPrefix] = valStr;
                }
            }
            nsStack.push(currentNs);
            const namespaceUri = prefix !== null ? (currentNs[prefix] || null) : (currentNs[''] || null);
            const frame = {
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
            if (stack.length > 0) {
                const top = stack[stack.length - 1];
                top.text = (top.text || '') + text;
            }
        });
        parser.on('cdata', (cdata) => {
            if (stack.length > 0) {
                const top = stack[stack.length - 1];
                top.text = (top.text || '') + cdata;
            }
        });
        parser.on('closetag', () => {
            if (stack.length === 0) {
                return;
            }
            const frame = stack.pop();
            nsStack.pop();
            // Update full element end range
            frame.range.endLine = Math.max(0, parser.line - 1);
            frame.range.endCol = Math.max(0, parser.column - 1);
            let textValue = null;
            if (frame.children.length === 0 && frame.text !== null && frame.text !== undefined) {
                const trimmed = frame.text.trim();
                textValue = trimmed.length > 0 ? trimmed : null;
            }
            const element = {
                prefix: frame.prefix,
                localName: frame.localName,
                namespaceUri: frame.namespaceUri,
                attributes: frame.attributes,
                children: frame.children,
                range: frame.range,
                nameRange: frame.nameRange,
                text: textValue,
            };
            if (stack.length > 0) {
                stack[stack.length - 1].children.push(element);
            }
            else {
                rootElement = element;
            }
        });
        parser.write(xmlContent);
        parser.close();
        // Fault-tolerant recovery: if parser stopped due to an unclosed tag but stack has frames,
        // unwind the stack so that any flows and components parsed up to the error are recovered.
        if (!rootElement && stack.length > 0) {
            while (stack.length > 1) {
                const frame = stack.pop();
                const element = {
                    prefix: frame.prefix,
                    localName: frame.localName,
                    namespaceUri: frame.namespaceUri,
                    attributes: frame.attributes,
                    children: frame.children,
                    range: frame.range,
                    nameRange: frame.nameRange,
                    text: frame.text ? (frame.text.trim().length > 0 ? frame.text.trim() : null) : null,
                };
                stack[stack.length - 1].children.push(element);
            }
            const rootFrame = stack.pop();
            rootElement = {
                prefix: rootFrame.prefix,
                localName: rootFrame.localName,
                namespaceUri: rootFrame.namespaceUri,
                attributes: rootFrame.attributes,
                children: rootFrame.children,
                range: rootFrame.range,
                nameRange: rootFrame.nameRange,
                text: rootFrame.text ? (rootFrame.text.trim().length > 0 ? rootFrame.text.trim() : null) : null,
            };
        }
        return { root: rootElement, errors };
    }
}
exports.MuleXmlParser = MuleXmlParser;
MuleXmlParser.lastGoodResult = null;
//# sourceMappingURL=xmlParser.js.map