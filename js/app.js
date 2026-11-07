/* ============================================================
   App: boot, login, routing (#/  #/p/ID  #/p/ID/s/SID), forms, events.
   Flow: user action -> change Data -> render().
   ============================================================ */
const $ = (s) => document.querySelector(s);
const modal = $('#modal');
let ROUTE = {};

/* ---------- Rendering ---------- */
function parseRoute() {
  const m = location.hash.match(/^#\/p\/([^/]+)(?:\/s\/(.+))?$/);
  if (!m || !Data.project(m[1])) return {};
  return m[2] && Data.sub(m[1], m[2]) ? { pid: m[1], sid: m[2] } : { pid: m[1] };
}
function render(keepScroll) {
  const y = window.scrollY; ROUTE = parseRoute();
  $('#nav').innerHTML = Views.nav(ROUTE.pid || 'home');
  $('#view').innerHTML = Views.backupBanner() + (ROUTE.sid ? Views.sub(ROUTE.pid, ROUTE.sid) : ROUTE.pid ? Views.project(ROUTE.pid) : Views.dashboard());
  hydrateImages(); updateBadge(); window.scrollTo(0, keepScroll ? y : 0);
}
function changed(msg) { Notify.check(); render(true); if (msg) toast(msg); }
function hydrateImages() { document.querySelectorAll('img[data-img]:not([src])').forEach(async (im) => { im.src = await Img.url(im.dataset.img); }); }
function updateBadge() { const n = Data.db ? Notify.unread() : 0, b = $('#badge'); b.textContent = n; b.hidden = !n; }
function toast(msg) { const e = $('#toast'); e.textContent = msg; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { e.hidden = true; }, 2400); }

/** Texts that live in static HTML (re-run after changing language). */
function applyStatic() {
  $('#logo').innerHTML = LOGO_SVG;
  $('#tagline').textContent = t('tagline'); document.title = 'THE MANAGER – ' + t('tagline');
  $('#lang').innerHTML = langOptions(); $('#lang').setAttribute('aria-label', t('language'));
  $('#langbtn').innerHTML = Flags.svg(LANG); $('#langbtn').setAttribute('aria-label', t('language'));
  $('#bell').setAttribute('aria-label', t('notifications')); $('#cog').setAttribute('aria-label', t('settings'));
}

/* ---------- Modal + generic form ---------- */
function closeModal() { modal.hidden = true; modal.innerHTML = ''; }
function openModal(html, cls = '') {
  modal.innerHTML = `<div class="box ${cls}" role="dialog" aria-modal="true">${html}</div>`; modal.hidden = false;
  const f = modal.querySelector('input:not([type=file]):not([hidden]),textarea,select') || modal.querySelector('button'); if (f) f.focus();
  hydrateImages();
}
function showErr(m, id = 'merr') { const e = $('#' + id); e.textContent = m; e.hidden = false; }

