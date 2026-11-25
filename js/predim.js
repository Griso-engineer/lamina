/* ==========================================================================
   Lamina — module « Pré-dimensionnement » : géométrie et appuis, tableau des cas de charge, résultats,
   élévation du vitrage, fiche NDC.
   ========================================================================== */
(function () {
  'use strict';
  const C = window.LaminaPredim, RK = window.LaminaRoark, GL = window.LaminaGlass;
  const A = () => window.LaminaApp;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const pct = (r) => (Number.isFinite(r) ? Math.round(r * 100) + ' %' : '∞');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.;′σ]+)/g, '<sub>$1</sub>');
  const fh = (f) => sub(String(f || '').replace(/t([²³])/g, 'h$1'));   // formules de Roark écrites avec h (épaisseur équivalente)
  const bar = (r) => `<div class="bar"><i class="${!(r <= 1) ? 'ko' : r > 0.9 ? 'hi' : ''}" style="width:${Math.min(100, (Number.isFinite(r) ? r : 1) * 100)}%"></i></div>`;
  const pill = (r) => (r == null ? '<span class="pill na">—</span>' : r <= 1 ? '<span class="pill ok">OK</span>' : '<span class="pill ko">NON</span>');
  const INK = '#111110', ACC = '#6b8fc2', GLASS = '#e3eaf4', MUTED = '#6e6d69';
  let st = null, dirty = false, db = null;
  const get = (p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), st);
  function set(p, v) { const ks = p.split('.'); let a = st; ks.slice(0, -1).forEach((k) => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
  const inp = (p, o = {}) => `<input type="${o.type || 'number'}" data-pp="${p}" value="${esc(get(p))}"${(o.type || 'number') === 'number' ? ' step="any"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.style ? ` style="${o.style}"` : ''}>`;
  const sel = (p, opts, o = {}) => { const v = String(get(p)); return `<select data-pp="${p}"${o.rr ? ' data-rr="1"' : ''}${o.style ? ` style="${o.style}"` : ''}>${opts.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === v ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`; };
  const chk = (p, label, rr) => `<label class="check"><input type="checkbox" data-pp="${p}"${get(p) ? ' checked' : ''}${rr ? ' data-rr="1"' : ''}> ${label}</label>`;
  const field = (label, control, unit, hint) => `<label class="field"><span>${label}${unit ? ` <span class="u">[${unit}]</span>` : ''}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const blockHead = (n, t, p) => `<div class="block-head"><span class="num">${n}</span><h2>${t}</h2><p>${p || ''}</p></div>`;

  function init(database) { db = database; st = db.draft_vitrage ? C.upgrade(db.draft_vitrage) : C.defaultState(); dirty = !!db.draftDirty_vitrage; }
  function flush(dbx) { dbx.draft_vitrage = st; dbx.draftDirty_vitrage = dirty; }
  let saveT = null;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => { flush(db); A().saveDb(); }, 250); }

  // ======================================================================
  //  DESSINS
  // ======================================================================
  function icon(e) {
    const seg = (x1, y1, x2, y2, k) => k === 'fx' ? `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK}" stroke-width="3.2"/>` : k === 'ss' ? `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK}" stroke-width="1.3"/>` : `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${ACC}" stroke-width="1.1" stroke-dasharray="2.5 2"/>`;
    return `<svg viewBox="0 0 52 30" width="52" height="30" aria-hidden="true"><rect x="9" y="4" width="34" height="22" fill="${GLASS}"/>${seg(9, 26, 43, 26, e.bottom)}${seg(9, 4, 43, 4, e.top)}${seg(9, 4, 9, 26, e.left)}${seg(43, 4, 43, 26, e.right)}</svg>`;
  }
  /* Élévation du vitrage : appuis (encastrement hachuré, appui simple à triangles, bord libre tireté), cotes a et b. */
  function elevation(c, a, b, W = 560, H = 440) {
    const ml = 92, mr = 46, mt = 46, mb = 92;
    const k = Math.min((W - ml - mr) / a, (H - mt - mb) / b), w = a * k, h = b * k;
    const x0 = ml + (W - ml - mr - w) / 2, y0 = mt + (H - mt - mb - h) / 2, e = c.edges;
    const edge = (x1, y1, x2, y2, kd, nx, ny) => {
      const L = Math.hypot(x2 - x1, y2 - y1), tx = (x2 - x1) / L, ty = (y2 - y1) / L;
      if (kd === 'fx') {
        let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="5"/>`;
        const n = Math.max(4, Math.round(L / 14));
        for (let i = 0; i <= n; i++) { const x = x1 + tx * L * i / n, y = y1 + ty * L * i / n; s += `<line x1="${x + nx * 3}" y1="${y + ny * 3}" x2="${x + nx * 14 + tx * 8}" y2="${y + ny * 14 + ty * 8}" stroke="${INK}" stroke-width="1.2"/>`; }
        return s;
      }
      if (kd === 'ss') {
        let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="2"/>`;
        const n = Math.max(2, Math.round(L / 46));
        for (let i = 0; i < n; i++) { const f = (i + 0.5) / n, x = x1 + tx * L * f, y = y1 + ty * L * f; s += `<path d="M${x + nx * 2} ${y + ny * 2} L${x + nx * 15 - tx * 8} ${y + ny * 15 - ty * 8} L${x + nx * 15 + tx * 8} ${y + ny * 15 + ty * 8} Z" fill="#fff" stroke="${INK}" stroke-width="1.3"/>`; }
        return s;
      }
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ACC}" stroke-width="2" stroke-dasharray="7 5"/>`;
    };
    let s = `<defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef3fa"/><stop offset="1" stop-color="#d9e3f1"/></linearGradient></defs>`;
    s += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="url(#gl)"/>`;
    s += `<path d="M${x0 + w * 0.12} ${y0 + h * 0.62} L${x0 + w * 0.34} ${y0 + h * 0.2} M${x0 + w * 0.2} ${y0 + h * 0.72} L${x0 + w * 0.42} ${y0 + h * 0.3}" stroke="#fff" stroke-width="3" opacity=".9"/>`;
    s += edge(x0, y0 + h, x0 + w, y0 + h, e.bottom, 0, 1) + edge(x0, y0, x0 + w, y0, e.top, 0, -1) + edge(x0, y0, x0, y0 + h, e.left, -1, 0) + edge(x0 + w, y0, x0 + w, y0 + h, e.right, 1, 0);
    // cotes
    const yd = y0 + h + 44, xd = x0 - 50, tick = (x, y, v) => `<path d="M${x - 5} ${y + (v ? 0 : 5)} L${x + 5} ${y - (v ? 0 : 5)}" stroke="${INK}" stroke-width="1.3"/>`;
    s += `<line x1="${x0}" y1="${yd}" x2="${x0 + w}" y2="${yd}" stroke="${INK}"/><line x1="${x0}" y1="${y0 + h + 22}" x2="${x0}" y2="${yd + 6}" stroke="${MUTED}" stroke-width=".8"/><line x1="${x0 + w}" y1="${y0 + h + 22}" x2="${x0 + w}" y2="${yd + 6}" stroke="${MUTED}" stroke-width=".8"/>${tick(x0, yd)}${tick(x0 + w, yd)}`;
    s += `<text x="${x0 + w / 2}" y="${yd - 7}" font-size="15" font-weight="700" text-anchor="middle" fill="${INK}">a = ${fmtG(a, 0)} mm</text>`;
    s += `<line x1="${xd}" y1="${y0}" x2="${xd}" y2="${y0 + h}" stroke="${INK}"/><line x1="${x0 - 22}" y1="${y0}" x2="${xd - 6}" y2="${y0}" stroke="${MUTED}" stroke-width=".8"/><line x1="${x0 - 22}" y1="${y0 + h}" x2="${xd - 6}" y2="${y0 + h}" stroke="${MUTED}" stroke-width=".8"/>${tick(xd, y0, 1)}${tick(xd, y0 + h, 1)}`;
    s += `<text x="${xd - 9}" y="${y0 + h / 2}" font-size="15" font-weight="700" text-anchor="middle" fill="${INK}" transform="rotate(-90 ${xd - 9} ${y0 + h / 2})">b = ${fmtG(b, 0)} mm</text>`;
    if (c.strip) s += `<text x="${x0 + w + 22}" y="${y0 + h + 4}" font-size="12" fill="${MUTED}">z = 0</text><text x="${x0 + w + 22}" y="${y0 + 4}" font-size="12" fill="${MUTED}">z = b</text>`;
    // légende
    const ly = H - 18, items = [['fx', 'encastré'], ['ss', 'appui simple'], ['fr', 'bord libre']].filter(([kk]) => Object.values(e).includes(kk));
    let lx = W / 2 - items.length * 70;
    items.forEach(([kk, lab]) => { s += `<g transform="translate(${lx},${ly})">${kk === 'fx' ? `<line x1="0" y1="0" x2="34" y2="0" stroke="${INK}" stroke-width="5"/>` : kk === 'ss' ? `<line x1="0" y1="0" x2="34" y2="0" stroke="${INK}" stroke-width="2"/><path d="M17 1 L10 12 L24 12 Z" fill="#fff" stroke="${INK}"/>` : `<line x1="0" y1="0" x2="34" y2="0" stroke="${ACC}" stroke-width="2" stroke-dasharray="7 5"/>`}<text x="42" y="5" font-size="13" fill="${INK}">${lab}</text></g>`; lx += 140; });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;margin:0 auto" font-family="Inter, sans-serif">${s}</svg>`;
  }

  // ======================================================================
  //  PAGE
  // ======================================================================
  function render(app) {
    const { p } = A().crumbK('vitrage');
    const c = RK.CASE[st.cas], loads = C.loadsOf(c), fdc = st.slsCrit === 'fd';
    const groups = RK.GROUPS.map(([gid, gname]) => `<div class="pl-group"><div class="sub-title">${gname}</div><div class="pl-cases">${RK.CASES.filter((x) => x.group === gid).map((x) =>
      `<button type="button" class="pl-case${x.id === st.cas ? ' on' : ''}" data-pact="cas" data-v="${x.id}">${icon(x.edges)}<span>${esc(x.label)}<small>${x.strip ? 'statique de poutre' : 'Roark cas ' + x.roark}</small></span></button>`).join('')}</div></div>`).join('');
    const lbA = c.strip ? 'Largeur a' : 'Côté a', lbB = c.strip ? (c.bc === 'cant' ? 'Porte-à-faux b' : 'Portée b') : 'Côté b';
    const anyConc = st.rows.some((r) => r.load === 'conc');
    const rows = st.rows.map((r, i) => {
      const uls = r.st !== 'sls', pos = c.strip && r.load && r.load !== 'uni', pt = c.strip && r.load === 'point';
      return `<tr>
        <td class="rowh">${i + 1}</td>
        <td><input type="text" data-pp="rows.${i}.name" value="${esc(r.name)}" style="min-width:120px;text-align:left"></td>
        <td>${sel(`rows.${i}.st`, [['uls', 'ELU'], ['sls', 'ELS']], { rr: true, style: 'min-width:72px' })}</td>
        <td>${sel(`rows.${i}.load`, loads.map((l) => [l.id, l.label + (l.roark ? ` (${l.roark})` : '')]).concat(c.loads[r.load] ? [] : [[r.load, '— non disponible —']]), { rr: true, style: 'min-width:170px' })}</td>
        <td><div class="inline"><input type="number" step="any" data-pp="rows.${i}.val" value="${esc(r.val)}" style="min-width:70px"><span class="u" style="font-size:11px;color:var(--muted);white-space:nowrap">${RK.valUnit(r.load)}</span></div></td>
        <td>${pos ? `<input type="number" step="any" data-pp="rows.${i}.d" value="${esc(r.d)}" placeholder="${c.bc === 'cant' ? 'b' : 'b/2'}">` : '<span class="na">—</span>'}</td>
        <td>${pt ? `<input type="number" step="any" data-pp="rows.${i}.beff" value="${esc(r.beff)}" placeholder="a">` : '<span class="na">—</span>'}</td>
        <td><input type="number" step="any" data-pp="rows.${i}.h" value="${esc(r.h)}" title="${uls ? 'h_ef;σ' : 'h_ef;w'}"></td>
        <td>${uls ? `<input type="number" step="any" data-pp="rows.${i}.f" value="${esc(r.f)}">` : '<span class="na">—</span>'}</td>
        <td>${uls ? '<span class="na">—</span>' : fdc ? '<input type="number" disabled id="pLim' + i + '">' : `<input type="number" step="any" data-pp="rows.${i}.lim" value="${esc(r.lim)}">`}</td>
        <td>${uls ? '<span class="na">—</span>' : fdc ? '<input type="number" disabled id="pMax' + i + '">' : `<input type="number" step="any" data-pp="rows.${i}.max" value="${esc(r.max)}" placeholder="—">`}</td>
        <td class="ro" id="pRes${i}"></td><td class="ro" id="pRat${i}"></td>
        <td style="white-space:nowrap"><button class="btn sm ghost" data-pact="dupRow" data-i="${i}" title="Dupliquer la ligne">⧉</button>${st.rows.length > 1 ? `<button class="btn sm ghost" data-pact="delRow" data-i="${i}" title="Supprimer la ligne">✕</button>` : ''}</td></tr>`;
    }).join('');
    app.innerHTML = `<div class="page">
      <div class="actionbar">
        <div class="grow"><span class="crumb">${p ? `Projet <b>${esc(p.name)}</b> ›` : 'Hors projet ›'} <b id="pCrumb">${esc(st.name || 'Sans nom')}</b></span><span class="dirty" id="pDirty">${dirty ? 'modifié · non enregistré' : ''}</span></div>
        <span id="pVerdict"></span>
        <div class="btn-group"><button class="btn" data-pact="new">Nouveau</button><button class="btn" data-pact="save">Enregistrer</button><button class="btn" data-pact="saveas">Enregistrer sous…</button></div>
        <button class="btn primary" data-pact="report">Fiche NDC ↗</button>
      </div>
      ${blockHead('01', 'Vitrage', 'Appuis et dimensions du vitrage, hors épaisseur. Plaques : tableau 11.4 de Roark ; bandes et consoles : statique de poutre de largeur unité.')}
      ${groups}
      <div class="cols2" style="margin-top:18px;align-items:start"><div>
        <div class="fields">${field('Repère', inp('name', { type: 'text', ph: 'ex. Verrière V1' }))}</div>
        <p class="muted" style="font-size:12.5px;margin:6px 0 10px">${esc(c.ab)}</p>
        <div class="fields">${field(lbA, inp('a'), 'mm')}${field(lbB, inp('b'), 'mm')}${field('Module E', inp('E'), 'MPa')}${field('Coefficient de Poisson ν', inp('nu'), '', 'FD P78-468 : 0,23')}
          ${anyConc ? field('Rayon de la zone chargée r<sub>o</sub>', inp('ro'), 'mm', 'charge concentrée') : ''}</div>
        <div class="fields" style="margin-top:14px">${field('Critère de flèche ELS', sel('slsCrit', [['fd', 'FD P78-468 § 10.5'], ['libre', 'Saisi par ligne (b / n, plafond)']], { rr: true }), '', '')}
          ${fdc && c.group !== '4 côtés' ? `<label class="field"><span>&nbsp;</span>${chk('igu', 'Vitrage isolant (limite /150)', true)}</label>` : ''}</div>
        <p class="muted" style="font-size:12.5px;margin-top:6px" id="pFd"></p>
        ${c.strip ? `<div style="margin-top:12px">${chk('cyl', 'Rigidité de plaque D′ = E·h³/12(1 − ν²) (sinon poutre D′ = E·h³/12)')}</div>` : ''}
      </div>
      <div class="fig" id="pFig"></div></div>
      ${blockHead('02', 'Cas de charge', 'Une ligne par cas : ELU (contrainte) ou ELS (flèche), type et intensité de la charge, épaisseur équivalente h et résistance f<sub>g;d</sub> reprises des onglets Épaisseur équivalente et Résistance.')}
      <p class="note" style="margin-top:0">ELU : h = h<sub>ef;σ</sub> du pli étudié et f<sub>g;d</sub> pour la durée de la charge. ELS : h = h<sub>ef;w</sub>. Verre monolithique : h = t. Les intensités sont les valeurs combinées (ELU pondérées, ELS de service).</p>
      <div class="tbl-wrap"><table class="grid pd-grid">
        <thead><tr><th class="rowh">#</th><th class="rowh">Cas</th><th>État</th><th>Charge</th><th>Intensité</th><th>d [mm]</th><th>b<sub>eff</sub> [mm]</th><th>h [mm]</th><th>f<sub>g;d</sub> [MPa]</th><th>Limite ${fdc ? '' : 'b'}/n</th><th>Plafond [mm]</th><th>Résultat</th><th>Taux</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <div style="margin:8px 0 4px;display:flex;gap:8px"><button class="btn sm" data-pact="addRow" data-v="uls">+ cas ELU</button><button class="btn sm" data-pact="addRow" data-v="sls">+ cas ELS</button></div>
      <p class="muted" style="font-size:12px;margin-top:6px">${c.strip ? 'd : position de la charge linéique ou ponctuelle depuis le côté z = 0 (vide : ' + (c.bc === 'cant' ? 'extrémité libre' : 'mi-portée') + ') ; b<sub>eff</sub> : largeur sur laquelle se répartit une charge ponctuelle (vide : toute la largeur a).' : 'Charges linéiques et ponctuelles quelconques : choisir des appuis de type bande ou console.'}</p>
      ${blockHead('03', 'Résultats', c.strip ? 'σ = 6·m/h² (m par unité de largeur), flèche par double intégration de m/D′.' : 'σ = β·q·b²/h², y = α·q·b⁴/(E·h³), R = γ·q·b (Roark, tableau 11.4). Coins supposés maintenus.')}
      <div id="pResults"></div>
    </div>`;
    refresh();
  }

  function refresh() {
    const R = C.compute(st);
    const v = $('#pVerdict');
    if (v) v.innerHTML = !R.valid ? '<span class="verdict ko">— <small>données invalides</small></span>' : !R.gov ? '<span class="verdict" style="background:var(--paper-2);color:var(--ink)">— <small>' + (R.status === 'oor' ? 'hors domaine' : 'aucun résultat') + '</small></span>' : `<span class="verdict ${R.max <= 1 ? 'ok' : 'ko'}">${pct(R.max)} <small>${R.max <= 1 ? 'vérifié*' : 'non vérifié'}</small></span>`;
    const dd = $('#pDirty'); if (dd) dd.textContent = dirty ? 'modifié · non enregistré' : '';
    const cn = $('#pCrumb'); if (cn) cn.textContent = st.name || 'Sans nom';
    const fig = $('#pFig'), box = $('#pResults');
    if (fig) fig.innerHTML = R.valid ? elevation(R.case, R.geo.a, R.geo.b) : '';
    const fd = $('#pFd'); if (fd) fd.innerHTML = R.fdDefl ? `${esc(R.fdDefl.ref)} : flèche ≤ ${esc(R.fdDefl.Ln)}/${R.fdDefl.lim} et ≤ ${R.fdDefl.max} mm, soit ${fmt(Math.min(R.fdDefl.L / R.fdDefl.lim, R.fdDefl.max), 1)} mm.` : '';
    if (!R.valid) { if (box) box.innerHTML = R.warnings.map((x) => `<p class="note warn">${sub(x)}</p>`).join(''); return; }
    R.rows.forEach((o) => {
      const rs = $('#pRes' + o.i), rt = $('#pRat' + o.i), li = $('#pLim' + o.i), mx = $('#pMax' + o.i);
      if (li && R.fdDefl) li.value = R.fdDefl.lim; if (mx && R.fdDefl) mx.value = R.fdDefl.max;
      if (rs) rs.innerHTML = o.err ? `<span style="color:var(--c-red)" title="${esc(o.err)}">${o.na ? 'non donnée' : 'erreur'}</span>` : `${fmt(o.Ed, o.unitR === 'mm' ? 2 : 1)} ≤ ${fmt(o.Rd, o.unitR === 'mm' ? 2 : 1)} ${o.unitR}`;
      if (rt) rt.innerHTML = o.err ? '—' : `<b style="color:${o.r > 1 ? 'var(--c-red)' : 'inherit'}">${pct(o.r)}</b>${o.oor ? ' <small>hors dom.</small>' : ''}${o === R.gov && R.rows.length > 1 ? ' ◂' : ''}`;
    });
    if (!box) return;
    const ok = R.rows.filter((o) => !o.err);
    const det = R.rows.map((o) => o.err ? `<tr><td>${o.i + 1}</td><td>${esc(o.name)}</td><td>${o.st === 'uls' ? 'ELU' : 'ELS'}</td><td colspan="7" style="color:var(--c-red)">${sub(o.err)}</td></tr>`
      : `<tr${o === R.gov ? ' class="gov"' : ''}><td>${o.i + 1}</td><td>${esc(o.name)}</td><td>${o.st === 'uls' ? 'ELU' : 'ELS'}</td><td>${sub(o.gov.label)}<br><small class="muted">${esc(o.L.label.toLowerCase())}, ${fmtG(o.val, 3)} ${o.unit}${o.d != null && o.load !== 'uni' ? `, d = ${fmtG(o.d, 0)} mm` : ''} · h = ${fmtG(o.h, 2)} mm</small></td><td class="f">${fh(o.gov.formula)}</td><td class="num">${fmt(o.Ed, o.unitR === 'mm' ? 2 : 1)}</td><td class="num">${fmt(o.Rd, o.unitR === 'mm' ? 2 : 1)}</td><td class="f">${o.unitR}</td><td class="num"><span class="ratio">${pct(o.r)}</span></td><td style="width:90px">${bar(o.r)}</td><td>${o.oor ? '<span class="pill na">hors dom.</span>' : pill(o.r)}</td></tr>`).join('');
    const all = ok.map((o) => `<details class="pl-tab"><summary>${o.i + 1}. ${esc(o.name)} — toutes les grandeurs calculées</summary><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Grandeur</th><th>Formule</th>${R.case.strip ? '' : '<th class="num">Coef.</th>'}<th class="num">Valeur</th><th>Unité</th></tr></thead><tbody>${o.out.map((x) => `<tr><td>${sub(x.label)}</td><td class="f">${fh(x.formula)}</td>${R.case.strip ? '' : `<td class="num">${fmt(x.k, 4)}</td>`}<td class="num"><b>${fmt(x.v, x.unit === 'mm' ? 2 : 1)}</b>${x.doubt ? ' ⚠' : ''}</td><td class="f">${x.unit}</td></tr>`).join('')}</tbody></table></div></details>`).join('');
    const o1 = ok.find((o) => o.cs && o.L.r);
    const coefs = !R.case.strip && o1 ? `<details class="pl-tab"><summary>Coefficients de Roark, cas ${esc(o1.L.roark)} (interpolés en a/b = ${fmt(R.geo.ratio, 2)})</summary><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>a/b</th>${o1.L.r.map((x) => `<th class="num">${x === Infinity ? '∞' : fmtG(x, 3)}</th>`).join('')}<th class="num hl">${fmt(R.geo.ratio, 2)}</th></tr></thead><tbody>${Object.keys(o1.L.c).map((k) => `<tr><td>${{ a: 'α', b: 'β', g: 'γ' }[k[0]]}${k.length > 1 ? `<sub>${k[1]}</sub>` : ''}</td>${o1.L.c[k].map((x) => `<td class="num">${fmtG(x, 4)}</td>`).join('')}<td class="num hl"><b>${fmtG(o1.cs[k].v, 4)}</b></td></tr>`).join('')}</tbody></table></div></details>` : '';
    const gU = R.govU, gS = R.govS;
    box.innerHTML = `${R.warnings.map((w) => `<p class="note warn">${sub(w)}</p>`).join('')}${R.info.map((w) => `<p class="note">${sub(w)}</p>`).join('')}
      <div class="kpis k3">
        ${R.gov ? `<div class="kpi ${R.max <= 1 ? 'hero' : 'bad'}"><b>Taux maximal</b><span>${pct(R.max)}</span><small>${esc(R.gov.name)} — ${sub(R.gov.crit)}</small></div>` : `<div class="kpi bad"><b>Taux maximal</b><span>—</span><small>aucune ligne exploitable</small></div>`}
        <div class="kpi"><b>Contrainte ELU</b><span>${gU ? fmt(gU.Ed, 1) + ' MPa' : '—'}</span><small>${gU ? `${esc(gU.name)} · f<sub>g;d</sub> = ${fmt(gU.Rd, 1)} MPa` : 'aucun cas ELU'}</small></div>
        <div class="kpi"><b>Flèche ELS</b><span>${gS ? fmt(gS.Ed, 2) + ' mm' : '—'}</span><small>${gS ? `${esc(gS.name)} · limite ${fmt(gS.Rd, 1)} mm` : 'aucun cas ELS'}</small></div>
      </div>
      <div class="tbl-wrap" style="margin-top:18px"><table class="tbl"><thead><tr><th>#</th><th>Cas</th><th>État</th><th>Grandeur dimensionnante</th><th>Formule</th><th class="num">E<sub>d</sub></th><th class="num">R<sub>d</sub></th><th>Unité</th><th class="num">Taux</th><th></th><th></th></tr></thead><tbody>${det}</tbody></table></div>
      <div style="margin-top:16px">${all}${coefs}</div>
      <p class="note">* Critères traités : contrainte de flexion élastique (direction de contrainte donnée par Roark) et flèche, en théorie linéaire, pour les épaisseurs h et résistances f<sub>g;d</sub> saisies. Hors champ : effet membrane, partage des charges des vitrages isolants, stabilité, choc, attaches et calages, contraintes thermiques.</p>`;
  }

  // ======================================================================
  //  FICHE NDC
  // ======================================================================
  function page(state, project, idx, total, opts) {
    const s = C.upgrade(JSON.parse(JSON.stringify(state)));
    const R = C.compute(s);
    if (!R.valid) return `<section class="rp-page"><p>${esc(s.name)} : données invalides.</p></section>`;
    const g = R.geo, c = R.case, date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    let n = 0; const H2 = (t) => `<h2><span class="n">${++n}</span>${t}</h2>`;
    const kv = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
    const rows = R.rows.map((o) => `<tr${o === R.gov ? ' class="gov"' : ''}><td>${o.i + 1}</td><td>${esc(o.name)}</td><td>${o.st === 'uls' ? 'ELU' : 'ELS'}</td><td>${o.L ? esc(o.L.label.toLowerCase()) : '—'}</td><td class="num">${fmtG(o.val, 3)} ${o.unit}${o.d != null && o.load !== 'uni' ? `<br><small>d = ${fmtG(o.d, 0)}${o.load === 'point' ? `, b<sub>eff</sub> = ${fmtG(o.beff, 0)}` : ''}</small>` : ''}</td><td class="num">${fmtG(o.h, 2)}</td>${o.err ? `<td colspan="4">${sub(o.err)}</td>` : `<td>${sub(o.gov.label)}</td><td class="num">${fmt(o.Ed, o.unitR === 'mm' ? 2 : 1)} / ${fmt(o.Rd, o.unitR === 'mm' ? 2 : 1)} ${o.unitR}</td><td class="num">${pct(o.r)}</td><td>${o.oor ? 'hors domaine' : o.r <= 1 ? '<span class="rp-ok">OK</span>' : '<span class="rp-ko">Non vérifié</span>'}</td>`}</tr>`).join('');
    const notes = R.warnings.concat(R.info);
    return `<section class="rp-page"><header class="rp-head"><div class="l"><b>${esc(project || 'Note de calcul')}</b>Vitrage — pré-dimensionnement${c.strip ? ' (statique de poutre)' : ' (Roark, tableau 11.4)'}${opts && opts.ref ? ' · ' + esc(opts.ref) : ''}</div><div class="r">${!opts || opts.logo ? '<div class="logo-s">tracés</div>' : ''}${esc(s.name)} · ${date}</div></header>
      <div class="rp-title"><h1>${esc(s.name)} — ${fmtG(g.a, 0)} × ${fmtG(g.b, 0)} mm${total > 1 ? ` (${idx + 1}/${total})` : ''}</h1><p>${esc(c.label)}</p></div>
      ${H2('Hypothèses')}
      <div class="rp-fig"><div style="width:95mm;flex:none">${elevation(c, g.a, g.b)}</div><div style="flex:1"><div class="rp-kv" style="grid-template-columns:1fr">
        ${kv('Appuis', esc(c.label))}${kv('Dimensions', `a = ${fmtG(g.a, 0)} mm, b = ${fmtG(g.b, 0)} mm${c.strip ? '' : `, a/b = ${fmt(g.ratio, 2)}`}`)}
        ${kv('Verre', `E = ${fmtG(g.E, 0)} MPa, ν = ${fmtG(g.nu, 2)}`)}${kv('Flèche ELS', R.fdDefl ? `${esc(R.fdDefl.ref)} : ${esc(R.fdDefl.Ln)}/${R.fdDefl.lim} ≤ ${R.fdDefl.max} mm` : 'limite par cas')}
        ${kv('Épaisseurs h', 'ELU : h<sub>ef;σ</sub> ; ELS : h<sub>ef;w</sub> (NF EN 16612 annexe D)')}${kv('Résistances', 'f<sub>g;d</sub> par cas (NF EN 16612 / FD P78-468)')}
      </div></div></div>
      ${H2('Cas de charge et vérifications')}
      <table><thead><tr><th>#</th><th>Cas</th><th>État</th><th>Charge</th><th class="num">Intensité</th><th class="num">h [mm]</th><th>Grandeur dimensionnante</th><th class="num">E<sub>d</sub> / R<sub>d</sub></th><th class="num">Taux</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table>
      ${notes.length ? `<p style="font-size:7.6pt"><b>Remarques :</b> ${notes.map(sub).join(' ')}</p>` : ''}
      <div class="rp-concl"><span>Conclusion — ${esc(s.name)}</span><b class="${R.gov && R.max <= 1 ? 'rp-ok' : 'rp-ko'}">${!R.gov ? 'Aucun cas exploitable' : (R.max <= 1 ? 'Vérifié' : 'Non vérifié') + ' — taux max. ' + pct(R.max)}</b></div>
      <p style="font-size:7.4pt;color:#555;margin-top:5pt">${c.strip ? 'Bande de largeur unité, statique de poutre.' : 'W. C. Young, R. G. Budynas, Roark’s Formulas for Stress and Strain, chapitre 11, tableau 11.4 (coefficients interpolés en a/b).'} Théorie linéaire ; hors champ : effet membrane, vitrages isolants, stabilité, choc, attaches, contraintes thermiques.</p>
    </section>`;
  }

  // ======================================================================
  //  ÉVÉNEMENTS
  // ======================================================================
  function bind(app) {
    const onEdit = (e) => {
      const t = e.target; if (!t.dataset || !t.dataset.pp || t.closest('.modal')) return;
      if (e.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return;
      set(t.dataset.pp, t.type === 'checkbox' ? t.checked : t.value);
      dirty = true; persist();
      if (t.dataset.rr && e.type === 'change') { const y = window.scrollY; render(app); window.scrollTo(0, y); return; }
      refresh();
    };
    app.addEventListener('input', onEdit);
    app.addEventListener('change', onEdit);
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-pact]'); if (!b) return;
      const a = b.dataset.pact, y = window.scrollY;
      const rr = () => { dirty = true; persist(); render(app); window.scrollTo(0, y); };
      if (a === 'cas') { st.cas = b.dataset.v; const c = RK.CASE[st.cas]; st.rows.forEach((r) => { if (!c.loads[r.load]) r.load = 'uni'; }); rr(); }
      else if (a === 'addRow') {
        const kind = b.dataset.v, L = [...st.rows].reverse().find((r) => r.st === kind) || st.rows[st.rows.length - 1] || {};
        st.rows.push({ name: (kind === 'sls' ? 'ELS ' : 'ELU ') + (st.rows.filter((r) => r.st === kind).length + 1), st: kind, load: L.load || 'uni', val: L.val, d: L.d || '', beff: L.beff || '', h: L.h, f: kind === 'uls' ? L.f : '', lim: L.lim || 100, max: L.max || '' }); rr();
      }
      else if (a === 'dupRow') { const r = st.rows[+b.dataset.i]; st.rows.splice(+b.dataset.i + 1, 0, Object.assign({}, r, { name: r.name + ' (copie)' })); rr(); }
      else if (a === 'delRow') { st.rows.splice(+b.dataset.i, 1); rr(); }
      else if (a === 'save' || a === 'saveas') { const ok = await A().saveItem('vitrage', st, a === 'saveas'); if (ok) { dirty = false; persist(); render(app); window.scrollTo(0, y); } }
      else if (a === 'new') {
        if (dirty && !(await A().confirmBox('Nouveau vitrage', 'Les modifications non enregistrées seront perdues. Continuer ?'))) return;
        st = C.defaultState(); st.name = 'Nouveau vitrage'; A().newItem('vitrage'); dirty = false; persist(); render(app);
      }
      else if (a === 'report') window.LaminaReport.open([{ state: st, project: A().crumbK('vitrage').p ? A().crumbK('vitrage').p.name : '' }]);
    });
  }
  function load(state) { st = C.upgrade(state); dirty = false; persist(); }

  const api = { init, render, bind, page, load, flush, get state() { return st; }, get dirty() { return dirty; }, summary: C.summary };
  window.LaminaModules = window.LaminaModules || {};
  window.LaminaModules.vitrage = { kind: 'vitrage', route: 'predim', title: 'Pré-dimensionnement', short: 'vitrage', ref: 'Roark · NF EN 16612 · FD P78-468', api, upgrade: C.upgrade };
})();
