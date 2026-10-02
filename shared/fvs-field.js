/* ─────────────────────────────────────────────────────────────
   ORGANICA — fvs-field.js
   Organica.fvsField — a decorative full-screen field made with the Flexible
   Visual System: one Element (Organica.shapes) in every cell of a grid, each
   cell's turn set by a named rule. It lies under a page (the 404), never
   takes the pointer, and moves the way FVS itself does. Two motions:

     arrival — FVS's Generate arrival (fvs/index.html runSymbolArrival, after
               Bencho, MIT): a cell forms out of a blurred, hard-contrast mass
               into its sharp shape, cells in a scattered order; then one cell
               at a time takes a quarter turn and re-forms.
               Element: Arc truchet · rule: Checkerboard 0° / 90° · two inks
               alternating with the turn.
     rules   — FVS's transform vocabulary: every cell turns in quarter turns
               as the grid moves from one named rule to the next
               (Radial → Checkerboard → Pinwheel → Identity).
               Element: Arc (a quarter ring; four under Radial = a ring).

   With opts.numerals the grid spells "404" through the cells that do not
   behave: in arrival they never finish arriving (they stay a liquid haze),
   in rules they never obey the rule (always a quarter turn off) and carry
   the palette's strongest ink — FVS's per-cell colour.

   Organica.fvsField.mount(host, opts) → { stop() }   (stop empties the host)
     host           a sized block element (.org-fvs-field)
     opts.motion    'arrival' | 'rules'
     opts.numerals  true → the "404" mask
     opts.band      the element whose box the numerals fill (.org-fvs-field__band);
                    the grid runs on from it over the whole host
     opts.centre    without numerals: the element the grid centres on (a card)
     opts.above     an element no cell may lie above (the header)
     opts.below     an element no cell may lie below (the footer)
     opts.palette   one entry of Organica.fvsField.palettes(): { name, paper,
                    inks[], mark, dark } — see resolve(). A palette is content:
                    the same in light and dark. Without one, fill =
                    currentColor and follows the theme.
   Organica.fvsField.palettes()  the palette library (Organica.palette.library:
                    the palettes saved in TuneSutra + the built-in
                    combinations), each resolved to a ground and its inks.

   Inline SVG. Runs only its own timers, pauses while the tab is hidden,
   rebuilds on resize. prefers-reduced-motion = the settled picture, nothing
   moves (and the motion tokens the rules transition uses collapse to 1ms).
   Paired CSS: fvs-field.css. Load AFTER core.js + color.js + palette.js +
   shapes.js (color + palette only for palettes()).
   Used by: /404.html. Reference: /design-system/#fvs-field.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var Organica = window.Organica = window.Organica || {};
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var S = Organica.shapes;
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

  // ── the grid covers the whole host. With numerals: the mask's 16 × 8 block
  //    fills the band's box and the grid runs on from it at the same cell size.
  //    Without: centred on opts.centre (a card). Either way an even number of cells lies before the
  //    anchor, so Radial's 2 × 2 blocks line up with it.
  function layout(host, opts) {
    var r = host.getBoundingClientRect(), W = Math.max(1, r.width), H = Math.max(1, r.height);
    var g = { W: W, H: H, cells: [], left: 0, up: 0 };
    var ax, ay;                                   // the anchor: the mask's top-left, or the card's centre
    if (opts.numerals) {
      var mc = MASK[0].length, mr = MASK.length, b = (opts.band || host).getBoundingClientRect();
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
                     mark: !!opts.numerals && (MASK[row - g.up] || '').charAt(col - g.left) === 'X',
                     dist: opts.numerals ? 0 : Math.hypot(x + g.cell / 2 - g.cx, y + g.cell / 2 - g.cy) / g.cell });
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
    var d = S.arcTruchetGeometry(3, 0.5).d, k = g.cell / 100;
    var defs = mk('defs', {}, svg);
    var src = mk('g', {}, defs);                            // the Symbol, sharp — every cell a group a pane can copy
    var shown = mk('g', {}, svg), layer = mk('g', {}, svg);
    g.cells.forEach(function (c) {
      c.rot = (c.col + c.row) % 2 ? 90 : 0;                  // Checkerboard 0° / 90°
      c.path = mk('path', { d: d }, mk('g', { id: uid + '-c' + c.i }, src));
      if (pal) c.path.setAttribute('fill', pal.inks[(c.col + c.row) % pal.inks.length]);   // the ink alternates with the turn
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
      c.own.setAttribute('opacity', '0');
      return p;
    }
    // FVS's tick, for one pane at progress t (0 → 1). `drift` keeps the water moving on a held cell.
    function set(p, t, drift) {
      var c = p.c, haze = smooth(0, 0.3, t), form = smooth(0.1, 0.82, t);
      var sd = mix(ARRIVE.blur, 0, 1 - Math.pow(1 - form, 2.2));
      var kk = mix(ARRIVE.contrast, 1, form);
      var warp = (ARRIVE.ripple / 100) * 32 * Math.pow(1 - smooth(0.05, 0.9, t), 1.5);
      var fq = 0.006 + 0.0018 * Math.sin((drift == null ? t : drift) * 4.4);
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
    function arrive(cells, step) {
      var panes = cells.map(pane), n = panes.length, t0 = 0, left = n;
      var rank = panes.map(function (_, i) { return i; });
      for (var i = n - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), s = rank[i]; rank[i] = rank[j]; rank[j] = s; }
      T.raf(function (now) {
        if (!t0) t0 = now;
        panes.forEach(function (p, i) {
          if (p.done) return;
          var t = (now - t0 - rank[i] * step) / ARRIVE.cell;
          if (t <= 0) return;
          if (p.c.mark && t >= ARRIVE.hold) { p.done = true; left--; held.push(p); return; }
          if (t >= 1) { p.done = true; left--; land(p); return; }
          set(p, t);
        });
        return left > 0;
      });
    }

    if (REDUCED) {
      g.cells.filter(function (c) { return c.mark; }).forEach(function (c) { set(pane(c), ARRIVE.hold); });
    } else {
      arrive(g.cells, clamp(ARRIVE.sweep / g.cells.length, Math.max(ARRIVE.stepMin, ARRIVE.cell / ARRIVE.atOnce), ARRIVE.stepMax));
      // the numerals stay liquid
      if (opts.numerals) T.raf(function (now) { held.forEach(function (p, i) { set(p, ARRIVE.hold, now / 1000 * 0.35 + i); }); });
      // and the rest of the weave keeps changing: one cell takes a quarter turn and re-forms
      var free = g.cells.filter(function (c) { return !c.mark; });
      T.every(opts.numerals ? 1400 : 1800, function () {
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
    var d = S.arcGeometry(42).d, k = g.cell / 100;
    var rng = Organica.mulberry32(404);
    g.cells.forEach(function (c) {
      var at = mk('g', { transform: 'translate(' + c.x + ' ' + c.y + ') scale(' + k + ')' }, svg);
      c.path = mk('path', { d: d, 'class': 'org-fvs-field__cell' }, at);
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
    var ruled = g.cells.filter(function (c) { return !c.mark; }), marks = g.cells.filter(function (c) { return c.mark; });
    function wave(c) { return opts.numerals ? (c.col + c.row) * 0.25 : c.dist * 0.7; }
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
    T.every(opts.numerals ? 6000 : 9000, function () { at = (at + 1) % ORDER.length; apply(ORDER[at]); });
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
    MOTIONS: Object.keys(MOTIONS),
    palettes: function () {
      return Organica.palette.library().filter(function (p) { return p.colors.length >= 2 && p.colors.length <= 7; }).map(resolve);
    },
    mount: function (host, opts) {
      opts = opts || {};
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
