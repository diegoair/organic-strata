/* ═══════════════════════════════════════════════════════════
   F · Weave — one home-hero loop for Organica.heroPlayer (shared/hero-player.js).
   Its slides are data (title, ms, pal, brief, and the loop's own fields); its engine is
   build(svg, W, H) → { enter(i, instant), step(ms), reroll(), palette() }. Split out of
   shared/hero-sheets.js on Nov 26, 2026 (backlog 2.1), code unchanged.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var P = window.Organica.heroPlayer, U = P.util, NS = U.NS, HL = U.HL, PALS = U.PALS;
  var el = U.el, rng = U.rng, f = U.f, clamp = U.clamp, ease = U.ease, rgb = U.rgb, mix = U.mix, lum = U.lum, many = U.many;

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
  var WEAVE_UID = 0;
  var WEAVE = {
    slides: [
      { title: 'Weave', ms: 4000, brief: 'One square. The sheet is cut into bands, each with its own small motif in two inks, each drifting sideways one square at a time.', pal: 0 },
      { title: 'Bands', ms: 3600, brief: 'On every beat a band closes like a pulled thread and opens on a new motif.', pal: 1 },
      { title: 'Drift', ms: 4400, brief: 'The same weave in a third palette; the bands keep their own speed and direction.', pal: 2 },
      { title: 'Cloth', ms: 4000, brief: 'Up to nine inks across the sheet, two or three in any one band.', pal: 3 },
      { title: 'Colourway', ms: 4000, brief: 'Each band takes the next palette as it re-opens.', pal: 'cycle' },
    ],
    build: function (svg, W, H, T) {     // T: FVS tiles (capture-weave.mjs) — each band is then FVS's own Component, repeated
      var ROWS = 44, u = Math.ceil(H / ROWS), COLS = Math.ceil(W / u), BEAT = 1200, SHUT = 200, OPEN = 280;
      svg.setAttribute('shape-rendering', 'crispEdges');
      var defs = T ? el('defs', {}, svg) : null, uid = 'wv' + (++WEAVE_UID);
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
          if (i === 0) { rand = rng(11); beat = 0; }   // the wrap (backlog 2.2): the same draws and beats every cycle; every band refills — seamless
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

  P.define('weavefvs', WEAVEFVS, { slot: 'weave', set: function (j) { WEAVE_TILES = j; } });
})();
