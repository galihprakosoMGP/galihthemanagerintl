/* ============================================================
   Single-user login (one manager). Password is never stored:
   only a salted PBKDF2-SHA256 hash, in this device's database.
   NOTE: this protects access to the app; it does not encrypt the
   stored data. Combine with the device lock for sensitive data.
   ============================================================ */
const Auth = {
  ok: false, rec: null, fails: 0, lockUntil: 0,

  supported() { return !!(window.crypto && crypto.subtle); },
  hasAccount() { return !!this.rec; },
  name() { return this.rec ? this.rec.name : ''; },

  async init() {
    this.rec = (await DB.get('kv', 'auth')) || null;
    try { this.ok = !!this.rec && sessionStorage.getItem('tm.session') === '1'; } catch (e) { this.ok = false; }
  },
  async _hash(pw, salt, iter) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, 256);
    return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
  },
  async _make(name, pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iter = 150000;
    return { name, salt: [...salt], iter, hash: await this._hash(pw, salt, iter) };
  },
  _session(on) { this.ok = on; try { on ? sessionStorage.setItem('tm.session', '1') : sessionStorage.removeItem('tm.session'); } catch (e) { /* ignore */ } },

  async create(name, pw) { this.rec = await this._make(name, pw); await DB.set('kv', 'auth', this.rec); this._session(true); },
  /** returns 'ok' | 'bad' | 'locked' */
  async login(pw) {
    if (Date.now() < this.lockUntil) return 'locked';
    const h = await this._hash(pw, new Uint8Array(this.rec.salt), this.rec.iter);
    if (h === this.rec.hash) { this.fails = 0; this._session(true); return 'ok'; }
    if (++this.fails >= 5) { this.fails = 0; this.lockUntil = Date.now() + 30000; }
    return 'bad';
  },
  lockSeconds() { return Math.max(1, Math.ceil((this.lockUntil - Date.now()) / 1000)); },
  async change(oldPw, newPw) {
    const h = await this._hash(oldPw, new Uint8Array(this.rec.salt), this.rec.iter);
    if (h !== this.rec.hash) return 'bad';
    this.rec = await this._make(this.rec.name, newPw); await DB.set('kv', 'auth', this.rec); return 'ok';
  },
  logout() { this._session(false); }
};
