/* ============================================================
   Auto backup, every 14 days (two parts):
   1. SNAPSHOT: a copy of the data (without photos) is stored inside this device's
      database automatically; the last 3 are kept and can be restored in Settings.
      Protects against mistakes (deleted a project by accident).
   2. REMINDER: a banner asks you to save a backup FILE. Browsers cannot silently write
      files to your phone, so it is one tap ("Save backup now"); on phones it opens the
      share sheet (save to Files / Drive). Only a file survives clearing browser data.
   ============================================================ */
const AutoBackup = {
  DAY: 86400000,
  cfg() { return Data.db.settings.autoBackup; },
  daysSince(ts) { return Math.floor((Date.now() - ts) / this.DAY); },
  async snapshots() { return (await DB.get('kv', 'snapshots')) || []; },

  /** Run at login, every 30 minutes, and when the app returns to the foreground. */
  async check() {
    if (!Data.db) return;
    const c = this.cfg();
    if (!c.on || (c.lastSnap && Date.now() - c.lastSnap < c.days * this.DAY)) return;
    const list = await this.snapshots();
    list.unshift({ ts: Date.now(), n: Data.db.projects.length, json: JSON.stringify(Data.db) });
    await DB.set('kv', 'snapshots', list.slice(0, 3));
    c.lastSnap = Date.now(); Data.save();
  },
  /** True when a backup file should be saved now (not snoozed). */
  due() {
    if (!Data.db) return false;
    const c = this.cfg();
    return c.on && Date.now() >= c.snooze && Date.now() - (c.lastExport || c.start) >= c.days * this.DAY;
  },
  snooze() { this.cfg().snooze = Date.now() + this.DAY; Data.save(); },
  markExported() { const c = this.cfg(); c.lastExport = Date.now(); c.snooze = 0; Data.save(); },

  async restore(ts) {
    const s = (await this.snapshots()).find((x) => x.ts === ts);
    if (!s) return false;
    const keep = this.cfg(); // keep this device's backup settings
    Data.db = Data.normalize(JSON.parse(s.json)); Data.db.settings.autoBackup = keep; Data.save();
    return true;
  }
};
