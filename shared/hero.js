/* ═══════════════════════════════════════════════════════════
   Organica.hero — the home hero: one FVS loop per visit.

     Organica.hero.mount(host, { fallback, key, onProgress, onEnd })
       → { key, name, stats(), loop(), stop() }   (also kept as Organica.hero.current)

   Eight loops (A–H), each drawn by FVS and animated as a model
   (shared/hero-loop.js, shared/hero-sheets.js, models in shared/hero/).
   A visit loads ONLY the scripts and the one model its loop needs.
   Which loop: ?hero=a…h (author's test), else the next in ROTATION
   after the last one shown (localStorage organica.hub.hero; the
   first visit starts anywhere).
   If the loop cannot load (network, script error, 4 s), opts.fallback()
   runs once and the loop is dropped.
   A carousel names the loop itself: opts.key (no rotation, nothing stored),
   opts.onProgress(p) with p 0..1 over the loop's whole cycle, opts.onEnd()
   when the cycle is over; Organica.hero.preload(key, host) fetches the next
   loop's scripts and model ahead.

   The host must be an element of its own: a loop empties it.
   Load AFTER core.js. Colours are content (the loops' palettes).
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var O = window.Organica = window.Organica || {};
  var DIR = '/shared/hero/', KEY = 'organica.hub.hero', TIMEOUT = 4000;
  var LOOP = '/shared/hero-loop.js', SHEETS = [LOOP, '/shared/hero-sheets.js'];
  var SHADING = ['/shared/color.js', '/shared/noise.js', '/shared/shade-marks.js', '/shared/shading.js'];

  // G's tiles hold for one stage proportion: one model per format
  function printModel(aspect) { return aspect >= 1.2 ? 'print-model' : aspect >= 0.65 ? 'print-model-4x5' : 'print-model-9x16'; }

  var LOOPS = {
    a: { name: 'Bands', kind: 'bandsfvs', scripts: SHADING.concat(SHEETS) },
    b: { name: 'Windows', kind: 'windowsfvs', scripts: SHEETS, slot: 'windows', model: 'windows-model' },
    c: { name: 'The score', scripts: [LOOP], model: 'score-model' },
    d: { name: 'Morph sheet', kind: 'morphfvs', scripts: SHEETS, slot: 'morph', model: 'morph-model' },
    e: { name: 'Dot score', kind: 'dotsfvsov', scripts: SHEETS, slot: 'dots', model: 'dots-model' },
    f: { name: 'Weave', kind: 'weavefvs', scripts: SHEETS, slot: 'weave', model: 'weave-tiles' },
    g: { name: 'Overprint', kind: 'printfvs', scripts: SHEETS, slot: 'print', model: printModel },
    h: { name: 'Stacks', kind: 'stacksfvs', scripts: SHEETS, slot: 'stacks', model: 'stacks-model' },
  };
  // The order a returning visitor sees the loops in. A loop left out of this list is never shown.
  // C · The score is out until its paint cost is fixed (Nov 24, 2026, 1359 × 778 at 2×: 16–22 fps on the haze and
  // word slides, script under 1 ms: the cost is the SVG haze filter). It still runs with ?hero=c.
  var ROTATION = ['a', 'b', 'd', 'e', 'f', 'g', 'h'];

  // ── loading: a script once, in order; a model once ──
  var scriptOf = {}, modelOf = {};
  function script(src) {
    if (scriptOf[src]) return scriptOf[src];
    if (document.querySelector('script[src="' + src + '"]')) return (scriptOf[src] = Promise.resolve());   // already on the page
    return (scriptOf[src] = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = src; s.async = false;
      s.onload = function () { ok(); }; s.onerror = function () { delete scriptOf[src]; no(new Error('hero: ' + src)); };
      document.head.appendChild(s);
    }));
  }
  function scripts(list) { return list.reduce(function (p, src) { return p.then(function () { return script(src); }); }, Promise.resolve()); }
  function model(name) {
    return modelOf[name] || (modelOf[name] = fetch(DIR + name + '.json').then(function (r) {
      if (!r.ok) throw new Error('hero: ' + name + ' ' + r.status);
      return r.json();
    }).catch(function (e) { delete modelOf[name]; throw e; }));
  }

  // ── which loop this visit ──
  function pick() {
    var q = (new URLSearchParams(location.search).get('hero') || '').toLowerCase();
    if (LOOPS[q]) return q;
    var last = null;
    try { last = localStorage.getItem(KEY); } catch (e) {}
    var i = ROTATION.indexOf(last);
    var key = ROTATION[i < 0 ? Math.floor(Math.random() * ROTATION.length) : (i + 1) % ROTATION.length];
    try { localStorage.setItem(KEY, key); } catch (e) {}
    return key;
  }

  // fetch a loop's scripts and model before it is shown (host: the stage it will fill, for a model that follows the format)
  function preload(key, host) {
    var L = LOOPS[key]; if (!L) return;
    var name = typeof L.model === 'function' ? L.model(host ? host.clientWidth / Math.max(1, host.clientHeight) : 1.6) : L.model;
    scripts(L.scripts).catch(function () {}); if (name) model(name).catch(function () {});
  }

  function mount(host, opts) {
    opts = opts || {};
    var key = LOOPS[opts.key] ? opts.key : pick(), L = LOOPS[key], loop = null, dead = false, ro = null, wait = 0, shown = '';
    // the loop's own slides, as one cycle: where it is (0..1) and when it is over
    var durs = [], total = 0, at = 0, slide = 0, ended = false;
    function onSlide(i) { slide = i; at = 0; for (var k = 0; k < i; k++) at += durs[k]; }
    function onProgress(p) {
      if (opts.onProgress && total) opts.onProgress(Math.min(1, (at + p * durs[slide]) / total));
      if (p >= 1 && slide === durs.length - 1 && !ended && opts.onEnd) { ended = true; setTimeout(function () { if (!dead) opts.onEnd(); }, 0); }
    }
    function aspect() { return host.clientWidth / Math.max(1, host.clientHeight); }
    function modelName() { return typeof L.model === 'function' ? L.model(aspect()) : L.model; }
    function fail(e) {
      if (dead) return;
      stop();
      if (opts.fallback) opts.fallback(e);
    }
    function start(name, json) {
      if (dead) return;
      if (loop) { loop.stop(); loop = null; }
      shown = name || '';
      durs = L.kind ? O.heroSheets.KINDS[L.kind].slides.map(function (s) { return s.ms; }) : O.heroLoop.SLIDES.map(function (s) { return s.dur; });
      total = durs.reduce(function (a, b) { return a + b; }, 0); at = 0; slide = 0; ended = false;
      if (L.kind) {
        if (L.slot) O.heroSheets.setModel(L.slot, json);
        loop = O.heroSheets.mount(host, { kind: L.kind, label: false, onSlide: onSlide, onProgress: onProgress });
      } else {
        loop = O.heroLoop.mount(host, { concept: 'C', element: 'bloom', fvs: json, label: false, onSlide: onSlide, onProgress: onProgress });
      }
      host.classList.add('is-on');
    }
    function load() {
      var name = modelName();
      return Promise.all([scripts(L.scripts), name ? model(name) : null]).then(function (r) { start(name, r[1]); });
    }
    function stop() {
      dead = true; clearTimeout(timer); clearTimeout(wait);
      if (ro) ro.disconnect();
      if (loop) { loop.stop(); loop = null; }
    }
    var timer = setTimeout(function () { if (!loop) fail(new Error('hero: timeout')); }, TIMEOUT);
    load().then(function () {
      clearTimeout(timer);
      if (dead || typeof L.model !== 'function') return;
      // a loop whose model follows the format: when the stage crosses into another format, take that model
      ro = new ResizeObserver(function () {
        clearTimeout(wait);
        wait = setTimeout(function () { if (!dead && modelName() !== shown) load().catch(function () {}); }, 250);
      });
      ro.observe(host);
    }).catch(fail);
    return (O.hero.current = { key: key, name: L.name, stats: function () { return loop && loop.stats ? loop.stats() : null; }, loop: function () { return loop; }, stop: stop });
  }

  O.hero = { mount: mount, preload: preload, scripts: scripts, LOOPS: LOOPS, ROTATION: ROTATION };
})();
