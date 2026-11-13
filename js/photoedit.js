/* ============================================================
   Photo editor: rotate (90-degree steps) and crop (free, 1:1, 4:3, 16:9) before a photo is saved.
   Plain canvas + pointer events (mouse and touch), no libraries. Non-destructive: the original
   file is kept, so opening the editor again starts from the original.
   PhotoMath = pure helper functions (unit-tested without a browser).
   PhotoEditor.open(file) -> Promise<Blob|null>  (null = cancelled)
   ============================================================ */
const PhotoMath = {
  MIN: 40, // smallest crop size, in display pixels

  /** Rotate a normalized crop rectangle {x,y,w,h} by a quarter turn ('cw' or 'ccw'). */
  rotateRect(c, dir) {
    return dir === 'cw' ? { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w } : { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w };
  },
  /** Largest centred rectangle with width/height = r inside a w x h box. */
  fit(w, h, r) { const rw = Math.min(w, h * r); return { x: (w - rw) / 2, y: (h - rw / r) / 2, w: rw, h: rw / r }; },

  /** New rectangle (px) after dragging a handle by dx,dy. mode: 'move' | 'n','s','e','w','ne','nw','se','sw'.
      ratio > 0 keeps width/height fixed (corners only; the opposite corner stays in place). */
  drag(R, mode, dx, dy, bw, bh, ratio) {
    const MIN = this.MIN, cl = (v, a, b) => Math.min(Math.max(v, a), b);
    if (mode === 'move') return { x: cl(R.x + dx, 0, bw - R.w), y: cl(R.y + dy, 0, bh - R.h), w: R.w, h: R.h };
    const west = mode.includes('w'), north = mode.includes('n');
    if (ratio && mode.length === 2) {
      const ax = west ? R.x + R.w : R.x, ay = north ? R.y + R.h : R.y; // fixed corner
      const w1 = R.w + (west ? -dx : dx), w2 = (R.h + (north ? -dy : dy)) * ratio;
      let w = Math.abs(w1 - R.w) >= Math.abs(w2 - R.w) ? w1 : w2;        // follow the bigger movement
      const maxW = Math.min(west ? ax : bw - ax, (north ? ay : bh - ay) * ratio);
      w = cl(w, Math.max(MIN, MIN * ratio), maxW); const h = w / ratio;
      return { x: west ? ax - w : ax, y: north ? ay - h : ay, w, h };
    }
    let L = R.x, T = R.y, Rt = R.x + R.w, B = R.y + R.h;
    if (west) L = cl(L + dx, 0, Rt - MIN);
    if (mode.includes('e')) Rt = cl(Rt + dx, L + MIN, bw);
    if (north) T = cl(T + dy, 0, B - MIN);
    if (mode.includes('s')) B = cl(B + dy, T + MIN, bh);
    return { x: L, y: T, w: Rt - L, h: B - T };
  },
  /** Output size: the cropped area at full resolution, long side limited to `max` px. */
  outSize(rw, rh, c, max) { const f = Math.min(1, max / Math.max(rw, rh)); return { f, w: Math.max(1, Math.round(c.w * rw * f)), h: Math.max(1, Math.round(c.h * rh * f)) }; }
};

/** Put the canvas in the "rotated image" coordinate system: after this, drawImage(img,0,0) fills [0,rw]x[0,rh]. */
function applyRotation(ctx, rot, rw, rh) {
  if (rot === 1) { ctx.translate(rw, 0); ctx.rotate(Math.PI / 2); }
  else if (rot === 2) { ctx.translate(rw, rh); ctx.rotate(Math.PI); }
  else if (rot === 3) { ctx.translate(0, rh); ctx.rotate(-Math.PI / 2); }
}

