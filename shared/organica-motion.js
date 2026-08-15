/* ─────────────────────────────────────────────────────────────
   ORGANICA — organica-motion.js
   The animation engine's own primitive contract: every source tool
   (Genesis, Strata, Pollen, Spore, Halide, Loom, Komorebi/Camo Turing/
   Warping's own posterised vector exports) already produces real SVG —
   that's the one thing every tool in this repo has in common, and per
   the engine's own scoping call, EVERYTHING becomes vectors before it
   reaches this module, raster included (Halide/Komorebi/Camo Turing/
   Warping already vectorise via the shared contour tracer in
   organica-core.js). So the primitive contract's input format is just
   "an SVG string" — no per-tool adapter needed, one parser covers every
   source.

   `parsePrimitives(svgString)` walks the SAME tag set Pollen's own
   `drawSvgEl()` canvas-replay function already handles (circle/ellipse/
   rect/path/polygon/polyline/line, recursing into <g>) — that function
   is the proven, shipped answer to "what shapes actually appear in an
   Organica SVG export," so the parser targets it directly rather than
   guessing at SVG's much larger tag surface.

   Every primitive gets a stable id, a type ('point' for circle/ellipse,
   'path' for everything else), and a bbox/cx/cy REGARDLESS of type —
   the one field every stagger/timeline formula needs (distance from
   centre, index, position), independent of what kind of shape it is.
   bbox comes from the browser's own SVGGeometryElement.getBBox() (a
   detached, invisible host SVG the parser owns) rather than hand-rolled
   path-curve-extrema math — reusing a real, already-correct engine
   capability instead of reimplementing it.

   Requires organica-core.js loaded first (extends window.Organica).
   ───────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  const Organica = global.Organica = global.Organica || {};
  const motion = {};

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SUPPORTED = new Set(['circle', 'ellipse', 'rect', 'path', 'polygon', 'polyline', 'line']);

  // A hidden SVG host purely so getBBox() has something real to measure.
  // First attempt kept this detached from the document entirely — WRONG,
  // caught by testing against a real Loom export rather than assumed:
  // Chromium returns an all-zero bbox for geometry inside an SVG that was
  // never actually attached to the document (no layout box exists to
  // measure), so every non-circle/ellipse primitive came back with
  // x/y/cx/cy/r all 0. Fixed by attaching the host once, positioned off
  // the visible page (not `display:none`, which suppresses layout in
  // exactly the way that broke this the first time) — same "hidden but
  // still laid out" convention already used elsewhere in this repo.
  let hostSVG = null;
  function getHost() {
    if (!hostSVG) {
      hostSVG = document.createElementNS(SVG_NS, 'svg');
      hostSVG.setAttribute('width', '0');
      hostSVG.setAttribute('height', '0');
      hostSVG.style.position = 'absolute';
      hostSVG.style.left = '-99999px';
      hostSVG.style.top = '-99999px';
      hostSVG.style.overflow = 'visible';
      document.body.appendChild(hostSVG);
    }
    return hostSVG;
  }

  function toGeometryEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    return el;
  }

  function numAttr(el, name, fallback) {
    const v = el.getAttribute(name);
    return v == null ? (fallback || 0) : parseFloat(v);
  }

  // Converts one source SVG element into the geometry element getBBox()
  // needs, mirroring drawSvgEl()'s own tag handling exactly so a shape
  // Pollen already knows how to draw is parsed identically here.
  function buildMeasurable(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'circle') return toGeometryEl('circle', { cx: numAttr(el, 'cx'), cy: numAttr(el, 'cy'), r: numAttr(el, 'r') });
    if (tag === 'ellipse') return toGeometryEl('ellipse', { cx: numAttr(el, 'cx'), cy: numAttr(el, 'cy'), rx: numAttr(el, 'rx'), ry: numAttr(el, 'ry') });
    if (tag === 'rect') return toGeometryEl('rect', { x: numAttr(el, 'x'), y: numAttr(el, 'y'), width: numAttr(el, 'width'), height: numAttr(el, 'height') });
    if (tag === 'path') return toGeometryEl('path', { d: el.getAttribute('d') || '' });
    if (tag === 'polygon' || tag === 'polyline') return toGeometryEl(tag, { points: el.getAttribute('points') || '' });
    if (tag === 'line') return toGeometryEl('line', { x1: numAttr(el, 'x1'), y1: numAttr(el, 'y1'), x2: numAttr(el, 'x2'), y2: numAttr(el, 'y2') });
    return null;
  }

  // Every Organica SVG exporter opens with a full-bleed background rect
  // (`<rect width="100%" height="100%" fill="..."/>` in svg-renderer.js,
  // `<rect width="${W}" height="${H}" fill="${bg}"/>` in Pollen's own
  // buildSVG, the same convention everywhere) — that's canvas backdrop,
  // not an animatable shape, and would otherwise show up as one giant
  // "primitive" covering the whole scene. Recognised structurally (origin
  // at 0,0 or unset, size matching the declared canvas or a literal
  // 100%/100%) rather than by position-in-document, since Pollen's isn't
  // always element 0 once a <g> wrapper is involved elsewhere.
  function isBackgroundRect(el, canvas) {
    if (el.tagName.toLowerCase() !== 'rect') return false;
    const x = numAttr(el, 'x'), y = numAttr(el, 'y');
    if (x !== 0 || y !== 0) return false;
    const wAttr = el.getAttribute('width'), hAttr = el.getAttribute('height');
    if (wAttr === '100%' && hAttr === '100%') return true;
    const w = parseFloat(wAttr), h = parseFloat(hAttr);
    return canvas.width > 0 && canvas.height > 0 && Math.abs(w - canvas.width) < 0.5 && Math.abs(h - canvas.height) < 0.5;
  }

  // fill/stroke/stroke-width are real SVG-inherited properties — Loom's
  // own SVG export (and likely others) sets them once on the wrapping
  // `<g fill="none" stroke="#3399ff" stroke-width="1">` rather than
  // repeating them on every child shape, exactly the way real SVG
  // rendering resolves style. A first version read only `el.getAttribute`
  // per element, missing anything set on an ancestor — caught live
  // (Loom's Hexagonal export rendered every hexagon in Soul's own
  // fallback colour, not the real #3399ff blue). `inherited` carries
  // whatever the nearest ancestor declared down to each leaf shape,
  // overridden by the element's own attribute when it has one.
  function walk(el, out, idCounter, canvas, inherited) {
    inherited = inherited || { fill: null, stroke: null, strokeWidth: null };
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (tag === 'g' || tag === 'svg') {
      const next = {
        fill: el.hasAttribute('fill') ? el.getAttribute('fill') : inherited.fill,
        stroke: el.hasAttribute('stroke') ? el.getAttribute('stroke') : inherited.stroke,
        strokeWidth: el.hasAttribute('stroke-width') ? numAttr(el, 'stroke-width') : inherited.strokeWidth,
      };
      Array.from(el.children).forEach(c => walk(c, out, idCounter, canvas, next));
      return;
    }
    if (!SUPPORTED.has(tag)) return;
    if (isBackgroundRect(el, canvas)) return;

    const measurable = buildMeasurable(el);
    if (!measurable) return;
    getHost().appendChild(measurable);
    let bbox;
    try { bbox = measurable.getBBox(); } catch (e) { bbox = { x: 0, y: 0, width: 0, height: 0 }; }
    getHost().removeChild(measurable);

    const cx = bbox.x + bbox.width / 2, cy = bbox.y + bbox.height / 2;
    const isPoint = tag === 'circle' || tag === 'ellipse';
    const fill = el.hasAttribute('fill') ? el.getAttribute('fill') : inherited.fill;
    const stroke = el.hasAttribute('stroke') ? el.getAttribute('stroke') : inherited.stroke;
    const strokeWidth = el.hasAttribute('stroke-width') ? numAttr(el, 'stroke-width') : inherited.strokeWidth;
    const prim = {
      id: 'prim' + (idCounter.n++),
      type: isPoint ? 'point' : 'path',
      tag,
      x: isPoint ? numAttr(el, 'cx') : cx,
      y: isPoint ? numAttr(el, 'cy') : cy,
      r: isPoint ? (numAttr(el, 'r') || Math.max(numAttr(el, 'rx'), numAttr(el, 'ry'))) : Math.max(bbox.width, bbox.height) / 2,
      bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
      cx, cy,
      fill,
      stroke,
      strokeWidth,
      // Original markup preserved verbatim — a renderer (CSS/GSAP/canvas)
      // can always fall back to re-drawing the exact source shape rather
      // than reconstructing it from the normalised fields above.
      sourceTag: tag,
      sourceAttrs: attrsOf(el),
    };
    out.push(prim);
  }

  function attrsOf(el) {
    const o = {};
    for (const a of el.attributes) o[a.name] = a.value;
    return o;
  }

  // @param {string} svgString - any Organica tool's own SVG export
  // @returns {{primitives:Array, canvas:{width,height}}}
  motion.parsePrimitives = function parsePrimitives(svgString) {
    const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.documentElement;
    if (!svgEl || svgEl.tagName.toLowerCase() !== 'svg') {
      throw new Error('Not a valid SVG document.');
    }
    const vb = svgEl.getAttribute('viewBox');
    let width = parseFloat(svgEl.getAttribute('width')) || 0;
    let height = parseFloat(svgEl.getAttribute('height')) || 0;
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4) { width = width || parts[2]; height = height || parts[3]; }
    }
    const out = [];
    const idCounter = { n: 0 };
    const canvas = { width, height };
    Array.from(svgEl.children).forEach(c => walk(c, out, idCounter, canvas));
    return { primitives: out, canvas };
  };

  // ═══════════════════════════════════════════════════════════
  // MOTION MODEL — pattern + stagger, applied to primitives via GSAP.
  //
  // The 6 patterns are `docs/ANIMATION-SYSTEM.md`'s own 6 physics
  // patterns, REBUILT parametric and GSAP-backed instead of hand-typed
  // per-form CSS keyframes — the exact gap that document itself implies
  // (every Genesis form re-derives the same physics by hand). Each
  // pattern function takes a real SVG element (not a canvas primitive
  // object) and returns a GSAP timeline/tween — GSAP needs a DOM/SVG
  // target to animate, which is why Soul's stage renders primitives as
  // real `<circle>`/`<path>` elements, not canvas draws, once animation
  // is involved (the primitive-parsing step above stays canvas-preview
  // for the static case, animation is SVG-native).
  //
  // "Collective behaviour" (Genesis's own 4th pattern) is deliberately
  // NOT a 7th pattern function here — its own header already says why:
  // "the same simple animation on many elements, phase-shifted" is
  // exactly what PATTERN + STAGGER composed together already gives you,
  // for free, on any of the other 5. Building it as a separate pattern
  // would duplicate one of the other 5 with a stagger bolted on.
  // ═══════════════════════════════════════════════════════════

  function requireGSAP() {
    if (typeof gsap === 'undefined') throw new Error('GSAP not loaded — include shared/gsap.min.js before calling Organica.motion pattern functions.');
    return gsap;
  }

  const PATTERNS = {
    // 1. Internal Pressure — scale, asymmetric compress/expand, real
    // biological pressure systems (breath, heartbeat, bloom).
    pressure: function (el, p) {
      const g = requireGSAP();
      const amt = p.amount != null ? p.amount : 0.25;
      const dur = p.duration || 3.4;
      const tl = g.timeline({ repeat: -1, defaults: { transformOrigin: '50% 50%' } });
      tl.to(el, { scale: 1 + amt * 0.32, duration: dur * 0.55, ease: 'sine.out' })
        .to(el, { scale: 1 - amt * 0.72, duration: dur * 0.45, ease: 'sine.inOut' });
      return tl;
    },

    // 2. Gravity + Viscosity — translateY + scaleY, stretch on fall,
    // squash on impact. Real percentage keyframes, same shape as the
    // CSS original (`docs/ANIMATION-SYSTEM.md`'s own honey-drip example).
    gravity: function (el, p) {
      const g = requireGSAP();
      const amt = p.amount != null ? p.amount : 1;
      const dur = p.duration || 1.8;
      return g.to(el, {
        transformOrigin: '50% 0%',
        repeat: -1,
        duration: dur,
        ease: 'none',
        keyframes: {
          '0%': { y: 0, scaleY: 1 },
          '40%': { y: 8 * amt, scaleY: 1 + 1.6 * amt, ease: 'power1.in' },
          '55%': { y: 20 * amt, scaleY: 1 + 1.2 * amt },
          '70%': { y: 40 * amt, scaleY: 1 - 0.1 * amt, opacity: 0.9, ease: 'power2.out' },
          '100%': { y: 60 * amt, scaleY: 1 - 0.1 * amt, opacity: 0 },
        },
      });
    },

    // 3. Growth by Tracing — DrawSVG is the exact, direct match for
    // this pattern (stroke-dashoffset animated 0→100%), no approximation
    // needed. Falls back to a manual stroke-dasharray tween if DrawSVG
    // wasn't registered, so the pattern still runs (a straight, honest
    // degrade, not a silent no-op).
    growth: function (el, p) {
      const g = requireGSAP();
      const dur = p.duration || 2.6;
      if (g.plugins && (g.plugins.drawSVG || typeof DrawSVGPlugin !== 'undefined')) {
        return g.fromTo(el, { drawSVG: '0%' }, { drawSVG: '100%', duration: dur, repeat: -1, ease: 'power1.inOut' });
      }
      const len = el.getTotalLength ? el.getTotalLength() : 100;
      g.set(el, { strokeDasharray: len, strokeDashoffset: len });
      return g.to(el, { strokeDashoffset: 0, duration: dur, repeat: -1, ease: 'power1.inOut' });
    },

    // 5. Environmental Forces — continuous, uniform drift (wind,
    // current). Linear easing, deliberately not eased in/out — that's
    // what distinguishes an external force from a biological one, per
    // the same document's own header.
    environmental: function (el, p) {
      const g = requireGSAP();
      const amt = p.amount != null ? p.amount : 20;
      const dur = p.duration || 6;
      const axis = p.axis === 'y' ? 'y' : 'x';
      const tl = g.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'none', duration: dur / 2 } });
      tl.to(el, { [axis]: amt }).to(el, { [axis]: -amt });
      return tl;
    },

    // 6. Differential Rotation — counter-spinning layers. At the single-
    // primitive level (no explicit "layer" grouping exists yet), applied
    // per-primitive with direction alternating by index parity — real
    // differential rotation between neighbours, the same visual idea as
    // two counter-spinning layers, just decided per-element instead of
    // per-declared-layer since Soul has no layer concept yet.
    rotation: function (el, p, ctx) {
      const g = requireGSAP();
      const dur = p.duration || 8;
      const dir = (ctx && ctx.index % 2 === 0) ? 1 : -1;
      return g.to(el, { rotation: '+=' + (360 * dir), transformOrigin: '50% 50%', duration: dur, repeat: -1, ease: 'none' });
    },
  };

  // Stagger — a per-primitive delay formula, the composable half of
  // "collective behaviour" (see PATTERNS' own header). Pure function of
  // (primitive, index, all primitives, config) → delay in seconds, so
  // it can be computed once per primitive and handed to GSAP's own
  // timeline `delay` option, no dependency on GSAP's own (position-
  // string-only) stagger DSL.
  function staggerDelay(prim, index, all, cfg) {
    cfg = cfg || {};
    const by = cfg.by || 'none';
    const amount = cfg.amount != null ? cfg.amount : 0.15;
    if (by === 'none' || !amount) return 0;
    if (by === 'index') return index * amount;
    if (by === 'distance') {
      const cx = cfg.originX != null ? cfg.originX : all.reduce((s, p) => s + p.cx, 0) / all.length;
      const cy = cfg.originY != null ? cfg.originY : all.reduce((s, p) => s + p.cy, 0) / all.length;
      const dist = Math.hypot(prim.cx - cx, prim.cy - cy);
      const maxDist = Math.max(1, ...all.map(p => Math.hypot(p.cx - cx, p.cy - cy)));
      return (dist / maxDist) * amount * all.length * 0.3;
    }
    if (by === 'noise') {
      const scale = cfg.noiseScale || 0.006;
      const n = noise.simplexFbm2(prim.cx * scale, prim.cy * scale);   // reuses this file's own Simplex noise, not a separate RNG
      return ((n + 1) / 2) * amount * all.length * 0.3;
    }
    return 0;
  }

  // Applies one pattern to every element in `targets` (parallel to
  // `primitives`, same index), staggered per `staggerCfg`, returns the
  // list of GSAP tweens/timelines created (so the caller can pause/kill
  // them without re-deriving what was built).
  motion.animate = function animate(targets, primitives, patternName, patternParams, staggerCfg) {
    const fn = PATTERNS[patternName];
    if (!fn) throw new Error('Unknown pattern: ' + patternName);
    const tweens = [];
    targets.forEach((el, i) => {
      const tween = fn(el, patternParams || {}, { index: i, primitive: primitives[i] });
      const d = staggerDelay(primitives[i], i, primitives, staggerCfg);
      if (d) tween.delay(d);
      tweens.push(tween);
    });
    return tweens;
  };

  motion.PATTERNS = PATTERNS;
  motion.staggerDelay = staggerDelay;

  Organica.motion = motion;
})(window);
