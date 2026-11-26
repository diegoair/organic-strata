/* ═══════════════════════════════════════════════════════════
   Organica.heroPlayer — the one player of the home-hero loops (backlog 2.1, Nov 26, 2026;
   was the mount of shared/hero-sheets.js). A loop is data + an engine, one file each in
   shared/hero-loops/ (bands, windows, morph, dots, weave, print, stacks), registered with

     Organica.heroPlayer.define(kind, { slides: [{ title, ms, pal, brief, … }], build(svg, W, H) },
                                { slot, set(json) })        // slot: its model in shared/hero/, if it has one

   The player owns everything that is not the picture: the clock (SPEED × real time), the
   slides and their order, the entrance (intro), reduced motion / still, visibility, the
   format (a resize rebuilds), progress, pause, stats.

     Organica.heroPlayer.mount(host, { kind, start, lock, still, intro, label, onSlide, onProgress })
       → { go(i), next(), prev(), reroll(), pause(bool), stats(), advance(ms), stop() }
     Organica.heroPlayer.setModel(slot, json)   hand a fetched model to its loop
     Organica.heroPlayer.cycleMs(kind)          one cycle in real ms (the slides' ms / SPEED)

   Organica.heroSheets is the same object (the name shared/hero.js, hero-social.js and the
   hub knew). C · The score is not on it: shared/hero-loop.js keeps its own clock, and its
   four palettes, which every loop reads (load hero-loop.js first).

   Inline SVG, one rAF clock, nothing runs while hidden or off screen;
   reduced motion (or still: true) gives one settled still per slide.
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

  // ── the loops, as they are defined (one file each, shared/hero-loops/) ──
  // the clock of every loop runs SPEED × real time (Diego, Nov 26, 2026: faster — 1.15, then 1.35)
  var SPEED = 1.35;
  var KINDS = {}, SLOTS = {};
  function define(kind, spec, model) { KINDS[kind] = spec; if (model && model.slot) SLOTS[model.slot] = model.set; }

  // ═════════ the mount: clock, slides, life ═════════
  function mount(host, opts) {
    opts = opts || {};
    var K = KINDS[opts.kind]; if (!K) throw new Error('heroPlayer: no loop ' + opts.kind + ' (load its shared/hero-loops/ file)');
    var slides = K.slides, n = slides.length;
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
      ms *= SPEED; tS += ms; view.step(ms);   // the loop's own clock runs SPEED × real time: every beat, transition and drift, and the slides
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
  function setModel(name, j) { if (SLOTS[name]) SLOTS[name](j); }
  function cycleMs(kind) { var K = KINDS[kind]; return K ? K.slides.reduce(function (a, s) { return a + s.ms; }, 0) / SPEED : 0; }

  var api = { define: define, mount: mount, setModel: setModel, cycleMs: cycleMs, KINDS: KINDS, SPEED: SPEED,
    util: { NS: NS, HL: HL, PALS: PALS, el: el, rng: rng, f: f, clamp: clamp, ease: ease, rgb: rgb, mix: mix, lum: lum, many: many } };
  window.Organica.heroPlayer = window.Organica.heroSheets = api;
})();