/** fields: [{name,label,type,req,wide,min,max,list,area,options:[[value,label]]}]; onSave(values) may be async and return an error message. */
function openForm({ title, fields, values = {}, extra = '', onOpen, onSave }) {
  const field = (f) => {
    const v = esc(values[f.name] == null ? '' : values[f.name]);
    const input = f.area ? `<textarea name="${f.name}" rows="2">${v}</textarea>`
      : f.options ? `<select name="${f.name}">${f.options.map(([val, l]) => `<option value="${val}" ${val === values[f.name] ? 'selected' : ''}>${l}</option>`).join('')}</select>`
        : `<input name="${f.name}" type="${f.type || 'text'}" value="${v}" ${f.type === 'tel' ? 'inputmode="tel"' : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.list ? `list="dl-${f.name}"` : ''}>`;
    const dl = f.list ? `<datalist id="dl-${f.name}">${f.list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : '';
    return `<label class="fld ${f.wide ? 'wide' : ''}"><span>${f.label}${f.req ? ' *' : ''}</span>${input}${dl}</label>`;
  };
  openModal(`<div class="mh"><h2>${title}</h2><button class="x" data-act="close" type="button" aria-label="${t('close')}">×</button></div>
    <form id="mf" novalidate><div class="fgrid">${fields.map(field).join('')}${extra}</div><p id="merr" class="err" role="alert" hidden></p>
    <div class="mf"><button type="button" class="btn ghost" data-act="close">${t('cancel')}</button><button class="btn" type="submit">${t('save')}</button></div></form>`);
  if (onOpen) onOpen();
  $('#mf').addEventListener('submit', async (e) => {
    e.preventDefault(); const out = {};
    for (const f of fields) {
      let v = e.target.elements[f.name].value.trim();
      if (f.req && !v) return showErr(t('errReq', { f: f.label }));
      if (f.type === 'number') {
        v = Number(v);
        if (Number.isNaN(v) || v < f.min || v > (f.max == null ? Infinity : f.max)) return showErr(t('errNum', { f: f.label, a: f.min, b: f.max == null ? '∞' : f.max }));
      }
      out[f.name] = v;
    }
    const btn = e.target.querySelector('[type=submit]'); btn.disabled = true;
    let err; try { err = await onSave(out); } catch (x) { err = String(x.message || x); }
    btn.disabled = false;
    if (err) return showErr(err);
    closeModal();
  });
}
function confirmBox(msg, onYes, label = t('yesDelete'), title = t('delete'), cls = 'danger-solid') {
  openModal(`<div class="mh"><h2>${title}</h2></div><p class="cmsg">${msg}</p><div class="mf"><button class="btn ghost" data-act="close" type="button">${t('cancel')}</button><button class="btn ${cls}" id="yes" type="button">${label}</button></div>`);
  $('#yes').addEventListener('click', () => { closeModal(); onYes(); });
}

/* ---------- Forms ---------- */
function projectForm(p) {
  openForm({
    title: p ? t('tEditProject') : t('tNewProject'), values: p || { start: toISO(new Date()) },
    fields: [{ name: 'name', label: t('fProjName'), req: true, wide: true }, { name: 'desc', label: t('fDesc'), wide: true },
      { name: 'start', label: t('fStart'), type: 'date', req: true }, { name: 'deadline', label: t('fProjDead'), type: 'date', req: true }],
    onSave(v) {
      if (v.deadline < v.start) return t('errDates');
      const id = Data.upsertProject({ ...v, id: p && p.id }); location.hash = '#/p/' + id; changed(t('tSaved'));
    }
  });
}
function subForm(pid, s) {
  const p = Data.project(pid);
  openForm({
    title: s ? t('tEditSub') : t('tNewSub'), values: s || { progress: 0, deadline: p.deadline },
    fields: [{ name: 'name', label: t('fDivName'), req: true, wide: true, list: SPECIALTIES },
      { name: 'target', label: t('target'), req: true, wide: true, area: true },
      { name: 'progress', label: t('fProgress'), type: 'number', min: 0, max: 100, req: true }, { name: 'deadline', label: t('fDivDead'), type: 'date', req: true },
      { name: 'issue', label: t('fIssue'), wide: true, area: true }],
    onSave(v) {
      if (v.deadline > p.deadline) return t('errSubDead', { d: fmtDate(p.deadline) });
      const id = Data.upsertSub(pid, { ...v, id: s && s.id });
      if (!s) location.hash = `#/p/${pid}/s/${id}`; // new division: open it to add the team
      changed(t('tSaved'));
    }
  });
}
function personForm(pid, sid, m) {
  openForm({
    title: t('tPerson'), values: m || { kind: 'member' },
    fields: [{ name: 'name', label: t('fName'), req: true, wide: true }, { name: 'role', label: t('fRole'), wide: true },
      { name: 'phone', label: t('fPhone'), type: 'tel' }, { name: 'kind', label: t('fType'), options: Pos.options() }],
    onSave(v) { Data.upsertPerson(pid, sid, { ...v, id: m && m.id }); changed(t('tSaved')); }
  });
}
/** Progress update: new progress %, a note and photos (stored on this device). */
function updateForm(pid, sid) {
  const s = Data.sub(pid, sid);
  openForm({
    title: t('tUpdate'), values: { progress: s.progress },
    fields: [{ name: 'progress', label: t('fProgress'), type: 'number', min: 0, max: 100, req: true }, { name: 'note', label: t('fNote'), wide: true, area: true }],
    extra: `<div class="fld wide"><span>${t('fPhotos')}</span><div class="srow"><label class="btn ghost sm filebtn" for="files">${t('addPhotos')}</label><input id="files" type="file" accept="image/*" multiple hidden><span id="fcount" class="mut small"></span></div><div id="prev" class="prev"></div></div>`,
    onOpen() {
      $('#files').addEventListener('change', (e) => {
        $('#fcount').textContent = e.target.files.length ? t('photosSel', { n: e.target.files.length }) : '';
        $('#prev').innerHTML = ''; [...e.target.files].forEach((f) => { const im = document.createElement('img'); im.src = URL.createObjectURL(f); im.alt = ''; $('#prev').appendChild(im); });
      });
    },
    async onSave(v) {
      const images = []; for (const f of $('#files').files) { try { images.push(await Img.add(f)); } catch (e) { /* skip unreadable file */ } }
      Data.addUpdate(pid, sid, { id: uid(), date: toISO(new Date()), progress: v.progress, note: v.note, images }); changed(t('tSaved'));
    }
  });
}
function showPerson(pid, sid, id) {
  const p = Data.project(pid), s = Data.sub(pid, sid), m = s.people.find((x) => x.id === id);
  const tel = (m.phone || '').replace(/[^\d+]/g, ''), digits = tel.replace(/\D/g, ''), at = `data-pid="${pid}" data-sid="${sid}" data-id="${id}"`;
  openModal(`<div class="mh"><h2>${esc(m.name)}</h2><button class="x" data-act="close" type="button" aria-label="${t('close')}">×</button></div>
    <p class="prole">${esc(m.role || '–')}</p><p class="mut small">${esc(Pos.name(m.kind))} · ${esc(s.name)} · ${esc(p.name)}</p>
    <div class="pphone">${m.phone ? `<b dir="ltr">${esc(m.phone)}</b><div class="mf left"><a class="btn" href="tel:${tel}">${t('call')}</a><a class="btn outline" href="https://wa.me/${digits}" target="_blank" rel="noopener">${t('whatsapp')}</a></div>` : `<span class="mut">${t('noPhone')}</span>`}</div>
    <div class="mf"><button class="btn ghost danger" data-act="del-person" ${at} type="button">${t('delete')}</button><button class="btn ghost" data-act="edit-person" ${at} type="button">${t('edit')}</button></div>`);
}

