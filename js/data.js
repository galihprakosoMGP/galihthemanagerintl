/* ============================================================
   App data (kept in memory, saved to IndexedDB on every change).
   Shape:
   { projects: [ { id, name, desc, start, deadline, subs: [
       { id, name, target, progress, deadline, issue,
         people:  [ { id, name, role, phone, kind: 'head'|'deputy'|'member' } ],
         updates: [ { id, date, progress, note, images: [imageId] } ] } ] } ],
     notifications: [ { id, type, pid, sid, vars, ts, read } ],
     notified: [ 'subId:late', ... ],   // already-announced alerts (avoid repeats)
     settings: { notif: bool, positions: [ { id, name } ], autoBackup: { on, days, lastExport, lastSnap, snooze, start } } }   // positions = job titles; person.kind = position id
   Sample data is in English. Dates are "YYYY-MM-DD".
   ============================================================ */
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISO(d); };
const uid = () => Math.random().toString(36).slice(2, 10);
const SPECIALTIES = ['Prototype Specialist', 'Motor Specialist', 'ESC Specialist', 'QA Specialist', 'Regulation Specialist', 'Battery Specialist', 'Chassis Specialist', 'Software Specialist'];

/* Positions (job titles): 3 built-in defaults the user may rename, plus any custom ones.
   name '' = use the default (translated) name. 'head' and 'deputy' are limited to one person per division. */
const DEFAULT_POS = ['head', 'deputy', 'member'];
const defaultPositions = () => DEFAULT_POS.map((id) => ({ id, name: '' }));
/* Auto backup: on/off, interval (days), last saved backup FILE (0 = never), last snapshot, snooze-until, clock start. */
const defaultAutoBackup = () => ({ on: true, days: 14, lastExport: 0, lastSnap: 0, snooze: 0, start: Date.now() });

function seedData() {
  let n = 10; // fictional US phone numbers (555-01xx is reserved for fiction)
  const T = (...list) => list.map(([name, role], i) => ({ id: uid(), name, role, phone: `+1 555 01${String(n++).padStart(2, '0')}`, kind: i === 0 ? 'head' : i === 1 ? 'deputy' : 'member' }));
  const U = (ago, progress, note) => ({ id: uid(), date: dayOffset(-ago), progress, note, images: [] });
  const S = (name, target, progress, due, issue, people, updates = []) => ({ id: uid(), name, target, progress, deadline: dayOffset(due), issue, people, updates });
  return {
    notifications: [], notified: [], settings: { notif: false, positions: defaultPositions(), autoBackup: defaultAutoBackup() },
    projects: [
      { id: uid(), name: 'VOLTRA Model A1', desc: 'Electric sedan, 500 km range', start: dayOffset(-100), deadline: dayOffset(80), subs: [
        S('Prototype Specialist', 'Prototype v3 ready for road testing', 78, 30, '', T(['Michael Carter', 'Head of Prototyping'], ['Emily Johnson', 'Deputy, chassis integration'], ['Tom Becker', 'Test driver'], ['Sophie Martin', 'Mechanical technician']), [U(20, 60, 'Frame assembly finished.'), U(6, 78, 'Road-test slot booked for next month.')]),
        S('Motor Specialist', 'Motor 220 kW passes dyno test', 55, 45, 'Magnet supplier delayed by 2 weeks', T(['David Miller', 'Powertrain engineer (PhD)'], ['Sarah Williams', 'Electromagnetics'], ['Luca Rossi', 'Winding specialist'], ['Anna Kowalski', 'Test engineer'])),
        S('ESC Specialist', 'ESC firmware v2.0 stable', 40, 40, 'Overheating bug at 90% load', T(['James Anderson', 'Embedded software lead'], ['Jessica Brown', 'Power electronics'], ['Jonas Weber', 'Firmware engineer'], ['Maria Garcia', 'Thermal analyst']), [U(14, 30, 'Bench test reproduced the overheating bug.'), U(5, 40, 'Fix candidate is under review.')]),
        S('QA Specialist', 'Pass 100% of safety tests', 62, 70, '', T(['Emma Wilson', 'Head of QA'], ['Daniel Moore', 'Safety auditor'], ['Hanna Visser', 'Test coordinator'])),
        S('Regulation Specialist', 'Type approval (homologation)', 85, 60, '', T(['Robert Taylor', 'Regulatory affairs lead'], ['Olivia Davis', 'Compliance officer'], ['Pablo Ortega', 'Documentation']))
      ] },
      { id: uid(), name: 'VOLTRA Model C3 SUV', desc: 'Family SUV, 7 seats', start: dayOffset(-40), deadline: dayOffset(200), subs: [
        S('Battery Specialist', '90 kWh pack passes thermal test', 35, 120, '', T(['Christopher Evans', 'Battery systems lead'], ['Rachel Thompson', 'Cell chemistry'], ['Lars Nielsen', 'Thermal engineer'])),
        S('Chassis Specialist', 'Frame passes crash test', 20, 100, '', T(['Matthew Clark', 'Structural engineer'], ['Laura Hughes', 'Materials'], ['Pierre Dubois', 'CAE analyst'])),
        S('Software Specialist', 'Vehicle OS beta release', 10, 90, '3 firmware engineers short', T(['Andrew Scott', 'Software architect'], ['Megan Turner', 'Embedded lead'], ['Sofia Petrov', 'UI developer']))
      ] },
      { id: uid(), name: 'VOLTRA Model T2 City Car', desc: 'Compact city car', start: dayOffset(-150), deadline: dayOffset(15), subs: [
        S('Prototype Specialist', 'Pilot production of 50 units', 100, -5, '', T(['Kevin Roberts', 'Production lead'], ['Amanda Lewis', 'Line supervisor'], ['Marco Bianchi', 'Assembly technician'])),
        S('QA Specialist', 'First batch quality check', 96, -3, 'Waiting for repaint test results', T(['Jennifer Walker', 'QA lead'], ['Brian Hall', 'Inspector'], ['Eva Jansen', 'Paint specialist'])),
        S('Regulation Specialist', 'Road-legal registration', 88, 10, '', T(['Steven Young', 'Regulatory lead'], ['Nicole King', 'Legal liaison']))
      ] }
    ]
  };
}

