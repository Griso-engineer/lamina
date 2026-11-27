/* ==========================================================================
   Lamina — champ de flèche et de contraintes d'une plaque rectangulaire (Kirchhoff) par la méthode de Ritz.
   Sert uniquement à la visualisation de l'onglet Pré-dimensionnement : les vérifications restent celles
   de Roark (tableau 11.4) ou de la statique de poutre.
   · Déplacement : w(x, y) = Σ c_ij·f_i(ξ)·g_j(η), ξ = 2x/a − 1, η = 2y/b − 1 ;
     f_i(ξ) = (1 + ξ)^pG·(1 − ξ)^pD·P_i(ξ) (P_i : polynômes de Legendre), p = 0 bord libre, 1 appui simple,
     2 encastrement : les conditions cinématiques sont satisfaites, les conditions naturelles le sont par
     minimisation de l'énergie potentielle (bords libres).
   · Énergie : U = D/2·∬[w,xx² + w,yy² + 2ν·w,xx·w,yy + 2(1 − ν)·w,xy²] ; D = E·h³/12(1 − ν²).
   · Moments : M_x = −D(w,xx + ν·w,yy), M_y = −D(w,yy + ν·w,xx), M_xy = −D(1 − ν)·w,xy ; σ = 6·M/h² (face opposée à la charge).
   ========================================================================== */
