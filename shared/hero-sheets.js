/* ═══════════════════════════════════════════════════════════
   Organica.heroSheets — seven of the home hero's loops (the eighth,
   C · The score, is shared/hero-loop.js). Same handle for all:

     Organica.heroSheets.mount(host, { kind, start, lock, still, intro, label, onSlide, onProgress })
       → { go(i), next(), prev(), reroll(), pause(bool), stats(), advance(ms), stop() }

     kind 'bandsfvs'    A · bands of checks and stripes, gradients by Organica.shading
          'windowsfvs'  B · ellipse windows cut into texture panels
          'morphfvs'    D · a sheet of flat marks that morph in place
          'dotsfvsov'   E · a score of concentric discs that overlap as they change
          'weavefvs'    F · a pixel weave in drifting bands
          'printfvs'    G · three inks overprinted, strokes that lean and fade
          'stacksfvs'   H · columns of capsules stacked like a deck
     label false → no slide-title chip (.hloop__word); the home passes false

   Every kind but A needs its model loaded first (load…Model(url), files in
   shared/hero/); A needs Organica.shading. shared/hero.js does both, on
   demand. Each FVS kind draws through its hand-drawn base (WEAVE, DOTS, …),
   which is why those stay in the file. Came from explorations/home-mockups.

   Inline SVG, one rAF clock, nothing runs while hidden or off screen;
   reduced motion (or still: true) gives one settled still per slide.
   Colours are content: the four TuneSutra palettes in hero-loop.js.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', HL = window.Organica.heroLoop, PALS = HL.PALETTES;

  // ── small tools ──
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function f(n) { return Math.round(n * 100) / 100; }
  function clamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, t) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')'; }
  function lum(c) { return (c[0] * .299 + c[1] * .587 + c[2] * .114) / 255; }
  function many(pi) { var p = PALS[pi]; return HL.inks(pi, 9).filter(function (h) { return h !== p.paper; }); }   // up to nine inks, never the paper

  /* ═════════ D · the morph sheet ═════════
     A mark is up to four parts; a part is a quad with a radius on each corner,
     so square, disc, half disc, leaf, triangle and diamond are one shape and
     any mark can morph into any other. */
  function sq(cx, cy, w, h, r) {
    h = h == null ? w : h; r = r || 0; if (typeof r === 'number') r = [r, r, r, r];
    var x = cx - w / 2, y = cy - h / 2; return { p: [x, y, x + w, y, x + w, y + h, x, y + h], r: r, k: 0 };
  }
  function disc(cx, cy, d) { return sq(cx, cy, d, d, d / 2); }
  function tri(a, b, c, d, e, g) { return { p: [a, b, c, d, e, g, e, g], r: [0, 0, 0, 0], k: 0 }; }
  function dia(cx, cy, w, h) { h = h == null ? w : h; return { p: [cx, cy - h / 2, cx + w / 2, cy, cx, cy + h / 2, cx - w / 2, cy], r: [0, 0, 0, 0], k: 0 }; }
  function k(part, i) { part.k = i; return part; }
  var MARKS = [
    [disc(30, 30, 30), disc(70, 30, 30), disc(30, 70, 30), disc(70, 70, 30)],
    [disc(50, 50, 80), k(disc(50, 50, 46), 1), k(disc(50, 50, 16), 2)],
    [sq(31, 50, 38, 80, [0, 38, 38, 0]), sq(69, 50, 38, 80, [38, 0, 0, 38])],
    [sq(31, 31, 38, 38, [0, 38, 0, 38]), sq(69, 31, 38, 38, [38, 0, 38, 0]), sq(69, 69, 38, 38, [0, 38, 0, 38]), sq(31, 69, 38, 38, [38, 0, 38, 0])],
    [sq(25, 25, 30), k(sq(50, 50, 30), 1), sq(75, 75, 30)],
    [k(dia(50, 32, 80, 40), 1), { p: [10, 32, 50, 52, 50, 92, 10, 72], r: [0, 0, 0, 0], k: 0 }, { p: [50, 52, 90, 32, 90, 72, 50, 92], r: [0, 0, 0, 0], k: 2 }],
    [tri(10, 90, 90, 90, 90, 10), k(dia(58, 62, 34), 1)],
    [disc(50, 50, 80), k(dia(50, 50, 44), 1)],
    [disc(50, 24, 24), tri(50, 44, 70, 90, 30, 90)],
    [sq(50, 35, 60, 30, [30, 30, 0, 0]), k(sq(50, 65, 60, 30, [0, 0, 30, 30]), 1)],
    [tri(10, 50, 50, 50, 50, 10), tri(50, 50, 90, 50, 90, 10), tri(10, 90, 50, 90, 50, 50), tri(50, 90, 90, 90, 90, 50)],
    [sq(30, 70, 40, 40), k(sq(70, 50, 40, 80), 1), k(disc(70, 74, 18), 2)],
    [sq(50, 50, 80, 26, 13), k(sq(50, 50, 26, 80, 13), 1)],
    [dia(50, 50, 84, 52), k(disc(50, 50, 30), 1), k(disc(50, 50, 10), 2)],
  ];
  var TURNS = [
    function (r, c) { return [[180, 270], [90, 0]][r % 2][c % 2]; },     // Radial
    function (r, c) { return (r + c) % 2 ? 180 : 0; },                    // Checkerboard
    function (r, c) { return ((r % 2) * 2 + (c % 2)) * 90; },             // Pinwheel
    function () { return 0; },                                            // Identity
  ];
  function closed(part) {                    // a missing part: the other pose's part, shut on its own centre
    var x = (part.p[0] + part.p[2] + part.p[4] + part.p[6]) / 4, y = (part.p[1] + part.p[3] + part.p[5] + part.p[7]) / 4;
    return { p: [x, y, x, y, x, y, x, y], r: [0, 0, 0, 0], k: part.k };
  }
  function pathOf(p, r) {
    var d = '';
    for (var i = 0; i < 4; i++) {
      var x = p[i * 2], y = p[i * 2 + 1], j = (i + 3) % 4, n = (i + 1) % 4;
      var ux = p[j * 2] - x, uy = p[j * 2 + 1] - y, vx = p[n * 2] - x, vy = p[n * 2 + 1] - y, lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy), rr = r[i];
      var tn = (rr < .05 || lu < .05 || lv < .05) ? 0 : Math.tan(Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)))) / 2);
      if (tn < 1e-3) { d += (d ? 'L' : 'M') + f(x) + ' ' + f(y); continue; }
      var dd = Math.min(rr / tn, lu, lv); rr = dd * tn;
      d += (d ? 'L' : 'M') + f(x + ux / lu * dd) + ' ' + f(y + uy / lu * dd) + 'A' + f(rr) + ' ' + f(rr) + ' 0 0 ' + (ux * vy - uy * vx < 0 ? 1 : 0) + ' ' + f(x + vx / lv * dd) + ' ' + f(y + vy / lv * dd);
    }
    return d + 'Z';
  }
  var MORPH = {
    slides: [
      { title: 'Specimen', ms: 5000, brief: 'A sheet of marks, each made of up to four parts. They hold a pose, then every part glides to its place in the next mark.', sheet: 'specimen', timing: 'together', gap: 'open', pal: 0 },
      { title: 'In a wave', ms: 5500, brief: 'The same sheet, but the change starts in the centre and travels out, cell by cell.', sheet: 'specimen', timing: 'wave', gap: 'open', pal: 1 },
      { title: 'One Element', ms: 5000, brief: 'One mark in every cell. A rule turns each cell; on every beat the mark and the rule change together.', sheet: 'one', timing: 'together', gap: 'tight', pal: 2 },
      { title: 'Four rules', ms: 5500, brief: 'One mark, four rules in turn (Radial, Checkerboard, Pinwheel, Identity), passed across the sheet as a wave.', sheet: 'one', timing: 'wave', gap: 'open', pal: 3 },
      { title: 'Colourway', ms: 5000, brief: 'The sheet keeps morphing while the palette changes on every beat.', sheet: 'specimen', timing: 'together', gap: 'open', pal: 'cycle' },
    ],
    build: function (svg, W, H, T) {
      var ROWS = 6, u = Math.ceil(H / ROWS), COLS = Math.ceil(W / u), HOLD = 1000, DUR = 950, STEP = 95;
      var bg = el('rect', { width: W, height: H }, svg);
      // with T (the FVS model): every mark at rest is FVS's own drawing of its Element (a <symbol>, inks as CSS
      // variables); in between, the hero's parts morph. The One Element turns are FVS's rules' own.
      if (T) {
        var defs = el('defs', {}, svg);
        T.tiles.forEach(function (tl, m) {
          var body = tl.body;
          T.place.forEach(function (hex, k) { body = body.split('fill="' + hex + '"').join('style="fill:var(--i' + k + ')"'); });
          var sy = el('symbol', { id: 'hm-fvs-' + m, viewBox: tl.vb[0] + ' ' + tl.vb[1] + ' 100 100', overflow: 'visible' }, defs); sy.innerHTML = body;
        });
      }
      var root = el('g', { transform: 'translate(' + f((W - COLS * u) / 2) + ' 0) scale(' + u / 100 + ')' }, svg);
      var cells = [], beat = 0, t = 0, cfg = MORPH.slides[0], bgFrom, bgTo, M = MARKS.length;
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var g = el('g', {}, el('g', { transform: 'translate(' + c * 100 + ' ' + r * 100 + ')' }, root));
        cells.push({ i: cells.length, r: r, c: c, seed: (r * 5 + c * 3) % M, g: g, paths: [0, 1, 2, 3].map(function () { return el('path', {}, g); }),
          use: T ? el('use', { width: 100, height: 100 }, g) : null,
          dist: Math.hypot(r - (ROWS - 1) / 2, c - (COLS - 1) / 2), last: -1 });
      }
      function turnOf(b, r, c) {
        if (!T) return TURNS[b % TURNS.length](r, c);
        var tt = T.turns[T.rules[b % T.rules.length]]; return tt[r % tt.length][c % tt[0].length];
      }
      function palOf(b, cf) { return cf.pal === 'cycle' ? b % PALS.length : cf.pal; }
      function snap(c, b, cf) {
        var pi = palOf(b, cf), p = PALS[pi], one = cf.sheet === 'one', u9 = many(pi);
        return { m: one ? (b * 5) % M : (c.seed + b * 5) % M, turn: one ? turnOf(b, c.r, c.c) : 0, sc: cf.gap === 'open' ? .7 : 1, twist: !one,
          inks: one ? p.layers.map(rgb) : [0, 1, 2].map(function (j) { return rgb(u9[(c.i + j * 2) % u9.length]); }) };
      }
      function len() { return HOLD + DUR + (cfg.timing === 'wave' ? Math.hypot(ROWS / 2, COLS / 2) * STEP : 0); }
      function retarget() {
        cells.forEach(function (c) { c.from = c.to; c.to = snap(c, beat + 1, cfg); c.last = -1; });
        bgFrom = bgTo; bgTo = rgb(PALS[palOf(beat + 1, cfg)].paper);
      }
      function drawCell(c, e) {
        var A = c.from, B = c.to, pa = MARKS[A.m], pb = MARKS[B.m];
        var turn = A.turn + (((B.turn - A.turn) % 360 + 540) % 360 - 180) * e + (A.twist && B.twist ? 40 * Math.sin(Math.PI * e) * ((c.r + c.c) % 2 ? -1 : 1) : 0);
        c.g.setAttribute('transform', 'translate(50 50) rotate(' + f(turn) + ') scale(' + f(A.sc + (B.sc - A.sc) * e) + ') translate(-50 -50)');
        if (c.use) {             // at rest: FVS's own drawing of the mark's Element
          var rest = e <= 0 ? A : e >= 1 ? B : null;
          if (rest) {
            c.use.setAttribute('href', '#hm-fvs-' + rest.m); c.use.removeAttribute('display');
            for (var k2 = 0; k2 < 3; k2++) c.use.style.setProperty('--i' + k2, 'rgb(' + rest.inks[k2].join(',') + ')');
            for (var s2 = 0; s2 < 4; s2++) c.paths[s2].setAttribute('d', '');
            return;
          }
          c.use.setAttribute('display', 'none');
        }
        for (var s = 0; s < 4; s++) {
          var a = pa[s], b = pb[s], path = c.paths[s];
          if (!a && !b) { path.setAttribute('d', ''); continue; }
          a = a || closed(b); b = b || closed(a);
          var p = [], rr = [], i;
          for (i = 0; i < 8; i++) p[i] = a.p[i] + (b.p[i] - a.p[i]) * e;
          for (i = 0; i < 4; i++) rr[i] = a.r[i] + (b.r[i] - a.r[i]) * e;
          path.setAttribute('d', pathOf(p, rr));
          path.setAttribute('fill', mix(A.inks[a.k], B.inks[b.k], e));
        }
      }
      function draw() {
        bg.setAttribute('fill', mix(bgFrom, bgTo, ease(clamp((t - HOLD) / DUR))));
        for (var i = 0; i < cells.length; i++) {
          var c = cells[i], e = ease(clamp((t - HOLD - (cfg.timing === 'wave' ? c.dist * STEP : 0)) / DUR));
          if (e !== c.last) { c.last = e; drawCell(c, e); }
        }
      }
      return {
        cells: cells.length * 4,
        enter: function (i, instant) {
          var first = !cells[0].to; cfg = MORPH.slides[i];
          if (instant || first) {
            cells.forEach(function (c) { c.from = snap(c, beat, cfg); c.to = snap(c, beat + 1, cfg); c.last = -1; });
            bgFrom = rgb(PALS[palOf(beat, cfg)].paper); bgTo = rgb(PALS[palOf(beat + 1, cfg)].paper); t = 0;
          } else {                                   // the new slide is simply the next pose: morph into it now
            var half = t - HOLD > DUR / 2;
            if (half) beat++;
            cells.forEach(function (c) { if (half) c.from = c.to; c.to = snap(c, beat + 1, cfg); c.last = -1; });
            if (half) bgFrom = bgTo; bgTo = rgb(PALS[palOf(beat + 1, cfg)].paper); t = HOLD - 200;
          }
        },
        step: function (ms) { t += ms; while (t >= len()) { t -= len(); beat++; retarget(); } draw(); },
        reroll: function () { beat += 3; cells.forEach(function (c) { c.from = c.to; c.to = snap(c, beat + 1, cfg); c.last = -1; }); bgFrom = bgTo; t = HOLD - 60; },
        palette: function () { return palOf(beat + 1, cfg); },
      };
    },
  };

  /* ═════════ E · the dot score ═════════
     A lattice of pale discs. Each column carries runs: a run is a style
     (disc, disc + point, ring, target, point) in up to three inks. On every
     beat the runs grow, shrink or change style, from the bottom row up. */
  var STYLES = { empty: [0, 0, 0], big: [.54, 0, 0], bigdot: [.54, 0, .07], ring: [.36, .22, .1], target: [.54, .34, .14], dot: [0, 0, .17], tiny: [0, 0, .07] };
  var RICH = ['big', 'big', 'bigdot', 'target', 'ring', 'big', 'empty'], POOR = ['empty', 'empty', 'empty', 'dot', 'tiny', 'ring', 'dot'];
  var DOTS = {
    slides: [
      { title: 'Score', ms: 5000, brief: 'One disc, drawn up to three times in a cell. Each column carries runs of one style; on every beat the runs grow or shrink from the bottom up.', density: .5, pal: 0 },
      { title: 'Sparse', ms: 4500, brief: 'Fewer full columns: the points and rings carry the picture.', density: .25, pal: 1 },
      { title: 'Dense', ms: 5500, brief: 'Most columns are full, so the discs join into bars.', density: .8, pal: 2 },
      { title: 'Runs', ms: 5000, brief: 'The same score in a fourth palette, with up to nine inks.', density: .55, pal: 3 },
      { title: 'Colourway', ms: 5000, brief: 'The score keeps its runs while the palette changes on every beat.', density: .55, pal: 'cycle' },
    ],
    build: function (svg, W, H, M, O) {        // O.overlap: while a disc changes it swells past its cell over its neighbours, then settles
      var OV = !!(O && O.overlap), sdefs = OV ? el('defs', {}, svg) : null, stripeOf = {}, SUID = 'hds' + Math.floor(Math.random() * 1e6);
      function stripes(hex) {                         // the ink with stripes of itself, darker (Diego, Nov 24); in sheet space, so overlapping discs line up
        if (!stripeOf[hex]) { var id = SUID + hex.slice(1), pt = el('pattern', { id: id, patternUnits: 'userSpaceOnUse', width: f(u * 4), height: f(u * .34) }, sdefs);
          el('rect', { width: f(u * 4), height: f(u * .34), fill: hex }, pt); el('rect', { width: f(u * 4), height: f(u * .15), fill: mix(rgb(hex), [0, 0, 0], .32) }, pt); stripeOf[hex] = 'url(#' + id + ')'; }
        return stripeOf[hex];
      }
      var ROWS = 22, u = H / ROWS, COLS = Math.ceil(W / u) + 1, ox = (W - COLS * u) / 2, BEAT = 1700, DUR = 620;
      var bg = el('rect', { width: W, height: H }, svg), root = el('g', { transform: 'translate(' + f(ox) + ' 0)' }, svg);
      var cells = [], cols = [], active = [], now = 0, next = BEAT, beat = 0, cfg = DOTS.slides[0], rand = rng(7), pal = 0, inks = [], pale = '#000';
      var bgA = null, bgB = null, bgT0 = -1e9;
      // with M (the FVS model): the pale disc's size comes from the Elements' Paper layer, and FVS draws layer by layer
      // (every cell's pale disc, then every cell's outer disc, …), so a big disc overlaps its neighbours' pale discs
      var baseR = M ? M.styles.empty.layers[0].size / 2 : .46;
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var cx = f((c + .5) * u), cy = f((r + .5) * u);
        cells.push({ r: r, c: c, cx: cx, cy: cy, base: el('circle', { cx: cx, cy: cy, r: f(u * baseR) }, root),
          L: M ? [] : [0, 1, 2].map(function () { return el('circle', { cx: cx, cy: cy, r: 0 }, root); }), from: [0, '', 0, '', 0, ''], to: [0, '', 0, '', 0, ''], t0: 0, on: false,
          dist: Math.hypot(r - ROWS / 2, c - COLS / 2) });
      }
      if (M) for (var j0 = 0; j0 < 3; j0++) cells.forEach(function (c) { c.L.push(el('circle', { cx: c.cx, cy: c.cy, r: 0 }, root)); });
      var PLACE = { Outer: 0, Middle: 1, Point: 2 };
      function setPal(pi) {
        pal = pi; inks = many(pi);
        var p = rgb(PALS[pi].paper); pale = mix(p, [255, 255, 255], lum(p) < .5 ? .13 : .5);
      }
      function seg() {
        var rich = this.rich, style = (rich ? RICH : POOR)[Math.floor(rand() * 7)];
        return { len: 2 + Math.floor(rand() * 9), style: style, k: [Math.floor(rand() * 9), Math.floor(rand() * 9), Math.floor(rand() * 9)] };
      }
      function column(prev) {
        if (prev && rand() < .32) return { rich: prev.rich, segs: prev.segs.map(function (s) { return { len: s.len, style: s.style, k: s.k.slice() }; }) };
        var col = { rich: rand() < cfg.density, segs: [] }, y = 0;
        while (y < ROWS) { var s = seg.call(col); col.segs.push(s); y += s.len; }
        return col;
      }
      function stateOf(c) {
        var segs = cols[c.c].segs, y = 0, s = segs[0];
        for (var i = 0; i < segs.length; i++) { s = segs[i]; y += s.len; if (c.r < y) break; }
        var st = STYLES[s.style], n = inks.length, a = inks[s.k[0] % n], b = inks[s.k[1] % n], d = inks[s.k[2] % n];
        if (M) {                 // the style's FVS Element: each layer a circle of its saved Size, its fixed ink from the run's colourway
          var run = [a, s.style === 'target' && b === a ? pale : b, d, pale], out = [0, '', 0, '', 0, ''];
          M.styles[s.style].layers.forEach(function (l) { var j = PLACE[l.name]; if (j == null) return; out[j * 2] = l.size / 2; out[j * 2 + 1] = run[l.ink]; });
          out[6] = OV && s.style === 'big' && (s.k[0] * 7 + s.k[2] * 3 + s.len) % 10 < 5;   // some full discs (only the plain ones: no ring, no point) striped (no draw from rand: the plain score keeps its sequence)
          return out;
        }
        if (s.style === 'ring') b = pale; if (s.style === 'bigdot') d = pale; if (s.style === 'target' && b === a) b = pale;
        return [st[0], a, st[1], b, st[2], d];
      }
      function apply(delay, instant) {
        for (var i = 0; i < cells.length; i++) {
          var c = cells[i], to = stateOf(c), same = true;
          for (var j = 0; j < 7; j++) if (to[j] !== c.to[j]) same = false;
          if (same && !instant) continue;
          c.from = c.to; c.to = to;
          if (instant) { c.from = to; paint(c, 1); continue; }
          c.t0 = now + delay(c); if (!c.on) { c.on = true; active.push(c); }
          if (OV) c.L.forEach(function (n) { n.parentNode.appendChild(n); });   // the swelling disc passes over its neighbours
        }
      }
      function paint(c, p) {
        for (var j = 0; j < 3; j++) {
          var r0 = c.from[j * 2], k0 = c.from[j * 2 + 1], r1 = c.to[j * 2], k1 = c.to[j * 2 + 1], rr, col;
          if (!r0 || !r1 || k0 === k1) { rr = r0 + (r1 - r0) * p; col = r1 ? k1 : k0; }      // grow, shrink or resize in one ink
          else if (p < .5) { rr = r0 * (1 - p * 2); col = k0; }                               // a new ink: shut, then open
          else { rr = r1 * (p * 2 - 1); col = k1; }
          if (OV && p < 1) {                         // the swell (Diego, Nov 24): up to 4 × at the middle of the change, back to FVS's size at rest
            var sw = Math.sin(Math.PI * p), big = Math.max(r0, r1);
            if (k0 !== k1 && r0 && r1) { rr = r1 * p + big * 3 * sw; col = k1; }   // a new ink grows over the old one, not shut-then-open
            else rr = rr + big * 3 * sw;
          }
          c.L[j].setAttribute('r', f(rr * u)); if (col) c.L[j].setAttribute('fill', j === 0 && (p < .5 ? c.from : c.to)[6] && col.charAt(0) === '#' ? stripes(col) : col);
        }
      }
      function regenerate() { cols = []; for (var c = 0; c < COLS; c++) cols.push(column(cols[c - 1])); }
      function mutate() {
        for (var c = 0; c < COLS; c++) {
          var col = cols[c], n = col.segs.length;
          if (rand() < .45 && n > 1) {
            var i = Math.floor(rand() * (n - 1)), d = Math.floor(rand() * 9) - 4;
            d = Math.max(1 - col.segs[i].len, Math.min(col.segs[i + 1].len - 1, d));
            col.segs[i].len += d; col.segs[i + 1].len -= d;
          }
          if (rand() < .14) { var s = col.segs[Math.floor(rand() * n)]; s.style = (col.rich ? RICH : POOR)[Math.floor(rand() * 7)]; s.k[0] = Math.floor(rand() * 9); }
        }
      }
      function paper(instant) {
        var to = rgb(PALS[pal].paper);
        bgA = instant || !bgB ? to : bgB; bgB = to; bgT0 = instant ? -1e9 : now;
        if (instant) { bg.setAttribute('fill', PALS[pal].paper); cells.forEach(function (c) { c.base.setAttribute('fill', pale); }); }
      }
      var baseFrom = null;
      return {
        cells: cells.length * 4,
        enter: function (i, instant) {
          cfg = DOTS.slides[i]; baseFrom = pale;
          setPal(cfg.pal === 'cycle' ? beat % PALS.length : cfg.pal);
          regenerate(); paper(instant); apply(function (c) { return c.dist * 28; }, instant); next = now + BEAT;
        },
        step: function (ms) {
          now += ms;
          if (now >= next) {
            next = now + BEAT; beat++;
            if (cfg.pal === 'cycle') { baseFrom = pale; setPal(beat % PALS.length); paper(false); }
            mutate(); apply(function (c) { return (ROWS - c.r) * 34; }, false);
          }
          var bp = (now - bgT0) / 900;
          if (bp <= 1.05 && bgA) {
            var e = ease(clamp(bp)); bg.setAttribute('fill', mix(bgA, bgB, e));
            var pf = e < .5 ? baseFrom : pale; for (var i = 0; i < cells.length; i++) cells[i].base.setAttribute('fill', pf);
          }
          for (var a = active.length - 1; a >= 0; a--) {
            var c = active[a], p = (now - c.t0) / DUR;
            if (p <= 0) continue;
            paint(c, ease(clamp(p)));
            if (p >= 1) { c.on = false; active.splice(a, 1); }
          }
        },
        reroll: function () { regenerate(); apply(function (c) { return c.dist * 22; }, false); next = now + BEAT; },
        palette: function () { return pal; },
      };
    },
  };

  /* ═════════ F · the weave ═════════
     One square, repeated. The sheet is cut into bands; each band has a small
     repeating motif in two inks and drifts sideways one square at a time.
     On every beat a band or two closes like a pulled thread and opens on a
     new motif. A band is a handful of paths, not thousands of squares. */
  var MOTIFS = [
    function (x, y, n) { return (x + y) % 2 ? 0 : 1; },                                                        // checker
    function (x, y, n) { return (x + y) % 2 ? 0 : -1; },                                                       // open checker
    function (x, y, n) { return ((x >> 1) + (y >> 1)) % 2 ? 0 : 1; },                                          // blocks
    function (x, y, n) { var a = x % 4, b = y % 4; return (a === 1 || b === 1) && a < 3 && b < 3 ? 0 : (a === 3 && b === 3 ? 1 : -1); },   // plus
    function (x, y, n, h, P) { return x % P < P / 2 ? 0 : (y === (h >> 1) ? 1 : -1); },                        // bars with a thread
    function (x, y, n) { return n < .5 ? 0 : n < .75 ? 1 : -1; },                                              // noise
    function (x, y, n) { return n < .15 ? -1 : n < .32 ? 1 : 0; },                                             // solid with holes
    function (x, y, n) { return y % 2 ? 0 : (n < .6 ? 1 : -1); },                                              // stripes
    function (x, y, n) { return n < .2 ? 2 : (x % 3 === 0 ? 0 : -1); },                                        // warp threads
  ];
  var WEAVE = {
    slides: [
      { title: 'Weave', ms: 5000, brief: 'One square. The sheet is cut into bands, each with its own small motif in two inks, each drifting sideways one square at a time.', pal: 0 },
      { title: 'Bands', ms: 4500, brief: 'On every beat a band closes like a pulled thread and opens on a new motif.', pal: 1 },
      { title: 'Drift', ms: 5500, brief: 'The same weave in a third palette; the bands keep their own speed and direction.', pal: 2 },
      { title: 'Cloth', ms: 5000, brief: 'Up to nine inks across the sheet, two or three in any one band.', pal: 3 },
      { title: 'Colourway', ms: 5000, brief: 'Each band takes the next palette as it re-opens.', pal: 'cycle' },
    ],
    build: function (svg, W, H, T) {     // T: FVS tiles (capture-weave.mjs) — each band is then FVS's own Component, repeated
      var ROWS = 44, u = Math.ceil(H / ROWS), COLS = Math.ceil(W / u), BEAT = 1200, SHUT = 200, OPEN = 280;
      svg.setAttribute('shape-rendering', 'crispEdges');
      var defs = T ? el('defs', {}, svg) : null, uid = 'wv' + Math.floor(Math.random() * 1e6);
      var bg = el('rect', { width: W, height: H }, svg), bands = [], rand = rng(11), now = 0, next = BEAT, beat = 0, cfg = WEAVE.slides[0], pal = 0;
      var bgA = null, bgB = null, bgT0 = -1e9;
      for (var y = 0; y < ROWS;) {
        var h = Math.min(ROWS - y, 3 + Math.floor(rand() * 5));
        var outer = el('g', { transform: 'translate(0 ' + y * u + ')' }, svg), sqz = el('g', {}, outer), inner = el('g', {}, sqz);
        bands.push({ y: y, h: h, sqz: sqz, inner: inner, paths: T ? [] : [0, 1, 2].map(function () { return el('path', {}, inner); }), P: 4, speed: 0, pos: 0, off: -1, sw: -1, s: -1, n: bands.length });
        y += h;
      }
      function fill(b) {
        var inks = many(pal), P = [4, 4, 6, 8, 12][Math.floor(rand() * 5)], m = MOTIFS[Math.floor(rand() * MOTIFS.length)], noise = [], x, yy;
        for (x = 0; x < P * b.h; x++) noise.push(rand());
        var d = ['', '', ''];
        for (yy = 0; yy < b.h; yy++) for (x = 0; x < COLS + P; x++) {
          var q = m(x % P, yy, noise[(x % P) * b.h + yy], b.h, P);
          if (q >= 0) d[q] += 'M' + x + ' ' + yy + 'h1v1h-1z';
        }
        var a = Math.floor(rand() * inks.length);
        if (T) {                                     // the band as FVS draws it: the motif's Component, recoloured, repeated across
          var three = [0, 1, 2].map(function (i) { return inks[(a + i * (1 + Math.floor(rand() * 3))) % inks.length]; });
          var t = T.tiles[MOTIFS.indexOf(m) + '|' + P + '|' + Math.max(3, Math.min(7, b.h))], S = +(/width="([0-9.]+)"/.exec(t.svg)[1]);
          var body = t.svg.split(T.place[0]).join(three[0]).split(T.place[1]).join(three[1]).split(T.place[2]).join(three[2]);
          var id = uid + '-' + b.n, sym = defs.querySelector('#' + id);
          if (!sym) { sym = el('symbol', { id: id, preserveAspectRatio: 'none' }, defs); }
          var bx = t.box || [(S - P * 20) / 2, (S - b.h * 20) / 2, P * 20, b.h * 20], rowH = bx[3] / Math.max(3, Math.min(7, b.h));
          sym.setAttribute('viewBox', f(bx[0]) + ' ' + f(bx[1] + (bx[3] - rowH * b.h) / 2) + ' ' + f(bx[2]) + ' ' + f(rowH * b.h));
          sym.innerHTML = body;
          while (b.inner.firstChild) b.inner.removeChild(b.inner.firstChild);
          for (x = 0; x < COLS + P; x += P) el('use', { href: '#' + id, x: x, y: 0, width: P, height: b.h }, b.inner);
        } else
        b.paths.forEach(function (p, i) { p.setAttribute('d', d[i]); p.setAttribute('fill', inks[(a + i * (1 + Math.floor(rand() * 3))) % inks.length]); });
        b.P = P; b.speed = [0, 0, 1, -1, 2, -2, 3, -4][Math.floor(rand() * 8)]; b.pos = 0; b.off = -1;
      }
      function squeeze(b, s) {
        if (s === b.s) return; b.s = s;
        b.sqz.setAttribute('transform', 'translate(0 ' + f(b.h * u / 2) + ') scale(1 ' + f(s) + ') translate(0 ' + f(-b.h * u / 2) + ')');
      }
      function paper(instant) {
        var to = rgb(PALS[pal].paper); bgA = instant || !bgB ? to : bgB; bgB = to; bgT0 = instant ? -1e9 : now;
        if (instant) bg.setAttribute('fill', PALS[pal].paper);
      }
      return {
        cells: bands.length * 3,
        enter: function (i, instant) {
          cfg = WEAVE.slides[i]; pal = cfg.pal === 'cycle' ? beat % PALS.length : cfg.pal; paper(instant);
          bands.forEach(function (b, n) { if (instant) { fill(b); b.sw = -1; squeeze(b, 1); } else { b.sw = now + n * 80; b.done = false; } });
          next = now + BEAT;
        },
        step: function (ms) {
          now += ms;
          if (now >= next) {
            next = now + BEAT; beat++;
            if (cfg.pal === 'cycle') { pal = beat % PALS.length; paper(false); }
            for (var n = 0; n < 2; n++) { var pick = bands[Math.floor(rand() * bands.length)]; if (pick.sw < 0) { pick.sw = now; pick.done = false; } }
          }
          var bp = (now - bgT0) / 900; if (bp <= 1.05 && bgA) bg.setAttribute('fill', mix(bgA, bgB, ease(clamp(bp))));
          for (var i = 0; i < bands.length; i++) {
            var b = bands[i];
            if (b.sw >= 0 && now >= b.sw) {                 // shut, swap the motif, open
              var q = now - b.sw;
              if (q < SHUT) squeeze(b, 1 - ease(q / SHUT));
              else { if (!b.done) { fill(b); b.done = true; } if (q < SHUT + OPEN) squeeze(b, ease((q - SHUT) / OPEN)); else { squeeze(b, 1); b.sw = -1; } }
            }
            b.pos += b.speed * ms / 1000;
            var off = ((Math.floor(b.pos) % b.P) + b.P) % b.P;
            if (off !== b.off) { b.off = off; b.inner.setAttribute('transform', 'translate(' + (-off * u) + ' 0) scale(' + u + ')'); }
          }
        },
        reroll: function () { bands.forEach(function (b, n) { if (b.sw < 0) { b.sw = now + n * 45; b.done = false; } }); },
        palette: function () { return pal; },
      };
    },
  };

  /* ═════════ G · overprint ═════════
     Three inks printed one over the other, as in a riso print: each ink is
     a layer of round-capped strokes on one column lattice, and the layers
     multiply where they cross. A layer is a few numbers (lean, stroke
     length, width, offset, fade across the sheet, ink); on every beat one
     layer glides to new numbers, column by column. */
  var FADES = {
    flat: function () { return .78; },
    centre: function (x) { return .3 + .55 * (1 - Math.abs(x - .5) * 2); },
    left: function (x) { return .85 - .55 * x; },
    right: function (x) { return .3 + .55 * x; },
    edges: function (x) { return .3 + .55 * Math.abs(x - .5) * 2; },
  };
  var FADE_KEYS = Object.keys(FADES);
  function sat(c) { var mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]); return mx ? (mx - mn) / mx : 0; }
  function printInks(pi) {                       // the three most saturated colours of the palette
    var p = PALS[pi];
    return p.all.filter(function (h) { return h !== p.paper; }).map(rgb)
      .sort(function (a, b) { return sat(b) + lum(b) * .3 - (sat(a) + lum(a) * .3); }).slice(0, 3)
      .map(function (c) { var t = lum(c) < .4 ? .3 : 0; return c.map(function (v) { return v + (255 - v) * t; }); });   // riso inks are bright: lift the darkest
  }
  function printPaper(pi) {                      // inks multiply, so the paper must be light
    var p = rgb(PALS[pi].paper);
    if (lum(p) > .62) return p;
    var l = rgb(PALS[pi].lead), w = [244, 241, 236];
    return w.map(function (v, i) { return Math.round(v + (l[i] - v) * .06); });
  }
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
      { title: 'Turn', ms: 5500, pal: 3, brief: 'A half turn by a rule: Checkerboard, rows, bands. The flat ink hides it; the gradient turns over.' },
      { title: 'Re-ink', ms: 5000, pal: 2, brief: 'One block at a time takes new inks; the layout holds.' },
      { title: 'Restack', ms: 5500, pal: 0, brief: 'A band folds away and rebuilds with a new stack of blocks.' },
      { title: 'Colourway', ms: 5000, pal: 'cycle', brief: 'The same sheet, re-inked: each beat, the next palette, band by band.' },
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
          next = now + BEAT;
        },
        step: function (ms) {
          now += ms;
          if (now >= next) {
            next = now + BEAT; beat++;
            var inks = inksOf(pal), si = BANDS.slides.indexOf(cfg);
            if (si === 1) { var nr = [2, 3, 1, 0][beat % 4]; setRule(nr === rule ? [2, 3, 1, 0][(beat + 1) % 4] : nr, true); }   // never the rule already there: that beat would stand still
            else if (si === 2) for (var k = 0; k < 3; k++) { var band = bands[Math.floor(rand() * NB)], b = band.blocks[Math.floor(rand() * band.blocks.length)]; reink(b, inks, k * 160); }
            else if (si === 3) restack(bands[Math.floor(rand() * NB)], 0);
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

  /* ═════════ B · Windows (after a 'Sports design' pin, Nov 24, 2026 — inspired by it, not a copy) ═════════
     Four long ellipses stacked on a dark ground, each a window cut into one to three panels, each panel a
     texture: a big flat ink, a check, a comb, square dots, blocks, stripes, a ladder of inks — mostly cream
     and black, the flats in colour. Below the middle, a barcode of bars; small checks pin the windows at the
     seams; a coil of tilted ovals rides in two windows. Beats: windows slide like drawers, panels flip like
     a split-flap board, windows swap places, the palette turns. */
  var WIN_UID = 0;
  var WINDOWS = {
    slides: [
      { title: 'Windows', ms: 5000, pal: 1, brief: 'Long windows on a dark ground, each cut into panels: big flat inks, checks, combs, dots, blocks.' },
      { title: 'Drawers', ms: 5500, pal: 1, brief: 'On each beat a window slides sideways like a drawer; the barcode shows behind it.' },
      { title: 'Flip', ms: 5500, pal: 3, brief: 'Panels flip like a split-flap board: each closes on its middle line and opens on a new texture.' },
      { title: 'Swap', ms: 5000, pal: 2, brief: 'Two windows trade places, one passing over the other.' },
      { title: 'Colourway', ms: 5000, pal: 'cycle', brief: 'The same windows, re-inked: each beat, the next palette, flipped panel by panel.' },
    ],
    build: function (svg, W, H, FV) {          // FV (capture-windows.mjs): every texture is an FVS Component, one repeat of it tiled as a pattern
      var FT = FV && FV.tiles ? FV.tiles : null;
      var uid = 'hw' + (++WIN_UID), pid = 0, rand = rng(41), now = 0, BEAT = 1600, DUR = 900, next = BEAT, beat = 0, cfg = WINDOWS.slides[0], pal = 1;
      // the layout follows the format: two windows a row on a landscape stage, one in portrait (IG 4:5, 9:16), every
      // window 2.35 : 1, as many rows as fit (landscape 16:10 → 2 × 3, exactly as before)
      var WC = W / H >= 1.2 ? 2 : 1, ww = W * (WC === 2 ? .44 : .84), wh = ww / 2.35, WR = Math.max(2, Math.floor(H * .96 / (wh * 1.02))), R = WC * WR, s = wh / 11, coilAmp = 0, coilTo = 0, phase = 0;
      var SLOTY = [], BASEX = []; for (var sk = 0; sk < R; sk++) { SLOTY.push(H * .02 + H * .96 / WR * (Math.floor(sk / WC) + .5)); BASEX.push(W * ((WC === 2 ? (sk % 2 ? .735 : .265) : .5) + [-.025, .02, .03, -.02, -.015, .025][sk % 6])); }
      var defs = el('defs', {}, svg), ground = el('rect', { width: W, height: H }, svg);
      var roles = rolesOf(pal), bgFrom = null, bgT0 = -1e9;

      function hexMix(h, to, t) { var a = rgb(h), b = rgb(to); return '#' + [0, 1, 2].map(function (k) { return ('0' + Math.round(a[k] + (b[k] - a[k]) * t).toString(16)).slice(-2); }).join(''); }
      function rolesOf(pi) {                          // D the ground, L the cream, C the colours — all from the palette
        var p = PALS[pi], all = p.all.concat([p.paper]).filter(function (h, i, a) { return a.indexOf(h) === i; });
        var by = all.slice().sort(function (x, y) { return lum(rgb(x)) - lum(rgb(y)); }), D = by[0], L = by[by.length - 1];
        var C = all.filter(function (h) { return h !== D && h !== L && lum(rgb(h)) - lum(rgb(D)) > .15 && lum(rgb(L)) - lum(rgb(h)) > .08; });   // a colour must read on the ground and on the cream
        if (lum(rgb(D)) > .3) D = hexMix(D, '#141414', .75);   // no dark in the palette: its darkest ink, deepened
        L = hexMix(L, '#fff8ec', lum(rgb(L)) < .7 ? .6 : .35);  // the light leans to cream, as in the reference
        return { D: D, L: L, C: C.length ? C : [hexMix(D, L, .5)] };
      }
      function ink(role, rr) { return role === 'D' ? rr.D : role === 'L' ? rr.L : rr.C[role % rr.C.length]; }
      function pattern(spec, rr) {                    // a texture → a fill (a flat ink, or a <pattern> in the window's own space)
        var a = ink(spec.a, rr), b = spec.b == null ? null : ink(spec.b, rr), k = spec.kind, w, h, kids = [];
        if (k === 'flat') return { fill: a, pat: null };
        function r(x, y, w2, h2, c) { kids.push([x, y, w2, h2, c]); }
        if (k === 'check') { var c = s * .8; w = h = 2 * c; r(0, 0, w, h, a); r(0, 0, c, c, b); r(c, c, c, c, b); }
        else if (k === 'hstripe') { w = s * 4; h = s * 1.1; r(0, 0, w, h, a); r(0, 0, w, h * .45, b); }
        else if (k === 'comb') { w = s * 1.3; h = s * 4; r(0, 0, w, h, a); r(0, 0, w * .48, h, b); }
        else if (k === 'dots') { w = h = s * 1.8; r(0, 0, w, h, a); r(w * .4, h * .4, s * .32, s * .32, b); }
        else if (k === 'blocks') { var n = 6, cc = s * 1.5, q = rng(spec.seed); w = h = n * cc; r(0, 0, w, h, a); for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (q() < .5) r(i * cc, j * cc, cc, cc, b); }
        else if (k === 'ladder') { var st = s * .8; w = s; h = st * rr.C.length; r(0, 0, w, h, rr.D); rr.C.forEach(function (col, m) { r(0, m * st, w, st * .55, col); }); }
        var id = uid + 'p' + (++pid), pat = el('pattern', { id: id, patternUnits: 'userSpaceOnUse', width: f(w), height: f(h), x: f(-ww / 2), y: f(-wh / 2) }, defs);
        var tk = FT && FT[[k, k === 'ladder' ? rr.D : a, k === 'ladder' ? '' : b, k === 'blocks' ? 1 + spec.seed % 4 : 0].join('|').toLowerCase()];
        if (tk) { pat.setAttribute('viewBox', tk.vb.join(' ')); pat.setAttribute('preserveAspectRatio', 'none'); pat.innerHTML = tk.body; return { fill: 'url(#' + id + ')', pat: pat }; }   // FVS draws the repeat
        kids.forEach(function (q2) { el('rect', { x: f(q2[0]), y: f(q2[1]), width: f(q2[2]), height: f(q2[3]), fill: q2[4] }, pat); });
        return { fill: 'url(#' + id + ')', pat: pat };
      }
      function pickTex(avoid) {                       // mostly big colour flats and cream / black textures
        var k, guard = 0;
        do { var u0 = rand(); k = u0 < .38 ? 'flat' : u0 < .52 ? 'dots' : u0 < .66 ? 'check' : u0 < .76 ? 'blocks' : u0 < .88 ? 'comb' : u0 < .94 ? 'hstripe' : 'ladder'; } while (k === avoid && ++guard < 9);
        var ci = Math.floor(rand() * 6), dl = rand() < .5 ? ['D', 'L'] : ['L', 'D'];
        if (k === 'flat') return { kind: k, a: ci };
        if (k === 'dots') return { kind: k, a: rand() < .6 ? ci : 'L', b: 'D' };
        if (k === 'comb') return { kind: k, a: rand() < .5 ? ci : 'L', b: 'D' };
        return { kind: k, a: dl[0], b: dl[1], seed: 1 + Math.floor(rand() * 1e6) };
      }
      function cuts() { var u0 = rand(); if (u0 < .2) return [0, 1]; if (u0 < .75) return [0, .35 + rand() * .3, 1]; var c1 = .2 + rand() * .2, c2 = c1 + .22 + rand() * (.8 - c1 - .22); return [0, c1, c2, 1]; }

      // the barcode, below the middle: rows of bars, each its own rhythm, drifting slowly (drawn twice, so it wraps)
      var BY0 = H * .5, BY1 = H * .93, NR = 4, rhB = (BY1 - BY0) / NR, bars = el('g', {}, svg), rows = [];
      for (var bi = 0; bi < NR; bi++) {
        var rg = el('g', {}, bars), x = 0, list = [], qq = rng(100 + bi);
        while (x < W) { var bw = s * [.3, .5, .8][Math.floor(qq() * 3)], gp = s * [.35, .6, 1][Math.floor(qq() * 3)]; list.push([x, Math.min(bw, W - x)]); x += bw + gp; }
        [0, W].forEach(function (dx) { list.forEach(function (b) { el('rect', { x: f(b[0] + dx), y: f(BY0 + bi * rhB), width: f(b[1]), height: f(rhB + .5) }, rg); }); });
        rows.push({ g: rg, off: qq() * W, v: (5 + qq() * 9) * (bi % 2 ? 1 : -1) });
      }
      // the windows, each drawn around (0, 0) and placed by its own transform: slide, swap and open are transforms
      var wins = [], winG = el('g', {}, svg);
      for (var wi = 0; wi < R; wi++) (function (i) {
        var cid = uid + 'c' + i, cp = el('clipPath', { id: cid }, defs); el('ellipse', { rx: f(ww / 2), ry: f(wh / 2) }, cp);
        var g = el('g', {}, winG), halo = el('ellipse', { rx: f(ww / 2 + s * .5), ry: f(wh / 2 + s * .5) }, g), inner = el('g', { 'clip-path': 'url(#' + cid + ')' }, g), segG = el('g', {}, inner);
        var w = { i: i, slot: i, g: g, halo: halo, segG: segG, x: BASEX[i], y: SLOTY[i], fx: 0, tx: 0, xt0: -1e9, fy: 0, ty: 0, yt0: -1e9, ot0: -1e9, open: 1, edges: [0, 1], segs: [] };
        w.fx = w.tx = w.x; w.fy = w.ty = w.y;
        if (i % 3 === 0 || i % 5 === 4) {             // a coil of tilted ovals, a dotted line behind it
          var dl = el('g', {}, inner); for (var dx = -ww / 2 + s * 2; dx < ww / 2 - s * 2; dx += s * 1.4) el('rect', { x: f(dx), y: f(-s * .14), width: f(s * .28), height: f(s * .28) }, dl);
          var cg = el('g', {}, inner), nOv = 3 + Math.floor(rand() * 3), rx = wh * .1, ov = [];
          var ovT = FT && FT['oval|#000000||0'];
          if (ovT && !defs.querySelector('#' + uid + 'oval')) { var osy = el('symbol', { id: uid + 'oval', viewBox: ovT.vb.join(' '), preserveAspectRatio: 'none' }, defs); osy.innerHTML = ovT.body.split('fill="#000000"').join('fill="currentColor"'); }
          for (var o = 0; o < nOv; o++) { var ocx = (o - (nOv - 1) / 2) * rx * 1.9;
            ov.push(ovT ? el('use', { href: '#' + uid + 'oval', x: f(ocx - rx), y: f(-wh * .36), width: f(rx * 2), height: f(wh * .72), 'data-cx': f(ocx) }, cg)   // FVS's Circle, stretched as its look would
                        : el('ellipse', { cx: f(ocx), cy: 0, rx: f(rx), ry: f(wh * .36), 'data-cx': f(ocx) }, cg)); }
          w.dash = dl; w.coil = { g: cg, ov: ov, x: ww * (rand() - .5) * .3 };
          cg.setAttribute('transform', 'translate(' + f(w.coil.x) + ' 0)');
        }
        wins.push(w);
      })(wi);
      // the seam pins: a 2 × 2 check where each window meets the one above it (rows two and three)
      var pins = [], c2 = wh * .13;
      for (var pk = WC; pk < R; pk++) { var pg = el('g', {}, svg); pins.push({ g: pg, slot: pk, r: [[0, 0, 'D'], [c2, 0, 'L'], [0, c2, 'L'], [c2, c2, 'D']].map(function (q) { return el('rect', { x: f(q[0] - c2), y: f(q[1] - c2), width: f(c2 + .3), height: f(c2 + .3), 'data-r': q[2] }, pg); }) }); }
      // confetti dashes at the foot
      var foot = el('g', {}, svg), feet = [];
      for (var fx = s * 2, fk = 0; fx < W - s * 2; fx += s * 3.6, fk++) feet.push(el('rect', { x: f(fx), y: f(H * .955), width: f(s * 1.8), height: f(s * .4) }, foot));

      function drop(l) { if (l) { l.rect.remove(); if (l.pat) l.pat.remove(); } }
      function layer(seg, spec) { var p = pattern(spec, roles), rect = el('rect', { y: f(-wh / 2), height: f(wh), fill: p.fill }, seg.w.segG); return { rect: rect, pat: p.pat }; }
      function place(seg) {
        var e = seg.w.edges, xa = -ww / 2 + ww * e[seg.j], xb = -ww / 2 + ww * e[seg.j + 1];
        seg.cur.rect.setAttribute('x', f(xa)); seg.cur.rect.setAttribute('width', f(xb - xa + .6));
      }
      function fillWin(w, animate, delay) {
        w.segs.forEach(function (sg) { drop(sg.cur); }); w.segs = []; w.edges = cuts();
        var prevK = null;
        for (var j = 0; j < w.edges.length - 1; j++) { var spec = pickTex(w.edges.length === 2 ? 'blocks' : prevK); prevK = spec.kind; var sg = { w: w, j: j, spec: spec, flip: null }; sg.cur = layer(sg, spec); place(sg); w.segs.push(sg); }
        w.ot0 = animate ? now + (delay || 0) : -1e9; w.open = animate ? 0 : 1;
      }
      function flip(sg, spec, delay) { sg.flip = { t0: now + (delay || 0), spec: spec, done: false }; }
      function setFlip(sg, k) { var h = wh * Math.max(.001, k); sg.cur.rect.setAttribute('y', f(-h / 2)); sg.cur.rect.setAttribute('height', f(h)); }
      function recolour(animate) {                    // every role re-read from the palette: the panels flip, the rest fades
        roles = rolesOf(pal);
        wins.forEach(function (w) { w.segs.forEach(function (sg, j) {
          if (animate) flip(sg, sg.spec, w.slot * 200 + j * 110); else { drop(sg.cur); sg.cur = layer(sg, sg.spec); place(sg); }
        }); });
        bgFrom = { D: ground.getAttribute('fill') || roles.D, L: bars.getAttribute('fill') || roles.L }; bgT0 = animate ? now : -1e9; paintBG(animate ? 0 : 1);
      }
      var pinPats = {};
      function pinPattern() {                         // FVS: the seam pin is the Check Component (D and cream), one repeat over the pin
        var key = (roles.L + roles.D).toLowerCase(), t = FT['check|' + roles.L.toLowerCase() + '|' + roles.D.toLowerCase() + '|0'];
        if (!t) return null;
        if (!pinPats[key]) { var id = uid + 'pin' + (++pid), pt = el('pattern', { id: id, patternUnits: 'userSpaceOnUse', x: f(-c2), y: f(-c2), width: f(2 * c2), height: f(2 * c2), viewBox: t.vb.join(' '), preserveAspectRatio: 'none' }, defs); pt.innerHTML = t.body; pinPats[key] = 'url(#' + id + ')'; }
        return pinPats[key];
      }
      function paintBG(e) {
        var D = bgFrom && e < 1 ? hexMix(bgFrom.D, roles.D, e) : roles.D, L = bgFrom && e < 1 ? hexMix(bgFrom.L, roles.L, e) : roles.L;
        ground.setAttribute('fill', D); bars.setAttribute('fill', L);
        wins.forEach(function (w) { w.halo.setAttribute('fill', D); if (w.coil) { w.coil.g.setAttribute('fill', D); w.coil.g.setAttribute('color', D); } if (w.dash) w.dash.setAttribute('fill', L); });
        var pinFill = FT && pinPattern();
        pins.forEach(function (p) { p.r.forEach(function (r) { r.setAttribute('fill', pinFill || (r.getAttribute('data-r') === 'D' ? D : L)); }); });
        feet.forEach(function (r, k) { r.setAttribute('fill', roles.C[k % roles.C.length]); });
      }
      function bySlot(k) { for (var m = 0; m < R; m++) if (wins[m].slot === k) return wins[m]; }
      function drawer(w, delay) { w.fx = w.x; w.tx = BASEX[w.slot] + (rand() - .5) * W * .12; w.xt0 = now + (delay || 0); }
      function swap(k, k2) {                          // the windows in slots k and k2 trade places; the second passes in front
        var a = bySlot(k), b = bySlot(k2); a.slot = k2; b.slot = k;
        [a, b].forEach(function (w) { w.fy = w.y; w.ty = SLOTY[w.slot]; w.yt0 = now; w.fx = w.x; w.tx = BASEX[w.slot]; w.xt0 = now; });
        winG.appendChild(b.g);
      }
      wins.forEach(function (w) { fillWin(w, false); });
      recolour(false);

      return {
        cells: wins.reduce(function (a, w) { return a + w.segs.length; }, 0),
        enter: function (i, instant) {
          cfg = WINDOWS.slides[i]; var p0 = pal; pal = cfg.pal === 'cycle' ? (beat + 1) % PALS.length : cfg.pal;
          coilTo = i === 1 || i === 3 ? 1 : 0; if (instant) coilAmp = coilTo;
          if (i === 0) {
            roles = rolesOf(pal);
            wins.forEach(function (w) { w.slot = w.i; w.x = w.fx = w.tx = BASEX[w.i]; w.y = w.fy = w.ty = SLOTY[w.i]; w.xt0 = w.yt0 = -1e9; winG.appendChild(w.g); });
            wins.forEach(function (w, k) { fillWin(w, !instant, k * 200); }); bgFrom = null; paintBG(1);
          } else if (pal !== p0) recolour(!instant);
          next = now + BEAT;
        },
        step: function (ms) {
          now += ms;
          if (now >= next) {
            next = now + BEAT; beat++;
            var si = WINDOWS.slides.indexOf(cfg);
            if (si === 1) { drawer(wins[Math.floor(rand() * R)], 0); if (rand() < .5) drawer(wins[Math.floor(rand() * R)], 180); }
            else if (si === 2) { var w2 = bySlot(beat % R); w2.segs.forEach(function (sg, j) { flip(sg, pickTex(sg.spec.kind), j * 140); }); }
            else if (si === 3) { var k3 = Math.floor(rand() * R), k4 = WC === 2 && rand() < .5 ? k3 ^ 1 : (k3 + WC) % R; swap(k3, k4); }   // a neighbour across, or in the next row
            else if (si === 4) { pal = (pal + 1) % PALS.length; recolour(true); }
          }
          coilAmp += (coilTo - coilAmp) * Math.min(1, ms / 700); phase += ms * .003;
          var dt = ms / 1000;
          rows.forEach(function (r) { r.off = ((r.off + r.v * dt) % W + W) % W; r.g.setAttribute('transform', 'translate(' + f(-r.off) + ' 0)'); });
          if (bgT0 > -1e9) { var eb = (now - bgT0) / DUR; if (eb <= 1.05) paintBG(ease(clamp(eb))); }
          wins.forEach(function (w) {
            var eo = (now - w.ot0) / (DUR * 1.2); if (eo >= 0 && eo <= 1.05) w.open = ease(clamp(eo)); else if (eo < 0) w.open = 0;
            var ex = (now - w.xt0) / (DUR * 1.3); if (ex >= 0 && ex <= 1.05) w.x = w.fx + (w.tx - w.fx) * ease(clamp(ex));
            var ey = (now - w.yt0) / (DUR * 1.4); if (ey >= 0 && ey <= 1.05) w.y = w.fy + (w.ty - w.fy) * ease(clamp(ey));
            var k = Math.round(w.open * 1000) / 1000 || .001;
            w.g.setAttribute('transform', 'translate(' + f(w.x) + ' ' + f(w.y) + ')' + (k < 1 ? ' scale(' + k + ' 1)' : ''));
            w.segs.forEach(function (sg) {
              if (!sg.flip) return;
              var ef = (now - sg.flip.t0) / DUR; if (ef < 0) return;
              if (ef >= .5 && !sg.flip.done) { sg.flip.done = true; drop(sg.cur); sg.spec = sg.flip.spec; sg.cur = layer(sg, sg.spec); place(sg); }
              setFlip(sg, Math.abs(1 - 2 * ease(clamp(ef))));
              if (ef >= 1) { setFlip(sg, 1); sg.flip = null; }
            });
            if (w.coil) w.coil.ov.forEach(function (o, m) { o.setAttribute('transform', 'rotate(' + f(22 + 24 * coilAmp * Math.sin(phase - m * .8)) + ' ' + o.getAttribute('data-cx') + ' 0)'); });
          });
          pins.forEach(function (p) {                 // on the seam above the window in its slot, over that window's first cut
            var w = bySlot(p.slot), cx = w.edges.length > 2 ? -ww / 2 + ww * w.edges[1] : 0;
            p.g.setAttribute('transform', 'translate(' + f(w.x + cx) + ' ' + f(w.y - wh / 2) + ')');
          });
        },
        reroll: function () { var w = wins[Math.floor(rand() * R)]; w.segs.forEach(function (sg, j) { flip(sg, pickTex(sg.spec.kind), j * 140); }); },
        palette: function () { return pal; },
      };
    },
  };

  /* ═════════ H · Stacks (after a Jerry-Lee Bosmans print, Nov 24, 2026 — inspired by it, not a copy) ═════════
     Columns of capsules, each a round top on a straight body, stacked like a deck: every capsule covers the
     body of the one above it, so what shows of each is a crescent band. The spacing breathes along the
     column — tight runs read as thin arcs, loose runs as fat ones. Beats: the squeeze travels down the
     columns, columns melt into a smooth gradient of their own inks, columns scroll like belts, the palette
     washes down. */
  var STK_UID = 0;
  var STACKS = {
    slides: [
      { title: 'Stacks', ms: 2500, pal: 3, brief: 'Columns of round-topped capsules, stacked like a deck: each covers the one above, leaving a crescent band.' },
      { title: 'Squeeze', ms: 5500, pal: 3, brief: 'The spacing breathes and the squeeze travels down every column, each at its own phase.' },
      { title: 'Blend', ms: 5500, pal: 2, brief: 'On each beat a few columns melt into a smooth gradient of their own inks, and others come back.' },
      { title: 'Belts', ms: 5000, pal: 0, brief: 'Every column runs like a belt, up or down, at its own speed.' },
      { title: 'Colourway', ms: 5000, pal: 'cycle', brief: 'Each beat the next palette washes down the columns, capsule by capsule.' },
    ],
    build: function (svg, W, H, FV) {          // FV (capture-stacks.mjs): every capsule is FVS's own drawing of its Element in its ink
      var uid = 'hk' + (++STK_UID), rand = rng(57), now = 0, BEAT = 1600, DUR = 900, next = BEAT, beat = 0, cfg = STACKS.slides[0], pal = 3;
      var cw = H * .14, NC = Math.max(6, Math.round(W / cw)); cw = W / NC; var r = cw / 2, K = Math.ceil((H + 3 * cw) / (.28 * cw)) + 2;
      var squeeze = 0, squeezeTo = 0, belt = 0, beltTo = 0;
      var defs = el('defs', {}, svg), bg = el('rect', { width: W, height: H }, svg), cols = [];
      var inksOld = null, inks = HL.inks(pal, 9), washT0 = -1e9;
      var CAP = 'M0 ' + f(r) + 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(cw + .4) + ' ' + f(r) + 'V' + f(r + cw * 1.25) + 'H0Z';
      var symOf = {};                                 // FVS: one <symbol> per ink hex (its Linear Shading is a function of the hex alone)
      if (FV && FV.tiles) Object.keys(FV.tiles).forEach(function (pk) { Object.keys(FV.tiles[pk]).forEach(function (h) {
        if (symOf[h]) return; var id = uid + 's' + h.slice(1), sy = el('symbol', { id: id, viewBox: '21.5 0 57 100', preserveAspectRatio: 'none', overflow: 'visible' }, defs);
        sy.innerHTML = FV.tiles[pk][h].replace(/id="([^"]+)"/g, 'id="' + id + '$1"').replace(/url\(#([^)]+)\)/g, 'url(#' + id + '$1)'); symOf[h] = id; }); });
      var FVON = Object.keys(symOf).length > 0;
      function sp(c, g) { var v = .52 + .4 * Math.sin(g * .42 + c.ph); return cw * (v < .1 ? .1 : v > 1.1 ? 1.1 : v); }   // the spacing after capsule g
      function shuffle(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); for (var j = n - 1; j > 0; j--) { var k = Math.floor(rand() * (j + 1)), t = a[j]; a[j] = a[k]; a[k] = t; } return a; }
      for (var ci = 0; ci < NC; ci++) (function (c) {
        var cid = uid + 'c' + c, cp = el('clipPath', { id: cid }, defs), clip = el('rect', { x: f(c * cw), y: 0, width: f(cw + .5), height: f(H) }, cp);
        var g = el('g', { 'clip-path': 'url(#' + cid + ')' }, svg), caps = el('g', { transform: 'translate(' + f(c * cw) + ' 0)' }, g), pool = [];
        if (FVON) for (var ju = 0; ju < K; ju++) pool.push(el('use', { width: f(cw + .4), height: f(cw * 100 / 57) }, caps));   // FVS: the capsule Element, its ink's Linear Shading
        else for (var j = 0; j < K; j++) {                 // each capsule its own Linear gradient: its ink at the top, its tint where the next one covers it
          var lid = uid + 'l' + c + '-' + j, lg = el('linearGradient', { id: lid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: f(r + cw * .5) }, defs);
          var pth = el('path', { d: CAP, fill: 'url(#' + lid + ')' }, caps); pth._lg = lg; pth._s0 = el('stop', { offset: 0 }, lg); pth._s1 = el('stop', { offset: 1 }, lg); pool.push(pth);
        }
        var gid = uid + 'g' + c, grad = el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: f(H) }, defs), stops = [];
        for (var m = 0; m < K; m++) stops.push(el('stop', { offset: 0 }, grad));
        var blendR = el('rect', { x: f(c * cw), width: f(cw + .5), height: f(H), fill: 'url(#' + gid + ')', opacity: 0 }, g);
        cols.push({ c: c, clip: clip, pool: pool, stops: stops, blendR: blendR, ph: rand() * 6.3, seq: shuffle(9), g0: 0, head: -cw * (.5 + rand()), v: (rand() < .5 ? -1 : 1) * cw * (.5 + rand() * 1.1), blend: 0, bFrom: 0, bTo: 0, bt0: -1e9, rt0: -1e9, open: 1 });
      })(ci);
      function inkAt(c, g, y) {                       // the capsule's ink; during a wash, the old palette below the wave front
        var n = c.seq.length, i = c.seq[((g % n) + n) % n], front = (now - washT0) * (H / 1100) - c.c * cw * .35;
        return inksOld && y > front ? inksOld[i % inksOld.length] : inks[i % inks.length];
      }
      function lay(c) {                               // walk the column from its head down, placing capsules until the bottom
        while (c.head > -cw * .6) { c.g0--; c.head -= sp(c, c.g0); }
        while (c.head + sp(c, c.g0) < -cw * .6) { c.head += sp(c, c.g0); c.g0++; }
        var y = c.head, j = 0, blending = c.blend > .001;
        for (; j < K && y < H + 2; j++) {
          var g = c.g0 + j, col = inkAt(c, g, y), p = c.pool[j];
          var spg = sp(c, g); p.setAttribute('transform', 'translate(0 ' + f(y) + ')');
          if (FVON) { if (p._c !== col) { p._c = col; p.setAttribute('href', '#' + symOf[String(col).toLowerCase()]); } }
          else { p._lg.setAttribute('y2', f(r + spg)); }
          if (!FVON && p._c !== col) { p._c = col; p._s0.setAttribute('stop-color', col); p._s1.setAttribute('stop-color', tintOf(col)); } if (p._h) { p.removeAttribute('display'); p._h = false; }
          if (blending) { c.stops[j].setAttribute('offset', clamp((y + r) / H).toFixed(4)); c.stops[j].setAttribute('stop-color', col); }
          y += spg;
        }
        for (var q = j; q < K; q++) { var p2 = c.pool[q]; if (!p2._h) { p2.setAttribute('display', 'none'); p2._h = true; } if (blending) c.stops[q].setAttribute('offset', 1); }
      }
      var tints = {};
      function tintOf(h) { return tints[h] || (tints[h] = mix(rgb(h), [255, 255, 255], .5)); }   // the ink half way to white
      function setBlend(c, to, delay) { c.bFrom = c.blend; c.bTo = to; c.bt0 = now + (delay || 0); }
      function wash(pi, animate) { inksOld = animate ? inks : null; inks = HL.inks(pi, 9); washT0 = animate ? now : -1e9; bg.setAttribute('fill', PALS[pi].paper); }
      wash(pal, false);
      return {
        cells: NC * K,
        enter: function (i, instant) {
          cfg = STACKS.slides[i]; var p0 = pal; pal = cfg.pal === 'cycle' ? (beat + 1) % PALS.length : cfg.pal;
          squeezeTo = i === 1 ? 1 : i === 3 ? .25 : 0; beltTo = i === 3 ? 1 : 0;
          if (instant) { squeeze = squeezeTo; belt = beltTo; }
          if (i !== 2) cols.forEach(function (c) { if (c.bTo) setBlend(c, 0, instant ? -1e9 : 0); });
          if (i === 0) cols.forEach(function (c, k) { c.rt0 = instant ? -1e9 : now + k * 70; c.open = instant ? 1 : 0; });
          if (pal !== p0) wash(pal, !instant);
          next = now + BEAT;
        },
        step: function (ms) {
          now += ms;
          if (now >= next) {
            next = now + BEAT; beat++;
            var si = STACKS.slides.indexOf(cfg);
            if (si === 2) for (var k = 0; k < 3; k++) { var c0 = cols[Math.floor(rand() * NC)]; setBlend(c0, c0.bTo ? 0 : 1, k * 160); }
            else if (si === 4) { pal = (pal + 1) % PALS.length; wash(pal, true); }
          }
          var dt = ms / 1000;
          squeeze += (squeezeTo - squeeze) * Math.min(1, ms / 700); belt += (beltTo - belt) * Math.min(1, ms / 700);
          if (inksOld && (now - washT0) * (H / 1100) > H + NC * cw * .35 + cw) inksOld = null;
          cols.forEach(function (c) {
            c.ph -= dt * 1.7 * squeeze;              // the phase runs against the index: the squeeze travels down
            c.head += c.v * belt * dt;
            var eb = (now - c.bt0) / DUR; if (eb >= 0 && eb <= 1.05) c.blend = c.bFrom + (c.bTo - c.bFrom) * ease(clamp(eb));
            c.blendR.setAttribute('opacity', c.blend.toFixed(3));
            var eo = (now - c.rt0) / (DUR * 1.3); if (eo >= 0 && eo <= 1.05) c.open = ease(clamp(eo)); else if (eo < 0) c.open = 0;
            c.clip.setAttribute('height', f(H * c.open));
            lay(c);
          });
        },
        reroll: function () { cols.forEach(function (c) { c.seq = shuffle(9); }); },
        palette: function () { return pal; },
      };
    },
  };

  var STACKS_MODEL = null;
  function loadStacksModel(url) { return fetch(url).then(function (r) { return r.json(); }).then(function (j) { STACKS_MODEL = j; return j; }); }
  var STACKSFVS = {
    slides: STACKS.slides.map(function (s) { var o = {}; for (var k in s) o[k] = s[k]; o.brief = s.brief + ' Every capsule is FVS\u2019s Element (a Square rounded on top) in its ink, with the ink\u2019s Linear Shading.'; return o; }),
    build: function (svg, W, H) { return STACKS.build(svg, W, H, STACKS_MODEL); },
  };

  var WINDOWS_MODEL = null;
  function loadWindowsModel(url) { return fetch(url).then(function (r) { return r.json(); }).then(function (j) { WINDOWS_MODEL = j; return j; }); }
  var WINDOWSFVS = {
    slides: WINDOWS.slides.map(function (s) { var o = {}; for (var k in s) o[k] = s[k]; o.brief = s.brief + ' Every texture is an FVS Component, one repeat of it tiled; the coil\u2019s ovals are an FVS Circle.'; return o; }),
    build: function (svg, W, H) { return WINDOWS.build(svg, W, H, WINDOWS_MODEL); },
  };

  var PRINT_UID = 0;
  var PRINT = {
    slides: [
      { title: 'Overprint', ms: 5500, pal: 0, brief: 'Three inks, one over the other, as in a riso print. Where two cross, the colours multiply into a third.',
        layers: [{ dx: 0, s: 1, w: .42, off: 0, fade: 'centre' }, { dx: 1, s: .85, w: .34, off: 0, fade: 'right' }, { dx: 1, s: .55, w: .3, off: .5, fade: 'flat' }] },
      { title: 'Lean', ms: 5000, pal: 1, brief: 'Every layer leans its own way. One layer changes at a time; the others hold.',
        layers: [{ dx: -1, s: 1.1, w: .4, off: .25, fade: 'left' }, { dx: 1, s: 1.1, w: .4, off: 0, fade: 'right' }, { dx: 0, s: 1, w: .3, off: .5, fade: 'centre' }] },
      { title: 'Columns', ms: 5000, pal: 2, brief: 'All three upright, slid by half a column, fading in different directions.',
        layers: [{ dx: 0, s: 1, w: .55, off: 0, fade: 'left' }, { dx: 0, s: 1, w: .55, off: .5, fade: 'right' }, { dx: 0, s: .6, w: .3, off: .25, fade: 'edges' }] },
      { title: 'Stitch', ms: 5500, pal: 3, brief: 'Short strokes, like stitches: the same three numbers per layer, smaller.',
        layers: [{ dx: .5, s: .55, w: .3, off: 0, fade: 'flat' }, { dx: -.5, s: .55, w: .3, off: .5, fade: 'centre' }, { dx: 0, s: 1, w: .2, off: .25, fade: 'edges' }] },
      { title: 'Colourway', ms: 5000, pal: 'cycle', brief: 'The same print, re-inked: each beat, the next palette.',
        layers: [{ dx: 0, s: 1, w: .42, off: 0, fade: 'centre' }, { dx: 1, s: .85, w: .34, off: 0, fade: 'right' }, { dx: 1, s: .55, w: .3, off: .5, fade: 'flat' }] },
    ],
    build: function (svg, W, H, FV) {
      var M = Math.round(Math.min(W, H) * .06), ih = H - 2 * M, iw = W - 2 * M, R = 9;
      var pitch = Math.min(ih / 7, iw / 7), pad = pitch * .55, COLS = Math.max(6, Math.floor((iw - 2 * pad) / pitch - 1.5) + 1);
      pitch = (iw - 2 * pad) / (COLS - 1 + 1.5);
      var left = M + pad + pitch * .25, top = M + pad, rowStep = (ih - 2 * pad) / R, BEAT = 1600, DUR = 1100, CST = 45;
      var outer = el('rect', { width: W, height: H }, svg), sheet = el('rect', { x: M, y: M, width: iw, height: ih, rx: f(M * .45) }, svg);
      var ink = el('g', { style: 'isolation:isolate' }, svg), rand = rng(5), now = 0, next = BEAT, beat = 0, turn = 0, cfg = PRINT.slides[0], pal = 0;
      var bgA = null, bgB = null, bgT0 = -1e9;
      // FV (capture-print.mjs): FVS's drawing of every pose (a Segment Element in the cell's Rectangle box), valid when
      // this stage's cell has the reference's proportions; at rest each stroke is FVS's, tinted by the fade
      var fvOn = !!(FV && FV.tiles && Math.abs(pitch / rowStep - FV.ref.A) < .01), uid = 'hp' + (++PRINT_UID), kq = pitch / 100;
      if (fvOn) { var defs = el('defs', {}, svg);
        Object.keys(FV.tiles).forEach(function (k) { var gg = el('g', { id: uid + '-' + k.replace(/[^0-9-]/g, '_') }, defs); gg.innerHTML = FV.tiles[k].split('fill="#000000"').join('fill="currentColor"'); }); }
      var layers = [0, 1, 2].map(function (n) {
        var g = el('g', { style: 'mix-blend-mode:multiply', fill: 'none', 'stroke-linecap': 'round' }, ink);
        var cols = []; for (var c = 0; c < COLS; c++) { var col = { path: el('path', {}, g), from: null, to: null, last: -1 };
          if (fvOn) { col.fv = el('g', { display: 'none' }, g); col.uses = []; for (var j = 0; j < R; j++) col.uses.push(el('use', {}, col.fv)); }
          cols.push(col); }
        return { n: n, cols: cols, t0: -1e9 };
      });
      function spec(L, s, inks) {                  // a layer's numbers, column by column
        var fd = FADES[s.fade];
        return L.cols.map(function (c, i) { return { dx: s.dx, s: s.s, w: s.w, off: s.off, a: fd(i / (COLS - 1)), ink: inks[L.n] }; });
      }
      function set(L, s, inks, instant) {
        var to = spec(L, s, inks);
        L.cols.forEach(function (c, i) {
          // an animated first entrance (the carousel's intro) prints every stroke in from no ink; otherwise it moves from where it stands
          c.from = instant ? to[i] : !c.to ? { dx: to[i].dx, s: to[i].s, w: to[i].w, off: to[i].off, a: 0, ink: to[i].ink } : lerp(c.from, c.to, c.last < 0 ? 0 : c.last);
          c.to = to[i]; c.last = -1;
        });
        L.s = s; L.t0 = instant ? -1e9 : now;
        if (instant) L.cols.forEach(function (c) { c.from = c.to; draw(c, 1, c.to); });
      }
      function lerp(a, b, e) {
        return { dx: a.dx + (b.dx - a.dx) * e, s: a.s + (b.s - a.s) * e, w: a.w + (b.w - a.w) * e, off: a.off + (b.off - a.off) * e, a: a.a + (b.a - a.a) * e,
          ink: [0, 1, 2].map(function (k) { return a.ink[k] + (b.ink[k] - a.ink[k]) * e; }) };
      }
      function draw(c, e, v) {
        v = v || (e >= 1 ? c.to : lerp(c.from, c.to, e));   // at rest the target itself (a lerp at 1 can leave 1.1000000000000001)
        var key = fvOn && e >= 1 ? [v.dx, v.s, v.w].join('/') : null;
        if (key && FV.tiles[key]) {                // at rest: FVS draws the stroke; multiply at opacity a = the ink tinted by a
          var href = '#' + uid + '-' + key.replace(/[^0-9-]/g, '_'), x0 = left + (c.i + v.off) * pitch;
          c.uses.forEach(function (u, j) { u.setAttribute('href', href); u.setAttribute('transform', 'translate(' + f(x0) + ' ' + f(top + j * rowStep - FV.ref.Y0 * kq) + ') scale(' + f(kq * 1000) / 1000 + ')'); });
          c.fv.setAttribute('color', 'rgb(' + v.ink.map(function (x) { return Math.round(255 - v.a * (255 - x)); }).join(',') + ')');
          c.fv.removeAttribute('display'); c.path.setAttribute('d', ''); return;
        }
        if (c.fv) c.fv.setAttribute('display', 'none');
        var i = c.i, x = left + (i + v.off + Math.max(0, -v.dx)) * pitch, d = '';
        for (var j = 0; j < R; j++) {
          var ya = top + j * rowStep, yb = Math.min(top + R * rowStep, ya + v.s * rowStep), k = (yb - ya) / (v.s * rowStep || 1);
          d += 'M' + f(x) + ' ' + f(ya) + 'L' + f(x + v.dx * pitch * k) + ' ' + f(yb);
        }
        c.path.setAttribute('d', d);
        c.path.setAttribute('stroke-width', f(v.w * pitch));
        c.path.setAttribute('stroke', 'rgb(' + v.ink.map(Math.round).join(',') + ')');
        c.path.setAttribute('stroke-opacity', f(v.a));
      }
      layers.forEach(function (L) { L.cols.forEach(function (c, i) { c.i = i; }); });
      function mutate(s) {
        var o, same = true;
        // a beat always changes something: a draw that lands on the value already there is drawn again (it left a beat still)
        for (var tries = 0; same && tries < 8; tries++) {
          o = { dx: s.dx, s: s.s, w: s.w, off: s.off, fade: s.fade };
          switch (Math.floor(rand() * 4)) {
            case 0: o.dx = [0, 1, -1, .5, -.5][Math.floor(rand() * 5)]; break;
            case 1: o.s = o.dx ? [.45, .55, .85][Math.floor(rand() * 3)] : 1; o.w = [.2, .3, .38, .45][Math.floor(rand() * 4)]; break;
            case 2: o.off = [0, .25, .5][Math.floor(rand() * 3)]; break;
            default: o.fade = FADE_KEYS[Math.floor(rand() * FADE_KEYS.length)];
          }
          same = o.dx === s.dx && o.s === s.s && o.w === s.w && o.off === s.off && o.fade === s.fade;
        }
        return o;
      }
      function paper(instant) {
        var to = printPaper(pal); bgA = instant || !bgB ? to : bgB; bgB = to; bgT0 = instant ? -1e9 : now;
        if (instant) paint(1);
      }
      function paint(e) {
        sheet.setAttribute('fill', mix(bgA, bgB, e));
        outer.setAttribute('fill', mix(bgA.map(function (v) { return v * .9; }), bgB.map(function (v) { return v * .9; }), e));
      }
      return {
        cells: COLS * 3,
        enter: function (i, instant) {
          cfg = PRINT.slides[i]; pal = cfg.pal === 'cycle' ? beat % PALS.length : cfg.pal; paper(instant);
          var inks = printInks(pal);
          layers.forEach(function (L) { set(L, cfg.layers[L.n], inks, instant); });
          next = now + BEAT;
        },
        step: function (ms) {
          now += ms;
          if (now >= next) {
            next = now + BEAT; beat++;
            if (cfg.pal === 'cycle') { pal = beat % PALS.length; paper(false); var inks = printInks(pal); layers.forEach(function (L) { set(L, L.s, inks, false); }); }
            else { var L = layers[turn++ % 3]; set(L, mutate(L.s), printInks(pal), false); }
          }
          var bp = (now - bgT0) / 900; if (bp <= 1.05 && bgA) paint(ease(clamp(bp)));
          layers.forEach(function (L) {
            if (now - L.t0 > DUR + COLS * CST + 50) return;
            L.cols.forEach(function (c, i) {
              var e = ease(clamp((now - L.t0 - i * CST) / DUR));
              if (e !== c.last) { c.last = e; draw(c, e); }
            });
          });
        },
        reroll: function () { var inks = printInks(pal); layers.forEach(function (L) { set(L, mutate(mutate(L.s)), inks, false); }); next = now + BEAT; },
        palette: function () { return pal; },
      };
    },
  };

  // F · Weave made with FVS: the same Weave, step for step (same random sequence, bands, speeds, inks), but every band is
  // FVS's own Component of that motif (capture-weave.mjs); the noise of a motif is fixed per motif × period × height.
  var WEAVE_TILES = null;
  var WEAVEFVS = {
    slides: WEAVE.slides.map(function (s) { return { title: s.title, ms: s.ms, pal: s.pal, brief: s.brief + ' Every band is an FVS Component: one square Element, a P × h grid, each cell inked or empty.' }; }),
    build: function (svg, W, H) { return WEAVE.build(svg, W, H, WEAVE_TILES); },
  };
  function loadWeaveTiles(url) {
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) { WEAVE_TILES = j; return j; });
  }
  // E · Dot score made with FVS: the same score, step for step (same random sequence, runs, inks), but every style is
  // read from FVS's own Element of it — a stack of circle layers, each its saved Size and fixed ink (capture-dots.mjs) —
  // and drawn layer by layer as FVS draws. The hero animates those layers' sizes and inks.
  var DOTS_MODEL = null;
  var DOTSFVS = {
    slides: DOTS.slides.map(function (s) { return { title: s.title, ms: s.ms, density: s.density, pal: s.pal, brief: s.brief + ' Every style is an FVS Element: circle layers, each its own Size and ink.' }; }),
    build: function (svg, W, H) { return DOTS.build(svg, W, H, DOTS_MODEL); },
  };
  var DOTSFVSOV = {
    slides: DOTS.slides.map(function (s) { return { title: s.title, ms: s.ms, density: s.density, pal: s.pal, brief: s.brief + ' While a disc changes it swells past its cell and overlaps its neighbours, then settles back to its FVS Element.' }; }),
    build: function (svg, W, H) { return DOTS.build(svg, W, H, DOTS_MODEL, { overlap: true }); },
  };
  function loadDotsModel(url) {
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) { DOTS_MODEL = j; return j; });
  }
  // D · Morph sheet made with FVS: the same sheet, step for step, but every mark at rest is FVS's own drawing of its
  // Element (capture-morph.mjs: each part a layer of an FVS shape, checked against the hero's outline), and the One
  // Element slides turn the cells by FVS's own rules (Radial, Checkerboard, Step turn, Uniform). The morph in between
  // is the hero's: FVS has no morph.
  var MORPH_MODEL = null;
  var MORPHFVS = {
    slides: MORPH.slides.map(function (s) { var o = {}; for (var k in s) o[k] = s[k]; o.brief = s.brief + ' At rest every mark is an FVS Element; the turns are FVS rules.'; return o; }),
    build: function (svg, W, H) { return MORPH.build(svg, W, H, MORPH_MODEL); },
  };
  // G · Overprint made with FVS: the same print, step for step, but every stroke at rest is FVS's own drawing of its
  // pose (capture-print.mjs: a Segment Element, Round ends, in the cell's Rectangle box; all 240 poses the print can
  // reach), each column tinted by its fade (multiply at opacity a = multiply by the ink mixed toward white by a). In FVS
  // the inks are Components (Blend → Multiply) and each slide a Symbol of the three stacked (Overlap → Multiply).
  var PRINT_MODEL = null;
  var PRINTFVS = {
    slides: PRINT.slides.map(function (s) { var o = {}; for (var k in s) o[k] = s[k]; o.brief = s.brief + ' At rest every stroke is an FVS Element; each ink an FVS Component set to Multiply.'; return o; }),
    build: function (svg, W, H) { return PRINT.build(svg, W, H, PRINT_MODEL); },
  };
  function loadPrintModel(url) {
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) { PRINT_MODEL = j; return j; });
  }
  function loadMorphModel(url) {
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) { MORPH_MODEL = j; return j; });
  }
  var KINDS = { bandsfvs: BANDSFVS, windowsfvs: WINDOWSFVS, morphfvs: MORPHFVS, dotsfvsov: DOTSFVSOV, weavefvs: WEAVEFVS, printfvs: PRINTFVS, stacksfvs: STACKSFVS };

  // ═════════ the mount: clock, slides, life ═════════
  function mount(host, opts) {
    opts = opts || {};
    var K = KINDS[opts.kind] || MORPH, slides = K.slides, n = slides.length;
    var still = !!opts.still || matchMedia('(prefers-reduced-motion: reduce)').matches;
    var svg = el('svg', { 'aria-hidden': 'true' }); svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    var word = document.createElement('div'); word.className = 'hloop__word';
    host.appendChild(svg); if (opts.label !== false) host.appendChild(word);
    var cur = Math.max(0, Math.min(n - 1, opts.start || 0)), tS = 0, paused = false, vis = true, dead = false, view = null, prev = 0, wordT = 0, size = '';
    var meter = { dt: [], js: [] }, built = false;

    function label() {
      var p = PALS[view ? view.palette() : 0];
      word.textContent = slides[cur].title; word.style.background = p.lead; word.style.color = p.paper;
      word.classList.add('is-on'); wordT = 2600;
    }
    function build() {
      var W = host.clientWidth, H = host.clientHeight; if (!W || !H || size === W + 'x' + H) return;
      size = W + 'x' + H; svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); while (svg.firstChild) svg.removeChild(svg.firstChild);
      var intro = !!opts.intro && !built && !still; built = true;   // the first build plays the slide's entrance (the carousel); a resize or an export shows it finished
      view = K.build(svg, W, H); view.enter(cur, !intro); view.step(0); label();
    }
    function show(i, instant) {
      cur = ((i % n) + n) % n; tS = 0;
      if (view) { view.enter(cur, instant || still); view.step(0); label(); }
      if (opts.onSlide) opts.onSlide(cur, { title: slides[cur].title, brief: slides[cur].brief });
    }
    function advance(ms) {
      if (!view) return;
      if (wordT > 0 && (wordT -= ms) <= 0 && !still) word.classList.remove('is-on');
      if (still) return;
      tS += ms; view.step(ms);
      if (opts.onProgress) opts.onProgress(Math.min(1, tS / slides[cur].ms));
      if (!opts.lock && tS >= slides[cur].ms) show(cur + 1);
    }
    var raf = 0;
    function tick(now) {
      if (dead) return;
      if (paused || !vis || document.hidden || still) { raf = 0; prev = 0; return; }   // asleep: no frame is requested until wake()
      raf = requestAnimationFrame(tick);
      var dt = prev ? Math.min(50, now - prev) : 0;
      if (prev) { meter.dt.push(now - prev); if (meter.dt.length > 600) meter.dt.shift(); }
      prev = now;
      var t0 = performance.now(); advance(dt); meter.js.push(performance.now() - t0); if (meter.js.length > 600) meter.js.shift();
    }
    function stats() {
      function summary(a) {
        if (!a.length) return { avg: 0, p95: 0, max: 0 };
        var s = a.slice().sort(function (x, y) { return x - y; });
        return { avg: a.reduce(function (x, y) { return x + y; }, 0) / a.length, p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] };
      }
      var out = { frame: summary(meter.dt), js: summary(meter.js), cells: view ? view.cells : 0, moving: 0 };
      meter = { dt: [], js: [] }; return out;
    }
    var ro = new ResizeObserver(build), io = new IntersectionObserver(function (e) { vis = e[e.length - 1].isIntersecting; prev = 0; wake(); });
    function wake() { if (!dead && !raf && !paused && vis && !still && !document.hidden) raf = requestAnimationFrame(tick); }
    function onVis() { prev = 0; wake(); }
    ro.observe(host); io.observe(host); document.addEventListener('visibilitychange', onVis);
    build(); if (opts.onSlide) opts.onSlide(cur, { title: slides[cur].title, brief: slides[cur].brief });
    wake();
    return {
      go: function (i) { show(i); }, next: function () { show(cur + 1); }, prev: function () { show(cur - 1); },
      reroll: function () { if (view && view.reroll && !still) view.reroll(); },
      pause: function (b) { paused = !!b; prev = 0; wake(); }, stats: stats, advance: advance,
      stop: function () { dead = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); svg.remove(); word.remove(); },
    };
  }

  // hand a model over once it is fetched (shared/hero.js fetches it next to the scripts)
  function setModel(name, j) {
    if (name === 'weave') WEAVE_TILES = j; else if (name === 'dots') DOTS_MODEL = j; else if (name === 'morph') MORPH_MODEL = j;
    else if (name === 'print') PRINT_MODEL = j; else if (name === 'stacks') STACKS_MODEL = j; else if (name === 'windows') WINDOWS_MODEL = j;
  }
  window.Organica.heroSheets = { mount: mount, setModel: setModel, KINDS: KINDS, loadWeaveTiles: loadWeaveTiles, loadDotsModel: loadDotsModel, loadMorphModel: loadMorphModel, loadPrintModel: loadPrintModel, loadStacksModel: loadStacksModel, loadWindowsModel: loadWindowsModel };
})();
