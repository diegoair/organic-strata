/* ═══════════════════════════════════════════════════════════
   E · Dot score — one home-hero loop for Organica.heroPlayer (shared/hero-player.js).
   Its slides are data (title, ms, pal, brief, and the loop's own fields); its engine is
   build(svg, W, H) → { enter(i, instant), step(ms), reroll(), palette() }. Split out of
   shared/hero-sheets.js on Nov 26, 2026 (backlog 2.1), code unchanged.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var P = window.Organica.heroPlayer, U = P.util, NS = U.NS, HL = U.HL, PALS = U.PALS;
  var el = U.el, rng = U.rng, f = U.f, clamp = U.clamp, ease = U.ease, rgb = U.rgb, mix = U.mix, lum = U.lum, many = U.many;

  /* ═════════ E · the dot score ═════════
     A lattice of pale discs. Each column carries runs: a run is a style
     (disc, disc + point, ring, target, point) in up to three inks. On every
     beat the runs grow, shrink or change style, from the bottom row up. */
  var STYLES = { empty: [0, 0, 0], big: [.54, 0, 0], bigdot: [.54, 0, .07], ring: [.36, .22, .1], target: [.54, .34, .14], dot: [0, 0, .17], tiny: [0, 0, .07] };
  var RICH = ['big', 'big', 'bigdot', 'target', 'ring', 'big', 'empty'], POOR = ['empty', 'empty', 'empty', 'dot', 'tiny', 'ring', 'dot'];
  var DOTS_UID = 0;
  var DOTS = {
    slides: [
      { title: 'Score', ms: 4000, brief: 'One disc, drawn up to three times in a cell. Each column carries runs of one style; on every beat the runs grow or shrink from the bottom up.', density: .5, pal: 0 },
      { title: 'Sparse', ms: 3600, brief: 'Fewer full columns: the points and rings carry the picture.', density: .25, pal: 1 },
      { title: 'Dense', ms: 4400, brief: 'Most columns are full, so the discs join into bars.', density: .8, pal: 2 },
      { title: 'Runs', ms: 4000, brief: 'The same score in a fourth palette, with up to nine inks.', density: .55, pal: 3 },
      { title: 'Colourway', ms: 4000, brief: 'The score keeps its runs while the palette changes on every beat.', density: .55, pal: 'cycle' },
    ],
    build: function (svg, W, H, M, O) {        // O.overlap: while a disc changes it swells past its cell over its neighbours, then settles
      var OV = !!(O && O.overlap), sdefs = OV ? el('defs', {}, svg) : null, stripeOf = {}, SUID = 'hds' + (++DOTS_UID);   // a counter, as the other loops: the same ids every run
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
          if (i === 0) { rand = rng(7); beat = 0; }   // the wrap (backlog 2.2): the same draws and beats every cycle — seamless
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

  P.define('dotsfvsov', DOTSFVSOV, { slot: 'dots', set: function (j) { DOTS_MODEL = j; } });
})();
