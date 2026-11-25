/* ═══════════════════════════════════════════════════════════
   Organica.monogram — the 0rganic4 monogram (Nov 24, 2026).

   One Element, the Overprint Segment: a round-capped stroke. Length 0 is
   a circle, length > 0 a pill. The loop (≈2.1 s at speed 1.5):
     1  the ink circle — the mark at rest, exactly the old header circle
     2  it shrinks to a smaller red circle and, without stopping,
     3  stretches into a teal pill
     4  the pill copies itself; the copies open about the centre, each a
        new riso ink, overprinted (multiply), and spin one fast full turn
     5  they close straight back into the ink circle
   Designed on the "0rganic4 — animated logotype" canvas (Monogram 04 page).

     Organica.monogram.mount(host, opts) → { play(), stop(), frame(ms), destroy() }
       opts.trigger  'hover' (default) — plays while opts.target (default: the
                     host's closest <a>, else the host) is hovered or focused,
                     keeps looping, and on leave finishes its loop and stops
                     on the circle · 'loop' — plays for ever · 'none' — still
       opts.count 6 · opts.thick .34 (pill width, of the circle) · opts.speed 1.5
     Organica.monogram.frameSVG(ms, opts) → the SVG markup of one frame
       (the favicon is frame 1999: the rosette fully open, its turn done)

   Auto-mount: every .org-header__mark on a page that loads this file becomes
   the monogram, hovered through its .org-header__logo link.

   Colours: the rest circle is the host's own colour (var(--ink) through
   currentColor, so it follows the theme); the riso inks are the mark's
   artwork — fixed, like a tool's content colours (ledger §3) — and multiply
   only with each other: the SVG is isolated (header.css .org-monogram), so one
   rule holds in both themes. Reduced motion: never plays, and snaps back to
   the circle if it is turned on mid-loop. Focus plays only on :focus-visible.
   Load anywhere after the header markup; no dependencies.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var O = window.Organica = window.Organica || {};
  var NS = 'http://www.w3.org/2000/svg';
  var RED = '#e5000d', TEAL = '#67c3b7';
  var INKS = ['#67c3b7', '#fff23f', '#ff48b0', '#1a439b', '#e5000d', '#8f6aa5', '#fff23f', '#67c3b7'];
  var CYCLE = 3100, D = 84;

  function ease(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return (1 - Math.cos(Math.PI * t)) / 2; }
  function rgbOf(c) {
    if (c.charAt(0) === '#') return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); });
    var m = c.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2]] : [17, 17, 17];
  }
  function mix(a, b, t) { var x = rgbOf(a), y = rgbOf(b); return 'rgb(' + x.map(function (v, i) { return Math.round(v + (y[i] - v) * t); }).join(',') + ')'; }

  // the state at time t (ms of the loop): the base Element (length L, width W of D, colour) and the radial (r 0..1, spin °)
  function state(t, ink, o) {
    var w = o.thick, L, W, col;
    if (t < 350) { L = 0; W = 1; col = ink; }                                         // 1 · the circle
    else if (t < 1150) {                                                              // 2 → 3 in one move
      var u = (t - 350) / 800;
      W = 1 - (1 - w) * ease(u / .6); L = (1 - w) * ease((u - .4) / .6);
      col = u < .5 ? mix(ink, RED, ease(u * 2)) : mix(RED, TEAL, ease(u * 2 - 1));
    } else if (t < 2000) { L = 1 - w; W = w; col = TEAL; }                             // 3 · the pill (opens, below)
    else if (t < 2500) { var k = ease((t - 2000) / 500); L = (1 - w) * (1 - k); W = w + (1 - w) * k; col = mix(TEAL, ink, k); }   // 5
    else { L = 0; W = 1; col = ink; }
    var r = t < 1150 ? 0 : t < 1700 ? ease((t - 1150) / 550) : t < 2000 ? 1 : t < 2250 ? 1 - ease((t - 2000) / 250) : 0;
    var spin = t >= 1550 && t < 2000 ? 360 * ease((t - 1550) / 450) : 0;
    return { L: L, W: W, col: col, r: r, spin: spin };
  }
  function pills(t, ink, o) {
    var s = state(t, ink, o), n = s.r > 0 ? o.count : 1, half = s.L * D / 2, out = [];
    for (var c = 0; c < n; c++) out.push({
      y1: 50 - half, y2: 50 + half, w: s.W * D, c: c === 0 ? s.col : INKS[c % INKS.length],
      o: c === 0 ? 1 : Math.min(1, s.r * 3), a: c * (180 / o.count) * s.r + s.spin
    });
    return out;
  }
  function opts(o) {
    o = o || {};
    return { count: o.count || 6, thick: o.thick || .34, speed: o.speed || 1.5, trigger: o.trigger || 'hover', target: o.target, ink: o.ink };
  }
  function f(n) { return Math.round(n * 1000) / 1000; }

  function mount(host, o) {
    o = opts(o);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', 'org-monogram'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var lines = [];
    for (var i = 0; i < o.count; i++) {
      var l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', 50); l.setAttribute('x2', 50); l.setAttribute('stroke-linecap', 'round');
      l.setAttribute('class', 'org-monogram__pill'); svg.appendChild(l); lines.push(l);
    }
    host.textContent = ''; host.appendChild(svg); host.classList.add('org-monogram-host');
    var raf = 0, t0 = 0, hover = false, endAt = Infinity;
    function ink() { return getComputedStyle(host).color; }
    function draw(t) {
      var rest = t === 0, ps = pills(t, rest ? '#111111' : ink(), o);
      lines.forEach(function (l, i) {
        var p = ps[i];
        if (!p) { l.setAttribute('display', 'none'); return; }
        l.removeAttribute('display');
        l.setAttribute('y1', f(p.y1)); l.setAttribute('y2', f(p.y2)); l.setAttribute('stroke-width', f(p.w));
        l.setAttribute('stroke', rest ? 'currentColor' : p.c); l.setAttribute('opacity', f(p.o));   // at rest: the theme's ink, live
        l.setAttribute('transform', 'rotate(' + f(p.a) + ' 50 50)');
      });
    }
    function tick(now) {
      var e = (now - t0) * o.speed;
      if (e >= endAt) { raf = 0; draw(0); return; }
      draw(e % CYCLE); raf = requestAnimationFrame(tick);
    }
    var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    function reduced() { return !!(mq && mq.matches); }
    function play() {
      hover = true; endAt = Infinity;
      if (raf || reduced()) return;
      t0 = performance.now(); raf = requestAnimationFrame(tick);
    }
    function snap() { if (reduced()) { cancelAnimationFrame(raf); raf = 0; draw(0); } }   // reduced motion turned on mid-loop
    function stop() {                         // finish the loop in progress, then rest on the circle
      if (!hover) return; hover = false;
      if (!raf) return;
      var e = (performance.now() - t0) * o.speed; endAt = Math.ceil(e / CYCLE) * CYCLE;
    }
    var target = o.target || host.closest('a') || host, on = [];
    function listen(el, ev, fn) { el.addEventListener(ev, fn); on.push([el, ev, fn]); }
    if (o.trigger === 'hover') {
      listen(target, 'pointerenter', play); listen(target, 'pointerleave', stop);
      listen(target, 'focus', function () { if (target.matches(':focus-visible')) play(); }); listen(target, 'blur', stop);
    } else if (o.trigger === 'loop') play();
    if (mq) listen(mq, 'change', snap);
    draw(0);
    return {
      play: play, stop: stop, frame: function (ms) { draw(ms % CYCLE); },
      destroy: function () { cancelAnimationFrame(raf); on.forEach(function (x) { x[0].removeEventListener(x[1], x[2]); }); host.textContent = ''; host.classList.remove('org-monogram-host'); }
    };
  }

  function frameSVG(ms, o) {
    o = opts(o);
    var ink = o.ink || '#111111';
    return '<svg xmlns="' + NS + '" viewBox="0 0 100 100"><g style="isolation:isolate">' + pills(ms, ink, o).map(function (p) {
      return '<line x1="50" x2="50" y1="' + f(p.y1) + '" y2="' + f(p.y2) + '" stroke="' + p.c + '" stroke-width="' + f(p.w) +
        '" stroke-linecap="round" opacity="' + f(p.o) + '" transform="rotate(' + f(p.a) + ' 50 50)" style="mix-blend-mode:multiply"/>';
    }).join('') + '</g></svg>';
  }

  O.monogram = { mount: mount, frameSVG: frameSVG, CYCLE: CYCLE, INKS: INKS };

  function auto() {
    [].forEach.call(document.querySelectorAll('.org-header__mark'), function (m) {
      if (!m.classList.contains('org-monogram-host')) mount(m, { trigger: 'hover', target: m.closest('.org-header__logo') || undefined });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
