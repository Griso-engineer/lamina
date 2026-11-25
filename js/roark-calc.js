/* ==========================================================================
   Lamina — prédimensionnement rapide des vitrages d'après W. C. Young & R. G. Budynas,
   Roark's Formulas for Stress and Strain, chapitre 11 (tableau 11.4 et § 11.11), et la statique des poutres.

   · Plaques appuyées sur 2, 3 ou 4 côtés (reprise de l'onglet Plaques de Firmitas) :
       σ = β·q·b²/t², y = α·q·b⁴/(E·t³), R = γ·q·b ; coefficients interpolés linéairement en a/b.
   · Bandes sur deux côtés opposés et consoles (reprise et correction du classeur
     « Glass behaviour under different restraints ») : poutre de largeur unité, portée b,
     appuis simple / encastré / libre ; pression, charge linéique ou charge ponctuelle en position quelconque.
       m(x) = M_A + R_A·x − w·x²/2 − P·⟨x − d⟩ ; σ = 6·m/t² ; D′·y″ = −m, D′ = E·t³/12
       (ou E·t³/12(1 − ν²) en flexion cylindrique), intégration exacte (Simpson sur m quadratique par morceaux).
   Bibliothèque de formules utilisée par l'onglet Pré-dimensionnement (js/predim-calc.js) et la page de contre-vérification.
   Unités internes : N, mm, MPa ; pressions saisies en kPa, charges linéiques en kN/m, charges ponctuelles en kN.
   ========================================================================== */
