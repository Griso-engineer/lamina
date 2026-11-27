/* ==========================================================================
   Lamina — pré-dimensionnement d'un vitrage : géométrie et appuis communs, puis une ligne par cas de charge.
   Chaque ligne : ELU (contrainte σ ≤ f_g;d) ou ELS (flèche ≤ limite) ; pression uniforme, charge linéique ou
   ponctuelle ; épaisseur équivalente h saisie (h_ef;σ pour l'ELU, h_ef;w pour l'ELS — onglet Épaisseur
   équivalente) et résistance f_g;d saisie (onglet Résistance). Formules : js/roark-calc.js.
   ========================================================================== */
(function () {
  'use strict';
  const GL = window.LaminaGlass, RK = window.LaminaRoark, num = GL.num;
  const CASE = RK.CASE, INF = Infinity;

  function defaultState() {
    return {
      v: 2, kind: 'vitrage', name: 'Vitrage V1', cas: 'c1', a: 3000, b: 1500, E: 70000, nu: 0.23, ro: 50, cyl: false, slsCrit: 'fd', igu: false, viz: 0,
      // exemple : feuilleté trempé 10/1,52/10, PVB, vent (ω = 0,3) : h_ef;σ = 18,06 mm, h_ef;w = 16,37 mm ; f_g;d = 80 MPa (FD P78-468)
      rows: [
        { name: 'Vent ELU', st: 'uls', load: 'uni', val: 1.8, d: '', beff: '', h: 18.06, f: 80, lim: 100, max: '' },
        { name: 'Vent ELS', st: 'sls', load: 'uni', val: 1.2, d: '', beff: '', h: 16.37, f: '', lim: 100, max: '' }
      ]
    };
  }

  /* Calcul enregistré avec l'ancien onglet « Roark » (v1) : composition et résistance converties en h et f_g;d par ligne. */
  function fromV1(s) {
    const d = defaultState(), cp = s.comp || {}, res = s.res || {}, pos = s.pos || {}, mat = s.mat || {};
    let plies, hw, hs;
    if (cp.mode !== 'feuillete') { const t = num(cp.t, 10); plies = [{ h: t, temper: cp.temper || 'trempe' }]; hw = t; hs = [t]; }
    else {
      plies = (cp.plies || []).map((p) => ({ h: num(p.h), temper: p.temper || 'trempe' })).filter((p) => p.h > 0);
      const e = GL.effective(plies.map((p) => p.h), num(cp.hint), num(cp.w), cp.ref === 'cg' ? 'cg' : 'geo');
      hw = e ? e.hw : 10; hs = e ? e.hs : [10];
    }
    const k = hs.indexOf(Math.min(...hs)), temper = (plies[k] || {}).temper || 'trempe';
    const key = RK.valKey(s.load || 'uni'), r2 = (x, n) => Math.round(x * 10 ** n) / 10 ** n;
    const resP = Object.assign({ gRef: res.gRef || RK.gRefOf(res) }, res);
    const rows = [];
    (s.uls || []).forEach((x) => {
      const dur = GL.DURATION[x.dur] || GL.DURATION['10min'], hrs = dur.h == null ? num(x.hrs) : dur.h;
      const kmod = dur.kmod != null ? dur.kmod : GL.kmodOf(hrs > 0 ? hrs : 1 / 6);
      const f = res.mode === 'adm' ? num(res.fadm) : GL.fgd(resP, temper, kmod).v;
      rows.push({ name: x.name || 'ELU', st: 'uls', load: s.load || 'uni', val: x[key], d: pos.d || '', beff: pos.beff || '', h: r2(Math.min(...hs), 2), f: r2(f, 1), lim: 100, max: '' });
    });
    (s.sls || []).forEach((x) => rows.push({ name: x.name || 'ELS', st: 'sls', load: s.load || 'uni', val: x[key], d: pos.d || '', beff: pos.beff || '', h: r2(hw, 2), f: '', lim: x.lim, max: x.max }));
    return {
      v: 2, kind: 'vitrage', name: s.name || d.name, cas: s.cas || 'c1', a: s.a, b: s.b, E: mat.E != null ? mat.E : 70000, nu: mat.nu != null ? mat.nu : 0.22,
      ro: pos.ro != null ? pos.ro : 50, cyl: !!s.cyl, slsCrit: s.slsCrit || 'libre', igu: !!s.igu, rows: rows.length ? rows : d.rows
    };
  }
  function upgrade(s) {
    if (!Array.isArray(s.rows)) s = fromV1(s);
    const d = defaultState();
    Object.keys(d).forEach((k) => { if (s[k] === undefined) s[k] = d[k]; });
    if (!CASE[s.cas]) s.cas = 'c1';
    if (!s.rows.length) s.rows = d.rows;
    s.v = 2; s.kind = 'vitrage';
    return s;
  }

  const loadsOf = (c) => Object.entries(c.loads).map(([k, l]) => ({ id: k, label: l.label, roark: c.strip ? '' : l.roark }));

  function compute(s) {
    const R = { valid: true, warnings: [], info: [], rows: [] };
    const c = CASE[s.cas] || CASE.c1;
    R.case = c;
    let a = num(s.a), b = num(s.b);
    const E = num(s.E, 70000), nu = num(s.nu, 0.23), ro = num(s.ro, 50);
    const bad = [];
    if (!(a > 0) || !(b > 0)) bad.push('côtés a et b');
    if (!(E > 0)) bad.push('module E');
    if (!(nu >= 0 && nu < 0.5)) bad.push('coefficient de Poisson');
    if (bad.length) { R.valid = false; R.warnings.push('Données invalides : ' + bad.join(', ') + '.'); return R; }
    let swapped = false;
    if (c.swap && a > b) { [a, b] = [b, a]; swapped = true; }
    const ratio = a / b;
    R.geo = { a, b, ratio, swapped, E, nu, ro };
    const FD = s.slsCrit === 'fd' ? RK.fdDefl(c, a, b, !!s.igu) : null;
    R.fdDefl = FD;
    const oorSet = new Set(), nuSet = new Set();

    R.rows = (s.rows || []).map((x, i) => {
      const o = { i, name: String(x.name || '').trim() || 'Cas ' + (i + 1), st: x.st === 'sls' ? 'sls' : 'uls', load: x.load, val: num(x.val), h: num(x.h), f: num(x.f), errs: [] };
      const L = c.loads[x.load];
      o.unit = RK.valUnit(x.load);
      if (!L) o.errs.push('type de charge non disponible pour ces appuis');
      if (!(o.h > 0)) o.errs.push('épaisseur h');
      if (!(o.val >= 0)) o.errs.push('charge (positive attendue)');
      if (o.st === 'uls' && !(o.f > 0)) o.errs.push('résistance f_g;d');
      if (x.load === 'conc' && !(ro > 0)) o.errs.push('rayon de la zone chargée');
      const g = { a, b, E, nu, ro, cyl: !!s.cyl, t: o.h };
      if (c.strip && L) {
        const dIn = String(x.d == null ? '' : x.d).trim();
        g.d = dIn === '' ? (c.bc === 'cant' ? b : b / 2) : num(dIn); o.d = g.d; o.dDefault = dIn === '';
        const bIn = String(x.beff == null ? '' : x.beff).trim();
        g.beff = bIn === '' ? a : num(bIn); o.beff = g.beff;
        if (x.load !== 'uni' && !(g.d >= 0 && g.d <= b)) o.errs.push(`position d (0 à ${b} mm)`);
        if (x.load === 'point' && !(g.beff > 0)) o.errs.push('largeur participante b_eff');
      }
      if (o.st === 'sls' && !FD && !(num(x.lim) > 0)) o.errs.push('flèche limite');
      if (o.errs.length) { o.err = 'Données invalides : ' + o.errs.join(', ') + '.'; return o; }

      const key = RK.valKey(x.load);
      const E1 = c.strip ? RK.evalStrip(c, x.load, g, o.val) : RK.evalPlate(c, L, g, key === 'q' ? o.val : 0, key === 'W' ? o.val : 0);
      o.out = E1.out; o.cs = E1.cs; o.rop = E1.rop; o.beam = E1.beam; o.L = L;
      if (!c.strip) {
        if (Object.values(E1.cs).some((v) => v.clamp)) { o.oor = true; oorSet.add(L.roark); }
        if (L.nu != null && Math.abs(L.nu - nu) > 0.02) nuSet.add(String(L.nu).replace('.', ','));
        E1.out.filter((v) => v.doubt).forEach((v) => R.warnings.push(`${o.name} : ${v.doubt}.`));
      }
      if (o.st === 'uls') {
        const sm = E1.out.filter((v) => v.unit === 'MPa').reduce((m, v) => (!m || Math.abs(v.v) > Math.abs(m.v) ? v : m), null);
        o.gov = sm; o.Ed = sm ? Math.abs(sm.v) : 0; o.Rd = o.f; o.unitR = 'MPa';
        o.crit = `σ ≤ f_g;d`;
      } else {
        const y = E1.out.find((v) => v.unit === 'mm');
        if (!y) { o.na = true; o.err = 'Roark ne donne pas la flèche pour ce cas d’appuis : flèche non vérifiée.'; return o; }
        const lim = FD ? FD.lim : num(x.lim), mx = FD ? FD.max : num(x.max, 0), Lr = FD ? FD.L : b, Ln = FD ? FD.Ln : 'b';
        o.Rd = mx > 0 ? Math.min(Lr / lim, mx) : Lr / lim;
        o.gov = y; o.Ed = Math.abs(y.v); o.unitR = 'mm'; o.lim = lim; o.max = mx;
        o.crit = mx > 0 && mx < Lr / lim ? `flèche ≤ ${String(mx).replace('.', ',')} mm` : `flèche ≤ ${Ln}/${String(lim).replace('.', ',')}`;
        if (o.Ed > 0.5 * o.h && !c.strip) o.big = true;
      }
      o.r = o.Rd > 0 ? o.Ed / o.Rd : Infinity;
      if (c.strip && x.load === 'point' && g.beff >= a - 1e-9) o.beffWarn = true;
      return o;
    });

    // remarques
    if (oorSet.size) R.warnings.push(`Hors domaine : a/b = ${ratio.toFixed(2).replace('.', ',')} sort du tableau de Roark (cas ${[...oorSet].join(', ')}) ; valeurs indicatives, sans conclusion.`);
    if (c.min >= 1 && !c.strip && num(s.a) < num(s.b)) R.warnings.push('Pour ces appuis, a désigne le grand côté : saisir a ≥ b.');
    if (swapped) R.info.push('a > b : côtés permutés pour rester dans le tableau (cas symétrique).');
    if (nuSet.size) R.info.push(`Coefficients de Roark établis pour ν = ${[...nuSet].join(' / ')} (verre : ${String(nu).replace('.', ',')}) : écart attendu de quelques % sur la flèche, jusqu’à 15 % sur les contraintes (§ 11.10).`);
    if (R.rows.some((o) => o.beffWarn)) R.warnings.push('Charge ponctuelle répartie sur toute la largeur a : non sécuritaire si a est grand devant la portée ; préciser une largeur participante b_eff.');
    if (R.rows.some((o) => o.big)) R.info.push('Flèche supérieure à h/2 : la théorie linéaire surestime flèche et contraintes (effet membrane négligé), ce qui va dans le sens de la sécurité.');
    if (c.strip) R.info.push(`Bande de largeur unité, portée b : statique de poutre, ${s.cyl ? 'D′ = E·h³/12(1 − ν²) (flexion cylindrique)' : 'D′ = E·h³/12 (sans effet de Poisson, du côté de la sécurité)'}.`);
    if (R.rows.some((o) => o.load === 'conc' && !o.err)) { const r0 = R.rows.find((o) => o.load === 'conc' && !o.err); R.info.push(`Charge concentrée répartie sur un disque de rayon r_o = ${ro} mm (r′_o = ${r0.rop.toFixed(1).replace('.', ',')} mm pour la première ligne).`); }

    const ok = R.rows.filter((o) => !o.err && Number.isFinite(o.r));
    R.max = ok.filter((o) => !o.oor).reduce((m, o) => Math.max(m, o.r), 0);
    R.gov = ok.filter((o) => !o.oor).reduce((m, o) => (!m || o.r > m.r ? o : m), null);
    R.govU = ok.filter((o) => o.st === 'uls').reduce((m, o) => (!m || o.r > m.r ? o : m), null);
    R.govS = ok.filter((o) => o.st === 'sls').reduce((m, o) => (!m || o.r > m.r ? o : m), null);
    R.nErr = R.rows.filter((o) => o.err && !o.na).length;
    R.status = !ok.length ? 'none' : oorSet.size && !R.gov ? 'oor' : R.max <= 1 ? 'ok' : 'ko';
    return R;
  }

  function summary(st) {
    try {
      const R = compute(st), c = CASE[st.cas];
      return { type: 'Pré-dimensionnement', sec: `${num(st.a)} × ${num(st.b)} mm · ${c ? c.label : ''} · ${(st.rows || []).length} cas`, gov: !R.valid ? 'Données invalides' : R.gov ? `${R.gov.name} — ${R.gov.crit}` : '', max: R.valid && R.gov ? R.max : null };
    } catch (e) { return null; }
  }

  window.LaminaPredim = { defaultState, upgrade, compute, summary, loadsOf, fromV1 };
})();
