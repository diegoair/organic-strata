/* ─────────────────────────────────────────────────────────────────────────────
 * circle-advanced.js — Organica.circleAdvanced: the Circle Element's optional
 * modifiers, built with Paper.js boolean ops (subtract / intersect / unite).
 *
 * shapes.js's circleGeometry(radiusPct) stays a pure analytic circle; when
 * given an `opts` object with anything switched on it delegates here. With
 * every modifier Off the caller never gets here, so the default output (and
 * every saved Component/Symbol/snapshot/Genesis seed) is byte-identical.
 *
 * PIPELINE (fixed order, so parameters can never contradict each other):
 *   1. OUTLINE   Radius → Roundness (superellipse) → Lobes (sinusoidal radius)
 *   2. INTERIOR  ONE of: solid | ring | rings | holes
 *   3. TRIM      ONE of: none | cut | bite | slices
 * Only the active mode's parameters are read; the others are ignored.
 *
 * Needs the Paper.js global (shared/vendor/paper-full.min.js). It works in a
 * private scratch Project and re-activates whichever project was active
 * (the freehand editor's), so the two never disturb each other.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  const DEFAULTS = {
    round: 0, rotate: 0, lobes: 0, lobeDepth: 20,
    interior: 'solid', inner: 50, ringCount: 3, ringRatio: 55, holes: 6, holeSize: 14, holeRing: 60,
    trim: 'none', cutPos: 0, cutAngle: 0, biteRadius: 70, biteOffset: 60, biteAngle: 45, slices: 6, sliceGap: 6,
  };
  const cache = new Map(), boundsCache = new Map();
  let scratch = null;

  function isActive(o) {
    return o.round > 0 || (o.lobes >= 2 && o.lobeDepth > 0) || o.interior !== 'solid' || o.trim !== 'none';
  }

  function build(radiusPct, userOpts) {
    const o = Object.assign({}, DEFAULTS, userOpts || {});
    const R = 50 * Math.min(100, Math.max(5, radiusPct == null ? 100 : radiusPct)) / 100;
    const key = R + '|' + JSON.stringify(o);
    if (cache.has(key)) return cache.get(key);
    const paper = global.paper;
    let d = '', bounds = null;
    if (paper) {
      const prev = paper.project;
      if (!scratch) scratch = new paper.Project(document.createElement('canvas'));
      scratch.activate();
      try { const res = run(paper, R, o); d = res.d; bounds = res.bounds; }
      catch (e) { d = ''; }
      finally { scratch.clear(); if (prev && prev !== scratch) prev.activate(); }
    }
    if (cache.size > 96) cache.delete(cache.keys().next().value);
    cache.set(key, d);
    boundsCache.set(key, bounds);
    return d;
  }
  // Same build, plus the resulting path's bounds ({x,y,w,h}) — Rotate can push a squircle's corners past the cell.
  function buildWithBounds(radiusPct, userOpts) {
    const d = build(radiusPct, userOpts), o = Object.assign({}, DEFAULTS, userOpts || {});
    const R = 50 * Math.min(100, Math.max(5, radiusPct == null ? 100 : radiusPct)) / 100;
    return { d, bounds: boundsCache.get(R + '|' + JSON.stringify(o)) || null };
  }

  function run(paper, R, o) {
    const C = new paper.Point(50, 50);

    // 1. OUTLINE — a closed, smoothed path around (50,50).
    const outline = (() => {
      const n = Math.max(64, (o.lobes >= 2 ? o.lobes * 10 : 0));
      const sn = 2 + Math.min(100, Math.max(0, o.round)) * 0.06;          // 2 = circle … 8 ≈ square
      const depth = o.lobes >= 2 ? Math.min(50, Math.max(0, o.lobeDepth)) / 100 : 0;
      const p = new paper.Path({ closed: true });
      for (let i = 0; i < n; i++) {
        const t = i / n * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
        let r = R / Math.pow(Math.pow(Math.abs(c), sn) + Math.pow(Math.abs(s), sn), 1 / sn);
        if (depth) r *= 1 + depth * Math.cos(o.lobes * t);
        p.add(new paper.Point(50 + c * r, 50 + s * r));
      }
      p.smooth({ type: 'catmull-rom', factor: 0.5 });
      if (o.rotate) p.rotate(o.rotate, C);   // Rotate: turns a squircle / the lobe phase; holes + slices follow below
      return p;
    })();
    const scaled = k => { const q = outline.clone(); q.scale(k, C); return q; };
    let shape = outline;

    // 2. INTERIOR
    if (o.interior === 'ring') {
      shape = shape.subtract(scaled(Math.min(95, Math.max(5, o.inner)) / 100));
    } else if (o.interior === 'rings') {
      const count = Math.max(2, Math.round(o.ringCount));
      const step = 1 / count, band = step * Math.min(0.95, Math.max(0.1, o.ringRatio / 100));
      let acc = null;
      for (let i = 1; i <= count; i++) {
        const outer = scaled(i * step);
        const annulus = (i * step - band > 0.02) ? outer.subtract(scaled(i * step - band)) : outer;
        acc = acc ? acc.unite(annulus) : annulus;
      }
      shape = acc;
    } else if (o.interior === 'holes') {
      const count = Math.max(2, Math.round(o.holes));
      const hr = R * Math.min(90, Math.max(0, o.holeRing)) / 100, rr = R * Math.min(40, Math.max(3, o.holeSize)) / 100;
      let holes = null;
      for (let i = 0; i < count; i++) {
        const a = i / count * Math.PI * 2 - Math.PI / 2 + (o.rotate || 0) * Math.PI / 180;
        const c = new paper.Path.Circle(new paper.Point(50 + Math.cos(a) * hr, 50 + Math.sin(a) * hr), rr);
        holes = holes ? holes.unite(c) : c;
      }
      shape = shape.subtract(holes);
    }

    // 3. TRIM
    if (o.trim === 'cut') {
      const edge = R * Math.min(90, Math.max(-90, o.cutPos)) / 100;
      const keep = new paper.Path.Rectangle(new paper.Point(-200, -200), new paper.Point(edge, 200));
      keep.rotate(o.cutAngle, new paper.Point(0, 0));
      keep.translate(C);
      shape = shape.intersect(keep);
    } else if (o.trim === 'bite') {
      const a = o.biteAngle * Math.PI / 180, dist = R * Math.min(100, Math.max(0, o.biteOffset)) / 100;
      const bite = new paper.Path.Circle(new paper.Point(50 + Math.cos(a) * dist, 50 + Math.sin(a) * dist), R * Math.min(100, Math.max(10, o.biteRadius)) / 100);
      shape = shape.subtract(bite);
    } else if (o.trim === 'slices') {
      const count = Math.max(2, Math.round(o.slices)), w = R * Math.min(30, Math.max(0.5, o.sliceGap)) / 100;
      let gaps = null;
      for (let i = 0; i < count; i++) {
        const g = new paper.Path.Rectangle(new paper.Point(0, -w / 2), new paper.Point(R * 3, w / 2));
        g.rotate(i / count * 360 - 90 + (o.rotate || 0), new paper.Point(0, 0));
        g.translate(C);
        gaps = gaps ? gaps.unite(g) : g;
      }
      shape = shape.subtract(gaps);
    }
    // Trim the decimals — booleans emit 5+ digits per number, which bloats every SVG export.
    const bb = shape && shape.bounds ? { x: shape.bounds.x, y: shape.bounds.y, w: shape.bounds.width, h: shape.bounds.height } : null;
    return { d: shape ? shape.pathData.replace(/-?\d+\.\d+/g, m => String(+(+m).toFixed(3))) : '', bounds: bb };
  }

  Organica.circleAdvanced = { build, buildWithBounds, isActive, DEFAULTS };
})(window);
