/* ═══════════════════════════════════════════════════════════
   A · Bands — one home-hero loop for Organica.heroPlayer (shared/hero-player.js).
   Its slides are data (title, ms, pal, brief, and the loop's own fields); its engine is
   build(svg, W, H) → { enter(i, instant), step(ms), reroll(), palette() }. Split out of
   shared/hero-sheets.js on Nov 26, 2026 (backlog 2.1), code unchanged.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var P = window.Organica.heroPlayer, U = P.util, NS = U.NS, HL = U.HL, PALS = U.PALS;
  var el = U.el, rng = U.rng, f = U.f, clamp = U.clamp, ease = U.ease, rgb = U.rgb, mix = U.mix, lum = U.lum, many = U.many;

  /* ═════════ A · Bands (after Jerry-Lee Bosmans's gradient checks) ═════════
     Vertical bands, four cells wide. Each band is a stack of blocks: a CHECK (4 × 2 cells, two inks
     alternating — one flat, one a gradient top → bottom) or a STRIPE (4 × 1, tall). A cell can be turned
     a half turn: the flat ink does not show it, the gradient turns over — so the rules (Checkerboard, by
     rows, by bands) read only in the gradient cells. On every beat the sheet changes one thing: the
     turns, a block's inks, a band's stack, the palette. */
  var BANDS_UID = 0;
  var BANDS = {
    slides: [
      { title: 'Bands', ms: 2000, pal: 3, brief: 'Bands four cells wide, stacked from blocks: a check of two inks, one flat and one a gradient, or a tall stripe.' },
      { title: 'Turn', ms: 4400, pal: 3, brief: 'A half turn by a rule: Checkerboard, rows, bands. The flat ink hides it; the gradient turns over.' },
      { title: 'Re-ink', ms: 4000, pal: 2, brief: 'One block at a time takes new inks; the layout holds.' },
      { title: 'Restack', ms: 4400, pal: 0, brief: 'A band folds away and rebuilds with a new stack of blocks.' },
      { title: 'Colourway', ms: 4000, pal: 'cycle', brief: 'The same sheet, re-inked: each beat, the next palette, band by band.' },
    ],
    build: function (svg, W, H, FV) {         // FV: every gradient is FVS's own Shading (Organica.shading.smoothStops: OKLab, 17 stops)
      var SH = FV && window.Organica && Organica.shading && Organica.shading.smoothStops ? Organica.shading : null;
      var ROWS = 12, u = H / ROWS, NB = Math.max(3, Math.round(W / (4 * .8 * u))), cw = W / (NB * 4);
      var BEAT = 1600, DUR = 850, CST = 55, rand = rng(23), now = 0, next = BEAT, beat = 0, cfg = BANDS.slides[0], pal = 0, rule = 0, uid = 'hb' + (++BANDS_UID), gid = 0;
      var defs = el('defs', {}, svg), bg = el('rect', { width: W, height: H }, svg), bands = [];
      var TURNS = [                                   // the half-turn rules, on the sheet's own cell grid
        function () { return 0; },                                          // Uniform
        function (gc, gr) { return (gc + gr) % 2 ? 180 : 0; },              // Checkerboard
        function (gc, gr) { return gr % 2 ? 180 : 0; },                     // Rows
        function (gc) { return Math.floor(gc / 4) % 2 ? 180 : 0; },         // Bands
      ];
      function inksOf(pi) {                           // the palette's own inks (no paper mixes: they dull) + each one's tint toward white
        var p = PALS[pi], core = p.all.filter(function (h) { return h !== p.paper; }).map(rgb);
        return { core: core, tint: core.map(function (c) { return c.map(function (v) { return v + (255 - v) * .62; }); }) };
      }
      function pick(inks) {                           // mostly an ink into its own tint (as in the reference), sometimes into another ink; the flat ink is a third
        var n = inks.core.length, k = Math.floor(rand() * n), j = (k + 1 + Math.floor(rand() * (n - 1))) % n, own = rand() < .72;
        var g = own ? [inks.tint[k], inks.core[k]] : [inks.core[j], inks.core[k]]; if (rand() < .5) g.reverse();
        var pool = inks.core.concat(inks.tint).filter(function (c) { return c !== inks.core[k] && c !== inks.tint[k] && (own || c !== inks.core[j]); });
        return { flat: pool[Math.floor(rand() * pool.length)] || inks.tint[j], g0: g[0], g1: g[1] };
      }
      function stack() { var out = [], y = 0; while (y < ROWS) { var k = rand() < .62 ? 'check' : 'stripe', h = k === 'check' ? 2 : 3 + Math.floor(rand() * 3); out.push({ kind: k, y: y, h: h }); y += h; } return out; }
      function cssOf(c) { return 'rgb(' + c.map(Math.round).join(',') + ')'; }
      function mixc(a, b, e) { return [0, 1, 2].map(function (k) { return a[k] + (b[k] - a[k]) * e; }); }
      function makeBlock(band, spec, inks) {
        var b = { kind: spec.kind, y: spec.y, h: spec.h, col: pick(inks), from: null, t0: -1e9, gt0: -1e9, gdir: 1, gk: 1, cells: [], id: uid + '-' + (++gid) };
        b.g = el('g', {}, band.g); b.grad = el('linearGradient', { id: b.id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
        b.s0 = el('stop', { offset: 0 }, b.grad); b.s1 = el('stop', { offset: 1 }, b.grad); b.stops = [b.s0, b.s1];
        if (SH) { b.artG = el('g', { id: b.id + '-g' }, defs); b.artF = el('g', { id: b.id + '-f' }, defs); b.art = -1e9; }
        var rows = b.kind === 'check' ? 2 : 1, rh = b.h * u / rows;
        for (var r = 0; r < rows; r++) for (var c = 0; c < 4; c++) {
          var x = (band.i * 4 + c) * cw, y = b.y * u + r * rh, gc = band.i * 4 + c, gr = b.y + r * (b.h / rows);
          var cg = el('g', {}, b.g), isG = (c + r) % 2 === band.i % 2, rect;
          if (SH) { b.rh = rh; rect = el('use', { href: '#' + b.id + (isG ? '-g' : '-f'), transform: 'translate(' + f(x) + ' ' + f(y) + ')' }, cg); }   // FVS: the block's cell, drawn once
          else { rect = el('rect', { x: f(x), y: f(y), width: f(cw + .6), height: f(rh + .6) }, cg); if (isG) rect.setAttribute('fill', 'url(#' + b.id + ')'); }
          b.cells.push({ g: cg, rect: rect, grad: isG, cx: x + cw / 2, cy: y + rh / 2, gc: gc, gr: gr, turn: 0, from: 0, t0: -1e9 });
        }
        b.cells.forEach(function (c) { c.turn = c.from = TURNS[rule](c.gc, Math.round(c.gr)); drawCell(c, 1); });
        paint(b, 1); return b;
      }
      var shadeCtxOf = {};
      function shadeCtx() {                           // the palette's tints, as FVS gives them to a Shading (05-render-component.js)
        if (!shadeCtxOf[pal]) { var p = PALS[pal]; shadeCtxOf[pal] = { tints: [].concat.apply([], p.all.filter(function (h) { return h !== p.paper; }).map(function (h) { return Organica.color.scale(h).map(function (st) { return st.hex; }); })) }; }
        return shadeCtxOf[pal];
      }
      function hexOf(c) { return '#' + c.map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join(''); }
      function paint(b, e) {
        var a = b.from || b.col, z = b.col;
        if (SH) {                                     // FVS: each ink's Shading, drawn by Organica.shading.overlaySVG — the gradient ink a Linear
          if (e < 1 && now - b.art < 90) return;      // (angle 180 = top → bottom) into its partner, the flat ink Flat; both with the Shadow inside
          b.art = now;
          var d = 'M0 0h' + f(cw + .6) + 'v' + f(b.rh + .6) + 'h' + f(-cw - .6) + 'z', g0 = hexOf(mixc(a.g0, z.g0, e)), g1 = hexOf(mixc(a.g1, z.g1, e)), fh = hexOf(mixc(a.flat, z.flat, e));
          // no Shadow, and the plain two-stop gradient of the sheet without FVS (Diego, Nov 24), top → bottom, not FVS's OKLab
          // Linear; the flat ink a plain fill
          b.s0.setAttribute('stop-color', g0); b.s1.setAttribute('stop-color', g1);
          b.artG.innerHTML = '<path d="' + d + '" fill="url(#' + b.id + ')"/>';
          b.artF.innerHTML = '<path d="' + d + '" fill="' + fh + '"/>';
          return;
        } else {
        b.s0.setAttribute('stop-color', cssOf(mixc(a.g0, z.g0, e))); b.s1.setAttribute('stop-color', cssOf(mixc(a.g1, z.g1, e))); }
        var fl = cssOf(mixc(a.flat, z.flat, e)); b.cells.forEach(function (c) { if (!c.grad) c.rect.setAttribute('fill', fl); });
      }
      function drawCell(c, e) {
        var a = c.from + (c.turn - c.from) * e, s = Math.cos(a * Math.PI / 180);
        c.g.setAttribute('transform', s > .9999 ? '' : 'translate(0 ' + f(c.cy) + ') scale(1 ' + (Math.round(s * 1000) / 1000 || .001) + ') translate(0 ' + f(-c.cy) + ')');
      }
      function grow(b, e) {                           // a block folds up into its top edge (e 0) or opens down from it (e 1)
        var k = b.gdir > 0 ? e : 1 - e; b.gk = k; var y0 = b.y * u;
        b.g.setAttribute('transform', k > .9999 ? '' : 'translate(0 ' + f(y0) + ') scale(1 ' + (Math.round(k * 1000) / 1000 || .001) + ') translate(0 ' + f(-y0) + ')');
      }
      function newBand(i) { var band = { i: i, g: el('g', {}, svg), blocks: [], pend: null, ft0: -1e9 }; return band; }
      function fill(band, inks, animate, delay) {
        band.blocks.forEach(function (b) { b.g.remove(); b.grad.remove(); if (b.artG) { b.artG.remove(); b.artF.remove(); } });
        band.blocks = stack().map(function (s) { return makeBlock(band, s, inks); });
        band.blocks.forEach(function (b, k) { if (animate) { b.gdir = 1; b.gt0 = now + (delay || 0) + k * CST; grow(b, 0); } });
      }
      function restack(band, delay) {                 // fold every block away, then a new stack opens
        band.blocks.forEach(function (b, k) { b.gdir = -1; b.gt0 = now + (delay || 0) + (band.blocks.length - 1 - k) * CST * .6; });
        band.pend = now + (delay || 0) + band.blocks.length * CST * .6 + DUR;
      }
      function reink(b, inks, delay) { b.from = { flat: mixc(b.from ? b.from.flat : b.col.flat, b.col.flat, 1), g0: b.col.g0, g1: b.col.g1 }; b.col = pick(inks); b.t0 = now + (delay || 0); }
      function setRule(rk, animate) {
        rule = rk;
        bands.forEach(function (band) { band.blocks.forEach(function (b) { b.cells.forEach(function (c) {
          var to = TURNS[rk](c.gc, Math.round(c.gr)); if (to === c.turn) return;
          c.from = c.turn; c.turn = to; c.t0 = animate ? now + (c.gc * 1.2 + c.gr) * 18 : -1e9; if (!animate) drawCell(c, 1);
        }); }); });
      }
      function background(pi) { bg.setAttribute('fill', PALS[pi].paper); }
      for (var i = 0; i < NB; i++) bands.push(newBand(i));
      bands.forEach(function (band) { fill(band, inksOf(BANDS.slides[0].pal), false); });
      return {
        cells: NB * 4 * ROWS,
        enter: function (i, instant) {
          cfg = BANDS.slides[i]; var p0 = pal; pal = cfg.pal === 'cycle' ? (beat + 1) % PALS.length : cfg.pal; background(pal);
          var inks = inksOf(pal);
          if (i === 0) { setRule(0, false); bands.forEach(function (band, k) { fill(band, inks, !instant, k * CST * 2); }); }
          else if (i === 1) setRule(1, !instant);
          else { if (rule) setRule(0, !instant); if (pal !== p0) bands.forEach(function (band) { band.blocks.forEach(function (b) { reink(b, inks, instant ? -1e9 : band.i * CST * 1.5 + b.y * 12); if (instant) { b.t0 = -1e9; paint(b, 1); } }); }); }
          next = now + (i === 4 ? BEAT * .6 : BEAT);   // Colourway: its first re-ink follows the entry re-ink sooner, or the sheet stands still between them
        },
        step: function (ms) {
          now += ms;
          if (now >= next) {
            next = now + BEAT; beat++;
            var inks = inksOf(pal), si = BANDS.slides.indexOf(cfg);
            if (si === 1) { var nr = [2, 3, 1, 0][beat % 4]; setRule(nr === rule ? [2, 3, 1, 0][(beat + 1) % 4] : nr, true); }   // never the rule already there: that beat would stand still
            else if (si === 2) for (var k = 0; k < 3; k++) { var band = bands[Math.floor(rand() * NB)], b = band.blocks[Math.floor(rand() * band.blocks.length)]; reink(b, inks, k * 160); }
            else if (si === 3) { var free = bands.filter(function (b) { return b.pend == null; }); if (free.length) restack(free[Math.floor(rand() * free.length)], 0); }   // never a band already rebuilding: that beat would stand still
            else if (si === 4) { pal = (pal + 1) % PALS.length; background(pal); inks = inksOf(pal); bands.forEach(function (band) { band.blocks.forEach(function (b) { reink(b, inks, band.i * CST * 1.5 + b.y * 12); }); }); }
          }
          bands.forEach(function (band) {
            if (band.pend != null && now >= band.pend) { band.pend = null; fill(band, inksOf(pal), true, 0); }
            band.blocks.forEach(function (b) {
              var ec = (now - b.t0) / DUR; if (ec >= 0 && ec <= 1.05) paint(b, ease(clamp(ec)));
              var eg = (now - b.gt0) / DUR; if (eg >= 0 && eg <= 1.05) grow(b, ease(clamp(eg))); else if (eg < 0 && b.gdir > 0 && b.gk !== 0) grow(b, 0);
              b.cells.forEach(function (c) { var et = (now - c.t0) / DUR; if (et >= 0 && et <= 1.05) drawCell(c, ease(clamp(et))); });
            });
          });
        },
        reroll: function () { restack(bands[Math.floor(rand() * NB)], 0); },
        palette: function () { return pal; },
        model: function () {                          // the sheet as it stands (capture-bands.mjs builds it in FVS)
          return { NB: NB, ROWS: ROWS, cw: cw, u: u, rule: rule, pal: pal, bands: bands.map(function (band) { return band.blocks.map(function (b) {
            return { kind: b.kind, y: b.y, h: b.h, flat: hexOf(b.col.flat), g0: hexOf(b.col.g0), g1: hexOf(b.col.g1),
              cells: b.cells.map(function (c) { return { grad: c.grad, turn: c.turn }; }) }; }); }) };
        },
      };
    },
  };
  var BANDSFVS = {
    slides: BANDS.slides.map(function (s) { var o = {}; for (var k in s) o[k] = s[k]; o.brief = s.brief + ' Every gradient is FVS\u2019s Shading of the ink (OKLab, as FVS draws it); every block an FVS Component.'; return o; }),
    build: function (svg, W, H) { return BANDS.build(svg, W, H, true); },
  };

  P.define('bandsfvs', BANDSFVS);
})();
