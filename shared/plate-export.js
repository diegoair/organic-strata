/* ─────────────────────────────────────────────────────────────
   plate-export.js — generalizes Colornet's own per-channel PNG loop
   (exportSeparations) into "N discrete outputs → N staggered downloads",
   reusable by any tool that can enumerate N atomic plates and build each
   one's Blob on demand. Extracted at the 2nd+3rd real consumer (Pollen,
   Spore) alongside Colornet (1st) — this repo's own "extract at the
   second consumer" convention (pollen-engine.js, radial.js, shapes.js).

   Plain classic script (IIFE → window.Organica.plateExport), same shape
   as every other shared/*.js file.

   LOAD ORDER: core.js → print-size.js → print-size-panel.js →
   plate-export.js → tool script. Needs Organica.download (core.js).
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  const key = h => { h = String(h).toLowerCase(); return h.length === 4 ? '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h.slice(0, 7); };
  // The inks a drawing separates into (Nov 21, 2026 — promoted from FVS, where it began Nov 20): the palette's, in its
  // order, then every other solid ink the drawing uses — a shaded colour's shadow inks (Halftone, Core, a texture's
  // marks; Organica.shading plates are one ink per path) and a smooth shading's gradient stops. The paper is left out.
  function inksOf(svg, colors, paper) {
    const out = (colors || []).map(key), pk = paper && paper !== 'none' ? key(paper) : null;
    String(svg || '').replace(/(?:fill|stroke|stop-color)="(#[0-9a-fA-F]{6})"/g, (m, c) => { const k = key(c); if (k !== pk && out.indexOf(k) < 0) out.push(k); return m; });
    return out;
  }
  // A smooth shading is an SVG gradient: each stop on its own ink's plate at its opacity, clear on every other plate
  // (on = the plate's colour: black, or white inside a knock-out mask).
  function plateStops(seg, cs, i, on) {
    return seg.replace(/stop-color="(#[0-9a-fA-F]{3,8})"(\s+stop-opacity="([\d.]+)")?/g, (m, c, _o, op) => {
      const j = cs.indexOf(key(c));
      if (j === -1) return m;
      return j === i ? `stop-color="${on}"${op != null ? ` stop-opacity="${op}"` : ''}` : `stop-color="${on}" stop-opacity="0"`;
    });
  }
  // Plate i of a drawing: its ink in black, every other ink gone — matched by INDEX in `inks` (two equal hexes never
  // land on two plates). The paper rect goes. opts.knockout: shapes on top cover the ones below (an ink under another
  // is cut out) — the drawing becomes a mask; without it the plain plate (or an overprint: multiply, images).
  function plateSVG(svg, inks, i, paper, opts) {
    const cs = inks.map(key);
    let out = paper && paper !== 'none' ? svg.replace(new RegExp(`<rect width="[\\d.]+" height="[\\d.]+" fill="${paper}"/>`, 'i'), '') : svg;
    if (!(opts && opts.knockout) || /mix-blend-mode:\s*multiply|<image\b/.test(out)) {
      return plateStops(out.replace(/(fill|stroke)="(#[0-9a-fA-F]{3,8})"/g, (m, attr, c) => {
        const j = cs.indexOf(key(c));
        return j === -1 ? m : `${attr}="${j === i ? '#000000' : 'none'}"`;
      }), cs, i, '#000000');
    }
    const m = out.match(/^(<svg\b[^>]*>)([\s\S]*)(<\/svg>\s*)$/), vb = out.match(/viewBox="([-\d.]+)[ ,]+([-\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)"/);
    if (!m || !vb) return out;
    const paint = seg => plateStops(seg.replace(/(fill|stroke)="(#[0-9a-fA-F]{3,8})"/g, (x, attr, c) => `${attr}="${cs.indexOf(key(c)) === i ? '#ffffff' : '#000000'}"`), cs, i, '#ffffff');
    const inner = m[2].split(/(<(mask|clipPath)\b[\s\S]*?<\/\2>)/).map((seg, k) => (k % 3 === 0 ? paint(seg) : k % 3 === 1 ? seg : '')).join('');
    const [x, y, w, h] = vb.slice(1).map(Number), id = 'plate-' + i;
    return `${m[1]}<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000000"/>${inner}</mask></defs>`
      + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000000" mask="url(#${id})"/>${m[3]}`;
  }

  Organica.plateExport = {
    inksOf: inksOf,
    plateSVG: plateSVG,
    // count: number of plates. opts.build(i) → {blob, filename} — or a
    // Promise of one, for a plate whose export needs async work (e.g.
    // embedding a PNG pHYs chunk via Blob.arrayBuffer()) — or null/
    // undefined to skip an empty/degenerate plate without downloading a
    // blank file. opts.stagger (ms, default 220 — browsers drop bursts
    // of simultaneous downloads, the same reasoning Colornet's original
    // exportSeparations loop already used). opts.onDone() fires once
    // every plate has resolved (order-independent).
    run: function (count, opts) {
      opts = opts || {};
      const stagger = opts.stagger != null ? opts.stagger : 220;
      let done = 0;
      for (let i = 0; i < count; i++) {
        setTimeout(function (idx) {
          Promise.resolve(opts.build(idx)).then(function (r) {
            if (r) Organica.download(r.blob, r.filename);
            done++;
            if (done === count && opts.onDone) opts.onDone();
          });
        }.bind(null, i), i * stagger);
      }
    },
  };
})(typeof window !== 'undefined' ? window : this);