(function () {
  'use strict';
  const PW = { fr: 0, ss: 1, fx: 2 };

  function gauss(n) {
    const x = [], w = [];
    for (let i = 1; i <= n; i++) {
      let z = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), pp = 1;
      for (let it = 0; it < 100; it++) {
        let p1 = 1, p2 = 0;
        for (let j = 1; j <= n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; }
        pp = n * (z * p1 - p2) / (z * z - 1);
        const z1 = z; z = z1 - p1 / pp;
        if (Math.abs(z - z1) < 1e-15) break;
      }
      x.push(z); w.push(2 / ((1 - z * z) * pp * pp));
    }
    return { x, w };
  }
  const pmul = (a, b) => { const r = new Array(a.length + b.length - 1).fill(0); a.forEach((ai, i) => b.forEach((bj, j) => { r[i + j] += ai * bj; })); return r; };
  const pder = (a) => (a.length > 1 ? a.slice(1).map((c, i) => c * (i + 1)) : [0]);
  const pval = (a, x) => { let s = 0; for (let i = a.length - 1; i >= 0; i--) s = s * x + a[i]; return s; };
  const ppow = (base, n) => { let r = [1]; for (let i = 0; i < n; i++) r = pmul(r, base); return r; };
  function legendre(N) {
    const P = [[1], [0, 1]];
    for (let n = 1; n < N; n++) {
      const r = pmul([0, 1], P[n]).map((c) => c * (2 * n + 1) / (n + 1));
      P[n - 1].forEach((c, i) => { r[i] -= c * n / (n + 1); });
      P.push(r);
    }
    return P.slice(0, N);
  }
  function basis(kL, kR, N) {
    const env = pmul(ppow([1, 1], PW[kL]), ppow([1, -1], PW[kR]));
    return legendre(N).map((P) => { const f = pmul(env, P), d1 = pder(f), d2 = pder(d1); return { f, d1, d2 }; });
  }
  // matrices 1D : ∫ φ_i^(p)·φ_k^(q) dξ
  function mats(B, G) {
    const N = B.length, M = (p, q) => { const m = []; for (let i = 0; i < N; i++) { m.push([]); for (let k = 0; k < N; k++) { let s = 0; G.x.forEach((x, g) => { s += G.w[g] * pval(B[i][p], x) * pval(B[k][q], x); }); m[i].push(s); } } return m; };
    return { m00: M('f', 'f'), m11: M('d1', 'd1'), m22: M('d2', 'd2'), m20: M('d2', 'f'), m02: M('f', 'd2') };
  }
  function cholSolve(K, F) {
    const n = F.length, L = K.map((r) => r.slice());
    for (let j = 0; j < n; j++) {
      let s = L[j][j];
      for (let k = 0; k < j; k++) s -= L[j][k] * L[j][k];
      if (!(s > 0)) return null;
      L[j][j] = Math.sqrt(s);
      for (let i = j + 1; i < n; i++) { let t = L[i][j]; for (let k = 0; k < j; k++) t -= L[i][k] * L[j][k]; L[i][j] = t / L[j][j]; }
    }
    const y = new Array(n);
    for (let i = 0; i < n; i++) { let t = F[i]; for (let k = 0; k < i; k++) t -= L[i][k] * y[k]; y[i] = t / L[i][i]; }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) { let t = y[i]; for (let k = i + 1; k < n; k++) t -= L[k][i] * x[k]; x[i] = t / L[i][i]; }
    return x;
  }

  /* o : { a, b, E, nu, h, edges {bottom, top, left, right}, load: 'uni'|'linx'|'liny'|'triy'|'point', q [N/mm²], W [N], x0, y0, N }
     x le long de a (bord « bottom » en y = 0), y le long de b. */
  function solve(o) {
    const N = o.N || 10, a = o.a, b = o.b, nu = o.nu, D = o.E * o.h ** 3 / (12 * (1 - nu * nu));
    const G = gauss(Math.max(16, N + 8));
    const Bx = basis(o.edges.left, o.edges.right, N), By = basis(o.edges.bottom, o.edges.top, N);
    const X = mats(Bx, G), Y = mats(By, G);
    const sx = 2 / a, sy = 2 / b, J = a * b / 4;
    const n = N * N, K = [], F = new Array(n).fill(0);
    for (let p = 0; p < n; p++) K.push(new Array(n).fill(0));
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) for (let l = 0; l < N; l++) {
      K[i * N + j][k * N + l] = D * J * (sx ** 4 * X.m22[i][k] * Y.m00[j][l] + sy ** 4 * X.m00[i][k] * Y.m22[j][l]
        + nu * sx * sx * sy * sy * (X.m20[i][k] * Y.m02[j][l] + X.m02[i][k] * Y.m20[j][l]) + 2 * (1 - nu) * sx * sx * sy * sy * X.m11[i][k] * Y.m11[j][l]);
    }
    // charge
    if (o.load === 'point') {
      const xi = 2 * o.x0 / a - 1, et = 2 * o.y0 / b - 1;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) F[i * N + j] = o.W * pval(Bx[i].f, xi) * pval(By[j].f, et);
    } else {
      const fx = (xi) => (o.load === 'linx' ? (1 + xi) / 2 : 1), fy = (et) => (o.load === 'liny' ? (1 + et) / 2 : o.load === 'triy' ? (1 - et) / 2 : 1);
      const Ix = Bx.map((B) => G.x.reduce((s, x, g) => s + G.w[g] * fx(x) * pval(B.f, x), 0));
      const Iy = By.map((B) => G.x.reduce((s, x, g) => s + G.w[g] * fy(x) * pval(B.f, x), 0));
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) F[i * N + j] = o.q * J * Ix[i] * Iy[j];
    }
    const c = cholSolve(K, F);
    if (!c) return null;
    // évaluation
    const ev = (B, t) => B.map((x) => [pval(x.f, t), pval(x.d1, t), pval(x.d2, t)]);
    function at(x, y) {
      const fx = ev(Bx, 2 * x / a - 1), gy = ev(By, 2 * y / b - 1);
      let w = 0, wxx = 0, wyy = 0, wxy = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const cc = c[i * N + j];
        w += cc * fx[i][0] * gy[j][0]; wxx += cc * fx[i][2] * gy[j][0]; wyy += cc * fx[i][0] * gy[j][2]; wxy += cc * fx[i][1] * gy[j][1];
      }
      wxx *= sx * sx; wyy *= sy * sy; wxy *= sx * sy;
      const Mx = -D * (wxx + nu * wyy), My = -D * (wyy + nu * wxx), Mxy = -D * (1 - nu) * wxy, k = 6 / (o.h * o.h);
      const s_x = k * Mx, s_y = k * My, t = k * Mxy, m = (s_x + s_y) / 2, r = Math.hypot((s_x - s_y) / 2, t);
      return { w, sx: s_x, sy: s_y, txy: t, s1: m + r, s2: m - r, smax: Math.max(Math.abs(m + r), Math.abs(m - r)) };
    }
    // évaluation sur une grille (fonctions de base calculées une fois par colonne et par ligne)
    function field(xs, ys) {
      const FX = xs.map((x) => ev(Bx, 2 * x / a - 1)), GY = ys.map((y) => ev(By, 2 * y / b - 1)), k = 6 / (o.h * o.h);
      return ys.map((y, iy) => xs.map((x, ix) => {
        const fx = FX[ix], gy = GY[iy];
        let w = 0, wxx = 0, wyy = 0, wxy = 0;
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
          const cc = c[i * N + j];
          w += cc * fx[i][0] * gy[j][0]; wxx += cc * fx[i][2] * gy[j][0]; wyy += cc * fx[i][0] * gy[j][2]; wxy += cc * fx[i][1] * gy[j][1];
        }
        wxx *= sx * sx; wyy *= sy * sy; wxy *= sx * sy;
        const s_x = -k * D * (wxx + nu * wyy), s_y = -k * D * (wyy + nu * wxx), t = -k * D * (1 - nu) * wxy, m = (s_x + s_y) / 2, r = Math.hypot((s_x - s_y) / 2, t);
        return { x, y, w, sx: s_x, sy: s_y, txy: t, smax: Math.max(Math.abs(m + r), Math.abs(m - r)) };
      }));
    }
    /* grille de nx × ny cellules (valeurs au centre des cellules) et extrema sur une grille deux fois plus fine, bords compris */
    function grid(nx, ny) {
      const lin = (n, L, off) => Array.from({ length: n }, (_, i) => (i + off) / (off ? n : n - 1) * L);
      const cells = field(lin(nx, a, 0.5), lin(ny, b, 0.5));
      const fine = field(lin(2 * nx + 1, a, 0), lin(2 * ny + 1, b, 0));
      let wMax = { v: 0 }, sMax = { v: 0 };
      fine.forEach((row) => row.forEach((p) => { if (Math.abs(p.w) > Math.abs(wMax.v)) wMax = { v: p.w, x: p.x, y: p.y }; if (p.smax > sMax.v) sMax = { v: p.smax, x: p.x, y: p.y, p }; }));
      return { cells, wMax, sMax };
    }
    // valeurs aux sommets d'un maillage de nx × ny quadrilatères (vue 3D)
    const nodes = (nx, ny) => field(Array.from({ length: nx + 1 }, (_, i) => i / nx * a), Array.from({ length: ny + 1 }, (_, j) => j / ny * b));
    return { at, grid, nodes, D, N };
  }

  window.LaminaRitz = { solve, gauss, legendre };
})();
