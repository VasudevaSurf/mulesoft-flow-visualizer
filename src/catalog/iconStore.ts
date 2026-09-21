import { CORE_ICONS } from './coreIcons';

/**
 * Sanitizes and manages icons for both core and dynamic connectors.
 */
export class IconStore {
  private static sanitizedIcons = new Map<string, string>(); // iconId -> SVG symbol
  private static initialized = false;

  private static ensureCoreIcons(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    for (const [id, svg] of Object.entries(CORE_ICONS)) {
      this.sanitizeSvg(svg, id);
    }
  }

  /**
   * Sanitizes an SVG string extracted from a jar or external source using an allowlist approach.
   * Strips scripts, event handlers, foreignObject, and remote image references.
   * Normalizes to viewBox="0 0 48 48".
   */
  public static sanitizeSvg(rawSvg: string, iconId: string): string {
    if (!rawSvg) {
      return '';
    }

    try {
      // 1. Remove dangerous tags and their content
      let cleaned = rawSvg
        .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
        .replace(/<\s*foreignObject[^>]*>[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, '')
        .replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');

      // 2. Remove on* event handlers (e.g. onload, onclick)
      cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, '');
      cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '');

      // 3. Remove javascript: links and remote URLs in href/xlink:href/src
      cleaned = cleaned.replace(/href\s*=\s*['"]\s*javascript:[^'"]*['"]/gi, 'href=""');
      cleaned = cleaned.replace(/xlink:href\s*=\s*['"]\s*javascript:[^'"]*['"]/gi, 'xlink:href=""');
      cleaned = cleaned.replace(/href\s*=\s*['"]\s*https?:[^'"]*['"]/gi, 'href=""');
      cleaned = cleaned.replace(/xlink:href\s*=\s*['"]\s*https?:[^'"]*['"]/gi, 'xlink:href=""');

      // 4. Extract viewBox or width/height to normalize
      const viewBoxMatch = cleaned.match(/viewBox\s*=\s*["']([^"']+)["']/i);
      let viewBox = '0 0 48 48';
      if (viewBoxMatch) {
        viewBox = viewBoxMatch[1].trim();
      } else {
        const widthMatch = cleaned.match(/width\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
        const heightMatch = cleaned.match(/height\s*=\s*["'](\d+(?:\.\d+)?)["']/i);
        if (widthMatch && heightMatch) {
          viewBox = `0 0 ${widthMatch[1]} ${heightMatch[1]}`;
        }
      }

      // 5. Extract the inner elements between <svg> and </svg>
      const innerMatch = cleaned.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
      const innerContent = innerMatch ? innerMatch[1].trim() : cleaned;

      // Wrap in a standard symbol
      const symbolDef = `<symbol id="${this.escapeXml(iconId)}" viewBox="${viewBox}">${innerContent}</symbol>`;
      this.sanitizedIcons.set(iconId, symbolDef);

      return symbolDef;
    } catch (e) {
      console.error(`Failed to sanitize SVG for ${iconId}:`, e);
      return '';
    }
  }

  public static registerSymbol(iconId: string, symbolXml: string): void {
    this.sanitizedIcons.set(iconId, symbolXml);
  }

  public static getSymbol(iconId: string): string | undefined {
    this.ensureCoreIcons();
    return this.sanitizedIcons.get(iconId);
  }

  public static hasIcon(iconId: string): boolean {
    this.ensureCoreIcons();
    return this.sanitizedIcons.has(iconId);
  }

  public static getAllSymbols(): string {
    this.ensureCoreIcons();
    return Array.from(this.sanitizedIcons.values()).join('\n');
  }

  private static escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}
