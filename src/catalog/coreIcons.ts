/**
 * src/catalog/coreIcons.ts
 *
 * Authentic vector SVGs for core Mule runtime components per Section 7.4.
 * Styled to match the exact visual fidelity, circular badges, and iconography of Anypoint Studio.
 */

export const CORE_ICONS: Record<string, string> = {
  "core:logger": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#1E88E5"/>
    <rect x="14" y="12" width="20" height="24" rx="3" fill="#FFFFFF"/>
    <line x1="18" y1="18" x2="30" y2="18" stroke="#1E88E5" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="18" y1="23" x2="30" y2="23" stroke="#1E88E5" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="18" y1="28" x2="26" y2="28" stroke="#1E88E5" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,

  "core:set-payload": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#43A047"/>
    <rect x="13" y="11" width="22" height="26" rx="3" fill="#FFFFFF"/>
    <path d="M24 16v12m-4-4l4 4 4-4" fill="none" stroke="#43A047" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="17" y1="32" x2="31" y2="32" stroke="#43A047" stroke-width="2" stroke-linecap="round"/>
  </svg>`,

  "core:set-variable": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#8E24AA"/>
    <rect x="12" y="12" width="24" height="24" rx="5" fill="#FFFFFF"/>
    <text x="24" y="29.5" font-size="18" font-family="-apple-system, sans-serif" font-weight="900" fill="#8E24AA" text-anchor="middle">V</text>
  </svg>`,

  "core:remove-variable": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#E53935"/>
    <rect x="12" y="12" width="24" height="24" rx="5" fill="#FFFFFF"/>
    <line x1="17" y1="24" x2="31" y2="24" stroke="#E53935" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`,

  "core:transform": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#00ACC1"/>
    <rect x="11" y="11" width="26" height="26" rx="4" fill="#FFFFFF"/>
    <path d="M19 16c-3 0-4 3-4 5v2c0 2-2 3-3 3 1 0 3 1 3 3v2c0 2 1 5 4 5" fill="none" stroke="#00ACC1" stroke-width="2" stroke-linecap="round"/>
    <path d="M29 16c3 0 4 3 4 5v2c0 2 2 3 3 3-1 0-3 1-3 3v2c0 2-1 5-4 5" fill="none" stroke="#00ACC1" stroke-width="2" stroke-linecap="round"/>
    <circle cx="24" cy="24" r="2" fill="#00ACC1"/>
  </svg>`,

  "core:choice": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#FB8C00"/>
    <rect x="12" y="12" width="24" height="24" rx="4" fill="#FFFFFF"/>
    <path d="M16 24h6l7-8h4m-4-3l3 3-3 3m-6 5l7 8h4m-4-3l3 3-3 3" fill="none" stroke="#FB8C00" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  "core:scatter-gather": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#3949AB"/>
    <rect x="12" y="12" width="24" height="24" rx="4" fill="#FFFFFF"/>
    <line x1="16" y1="18" x2="32" y2="18" stroke="#3949AB" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="16" y1="24" x2="32" y2="24" stroke="#3949AB" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="16" y1="30" x2="32" y2="30" stroke="#3949AB" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M28 15l3 3-3 3m0 3l3 3-3 3m0 3l3 3-3 3" fill="none" stroke="#3949AB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  "core:round-robin": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#00897B"/>
    <circle cx="24" cy="24" r="12" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-dasharray="8 4"/>
    <path d="M30 18l3 3-3 3" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  "core:first-successful": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#F4511E"/>
    <path d="M16 24l6 6 12-12" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  "core:try": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#546E7A"/>
    <path d="M24 12l10 4.5v7.5c0 6.5-4.5 11-10 13-5.5-2-10-6.5-10-13v-7.5l10-4.5z" fill="#FFFFFF"/>
    <circle cx="24" cy="24" r="4" fill="#546E7A"/>
  </svg>`,

  "core:foreach": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#FB8C00"/>
    <path d="M17 19a10 10 0 1 1-2 8m-2-5l3-3 3 3" fill="none" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="24" cy="24" r="3" fill="#FFFFFF"/>
  </svg>`,

  "core:parallel-foreach": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#E65100"/>
    <path d="M14 20h20m-20 8h20" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 16l4 4-4 4m0 4l4 4-4 4" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  "core:until-successful": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#1E88E5"/>
    <path d="M16 24a8 8 0 1 1 2 5.5m-3-6h5v-5" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  "core:async": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#7E57C2"/>
    <path d="M27 12l-9 13h7l-4 11 12-15h-7l5-9z" fill="#FFFFFF"/>
  </svg>`,

  "core:cache": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#00897B"/>
    <ellipse cx="24" cy="17" rx="11" ry="4" fill="#FFFFFF"/>
    <path d="M13 17v7c0 2.2 4.9 4 11 4s11-1.8 11-4v-7" fill="none" stroke="#FFFFFF" stroke-width="2.2"/>
    <path d="M13 24v7c0 2.2 4.9 4 11 4s11-1.8 11-4v-7" fill="none" stroke="#FFFFFF" stroke-width="2.2"/>
  </svg>`,

  "core:flow-ref": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#0288D1"/>
    <rect x="13" y="13" width="22" height="22" rx="4" fill="#FFFFFF"/>
    <path d="M18 29V21a3 3 0 0 1 3-3h8m-3-4l4 4-4 4" fill="none" stroke="#0288D1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  "core:raise-error": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#D32F2F"/>
    <path d="M24 13l13 22H11L24 13z" fill="#FFFFFF"/>
    <line x1="24" y1="21" x2="24" y2="28" stroke="#D32F2F" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="24" cy="31.5" r="1.5" fill="#D32F2F"/>
  </svg>`,

  "core:error-handler": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#C62828"/>
    <path d="M24 11l12 5.5v8c0 7-5.5 12-12 14-6.5-2-12-7-12-14v-8l12-5.5z" fill="#FFFFFF"/>
    <line x1="24" y1="18" x2="24" y2="28" stroke="#C62828" stroke-width="2.8" stroke-linecap="round"/>
    <circle cx="24" cy="32" r="1.8" fill="#C62828"/>
  </svg>`,

  "core:on-error-propagate": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#B71C1C"/>
    <path d="M24 12l10 5v7c0 6.5-4.5 11.5-10 13.5-5.5-2-10-7-10-13.5v-7l10-5z" fill="#FFFFFF"/>
    <path d="M20 28l8-8m0 0h-6m6 0v6" fill="none" stroke="#B71C1C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  "core:on-error-continue": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#EF6C00"/>
    <path d="M24 12l10 5v7c0 6.5-4.5 11.5-10 13.5-5.5-2-10-7-10-13.5v-7l10-5z" fill="#FFFFFF"/>
    <path d="M19 24h10m-4-4l4 4-4 4" fill="none" stroke="#EF6C00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  "core:scheduler": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#00897B"/>
    <circle cx="24" cy="24" r="13" fill="#FFFFFF"/>
    <polyline points="24,16 24,24 29,27" fill="none" stroke="#00897B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  "core:generic-source": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#3949AB"/>
    <rect x="14" y="16" width="20" height="16" rx="3" fill="#FFFFFF"/>
    <line x1="20" y1="11" x2="20" y2="16" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="28" y1="11" x2="28" y2="16" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="24" y1="32" x2="24" y2="37" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  "core:generic-operation": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#5C6BC0"/>
    <circle cx="24" cy="24" r="8" fill="none" stroke="#FFFFFF" stroke-width="3"/>
    <path d="M24 11v4m0 18v4m-13-13h4m18 0h4m-18.5-7.5l2.8 2.8m11.4 11.4l2.8 2.8m-17-2.8l2.8-2.8m11.4-11.4l2.8-2.8" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
  </svg>`,

  "core:unknown": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#78909C"/>
    <path d="M19 19a5 5 0 0 1 8.5-3.5c1.5 1.5 1.5 3.5 0 5-1.5 1.5-2.5 2.5-2.5 4.5v1" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
    <circle cx="25" cy="32" r="1.5" fill="#FFFFFF"/>
  </svg>`,

  "core:flow": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#0288D1"/>
    <rect x="12" y="16" width="24" height="16" rx="4" fill="#FFFFFF"/>
    <path d="M21 21l4 3-4 3" fill="none" stroke="#0288D1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  "core:sub-flow": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle cx="24" cy="24" r="22" fill="#00897B"/>
    <path d="M26 12l-7 13h6l-3 11 10-14h-6l5-10z" fill="#FFFFFF"/>
  </svg>`,
};

export function generateSvgSymbols(): string {
  return Object.entries(CORE_ICONS)
    .map(([id, svg]) => {
      const inner = svg
        .replace(/<svg[^>]*>/, "")
        .replace(/<\/svg>/, "");
      return `<symbol id="${id}" viewBox="0 0 48 48">${inner}</symbol>`;
    })
    .join("\n");
}
