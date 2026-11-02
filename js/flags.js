/* ============================================================
   Language icons for the phone layout.
   The flags are simple SVG drawings made for this project (no third-party
   icon sets, no emoji - Windows does not render flag emoji), so there is no
   licence to track. Arabic has no single country, so it uses a letter badge.
   Flags = countries, not languages: the menu always shows the language name next to the icon.
   ============================================================ */
const FLAGS = {
  en: '<rect width="30" height="20" fill="#012169"/><path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.6"/><path d="M15 0V20M0 10H30" stroke="#fff" stroke-width="6"/><path d="M15 0V20M0 10H30" stroke="#C8102E" stroke-width="3.6"/>',
  de: '<rect width="30" height="7" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#D00000"/><rect y="13.33" width="30" height="6.67" fill="#FFCE00"/>',
  nl: '<rect width="30" height="7" fill="#AE1C28"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><rect y="13.33" width="30" height="6.67" fill="#21468B"/>',
  es: '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>',
  it: '<rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#CE2B37"/>',
  'zh-HK': '<rect width="30" height="20" fill="#DE2910"/><g fill="#fff" transform="translate(15 10)">' +
    [0, 72, 144, 216, 288].map((a) => `<path d="M0 0C-1.9 -2.3 -1.7 -5.6 0 -6.8C1.7 -5.6 1.9 -2.3 0 0Z" transform="rotate(${a})"/>`).join('') + '</g>'
};

const Flags = {
  /** Small flag (or letter badge for Arabic) for a language code. */
  svg(code) {
    return FLAGS[code]
      ? `<span class="flag" aria-hidden="true"><svg viewBox="0 0 30 20" preserveAspectRatio="none">${FLAGS[code]}</svg></span>`
      : '<span class="flag arb" aria-hidden="true">ع</span>';
  }
};
