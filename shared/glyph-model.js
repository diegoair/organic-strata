/* ─────────────────────────────────────────────────────────────────────────────
 * glyph-model.js — Organica.glyphModel: a Bézier-true, master-aware glyph model
 * for Living Path's variable-font work.
 *
 * WHY THIS EXISTS
 *   Living Path's live pipeline flattens every glyph straight to a polyline
 *   (`fromOTCommands`, FL=8 per curve) and throws the Bézier structure away.
 *   That is fine for "apply an organic effect and preview it", but it cannot
 *   support interpolation masters: variable-font (`gvar`) interpolation needs
 *   every master to share point structure per glyph. This module builds a
 *   *canonical* point structure once (curvature-anchored arc-length resample,
 *   corners kept as on-curve anchors) so that:
 *     - every glyph, every master resamples deterministically to the same
 *       point count + corner layout  → interpolation is point-wise valid;
 *     - structure-preserving presets (jitter/wobble/inflate/twist) become
 *       masters by simply moving those points;
 *     - reconstructive presets re-project their result onto this structure.
 *
 *   Phase 0 scope (this file, first cut): the model container, the
 *   commands→cubic-segments reader (CFF cubic + TrueType quad→cubic), the
 *   canonical resampler, the fvar axis reader, and the `→subs` bridge that
 *   reproduces `fromOTCommands`'s output shape so the rest of Living Path can
 *   consume a master with zero change. Interpolation / the preset→master
 *   baker / compatibility checker land in later phases.
 *
 * COORDINATE SPACE
 *   Everything here is raw font units, y-up — exactly what
 *   `opentype.Glyph.path.commands` gives and what `fromOTCommands` /
 *   `processGlyphEm` already work in. The DOM-space flip stays in Living Path.
 *
 * LOAD ORDER: core.js → (pathfx.js) → glyph-model.js → tool script.
 *   Independent of pathfx.js for Phase 0; later phases' baker will call it.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  // ── small geometry helpers ────────────────────────────────────────────────
  const lerp = (a, b, t) => a + (b - a) * t;
  function cubicAt(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
  }
  function unit(x, y) { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; }

  // ── opentype commands → list of contours, each a list of cubic segments ───
  //  seg: {p0,p1,p2,p3, line:bool}  (p1/p2 are real control points; for a
  //  straight edge they sit at the 1/3 and 2/3 points so the segment is a
  //  degenerate-but-valid cubic — keeps one code path downstream).
  function segmentsFromCommands(cmds) {
    const contours = [];
    let cur = null, start = null, pen = null;
    const lineSeg = (a, b) => ({
      p0: { x: a.x, y: a.y },
      p1: { x: lerp(a.x, b.x, 1 / 3), y: lerp(a.y, b.y, 1 / 3) },
      p2: { x: lerp(a.x, b.x, 2 / 3), y: lerp(a.y, b.y, 2 / 3) },
      p3: { x: b.x, y: b.y },
      line: true,
    });
    const closeCur = () => {
      if (!cur) return;
      if (cur.segs.length && start && (Math.abs(pen.x - start.x) > 1e-4 || Math.abs(pen.y - start.y) > 1e-4)) {
        cur.segs.push(lineSeg(pen, start));           // implied closing edge
      }
      cur.closed = true;
      if (cur.segs.length) contours.push(cur);
      cur = null;
    };
    for (const c of cmds) {
      if (c.type === 'M') {
        closeCur();
        cur = { closed: false, segs: [] };
        start = { x: c.x, y: c.y }; pen = { x: c.x, y: c.y };
      } else if (!cur) {
        continue;                                     // defensive: geometry before first M
      } else if (c.type === 'L') {
        const b = { x: c.x, y: c.y };
        cur.segs.push(lineSeg(pen, b)); pen = b;
      } else if (c.type === 'C') {
        cur.segs.push({
          p0: { x: pen.x, y: pen.y },
          p1: { x: c.x1, y: c.y1 }, p2: { x: c.x2, y: c.y2 },
          p3: { x: c.x, y: c.y }, line: false,
        });
        pen = { x: c.x, y: c.y };
      } else if (c.type === 'Q') {
        // quadratic → cubic by degree elevation (exact)
        const q = { x: c.x1, y: c.y1 }, b = { x: c.x, y: c.y };
        cur.segs.push({
          p0: { x: pen.x, y: pen.y },
          p1: { x: pen.x + 2 / 3 * (q.x - pen.x), y: pen.y + 2 / 3 * (q.y - pen.y) },
          p2: { x: b.x + 2 / 3 * (q.x - b.x), y: b.y + 2 / 3 * (q.y - b.y) },
          p3: { x: b.x, y: b.y }, line: false,
        });
        pen = b;
      } else if (c.type === 'Z') {
        closeCur();
      }
    }
    closeCur();
    return contours;
  }

  // ── canonical resample of one contour ────────────────────────────────────
  //  Keep the font's own on-curve nodes (designers put them at extrema and
  //  corners), then fill each segment with curvature-adaptive interior points
  //  — dense on tight bends, sparse on straight runs — and clamp a point
  //  tight to every corner so `dFromSubs`'s Catmull-Rom re-emission stays
  //  sharp there (this is why fromOTCommands, dense everywhere, never rounds
  //  visibly). Deterministic — same contour in ⇒ same points out.
  function canonicalContour(contour, opts) {
    const segs = contour.segs;
    if (!segs.length) return { closed: !!contour.closed, pts: [] };
    const FLAT = Math.max(6, opts.flatten);
    const cornerCos = Math.cos(opts.cornerAngleDeg * Math.PI / 180);
    const clamp = opts.cornerClamp;

    // flatten every segment once, with cumulative arc length + total turning
    const flat = segs.map(s => {
      const pts = [cubicAt(s.p0, s.p1, s.p2, s.p3, 0)], cum = [0];
      const steps = s.line ? 2 : FLAT;
      for (let k = 1; k <= steps; k++) {
        pts.push(cubicAt(s.p0, s.p1, s.p2, s.p3, k / steps));
        cum.push(cum[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y));
      }
      let turn = 0;
      for (let k = 1; k < pts.length - 1; k++) {
        const a = unit(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
        const b = unit(pts[k + 1].x - pts[k].x, pts[k + 1].y - pts[k].y);
        turn += Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y)));
      }
      return { pts, cum, len: cum[cum.length - 1], turn };
    });
    const ptAtLen = (f, s) => {
      s = Math.max(0, Math.min(f.len, s));
      let lo = 0, hi = f.cum.length - 1;
      while (lo + 1 < hi) { const mid = (lo + hi) >> 1; (f.cum[mid] <= s ? lo = mid : hi = mid); }
      const d = f.cum[hi] - f.cum[lo] || 1, t = (s - f.cum[lo]) / d;
      return { x: lerp(f.pts[lo].x, f.pts[hi].x, t), y: lerp(f.pts[lo].y, f.pts[hi].y, t) };
    };
    const dirStart = f => unit(f.pts[1].x - f.pts[0].x, f.pts[1].y - f.pts[0].y);
    const dirEnd = f => { const n = f.pts.length; return unit(f.pts[n - 1].x - f.pts[n - 2].x, f.pts[n - 1].y - f.pts[n - 2].y); };
    // corner at the join *before* segment i (i.e. seg i-1 end ↔ seg i start)
    const isCorner = (i) => {
      if (!contour.closed && i === 0) return true;
      const prev = flat[(i - 1 + segs.length) % segs.length], now = flat[i];
      const d1 = dirEnd(prev), d2 = dirStart(now);
      return (d1.x * d2.x + d1.y * d2.y) < cornerCos;
    };

    const out = [];
    for (let i = 0; i < segs.length; i++) {
      const f = flat[i];
      if (f.len < 1e-4) continue;
      const startCorner = isCorner(i);
      const endCorner = isCorner((i + 1) % segs.length);
      out.push({ x: f.pts[0].x, y: f.pts[0].y, corner: startCorner });   // the real node
      if (startCorner && f.len > clamp * 2) out.push(Object.assign(ptAtLen(f, clamp), { corner: false }));
      // curvature-adaptive interior spacing: tighter where the segment bends
      // (turn measured against a half-turn — a quarter-arc is a gentle sweep,
      // not a tight bend, so it should stay lightly sampled)
      const bend = Math.min(2.5, f.turn / Math.PI);
      const effSp = opts.spacing / (1 + opts.curveGain * bend);
      const lo = startCorner ? clamp : 0, hi = endCorner ? f.len - clamp : f.len;
      const span = Math.max(0, hi - lo);
      const n = Math.max(0, Math.round(span / effSp) - 1);
      for (let k = 1; k <= n; k++) out.push(Object.assign(ptAtLen(f, lo + span * k / (n + 1)), { corner: false }));
      if (endCorner && f.len > clamp * 2) out.push(Object.assign(ptAtLen(f, f.len - clamp), { corner: false }));
    }
    if (!contour.closed) {
      const lastF = flat[flat.length - 1], e = lastF.pts[lastF.pts.length - 1];
      out.push({ x: e.x, y: e.y, corner: true });
    }
    if (out.length > opts.maxPts) {                   // decimate non-corner points evenly
      const keep = [], stride = out.length / opts.maxPts; let acc = 0;
      for (let i = 0; i < out.length; i++) {
        if (out[i].corner || i >= acc) { keep.push(out[i]); acc += stride; }
      }
      return { closed: !!contour.closed, pts: keep };
    }
    return { closed: !!contour.closed, pts: out };
  }

  function resampleOpts(unitsPerEm, over) {
    const upm = unitsPerEm || 1000;
    return Object.assign({
      spacing: upm / 26,          // ~38 units on a 1000-upm font — interior fill only
      curveGain: 1.3,             // how much tighter the fill gets on bends
      cornerClamp: upm / 110,     // node distance of the corner-sharpening point
      maxPts: 240,
      cornerAngleDeg: 30,
      flatten: 16,
    }, over || {});
  }

  // one glyph → canonical form (raw font units, y-up)
  function canonicalGlyph(otGlyph, unitsPerEm, over) {
    const opts = resampleOpts(unitsPerEm, over);
    const contours = segmentsFromCommands((otGlyph.path && otGlyph.path.commands) || [])
      .map(c => canonicalContour(c, opts))
      .filter(c => c.pts.length > 1);
    const advance = Math.round(otGlyph.advanceWidth != null ? otGlyph.advanceWidth : (unitsPerEm || 1000) * 0.5);
    return { advance, contours };
  }

  // canonical contours → `subs` (exact shape of fromOTCommands: [{closed,pts:[{x,y}]}])
  function toSubs(contours) {
    return (contours || []).map(c => ({ closed: !!c.closed, pts: c.pts.map(p => ({ x: p.x, y: p.y })) }));
  }

  // ── fvar axes (read-only) ───────────────────────────────────────────────
  function readAxes(font) {
    const fvar = font && font.tables && font.tables.fvar;
    if (!fvar || !fvar.axes) return [];
    return fvar.axes.map(a => ({
      tag: a.tag,
      name: (a.name && (a.name.en || a.name.En || Object.values(a.name)[0])) || a.tag,
      min: a.minValue, default: a.defaultValue, max: a.maxValue,
    }));
  }

  // stable per-glyph key: prefer the real name, fall back to uniXXXX
  function glyphKey(otGlyph) {
    if (otGlyph.name && otGlyph.name !== '.notdef') return otGlyph.name;
    if (otGlyph.unicode != null && otGlyph.unicode > 0) return 'uni' + otGlyph.unicode.toString(16).toUpperCase().padStart(4, '0');
    return 'gid' + otGlyph.index;
  }

  // ── variation model ────────────────────────────────────────────────────
  //  Compact port of fonttools varLib.models — master supports (tent regions)
  //  + delta weights, so any design-space location interpolates. Correct for
  //  the common layouts (base + on-axis extremes + corners); exotic
  //  intermediate-master arrangements are validated against real fonttools
  //  output at designspace-export time (Phase 4).
  function supportScalar(loc, support) {
    let scalar = 1;
    for (const axis in support) {
      const s = support[axis], lower = s[0], peak = s[1], upper = s[2];
      if (peak === 0) continue;
      if (lower > peak || peak > upper) continue;
      if (lower < 0 && upper > 0) continue;
      const v = loc[axis] || 0;
      if (v === peak) continue;
      if (v <= lower || upper <= v) return 0;
      if (v < peak) scalar *= (v - lower) / (peak - lower);
      else scalar *= (upper - v) / (upper - peak);
    }
    return scalar;
  }
  function buildVariationModel(locs) {
    const nAxes = l => Object.keys(l).filter(k => l[k] !== 0).length;
    const order = locs.map((_, i) => i).sort((a, b) => {
      const d = nAxes(locs[a]) - nAxes(locs[b]); if (d) return d;
      const ka = Object.keys(locs[a]).sort().join(','), kb = Object.keys(locs[b]).sort().join(',');
      if (ka !== kb) return ka < kb ? -1 : 1;
      for (const ax of Object.keys(locs[a]).sort()) { const dd = Math.abs(locs[a][ax]) - Math.abs(locs[b][ax]); if (dd) return dd; }
      return 0;
    });
    const sorted = order.map(i => locs[i]);
    const supports = sorted.map((loc, i) => {
      const region = {};
      for (const ax in loc) { const v = loc[ax]; if (!v) continue; region[ax] = v > 0 ? [0, v, 1] : [-1, v, 0]; }
      for (let j = 0; j < i; j++) {
        const other = sorted[j];
        const oAxes = Object.keys(other).filter(a => other[a] !== 0);
        if (!oAxes.length || oAxes.some(a => !(a in region))) continue;
        let inside = true;
        for (const a of oAxes) { const r = region[a], ov = other[a]; if (!(r[0] < ov && ov < r[2])) { inside = false; break; } }
        if (!inside) continue;
        for (const a of oAxes) {
          const r = region[a], ov = other[a];
          if (ov === r[1]) continue;
          if (ov > 0 && r[1] > 0 && ov < r[1]) region[a] = [ov, r[1], r[2]];
          else if (ov < 0 && r[1] < 0 && ov > r[1]) region[a] = [r[0], r[1], ov];
        }
      }
      return region;
    });
    const weights = sorted.map((loc, i) => {
      const w = {};
      for (let j = 0; j < i; j++) { const s = supportScalar(loc, supports[j]); if (Math.abs(s) > 1e-9) w[j] = s; }
      return w;
    });
    return {
      // masterValsByOrig: array indexed by ORIGINAL master index; each a numeric array of length `dim`
      interpolate(masterValsByOrig, normLoc, dim) {
        const mv = order.map(oi => masterValsByOrig[oi]);
        const deltas = [];
        for (let i = 0; i < mv.length; i++) {
          const d = Float64Array.from(mv[i]);
          const w = weights[i];
          for (const j in w) { const wj = w[j], dj = deltas[j]; for (let k = 0; k < dim; k++) d[k] -= wj * dj[k]; }
          deltas.push(d);
        }
        const out = new Float64Array(dim);
        for (let i = 0; i < mv.length; i++) {
          const s = supportScalar(normLoc, supports[i]); if (!s) continue;
          const d = deltas[i]; for (let k = 0; k < dim; k++) out[k] += s * d[k];
        }
        return out;
      },
    };
  }
  const flatten = contours => { const a = []; contours.forEach(c => c.pts.forEach(p => { a.push(p.x, p.y); })); return a; };
  const unflatten = (ref, arr) => {
    let k = 0;
    return ref.map(c => ({ closed: c.closed, pts: c.pts.map(p => ({ x: arr[k++], y: arr[k++], corner: !!p.corner })) }));
  };

  // ── preset → master baker helpers ──────────────────────────────────────
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const signedArea = pts => { let s = 0; for (let i = 0, n = pts.length; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; s += a.x * b.y - b.x * a.y; } return s / 2; };
  const centroid = pts => { let x = 0, y = 0; for (const p of pts) { x += p.x; y += p.y; } return { x: x / pts.length, y: y / pts.length }; };
  const subsToContours = subs => (subs || []).map(s => ({ closed: s.closed !== false, pts: (s.pts || []).map(p => ({ x: p.x, y: p.y, corner: false })) })).filter(c => c.pts.length > 2);

  // greedy nearest-centroid matching: perm[i] = out-contour index for base i
  function matchContours(outC, baseC) {
    const oc = outC.map(c => centroid(c.pts)), used = new Set(), perm = [];
    for (let i = 0; i < baseC.length; i++) {
      const bc = centroid(baseC[i].pts);
      let bi = -1, bd = Infinity;
      for (let j = 0; j < outC.length; j++) { if (used.has(j)) continue; const d = dist(oc[j], bc); if (d < bd) { bd = d; bi = j; } }
      used.add(bi); perm.push(bi);
    }
    return perm;
  }
  // resample `out` polyline onto `ref`'s point count, same winding, start at
  // the out-point nearest ref.pts[0]; corner flags carried from ref
  function reprojectContour(out, ref) {
    const N = ref.pts.length;
    let src = out.pts.slice();
    if (signedArea(src) * signedArea(ref.pts) < 0) src.reverse();
    const M = src.length;
    const cum = [0];
    for (let i = 1; i < M; i++) cum.push(cum[i - 1] + dist(src[i], src[i - 1]));
    const total = cum[M - 1] + dist(src[0], src[M - 1]);
    if (total < 1e-6) return { closed: true, pts: ref.pts.map(p => ({ x: p.x, y: p.y, corner: !!p.corner })) };
    let bi = 0, bd = Infinity;
    for (let i = 0; i < M; i++) { const d = dist(src[i], ref.pts[0]); if (d < bd) { bd = d; bi = i; } }
    const s0 = cum[bi];
    const at = s => {
      s = ((s % total) + total) % total;
      if (s <= cum[M - 1]) {
        let lo = 0, hi = M - 1;
        while (lo + 1 < hi) { const m = (lo + hi) >> 1; (cum[m] <= s ? lo = m : hi = m); }
        const d = cum[hi] - cum[lo] || 1, t = (s - cum[lo]) / d;
        return { x: lerp(src[lo].x, src[hi].x, t), y: lerp(src[lo].y, src[hi].y, t) };
      }
      const d = total - cum[M - 1] || 1, t = (s - cum[M - 1]) / d;
      return { x: lerp(src[M - 1].x, src[0].x, t), y: lerp(src[M - 1].y, src[0].y, t) };
    };
    const pts = [];
    for (let k = 0; k < N; k++) { const p = at(s0 + k * total / N); pts.push({ x: p.x, y: p.y, corner: !!ref.pts[k].corner }); }
    return { closed: true, pts };
  }
  // classify a baked glyph against base structure:
  //  null         → contour count changed (topology) — static-instance only
  //  {kind:'direct',   contours} → point structure identical, use points 1:1
  //  {kind:'reproject',contours} → same contour count, re-projected onto base
  function classifyBake(outC, baseC) {
    if (!outC.length || outC.length !== baseC.length) return null;
    const perm = matchContours(outC, baseC);
    if (perm.some(pi => pi < 0)) return null;
    const exact = perm.every((pi, i) => outC[pi].pts.length === baseC[i].pts.length);
    const contours = baseC.map((bc, i) => {
      const oc = outC[perm[i]];
      return exact
        ? { closed: bc.closed, pts: oc.pts.map((p, k) => ({ x: p.x, y: p.y, corner: !!(bc.pts[k] && bc.pts[k].corner) })) }
        : reprojectContour(oc, bc);
    });
    return { kind: exact ? 'direct' : 'reproject', contours };
  }

  // ── model container ────────────────────────────────────────────────────
  //  Lazy: font load stays cheap. A master resamples each glyph on first
  //  request and caches it. base = masters[0] (the imported font); further
  //  masters are added hand-edited or preset-baked (Phase 2/3).
  function makeMaster(name, location, base) {
    return {
      name, location: location || {}, source: 'hand', _cache: {},
      glyph(key) {
        if (this._cache[key]) return this._cache[key];
        const b = base.glyph(key);
        const cg = {
          advance: b.advance, unicode: b.unicode, edited: false,
          contours: b.contours.map(c => ({ closed: c.closed, pts: c.pts.map(p => ({ x: p.x, y: p.y, corner: !!p.corner })) })),
        };
        this._cache[key] = cg;
        return cg;
      },
    };
  }

  function createModel(font, over) {
    const unitsPerEm = font.unitsPerEm || 1000;
    const opts = resampleOpts(unitsPerEm, over);

    // canonical glyph order: unicode'd glyphs, first occurrence wins (mirrors
    // buildModifiedFont's own de-dup)
    const glyphOrder = [], byKey = {}, seen = new Set();
    for (let i = 0; i < font.glyphs.length; i++) {
      const g = font.glyphs.get(i);
      if (g.unicode == null || g.unicode <= 0 || seen.has(g.unicode)) continue;
      seen.add(g.unicode);
      const k = glyphKey(g);
      glyphOrder.push(k); byKey[k] = g;
    }

    const base = {
      name: 'Base',
      location: {},
      source: 'imported',
      _cache: {},
      glyph(key) {
        if (this._cache[key]) return this._cache[key];
        const g = byKey[key];
        const cg = g ? canonicalGlyph(g, unitsPerEm, opts) : { advance: Math.round(unitsPerEm * 0.5), contours: [] };
        cg.unicode = g ? g.unicode : null;
        this._cache[key] = cg;
        return cg;
      },
    };

    const model = {
      unitsPerEm,
      resampleOpts: opts,
      axes: [],                             // design-space axes (see setAxes/addAxis)
      fontAxes: readAxes(font),             // the imported font's own fvar (informational)
      masters: [base],
      editMasterIdx: 0,                     // which master the outline editor targets
      loc: {},                              // current design-space location (user units)
      glyphOrder,
      _font: font,
      _byKey: byKey,

      // ── axes ────────────────────────────────────────────────────────────
      addAxis(a) {
        const ax = {
          tag: (a.tag || 'AXIS').slice(0, 4),
          name: a.name || a.tag || 'Axis',
          min: +a.min, default: +a.default, max: +a.max,
        };
        if (this.axes.some(x => x.tag === ax.tag)) return null;
        this.axes.push(ax);
        return ax;
      },
      removeAxis(tag) {
        this.axes = this.axes.filter(x => x.tag !== tag);
        this.masters.forEach(m => { if (m.location) delete m.location[tag]; });
        delete this.loc[tag];
      },
      // ── masters ─────────────────────────────────────────────────────────
      addMaster(name, location) {
        const m = makeMaster(name || ('Master ' + this.masters.length), location || {}, base);
        this.masters.push(m);
        return this.masters.length - 1;
      },
      removeMaster(idx) {
        if (idx <= 0 || idx >= this.masters.length) return;
        this.masters.splice(idx, 1);
        if (this.editMasterIdx >= this.masters.length) this.editMasterIdx = this.masters.length - 1;
      },
      // index of the master whose location == `userLoc` (within eps), or -1
      locIsMaster(userLoc) {
        const a = this.normLoc(userLoc);
        for (let i = 0; i < this.masters.length; i++) {
          const b = this.normLoc(this.masters[i].location);
          if (this.axes.every(ax => Math.abs((a[ax.tag] || 0) - (b[ax.tag] || 0)) < 1e-4)) return i;
        }
        return -1;
      },
      // ── normalisation (user units → [-1,1] per axis) ────────────────────
      normLoc(loc) {
        const out = {};
        for (const ax of this.axes) {
          const v = (loc && loc[ax.tag] != null) ? +loc[ax.tag] : ax.default;
          let n;
          if (v < ax.default) n = (ax.default === ax.min) ? 0 : (v - ax.default) / (ax.default - ax.min);
          else n = (ax.max === ax.default) ? 0 : (v - ax.default) / (ax.max - ax.default);
          out[ax.tag] = Math.max(-1, Math.min(1, n));
        }
        return out;
      },
      // ── compatibility ──────────────────────────────────────────────────
      checkCompat(key) {
        const b = this.masters[0].glyph(key);
        const sig = cs => cs.map(c => c.pts.length).join(',');
        const bSig = sig(b.contours), bN = b.contours.length;
        for (let i = 1; i < this.masters.length; i++) {
          const g = this._masterGlyph(i, key);
          if (g.contours.length !== bN) return { ok: false, master: i, reason: `“${this.masters[i].name}”: ${g.contours.length} contour(s) vs base ${bN}` };
          if (sig(g.contours) !== bSig) return { ok: false, master: i, reason: `“${this.masters[i].name}”: node counts differ from base` };
        }
        return { ok: true };
      },
      // a master's contribution for `key`: its edited copy, else base (delta 0)
      _masterGlyph(i, key) {
        if (i === 0) return this.masters[0].glyph(key);
        const c = this.masters[i]._cache[key];
        return (c && c.edited) ? c : this.masters[0].glyph(key);
      },
      // ── interpolation ──────────────────────────────────────────────────
      instanceGlyph(key, userLoc) {
        const b = this.masters[0].glyph(key);
        if (this.masters.length < 2 || !this.axes.length) return { contours: b.contours, advance: b.advance, ok: true, interpolated: false };
        const compat = this.checkCompat(key);
        const nl = this.normLoc(userLoc || this.loc);
        if (!compat.ok) {
          // nearest master by squared distance in normalised space
          let bi = 0, bd = Infinity;
          for (let i = 0; i < this.masters.length; i++) {
            const b2 = this.normLoc(this.masters[i].location);
            let d = 0; for (const ax of this.axes) { const e = (nl[ax.tag] || 0) - (b2[ax.tag] || 0); d += e * e; }
            if (d < bd) { bd = d; bi = i; }
          }
          const g = this._masterGlyph(bi, key);
          return { contours: g.contours, advance: g.advance, ok: false, reason: compat.reason, interpolated: false };
        }
        const dim = flatten(b.contours).length;
        if (!dim) return { contours: b.contours, advance: b.advance, ok: true, interpolated: false };
        const mFlats = this.masters.map((m, i) => flatten(this._masterGlyph(i, key).contours));
        const mAdv = this.masters.map((m, i) => [this._masterGlyph(i, key).advance]);
        const vm = buildVariationModel(this.masters.map(m => this.normLoc(m.location)));
        const outFlat = vm.interpolate(mFlats, nl, dim);
        const outAdv = vm.interpolate(mAdv, nl, 1)[0];
        return { contours: unflatten(b.contours, outFlat), advance: Math.round(outAdv), ok: true, interpolated: true };
      },
      subsForInstance(key, userLoc) { return toSubs(this.instanceGlyph(key, userLoc).contours); },

      subsFor(key, masterIdx) {             // raw master contours (no interpolation)
        return toSubs(this.masters[masterIdx || 0].glyph(key).contours);
      },

      // ── preset → master baker ──────────────────────────────────────────
      //  o.normGlyph(subs) → {norm,k,ox,oy}   (the tool's 1000-box normaliser)
      //  o.denormGlyph(subs,k,ox,oy) → subs   (its inverse)
      //  o.apply(normSubs) → normSubs'        (the tool's effect stack)
      //  o.amount (default 1) — lerp from base; o.glyphKeys — subset; o.onProgress
      //  Returns { direct, reprojected, staticOnly, total }.
      async bakePresetMaster(masterIdx, o) {
        o = o || {};
        if (masterIdx <= 0 || masterIdx >= this.masters.length) throw new Error('bake target must be a non-base master');
        const master = this.masters[masterIdx];
        const srcIdx = (o.sourceMasterIdx != null) ? o.sourceMasterIdx : 0;   // read from here (self = iterative shaping)
        const keys = o.glyphKeys || this.glyphOrder;
        const amount = o.amount == null ? 1 : o.amount;
        let direct = 0, reprojected = 0, staticOnly = 0, total = 0;
        for (let gi = 0; gi < keys.length; gi++) {
          const K = keys[gi];
          if (!(this._byKey && this._byKey[K])) continue;
          const baseC = (srcIdx === 0) ? this.masters[0].glyph(K).contours : this._masterGlyph(srcIdx, K).contours;
          if (!baseC.length) continue;
          total++;
          let outC = null;
          try {
            const ng = o.normGlyph(toSubs(baseC));
            const applied = o.apply(ng.norm);
            outC = subsToContours(o.denormGlyph(applied, ng.k, ng.ox, ng.oy));
          } catch (e) { staticOnly++; continue; }
          const cls = classifyBake(outC, baseC);
          if (!cls) { staticOnly++; continue; }
          const full = cls.contours;
          const baked = amount === 1 ? full : baseC.map((bc, i) => ({
            closed: bc.closed,
            pts: bc.pts.map((p, k) => ({
              x: p.x + (full[i].pts[k].x - p.x) * amount,
              y: p.y + (full[i].pts[k].y - p.y) * amount,
              corner: !!p.corner,
            })),
          }));
          const bg = master.glyph(K);
          bg.contours = baked; bg.edited = true;
          if (cls.kind === 'direct') direct++; else reprojected++;
          if (o.onProgress && (gi % 12 === 0)) { o.onProgress(gi + 1, keys.length); await new Promise(r => setTimeout(r, 0)); }
        }
        master.source = 'preset';
        if (o.presetRef) master.presetRef = o.presetRef;
        return { direct, reprojected, staticOnly, total };
      },
    };
    return model;
  }

  Organica.glyphModel = {
    segmentsFromCommands,
    canonicalContour,
    canonicalGlyph,
    resampleOpts,
    toSubs,
    readAxes,
    glyphKey,
    createModel,
    supportScalar,
    buildVariationModel,
    reprojectContour,
    classifyBake,
  };
})(typeof window !== 'undefined' ? window : this);
