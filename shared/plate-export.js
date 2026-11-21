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
  // A wash (Organica.shading, O-92 c) separates into its STOPS, not its ~60 bands: its <g data-wash> is read for the
  // stops of its bands' data-mix, and its band colours are never inks.
  const WASH_G = /<g data-wash="([^"]*)">([\s\S]*?)<\/g>/g, MIX = /data-mix="(#[0-9a-fA-F]{6}) (#[0-9a-fA-F]{6}) ([\d.]+)"/;
  function inksOf(svg, colors, paper) {
    const out = (colors || []).map(key), pk = paper && paper !== 'none' ? key(paper) : null;
    const add = c => { const k = key(c); if (k !== pk && out.indexOf(k) < 0) out.push(k); };
    svg = String(svg || '').replace(WASH_G, (m, w, inner) => { inner.replace(new RegExp(MIX.source, 'g'), (x, a, b) => { add(a); add(b); return x; }); return ''; });
    svg.replace(/(?:fill|stroke|stop-color)="(#[0-9a-fA-F]{6})"/g, (m, c) => { const k = key(c); if (k !== pk && out.indexOf(k) < 0) out.push(k); return m; });
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
  // A wash on plate i: each band a dot screen of its share of ink i — (1 − f) of its first stop, f of its second —
  // a dot every `pitch` units (anchored at ox, oy), one screen angle per plate so two inks of a band never moiré.
  // on / off: the plate's ink and its absence (#000 / none on a plain plate; #fff / #000 inside a knock-out mask,
  // where a band covers the bands and shapes below).
  const ANGLES = [15, 75, 0, 45], STEPS = 64;
  // A round dot that keeps growing past 50 % and joins its neighbours (the tile clips it): the radius, in pitches, whose
  // circle ∩ the unit tile covers c — πr² up to r = ½, then minus the four caps beyond the tile's sides (bisection).
  function dotRadius(c) {
    const area = r => r <= 0.5 ? Math.PI * r * r : Math.PI * r * r - 4 * (r * r * Math.acos(0.5 / r) - 0.5 * Math.sqrt(r * r - 0.25));
    let lo = 0, hi = Math.SQRT1_2;
    for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (area(m) < c) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  let _wash = 0;
  function washPlate(w, inner, cs, i, on, off) {
    const [pitch, ox, oy] = w.split(' ').map(Number), id = 'ht' + (++_wash).toString(36) + '-', used = {};
    const h = pitch / 2, r = c => (dotRadius(c) * pitch).toFixed(3);
    const body = inner.replace(/<path fill="(#[0-9a-fA-F]{6})" (data-mix="[^"]*")/g, (m, band, mix) => {
      const [, a, b, f] = mix.match(MIX), q = Math.round(((key(a) === cs[i] ? 1 - +f : 0) + (key(b) === cs[i] ? +f : 0)) * STEPS);
      if (q <= 0) return `<path fill="${off}"`;
      if (q >= STEPS) return `<path fill="${on}"`;
      used[q] = 1;
      return `<path fill="url(#${id}${q})"`;
    });
    const pats = Object.keys(used).map(q => {
      const dot = r(q / STEPS), box = `M0 0h${pitch}v${pitch}h-${pitch}z`;
      const circ = `M${(h - dot).toFixed(3)} ${h}a${dot} ${dot} 0 1 0 ${2 * dot} 0a${dot} ${dot} 0 1 0 ${-2 * dot} 0z`;
      // once the dots touch (r > ½) the tile is ink and the holes are cut at its corners — no tile edge in the ink,
      // where a rotated pattern leaves hairlines (a plain plate cannot paint a hole: it keeps the clipped dot)
      const inside = off === 'none' ? `<path fill="${on}" d="${circ}"/>`
        : +dot > h ? `<path fill="${on}" d="${box}"/><path fill="${off}" fill-rule="evenodd" d="${box}${circ}"/>`
        : `<path fill="${off}" d="${box}"/><path fill="${on}" d="${circ}"/>`;
      return `<pattern id="${id}${q}" patternUnits="userSpaceOnUse" width="${pitch}" height="${pitch}" patternTransform="translate(${-ox} ${-oy}) rotate(${ANGLES[i % 4]})">${inside}</pattern>`;
    }).join('');
    return (pats ? `<defs>${pats}</defs>` : '') + body;
  }
  function plateSVG(svg, inks, i, paper, opts) {
    const cs = inks.map(key), washes = [];
    let out = paper && paper !== 'none' ? svg.replace(new RegExp(`<rect width="[\\d.]+" height="[\\d.]+" fill="${paper}"/>`, 'i'), '') : svg;
    // the washes leave the drawing while it is painted (their band colours are no ink) and come back as screens
    out = out.replace(WASH_G, (m, w, inner) => { washes.push([w, inner]); return '<!--wash' + (washes.length - 1) + '-->'; });
    const back = (str, on, off) => str.replace(/<!--wash(\d+)-->/g, (m, k) => washPlate(washes[k][0], washes[k][1], cs, i, on, off));
    // a wash covers what is under it (the shape's own fill, a band under a band): its drawing is knocked out
    if (!(opts && opts.knockout || washes.length) || /mix-blend-mode:\s*multiply|<image\b/.test(out)) {
      return back(plateStops(out.replace(/(fill|stroke)="(#[0-9a-fA-F]{3,8})"/g, (m, attr, c) => {
        const j = cs.indexOf(key(c));
        return j === -1 ? m : `${attr}="${j === i ? '#000000' : 'none'}"`;
      }), cs, i, '#000000'), '#000000', 'none');
    }
    const m = out.match(/^(<svg\b[^>]*>)([\s\S]*)(<\/svg>\s*)$/), vb = out.match(/viewBox="([-\d.]+)[ ,]+([-\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)"/);
    if (!m || !vb) return back(out, '#000000', 'none');
    const paint = seg => plateStops(seg.replace(/(fill|stroke)="(#[0-9a-fA-F]{3,8})"/g, (x, attr, c) => `${attr}="${cs.indexOf(key(c)) === i ? '#ffffff' : '#000000'}"`), cs, i, '#ffffff');
    const inner = back(m[2].split(/(<(mask|clipPath)\b[\s\S]*?<\/\2>)/).map((seg, k) => (k % 3 === 0 ? paint(seg) : k % 3 === 1 ? seg : '')).join(''), '#ffffff', '#000000');
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
