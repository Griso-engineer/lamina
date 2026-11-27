/* ==========================================================================
   Lamina — module « Résistance » : f_g;d pour toutes les durées de charge et tous les traitements.
   ========================================================================== */
(function () {
  'use strict';
  const C = window.LaminaResistance, GL = window.LaminaGlass;
  const A = () => window.LaminaApp;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.;′σΔ]+)/g, '<sub>$1</sub>');
  let st = null, dirty = false, db = null;
  const inp = (p, o = {}) => `<input type="${o.type || 'number'}" data-rs="${p}" value="${esc(st[p])}"${(o.type || 'number') === 'number' ? ' step="any"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>`;
  const sel = (p, opts, o = {}) => `<select data-rs="${p}"${o.rr ? ' data-rr="1"' : ''}>${opts.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === String(st[p]) ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`;
  const field = (label, control, unit, hint) => `<label class="field"><span>${label}${unit ? ` <span class="u">[${unit}]</span>` : ''}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const blockHead = (n, t, p) => `<div class="block-head"><span class="num">${n}</span><h2>${t}</h2><p>${p || ''}</p></div>`;

  function init(database) { db = database; st = db.draft_resistance ? C.upgrade(db.draft_resistance) : C.defaultState(); dirty = !!db.draftDirty_resistance; }
  function flush(dbx) { dbx.draft_resistance = st; dbx.draftDirty_resistance = dirty; }
  let saveT = null;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => { flush(db); A().saveDb(); }, 250); }

  function table(R, cls) {
    const T = GL.TEMPERS;
    const row = (r) => `<tr${r.dur.id === 'fdW' ? ' class="gov"' : ''}><td>${sub(r.dur.label)}</td><td class="num">${fmt(r.kmod, 2)}</td>${T.map((t) => `<td class="num">${r.vals[t.id] ? `<b>${fmt(r.vals[t.id].v)}</b>` : '<span class="muted">—</span>'}</td>`).join('')}</tr>`;
    const head = `<tr><th>Durée de charge</th><th class="num">k<sub>mod</sub></th>${T.map((t) => `<th class="num">${esc(t.label)} [MPa]</th>`).join('')}</tr>`;
    const fd = R.rows.filter((r) => r.fd), ec = R.rows.filter((r) => r.ec10), other = R.rows.filter((r) => !r.fd && !r.ec10);
    return `<div class="tbl-wrap"><table class="${cls || 'tbl'}"><thead>${head}</thead><tbody>
      <tr><td colspan="${T.length + 2}" class="f"><b>Charges du tableau 25 de FD P78-468</b> (k<sub>mod</sub> forfaitaire)</td></tr>${fd.map(row).join('')}
      <tr><td colspan="${T.length + 2}" class="f"><b>Charges du tableau A.3 de NF EN 19100-1 (Eurocode 10)</b> (k<sub>mod</sub> forfaitaire, dont charges d’exploitation et de foule)</td></tr>${ec.map(row).join('')}
      <tr><td colspan="${T.length + 2}" class="f"><b>Durées cumulées</b> (k<sub>mod</sub> = 0,663·t<sup>−1/16</sup>, NF EN 16612)</td></tr>${other.map(row).join('')}
    </tbody></table></div>`;
  }

  function render(app) {
    const { p } = A().crumbK('resistance');
    app.innerHTML = `<div class="page">
      <div class="actionbar">
        <div class="grow"><span class="crumb">${p ? `Projet <b>${esc(p.name)}</b> ›` : 'Hors projet ›'} <b id="rCrumb">${esc(st.name || 'Sans nom')}</b></span><span class="dirty" id="rDirty">${dirty ? 'modifié · non enregistré' : ''}</span></div>
        <div class="btn-group"><button class="btn" data-ract="new">Nouveau</button><button class="btn" data-ract="save">Enregistrer</button><button class="btn" data-ract="saveas">Enregistrer sous…</button></div>
        <button class="btn primary" data-ract="report">Fiche NDC ↗</button>
      </div>
      ${blockHead('01', 'Verre et coefficients', 'f<sub>g;d</sub> = k<sub>e</sub>·k<sub>mod</sub>·k<sub>sp</sub>·f<sub>g;k</sub>/γ<sub>M;A</sub> + k<sub>v</sub>·(f<sub>b;k</sub> − f<sub>g;k</sub>)/γ<sub>M;v</sub>. Coefficients partiels selon NF EN 16612 ou selon FD P78-468 (France).')}
      <div class="fields wide">
        ${field('Repère', inp('name', { type: 'text', ph: 'ex. Verre float' }))}
        ${field('Méthode — γ<sub>M;A</sub> / γ<sub>M;v</sub>', sel('gRef', [['fd', 'FD P78-468 (France) — 1,5 / 1,5'], ['en', 'NF EN 16612 — 1,8 / 1,2'], ['custom', 'Coefficients saisis']], { rr: true }))}
        ${field('Surface', sel('surface', GL.SURFACES.map((x) => [x.id, `${x.label} — kₛₚ = ${String(x.ksp).replace('.', ',')}`])))}
      </div>
      <div class="fields" style="margin-top:14px">
        ${field('γ<sub>M;A</sub>', inp('gMA'), '', 'verre recuit')}${field('γ<sub>M;v</sub>', inp('gMv'), '', 'précontrainte')}
        ${field('f<sub>g;k</sub>', inp('fgk'), 'MPa', 'verre recuit : 45 MPa')}
        ${field('k<sub>e</sub>', inp('ke'), '', st.gRef === 'fd' ? 'recuit seul (FD tableau 24) : 0,8 avec bord libre à bords bruts ou AA' : 'facteur de bord')}
        ${field('k<sub>v</sub>', sel('kv', [['1', 'Trempe horizontale — 1,0'], ['0.6', 'Trempe verticale — 0,6']]))}
        ${field('Durée supplémentaire', inp('hrs', { ph: 'heures' }), 'h', 'facultatif : ajoute une ligne')}
      </div>
      ${blockHead('02', 'Résistance de calcul f<sub>g;d</sub>', 'En MPa, pour toutes les durées de charge et tous les traitements. Ces valeurs se reportent ensuite dans l’onglet Pré-dimensionnement.')}
      <div id="rOut"></div>
    </div>`;
    refresh();
  }
  function refresh() {
    const R = C.compute(st), box = $('#rOut');
    const cn = $('#rCrumb'); if (cn) cn.textContent = st.name || 'Sans nom';
    const dd = $('#rDirty'); if (dd) dd.textContent = dirty ? 'modifié · non enregistré' : '';
    if (!box) return;
    if (!R.valid) { box.innerHTML = R.warnings.map((x) => `<p class="note warn">${sub(x)}</p>`).join(''); return; }
    box.innerHTML = table(R) + R.info.map((x) => `<p class="note">${sub(x)}</p>`).join('') +
      `<p class="note">Surface : ${esc(R.sf.label)}, k<sub>sp</sub> = ${fmtG(R.sf.ksp, 2)} ; f<sub>b;k</sub> : durci ${R.sf.fbk.durci || '—'}, trempé ${R.sf.fbk.trempe || '—'}, trempé chimiquement ${R.sf.fbk.chimique || '—'} MPa. Pour une combinaison de charges, k<sub>mod</sub> est celui de la charge de plus courte durée (FD P78-468 § 8.1.4 et 10.4).</p>`;
  }

  function page(state, project, idx, total, opts) {
    const s = C.upgrade(JSON.parse(JSON.stringify(state))), R = C.compute(s);
    if (!R.valid) return `<section class="rp-page"><p>${esc(s.name)} : données invalides.</p></section>`;
    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const ref = s.gRef === 'fd' ? 'FD P78-468' : s.gRef === 'en' ? 'NF EN 16612' : 'coefficients saisis';
    return `<section class="rp-page"><header class="rp-head"><div class="l"><b>${esc(project || 'Note de calcul')}</b>Verre — résistance de calcul en flexion (NF EN 16612${s.gRef === 'fd' ? ', FD P78-468' : ''})${opts && opts.ref ? ' · ' + esc(opts.ref) : ''}</div><div class="r">${!opts || opts.logo ? '<div class="logo-s">tracés</div>' : ''}${esc(s.name)} · ${date}</div></header>
      <div class="rp-title"><h1>${esc(s.name)}${total > 1 ? ` (${idx + 1}/${total})` : ''}</h1><p>${esc(R.sf.label)} · ${esc(ref)} : γ<sub>M;A</sub> = ${fmtG(R.p.gMA, 2)}, γ<sub>M;v</sub> = ${fmtG(R.p.gMv, 2)}, f<sub>g;k</sub> = ${fmtG(R.p.fgk, 1)} MPa, k<sub>sp</sub> = ${fmtG(R.sf.ksp, 2)}, k<sub>e</sub> = ${fmtG(R.p.ke, 2)}, k<sub>v</sub> = ${fmtG(R.p.kv, 2)}</p></div>
      <h2><span class="n">1</span>f<sub>g;d</sub> [MPa]</h2>${table(R, '')}
      ${R.info.length ? `<p style="font-size:7.6pt"><b>Remarques :</b> ${R.info.map(sub).join(' ')}</p>` : ''}
      <p style="font-size:7.4pt;color:#555">f<sub>g;d</sub> = k<sub>e</sub>·k<sub>mod</sub>·k<sub>sp</sub>·f<sub>g;k</sub>/γ<sub>M;A</sub> + k<sub>v</sub>·(f<sub>b;k</sub> − f<sub>g;k</sub>)/γ<sub>M;v</sub> ; k<sub>mod</sub> : FD P78-468 tableau 25, ou 0,663·t<sup>−1/16</sup>.</p></section>`;
  }

  function bind(app) {
    const onEdit = (e) => {
      const t = e.target; if (!t.dataset || !t.dataset.rs || t.closest('.modal')) return;
      if (e.type === 'input' && t.tagName === 'SELECT') return;
      st[t.dataset.rs] = t.value;
      if (t.dataset.rs === 'gRef' && GL.GAMMAS[t.value]) { st.gMA = GL.GAMMAS[t.value].gMA; st.gMv = GL.GAMMAS[t.value].gMv; }
      if (t.dataset.rs === 'gMA' || t.dataset.rs === 'gMv') { st.gRef = C.gRefOf(st); const s2 = $('[data-rs="gRef"]'); if (s2) s2.value = st.gRef; }
      dirty = true; persist();
      if (t.dataset.rr && e.type === 'change') { const y = window.scrollY; render(app); window.scrollTo(0, y); return; }
      refresh();
    };
    app.addEventListener('input', onEdit);
    app.addEventListener('change', onEdit);
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ract]'); if (!b) return;
      const a = b.dataset.ract, y = window.scrollY;
      if (a === 'save' || a === 'saveas') { const ok = await A().saveItem('resistance', st, a === 'saveas'); if (ok) { dirty = false; persist(); render(app); window.scrollTo(0, y); } }
      else if (a === 'new') {
        if (dirty && !(await A().confirmBox('Nouvelle résistance', 'Les modifications non enregistrées seront perdues. Continuer ?'))) return;
        st = C.defaultState(); A().newItem('resistance'); dirty = false; persist(); render(app);
      } else if (a === 'report') window.LaminaReport.open([{ state: st, project: A().crumbK('resistance').p ? A().crumbK('resistance').p.name : '' }]);
    });
  }
  function load(state) { st = C.upgrade(state); dirty = false; persist(); }

  const api = { init, render, bind, page, load, flush, get state() { return st; }, get dirty() { return dirty; }, summary: C.summary };
  window.LaminaModules = window.LaminaModules || {};
  window.LaminaModules.resistance = { kind: 'resistance', route: 'resistance', title: 'Résistance du verre', short: 'résistance', ref: 'NF EN 16612 · FD P78-468', api, upgrade: C.upgrade };
})();
