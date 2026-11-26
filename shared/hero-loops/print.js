/* ═══════════════════════════════════════════════════════════
   G · Overprint — one home-hero loop for Organica.heroPlayer (shared/hero-player.js).
   Its slides are data (title, ms, pal, brief, and the loop's own fields); its engine is
   build(svg, W, H) → { enter(i, instant), step(ms), reroll(), palette() }. Split out of
   shared/hero-sheets.js on Nov 26, 2026 (backlog 2.1), code unchanged.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var P = window.Organica.heroPlayer, U = P.util, NS = U.NS, HL = U.HL, PALS = U.PALS;
  var el = U.el, rng = U.rng, f = U.f, clamp = U.clamp, ease = U.ease, rgb = U.rgb, mix = U.mix, lum = U.lum, many = U.many;

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
  var PRINT_UID = 0;
  var PRINT = {
    slides: [
      { title: 'Overprint', ms: 4400, pal: 0, brief: 'Three inks, one over the other, as in a riso print. Where two cross, the colours multiply into a third.',
        layers: [{ dx: 0, s: 1, w: .42, off: 0, fade: 'centre' }, { dx: 1, s: .85, w: .34, off: 0, fade: 'right' }, { dx: 1, s: .55, w: .3, off: .5, fade: 'flat' }] },
      { title: 'Lean', ms: 4000, pal: 1, brief: 'Every layer leans its own way. One layer changes at a time; the others hold.',
        layers: [{ dx: -1, s: 1.1, w: .4, off: .25, fade: 'left' }, { dx: 1, s: 1.1, w: .4, off: 0, fade: 'right' }, { dx: 0, s: 1, w: .3, off: .5, fade: 'centre' }] },
      { title: 'Columns', ms: 4000, pal: 2, brief: 'All three upright, slid by half a column, fading in different directions.',
        layers: [{ dx: 0, s: 1, w: .55, off: 0, fade: 'left' }, { dx: 0, s: 1, w: .55, off: .5, fade: 'right' }, { dx: 0, s: .6, w: .3, off: .25, fade: 'edges' }] },
      { title: 'Stitch', ms: 4400, pal: 3, brief: 'Short strokes, like stitches: the same three numbers per layer, smaller.',
        layers: [{ dx: .5, s: .55, w: .3, off: 0, fade: 'flat' }, { dx: -.5, s: .55, w: .3, off: .5, fade: 'centre' }, { dx: 0, s: 1, w: .2, off: .25, fade: 'edges' }] },
      { title: 'Colourway', ms: 4000, pal: 'cycle', brief: 'The same print, re-inked: each beat, the next palette.',
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
          if (i === 0) { rand = rng(5); beat = 0; turn = 0; }   // the wrap (backlog 2.2): the same draws, beats and turns every cycle — seamless
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

  P.define('printfvs', PRINTFVS, { slot: 'print', set: function (j) { PRINT_MODEL = j; } });
})();
