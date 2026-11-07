/* ============================================================
   App identity and version (shown in Settings).
   For every release: bump `version` here AND CACHE_VERSION in sw.js,
   otherwise installed phones keep serving the old cached files.
   ============================================================ */
const APP = { name: 'THE MANAGER', version: '0.9.0-beta.3', released: '2026-11-05' };

/* Logo mark: a bold geometric "M" (single path, one colour = currentColor-style fill set by CSS).
   Same shape as src/icons/icon.svg (app icon). */
const LOGO_SVG = '<svg viewBox="108 122 296 268" aria-hidden="true"><path d="M116 382V130H168L256 232L344 130H396V382H344V210L256 312L168 210V382Z"/></svg>';
