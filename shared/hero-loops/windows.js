/* ═══════════════════════════════════════════════════════════
   B · Windows — one home-hero loop for Organica.heroPlayer (shared/hero-player.js).
   Its slides are data (title, ms, pal, brief, and the loop's own fields); its engine is
   build(svg, W, H) → { enter(i, instant), step(ms), reroll(), palette() }. Split out of
   shared/hero-sheets.js on Nov 26, 2026 (backlog 2.1), code unchanged.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var P = window.Organica.heroPlayer, U = P.util, NS = U.NS, HL = U.HL, PALS = U.PALS;
  var el = U.el, rng = U.rng, f = U.f, clamp = U.clamp, ease = U.ease, rgb = U.rgb, mix = U.mix, lum = U.lum, many = U.many;

  /* ═════════ B · Windows (after a 'Sports design' pin, Nov 24, 2026 — inspired by it, not a copy) ═════════
     Four long ellipses stacked on a dark ground, each a window cut into one to three panels, each panel a
     texture: a big flat ink, a check, a comb, square dots, blocks, stripes, a ladder of inks — mostly cream
     and black, the flats in colour. Below the middle, a barcode of bars; small checks pin the windows at the
     seams; a coil of tilted ovals rides in two windows. Beats: windows slide like drawers, panels flip like
     a split-flap board, windows swap places, the palette turns. */
  var WIN_UID = 0;
  var WINDOWS = {
    slides: [
      { title: 'Windows', ms: 4000, pal: 1, brief: 'Long windows on a dark ground, each cut into panels: big flat inks, checks, combs, dots, blocks.' },
      { title: 'Drawers', ms: 4400, pal: 1, brief: 'On each beat a window slides sideways like a drawer; the barcode shows behind it.' },
      { title: 'Flip', ms: 4400, pal: 3, brief: 'Panels flip like a split-flap board: each closes on its middle line and opens on a new texture.' },
      { title: 'Swap', ms: 4000, pal: 2, brief: 'Two windows trade places, one passing over the other.' },
      { title: 'Colourway', ms: 4000, pal: 'cycle', brief: 'The same windows, re-inked: each beat, the next palette, flipped panel by panel.' },
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

      // the barcode, below the middle: rows of bars, each its own rhythm, drifting slowly. Seamless by construction
      // (backlog 2.2): a row's bars repeat every p px, and p is what the row drifts in one cycle (CYC, the slides' clock
      // ms) — so after a cycle every row is where it started; the drift is timed from the cycle's start (r.t0).
      var BY0 = H * .5, BY1 = H * .93, NR = 4, rhB = (BY1 - BY0) / NR, bars = el('g', {}, svg), rows = [];
      var CYC = WINDOWS.slides.reduce(function (a, sl) { return a + sl.ms; }, 0) / 1000;
      for (var bi = 0; bi < NR; bi++) {
        var rg = el('g', {}, bars), x = 0, list = [], qq = rng(100 + bi);
        var v0 = 5 + qq() * 9, m = Math.max(1, Math.round(W / (v0 * CYC))), pw = W / m;   // m repeats across the width
        while (x < pw) { var bw = s * [.3, .5, .8][Math.floor(qq() * 3)], gp = s * [.35, .6, 1][Math.floor(qq() * 3)]; list.push([x, Math.min(bw, pw - x)]); x += bw + gp; }
        for (var rep = 0; rep <= m; rep++) list.forEach(function (b) { el('rect', { x: f(b[0] + rep * pw), y: f(BY0 + bi * rhB), width: f(b[1]), height: f(rhB + .5) }, rg); });
        rows.push({ g: rg, p: pw, off0: qq() * pw, off: 0, v: pw / CYC * (bi % 2 ? 1 : -1), t0: 0 });
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
          if (i === 0) { rand = rng(41); beat = 0; phase = 0; rows.forEach(function (r) { r.t0 = now; }); }   // the wrap (backlog 2.2): the same draws, beats and coil phase every cycle — seamless
          cfg = WINDOWS.slides[i]; var p0 = pal; pal = cfg.pal === 'cycle' ? (beat + 1) % PALS.length : cfg.pal;
          coilTo = i === 1 || i === 3 ? 1 : 0; if (instant) coilAmp = coilTo;
          if (i === 0) {
            roles = rolesOf(pal);
            // every window back to its own slot: snapped on a build, glided back on the wrap (a swapped window would jump)
            wins.forEach(function (w) {
              w.slot = w.i; w.tx = BASEX[w.i]; w.ty = SLOTY[w.i]; winG.appendChild(w.g);
              if (instant) { w.x = w.fx = w.tx; w.y = w.fy = w.ty; w.xt0 = w.yt0 = -1e9; } else { w.fx = w.x; w.fy = w.y; w.xt0 = w.yt0 = now; }
            });
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
          rows.forEach(function (r) { r.off = ((r.off0 + r.v * (now - r.t0) / 1000) % r.p + r.p) % r.p; r.g.setAttribute('transform', 'translate(' + f(-r.off) + ' 0)'); });
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

  var WINDOWS_MODEL = null;
  function loadWindowsModel(url) { return fetch(url).then(function (r) { return r.json(); }).then(function (j) { WINDOWS_MODEL = j; return j; }); }
  var WINDOWSFVS = {
    slides: WINDOWS.slides.map(function (s) { var o = {}; for (var k in s) o[k] = s[k]; o.brief = s.brief + ' Every texture is an FVS Component, one repeat of it tiled; the coil\u2019s ovals are an FVS Circle.'; return o; }),
    build: function (svg, W, H) { return WINDOWS.build(svg, W, H, WINDOWS_MODEL); },
  };

  P.define('windowsfvs', WINDOWSFVS, { slot: 'windows', set: function (j) { WINDOWS_MODEL = j; } });
})();
