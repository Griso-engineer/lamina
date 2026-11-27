/* ==========================================================================
   Lamina — résistance de calcul en flexion du verre f_g;d pour toutes les durées de charge.
     f_g;d = k_e·k_mod·k_sp·f_g;k/γ_M;A + k_v·(f_b;k − f_g;k)/γ_M;v       (NF EN 16612 ; FD P78-468 éq. 11 et 12)
   Coefficients γ : NF EN 16612 (1,8 / 1,2), FD P78-468 (1,5 / 1,5) ou saisis. FD P78-468 : k_e pour le verre recuit seul.
   k_mod : tableau 25 de FD P78-468, ou 0,663·t^(−1/16) pour une durée cumulée t [h] (borné à 0,25 … 1).
   ========================================================================== */
(function () {
  'use strict';
  const GL = window.LaminaGlass, num = GL.num;

  function defaultState() {
    return { v: 1, kind: 'resistance', name: 'Verre float', gRef: 'fd', gMA: 1.5, gMv: 1.5, surface: 'float', fgk: 45, ke: 1, kv: 1, hrs: '' };
  }
  function upgrade(s) {
    const d = defaultState();
    Object.keys(d).forEach((k) => { if (s[k] === undefined) s[k] = d[k]; });
    if (!GL.SURFACE[s.surface]) s.surface = 'float';
    return s;
  }
  function gRefOf(s) {
    const a = num(s.gMA, 1.8), v = num(s.gMv, 1.2);
    return Object.keys(GL.GAMMAS).find((k) => Math.abs(GL.GAMMAS[k].gMA - a) < 1e-9 && Math.abs(GL.GAMMAS[k].gMv - v) < 1e-9) || 'custom';
  }

  function compute(s) {
    const R = { valid: true, warnings: [], info: [] };
    const p = { surface: s.surface, fgk: num(s.fgk, 45), gMA: num(s.gMA), gMv: num(s.gMv), ke: num(s.ke, 1), kv: num(s.kv, 1), gRef: s.gRef };
    const bad = [];
    if (!(p.fgk > 0)) bad.push('f_g;k');
    if (!(p.gMA > 0) || !(p.gMv > 0)) bad.push('coefficients γ');
    if (!(p.ke > 0 && p.ke <= 1)) bad.push('k_e');
    if (!(p.kv > 0 && p.kv <= 1)) bad.push('k_v');
    if (bad.length) { R.valid = false; R.warnings.push('Données invalides : ' + bad.join(', ') + '.'); return R; }
    const sf = GL.SURFACE[s.surface] || GL.SURFACE.float;
    const durs = GL.DURATIONS.filter((d) => d.h != null).slice();
    const hrs = num(s.hrs);
    if (hrs > 0) durs.push({ id: 'saisie', label: `Durée saisie — ${String(hrs).replace('.', ',')} h`, h: hrs });
    R.rows = durs.map((d) => {
      const kmod = d.kmod != null ? d.kmod : GL.kmodOf(d.h);
      const vals = {};
      GL.TEMPERS.forEach((t) => { const f = GL.fgd(p, t.id, kmod); vals[t.id] = f.available ? f : null; });
      return { dur: d, kmod, vals, fd: !!d.fd, ec10: !!d.ec10 };
    });
    R.sf = sf; R.p = p;
    if (s.gRef === 'fd' && p.ke !== 1) R.info.push('FD P78-468 : k_e ne s’applique qu’au verre recuit (équations 11 et 12) ; il est sans effet sur les verres précontraints.');
    const na = GL.TEMPERS.filter((t) => t.id !== 'recuit' && !(sf.fbk[t.id] > 0)).map((t) => t.label.toLowerCase());
    if (na.length) R.info.push(`Surface « ${sf.label} » : pas de f_b;k pour ${na.join(', ')} (non disponible).`);
    return R;
  }
  const fmtN = (x, d = 1) => Number(x).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  function summary(st) {
    try {
      const R = compute(st), w = R.valid && R.rows.find((r) => r.dur.id === 'fdW');
      const ref = st.gRef === 'fd' ? 'FD P78-468' : st.gRef === 'en' ? 'NF EN 16612' : 'γ saisis';
      return { type: 'Résistance', sec: `${(GL.SURFACE[st.surface] || GL.SURFACE.float).label} · ${ref}`, gov: w ? `vent 3 s : recuit ${w.vals.recuit ? fmtN(w.vals.recuit.v) : '—'} · trempé ${w.vals.trempe ? fmtN(w.vals.trempe.v) : '—'} MPa` : '', max: null };
    } catch (e) { return null; }
  }

  window.LaminaResistance = { defaultState, upgrade, compute, summary, gRefOf };
})();
