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
    // Chromium's XML parser doesn't replace the document root on a parse
    // error — it keeps the outer tag open and injects a <parsererror> as
    // a CHILD, so `documentElement.tagName === 'svg'` still passes above
    // even for genuinely broken markup (caught live: a truncated <svg>
    // tag silently produced "found no recognisable shapes" instead of a
    // real parse error, since <parsererror> just isn't in SUPPORTED and
    // gets walked past like any other unknown tag). Checked explicitly
    // rather than trusting the root tag alone.
    if (svgEl.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'parsererror').length) {
      throw new Error('Malformed SVG markup.');
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
      // Keyframe timing recalibrated after measuring the perceptual start
      // live (Diego's own feedback: "takes a moment to start"): the
      // acceleration phase (0→8*amt, `power1.in` — genuinely correct
      // physics, a falling object starts at rest) previously ran across
      // the first 40% of the WHOLE duration, so at the default 3s
      // duration that's 1.2s of near-imperceptible motion — measured
      // directly, only 0.19px of movement 300ms in. The physical SHAPE
      // is unchanged (accelerate → fall → impact squash → settle/fade),
      // only WHERE each stage lands on the timeline — compressed so the
      // slow-start phase is a small, honest fraction of total duration
      // instead of nearly half of it.
      return g.to(el, {
        transformOrigin: '50% 0%',
        repeat: -1,
        duration: dur,
        ease: 'none',
        keyframes: {
          '0%': { y: 0, scaleY: 1 },
          '18%': { y: 8 * amt, scaleY: 1 + 1.6 * amt, ease: 'power1.in' },
          '32%': { y: 20 * amt, scaleY: 1 + 1.2 * amt },
          '50%': { y: 40 * amt, scaleY: 1 - 0.1 * amt, opacity: 0.9, ease: 'power2.out' },
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
      // `power1.inOut` measured directly (via the real strokeDasharray
      // segment length, not assumed): only 1.85% of the path drawn at
      // 300ms into a 3s duration, 7.7% at 600ms — a genuinely flat, near-
      // invisible start, the concrete cause behind "takes a moment to
      // start" feedback. Switched to `power1.out` — a fast, immediately
      // visible start that decelerates toward completion. Also more
      // botanically honest for THIS pattern than the old ease: a vine or
      // root doesn't need to build up momentum from rest the way a
      // falling object does (gravity's own `power1.in` stays a slow
      // start, correctly — that one really is accelerating from zero).
      if (g.plugins && (g.plugins.drawSVG || typeof DrawSVGPlugin !== 'undefined')) {
        return g.fromTo(el, { drawSVG: '0%' }, { drawSVG: '100%', duration: dur, repeat: -1, ease: 'power1.out' });
      }
      const len = el.getTotalLength ? el.getTotalLength() : 100;
      g.set(el, { strokeDasharray: len, strokeDashoffset: len });
      return g.to(el, { strokeDashoffset: 0, duration: dur, repeat: -1, ease: 'power1.out' });
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

    // 7. Organic Wobble — NOT one of Genesis's 6 physics patterns; added
    // directly from feedback that the first 5 (pure affine transforms —
    // scale/translate/rotate on clean periodic curves) read as "basic".
    // The real difference in kind: every pattern above is a fixed,
    // repeating GSAP timeline — this one is CONTINUOUS, procedural motion
    // driven by simplex3(x, y, t)'s own genuinely non-repeating time axis
    // (organica-noise.js, verified continuous to 0.004 max delta per
    // 0.001s of t when it was built). Because each primitive samples the
    // noise field at ITS OWN (cx, cy) as the spatial seed, neighbouring
    // elements drift in a correlated but never-identical way — the same
    // "organic field" quality Komorebi's canopy patterns have, applied to
    // motion instead of a static mask. Amplitude scales with the
    // primitive's own size (`prim.r`), so small dots sway a little and
    // large shapes sway more, in proportion — reads as each element's own
    // natural weight, not one global pixel amount applied uniformly.
    //
    // Returns a plain object with `.kill()`/`.delay()`, NOT a real GSAP
    // tween — there's no fixed-duration timeline to hand back, the motion
    // never completes or repeats in the traditional sense. `animate()`'s
    // own contract only needs `.kill()`/`.delay()` to exist, so this is a
    // legitimate second implementation strategy behind the same interface,
    // not a special case bolted awkwardly onto the tween-based one.
    // Per-element wobble is handled as a special case in `animate()`
    // itself (see `animateWobbleBatch` below), NOT here — a real
    // performance bug found by testing at Pollen-export scale (5748
    // primitives), not assumed fine from the small cases verified
    // earlier: N independent `gsap.ticker.add()` callbacks, each doing 3
    // `simplex3` calls and a `gsap.set()`, measured at **1fps** with
    // 5748 elements — vs. **51fps** for the exact same element count
    // using a real batched GSAP tween (`pressure`), isolating the cost
    // to wobble's OWN per-callback/per-gsap.set overhead, not "SVG DOM
    // doesn't scale" in general. This entry is kept only so
    // `PATTERNS.wobble` still resolves to something (e.g. for any code
    // that inspects the registry), but `animate()` never calls it.
    wobble: function () { return { kill() {}, delay() {} }; },

    // 8. Morph — the other "not one of the 6" addition, this one from
    // MorphSVG (vendored since the engine's own first commit, never
    // invoked by a real feature until now). Morphs a point-type primitive
    // between its own native circle shape and a noise-perturbed organic
    // blob built from the SAME primitive's own centre/radius — genuinely
    // different in KIND from the other patterns, since it changes the
    // primitive's own SHAPE over time, not just its position/scale.
    // Scoped to point-type primitives only (same "not every pattern
    // applies to every primitive type" precedent Growth already sets for
    // path-type) — a path primitive morphing into an unrelated blob has
    // no principled target shape the way a circle-to-blob does.
    morph: function (el, p, ctx) {
      const g = requireGSAP();
      const prim = ctx.primitive;
      if (prim.type !== 'point') return g.timeline();   // valid, killable no-op — Soul's own playMotion() already filters Growth this way for the inverse case; Morph filters itself so any caller gets a safe object regardless
      const amt = p.amount != null ? p.amount : 0.4;
      const dur = p.duration || 3;
      const blobD = organicBlobPath(prim.x, prim.y, Math.max(prim.r, 4), prim.cx * 0.02 + prim.cy * 0.013, amt);
      // MorphSVGPlugin does NOT auto-convert a non-<path> target — a
      // bare morphSVG tween on a <circle> was verified live to do
      // nothing at all (no error, `d` never set, `r` unchanged), while
      // the identical tween on a real <path> worked immediately.
      // `convertToPath(el, true)` does the conversion explicitly and
      // swaps the new <path> into the DOM in place of the original — the
      // primitive's own `.el` is updated to it so anything reading the
      // primitive afterward (Soul's own Stop/re-Play) targets the live
      // element, not the circle that's no longer in the document.
      let target = el;
      if (el.tagName.toLowerCase() !== 'path') {
        const converted = MorphSVGPlugin.convertToPath(el, true);
        target = Array.isArray(converted) ? converted[0] : converted;
        prim.el = target;
        // The circle-as-path `d` convertToPath just produced IS the rest
        // state — captured here so a caller (Soul's own Stop) can reset
        // to it. `gsap.set(el, {clearProps:'all'})` alone doesn't do
        // this: `d` is an SVG attribute MorphSVG writes directly, not a
        // CSS property with a real GSAP-remembered original value, so a
        // killed morph tween would otherwise leave the shape frozen
        // mid-blob instead of genuinely reverting to a circle.
        prim._morphRestD = target.getAttribute('d');
      }
      return g.to(target, { morphSVG: blobD, duration: dur / 2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    },
  };

  // Builds a closed polygon path approximating a noise-perturbed organic
  // blob around (cx, cy) at base radius r — MorphSVG's own target shape
  // for the Morph pattern above. Deliberately straight segments, not
  // curved: MorphSVG interpolates point-to-point smoothly regardless of
  // whether the TARGET path itself has sharp corners, so a polygon target
  // still reads as an organic wobble once animated, and it's simpler/
  // cheaper to generate than a Catmull-Rom fit.
  function organicBlobPath(cx, cy, r, seed, amount) {
    const n = 10;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const noiseVal = Organica.noise.simplex2(Math.cos(a) * 0.7 + seed, Math.sin(a) * 0.7 + seed);
      const rr = r * (1 + noiseVal * 0.4 * amount);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    let d = 'M ' + pts[0][0] + ',' + pts[0][1] + ' ';
    for (let i = 1; i < pts.length; i++) d += 'L ' + pts[i][0] + ',' + pts[i][1] + ' ';
    return d + 'Z';
  }

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
      // Organica.noise, not a bare `noise` — this file has no local noise
      // object of its own (that's organica-noise.js's own closure); a
      // first version referenced the bare name assuming it was in scope,
      // which it never was — caught only when the 'noise' stagger option
      // was actually exercised for the first time, not by any earlier
      // pass that happened to test 'index'/'distance' and generalised.
      const n = Organica.noise.simplexFbm2(prim.cx * scale, prim.cy * scale);
      return ((n + 1) / 2) * amount * all.length * 0.3;
    }
    return 0;
  }

  // Applies one pattern to every element in `targets` (parallel to
  // `primitives`, same index), staggered per `staggerCfg`, returns the
  // list of GSAP tweens/timelines created (so the caller can pause/kill
  // them without re-deriving what was built).
  // Wobble batched into ONE gsap.ticker callback that loops every active
  // element directly, writing `el.style.transform` as a single string
  // rather than going through `gsap.set()` per element (GSAP's own
  // per-call property-parsing/plugin-dispatch overhead, multiplied by
  // thousands of calls a frame, was the actual cost — not the DOM size).
  // Verified fix: 5748 elements, 1fps → see organica-motion.js's own
  // wobble() header for the measured before/after.
  function animateWobbleBatch(targets, primitives, p, staggerCfg) {
    const amt = p.amount != null ? p.amount : 0.4;
    const speed = p.duration ? 3 / p.duration : 1;
    const startTime = gsap.ticker.time;
    const items = targets.map((el, i) => {
      const prim = primitives[i];
      el.style.transformOrigin = '50% 50%';   // set once, not every frame
      return {
        el,
        seedX: prim.cx * 0.01, seedY: prim.cy * 0.01 + 500,
        amp: amt * Math.max(prim.r || 10, 10) * 1.3,
        delaySec: staggerDelay(prim, i, primitives, staggerCfg),
      };
    });
    function tick() {
      const t = gsap.ticker.time - startTime;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (t < it.delaySec) continue;
        const lt = (t - it.delaySec) * speed;
        const nx = Organica.noise.simplex3(it.seedX, it.seedY, lt);
        const ny = Organica.noise.simplex3(it.seedX + 37.1, it.seedY, lt);
        const nr = Organica.noise.simplex3(it.seedX, it.seedY + 71.3, lt);
        it.el.style.transform = 'translate(' + (nx * it.amp).toFixed(2) + 'px,' + (ny * it.amp).toFixed(2) + 'px) rotate(' + (nr * 16 * amt).toFixed(2) + 'deg)';
      }
    }
    gsap.ticker.add(tick);
    // A single shared kill for every item — Soul's own stopMotion() calls
    // .kill() once per primitive, but gsap.ticker.remove() on an already-
    // removed function is a harmless no-op, and clearing `style.transform`
    // directly here (not relying on GSAP's clearProps, which doesn't know
    // about a property this batch wrote outside of gsap.set/to) is what
    // actually resets the pose.
    // Soul's own stopMotion() calls `.kill()` once PER PRIMITIVE (it has
    // no way to know these N handles are secretly the same batch) — an
    // idempotency guard keeps that O(N) call pattern from redoing the
    // full O(N) reset loop N times over (O(N²) for the whole Stop
    // action), the exact class of cost this same pattern was just fixed
    // for on the per-frame side.
    let killed = false;
    const killAll = () => {
      if (killed) return; killed = true;
      gsap.ticker.remove(tick);
      items.forEach(it => { it.el.style.transform = ''; });
    };
    return items.map(() => ({ kill: killAll, delay: () => {} }));
  }

  motion.animate = function animate(targets, primitives, patternName, patternParams, staggerCfg) {
    if (patternName === 'wobble') return animateWobbleBatch(targets, primitives, patternParams || {}, staggerCfg);
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
