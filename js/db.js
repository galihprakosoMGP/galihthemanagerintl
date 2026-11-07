/* ============================================================
   Storage layer: everything lives on THIS device (IndexedDB).
   - store 'kv'  : app data (JSON) and the account record
   - store 'img' : photos (Blobs)
   If IndexedDB is unavailable (private mode, sandbox) it falls back
   to memory and DB.persistent = false (the UI shows a warning).
   ============================================================ */
const DB = {
  idb: null, persistent: false, mem: { kv: {}, img: {} },

  async open() {
    try {
      this.idb = await new Promise((resolve, reject) => {
        const req = indexedDB.open('the-manager', 1);
        req.onupgradeneeded = () => { req.result.createObjectStore('kv'); req.result.createObjectStore('img'); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      this.persistent = true;
    } catch (e) { this.persistent = false; }
  },
  _tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.idb.transaction(store, mode), req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    });
  },
  async get(store, key) { return this.persistent ? this._tx(store, 'readonly', (s) => s.get(key)) : this.mem[store][key]; },
  async set(store, key, val) { if (!this.persistent) { this.mem[store][key] = val; return; } await this._tx(store, 'readwrite', (s) => s.put(val, key)); },
  async del(store, key) { if (!this.persistent) { delete this.mem[store][key]; return; } await this._tx(store, 'readwrite', (s) => s.delete(key)); },
  async clear(store) { if (!this.persistent) { this.mem[store] = {}; return; } await this._tx(store, 'readwrite', (s) => s.clear()); }
};

/* Photos: resized to max 1280px JPEG before saving, so the database stays small. */
const Img = {
  urls: {},
  _load(file) {
    return new Promise((resolve, reject) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); resolve(im); };
      im.onerror = () => reject(new Error('image'));
      im.src = u;
    });
  },
  async add(file) {
    const im = await this._load(file), k = Math.min(1, 1280 / Math.max(im.width, im.height));
    const c = document.createElement('canvas');
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82)), id = uid();
    await DB.set('img', id, blob); return id;
  },
  async url(id) {
    if (!this.urls[id]) { const b = await DB.get('img', id); if (!b) return ''; this.urls[id] = URL.createObjectURL(b); }
    return this.urls[id];
  },
  async remove(id) { await DB.del('img', id); if (this.urls[id]) { URL.revokeObjectURL(this.urls[id]); delete this.urls[id]; } }
};

/* Backup file = JSON with all data and photos (photos as data URLs). The account password is NOT included. */
const Backup = {
  async export() {
    const images = {};
    for (const id of Data.imageIds()) {
      const b = await DB.get('img', id);
      if (b) images[id] = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
    }
    const blob = new Blob([JSON.stringify({ app: 'the-manager', v: 1, db: Data.db, images })], { type: 'application/json' });
    const name = 'the-manager-backup-' + toISO(new Date()) + '.json', file = new File([blob], name, { type: 'application/json' });
    // Phones: open the share sheet (save to Files / Drive / WhatsApp...). Elsewhere: normal download.
    if (matchMedia('(pointer:coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'THE MANAGER backup' }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return false; /* cancelled: not saved */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  },
  async import(file) {
    const j = JSON.parse(await file.text());
    if (j.app !== 'the-manager' || !j.db || !Array.isArray(j.db.projects)) throw new Error('bad backup');
    for (const [id, d] of Object.entries(j.images || {})) {
      const [h, b] = d.split(','), bin = atob(b), a = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
      await DB.set('img', id, new Blob([a], { type: h.slice(5, h.indexOf(';')) }));
    }
    Data.db = Data.normalize(j.db); Data.save();
  }
};
