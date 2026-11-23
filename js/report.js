/* ==========================================================================
   Lamina — fiche pour note de calcul (NDC)
   Aperçu A4 à l'écran, puis PDF (impression du navigateur) ou Word (.doc).
   Chaque module fournit ses pages : api.page(state, project, idx, total, opts).
   ========================================================================== */
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const opts = { logo: true, ref: '' };
  let items = [];

  const build = () => items.map((it, i) => {
    const m = it.state && window.LaminaModules && window.LaminaModules[it.state.kind];
    return m ? m.api.page(it.state, it.project, i, items.length, opts) : '';
  }).join('');
  function open(list) {
    items = list;
    if (!items.length) return;
    const name = list.length === 1 ? (list[0].state.name || 'element') : (list[0].project || 'projet');
    const ov = document.createElement('div');
    ov.className = 'rp-overlay';
    ov.innerHTML = `<div class="rp-bar"><b>Fiche NDC — ${esc(name)}</b>
      <label><input type="text" id="rpRef" placeholder="Réf. affaire / NDC" value="${esc(opts.ref)}" style="width:150px;padding:4px 6px;font-size:12px;border:0"></label>
      <label><input type="checkbox" id="rpLogo"${opts.logo ? ' checked' : ''}> logo tracés</label>
      <button class="btn primary" data-x="pdf">PDF</button><button class="btn" data-x="doc">Word</button><button class="btn" data-x="close">Fermer ✕</button></div>
      <div class="rp-pages"></div>`;
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    const render = () => { $('.rp-pages', ov).innerHTML = build(); };
    render();
    const close = () => { ov.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('change', (e) => {
      if (e.target.id === 'rpLogo') opts.logo = e.target.checked;
      if (e.target.id === 'rpRef') opts.ref = e.target.value;
      render();
    });
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'close') close();
      if (b.dataset.x === 'pdf') { const t = document.title; document.title = 'NDC-' + slug(name); window.print(); document.title = t; }
      if (b.dataset.x === 'doc') exportWord(ov, name);
    });
  }
  const slug = (s) => String(s || 'lamina').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  function download(fname, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function svgToPng(svg) {
    return new Promise((resolve) => {
      const img = new Image(), scale = 3;
      img.onload = () => { const c = document.createElement('canvas'); c.width = img.width * scale; c.height = img.height * scale; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); resolve({ src: c.toDataURL('image/png'), w: img.width, h: img.height }); };
      img.onerror = () => resolve(null);
      const s = svg.cloneNode(true); s.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const vb = (s.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      if (vb.length === 4) { s.setAttribute('width', vb[2]); s.setAttribute('height', vb[3]); }
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.outerHTML);
    });
  }
  async function exportWord(ov, name) {
    const clone = $('.rp-pages', ov).cloneNode(true);
    for (const sv of Array.from(clone.querySelectorAll('svg'))) { const png = await svgToPng(sv); if (png) { const im = document.createElement('img'); im.src = png.src; im.width = png.w; im.height = png.h; sv.replaceWith(im); } else sv.remove(); }
    clone.querySelectorAll('.pl-legend').forEach((x) => x.remove());
    clone.querySelectorAll('.rp-fig').forEach((f) => { const t = document.createElement('table'); const tr = t.insertRow(); Array.from(f.children).forEach((ch) => { const td = tr.insertCell(); td.style.border = '0'; td.style.verticalAlign = 'top'; td.appendChild(ch); }); f.replaceWith(t); });
    clone.querySelectorAll('.rp-kv, .rp-calc').forEach((k) => { const t = document.createElement('table'); Array.from(k.children).forEach((d) => { const tr = t.insertRow(); Array.from(d.children).forEach((x) => { const td = tr.insertCell(); td.innerHTML = x.innerHTML; }); }); k.replaceWith(t); });
    clone.querySelectorAll('.rp-head, .rp-concl').forEach((h) => { const t = document.createElement('table'); t.className = h.classList.contains('rp-head') ? 'hd' : 'cc'; const tr = t.insertRow(); Array.from(h.children).forEach((ch, i) => { const td = tr.insertCell(); td.innerHTML = h.classList.contains('rp-head') ? ch.innerHTML : ch.outerHTML; if (i) td.style.textAlign = 'right'; }); h.replaceWith(t); });
    const pages = Array.from(clone.querySelectorAll('.rp-page')).map((p) => p.innerHTML);
    const css = `body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#111}h1{font-size:15pt;margin:4pt 0}h2{font-size:10.5pt;border-top:1pt solid #111;padding-top:3pt;margin:12pt 0 4pt}h3{font-size:9.5pt;margin:8pt 0 3pt}
      table{border-collapse:collapse;width:100%;font-size:8.5pt;margin:2pt 0 5pt}th,td{border-bottom:.5pt solid #bbb;padding:2pt 4pt;text-align:left;vertical-align:top}th{border-bottom:1pt solid #111}td.num,th.num{text-align:right}
      .n{color:#6b8fc2;margin-right:6pt}.logo-s{color:#6b8fc2;font-weight:bold;font-size:14pt}table.hd td{border:0;border-bottom:1.2pt solid #111;font-size:8pt;color:#555}table.cc td{border:1pt solid #111;font-size:10pt;padding:5pt}
      .rp-ok{color:#1f7a4d;font-weight:bold}.rp-ko{color:#c62f29;font-weight:bold}tr.gov td{font-weight:bold}p{margin:0 0 4pt}`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(name)}</title>
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>@page{size:21cm 29.7cm;margin:1.6cm}${css}</style></head>
      <body>${pages.map((p, i) => (i ? '<br clear="all" style="page-break-before:always">' : '') + p).join('')}</body></html>`;
    download('NDC-' + slug(name) + '.doc', new Blob(['﻿', html], { type: 'application/msword' }));
  }
  window.LaminaReport = { open };
})();