/* ---------- Export document ---------- */
function openReport(id) {
  $('#report').innerHTML = `<div class="rbar no-print"><b>${t('exportDoc')}</b><div><button class="btn sm" data-act="print" type="button">${t('printPdf')}</button> <button class="btn ghost sm" data-act="close-report" type="button">${t('close')}</button></div></div><div class="rscroll">${Views.report(id)}</div>`;
  $('#report').hidden = false; document.body.classList.add('report-open'); hydrateImages(); // load photos of the progress updates
}
function closeReport() { $('#report').hidden = true; document.body.classList.remove('report-open'); }

/* ---------- Login ---------- */
function showAuth() {
  document.body.classList.add('locked'); const a = $('#auth');
  a.innerHTML = Views.auth(Auth.hasAccount() ? 'login' : 'setup'); a.hidden = false;
}
async function enter() {
  await Data.load(); await AutoBackup.check(); $('#auth').hidden = true; document.body.classList.remove('locked');
  Notify.check(); render();
  if (!DB.persistent) toast(t('sStorage'));
  if (!enter.timer) enter.timer = setInterval(() => { if (Auth.ok && Data.db) { Notify.check(); AutoBackup.check().then(() => { if (AutoBackup.due()) render(true); }); updateBadge(); } }, 30 * 60 * 1000);
}
document.addEventListener('submit', async (e) => {
  const f = e.target;
  if (f.id === 'authf') {
    e.preventDefault(); const setup = !Auth.hasAccount(), v = Object.fromEntries(new FormData(f)), err = (m) => showErr(m, 'aerr');
    if (!Auth.supported()) return err(t('aNoCrypto'));
    if (setup) {
      if (!v.name.trim()) return err(t('errReq', { f: t('aName') }));
      if (v.pw.length < 6) return err(t('aShort'));
      if (v.pw !== v.pw2) return err(t('aMismatch'));
      await Auth.create(v.name.trim(), v.pw); return enter();
    }
    const r = await Auth.login(v.pw);
    if (r === 'ok') return enter();
    return err(r === 'locked' ? t('aLocked', { s: Auth.lockSeconds() }) : t('aBad'));
  }
  if (f.id === 'pwf') {
    e.preventDefault(); const v = Object.fromEntries(new FormData(f));
    if (v.nw.length < 6) return showErr(t('aShort'), 'perr');
    if ((await Auth.change(v.old, v.nw)) !== 'ok') return showErr(t('aBad'), 'perr');
    closeModal(); toast(t('tSaved'));
  }
  if (f.id === 'posf') {
    e.preventDefault();
    const err = Pos.save([...f.querySelectorAll('.posrow')].map((li) => ({ id: li.dataset.id, name: li.querySelector('input').value })));
    if (err) return showErr(err, 'perr2');
    changed(t('tSaved')); openModal(Views.settings());
  }
});

