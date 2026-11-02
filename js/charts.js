/* ============================================================
   Simple charts (pure SVG/HTML, no libraries). Each returns an HTML string.
   ============================================================ */
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CIRC = 2 * Math.PI * 40;

const Charts = {
  chip(st) { const m = STATUS[st]; return `<span class="chip" style="--c:${m.color}">${t(m.key)}</span>`; },

  ring(pct, color, size = 92, sub = '') {
    return `<div class="ring" style="width:${size}px;height:${size}px" role="img" aria-label="${pct}%">
      <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" class="rt"/>
      <circle cx="50" cy="50" r="40" class="rf" stroke="${color}" stroke-dasharray="${(pct / 100 * CIRC).toFixed(1)} ${CIRC.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>
      <span><b>${pct}%</b>${sub ? `<small>${sub}</small>` : ''}</span></div>`;
  },

  donut(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    let acc = 0;
    const segs = total ? Object.keys(STATUS).filter((k) => counts[k]).map((k) => {
      const len = counts[k] / total * CIRC;
      const s = `<circle cx="50" cy="50" r="40" class="seg" stroke="${STATUS[k].color}" stroke-dasharray="${len.toFixed(1)} ${(CIRC - len).toFixed(1)}" stroke-dashoffset="${(-acc).toFixed(1)}" transform="rotate(-90 50 50)"/>`;
      acc += len; return s;
    }).join('') : '';
    const legend = Object.keys(STATUS).map((k) => `<li><i style="background:${STATUS[k].color}"></i>${t(STATUS[k].key)}<b>${counts[k]}</b></li>`).join('');
    return `<div class="donut-wrap"><div class="donut" role="img" aria-label="${total} ${t('divisionsWord')}"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" class="rt seg"/>${segs}</svg><span><b>${total}</b><small>${t('divisionsWord')}</small></span></div><ul class="legend">${legend}</ul></div>`;
  },

  /** Progress bar; the white marker = where progress should be today. */
  bar(actual, expected, color) {
    return `<div class="bar" role="img" aria-label="${actual}% / ${expected}%"><i style="width:${actual}%;background:${color}"></i><b style="inset-inline-start:${expected}%"></b></div>`;
  },

  hbars(items) {
    const max = Math.max(1, ...items.map((i) => i.value));
    return `<ul class="hbars">${items.map((i) => `<li><span>${esc(i.label)}</span><div class="hb"><i style="width:${i.value / max * 100}%"></i></div><b>${i.value}</b></li>`).join('')}</ul>`;
  }
};
