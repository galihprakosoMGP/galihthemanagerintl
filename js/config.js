/* ============================================================
   App identity and version (shown in Settings).
   For every release: bump `version` here AND CACHE_VERSION in sw.js,
   otherwise installed phones keep serving the old cached files.
   ============================================================ */
const APP = { name: 'THE MANAGER', version: '0.9.0-beta.6', released: '2026-11-05' };

/* Logo mark: a bold geometric "M" built from two facets (left darker, right lighter) with a centre slit and light edges.
   Same shape as src/icons/icon.svg (app icon). Flat colours on purpose: gradient ids would clash when the logo appears twice. */
const LOGO_SVG = '<svg viewBox="108 122 296 268" aria-hidden="true"><path fill="#12234A" d="M116 382V130H168L251 226V306L168 210V382Z"/><path fill="#1E3F73" d="M396 382V130H344L261 226V306L344 210V382Z"/><path fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M118 131H168L250 227M394 131H344L262 227"/></svg>';
