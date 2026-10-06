/* ─────────────────────────────────────────────────────────────
   ORGANICA — fvs-field.js
   Organica.fvsField — a decorative full-screen field made with the Flexible
   Visual System: one Element (Organica.shapes) in every cell of a grid, each
   cell's turn set by a named rule. It lies under a page (the 404), never
   takes the pointer, and moves the way FVS itself does. Two motions:

     arrival — FVS's Generate arrival (fvs/js/08-symbol-grid.js runSymbolArrival, after
               Bencho, MIT): a cell forms out of a blurred, hard-contrast mass
               into its sharp shape, cells in a scattered order; then one cell
               at a time takes a quarter turn and re-forms.
               Element: Arc truchet · rule: Checkerboard 0° / 90° · two inks
               alternating with the turn.
     rules   — FVS's transform vocabulary: every cell turns in quarter turns
               as the grid moves from one named rule to the next
               (Radial → Checkerboard → Pinwheel → Identity).
               Element: Arc (a quarter ring; four under Radial = a ring).

   With opts.numerals ("404") or opts.text (any words, in a 3 × 5 cell
   alphabet) the grid spells them through the cells that do not behave: in arrival they never finish arriving (they stay a liquid haze),
   in rules they never obey the rule (always a quarter turn off) and carry
   the palette's strongest ink — FVS's per-cell colour.

   Organica.fvsField.mount(host, opts) → { stop() }   (stop empties the host)
     host           a sized block element (.org-fvs-field)
     opts.motion    'arrival' | 'rules'
     opts.numerals  true → the "404" mask (4 × 6 numerals)
     opts.text      or: words to spell, '\n' between lines, e.g.
                    'WELCOME TO\nORGANICA' (A–Z, 0–9; unknown characters are spaces)
     opts.elements  { cell, mark } — the Element of an ordinary cell and of a
                    cell of the words, by name: 'truchet' | 'arc' | 'triangle' |
                    'circle'. Default: the motion's own Element for both
                    (arrival: truchet, rules: arc). With a different `mark`
                    the words are simply drawn in the other Element, in the
                    palette's strongest ink — e.g. { cell: 'triangle',
                    mark: 'circle' }: circles spelling the words among triangles.
     opts.hold      false → the words' cells arrive / obey like every other
                    (default true: they never do — the 404)
     opts.band      the element whose box the numerals / words fill (.org-fvs-field__band);
                    the grid runs on from it over the whole host
     opts.centre    with neither: the element the grid centres on (a card)
     opts.above     an element no cell may lie above (the header)
     opts.below     an element no cell may lie below (the footer)
     opts.palette   one entry of Organica.fvsField.palettes(): { name, paper,
                    inks[], mark, dark } — see resolve(). A palette is content:
                    the same in light and dark. Without one, fill =
                    currentColor and follows the theme.
   Organica.fvsField.palettes()  the built-in combinations, resolved to a ground
                    and its inks — or, where color.js + palette.js are loaded,
                    the whole library (Organica.palette.library: the palettes
                    saved in TuneSutra + the built-ins).
   Organica.fvsField.visit(key)  counts this browser's visits to a page
                    (localStorage[key]) and returns the count — a page uses it
                    to show the other motion and the next palette each time.
   Organica.fvsField.resolve(entry)  one library entry → { name, paper, inks,
                    mark, dark } (needs color.js).

   Inline SVG. Runs only its own timers, pauses while the tab is hidden,
   rebuilds on resize. prefers-reduced-motion = the settled picture, nothing
   moves (and the motion tokens the rules transition uses collapse to 1ms).
   Paired CSS: fvs-field.css.

   STANDALONE — no other script is needed (the 404 loads this file alone).
   What it would take from the rest of the system is baked in below and kept
   honest by `node scripts/test-fvs-field.mjs` (run by scripts/check.py):
     ELEMENTS  the two Elements' paths = Organica.shapes' own output
     BUILTIN   the library's built-in combinations, resolved
   Where color.js + palette.js ARE loaded (a tool, the design system),
   palettes() reads the live library instead — the saved palettes too.
   Used by: /404.html. Reference: /design-system/#fvs-field.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var Organica = window.Organica = window.Organica || {};
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  function mk(tag, attrs, parent) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { var u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); }

  // The Elements, in FVS's 0..100 cell box — Organica.shapes' arcTruchetGeometry(3, 0.5), arcGeometry(42),
  // triangleGeometry(100, 100, 0) and circleGeometry(90), baked (shapes.js is ~97 KB for these strings).
  var ELEMENTS = {
    truchet: 'M 33.333,100 A 16.667,16.667 0 0 1 66.667,100 L 58.333,100 A 8.333,8.333 0 0 0 41.667,100 ZM 16.667,100 A 33.333,33.333 0 0 1 83.333,100 L 75,100 A 25,25 0 0 0 25,100 ZM 0,100 A 50,50 0 0 1 100,100 L 91.667,100 A 41.667,41.667 0 0 0 8.333,100 ZM 33.333,0 A 16.667,16.667 0 0 0 66.667,0 L 58.333,0 A 8.333,8.333 0 0 1 41.667,0 ZM 16.667,0 A 33.333,33.333 0 0 0 83.333,0 L 75,0 A 25,25 0 0 1 25,0 ZM 0,0 A 50,50 0 0 0 100,0 L 91.667,0 A 41.667,41.667 0 0 1 8.333,0 Z',
    arc: 'M 100,0 A 100,100 0 0,1 0,100 L 0,58.00000000000001 A 58.00000000000001,58.00000000000001 0 0,0 58.00000000000001,0 Z',
    triangle: 'M 50,0 L 0,100 L 100,100 Z',
    circle: 'M 5,50 A 45,45 0 1,1 95,50 A 45,45 0 1,1 5,50 Z',
  };
  // The library's built-in combinations (shared/palette.js COMBINATIONS), already through resolve().
  var BUILTIN = [
    {name: 'Violet 06', paper: '#f9dfe2', inks: ['#da887f', '#b296b9'], mark: '#93789a', dark: false},
    {name: 'Stimulating', paper: '#74c476', inks: ['#d40039', '#5f238d'], mark: '#5f238d', dark: false},
    {name: 'Violet 07', paper: '#fffab8', inks: ['#8aa9a5', '#ad9ca6'], mark: '#8e7e88', dark: false},
  ];
  // core.js's mulberry32, so the rules motion needs no core
  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t |= 0; t = (t + 0x6D2B79F5) | 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // "404" on a 16 × 8 grid: 4 × 6 numerals, one cell of pattern all round.
  // Even both ways, so Radial's 2 × 2 blocks close into whole rings.
  var MASK = [
    '................',
    '.X..X.XXXX.X..X.',
    '.X..X.X..X.X..X.',
    '.X..X.X..X.X..X.',
    '.XXXX.X..X.XXXX.',
    '....X.X..X....X.',
    '....X.XXXX....X.',
    '................',
  ];

  // Words: a 3 × 5 cell alphabet (M, N, W wider), one cell between letters, one
  // row between lines, one cell of pattern all round; lines are centred.
  var FONT = {
    A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'], B: ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'], C: ['XXX', 'X..', 'X..', 'X..', 'XXX'],
    D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'], E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'], F: ['XXX', 'X..', 'XX.', 'X..', 'X..'],
    G: ['XXX', 'X..', 'X.X', 'X.X', 'XXX'], H: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'], I: ['XXX', '.X.', '.X.', '.X.', 'XXX'],
    J: ['..X', '..X', '..X', 'X.X', 'XXX'], K: ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'], L: ['X..', 'X..', 'X..', 'X..', 'XXX'],
    M: ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X'], N: ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'], O: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
    P: ['XXX', 'X.X', 'XXX', 'X..', 'X..'], Q: ['XXX', 'X.X', 'X.X', 'XXX', '..X'], R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'],
    S: ['XXX', 'X..', 'XXX', '..X', 'XXX'], T: ['XXX', '.X.', '.X.', '.X.', '.X.'], U: ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'],
    V: ['X.X', 'X.X', 'X.X', 'X.X', '.X.'], W: ['X...X', 'X...X', 'X.X.X', 'XX.XX', 'X...X'], X: ['X.X', 'X.X', '.X.', 'X.X', 'X.X'],
    Y: ['X.X', 'X.X', '.X.', '.X.', '.X.'], Z: ['XXX', '..X', '.X.', 'X..', 'XXX'],
    0: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'], 1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'], 2: ['XXX', '..X', 'XXX', 'X..', 'XXX'],
    3: ['XXX', '..X', 'XXX', '..X', 'XXX'], 4: ['X.X', 'X.X', 'XXX', '..X', '..X'], 5: ['XXX', 'X..', 'XXX', '..X', 'XXX'],
    6: ['XXX', 'X..', 'XXX', 'X.X', 'XXX'], 7: ['XXX', '..X', '..X', '..X', '..X'], 8: ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
    9: ['XXX', 'X.X', 'XXX', '..X', 'XXX'],
  };
  function dots(n) { return new Array(n + 1).join('.'); }
  function textMask(text) {
    var lines = String(text).toUpperCase().split('\n').map(function (line) {
      var rows = ['', '', '', '', ''];
      line.split('').forEach(function (ch, i) {
        var gl = FONT[ch] || ['.', '.', '.', '.', '.'];          // a space is one empty column (+ the gaps either side)
        rows = rows.map(function (r, k) { return r + (i ? '.' : '') + gl[k]; });
      });
      return rows;
    });
    var w = Math.max.apply(null, lines.map(function (l) { return l[0].length; })), out = [dots(w + 2)];
    lines.forEach(function (l) {
      var pad = (w - l[0].length) >> 1;
      l.forEach(function (r) { out.push('.' + dots(pad) + r + dots(w - pad - r.length) + '.'); });
      out.push(dots(w + 2));
    });
    return out;
  }

  // ── the grid covers the whole host. With numerals / words: the mask's block
  //    fills the band's box and the grid runs on from it at the same cell size.
  //    Without: centred on opts.centre (a card). Either way an even number of cells lies before the
  //    anchor, so Radial's 2 × 2 blocks line up with it.
  function layout(host, opts) {
    var r = host.getBoundingClientRect(), W = Math.max(1, r.width), H = Math.max(1, r.height);
    var g = { W: W, H: H, cells: [], left: 0, up: 0 };
    var ax, ay;                                   // the anchor: the mask's top-left, or the card's centre
    if (opts.mask) {
      var mc = opts.mask[0].length, mr = opts.mask.length, b = (opts.band || host).getBoundingClientRect();
      g.cell = Math.min(b.height / mr, W / mc);
      ax = b.left + b.width / 2 - r.left - mc * g.cell / 2;
      ay = b.top - r.top + (b.height - mr * g.cell) / 2;
    } else {
      ax = W / 2; ay = H / 2;
      if (opts.centre) { var c = opts.centre.getBoundingClientRect(); ax = c.left + c.width / 2 - r.left; ay = c.top + c.height / 2 - r.top; }
      g.cell = clamp(Math.round(Math.max(W, H) / 14), 64, 112);
      g.cx = ax; g.cy = ay;
    }
    g.left = 2 * Math.ceil(Math.max(0, ax) / g.cell / 2); g.up = 2 * Math.ceil(Math.max(0, ay) / g.cell / 2);
    g.ox = ax - g.left * g.cell; g.oy = ay - g.up * g.cell;
    g.cols = Math.ceil((W - g.ox) / g.cell); g.rows = Math.ceil((H - g.oy) / g.cell);
    // no cell above the bottom of opts.above (a header) or below the top of opts.below (a footer):
    // the ground runs under them, the pattern does not
    var top = opts.above ? opts.above.getBoundingClientRect().bottom - r.top : -Infinity;
    var bottom = opts.below ? opts.below.getBoundingClientRect().top - r.top : Infinity;
    g.at = {};
    for (var row = 0; row < g.rows; row++) for (var col = 0; col < g.cols; col++) {
      var x = g.ox + col * g.cell, y = g.oy + row * g.cell;
      if (y < top - 1 || y + g.cell > bottom + 1) continue;
      g.cells.push({ i: g.cells.length, col: col, row: row, x: x, y: y,
                     mark: !!opts.mask && (opts.mask[row - g.up] || '').charAt(col - g.left) === 'X',
                     dist: opts.mask ? 0 : Math.hypot(x + g.cell / 2 - g.cx, y + g.cell / 2 - g.cy) / g.cell });
      g.at[col + ',' + row] = g.cells[g.cells.length - 1];
    }
    return g;
  }
  function frame(host, g, cls, pal) {
    host.textContent = '';
    host.style.background = pal ? pal.paper : '';
    return mk('svg', { viewBox: '0 0 ' + g.W + ' ' + g.H, width: '100%', height: '100%', 'class': cls, fill: 'currentColor' }, host);
  }
  // every scene keeps its timers here, so a rebuild (resize) starts clean
  function clock() {
    var ids = [], rafs = [];
    return {
      every: function (ms, fn) { ids.push(setInterval(function () { if (!document.hidden) fn(); }, ms)); },
      after: function (ms, fn) { ids.push(setTimeout(fn, ms)); },
      raf: function (fn) { var o = { id: 0 }; rafs.push(o); (function loop(now) { if (fn(now) !== false) o.id = requestAnimationFrame(loop); })(performance.now()); },
      stop: function () { ids.forEach(function (i) { clearInterval(i); clearTimeout(i); }); rafs.forEach(function (o) { cancelAnimationFrame(o.id); }); ids = []; rafs = []; },
    };
  }

  // ═════════ ARRIVAL ═════════
  // FVS's constants, verbatim (GEN_ARRIVE). `hold` = where a numeral's cell
  // stops: still a few glassy masses, its edges never found.
  var ARRIVE = { cell: 1000, sweep: 1200, stepMin: 4, stepMax: 60, blur: 20, contrast: 2.4, ripple: 50, hold: 0.36,
                 atOnce: 140 };   // ours: no more than this many cells forming at a time (a full-screen grid has ~700)

  function arrival(host, opts) {
    var T = clock();
    var g = layout(host, opts), pal = opts.palette, svg = frame(host, g, 'org-fvs-field__svg', pal);
    var uid = 'ff' + Math.random().toString(36).slice(2, 7);
    var E = opts.elements || {}, dCell = ELEMENTS[E.cell] || ELEMENTS.truchet, dMark = ELEMENTS[E.mark] || dCell, k = g.cell / 100;
    var hold = !!opts.mask && opts.hold !== false;
    // words in their own Element: the pattern keeps to the quieter inks, so the strongest is theirs alone
    var own = dMark !== dCell, inks = pal ? (own && pal.inks.length > 1 ? pal.inks.slice(0, -1) : pal.inks) : null;
    var defs = mk('defs', {}, svg);
    var src = mk('g', {}, defs);                            // the Symbol, sharp — every cell a group a pane can copy
    var shown = mk('g', {}, svg), layer = mk('g', {}, svg);
    g.cells.forEach(function (c) {
      c.rot = (c.col + c.row) % 2 ? 90 : 0;                  // Checkerboard 0° / 90°
      c.path = mk('path', { d: c.mark ? dMark : dCell }, mk('g', { id: uid + '-c' + c.i }, src));
      // the ink alternates with the turn; words drawn in their own Element take the strongest ink
      if (pal) c.path.setAttribute('fill', c.mark && own ? pal.mark : inks[(c.col + c.row) % inks.length]);
      c.place = function () { c.path.setAttribute('transform', 'translate(' + c.x + ' ' + c.y + ') scale(' + k + ') rotate(' + c.rot + ' 50 50)'); };
      c.place();
      c.own = mk('use', { href: '#' + uid + '-c' + c.i }, shown);
      var cp = mk('clipPath', { id: uid + '-k' + c.i }, defs);
      mk('rect', { x: c.x, y: c.y, width: g.cell, height: g.cell }, cp);
    });

    // one pane: a filtered copy of the whole Symbol cut to this cell
    function pane(c) {
      var f = mk('filter', { id: uid + '-f' + c.i, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, defs);
      var p = { c: c, f: f };
      p.turb = mk('feTurbulence', { type: 'fractalNoise', numOctaves: '2', seed: String(7 + c.i), result: 'n' }, f);
      p.disp = mk('feDisplacementMap', { 'in': 'SourceGraphic', in2: 'n', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' }, f);
      p.blur = mk('feGaussianBlur', { 'in': 'd' }, f);
      p.fn = mk('feFuncA', { type: 'linear' }, mk('feComponentTransfer', {}, f));   // no paper → the contrast goes on the alpha
      p.g = mk('g', { 'clip-path': 'url(#' + uid + '-k' + c.i + ')' }, layer);
      p.pic = mk('g', { opacity: '0' }, p.g);
      // FVS filters a copy of the whole Symbol, so shapes that meet across an edge stay joined while they
      // form. Here the blur and the ripple reach less than one cell, so the cell and its eight neighbours
      // are the whole of what the filter can see — the same picture, at a ninth of a full-screen grid's cost.
      var seen = mk('g', { filter: 'url(#' + uid + '-f' + c.i + ')' }, p.pic);
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var nb = g.at[(c.col + dx) + ',' + (c.row + dy)];
        if (nb) mk('use', { href: '#' + uid + '-c' + nb.i }, seen);
      }
      c.own.classList.remove('org-fvs-field__own'); c.own.style.opacity = '';
      c.own.setAttribute('opacity', '0');
      return p;
    }
    // a cell that arrives without the filter: it fades in at its turn (see `share`)
    function plain(c) { c.own.classList.add('org-fvs-field__own'); c.own.style.opacity = '0'; return { c: c, plain: true }; }
    // FVS's tick, for one pane at progress t (0 → 1). `drift` keeps the water moving on a held cell.
    // FVS's lengths are for a cell of about 47px (the 404 at a 900px window); a smaller cell takes them in proportion
    var small = Math.min(1, g.cell / 47);
    function set(p, t, drift) {
      var c = p.c, haze = smooth(0, 0.3, t), form = smooth(0.1, 0.82, t);
      var sd = mix(ARRIVE.blur, 0, 1 - Math.pow(1 - form, 2.2)) * small;
      var kk = mix(ARRIVE.contrast, 1, form);
      var warp = (ARRIVE.ripple / 100) * 32 * Math.pow(1 - smooth(0.05, 0.9, t), 1.5) * small;
      var fq = (0.006 + 0.0018 * Math.sin((drift == null ? t : drift) * 4.4)) / small;
      var m = 2.5 * sd + warp + 1;
      p.f.setAttribute('x', (c.x - m).toFixed(1)); p.f.setAttribute('y', (c.y - m).toFixed(1));
      p.f.setAttribute('width', (g.cell + 2 * m).toFixed(1)); p.f.setAttribute('height', (g.cell + 2 * m).toFixed(1));
      p.turb.setAttribute('baseFrequency', fq.toFixed(5) + ' ' + (fq * 1.3).toFixed(5));
      p.disp.setAttribute('scale', warp.toFixed(2));
      p.blur.setAttribute('stdDeviation', Math.max(0.001, sd).toFixed(3));
      p.fn.setAttribute('slope', kk.toFixed(3)); p.fn.setAttribute('intercept', (0.5 - 0.5 * kk).toFixed(3));
      p.pic.setAttribute('opacity', (haze * mix(0.7, 1, form)).toFixed(3));
    }
    function land(p) { p.g.remove(); p.f.remove(); p.c.own.setAttribute('opacity', '1'); }

    var held = [];
    // a set of cells arrives, `step` ms apart in a scattered order; a numeral's cell stops at `hold`
    // `share` < 1: only that share of the cells (and every cell of the words) forms through the filter
    function arrive(cells, step, share) {
      var panes = cells.map(function (c) { return !(share < 1) || c.mark || Math.random() < share ? pane(c) : plain(c); });
      var n = panes.length, t0 = 0, left = n;
      var rank = panes.map(function (_, i) { return i; });
      for (var i = n - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), s = rank[i]; rank[i] = rank[j]; rank[j] = s; }
      T.raf(function (now) {
        if (!t0) t0 = now;
        panes.forEach(function (p, i) {
          if (p.done) return;
          var t = (now - t0 - rank[i] * step) / ARRIVE.cell;
          if (t <= 0) return;
          if (p.plain) { p.done = true; left--; p.c.own.style.opacity = '1'; return; }
          if (hold && p.c.mark && t >= ARRIVE.hold) { p.done = true; left--; held.push(p); return; }
          if (t >= 1) { p.done = true; left--; land(p); return; }
          set(p, t);
        });
        return left > 0;
      });
    }

    if (REDUCED) {
      if (hold) g.cells.filter(function (c) { return c.mark; }).forEach(function (c) { set(pane(c), ARRIVE.hold); });
    } else {
      // A big grid (the sign-in's words need ~1700 cells) would take 12 s at `atOnce`: past 800 cells only a
      // share of them forms through the filter, the others fade in at their turn — the picture is still
      // decided in many places at once, in about 3 s.
      var share = Math.min(1, 800 / g.cells.length);
      arrive(g.cells, clamp(ARRIVE.sweep / g.cells.length, ARRIVE.cell * share / (ARRIVE.atOnce / small), ARRIVE.stepMax), share);
      // the numerals stay liquid
      if (hold) T.raf(function (now) { held.forEach(function (p, i) { set(p, ARRIVE.hold, now / 1000 * 0.35 + i); }); });
      // and the rest of the weave keeps changing: one cell takes a quarter turn and re-forms
      var free = hold || own ? g.cells.filter(function (c) { return !c.mark; }) : g.cells;
      T.every(opts.mask ? 1400 : 1800, function () {
        var c = free[Math.floor(Math.random() * free.length)];
        if (c.own.getAttribute('opacity') === '0') return;   // still forming
        c.rot = (c.rot + 90) % 360; c.place();
        arrive([c], 0);
      });
    }
    return T.stop;
  }

  // ═════════ RULES ═════════
  // A rule gives every cell its turn from its column and row — FVS's named
  // rules, written for any grid size. The Arc at 0° sits in its cell's
  // top-left corner, so Radial (a true clockwise walk of each 2 × 2 block)
  // starts the walk at 180° and the four arcs close into a ring.
  var RULES = {
    radial:   function (c) { return [[180, 270], [90, 0]][c.row % 2][c.col % 2]; },
    checker:  function (c) { return (c.col + c.row) % 2 ? 180 : 0; },
    pinwheel: function (c) { return ((c.row % 2) * 2 + (c.col % 2)) * 90; },
    identity: function () { return 0; },
  };
  var ORDER = ['radial', 'checker', 'pinwheel', 'identity'];

  function rules(host, opts) {
    var T = clock();
    var g = layout(host, opts), pal = opts.palette, svg = frame(host, g, 'org-fvs-field__svg', pal);
    // the ruled cells share the palette's quieter inks, one per 2 × 2 block; the numerals carry its strongest one
    var ruleInks = pal ? (pal.inks.length > 1 ? pal.inks.slice(0, -1) : pal.inks) : null;
    var E = opts.elements || {}, dCell = ELEMENTS[E.cell] || ELEMENTS.arc, dMark = ELEMENTS[E.mark] || dCell, k = g.cell / 100;
    var hold = !!opts.mask && opts.hold !== false;
    var rng = mulberry32(404);
    g.cells.forEach(function (c) {
      var at = mk('g', { transform: 'translate(' + c.x + ' ' + c.y + ') scale(' + k + ')' }, svg);
      c.path = mk('path', { d: c.mark ? dMark : dCell, 'class': 'org-fvs-field__cell' }, at);
      if (pal) c.path.setAttribute('fill', c.mark ? pal.mark : ruleInks[((c.col >> 1) + (c.row >> 1)) % ruleInks.length]);
      c.deg = 0;
      // a turn always takes the short way round; `wait` = its place in the wave, in --dur-stagger steps
      c.turn = function (rot, wait) {
        var delta = ((rot - c.deg) % 360 + 540) % 360 - 180;
        if (delta === -180) delta = 180;
        c.deg += delta;
        c.path.style.transitionDelay = 'calc(var(--dur-stagger) * ' + (wait || 0).toFixed(2) + ')';
        c.path.style.transform = 'rotate(' + c.deg + 'deg)';
      };
    });
    // hold: the words' cells never obey. Otherwise they follow the rule like the rest (a circle has no turn to take).
    var marks = hold ? g.cells.filter(function (c) { return c.mark; }) : [];
    var ruled = hold ? g.cells.filter(function (c) { return !c.mark; }) : g.cells;
    function wave(c) { return opts.mask ? (c.col + c.row) * 0.25 : c.dist * 0.7; }
    function apply(name) { ruled.forEach(function (c) { c.turn(RULES[name](c), wave(c)); }); }
    // a numeral's cell is always one quarter turn away from where the rule would put it
    function stray(c, name) { return RULES[name](c) + 90 * (1 + Math.floor(rng() * 3)); }

    var at = 0;
    if (REDUCED) {
      apply('radial');
      marks.forEach(function (c) { c.turn(stray(c, 'radial')); });
      return T.stop;
    }
    // disorder first, without a transition; then the rule, in a wave
    g.cells.forEach(function (c) { c.path.style.transition = 'none'; c.turn(90 * Math.floor(rng() * 4)); });
    T.after(350, function () {
      g.cells.forEach(function (c) { c.path.style.transition = ''; });
      apply('radial');
    });
    T.every(opts.mask ? 6000 : 9000, function () { at = (at + 1) % ORDER.length; apply(ORDER[at]); });
    // the numerals keep looking for their turn, one cell at a time
    if (marks.length) T.every(260, function () {
      var c = marks[Math.floor(rng() * marks.length)];
      c.turn(stray(c, ORDER[at]));
    });
    return T.stop;
  }

  var MOTIONS = { arrival: arrival, rules: rules };
  // A library palette → ground + inks. The ground is the colour that leaves
  // the others the most contrast; each ink keeps its hue and moves along its
  // own shade scale only as far as it must — 1.8:1 on the ground for the
  // pattern, 3:1 for the numerals' own ink (`mark`, the strongest: it is the
  // message). `dark` = the ground takes light text.
  function resolve(p) {
    var K = Organica.color, hex = p.colors.map(function (c) { return c.hex; });
    var at = 0, most = -1;
    hex.forEach(function (h, i) {
      var least = Math.min.apply(null, hex.filter(function (_, j) { return j !== i; }).map(function (o) { return K.contrast(h, o); }));
      if (least > most) { most = least; at = i; }
    });
    var paper = hex[at];
    function reach(h, min) { var st = K.stepFor(h, paper, min); return st ? st.hex : h; }
    var inks = hex.filter(function (_, i) { return i !== at; })
                  .sort(function (a, b) { return K.contrast(a, paper) - K.contrast(b, paper); });
    return { name: p.name, paper: paper, inks: inks.map(function (h) { return reach(h, 1.8); }),
             mark: reach(inks[inks.length - 1], 3),
             dark: K.contrast(paper, '#ffffff') > K.contrast(paper, '#000000') };
  }
  Organica.fvsField = {
    MOTIONS: Object.keys(MOTIONS), ELEMENTS: ELEMENTS, BUILTIN: BUILTIN, resolve: resolve, textMask: textMask,
    visit: function (key) {
      try { var n = (+localStorage.getItem(key) || 0) + 1; localStorage.setItem(key, String(n)); return n; }
      catch (e) { return Math.floor(Math.random() * 60); }
    },
    palettes: function () {
      if (!Organica.color || !Organica.palette || !Organica.palette.library) return BUILTIN.slice();
      return Organica.palette.library().filter(function (p) { return p.colors.length >= 2 && p.colors.length <= 7; }).map(resolve);
    },
    mount: function (host, opts) {
      opts = Object.assign({}, opts);
      opts.mask = opts.text ? textMask(opts.text) : opts.numerals ? MASK : null;
      var make = MOTIONS[opts.motion || 'arrival'];
      if (!host || !make) return;
      var stop = null, w = 0, h = 0, wait = 0;
      function build() { if (stop) stop(); stop = make(host, opts); }
      var ro = new ResizeObserver(function () {
        var r = host.getBoundingClientRect();
        if (Math.abs(r.width - w) < 1 && Math.abs(r.height - h) < 1) return;
        w = r.width; h = r.height;
        clearTimeout(wait); wait = setTimeout(build, stop ? 200 : 0);
      });
      ro.observe(host);
      return { stop: function () { ro.disconnect(); clearTimeout(wait); if (stop) stop(); stop = null; host.textContent = ''; host.style.background = ''; } };
    },
  };
})();
