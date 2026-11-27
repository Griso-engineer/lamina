/* ==========================================================================
   Lamina — module « Épaisseur équivalente » : interface, coupe, fiche NDC.
   ========================================================================== */
(function () {
  'use strict';
  const C = window.LaminaEpaisseur, GL = window.LaminaGlass;
  const A = () => window.LaminaApp;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.;′σΔ]+)/g, '<sub>$1</sub>');
  const INK = '#111110', ACC = '#6b8fc2', GLASS = '#e3eaf4', RED = '#c0392b', DARK = '#3f5f8f';
  let st = null, dirty = false, db = null;
  const get = (p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), st);
  function set(p, v) { const ks = p.split('.'); let a = st; ks.slice(0, -1).forEach((k) => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
  const inp = (p, o = {}) => `<input type="${o.type || 'number'}" data-ep="${p}" value="${esc(get(p))}"${(o.type || 'number') === 'number' ? ' step="any"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>`;
  const sel = (p, opts, o = {}) => { const v = String(get(p)); return `<select data-ep="${p}"${o.rr ? ' data-rr="1"' : ''}>${opts.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === v ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`; };
  const chk = (p, label, rr) => `<label class="check"><input type="checkbox" data-ep="${p}"${get(p) ? ' checked' : ''}${rr ? ' data-rr="1"' : ''}> ${label}</label>`;
  const field = (label, control, unit, hint, wide) => `<label class="field"${wide ? ' style="grid-column:1/-1;max-width:640px"' : ''}><span>${label}${unit ? ` <span class="u">[${unit}]</span>` : ''}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const blockHead = (n, t, p) => `<div class="block-head"><span class="num">${n}</span><h2>${t}</h2><p>${p || ''}</p></div>`;

  function init(database) { db = database; st = db.draft_epaisseur ? C.upgrade(db.draft_epaisseur) : C.defaultState(); dirty = !!db.draftDirty_epaisseur; }
  function flush(dbx) { dbx.draft_epaisseur = st; dbx.draftDirty_epaisseur = dirty; }
  let saveT = null;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => { flush(db); A().saveDb(); }, 250); }

  // coupe dilatée : plis, intercalaires, plan de symétrie du feuilleté
  function section(R, W = 440) {
    const g = R.g; if (!g) return '';
    const k = Math.min(6, 170 / g.total), H = g.total * k + 34, x0 = 96, x1 = W - 150, yb = H - 16;
    let o = '', y = yb;
    g.h.forEach((h, i) => {
      const hh = h * k;
      o += `<rect x="${x0}" y="${y - hh}" width="${x1 - x0}" height="${hh}" fill="${GLASS}" stroke="${INK}" stroke-width="1"/>`;
      o += `<text x="${x0 - 8}" y="${y - hh / 2 + 4}" font-size="11" text-anchor="end" fill="${INK}">pli ${i + 1} · ${fmtG(h, 2)}</text>`;
      o += `<text x="${x1 + 8}" y="${y - hh / 2 + 4}" font-size="10.5" fill="#6e6d69">hₘ = ${fmtG(g.hm[i], 2)} mm</text>`;
      y -= hh;
      if (i < g.n - 1) { const hi = g.hints[i] * k; o += `<rect x="${x0}" y="${y - hi}" width="${x1 - x0}" height="${hi}" fill="${ACC}" opacity=".55"/>`; y -= hi; }
    });
    const yg = yb - g.zg * k;
    o += `<line x1="${x0 - 4}" y1="${yg}" x2="${x1 + 4}" y2="${yg}" stroke="${DARK}" stroke-width="1.2" stroke-dasharray="6 3"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block" font-family="Inter, sans-serif">${o}</svg>
      <p class="cap">Coupe dilatée, pli 1 en bas. Tireté : plan de symétrie du feuilleté, depuis lequel sont mesurées les distances h<sub>m</sub> (NF EN 16612 annexe D).</p>`;
  }

  // ======================================================================
  //  PAGE
  // ======================================================================
  function render(app) {
    const { p } = A().crumbK('epaisseur');
    const n = st.plies.length, custom = st.il === 'custom', il = GL.INTERLAYER[st.il];
    const plyRows = st.plies.map((x, i) => `<tr><td class="rowh">Pli ${i + 1}${i === 0 ? ' <small>(bas)</small>' : ''}</td><td><input type="number" step="any" data-ep="plies.${i}.h" value="${esc(x.h)}"></td>
      <td>${i < n - 1 ? `<input type="number" step="any" data-ep="hints.${i}" value="${esc(st.hints[i])}">` : '<span class="muted" style="font-size:12px;padding:0 6px">—</span>'}</td><td class="ro" id="eHm${i}"></td>
      <td>${n > 1 ? `<button class="btn sm ghost" data-eact="delPly" data-i="${i}" title="Supprimer ce pli">✕</button>` : ''}</td></tr>`).join('');
    const ee = st.eet, EC = C.EET_CASE[ee.cas] || C.EET_CASES[0];
    const loadsG = il && il.G ? GL.loadVariants(il, 'G') : [];
    app.innerHTML = `<div class="page">
      <div class="actionbar">
        <div class="grow"><span class="crumb">${p ? `Projet <b>${esc(p.name)}</b> ›` : 'Hors projet ›'} <b id="eCrumb">${esc(st.name || 'Sans nom')}</b></span><span class="dirty" id="eDirty">${dirty ? 'modifié · non enregistré' : ''}</span></div>
        <span id="eVerdict"></span>
        <div class="btn-group"><button class="btn" data-eact="new">Nouveau</button><button class="btn" data-eact="save">Enregistrer</button><button class="btn" data-eact="saveas">Enregistrer sous…</button></div>
        <button class="btn primary" data-eact="report">Fiche NDC ↗</button>
      </div>
      ${blockHead('01', 'Composition', 'Plis de verre de bas en haut et intercalaire au-dessus de chaque pli (épaisseurs nominales ; FD P78-468 § 10.6.1 : l’épaisseur nominale de l’intercalaire doit être connue).')}
      <div class="cols2"><div>
        <div class="fields">${field('Repère', inp('name', { type: 'text', ph: 'ex. Feuilleté F1' }))}</div>
        <div class="tbl-wrap" style="margin-top:12px"><table class="grid"><thead><tr><th class="rowh">Pli</th><th>h [mm]</th><th>Intercalaire au-dessus [mm]</th><th>h<sub>m</sub> [mm]</th><th></th></tr></thead><tbody>${plyRows}</tbody></table></div>
        <div style="margin:8px 0 14px"><button class="btn sm" data-eact="addPly">+ pli</button></div>
      </div>
      <div><div class="fig" id="eFig"></div></div></div>
      ${blockHead('02', 'Méthode ω', 'NF EN 16612 annexe D : h<sub>ef;w</sub> = (Σh<sub>k</sub>³ + 12·ω·Σh<sub>k</sub>·h<sub>m,k</sub>²)<sup>1/3</sup> ; h<sub>ef;σ,j</sub> = √(h<sub>ef;w</sub>³ / (h<sub>j</sub> + 2·ω·h<sub>m,j</sub>)). ω par cas de charge : FD P78-468 tableau 32 ou DTA de l’intercalaire.')}
      <div class="fields wide">${field('Intercalaire', sel('il', GL.INTERLAYERS.map((x) => [x.id, `${x.label}${x.id === 'custom' ? '' : ' — ' + x.src}`]), { rr: true }), '', '', true)}</div>
      <div id="eW" style="margin-top:14px"></div>
      <p class="note">Pour une combinaison de charges, ω est celui de la charge de plus courte durée (FD P78-468 § 10.6.2 et annexe B). Un intercalaire non évalué selon l’EN 16613, ou hors de la plage de température et de durée concernée, est pris avec ω = 0 ; intercalaire rigide : évaluation spécifique (DTA).</p>
      ${blockHead('03', 'Méthode EET', 'EN 19100-2 annexe A (informative) : paramètre de couplage η à partir du module de cisaillement G de l’intercalaire et du coefficient Ψ de charge et d’appuis ; 1/h<sub>ef;w</sub>³ = η/I<sub>full</sub> + (1 − η)/Σh³ ; ω équivalent par (A.1).')}
      <div style="margin-bottom:12px">${chk('eet.on', 'Calculer aussi par la méthode EET', true)}</div>
      ${ee.on ? `<div class="fields wide">
        ${field('Charge et appuis', sel('eet.cas', C.EET_CASES.map((x) => [x.id, x.label]), { rr: true }), '', '', true)}
        ${EC.id === 'ss4' ? `${field('Côté a', inp('eet.a'), 'mm')}${field('Côté b', inp('eet.b'), 'mm')}` : EC.id === 'bss' ? field('Portée L', inp('eet.L'), 'mm') : `${field('Ψ', inp('eet.psi'), 'mm⁻²·10⁶', 'valeur lue dans les tableaux A.1 ou A.2')}${field('Formule de η', sel('eet.kind', [['plate', 'Plaque — (A.4), (A.7)'], ['beam', 'Poutre — (A.8), (A.9)']]))}`}
        ${field('Module de cisaillement G', sel('eet.gSrc', [['il', il && il.G ? `${il.label} — ${il.src}` : 'Non fourni pour cet intercalaire — G saisi'], ['custom', 'Saisi']], { rr: true }))}
        ${st.eet.gSrc === 'il' && il && il.G ? field('Cas de charge', sel('eet.load', loadsG.map((V) => [V.key, V.label]), { rr: true })) : field('G', inp('eet.G', { ph: 'à saisir' }), 'MPa', il && il.G ? '' : 'aucune valeur de G dans FD P78-468 pour cet intercalaire')}
        ${EC.kind !== 'beam' ? field('Module E / ν', `<div class="inline">${inp('E')}${inp('nu')}</div>`, 'MPa / —') : field('Module E', inp('E'), 'MPa')}
      </div><div id="eEet" style="margin-top:14px"></div>` : ''}
      <div id="eNotes"></div>
    </div>`;
    refresh();
  }

  function refresh() {
    const R = C.compute(st);
    const cn = $('#eCrumb'); if (cn) cn.textContent = st.name || 'Sans nom';
    const dd = $('#eDirty'); if (dd) dd.textContent = dirty ? 'modifié · non enregistré' : '';
    const wBox = $('#eW'), eBox = $('#eEet'), notes = $('#eNotes'), fig = $('#eFig'), v = $('#eVerdict');
    if (!R.valid) { if (wBox) delete wBox.dataset.key; if (wBox) wBox.innerHTML = R.warnings.map((x) => `<p class="note warn">${sub(x)}</p>`).join(''); if (fig) fig.innerHTML = ''; if (eBox) eBox.innerHTML = ''; if (v) v.innerHTML = '<span class="verdict ko">— <small>données invalides</small></span>'; return; }
    const g = R.g, wr = R.rows.find((r) => r.L.id === 'W');
    if (v) v.innerHTML = wr ? `<span class="verdict" style="background:var(--c-sun);color:var(--ink)">${fmt(wr.hw, 2)} mm <small>h<sub>ef;w</sub> vent</small></span>` : '';
    g.hm.forEach((x, i) => { const e = $('#eHm' + i); if (e) e.textContent = fmt(x, 2); });
    if (fig) fig.innerHTML = section(R) + `<p class="muted" style="font-size:12.5px;margin-top:6px">Verre ${fmtG(g.glass, 2)} mm · épaisseur totale ${fmtG(g.total, 2)} mm · poids ${fmt(g.glass * GL.RHO / 1000, 2)} kN/m²</p>`;
    const custom = st.il === 'custom';
    if (wBox) {
      // la structure (et les champs ω saisis) est construite une fois ; on ne met à jour que les cellules
      const loads = custom ? R.vars : R.rows;   // éléments { key, id, label, L }
      const key = loads.map((V) => V.key).join(',') + '|' + g.n + '|' + st.il;
      if (wBox.dataset.key !== key) {
        wBox.dataset.key = key;
        const rows = loads.map((V) => `<tr${V.key === 'W' ? ' class="gov"' : ''}><td>${sub(V.label)}</td><td class="f">${esc(V.L.dur)}</td><td class="num">${custom ? `<input type="number" step="any" data-ep="wc.${V.id}" value="${esc(st.wc[V.id] != null ? st.wc[V.id] : '')}" placeholder="—" style="max-width:80px">` : `<span id="eW_${V.key}"></span>`}</td><td class="num"><b id="eHw_${V.key}"></b></td>${g.h.map((_, k) => `<td class="num" id="eHs_${V.key}_${k}"></td>`).join('')}<td class="num"><b id="eHsm_${V.key}"></b></td></tr>`).join('');
        wBox.innerHTML = `<div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Cas de charge (charge de plus courte durée)</th><th>Durée</th><th class="num">ω [–]</th><th class="num">h<sub>ef;w</sub> [mm]</th>${g.h.map((h, k) => `<th class="num">h<sub>ef;σ,${k + 1}</sub> [mm]<br><small>pli ${k + 1}</small></th>`).join('')}<th class="num">h<sub>ef;σ</sub> min [mm]</th></tr></thead><tbody>${rows}</tbody></table></div><p class="cap" id="eWcap"></p>`;
      }
      const T = (id, v) => { const e = $('#' + id); if (e) e.textContent = v; };
      loads.forEach((V) => {
        const r = R.rows.find((x) => x.key === V.key);
        T('eW_' + V.key, r ? fmt(r.w, 2) : '—'); T('eHw_' + V.key, r ? fmt(r.hw, 2) : '—'); T('eHsm_' + V.key, r ? fmt(r.hsMin, 2) : '—');
        g.h.forEach((_, k) => T(`eHs_${V.key}_${k}`, r ? fmt(r.hs[k], 2) : '—'));
      });
      const cap = $('#eWcap'); if (cap) cap.textContent = `Épaisseurs en mm. ${R.il.src}${R.il.dta ? ' — valeurs du DTA pour ' + R.il.label : ''}. VI : vitrage isolant.`;
    }
    if (eBox && R.eet) {
      const E = R.eet;
      if (E.err) eBox.innerHTML = `<p class="note warn">${sub('EET : ' + E.err)}</p>`;
      else {
        const wRef = R.rows.find((r) => r.key === (st.eet.gSrc === 'il' ? st.eet.load : 'W')) || R.rows.find((r) => r.L.id === GL.splitKey(st.eet.load).id);
        eBox.innerHTML = `<div class="kpis k3" style="grid-template-columns:repeat(4,minmax(0,1fr))">
          <div class="kpi"><b>Paramètre de couplage η</b><span>${fmt(E.eta, 3)}</span><small>${esc(E.formula || E.note || '')} · Ψ = ${fmtG(E.psi * 1e6, 4)}·10⁻⁶ mm⁻²${E.psiInfo ? ' (' + sub(E.psiInfo) + ')' : ''}</small></div>
          <div class="kpi hero"><b>h<sub>ef;w</sub> (EET)</b><span>${fmt(E.hw, 2)} mm</span><small>G = ${fmtG(E.G, 2)} MPa — ${esc(E.gTxt)}</small></div>
          <div class="kpi"><b>h<sub>ef;σ</sub> min (EET)</b><span>${fmt(Math.min(...E.hs), 2)} mm</span><small>${E.hs.map((x, k) => `pli ${k + 1} : ${fmt(x, 2)}`).join(' · ')}</small></div>
          <div class="kpi"><b>ω équivalent (A.1)</b><span>${fmt(E.w, 3)}</span><small>${wRef ? `méthode ω (${esc(wRef.L.label.toLowerCase())}) : ω = ${fmt(wRef.w, 2)}, h<sub>ef;w</sub> = ${fmt(wRef.hw, 2)} mm` : ''}</small></div>
        </div>`;
      }
    }
    if (notes) notes.innerHTML = R.warnings.map((x) => `<p class="note warn">${sub(x)}</p>`).join('') + R.info.map((x) => `<p class="note">${sub(x)}</p>`).join('');
  }

  // ======================================================================
  //  FICHE NDC
  // ======================================================================
  function page(state, project, idx, total, opts) {
    const s = C.upgrade(JSON.parse(JSON.stringify(state)));
    const R = C.compute(s);
    if (!R.valid) return `<section class="rp-page"><p>${esc(s.name)} : données invalides.</p></section>`;
    const g = R.g, date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    let n = 0; const H2 = (t) => `<h2><span class="n">${++n}</span>${t}</h2>`;
    const kv = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
    const rows = R.rows.map((r) => `<tr${r.L.id === 'W' ? ' class="gov"' : ''}><td>${sub(r.label)}</td><td>${esc(r.L.dur)}</td><td class="num">${fmt(r.w, 2)}</td><td class="num">${fmt(r.hw, 2)}</td>${g.h.map((_, k) => `<td class="num">${fmt(r.hs[k], 2)}</td>`).join('')}</tr>`).join('');
    const E = R.eet;
    return `<section class="rp-page"><header class="rp-head"><div class="l"><b>${esc(project || 'Note de calcul')}</b>Verre feuilleté — épaisseurs effectives (NF EN 16612, FD P78-468${E && !E.err ? ', EN 19100-2' : ''})${opts && opts.ref ? ' · ' + esc(opts.ref) : ''}</div><div class="r">${!opts || opts.logo ? '<div class="logo-s">tracés</div>' : ''}${esc(s.name)} · ${date}</div></header>
      <div class="rp-title"><h1>${esc(s.name)} — ${esc(C.compLabel(s))}${total > 1 ? ` (${idx + 1}/${total})` : ''}</h1><p>Intercalaire : ${esc(R.il.label)} (${esc(R.il.src)})</p></div>
      ${H2('Composition')}
      <div class="rp-fig"><div style="width:95mm;flex:none">${section(R, 440)}</div><div style="flex:1"><div class="rp-kv" style="grid-template-columns:1fr">
        ${kv('Plis de verre', g.h.map((x) => fmtG(x, 2)).join(' / ') + ' mm')}${kv('Intercalaires', g.hints.map((x) => fmtG(x, 2)).join(' / ') + ' mm')}
        ${kv('Distances h<sub>m</sub>', 'depuis le plan de symétrie du feuilleté (NF EN 16612)')}${kv('Verre / total', `${fmtG(g.glass, 2)} / ${fmtG(g.total, 2)} mm`)}
        ${kv('Distances h<sub>m</sub>', g.hm.map((x) => fmt(x, 2)).join(' / ') + ' mm')}
      </div></div></div>
      ${H2('Méthode ω — NF EN 16612 annexe D')}
      <table><thead><tr><th>Cas de charge</th><th>Durée</th><th class="num">ω [–]</th><th class="num">h<sub>ef;w</sub> [mm]</th>${g.h.map((_, k) => `<th class="num">h<sub>ef;σ,${k + 1}</sub> [mm]</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
      <p style="font-size:7.6pt;color:#555">Épaisseurs en mm. h<sub>ef;w</sub> = (Σh<sub>k</sub>³ + 12·ω·Σh<sub>k</sub>·h<sub>m,k</sub>²)<sup>1/3</sup> ; h<sub>ef;σ,j</sub> = √(h<sub>ef;w</sub>³/(h<sub>j</sub> + 2·ω·h<sub>m,j</sub>)). Pour une combinaison, ω de la charge de plus courte durée (FD P78-468 § 10.6.2).</p>
      ${E && !E.err ? `${H2('Méthode EET — EN 19100-2 annexe A')}<div class="rp-kv">${kv('Cas', sub(E.case.label))}${kv('Ψ', `${fmtG(E.psi * 1e6, 4)}·10⁻⁶ mm⁻²`)}${kv('G intercalaire', `${fmtG(E.G, 2)} MPa (${esc(E.gTxt)})`)}${kv('η ' + esc(E.formula || ''), fmt(E.eta, 3))}${kv('h<sub>ef;w</sub>', fmt(E.hw, 2) + ' mm')}${kv('h<sub>ef;σ</sub>', E.hs.map((x) => fmt(x, 2)).join(' / ') + ' mm')}${kv('ω équivalent (A.1)', fmt(E.w, 3))}</div>` : ''}
      ${R.info.length || R.warnings.length ? `<p style="font-size:7.6pt"><b>Remarques :</b> ${R.warnings.concat(R.info).map(sub).join(' ')}</p>` : ''}
    </section>`;
  }

  // ======================================================================
  //  ÉVÉNEMENTS
  // ======================================================================
  function bind(app) {
    const onEdit = (e) => {
      const t = e.target; if (!t.dataset || !t.dataset.ep || t.closest('.modal')) return;
      if (e.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return;
      set(t.dataset.ep, t.type === 'checkbox' ? t.checked : t.value);
      dirty = true; persist();
      if (t.dataset.rr && e.type === 'change') { const y = window.scrollY; render(app); window.scrollTo(0, y); return; }
      refresh();
    };
    app.addEventListener('input', onEdit);
    app.addEventListener('change', onEdit);
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-eact]'); if (!b) return;
      const a = b.dataset.eact, y = window.scrollY;
      const rr = () => { dirty = true; persist(); render(app); window.scrollTo(0, y); };
      if (a === 'addPly') { const L = st.plies[st.plies.length - 1] || { h: 8 }; st.plies.push({ h: L.h }); st.hints.push(st.hints[st.hints.length - 1] != null ? st.hints[st.hints.length - 1] : 1.52); rr(); }
      else if (a === 'delPly') { const i = +b.dataset.i; st.plies.splice(i, 1); st.hints.splice(Math.min(i, st.hints.length - 1), 1); rr(); }
      else if (a === 'save' || a === 'saveas') { const ok = await A().saveItem('epaisseur', st, a === 'saveas'); if (ok) { dirty = false; persist(); render(app); window.scrollTo(0, y); } }
      else if (a === 'new') {
        if (dirty && !(await A().confirmBox('Nouveau feuilleté', 'Les modifications non enregistrées seront perdues. Continuer ?'))) return;
        st = C.defaultState(); st.name = 'Nouveau feuilleté'; A().newItem('epaisseur'); dirty = false; persist(); render(app);
      }
      else if (a === 'report') window.LaminaReport.open([{ state: st, project: A().crumbK('epaisseur').p ? A().crumbK('epaisseur').p.name : '' }]);
    });
  }
  function load(state) { st = C.upgrade(state); dirty = false; persist(); }

  const api = { init, render, bind, page, load, flush, get state() { return st; }, get dirty() { return dirty; }, summary: C.summary };
  window.LaminaModules = window.LaminaModules || {};
  window.LaminaModules.epaisseur = { kind: 'epaisseur', route: 'epaisseur', title: 'Épaisseur équivalente', short: 'feuilleté', ref: 'NF EN 16612 · FD P78-468', api, upgrade: C.upgrade };
})();