/* ---------- Events ---------- */
document.addEventListener('click', async (e) => {
  if (e.target === modal) return closeModal();
  const b = e.target.closest('[data-act]'); if (!b || b.dataset.act === 'prog' || b.tagName === 'SELECT') return;
  const d = b.dataset, pid = d.pid || ROUTE.pid, sid = d.sid || ROUTE.sid, p = pid && Data.db && Data.project(pid), s = p && sid && Data.sub(pid, sid);
  const A = {
    close: closeModal, 'close-report': closeReport, print: () => { try { window.print(); } catch (x) { toast(t('prUnavail')); } },
    export: () => openReport(ROUTE.pid),
    'add-project': () => projectForm(), 'edit-project': () => projectForm(p),
    'del-project': () => confirmBox(t('delProjQ', { n: esc(p.name) }), async () => { await Data.removeProject(pid); location.hash = '#/'; render(); toast(t('tDeleted')); }),
    'add-sub': () => subForm(pid), 'edit-sub': () => subForm(pid, s),
    'del-sub': () => confirmBox(t('delSubQ', { n: esc(s.name) }), async () => { await Data.removeSub(pid, sid); location.hash = '#/p/' + pid; changed(t('tDeleted')); }),
    person: () => showPerson(pid, sid, d.id), 'add-person': () => personForm(pid, sid), 'edit-person': () => personForm(pid, sid, s.people.find((m) => m.id === d.id)),
    'del-person': () => { const m = s.people.find((x) => x.id === d.id); confirmBox(t('delPersonQ', { n: esc(m.name) }), () => { Data.removePerson(pid, sid, d.id); changed(t('tDeleted')); }); },
    'add-upd': () => updateForm(pid, sid),
    'del-upd': () => confirmBox(t('delUpdQ'), async () => { await Data.removeUpdate(pid, sid, d.uid); changed(t('tDeleted')); }),
    photo: () => openModal(`<button class="x lbx" data-act="close" type="button" aria-label="${t('close')}">×</button><img class="lbimg" data-img="${d.img}" alt="">`, 'lb'),
    langmenu: () => openModal(Views.langMenu()),
    setlang: () => { setLang(d.lang); applyStatic(); closeModal(); if (!$('#auth').hidden) showAuth(); else if (Data.db) render(true); },
    notifs: () => openModal(Views.notifs()),
    'read-all': () => { Notify.markAllRead(); updateBadge(); openModal(Views.notifs()); },
    'open-notif': () => { const n = Data.db.notifications.find((x) => x.id === d.nid); n.read = true; Data.save(); closeModal(); location.hash = Data.sub(n.pid, n.sid) ? `#/p/${n.pid}/s/${n.sid}` : '#/'; render(); },
    settings: () => openModal(Views.settings()),
    positions: () => openModal(Views.positions()),
    'pos-add': () => { const tmp = document.createElement('ul'); tmp.innerHTML = Views.posRow({ id: 'p_' + uid(), name: '' }); const li = tmp.firstElementChild; $('#poslist').appendChild(li); li.querySelector('input').focus(); },
    'pos-del': () => b.closest('.posrow').remove(),
    'pos-reset': () => document.querySelectorAll('#poslist .posrow').forEach((li) => { if (DEFAULT_POS.includes(li.dataset.id)) li.querySelector('input').value = ''; }),
    'notif-enable': async () => { await Notify.enable(); openModal(Views.settings()); },
    'export-backup': async () => { if (await Backup.export()) { AutoBackup.markExported(); render(true); openModal(Views.settings()); } },
    'backup-now': async () => { if (await Backup.export()) { AutoBackup.markExported(); render(true); toast(t('tSaved')); } },
    'backup-later': () => { AutoBackup.snooze(); render(true); },
    snaps: async () => openModal(Views.snaps(await AutoBackup.snapshots())),
    'snap-restore': () => confirmBox(t('abRestoreQ', { d: fmtDateTime(Number(d.ts)) }), async () => { await AutoBackup.restore(Number(d.ts)); Notify.check(); location.hash = '#/'; render(); toast(t('tSaved')); }, t('abRestore'), t('abRestore'), ''),
    demo: () => confirmBox(t('demoQ'), async () => { await Data.reset(); Notify.check(); location.hash = '#/'; render(); toast(t('tSaved')); }),
    erase: () => confirmBox(t('eraseQ'), async () => { await Data.eraseAll(); Auth.logout(); location.reload(); }),
    forgot: () => confirmBox(t('eraseQ'), async () => { await Data.eraseAll(); Auth.logout(); location.reload(); }),
    signout: () => { Auth.logout(); closeModal(); closeReport(); showAuth(); }
  };
  (A[d.act] || (() => {}))();
});

