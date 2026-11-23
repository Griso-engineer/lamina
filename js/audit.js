/* ==========================================================================
   Lamina — page « Contre-vérification » : recoupement avec les classeurs d'origine
   (« Glass behaviour under different restraints », « Glass Strength Spreadsheet »,
   « Effective Thickness - prEN16612 ») et anomalies relevées. Les valeurs Lamina sont calculées en direct.
   ========================================================================== */
(function () {
  'use strict';
  const C = window.LaminaRoark, GL = window.LaminaGlass;
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

  // valeurs du classeur pour ses données par défaut : portée a = 3000 mm, largeur b = 1500 mm, t = 16 mm,
  // E = 70 000 MPa, intensité 5 (kPa, kN/m ou kN), d1 = 40 mm (cellules P18:Q28 et D25:D26 de Sheet1)
  const XL = { L: 3000, B: 1500, t: 16, E: 70000, val: 5, d: 40,
    rows: [
      { bc: 'ss', load: 'point', s: 3.0833333333333335, y: 3.2209615846022013 },
      { bc: 'ss', load: 'line', s: 4.625, y: 4.8314423769033024 },
      { bc: 'ss', load: 'uni', s: 131.8359375, y: 220.70748465401786 },
      { bc: 'fs', load: 'point', s: 3.0627777777777778, y: 2.8876966490299825e-3, yAtLoad: true },
      { bc: 'fs', load: 'line', s: 4.5941666666666672, y: 4.3315449735449735e-3, yAtLoad: true },
      { bc: 'fs', load: 'uni', s: 131.8359375, y: 91.623431467181462 },
      { bc: 'cant', load: 'point', s: 3.125, y: 0.33333333333333331 },
      { bc: 'cant', load: 'line', s: 4.6875, y: 0.5 },
      { bc: 'cant', load: 'uni', s: 263.671875, y: 2118.7918526785716 }
    ],
    plate: { a: 3000, b: 1500, s: 26.815429687499996, y: 9.7994123186383941 } };
  const BC = { ss: 'Appuis simples (« Pinned »)', fs: 'Encastré – appuyé (« Propped Cantilever »)', cant: 'Console (« Cantilevering »)' };
  const LD = { point: 'Charge ponctuelle 5 kN', line: 'Charge linéique 5 kN/m', uni: 'Pression 5 kPa' };

  function compare() {
    const Dp = XL.E * XL.t ** 3 / 12;
    const rows = XL.rows.map((r) => {
      const w = r.load === 'uni' ? XL.val / 1000 : 0, P = r.load === 'line' ? XL.val : r.load === 'point' ? XL.val * 1000 / XL.B : 0;
      const B = C.beam(r.bc, XL.L, w, P, r.load === 'uni' ? 0 : XL.d, Dp);
      const s = 6 * Math.max(Math.abs(B.mneg.v), Math.abs(B.mpos.v)) / XL.t ** 2;
      return Object.assign({}, r, { ls: s, ly: Math.abs(B.ymax.v), lyLoad: B.yAt(XL.d), mA: 6 * Math.abs(B.MA) / XL.t ** 2 });
    });
    const pc = C.CASE.c1, pl = C.evalPlate(pc, pc.loads.uni, { a: XL.plate.a, b: XL.plate.b, t: XL.t, E: XL.E, nu: 0.22, ro: 0 }, XL.val, 0);
    const plate = Object.assign({}, XL.plate, { ls: pl.out[0].v, ly: pl.out[1].v });
    return { rows, plate };
  }

  // feuilleté dissymétrique : axe neutre au milieu géométrique (classeur) ou au centre de gravité du verre (Lamina)
  function asym(h1 = 8, h2 = 12, hint = 1.52, w = 0.5) {
    const e = GL.effective([h1, h2], hint, w);
    const z = e.z, zg = e.zg, hmG = z.map((zk) => Math.abs(zk - zg));
    const hwG = Math.cbrt(h1 ** 3 + h2 ** 3 + 12 * w * (h1 * hmG[0] ** 2 + h2 * hmG[1] ** 2));
    return { e, hwG, hsG: [h1, h2].map((h, k) => Math.sqrt(hwG ** 3 / (h + 2 * w * hmG[k]))) };
  }

  function render(app) {
    const A = window.LaminaApp, cmp = compare();
    const ok = (a, b, tol = 2e-3) => Math.abs(a - b) <= tol * Math.max(1e-9, Math.abs(b));
    const tag = (a, b, tol) => (ok(a, b, tol) ? '<span class="pill ok">=</span>' : '<span class="pill ko">≠</span>');
    const rows = cmp.rows.map((r) => `<tr><td>${BC[r.bc]}</td><td>${LD[r.load]}</td><td class="num">${fmt(r.s, 3)}</td><td class="num"><b>${fmt(r.ls, 3)}</b></td><td>${tag(r.ls, r.s)}</td><td class="num">${fmt(r.y, r.y < 0.1 ? 5 : 3)}</td><td class="num"><b>${fmt(r.ly, r.ly < 0.1 ? 5 : 3)}</b></td><td>${tag(r.ly, r.y, r.bc === 'fs' && r.load === 'uni' ? 3e-3 : 2e-3)}</td>
      <td class="f">${r.bc === 'fs' && r.load !== 'uni' ? `classeur : moment d'encastrement (Lamina : ${fmt(r.mA, 3)} MPa, identique) et flèche sous la charge (Lamina : ${fmt(r.lyLoad, 5)} mm, identique) ; la flèche maximale est ailleurs` : r.bc === 'cant' && r.load === 'uni' ? 'classeur : M = q·a·b²/2 au lieu de q·b·a²/2' : r.bc === 'fs' && r.load === 'uni' ? 'classeur : q·L⁴/(185·EI), exact : q·L⁴/(184,6·EI)' : ''}</td></tr>`).join('');
    const p = cmp.plate;
    const as = asym();
    app.innerHTML = `<div class="page">
      ${A.blockHead('—', 'Contre-vérification', 'Reprise des classeurs « Glass behaviour under different restraints » (formules de Roark et de poutre), « Glass Strength Spreadsheet » (résistance prEN 16612) et « Effective Thickness - prEN16612 » (feuilleté). Valeurs Lamina calculées en direct par le moteur de l’application.')}
      <div class="sub-title">Classeur « Glass behaviour… » — données par défaut (portée 3 000 mm, largeur 1 500 mm, t = 16 mm, d<sub>1</sub> = 40 mm)</div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Appuis</th><th>Charge</th><th class="num">σ classeur</th><th class="num">σ Lamina</th><th></th><th class="num">y classeur</th><th class="num">y<sub>max</sub> Lamina</th><th></th><th>Remarque</th></tr></thead><tbody>
        ${rows}
        <tr><td>4 appuis simples (Roark 1a, a/b = 2)</td><td>Pression 5 kPa</td><td class="num">${fmt(p.s, 3)}</td><td class="num"><b>${fmt(p.ls, 3)}</b></td><td>${tag(p.ls, p.s)}</td><td class="num">${fmt(p.y, 3)}</td><td class="num"><b>${fmt(p.ly, 3)}</b></td><td>${tag(p.ly, p.y)}</td><td class="f"></td></tr>
      </tbody></table></div>
      <p class="cap">Contraintes en MPa, flèches en mm. Bandes calculées en poutre (D′ = E·t³/12) comme le classeur, charge ponctuelle répartie sur toute la largeur.</p>

      <div class="sub-title" style="margin-top:28px">Anomalies relevées et traitement dans Lamina</div>
      <ol class="audit">
        <li><b class="sev">Élevée</b><b>Console sous pression uniforme : moment faux.</b> Cellule R28 : M = q·a·b²/2 (portée × largeur²) au lieu de q·b·a²/2. La contrainte est sous-estimée du rapport a/b, soit ×2 avec les données par défaut (264 au lieu de 527 MPa). La flèche (Q28) est juste. <i>Lamina : statique de poutre exacte.</i></li>
        <li><b class="sev">Élevée</b><b>Encastré – appuyé, charge ponctuelle ou linéique : seul le moment d’encastrement est retenu</b> (R22, R23). Quand la charge est à plus de 0,586·L de l’encastrement, le moment en travée sous la charge devient prépondérant : contrainte sous-estimée jusqu’à un facteur ≈ 2 près de l’appui simple. <i>Lamina : |m| maximal sur toute la portée.</i></li>
        <li><b class="sev">Élevée</b><b>Encastré – appuyé, charge ponctuelle ou linéique : flèche sous la charge au lieu de la flèche maximale</b> (Q22, Q23). Avec d<sub>1</sub> = 40 mm le classeur donne ${fmt(cmp.rows[3].y, 4)} mm pour une flèche maximale de ${fmt(cmp.rows[3].ly, 3)} mm. <i>Lamina : flèche maximale et sa position.</i></li>
        <li><b class="sev m">Moyenne</b><b>Flèche limite a/150 sur le grand côté</b> (D11). Pour un vitrage sur 4 côtés la portée déterminante est le petit côté : avec a/b = 2 le critère est deux fois trop lâche. <i>Lamina : b/n (b petit côté ou portée), plafond en mm facultatif, plusieurs cas ELS.</i></li>
        <li><b class="sev m">Moyenne</b><b>Résistance f<sub>d</sub> = 42 MPa / LDF</b> (D9:D10), sans lien avec le traitement du verre ni la durée réelle de la charge ; γ<sub>M0</sub> n’intervient que dans M<sub>p,el,Rd</sub>, non utilisé. <i>Lamina : NF EN 16612 (reprise du « Glass Strength Spreadsheet ») avec k<sub>mod</sub> propre à chaque cas ELU, ou contrainte admissible saisie.</i></li>
        <li><b class="sev m">Moyenne</b><b>Charge ponctuelle sur bande répartie sur toute la largeur b</b> (Q18, R18). Non sécuritaire pour un vitrage large devant sa portée. <i>Lamina : largeur participante b<sub>eff</sub> (par défaut toute la largeur, avec avertissement).</i></li>
        <li><b class="sev l">Faible</b><b>4 côtés appuyés : E = 70 000 MPa codé en dur</b> dans la flèche (D26, nom « output_deflection ») au lieu de la cellule E ; pression uniforme seulement ; pas d’interpolation entre a/b = 5 et ∞ (saut 0,7476 → 0,75). <i>Lamina : E saisi, tous les cas du tableau 11.4 repris de Firmitas, interpolation en b/a vers ∞.</i></li>
        <li><b class="sev l">Faible</b><b>Encastré – appuyé sous pression : flèche q·L⁴/(185·EI)</b> (Q24) ; valeur exacte q·L⁴/(184,6·EI), écart 0,2 %.</li>
        <li><b class="sev l">Faible</b><b>Coefficients de Roark établis pour ν = 0,3</b> (0,2 pour certains cas) alors que ν = 0,22 pour le verre : écart de quelques % signalé dans les résultats.</li>
        <li><b class="sev l">Faible</b><b>« Effective Thickness » : h<sub>m,k</sub> mesurées depuis le milieu géométrique du feuilleté</b> (Sheet2!E17). Exact pour une composition symétrique ; pour une composition dissymétrique l’axe neutre est le centre de gravité du verre (forme à deux plis de NF EN 16612 : h<sub>m,1</sub> = h<sub>s;1,2</sub>·h<sub>2</sub>/(h<sub>1</sub> + h<sub>2</sub>)). Exemple 8 / 1,52 / 12 mm, ω = 0,5 : h<sub>ef;w</sub> = ${fmt(as.hwG, 2)} mm (classeur) contre ${fmt(as.e.hw, 2)} mm ; h<sub>ef;σ,1</sub> = ${fmt(as.hsG[0], 2)} contre ${fmt(as.e.hs[0], 2)} mm. <i>Lamina : centre de gravité du verre.</i></li>
        <li><b class="sev l">Faible</b><b>« Glass Strength Spreadsheet » : facteur de bord k<sub>e</sub> absent.</b> <i>Lamina : k<sub>e</sub> ajouté (1,0 par défaut, partie courante).</i></li>
      </ol>
      <p class="note">Les recoupements chiffrés sont aussi exécutés par <a href="tests.html">tests.html</a>.</p>
    </div>`;
  }

  window.LaminaAudit = { XL, compare, asym };
  window.LaminaPages = Object.assign(window.LaminaPages || {}, { classeur: render });
})();
