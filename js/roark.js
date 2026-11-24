/* ==========================================================================
   Lamina — module « Roark » : prédimensionnement rapide d'un vitrage
   (plaques sur 2, 3 ou 4 côtés, bandes et consoles ; monolithique ou feuilleté).
   Interface, figures, fiche NDC.
   ========================================================================== */
(function () {
  'use strict';
  const C = window.LaminaRoark, GL = window.LaminaGlass;
  const A = () => window.LaminaApp;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
  const fmtG = (x, d = 3) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '—');
  const pct = (r) => (Number.isFinite(r) ? Math.round(r * 100) + ' %' : '∞');
  const sub = (s) => esc(s).replace(/_([A-Za-z0-9,.;′σ]+)/g, '<sub>$1</sub>');
  const bar = (r) => `<div class="bar"><i class="${!(r <= 1) ? 'ko' : r > 0.9 ? 'hi' : ''}" style="width:${Math.min(100, (Number.isFinite(r) ? r : 1) * 100)}%"></i></div>`;
  const pill = (r) => (r == null ? '<span class="pill na">—</span>' : r <= 1 ? '<span class="pill ok">OK</span>' : '<span class="pill ko">NON</span>');
  const fV = (o) => (o ? fmt(o.v, o.unit === 'mm' ? 2 : 1) + (o.doubt ? ' ⚠ non exploitable' : '') : '—');
  const INK = '#111110', ACC = '#6b8fc2', GLASS = '#e3eaf4', RED = '#c0392b', OK = '#1f7a4d', DARK = '#3f5f8f';
  let st = null, dirty = false, db = null;
  const get = (p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), st);
  function set(p, v) { const ks = p.split('.'); let a = st; ks.slice(0, -1).forEach((k) => { if (a[k] == null) a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
  const inp = (p, o = {}) => `<input type="${o.type || 'number'}" data-qp="${p}" value="${esc(get(p))}"${(o.type || 'number') === 'number' ? ' step="any"' : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.style ? ` style="${o.style}"` : ''}>`;
  const sel = (p, opts, o = {}) => { const v = String(get(p)); return `<select data-qp="${p}"${o.rr ? ' data-rr="1"' : ''}${o.style ? ` style="${o.style}"` : ''}>${opts.map((x) => `<option value="${esc(x[0])}"${String(x[0]) === v ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select>`; };
  const chk = (p, label, rr) => `<label class="check"><input type="checkbox" data-qp="${p}"${get(p) ? ' checked' : ''}${rr ? ' data-rr="1"' : ''}> ${label}</label>`;
  const field = (label, control, unit, hint) => `<label class="field"><span>${label}${unit ? ` <span class="u">[${unit}]</span>` : ''}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const blockHead = (n, t, p) => `<div class="block-head"><span class="num">${n}</span><h2>${t}</h2><p>${p || ''}</p></div>`;
  const chips = (act, cur, opts) => `<div class="chips">${opts.map((o) => `<button type="button" class="chip${o[0] === cur ? ' on' : ''}" data-qact="${act}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
  const tempers = () => GL.TEMPERS.map((x) => [x.id, x.label]);
  const R0group = (c) => c.group !== '4 côtés';   // la limite FD § 10.5.2 dépend du type de vitrage (simple ou isolant)

  function init(database) { db = database; st = db.draft_vitrage ? C.upgrade(db.draft_vitrage) : C.defaultState(); dirty = !!db.draftDirty_vitrage; }
  function flush(dbx) { dbx.draft_vitrage = st; dbx.draftDirty_vitrage = dirty; }
  let saveT = null;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => { flush(db); A().saveDb(); }, 250); }

  // ======================================================================
  //  DESSINS
  // ======================================================================
  // icône 52 × 30 : épais = encastré, fin = appui simple, tireté = bord libre
  function icon(e) {
    const seg = (x1, y1, x2, y2, k) => k === 'fx' ? `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK}" stroke-width="3.2"/>` : k === 'ss' ? `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${INK}" stroke-width="1.3"/>` : `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${ACC}" stroke-width="1.1" stroke-dasharray="2.5 2"/>`;
    return `<svg viewBox="0 0 52 30" width="52" height="30" aria-hidden="true"><rect x="9" y="4" width="34" height="22" fill="${GLASS}"/>${seg(9, 26, 43, 26, e.bottom)}${seg(9, 4, 43, 4, e.top)}${seg(9, 4, 9, 26, e.left)}${seg(43, 4, 43, 26, e.right)}</svg>`;
  }
  function edge(x1, y1, x2, y2, k, nx, ny) {
    if (k === 'fx') {
      const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(3, Math.round(L / 12));
      let h = '';
      for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n; h += `<line x1="${x}" y1="${y}" x2="${x + nx * 8 + (y2 - y1) / L * 5}" y2="${y + ny * 8 - (x2 - x1) / L * 5}" stroke="${INK}" stroke-width="1"/>`; }
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="4"/>${h}`;
    }
    if (k === 'ss') {
      const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(L / 40));
      let h = '';
      for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * (i + 0.5) / (n + 1), y = y1 + (y2 - y1) * (i + 0.5) / (n + 1); h += `<path d="M${x} ${y} l${nx * 9 - ny * 5} ${ny * 9 + nx * 5} l${ny * 10} ${-nx * 10} z" fill="#fff" stroke="${INK}" stroke-width="1"/>`; }
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="1.6"/>${h}`;
    }
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ACC}" stroke-width="1.3" stroke-dasharray="5 4"/>`;
  }
  // plan du vitrage (z = 0 en bas), conditions d'appui, cotes, charge, points de calcul numérotés
  function plan(R, s, W = 420, H = 300) {
    const g = R.geo, c = R.case, m = 46, k = Math.min((W - 2 * m) / g.a, (H - 2 * m) / g.b);
    const w = g.a * k, h = g.b * k, x0 = (W - w) / 2, y0 = (H - h) / 2, e = c.edges;
    let o = `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${GLASS}"/>`;
    o += edge(x0, y0 + h, x0 + w, y0 + h, e.bottom, 0, 1) + edge(x0, y0, x0 + w, y0, e.top, 0, -1) + edge(x0, y0, x0, y0 + h, e.left, -1, 0) + edge(x0 + w, y0, x0 + w, y0 + h, e.right, 1, 0);
    o += `<text x="${x0 + w / 2}" y="${y0 + h + 34}" font-size="12" text-anchor="middle" fill="${INK}">a = ${fmtG(g.a, 0)} mm</text>`;
    o += `<text x="${x0 - 30}" y="${y0 + h / 2}" font-size="12" text-anchor="middle" fill="${INK}" transform="rotate(-90 ${x0 - 30} ${y0 + h / 2})">b = ${fmtG(g.b, 0)} mm</text>`;
    o += `<text x="${x0 + 4}" y="${y0 + h - 6}" font-size="9.5" fill="#6e6d69">z = 0</text>`;
    // charge linéique / ponctuelle des bandes
    if (c.strip && s.load !== 'uni') {
      const yl = y0 + h - (g.d / g.b) * h;
      if (s.load === 'line') o += `<line x1="${x0}" y1="${yl}" x2="${x0 + w}" y2="${yl}" stroke="${DARK}" stroke-width="2.4"/><text x="${x0 + w - 4}" y="${yl - 5}" font-size="10" text-anchor="end" fill="${DARK}" font-weight="700">p</text>`;
      else { const bw = Math.min(w, g.beff * k); o += `<line x1="${x0 + (w - bw) / 2}" y1="${yl}" x2="${x0 + (w + bw) / 2}" y2="${yl}" stroke="${DARK}" stroke-width="1.2" stroke-dasharray="3 2"/><circle cx="${x0 + w / 2}" cy="${yl}" r="5" fill="${DARK}"/><text x="${x0 + w / 2 + 8}" y="${yl - 6}" font-size="10" fill="${DARK}" font-weight="700">P${bw < w - 0.5 ? ' (b_eff)' : ''}</text>`; }
    } else if (s.load === 'conc') o += `<circle cx="${x0 + w / 2}" cy="${y0 + h / 2}" r="${Math.max(3, (+s.pos.ro || 0) * k)}" fill="none" stroke="${DARK}" stroke-width="1.4"/>`;
    R.uls.forEach((u, i) => {
      if (!u.pos) return;
      const x = x0 + (u.pos[0] + 0.5) * w + (c.strip ? (i % 2 ? 9 : -9) : 0), y = y0 + h - u.pos[1] * h, col = u.unit === 'mm' ? OK : u.unit === 'MPa' ? RED : DARK;
      o += `<circle cx="${x}" cy="${y}" r="5.5" fill="${col}" stroke="#fff" stroke-width="1.5"/><text x="${x + 7}" y="${y - 6}" font-size="11" font-weight="700" fill="${INK}">${i + 1}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block" font-family="Inter, sans-serif">${o}</svg>
      <div class="pl-legend"><span class="k fx">encastré</span><span class="k ss">appui simple</span><span class="k fr">bord libre</span></div>`;
  }
  // coupe de la composition (épaisseurs dilatées), axe neutre
  function section(R, W = 420) {
    const G = R.comp; if (!G) return '';
    const hint = G.mono ? 0 : (G.total - G.glass) / Math.max(1, G.plies.length - 1);
    const k = Math.min(5, 120 / G.total), H = G.total * k + 30, x0 = 120, x1 = W - 150;
    let o = '', y = H - 14;
    G.plies.forEach((p, i) => {
      const hh = p.h * k;
      o += `<rect x="${x0}" y="${y - hh}" width="${x1 - x0}" height="${hh}" fill="${GLASS}" stroke="${INK}" stroke-width="1"/>`;
      o += `<text x="${x0 - 8}" y="${y - hh / 2 + 4}" font-size="11" text-anchor="end" fill="${INK}">pli ${i + 1} · ${fmtG(p.h, 2)} mm</text>`;
      o += `<text x="${x1 + 8}" y="${y - hh / 2 + 4}" font-size="10.5" fill="#6e6d69">${esc(GL.TEMPER[p.temper] ? GL.TEMPER[p.temper].short : '')}${G.mono ? '' : ` · h_ef;σ = ${fmtG(G.hs[i], 2)}`}</text>`;
      y -= hh;
      if (i < G.plies.length - 1) { const hi = hint * k; o += `<rect x="${x0}" y="${y - hi}" width="${x1 - x0}" height="${hi}" fill="${ACC}" opacity=".55"/>`; y -= hi; }
    });
    if (!G.mono) { const yn = H - 14 - G.eff.z0 * k; o += `<line x1="${x0 - 4}" y1="${yn}" x2="${x1 + 4}" y2="${yn}" stroke="${RED}" stroke-width="1" stroke-dasharray="4 3"/>`; }
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;margin-top:10px" font-family="Inter, sans-serif">${o}</svg>${G.mono ? '' : `<p class="cap">${sub('Coupe dilatée (pli 1 en face inférieure) ; tireté rouge : plan de référence des distances h_m,k (' + (R.comp.eff.ref === 'cg' ? 'centre de gravité du verre' : 'plan de symétrie du feuilleté') + ').')}</p>`}`;
  }
  // élévation d'une bande : appuis, charge, moment (ELU) et déformée (ELS)
  function elevation(R, s, W = 520) {
    const c = R.case, g = R.geo, Bu = R.ulsBeam, Bs = R.slsBeam;
    if (!c.strip || !Bu) return '';
    const m = 40, H = 210, L = g.b, kx = (W - 2 * m) / L, X = (x) => m + x * kx, yb = 70;
    let o = `<line x1="${X(0)}" y1="${yb}" x2="${X(L)}" y2="${yb}" stroke="${INK}" stroke-width="3"/>`;
    const sup = (x, k, dir) => k === 'fx' ? `<line x1="${X(x)}" y1="${yb - 16}" x2="${X(x)}" y2="${yb + 16}" stroke="${INK}" stroke-width="3"/>${[...Array(5)].map((_, i) => `<line x1="${X(x)}" y1="${yb - 14 + i * 7}" x2="${X(x) - dir * 7}" y2="${yb - 8 + i * 7}" stroke="${INK}"/>`).join('')}`
      : k === 'ss' ? `<path d="M${X(x)} ${yb + 2} l-7 12 h14 z" fill="#fff" stroke="${INK}"/>` : '';
    o += sup(0, c.edges.bottom, 1) + sup(L, c.edges.top, -1);
    // charges
    if (s.load === 'uni') { for (let i = 0; i <= 12; i++) { const x = X(L * i / 12); o += `<line x1="${x}" y1="${yb - 30}" x2="${x}" y2="${yb - 4}" stroke="${DARK}"/><path d="M${x} ${yb - 3} l-3 -6 h6 z" fill="${DARK}"/>`; } o += `<line x1="${X(0)}" y1="${yb - 30}" x2="${X(L)}" y2="${yb - 30}" stroke="${DARK}"/>`; }
    else { const x = X(g.d); o += `<line x1="${x}" y1="${yb - 38}" x2="${x}" y2="${yb - 5}" stroke="${DARK}" stroke-width="2"/><path d="M${x} ${yb - 3} l-5 -9 h10 z" fill="${DARK}"/><text x="${x + 6}" y="${yb - 30}" font-size="11" font-weight="700" fill="${DARK}">${s.load === 'line' ? 'p' : 'P'}</text>`; }
    // moment ELU (fibre tendue : positif vers le bas)
    const mMax = Math.max(1e-9, ...Bu.ms.map(Math.abs)), ym = 150, km = 40 / mMax;
    const pts = Bu.xs.map((x, i) => `${X(x).toFixed(1)},${(ym + Bu.ms[i] * km).toFixed(1)}`).join(' ');
    o += `<polygon points="${X(0)},${ym} ${pts} ${X(L)},${ym}" fill="rgba(107,143,194,.25)" stroke="${ACC}" stroke-width="1.3"/><line x1="${X(0)}" y1="${ym}" x2="${X(L)}" y2="${ym}" stroke="${INK}"/>`;
    const lab = (x, v) => `<text x="${Math.min(W - m, Math.max(m, X(x)))}" y="${ym + v * km + (v >= 0 ? 13 : -5)}" font-size="10" text-anchor="middle" fill="${INK}">${fmtG(v / 1000, 2)}</text>`;
    if (Math.abs(Bu.MA) > 1e-6 * mMax) o += lab(0, Bu.MA);
    if (Math.abs(Bu.MB) > 1e-6 * mMax) o += lab(L, Bu.MB);
    if (Bu.mpos.v > 1e-6 * mMax) o += lab(Bu.mpos.x, Bu.mpos.v);
    o += `<text x="${W - 4}" y="${ym - 6}" font-size="10" text-anchor="end" fill="#6e6d69">m ELU [kN·m/m]</text>`;
    // déformée ELS (amplifiée)
    if (Bs) {
      const yM = Math.max(1e-9, ...Bs.ys.map(Math.abs)), ky = 22 / yM;
      o += `<polyline points="${Bs.xs.map((x, i) => `${X(x).toFixed(1)},${(yb + Bs.ys[i] * ky).toFixed(1)}`).join(' ')}" fill="none" stroke="${OK}" stroke-width="1.3" stroke-dasharray="5 3"/>`;
      o += `<text x="${X(Bs.ymax.x)}" y="${yb + Bs.ymax.v * ky + 14}" font-size="10" text-anchor="middle" fill="${OK}">${fmtG(Bs.ymax.v, 2)} mm</text>`;
    }
    o += `<text x="${X(0)}" y="${H - 6}" font-size="10" fill="#6e6d69">z = 0</text><text x="${X(L)}" y="${H - 6}" font-size="10" text-anchor="end" fill="#6e6d69">z = b = ${fmtG(L, 0)} mm</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block" font-family="Inter, sans-serif">${o}</svg>`;
  }

  // ======================================================================
  //  PAGE
  // ======================================================================
  function render(app) {
    const { p } = A().crumbK('vitrage');
    const c = C.CASE[st.cas], key = C.valKey(st.load), unit = C.valUnit(st.load), adm = st.res.mode === 'adm', lam = st.comp.mode === 'feuillete';
    const groups = C.GROUPS.map(([gid, gname]) => `<div class="pl-group"><div class="sub-title">${gname}</div><div class="pl-cases">${C.CASES.filter((x) => x.group === gid).map((x) =>
      `<button type="button" class="pl-case${x.id === st.cas ? ' on' : ''}" data-qact="cas" data-v="${x.id}">${icon(x.edges)}<span>${esc(x.label)}<small>${x.strip ? 'statique de poutre' + (x.xl ? ' — classeur' : '') : 'Roark cas ' + x.roark}</small></span></button>`).join('')}</div></div>`).join('');
    const plyRows = st.comp.plies.map((x, i) => `<tr><td class="rowh">Pli ${i + 1}${i === 0 ? ' <small>(face inf.)</small>' : ''}</td><td><input type="number" step="any" data-qp="comp.plies.${i}.h" value="${esc(x.h)}"></td><td>${sel(`comp.plies.${i}.temper`, tempers(), { style: 'min-width:170px' })}</td><td class="ro" id="qHs${i}"></td><td>${st.comp.plies.length > 1 ? `<button class="btn sm ghost" data-qact="delPly" data-i="${i}" title="Supprimer ce pli">✕</button>` : ''}</td></tr>`).join('');
    const durOpts = GL.DURATIONS.map((x) => [x.id, x.label]);
    const ulsRows = st.uls.map((x, i) => `<tr><td><input type="text" data-qp="uls.${i}.name" value="${esc(x.name)}" style="min-width:130px;text-align:left"></td><td><input type="number" step="any" data-qp="uls.${i}.${key}" value="${esc(x[key])}"></td>
      ${adm ? '' : `<td>${sel(`uls.${i}.dur`, durOpts, { rr: true, style: 'min-width:150px' })}</td><td>${x.dur === 'autre' ? `<input type="number" step="any" data-qp="uls.${i}.hrs" value="${esc(x.hrs)}" placeholder="heures">` : ''}</td><td class="ro" id="qKm${i}"></td>`}
      <td class="ro" id="qFd${i}"></td><td class="ro" id="qSg${i}"></td><td class="ro" id="qUr${i}"></td><td>${st.uls.length > 1 ? `<button class="btn sm ghost" data-qact="delUls" data-i="${i}" title="Supprimer ce cas">✕</button>` : ''}</td></tr>`).join('');
    const fdc = st.slsCrit === 'fd', FDd = C.fdDefl(c, +st.a || 0, +st.b || 0, !!st.igu);
    const slsRows = st.sls.map((x, i) => `<tr><td><input type="text" data-qp="sls.${i}.name" value="${esc(x.name)}" style="min-width:130px;text-align:left"></td><td><input type="number" step="any" data-qp="sls.${i}.${key}" value="${esc(x[key])}"></td><td>${fdc ? `<input type="number" value="${FDd.lim}" disabled>` : `<input type="number" step="any" data-qp="sls.${i}.lim" value="${esc(x.lim)}" placeholder="ex. 150">`}</td><td>${fdc ? `<input type="number" value="${FDd.max}" disabled>` : `<input type="number" step="any" data-qp="sls.${i}.max" value="${esc(x.max)}" placeholder="—">`}</td><td class="ro" id="qSlsY${i}"></td><td class="ro" id="qSlsR${i}"></td><td>${st.sls.length > 1 ? `<button class="btn sm ghost" data-qact="delSls" data-i="${i}" title="Supprimer ce cas">✕</button>` : ''}</td></tr>`).join('');
    const lbA = c.strip ? 'Largeur a' : 'Côté a', lbB = c.strip ? (c.bc === 'cant' ? 'Porte-à-faux b' : 'Portée b') : 'Côté b';
    app.innerHTML = `<div class="page">
      <div class="actionbar">
        <div class="grow"><span class="crumb">${p ? `Projet <b>${esc(p.name)}</b> ›` : 'Hors projet ›'} <b id="qCrumb">${esc(st.name || 'Sans nom')}</b></span><span class="dirty" id="qDirty">${dirty ? 'modifié · non enregistré' : ''}</span></div>
        <span id="qVerdict"></span>
        <div class="btn-group"><button class="btn" data-qact="new">Nouveau</button><button class="btn" data-qact="save">Enregistrer</button><button class="btn" data-qact="saveas">Enregistrer sous…</button></div>
        <button class="btn primary" data-qact="report">Fiche NDC ↗</button>
      </div>
      ${blockHead('01', 'Conditions d’appui', 'Vitrage rectangulaire chargé normalement à son plan. Plaques : coefficients α, β, γ du tableau 11.4 de Roark. Bandes et consoles : statique de poutre de largeur unité, toute position de charge.')}
      ${groups}
      ${blockHead('02', 'Vitrage', 'Monolithique ou feuilleté. Feuilleté : épaisseurs effectives NF EN 16612 — h<sub>ef;w</sub> pour la flèche, h<sub>ef;σ,j</sub> pour la contrainte du pli j — selon le coefficient de transfert de cisaillement ω de l’intercalaire.')}
      <div class="cols2"><div>
        <div class="fields">${field('Repère', inp('name', { type: 'text', ph: 'ex. Verrière V1' }))}</div>
        <p class="muted" style="font-size:12.5px;margin:4px 0 8px">${esc(c.ab)}</p>
        <div class="fields">${field(lbA, inp('a'), 'mm')}${field(lbB, inp('b'), 'mm')}${field('Module E', inp('mat.E'), 'MPa')}${field('Coefficient de Poisson ν', inp('mat.nu'), '', 'FD P78-468 § 6 : 0,23')}</div>
        <div class="sub-title">Composition</div>
        ${chips('comp', st.comp.mode, [['mono', 'Monolithique'], ['feuillete', 'Feuilleté']])}
        ${lam ? `<div class="tbl-wrap" style="margin-top:12px"><table class="grid"><thead><tr><th class="rowh">Pli</th><th>h [mm]</th><th>Traitement</th><th>h<sub>ef;σ</sub> [mm]</th><th></th></tr></thead><tbody>${plyRows}</tbody></table></div>
          <div style="margin:8px 0 12px"><button class="btn sm" data-qact="addPly" title="Ajouter un pli">+ pli</button></div>
          <div class="fields">${field('Intercalaire', inp('comp.hint'), 'mm', 'épaisseur de chaque intercalaire')}${field('Transfert de cisaillement ω', inp('comp.w'), '', '0 : plis indépendants · 1 : monolithique ; valeurs par cas de charge dans l’onglet Épaisseur équivalente')}${field('Plan de référence h<sub>m</sub>', sel('comp.ref', [['geo', 'Plan de symétrie (EN 16612)'], ['cg', 'Centre de gravité du verre']]))}</div>
          <p class="muted" style="font-size:12.5px;margin-top:8px" id="qHw"></p>`
        : `<div class="fields" style="margin-top:12px">${field('Épaisseur t', inp('comp.t'), 'mm', 'épaisseur de calcul (min. EN 572 si besoin)')}${field('Traitement', sel('comp.temper', tempers()))}</div>`}
        ${c.strip ? `<div style="margin-top:14px">${chk('cyl', 'Rigidité de plaque en flexion cylindrique D′ = E·t³/12(1 − ν²) (sinon poutre : D′ = E·t³/12, comme le classeur)')}</div>` : ''}
      </div>
      <div><div class="fig" id="qFig"></div><div id="qSec"></div></div></div>
      ${blockHead('03', 'Résistance du verre', adm ? 'Contrainte admissible saisie, comparée à la contrainte maximale de calcul.' : 'NF EN 16612 : f<sub>g;d</sub> = k<sub>e</sub>·k<sub>mod</sub>·k<sub>sp</sub>·f<sub>g;k</sub>/γ<sub>M;A</sub> + k<sub>v</sub>·(f<sub>b;k</sub> − f<sub>g;k</sub>)/γ<sub>M;v</sub>. k<sub>mod</sub> du tableau 25 de FD P78-468 selon la charge, ou 0,663·t<sup>−1/16</sup> pour une durée cumulée t [h]. γ selon FD P78-468 (France) ou NF EN 16612.')}
      ${chips('res', st.res.mode, [['en16612', 'NF EN 16612 / FD P78-468'], ['adm', 'Contrainte admissible']])}
      <div class="fields" style="margin-top:14px">${adm ? field('Contrainte admissible σ<sub>adm</sub>', inp('res.fadm'), 'MPa')
        : `${field('Surface', sel('res.surface', GL.SURFACES.map((x) => [x.id, `${x.label} — kₛₚ = ${String(x.ksp).replace('.', ',')}`])))}${field('Coefficients γ<sub>M</sub>', sel('res.gRef', [['fd', 'FD P78-468 (France) — 1,5 / 1,5'], ['en', 'NF EN 16612 — 1,8 / 1,2'], ['custom', 'Valeurs saisies']], { rr: true }), '', 'γ<sub>M;A</sub> / γ<sub>M;v</sub>')}${field('γ<sub>M;A</sub>', inp('res.gMA'), '', 'verre recuit')}${field('γ<sub>M;v</sub>', inp('res.gMv'), '', 'part due à la précontrainte')}${field('f<sub>g;k</sub>', inp('res.fgk'), 'MPa', 'verre recuit : 45 MPa')}${field('k<sub>e</sub>', inp('res.ke'), '', st.res.gRef === 'fd' ? 'recuit seulement (FD tableau 24) : 0,8 avec bord libre à bords bruts ou AA, sinon 1,0' : 'facteur de bord (1,0 en partie courante)')}${field('k<sub>v</sub>', sel('res.kv', [['1', 'Horizontale — 1,0'], ['0.6', 'Verticale — 0,6']]), '', 'orientation de la trempe')}`}</div>
      <p class="muted" style="font-size:12.5px;margin-top:8px" id="qFgd"></p>
      ${blockHead('04', 'Charges', `Intensités de calcul (ELU) et de service (ELS) en ${unit}. ${c.strip ? 'Bande : pression uniforme, charge linéique parallèle aux côtés tenus (ex. main courante) ou charge ponctuelle.' : 'Pression maximale pour les charges variables.'}`)}
      <div class="fields">${field('Type de charge', sel('load', Object.entries(c.loads).map(([k, l]) => [k, `${l.label}${c.strip ? '' : ` (${l.roark})`}`]), { rr: true }))}
        ${c.strip && st.load !== 'uni' ? field('Position d depuis z = 0', inp('pos.d', { ph: c.bc === 'cant' ? 'b (extrémité)' : 'b/2' }), 'mm', c.bc === 'cant' ? 'vide : extrémité libre' : 'vide : mi-portée') : ''}
        ${c.strip && st.load === 'point' ? field('Largeur participante b<sub>eff</sub>', inp('pos.beff', { ph: 'a (toute la largeur)' }), 'mm', 'vide : toute la largeur a') : ''}
        ${st.load === 'conc' ? field('Rayon de la zone chargée r<sub>o</sub>', inp('pos.ro'), 'mm', 'r′<sub>o</sub> = √(1,6·r<sub>o</sub>² + t²) − 0,675·t si r<sub>o</sub> < 0,5·t') : ''}</div>
      <div class="sub-title">Cas ELU — contrainte</div>
      <div class="tbl-wrap"><table class="grid">
        <thead><tr><th class="rowh">Cas ELU</th><th>${C.valKey(st.load)} [${unit}]</th>${adm ? '' : '<th>Durée cumulée</th><th>[h]</th><th>k<sub>mod</sub></th>'}<th>${adm ? 'σ<sub>adm</sub>' : 'f<sub>g;d</sub>'} [MPa]</th><th>σ<sub>max</sub> [MPa]</th><th>Taux</th><th></th></tr></thead>
        <tbody>${ulsRows}</tbody></table></div>
      <div style="margin:8px 0 4px"><button class="btn sm" data-qact="addUls" title="Ajouter un cas ELU">+</button></div>
      <div class="sub-title">Cas ELS — flèche</div>
      <div class="fields wide" style="margin-bottom:10px">${field('Critère de flèche', sel('slsCrit', [['fd', 'FD P78-468 § 10.5'], ['libre', 'Limite et plafond saisis']], { rr: true }), '', fdc ? `${esc(FDd.ref)} : ${esc(FDd.Ln)}/${FDd.lim} ≤ ${FDd.max} mm` : 'limite rapportée à b')}
        ${fdc && R0group(c) ? `<label class="field"><span>&nbsp;</span>${chk('igu', 'Vitrage isolant (limite /150)', true)}</label>` : ''}</div>
      <div class="tbl-wrap"><table class="grid">
        <thead><tr><th class="rowh">Cas ELS</th><th>${C.valKey(st.load)} [${unit}]</th><th>Limite ${fdc ? esc(FDd.Ln) : 'b'} /</th><th>Plafond [mm]</th><th>Flèche [mm]</th><th>Taux</th><th></th></tr></thead>
        <tbody>${slsRows}</tbody></table></div>
      <div style="margin:8px 0 4px"><button class="btn sm" data-qact="addSls" title="Ajouter un cas ELS">+</button></div>
      ${(st.cas === 'c1' || st.cas === 'c8') && st.load === 'uni' ? `<div style="margin:12px 0">${chk('large', 'Afficher pour information l’effet membrane (grandes flèches, § 11.11) — les vérifications restent linéaires')}</div>` : ''}
      ${blockHead('05', 'Résultats', c.strip ? 'σ = 6·m/t² (m par unité de largeur), flèche par double intégration de m/D′ ; σ positive quand la face opposée à la charge est tendue.' : 'σ = β·q·b²/t², y = α·q·b⁴/(E·t³), R = γ·q·b ; σ positive quand la face opposée à la charge est tendue. Coins supposés maintenus.')}
      <div id="qResults"></div>
    </div>`;
    refresh();
  }

  function refresh() {
    const R = C.compute(st);
    const v = $('#qVerdict');
    if (v) v.innerHTML = !R.valid ? '<span class="verdict ko">— <small>données invalides</small></span>' : (R.status === 'oor' ? '<span class="verdict" style="background:var(--paper-2);color:var(--ink)">— <small>hors domaine</small></span>' : `<span class="verdict ${R.max <= 1 ? 'ok' : 'ko'}">${pct(R.max)} <small>${R.max <= 1 ? 'vérifié*' : 'non vérifié'}</small></span>`);
    const dd = $('#qDirty'); if (dd) dd.textContent = dirty ? 'modifié · non enregistré' : '';
    const cn = $('#qCrumb'); if (cn) cn.textContent = st.name || 'Sans nom';
    const box = $('#qResults'), fig = $('#qFig'), sec = $('#qSec');
    const G = C.composition(st);
    if (G && !G.mono) { G.hs.forEach((h, i) => { const e = $('#qHs' + i); if (e) e.textContent = fmt(h, 2); }); const hw = $('#qHw'); if (hw) hw.innerHTML = `h<sub>ef;w</sub> = <b style="color:var(--ink)">${fmt(G.hw, 2)} mm</b> (flèche) · verre ${fmtG(G.glass, 2)} mm · épaisseur totale ${fmtG(G.total, 2)} mm · poids ${fmt(G.glass * GL.RHO / 1000, 2)} kN/m²`; }
    if (!R.valid) { if (box) box.innerHTML = R.warnings.map((x) => `<p class="note warn">${sub(x)}</p>`).join(''); if (fig) fig.innerHTML = ''; if (sec) sec.innerHTML = ''; return; }
    const g = R.geo, adm = st.res.mode === 'adm';
    if (fig) fig.innerHTML = plan(R, st) + (R.case.strip ? `<div style="border-top:1px solid var(--line);margin-top:8px;padding-top:6px">${elevation(R, st)}</div>` : '');
    if (sec) sec.innerHTML = section(R);
    // résistance : rappel par traitement présent
    const fg = $('#qFgd');
    if (fg) {
      if (adm) fg.innerHTML = '';
      else {
        const used = [...new Set(R.comp.plies.map((p) => p.temper))];
        fg.innerHTML = R.ulsCases.map((x) => `${esc(x.name)} (k<sub>mod</sub> = ${fmt(x.kmod, 3)}) : ${used.map((t) => { const f = GL.fgd(st.res, t, x.kmod); return `${esc(GL.TEMPER[t].short)} f<sub>g;d</sub> = <b style="color:var(--ink)">${fmt(f.v, 1)} MPa</b>${f.available ? '' : ' ⚠'}`; }).join(' · ')}`).join('<br>');
      }
    }
    R.ulsCases.forEach((x, i) => {
      const p = x.gov, set1 = (id, h) => { const e = $(id + i); if (e) e.innerHTML = h; };
      set1('#qKm', fmt(x.kmod, 3));
      set1('#qFd', p ? fmt(p.fd.v, 1) + (R.comp.mono ? '' : ` <small>(pli ${p.k + 1})</small>`) : '—');
      set1('#qSg', p && p.s ? fmt(Math.abs(p.s.v), 1) : '—');
      set1('#qUr', x.chk ? `<b style="color:${x.chk.r > 1 ? 'var(--c-red)' : 'inherit'}">${pct(x.chk.r)}</b>${R.ulsCases.length > 1 && x === R.ulsGov ? ' ◂' : ''}` : '—');
    });
    R.slsCases.forEach((x, i) => { const cy = $('#qSlsY' + i), cr = $('#qSlsR' + i); if (cy) cy.textContent = x.y ? fmt(Math.abs(x.y.v), 2) + ' ≤ ' + fmt(x.limv, 2) : '—'; if (cr) cr.innerHTML = x.chk ? `<b style="color:${x.chk.r > 1 ? 'var(--c-red)' : 'inherit'}">${pct(x.chk.r)}</b>${R.slsCases.length > 1 && x === R.slsGov ? ' ◂' : ''}` : '—'; });
    if (!box) return;
    const yS = R.slsGov && R.slsGov.y, ug = R.ulsGov, gp = ug && ug.gov;
    const rows = R.checks.map((x) => `<tr${R.gov === x ? ' class="gov"' : ''}><td>${sub(x.label)}</td><td class="f">${sub(x.ref)}</td><td class="num">${fmt(x.Ed, x.unit === 'mm' ? 2 : 1)}</td><td class="num">${fmt(x.Rd, x.unit === 'mm' ? 2 : 1)}</td><td class="f">${x.unit}</td><td class="num"><span class="ratio">${pct(x.r)}</span></td><td style="width:100px">${bar(x.r)}</td><td>${pill(x.r)}</td></tr>`).join('');
    const outRows = R.uls.map((o, i) => `<tr><td><span class="pl-badge ${o.unit === 'mm' ? 'y' : o.unit === 'MPa' ? 's' : 'R'}">${i + 1}</span></td><td>${sub(o.label)}</td><td class="f">${sub(o.formula)}</td>${R.case.strip ? '' : `<td class="num">${fmt(o.k, 4)}</td>`}<td class="num"><b>${fV(o)}</b></td><td class="num">${fV(R.sls[i])}</td><td class="f">${o.unit}</td></tr>`).join('');
    const plyTab = R.comp.mono ? '' : `<div class="sub-title" style="margin-top:22px">Contraintes par pli</div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Cas ELU</th>${R.comp.plies.map((p, k) => `<th class="num">Pli ${k + 1} — ${fmtG(p.h, 2)} mm ${esc(GL.TEMPER[p.temper].short)}<br><small>h<sub>ef;σ</sub> = ${fmt(R.comp.hs[k], 2)} mm</small></th>`).join('')}</tr></thead><tbody>
      ${R.ulsCases.map((x) => `<tr${x === R.ulsGov ? ' class="gov"' : ''}><td>${esc(x.name)}</td>${x.plies.map((p) => `<td class="num">${fmt(Math.abs(p.s ? p.s.v : 0), 1)} / ${fmt(p.fd.v, 1)} MPa = <b>${pct(p.r)}</b></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const L = R.large;
    const large = L && st.large ? `<div class="sub-title" style="margin-top:22px">Grandes flèches — effet membrane (Roark § 11.11)</div>
      <p class="note">Bords retenus dans leur plan (« held »), ν = 0,316, tableau a/b = ${esc(L.table)}, épaisseur h<sub>ef;w</sub>. Relation α·Q = w + k·w³ (w = y/t, Q = q·b⁴/(E·t⁴)) tangente à la théorie linéaire, k ajusté sur le tableau ; contrainte totale (flexion + membrane) ${esc(L.where)}.${L.uls.out || L.sls.out ? ' Q au-delà du tableau (250) : extrapolation.' : ''}</p>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th></th><th class="num">Q</th><th class="num">Linéaire</th><th class="num">Grandes flèches</th></tr></thead><tbody>
        <tr><td>Flèche ELS</td><td class="num">${fmt(L.sls.Q, 1)}</td><td class="num">${yS ? fmt(yS.v, 2) : '—'} mm</td><td class="num"><b>${fmt(L.sls.y, 2)} mm</b></td></tr>
        <tr><td>Contrainte maximale ELU (épaisseur h<sub>ef;w</sub>)</td><td class="num">${fmt(L.uls.Q, 1)}</td><td class="num">${fmt(Math.abs(R.sLinW), 1)} MPa</td><td class="num"><b>${fmt(L.uls.s, 1)} MPa</b></td></tr>
      </tbody></table></div>
      <p class="note">${yS && L.sls.y < yS.v * 0.95 ? `La rigidité de membrane réduit la flèche ELS de ${Math.round((1 - L.sls.y / yS.v) * 100)} % : utilisable si les bords sont effectivement retenus dans leur plan. Les vérifications ci-dessus restent celles de la théorie linéaire, du côté de la sécurité.` : 'Petites flèches : la théorie linéaire suffit.'}</p>` : '';
    const tab = R.case.strip ? '' : (() => {
      const keys = Object.keys(R.L.c), nm = (k) => ({ a: 'α', b: 'β', g: 'γ' }[k[0]] + (k.length > 1 ? `<sub>${k[1]}</sub>` : ''));
      return `<details class="pl-tab"><summary>Coefficients de Roark, cas ${esc(R.L.roark)} (interpolés en a/b)</summary><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>a/b</th>${R.L.r.map((x) => `<th class="num">${x === Infinity ? '∞' : fmtG(x, 3)}</th>`).join('')}<th class="num hl">${fmt(g.ratio, 2)}</th></tr></thead><tbody>
        ${keys.map((k) => `<tr><td>${nm(k)}</td>${R.L.c[k].map((x) => `<td class="num">${fmtG(x, 4)}</td>`).join('')}<td class="num hl"><b>${fmtG(R.cs[k].v, 4)}</b></td></tr>`).join('')}</tbody></table></div></details>`;
    })();
    const sU = gp && gp.s;
    box.innerHTML = `${R.warnings.map((w) => `<p class="note warn">${sub(w)}</p>`).join('')}${R.info.map((w) => `<p class="note">${sub(w)}</p>`).join('')}
      <div class="kpis k3">
        ${R.status === 'oor' ? `<div class="kpi bad"><b>Hors domaine</b><span>—</span><small>a/b hors du tableau de Roark : conclusion impossible (taux indicatif ${pct(R.max)})</small></div>` : `<div class="kpi ${R.max <= 1 ? 'hero' : 'bad'}"><b>Taux maximal</b><span>${pct(R.max)}</span><small>${R.max <= 1 ? 'Vérifié pour les critères traités*' : 'Vitrage non vérifié'}</small></div>`}
        <div class="kpi"><b>Contrainte ELU${R.ulsCases.length > 1 ? ' — ' + esc(ug.name) : ''}</b><span>${sU ? fmt(Math.abs(sU.v), 1) + ' MPa' : '—'}</span><small>${gp ? `${adm ? 'σ<sub>adm</sub>' : 'f<sub>g;d</sub>'} = ${fmt(gp.fd.v, 1)} MPa${R.comp.mono ? '' : ` (pli ${gp.k + 1})`}` : ''}</small></div>
        <div class="kpi"><b>Flèche ELS${st.sls.length > 1 ? ' — ' + esc(R.slsGov.name) : ''}</b><span>${yS ? fmt(Math.abs(yS.v), 2) + ' mm' : '—'}</span><small>${yS ? `b/${Math.round(g.b / Math.abs(yS.v))} (limite ${fmt(R.slsGov.limv, 1)} mm) · y/h<sub>ef;w</sub> = ${fmt(Math.abs(yS.v) / R.comp.hw, 2)}` : 'non donnée par Roark pour ce cas'}</small></div>
      </div>
      <div class="tbl-wrap" style="margin-top:18px"><table class="tbl"><thead><tr><th>Critère</th><th>Réf.</th><th class="num">E<sub>d</sub></th><th class="num">R<sub>d</sub></th><th>Unité</th><th class="num">Taux</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${plyTab}
      <div class="sub-title" style="margin-top:22px">Grandeurs calculées</div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th></th><th>Grandeur</th><th>Formule</th>${R.case.strip ? '' : '<th class="num">Coef.</th>'}<th class="num">ELU${R.ulsCases.length > 1 ? ' « ' + esc(ug.name) + ' »' : ''}</th><th class="num">ELS${st.sls.length > 1 ? ' « ' + esc(R.slsGov.name) + ' »' : ''}</th><th>Unité</th></tr></thead><tbody>${outRows}</tbody></table></div>
      <p class="cap">Contraintes ELU calculées avec ${R.comp.mono ? 't' : `h<sub>ef;σ</sub> du pli dimensionnant (pli ${gp ? gp.k + 1 : 1})`} ; flèches avec ${R.comp.mono ? 't' : 'h<sub>ef;w</sub>'} ; réactions par mètre de côté.</p>
      ${large}${tab}
      <p class="note">* Critères traités : contrainte de flexion élastique (une seule direction de contrainte donnée par Roark) et flèche, en théorie linéaire. Hors champ : effet membrane (sauf information § 11.11), double vitrage (partage des charges, effet de la lame de gaz), stabilité des verres porteurs (déversement, voilement), choc (pendule), attaches et calages, contraintes thermiques. Si les coins peuvent se soulever, la contrainte au centre d’une plaque carrée sur appuis simples augmente d’environ 35 % (Roark § 11.10).</p>`;
  }

  // ======================================================================
  //  FICHE NDC
  // ======================================================================
  function page(state, project, idx, total, opts) {
    const s = C.upgrade(JSON.parse(JSON.stringify(state)));
    const R = C.compute(s);
    if (!R.valid) return `<section class="rp-page"><p>${esc(s.name)} : données invalides.</p></section>`;
    const g = R.geo, unit = R.unit, key = R.key, adm = s.res.mode === 'adm';
    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const head = `<header class="rp-head"><div class="l"><b>${esc(project || 'Note de calcul')}</b>Vitrage — prédimensionnement d’après Roark${adm ? '' : ' et NF EN 16612'}${opts && opts.ref ? ' · ' + esc(opts.ref) : ''}</div><div class="r">${!opts || opts.logo ? '<div class="logo-s">tracés</div>' : ''}${esc(s.name)} · ${date}</div></header>`;
    let n = 0; const H2 = (t) => `<h2><span class="n">${++n}</span>${t}</h2>`;
    const kv = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
    const chkRows = R.checks.map((x) => `<tr${R.gov === x ? ' class="gov"' : ''}><td>${sub(x.label)}</td><td>${sub(x.ref)}</td><td class="num">${fmt(x.Ed, x.unit === 'mm' ? 2 : 1)}</td><td class="num">${fmt(x.Rd, x.unit === 'mm' ? 2 : 1)}</td><td>${x.unit}</td><td class="num">${pct(x.r)}</td><td>${x.r <= 1 ? '<span class="rp-ok">OK</span>' : '<span class="rp-ko">Non vérifié</span>'}</td></tr>`).join('');
    const outRows = R.uls.map((o, i) => `<tr><td>${i + 1}</td><td>${sub(o.label)}</td><td>${sub(o.formula)}</td>${R.case.strip ? '' : `<td class="num">${fmt(o.k, 4)}</td>`}<td class="num">${fV(o)}</td><td class="num">${fV(R.sls[i])}</td><td>${o.unit}</td></tr>`).join('');
    const G = R.comp;
    const compTxt = G.mono ? `monolithique, t = ${fmtG(G.hw, 2)} mm, ${esc(GL.TEMPER[G.plies[0].temper].label.toLowerCase())}`
      : `feuilleté ${G.plies.map((p) => fmtG(p.h, 2)).join(' / ')} mm (${G.plies.map((p) => esc(GL.TEMPER[p.temper].short)).join(' / ')}), intercalaires ${fmtG(+s.comp.hint, 2)} mm, ω = ${fmtG(+s.comp.w, 2)}`;
    const sf = GL.SURFACE[s.res.surface] || GL.SURFACE.float;
    const notes = R.warnings.concat(R.info);
    const ulsRows = R.ulsCases.map((x) => `<tr${x === R.ulsGov ? ' class="gov"' : ''}><td>${esc(x.name)}</td><td class="num">${fmtG(x.val, 3)}</td>${adm ? '' : `<td>${esc(x.dur.id === 'autre' ? fmtG(x.hrs, 3) + ' h' : x.dur.label)}</td><td class="num">${fmt(x.kmod, 3)}</td>`}${x.plies.map((p) => `<td class="num">${fmt(Math.abs(p.s ? p.s.v : 0), 1)} / ${fmt(p.fd.v, 1)}</td>`).join('')}<td class="num">${x.chk ? pct(x.chk.r) : '—'}</td></tr>`).join('');
    const slsRows = R.slsCases.map((x) => `<tr${x === R.slsGov ? ' class="gov"' : ''}><td>${esc(x.name)}</td><td class="num">${fmtG(x.val, 3)}</td><td class="num">b/${fmtG(x.lim, 0)}${x.max > 0 ? ` ; ${fmtG(x.max, 1)} mm` : ''}</td><td class="num">${x.y ? fmt(Math.abs(x.y.v), 2) : '—'}</td><td class="num">${fmt(x.limv, 2)}</td><td class="num">${x.chk ? pct(x.chk.r) : '—'}</td></tr>`).join('');
    return `<section class="rp-page">${head}
      <div class="rp-title"><h1>${esc(s.name)} — ${fmtG(g.a, 0)} × ${fmtG(g.b, 0)} mm${total > 1 ? ` (${idx + 1}/${total})` : ''}</h1>
      <p>${esc(R.case.label)} · ${esc(R.L.label.toLowerCase())}${R.case.strip ? ' (statique de poutre)' : ` (Roark ${esc(R.L.roark)})`} · ${compTxt}</p></div>
      ${H2('Hypothèses')}
      <div class="rp-fig"><div style="width:88mm;flex:none">${plan(R, s, 420, 300)}</div><div style="flex:1;min-width:0">
        <div class="rp-kv" style="grid-template-columns:1fr">
        ${kv('Dimensions', `a = ${fmtG(g.a, 0)} mm, b = ${fmtG(g.b, 0)} mm${R.case.strip ? '' : `, a/b = ${fmt(g.ratio, 2)}`}`)}
        ${kv('Verre', `E = ${fmtG(g.E, 0)} MPa, ν = ${fmtG(g.nu, 2)}`)}
        ${G.mono ? kv('Épaisseur', `t = ${fmtG(G.hw, 2)} mm`) : kv('Épaisseurs effectives', `h<sub>ef;w</sub> = ${fmt(G.hw, 2)} mm ; h<sub>ef;σ</sub> = ${G.hs.map((h) => fmt(h, 2)).join(' / ')} mm`)}
        ${adm ? kv('Résistance', `σ<sub>adm</sub> = ${fmtG(+s.res.fadm, 1)} MPa`) : kv(s.res.gRef === 'fd' ? 'Résistance (NF EN 16612, γ FD P78-468)' : s.res.gRef === 'en' ? 'Résistance (NF EN 16612)' : 'Résistance (NF EN 16612, γ saisis)', `${esc(sf.label)}, k<sub>sp</sub> = ${fmtG(sf.ksp, 2)}, f<sub>g;k</sub> = ${fmtG(+s.res.fgk, 1)} MPa, γ<sub>M;A</sub> = ${fmtG(+s.res.gMA, 2)}, γ<sub>M;v</sub> = ${fmtG(+s.res.gMv, 2)}, k<sub>e</sub> = ${fmtG(+s.res.ke, 2)}, k<sub>v</sub> = ${fmtG(+s.res.kv, 2)}`)}
        ${R.case.strip && s.load !== 'uni' ? kv('Position de la charge', `d = ${fmtG(g.d, 0)} mm${s.load === 'point' ? `, b<sub>eff</sub> = ${fmtG(g.beff, 0)} mm` : ''}`) : ''}
        ${s.load === 'conc' ? kv('Zone chargée', `r<sub>o</sub> = ${fmtG(g.ro, 0)} mm`) : ''}
        </div>${section(R, 420)}</div></div>
      ${R.case.strip ? `<div style="max-width:150mm;margin-top:4pt">${elevation(R, s, 520)}</div>` : ''}
      ${H2('Charges et contraintes ELU')}
      <table><thead><tr><th>Cas</th><th class="num">${key} [${unit}]</th>${adm ? '' : '<th>Durée</th><th class="num">k<sub>mod</sub></th>'}${G.plies.map((p, k) => `<th class="num">${G.mono ? '' : `Pli ${k + 1} : `}σ / ${adm ? 'σ<sub>adm</sub>' : 'f<sub>g;d</sub>'} [MPa]</th>`).join('')}<th class="num">Taux</th></tr></thead><tbody>${ulsRows}</tbody></table>
      ${H2('Flèches ELS')}
      <table><thead><tr><th>Cas</th><th class="num">${key} [${unit}]</th><th class="num">Critère</th><th class="num">Flèche [mm]</th><th class="num">Limite [mm]</th><th class="num">Taux</th></tr></thead><tbody>${slsRows}</tbody></table>
      ${H2('Grandeurs calculées')}
      <table><thead><tr><th></th><th>Grandeur</th><th>Formule</th>${R.case.strip ? '' : '<th class="num">Coef.</th>'}<th class="num">ELU</th><th class="num">ELS</th><th>Unité</th></tr></thead><tbody>${outRows}</tbody></table>
      ${H2('Vérifications')}
      <table><thead><tr><th>Critère</th><th>Réf.</th><th class="num">E<sub>d</sub></th><th class="num">R<sub>d</sub></th><th>Unité</th><th class="num">Taux</th><th>Statut</th></tr></thead><tbody>${chkRows}</tbody></table>
      ${R.large && s.large ? `<p style="font-size:7.6pt">Grandes flèches (§ 11.11, bords retenus dans leur plan) : flèche ELS ${R.slsCases.map((x, i) => (R.slsCases.length > 1 ? esc(x.name) + ' ' : '') + fmt(R.large.slsAll[i].y, 2) + ' mm').join(', ')}, contrainte ELU ${fmt(R.large.uls.s, 1)} MPa (pour information).</p>` : ''}
      ${notes.length ? `<p style="font-size:7.6pt"><b>Remarques :</b> ${notes.map(sub).join(' ')}</p>` : ''}
      <div class="rp-concl"><span>Conclusion — ${G.mono ? `${fmtG(G.hw, 2)} mm ${esc(GL.TEMPER[G.plies[0].temper].short)}` : `feuilleté ${G.plies.map((p) => fmtG(p.h, 2)).join('/')}`}</span><b class="${R.status === 'ok' ? 'rp-ok' : 'rp-ko'}">${R.status === 'oor' ? 'Hors domaine du tableau de Roark — conclusion impossible' : (R.max <= 1 ? 'Vérifié' : 'Non vérifié') + ' — taux max. ' + pct(R.max)}</b></div>
      <p style="font-size:7.4pt;color:#555;margin-top:5pt">${R.case.strip ? 'Bande de largeur unité, statique de poutre.' : 'W. C. Young, R. G. Budynas, Roark’s Formulas for Stress and Strain, chapitre 11, tableau 11.4 (coefficients interpolés en a/b).'} ${adm ? '' : 'Résistance de calcul et épaisseurs effectives selon NF EN 16612.'} Théorie linéaire ; hors champ : effet membrane, double vitrage, stabilité, choc, attaches, contraintes thermiques.</p>
    </section>`;
  }

  // ======================================================================
  //  ÉVÉNEMENTS
  // ======================================================================
  function bind(app) {
    const onEdit = (e) => {
      const t = e.target; if (!t.dataset || !t.dataset.qp || t.closest('.modal')) return;
      if (e.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return;
      set(t.dataset.qp, t.type === 'checkbox' ? t.checked : t.value);
      dirty = true; persist();
      // coefficients γ : le référentiel fixe les valeurs ; une saisie directe passe en « valeurs saisies »
      if (t.dataset.qp === 'res.gRef' && GL.GAMMAS[t.value]) { st.res.gMA = GL.GAMMAS[t.value].gMA; st.res.gMv = GL.GAMMAS[t.value].gMv; }
      if (t.dataset.qp === 'res.gMA' || t.dataset.qp === 'res.gMv') { st.res.gRef = C.gRefOf(st.res); const s2 = $('[data-qp="res.gRef"]'); if (s2) s2.value = st.res.gRef; }
      if (t.dataset.rr && e.type === 'change') { const y = window.scrollY; render(app); window.scrollTo(0, y); return; }
      refresh();
    };
    app.addEventListener('input', onEdit);
    app.addEventListener('change', onEdit);
    app.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-qact]'); if (!b) return;
      const a = b.dataset.qact, y = window.scrollY;
      const rr = () => { dirty = true; persist(); render(app); window.scrollTo(0, y); };
      if (a === 'cas') { st.cas = b.dataset.v; if (!C.CASE[st.cas].loads[st.load]) st.load = 'uni'; rr(); }
      else if (a === 'comp') { st.comp.mode = b.dataset.v; rr(); }
      else if (a === 'res') { st.res.mode = b.dataset.v; rr(); }
      else if (a === 'addPly') { const L = st.comp.plies[st.comp.plies.length - 1] || { h: 8, temper: 'trempe' }; st.comp.plies.push({ h: L.h, temper: L.temper }); rr(); }
      else if (a === 'delPly') { st.comp.plies.splice(+b.dataset.i, 1); rr(); }
      else if (a === 'addUls') { const L = st.uls[st.uls.length - 1] || {}; st.uls.push({ name: 'ELU ' + (st.uls.length + 1), q: L.q, W: L.W, p: L.p, dur: L.dur || 'fdW', hrs: L.hrs || '' }); rr(); }
      else if (a === 'delUls') { st.uls.splice(+b.dataset.i, 1); rr(); }
      else if (a === 'addSls') { const L = st.sls[st.sls.length - 1] || {}; st.sls.push({ name: 'ELS ' + (st.sls.length + 1), q: L.q, W: L.W, p: L.p, lim: L.lim, max: L.max }); rr(); }
      else if (a === 'delSls') { st.sls.splice(+b.dataset.i, 1); rr(); }
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
  window.LaminaModules.vitrage = { kind: 'vitrage', route: 'roark', title: 'Vitrage — Roark', short: 'vitrage', ref: 'Roark · NF EN 16612 · FD P78-468', api, upgrade: C.upgrade };
})();
