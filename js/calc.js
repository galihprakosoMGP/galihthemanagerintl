/* ============================================================
   Calculations: status, progress, alerts.
   Division status rules:
     progress 100%                      -> done
     past deadline and not finished     -> late
     behind schedule by more than 25 pt -> late
     behind schedule by 11-25 pt        -> risk
     otherwise                          -> ok
   "Schedule" = % of time elapsed from the project start to the
   division deadline. Change the thresholds in Calc.status().
   ============================================================ */
const STATUS = {
  ok: { key: 'sOk', color: 'var(--ok)' }, risk: { key: 'sRisk', color: 'var(--risk)' },
  late: { key: 'sLate', color: 'var(--late)' }, done: { key: 'sDone', color: 'var(--done)' }
};

const Calc = {
  today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; },
  parse(s) { return new Date(s + 'T00:00:00'); },
  daysLeft(deadline) { return Math.round((this.parse(deadline) - this.today()) / 86400000); },
  expected(p, s) {
    const a = this.parse(p.start), b = this.parse(s.deadline);
    if (b <= a) return 100;
    return Math.round(Math.min(1, Math.max(0, (this.today() - a) / (b - a))) * 100);
  },
  status(p, s) {
    if (s.progress >= 100) return 'done';
    if (this.daysLeft(s.deadline) < 0) return 'late';
    const gap = this.expected(p, s) - s.progress;
    return gap > 25 ? 'late' : gap > 10 ? 'risk' : 'ok';
  },
  person(s, kind) { return s.people.find((m) => m.kind === kind); },

  project(p) {
    const subs = p.subs.map((s) => ({ s, st: this.status(p, s), exp: this.expected(p, s) }));
    const n = subs.length, counts = { ok: 0, risk: 0, late: 0, done: 0 };
    subs.forEach((x) => counts[x.st]++);
    const progress = n ? Math.round(subs.reduce((a, x) => a + Number(x.s.progress), 0) / n) : 0;
    const people = subs.reduce((a, x) => a + x.s.people.length, 0), days = this.daysLeft(p.deadline);
    let status = !n ? 'ok' : counts.late ? 'late' : counts.risk ? 'risk' : counts.done === n ? 'done' : 'ok';
    if (status !== 'done' && days < 0) status = 'late';
    return { subs, n, counts, progress, people, days, status };
  },
  /** Divisions that need attention, most urgent first. */
  alerts() {
    const out = [];
    Data.db.projects.forEach((p) => p.subs.forEach((s) => {
      const st = this.status(p, s);
      if (st === 'risk' || st === 'late') out.push({ p, s, st, gap: this.expected(p, s) - s.progress, days: this.daysLeft(s.deadline) });
    }));
    return out.sort((a, b) => (b.st === 'late') - (a.st === 'late') || b.gap - a.gap);
  }
};
