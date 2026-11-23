/* ==========================================================================
   Lamina — application : routage, projets, enregistrement, modales.
   Chaque calcul est un module déclaré dans window.LaminaModules
   ({ kind, route, title, short, ref, api: { init, render, bind, page, load, flush, dirty, summary }, upgrade }).
   ========================================================================== */
(function () {
  'use strict';
  const ST = window.LaminaStore;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const pct = (r) => (Number.isFinite(r) ? Math.round(r * 100) + ' %' : '∞');
  const pill = (r) => (r == null ? '<span class="pill na">—</span>' : r <= 1 ? '<span class="pill ok">OK</span>' : '<span class="pill ko">NON</span>');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.;′σ]+)/g, '<sub>$1</sub>');
  const blockHead = (n, title, text) => `<div class="block-head"><span class="num">${n}</span><h2>${title}</h2><p>${text || ''}</p></div>`;

  const db = ST.load();
  const MODS = () => window.LaminaModules || {};
  const modOf = (kind) => MODS()[kind];
  const kindOf = (it) => it.kind || (it.state && it.state.kind) || 'vitrage';
  const firstRoute = () => (Object.values(MODS())[0] || {}).route || 'projets';

  function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }

  // ---------- projets ----------
  function summaryOf(it) {
    const m = modOf(kindOf(it));
    if (!m) return null;
    return m.api.summary(m.upgrade(JSON.parse(JSON.stringify(it.state))));
  }
  function renderProjets(app) {
    const kb = ST.usage() / 1024;
    const list = db.projects.map((p) => {
      const isCur = Object.values(db.curs).some((c) => c && c.projectId === p.id);
      const rows = p.items.map((it) => {
        const sm = summaryOf(it) || {};
        const cur = db.curs[kindOf(it)];
        const isIt = cur && cur.projectId === p.id && cur.itemId === it.id;
        return `<tr${isIt ? ' class="gov"' : ''}><td><b>${esc(it.name)}</b></td><td>${esc(sm.type || '')}</td><td>${esc(sm.sec || '')}</td><td class="f">${sub(sm.gov || '')}</td><td class="num">${sm.max == null ? '—' : pct(sm.max)}</td><td>${pill(sm.max)}</td><td class="f">${new Date(it.updated).toLocaleDateString('fr-FR')}</td>
          <td style="white-space:nowrap"><button class="btn sm" data-act="open" data-p="${p.id}" data-i="${it.id}">Ouvrir</button> <button class="btn sm ghost" data-act="dupItem" data-p="${p.id}" data-i="${it.id}">Dupliquer</button> <button class="btn sm ghost" data-act="delItem" data-p="${p.id}" data-i="${it.id}">Supprimer</button></td></tr>`;
      }).join('');
      return `<div class="proj${isCur ? ' current' : ''}">
        <div class="proj-head"><h3>${esc(p.name)}</h3><span class="muted" style="font-size:13px">${p.items.length} calcul${p.items.length > 1 ? 's' : ''}</span><span class="grow"></span>
          <button class="btn sm" data-act="reportProj" data-p="${p.id}"${p.items.length ? '' : ' disabled'}>Fiches NDC du projet</button>
          <button class="btn sm" data-act="exportProj" data-p="${p.id}">Exporter .json</button>
          <button class="btn sm ghost" data-act="renameProj" data-p="${p.id}">Renommer</button>
          <button class="btn sm ghost" data-act="delProj" data-p="${p.id}">Supprimer</button></div>
        ${p.items.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Repère</th><th>Type</th><th>Élément</th><th>Critère dimensionnant</th><th class="num">Taux</th><th></th><th>Modifié</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="empty">Aucun calcul enregistré dans ce projet.</p>'}
      </div>`;
    }).join('');
    app.innerHTML = `<div class="page">
      ${blockHead('—', 'Projets', "Chaque projet regroupe les calculs enregistrés. Les données restent dans ce navigateur (aucun serveur) : exporter le projet en .json pour l'archiver avec l'affaire ou le rouvrir sur un autre poste.")}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
        <button class="btn primary" data-act="newProj">Nouveau projet</button>
        <label class="btn" style="cursor:pointer">Importer un .json<input type="file" accept=".json,application/json" data-act="import" hidden></label>
        <span class="muted" style="font-size:12.5px;align-self:center">Stockage utilisé : ${fmt(kb, 1)} ko sur ~5 000 ko disponibles</span>
      </div>
      <div class="proj-list">${list || '<p class="empty">Aucun projet pour l\'instant. Créez-en un, puis enregistrez vos calculs depuis les onglets de calcul.</p>'}</div>
    </div>`;
  }

  // ---------- modales ----------
  function modal(title, body, actions) {
    return new Promise((resolve) => {
      const bg = document.createElement('div'); bg.className = 'modal-bg';
      bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>${title}</h3>${body}<div class="row-actions">${actions.map((a, i) => `<button class="btn${a.primary ? ' primary' : ''}" data-i="${i}">${a.label}</button>`).join('')}</div></div>`;
      document.body.appendChild(bg);
      const close = (v) => { bg.remove(); resolve(v); };
      bg.addEventListener('click', (e) => { if (e.target === bg) return close(null); const b = e.target.closest('button[data-i]'); if (b) { const a = actions[+b.dataset.i]; close(a.value ? a.value(bg) : null); } });
      bg.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close(null);
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const a = actions.find((x) => x.primary); close(a && a.value ? a.value(bg) : null); }
      });
      const f = bg.querySelector('input,select'); if (f) { f.focus(); if (f.select) f.select(); }
    });
  }
  const confirmBox = (title, text) => modal(title, `<p>${text}</p>`, [{ label: 'Annuler' }, { label: 'Confirmer', primary: true, value: () => true }]);
  function crumbK(kind) {
    const c = db.curs[kind];
    const p = c && db.projects.find((x) => x.id === c.projectId);
    const it = p && p.items.find((x) => x.id === c.itemId);
    return { p, it };
  }
  function askSave(asNew, obj, kind) {
    const cc = db.curs[kind] || Object.values(db.curs).find((x) => x && x.projectId);
    const projOpts = db.projects.map((p) => `<option value="${p.id}"${cc && cc.projectId === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    return modal(asNew ? 'Enregistrer sous…' : 'Enregistrer le calcul', `
      <div class="fields wide" style="grid-template-columns:1fr">
        <label class="field">Projet<select id="mProj">${projOpts}<option value="__new"${db.projects.length ? '' : ' selected'}>+ Nouveau projet…</option></select></label>
        <label class="field" id="mNewWrap"${db.projects.length ? ' hidden' : ''}>Nom du nouveau projet<input type="text" id="mNewName" placeholder="ex. Verrière Montaigne"></label>
        <label class="field">Repère de l'élément<input type="text" id="mName" value="${esc(obj.name)}"></label>
      </div>`, [{ label: 'Annuler' }, { label: 'Enregistrer', primary: true, value: (bg) => ({ proj: $('#mProj', bg).value, newName: $('#mNewName', bg).value.trim(), name: $('#mName', bg).value.trim() }) }]);
  }
  document.addEventListener('change', (e) => { if (e.target.id === 'mProj') { const w = $('#mNewWrap'); if (w) w.hidden = e.target.value !== '__new'; } });
  function storeItem(projectId, itemId, name, obj, kind) {
    const p = db.projects.find((x) => x.id === projectId);
    obj.name = name || obj.name;
    const copy = JSON.parse(JSON.stringify(obj));
    let it = itemId && p.items.find((x) => x.id === itemId);
    if (!it) { it = { id: ST.uid(), created: Date.now() }; p.items.push(it); }
    Object.assign(it, { name: obj.name || 'Sans nom', kind, state: copy, updated: Date.now() });
    db.curs[kind] = { projectId, itemId: it.id };
    toast(ST.save(db) ? 'Enregistré dans « ' + p.name + ' »' : 'Stockage du navigateur plein : exportez puis supprimez d\'anciens projets.');
  }
  async function doSave(asNew, obj, kind) {
    const cur = crumbK(kind);
    if (!asNew && cur.p && cur.it) { storeItem(cur.p.id, cur.it.id, obj.name, obj, kind); topMeta(); return true; }
    const r = await askSave(asNew, obj, kind); if (!r) return false;
    let pid = r.proj;
    if (pid === '__new' || !pid) { const p = { id: ST.uid(), name: r.newName || 'Projet sans nom', created: Date.now(), items: [] }; db.projects.push(p); pid = p.id; }
    storeItem(pid, null, r.name, obj, kind);
    topMeta();
    return true;
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const slug = (s) => String(s || 'lamina').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

  // ---------- événements de la page Projets ----------
  const app = $('#app');
  app.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'INPUT') return;
    const a = b.dataset.act;
    if (a === 'newProj') {
      const n = await modal('Nouveau projet', '<label class="field">Nom<input type="text" id="mN" placeholder="ex. Verrière Montaigne"></label>', [{ label: 'Annuler' }, { label: 'Créer', primary: true, value: (bg) => $('#mN', bg).value.trim() }]);
      if (n == null) return;
      db.projects.push({ id: ST.uid(), name: n || 'Projet sans nom', created: Date.now(), items: [] }); ST.save(db); route();
    } else if (a === 'renameProj') {
      const p = db.projects.find((x) => x.id === b.dataset.p);
      const n = await modal('Renommer le projet', `<label class="field">Nom<input type="text" id="mN" value="${esc(p.name)}"></label>`, [{ label: 'Annuler' }, { label: 'Renommer', primary: true, value: (bg) => $('#mN', bg).value.trim() }]);
      if (n) { p.name = n; ST.save(db); route(); }
    } else if (a === 'delProj') {
      const p = db.projects.find((x) => x.id === b.dataset.p);
      if (!(await confirmBox('Supprimer le projet', `Supprimer « ${esc(p.name)} » et ses ${p.items.length} calcul(s) ? Pensez à l'exporter avant.`))) return;
      db.projects = db.projects.filter((x) => x !== p);
      Object.keys(db.curs).forEach((k) => { if (db.curs[k] && db.curs[k].projectId === p.id) db.curs[k] = null; });
      ST.save(db); route();
    } else if (a === 'open' || a === 'dupItem' || a === 'delItem') {
      const p = db.projects.find((x) => x.id === b.dataset.p), it = p.items.find((x) => x.id === b.dataset.i);
      if (a === 'open') {
        const m = modOf(kindOf(it)); if (!m) return;
        if (m.api.dirty && !(await confirmBox('Ouvrir', 'Les modifications non enregistrées du calcul en cours seront perdues. Continuer ?'))) return;
        m.api.load(JSON.parse(JSON.stringify(it.state)));
        db.curs[kindOf(it)] = { projectId: p.id, itemId: it.id }; ST.save(db);
        location.hash = '#/' + m.route;
      } else if (a === 'dupItem') {
        const c = JSON.parse(JSON.stringify(it)); c.id = ST.uid(); c.name = it.name + ' (copie)'; c.state.name = c.name; c.updated = Date.now();
        p.items.splice(p.items.indexOf(it) + 1, 0, c); ST.save(db); route();
      } else {
        if (!(await confirmBox('Supprimer', `Supprimer le calcul « ${esc(it.name)} » ?`))) return;
        p.items = p.items.filter((x) => x !== it);
        Object.values(db.curs).forEach((c) => { if (c && c.itemId === it.id) c.itemId = null; });
        ST.save(db); route();
      }
    } else if (a === 'exportProj') {
      const p = db.projects.find((x) => x.id === b.dataset.p);
      download('lamina-' + slug(p.name) + '.json', JSON.stringify({ lamina: 1, exported: new Date().toISOString(), project: p }, null, 1), 'application/json');
    } else if (a === 'reportProj') {
      const p = db.projects.find((x) => x.id === b.dataset.p);
      window.LaminaReport.open(p.items.filter((it) => modOf(kindOf(it))).map((it) => ({ state: modOf(kindOf(it)).upgrade(JSON.parse(JSON.stringify(it.state))), project: p.name })));
    }
  });
  app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.act === 'import' && t.files && t.files[0]) {
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const j = JSON.parse(fr.result), p = j.project || j;
          if (!p || !Array.isArray(p.items)) throw new Error('format');
          p.id = ST.uid();
          if (db.projects.some((x) => x.name === p.name)) p.name += ' (import)';
          p.items.forEach((it) => { it.id = ST.uid(); const m = modOf(kindOf(it)); if (m) it.state = m.upgrade(it.state); });
          db.projects.push(p); ST.save(db); route(); toast('Projet « ' + p.name + ' » importé');
        } catch (err) { toast('Fichier non reconnu'); }
      };
      fr.readAsText(t.files[0]);
    }
  });

  // ---------- routage ----------
  let curRoute = null;
  function topMeta() {
    const mr = Object.values(MODS()).find((m) => m.route === curRoute);
    const el = $('#topMeta'); if (!el) return;
    if (mr) { const ps = crumbK(mr.kind).p; el.innerHTML = ps ? `${esc(ps.name)}<span>${esc(mr.short)}</span>` : `${esc(mr.title)}<span>${esc(mr.ref)}</span>`; }
    else el.innerHTML = `Calculs de vitrages<span>${db.projects.length} projet${db.projects.length > 1 ? 's' : ''}</span>`;
  }
  const PAGES = { projets: renderProjets };
  function route() {
    const r = (location.hash.replace(/^#\/?/, '') || firstRoute()).split('/')[0];
    curRoute = r;
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === r));
    const mr = Object.values(MODS()).find((m) => m.route === r);
    if (mr) mr.api.render(app);
    else if (PAGES[r]) PAGES[r](app);
    else if (window.LaminaPages && window.LaminaPages[r]) window.LaminaPages[r](app);
    else { location.hash = '#/' + firstRoute(); return; }
    topMeta();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', () => { Object.values(MODS()).forEach((m) => m.api.flush(db)); ST.save(db); });
  window.LaminaApp = {
    fmt, fmtG, pct, esc, sub, blockHead, pill,
    crumbK, confirmBox, toast, saveDb: () => ST.save(db),
    saveItem: (kind, obj, asNew) => doSave(asNew, obj, kind),
    newItem: (kind) => { const c = db.curs[kind]; db.curs[kind] = c ? { projectId: c.projectId, itemId: null } : null; ST.save(db); topMeta(); }
  };
  Object.values(MODS()).forEach((m) => { m.api.init(db); m.api.bind(app); });
  route();
})();