const PhotoEditor = {
  _cancel: null,
  isOpen() { return !!this._cancel; },
  close() { if (this._cancel) this._cancel(); },

  async open(file) {
    const img = await new Promise((res) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => res(null); im.src = u;
    });
    if (!img) return null;

    const root = document.getElementById('editor');
    return new Promise((resolve) => {
      let rot = 0, crop = { x: 0, y: 0, w: 1, h: 1 }, ratio = 0, cw = 0, ch = 0, drag = null;
      root.innerHTML = `<div class="ed-bar"><b>${t('edTitle')}</b><span class="mut small">${t('edHint')}</span></div>
        <div class="ed-stage"><div class="ed-wrap"><canvas></canvas><div class="ed-crop">${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<i class="h h-${h}" data-h="${h}"></i>`).join('')}</div></div></div>
        <div class="ed-tools"><button type="button" class="btn ghost sm" data-ed="ccw">↺ ${t('edRotL')}</button><button type="button" class="btn ghost sm" data-ed="cw">↻ ${t('edRotR')}</button>
          <span class="ed-rs"><button type="button" class="edr on" data-r="0">${t('edFree')}</button><button type="button" class="edr" data-r="1">1:1</button><button type="button" class="edr" data-r="1.3333">4:3</button><button type="button" class="edr" data-r="1.7778">16:9</button></span>
          <button type="button" class="btn ghost sm" data-ed="reset">${t('edReset')}</button></div>
        <div class="ed-act"><button type="button" class="btn ghost" data-ed="cancel">${t('cancel')}</button><button type="button" class="btn" data-ed="apply">${t('edApply')}</button></div>`;
      root.hidden = false;
      const stage = root.querySelector('.ed-stage'), wrap = root.querySelector('.ed-wrap'), cv = root.querySelector('canvas'), cropEl = root.querySelector('.ed-crop');
      const dims = () => (rot % 2 ? [img.naturalHeight, img.naturalWidth] : [img.naturalWidth, img.naturalHeight]);
      const place = () => { Object.assign(cropEl.style, { left: crop.x * cw + 'px', top: crop.y * ch + 'px', width: crop.w * cw + 'px', height: crop.h * ch + 'px' }); };
      const setRatio = (r) => {
        ratio = r; wrap.classList.toggle('locked', !!r);
        root.querySelectorAll('.edr').forEach((b) => b.classList.toggle('on', Number(b.dataset.r) === r));
        if (r) { const f = PhotoMath.fit(cw, ch, r); crop = { x: f.x / cw, y: f.y / ch, w: f.w / cw, h: f.h / ch }; }
        place();
      };
      const layout = () => {
        const [rw, rh] = dims(), s = Math.min((stage.clientWidth - 28) / rw, (stage.clientHeight - 28) / rh);
        cw = Math.max(60, Math.round(rw * s)); ch = Math.max(60, Math.round(rh * s));
        wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
        const ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.scale(cv.width / rw, cv.height / rh); applyRotation(ctx, rot, rw, rh); ctx.drawImage(img, 0, 0);
        place();
      };
      const finish = (v) => { window.removeEventListener('resize', layout); root.hidden = true; root.innerHTML = ''; this._cancel = null; resolve(v); };
      this._cancel = () => finish(null);

      cropEl.addEventListener('pointerdown', (e) => {
        e.preventDefault(); cropEl.setPointerCapture(e.pointerId);
        drag = { mode: e.target.dataset.h || 'move', x: e.clientX, y: e.clientY, R: { x: crop.x * cw, y: crop.y * ch, w: crop.w * cw, h: crop.h * ch } };
      });
      cropEl.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const R = PhotoMath.drag(drag.R, drag.mode, e.clientX - drag.x, e.clientY - drag.y, cw, ch, ratio);
        crop = { x: R.x / cw, y: R.y / ch, w: R.w / cw, h: R.h / ch }; place();
      });
      ['pointerup', 'pointercancel'].forEach((n) => cropEl.addEventListener(n, () => { drag = null; }));

      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ed],[data-r]'); if (!b) return;
        if (b.dataset.r !== undefined) return setRatio(Number(b.dataset.r));
        const a = b.dataset.ed;
        if (a === 'cw' || a === 'ccw') { rot = (rot + (a === 'cw' ? 1 : 3)) % 4; crop = PhotoMath.rotateRect(crop, a); layout(); if (ratio) setRatio(ratio); }
        else if (a === 'reset') { rot = 0; crop = { x: 0, y: 0, w: 1, h: 1 }; layout(); setRatio(0); }
        else if (a === 'cancel') finish(null);
        else if (a === 'apply') {
          const [rw, rh] = dims(), o = PhotoMath.outSize(rw, rh, crop, 2560), c = document.createElement('canvas');
          c.width = o.w; c.height = o.h;
          const ctx = c.getContext('2d'); ctx.scale(o.f, o.f); ctx.translate(-crop.x * rw, -crop.y * rh); applyRotation(ctx, rot, rw, rh); ctx.drawImage(img, 0, 0);
          c.toBlob((blob) => finish(blob), 'image/jpeg', 0.92);
        }
      });
      window.addEventListener('resize', layout);
      layout();
    });
  }
};
