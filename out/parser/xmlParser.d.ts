import { RawElement } from './types';
export declare class MuleXmlParser {
    private static lastGoodResult;
    /**
     * Parses Mule XML text into a hierarchical RawElement tree with accurate source ranges.
     * On parse errors (e.g. while user is typing), returns the last good tree if available.
     */
    static parse(xmlContent: string): {
        root: RawElement | null;
        error: string | null;
    };
    /**
     * Sanitizes XML content before parsing with strict XML parser:
     * - Preserves CDATA sections and comments without alteration
     * - Sanitizes unescaped '<' inside quoted attribute values
     * - Sanitizes unescaped '&' characters (e.g. '&&' in DataWeave expressions, '&' in URLs/doc:names)
     */
    static sanitizeXml(xml: string): string;
    private static doParse;
}
//# sourceMappingURL=xmlParser.d.ts.map