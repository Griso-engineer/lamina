/* ==========================================================================
   Lamina — vue 3D orientable d'un champ sur le vitrage (canvas 2D, sans dépendance).
   Surface déformée (flèche amplifiée) maillée en quadrilatères, colorée selon la valeur du champ,
   éclairée, triée par profondeur (algorithme du peintre). Glisser : rotation ; molette : zoom ;
   double-clic : vue initiale. Repère : x le long de a, y le long de b, z vers l'observateur (sens opposé à la charge).
   ========================================================================== */
(function () {
  'use strict';
  const view = { az: -32, el: 38, zoom: 1 };          // orientation conservée d'un affichage à l'autre
  const DEF = { az: -32, el: 38, zoom: 1 };
  const LIGHT = (() => { const l = [-0.45, -0.6, 0.66], n = Math.hypot(...l); return l.map((v) => v / n); })();
  const rgb = (s) => s.match(/\d+/g).map(Number);

  /* o : { a, b, nodes: [[{w, v}]] (ny+1 lignes × nx+1 colonnes, y croissant), vmax, cmap(t) → 'rgb()',
           edges {bottom, top, left, right}, exag, label, maxPt {x, y}, unit } */
  function mount(canvas, o) {
    const ctx = canvas.getContext('2d'), ny = o.nodes.length - 1, nx = o.nodes[0].length - 1;
    const L = Math.max(o.a, o.b), wmax = Math.max(1e-12, ...o.nodes.flat().map((p) => Math.abs(p.w)));
    const s = o.exag || 0.14 * L / wmax;
    // sommets dans le monde (centrés)
    const P = o.nodes.map((row, j) => row.map((p, i) => [i / nx * o.a - o.a / 2, j / ny * o.b - o.b / 2, p.w * s]));
    const col = o.nodes.map((row) => row.map((p) => rgb(o.cmap(o.vmax > 0 ? p.v / o.vmax : 0))));
    let W = 0, H = 0, dpr = 1;
    function resize() {
      const r = canvas.getBoundingClientRect(); dpr = window.devicePixelRatio || 1;
      W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    // projection perspective, puis cadrage automatique de la plaque déformée dans le canevas
    function cam() {
      const a = view.az * Math.PI / 180, e = view.el * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), ce = Math.cos(e), se = Math.sin(e), D = 3.2 * L;
      const raw = (x, y, z) => { const xr = x * ca - y * sa, yr = x * sa + y * ca, d = yr * ce - z * se, f = D / (D + d); return [xr * f, -(z * ce + yr * se) * f, d]; };
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      P.forEach((row) => row.forEach((p) => { const r = raw(p[0], p[1], p[2]); u0 = Math.min(u0, r[0]); u1 = Math.max(u1, r[0]); v0 = Math.min(v0, r[1]); v1 = Math.max(v1, r[1]); }));
      const pad = 46, k = view.zoom * Math.min((W - 2 * pad) / Math.max(1e-9, u1 - u0), (H - 2 * pad - 18) / Math.max(1e-9, v1 - v0));
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      const f = (x, y, z) => { const r = raw(x, y, z); return [W / 2 + (r[0] - cu) * k, (H - 18) / 2 + (r[1] - cv) * k, r[2]]; };
      f.center = [W / 2, (H - 18) / 2];
      return f;
    }
    function draw() {
      if (!W) return;
      const pr = cam();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const S = P.map((row) => row.map((v) => pr(v[0], v[1], v[2])));
      // éléments à dessiner, triés par profondeur (du plus loin au plus proche) : faces, segments de bord, repère du maximum
      const items = [], eps = 1e-3 * L, QD = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const p0 = P[j][i], p1 = P[j][i + 1], p2 = P[j + 1][i + 1], p3 = P[j + 1][i];
        const u = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]], v = [p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]];
        let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const nn = Math.hypot(...n) || 1; n = n.map((c) => c / nn);
        const lit = 0.72 + 0.28 * Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
        const c = [0, 1, 2].map((k) => Math.round((col[j][i][k] + col[j][i + 1][k] + col[j + 1][i + 1][k] + col[j + 1][i][k]) / 4 * lit));
        const q = [S[j][i], S[j][i + 1], S[j + 1][i + 1], S[j + 1][i]];
        const dq = (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4;
        (QD[j] = QD[j] || [])[i] = dq;
        items.push({ t: 'q', q, d: dq, c: `rgb(${c.join(',')})` });
      }
      // bords : un segment par maille, dessiné juste après la maille qu'il borde (masqué seulement par les mailles placées devant)
      const e = o.edges;
      const side = (pts, k, dq) => {
        const n = pts.length - 1, step = Math.max(2, Math.round(n / 5));
        for (let i = 0; i < n; i++) {
          if (k === 'fr' && i % 2) continue;   // bord libre : tireté
          items.push({ t: 'e', p: pts[i], q: pts[i + 1], k, tri: k === 'ss' && i % step === Math.floor(step / 2), d: dq(i) - eps });
        }
      };
      side(S[0], e.bottom, (i) => QD[0][i]); side(S[ny], e.top, (i) => QD[ny - 1][i]);
      side(S.map((r) => r[0]), e.left, (j) => QD[j][0]); side(S.map((r) => r[nx]), e.right, (j) => QD[j][nx - 1]);
      // maximum : dessiné à sa profondeur, donc masqué s'il est derrière la plaque
      if (o.maxPt) {
        const i = Math.min(nx, Math.max(0, Math.round(o.maxPt.x / o.a * nx))), j = Math.min(ny, Math.max(0, Math.round(o.maxPt.y / o.b * ny)));
        const m = pr(o.maxPt.x - o.a / 2, o.maxPt.y - o.b / 2, P[j][i][2]);
        const near = [[j - 1, i - 1], [j - 1, i], [j, i - 1], [j, i]].filter(([jj, ii]) => jj >= 0 && ii >= 0 && jj < ny && ii < nx).map(([jj, ii]) => QD[jj][ii]);
        items.push({ t: 'm', m, d: Math.min(...near) - 2 * eps });
      }
      items.sort((A, B) => B.d - A.d);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      items.forEach((it) => {
        if (it.t === 'q') {
          ctx.beginPath(); ctx.moveTo(it.q[0][0], it.q[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(it.q[k][0], it.q[k][1]); ctx.closePath();
          ctx.fillStyle = it.c; ctx.fill(); ctx.strokeStyle = it.c; ctx.lineWidth = 0.8; ctx.stroke();
        } else if (it.t === 'e') {
          ctx.beginPath(); ctx.moveTo(it.p[0], it.p[1]); ctx.lineTo(it.q[0], it.q[1]);
          ctx.strokeStyle = it.k === 'fr' ? '#3f5f8f' : '#111110'; ctx.lineWidth = it.k === 'fx' ? 4.5 : it.k === 'ss' ? 2.2 : 1.8; ctx.stroke();
          if (it.tri) {
            // triangle d'appui orienté vers l'extérieur du contour (normale au segment, à l'opposé du centre de la vue)
            const p = it.p, tx = it.q[0] - p[0], ty = it.q[1] - p[1], tl = Math.hypot(tx, ty) || 1; let nx2 = -ty / tl, ny2 = tx / tl;
            if ((p[0] - pr.center[0]) * nx2 + (p[1] - pr.center[1]) * ny2 < 0) { nx2 = -nx2; ny2 = -ny2; }
            const ux = tx / tl, uy = ty / tl;
            ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + nx2 * 11 - ux * 6, p[1] + ny2 * 11 - uy * 6); ctx.lineTo(p[0] + nx2 * 11 + ux * 6, p[1] + ny2 * 11 + uy * 6); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#111110'; ctx.lineWidth = 1.2; ctx.stroke(); }
        } else {
          const m = it.m;
          ctx.beginPath(); ctx.arc(m[0], m[1], 5, 0, 2 * Math.PI); ctx.fillStyle = '#111'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
          ctx.font = '800 13px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(o.label, m[0], m[1] - 13); ctx.fillStyle = '#111'; ctx.fillText(o.label, m[0], m[1] - 13);
        }
      });
      // repère et légende
      // cotes au milieu des bords y = 0 (a) et x = 0 (b), décalées vers l'extérieur
      const tag = (txt, A, B) => { const m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], tl = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; let nx2 = -(B[1] - A[1]) / tl, ny2 = (B[0] - A[0]) / tl; if ((m[0] - pr.center[0]) * nx2 + (m[1] - pr.center[1]) * ny2 < 0) { nx2 = -nx2; ny2 = -ny2; } const x = m[0] + nx2 * 28, y = m[1] + ny2 * 28; ctx.font = '700 12px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(txt, x, y + 4); ctx.fillStyle = '#3f3e3b'; ctx.fillText(txt, x, y + 4); };
      // chaque cote sur celui des deux bords opposés qui est le plus proche de l'observateur
      const yA = pr(0, -o.b / 2, 0)[2] <= pr(0, o.b / 2, 0)[2] ? -o.b / 2 : o.b / 2, xB = pr(-o.a / 2, 0, 0)[2] <= pr(o.a / 2, 0, 0)[2] ? -o.a / 2 : o.a / 2;
      tag(`a = ${Math.round(o.a).toLocaleString('fr-FR')} mm`, pr(-o.a / 2, yA, 0), pr(o.a / 2, yA, 0));
      tag(`b = ${Math.round(o.b).toLocaleString('fr-FR')} mm`, pr(xB, -o.b / 2, 0), pr(xB, o.b / 2, 0));
      ctx.font = '600 11px Inter, sans-serif'; ctx.fillStyle = '#6e6d69'; ctx.textAlign = 'left';
      ctx.fillText(`déformée amplifiée ×${Math.round(s).toLocaleString('fr-FR')} · glisser pour tourner, molette pour zoomer, double-clic : vue initiale`, 10, H - 10);
    }
    // interactions
    let drag = null, raf = 0;
    const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
    canvas.onpointerdown = (ev) => { drag = { x: ev.clientX, y: ev.clientY, az: view.az, el: view.el }; canvas.setPointerCapture(ev.pointerId); canvas.style.cursor = 'grabbing'; };
    canvas.onpointermove = (ev) => { if (!drag) return; view.az = drag.az - (ev.clientX - drag.x) * 0.4; view.el = Math.max(-5, Math.min(89, drag.el + (ev.clientY - drag.y) * 0.3)); redraw(); };
    canvas.onpointerup = canvas.onpointercancel = () => { drag = null; canvas.style.cursor = 'grab'; };
    canvas.ondblclick = () => { Object.assign(view, DEF); redraw(); };
    canvas.onwheel = (ev) => { ev.preventDefault(); view.zoom = Math.max(0.4, Math.min(4, view.zoom * (ev.deltaY < 0 ? 1.1 : 1 / 1.1))); redraw(); };
    canvas.style.cursor = 'grab'; canvas.style.touchAction = 'none';
    resize(); draw();
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (!canvas.isConnected) { ro.disconnect(); return; } resize(); draw(); }); ro.observe(canvas); }
    return { draw, reset: () => { Object.assign(view, DEF); draw(); } };
  }

  window.LaminaView3D = { mount, view };
})();