const Data = {
  db: null,
  async load() {
    let d = null;
    try { d = await DB.get('kv', 'db'); } catch (e) { /* use sample data */ }
    this.db = d && Array.isArray(d.projects) ? this.normalize(d) : seedData();
    if (!d) this.save();
  },
  normalize(d) {
    d.notifications = d.notifications || []; d.notified = d.notified || []; d.settings = d.settings || { notif: false };
    if (!Array.isArray(d.settings.positions)) d.settings.positions = defaultPositions();
    if (!d.settings.autoBackup) d.settings.autoBackup = defaultAutoBackup();
    d.projects.forEach((p) => p.subs.forEach((s) => { s.people = s.people || []; s.updates = s.updates || []; }));
    return d;
  },
  save() { clearTimeout(this._t); this._t = setTimeout(() => DB.set('kv', 'db', this.db).catch(() => {}), 120); },
  async reset() { await DB.clear('img'); this.db = seedData(); this.save(); },
  async eraseAll() { await DB.clear('kv'); await DB.clear('img'); this.db = null; },

  project(id) { return this.db.projects.find((p) => p.id === id); },
  sub(pid, sid) { const p = this.project(pid); return p && p.subs.find((s) => s.id === sid); },
  imageIds() { return this.db.projects.flatMap((p) => p.subs.flatMap((s) => s.updates.flatMap((u) => u.images))); },

  upsertProject(rec) {
    const p = this.project(rec.id); let id = rec.id;
    if (p) Object.assign(p, rec); else { id = uid(); this.db.projects.push({ ...rec, id, subs: [] }); }
    this.save(); return id;
  },
  async removeProject(id) { const p = this.project(id); for (const s of p.subs) await this.removeSub(id, s.id, true); this.db.projects = this.db.projects.filter((x) => x.id !== id); this.save(); },
  upsertSub(pid, rec) {
    const p = this.project(pid), s = p.subs.find((x) => x.id === rec.id);
    let id = rec.id;
    if (s) Object.assign(s, rec); else { id = uid(); p.subs.push({ progress: 0, people: [], updates: [], ...rec, id }); }
    this.save(); return id;
  },
  async removeSub(pid, sid, keepSave) {
    const p = this.project(pid), s = this.sub(pid, sid);
    for (const u of s.updates) for (const i of u.images) await Img.remove(i);
    p.subs = p.subs.filter((x) => x.id !== sid); if (!keepSave) this.save();
  },
  upsertPerson(pid, sid, rec) {
    const s = this.sub(pid, sid);
    if (rec.kind === 'head' || rec.kind === 'deputy') s.people.forEach((m) => { if (m.kind === rec.kind && m.id !== rec.id) m.kind = 'member'; }); // one head, one deputy
    const m = s.people.find((x) => x.id === rec.id);
    if (m) Object.assign(m, rec); else s.people.push({ ...rec, id: uid() });
    this.save();
  },
  removePerson(pid, sid, id) { const s = this.sub(pid, sid); s.people = s.people.filter((m) => m.id !== id); this.save(); },
  addUpdate(pid, sid, entry) { const s = this.sub(pid, sid); s.updates.unshift(entry); s.progress = entry.progress; this.save(); },
  async removeUpdate(pid, sid, id) {
    const s = this.sub(pid, sid), u = s.updates.find((x) => x.id === id);
    for (const i of u.images) await Img.remove(i);
    s.updates = s.updates.filter((x) => x.id !== id); this.save();
  }
};

/** Position helpers (labels follow the app language unless the user renamed them). */
const Pos = {
  list() { return Data.db.settings.positions; },
  name(id) { const p = this.list().find((x) => x.id === id); return (p && p.name) || (DEFAULT_POS.includes(id) ? t(id) : t('member')); },
  index(id) { const i = this.list().findIndex((x) => x.id === id); return i < 0 ? 99 : i; },
  options() { return this.list().map((p) => [p.id, this.name(p.id)]); },
  /** rows = [{id, name}] from the editor. Returns an error message, or '' when saved. */
  save(rows) {
    const clean = rows.map((r) => ({ id: r.id, name: String(r.name || '').trim() }));
    if (clean.some((r) => !DEFAULT_POS.includes(r.id) && !r.name)) return t('errReq', { f: t('posName') });
    const eff = clean.map((r) => (r.name || t(r.id)).toLowerCase());
    if (new Set(eff).size !== eff.length) return t('posDup');
    const keep = new Set(clean.map((r) => r.id));
    Data.db.projects.forEach((p) => p.subs.forEach((s) => s.people.forEach((m) => { if (!keep.has(m.kind)) m.kind = 'member'; }))); // removed position -> member
    Data.db.settings.positions = clean; Data.save(); return '';
  }
};
