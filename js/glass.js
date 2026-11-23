/* ==========================================================================
   Lamina — données et lois du verre.
   · Résistance de calcul en flexion selon NF EN 16612 (reprise du classeur « Glass Strength Spreadsheet ») :
       f_g;d = k_e·k_mod·k_sp·f_g;k / γ_M;A + k_v·(f_b;k − f_g;k) / γ_M;v
       k_mod = 0,663·t^(−1/16), t durée cumulée de la charge en heures, borné à [0,25 ; 1].
   · Épaisseurs effectives du verre feuilleté (classeur « Effective Thickness - prEN16612 ») :
       h_ef;w   = (Σ h_k³ + 12·ω·Σ h_k·h_m,k²)^(1/3)              (flèche)
       h_ef;σ,j = √( h_ef;w³ / (h_j + 2·ω·h_m,j) )               (contrainte dans le pli j)
     h_m,k : distance du plan moyen du pli k à l'axe neutre du feuilleté (centre de gravité des plis de verre).
   Unités : mm, MPa, heures.
   ========================================================================== */
(function () {
  'use strict';
  const num = (v, d = 0) => { const x = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(x) ? x : d; };

  const E = 70000, NU = 0.22, RHO = 25;   // MPa, —, kN/m³ (NF EN 572-1)

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
    { id: 'imprime-arme', label: 'Imprimé armé', ksp: 0.6, fbk: { recuit: 0, durci: 0, trempe: 0, chimique: 0 } }
  ];
  const TEMPER = Object.fromEntries(TEMPERS.map((x) => [x.id, x]));
  const SURFACE = Object.fromEntries(SURFACES.map((x) => [x.id, x]));

  // durées cumulées de charge proposées (heures) ; k_mod déduit de la loi de NF EN 16612
  const DURATIONS = [
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

  /* Résistance de calcul en flexion d'un pli. p : { fgk, gMA, gMv, ke, kv, surface }, temper, kmod. */
  function fgd(p, temper, kmod) {
    const sf = SURFACE[p.surface] || SURFACE.float;
    const fbk = sf.fbk[temper] || 0;
    const ann = num(p.ke, 1) * kmod * sf.ksp * num(p.fgk, 45) / num(p.gMA, 1.8);
    const pre = fbk > 0 ? num(p.kv, 1) * (fbk - num(p.fgk, 45)) / num(p.gMv, 1.2) : 0;
    return { v: ann + pre, ann, pre, fbk, ksp: sf.ksp, available: temper === 'recuit' || fbk > 0 };
  }

  /* Épaisseurs effectives d'un feuilleté. plies : épaisseurs h_k (mm) de bas en haut, hint : intercalaire, w : ω. */
  function effective(plies, hint, w) {
    const h = plies.map((x) => num(x)).filter((x) => x > 0), n = h.length;
    if (!n) return null;
    // positions des plans moyens (z = 0 en face inférieure)
    const z = []; let y = 0;
    h.forEach((hk, k) => { z.push(y + hk / 2); y += hk + (k < n - 1 ? hint : 0); });
    const total = y, glass = h.reduce((s, x) => s + x, 0);
    const z0 = h.reduce((s, hk, k) => s + hk * z[k], 0) / glass;   // axe neutre : centre de gravité du verre
    const zg = total / 2;                                           // milieu géométrique (convention du classeur)
    const hm = z.map((zk) => Math.abs(zk - z0));
    const hw = Math.cbrt(h.reduce((s, hk) => s + hk ** 3, 0) + 12 * w * h.reduce((s, hk, k) => s + hk * hm[k] ** 2, 0));
    const hs = h.map((hk, k) => Math.sqrt(hw ** 3 / (hk + 2 * w * hm[k])));
    return { h, z, z0, zg, hm, hw, hs, total, glass, n };
  }

  window.LaminaGlass = { E, NU, RHO, TEMPERS, TEMPER, SURFACES, SURFACE, DURATIONS, DURATION, kmodOf, fgd, effective, num };
})();
