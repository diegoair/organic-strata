/* ─────────────────────────────────────────────────────────────
   Organica.heroLoop — the home hero as ONE Flexible Visual System that
   runs. Loop C · The score of the home hero, and the four content
   palettes every hero loop uses (shared/hero-sheets.js reads them).
   Loaded on demand by shared/hero.js; came from explorations/home-mockups.

   One lattice of cells that never unmounts. A slide is a STATE of that
   lattice (Element · rule · inks · words); a transition is the next
   state reaching the cells one by one (a wave, a line, a scatter) —
   never a crossfade. A camera looks at the lattice: 35 cells across
   for the slides that spell words, 12 across for the others.

   Three transition sets over the same five slides (opts.concept):
     A  One sheet    no camera; the big cells are 3 × 3 blocks that
                     subdivide and merge
     B  Powers       every transition pushes into a cell or pulls back
     C  The score    waves and one line, one pull-back, ONE zoom (4 → 5)

   Organica.heroLoop.mount(host, opts) → { go(i), next(), prev(), reroll(x, y),
                                  pause(bool), stats(), stop() }
     opts.concept   'A' | 'B' | 'C'            (default 'C')
     opts.element   the opening Element, a key of HeroLoop.OPENERS
     opts.start     first slide, 0-based
     opts.lock      true → stay on the slide (no auto-advance)
     opts.still     true → the settled picture of the slide, nothing moves
                    (prefers-reduced-motion does the same)
     opts.label     false → no slide-title chip (.hloop__word); the home passes false
     opts.onSlide(i, info)  opts.onProgress(p 0..1)

   Inline SVG, one requestAnimationFrame clock (so it pauses, and a tab
   that is hidden or a hero that is off screen costs nothing). The haze
   is one SVG filter over the cells that have not arrived.
   Colours are content: four TuneSutra palettes, by house number.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', UID = 0;
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function mk(tag, attrs, parent) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  var E = {
    io: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    in2: function (t) { return t * t; },
    in3: function (t) { return t * t * t; },
    out3: function (t) { return 1 - Math.pow(1 - t, 3); },
    back: function (t) { var c = 1.3; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };

  // ── colour: four palettes saved in TuneSutra (Diego, Nov 23, 2026), by house number.
  //    layers = an Element's inks back → front · lead = the ink of a one-ink Element · mark = the ink of the words
  var PALETTES = [
    { name: 'Vivid yellow, softer', house: 902, paper: '#000000', layers: ['#bababa', '#fff23f', '#6a3387'], lead: '#fff23f', mark: '#67c3b7',
      all: ['#bababa', '#fff23f', '#6a3387', '#67c3b7'] },
    { name: 'Black',                house: 907, paper: '#1a1a1a', layers: ['#b189c1', '#000000', '#fff200'], lead: '#fff200', mark: '#b189c1',
      all: ['#b189c1', '#000000', '#fff200', '#1a439b'] },
    { name: 'Bright red',           house: 910, paper: '#fba79d', layers: ['#f9dfe2', '#fb6759', '#e5000d'], lead: '#f9dfe2', mark: '#e5000d',
      all: ['#f9dfe2', '#fb6759', '#e5000d', '#fdd9cd'] },
    { name: 'Carmine',              house: 971, paper: '#9ec5dc', layers: ['#230838', '#78aecc', '#e5000d'], lead: '#230838', mark: '#e5000d',
      all: ['#230838', '#78aecc', '#e5000d', '#d4e4ee', '#c20063', '#326b67'] },
  ];
  // an Element of 4–9 layers takes every colour of the palette (`all`), then their tints: each colour half way to the
  // paper, then towards white — nine inks. A STAND-IN for the palette's own TuneSutra tints (open question for Diego).
  function mixHex(a, b, t) { var x = rgb(a), y = rgb(b); return '#' + [0, 1, 2].map(function (i) { return ('0' + Math.round(lerp(x[i], y[i], t)).toString(16)).slice(-2); }).join(''); }
  PALETTES.forEach(function (p) {
    p.nine = p.all.concat(p.all.map(function (h) { return mixHex(h, p.paper, 0.5); }), p.all.map(function (h) { return mixHex(h, '#ffffff', 0.45); })).slice(0, 9);
  });
  function inks(pi, n) { var p = PALETTES[pi]; return n > 3 ? p.nine : n > 1 ? p.layers : [p.lead]; }

  // ── the Elements, in FVS's 0..100 cell box, layers back → front
  var ELEMENTS = {
    leaf:    ['M0 0A100 100 0 0 1 100 100A100 100 0 0 1 0 0Z', 'M22 22A56 56 0 0 1 78 78A56 56 0 0 1 22 22Z', 'M80 30A10 10 0 1 0 60 30A10 10 0 1 0 80 30Z'],
    terrace: ['M0 0H100V100H0Z', 'M0 0H67V67H0Z', 'M0 0H34V34H0Z'],
    arch:    ['M0 100A50 50 0 0 1 100 100H75A25 25 0 0 0 25 100Z', 'M34 100A16 16 0 0 1 66 100Z', 'M58 24A8 8 0 1 0 42 24A8 8 0 1 0 58 24Z'],
    eclipse: ['M50 2A48 48 0 1 1 50 98A48 48 0 1 1 50 2Z', 'M64 4A32 32 0 1 1 64 68A32 32 0 1 1 64 4Z', 'M30 66A8 8 0 1 0 14 66A8 8 0 1 0 30 66Z'],
    three:   ['M0 0H100A100 100 0 0 1 0 100Z', 'M72 0A72 72 0 0 1 0 72V42A42 42 0 0 0 42 0Z', 'M95 80A15 15 0 1 0 65 80A15 15 0 1 0 95 80ZM30 20A10 10 0 1 0 10 20A10 10 0 1 0 30 20Z'],
    // illustrative · a flower growing out of one corner (four close a full bloom under Radial) — 9 layers
    bloom:   ['M0 0H96A96 96 0 0 1 0 96Z',
              'M22.2 9.2A34 15 22.5 1 0 85 35.2A34 15 22.5 1 0 22.2 9.2ZM9.2 22.2A34 15 67.5 1 0 35.2 85A34 15 67.5 1 0 9.2 22.2Z',
              'M14.2 14.2A30 14 45 1 0 56.6 56.6A30 14 45 1 0 14.2 14.2Z',
              'M35.1 14.5A20 5 22.5 1 0 72.1 29.9A20 5 22.5 1 0 35.1 14.5ZM14.5 35.1A20 5 67.5 1 0 29.9 72.1A20 5 67.5 1 0 14.5 35.1Z',
              'M0 0H30A30 30 0 0 1 0 30Z', 'M0 0H16A16 16 0 0 1 0 16Z',
              'M24 9A3 3 0 1 0 18 9A3 3 0 1 0 24 9ZM12 21A3 3 0 1 0 6 21A3 3 0 1 0 12 21ZM20 17A3 3 0 1 0 14 17A3 3 0 1 0 20 17Z',
              'M100 60A45 45 0 0 1 60 100A45 45 0 0 1 100 60Z', 'M96 90A6 6 0 1 0 84 90A6 6 0 1 0 96 90Z'],
    // illustrative · a small landscape in every cell: sky, sun, two hills, a house, its roof, its door, a tree — 8 layers
    scene:   ['M0 0H100V100H0Z', 'M88 30A18 18 0 1 0 52 30A18 18 0 1 0 88 30Z', 'M0 68C20 48 40 48 60 62C75 72 88 60 100 52V100H0Z',
              'M0 88C25 72 50 76 100 82V100H0Z', 'M16 60H40V86H16Z', 'M11 61L28 43L45 61Z', 'M25 71H32V86H25Z',
              'M91 66A9 9 0 1 0 73 66A9 9 0 1 0 91 66ZM80.5 72H83.5V86H80.5Z'],
    // abstract · discs, bands, a bar, a square: nine primitives stacked off one corner — 9 layers
    strata:  ['M0 0H100A100 100 0 0 1 0 100Z', 'M78 0A78 78 0 0 1 0 78V60A60 60 0 0 0 60 0Z', 'M0 0H44A44 44 0 0 1 0 44Z',
              'M30 0A30 30 0 0 1 0 30V20A20 20 0 0 0 20 0Z', 'M66 66H100V100H66Z', 'M100 78A22 22 0 0 0 78 100H100Z',
              'M40 100L100 40V52L52 100Z', 'M16 9A7 7 0 1 0 2 9A7 7 0 1 0 16 9Z', 'M100 0V22L78 0Z'],
    ring:    ['M100 0A100 100 0 0 1 0 100V50A50 50 0 0 0 50 0Z'],
    tri:     ['M-.4 -.4H100.4L-.4 100.4Z'],          // a hair over the box: no seam between neighbours
    dot:     ['M50 12A38 38 0 1 1 50 88A38 38 0 1 1 50 12Z'],
    blob:    ['M50 3A47 47 0 1 1 50 97A47 47 0 1 1 50 3Z'],
  };
  var OPENERS = { leaf: 'Layered leaf', terrace: 'Terrace', arch: 'Arch', eclipse: 'Eclipse', three: 'Three layers', bloom: 'Bloom \u00b7 illustrative', scene: 'Landscape \u00b7 illustrative', strata: 'Strata \u00b7 abstract' };

  var RULES = {
    radial:    function (r, c) { return [[180, 270], [90, 0]][r % 2][c % 2]; },
    checker:   function (r, c) { return (r + c) % 2 ? 180 : 0; },
    checker90: function (r, c) { return (r + c) % 2 ? 90 : 0; },
    pinwheel:  function (r, c) { return ((r % 2) * 2 + (c % 2)) * 90; },
    identity:  function () { return 0; },
  };
  var RULE_NAME = { radial: 'Radial', checker: 'Checkerboard', checker90: 'Checkerboard', pinwheel: 'Pinwheel', identity: 'Identity' };
  var S1R = ['radial', 'checker90', 'pinwheel'], S2R = ['radial', 'checker', 'pinwheel', 'identity'];
  var S3R = ['checker', 'pinwheel', 'radial'], S4R = ['radial', 'pinwheel', 'checker90'], S5P = [3, 2, 1, 0];

  // a 3 × 5 cell alphabet (only the letters the slides spell)
  var GLYPH = {
    F: '####..##.#..#..', L: '#..#..#..#..###', E: '####..##.#..###', X: '#.##.#.#.#.##.#', I: '###.#..#..#.###',
    B: '##.#.###.#.###.', V: '#.##.##.##.#.#.', S: '####..###..####', U: '#.##.##.##.####', A: '####.#####.##.#',
    Y: '#.##.#.#..#..#.', T: '###.#..#..#..#.', M: '#.########.##.#', R: '##.#.###.#.##.#', D: '##.#.##.##.###.', W: '#.##.########.#',
  };

  var SLIDES = [
    { title: 'Arrival', dur: 8000 },
    { title: 'Four rules', dur: 7500 },
    { title: 'The words obey', dur: 7500 },
    { title: 'The words disobey', dur: 8500 },
    { title: 'Colourway', dur: 8000 },
  ];

  function mount(host, opts) {
    opts = opts || {};
    var concept = /^[ABC]$/.test(opts.concept) ? opts.concept : 'C';
    // opts.fvs (capture-score.mjs): every cell is FVS's own drawing of its Element (a <symbol>, its inks as CSS
    // variables), and the rules turn the cells as FVS's rules do. Without it, the hero's own paths and rules.
    var FVS = opts.fvs && opts.fvs.tiles ? opts.fvs : null;
    var RN = FVS ? { radial: 'Radial', checker: 'Checkerboard', checker90: 'Checkerboard', pinwheel: 'Step turn', identity: 'Uniform' } : RULE_NAME;   // FVS's words for its rules
    function turn(name, r, c) { if (!FVS) return RULES[name](r, c); var t = FVS.turns[name]; return t[r % t.length][c % t[0].length]; }
    var opener = OPENERS[opts.element] ? opts.element : 'leaf';
    var instant = !!opts.still || REDUCED, lock = !!opts.lock || instant;
    var uid = 'hloop' + (++UID);
    var W, H, u, VW, VH, COLS, ROWS, CX, CY, cells = [], mask3, mask4;
    var svg, gCam, gHaze, gSharp, paperEl, wipeRect, wipeCirc, coverEl, labelEl;
    var T = 0, last = 0, raf = 0, paused = false, visible = true, dead = false;
    var tweens = [], active = [], bent = [];
    var cur = -1, slideT0 = 0, V = [0, 0, 0, 0, 0];
    var cam = { cx: 0, cy: 0, z: 1 }, shown = { cx: 0, cy: 0, z: 1 }, camMoving = false;
    var paperNow = [0, 0, 0], wipeGoal = null, ptr = null;
    var FS = PALETTES.map(function (p, i) { return { N: { fills: p.nine, fk: i + 'N' }, L: { fills: p.layers, fk: i + 'L' }, S: { fills: [p.lead], fk: i + 'S' }, M: { fills: [p.mark], fk: i + 'M' } }; });
    var meter = { dt: [], js: [] };

    // ═════════ build ═════════
    function textMask(text) {
      var lines = text.split('\n'), out = new Int16Array(COLS * ROWS).fill(-1), list = [], n = 0;
      var top = Math.round((ROWS - (lines.length * 6 - 1)) / 2);
      lines.forEach(function (line, li) {
        var left = Math.round((COLS - (line.length * 4 - 1)) / 2);
        line.split('').forEach(function (ch, ci) {
          var g = GLYPH[ch]; if (!g) return;
          for (var k = 0; k < 15; k++) if (g[k] === '#') {
            var x = left + ci * 4 + k % 3, y = top + li * 6 + ((k / 3) | 0);
            if (x >= 0 && x < COLS && y >= 0 && y < ROWS) { out[y * COLS + x] = n; list.push(cells[y * COLS + x]); }
          }
          n++;
        });
      });
      return { at: out, cells: list };
    }
    function build() {
      host.textContent = '';
      W = host.clientWidth; H = host.clientHeight;
      if (!W || !H) return false;
      u = Math.min(W / 35, H / 19); VW = W / u; VH = H / u;
      COLS = Math.ceil(VW) + 4; ROWS = Math.ceil(VH) + 4;
      COLS += COLS % 2; ROWS += ROWS % 2;                      // an even lattice: the centre is a corner four cells share
      CX = COLS / 2; CY = ROWS / 2;
      svg = mk('svg', { width: '100%', height: '100%', viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' }, null);
      svg.style.display = 'block';
      var defs = mk('defs', {}, svg);
      var f = mk('filter', { id: uid + '-haze', filterUnits: 'userSpaceOnUse', x: -200, y: -200, width: COLS * 100 + 400, height: ROWS * 100 + 400, 'color-interpolation-filters': 'sRGB' }, defs);
      mk('feGaussianBlur', { stdDeviation: 15 }, f);
      mk('feColorMatrix', { type: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8' }, f);
      if (FVS) Object.keys(FVS.tiles).forEach(function (name) {
        var tl = FVS.tiles[name], body = tl.body;
        FVS.place.forEach(function (hex, k) { body = body.split('fill="' + hex + '"').join('style="fill:var(--i' + k + ')"'); });
        var sy = mk('symbol', { id: uid + '-fvs-' + name, viewBox: tl.vb[0] + ' ' + tl.vb[1] + ' 100 100', overflow: 'visible' }, defs); sy.innerHTML = body;
      });
      paperEl = mk('rect', { width: W, height: H }, svg);
      gCam = mk('g', {}, svg);
      wipeRect = mk('rect', { y: -5000, height: ROWS * 100 + 10000, display: 'none' }, gCam);
      wipeCirc = mk('circle', { display: 'none' }, gCam);
      gHaze = mk('g', { filter: 'url(#' + uid + '-haze)' }, gCam);
      gSharp = mk('g', {}, gCam);
      coverEl = mk('rect', { width: W, height: H, opacity: 0, 'pointer-events': 'none' }, svg);
      cells = [];
      for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
        var g = mk('g', {}, gSharp);
        cells.push({ x: x, y: y, g: g, p: [], el: null, fk: '', rot: 0, sc: 1,
          haze: false, mark: false, wob: 0, bn: 0, bend: 0, inBent: false, anim: null, act: false, dirty: false, hid: false, rnd: Math.random() });
      }
      mask3 = textMask('FLEXIBLE\nVISUAL\nSYSTEM'); mask4 = textMask('RULES\nDRAW');
      host.appendChild(svg);
      labelEl = document.createElement('div'); labelEl.className = 'hloop__word'; labelEl.setAttribute('aria-hidden', 'true');
      if (opts.label !== false) host.appendChild(labelEl);
      active = []; bent = []; tweens = [];
      return true;
    }

    // ═════════ cells ═════════
    function swap(c, t) {
      var k;
      if (FVS && FVS.tiles[t.el]) {                              // FVS draws the Element; the cell sets its inks
        if (c.el !== t.el) {
          if (!c.use) { c.use = mk('use', { width: 100, height: 100 }, c.g); for (k = 0; k < c.p.length; k++) c.p[k].setAttribute('d', ''); }
          c.use.setAttribute('href', '#' + uid + '-fvs-' + t.el); c.el = t.el; c.fk = '';
        }
        if (c.fk !== t.fk) { for (k = 0; k < t.fills.length; k++) c.g.style.setProperty('--i' + k, t.fills[k]); c.fk = t.fk; }
        if (c.haze !== t.haze) { (t.haze ? gHaze : gSharp).appendChild(c.g); c.haze = t.haze; }
        c.mark = t.mark; return;
      }
      if (c.el !== t.el) {                                       // a cell holds as many paths as its richest Element so far (up to 9)
        var L = ELEMENTS[t.el]; while (c.p.length < L.length) c.p.push(mk('path', {}, c.g));
        for (k = 0; k < c.p.length; k++) c.p[k].setAttribute('d', L[k] || ''); c.el = t.el; c.fk = '';
      }
      if (c.fk !== t.fk) { for (k = 0; k < c.p.length; k++) if (t.fills[k]) c.p[k].setAttribute('fill', t.fills[k]); c.fk = t.fk; }
      if (c.haze !== t.haze) { (t.haze ? gHaze : gSharp).appendChild(c.g); c.haze = t.haze; }
      c.mark = t.mark;
    }
    function inView(c) {
      return Math.abs(c.x + 0.5 - shown.cx) < VW / (2 * shown.z) + 2.5 && Math.abs(c.y + 0.5 - shown.cy) < VH / (2 * shown.z) + 2.5;
    }
    function render(c) {
      c.dirty = false;
      if (c.sc < 0.004) { if (!c.hid) { c.g.style.display = 'none'; c.hid = true; } return; }
      if (c.hid) { c.g.style.display = ''; c.hid = false; }
      c.g.setAttribute('transform', 'translate(' + (c.x * 100 + 50) + ' ' + (c.y * 100 + 50) + ') rotate(' + (c.rot + 90 * c.bn).toFixed(2) + ') scale(' + c.sc.toFixed(3) + ') translate(-50 -50)');
    }
    function setCell(c, t) { swap(c, t); c.rot = t.rot; c.sc = t.sc; c.anim = null; render(c); }
    // 0 = waiting · 1 = running · 2 = finished
    function evalAnim(c) {
      var a = c.anim; if (!a) return 2;
      var q = (T - a.t0) / (a.t1 - a.t0);
      if (q <= 0) return 0;
      if (q >= 1) { if (a.swap && !a.done) swap(c, a.swap); c.rot = a.r1; c.sc = a.s1; c.anim = null; return 2; }
      if (a.swap) {
        var mid = a.dip * Math.max(a.s0, a.s1), v;
        if (q < 0.5) { v = E.in2(q * 2); c.rot = a.r0 + 45 * v; c.sc = lerp(a.s0, mid, v); }
        else { if (!a.done) { swap(c, a.swap); a.done = true; } v = E.out3(q * 2 - 1); c.rot = a.r1 - 45 * (1 - v); c.sc = lerp(mid, a.s1, v); }
      } else { c.rot = lerp(a.r0, a.r1, E.back(q)); c.sc = lerp(a.s0, a.s1, E.io(q)); }
      return 1;
    }
    function goCell(c, t, delay, dur) {
      if (c.anim) { evalAnim(c); c.anim = null; }
      var need = c.el !== t.el || c.fk !== t.fk || c.haze !== t.haze;
      var to = c.rot + ((((t.rot - c.rot) % 360) + 540) % 360 - 180);
      if (!need && Math.abs(to - c.rot) < 0.01 && Math.abs(t.sc - c.sc) < 0.001) return;
      c.anim = { t0: T + delay, t1: T + delay + dur, r0: c.rot, r1: to, s0: c.sc, s1: t.sc, swap: need ? t : null, done: false,
        dip: c.el === t.el && c.fk === t.fk ? 0.4 : 0 };          // only the haze changes: the mass tightens, then the shape springs out
      if (!c.act) { c.act = true; active.push(c); }
    }
    // df(c, t) → ms; < 0 = set at once (a cell that is off screen)
    function apply(sf, df, dur) {
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i], t = sf(c), d = instant ? -1 : df(c, t);
        if (d < 0) setCell(c, t); else goCell(c, t, d, dur);
      }
    }

    // ═════════ the five states ═════════
    function coarse(i) { return concept === 'A' && (i === 0 || i === 1 || i === 4); }
    function zOf(i) { return concept === 'A' ? 1 : [3, 3, 1, 1, 3][i]; }
    function palOf(i) { return i === 4 ? S5P[V[4] % 4] : i; }
    function tgt(el, f, rot, sc, haze, mark) { return { el: el, fills: f.fills, fk: f.fk, rot: rot, sc: sc, haze: !!haze, mark: !!mark }; }
    function hazy(t, k) { return { el: t.el, fills: t.fills, fk: t.fk, rot: t.rot, sc: t.sc * k, haze: true, mark: t.mark }; }
    function stateOf(i, noMark) {
      var co = coarse(i), v = V[i], f = FS[palOf(i)], n = ELEMENTS[opener].length, fo = n > 3 ? f.N : n > 1 ? f.L : f.S;
      return function (c) {
        var x = c.x, y = c.y, sc = 1;
        if (co) { sc = c.x % 3 === 1 && c.y % 3 === 1 ? 3 : 0; x = (c.x / 3) | 0; y = (c.y / 3) | 0; }
        if (i === 0) return tgt(opener, fo, turn(S1R[v % 3], y, x) + 90 * c.wob, sc);
        if (i === 1) return tgt('ring', f.S, turn(S2R[v % 4], y, x), sc);
        if (i === 2) return !noMark && mask3.at[c.y * COLS + c.x] >= 0 ? tgt('dot', f.M, 0, 1, false, true) : tgt('tri', f.S, turn(S3R[v % 3], y, x), 1);
        if (i === 3) return mask4.at[c.y * COLS + c.x] >= 0 ? tgt('blob', f.M, 0, 1, true, true) : tgt(opener, fo, turn(S4R[v % 3], y, x), 1);
        return n > 3 ? tgt(opener, f.N, turn('radial', y, x), sc) : tgt('three', f.L, turn('radial', y, x), sc);   // a 6–9 layer opener is the Colourway's figure too
      };
    }

    // ═════════ clock: tweens, camera, paper ═════════
    function tw(delay, dur, fn, ease, end) { tweens.push({ t0: T + delay, dur: dur, fn: fn, ease: ease, end: end, dead: false }); }
    function at(ms, fn) { tw(ms, 0, null, null, fn); }
    function camTo(to, delay, dur, ease) {
      var from = null;
      tw(delay, dur, function (e) {
        if (!from) from = { cx: cam.cx, cy: cam.cy, z: cam.z };
        cam.cx = lerp(from.cx, to.cx, e); cam.cy = lerp(from.cy, to.cy, e);
        cam.z = Math.exp(lerp(Math.log(from.z), Math.log(to.z), e)); camMoving = true;
      }, ease || E.io);
    }
    function paperSet(c) { paperNow = c.slice(); paperEl.setAttribute('fill', 'rgb(' + c.map(Math.round).join(',') + ')'); }
    function paperFade(hex, delay, dur) {
      var from = null, to = rgb(hex);
      tw(delay, dur, function (e) { if (!from) from = paperNow.slice(); paperSet([lerp(from[0], to[0], e), lerp(from[1], to[1], e), lerp(from[2], to[2], e)]); }, E.io);
    }
    function wipeEnd() { if (wipeGoal) paperSet(wipeGoal); wipeGoal = null; wipeRect.setAttribute('display', 'none'); wipeCirc.setAttribute('display', 'none'); }
    function wipeX(hex, v, span) {
      wipeGoal = rgb(hex); wipeRect.setAttribute('fill', hex); wipeRect.setAttribute('x', v.l * 100 - 5000); wipeRect.setAttribute('display', '');
      tw(0, span, function (e) { wipeRect.setAttribute('width', 5000 + e * v.w * 100); }, null, wipeEnd);
    }
    function wipeCircle(hex, per, rMax) {
      wipeGoal = rgb(hex); wipeCirc.setAttribute('fill', hex); wipeCirc.setAttribute('cx', CX * 100); wipeCirc.setAttribute('cy', CY * 100); wipeCirc.setAttribute('display', '');
      tw(0, per * rMax, function (e) { wipeCirc.setAttribute('r', e * rMax * 100); }, null, wipeEnd);
    }
    function label(text, p) {
      if (instant) return;
      labelEl.textContent = text; labelEl.style.background = p.paper; labelEl.style.color = p.lead; labelEl.classList.add('is-on');
      at(1700, function () { labelEl.classList.remove('is-on'); });
    }
    function view(z) { var w = VW / z, h = VH / z; return { l: CX - w / 2, t: CY - h / 2, w: w, h: h }; }
    function dDiag(v, span) { return function (c) { return Math.max(0, (c.x - v.l + c.y - v.t) / (v.w + v.h)) * span; }; }
    function dLR(v, span) { return function (c) { return Math.max(0, (c.x + 0.5 - v.l) / v.w) * span; }; }
    function dCentre(px, py, per) { return function (c) { return Math.hypot(c.x + 0.5 - px, c.y + 0.5 - py) * per; }; }
    function dScatter(span) { return function (c) { return Math.random() * span; }; }
    function inside(v, df) { return function (c, t) { return c.x + 1 < v.l || c.x > v.l + v.w || c.y + 1 < v.t || c.y > v.t + v.h ? -1 : df(c, t); }; }
    function halfDiag(v) { return Math.hypot(v.w, v.h) / 2; }
    function cellAt(x, y) { return cells[clamp(y | 0, 0, ROWS - 1) * COLS + clamp(x | 0, 0, COLS - 1)]; }
    function nearest(list) {
      var best = list[0], bd = 1e9;
      list.forEach(function (c) { var d = Math.hypot(c.x + 0.5 - CX, c.y + 0.5 - CY); if (d < bd) { bd = d; best = c; } });
      return best || cellAt(CX, CY);
    }

    // ═════════ moves ═════════
    function settle(i) {
      cam.cx = CX; cam.cy = CY; cam.z = zOf(i); camMoving = true;
      paperSet(rgb(PALETTES[palOf(i)].paper)); coverEl.setAttribute('opacity', 0);
      var sf = stateOf(i); cells.forEach(function (c) { setCell(c, sf(c)); });
    }
    function arrive(d0) {
      var sf = stateOf(0);
      cells.forEach(function (c) { var t = sf(c); c.rnd = Math.random(); setCell(c, hazy(t, 1.15)); goCell(c, t, d0 + c.rnd * 1500, 700); });
      return d0 + 2200;
    }
    // push into one cell until its ink is the whole frame, change the world behind it, pull back
    function pushPull(to, cell, ink, then) {
      var zBig = Math.hypot(W, H) * 1.15 / u;
      coverEl.setAttribute('fill', ink);
      camTo({ cx: cell.x + 0.5, cy: cell.y + 0.5, z: zBig }, 0, 1200, E.in3);
      tw(650, 550, function (e) { coverEl.setAttribute('opacity', e); }, E.in2);
      at(1210, function () {
        if (then) then(); else {
          paperSet(rgb(PALETTES[palOf(to)].paper));
          var sf = stateOf(to); cells.forEach(function (c) { setCell(c, sf(c)); });
          cam.cx = CX; cam.cy = CY; cam.z = zBig; camTo({ cx: CX, cy: CY, z: zOf(to) }, 0, 1500, E.out3);
        }
        tw(120, 600, function (e) { coverEl.setAttribute('opacity', 1 - e); }, E.io);
      });
      return 2700;
    }
    function exhale() {                                          // 5 → 1: every cell softens back into the mass, then arrives
      var sf = stateOf(0);
      paperFade(PALETTES[0].paper, 0, 900);
      apply(function (c) { return hazy(sf(c), 1.15); }, dScatter(1000), 600);
      at(1700, function () { apply(sf, dScatter(1500), 700); });
      return 3900;
    }
    function breath() {                                          // 3 → 4: only the words dissolve; the rest follows, slowly
      var m = FS[2].M, v = view(zOf(3));
      mask3.cells.forEach(function (c) { goCell(c, tgt('blob', m, 0, 1, true, true), Math.random() * 700, 600); });
      at(1100, function () {
        paperFade(PALETTES[3].paper, 0, 1300);
        apply(stateOf(3), dCentre(CX, CY, 1400 / halfDiag(v)), 800);
      });
      return 3300;
    }
    var TRANS = {
      C: [
        function () { var v = view(3), per = 1100 / halfDiag(v); wipeCircle(PALETTES[1].paper, per, halfDiag(v) + 2); apply(stateOf(1), dCentre(CX, CY, per), 700); return 1900; },
        function () {                                            // a line crosses the frame, then the camera pulls back and the words surface
          var v = view(3), sf = stateOf(2);
          wipeX(PALETTES[2].paper, v, 1000); apply(stateOf(2, true), inside(v, dLR(v, 1000)), 600);
          at(1650, function () {
            camTo({ cx: CX, cy: CY, z: 1 }, 0, 1700);
            mask3.cells.forEach(function (c) { goCell(c, sf(c), 500 + mask3.at[c.y * COLS + c.x] * 110 + c.rnd * 150, 500); });
          });
          return 4300;
        },
        breath,
        function () { return pushPull(4, nearest(mask4.cells), PALETTES[3].mark); },
        exhale,
      ],
      A: [
        function () { paperFade(PALETTES[1].paper, 0, 1000); apply(stateOf(1), dDiag(view(1), 1400), 700); return 2100; },
        function () {                                            // every block subdivides as the line passes; the words turn last
          var v = view(1), lr = dLR(v, 1500);
          wipeX(PALETTES[2].paper, v, 1500); apply(stateOf(2), function (c, t) { return lr(c) + (t.mark ? 700 : 0); }, 650);
          return 2900;
        },
        breath,
        function () { apply(stateOf(4), dCentre(CX, CY, 1500 / halfDiag(view(1))), 800); return 2400; },
        exhale,
      ],
      B: [
        function () { return pushPull(1, cellAt(CX, CY), PALETTES[1].lead); },
        function () { camTo({ cx: CX, cy: CY, z: 1 }, 0, 2400); wipeCircle(PALETTES[2].paper, 55, halfDiag(view(1)) + 3); apply(stateOf(2), dCentre(CX, CY, 55), 600); return 2600; },
        function () { return pushPull(3, nearest(mask3.cells), PALETTES[2].mark); },
        function () { return pushPull(4, nearest(mask4.cells), PALETTES[3].mark); },
        function () {
          pushPull(0, cellAt(CX, CY), PALETTES[0].paper, function () { paperSet(rgb(PALETTES[0].paper)); cam.cx = CX; cam.cy = CY; cam.z = 3; camMoving = true; arrive(250); });
          return 3700;
        },
      ],
    };
    function generic(i) {
      camTo({ cx: CX, cy: CY, z: zOf(i) }, 0, 1300); paperFade(PALETTES[palOf(i)].paper, 0, 900);
      tw(0, 300, function (e) { coverEl.setAttribute('opacity', (1 - e) * +coverEl.getAttribute('opacity')); });
      apply(stateOf(i), dScatter(800), 600);
      return 1500;
    }

    // ═════════ what happens inside a slide ═════════
    function wander() {                                          // slide 1: one cell at a time takes a quarter turn
      for (var k = 0; k < 6; k++) {
        var v = view(cam.z), c = cellAt(v.l + Math.random() * v.w, v.t + Math.random() * v.h);
        if (coarse(0)) c = cellAt(c.x - c.x % 3 + 1, c.y - c.y % 3 + 1);
        if (!c.anim && !c.haze) { c.wob = (c.wob + 1) % 4; goCell(c, stateOf(0)(c), 0, 520); break; }
      }
      at(380, wander);
    }
    function simmer() {                                          // slide 4: the haze never settles
      for (var k = 0; k < 4; k++) {
        var c = mask4.cells[(Math.random() * mask4.cells.length) | 0];
        if (c && c.haze && !c.anim) goCell(c, tgt('blob', FS[3].M, 0, 0.7 + Math.random() * 0.55, true, true), 0, 1100);
      }
      at(260, simmer);
    }
    function beats(i, tr) {
      var v = view(zOf(i)), per = 900 / halfDiag(v);
      if (i === 0) at(tr + 300, wander);
      if (i === 1) [1, 2, 3].forEach(function (k) {
        at(tr + k * 1400, function () { V[1]++; apply(stateOf(1), dCentre(CX, CY, per), 650); label(RN[S2R[V[1] % 4]], PALETTES[1]); });
      });
      if (i === 2) at(tr + 1800, function () { V[2]++; apply(stateOf(2), dDiag(v, 1200), 650); });
      if (i === 3) { at(tr + 300, simmer); [2000, 3800].forEach(function (ms) { at(tr + ms, function () { V[3]++; apply(stateOf(3), dCentre(CX, CY, per), 700); }); }); }
      if (i === 4) [1, 2, 3].forEach(function (k) {
        at(tr + 300 + k * 1300, function () {
          V[4]++; var p = PALETTES[palOf(4)];
          paperFade(p.paper, 0, 900); apply(stateOf(4), dDiag(v, 900), 600); label(p.name + ' — house no. ' + p.house, p);
        });
      });
    }
    function firstLabel(i) {
      var p = PALETTES[palOf(i)];
      label(i === 1 ? RN[S2R[0]] : i === 4 ? p.name + ' — house no. ' + p.house : SLIDES[i].title, p);
    }
    function go(i) {
      i = ((i % 5) + 5) % 5;
      var from = cur, tr = 0;
      tweens.forEach(function (w) { w.dead = true; }); wipeEnd(); labelEl.classList.remove('is-on');
      cur = i; V[i] = 0; slideT0 = T;
      if (i === 0) cells.forEach(function (c) { c.wob = 0; });
      if (instant) settle(i);
      else if (from < 0) { if (i === 0) { settle(0); tr = arrive(200); } else settle(i); }
      else if (i === (from + 1) % 5) tr = TRANS[concept][from]();
      else tr = generic(i);
      if (!instant) { firstLabel(i); beats(i, tr); }
      if (opts.onSlide) opts.onSlide(i, { title: SLIDES[i].title, palette: PALETTES[palOf(i)] });
      if (instant) frameOnce();
    }
    // a click re-rolls: the slide's next rule (or palette) spreads from the point
    function reroll(px, py) {
      if (cur < 0) return;
      V[cur]++;
      if (cur === 0) cells.forEach(function (c) { c.wob = 0; });
      var lx = shown.cx + (px - W / 2) / (u * shown.z), ly = shown.cy + (py - H / 2) / (u * shown.z);
      if (cur === 4) paperFade(PALETTES[palOf(4)].paper, 0, 900);
      apply(stateOf(cur), dCentre(lx, ly, 45 / Math.sqrt(shown.z)), 600);
      if (cur === 1) label(RN[S2R[V[1] % 4]], PALETTES[1]);
      if (instant) frameOnce();
    }

    // ═════════ the frame ═════════
    function bendCells() {
      var i, c;
      for (i = 0; i < bent.length; i++) bent[i].bend = 0;
      if (ptr && shown.z < 8) {
        var lx = shown.cx + (ptr.x - W / 2) / (u * shown.z), ly = shown.cy + (ptr.y - H / 2) / (u * shown.z);
        var R = coarse(cur) ? 4 : shown.z > 2 ? 1.4 : 2.4, x0 = Math.floor(lx - R), y0 = Math.floor(ly - R);
        for (var y = y0; y <= y0 + 2 * R + 1; y++) for (var x = x0; x <= x0 + 2 * R + 1; x++) {
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS || Math.hypot(x + 0.5 - lx, y + 0.5 - ly) > R) continue;
          c = cells[y * COLS + x]; c.bend = 1;
          if (!c.inBent) { c.inBent = true; bent.push(c); }
        }
      }
    }
    function placeCamera() {
      var k = concept === 'A' || instant ? 0 : 1, z = cam.z * (1 + k * 0.012 * Math.sin(T / 8000));
      shown.cx = cam.cx + k * 14 / (u * z) * Math.sin(T / 5200); shown.cy = cam.cy + k * 10 / (u * z) * Math.sin(T / 6900 + 1); shown.z = z;
      gCam.setAttribute('transform', 'translate(' + (W / 2).toFixed(2) + ' ' + (H / 2).toFixed(2) + ') scale(' + (u * z / 100).toFixed(5) + ') translate(' + (-shown.cx * 100).toFixed(2) + ' ' + (-shown.cy * 100).toFixed(2) + ')');
    }
    function step(dt) {
      var i, w, q, c, s;
      T += dt;
      for (i = 0; i < tweens.length; i++) {
        w = tweens[i]; if (w.dead) continue;
        q = w.dur ? (T - w.t0) / w.dur : (T >= w.t0 ? 1 : -1);
        if (q < 0) continue;
        if (q >= 1) { w.dead = true; if (w.fn) w.fn(1); if (w.end) w.end(); }
        else if (w.fn) w.fn(w.ease ? w.ease(q) : q);
      }
      tweens = tweens.filter(function (x) { return !x.dead; });
      placeCamera();
      if (!instant) bendCells();
      for (i = active.length - 1; i >= 0; i--) {
        c = active[i]; s = evalAnim(c);
        if (s) { if (inView(c)) render(c); else c.dirty = true; }
        if (s === 2) { c.act = false; active[i] = active[active.length - 1]; active.pop(); }
      }
      var k = Math.min(1, dt / 130);
      for (i = bent.length - 1; i >= 0; i--) {
        c = bent[i]; c.bn += (c.bend - c.bn) * k;
        if (!c.bend && c.bn < 0.003) { c.bn = 0; c.inBent = false; bent[i] = bent[bent.length - 1]; bent.pop(); }
        render(c);
      }
      if (camMoving) { for (i = 0; i < cells.length; i++) if (cells[i].dirty && inView(cells[i])) render(cells[i]); camMoving = false; }
      if (cur >= 0 && !lock) {
        var p = (T - slideT0) / SLIDES[cur].dur;
        if (opts.onProgress) opts.onProgress(Math.min(1, p));
        if (p >= 1) go(cur + 1);
      }
    }
    function frameOnce() { step(0); cells.forEach(render); }
    function push(a, v) { a.push(v); if (a.length > 240) a.shift(); }
    function frame(now) {
      if (dead) return;
      if (paused || !visible || instant || document.hidden) { raf = 0; return; }   // asleep: no frame is requested until wake()
      raf = requestAnimationFrame(frame);
      var raw = now - last; last = now;
      if (raw < 250) push(meter.dt, raw);
      var t0 = performance.now();
      step(Math.min(50, raw));
      push(meter.js, performance.now() - t0);
    }
    function stats() {
      function summary(a) {
        if (!a.length) return { avg: 0, p95: 0, max: 0 };
        var s = a.slice().sort(function (x, y) { return x - y; });
        return { avg: a.reduce(function (x, y) { return x + y; }, 0) / a.length, p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] };
      }
      return { frame: summary(meter.dt), js: summary(meter.js), cells: cells.length, moving: active.length };
    }

    // ═════════ life ═════════
    function onMove(e) { var r = host.getBoundingClientRect(); ptr = { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function onLeave() { ptr = null; }
    var wait = 0, sized = false;
    var ro = new ResizeObserver(function () {
      if (!sized) { sized = true; return; }
      clearTimeout(wait);
      wait = setTimeout(function () { if (dead || (host.clientWidth === W && host.clientHeight === H)) return; var i = Math.max(0, cur); if (build()) { cur = -1; var keep = instant; instant = true; go(i); instant = keep; if (!instant) beats(i, 0); } }, 200);
    });
    function wake() { if (dead || raf || paused || !visible || instant || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(frame); }
    var io = new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; wake(); });
    if (!build()) return { go: function () {}, next: function () {}, prev: function () {}, reroll: function () {}, pause: function () {}, stats: stats, stop: function () {} };
    ro.observe(host); io.observe(host); document.addEventListener('visibilitychange', wake);
    if (!instant) { host.addEventListener('pointermove', onMove); host.addEventListener('pointerleave', onLeave); }
    go(opts.start || 0);
    last = performance.now(); raf = requestAnimationFrame(frame);
    return {
      go: go, next: function () { go(cur + 1); }, prev: function () { go(cur - 1); }, reroll: reroll,
      pause: function (b) { paused = !!b; wake(); }, stats: stats,
      // run the clock by hand (a test in a tab that gets no frames): returns the script cost of a frame, ms
      advance: function (ms) { var n = 0, sum = 0, max = 0; for (var t = 0; t < ms; t += 16) { var a = performance.now(); step(16); a = performance.now() - a; sum += a; max = Math.max(max, a); n++; } return { frames: n, avg: sum / n, max: max }; },
      stop: function () { dead = true; cancelAnimationFrame(raf); clearTimeout(wait); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', wake); host.removeEventListener('pointermove', onMove); host.removeEventListener('pointerleave', onLeave); host.textContent = ''; },
    };
  }

  (window.Organica = window.Organica || {}).heroLoop = { mount: mount, inks: inks, PALETTES: PALETTES, ELEMENTS: ELEMENTS, OPENERS: OPENERS, SLIDES: SLIDES, RULES: RULES };
})();
