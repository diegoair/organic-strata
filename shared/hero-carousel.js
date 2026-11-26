/* Organica.heroCarousel — the carousel of FVS loops, one per slide (Nov 26, 2026, lifted out of the home).
   The home shows Organica.hero.HOME; /design-system/_hero-loops.html, the work page, shows every loop.
   Organica.hero loads only the loop on screen, and the next one ahead. A loop plays its own cycle, then the
   next one takes the stage. ?hero=<key> starts on that loop when it is in the list.
   carousel({ root, stage, bars, count, prev, next, ui, keys }) → { show(i), keys }  (ui: the controls; over them the loop pauses) */
(function () {
  'use strict';
  var O = window.Organica = window.Organica || {};
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function carousel(o) {
    var H = O.hero, KEYS = (o.keys || Object.keys(H.LOOPS)).filter(function (k) { return H.LOOPS[k]; }), N = KEYS.length;
    var cur = 0, handle = null, failed = 0;
    var barEls = KEYS.map(function (k, i) {
      var b = document.createElement('button'); b.type = 'button';
      b.setAttribute('aria-label', 'Composition ' + (i + 1) + ': ' + H.LOOPS[k].name); b.innerHTML = '<i></i>';
      b.onclick = function () { show(i); }; o.bars.appendChild(b); return b;
    });
    function show(i) {
      cur = ((i % N) + N) % N;
      var key = KEYS[cur];
      if (handle) handle.stop();
      o.stage.textContent = '';
      barEls.forEach(function (b, k) { b.classList.toggle('is-done', k < cur); b.firstChild.style.transform = ''; b.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
      o.stage.setAttribute('aria-label', (cur + 1) + ' of ' + N + ': ' + H.LOOPS[key].name);
      o.count.textContent = pad(cur + 1) + ' / ' + pad(N);
      var mine = handle = H.mount(o.stage, { key: key, intro: true,   // the loop starts moving at once: its first slide plays its entrance
        onProgress: function (p) { if (handle === mine) { failed = 0; barEls[cur].firstChild.style.transform = 'scaleX(' + p + ')'; } },
        onEnd: function () { if (handle === mine) show(cur + 1); },
        fallback: function () { if (handle === mine && ++failed < N) show(cur + 1); },   // a loop that cannot load is skipped
      });
      H.preload(KEYS[(cur + 1) % N], o.stage);
      if (o.onShow) o.onShow(key, cur);
    }
    function loop() { return handle && handle.loop(); }
    function pause(b) { var l = loop(); if (l) l.pause(b); }
    // the pointer plays with the picture, so it pauses only over the controls (and while they hold the focus)
    if (o.ui) {
      o.ui.addEventListener('mouseenter', function () { pause(true); }); o.ui.addEventListener('mouseleave', function () { pause(false); });
      o.ui.addEventListener('focusin', function () { pause(true); }); o.ui.addEventListener('focusout', function () { pause(false); });
    }
    o.stage.addEventListener('click', function (e) { var l = loop(), r = o.stage.getBoundingClientRect(); if (l) l.reroll(e.clientX - r.left, e.clientY - r.top); });
    o.prev.onclick = function () { show(cur - 1); };
    o.next.onclick = function () { show(cur + 1); };
    addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (o.root.getBoundingClientRect().bottom < innerHeight / 2) return;   // only while the carousel is what the visitor is looking at
      if (e.key === 'ArrowRight') show(cur + 1); if (e.key === 'ArrowLeft') show(cur - 1);
    });
    var q = (new URLSearchParams(location.search).get('hero') || '').toLowerCase();
    show(Math.max(0, KEYS.indexOf(q)));
    return { show: show, keys: KEYS };
  }
  O.heroCarousel = carousel;
})();
