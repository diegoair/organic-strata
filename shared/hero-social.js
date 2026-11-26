/* ─────────────────────────────────────────────────────────────────────────────
 * hero-social.js — Organica.heroSocial: a home-hero loop as a social source.
 *
 * Nov 25, 2026 (docs/SOCIAL-EXPORT.md P3). Wraps one of the eight FVS loops
 * of Organica.hero (A–H) in the source contract of Organica.socialExport, so
 * the hub's Export for social (and any script) can post it. Lifted from the
 * capture page explorations/home-mockups/ig-export.html.
 *
 *   const src = Organica.heroSocial.source('f', { aspect });   // a … h; aspect() → the page's own hero, w / h (optional)
 *   const res = await Organica.socialExport.bundle(src, { formats, stills, reels });
 *   src.close();                                    // bundle also calls it
 *
 * layout(W, H) mounts the loop off screen at that size (each loop lays itself
 * out for the format — G even loads a model per format), pauses its clock and
 * PRE-ROLLS one full cycle: frame 0 is where the cycle ends, so a reel loops
 * seamlessly and never opens on an empty sheet. seek(ms) runs the loop's own
 * clock forward in its own steps (re-mounting to go back). svg() is the frame.
 *
 * The loop's word slides are HTML overlays, not in the SVG: they do not reach
 * the files (as in the capture page). Text inside the SVG draws with the
 * browser's fallback font (an SVG drawn through <img> loads no web fonts).
 *
 * LOAD ORDER: core.js → hero.js → zip.js → mp4.js → social-export.js → hero-social.js.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const O = global.Organica || (global.Organica = {});
  const READY_MS = 8000;

  const cycleOf = L => L.kind ? O.heroPlayer.cycleMs(L.kind) : O.heroLoop.SLIDES.reduce((a, s) => a + s.dur, 0);   // real ms (the player's SPEED applied)

  function source(key, opts = {}) {
    key = String(key || '').toLowerCase();
    const L = O.hero && O.hero.LOOPS[key];
    if (!L) throw new Error('heroSocial: no loop ' + key);
    const step = L.kind ? 1000 / 30 : 32;   // the sheets' clock; HeroLoop's runs in 16 ms ticks, two a frame (31.25 fps)
    let host = null, handle = null, loop = null, at = 0, W = 0, H = 0;

    function unmount() {
      if (handle) handle.stop();
      if (host) host.remove();
      host = handle = loop = null;
    }
    // The cycle is OBSERVED, not summed: each slide drops the part of a step that runs past its end, so a real cycle is a
    // few steps longer than the slides' ms add up to. The pre-roll runs from go(0) to the wrap back to slide 1 (the hero's
    // onProgress falls from ~1 to 0) and counts the steps of the next full cycle: that count is the reel's frame count, so
    // frame n would be frame 0 again.
    let p = 0;
    function run(steps) { for (let i = 0; i < steps; i++) loop.advance(step); }
    const stepsOf = ms => Math.round(ms / step);
    function toWrap(max) { let n = 0, prev = p; for (; n < max; n++) { loop.advance(step); if (p < prev - 0.5) return n + 1; prev = p; } return 0; }
    function preroll() {
      loop.go(0); p = 0;
      const nominal = stepsOf(cycleOf(L)), max = nominal * 2 + 60;
      if (!toWrap(max)) throw new Error('heroSocial: the loop ' + L.name + ' never wrapped');   // to the end of the first cycle
      period = toWrap(max) || nominal;   // one whole cycle, counted — and back at its start
      src.cycleMs = period * step; at = 0;
    }
    let period = 0, shown = null;
    // A loop whose model follows the format (G · Overprint) loads it into a slot the page's own copy shares, and that copy
    // rebuilds from the slot on a resize that keeps its model name: on close, put back the model for the page's aspect.
    function restore() {
      if (!L.slot || typeof L.model !== 'function' || !opts.aspect || !shown || shown.key !== key) return;
      fetch('/shared/hero/' + L.model(opts.aspect()) + '.json').then(r => r.json()).then(j => O.heroPlayer.setModel(L.slot, j)).catch(() => {});
    }
    async function layout(w, h) {
      unmount();   // always a fresh mount: go(0) from wherever a loop was left is not the same frame (its transitions start from there)
      W = w; H = h;
      host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.dataset.theme = 'light';   // a work surface
      Object.assign(host.style, { position: 'fixed', left: '0', top: '0', width: w + 'px', height: h + 'px', overflow: 'hidden', transform: 'translateX(-200vw)', pointerEvents: 'none' });
      document.body.appendChild(host);
      let failed = null;
      shown = O.hero.current;   // the page's own loop: mount() takes O.hero.current, give it back
      handle = O.hero.mount(host, { key, onProgress: v => { p = v; }, fallback: () => { failed = new Error('heroSocial: the loop ' + L.name + ' could not load'); } });
      O.hero.current = shown;
      const t0 = performance.now();
      while (!(loop = handle.loop()) && !failed) {
        if (performance.now() - t0 > READY_MS) { failed = new Error('heroSocial: the loop ' + L.name + ' took too long to load'); break; }
        await new Promise(r => setTimeout(r, 40));
      }
      if (failed) { unmount(); throw failed; }
      loop.pause(true);
      preroll();
    }
    function seek(ms) {
      const to = stepsOf(ms);
      if (to < at) preroll();   // back: start the cycle again
      run(to - at); at = to;   // at: steps since the cycle start
    }
    function svg() {
      const s = host && host.querySelector('svg');
      if (!s) throw new Error('heroSocial: the loop drew no SVG');
      const c = s.cloneNode(true);
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      c.setAttribute('width', W); c.setAttribute('height', H);
      c.removeAttribute('style'); c.removeAttribute('aria-hidden'); c.removeAttribute('class');
      return new XMLSerializer().serializeToString(c);
    }
    const src = {
      name: 'organica-' + L.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: L.name, paper: '#ffffff', fps: 1000 / step,
      cycleMs: (L.kind ? O.heroPlayer && O.heroPlayer.KINDS[L.kind] && cycleOf(L) : O.heroLoop && cycleOf(L)) || 1,   // the real length once layout() has loaded the loop (its file may not be loaded yet)
      layout, seek, svg, close: () => { unmount(); restore(); },
    };
    return src;
  }

  O.heroSocial = { source };
})(window);
