/* ─────────────────────────────────────────────────────────────────────────────
 * radial.js — Radial's polar-field geometry + render core.
 *
 * Extracted from radial/index.html at the second consumer (Pulsar, the Motion
 * tool that animates these parameters over time). Same "extract at the second
 * consumer" pattern as noise.js / motion.js.
 *
 * LOAD ORDER (load-bearing):
 *   core.js  →  noise.js  →  radial.js  →  tool script
 * core.js's last line reassigns global.Organica, so anything that
 * extends the namespace must load after it; this module needs Organica.noise.
 *
 * Surface:
 *   Organica.radial = {
 *     SIZE,                                   // 760 — the canonical square
 *     PARAM_RANGES,                           // { camelKey: {min,max,step,int?} }
 *     BP, BUILTIN_PRESETS,                    // preset factory + the 17 Book-of-Shapes snapshots
 *     buildScene(P, W, H),                    // camelCase P → tagged primitive set
 *     sceneSVG(prim, P),                      // preview === export string
 *     drawSceneCanvas(ctx, prim, P, scale),   // Canvas2D, same primitives
 *     buildPoints, warpPoint, arcPathD,       // internals, exposed for completeness
 *   }
 *
 * buildScene is deterministic (fill/arc/loop RNG re-seeds from P.seed every
 * call), so a caller may redraw it every frame with a time-varying P without
 * any drift or accumulation.
 *
 * Four inert hooks (each an exact no-op when unset, so Radial's own output is
 * byte-identical) let a caller animate a noise *phase*, not just a slider:
 *   P.warpPhase  — added to the domain-warp noise-domain offset  (field flows)
 *   P.fillPhase  — added to the fill-noise offset  (travelling dissolve wave)
 *   P.loopPhase  — added inside the chaos-circle noise  (tangle writhes)
 *   P.rotate/P.zoom — a whole-field group transform in drawSceneCanvas only
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  const N = Organica.noise;
  if (!N) throw new Error('radial.js: load noise.js first');

  const TAU = Math.PI * 2;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));   // ≈ 2.39996 rad
  const SIZE = 760;

  // ── Slider ranges, keyed by the camelCase buildScene() P keys. Pulsar clamps
  //    composed parameter tracks against these; `int` keys must be rounded
  //    before buildScene (it trusts its caller, exactly as radial's buildParams).
  const PARAM_RANGES = {
    sides:      { min: 3,   max: 72,   step: 1,     int: true },
    rings:      { min: 1,   max: 50,   step: 1,     int: true },
    innerFrac:  { min: 0,   max: 0.85, step: 0.01 },
    radiusFrac: { min: 0.4, max: 1,    step: 0.01 },
    ringCurve:  { min: 0.3, max: 3,    step: 0.05 },
    count:      { min: 2,   max: 2000, step: 1,     int: true },
    spread:     { min: 0.2, max: 1.2,  step: 0.01 },
    arms:       { min: 1,   max: 12,   step: 1,     int: true },
    perArm:     { min: 10,  max: 400,  step: 1,     int: true },
    twist:      { min: 0.2, max: 6,    step: 0.1 },
    petals:     { min: 2,   max: 12,   step: 1,     int: true },
    petalDepth: { min: 0,   max: 1,    step: 0.01 },
    shear:      { min: 0,   max: 2,    step: 0.02 },
    warpAmt:    { min: 0,   max: 1,    step: 0.01 },
    warpScale:  { min: 0.1, max: 4,    step: 0.05 },
    fillScale:  { min: 0.2, max: 12,   step: 0.1 },
    threshold:  { min: 0,   max: 1,    step: 0.01 },
    markSize:   { min: 0.5, max: 20,   step: 0.5 },
    sizeAmt:    { min: 0,   max: 2,    step: 0.05 },
    arcCount:   { min: 2,   max: 30,   step: 1,     int: true },
    arcMin:     { min: 0.5, max: 20,   step: 0.5 },
    arcMax:     { min: 5,   max: 140,  step: 1 },
    arcGrowth:  { min: 1,   max: 5,    step: 0.1 },
    arcGap:     { min: 0,   max: 0.3,  step: 0.005 },
    arcSpan:    { min: 0.1, max: 1,    step: 0.01 },
    arcBias:    { min: 0,   max: 1,    step: 0.01 },
    loopCount:  { min: 10,  max: 300,  step: 1,     int: true },
    loopRadius: { min: 0.2, max: 1,    step: 0.01 },
    loopNoise:  { min: 0,   max: 0.6,  step: 0.01 },
    jitter:     { min: 0,   max: 1,    step: 0.01 },
    seed:       { min: 1,   max: 9999, step: 1,     int: true },
    // synthetic (animation only) — wide clamps, never touched by Radial itself
    warpPhase:  { min: -1e6, max: 1e6, step: 0.01 },
    fillPhase:  { min: -1e6, max: 1e6, step: 0.01 },
    loopPhase:  { min: -1e6, max: 1e6, step: 0.01 },
    rotate:     { min: -1e6, max: 1e6, step: 0.1 },
    zoom:       { min: 0.05, max: 20,  step: 0.01 },
  };

  // ─────────────────────────────────────────────
  // DOMAIN WARP — two decorrelated fbm taps offset by (5.2, 1.3), Amount 0 an
  // exact no-op. warpPhase (default 0) slides the noise domain over time.
  // ─────────────────────────────────────────────
  function warpPoint(px, py, cx, cy, R, P) {
    if (P.warpAmt <= 0) return [px, py];
    const nx = (px - cx) / R, ny = (py - cy) / R;
    const so = P.seed * 1.7 + (P.warpPhase || 0);
    const f = P.warpScale * 3;
    const n1 = N.fbm(nx * f + so, ny * f + so) - 0.5;
    const n2 = N.fbm(nx * f + so + 5.2, ny * f + so + 1.3) - 0.5;
    return [px + n1 * P.warpAmt * R * 0.35, py + n2 * P.warpAmt * R * 0.35];
  }

  // ── POINT FIELD — grid lattice OR a flat point list, per Placement. ──
  function buildPoints(P, cx, cy, R) {
    const jrng = P.jitter > 0 ? Organica.mulberry32((P.seed ^ 0x85EBCA6B) >>> 0) : null;
    const jit = p => {
      let q = warpPoint(p[0], p[1], cx, cy, R, P);
      if (jrng) q = [q[0] + (jrng() * 2 - 1) * P.jitter * R * 0.05,
                     q[1] + (jrng() * 2 - 1) * P.jitter * R * 0.05];
      return q;
    };

    if (P.placement === 'grid') {
      const sides = P.sides, rings = Math.max(1, P.rings);
      const inR = R * P.innerFrac, outR = R * P.radiusFrac;
      const V = [];
      for (let i = 0; i <= rings; i++) {
        const frac = Math.pow(i / rings, P.ringCurve);
        let baseR = inR + frac * (outR - inR);
        const row = [];
        for (let j = 0; j < sides; j++) {
          let a = -Math.PI / 2 + (j / sides) * TAU;
          let rr = baseR;
          if (P.modulation === 'rose') rr *= 1 + P.petalDepth * 0.6 * Math.cos(P.petals * a);
          if (P.modulation === 'shear') a += P.shear * (i / rings);
          row.push(jit([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]));
        }
        V.push(row);
      }
      const ringPolys = V.map(r => r.slice());
      const spokes = [];
      for (let j = 0; j < sides; j++) {
        const line = [];
        for (let i = 0; i <= rings; i++) line.push(V[i][j]);
        spokes.push(line);
      }
      const cells = [];
      for (let i = 0; i < rings; i++) {
        for (let j = 0; j < sides; j++) {
          const jn = (j + 1) % sides;
          cells.push({ pts: [V[i][j], V[i][jn], V[i + 1][jn], V[i + 1][j]], t: (i + 0.5) / rings });
        }
      }
      const points = [];
      for (let i = 0; i <= rings; i++) for (let j = 0; j < sides; j++) points.push({ p: V[i][j], t: i / rings });
      return { V, ringPolys, spokes, cells, points };
    }

    if (P.placement === 'phyllo') {
      const n = P.count, points = [];
      for (let k = 0; k < n; k++) {
        const a = k * GOLDEN;
        const t = Math.sqrt((k + 0.5) / n);
        const rr = R * P.spread * t;
        points.push({ p: jit([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]), t });
      }
      return { points };
    }

    // spiral arms
    const inR = R * 0.05, outR = R * (P.radiusFrac || 1), points = [];
    for (let m = 0; m < P.arms; m++) {
      const base = m * (TAU / P.arms);
      for (let k = 0; k < P.perArm; k++) {
        const frac = k / Math.max(1, P.perArm - 1);
        const a = base + P.twist * TAU * frac;
        const rr = inR + frac * (outR - inR);
        points.push({ p: jit([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]), t: frac });
      }
    }
    return { points };
  }

  // Annular open-arc path (stroked) — the wedgePathD idiom from genesis,
  // reduced to a single arc segment.
  function arcPathD(cx, cy, radius, a0, a1) {
    const x0 = cx + Math.cos(a0) * radius, y0 = cy + Math.sin(a0) * radius;
    const x1 = cx + Math.cos(a1) * radius, y1 = cy + Math.sin(a1) * radius;
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    const r2 = v => Math.round(v * 100) / 100;
    return `M ${r2(x0)} ${r2(y0)} A ${r2(radius)} ${r2(radius)} 0 ${large} 1 ${r2(x1)} ${r2(y1)}`;
  }

  // ── SCENE — the single source of truth for preview + every export. ──
  function buildScene(P, W, H) {
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 * 0.92;
    const geo = buildPoints(P, cx, cy, R);
    const prim = { polygonsStroke: [], polylines: [], lines: [], polygonsFill: [], arcs: [], marks: [], W, H };
    const rn = P.render;

    if (rn === 'rings' && geo.ringPolys) {
      geo.ringPolys.forEach(poly => prim.polygonsStroke.push(poly));
    } else if (rn === 'spokes' && geo.spokes) {
      geo.spokes.forEach(l => prim.polylines.push(l));
    } else if (rn === 'mesh' && geo.V) {
      geo.ringPolys.forEach(poly => prim.polygonsStroke.push(poly));
      geo.spokes.forEach(l => prim.polylines.push(l));
      if (P.diagonals) {
        geo.cells.forEach(c => {
          prim.lines.push([c.pts[0], c.pts[2]]);
          prim.lines.push([c.pts[1], c.pts[3]]);
        });
      }
    } else if (rn === 'fill' && geo.cells) {
      geo.ringPolys.forEach(poly => prim.polygonsStroke.push(poly));
      geo.spokes.forEach(l => prim.polylines.push(l));
      const frng = Organica.mulberry32((P.seed ^ 0x9E3779B9) >>> 0);
      const fox = frng() * 1000 + (P.fillPhase || 0), foy = frng() * 1000 + (P.fillPhase || 0);
      geo.cells.forEach(c => {
        let sx = 0, sy = 0;
        for (const p of c.pts) { sx += p[0]; sy += p[1]; }
        const nx = (sx / 4 - cx) / R, ny = (sy / 4 - cy) / R;
        const f = N.fbm(nx * P.fillScale + fox, ny * P.fillScale + foy);
        const filled = P.threshold <= 0 ? true : P.threshold >= 1 ? false : f > P.threshold;
        if (filled) prim.polygonsFill.push(c.pts);
      });
    } else if (rn === 'marks') {
      const so = P.seed * 1.7;
      geo.points.forEach(({ p, t }) => {
        let r = P.markSize;
        if (P.sizeMode === 'noise') {
          const nx = (p[0] - cx) / R, ny = (p[1] - cy) / R;
          r = P.markSize * (0.25 + P.sizeAmt * N.fbm(nx * 3 + so, ny * 3 + so));
        } else if (P.sizeMode === 'gradient') {
          r = P.markSize * (0.12 + P.sizeAmt * (1 - Math.sqrt(Math.max(0, 1 - t * t))));
        }
        prim.marks.push({ x: p[0], y: p[1], r: Math.max(0.2, r), shape: P.markShape, dir: P.lineDir });
      });
    } else if (rn === 'loops') {
      const lrng = Organica.mulberry32((P.seed * 40503) >>> 0);
      const SEG = 72;
      const lp = P.loopPhase || 0;
      for (let i = 0; i < P.loopCount; i++) {
        const phase = lrng() * 1000;
        const rot = lrng() * TAU;
        const rScale = 0.82 + lrng() * 0.24;
        const baseR = R * P.loopRadius * rScale;
        const drift = R * 0.30 * P.loopNoise * (lrng() - 0.5);
        const ox = drift, oy = R * 0.30 * P.loopNoise * (lrng() - 0.5);
        const loop = [];
        for (let s = 0; s < SEG; s++) {
          const a = rot + (s / SEG) * TAU;
          const nz = N.simplex2(Math.cos(a) * 1.3 + phase + lp, Math.sin(a) * 1.3 + phase + lp);
          const rr = baseR * (1 + nz * P.loopNoise);
          loop.push([cx + ox + Math.cos(a) * rr, cy + oy + Math.sin(a) * rr]);
        }
        prim.polygonsStroke.push(loop);
      }
    } else if (rn === 'arcs') {
      const rng = Organica.mulberry32((P.seed * 2654435761) >>> 0);
      const n = Math.max(1, P.arcCount);
      let rr = R * P.innerFrac + P.arcMin;
      const span = P.arcSpan * TAU;
      for (let i = 0; i < n; i++) {
        const tt = n === 1 ? 1 : i / (n - 1);
        const sw = P.arcMin + Math.pow(tt, P.arcGrowth) * (P.arcMax - P.arcMin);
        const jitter = (rng() - 0.5) * (1 - P.arcBias) * TAU;
        const a0 = -Math.PI / 2 + jitter - span / 2;
        prim.arcs.push({ d: arcPathD(cx, cy, rr + sw / 2, a0, a0 + span), sw: Math.round(sw * 100) / 100 });
        rr += sw + R * P.arcGap;
      }
    }
    return prim;
  }

  // ── SVG (preview === export) ──
  function ptsStr(arr) {
    return arr.map(p => (Math.round(p[0] * 100) / 100) + ',' + (Math.round(p[1] * 100) / 100)).join(' ');
  }
  function n2(v) { return Math.round(v * 100) / 100; }
  function markSVG(m, ink, cx, cy) {
    if (m.shape === 'line') {
      let a = Math.atan2(m.y - cy, m.x - cx);
      if (m.dir === 'tangent') a += Math.PI / 2;
      const dx = Math.cos(a) * m.r, dy = Math.sin(a) * m.r;
      return `<line x1="${n2(m.x - dx)}" y1="${n2(m.y - dy)}" x2="${n2(m.x + dx)}" y2="${n2(m.y + dy)}"/>`;
    }
    if (m.shape === 'circle') return `<circle cx="${n2(m.x)}" cy="${n2(m.y)}" r="${n2(m.r)}" fill="none"/>`;
    return `<circle cx="${n2(m.x)}" cy="${n2(m.y)}" r="${n2(m.r)}"/>`;   // dot
  }
  function sceneSVG(prim, P) {
    const { polygonsStroke, polylines, lines, polygonsFill, arcs, marks, W, H } = prim;
    const wrap = (P.rotate || (P.zoom && P.zoom !== 1));
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
    s += `<rect width="100%" height="100%" fill="${P.paper}"/>`;
    if (wrap) {
      const tf = [];
      if (P.rotate) tf.push(`rotate(${n2(P.rotate)} ${W / 2} ${H / 2})`);
      if (P.zoom && P.zoom !== 1) tf.push(`translate(${n2(W / 2)} ${n2(H / 2)}) scale(${n2(P.zoom)}) translate(${n2(-W / 2)} ${n2(-H / 2)})`);
      s += `<g transform="${tf.join(' ')}">`;
    }
    if (polygonsStroke.length || polylines.length || lines.length) {
      s += `<g fill="none" stroke="${P.ink}" stroke-width="1" stroke-linejoin="round">`;
      polygonsStroke.forEach(poly => { s += `<polygon points="${ptsStr(poly)}"/>`; });
      polylines.forEach(l => { s += `<polyline points="${ptsStr(l)}"/>`; });
      lines.forEach(l => { s += `<line x1="${n2(l[0][0])}" y1="${n2(l[0][1])}" x2="${n2(l[1][0])}" y2="${n2(l[1][1])}"/>`; });
      s += '</g>';
    }
    if (polygonsFill.length) {
      s += `<g fill="${P.ink}" stroke="none">`;
      polygonsFill.forEach(poly => { s += `<polygon points="${ptsStr(poly)}"/>`; });
      s += '</g>';
    }
    arcs.forEach(a => {
      s += `<path d="${a.d}" fill="none" stroke="${P.ink}" stroke-width="${a.sw}" stroke-linecap="butt"/>`;
    });
    if (marks.length) {
      const stroked = marks[0] && marks[0].shape !== 'dot';
      s += `<g fill="${stroked ? 'none' : P.ink}" stroke="${stroked ? P.ink : 'none'}" stroke-width="1">`;
      marks.forEach(m => { s += markSVG(m, P.ink, W / 2, H / 2); });
      s += '</g>';
    }
    if (wrap) s += '</g>';
    s += '</svg>';
    return s;
  }

  // ── Canvas — same primitives. ──
  function drawSceneCanvas(ctx, prim, P, scale) {
    const { polygonsStroke, polylines, lines, polygonsFill, arcs, marks, W, H } = prim;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = P.paper;
    ctx.fillRect(0, 0, W, H);
    if (P.rotate || (P.zoom && P.zoom !== 1)) {
      const cx = W / 2, cy = H / 2;
      ctx.translate(cx, cy);
      if (P.rotate) ctx.rotate(P.rotate * Math.PI / 180);
      if (P.zoom && P.zoom !== 1) ctx.scale(P.zoom, P.zoom);
      ctx.translate(-cx, -cy);
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1;
    ctx.strokeStyle = P.ink;
    const trace = (arr, close) => {
      ctx.beginPath();
      ctx.moveTo(arr[0][0], arr[0][1]);
      for (let i = 1; i < arr.length; i++) ctx.lineTo(arr[i][0], arr[i][1]);
      if (close) ctx.closePath();
    };
    polygonsStroke.forEach(poly => { trace(poly, true); ctx.stroke(); });
    polylines.forEach(l => { trace(l, false); ctx.stroke(); });
    lines.forEach(l => { trace(l, false); ctx.stroke(); });
    ctx.fillStyle = P.ink;
    polygonsFill.forEach(poly => { trace(poly, true); ctx.fill(); });
    arcs.forEach(a => { ctx.lineWidth = a.sw; ctx.stroke(new Path2D(a.d)); });
    ctx.lineWidth = 1;
    marks.forEach(m => {
      if (m.shape === 'line') {
        let ang = Math.atan2(m.y - H / 2, m.x - W / 2);
        if (m.dir === 'tangent') ang += Math.PI / 2;
        const dx = Math.cos(ang) * m.r, dy = Math.sin(ang) * m.r;
        ctx.beginPath(); ctx.moveTo(m.x - dx, m.y - dy); ctx.lineTo(m.x + dx, m.y + dy); ctx.stroke();
      } else if (m.shape === 'circle') {
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
      }
    });
    ctx.restore();
  }

  // ── PRESETS — one snapshot per covered Book of Shapes radial pattern.
  //    Keys are the lowercase applyState() shape, NOT the camelCase buildScene
  //    P shape; a consumer that feeds these to buildScene must map them first
  //    (radial/index.html does this in buildParams()).
  const BP = (o) => Object.assign({
    placement: 'grid', modulation: 'none', render: 'rings', markshape: 'dot', linedir: 'radial', sizemode: 'uniform',
    diagonals: false, sides: 48, rings: 12, inner: 0.15, radius: 1, ringcurve: 1,
    count: 800, spread: 0.95, arms: 3, perarm: 220, twist: 3.5,
    petals: 8, petaldepth: 0.5, shear: 1.2, warpamt: 0, warpscale: 0.6,
    fillscale: 6, threshold: 0.42, marksize: 3, sizeamt: 1,
    arccount: 7, arcmin: 1, arcmax: 90, arcgrowth: 2, arcgap: 0.02, arcspan: 0.42, arcbias: 0.7,
    loopcount: 83, loopradius: 0.85, loopnoise: 0.16,
    jitter: 0, seed: 3, ink: '#1c1c1c', paper: '#f2efe6',
  }, o);

  const BUILTIN_PRESETS = {
    'Broken Ring':            BP({ render: 'fill', sides: 72, rings: 21, inner: 0.35, warpamt: 0.12, fillscale: 6, threshold: 0.42, seed: 3 }),
    'Nested Polygons':        BP({ render: 'rings', sides: 6, rings: 12, inner: 0.05, warpamt: 0, seed: 1, ink: '#241b14', paper: '#ffffff' }),
    'Concentric Noise Rings': BP({ render: 'rings', sides: 64, rings: 22, inner: 0.08, warpamt: 0.35, warpscale: 0.5, seed: 6 }),
    'Noise Circle':           BP({ render: 'rings', sides: 72, rings: 1, inner: 0, radius: 0.9, warpamt: 0.5, warpscale: 0.8, seed: 2 }),
    'Modular Circle':         BP({ render: 'rings', sides: 60, rings: 10, inner: 0.15, ringcurve: 2, warpamt: 0, seed: 1 }),
    'Radial Harmony':         BP({ render: 'mesh', sides: 24, rings: 8, inner: 0.12, warpamt: 0, seed: 1, ink: '#241b14', paper: '#ffffff' }),
    'Radial Spokes':          BP({ render: 'spokes', sides: 34, rings: 2, inner: 0.3, radius: 0.95, warpamt: 0, jitter: 0.14, seed: 4, ink: '#241b14', paper: '#ffffff' }),
    'Line-Based Circles':     BP({ render: 'marks', markshape: 'line', linedir: 'tangent', sizemode: 'uniform', sides: 48, rings: 8, inner: 0.12, radius: 0.95, marksize: 4, jitter: 0.06, warpamt: 0, seed: 3, ink: '#241b14', paper: '#ffffff' }),
    'Jittered Rings':         BP({ render: 'rings', sides: 40, rings: 8, inner: 0.1, jitter: 0.05, warpamt: 0, seed: 3 }),
    'Polar Mesh':             BP({ render: 'mesh', diagonals: true, sides: 30, rings: 9, inner: 0.1, warpamt: 0.1, warpscale: 0.5, seed: 5 }),
    'Rose Mesh':              BP({ render: 'mesh', modulation: 'rose', petals: 8, petaldepth: 0.5, sides: 46, rings: 9, inner: 0.1, warpamt: 0.12, warpscale: 0.7, seed: 2 }),
    'Spiral Mesh':            BP({ render: 'mesh', modulation: 'shear', shear: 1.2, sides: 40, rings: 12, inner: 0.08, warpamt: 0.08, seed: 3 }),
    'Phyllotaxis Bloom':      BP({ placement: 'phyllo', render: 'marks', markshape: 'line', sizemode: 'gradient', count: 800, spread: 0.95, marksize: 6, sizeamt: 1.2, warpamt: 0, seed: 1, ink: '#241b14', paper: '#ffffff' }),
    'Spiral Dot Field':       BP({ placement: 'spiral', render: 'marks', markshape: 'dot', sizemode: 'uniform', arms: 3, perarm: 220, twist: 3.5, marksize: 3, warpamt: 0, seed: 7, ink: '#241b14', paper: '#ffffff' }),
    'Halftone Sphere':        BP({ render: 'marks', markshape: 'dot', sizemode: 'gradient', sides: 48, rings: 26, inner: 0.02, marksize: 2.5, sizeamt: 2, warpamt: 0, seed: 1, ink: '#241b14', paper: '#ffffff' }),
    'Chaos Circles':          BP({ render: 'loops', loopcount: 83, loopradius: 0.85, loopnoise: 0.16, seed: 9, ink: '#241b14', paper: '#ffffff' }),
    'Brockmann Arcs':         BP({ render: 'arcs', arccount: 7, arcmin: 1, arcmax: 90, arcgrowth: 2, arcgap: 0.02, arcspan: 0.42, arcbias: 0.7, inner: 0.12, seed: 4, ink: '#1c1c1c', paper: '#efe9dd' }),
  };

  Organica.radial = {
    SIZE, PARAM_RANGES, BP, BUILTIN_PRESETS,
    buildScene, sceneSVG, drawSceneCanvas,
    buildPoints, warpPoint, arcPathD,
  };
})(typeof window !== 'undefined' ? window : this);
