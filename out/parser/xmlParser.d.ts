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
     * Sanitizes unescaped '<' characters inside quoted attribute values (e.g. #[amount <= 0])
     * without affecting XML tags.
     */
    private static sanitizeAttributes;
    private static doParse;
}
//# sourceMappingURL=xmlParser.d.ts.map