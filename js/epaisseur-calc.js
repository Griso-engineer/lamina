/* ==========================================================================
   Lamina — épaisseur équivalente (effective) d'un verre feuilleté.
   · NF EN 16612 annexe D (méthode simplifiée, coefficient ω), valeurs de ω par cas de charge selon
     FD P78-468 § 10.6 et tableau 32 (intercalaires courants) ou DTA 6/15-2253_V5 (SentryGlas®),
     reprise du classeur « Effective Thickness - prEN16612-2017 - LG ».
   · EN 19100-2:2026 annexe A (informative), approche améliorée de l'épaisseur effective (EET) :
     paramètre de couplage η à partir du module de cisaillement G de l'intercalaire et du coefficient Ψ
     de charge et de conditions aux limites ; ω équivalent selon (A.1).
   ========================================================================== */
(function () {
  'use strict';
  const GL = window.LaminaGlass, num = GL.num;

  function defaultState() {
    return {
      v: 1, kind: 'epaisseur', name: 'Feuilleté F1',
      plies: [{ h: 8 }, { h: 8 }, { h: 8 }], hints: [1.52, 1.52],
      ref: 'geo', il: 'sg', pos: 'ext', wc: { G: 0, A: 0, W: 0.3, H: 0, E: 0, Ej: 0, S: 0 },
      E: 70000, nu: 0.23,
      eet: { on: true, cas: 'ss4', a: 1500, b: 3000, L: 2000, psi: '', kind: 'plate', gSrc: 'il', load: 'W', G: 50 }
    };
  }
  function upgrade(s) {
    const d = defaultState();
    (function merge(dst, src) {
      Object.keys(src).forEach((k) => {
        if (dst[k] === undefined) dst[k] = src[k];
        else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') merge(dst[k], src[k]);
      });
    })(s, d);
    if (!Array.isArray(s.plies) || !s.plies.length) s.plies = d.plies;
    if (!Array.isArray(s.hints)) s.hints = [];
    while (s.hints.length < s.plies.length - 1) s.hints.push(s.hints[s.hints.length - 1] != null ? s.hints[s.hints.length - 1] : 1.52);
    s.hints.length = Math.max(0, s.plies.length - 1);
    if (!GL.INTERLAYER[s.il]) s.il = 'pvb';
    return s;
  }

  const EET_CASES = [
    { id: 'ss4', label: 'Plaque sur 4 appuis simples, charge uniforme (tableau A.1)', kind: 'plate' },
    { id: 'bss', label: 'Bande ou poutre sur 2 appuis simples, charge uniforme (tableau A.2 : Ψ_b = 168/(17·L²))', kind: 'beam' },
    { id: 'psi', label: 'Ψ saisi (autre cas des tableaux A.1 et A.2)', kind: null }
  ];
  const EET_CASE = Object.fromEntries(EET_CASES.map((x) => [x.id, x]));

  function compute(s) {
    const R = { valid: true, warnings: [], info: [] };
    const plies = (s.plies || []).map((p) => num(p.h));
    const hints = (s.hints || []).map((x) => num(x));
    const E = num(s.E, 70000), nu = num(s.nu, 0.23);
    const bad = [];
    if (!plies.length || plies.some((x) => !(x > 0))) bad.push('épaisseurs des plis');
    if (hints.some((x) => !(x >= 0))) bad.push('épaisseurs d’intercalaire');
    if (!(E > 0)) bad.push('module E');
    if (!(nu >= 0 && nu < 0.5)) bad.push('coefficient de Poisson');
    if (bad.length) { R.valid = false; R.warnings.push('Données invalides : ' + bad.join(', ') + '.'); return R; }
    const g = GL.geometry(plies, hints, s.ref);
    const alt = GL.geometry(plies, hints, s.ref === 'cg' ? 'geo' : 'cg');
    R.g = g; R.n = g.n;
    if (g.n === 1) R.info.push('Un seul pli : verre monolithique, h_ef = h.');

    // ---- NF EN 16612 annexe D avec ω par cas de charge
    const il = GL.INTERLAYER[s.il] || GL.INTERLAYER.pvb, pos = s.pos === 'int' ? 'int' : 'ext';
    R.il = il; R.pos = pos;
    R.rows = GL.LOADS.map((L) => {
      let w = il.id === 'custom' ? (s.wc && s.wc[L.id] !== undefined && String(s.wc[L.id]).trim() !== '' ? num(s.wc[L.id]) : undefined) : GL.pick(il.w[L.id], pos);
      if (w === undefined) return null;
      const e = GL.effective(plies, hints, w, s.ref), ea = GL.effective(plies, hints, w, alt.ref);
      return { L, w, hw: e.hw, hs: e.hs, hsMin: Math.min(...e.hs), alt: { hw: ea.hw, hs: ea.hs } };
    }).filter(Boolean);
    if (R.rows.some((r) => !(r.w >= 0 && r.w <= 1))) { R.valid = false; R.warnings.push('Données invalides : ω doit être compris entre 0 et 1.'); return R; }

    // écart entre les deux conventions de plan de référence (compositions dissymétriques)
    if (!g.sym && g.n > 1) {
      const dev = R.rows.reduce((m, r) => Math.max(m, Math.abs(r.alt.hw / r.hw - 1), ...r.hs.map((x, k) => Math.abs(r.alt.hs[k] / x - 1))), 0);
      R.asym = dev;
      R.info.push(`Composition dissymétrique : le plan de symétrie du feuilleté et le centre de gravité du verre sont distants de ${fmtN(Math.abs(g.zg - g.zc), 2)} mm ; écart maximal entre les deux conventions sur les épaisseurs effectives : ${fmtN(dev * 100, 1)} %.`);
    }

    // ---- EN 19100-2 annexe A (EET)
    const ee = s.eet || {};
    if (ee.on && g.n > 1) {
      const C = EET_CASE[ee.cas] || EET_CASE.ss4;
      let psi = NaN, kind = C.kind || (ee.kind === 'beam' ? 'beam' : 'plate'), psiInfo = '';
      if (C.id === 'ss4') {
        const a = num(ee.a), b = num(ee.b);
        if (a > 0 && b > 0) { const P = GL.psiPlateSS4(a, b); psi = P.psi; psiInfo = `λ = ${fmtN(P.lam, 3)}, Ψ_p·b² = ${fmtN(P.k, 2)}`; if (P.out) R.warnings.push('EET : λ < 0,1, hors du tableau A.1 — Ψ_p extrapolé en 1/λ².'); }
      } else if (C.id === 'bss') {
        const L = num(ee.L);
        if (L > 0) { psi = 168 / (17 * L * L); psiInfo = `L = ${fmtN(L)} mm`; }
      } else psi = num(ee.psi) * 1e-6;
      let G = NaN, gTxt = '';
      if (ee.gSrc !== 'custom' && il.G) { G = GL.pick(il.G[ee.load], pos); gTxt = `${il.label}, ${(GL.LOADS.find((x) => x.id === ee.load) || {}).label || ''} (${il.src})`; }
      else { G = num(ee.G); gTxt = 'saisi'; }
      R.eet = { case: C, kind, psi, psiInfo, G, gTxt };
      if (!(psi > 0)) R.eet.err = 'Ψ non défini (dimensions ou valeur saisie).';
      else if (!(G >= 0)) R.eet.err = 'Module de cisaillement G non défini.';
      else {
        const et = GL.etaEET(g, G, psi, kind, E, nu);
        if (et.err) R.eet.err = et.err;
        else Object.assign(R.eet, et, GL.effectiveEET(g, et.eta));
      }
      if (ee.gSrc !== 'custom' && !il.G) R.info.push(`EET : le référentiel « ${il.label} » ne donne pas de module G ; valeur saisie utilisée.`);
    }

    R.info.push('Méthode simplifiée de NF EN 16612 : vitrages supportés linéairement sous charges uniformément réparties ; elle peut sous-estimer contraintes et flèches pour les petits vitrages et les surestimer pour les grands.');
    return R;
  }
  function fmtN(x, d = 0) { return Number(x).toLocaleString('fr-FR', { maximumFractionDigits: d }); }

  function compLabel(s) {
    const p = (s.plies || []).map((x) => fmtN(num(x.h), 2)), t = (s.hints || []).map((x) => fmtN(num(x), 2));
    return p.map((x, i) => x + (i < t.length ? ' / ' + t[i] : '')).join(' / ') + ' mm';
  }
  function summary(st) {
    try {
      const R = compute(st), il = GL.INTERLAYER[st.il];
      const w = R.valid && R.rows.find((r) => r.L.id === 'W');
      return { type: 'Épaisseur équivalente', sec: `${compLabel(st)} · ${il ? il.label : ''}`, gov: w ? `vent : h_ef;w = ${fmtN(w.hw, 2)} mm, h_ef;σ = ${fmtN(w.hsMin, 2)} mm` : '', max: null };
    } catch (e) { return null; }
  }

  window.LaminaEpaisseur = { defaultState, upgrade, compute, summary, compLabel, EET_CASES, EET_CASE };
})();
