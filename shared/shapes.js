/* ─────────────────────────────────────────────────────────────────────────────
 * shapes.js — Organica.shapes: pure shape geometry + grid cell-placement math.
 *
 * Extracted from fvs/index.html at the second consumer (Trellis) — same
 * "extract at the second consumer" move as noise.js / motion.js / radial.js /
 * pollen-engine.js. FVS's Symbols tier was the first to solve "one shape per
 * grid cell, rect or polygon, fitted/anchored/scaled/rotated"; this file is
 * that solution with its FVS-only state coupling removed, so a new consumer
 * (Trellis) can drive it too. FVS itself now imports from here — verified
 * byte-identical output before/after.
 *
 * SCOPE:
 *   - Shape geometry: triangleGeometry / arcGeometry+arcPathD /
 *     arcTruchetGeometry+arcTruchetPathD — pure functions, no DOM. Each
 *     returns { d, normTx, normTy, normScale } — an SVG path `d` string in a
 *     0..100 box plus a bbox-fit correction transform (identity for these
 *     hand-authored shapes; the hook exists for an uploaded-SVG shape type,
 *     which stays tool-local since the upload/extraction pipeline is
 *     tool-specific).
 *   - Grid cell placement: resolveGridCells / resolveCellPlacement /
 *     cellColRow / frameSize — turn a loadLoomGrid() grid (or a plain square
 *     grid) into per-cell centres + a fit/anchor/padding/scale transform +
 *     a col/row/index/angle context for spatial rule generators.
 *
 * LOAD ORDER: core.js → palette.js → shapes.js → tool script.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  // ── SHAPE GEOMETRY ──────────────────────────────────────────────────────
  // Each shape is drawn directly in a 0..100 box. Real curves (the arcs) are
  // why this is `d` (SVG path syntax) rather than a plain polygon point-list:
  // SVG renders it via <path>, Canvas2D via `ctx.fill(new Path2D(d))` — both
  // support arc (A) commands natively.
  // Any triangle can be placed with its base on a horizontal edge and its
  // apex somewhere above — base width + height + the apex's horizontal
  // position is exactly enough freedom to reach every triangle shape up to
  // similarity (rotation/reflection are already covered by FVS's own
  // transform controls). apexPct = 0 is the old isosceles default (apex
  // centred, byte-identical `d` to the pre-generalisation output); ±100
  // puts the apex directly above a base corner — a right triangle, still
  // full-area (base × height / 2), so the whole -100..100 range is valid.
  // (The UIs show it as a 0–100 position: (apexPct + 100) / 2.)
  //
  // Optional 4th arg `opts` = {corner, curve, irregular, seed, outline}, every
  // field defaulting to "off". With all of them off the function returns the
  // exact same path as before (Genesis's 3-arg call and every pre-existing
  // saved Element depend on that).
  //   corner    0-100  rounds the three corners (same fraction logic as
  //                    roundedPolyPathD: up to half of each adjacent edge)
  //   curve     -100..100  bows every edge outward (+) / inward (-) with a
  //                    quadratic; +100 is a little past a Reuleaux triangle
  //   irregular 0-100  seeded per-vertex jitter, clamped to the triangle's
  //                    own bbox so dragging it never rescales the shape
  //   seed             same seed → same silhouette (mulberry32, like polygon)
  //   outline   0-95   hollow ring: thickness as % of the inradius. The inner
  //                    ring is the outer scaled toward the incentre and wound
  //                    the opposite way, so the default nonzero fill-rule cuts
  //                    the hole (same trick as wedgePathD, no fill-rule attr)
  // Also drives Polygon's extras (any vertex count): `centre` overrides the
  // ring's own mean (curvature bows AWAY from it — Polygon's Step loops must
  // use the shape's true centre), `style` picks the corner join — 'round' (the
  // quadratic through the vertex, default), 'chamfer' (straight cut) or 'scoop'
  // (the quadratic mirrored across the chord → concave).
  function triRing(pts, cornerPct, curvePct, centre, style) {
    const n = pts.length, cornerArr = Array.isArray(cornerPct) ? cornerPct : null;
    const fOf = i => (cornerArr ? cornerArr[i] : cornerPct) / 100 * 0.5;   // per-vertex fraction (Star: tips vs valleys)
    const f = fOf(0);
    const r2 = v => Math.round(v * 1000) / 1000;
    const cx = centre ? centre[0] : pts.reduce((a, p) => a + p[0], 0) / n, cy = centre ? centre[1] : pts.reduce((a, p) => a + p[1], 0) / n;
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const quad = (P, C, Q, t) => { const u = 1 - t; return [u * u * P[0] + 2 * u * t * C[0] + t * t * Q[0], u * u * P[1] + 2 * u * t * C[1] + t * t * Q[1]]; };
    const edges = [], samples = [];
    for (let i = 0; i < n; i++) {
      const P = pts[i], Q = pts[(i + 1) % n];
      let C = null;
      if (curvePct !== 0) {
        const dx = Q[0] - P[0], dy = Q[1] - P[1], len = Math.hypot(dx, dy) || 1;
        const mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2;
        let nx = dy / len, ny = -dx / len;
        if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }   // always point away from the ring's centre
        const off = curvePct / 100 * 0.3 * len;
        C = [mx + nx * off, my + ny * off];
      }
      for (let k = 0; k <= 12; k++) samples.push(C ? quad(P, C, Q, k / 12) : lerp(P, Q, k / 12));
      let p0, p1, c = null;
      const fa = fOf(i), fb = fOf((i + 1) % n);
      if (!C) { p0 = lerp(P, Q, fa); p1 = lerp(P, Q, 1 - fb); }
      else {
        p0 = quad(P, C, Q, fa); p1 = quad(P, C, Q, 1 - fb);
        // sub-segment [f, 1-f] of a quadratic: control = p0 + (t1-t0)/2 * B'(f)
        const dv = [2 * ((1 - fa) * (C[0] - P[0]) + fa * (Q[0] - C[0])), 2 * ((1 - fa) * (C[1] - P[1]) + fa * (Q[1] - C[1]))];
        const sp = cornerArr ? (1 - fa - fb) / 2 : (1 - 2 * f) / 2;
        c = [p0[0] + sp * dv[0], p0[1] + sp * dv[1]];
      }
      edges.push({ p0, p1, c, v: Q });
    }
    const fmt = p => `${r2(p[0])},${r2(p[1])}`;
    let d = 'M ' + fmt(edges[0].p0) + ' ';
    for (let i = 0; i < n; i++) {
      const e = edges[i];
      d += e.c ? `Q ${fmt(e.c)} ${fmt(e.p1)} ` : `L ${fmt(e.p1)} `;
      if (fOf((i + 1) % n) > 0) {
        const nx = edges[(i + 1) % n].p0;
        if (style === 'chamfer') d += `L ${fmt(nx)} `;
        else if (style === 'scoop') d += `Q ${fmt([e.p1[0] + nx[0] - e.v[0], e.p1[1] + nx[1] - e.v[1]])} ${fmt(nx)} `;
        else d += `Q ${fmt(e.v)} ${fmt(nx)} `;
      }
    }
    return { d: d + 'Z', samples };
  }
  function triangleGeometry(base, height, apexPct, opts) {
    const halfBase = base / 2;
    const apexY = 50 - height / 2;
    const baseY = 50 + height / 2;
    const pct = Math.max(-100, Math.min(100, apexPct == null ? 0 : apexPct));
    const apexX = 50 + halfBase * (pct / 100);
    const o = opts || {};
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v == null ? 0 : v));
    const corner = clamp(o.corner, 0, 100), curve = clamp(o.curve, -100, 100);
    const irregular = clamp(o.irregular, 0, 100), outline = clamp(o.outline, 0, 95);
    if (!corner && !curve && !irregular && !outline) {
      const d = `M ${apexX},${apexY} L ${50 - halfBase},${baseY} L ${50 + halfBase},${baseY} Z`;
      return { d, normTx: 0, normTy: 0, normScale: 1 };
    }
    let pts = [[apexX, apexY], [50 - halfBase, baseY], [50 + halfBase, baseY]];
    if (irregular > 0) {
      const rng = Organica.mulberry32((o.seed == null ? 1 : o.seed) >>> 0);
      const amp = irregular / 100 * 0.3 * Math.min(base, height);
      pts = pts.map(p => [
        Math.min(50 + halfBase, Math.max(50 - halfBase, p[0] + (rng() - 0.5) * 2 * amp)),
        Math.min(baseY, Math.max(apexY, p[1] + (rng() - 0.5) * 2 * amp)),
      ]);
    }
    const outer = triRing(pts, corner, curve);
    let d = outer.d;
    if (outline > 0) {
      // incentre = side-length-weighted centroid; scaling toward it by k gives
      // a concentric triangle whose inradius (and so wall thickness) is exact.
      const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      const la = len(pts[1], pts[2]), lb = len(pts[0], pts[2]), lc = len(pts[0], pts[1]), per = la + lb + lc;
      const ix = (la * pts[0][0] + lb * pts[1][0] + lc * pts[2][0]) / per, iy = (la * pts[0][1] + lb * pts[1][1] + lc * pts[2][1]) / per;
      const k = 1 - outline / 100;
      const inner = [pts[0], pts[2], pts[1]].map(p => [ix + (p[0] - ix) * k, iy + (p[1] - iy) * k]);   // reversed winding
      d += ' ' + triRing(inner, corner, curve).d;
    }
    // Curvature can push the silhouette past the 0..100 box; shrink + recentre
    // ONLY on overflow so the shape never jumps in size as the slider crosses 0.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    outer.samples.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    if (x0 < 0 || y0 < 0 || x1 > 100 || y1 > 100) {
      const s = Math.min(1, 100 / Math.max(x1 - x0, 1e-6), 100 / Math.max(y1 - y0, 1e-6));
      return { d, normTx: 50 / s - (x0 + x1) / 2, normTy: 50 / s - (y0 + y1) / 2, normScale: s };
    }
    return { d, normTx: 0, normTy: 0, normScale: 1 };
  }

  // Apex/pivot anchored at the box's own (0,0) corner, sweeping the quadrant
  // toward (100,0) and (0,100) — outer radius fixed at 100 so the outer curve
  // always reaches the cell's own far edges. thicknessPct sets how much of
  // that radius is filled, from the outer edge inward; 100 = solid quarter-disc.
  function arcPathD(thicknessPct) {
    const ir = 100 * (1 - thicknessPct / 100);
    if (ir <= 0.5) return 'M 0,0 L 100,0 A 100,100 0 0,1 0,100 Z';
    return `M 100,0 A 100,100 0 0,1 0,100 L 0,${ir} A ${ir},${ir} 0 0,0 ${ir},0 Z`;
  }
  // bbox {x,y,w,h} → the {normTx,normTy,normScale} that fits it into the
  // 0..100 box, aspect preserved and centred — the same formula FVS's
  // extractSeedFromSVG uses for an uploaded shape, here for generated shapes
  // that overflow the box by construction (drop, blob, free-sweep arc).
  function fitToBox(b) {
    const normScale = 100 / Math.max(b.w, b.h, 1e-6);
    const offX = (100 - b.w * normScale) / 2, offY = (100 - b.h * normScale) / 2;
    return { normScale, normTx: -b.x + offX / normScale, normTy: -b.y + offY / normScale };
  }
  function bboxOfPoints(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // Arc: with the defaults (corner pivot, 90° sweep) this is EXACTLY the
  // quarter-disc above, so every saved Component/Symbol is untouched. A
  // different sweep, or a centre pivot, builds a general wedge/ring segment
  // (same construction as Genesis Create's arc) and fits it to the box.
  function arcWedgePathD(cx, cy, outerR, startDeg, sweepDeg, innerR) {
    const r2 = v => Math.round(v * 1000) / 1000;
    const a0 = startDeg * Math.PI / 180, a1 = (startDeg + sweepDeg) * Math.PI / 180;
    const p = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    const [ox0, oy0] = p(outerR, a0), [ox1, oy1] = p(outerR, a1);
    const large = sweepDeg > 180 ? 1 : 0;
    if (innerR <= 0.5) {
      return `M ${r2(cx)},${r2(cy)} L ${r2(ox0)},${r2(oy0)} A ${r2(outerR)},${r2(outerR)} 0 ${large},1 ${r2(ox1)},${r2(oy1)} Z`;
    }
    const [ix1, iy1] = p(innerR, a1), [ix0, iy0] = p(innerR, a0);
    return `M ${r2(ox0)},${r2(oy0)} A ${r2(outerR)},${r2(outerR)} 0 ${large},1 ${r2(ox1)},${r2(oy1)}`
      + ` L ${r2(ix1)},${r2(iy1)} A ${r2(innerR)},${r2(innerR)} 0 ${large},0 ${r2(ix0)},${r2(iy0)} Z`;
  }
  // ── Arc extras (Start · End rounding · Segments/Gap · Taper · Irregularity) ──
  // arcBuild() draws the arc as one closed ring per segment, sampled at ~1°
  // (sagitta < 0.004 in the 0..100 box, invisible even at mural scale), so a
  // tapering / wobbling band and its rounded ends share one construction.
  // It is only reached when an extra is ACTIVE — arcGeometry() keeps the
  // analytic true-arc path for everything else, byte-identical to before.
  // Convention-free: the caller supplies the pivot (cx,cy), radii and base
  // start angle, so FVS (0..100 box, then fitToBox) and Genesis (its own 0..200
  // box, unfitted) get the same geometry in their own coordinate systems.
  function arcExtrasActive(o) {
    return !!o && ((o.start || 0) !== 0 || (o.round || 0) > 0 || (o.segs || 1) > 1 || (o.taper || 0) !== 0 || (o.irregular || 0) > 0);
  }
  function arcBuild(cx, cy, outerR, startDeg, sweepDeg, innerR, o) {
    o = o || {};
    const n = Math.min(24, Math.max(1, Math.round(o.segs || 1)));
    const gapF = Math.min(80, Math.max(0, o.gap || 0)) / 100;
    const taper = Math.min(100, Math.max(-100, o.taper || 0)) / 100;
    const irr = Math.min(100, Math.max(0, o.irregular || 0)) / 100;
    const round = Math.min(100, Math.max(0, o.round || 0)) / 100;
    const sd = o.seed == null ? 1 : o.seed;
    const start = startDeg + (o.start || 0);
    const segLen = sweepDeg / (n + (n - 1) * gapF), pitch = segLen * (1 + gapF);
    const band = outerR - innerR, solid = innerR <= 0.5 && taper === 0;
    const r2 = v => Math.round(v * 1000) / 1000;
    const noise = (t, k) => Organica.noise.simplex2(t * 3 + sd * 1.7 + k * 11.3, sd * 0.37 + k);
    // Outer / inner radius at angle a — t is the position along the WHOLE sweep,
    // so taper and wobble run continuously across segments.
    const radii = a => {
      const t = (a - start) / sweepDeg;
      const k = Math.max(0, taper >= 0 ? 1 - taper * t : 1 + taper * (1 - t));
      let ro = outerR, ri = solid ? 0 : outerR - band * k;
      if (irr > 0) { ro *= 1 + irr * 0.16 * noise(t, 0); if (ri > 0.5) ri = Math.min(ro - 0.3, ri * (1 + irr * 0.2 * noise(t, 1))); }
      return [ro, Math.max(0, ri)];
    };
    // Wedge extras (squash / rotate / apex fillet / bowed radial edges) — absent for Arc, whose output stays byte-identical.
    const sq = o.squash == null ? 1 : o.squash, rotDeg = o.rotate || 0, crot = Math.cos(rotDeg * Math.PI / 180), srot = Math.sin(rotDeg * Math.PI / 180);
    const at = (sq === 1 && !rotDeg)
      ? (r, a) => [cx + Math.cos(a * Math.PI / 180) * r, cy + Math.sin(a * Math.PI / 180) * r]
      : (r, a) => { let x = Math.cos(a * Math.PI / 180) * r, y = Math.sin(a * Math.PI / 180) * r * sq; if (rotDeg) { const xr = x * crot - y * srot; y = x * srot + y * crot; x = xr; } return [cx + x, cy + y]; };
    const E = o.edgeCurve ? 8 : 0, edgeCurve = (o.edgeCurve || 0) / 100;
    // interior samples of a bowed radial edge p→q (outward = away from the segment's mid-angle side)
    const bowEdge = (p, q, aMid) => {
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (len < 1e-9) return [];
      const dm = Math.hypot(mx - cx, my - cy) / Math.max(sq, 0.3), qm = at(dm, aMid);
      let nx = -(q[1] - p[1]) / len, ny = (q[0] - p[0]) / len;
      if (nx * (mx - qm[0]) + ny * (my - qm[1]) < 0) { nx = -nx; ny = -ny; }
      let dev = edgeCurve * 0.3 * len;
      if (dev < 0) dev = Math.max(dev, -0.9 * Math.hypot(mx - qm[0], my - qm[1]));
      const c = [mx + nx * 2 * dev, my + ny * 2 * dev], out = [];
      for (let i = 1; i <= E; i++) { const t = i / (E + 1), u = 1 - t; out.push([u * u * p[0] + 2 * u * t * c[0] + t * t * q[0], u * u * p[1] + 2 * u * t * c[1] + t * t * q[1]]); }
      return out;
    };
    let d = '';
    const all = [];   // pre-rounding points → the Fit bbox (so End rounding never rescales the shape)
    for (let s = 0; s < n; s++) {
      const a0 = start + s * pitch, a1 = a0 + segLen;
      const steps = Math.max(2, Math.ceil(segLen));
      const ring = [], corners = [];
      const outerPts = [], innerPts = [];
      for (let i = 0; i <= steps; i++) {
        const a = a0 + (a1 - a0) * i / steps, [ro, ri] = radii(a);
        outerPts.push(at(ro, a)); innerPts.push(ri > 0.5 ? at(ri, a) : [cx, cy]);
      }
      const apex = solid || innerPts.every(p => p[0] === cx && p[1] === cy);
      outerPts.forEach(p => ring.push(p));
      corners.push(0, steps);
      const aMid = (a0 + a1) / 2;
      let apexIdx = -1;
      if (apex) {
        if (E) bowEdge(outerPts[steps], [cx, cy], aMid).forEach(p => ring.push(p));
        apexIdx = ring.length; ring.push([cx, cy]);
        if (E) bowEdge([cx, cy], outerPts[0], aMid).forEach(p => ring.push(p));
      } else {
        if (E) bowEdge(outerPts[steps], innerPts[steps], aMid).forEach(p => ring.push(p));
        for (let i = steps; i >= 0; i--) ring.push(innerPts[i]);
        corners.push(steps + E + 1, 2 * steps + E + 1);
        if (E) bowEdge(innerPts[0], outerPts[0], aMid).forEach(p => ring.push(p));
      }
      ring.forEach(p => all.push(p));
      // corner radius = End rounding × half the band width at that end
      const wEnd = i => Math.hypot(outerPts[i][0] - innerPts[i][0], outerPts[i][1] - innerPts[i][1]);
      const want = c => {
        if (round <= 0) return 0;
        if (c === 0) return wEnd(0) / 2 * round;
        if (c === steps) return wEnd(steps) / 2 * round;
        if (c === steps + E + 1) return wEnd(steps) / 2 * round;
        return wEnd(0) / 2 * round;
      };
      const list = corners.map(c => [c, want(c)]);
      const alpha = segLen * Math.PI / 180;
      if (apexIdx >= 0 && o.apexRound && round > 0 && alpha < Math.PI - 1e-6) {
        const rcA = Math.hypot(outerPts[0][0] - cx, outerPts[0][1] - cy) / 2 * round, tau = Math.PI - alpha;
        const cut = rcA / Math.tan(alpha / 2);
        list.push([apexIdx, cut, (4 / 3) * Math.tan(tau / 4) * rcA / cut]);
      }
      d += ringPathD(ring, list, r2);
    }
    return { d, bbox: bboxOfPoints(all) };
  }
  // Closed polyline → path `d`, rounding the listed [vertexIndex, radius] corners
  // with a cubic fillet cut `radius` back along the ring on both sides. Radii are
  // clamped so neighbouring fillets never overlap; corners with radius ~0 stay sharp.
  function ringPathD(P, cornerList, r2) {
    const m = P.length;
    const cs = [0];
    for (let i = 1; i <= m; i++) cs.push(cs[i - 1] + Math.hypot(P[i % m][0] - P[i - 1][0], P[i % m][1] - P[i - 1][1]));
    const L = cs[m];
    const wrap = s => ((s % L) + L) % L;
    const ptAt = s => {
      s = wrap(s);
      let lo = 0, hi = m;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cs[mid] <= s) lo = mid; else hi = mid; }
      const a = P[lo], b = P[(lo + 1) % m], seg = cs[lo + 1] - cs[lo];
      const t = seg > 1e-12 ? (s - cs[lo]) / seg : 0;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    };
    const rounded = cornerList.filter(([, r]) => r > 0.05).map(([c, r, k, st]) => ({ c, r, k: k || 0.5523, st, s: cs[c] })).sort((a, b) => a.s - b.s);
    if (!rounded.length) return 'M ' + P.map(p => `${r2(p[0])},${r2(p[1])}`).join(' L ') + ' Z';
    // clamp: two fillets on one edge may each use at most half of it
    rounded.forEach((k, i) => {
      const nx = rounded[(i + 1) % rounded.length], pv = rounded[(i - 1 + rounded.length) % rounded.length];
      const dn = rounded.length > 1 ? wrap(nx.s - k.s) || L : L, dp = rounded.length > 1 ? wrap(k.s - pv.s) || L : L;
      k.r = Math.min(k.r, dn / 2, dp / 2);
    });
    const num = v => r2(v);
    const info = rounded.map(k => ({ ...k, B: ptAt(k.s - k.r), F: ptAt(k.s + k.r), C: P[k.c] }));
    let out = `M ${num(info[0].F[0])},${num(info[0].F[1])}`;
    info.forEach((k, i) => {
      const nx = info[(i + 1) % info.length];
      const sF = k.s + k.r, span = wrap((nx.s - nx.r) - sF);
      const vs = [];
      for (let v = 0; v < m; v++) { const rel = wrap(cs[v] - sF); if (rel > 1e-9 && rel < span - 1e-9) vs.push([rel, P[v]]); }
      vs.sort((a, b) => a[0] - b[0]).forEach(([, p]) => { out += ` L ${num(p[0])},${num(p[1])}`; });
      // curve at the NEXT corner: line to its back point, cubic through it
      if (nx.st === 'chamfer') { out += ` L ${num(nx.B[0])},${num(nx.B[1])} L ${num(nx.F[0])},${num(nx.F[1])}`; return; }
      let c1 = [nx.B[0] + (nx.C[0] - nx.B[0]) * nx.k, nx.B[1] + (nx.C[1] - nx.B[1]) * nx.k];
      let c2 = [nx.F[0] + (nx.C[0] - nx.F[0]) * nx.k, nx.F[1] + (nx.C[1] - nx.F[1]) * nx.k];
      if (nx.st === 'scoop') {   // concave: the arc of the circle centred on the corner itself (radius = the cut distance)
        const vb = [nx.B[0] - nx.C[0], nx.B[1] - nx.C[1]], vf = [nx.F[0] - nx.C[0], nx.F[1] - nx.C[1]];
        const dd = Math.hypot(vb[0], vb[1]) || 1, ang = Math.acos(Math.max(-1, Math.min(1, (vb[0] * vf[0] + vb[1] * vf[1]) / (dd * (Math.hypot(vf[0], vf[1]) || 1)))));
        const kk = 4 / 3 * Math.tan(ang / 4) * dd, tow = (v, to) => { let q = [-v[1] / dd, v[0] / dd]; if (q[0] * to[0] + q[1] * to[1] < 0) q = [-q[0], -q[1]]; return q; };
        const tb = tow(vb, [nx.F[0] - nx.B[0], nx.F[1] - nx.B[1]]), tf = tow(vf, [nx.B[0] - nx.F[0], nx.B[1] - nx.F[1]]);
        c1 = [nx.B[0] + tb[0] * kk, nx.B[1] + tb[1] * kk]; c2 = [nx.F[0] + tf[0] * kk, nx.F[1] + tf[1] * kk];
      }
      out += ` L ${num(nx.B[0])},${num(nx.B[1])} C ${num(c1[0])},${num(c1[1])} ${num(c2[0])},${num(c2[1])} ${num(nx.F[0])},${num(nx.F[1])}`;
    });
    return out + ' Z';
  }

  function arcGeometry(thicknessPct, pivot, sweepDeg, opts) {
    const isCenter = pivot === 'center';
    const sweep = Math.min(350, Math.max(10, sweepDeg == null ? 90 : sweepDeg));
    const extras = arcExtrasActive(opts);
    if (!extras && !isCenter && sweep === 90) return { d: arcPathD(thicknessPct), normTx: 0, normTy: 0, normScale: 1 };
    const cx = isCenter ? 50 : 0, cy = isCenter ? 50 : 0, outerR = isCenter ? 50 : 100;
    const start = isCenter ? -90 : 0;
    const innerR = outerR * (1 - thicknessPct / 100);
    if (extras) {
      const b = arcBuild(cx, cy, outerR, start, sweep, innerR, opts);
      return { d: b.d, ...fitToBox(b.bbox) };
    }
    const d = arcWedgePathD(cx, cy, outerR, start, sweep, innerR);
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const a = (start + sweep * i / 64) * Math.PI / 180;
      pts.push([cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR]);
      if (innerR > 0.5) pts.push([cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR]);
    }
    if (innerR <= 0.5) pts.push([cx, cy]);
    return { d, ...fitToBox(bboxOfPoints(pts)) };
  }

  // Circle, centred at (50,50): radiusPct 100 touches the box edges.
  // `opts` (optional) switches on the Circle's advanced modifiers — see
  // shared/circle-advanced.js. Absent / all Off → the plain analytic circle
  // below, byte-identical to before; also the fallback if that module (and
  // Paper.js) isn't loaded, so Genesis and Trellis never depend on Paper.
  function circleGeometry(radiusPct, opts) {
    const adv = Organica.circleAdvanced;
    if (opts && adv && global.paper && adv.isActive(Object.assign({}, adv.DEFAULTS, opts))) {
      const res = adv.buildWithBounds(radiusPct, opts), d = res.d;
      // Rotate can push a squircle's corners past the cell → shrink+recentre only on overflow; every other case stays 1:1.
      if (d) return opts.rotate && res.bounds ? overflowNorm(d, res.bounds) : { d, normTx: 0, normTy: 0, normScale: 1 };
    }
    const r = 50 * Math.min(100, Math.max(5, radiusPct == null ? 100 : radiusPct)) / 100;
    const r2 = v => Math.round(v * 1000) / 1000;
    const d = `M ${r2(50 - r)},50 A ${r2(r)},${r2(r)} 0 1,1 ${r2(50 + r)},50 A ${r2(r)},${r2(r)} 0 1,1 ${r2(50 - r)},50 Z`;
    return { d, normTx: 0, normTy: 0, normScale: 1 };
  }

  // Segment: a horizontal line through the centre. Zero area, so it only
  // shows in Stroke style (FVS switches Style for it, same as Genesis).
  function segmentGeometry(lenPct, opts) {
    if (segmentExtrasActive(opts)) return segmentBuild(lenPct, opts);
    const len = Math.min(100, Math.max(5, lenPct == null ? 70 : lenPct));
    return { d: `M ${50 - len / 2},50 L ${50 + len / 2},50`, normTx: 0, normTy: 0, normScale: 1 };
  }

  // Drop / teardrop — Genesis Create's dropPathD in the 0..100 box. The tail
  // makes it taller than the box, so it is fitted rather than clipped.
  function dropGeometry(radiusPct, tailPct, opts) {
    if (dropExtrasActive(opts)) return dropBuild(radiusPct, tailPct, opts);
    const r = 50 * Math.min(100, Math.max(5, radiusPct == null ? 60 : radiusPct)) / 100;
    const tail = Math.min(100, Math.max(0, tailPct == null ? 50 : tailPct));
    const r2 = v => Math.round(v * 1000) / 1000;
    const cx = 50, cy = 50 + r * 0.3, tipY = cy - r - tail;
    const d = `M ${r2(cx)},${r2(tipY)} `
      + `C ${r2(cx - r * 0.6)},${r2(tipY + tail * 0.5)} ${r2(cx - r)},${r2(cy - r * 0.6)} ${r2(cx - r)},${r2(cy)} `
      + `A ${r2(r)},${r2(r)} 0 1,0 ${r2(cx + r)},${r2(cy)} `
      + `C ${r2(cx + r)},${r2(cy - r * 0.6)} ${r2(cx + r * 0.6)},${r2(tipY + tail * 0.5)} ${r2(cx)},${r2(tipY)} Z`;
    return { d, ...fitToBox({ x: cx - r, y: tipY, w: 2 * r, h: cy + r - tipY }) };
  }

  // Blob — a noise-wobbled closed loop (Genesis Create's blobPathD): same
  // seed, same silhouette. Needs Organica.noise (shared/noise.js).
  function blobGeometry(radiusPct, amount, seed, opts) {
    if (blobExtrasActive(opts)) return blobBuild(radiusPct, amount, seed, opts);
    const r = 50 * Math.min(100, Math.max(5, radiusPct == null ? 60 : radiusPct)) / 100;
    const amt = (amount == null ? 40 : amount) / 100, sd = seed == null ? 1 : seed;
    const r2 = v => Math.round(v * 1000) / 1000;
    const n = 32, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const nv = Organica.noise.simplex2(Math.cos(a) * 0.7 + sd, Math.sin(a) * 0.7 + sd);
      const rr = r * (1 + nv * 0.4 * amt);
      pts.push([50 + Math.cos(a) * rr, 50 + Math.sin(a) * rr]);
    }
    const d = 'M ' + pts.map(p => `${r2(p[0])},${r2(p[1])}`).join(' L ') + ' Z';
    return { d, ...fitToBox(bboxOfPoints(pts)) };
  }

  // Concentric semicircular arc bands from the top AND bottom edge midpoints,
  // mirrored into a butterfly (bookofshapes concentric_arc_truchet_3). One
  // compound `d` (each band is its own closed annular half-ring, non-
  // overlapping → no fill-rule needed). Inscribed in the 0–100 box (max
  // radius 50, the two fans meet at the centre) — no per-cell clip needed.
  // `count` = bands per fan; `ratio` = band-thickness ÷ gap.
  function arcTruchetPathD(count, ratio) {
    count = Math.max(1, Math.round(count == null ? 5 : count));
    ratio = Math.min(0.95, Math.max(0.1, ratio == null ? 0.7 : ratio));
    const cx = 50, step = 50 / count, t = step * ratio;
    const r2 = v => Math.round(v * 1000) / 1000;
    let d = '';
    // side −1 = bottom pivot (py=100, opens up); side +1 = top pivot (py=0, opens down).
    // sweep=1 from left→right bulges UP in SVG's y-down space; the inner arc
    // travels right→left so it takes the opposite flag to bulge the same way.
    const fan = (py, side) => {
      const swOut = side < 0 ? 1 : 0, swIn = side < 0 ? 0 : 1;
      for (let i = 1; i <= count; i++) {
        const R = i * step, r = R - t;
        if (r <= 0.5) {
          d += `M ${r2(cx - R)},${py} A ${r2(R)},${r2(R)} 0 0 ${swOut} ${r2(cx + R)},${py} Z`;
        } else {
          d += `M ${r2(cx - R)},${py} A ${r2(R)},${r2(R)} 0 0 ${swOut} ${r2(cx + R)},${py}`
            + ` L ${r2(cx + r)},${py} A ${r2(r)},${r2(r)} 0 0 ${swIn} ${r2(cx - r)},${py} Z`;
        }
      }
    };
    fan(100, -1);
    fan(0, 1);
    return d;
  }
  // ── Arc truchet extras (Fans · Core · Spread · Reach · Ramp · Curve · Rounding · Segments) ──
  // Only reached when an extra is ACTIVE; with all of them at default
  // arcTruchetGeometry() returns arcTruchetPathD() untouched (byte-identical —
  // Trellis, saved Components/Symbols and the Radial rules depend on that).
  // Everything stays analytic (true `A` arcs + exact fillets, no sampling) and
  // inscribed in the 0..100 box: radii ≤ 50, fans centred on the vertical axis
  // with spread ≤ 180°, bands never overlap (thickness ≤ 0.95 × the local step),
  // so still no fill-rule, no fit and no per-cell clip.
  function truchetExtrasActive(o) {
    return !!o && ((o.fans != null && o.fans !== 2) || (o.core || 0) > 0 || (o.spread != null && o.spread < 180) || (o.reach != null && o.reach < 100)
      || (o.ramp || 0) !== 0 || (o.curve || 0) !== 0 || (o.round || 0) > 0 || (o.segs || 1) > 1);
  }
  // One sector/band segment between angles p0<p1 (degrees, measured from the +x
  // direction into the half-plane given by sgn: −1 = up on screen), outer radius
  // R, inner radius r (<= 0.5 → solid wedge with an apex at the pivot). rc = corner
  // fillet radius: the fillet circle is tangent to the arc and to the radial end
  // line — centre at distance (R−rc) / (r+rc) from the pivot, angular offset
  // asin(rc/(R−rc)) / asin(rc/(r+rc)), tangent on the radial line at
  // √((R−rc)²−rc²) / √((r+rc)²−rc²). At rc = t/2 the two tangent points meet →
  // a perfect semicircular cap. Shared by Arc truchet (defaults) and Wedge:
  //   o.sq        y-scale about the pivot (an axis-aligned scale keeps every
  //               fillet tangent; arcs become A R,R·sq)
  //   o.rot       rigid rotation (deg) about the pivot; arcs carry it as x-axis-rotation
  //   o.apexRound also fillet the apex of a solid wedge (span < 180°)
  //   o.curve     −100..100 bows the two radial edges (+ outward, − inward)
  function sectorD(cx, py, sgn, R, r, p0, p1, round, o) {
    o = o || {};
    const sq = o.sq == null ? 1 : o.sq, rot = o.rot || 0, curve = o.curve || 0;
    const r2 = v => Math.round(v * 1000) / 1000;
    const rad = Math.PI / 180, apex = r <= 0.5, span = (p1 - p0) * rad;
    const cr = Math.cos(rot * rad), sr = Math.sin(rot * rad);
    const map = (x, y) => { y *= sq; if (rot) { const xr = x * cr - y * sr; y = x * sr + y * cr; x = xr; } return [cx + x, py + y]; };
    const pt = (dist, deg) => map(dist * Math.cos(deg * rad), sgn * dist * Math.sin(deg * rad));
    const fmt = q => `${r2(q[0])},${r2(q[1])}`;
    const P = (dist, deg) => fmt(pt(dist, deg));
    const inc = sgn < 0 ? 0 : 1, dec = 1 - inc;           // sweep flag for increasing / decreasing angle
    const AR = (rr, large, sw) => `A ${r2(rr)},${r2(rr * sq)} ${rot ? r2(rot) : 0} ${large} ${sw}`;
    // radial edge from distance d1 to d2 at angle deg; s = +1 if outward is the +angle side
    const seg = (d1, d2, deg, s) => {
      if (!curve) return `L ${P(d2, deg)}`;
      const len = Math.abs(d2 - d1), dm = (d1 + d2) / 2;
      let dev = curve / 100 * 0.3 * len;
      if (dev < 0) dev = Math.max(dev, -0.9 * dm * Math.sin(Math.min(span, Math.PI) / 2));
      const a = deg * rad, off = 2 * dev * s;
      const c = map(dm * Math.cos(a) - off * Math.sin(a), sgn * (dm * Math.sin(a) + off * Math.cos(a)));
      return `Q ${fmt(c)} ${P(d2, deg)}`;
    };
    const apexOn = apex && !!o.apexRound && span < Math.PI - 1e-6;
    let rc = round * (apex ? R / 2 : (R - r) / 2);
    rc = Math.min(rc, (apex ? R : Math.min(R, (R + r) / 2)) / 2 * 0.999);
    const angOf = c => Math.max(Math.asin(Math.min(1, c / (R - c))), apex ? 0 : Math.asin(Math.min(1, c / (r + c))));
    const fits = c => 2 * angOf(c) <= span * 0.999 && (!apexOn || c / Math.tan(span / 2) <= 0.6 * Math.sqrt(Math.max(0, (R - c) ** 2 - c * c)));
    if (rc > 0 && !fits(rc)) {                             // clamp so neighbouring fillets never overlap
      let lo = 0, hi = rc;
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (!fits(mid)) hi = mid; else lo = mid; }
      rc = lo;
    }
    if (rc < 0.02) {                                       // sharp ends: plain arcs + radial edges
      const large = span > Math.PI ? 1 : 0;
      return apex
        ? `M ${fmt(map(0, 0))} ${seg(0, R, p0, -1)} ${AR(R, large, inc)} ${P(R, p1)}${curve ? ' ' + seg(R, 0, p1, 1) : ''} Z`
        : `M ${P(r, p0)} ${seg(r, R, p0, -1)} ${AR(R, large, inc)} ${P(R, p1)} ${seg(R, r, p1, 1)} ${AR(r, large, dec)} ${P(r, p0)} Z`;
    }
    const to = Math.asin(rc / (R - rc)) / rad, dO = Math.sqrt((R - rc) ** 2 - rc * rc);
    const F = `${AR(rc, 0, inc)}`;
    const arcO = `${AR(R, (p1 - p0 - 2 * to) > 180 ? 1 : 0, inc)} ${P(R, p1 - to)}`;
    if (apex) {
      if (apexOn) {
        const t = rc / Math.tan(span / 2);
        return `M ${P(t, p0)} ${seg(t, dO, p0, -1)} ${F} ${P(R, p0 + to)} ${arcO} ${F} ${P(dO, p1)} ${seg(dO, t, p1, 1)} ${F} ${P(t, p0)} Z`;
      }
      return `M ${fmt(map(0, 0))} ${seg(0, dO, p0, -1)} ${F} ${P(R, p0 + to)} ${arcO} ${F} ${P(dO, p1)}${curve ? ' ' + seg(dO, 0, p1, 1) : ''} Z`;
    }
    const ti = Math.asin(rc / (r + rc)) / rad, dI = Math.sqrt((r + rc) ** 2 - rc * rc);
    const line0 = Math.abs(dO - dI) > 1e-4;
    return `M ${P(dI, p0)}${line0 ? ` ${seg(dI, dO, p0, -1)}` : ''} ${F} ${P(R, p0 + to)} ${arcO} ${F} ${P(dO, p1)}`
      + `${line0 ? ` ${seg(dO, dI, p1, 1)}` : ''} ${F} ${P(r, p1 - ti)} ${AR(r, (p1 - p0 - 2 * ti) > 180 ? 1 : 0, dec)} ${P(r, p0 + ti)} ${F} ${P(dI, p0)} Z`;
  }
  function truchetBuild(count, ratio, o) {
    count = Math.max(1, Math.round(count == null ? 5 : count));
    ratio = Math.min(0.95, Math.max(0.1, ratio == null ? 0.7 : ratio));
    const clampN = (v, lo, hi, def) => Math.min(hi, Math.max(lo, v == null ? def : v));
    const fans = o.fans === 1 ? 1 : 2;
    const reach = 50 * clampN(o.reach, 30, 100, 100) / 100;
    const c0 = reach * clampN(o.core, 0, 80, 0) / 100;
    const cv = clampN(o.curve, -100, 100, 0) / 100, pw = cv >= 0 ? 1 + cv * 2 : 1 / (1 + -cv * 2);
    const ramp = clampN(o.ramp, -100, 100, 0) / 100;
    const spread = clampN(o.spread, 60, 180, 180), p0all = 90 - spread / 2;
    const segs = Math.round(clampN(o.segs, 1, 8, 1)), gapF = clampN(o.gap, 0, 80, 20) / 100;
    const round = clampN(o.round, 0, 100, 0) / 100;
    const segLen = spread / (segs + (segs - 1) * gapF), pitch = segLen * (1 + gapF);
    let d = '';
    const fan = (py, sgn) => {
      let prev = c0;
      for (let i = 1; i <= count; i++) {
        const R = c0 + (reach - c0) * Math.pow(i / count, pw), step = R - prev;
        const f = count > 1 ? (i - 1) / (count - 1) : 0.5;
        const ri = Math.min(0.95, Math.max(0.1, ratio * (1 + ramp * (2 * f - 1))));
        const r = R - step * ri;
        for (let k = 0; k < segs; k++) d += sectorD(50, py, sgn, R, r, p0all + k * pitch, p0all + k * pitch + segLen, round) + ' ';
        prev = R;
      }
    };
    fan(100, -1);
    if (fans === 2) fan(0, 1);
    return d.trim();
  }
  function arcTruchetGeometry(count, ratio, opts) {
    if (truchetExtrasActive(opts)) return { d: truchetBuild(count, ratio, opts), normTx: 0, normTy: 0, normScale: 1 };
    return { d: arcTruchetPathD(count, ratio), normTx: 0, normTy: 0, normScale: 1 };
  }

  // Pie / wedge slice, pivoted at the box centre (50,50), radius 50 (touches
  // the box's edge midpoints — same "fills the box at full param" scale as
  // triangleGeometry). Symmetric about the upward vertical axis so a plain
  // rotation transform sweeps it intuitively. angle=360 falls back to a
  // full disc/annulus (two half-circle arcs, same ir<=0.5 solid-vs-ring
  // branch as arcPathD); outer/inner arcs wind opposite directions so the
  // hole reads correctly under the default nonzero fill-rule, no
  // fill-rule attribute needed.
  // squashPct (30-100, default 100 — byte-identical to the plain circular
  // wedge) scales the whole shape vertically only, turning the circular
  // sector into an elliptical one — every radius becomes an (rx,ry) pair
  // (rx = rad, ry = rad*squash) rather than a single circle radius; the M/L
  // endpoints already come from pt(), which applies the same y-scale, so
  // they land exactly on the ellipse regardless of squash.
  function wedgePathD(angle, innerRadiusPct, squashPct) {
    angle = Math.min(360, Math.max(1, angle == null ? 90 : angle));
    innerRadiusPct = Math.min(95, Math.max(0, innerRadiusPct == null ? 0 : innerRadiusPct));
    const squash = Math.min(1, Math.max(0.3, (squashPct == null ? 100 : squashPct) / 100));
    const cx = 50, cy = 50, R = 50, r = R * innerRadiusPct / 100;
    const r2 = v => Math.round(v * 1000) / 1000;
    const pt = (deg, rad) => {
      const t = (deg - 90) * Math.PI / 180;
      return [r2(cx + rad * Math.cos(t)), r2(cy + rad * Math.sin(t) * squash)];
    };
    const ry = rad => r2(rad * squash);
    if (angle >= 359.9) {
      const outer = `M ${cx - R},${cy} A ${R},${ry(R)} 0 1,1 ${cx + R},${cy} A ${R},${ry(R)} 0 1,1 ${cx - R},${cy} Z`;
      if (r <= 0.5) return outer;
      const inner = `M ${cx - r},${cy} A ${r},${ry(r)} 0 1,0 ${cx + r},${cy} A ${r},${ry(r)} 0 1,0 ${cx - r},${cy} Z`;
      return outer + ' ' + inner;
    }
    const half = angle / 2, large = angle > 180 ? 1 : 0;
    const [ox0, oy0] = pt(-half, R), [ox1, oy1] = pt(half, R);
    if (r <= 0.5) {
      return `M ${cx},${cy} L ${ox0},${oy0} A ${R},${ry(R)} 0 ${large},1 ${ox1},${oy1} Z`;
    }
    const [ix0, iy0] = pt(-half, r), [ix1, iy1] = pt(half, r);
    return `M ${ix0},${iy0} L ${ox0},${oy0} A ${R},${ry(R)} 0 ${large},1 ${ox1},${oy1}`
      + ` L ${ix1},${iy1} A ${r},${ry(r)} 0 ${large},0 ${ix0},${iy0} Z`;
  }
  // Wedge extras (Corner rounding incl. the apex · Rotate · Edge curvature ·
  // Irregularity+Seed). All at default → wedgePathD untouched (byte-identical).
  // Active → sectorD (analytic true arcs + exact fillets, same maths as Arc
  // truchet's bands); with Irregularity the sampled arcBuild takes over so the
  // look does not jump. Rotation is about the centre, so the shape stays inside
  // the radius-50 circle → still inscribed, normScale 1.
  function wedgeExtrasActive(o) {
    return !!o && ((o.round || 0) > 0 || (o.rotate || 0) !== 0 || (o.curve || 0) !== 0 || (o.irregular || 0) > 0);
  }
  function wedgeBuild(angle, innerRadiusPct, squashPct, o) {
    angle = Math.min(360, Math.max(1, angle == null ? 90 : angle));
    innerRadiusPct = Math.min(95, Math.max(0, innerRadiusPct == null ? 0 : innerRadiusPct));
    const sq = Math.min(1, Math.max(0.3, (squashPct == null ? 100 : squashPct) / 100));
    const R = 50, r = R * innerRadiusPct / 100, r2 = v => Math.round(v * 1000) / 1000;
    const round = Math.min(100, Math.max(0, o.round || 0)) / 100, rot = Math.min(180, Math.max(-180, o.rotate || 0));
    const curve = Math.min(100, Math.max(-100, o.curve || 0)), irr = Math.min(100, Math.max(0, o.irregular || 0));
    const full = angle >= 359.9;
    if (irr > 0) {
      const sweep = full ? 359.5 : angle;
      return arcBuild(50, 50, R, -90 - sweep / 2, sweep, r, { irregular: irr, seed: o.seed, round: round * 100, squash: sq, rotate: rot, edgeCurve: full ? 0 : curve, apexRound: true });
    }
    if (full) {                                            // full disc / annulus — no corners, no edges; only Rotate can show (squashed)
      const xr = rot ? r2(rot) : 0, ell = rr => `${r2(rr)},${r2(rr * sq)} ${xr}`;
      const rc = Math.cos(rot * Math.PI / 180), rs = Math.sin(rot * Math.PI / 180);
      const at = rr => [[50 - rr * rc, 50 - rr * rs], [50 + rr * rc, 50 + rr * rs]].map(q => `${r2(q[0])},${r2(q[1])}`);
      const [o0, o1] = at(R);
      const outer = `M ${o0} A ${ell(R)} 1,1 ${o1} A ${ell(R)} 1,1 ${o0} Z`;
      if (r <= 0.5) return { d: outer };
      const [i0, i1] = at(r);
      return { d: outer + ' ' + `M ${i0} A ${ell(r)} 1,0 ${i1} A ${ell(r)} 1,0 ${i0} Z` };
    }
    return { d: sectorD(50, 50, -1, R, r, 90 - angle / 2, 90 + angle / 2, round, { sq, rot, apexRound: true, curve }) };
  }
  function wedgeGeometry(angle, innerRadiusPct, squashPct, opts) {
    if (wedgeExtrasActive(opts)) {
      const b = wedgeBuild(angle, innerRadiusPct, squashPct, opts);
      // Irregularity can push the wobbled rim past the box; shrink + recentre ONLY on overflow (Triangle's pattern)
      if (b.bbox && (b.bbox.x < 0 || b.bbox.y < 0 || b.bbox.x + b.bbox.w > 100 || b.bbox.y + b.bbox.h > 100)) {
        const sc = Math.min(1, 100 / Math.max(b.bbox.w, 1e-6), 100 / Math.max(b.bbox.h, 1e-6));
        return { d: b.d, normTx: 50 / sc - (b.bbox.x + b.bbox.w / 2), normTy: 50 / sc - (b.bbox.y + b.bbox.h / 2), normScale: sc };
      }
      return { d: b.d, normTx: 0, normTy: 0, normScale: 1 };
    }
    return { d: wedgePathD(angle, innerRadiusPct, squashPct), normTx: 0, normTy: 0, normScale: 1 };
  }

  // Shared "rounded polygon" construction — rounds every vertex of an
  // arbitrary point-list polygon by pulling two points back along its
  // adjacent edges (each pull is a FRACTION of that edge's own length, so
  // it scales safely regardless of how short an edge is — opposite corners
  // meet at worst at an edge's own midpoint, degenerating that edge to a
  // point rather than overlapping past it) and bridging them with a
  // quadratic curve through the original vertex. Works for any polygon,
  // convex or concave (reflex) vertices alike — used by Polygon and Cross.
  // Same family as the corner-clamp trick already used elsewhere in this
  // project (Apostate's sharpen/polygonizevec).
  function roundedPolyPathD(pts, cornerRadiusPct) {
    const cornerPct = Math.min(100, Math.max(0, cornerRadiusPct == null ? 0 : cornerRadiusPct));
    const r2 = v => Math.round(v * 1000) / 1000;
    const n = pts.length;
    if (cornerPct <= 0.5) {
      return 'M ' + pts.map(p => `${r2(p[0])},${r2(p[1])}`).join(' L ') + ' Z';
    }
    const frac = cornerPct / 100 * 0.5;
    let d = '';
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
      const p1 = [cur[0] + (prev[0] - cur[0]) * frac, cur[1] + (prev[1] - cur[1]) * frac];
      const p2 = [cur[0] + (next[0] - cur[0]) * frac, cur[1] + (next[1] - cur[1]) * frac];
      d += (i === 0 ? 'M ' : 'L ') + `${r2(p1[0])},${r2(p1[1])} `;
      d += `Q ${r2(cur[0])},${r2(cur[1])} ${r2(p2[0])},${r2(p2[1])} `;
    }
    return d + 'Z';
  }

  // Regular polygon, centred at (50,50), radius 50 (vertices touch the box
  // edges — pointy-top). irregularityPct (0-100, default 0 — byte-identical
  // to the regular polygon) jitters each vertex's own radius by a seeded
  // amount, up to ±50% of that jitter at 100%; a fresh mulberry32(seed)
  // stream each call so the same seed always reproduces the same
  // silhouette (same discipline as Symbols' own
  // generateSymbolCells/ruleRandom).
  function polygonPathD(sides, cornerRadiusPct, irregularityPct, seed, radiusPct) {
    sides = Math.max(3, Math.round(sides == null ? 6 : sides));
    const irregular = Math.min(100, Math.max(0, irregularityPct == null ? 0 : irregularityPct)) / 100;
    const cx = 50, cy = 50, R = 50 * Math.min(100, Math.max(10, radiusPct == null ? 100 : radiusPct)) / 100;
    const rng = Organica.mulberry32((seed == null ? 1 : seed) >>> 0);
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const t = (i * 360 / sides - 90) * Math.PI / 180;
      const rad = R * (1 - irregular * 0.5 + rng() * irregular);
      pts.push([cx + rad * Math.cos(t), cy + rad * Math.sin(t)]);
    }
    return roundedPolyPathD(pts, cornerRadiusPct);
  }
  // Polygon extras (Rotate · Step (star polygon {n/k}) · Corner style · Edge
  // curvature · Outline (hollow) · Angle jitter). All at default →
  // polygonPathD untouched (byte-identical). Active → polygonBuild: same
  // vertices (same rng order, so Irregularity looks identical), each Step loop
  // through triRing. Outward curvature can pass the box → shrink+recentre only
  // on overflow (Triangle's pattern).
  function polygonExtrasActive(o) {
    return !!o && ((o.rotate || 0) !== 0 || (o.step || 1) > 1 || (o.curve || 0) !== 0 || (o.outline || 0) > 0 || (o.skew || 0) > 0 || (o.style && o.style !== 'round'));
  }
  function polygonBuild(sides, cornerPct, irregularityPct, seed, radiusPct, o) {
    sides = Math.max(3, Math.round(sides == null ? 6 : sides));
    const cl = (v, lo, hi) => Math.min(hi, Math.max(lo, v == null ? 0 : v));
    const irregular = cl(irregularityPct, 0, 100) / 100, corner = cl(cornerPct, 0, 100);
    const R = 50 * Math.min(100, Math.max(10, radiusPct == null ? 100 : radiusPct)) / 100;
    const rot = cl(o.rotate, -180, 180), curve = cl(o.curve, -100, 100), outline = cl(o.outline, 0, 95), skew = cl(o.skew, 0, 100) / 100;
    const kMax = Math.max(1, Math.floor((sides - 1) / 2)), step = Math.min(kMax, Math.max(1, Math.round(o.step || 1)));
    const style = o.style === 'chamfer' || o.style === 'scoop' ? o.style : 'round';
    const rng = Organica.mulberry32((seed == null ? 1 : seed) >>> 0);
    const rng2 = skew > 0 ? Organica.mulberry32(((seed == null ? 1 : seed) ^ 0x9e3779b9) >>> 0) : null;
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const jit = rng2 ? (rng2() - 0.5) * 2 * skew * 0.45 * (360 / sides) : 0;
      const t = (i * 360 / sides - 90 + rot + jit) * Math.PI / 180;
      const rad = R * (1 - irregular * 0.5 + rng() * irregular);
      pts.push([50 + rad * Math.cos(t), 50 + rad * Math.sin(t)]);
    }
    const gcd = (a, b) => b ? gcd(b, a % b) : a, g = gcd(sides, step), per = sides / g;
    const centre = [50, 50];
    let d = '', x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let l = 0; l < g; l++) {
      const loop = [];
      for (let j = 0; j < per; j++) loop.push(pts[(l + j * step) % sides]);
      const ring = triRing(loop, corner, curve, centre, style);
      d += (d ? ' ' : '') + ring.d;
      ring.samples.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
      if (outline > 0 && step === 1) {
        const k = 1 - outline / 100;
        const inner = loop.slice().reverse().map(q => [50 + (q[0] - 50) * k, 50 + (q[1] - 50) * k]);   // reversed winding cuts the hole
        d += ' ' + triRing(inner, corner, curve, centre, style).d;
      }
    }
    if (x0 < 0 || y0 < 0 || x1 > 100 || y1 > 100) {
      const sc = Math.min(1, 100 / Math.max(x1 - x0, 1e-6), 100 / Math.max(y1 - y0, 1e-6));
      return { d, normTx: 50 / sc - (x0 + x1) / 2, normTy: 50 / sc - (y0 + y1) / 2, normScale: sc };
    }
    return { d, normTx: 0, normTy: 0, normScale: 1 };
  }
  function polygonGeometry(sides, cornerRadiusPct, irregularityPct, seed, radiusPct, opts) {
    if (polygonExtrasActive(opts)) return polygonBuild(sides, cornerRadiusPct, irregularityPct, seed, radiusPct, opts);
    return { d: polygonPathD(sides, cornerRadiusPct, irregularityPct, seed, radiusPct), normTx: 0, normTy: 0, normScale: 1 };
  }

  // Star: `points`-pointed, alternating outer (radius 50, box-edge-touching)
  // and inner (innerRadiusPct of outer) vertices, centred at (50,50).
  // irregularityPct (0-100, default 0 — byte-identical to the regular
  // star) jitters each of the outer AND inner vertices' own radius by a
  // seeded amount, same discipline as polygonPathD's own irregularity.
  function starPathD(points, innerRadiusPct, irregularityPct, seed, radiusPct) {
    points = Math.max(3, Math.round(points == null ? 5 : points));
    innerRadiusPct = Math.min(90, Math.max(5, innerRadiusPct == null ? 45 : innerRadiusPct));
    const irregular = Math.min(100, Math.max(0, irregularityPct == null ? 0 : irregularityPct)) / 100;
    const cx = 50, cy = 50, R = 50 * Math.min(100, Math.max(10, radiusPct == null ? 100 : radiusPct)) / 100, r = R * innerRadiusPct / 100;
    const rng = Organica.mulberry32((seed == null ? 1 : seed) >>> 0);
    const r2 = v => Math.round(v * 1000) / 1000;
    const n = points * 2, pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i * 360 / n - 90) * Math.PI / 180;
      const base = i % 2 === 0 ? R : r;
      const rad = base * (1 - irregular * 0.5 + rng() * irregular);
      pts.push([cx + rad * Math.cos(t), cy + rad * Math.sin(t)]);
    }
    return 'M ' + pts.map(p => `${r2(p[0])},${r2(p[1])}`).join(' L ') + ' Z';
  }
  function starGeometry(points, innerRadiusPct, irregularityPct, seed, radiusPct, opts) {
    if (starExtrasActive(opts)) return starBuild(points, innerRadiusPct, irregularityPct, seed, radiusPct, opts);
    return { d: starPathD(points, innerRadiusPct, irregularityPct, seed, radiusPct), normTx: 0, normTy: 0, normScale: 1 };
  }

  // Rounded rect / capsule, centred at (50,50). cornerRadiusPct maps to a
  // fraction of min(width,height)/2 — 0 is a plain axis-aligned rect, 100 is
  // a full stadium/pill (fully rounded on the shorter axis), same "half the
  // shorter side" cap as CSS border-radius.
  function roundedRectPathD(widthPct, heightPct, cornerRadiusPct) {
    const w = Math.min(100, Math.max(5, widthPct == null ? 100 : widthPct));
    const h = Math.min(100, Math.max(5, heightPct == null ? 100 : heightPct));
    const cornerPct = Math.min(100, Math.max(0, cornerRadiusPct == null ? 0 : cornerRadiusPct));
    const x0 = 50 - w / 2, x1 = 50 + w / 2, y0 = 50 - h / 2, y1 = 50 + h / 2;
    const r = Math.min(w, h) / 2 * (cornerPct / 100);
    if (r <= 0.5) return `M ${x0},${y0} L ${x1},${y0} L ${x1},${y1} L ${x0},${y1} Z`;
    const r2 = v => Math.round(v * 1000) / 1000;
    return `M ${r2(x0 + r)},${r2(y0)} L ${r2(x1 - r)},${r2(y0)} A ${r2(r)},${r2(r)} 0 0,1 ${r2(x1)},${r2(y0 + r)}`
      + ` L ${r2(x1)},${r2(y1 - r)} A ${r2(r)},${r2(r)} 0 0,1 ${r2(x1 - r)},${r2(y1)}`
      + ` L ${r2(x0 + r)},${r2(y1)} A ${r2(r)},${r2(r)} 0 0,1 ${r2(x0)},${r2(y1 - r)}`
      + ` L ${r2(x0)},${r2(y0 + r)} A ${r2(r)},${r2(r)} 0 0,1 ${r2(x0 + r)},${r2(y0)} Z`;
  }
  function roundedRectGeometry(widthPct, heightPct, cornerRadiusPct, opts) {
    if (rrExtrasActive(opts)) return rrBuild(widthPct, heightPct, cornerRadiusPct, opts);
    return { d: roundedRectPathD(widthPct, heightPct, cornerRadiusPct), normTx: 0, normTy: 0, normScale: 1 };
  }

  // Chevron / V-ribbon, apex up, outer legs always fixed to the box's own
  // bottom corners (same "fills the cell corner to corner" convention as
  // Triangle/Arc at their own full-param defaults) — a simple 6-point
  // polygon, no boolean/hole needed since the ribbon's two "feet" both rest
  // on the bottom edge. notchPct sets how far down the inner V's apex sits
  // (as a % of box height); armPct sets the ribbon's own thickness, as a %
  // of the outer half-span, independent of notch depth.
  // squashPct (30-100, default 100 — byte-identical to the plain chevron)
  // scales every point's own y toward the box's own vertical centre
  // (y' = 50 + (y-50)*squash), compressing the ribbon's height while
  // keeping it centred — same "vertical-only, centred" convention as
  // Wedge's own Squash.
  function chevronPathD(notchPct, armPct, squashPct) {
    const notchY = Math.min(90, Math.max(10, notchPct == null ? 40 : notchPct));
    const arm = Math.min(80, Math.max(20, armPct == null ? 55 : armPct));
    const squash = Math.min(1, Math.max(0.3, (squashPct == null ? 100 : squashPct) / 100));
    const cx = 50, halfSpread = 50, innerHalf = halfSpread * (arm / 100);
    const sy = y => 50 + (y - 50) * squash;
    const r2 = v => Math.round(v * 1000) / 1000;
    const pts = [
      [cx, sy(0)], [cx + halfSpread, sy(100)], [cx + innerHalf, sy(100)],
      [cx, sy(notchY)], [cx - innerHalf, sy(100)], [cx - halfSpread, sy(100)],
    ];
    return 'M ' + pts.map(p => `${r2(p[0])},${r2(p[1])}`).join(' L ') + ' Z';
  }
  function chevronGeometry(notchPct, armPct, squashPct, opts) {
    if (chevronExtrasActive(opts)) return chevronBuild(notchPct, armPct, squashPct, opts);
    return { d: chevronPathD(notchPct, armPct, squashPct), normTx: 0, normTy: 0, normScale: 1 };
  }

  // Cross / plus, centred at (50,50), axis-aligned — the standard 12-point
  // plus polygon. armWidthPct sets each bar's thickness (% of the box);
  // armLengthPct sets how far the bars reach from centre, as a % of the
  // box's own half-extent (100 = touches every edge, less = a floating
  // cross inset from the cell's edges). armWidth is clamped below
  // armLength so the shape can never self-intersect.
  // cornerRadiusPct (0-100, default 0 — byte-identical to the sharp plus)
  // rounds every one of the 12 vertices via roundedPolyPathD — including
  // the 8 reflex (concave, inward-facing) corners at the crook of each
  // arm, which the shared pull-back-by-fraction construction handles the
  // same way as an ordinary convex corner.
  function crossPathD(armWidthPct, armLengthPct, cornerRadiusPct) {
    const length = Math.min(50, Math.max(15, (armLengthPct == null ? 100 : armLengthPct) / 100 * 50));
    const width = Math.min(50, Math.max(5, armWidthPct == null ? 35 : armWidthPct));
    const aw = Math.min(width / 2, length * 0.9), al = length, cx = 50, cy = 50;
    const pts = [
      [cx - aw, cy - al], [cx + aw, cy - al], [cx + aw, cy - aw],
      [cx + al, cy - aw], [cx + al, cy + aw], [cx + aw, cy + aw],
      [cx + aw, cy + al], [cx - aw, cy + al], [cx - aw, cy + aw],
      [cx - al, cy + aw], [cx - al, cy - aw], [cx - aw, cy - aw],
    ];
    return roundedPolyPathD(pts, cornerRadiusPct);
  }
  function crossGeometry(armWidthPct, armLengthPct, cornerRadiusPct, opts) {
    if (crossExtrasActive(opts)) return crossBuild(armWidthPct, armLengthPct, cornerRadiusPct, opts);
    return { d: crossPathD(armWidthPct, armLengthPct, cornerRadiusPct), normTx: 0, normTy: 0, normScale: 1 };
  }

  // Lens / vesica — two circular arcs sharing fixed tips at (50,0)/(50,100)
  // (the box's own top/bottom midpoints), bulging left and right to a
  // combined width of widthPct at the vertical midline. For each arc, the
  // circle is the one passing through both tips and the target midline
  // point — solved directly (centre lies on y=50 by the tips' own
  // symmetry): with halfW = width/2 and k = halfW/2 - 1250/halfW, the
  // radius is R = sqrt(k² + 50²). The two arcs need the SAME sweep-flag
  // (both 0) to bulge to opposite sides — confirmed empirically by
  // rasterising and pixel-probing both edges + the tips (see fvs
  // session notes: the "opposite flags" guess that looks right on paper
  // actually retraces the same side and leaves a zero-area lens).
  function lensPathD(widthPct) {
    const w = Math.min(95, Math.max(8, widthPct == null ? 50 : widthPct));
    const halfW = w / 2;
    const k = halfW / 2 - 1250 / halfW;
    const R = Math.sqrt(k * k + 2500);
    const r2 = v => Math.round(v * 1000) / 1000;
    return `M 50,0 A ${r2(R)},${r2(R)} 0 0,0 50,100 A ${r2(R)},${r2(R)} 0 0,0 50,0 Z`;
  }
  function lensGeometry(widthPct, opts) {
    if (lensExtrasActive(opts)) return lensBuild(widthPct, opts);
    return { d: lensPathD(widthPct), normTx: 0, normTy: 0, normScale: 1 };
  }


  // ════════════════════════════════════════════════════════════════════════
  // Extras for Star · Rounded rect · Chevron · Cross · Lens · Segment · Drop ·
  // Blob. Same contract as Arc/Wedge/Polygon: every `xGeometry(…, opts)` takes an
  // optional trailing `opts`; with all of them at default the ORIGINAL path
  // function runs untouched (byte-identical), so saved Components/Symbols/
  // snapshots don't change. Shapes that can leave the 0..100 box use the
  // overflow-only shrink+recentre (Triangle's pattern).
  // ════════════════════════════════════════════════════════════════════════
  const N3 = v => Math.round(v * 1000) / 1000;
  const cl3 = (v, lo, hi, def) => Math.min(hi, Math.max(lo, v == null ? def : v));
  const rot3 = (p, deg, c) => {
    if (!deg) return p;
    const a = deg * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), dx = p[0] - c[0], dy = p[1] - c[1];
    return [c[0] + dx * co - dy * si, c[1] + dx * si + dy * co];
  };
  function overflowNorm(d, bb) {
    if (bb.x < 0 || bb.y < 0 || bb.x + bb.w > 100 || bb.y + bb.h > 100) {
      const s = Math.min(1, 100 / Math.max(bb.w, 1e-6), 100 / Math.max(bb.h, 1e-6));
      return { d, normTx: 50 / s - (bb.x + bb.w / 2), normTy: 50 / s - (bb.y + bb.h / 2), normScale: s };
    }
    return { d, normTx: 0, normTy: 0, normScale: 1 };
  }
  const styleOf = st => (st === 'chamfer' || st === 'scoop' ? st : 'round');

  // ── Star ── rotate · tip/valley rounding · corner style · edge curvature · twist · outline · angle jitter
  function starExtrasActive(o) {
    return !!o && ((o.rotate || 0) !== 0 || (o.tipRound || 0) > 0 || (o.valleyRound || 0) > 0 || (o.curve || 0) !== 0 || (o.outline || 0) > 0 || (o.twist || 0) !== 0 || (o.skew || 0) > 0 || (o.style && o.style !== 'round'));
  }
  function starBuild(points, innerPct, irrPct, seed, radiusPct, o) {
    points = Math.max(3, Math.round(points == null ? 5 : points));
    innerPct = cl3(innerPct, 5, 90, 45);
    const irr = cl3(irrPct, 0, 100, 0) / 100, R = 50 * cl3(radiusPct, 10, 100, 100) / 100, r = R * innerPct / 100;
    const rot = cl3(o.rotate, -180, 180, 0), curve = cl3(o.curve, -100, 100, 0), outline = cl3(o.outline, 0, 95, 0);
    const twist = cl3(o.twist, -100, 100, 0) / 100, skew = cl3(o.skew, 0, 100, 0) / 100;
    const tip = cl3(o.tipRound, 0, 100, 0), val = cl3(o.valleyRound, 0, 100, 0), style = styleOf(o.style);
    const rng = Organica.mulberry32((seed == null ? 1 : seed) >>> 0);
    const rng2 = skew > 0 ? Organica.mulberry32(((seed == null ? 1 : seed) ^ 0x9e3779b9) >>> 0) : null;
    const n = points * 2, pts = [];
    for (let i = 0; i < n; i++) {
      const jit = rng2 ? (rng2() - 0.5) * 2 * skew * 0.45 * (360 / n) : 0;
      const tw = i % 2 ? twist * 0.45 * (360 / n) : 0;
      const t = (i * 360 / n - 90 + rot + tw + jit) * Math.PI / 180;
      const rad = (i % 2 === 0 ? R : r) * (1 - irr * 0.5 + rng() * irr);
      pts.push([50 + rad * Math.cos(t), 50 + rad * Math.sin(t)]);
    }
    const corner = i => (i % 2 ? val : tip);
    const ring = triRing(pts, pts.map((_, i) => corner(i)), curve, [50, 50], style);
    let d = ring.d;
    if (outline > 0) {
      const k = 1 - outline / 100, rev = pts.slice().reverse().map(q => [50 + (q[0] - 50) * k, 50 + (q[1] - 50) * k]);
      d += ' ' + triRing(rev, rev.map((_, j) => corner(n - 1 - j)), curve, [50, 50], style).d;
    }
    return overflowNorm(d, bboxOfPoints(ring.samples));
  }

  // ── Rounded rect ── corner style · corner mask · skew · rotate · edge curvature · outline
  const RR_MASKS = { all: [1, 1, 1, 1], top: [1, 1, 0, 0], bottom: [0, 0, 1, 1], left: [1, 0, 0, 1], right: [0, 1, 1, 0], 'tl-br': [1, 0, 1, 0], 'tr-bl': [0, 1, 0, 1], tl: [1, 0, 0, 0], tr: [0, 1, 0, 0], br: [0, 0, 1, 0], bl: [0, 0, 0, 1] };
  function rrExtrasActive(o) {
    return !!o && ((o.style && o.style !== 'round') || (o.mask && o.mask !== 'all') || (o.skew || 0) !== 0 || (o.rotate || 0) !== 0 || (o.curve || 0) !== 0 || (o.outline || 0) > 0);
  }
  function rrRing(w, h, rc, mask, style, skew, rot, curve) {
    const x0 = 50 - w / 2, x1 = 50 + w / 2, y0 = 50 - h / 2, y1 = 50 + h / 2, tk = Math.tan(skew * Math.PI / 180);
    const P = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(p => rot3([p[0] + (p[1] - 50) * tk, p[1]], rot, [50, 50]));
    const E = curve ? 8 : 0, ring = [], list = [];
    for (let i = 0; i < 4; i++) {
      const A = P[i], B = P[(i + 1) % 4], prev = P[(i + 3) % 4];
      if (mask[i] && rc > 0.05) {
        const a = [prev[0] - A[0], prev[1] - A[1]], b = [B[0] - A[0], B[1] - A[1]];
        const al = Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / ((Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1])) || 1))));
        const cut = rc / Math.tan(al / 2);
        list.push([ring.length, cut, 4 / 3 * Math.tan((Math.PI - al) / 4) * rc / cut, style]);
      }
      ring.push(A);
      if (E) {
        const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
        let nx = (B[1] - A[1]) / len, ny = -(B[0] - A[0]) / len;
        if ((mx - 50) * nx + (my - 50) * ny < 0) { nx = -nx; ny = -ny; }
        const off = 2 * curve / 100 * 0.12 * len, C = [mx + nx * off, my + ny * off];
        for (let k = 1; k <= E; k++) { const t = k / (E + 1), u = 1 - t; ring.push([u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1]]); }
      }
    }
    return { ring, list };
  }
  function rrBuild(wPct, hPct, cornerPct, o) {
    const w = cl3(wPct, 5, 100, 100), h = cl3(hPct, 5, 100, 100), corner = cl3(cornerPct, 0, 100, 0);
    const rc = Math.min(w, h) / 2 * corner / 100, mask = RR_MASKS[o.mask] || RR_MASKS.all, style = styleOf(o.style);
    const skew = cl3(o.skew, -60, 60, 0), rot = cl3(o.rotate, -180, 180, 0), curve = cl3(o.curve, -100, 100, 0), outline = cl3(o.outline, 0, 95, 0);
    const outer = rrRing(w, h, rc, mask, style, skew, rot, curve);
    let d = ringPathD(outer.ring, outer.list, N3);
    if (outline > 0) {
      const t = outline / 100 * Math.min(w, h) / 2 * 0.95;
      const inner = rrRing(Math.max(1, w - 2 * t), Math.max(1, h - 2 * t), Math.max(0, rc - t), mask, style, skew, rot, curve), m = inner.ring.length;
      d += ' ' + ringPathD(inner.ring.slice().reverse(), inner.list.map(([i, c, k, st]) => [m - 1 - i, c, k, st]), N3);
    }
    return overflowNorm(d, bboxOfPoints(outer.ring));
  }

  // ── Chevron ── corner radius/style · edge curvature · lean · apex flat · stack · rotate
  function chevronExtrasActive(o) {
    return !!o && ((o.round || 0) > 0 || (o.curve || 0) !== 0 || (o.lean || 0) !== 0 || (o.flat || 0) > 0 || (o.stack || 1) > 1 || (o.rotate || 0) !== 0);
  }
  function chevronBuild(notchPct, armPct, squashPct, o) {
    const notchY = cl3(notchPct, 10, 90, 40), arm = cl3(armPct, 20, 80, 55), squash = cl3(squashPct, 30, 100, 100) / 100;
    const lean = cl3(o.lean, -100, 100, 0) / 100 * 30, flat = cl3(o.flat, 0, 100, 0) / 100;
    const stack = Math.round(cl3(o.stack, 1, 5, 1)), gap = cl3(o.gap, 0, 30, 6), round = cl3(o.round, 0, 100, 0);
    const curve = cl3(o.curve, -100, 100, 0), rot = cl3(o.rotate, -180, 180, 0), style = styleOf(o.style);
    const innerHalf = 50 * arm / 100, bandH = (100 - gap * (stack - 1)) / stack, apexX = 50 + lean;
    let d = '', all = [];
    for (let s = 0; s < stack; s++) {
      const top = s * (bandH + gap), Y = y => top + (50 + (y - 50) * squash) / 100 * bandH;
      const yc = flat * Math.min(40, notchY * 0.8);
      const pts = (flat > 0 ? [[apexX - apexX * yc / 100, Y(yc)], [apexX + (100 - apexX) * yc / 100, Y(yc)]] : [[apexX, Y(0)]])
        .concat([[100, Y(100)], [50 + innerHalf, Y(100)], [50 + lean, Y(notchY)], [50 - innerHalf, Y(100)], [0, Y(100)]])
        .map(p => rot3(p, rot, [50, 50]));
      const ring = triRing(pts, round, curve, undefined, style);
      d += (d ? ' ' : '') + ring.d; all = all.concat(ring.samples);
    }
    return overflowNorm(d, bboxOfPoints(all));
  }

  // ── Cross ── arms (2–12) · taper · tip · corner style · rotate
  function crossExtrasActive(o) {
    return !!o && ((o.arms != null && o.arms !== 4) || (o.taper || 0) !== 0 || (o.tip && o.tip !== 'flat') || (o.style && o.style !== 'round') || (o.rotate || 0) !== 0);
  }
  function crossBuild(armWidthPct, armLengthPct, cornerPct, o) {
    const al = cl3(armLengthPct, 30, 100, 100) / 100 * 50 < 15 ? 15 : cl3(armLengthPct, 30, 100, 100) / 100 * 50, width = cl3(armWidthPct, 5, 50, 35);
    const N = Math.round(cl3(o.arms, 2, 12, 4)), taper = cl3(o.taper, -100, 100, 0) / 100, rot = cl3(o.rotate, -180, 180, 0);
    const point = o.tip === 'point', style = styleOf(o.style);
    const awMax = N === 2 ? Infinity : al * Math.tan(Math.PI / N) * 0.9;
    const aw = Math.min(width / 2, al * 0.9, awMax), w2 = Math.min(Math.max(0.5, aw * (1 + taper)), aw * 2, al * 0.9);
    const ac = point ? al - Math.min(w2, al * 0.4) : al;
    const arms = [];
    for (let k = 0; k < N; k++) {
      const th = (-90 + k * 360 / N + rot) * Math.PI / 180, u = [Math.cos(th), Math.sin(th)], e = [-Math.sin(th), Math.cos(th)];   // e = toward the next arm (clockwise)
      const at = (a, b) => [50 + u[0] * a + e[0] * b, 50 + u[1] * a + e[1] * b];
      arms.push({ trail: [at(0, -aw), at(ac, -w2)], lead: [at(0, aw), at(ac, w2)], tips: [at(ac, -w2)].concat(point ? [at(al, 0)] : []).concat([at(ac, w2)]) });
    }
    const isect = (a, b, c, d) => {
      const x1 = a[0], y1 = a[1], x2 = b[0], y2 = b[1], x3 = c[0], y3 = c[1], x4 = d[0], y4 = d[1];
      const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(den) < 1e-9) return null;
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
      return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
    };
    const pts = [];
    for (let k = 0; k < N; k++) {
      arms[k].tips.forEach(p => pts.push(p));
      const nx = arms[(k + 1) % N], c = isect(arms[k].lead[0], arms[k].lead[1], nx.trail[0], nx.trail[1]);
      if (c) pts.push(c);
    }
    const ring = triRing(pts, cl3(cornerPct, 0, 100, 0), 0, [50, 50], style);
    return overflowNorm(ring.d, bboxOfPoints(ring.samples));
  }

  // ── Lens ── crescent · petals · outline · rotate
  function lensExtrasActive(o) {
    return !!o && ((o.crescent || 0) !== 0 || (o.petals || 1) > 1 || (o.outline || 0) > 0 || (o.rotate || 0) !== 0);
  }
  function lensPetalD(rho, k, bl, br, reversed) {
    const H = 50 * k, c = [50, 50], top = rot3([50, 50 - H], rho, c), bot = rot3([50, 50 + H], rho, c);
    const P = p => `${N3(p[0])},${N3(p[1])}`;
    const seg = (to, b, sweepPos) => {
      const bb = Math.abs(b) * k;
      if (bb < 0.05) return `L ${P(to)}`;
      const kk = bb / 2 - H * H / (2 * bb), R = Math.sqrt(kk * kk + H * H);
      return `A ${N3(R)},${N3(R)} 0 0,${b > 0 ? sweepPos : 1 - sweepPos} ${P(to)}`;
    };
    return reversed
      ? `M ${P(top)} ${seg(bot, br, 1)} ${seg(top, bl, 1)} Z`
      : `M ${P(top)} ${seg(bot, bl, 0)} ${seg(top, br, 0)} Z`;
  }
  function lensBuild(widthPct, o) {
    const halfW = cl3(widthPct, 8, 95, 50) / 2, cres = cl3(o.crescent, -100, 100, 0), petals = Math.round(cl3(o.petals, 1, 12, 1));
    const outline = cl3(o.outline, 0, 95, 0), rot = cl3(o.rotate, -180, 180, 0);
    const bl = halfW * (cres < 0 ? 1 + cres / 50 : 1), br = halfW * (cres > 0 ? 1 - cres / 50 : 1);
    let d = '';
    for (let i = 0; i < petals; i++) d += (d ? ' ' : '') + lensPetalD(rot + i * 180 / petals, 1, bl, br, false);
    if (outline > 0 && petals === 1) d += ' ' + lensPetalD(rot, 1 - outline / 100, bl, br, true);
    return { d, normTx: 0, normTy: 0, normScale: 1 };
  }

  // ── Segment ── angle · bend · wave · dashes · parallel lines
  function segmentExtrasActive(o) {
    return !!o && ((o.angle || 0) !== 0 || (o.bend || 0) !== 0 || (o.wave || 0) > 0 || (o.dashes || 1) > 1 || (o.lines || 1) > 1);
  }
  function segmentBuild(lenPct, o) {
    const len = cl3(lenPct, 5, 100, 70), ang = cl3(o.angle, -90, 90, 0), bend = cl3(o.bend, -100, 100, 0) / 100;
    const amp = cl3(o.wave, 0, 100, 0) / 100 * 15, cycles = Math.round(cl3(o.cycles, 1, 8, 3));
    const dashes = Math.round(cl3(o.dashes, 1, 12, 1)), dgap = cl3(o.gap, 0, 80, 30) / 100;
    const lines = Math.round(cl3(o.lines, 1, 9, 1)), sp = cl3(o.spacing, 1, 12, 6);
    const dl = 1 / (dashes + (dashes - 1) * dgap), pitch = dl * (1 + dgap), curved = bend !== 0 || amp > 0;
    let d = '', all = [];
    const at = (t, oy) => {
      const u = t * 2 - 1;
      return rot3([50 + u * len / 2, 50 - bend * 0.35 * len * (1 - u * u) + amp * Math.sin(2 * Math.PI * cycles * t) + oy], ang, [50, 50]);
    };
    for (let j = 0; j < lines; j++) {
      const oy = (j - (lines - 1) / 2) * sp;
      for (let k = 0; k < dashes; k++) {
        const t0 = k * pitch, t1 = t0 + dl, steps = curved ? Math.max(2, Math.ceil((t1 - t0) * (cycles * 24 + 24))) : 1;
        const pts = [];
        for (let i = 0; i <= steps; i++) pts.push(at(t0 + (t1 - t0) * i / steps, oy));
        d += (d ? ' ' : '') + 'M ' + pts.map(p => `${N3(p[0])},${N3(p[1])}`).join(' L ');
        all = all.concat(pts);
      }
    }
    return overflowNorm(d, bboxOfPoints(all));
  }

  // ── Drop ── tail bend · neck · petals · rotate
  function dropExtrasActive(o) {
    return !!o && ((o.bend || 0) !== 0 || (o.neck || 0) !== 0 || (o.petals || 1) > 1 || (o.rotate || 0) !== 0);
  }
  function dropBuild(radiusPct, tailPct, o) {
    const r = 50 * cl3(radiusPct, 5, 100, 60) / 100, tail = cl3(tailPct, 0, 100, 50);
    const neck = cl3(o.neck, -100, 100, 0) / 100, bend = cl3(o.bend, -100, 100, 0) / 100, petals = Math.round(cl3(o.petals, 1, 8, 1)), rot = cl3(o.rotate, -180, 180, 0);
    const cx = 50, cy = 50 + r * 0.3, tipY = cy - r - tail, tipX = cx + bend * r * 0.9, kx = 0.6 * (1 + neck * 0.8), half = (tipX - cx) * 0.5;
    const base = { tip: [tipX, tipY], l1: [cx - r * kx + half, tipY + tail * 0.5], l2: [cx - r, cy - r * 0.6], L: [cx - r, cy], R: [cx + r, cy], r2: [cx + r, cy - r * 0.6], r1: [cx + r * kx + half, tipY + tail * 0.5] };
    let d = '', all = [];
    for (let i = 0; i < petals; i++) {
      const rho = rot + i * 360 / petals, q = {}, P = p => `${N3(p[0])},${N3(p[1])}`;
      Object.keys(base).forEach(k => { q[k] = rot3(base[k], rho, [cx, cy]); });
      d += (d ? ' ' : '') + `M ${P(q.tip)} C ${P(q.l1)} ${P(q.l2)} ${P(q.L)} A ${N3(r)},${N3(r)} 0 1,0 ${P(q.R)} C ${P(q.r2)} ${P(q.r1)} ${P(q.tip)} Z`;
      const pp = [], bez = (a, b, c, e) => { for (let t = 0; t <= 1.0001; t += 1 / 16) { const u = 1 - t; pp.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * e[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * e[1]]); } };
      bez(base.tip, base.l1, base.l2, base.L); bez(base.R, base.r2, base.r1, base.tip);
      for (let a = 0; a <= 180; a += 10) pp.push([cx - r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)]);
      pp.forEach(q => all.push(rot3(q, rho, [cx, cy])));
    }
    return { d, ...fitToBox(bboxOfPoints(all)) };
  }

  // ── Blob ── frequency · smoothness · outline
  function blobExtrasActive(o) {
    return !!o && ((o.freq != null && o.freq !== 7) || (o.smooth || 0) > 0 || (o.outline || 0) > 0);
  }
  function blobBuild(radiusPct, amount, seed, o) {
    const r = 50 * cl3(radiusPct, 5, 100, 60) / 100, amt = cl3(amount, 0, 100, 40) / 100, sd = seed == null ? 1 : seed;
    const f = cl3(o.freq, 1, 20, 7) / 10, sm = cl3(o.smooth, 0, 100, 0) / 100 / 6, outline = cl3(o.outline, 0, 95, 0);
    const n = 32, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, nv = Organica.noise.simplex2(Math.cos(a) * f + sd, Math.sin(a) * f + sd), rr = r * (1 + nv * 0.4 * amt);
      pts.push([50 + Math.cos(a) * rr, 50 + Math.sin(a) * rr]);
    }
    const P = p => `${N3(p[0])},${N3(p[1])}`;
    const ring = pp => {
      const m = pp.length;
      if (!(sm > 0)) return 'M ' + pp.map(P).join(' L ') + ' Z';
      let d = 'M ' + P(pp[0]);
      for (let i = 0; i < m; i++) {
        const a = pp[i], b = pp[(i + 1) % m], pv = pp[(i - 1 + m) % m], nx = pp[(i + 2) % m];
        d += ` C ${P([a[0] + (b[0] - pv[0]) * sm, a[1] + (b[1] - pv[1]) * sm])} ${P([b[0] - (nx[0] - a[0]) * sm, b[1] - (nx[1] - a[1]) * sm])} ${P(b)}`;
      }
      return d + ' Z';
    };
    let d = ring(pts);
    if (outline > 0) { const k = 1 - outline / 100; d += ' ' + ring(pts.slice().reverse().map(q => [50 + (q[0] - 50) * k, 50 + (q[1] - 50) * k])); }
    return { d, ...fitToBox(bboxOfPoints(pts)) };
  }

  // ── GRID CELL PLACEMENT ─────────────────────────────────────────────────
  // grid = either { kind:'loom', cellShape, cells, width, height } (the shape
  // FVS wraps Organica.loadLoomGrid()'s return into — width/height = the
  // loader's own inner.width/height) or { kind:'square', cols, rows,
  // cellSize, gap } (a plain uniform lattice, no Loom import). Returns
  // grid-centred (origin at the grid's own middle) {cx, cy, cellSize, cellW,
  // cellH} per cell, row-major for 'square'.
  //
  // 'loom' cells carry ABSOLUTE canvas coordinates — Organica.loadLoomGrid's
  // loomResolveCellRects offsets every x/y by inner.x/inner.y (the margin),
  // so a cell's own (x,y) is not 0 at the grid's top-left. Centring on
  // grid.width/2 (assuming coordinates start at 0) leaves every cell shifted
  // by exactly that margin, down-and-right — most visible on a grid's shorter
  // axis, where the fixed-pixel shift is a larger fraction of the content.
  // The fix: derive the origin from the cells' own bounding box, not the
  // caller-supplied width/height.
  function resolveGridCells(grid) {
    if (grid.kind === 'loom') {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const raw = grid.cells.map(c => {
        if (grid.cellShape === 'polygon') {
          const xs = c.points.map(p => p[0]), ys = c.points.map(p => p[1]);
          const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
          minX = Math.min(minX, x0); maxX = Math.max(maxX, x1);
          minY = Math.min(minY, y0); maxY = Math.max(maxY, y1);
          const w = x1 - x0, h = y1 - y0;
          return { cx: c.centroid[0], cy: c.centroid[1], cellSize: Math.min(w, h), cellW: w, cellH: h };
        }
        minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x + c.width);
        minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y + c.height);
        return { cx: c.x + c.width / 2, cy: c.y + c.height / 2, cellSize: Math.min(c.width, c.height), cellW: c.width, cellH: c.height };
      });
      const originX = (minX + maxX) / 2, originY = (minY + maxY) / 2;
      return raw.map(r => ({ ...r, cx: r.cx - originX, cy: r.cy - originY }));
    }
    const totalW = grid.cols * grid.cellSize + (grid.cols - 1) * grid.gap;
    const totalH = grid.rows * grid.cellSize + (grid.rows - 1) * grid.gap;
    const originX = -totalW / 2, originY = -totalH / 2;
    const centers = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        centers.push({
          cx: originX + c * (grid.cellSize + grid.gap) + grid.cellSize / 2,
          cy: originY + r * (grid.cellSize + grid.gap) + grid.cellSize / 2,
          cellSize: grid.cellSize, cellW: grid.cellSize, cellH: grid.cellSize,
        });
      }
    }
    return centers;   // square grids: row-major, e.g. 2×2 = [TL, TR, BL, BR]
  }

  // The grid's own drawn extent. frameSize is the square frame every caller
  // centres a grid in (a non-square grid is letterboxed inside it — identical
  // to before for square grids); frameDims is the tight width × height.
  function frameDims(grid) {
    if (grid.kind === 'loom') return { w: grid.width, h: grid.height };
    const rows = grid.rows || grid.cols;
    return { w: grid.cols * grid.cellSize + (grid.cols - 1) * grid.gap, h: rows * grid.cellSize + (rows - 1) * grid.gap };
  }
  function frameSize(grid) {
    const d = frameDims(grid);
    return Math.max(d.w, d.h);
  }

  // Turns fit mode + anchor + padding + scale into a concrete {scaleX,
  // scaleY, offsetX, offsetY} for one cell. `natural` is the shape's own
  // untransformed box size (100 for these shapes; a nested item's own frame
  // size for a compound shape). Reduces to exactly plain centred-contain at
  // the defaults (fitMode:'contain', anchorX/Y:0, padding:0, scale:1).
  // `natural` may also be {w, h} — a non-square nested item (a rectangular
  // FVS Component) fills/contains by its own proportions instead of a square box.
  function resolveCellPlacement(cellW, cellH, natural, cell) {
    if (natural && typeof natural === 'object') {
      const pad = 1 - (cell.padding || 0);
      const effW = cellW * pad, effH = cellH * pad;
      const scale = cell.scale == null ? 1 : cell.scale;
      let scaleX, scaleY;
      if (cell.fitMode === 'fill') { scaleX = (effW / natural.w) * scale; scaleY = (effH / natural.h) * scale; }
      else if (cell.fitMode === 'fixed') scaleX = scaleY = (cell.fixedSize || 100) / Math.max(natural.w, natural.h);
      else scaleX = scaleY = Math.min(effW / natural.w, effH / natural.h) * scale;
      const itemW = natural.w * scaleX, itemH = natural.h * scaleY;
      const ax = cell.anchorX || 0, ay = cell.anchorY || 0;
      return { scaleX, scaleY, offsetX: ax * (effW - itemW) / 2, offsetY: ay * (effH - itemH) / 2 };
    }
    const pad = 1 - (cell.padding || 0);
    const effW = cellW * pad, effH = cellH * pad;
    const scale = cell.scale == null ? 1 : cell.scale;
    let scaleX, scaleY;
    if (cell.fitMode === 'fill') {
      scaleX = (effW / natural) * scale;
      scaleY = (effH / natural) * scale;
    } else if (cell.fitMode === 'fixed') {
      scaleX = scaleY = (cell.fixedSize || 100) / natural;
    } else {
      scaleX = scaleY = (Math.min(effW, effH) / natural) * scale;
    }
    const itemW = natural * scaleX, itemH = natural * scaleY;
    const ax = cell.anchorX || 0, ay = cell.anchorY || 0;
    return {
      scaleX, scaleY,
      offsetX: ax * (effW - itemW) / 2,
      offsetY: ay * (effH - itemH) / 2,
    };
  }

  function median(arr) { const s = [...arr].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; }

  // Per-cell {col,row,cols,rows,cx,cy,nx,ny,angle,index,count}, parallel to
  // resolveGridCells(grid)'s own output — the context spatial-rule /
  // stagger-phase generators read. Rect Loom cells carry real col/row in
  // their JSON, passed in as `rawCells` (the caller's own loadLoomGrid().cells
  // — kept as a separate arg rather than reached-into from shared state, the
  // one real change from FVS's original inline copy, which read a module
  // global); `gridMeta` is the raw loadLoomGrid().grid ({params, tracks}),
  // read only for the cols/rows count preference chain below — optional,
  // falls straight to the col/colSpan-derived count without it. Polygon
  // cells (and any rect caller that omits rawCells) fall back to binning
  // centroids into row/column bands.
  function cellColRow(grid, rawCells, gridMeta) {
    const centers = resolveGridCells(grid);   // {cx,cy,cellSize,cellW,cellH} grid-centred
    const n = centers.length;
    // 'square' grids carry no width/height (only 'loom' grids do) — fall
    // back to frameSize(grid), which already knows both kinds; a square
    // grid is square, so one dimension is exactly right for both halves.
    const halfW = (grid.width != null ? grid.width : frameDims(grid).w) / 2;
    const halfH = (grid.height != null ? grid.height : frameDims(grid).h) / 2;
    let colRow;
    if (grid.cellShape === 'rect' && rawCells && rawCells.length === n && rawCells.every(c => c.col != null)) {
      const g = gridMeta || {};
      const cols = (g.params && g.params.cols) || (g.tracks && g.tracks.cols && g.tracks.cols.length) ||
        Math.max(...rawCells.map(c => c.col + (c.colSpan || 1)));
      const rows = (g.params && g.params.rows) || (g.tracks && g.tracks.rows && g.tracks.rows.length) ||
        Math.max(...rawCells.map(c => c.row + (c.rowSpan || 1)));
      colRow = rawCells.map(c => ({ col: c.col, row: c.row, cols, rows }));
    } else {
      // Bin centroids: sorted unique y → rows, sorted unique x → cols.
      const medH = median(centers.map(c => c.cellH)) || 1;
      const medW = median(centers.map(c => c.cellW)) || 1;
      const bands = (vals, tol) => {
        const sorted = [...new Set(vals)].sort((a, b) => a - b);
        const reps = [];
        sorted.forEach(v => { if (!reps.length || v - reps[reps.length - 1] > tol) reps.push(v); });
        return reps;
      };
      const rowReps = bands(centers.map(c => c.cy), medH * 0.5);
      const colReps = bands(centers.map(c => c.cx), medW * 0.5);
      const nearest = (v, reps) => { let bi = 0, bd = Infinity; reps.forEach((r, i) => { const d = Math.abs(r - v); if (d < bd) { bd = d; bi = i; } }); return bi; };
      colRow = centers.map(c => ({ col: nearest(c.cx, colReps), row: nearest(c.cy, rowReps), cols: colReps.length, rows: rowReps.length }));
    }
    return centers.map((c, i) => ({
      ...colRow[i], cx: c.cx, cy: c.cy,
      nx: c.cx / (halfW || 1), ny: c.cy / (halfH || 1),
      angle: Math.atan2(c.cy, c.cx), index: i, count: n,
    }));
  }

  // Uniform scale of an arbitrary SVG path `d` by `s` about (cx, cy). Handles the
  // whole command set — absolute and relative M L H V C S Q T A Z. Absolute
  // points map p → c + s·(p − c); relative deltas just scale; an arc's radii
  // scale and its rotation + two flags stay as they are. Used by FVS's Inner
  // seed (nested copies), where `d` may come from an uploaded SVG (relative
  // commands, H/V/S) as well as from the hand-authored shapes above.
  function scalePathAbout(d, s, cx, cy) {
    const per = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
    const r = v => Math.round(v * 1000) / 1000;
    const toks = String(d).match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
    const out = [];
    let i = 0, cmd = '', first = true;
    while (i < toks.length) {
      if (/[a-zA-Z]/.test(toks[i])) { cmd = toks[i++]; out.push(cmd); if (!per[cmd.toUpperCase()]) continue; }
      // A path's very first moveto is absolute even when written lowercase ('m').
      const up = cmd.toUpperCase(), rel = cmd !== up && !(first && cmd === 'm'), n = per[up];
      first = false;
      if (n === 0) continue;
      const a = toks.slice(i, i + n).map(Number); i += n;
      const map = (k, v) => {
        if (up === 'A') { if (k < 2) return v * s; if (k < 5) return v; }
        if (rel) return v * s;
        const isY = up === 'V' || (up !== 'H' && k % 2 === 1);
        const c = isY ? cy : cx;
        return c + s * (v - c);
      };
      out.push(a.map((v, k) => r(map(k, v))).join(' '));
      if (up === 'M') cmd = cmd === 'm' ? 'l' : 'L';   // extra coordinate pairs after M are implicit lineto
    }
    return out.join(' ');
  }

  // Panel-row definitions for the extras above — data only, shared by FVS and Genesis Create so the
  // labels/ranges/defaults live in ONE place. kind: 'range' | 'select'; key = the params-object key.
  const EXTRAS = {
    star: [
      {"kind": "range", "id": "rotate", "key": "starRotate", "label": "Rotate", "min": -180, "max": 180, "def": 0, "title": "Rotates the star about the cell centre, in degrees."},
      {"kind": "range", "id": "tip", "key": "starTipRound", "label": "Tip rounding", "min": 0, "max": 100, "def": 0, "title": "Rounds the outer points."},
      {"kind": "range", "id": "valley", "key": "starValleyRound", "label": "Valley rounding", "min": 0, "max": 100, "def": 0, "title": "Rounds the inner corners between the points."},
      {"kind": "select", "id": "style", "key": "starStyle", "label": "Corner style", "options": [["round", "Round"], ["chamfer", "Chamfer"], ["scoop", "Scoop"]], "def": "round", "title": "How corners are cut when a rounding is above 0."},
      {"kind": "range", "id": "curve", "key": "starCurve", "label": "Edge curvature", "min": -100, "max": 100, "def": 0, "title": "Bows every edge — negative gives the classic ✦ sparkle."},
      {"kind": "range", "id": "twist", "key": "starTwist", "label": "Twist", "min": -100, "max": 100, "def": 0, "title": "Turns the inner vertices against the outer ones → pinwheel."},
      {"kind": "range", "id": "outline", "key": "starOutline", "label": "Outline (hollow)", "min": 0, "max": 95, "def": 0, "title": "Hollow ring — wall thickness as a % of the radius. Separate from Style → Stroke."},
      {"kind": "range", "id": "skew", "key": "starSkew", "label": "Angle jitter", "min": 0, "max": 100, "def": 0, "title": "Jitters each vertex's angle. Independent of Irregularity (radius)."},
    ],
    roundedrect: [
      {"kind": "select", "id": "style", "key": "rrStyle", "label": "Corner style", "options": [["round", "Round"], ["chamfer", "Chamfer"], ["scoop", "Scoop"]], "def": "round", "title": "Round, a straight cut, or a concave scoop (ticket)."},
      {"kind": "select", "id": "mask", "key": "rrMask", "label": "Corners", "options": [["all", "All"], ["top", "Top"], ["bottom", "Bottom"], ["left", "Left"], ["right", "Right"], ["tl-br", "TL + BR"], ["tr-bl", "TR + BL"], ["tl", "Top-left"], ["tr", "Top-right"], ["br", "Bottom-right"], ["bl", "Bottom-left"]], "def": "all", "title": "Which corners are rounded — the others stay sharp (leaf, tab and tag shapes)."},
      {"kind": "range", "id": "skew", "key": "rrSkew", "label": "Skew", "min": -60, "max": 60, "def": 0, "title": "Shears the rectangle into a parallelogram, in degrees."},
      {"kind": "range", "id": "rotate", "key": "rrRotate", "label": "Rotate", "min": -180, "max": 180, "def": 0, "title": "Rotates about the cell centre, in degrees."},
      {"kind": "range", "id": "curve", "key": "rrCurve", "label": "Edge curvature", "min": -100, "max": 100, "def": 0, "title": "Bows the sides — pillow (positive) or barrel/hourglass (negative)."},
      {"kind": "range", "id": "outline", "key": "rrOutline", "label": "Outline (hollow)", "min": 0, "max": 95, "def": 0, "title": "Hollow frame — wall thickness as a % of the shorter half-side."},
    ],
    chevron: [
      {"kind": "range", "id": "round", "key": "chevRound", "label": "Corner radius", "min": 0, "max": 100, "def": 0, "title": "Rounds every corner of the ribbon."},
      {"kind": "select", "id": "style", "key": "chevStyle", "label": "Corner style", "options": [["round", "Round"], ["chamfer", "Chamfer"], ["scoop", "Scoop"]], "def": "round", "title": "How corners are cut when Corner radius is above 0."},
      {"kind": "range", "id": "curve", "key": "chevCurve", "label": "Edge curvature", "min": -100, "max": 100, "def": 0, "title": "Bows the ribbon edges."},
      {"kind": "range", "id": "lean", "key": "chevLean", "label": "Lean", "min": -100, "max": 100, "def": 0, "title": "Shifts the apex sideways → an asymmetric chevron."},
      {"kind": "range", "id": "flat", "key": "chevFlat", "label": "Apex flat", "min": 0, "max": 100, "def": 0, "title": "Truncates the tip into a flat top."},
      {"kind": "range", "id": "stack", "key": "chevStack", "label": "Stack", "min": 1, "max": 5, "def": 1, "title": "Number of stacked chevrons (double / triple ») inside the cell."},
      {"kind": "range", "id": "gap", "key": "chevGap", "label": "Stack gap", "min": 0, "max": 30, "def": 6, "title": "Vertical gap between stacked chevrons."},
      {"kind": "range", "id": "rotate", "key": "chevRotate", "label": "Rotate", "min": -180, "max": 180, "def": 0, "title": "Rotates about the cell centre, in degrees."},
    ],
    cross: [
      {"kind": "range", "id": "arms", "key": "crossArms", "label": "Arms", "min": 2, "max": 12, "def": 4, "title": "4 is the plus; 3 a Y; 6 an asterisk."},
      {"kind": "range", "id": "taper", "key": "crossTaper", "label": "Taper", "min": -100, "max": 100, "def": 0, "title": "Arm tips narrower (negative) or wider (positive) than their root."},
      {"kind": "select", "id": "tip", "key": "crossTip", "label": "Tip", "options": [["flat", "Flat"], ["point", "Point"]], "def": "flat", "title": "Flat-cut or pointed arm ends."},
      {"kind": "select", "id": "style", "key": "crossStyle", "label": "Corner style", "options": [["round", "Round"], ["chamfer", "Chamfer"], ["scoop", "Scoop"]], "def": "round", "title": "How corners are cut when Corner radius is above 0."},
      {"kind": "range", "id": "rotate", "key": "crossRotate", "label": "Rotate", "min": -180, "max": 180, "def": 0, "title": "Rotates about the cell centre — 45° turns the plus into an X."},
    ],
    lens: [
      {"kind": "range", "id": "crescent", "key": "lensCrescent", "label": "Crescent", "min": -100, "max": 100, "def": 0, "title": "Flattens then inverts one arc → half-moon and crescent shapes."},
      {"kind": "range", "id": "petals", "key": "lensPetals", "label": "Petals", "min": 1, "max": 12, "def": 1, "title": "Lens copies rotated about the centre → flower / rosette."},
      {"kind": "range", "id": "outline", "key": "lensOutline", "label": "Outline (hollow)", "min": 0, "max": 95, "def": 0, "title": "Hollow eye shape. Ignored when Petals is above 1."},
      {"kind": "range", "id": "rotate", "key": "lensRotate", "label": "Rotate", "min": -180, "max": 180, "def": 0, "title": "Rotates about the cell centre, in degrees."},
    ],
    segment: [
      {"kind": "range", "id": "angle", "key": "segAngle", "label": "Angle", "min": -90, "max": 90, "def": 0, "title": "Tilts the line about the cell centre, in degrees."},
      {"kind": "range", "id": "bend", "key": "segBend", "label": "Bend", "min": -100, "max": 100, "def": 0, "title": "Bows the line into an arc."},
      {"kind": "range", "id": "wave", "key": "segWave", "label": "Wave", "min": 0, "max": 100, "def": 0, "title": "Wave amplitude — a squiggle."},
      {"kind": "range", "id": "cycles", "key": "segCycles", "label": "Wave cycles", "min": 1, "max": 8, "def": 3, "title": "Number of waves along the line."},
      {"kind": "range", "id": "dashes", "key": "segDashes", "label": "Dashes", "min": 1, "max": 12, "def": 1, "title": "Splits the line into separate dashes."},
      {"kind": "range", "id": "gap", "key": "segGap", "label": "Dash gap", "min": 0, "max": 80, "def": 30, "title": "Gap between dashes, as a % of a dash's length."},
      {"kind": "range", "id": "lines", "key": "segLines", "label": "Lines", "min": 1, "max": 9, "def": 1, "title": "Parallel copies of the line (hatch)."},
      {"kind": "range", "id": "spacing", "key": "segSpacing", "label": "Line spacing", "min": 1, "max": 12, "def": 6, "title": "Distance between parallel lines."},
    ],
    drop: [
      {"kind": "range", "id": "bend", "key": "dropBend", "label": "Tail bend", "min": -100, "max": 100, "def": 0, "title": "Curves the tail sideways → comma / flame."},
      {"kind": "range", "id": "neck", "key": "dropNeck", "label": "Neck", "min": -100, "max": 100, "def": 0, "title": "Pinches (negative) or bulges (positive) the sides between belly and tip."},
      {"kind": "range", "id": "petals", "key": "dropPetals", "label": "Petals", "min": 1, "max": 8, "def": 1, "title": "Drop copies rotated about the belly → flame / flower."},
      {"kind": "range", "id": "rotate", "key": "dropRotate", "label": "Rotate", "min": -180, "max": 180, "def": 0, "title": "Rotates the drop, in degrees."},
    ],
    blob: [
      {"kind": "range", "id": "freq", "key": "blobFreq", "label": "Frequency", "min": 1, "max": 20, "def": 7, "title": "How many wobbles around the outline (7 is the original)."},
      {"kind": "range", "id": "smooth", "key": "blobSmooth", "label": "Smoothness", "min": 0, "max": 100, "def": 0, "title": "0 keeps the original faceted outline; 100 is a fully smooth curve through the same points."},
      {"kind": "range", "id": "outline", "key": "blobOutline", "label": "Outline (hollow)", "min": 0, "max": 95, "def": 0, "title": "Hollow ring — wall thickness as a % of the radius."},
    ],
  };

  Organica.shapes = {
    scalePathAbout, triangleGeometry, arcGeometry, arcBuild, arcExtrasActive, arcPathD, circleGeometry, segmentGeometry, dropGeometry, blobGeometry, fitToBox,
    arcTruchetGeometry, arcTruchetPathD, truchetExtrasActive,
    wedgeGeometry, wedgePathD, wedgeExtrasActive, polygonGeometry, polygonPathD, polygonExtrasActive, starGeometry, starPathD,
    roundedRectGeometry, roundedRectPathD, chevronGeometry, chevronPathD,
    crossGeometry, crossPathD, lensGeometry, lensPathD,
    EXTRAS, starExtrasActive, rrExtrasActive, chevronExtrasActive, crossExtrasActive, lensExtrasActive, segmentExtrasActive, dropExtrasActive, blobExtrasActive,
    resolveGridCells, resolveCellPlacement, cellColRow, frameSize, frameDims, median,
  };
})(window);
