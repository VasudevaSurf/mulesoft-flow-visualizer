/**
 * Sanitizes and manages icons for both core and dynamic connectors.
 */
export declare class IconStore {
    private static sanitizedIcons;
    private static initialized;
    private static ensureCoreIcons;
    /**
     * Sanitizes an SVG string extracted from a jar or external source using an allowlist approach.
     * Strips scripts, event handlers, foreignObject, and remote image references.
     * Normalizes to viewBox="0 0 48 48".
     */
    static sanitizeSvg(rawSvg: string, iconId: string): string;
    static registerSymbol(iconId: string, symbolXml: string): void;
    static getSymbol(iconId: string): string | undefined;
    static hasIcon(iconId: string): boolean;
    static getAllSymbols(): string;
    private static escapeXml;
}
//# sourceMappingURL=iconStore.d.ts.map