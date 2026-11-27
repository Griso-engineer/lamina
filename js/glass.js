/* ==========================================================================
   Lamina — données et lois du verre.
   · Résistance de calcul en flexion selon NF EN 16612 (reprise du classeur « Glass Strength Spreadsheet ») :
       f_g;d = k_e·k_mod·k_sp·f_g;k / γ_M;A + k_v·(f_b;k − f_g;k) / γ_M;v
       k_mod = 0,663·t^(−1/16), t durée cumulée de la charge en heures, borné à [0,25 ; 1].
   · Épaisseurs effectives du verre feuilleté (classeur « Effective Thickness - prEN16612 ») :
       h_ef;w   = (Σ h_k³ + 12·ω·Σ h_k·h_m,k²)^(1/3)              (flèche)
       h_ef;σ,j = √( h_ef;w³ / (h_j + 2·ω·h_m,j) )               (contrainte dans le pli j)
     h_m,k : distance du plan moyen du pli k au plan de symétrie du feuilleté (ou, en option, au centre de gravité du verre).
   Unités : mm, MPa, heures.
   ========================================================================== */
(function () {
  'use strict';
  const num = (v, d = 0) => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : d; };

  const E = 70000, NU = 0.23, RHO = 25;   // MPa, —, kN/m³ (FD P78-468 § 6)

  // coefficients partiels de matériau : valeurs recommandées de NF EN 16612 ou valeurs françaises de FD P78-468
  // (tableau 1 : γ_M;A = 1,5 ; γ_M;v = 1,5, hypothèse du tableau 31)
  const GAMMAS = { fd: { gMA: 1.5, gMv: 1.5, label: 'FD P78-468 (France) — γ_M;A = 1,5 ; γ_M;v = 1,5' }, en: { gMA: 1.8, gMv: 1.2, label: 'NF EN 16612 — γ_M;A = 1,8 ; γ_M;v = 1,2' } };

  // traitement thermique (ou chimique) : f_b;k par type de surface (0 = non disponible), classeur « Lists »
  const TEMPERS = [
    { id: 'recuit', label: 'Recuit (float)', short: 'recuit' },
    { id: 'durci', label: 'Durci thermiquement', short: 'durci' },
    { id: 'trempe', label: 'Trempé thermiquement', short: 'trempé' },
    { id: 'chimique', label: 'Trempé chimiquement', short: 'trempé chim.' }
  ];
  const SURFACES = [
    { id: 'float', label: 'Float', ksp: 1, fbk: { recuit: 0, durci: 70, trempe: 120, chimique: 150 } },
    { id: 'etire', label: 'Étiré', ksp: 1, fbk: { recuit: 0, durci: 70, trempe: 120, chimique: 150 } },
    { id: 'emaille', label: 'Float ou étiré émaillé', ksp: 1, fbk: { recuit: 0, durci: 45, trempe: 75, chimique: 0 } },
    { id: 'imprime', label: 'Imprimé', ksp: 0.75, fbk: { recuit: 0, durci: 55, trempe: 90, chimique: 100 } },
    { id: 'imprime-em', label: 'Imprimé émaillé', ksp: 0.75, fbk: { recuit: 0, durci: 45, trempe: 75, chimique: 0 } },
    { id: 'arme-poli', label: 'Armé poli', ksp: 0.75, fbk: { recuit: 0, durci: 0, trempe: 0, chimique: 0 } },
    { id: 'imprime-arme', label: 'Imprimé armé', ksp: 0.6, fbk: { recuit: 0, durci: 0, trempe: 0, chimique: 0 } },
    { id: 'sable', label: 'Float recuit sablé ou gravé (FD P78-468 § 9.1.2.3)', ksp: 0.6, fbk: { recuit: 0, durci: 0, trempe: 0, chimique: 0 } }
  ];
  const TEMPER = Object.fromEntries(TEMPERS.map((x) => [x.id, x]));
  const SURFACE = Object.fromEntries(SURFACES.map((x) => [x.id, x]));

  // durées de charge : FD P78-468 tableau 25 (k_mod fixé), puis durées cumulées libres (k_mod par la loi de NF EN 16612)
  const DURATIONS = [
    { id: 'fdW', label: 'Vent — 3 s (FD P78-468)', h: 3 / 3600, kmod: 1, fd: true },
    { id: 'fdS', label: 'Neige — 1 mois (FD P78-468)', h: 30 * 24, kmod: 0.44, fd: true },
    { id: 'fdSa', label: 'Neige accidentelle — 7 jours (FD P78-468)', h: 7 * 24, kmod: 0.48, fd: true },
    { id: 'fdG', label: 'Poids propre ou altitude ΔH — 50 ans (FD P78-468)', h: 50 * 365 * 24, kmod: 0.29, fd: true },
    { id: 'fdE', label: 'Été F_ΔH + F_ΔT — 6 h (FD P78-468)', h: 6, kmod: 0.59, fd: true },
    { id: 'fdH', label: 'Hiver F_ΔH + F_ΔT — 12 h (FD P78-468)', h: 12, kmod: 0.57, fd: true },
    { id: '50a', label: '50 ans — charges permanentes', h: 50 * 365 * 24 },
    { id: '6m', label: '6 mois', h: 6 * 30 * 24 },
    { id: '3m', label: '3 mois', h: 3 * 30 * 24 },
    { id: '3s', label: '3 semaines', h: 21 * 24 },
    { id: '1j', label: '1 jour', h: 24 },
    { id: '1h', label: '1 heure', h: 1 },
    { id: '10min', label: '10 minutes — vent (rafales cumulées)', h: 10 / 60 },
    { id: '30s', label: '30 secondes', h: 30 / 3600 },
    { id: 'autre', label: 'Autre durée…', h: null }
  ];
  const DURATION = Object.fromEntries(DURATIONS.map((x) => [x.id, x]));
  const kmodOf = (hours) => Math.min(1, Math.max(0.25, 0.663 * Math.pow(hours, -1 / 16)));

  /* Résistance de calcul en flexion d'un pli. p : { fgk, gMA, gMv, ke, kv, surface, gRef }, temper, kmod.
     NF EN 16612 : f_g;d = k_e·k_mod·k_sp·f_g;k/γ_M;A + k_v·(f_b;k − f_g;k)/γ_M;v.
     FD P78-468 : k_e ne s'applique qu'au verre recuit (équations 11 et 12 ; tableau 31). */
  function fgd(p, temper, kmod) {
    const sf = SURFACE[p.surface] || SURFACE.float;
    const fbk = sf.fbk[temper] || 0;
    const ke = p.gRef === 'fd' && temper !== 'recuit' ? 1 : num(p.ke, 1);
    const ann = ke * kmod * sf.ksp * num(p.fgk, 45) / num(p.gMA, 1.8);
    const pre = fbk > 0 ? num(p.kv, 1) * (fbk - num(p.fgk, 45)) / num(p.gMv, 1.2) : 0;
    return { v: ann + pre, ann, pre, fbk, ksp: sf.ksp, available: temper === 'recuit' || fbk > 0 };
  }

  /* Géométrie d'un feuilleté. plies : épaisseurs h_k (mm) de bas en haut ; hint : épaisseur d'intercalaire
     (nombre, ou tableau des n − 1 intercalaires) ; ref : plan de référence des distances h_m,k (ou d_i) :
       'geo' — plan de symétrie du feuilleté complet, intercalaires compris (texte de NF EN 16612 annexe D,
               EN 19100-2 figure A.1, DTA SentryGlas et classeur « Effective Thickness ») ;
       'cg'  — centre de gravité des plis de verre (axe neutre en couplage total ; identique pour une composition symétrique). */
  function geometry(plies, hint, ref = 'geo') {
    const h = plies.map((x) => num(x)).filter((x) => x > 0), n = h.length;
    if (!n) return null;
    const hi = (k) => (Array.isArray(hint) ? num(hint[k]) : num(hint));
    const z = []; let y = 0;
    h.forEach((hk, k) => { z.push(y + hk / 2); y += hk + (k < n - 1 ? hi(k) : 0); });
    const total = y, glass = h.reduce((s, x) => s + x, 0);
    const zc = h.reduce((s, hk, k) => s + hk * z[k], 0) / glass;    // centre de gravité du verre
    const zg = total / 2;                                            // plan de symétrie du feuilleté
    const z0 = ref === 'cg' ? zc : zg;
    const d = z.map((zk) => zk - z0);                                // distances signées
    const hints = h.slice(0, -1).map((_, k) => hi(k));
    return { h, n, z, zc, zg, z0, d, hm: d.map(Math.abs), total, glass, hints, ref, sym: Math.abs(zc - zg) < 1e-9 };
  }
  const sum = (a) => a.reduce((s, x) => s + x, 0);

  /* NF EN 16612 annexe D (méthode simplifiée avec ω) :
       h_ef;w = (Σ h_k³ + 12·ω·Σ h_k·h_m,k²)^(1/3) ; h_ef;σ,j = √(h_ef;w³ / (h_j + 2·ω·h_m,j)) */
  function effective(plies, hint, w, ref = 'geo') {
    const g = geometry(plies, hint, ref);
    if (!g) return null;
    const I3 = sum(g.h.map((x) => x ** 3)), S2 = sum(g.h.map((x, k) => x * g.hm[k] ** 2));
    const hw = Math.cbrt(I3 + 12 * w * S2);
    const hs = g.h.map((hk, k) => Math.sqrt(hw ** 3 / (hk + 2 * w * g.hm[k])));
    return Object.assign(g, { w, hw, hs, I3, S2 });
  }

  /* EN 19100-2 annexe A (approche améliorée de l'épaisseur effective, EET) : paramètre de couplage η.
     kind 'plate' : formules (A.4) 2 plis, (A.7) 3 plis ; kind 'beam' : (A.8) n plis égaux, (A.9) 3 plis.
     Ψ en mm⁻², G en MPa. Retourne { eta } ou { err }. */
  function etaEET(g, G, Psi, kind, E = 70000, nu = 0.23) {
    if (!(G > 0)) return { eta: 0, note: 'G = 0 : aucun couplage' };
    const h = g.h, n = g.n, d = g.d, I3 = sum(h.map((x) => x ** 3)), S2 = sum(h.map((x, k) => x * d[k] ** 2));
    const c = kind === 'plate' ? 1 - nu * nu : 1;
    if (n === 1) return { eta: 1, note: 'monolithique' };
    if (n === 2) {
      const hint = g.hints[0];
      if (!(hint > 0)) return { eta: 1, note: 'intercalaire nul' };
      // (A.4) — plaque ; poutre : même forme sans (1 − ν²), identique à (A.8) pour 2 plis égaux
      const k = hint * E / (G * c) * (I3 / (I3 + 12 * S2)) * (h[0] * h[1] / (h[0] + h[1])) * Psi;
      return { eta: 1 / (1 + k), formula: kind === 'plate' ? '(A.4)' : '(A.8)' };
    }
    if (n === 3) {
      const [t1, t2] = g.hints;
      if (!(t1 > 0 && t2 > 0)) return { err: 'intercalaires nuls' };
      const k = E * I3 * S2 * Psi / (c * G * (I3 + 12 * S2) * ((d[0] - d[1]) ** 2 / t1 + (d[1] - d[2]) ** 2 / t2));
      return { eta: 1 / (1 + k), formula: kind === 'plate' ? '(A.7)' : '(A.9)' };
    }
    if (kind === 'beam' && h.every((x) => Math.abs(x - h[0]) < 1e-9) && g.hints.every((x) => Math.abs(x - g.hints[0]) < 1e-9)) {
      const hh = h[0], ti = g.hints[0];
      const k = ti * E / (12 * G) * (n * hh ** 3 * (n + 1) / (hh ** 2 + (hh + ti) ** 2 * (n * n - 1))) * Psi;
      return { eta: 1 / (1 + k), formula: '(A.8)' };
    }
    return { err: kind === 'plate' ? 'EN 19100-2 ne donne η pour les plaques qu’à 2 ou 3 plis' : 'EN 19100-2 ne donne η pour les poutres qu’à 3 plis ou n plis identiques' };
  }
  /* Épaisseurs effectives EET (A.2), (A.3) et ω équivalent EN 16612 (A.1). */
  function effectiveEET(g, eta) {
    const h = g.h, d = g.d, I3 = sum(h.map((x) => x ** 3)), S2 = sum(h.map((x, k) => x * d[k] ** 2)), If = I3 + 12 * S2;
    const hw = Math.pow(eta / If + (1 - eta) / I3, -1 / 3);
    const hs = h.map((hk, k) => 1 / Math.sqrt(2 * eta * Math.abs(d[k]) / If + hk / hw ** 3));
    const w = S2 > 0 ? (hw ** 3 - I3) / (12 * S2) : 0;
    return { hw, hs, w, I3, If };
  }

  /* Ψ_p, plaque rectangulaire sur 4 appuis simples, charge uniforme (EN 19100-2 tableau A.1, 1er bloc) :
     Ψ_p·b² ne dépend que de λ = a/b (a ≤ b) — valeurs de la ligne b = 1000 mm, ×10⁻⁶ mm⁻² × 10⁶ mm². */
  const PSI_SS4 = { lam: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], k: [1004.5, 260.698, 121.582, 72.6055, 49.9366, 37.653, 30.2676, 25.4866, 22.2163, 19.882] };
  function psiPlateSS4(a, b) {
    const lo = Math.min(a, b), hi = Math.max(a, b), lam = lo / hi, L = PSI_SS4.lam, K = PSI_SS4.k;
    let k;
    if (lam <= L[0]) k = K[0] * (L[0] / lam) ** 2;   // au-delà du tableau : Ψ·b² ∝ 1/λ² (bande)
    else { let i = 0; while (i < L.length - 2 && lam > L[i + 1]) i++; k = K[i] + (K[i + 1] - K[i]) * (lam - L[i]) / (L[i + 1] - L[i]); }
    return { psi: k / (hi * hi), lam, k, out: lam < L[0] };
  }

  /* ω par cas de charge — FD P78-468 tableau 32 (intercalaires courants) et DTA 6/15-2253_V5 (SentryGlas).
     pos : 'ext' (vitrage simple ou composant extérieur d'un VI) / 'int' (composant intérieur d'un VI). */
  const LOADS = [
    { id: 'G', label: 'Poids propre', dur: 'Permanent — 50 ans' },
    { id: 'A', label: 'Altitude (F_ΔH)', dur: 'Permanent — 50 ans' },
    { id: 'W', label: 'Vent en pression ou dépression', dur: '3 s' },
    { id: 'H', label: 'Pression isochore hiver', dur: '12 h' },
    { id: 'E', label: 'Pression isochore été — contraintes', dur: '6 h' },
    { id: 'Ej', label: 'Pression isochore été — effort dans le joint de scellement', dur: '6 h' },
    { id: 'E50', label: 'Été, composant > 50 °C — contraintes', dur: '6 h' },
    { id: 'E50j', label: 'Été, composant > 50 °C — effort dans le joint', dur: '6 h' },
    { id: 'S', label: 'Neige', dur: '1 mois' }
  ];
  const INTERLAYERS = [
    { id: 'pvb', label: 'PVB ou EVA courant', src: 'FD P78-468 tableau 32',
      w: { G: 0, A: 0, W: 0.3, H: { ext: 0.2, int: 0 }, E: 0, Ej: 0, S: { ext: 0.2, int: 0 } } },
    { id: 'pvba', label: 'PVB acoustique', src: 'FD P78-468 tableau 32',
      w: { G: 0, A: 0, W: 0.3, H: 0, E: 0, Ej: 0, S: { ext: 0.2, int: 0 } } },
    { id: 'gel', label: 'Gel intumescent', src: 'FD P78-468 tableau 32',
      w: { G: 0, A: 0, W: 0, H: 0, E: 0, Ej: 0, S: 0 } },
    { id: 'sg', label: 'SentryGlas®', src: 'DTA 6/15-2253_V5 § 2.3.2.2', dta: true,
      w: { G: 0, A: 0, W: 0.7, H: 0.5, E: 0.1, Ej: 0.9, E50: 0, E50j: 0.6, S: { ext: 0.5, int: 0.4 } },
      G: { G: 0, A: 0, W: 50, H: 20, E: 2.3, Ej: 60, E50: 0.05, E50j: 5, S: { ext: 30, int: 12 } } },
    { id: 'sgx', label: 'SentryGlas® Xtra™', src: 'DTA 6/15-2253_V5 § 2.3.2.2', dta: true,
      w: { G: 0, A: 0, W: 0.7, H: 0.4, E: 0.1, Ej: 0.85, E50: 0, E50j: 0.5, S: { ext: 0.5, int: 0.4 } },
      G: { G: 0, A: 0, W: 33, H: 20, E: 2.3, Ej: 30, E50: 0.05, E50j: 3.3, S: { ext: 30, int: 12 } } },
    { id: 'none', label: 'Non évalué selon EN 16613 (ω = 0)', src: 'FD P78-468 § 10.6.2',
      w: { G: 0, A: 0, W: 0, H: 0, E: 0, Ej: 0, S: 0 } },
    { id: 'custom', label: 'ω saisis', src: 'saisie', w: {} }
  ];
  const INTERLAYER = Object.fromEntries(INTERLAYERS.map((x) => [x.id, x]));
  const pick = (v, pos) => (v && typeof v === 'object' ? v[pos || 'ext'] : v);
  /* Cas de charge d'un intercalaire, dédoublés quand ω (ou G) dépend de la position dans un vitrage isolant. */
  const POS = { ext: 'vitrage simple ou composant extérieur d’un VI', int: 'composant intérieur d’un VI' };
  function loadVariants(il, tab = 'w') {
    const src = il[tab] || {}, out = [];
    LOADS.forEach((L) => {
      const v = src[L.id];
      if (v === undefined) return;
      if (v && typeof v === 'object') Object.keys(POS).forEach((p) => out.push({ key: L.id + '_' + p, id: L.id, pos: p, L, label: `${L.label} — ${POS[p]}`, dur: L.dur }));
      else out.push({ key: L.id, id: L.id, pos: null, L, label: L.label, dur: L.dur });
    });
    return out;
  }
  const splitKey = (key) => { const [id, pos] = String(key || '').split('_'); return { id, pos: pos || 'ext' }; };

  window.LaminaGlass = { E, NU, RHO, GAMMAS, TEMPERS, TEMPER, SURFACES, SURFACE, DURATIONS, DURATION, kmodOf, fgd, geometry, effective, etaEET, effectiveEET, psiPlateSS4, PSI_SS4, LOADS, INTERLAYERS, INTERLAYER, pick, loadVariants, splitKey, num };
})();
