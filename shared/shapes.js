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
  // would put the apex directly above a base corner (zero area), so it's
  // clamped just short of that to keep the triangle non-degenerate.
  function triangleGeometry(base, height, apexPct) {
    const halfBase = base / 2;
    const apexY = 50 - height / 2;
    const baseY = 50 + height / 2;
    const pct = Math.max(-98, Math.min(98, apexPct == null ? 0 : apexPct));
    const apexX = 50 + halfBase * (pct / 100);
    const d = `M ${apexX},${apexY} L ${50 - halfBase},${baseY} L ${50 + halfBase},${baseY} Z`;
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
  function arcGeometry(thicknessPct, pivot, sweepDeg) {
    const isCenter = pivot === 'center';
    const sweep = Math.min(350, Math.max(10, sweepDeg == null ? 90 : sweepDeg));
    if (!isCenter && sweep === 90) return { d: arcPathD(thicknessPct), normTx: 0, normTy: 0, normScale: 1 };
    const cx = isCenter ? 50 : 0, cy = isCenter ? 50 : 0, outerR = isCenter ? 50 : 100;
    const start = isCenter ? -90 : 0;
    const innerR = outerR * (1 - thicknessPct / 100);
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
      const d = adv.build(radiusPct, opts);
      if (d) return { d, normTx: 0, normTy: 0, normScale: 1 };
    }
    const r = 50 * Math.min(100, Math.max(5, radiusPct == null ? 100 : radiusPct)) / 100;
    const r2 = v => Math.round(v * 1000) / 1000;
    const d = `M ${r2(50 - r)},50 A ${r2(r)},${r2(r)} 0 1,1 ${r2(50 + r)},50 A ${r2(r)},${r2(r)} 0 1,1 ${r2(50 - r)},50 Z`;
    return { d, normTx: 0, normTy: 0, normScale: 1 };
  }

  // Segment: a horizontal line through the centre. Zero area, so it only
  // shows in Stroke style (FVS switches Style for it, same as Genesis).
  function segmentGeometry(lenPct) {
    const len = Math.min(100, Math.max(5, lenPct == null ? 70 : lenPct));
    return { d: `M ${50 - len / 2},50 L ${50 + len / 2},50`, normTx: 0, normTy: 0, normScale: 1 };
  }

  // Drop / teardrop — Genesis Create's dropPathD in the 0..100 box. The tail
  // makes it taller than the box, so it is fitted rather than clipped.
  function dropGeometry(radiusPct, tailPct) {
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
  function blobGeometry(radiusPct, amount, seed) {
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
  function arcTruchetGeometry(count, ratio) {
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
  function wedgeGeometry(angle, innerRadiusPct, squashPct) {
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
  function polygonGeometry(sides, cornerRadiusPct, irregularityPct, seed, radiusPct) {
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
  function starGeometry(points, innerRadiusPct, irregularityPct, seed, radiusPct) {
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
  function roundedRectGeometry(widthPct, heightPct, cornerRadiusPct) {
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
  function chevronGeometry(notchPct, armPct, squashPct) {
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
  function crossGeometry(armWidthPct, armLengthPct, cornerRadiusPct) {
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
  function lensGeometry(widthPct) {
    return { d: lensPathD(widthPct), normTx: 0, normTy: 0, normScale: 1 };
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

  function frameSize(grid) {
    if (grid.kind === 'loom') return Math.max(grid.width, grid.height);
    return grid.cols * grid.cellSize + (grid.cols - 1) * grid.gap;
  }

  // Turns fit mode + anchor + padding + scale into a concrete {scaleX,
  // scaleY, offsetX, offsetY} for one cell. `natural` is the shape's own
  // untransformed box size (100 for these shapes; a nested item's own frame
  // size for a compound shape). Reduces to exactly plain centred-contain at
  // the defaults (fitMode:'contain', anchorX/Y:0, padding:0, scale:1).
  function resolveCellPlacement(cellW, cellH, natural, cell) {
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
    const halfW = (grid.width != null ? grid.width : frameSize(grid)) / 2;
    const halfH = (grid.height != null ? grid.height : frameSize(grid)) / 2;
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

  Organica.shapes = {
    triangleGeometry, arcGeometry, arcPathD, circleGeometry, segmentGeometry, dropGeometry, blobGeometry, fitToBox,
    arcTruchetGeometry, arcTruchetPathD,
    wedgeGeometry, wedgePathD, polygonGeometry, polygonPathD, starGeometry, starPathD,
    roundedRectGeometry, roundedRectPathD, chevronGeometry, chevronPathD,
    crossGeometry, crossPathD, lensGeometry, lensPathD,
    resolveGridCells, resolveCellPlacement, cellColRow, frameSize, median,
  };
})(window);