/* Progress slider: live label while dragging, saved on release. */
document.addEventListener('input', (e) => { if (e.target.dataset.act === 'prog') e.target.closest('.sub').querySelector('.pv').textContent = e.target.value + '%'; });
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.dataset.act === 'prog') { Data.upsertSub(ROUTE.pid, { id: el.dataset.sid, progress: Number(el.value) }); changed(); }
  else if (el.id === 'lang' || el.classList.contains('langsel')) { setLang(el.value); applyStatic(); if (!$('#auth').hidden) showAuth(); else if (Data.db) render(true); }
  else if (el.id === 'abtoggle') { AutoBackup.cfg().on = el.checked; Data.save(); render(true); }
  else if (el.id === 'impfile' && el.files[0]) {
    try { await Backup.import(el.files[0]); AutoBackup.markExported(); Notify.check(); closeModal(); render(); toast(t('sImpOk')); } catch (x) { toast(t('sImpBad')); }
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!modal.hidden) closeModal(); else closeReport(); } });
window.addEventListener('hashchange', () => { if (Data.db && Auth.ok) { closeReport(); render(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && Auth.ok && Data.db) { Notify.check(); AutoBackup.check().then(() => { if (AutoBackup.due()) render(true); }); updateBadge(); } });

/* ---------- Boot ---------- */
(async function boot() {
  await DB.open(); await Auth.init(); applyStatic();
  if (Auth.ok) await enter(); else showAuth();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); // ask the browser not to evict our data
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // a new version took over: tell the user (the new files are used the next time the app is opened)
    let first = !hadController;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!first) toast(t('updReady')); first = false; });
  }
})();
