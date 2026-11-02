/* ============================================================
   Late-delivery notifications.
   - In-app list (bell) + optional system notifications.
   - Alerts when a division becomes Late / At risk, or is due within 3 days.
   - Each alert is announced once; it can fire again if the situation clears and returns.
   - Web: Notification API / service worker. Native app: Capacitor LocalNotifications plugin.
   ============================================================ */
const KEYS = { late: 'nLate', risk: 'nRisk', due: 'nDue' };
const native = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications;

const Notify = {
  text(n) { return t(KEYS[n.type], n.vars); },
  unread() { return Data.db.notifications.filter((n) => !n.read).length; },
  markAllRead() { Data.db.notifications.forEach((n) => { n.read = true; }); Data.save(); },

  /** Compare the current situation with what was already announced. Returns number of new alerts. */
  check() {
    const now = new Set(), fresh = [];
    Data.db.projects.forEach((p) => p.subs.forEach((s) => {
      const st = Calc.status(p, s), d = Calc.daysLeft(s.deadline), vars = { div: s.name, proj: p.name, n: d };
      const add = (type) => { const key = `${s.id}:${type}`; now.add(key); if (!Data.db.notified.includes(key)) fresh.push({ type, pid: p.id, sid: s.id, vars }); };
      if (st === 'late' || st === 'risk') add(st);
      if (st !== 'done' && d >= 0 && d <= 3) add('due');
    }));
    Data.db.notified = [...now];
    fresh.forEach((f) => Data.db.notifications.unshift({ id: uid(), ...f, ts: Date.now(), read: false }));
    Data.db.notifications = Data.db.notifications.slice(0, 60);
    Data.save();
    if (fresh.length && Data.db.settings.notif) fresh.forEach((f) => this.show(t('notifications'), this.text(f)));
    return fresh.length;
  },

  /** 'on' | 'off' | 'blocked' | 'na' */
  status() {
    if (native()) return Data.db.settings.notif ? 'on' : 'off';
    if (!('Notification' in window)) return 'na';
    if (Notification.permission === 'denied') return 'blocked';
    return Data.db.settings.notif && Notification.permission === 'granted' ? 'on' : 'off';
  },
  async enable() {
    let ok = false;
    try {
      if (native()) ok = (await native().requestPermissions()).display === 'granted';
      else if ('Notification' in window) ok = (await Notification.requestPermission()) === 'granted';
    } catch (e) { ok = false; }
    Data.db.settings.notif = ok; Data.save(); return ok;
  },
  async show(title, body) {
    try {
      if (native()) return await native().schedule({ notifications: [{ id: Math.floor(Math.random() * 2e9), title, body, schedule: { at: new Date(Date.now() + 500) } }] });
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) return await reg.showNotification(title, { body, icon: 'icons/icon-192.png' });
      new Notification(title, { body });
    } catch (e) { /* notifications are best-effort */ }
  }
};
