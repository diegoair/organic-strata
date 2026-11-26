/* ═══════════════════════════════════════════════════════════
   H · Stacks — one home-hero loop for Organica.heroPlayer (shared/hero-player.js).
   Its slides are data (title, ms, pal, brief, and the loop's own fields); its engine is
   build(svg, W, H) → { enter(i, instant), step(ms), reroll(), palette() }. Split out of
   shared/hero-sheets.js on Nov 26, 2026 (backlog 2.1), code unchanged.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var P = window.Organica.heroPlayer, U = P.util, NS = U.NS, HL = U.HL, PALS = U.PALS;
  var el = U.el, rng = U.rng, f = U.f, clamp = U.clamp, ease = U.ease, rgb = U.rgb, mix = U.mix, lum = U.lum, many = U.many;

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
      { title: 'Squeeze', ms: 4400, pal: 3, brief: 'The spacing breathes and the squeeze travels down every column, each at its own phase.' },
      { title: 'Blend', ms: 4400, pal: 2, brief: 'On each beat a few columns melt into a smooth gradient of their own inks, and others come back.' },
      { title: 'Belts', ms: 4000, pal: 0, brief: 'Every column runs like a belt, up or down, at its own speed.' },
      { title: 'Colourway', ms: 4000, pal: 'cycle', brief: 'Each beat the next palette washes down the columns, capsule by capsule.' },
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

  P.define('stacksfvs', STACKSFVS, { slot: 'stacks', set: function (j) { STACKS_MODEL = j; } });
})();
