import { ComponentDescriptor } from '../parser/types';
export interface XsdParseResult {
    namespaceUri: string;
    prefix?: string;
    descriptors: ComponentDescriptor[];
}
/**
 * Determines if an element is a message source based on XSD substitutionGroup or naming patterns.
 */
export declare function isLikelySourceElement(name: string, substitutionGroup?: string): boolean;
export declare class XsdClassifier {
    private static parser;
    /**
     * Parses an XSD content string and extracts component descriptors with kinds.
     */
    static classifyXsd(xsdContent: string, iconId: string): XsdParseResult | null;
    private static classifyElement;
    static formatDisplayName(localName: string): string;
}
//# sourceMappingURL=xsdClassifier.d.ts.map