(function () {
  'use strict';
  const GL = window.LaminaGlass;
  const num = GL.num;
  const INF = Infinity;
  const E4 = (bottom, top, left, right) => ({ bottom, top, left, right });

  /* ---------------------------------------------------------------- plaques (tableau 11.4) */
  const CASES = [
    // ------------------------------------------------ 4 côtés
    { id: 'c1', group: '4 côtés', label: '4 appuis simples', roark: '1', edges: E4('ss', 'ss', 'ss', 'ss'), ab: 'a ≥ b, a : grand côté', min: 1,
      loads: {
        uni: { label: 'Pression uniforme', roark: '1a', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, 3, 4, 5, INF],
          c: { b: [.2874, .3762, .4530, .5172, .5688, .6102, .7134, .7410, .7476, .7500], a: [.0444, .0616, .0770, .0906, .1017, .1110, .1335, .1400, .1417, .1421], g: [.420, .455, .478, .491, .499, .503, .505, .502, .501, .500] },
          out: [{ label: 'Contrainte σ_b au centre', kind: 's', coef: 'b', pos: [0, 0.5] }, { label: 'Flèche au centre', kind: 'y', coef: 'a', pos: [0, 0.5] },
            { label: 'Réaction au milieu des grands côtés', kind: 'R', coef: 'g', pos: [0, 0] }] },
        conc: { label: 'Charge concentrée au centre', roark: '1b', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF],
          c: { b: [.435, .650, .789, .875, .927, .958, 1.000], a: [.1267, .1478, .1621, .1715, .1770, .1805, .1851] },
          out: [{ label: 'Contrainte au centre', kind: 'sW', coef: 'b', pos: [0, 0.5] }, { label: 'Flèche au centre', kind: 'yW', coef: 'a', pos: [0, 0.5] }] },
        lin: { label: 'Pression croissant le long du grand côté', roark: '1d', nu: 0.3, r: [1, 1.5, 2, 2.5, 3, 3.5, 4],
          c: { b: [.16, .26, .34, .38, .43, .47, .49], a: [.022, .043, .060, .070, .078, .086, .091] },
          out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] },
        lin2: { label: 'Pression croissant le long du petit côté', roark: '1e', nu: 0.3, r: [1, 1.5, 2, 2.5, 3, 3.5, 4],
          c: { b: [.16, .26, .32, .35, .37, .38, .38], a: [.022, .042, .056, .063, .067, .069, .070] },
          out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] } } },
    { id: 'c3', group: '4 côtés', label: '3 appuis simples + 1 petit côté encastré', roark: '3', edges: E4('ss', 'ss', 'ss', 'fx'), ab: 'a ≥ b, b : côté encastré', min: 1,
      loads: { uni: { label: 'Pression uniforme', roark: '3a', nu: 0.3, r: [1, 1.5, 2, 2.5, 3, 3.5, 4],
        c: { b: [.50, .67, .73, .74, .75, .75, .75], a: [.030, .071, .101, .122, .132, .137, .139] },
        out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] } } },
    { id: 'c4', group: '4 côtés', label: '3 appuis simples + 1 grand côté encastré', roark: '4', edges: E4('fx', 'ss', 'ss', 'ss'), ab: 'a ≥ b, a : côté encastré', min: 1,
      loads: { uni: { label: 'Pression uniforme', roark: '4a', nu: 0.3, r: [1, 1.5, 2, 2.5, 3, 3.5, 4],
        c: { b: [.50, .66, .73, .74, .74, .75, .75], a: [.030, .046, .054, .056, .057, .058, .058] },
        out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] } } },
    { id: 'c5', group: '4 côtés', label: 'Grands côtés appuyés, petits côtés encastrés', roark: '5', edges: E4('ss', 'ss', 'fx', 'fx'), ab: 'a ≥ b, a : grands côtés', min: 1,
      loads: { uni: { label: 'Pression uniforme', roark: '5a', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF], infNote: 'α pour a/b → ∞ : limite de la bande simplement appuyée (valeur absente du tableau de Roark)',
        c: { b: [.4182, .5208, .5988, .6540, .6912, .7146, .750], a: [.0210, .0349, .0502, .0658, .0800, .0922, .1421] },
        out: [{ label: 'Contrainte au milieu des petits côtés', kind: 's', coef: 'b', sign: -1, pos: [-0.5, 0.5] }, { label: 'Flèche au centre', kind: 'y', coef: 'a', pos: [0, 0.5] }] } } },
    { id: 'c6', group: '4 côtés', label: 'Grands côtés encastrés, petits côtés appuyés', roark: '6', edges: E4('fx', 'fx', 'ss', 'ss'), ab: 'a ≥ b, a : grands côtés', min: 1,
      loads: { uni: { label: 'Pression uniforme', roark: '6a', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF],
        c: { b: [.4182, .4626, .4860, .4968, .4971, .4973, .500], a: [.0210, .0243, .0262, .0273, .0280, .0283, .0285] },
        out: [{ label: 'Contrainte au milieu des grands côtés', kind: 's', coef: 'b', sign: -1, pos: [0, 0] }, { label: 'Flèche au centre', kind: 'y', coef: 'a', pos: [0, 0.5] }] } } },
    { id: 'c9', group: '4 côtés', label: '3 côtés encastrés + 1 côté appuyé', roark: '9', edges: E4('fx', 'ss', 'fx', 'fx'), ab: 'a : côté appuyé (z = b) ; b : côtés encastrés latéraux', min: 0.25,
      loads: {
        uni: { label: 'Pression uniforme', roark: '9a', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b1: [.020, .081, .173, .307, .539, .657, .718], b2: [.004, .018, .062, .134, .284, .370, .422], b3: [.016, .061, .118, .158, .164, .135, .097], b4: [.031, .121, .242, .343, .417, .398, .318],
            g1: [.115, .230, .343, .453, .584, .622, .625], g2: [.123, .181, .253, .319, .387, .397, .386], g3: [.125, .256, .382, .471, .547, .549, .530] },
          out: [{ label: 'σ_b au milieu du côté encastré opposé (z = 0)', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'σ_b en travée (x = 0, z = 0,6 b)', kind: 's', coef: 'b2', pos: [0, 0.6] },
            { label: 'σ_a en travée (x = 0, z = 0,6 b)', kind: 's', coef: 'b3', pos: [0, 0.6] }, { label: 'σ_a sur les côtés encastrés latéraux (z = 0,6 b)', kind: 's', coef: 'b4', sign: -1, pos: [-0.5, 0.6] },
            { label: 'Réaction au milieu du côté encastré (z = 0)', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction au milieu du côté appuyé (z = b)', kind: 'R', coef: 'g2', pos: [0, 1] },
            { label: 'Réaction sur les côtés latéraux (z = 0,6 b)', kind: 'R', coef: 'g3', pos: [0.5, 0.6] }] },
        tri: { label: 'Pression décroissante de l\'encastrement (z = 0) à l\'appui', roark: '9d', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b1: [.018, .064, .120, .192, .303, .356, .382], b2: [.019, .068, .124, .161, .181, .168, .132], g1: [.106, .195, .265, .323, .383, .399, .400], g2: [.075, .152, .212, .245, .262, .258, .250] },
          out: [{ label: 'σ_b au milieu du côté encastré (z = 0)', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'σ_a sur les côtés latéraux (z = 0,4 b)', kind: 's', coef: 'b2', sign: -1, pos: [-0.5, 0.4] },
            { label: 'Réaction au milieu du côté encastré (z = 0)', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction sur les côtés latéraux (z = 0,4 b)', kind: 'R', coef: 'g2', pos: [0.5, 0.4] }] } } },
    { id: 'c8', group: '4 côtés', label: '4 côtés encastrés', roark: '8', edges: E4('fx', 'fx', 'fx', 'fx'), ab: 'a ≥ b, a : grand côté', min: 1,
      loads: {
        uni: { label: 'Pression uniforme', roark: '8a', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF],
          c: { b1: [.3078, .3834, .4356, .4680, .4872, .4974, .5000], b2: [.1386, .1794, .2094, .2286, .2406, .2472, .2500], a: [.0138, .0188, .0226, .0251, .0267, .0277, .0284] },
          out: [{ label: 'Contrainte au milieu des grands côtés', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'Contrainte au centre', kind: 's', coef: 'b2', pos: [0, 0.5] },
            { label: 'Flèche au centre', kind: 'y', coef: 'a', pos: [0, 0.5] }] },
        conc: { label: 'Charge concentrée au centre', roark: '8b', nu: 0.3, r: [1, 1.2, 1.4, 1.6, 1.8, 2, INF],
          c: { b1: [-.238, -.078, .011, .053, .068, .067, .067], b2: [.7542, .8940, .9624, .9906, 1.0000, 1.004, 1.008], a: [.0611, .0706, .0754, .0777, .0786, .0788, .0791] },
          out: [{ label: 'Contrainte au centre', kind: 'sW', coef: 'b1', pos: [0, 0.5] }, { label: 'Contrainte au milieu des grands côtés', kind: 'sWe', coef: 'b2', sign: -1, pos: [0, 0] },
            { label: 'Flèche au centre', kind: 'yW', coef: 'a', pos: [0, 0.5] }] } } },
    // ------------------------------------------------ 3 côtés
    { id: 'c2', group: '3 côtés', label: '3 appuis simples + 1 bord libre', roark: '2', edges: E4('ss', 'ss', 'ss', 'fr'), ab: 'b : bord libre ; a : côtés appuyés perpendiculaires', min: 0.5,
      loads: {
        uni: { label: 'Pression uniforme', roark: '2a', nu: 0.3, r: [.5, .667, 1, 1.5, 2, 4],
          c: { b: [.36, .45, .67, .77, .79, .80], a: [.080, .106, .140, .160, .165, .167] },
          out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] },
        lin: { label: 'Pression croissant le long du côté a', roark: '2d', nu: 0.3, r: [.5, .667, 1, 1.5, 2, 2.5, 3, 3.5, 4],
          c: { b: [.11, .16, .20, .28, .32, .35, .36, .37, .37], a: [.026, .033, .040, .050, .058, .064, .067, .069, .070] },
          out: [{ label: 'Contrainte maximale', kind: 's', coef: 'b' }, { label: 'Flèche maximale', kind: 'y', coef: 'a' }] } } },
    { id: 'c7', group: '3 côtés', label: '1 côté encastré, le côté opposé libre, 2 appuis simples', roark: '7', edges: E4('fx', 'fr', 'ss', 'ss'), ab: 'a : côté encastré (z = 0) ; b : distance au bord libre', min: 0.25,
      loads: {
        uni: { label: 'Pression uniforme', roark: '7a', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b1: [.044, .176, .380, .665, 1.282, 1.804, 2.450], b2: [.048, .190, .386, .565, .730, .688, .434], g1: [.183, .368, .541, .701, .919, 1.018, 1.055], g2: [.131, .295, .526, .832, 1.491, 1.979, 2.401] },
          out: [{ label: 'Contrainte au milieu du côté encastré', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'Contrainte au milieu du bord libre', kind: 's', coef: 'b2', pos: [0, 1] },
            { label: 'Réaction au milieu du côté encastré', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction aux extrémités du bord libre', kind: 'R', coef: 'g2', pos: [0.5, 1] }] },
        tri: { label: 'Pression décroissante de l\'encastrement au bord libre', roark: '7d', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b: [.037, .120, .212, .321, .523, .677, .866], g: [.159, .275, .354, .413, .482, .509, .517] },
          out: [{ label: 'Contrainte au milieu du côté encastré', kind: 's', coef: 'b', sign: -1, pos: [0, 0] }, { label: 'Réaction au milieu du côté encastré', kind: 'R', coef: 'g', pos: [0, 0] }] } } },
    { id: 'c10', group: '3 côtés', label: '3 côtés encastrés + 1 bord libre', roark: '10', edges: E4('fx', 'fr', 'fx', 'fx'), ab: 'a : bord libre (z = b) ; b : côtés encastrés latéraux', min: 0.25,
      loads: {
        uni: { label: 'Pression uniforme', roark: '10a', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3],
          c: { b1: [.020, .081, .173, .321, .727, 1.226, 2.105], b2: [.016, .066, .148, .259, .484, .605, .519], b3: [.031, .126, .286, .511, 1.073, 1.568, 1.982], g1: [.114, .230, .341, .457, .673, .845, 1.012], g2: [.125, .248, .371, .510, .859, 1.212, 1.627] },
          out: [{ label: 'σ_b au milieu du côté encastré opposé au bord libre', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'σ_a au milieu du bord libre', kind: 's', coef: 'b2', pos: [0, 1] },
            { label: 'σ_a aux extrémités du bord libre', kind: 's', coef: 'b3', sign: -1, pos: [-0.5, 1] }, { label: 'Réaction au milieu du côté encastré (z = 0)', kind: 'R', coef: 'g1', pos: [0, 0] },
            { label: 'Réaction aux extrémités du bord libre', kind: 'R', coef: 'g2', pos: [0.5, 1] }] },
        tri: { label: 'Pression décroissante de l\'encastrement au bord libre', roark: '10d', nu: 0.2, r: [.25, .5, .75, 1, 1.5, 2, 3], doubt: { coef: 'g2', lo: 1, hi: 2, text: 'γ_2 interpolé avec la valeur 0,106 publiée par Roark à a/b = 1,5 (vraisemblablement une coquille : 0,242 à 1 et 0,199 à 2) : réaction sur les côtés latéraux non exploitable entre a/b = 1 et 2' },
          c: { b1: [.018, .064, .120, .195, .351, .507, .758], b2: [.019, .068, .125, .166, .244, .387, .514], g1: [.106, .195, .265, .324, .406, .458, .505], g2: [.075, .151, .211, .242, .106, .199, .313] },
          out: [{ label: 'σ_b au milieu du côté encastré (z = 0)', kind: 's', coef: 'b1', sign: -1, pos: [0, 0] }, { label: 'σ_a sur les côtés latéraux', lab: (r) => `σ_a sur les côtés latéraux (z = ${r > 1 ? 'b' : '0,4 b'})`, kind: 's', coef: 'b2', sign: -1, pos: [-0.5, 1], at: (r) => [-0.5, r > 1 ? 1 : 0.4] },
            { label: 'Réaction au milieu du côté encastré (z = 0)', kind: 'R', coef: 'g1', pos: [0, 0] }, { label: 'Réaction sur les côtés latéraux', lab: (r) => `Réaction sur les côtés latéraux (z = ${r > 1 ? 'b' : '0,4 b'})`, kind: 'R', coef: 'g2', pos: [0.5, 1], at: (r) => [0.5, r > 1 ? 1 : 0.4] }] } } },
    // ------------------------------------------------ 2 côtés adjacents
    { id: 'c11', group: '2 côtés', label: '2 côtés adjacents encastrés, 2 bords libres', roark: '11', edges: E4('fx', 'fr', 'fx', 'fr'), ab: 'a : côté encastré bas (z = 0) ; b : côté encastré gauche (x = 0)', min: 0.125, swap: true,
      loads: { uni: { label: 'Pression uniforme', roark: '11a', nu: 0.2, r: [.125, .25, .375, .5, .75, 1],
        c: { b1: [.050, .182, .353, .631, 1.246, 1.769], b2: [.047, .188, .398, .632, 1.186, 1.769], g1: [.312, .572, .671, .874, 1.129, 1.183], g2: [.127, .264, .413, .557, .829, 1.183] },
        out: [{ label: 'σ_b à l\'extrémité libre du côté encastré bas (x = a, z = 0)', kind: 's', coef: 'b1', sign: -1, pos: [0.5, 0] }, { label: 'σ_a sur le côté encastré gauche', lab: (r) => `σ_a sur le côté encastré gauche (z = ${r > 0.5 ? 'b, extrémité libre' : '0,8 b'})`, kind: 's', coef: 'b2', sign: -1, pos: [-0.5, 1], at: (r) => [-0.5, r > 0.5 ? 1 : 0.8] },
          { label: 'Réaction au même point (côté bas)', kind: 'R', coef: 'g1', pos: [0.5, 0] }, { label: 'Réaction au même point (côté gauche)', kind: 'R', coef: 'g2', pos: [-0.5, 1], at: (r) => [-0.5, r > 0.5 ? 1 : 0.8] }] } } },
    // ------------------------------------------------ bandes et consoles (statique de poutre, largeur unité)
    ...[
      { id: 's-ss', bc: 'ss', label: '2 côtés opposés en appui simple', xl: 'Two side support-Pinned', edges: E4('ss', 'ss', 'fr', 'fr') },
      { id: 's-fs', bc: 'fs', label: '1 côté encastré, le côté opposé en appui simple', xl: 'Two side support-Propped Cantilever', edges: E4('fx', 'ss', 'fr', 'fr') },
      { id: 's-ff', bc: 'ff', label: '2 côtés opposés encastrés', xl: null, edges: E4('fx', 'fx', 'fr', 'fr') },
      { id: 's-cant', bc: 'cant', label: 'Console : 1 côté encastré, 3 bords libres', xl: 'Cantilevering', edges: E4('fx', 'fr', 'fr', 'fr') }
    ].map((x) => Object.assign(x, {
      group: 'Bandes', strip: true, roark: 'poutre', min: 0,
      ab: x.bc === 'cant' ? 'b : porte-à-faux depuis l\'encastrement (z = 0) ; a : largeur du vitrage' : 'b : portée entre les côtés tenus (z = 0 et z = b) ; a : largeur du vitrage (bords libres)',
      loads: {
        uni: { label: 'Pression uniforme', roark: 'poutre' },
        line: { label: 'Charge linéique parallèle aux appuis', roark: 'poutre' },
        point: { label: 'Charge ponctuelle', roark: 'poutre' }
      }
    }))
  ];
  const CASE = Object.fromEntries(CASES.map((c) => [c.id, c]));
  const GROUPS = [['4 côtés', 'Appuyé sur 4 côtés'], ['3 côtés', 'Appuyé sur 3 côtés'], ['2 côtés', 'Appuyé sur 2 côtés adjacents'], ['Bandes', 'Bandes et consoles — tenu sur 1 ou 2 côtés opposés']];

  // grandes flèches (§ 11.11, ν = 0,316) : Q = q·b⁴/(E·t⁴) → y/t et σ·b²/(E·t²) (contrainte totale)
  const LD_Q = [0, 12.5, 25, 50, 75, 100, 125, 150, 175, 200, 250];
  const LARGE = {
    ss: [
      { r: 1, y: [0, .430, .650, .930, 1.13, 1.26, 1.37, 1.47, 1.56, 1.63, 1.77], s: [0, 3.80, 5.80, 8.70, 10.90, 12.80, 14.30, 15.60, 17.00, 18.20, 20.50], where: 'au centre' },
      { r: 1.5, y: [0, .625, .879, 1.18, 1.37, 1.53, 1.68, 1.77, 1.88, 1.96, 2.12], s: [0, 4.48, 6.81, 9.92, 12.25, 14.22, 16.0, 17.50, 18.90, 20.30, 22.80], where: 'au centre' },
      { r: 2, y: [0, .696, .946, 1.24, 1.44, 1.60, 1.72, 1.84, 1.94, 2.03, 2.20], s: [0, 4.87, 7.16, 10.30, 12.60, 14.60, 16.40, 18.00, 19.40, 20.90, 23.60], where: 'au centre', label: '2 à ∞' }],
    fx: [
      { r: 1, y: [0, .165, .32, .59, .80, .95, 1.08, 1.19, 1.28, 1.38, 1.54], s: [0, 3.80, 6.90, 14.70, 21.0, 26.50, 31.50, 36.20, 40.70, 45.00, 53.50], where: 'au milieu des grands côtés' },
      { r: 1.5, y: [0, .28, .51, .825, 1.07, 1.24, 1.40, 1.50, 1.63, 1.72, 1.86], s: [0, 5.75, 11.12, 20.30, 27.8, 35.0, 41.0, 47.0, 52.50, 57.60, 67.00], where: 'au milieu des grands côtés', label: '1,5 à ∞' }]
  };

  // interpolation linéaire en a/b ; entre la dernière valeur finie et ∞ : linéaire en b/a
  function coef(r, vals, x) {
    const n = r.length;
    if (x <= r[0]) return { v: vals[0], clamp: x < r[0] - 1e-9 };
    for (let i = 0; i < n - 1; i++) {
      const r0 = r[i], r1 = r[i + 1];
      if (x <= r1) {
        if (r1 === INF) return { v: vals[i] + (vals[i + 1] - vals[i]) * (1 - r0 / x) };
        return { v: vals[i] + (vals[i + 1] - vals[i]) * (x - r0) / (r1 - r0) };
      }
    }
    return { v: vals[n - 1], clamp: r[n - 1] !== INF };
  }
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

  /* Grandes flèches : relation charge–flèche α·Q = w + k·w³ (w = y/t), tangente à l'origine à la théorie
     linéaire (α du tableau 11.4), k ajusté sur le tableau du § 11.11 ; contrainte s(w) = (β/α)·w + c·w². */
  function largeDefl(tab, al, be, Q) {
    const k = median(tab.y.map((w, i) => (i ? (al * LD_Q[i] - w) / w ** 3 : null)).filter((v) => v != null && v > 0));
    const target = al * Q;
    let w = target;
    for (let it = 0; it < 50; it++) w -= (w + k * w ** 3 - target) / (1 + 3 * k * w * w);
    w = Math.max(0, w);
    const sl = be / al, c = median(tab.y.map((ww, i) => (i ? (tab.s[i] - sl * ww) / (ww * ww) : null)).filter((v) => v != null));
    return { w, s: sl * w + c * w * w, k };
  }

  /* Plaque : valeurs d'une charge (q en kPa ou W en kN) pour une épaisseur t. */
  function evalPlate(c, L, g, qkPa, WkN) {
    const { a, b, t, E, nu } = g, q = qkPa / 1000, W = WkN * 1000;
    const rop = g.ro < 0.5 * t ? Math.sqrt(1.6 * g.ro * g.ro + t * t) - 0.675 * t : g.ro;   // rayon équivalent (tableau 11.4)
    const cs = {};
    Object.entries(L.c).forEach(([k, vals]) => (cs[k] = coef(L.r, vals, a / b)));
    const out = L.out.map((o) => {
      const k = cs[o.coef].v, sg = o.sign || 1;
      let v, unit, formula;
      if (o.kind === 's') { v = sg * k * q * b * b / (t * t); unit = 'MPa'; formula = `${sg < 0 ? '−' : ''}${o.coef.replace('b', 'β_').replace('g', 'γ_').replace(/_$/, '')}·q·b²/t²`; }
      else if (o.kind === 'y') { v = k * q * b ** 4 / (E * t ** 3); unit = 'mm'; formula = 'α·q·b⁴/(E·t³)'; }
      else if (o.kind === 'R') { v = k * q * b; unit = 'kN/m'; formula = `${o.coef.replace('g', 'γ_').replace(/_$/, '')}·q·b`; }
      else if (o.kind === 'sW') { v = 3 * W / (2 * Math.PI * t * t) * ((1 + nu) * Math.log(2 * b / (Math.PI * rop)) + k); unit = 'MPa'; formula = '3W/(2π·t²)·[(1+ν)·ln(2b/(π·r′_o)) + β]'; }
      else if (o.kind === 'sWe') { v = sg * k * W / (t * t); unit = 'MPa'; formula = '−β_2·W/t²'; }
      else if (o.kind === 'yW') { v = k * W * b * b / (E * t ** 3); unit = 'mm'; formula = 'α·W·b²/(E·t³)'; }
      const r = a / b, extra = {};
      if (o.at) extra.pos = o.at(r);
      if (o.lab) extra.label = o.lab(r);
      if (L.doubt && L.doubt.coef === o.coef && r > L.doubt.lo && r < L.doubt.hi) extra.doubt = L.doubt.text;
      return Object.assign({}, o, extra, { k, v, unit, formula });
    });
    return { cs, out, rop };
  }

  /* ---------------------------------------------------------------- poutre de largeur unité
     bc : ss (appui simple aux deux extrémités), fs (A encastré, B appui simple), ff (deux encastrements),
     cant (A encastré, B libre). w : charge répartie [N/mm par mm de largeur] ; P : charge [N par mm de largeur] à d de A.
     m(x) positif quand la face inférieure (opposée à la charge) est tendue ; y positif dans le sens de la charge. */
  function beam(bc, L, w, P, d, Dp, n = 1200) {
    const bb = L - d;
    let MA = 0, MB = 0;
    if (bc === 'fs') MA = -w * L * L / 8 - P * d * bb * (L + bb) / (2 * L * L);
    else if (bc === 'ff') { MA = -w * L * L / 12 - P * d * bb * bb / (L * L); MB = -w * L * L / 12 - P * d * d * bb / (L * L); }
    else if (bc === 'cant') MA = -w * L * L / 2 - P * d;
    const RA = (w * L * L / 2 + P * bb - MA + MB) / L;
    const RB = bc === 'cant' ? 0 : w * L + P - RA;
    const m = (x) => MA + RA * x - w * x * x / 2 - (x > d ? P * (x - d) : 0);
    // maillage incluant la position de la charge (m quadratique par morceaux : intégration de Simpson exacte)
    const xs = [];
    for (let i = 0; i <= n; i++) xs.push(L * i / n);
    if (P && d > 0 && d < L && !xs.some((x) => Math.abs(x - d) < 1e-9)) { xs.push(d); xs.sort((p, q) => p - q); }
    const th = [0], ys = [0];
    for (let i = 0; i < xs.length - 1; i++) {
      // m est continu ; sa pente saute en d, qui est un nœud : m est quadratique sur chaque segment
      const x0 = xs[i], x1 = xs[i + 1], h = x1 - x0, xm = (x0 + x1) / 2;
      const I1 = h / 6 * (m(x0) + 4 * m(xm) + m(x1));
      const Ih = h / 12 * (m(x0) + 4 * m((x0 + xm) / 2) + m(xm));
      const tm = th[i] - Ih / Dp, t1 = th[i] - I1 / Dp;
      th.push(t1); ys.push(ys[i] + h / 6 * (th[i] + 4 * tm + t1));
    }
    // appui simple en A : rotation initiale telle que y(L) = 0
    if (bc === 'ss') { const C = -ys[ys.length - 1] / L; for (let i = 0; i < xs.length; i++) { ys[i] += C * xs[i]; th[i] += C; } }
    const ms = xs.map(m);
    let iy = 0, ip = 0, ineg = 0;
    ys.forEach((y, i) => { if (Math.abs(y) > Math.abs(ys[iy])) iy = i; });
    ms.forEach((v, i) => { if (v > ms[ip]) ip = i; if (v < ms[ineg]) ineg = i; });
    const yAt = (x) => { for (let i = 0; i < xs.length - 1; i++) if (x <= xs[i + 1]) return ys[i] + (ys[i + 1] - ys[i]) * (x - xs[i]) / (xs[i + 1] - xs[i]); return ys[ys.length - 1]; };
    return { MA, MB, RA, RB, m, xs, ms, ys, yAt, ymax: { v: ys[iy], x: xs[iy] }, mpos: { v: ms[ip], x: xs[ip] }, mneg: { v: ms[ineg], x: xs[ineg] } };
  }

  /* Bande ou console : sorties pour une épaisseur t et une intensité (kPa, kN/m ou kN selon le type de charge). */
  function evalStrip(c, load, g, val) {
    const { b, t, E, nu } = g, L = b;
    const Dp = E * t ** 3 / (12 * (g.cyl ? 1 - nu * nu : 1));
    const w = load === 'uni' ? val / 1000 : 0;                                      // kPa → N/mm²
    const P = load === 'line' ? val : load === 'point' ? val * 1000 / g.beff : 0;   // kN/m = N/mm ; kN → N par mm de largeur
    const d = load === 'uni' ? 0 : g.d;
    const B = beam(c.bc, L, w, P, d, Dp);
    const sig = (mm) => 6 * mm / (t * t);
    const kNm = (mm) => (mm / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
    const zl = (x) => (x / L).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    const out = [];
    if (c.bc !== 'ss') out.push({ label: 'Contrainte sur l\'encastrement (z = 0)', kind: 's', v: sig(B.MA), unit: 'MPa', formula: `6·m/t², m = ${kNm(B.MA)} kN·m/m`, pos: [0, 0], m: B.MA });
    if (c.bc === 'ff') out.push({ label: 'Contrainte sur l\'encastrement (z = b)', kind: 's', v: sig(B.MB), unit: 'MPa', formula: `6·m/t², m = ${kNm(B.MB)} kN·m/m`, pos: [0, 1], m: B.MB });
    if (B.mpos.v > 1e-9 * Math.max(1, Math.abs(B.mneg.v))) out.push({ label: `Contrainte maximale en travée (z = ${zl(B.mpos.x)} b)`, kind: 's', v: sig(B.mpos.v), unit: 'MPa', formula: `6·m/t², m = ${kNm(B.mpos.v)} kN·m/m`, pos: [0, B.mpos.x / L], m: B.mpos.v });
    out.push({ label: c.bc === 'cant' && Math.abs(B.ymax.x - L) < 1e-6 ? 'Flèche à l\'extrémité libre' : `Flèche maximale (z = ${zl(B.ymax.x)} b)`, kind: 'y', v: B.ymax.v, unit: 'mm', formula: `∬ m/D′, D′ = E·t³/12${g.cyl ? '(1 − ν²)' : ''}`, pos: [0, B.ymax.x / L] });
    out.push({ label: c.bc === 'cant' ? 'Réaction sur l\'encastrement' : 'Réaction sur le côté z = 0', kind: 'R', v: B.RA, unit: 'kN/m', formula: 'statique', pos: [0, 0] });
    if (c.bc !== 'cant') out.push({ label: 'Réaction sur le côté z = b', kind: 'R', v: B.RB, unit: 'kN/m', formula: 'statique', pos: [0, 1] });
    return { out, beam: B, Dp };
  }

  /* ---------------------------------------------------------------- outils communs */
  function gRefOf(res) {
    const a = num(res.gMA, 1.8), v = num(res.gMv, 1.2);
    return Object.keys(GL.GAMMAS).find((k) => Math.abs(GL.GAMMAS[k].gMA - a) < 1e-9 && Math.abs(GL.GAMMAS[k].gMv - v) < 1e-9) || 'custom';
  }
  /* Flèche admissible FD P78-468 § 10.5 : 4 côtés — plus petite dimension/60 ≤ 30 mm ;
     2 ou 3 côtés — b/100 (simple vitrage) ou b/150 (vitrage isolant) ≤ 50 mm. */
  function fdDefl(c, a, b, igu) {
    if (c.group === '4 côtés') return { lim: 60, max: 30, L: Math.min(a, b), Ln: 'min(a, b)', ref: 'FD P78-468 § 10.5.1' };
    return { lim: igu ? 150 : 100, max: 50, L: b, Ln: 'b', ref: 'FD P78-468 § 10.5.2' };
  }
  // clé de l'intensité de charge selon le type : q (kPa), W (kN) ou p (kN/m)
  const valKey = (load) => (load === 'conc' || load === 'point' ? 'W' : load === 'line' ? 'p' : 'q');
  const valUnit = (load) => ({ q: 'kPa', W: 'kN', p: 'kN/m' }[valKey(load)]);

  window.LaminaRoark = { CASES, CASE, GROUPS, LARGE, LD_Q, coef, largeDefl, evalPlate, evalStrip, beam, gRefOf, fdDefl, valKey, valUnit, num };
})();
