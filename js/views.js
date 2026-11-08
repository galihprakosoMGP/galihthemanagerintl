/* ============================================================
   Views: every function returns an HTML string (all text via t()).
   Views.nav / dashboard / project / sub / report / notifs / settings / auth
   ============================================================ */
const fmtDate = (s) => Calc.parse(s).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });
const daysText = (d) => (d < 0 ? t('dLate', { n: -d }) : d === 0 ? t('dToday') : t('dLeft', { n: d }));
const empty = (title, sub, btn = '') => `<div class="empty"><b>${title}</b><span>${sub}</span>${btn}</div>`;
const gapText = (x) => (x.st === 'done' ? t('finished') : x.exp - x.s.progress > 0 ? t('behind', { n: x.exp - x.s.progress }) : t('onSched'));
const hrefOf = (p, s) => `#/p/${p.id}` + (s ? `/s/${s.id}` : '');
const langOptions = () => LANGS.map(([c, n]) => `<option value="${c}" ${c === LANG ? 'selected' : ''}>${n}</option>`).join('');
const fmtDateTime = (ts) => new Date(ts).toLocaleString(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const initials = (n) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
/** Clickable person name: opens the contact card. */
const personBtn = (p, s, m) => (m ? `<button class="person" type="button" data-act="person" data-pid="${p.id}" data-sid="${s.id}" data-id="${m.id}">${esc(m.name)}</button>` : '<span class="mut">–</span>');

const Views = {
  /** Install banner (Android/desktop Chrome: Install button; iPhone: how-to). Hidden when installed or dismissed for 7 days. */
  installBanner() {
    const o = Install.offer(); if (!o) return '';
    return `<div class="bk" role="status"><span>${o === 'ios' ? t('inIos') : t('inBanner')}</span><div class="acts">${o === 'prompt' ? `<button class="btn sm" data-act="install" type="button">${t('inBtn')}</button>` : ''}<button class="btn ghost sm" data-act="install-later" type="button">${t('inLater')}</button></div></div>`;
  },

  /** Reminder shown at the top of the dashboard/project pages when a backup file is due. */
  backupBanner() {
    if (!AutoBackup.due()) return '';
    const c = AutoBackup.cfg();
    return `<div class="bk" role="status"><span>${c.lastExport ? t('abDue', { n: AutoBackup.daysSince(c.lastExport) }) : t('abDueNever')}</span>
      <div class="acts"><button class="btn sm" data-act="backup-now" type="button">${t('abSaveNow')}</button><button class="btn ghost sm" data-act="backup-later" type="button">${t('abLater')}</button></div></div>`;
  },

  snaps(list) {
    return `<div class="mh"><h2>${t('abSnaps')}</h2><button class="x" data-act="close" type="button" aria-label="${t('close')}">×</button></div>
      ${list.length ? `<ul class="nlist">${list.map((s) => `<li class="snap"><span>${fmtDateTime(s.ts)}<small class="mut">${t('projects')}: ${s.n}</small></span><button class="btn ghost sm" type="button" data-act="snap-restore" data-ts="${s.ts}">${t('abRestore')}</button></li>`).join('')}</ul>` : `<p class="mut">${t('abNoSnap')}</p>`}
      <p class="mut small">${t('abNote')}</p><div class="mf"><button class="btn" data-act="close" type="button">${t('close')}</button></div>`;
  },

  nav(active) {
    const links = Data.db.projects.map((p) => `<a href="#/p/${p.id}" class="nl" ${active === p.id ? 'aria-current="page"' : ''}><i style="background:${STATUS[Calc.project(p).status].color}"></i><span>${esc(p.name)}</span></a>`).join('');
    return `<a href="#/" class="nl" ${active === 'home' ? 'aria-current="page"' : ''}>${t('dashboard')}</a><p class="nh">${t('projects')}</p>${links}<button class="btn sm" data-act="add-project" type="button">${t('newProject')}</button>`;
  },

  /* ---------- Dashboard ---------- */
  dashboard() {
    const ps = Data.db.projects.map((p) => ({ p, c: Calc.project(p) }));
    const tot = { ok: 0, risk: 0, late: 0, done: 0 };
    ps.forEach((x) => Object.keys(tot).forEach((k) => { tot[k] += x.c.counts[k]; }));
    const people = ps.reduce((a, x) => a + x.c.people, 0);
    const avg = ps.length ? Math.round(ps.reduce((a, x) => a + x.c.progress, 0) / ps.length) : 0;
    const alerts = Calc.alerts();
    const kpi = (l, v, s, c) => `<div class="card kpi"><small>${l}</small><b ${c ? `style="color:${c}"` : ''}>${v}</b><span>${s}</span></div>`;

    const alertList = alerts.length ? alerts.map((a) => `
      <li class="alert" style="--c:${STATUS[a.st].color}"><i></i><div class="ab"><a href="${hrefOf(a.p, a.s)}"><b>${esc(a.s.name)}</b> <span class="mut">· ${esc(a.p.name)}</span></a>
        <small>${personBtn(a.p, a.s, Calc.person(a.s, 'head'))} · ${gapText({ st: a.st, exp: Calc.expected(a.p, a.s), s: a.s })} · ${daysText(a.days)}</small>
        ${a.s.issue ? `<em>⚠ ${esc(a.s.issue)}</em>` : ''}</div>${Charts.chip(a.st)}</li>`).join('') : `<li class="okmsg">${t('allGood')}</li>`;

    const cards = ps.map(({ p, c }) => `
      <a class="card proj" href="#/p/${p.id}">${Charts.ring(c.progress, STATUS[c.status].color, 84)}
        <div class="pinfo"><h3>${esc(p.name)}</h3><p class="mut">${t('lblDeadline')} ${fmtDate(p.deadline)} · ${daysText(c.days)}</p>
          <div class="mini"><span style="--c:var(--ok)">${c.counts.ok}</span><span style="--c:var(--risk)">${c.counts.risk}</span><span style="--c:var(--late)">${c.counts.late}</span><span style="--c:var(--done)">${c.counts.done}</span><small>${t('peopleN', { n: c.people })}</small></div></div>
        ${Charts.chip(c.status)}</a>`).join('');

    return `<header class="ph"><div><h1>${t('execSummary')}</h1><p class="mut">${new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
      <button class="btn" data-act="add-project" type="button">${t('newProject')}</button></header>
      <section class="kpis">${kpi(t('kActive'), ps.length, t('kActiveSub'))}${kpi(t('kPeople'), people, t('kPeopleSub'))}${kpi(t('kAvg'), avg + '%', t('kAvgSub'))}${kpi(t('kAttn'), alerts.length, t('kAttnSub', { late: tot.late, risk: tot.risk }), alerts.length ? 'var(--or2)' : 'var(--ok)')}</section>
      <section class="two">
        <div class="card"><h2>${t('urgent')}</h2><ul class="alerts">${alertList}</ul></div>
        <div class="card"><h2>${t('statusAll')}</h2>${Charts.donut(tot)}<h2 class="sp">${t('peopleProj')}</h2>${ps.length ? Charts.hbars(ps.map((x) => ({ label: x.p.name, value: x.c.people }))) : ''}</div>
      </section>
      <h2 class="sec">${t('allProjects')}</h2>
      <section class="pgrid">${cards || empty(t('noProjects'), t('noProjectsHint'), `<button class="btn" data-act="add-project" type="button">${t('newProject')}</button>`)}</section>`;
  },

  /* ---------- Project ---------- */
  project(id) {
    const p = Data.project(id), c = Calc.project(p), col = STATUS[c.status].color;
    // Progress vs schedule: every row links to the division (sub-project)
    const rows = c.subs.map((x) => `<li><a class="rowlink" href="${hrefOf(p, x.s)}"><div class="row"><b>${esc(x.s.name)}</b><span>${x.s.progress}% <small class="mut">/ ${t('pvsOf', { n: x.exp })}</small></span></div>${Charts.bar(x.s.progress, x.exp, STATUS[x.st].color)}</a></li>`).join('');

    const subCard = (x) => {
      const s = x.s, d = Calc.daysLeft(s.deadline);
      return `<article class="card sub"><header><h3><a href="${hrefOf(p, s)}">${esc(s.name)}</a></h3>${Charts.chip(x.st)}</header>
        <p class="target"><small>${t('target')}</small>${esc(s.target)}</p>
        <dl class="meta"><div><dt>${esc(Pos.name('head'))}</dt><dd>${personBtn(p, s, Calc.person(s, 'head'))}</dd></div><div><dt>${esc(Pos.name('deputy'))}</dt><dd>${personBtn(p, s, Calc.person(s, 'deputy'))}</dd></div>
          <div><dt>${t('lblPeople')}</dt><dd>${t('peopleN', { n: s.people.length })}</dd></div><div><dt>${t('lblDeadline')}</dt><dd>${fmtDate(s.deadline)}</dd></div></dl>
        <div class="row"><b class="pv">${s.progress}%</b><small class="mut">${gapText(x)} · ${daysText(d)}</small></div>${Charts.bar(s.progress, x.exp, STATUS[x.st].color)}
        <label class="slider"><span>${t('updProg')}</span><input type="range" min="0" max="100" step="5" value="${s.progress}" data-act="prog" data-sid="${s.id}" aria-label="${t('updProg')}: ${esc(s.name)}"></label>
        ${s.issue ? `<p class="issue">⚠ ${esc(s.issue)}</p>` : ''}
        <footer><a class="btn ghost sm" href="${hrefOf(p, s)}">${t('openDetails')}</a></footer></article>`;
    };

    return `<a class="back" href="#/">${t('back')}</a>
      <header class="ph"><div><h1>${esc(p.name)}</h1><p class="mut">${esc(p.desc || '')}</p></div>
        <div class="acts"><button class="btn" data-act="add-sub" type="button">${t('addSub')}</button><button class="btn outline" data-act="export" type="button">${t('exportDoc')}</button><button class="btn ghost" data-act="edit-project" type="button">${t('edit')}</button><button class="btn ghost danger" data-act="del-project" type="button">${t('delete')}</button></div></header>
      <section class="card sum">${Charts.ring(c.progress, col, 104)}
        <div class="facts"><div><small>${t('lblStatus')}</small>${Charts.chip(c.status)}</div><div><small>${t('lblDeadline')}</small><b>${fmtDate(p.deadline)}</b><span class="mut">${daysText(c.days)}</span></div>
          <div><small>${t('lblDivisions')}</small><b>${c.n}</b></div><div><small>${t('lblPeople')}</small><b>${c.people}</b></div><div><small>${t('lblStart')}</small><b>${fmtDate(p.start)}</b></div></div></section>
      <section class="two">
        <div class="card"><h2>${t('pvs')}</h2><p class="mut small">${t('pvsHint')}</p>${rows ? `<ul class="bars">${rows}</ul>` : empty(t('noSubs'), t('noSubsHint'))}</div>
        <div class="card"><h2>${t('statusDivs')}</h2>${Charts.donut(c.counts)}<h2 class="sp">${t('peopleDiv')}</h2>${c.n ? Charts.hbars(c.subs.map((x) => ({ label: x.s.name, value: x.s.people.length }))) : ''}</div>
      </section>
      <h2 class="sec">${t('divHeading')}</h2>
      <section class="sgrid">${c.subs.map(subCard).join('') || empty(t('noSubs'), t('noSubsHint'))}</section>`;
  },

  /* ---------- Sub-project detail: team + progress log with photos ---------- */
  sub(pid, sid) {
    const p = Data.project(pid), s = Data.sub(pid, sid), st = Calc.status(p, s), exp = Calc.expected(p, s), x = { s, st, exp };
    const people = [...s.people].sort((a, b) => Pos.index(a.kind) - Pos.index(b.kind)).map((m) => `<li><button class="prow" type="button" data-act="person" data-pid="${p.id}" data-sid="${s.id}" data-id="${m.id}"><span class="av">${esc(initials(m.name))}</span><span><b>${esc(m.name)}</b><small>${esc(m.role || '')}</small></span><em>${esc(Pos.name(m.kind))}</em></button></li>`).join('');
    const log = s.updates.map((u) => `<li class="upd"><div class="uh"><b>${fmtDate(u.date)}</b><span class="pill">${u.progress}%</span>
        <button class="x sm" type="button" data-act="del-upd" data-uid="${u.id}" aria-label="${t('delete')}">×</button></div>
        ${u.note ? `<p>${esc(u.note)}</p>` : ''}${u.images.length ? `<div class="thumbs">${u.images.map((i) => `<button type="button" class="thumb" data-act="photo" data-img="${i}"><img data-img="${i}" alt=""></button>`).join('')}</div>` : ''}</li>`).join('');

    return `<a class="back" href="#/p/${p.id}">${backArrow()} ${esc(p.name)}</a>
      <header class="ph"><div><h1>${esc(s.name)}</h1><p class="mut">${esc(p.name)}</p></div>
        <div class="acts"><button class="btn ghost" data-act="edit-sub" type="button">${t('edit')}</button><button class="btn ghost danger" data-act="del-sub" type="button">${t('delete')}</button></div></header>
      <section class="card sum">${Charts.ring(s.progress, STATUS[st].color, 104)}
        <div class="facts"><div><small>${t('lblStatus')}</small>${Charts.chip(st)}</div><div><small>${t('lblDeadline')}</small><b>${fmtDate(s.deadline)}</b><span class="mut">${daysText(Calc.daysLeft(s.deadline))}</span></div>
          <div><small>${t('lblPeople')}</small><b>${s.people.length}</b></div><div><small>${t('pvs')}</small><b>${s.progress}% / ${exp}%</b><span class="mut">${gapText(x)}</span></div></div></section>
      <section class="card"><p class="target"><small>${t('target')}</small>${esc(s.target)}</p>${Charts.bar(s.progress, exp, STATUS[st].color)}${s.issue ? `<p class="issue" style="margin-top:14px"><b>${t('issueLbl')}:</b> ${esc(s.issue)}</p>` : ''}</section>
      <section class="two">
        <div class="card"><div class="ch"><h2>${t('team')}</h2><button class="btn sm" data-act="add-person" type="button">${t('addPerson')}</button></div>${people ? `<ul class="team">${people}</ul>` : empty(t('noTeam'), '')}</div>
        <div class="card"><div class="ch"><h2>${t('log')}</h2><button class="btn sm" data-act="add-upd" type="button">${t('addUpdate')}</button></div>${log ? `<ul class="logl">${log}</ul>` : empty(t('noUpdates'), '')}</div>
      </section>`;
  },

  /* ---------- Export document (print / PDF): branching map project -> divisions ---------- */
  report(id) {
    const p = Data.project(id), c = Calc.project(p), rank = { late: 0, risk: 1, ok: 2, done: 3 };
    const subs = [...c.subs].sort((a, b) => rank[a.st] - rank[b.st] || (b.exp - b.s.progress) - (a.exp - a.s.progress));
    const bad = subs.filter((x) => x.st === 'late' || x.st === 'risk'), good = subs.filter((x) => x.st === 'ok' || x.st === 'done');
    const headName = (s) => { const h = Calc.person(s, 'head'); return h ? esc(h.name) + (h.phone ? ` (<bdi dir="ltr">${esc(h.phone)}</bdi>)` : '') : '–'; };
    const who = (x) => `<li style="--c:${STATUS[x.st].color}"><i></i><div><b>${esc(x.s.name)}</b> – ${headName(x.s)}<small>${gapText(x)} · ${daysText(Calc.daysLeft(x.s.deadline))}${x.s.issue ? ` · ⚠ ${esc(x.s.issue)}` : ''}</small></div></li>`;
    const box = (label, n, color) => `<div class="rbox" style="--c:${color}"><b>${n}</b><span>${label}</span></div>`;
    const node = (x) => `<li data-st="${x.st}" style="--c:${STATUS[x.st].color}"><div class="tnode">
      <div class="tn-h"><b>${esc(x.s.name)}</b>${Charts.chip(x.st)}</div>
      <p>${esc(Pos.name('head'))}: <b>${headName(x.s)}</b></p><p>${esc(Pos.name('deputy'))}: ${esc((Calc.person(x.s, 'deputy') || { name: '–' }).name)}</p>
      <p>${t('peopleN', { n: x.s.people.length })} · ${t('lblDeadline')} ${fmtDate(x.s.deadline)} (${daysText(Calc.daysLeft(x.s.deadline))})</p>
      ${Charts.bar(x.s.progress, x.exp, STATUS[x.st].color)}
      <p class="tn-f"><b>${x.s.progress}%</b> · ${gapText(x)} <span class="mut">(${t('pvsOf', { n: x.exp })})</span></p>
      <p class="tn-t">${t('target')}: ${esc(x.s.target)}</p>${x.s.issue ? `<p class="tn-i">⚠ ${esc(x.s.issue)}</p>` : ''}${updates(x)}</div></li>`;
    const updates = (x) => (x.s.updates.length ? `<div class="tn-log"><b>${t('log')} (${x.s.updates.length})</b><ul>${x.s.updates.map((u) => `<li><span class="ud">${fmtDate(u.date)}</span> <span class="up">${u.progress}%</span>${u.note ? ' – ' + esc(u.note) : ''}${u.images.length ? `<div class="rthumbs">${u.images.map((i) => `<img data-img="${i}" alt="">`).join('')}</div>` : ''}</li>`).join('')}</ul></div>` : '');
    const root = `<div class="troot"><small>${t('projectWord')}</small><h3>${esc(p.name)}</h3><p>${esc(p.desc || '')}</p>
      <div class="tr-row">${Charts.chip(c.status)}<b>${c.progress}%</b></div><p>${t('lblDeadline')} ${fmtDate(p.deadline)}<br>${daysText(c.days)}</p><p>${t('lblDivisions')}: ${c.n} · ${t('peopleN', { n: c.people })}</p></div>`;
    return `<article class="paper">
      <header class="rp-head"><div><small>THE MANAGER · ${t('repTitle')}</small><h1>${esc(p.name)}</h1><p>${esc(p.desc || '')}</p></div>
        <p class="rp-meta">${t('printed')}: ${new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })}<br>${t('period')}: ${fmtDate(p.start)} – ${fmtDate(p.deadline)}</p></header>
      <section class="rp-sum">${box(t('sLate'), c.counts.late, STATUS.late.color)}${box(t('sRisk'), c.counts.risk, STATUS.risk.color)}${box(t('sOk'), c.counts.ok, STATUS.ok.color)}${box(t('sDone'), c.counts.done, STATUS.done.color)}${box(t('boxProg'), c.progress + '%', 'var(--tx)')}${box(t('lblPeople'), c.people, 'var(--tx)')}</section>
      <section class="rp-who"><div><h2>${t('needAction', { n: bad.length })}</h2><ul>${bad.map(who).join('') || `<li class="mut">${t('allGood')}</li>`}</ul></div>
        <div><h2>${t('goodList', { n: good.length })}</h2><ul>${good.map(who).join('') || '<li class="mut">–</li>'}</ul></div></section>
      <h2 class="rp-h">${t('mapT')}</h2>
      <div class="tree">${root}${subs.length ? `<ul class="tbranch">${subs.map(node).join('')}</ul>` : ''}</div>
      <footer class="rp-foot">${['late', 'risk', 'ok', 'done'].map((k) => Charts.chip(k)).join(' ')} · ${t('legend')}</footer></article>`;
  },

  /* ---------- Notifications, settings, login ---------- */
  /** One row of the position editor. Default positions cannot be removed, only renamed. */
  posRow(p) {
    const def = DEFAULT_POS.includes(p.id);
    return `<li class="posrow" data-id="${p.id}"><input value="${esc(p.name)}" placeholder="${esc(def ? t(p.id) : t('posName'))}" aria-label="${t('posName')}" maxlength="40">${def ? '' : `<button type="button" class="x" data-act="pos-del" aria-label="${t('delete')}">×</button>`}</li>`;
  },
  positions() {
    return `<div class="mh"><h2>${t('sPos')}</h2><button class="x" data-act="close" type="button" aria-label="${t('close')}">×</button></div><p class="mut small">${t('posHint')}</p>
      <form id="posf" novalidate><ul class="poslist" id="poslist">${Pos.list().map((p) => this.posRow(p)).join('')}</ul><p id="perr2" class="err" role="alert" hidden></p>
        <div class="mf left"><button class="btn ghost sm" type="button" data-act="pos-add">${t('posAdd')}</button><button class="btn ghost sm" type="button" data-act="pos-reset">${t('posReset')}</button></div>
        <div class="mf"><button class="btn ghost" type="button" data-act="close">${t('cancel')}</button><button class="btn" type="submit">${t('save')}</button></div></form>`;
  },

  /** Language picker (used on phones instead of the dropdown): flag + native name. */
  langMenu() {
    return `<div class="mh"><h2>${t('language')}</h2><button class="x" data-act="close" type="button" aria-label="${t('close')}">×</button></div>
      <ul class="langlist">${LANGS.map(([c, n]) => `<li><button type="button" class="litem ${c === LANG ? 'on' : ''}" data-act="setlang" data-lang="${c}" lang="${c}" ${c === LANG ? 'aria-current="true"' : ''}>${Flags.svg(c)}<span>${n}</span>${c === LANG ? '<em>✓</em>' : ''}</button></li>`).join('')}</ul>`;
  },

  notifs() {
    const items = Data.db.notifications;
    return `<div class="mh"><h2>${t('notifications')}</h2><button class="x" data-act="close" type="button" aria-label="${t('close')}">×</button></div>
      ${items.length ? `<ul class="nlist">${items.map((n) => `<li><button class="nitem ${n.read ? '' : 'unread'}" type="button" data-act="open-notif" data-nid="${n.id}"><i class="d-${n.type}"></i><span dir="auto">${esc(Notify.text(n))}<small>${new Date(n.ts).toLocaleString(locale())}</small></span></button></li>`).join('')}</ul>` : `<p class="mut">${t('nNone')}</p>`}
      <div class="mf"><button class="btn ghost" data-act="read-all" type="button">${t('nRead')}</button><button class="btn" data-act="close" type="button">${t('close')}</button></div>`;
  },

  settings() {
    const ns = Notify.status(), ab = AutoBackup.cfg();
    const nBtn = ns === 'on' ? `<span class="chip" style="--c:var(--ok)">${t('sEnabled')}</span>` : ns === 'blocked' ? `<span class="mut">${t('sBlocked')}</span>` : ns === 'na' ? '<span class="mut">–</span>' : `<button class="btn sm" data-act="notif-enable" type="button">${t('sEnable')}</button>`;
    return `<div class="mh"><h2>${t('settings')}</h2><button class="x" data-act="close" type="button" aria-label="${t('close')}">×</button></div>
      <p class="mut small">${APP.name} · ${t('sVersion')} ${APP.version}</p>
      <p class="mut small">${t('sLocalDb')} ${Auth.name() ? '· ' + esc(Auth.name()) : ''}</p>${DB.persistent ? '' : `<p class="warn">${t('sStorage')}</p>`}
      <div class="sset"><h3>${t('inTitle')}</h3>
        ${Install.standalone() ? `<p class="mut small">${t('inDone')}</p>` : Install.deferred ? `<div class="srow"><button class="btn sm" data-act="install" type="button">${t('inBtn')}</button></div>` : `<p class="mut small">${Install.ios() ? t('inIos') : t('inMenu')}</p>`}
        <ul id="inchk" class="chklist"></ul></div>
      <div class="sset"><div class="srow"><h3>${t('sNotif')}</h3>${nBtn}</div></div>
      <div class="sset"><div class="srow"><h3>${t('sPos')}</h3><button class="btn ghost sm" data-act="positions" type="button">${t('edit')}</button></div></div>
      <div class="sset"><h3>${t('sPw')}</h3><form id="pwf" novalidate><div class="fgrid"><label class="fld"><span>${t('sOldPw')}</span><input name="old" type="password" autocomplete="current-password"></label>
        <label class="fld"><span>${t('sNewPw')}</span><input name="nw" type="password" autocomplete="new-password"></label></div><p id="perr" class="err" role="alert" hidden></p><div class="mf"><button class="btn sm" type="submit">${t('save')}</button></div></form></div>
      <div class="sset"><h3>${t('sBackup')}</h3><div class="srow"><button class="btn ghost sm" data-act="export-backup" type="button">${t('sExport')}</button>
        <label class="btn ghost sm filebtn">${t('sImport')}<input id="impfile" type="file" accept="application/json,.json" hidden></label></div></div>
      <div class="sset"><h3>${t('abTitle')}</h3>
        <label class="chk"><input id="abtoggle" type="checkbox" ${ab.on ? 'checked' : ''}><span>${t('abToggle')}</span></label>
        <p class="mut small">${t('abLastFile', { d: ab.lastExport ? fmtDateTime(ab.lastExport) : t('abNever') })}<br>${t('abLastSnap', { d: ab.lastSnap ? fmtDateTime(ab.lastSnap) : t('abNever') })}</p>
        <div class="srow"><button class="btn ghost sm" data-act="snaps" type="button">${t('abSnaps')}</button></div></div>
      <div class="sset"><div class="srow"><button class="btn ghost sm" data-act="demo" type="button">${t('sDemo')}</button><button class="btn ghost sm danger" data-act="erase" type="button">${t('sErase')}</button></div></div>
      <div class="mf"><button class="btn ghost" data-act="signout" type="button">${t('signOut')}</button><button class="btn" data-act="close" type="button">${t('close')}</button></div>`;
  },

  auth(mode) {
    const setup = mode === 'setup';
    return `<div class="acard"><div class="arow"><span class="brand"><span class="logo" aria-hidden="true">${LOGO_SVG}</span><b>THE MANAGER</b></span>
        <select class="langsel" aria-label="${t('language')}">${langOptions()}</select>
        <button class="ibtn langbtn" type="button" data-act="langmenu" aria-label="${t('language')}">${Flags.svg(LANG)}</button></div>
      <h1>${setup ? t('aCreateT') : t('aWelcome', { n: esc(Auth.name()) })}</h1><p class="mut">${t('aLocal')}</p>
      <form id="authf" novalidate>${setup ? `<label class="fld"><span>${t('aName')}</span><input name="name" autocomplete="name"></label>` : ''}
        <label class="fld"><span>${t('aPass')}</span><input name="pw" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}"></label>
        ${setup ? `<label class="fld"><span>${t('aPass2')}</span><input name="pw2" type="password" autocomplete="new-password"></label>` : ''}
        <p id="aerr" class="err" role="alert" hidden></p><button class="btn block" type="submit">${setup ? t('aCreate') : t('aLoginT')}</button></form>
      ${setup ? '' : `<button class="link" data-act="forgot" type="button">${t('aForgot')}</button>`}${DB.persistent ? '' : `<p class="warn">${t('sStorage')}</p>`}</div>`;
  }
};
