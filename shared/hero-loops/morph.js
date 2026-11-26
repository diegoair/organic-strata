/* ═══════════════════════════════════════════════════════════
   D · Morph sheet — one home-hero loop for Organica.heroPlayer (shared/hero-player.js).
   Its slides are data (title, ms, pal, brief, and the loop's own fields); its engine is
   build(svg, W, H) → { enter(i, instant), step(ms), reroll(), palette() }. Split out of
   shared/hero-sheets.js on Nov 26, 2026 (backlog 2.1), code unchanged.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var P = window.Organica.heroPlayer, U = P.util, NS = U.NS, HL = U.HL, PALS = U.PALS;
  var el = U.el, rng = U.rng, f = U.f, clamp = U.clamp, ease = U.ease, rgb = U.rgb, mix = U.mix, lum = U.lum, many = U.many;

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
      { title: 'Specimen', ms: 4000, brief: 'A sheet of marks, each made of up to four parts. They hold a pose, then every part glides to its place in the next mark.', sheet: 'specimen', timing: 'together', gap: 'open', pal: 0 },
      { title: 'In a wave', ms: 4400, brief: 'The same sheet, but the change starts in the centre and travels out, cell by cell.', sheet: 'specimen', timing: 'wave', gap: 'open', pal: 1 },
      { title: 'One Element', ms: 4000, brief: 'One mark in every cell. A rule turns each cell; on every beat the mark and the rule change together.', sheet: 'one', timing: 'together', gap: 'tight', pal: 2 },
      { title: 'Four rules', ms: 4400, brief: 'One mark, four rules in turn (Radial, Checkerboard, Pinwheel, Identity), passed across the sheet as a wave.', sheet: 'one', timing: 'wave', gap: 'open', pal: 3 },
      { title: 'Colourway', ms: 4000, brief: 'The sheet keeps morphing while the palette changes on every beat.', sheet: 'specimen', timing: 'together', gap: 'open', pal: 'cycle' },
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
          } else if (i === 0) {                      // the wrap (backlog 2.2): morph back to the first pose and count the beats
            var half0 = t - HOLD > DUR / 2;          // from 0 again, so every cycle is the same cycle — seamless by construction
            cells.forEach(function (c) { if (half0) c.from = c.to; c.to = snap(c, 0, cfg); c.last = -1; });
            if (half0) bgFrom = bgTo; bgTo = rgb(PALS[palOf(0, cfg)].paper); beat = -1; t = HOLD - 200;
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

  // D · Morph sheet made with FVS: the same sheet, step for step, but every mark at rest is FVS's own drawing of its
  // Element (capture-morph.mjs: each part a layer of an FVS shape, checked against the hero's outline), and the One
  // Element slides turn the cells by FVS's own rules (Radial, Checkerboard, Step turn, Uniform). The morph in between
  // is the hero's: FVS has no morph.
  var MORPH_MODEL = null;
  var MORPHFVS = {
    slides: MORPH.slides.map(function (s) { var o = {}; for (var k in s) o[k] = s[k]; o.brief = s.brief + ' At rest every mark is an FVS Element; the turns are FVS rules.'; return o; }),
    build: function (svg, W, H) { return MORPH.build(svg, W, H, MORPH_MODEL); },
  };
  function loadMorphModel(url) {
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) { MORPH_MODEL = j; return j; });
  }

  P.define('morphfvs', MORPHFVS, { slot: 'morph', set: function (j) { MORPH_MODEL = j; } });
})();
