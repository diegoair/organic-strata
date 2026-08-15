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

  Organica.motion = motion;
})(window);
