/* ─────────────────────────────────────────────────────────────────────────────
 * pathfx.js — Organica.pathfx: the font-agnostic vector/raster effect engine
 * behind Living Path.
 *
 * Extracted from livingpath/index.html at the second consumer (a new
 * standalone vector-transformation tool) — same "extract at the second
 * consumer" move as tracks.js / radial.js / shapes.js / pollen-engine.js.
 * Living Path's own Explore pass confirmed this engine never reads anything
 * font-specific: every effect operates on a generic `subs` polyline
 * structure ([{closed, pts:[{x,y}]}]) whether the source was a font glyph,
 * an uploaded SVG, or a Genesis seed. Living Path keeps the genuinely
 * font-specific 20% (opentype parsing, the live text specimen, OTF export +
 * its Web Worker) locally, aliasing this module for everything else.
 *
 * SCOPE (moved here, all pure — no DOM, no font, no per-document state
 * beyond the two small internal knobs below):
 *   - Path/geometry model: cubicPts/quadPts (Bézier flattening), fromSVGString
 *     (generic SVG → subs, via the browser's own SVGGeometryElement),
 *     bboxOf, normalise, dFromSubs (subs → SVG path `d`, Catmull-Rom
 *     re-emission).
 *   - Vector effects registry FX (jitter/wobble/inflate/roughen/smooth/
 *     twist/scatter).
 *   - Raster engine: rasterize, morph, boxBlur, addNoise, grayScott,
 *     particles, skeleton, seamCarve, polygonize, contours (marching
 *     squares), smoothPoly, rasterFieldToSubs. Raster effects registry RFX
 *     wraps these.
 *   - Groups/blend appliers: blendField, rasterFieldFromGroups,
 *     applyVectorGroups — take a plain `groups` array + data, return data.
 *   - PRESETS (24 built-ins, pure parameterizations of the effect stack).
 *
 * NOT moved (stays tool-local, in both Living Path and any new consumer):
 * the live GROUPS/TECH/uid document state, addEffectToGroup/newGroup/
 * curGroups/aFX, chainedSubs/rasterCompute/CHAIN, presetToGroups, and every
 * DOM/render function (buildLayerEl, renderStack, computed, repaint,
 * preset-menu UI). Those are per-document orchestration wired to each
 * tool's own render()/markCustom() calls — the same "engine in shared/,
 * orchestration stays local" split as shared/radial.js (Radial/Pulsar) or
 * shared/tracks.js (Pulsar/Trellis).
 *
 * Two small stateful knobs (SEED_OFFSET, CONTOUR_SMOOTH) genuinely live
 * inside the effect functions' closures (per-instance seed shift for the
 * text specimen; contour-smoothing pass count some presets override) — kept
 * as internal module state here, exposed via get/set so a consumer can
 * still read/write them exactly as Living Path's own local vars did.
 *
 * LOAD ORDER: core.js → pathfx.js → tool script.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  const mulberry32 = a => Organica.mulberry32(a);

  // ============================================================
  //  PATH MODEL
  // ============================================================
  function cubicPts(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push({
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
      });
    }
    return out;
  }
  function quadPts(p0, p1, p2, n) {
    const out = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push({ x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y });
    }
    return out;
  }

  // Parse an SVG string -> subpaths, using the browser's own geometry
  // (SVGGeometryElement.getPointAtLength) so every shape type works.
  function fromSVGString(svgText) {
    // Use the HTML parser (innerHTML) so the nodes are real SVGGeometryElements
    // in THIS document — DOMParser nodes lack getTotalLength when adopted.
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden';
    holder.innerHTML = svgText;
    const root = holder.querySelector('svg');
    if (!root) throw new Error('no <svg>');
    document.body.appendChild(holder);
    const subs = [];
    const els = root.querySelectorAll('path,circle,ellipse,rect,line,polyline,polygon');
    els.forEach(el => {
      if (typeof el.getTotalLength !== 'function') return;
      let len = 0; try { len = el.getTotalLength(); } catch (e) { return; }
      if (!len) return;
      const step = Math.max(1.5, len / 220);          // ~120–220 samples
      const pts = [];
      for (let d = 0; d <= len; d += step) {
        const pt = el.getPointAtLength(d); pts.push({ x: pt.x, y: pt.y });
      }
      const tag = el.tagName.toLowerCase();
      const closed = ['circle', 'ellipse', 'rect', 'polygon'].includes(tag) ||
        (el.getAttribute('d') || '').toLowerCase().includes('z');
      if (pts.length > 2) subs.push({ closed, pts });
    });
    holder.remove();
    if (!subs.length) throw new Error('no drawable geometry');
    return subs;
  }

  function bboxOf(subs) {
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const s of subs) for (const p of s.pts) {
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }

  // normalise into a 1000×1000 box, centred, y-down
  function normalise(subs, flipY) {
    const bb = bboxOf(subs);
    const pad = 120, span = 1000 - pad * 2;
    const s = span / Math.max(bb.w, bb.h || 1);
    const ox = 500 - (bb.minX + bb.w / 2) * s, oy = 500 - (bb.minY + bb.h / 2) * s;
    const out = subs.map(sub => ({
      closed: sub.closed,
      pts: sub.pts.map(p => ({
        x: p.x * s + ox,
        y: flipY ? (1000 - (p.y * s + oy)) : (p.y * s + oy)
      }))
    }));
    return { subs: out, bbox: bboxOf(out) };
  }

  function dFromSubs(subs) {
    // Catmull-Rom -> cubic for a smooth re-emission of the polyline
    let d = '';
    for (const s of subs) {
      const p = s.pts; const n = p.length; if (n < 2) continue;
      d += `M${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
      const segs = s.closed ? n : n - 1;
      for (let i = 0; i < segs; i++) {
        const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
        const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
        d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      if (s.closed) d += 'Z';
    }
    return d;
  }

  // ============================================================
  //  Internal stateful knobs — per-instance seed shift + contour smoothing.
  //  Genuinely read inside the FX/RFX closures below, so they live here
  //  rather than being threaded through every apply() call. A consumer
  //  reads/writes them via the exported get/set pair.
  // ============================================================
  let SEED_OFFSET = 0;
  let CONTOUR_SMOOTH = 2;
  function setSeedOffset(v) { SEED_OFFSET = v; }
  function getSeedOffset() { return SEED_OFFSET; }
  function setContourSmooth(v) { CONTOUR_SMOOTH = v; }
  function getContourSmooth() { return CONTOUR_SMOOTH; }

  // ============================================================
  //  EFFECTS  — each: (subs, params, rng) => subs (new arrays)
  // ============================================================
  const FX = {
    jitter: {
      name: 'Noise · jitter', defaults: { amount: 6, seed: 7 },
      controls: [['amount', 'Amount', 0, 40, 1], ['seed', 'Seed', 1, 99, 1]],
      apply(subs, p) {
        const r = mulberry32(((p.seed + SEED_OFFSET) * 2654435761) >>> 0);
        return subs.map(s => ({
          closed: s.closed, pts: s.pts.map(pt => ({
            x: pt.x + (r() * 2 - 1) * p.amount, y: pt.y + (r() * 2 - 1) * p.amount
          }))
        }));
      }
    },

    wobble: {
      name: 'Wobble · sine', defaults: { amp: 14, freq: 6, phase: 0 },
      controls: [['amp', 'Amplitude', 0, 60, 1], ['freq', 'Frequency', 1, 30, 1], ['phase', 'Phase', 0, 100, 1]],
      apply(subs, p) {
        return subs.map(s => {
          const n = s.pts.length, ph = p.phase / 100 * Math.PI * 2;
          const pts = s.pts.map((pt, i) => {
            // displace along the local normal
            const a = s.pts[(i - 1 + n) % n], b = s.pts[(i + 1) % n];
            let dx = b.x - a.x, dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
            const off = Math.sin(i / n * p.freq * Math.PI * 2 + ph) * p.amp;
            return { x: pt.x - dy * off, y: pt.y + dx * off };
          });
          return { closed: s.closed, pts };
        });
      }
    },

    inflate: {
      name: 'Inflate / Erode', defaults: { dist: 8 },
      controls: [['dist', 'Distance', -40, 40, 1]],
      apply(subs, p) {
        return subs.map(s => {
          const n = s.pts.length;
          const pts = s.pts.map((pt, i) => {
            const a = s.pts[(i - 1 + n) % n], b = s.pts[(i + 1) % n];
            let dx = b.x - a.x, dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1;
            // outward normal (assume CW-ish); push along it
            return { x: pt.x + (dy / L) * p.dist, y: pt.y - (dx / L) * p.dist };
          });
          return { closed: s.closed, pts };
        });
      }
    },

    roughen: {
      name: 'Roughen', defaults: { detail: 3, amount: 10, seed: 13 },
      controls: [['detail', 'Subdiv', 1, 6, 1], ['amount', 'Push', 0, 40, 1], ['seed', 'Seed', 1, 99, 1]],
      apply(subs, p) {
        const r = mulberry32(((p.seed + SEED_OFFSET) * 40503) >>> 0);
        return subs.map(s => {
          let pts = s.pts.slice();
          for (let k = 0; k < p.detail; k++) { // midpoint subdivide
            const np = [];
            for (let i = 0; i < pts.length; i++) {
              const a = pts[i], b = pts[(i + 1) % pts.length];
              np.push(a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
            }
            pts = np;
          }
          pts = pts.map(pt => ({ x: pt.x + (r() * 2 - 1) * p.amount, y: pt.y + (r() * 2 - 1) * p.amount }));
          return { closed: s.closed, pts };
        });
      }
    },

    smooth: {
      name: 'Organic smooth', defaults: { iter: 2, strength: 50 },
      controls: [['iter', 'Passes', 1, 8, 1], ['strength', 'Strength', 0, 100, 1]],
      apply(subs, p) {
        const w = p.strength / 100;
        return subs.map(s => {
          let pts = s.pts.map(q => ({ x: q.x, y: q.y })); const n = pts.length;
          for (let k = 0; k < p.iter; k++) {
            const np = pts.map((pt, i) => {
              const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
              return { x: pt.x * (1 - w) + (a.x + b.x) / 2 * w, y: pt.y * (1 - w) + (a.y + b.y) / 2 * w };
            });
            pts = np;
          }
          return { closed: s.closed, pts };
        });
      }
    },

    twist: {
      name: 'Twist · radial', defaults: { angle: 40, falloff: 60 },
      controls: [['angle', 'Angle', -180, 180, 1], ['falloff', 'Falloff', 0, 100, 1]],
      apply(subs, p) {
        const bb = bboxOf(subs), cx = bb.minX + bb.w / 2, cy = bb.minY + bb.h / 2;
        const R = Math.max(bb.w, bb.h) / 2 || 1, ff = p.falloff / 100;
        return subs.map(s => ({
          closed: s.closed, pts: s.pts.map(pt => {
            const dx = pt.x - cx, dy = pt.y - cy, d = Math.hypot(dx, dy) / R;
            const a = (p.angle * Math.PI / 180) * (1 - d * ff);
            const ca = Math.cos(a), sa = Math.sin(a);
            return { x: cx + dx * ca - dy * sa, y: cy + dx * sa + dy * ca };
          })
        }));
      }
    },

    scatter: {
      name: 'Scatter · explode', defaults: { dist: 30, seed: 5 },
      controls: [['dist', 'Distance', 0, 120, 1], ['seed', 'Seed', 1, 99, 1]],
      apply(subs, p) {
        const bb = bboxOf(subs), cx = bb.minX + bb.w / 2, cy = bb.minY + bb.h / 2;
        const r = mulberry32(((p.seed + SEED_OFFSET) * 2246822519) >>> 0);
        return subs.map(s => {
          const ox = (r() * 2 - 1), oy = (r() * 2 - 1);                 // per-subpath drift
          return {
            closed: s.closed, pts: s.pts.map(pt => {
              let dx = pt.x - cx, dy = pt.y - cy, L = Math.hypot(dx, dy) || 1;
              return { x: pt.x + dx / L * p.dist * Math.abs(ox), y: pt.y + dy / L * p.dist * Math.abs(oy) };
            })
          };
        });
      }
    },
  };

  // ============================================================
  //  RASTER ENGINE  — glyph/shape → bitmap → pixel algorithms →
  //  re-vectorise (marching squares). Unlike the vector effects (which only
  //  nudge anchors), this changes TOPOLOGY: strokes merge, holes open,
  //  coral/cellular textures grow.
  // ============================================================
  const RES = 170;   // working grid resolution (speed vs. detail)

  function rasterize(subs) {
    const c = document.createElement('canvas'); c.width = c.height = RES;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, RES, RES);
    ctx.fillStyle = '#fff';
    ctx.save(); ctx.scale(RES / 1000, RES / 1000);
    try { ctx.fill(new Path2D(dFromSubs(subs)), 'evenodd'); } catch (e) {}
    ctx.restore();
    const img = ctx.getImageData(0, 0, RES, RES).data;
    const f = new Float32Array(RES * RES);
    for (let i = 0; i < f.length; i++) f[i] = img[i * 4] / 255;   // red channel = density
    return { w: RES, h: RES, f };
  }

  function morph(g, amt) {                     // dilate (>0) / erode (<0)
    const it = Math.abs(amt | 0), grow = amt > 0, { w, h } = g;
    for (let k = 0; k < it; k++) {
      const f = g.f, o = new Float32Array(f.length);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let m = f[y * w + x];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const v = f[yy * w + xx]; m = grow ? Math.max(m, v) : Math.min(m, v);
        }
        o[y * w + x] = m;
      }
      g.f = o;
    }
  }
  function boxBlur(g, r) {
    r = Math.round(r); if (r <= 0) return; const { w, h } = g;
    for (let pass = 0; pass < 2; pass++) {
      for (const horiz of [true, false]) {
        const f = g.f, o = new Float32Array(f.length);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          let sum = 0, cnt = 0;
          for (let k = -r; k <= r; k++) {
            const xx = horiz ? x + k : x, yy = horiz ? y : y + k;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            sum += f[yy * w + xx]; cnt++;
          }
          o[y * w + x] = sum / cnt;
        }
        g.f = o;
      }
    }
  }
  function addNoise(g, amt, scale, seed) {
    const { w, h } = g, rnd = mulberry32((seed * 99991) >>> 0), gs = Math.max(2, scale);
    const gw = Math.ceil(w / gs) + 2, gh = Math.ceil(h / gs) + 2, lat = new Float32Array(gw * gh);
    for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    const at = (gx, gy) => lat[gy * gw + gx];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = x / gs, fy = y / gs, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const ux = tx * tx * (3 - 2 * tx), uy = ty * ty * (3 - 2 * ty);
      const n = at(ix, iy) * (1 - ux) * (1 - uy) + at(ix + 1, iy) * ux * (1 - uy) + at(ix, iy + 1) * (1 - ux) * uy + at(ix + 1, iy + 1) * ux * uy;
      const i = y * w + x; g.f[i] = Math.min(1, Math.max(0, g.f[i] + (n - 0.5) * 2 * amt));
    }
  }
  function grayScott(g, F, K, steps, seedn, depth) {     // reaction-diffusion (coral/cellular)
    const { w, h } = g, N = w * h, Du = 0.16, Dv = 0.08;
    const M = new Uint8Array(N); for (let i = 0; i < N; i++) M[i] = g.f[i] > 0.5 ? 1 : 0;  // glyph mask
    const U = new Float32Array(N).fill(1), V = new Float32Array(N);
    // seed random spots INSIDE the glyph — Gray-Scott grows a coral/labyrinth
    // pattern from spots (seeding the whole mask just gives edge effects).
    const rnd = mulberry32(((seedn || 5) * 2654435761) >>> 0), ink = [];
    for (let i = 0; i < N; i++) if (M[i]) ink.push(i);
    if (!ink.length) return;
    const spots = Math.max(6, Math.floor(ink.length / 55));
    for (let k = 0; k < spots; k++) {
      const c = ink[(rnd() * ink.length) | 0], cx = c % w, cy = (c / w) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue; const i = y * w + x; if (M[i]) { V[i] = 1; U[i] = 0.35; }
      }
    }
    const U2 = new Float32Array(N), V2 = new Float32Array(N);
    for (let s = 0; s < steps; s++) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const l = x > 0 ? i - 1 : i, r = x < w - 1 ? i + 1 : i, u = y > 0 ? i - w : i, d = y < h - 1 ? i + w : i;
        const lapU = U[l] + U[r] + U[u] + U[d] - 4 * U[i], lapV = V[l] + V[r] + V[u] + V[d] - 4 * V[i];
        const uvv = U[i] * V[i] * V[i];
        U2[i] = U[i] + (Du * lapU - uvv + F * (1 - U[i]));
        V2[i] = V[i] + (Dv * lapV + uvv - (F + K) * V[i]);
        if (!M[i]) { V2[i] = 0; U2[i] = 1; }                  // confine the reaction to the glyph
      }
      U.set(U2); V.set(V2);
    }
    let mx = 0; for (let i = 0; i < N; i++) if (V[i] > mx) mx = V[i];
    const inv = mx > 1e-4 ? 1 / mx : 1, dp = (depth == null ? 0.9 : depth / 100);
    // letter stays solid; the coral pattern carves cellular holes (peaks of V)
    for (let i = 0; i < N; i++) g.f[i] = M[i] ? Math.max(0, 1 - dp * V[i] * inv) : 0;
  }

  // particles — scatter disks seeded on the ink; they accrete into bubbly
  // nodules along the form (union into the field).
  function particles(g, count, size, spread, seed, keepBody) {
    const { w, h, f } = g, rnd = mulberry32((seed * 2654435761) >>> 0);
    const ink = []; for (let i = 0; i < f.length; i++) if (f[i] > 0.5) ink.push(i);
    if (!ink.length) return;
    // keepBody=1 → nodules on the glyph; 0 → ONLY the disks (for subtract groups)
    const out = new Float32Array(f.length); if (keepBody) out.set(f);
    for (let k = 0; k < count; k++) {
      const i = ink[(rnd() * ink.length) | 0];
      let cx = (i % w) + (rnd() * 2 - 1) * spread, cy = ((i / w) | 0) + (rnd() * 2 - 1) * spread;
      const r = size * (0.5 + rnd());
      const x0 = Math.max(0, (cx - r) | 0), x1 = Math.min(w - 1, (cx + r) | 0),
        y0 = Math.max(0, (cy - r) | 0), y1 = Math.min(h - 1, (cy + r) | 0);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) out[y * w + x] = 1;
    }
    g.f = out;
  }

  // Zhang–Suen thinning → 1px skeleton, then dilate to a constant stream width.
  function skeleton(g, width) {
    const { w, h } = g; let b = new Uint8Array(w * h);
    for (let i = 0; i < b.length; i++) b[i] = g.f[i] > 0.5 ? 1 : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : b[y * w + x];
    let changed = true, guard = 0;
    while (changed && guard++ < 60) {
      changed = false;
      for (const step of [0, 1]) {
        const del = [];
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          if (!at(x, y)) continue;
          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1),
            p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
          const C = (p2 === 0 && p3 === 1) + (p3 === 0 && p4 === 1) + (p4 === 0 && p5 === 1) + (p5 === 0 && p6 === 1)
            + (p6 === 0 && p7 === 1) + (p7 === 0 && p8 === 1) + (p8 === 0 && p9 === 1) + (p9 === 0 && p2 === 1);
          const Nn = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (C !== 1 || Nn < 2 || Nn > 6) continue;
          if (step === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue; }
          else { if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue; }
          del.push(y * w + x);
        }
        if (del.length) { changed = true; for (const i of del) b[i] = 0; }
      }
    }
    const sk = { w, h, f: new Float32Array(w * h) };
    for (let i = 0; i < b.length; i++) sk.f[i] = b[i];
    if (width > 0) morph(sk, width);            // thicken the 1px line into a stream
    g.f = sk.f;
  }
  // seam carving — remove `count` minimum-energy seams (content-aware), which
  // pinches/slices the glyph. dir 0 = vertical seams (narrows width), 1 = horizontal.
  function seamCarve(g, count, dir) {
    let W = dir ? g.h : g.w, H = dir ? g.w : g.h;    // work where seams are vertical
    let cur = new Float32Array(W * H);
    if (dir) { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) cur[x * H + y] = g.f[y * g.w + x]; }  // transpose
    else cur.set(g.f);
    const startW = W; count = Math.max(0, Math.min(count | 0, W - 4));
    for (let s = 0; s < count; s++) {
      const en = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const l = cur[y * W + (x > 0 ? x - 1 : 0)], r = cur[y * W + (x < W - 1 ? x + 1 : W - 1)];
        const u = cur[(y > 0 ? y - 1 : 0) * W + x], d = cur[(y < H - 1 ? y + 1 : H - 1) * W + x];
        en[y * W + x] = Math.abs(r - l) + Math.abs(d - u);
      }
      const M = new Float32Array(W * H), back = new Int32Array(W * H);
      for (let x = 0; x < W; x++) M[x] = en[x];
      for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
        let best = M[(y - 1) * W + x], bx = x;
        if (x > 0 && M[(y - 1) * W + x - 1] < best) { best = M[(y - 1) * W + x - 1]; bx = x - 1; }
        if (x < W - 1 && M[(y - 1) * W + x + 1] < best) { best = M[(y - 1) * W + x + 1]; bx = x + 1; }
        M[y * W + x] = en[y * W + x] + best; back[y * W + x] = bx;
      }
      let minx = 0, minv = Infinity;
      for (let x = 0; x < W; x++) { const v = M[(H - 1) * W + x]; if (v < minv) { minv = v; minx = x; } }
      const nw = W - 1, nf = new Float32Array(nw * H); let sx = minx;
      for (let y = H - 1; y >= 0; y--) {
        let j = 0;
        for (let x = 0; x < W; x++) { if (x === sx) continue; nf[y * nw + j] = cur[y * W + x]; j++; }
        sx = back[y * W + sx];
      }
      cur = nf; W = nw;
    }
    // recentre the carved content in the original width
    const full = new Float32Array(startW * H), off = Math.floor((startW - W) / 2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) full[y * startW + x + off] = cur[y * W + x];
    if (dir) {
      const o = new Float32Array(g.w * g.h);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) o[y * g.w + x] = full[x * startW + y];
      g.f = o;
    } else g.f = full;
  }
  // block-quantise the field → chunky/faceted regions (pair with low contour smoothing)
  function polygonize(g, block) {
    const { w, h, f } = g; block = Math.max(2, block | 0);
    const o = new Float32Array(f.length);
    for (let by = 0; by < h; by += block) for (let bx = 0; bx < w; bx += block) {
      let sum = 0, c = 0; const x1 = Math.min(w, bx + block), y1 = Math.min(h, by + block);
      for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) { sum += f[y * w + x]; c++; }
      const v = sum / c > 0.5 ? 1 : 0;
      for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) o[y * w + x] = v;
    }
    g.f = o;
  }

  // ── marching squares → stitched contour polylines ──
  function contours(g, level) {
    const { w, h, f } = g, val = (x, y) => f[y * w + x], segs = [];
    const ip = (x1, y1, v1, x2, y2, v2) => { const t = (level - v1) / ((v2 - v1) || 1e-6); return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]; };
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
      const tl = val(x, y), tr = val(x + 1, y), br = val(x + 1, y + 1), bl = val(x, y + 1);
      let idx = 0; if (tl > level) idx |= 8; if (tr > level) idx |= 4; if (br > level) idx |= 2; if (bl > level) idx |= 1;
      if (idx === 0 || idx === 15) continue;
      const T = () => ip(x, y, tl, x + 1, y, tr), R = () => ip(x + 1, y, tr, x + 1, y + 1, br),
        B = () => ip(x, y + 1, bl, x + 1, y + 1, br), L = () => ip(x, y, tl, x, y + 1, bl);
      const push = (a, b) => segs.push([a, b]);
      switch (idx) {
        case 1: push(L(), B()); break; case 2: push(B(), R()); break;
        case 3: push(L(), R()); break; case 4: push(T(), R()); break;
        case 5: push(L(), T()); push(B(), R()); break;
        case 6: push(T(), B()); break; case 7: push(L(), T()); break;
        case 8: push(T(), L()); break; case 9: push(T(), B()); break;
        case 10: push(T(), R()); push(B(), L()); break;
        case 11: push(T(), R()); break; case 12: push(L(), R()); break;
        case 13: push(B(), R()); break; case 14: push(L(), B()); break;
      }
    }
    // stitch segments into polylines by endpoint hashing
    const key = p => `${Math.round(p[0] * 50)},${Math.round(p[1] * 50)}`;
    const map = new Map();
    segs.forEach((s, i) => [0, 1].forEach(e => { const k = key(s[e]); (map.get(k) || map.set(k, []).get(k)).push({ i, e }); }));
    const used = new Array(segs.length).fill(false), polys = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue; used[i] = true;
      const poly = [segs[i][0], segs[i][1]];
      let grow = true;
      while (grow) {
        grow = false;
        const tail = poly[poly.length - 1], cand = (map.get(key(tail)) || []).find(c => !used[c.i]);
        if (cand) { used[cand.i] = true; poly.push(segs[cand.i][cand.e ^ 1]); grow = true; }
      }
      if (key(poly[0]) === key(poly[poly.length - 1])) poly.pop();
      if (poly.length > 2) polys.push({ closed: true, pts: poly.map(p => ({ x: p[0], y: p[1] })) });
    }
    return polys;
  }

  // Laplacian smoothing on a closed polyline → rounds the marching-squares
  // stair-steps into the bubbly LivingPath edge. Also lightly decimates.
  function smoothPoly(pts, iter) {
    let p = pts.map(q => ({ x: q.x, y: q.y })); const n0 = p.length;
    for (let k = 0; k < iter; k++) {
      const n = p.length, o = new Array(n);
      for (let i = 0; i < n; i++) {
        const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
        o[i] = { x: (a.x + 2 * b.x + c.x) / 4, y: (a.y + 2 * b.y + c.y) / 4 };
      }
      p = o;
    }
    // decimate: drop points closer than ~1.2 grid units
    const out = []; let last = null;
    for (const q of p) { if (!last || Math.hypot(q.x - last.x, q.y - last.y) > 1.2) { out.push(q); last = q; } }
    return out.length > 2 ? out : p;
  }
  function rasterFieldToSubs(g, sc) {
    return contours(g, 0.5)
      .map(p => ({ closed: true, pts: smoothPoly(p.pts, CONTOUR_SMOOTH) }))
      .filter(p => p.pts.length > 2)
      .map(p => ({ closed: true, pts: p.pts.map(q => ({ x: q.x * sc, y: q.y * sc })) }));
  }

  const RFX = {
    dilate: {
      name: 'Dilate / Erode', defaults: { amount: 2 },
      controls: [['amount', 'Grow', -8, 8, 1]],
      apply(g, p) { morph(g, p.amount); }
    },
    blur: {
      name: 'Blur (flood)', defaults: { radius: 3 },
      controls: [['radius', 'Radius', 0, 14, 1]],
      apply(g, p) { boxBlur(g, p.radius); }
    },
    threshold: {
      name: 'Threshold (melt)', defaults: { level: 50 },
      controls: [['level', 'Level', 2, 98, 1]],
      apply(g, p) { const L = p.level / 100; for (let i = 0; i < g.f.length; i++) g.f[i] = g.f[i] >= L ? 1 : 0; }
    },
    noise: {
      name: 'Noise', defaults: { amount: 35, scale: 9, seed: 7 },
      controls: [['amount', 'Amount', 0, 100, 1], ['scale', 'Scale', 2, 28, 1], ['seed', 'Seed', 1, 99, 1]],
      apply(g, p) { addNoise(g, p.amount / 100, p.scale, p.seed + SEED_OFFSET); }
    },
    particles: {
      name: 'Particles', defaults: { count: 260, size: 5, spread: 6, seed: 5, body: 1 },
      controls: [['count', 'Count', 20, 800, 10], ['size', 'Size', 2, 14, 1], ['spread', 'Spread', 0, 30, 1], ['seed', 'Seed', 1, 99, 1], ['body', 'Keep body', 0, 1, 1]],
      apply(g, p) { particles(g, p.count, p.size, p.spread, p.seed + SEED_OFFSET, p.body); }
    },
    skeleton: {
      name: 'Center-line (skeleton)', defaults: { width: 2 },
      controls: [['width', 'Stream width', 0, 8, 1]],
      apply(g, p) { skeleton(g, p.width); }
    },
    polygonize: {
      name: 'Polygonize (facet)', defaults: { block: 9 },
      controls: [['block', 'Block', 3, 24, 1]],
      apply(g, p) { polygonize(g, p.block); }
    },
    seam: {
      name: 'Seam carve', defaults: { count: 16, dir: 0 },
      controls: [['count', 'Seams', 0, 50, 1], ['dir', 'Vertical', 0, 1, 1]],
      apply(g, p) { seamCarve(g, p.count, p.dir); }
    },
    reaction: {
      name: 'Reaction-diffusion', defaults: { feed: 55, kill: 62, iters: 18, depth: 90, seed: 5 },
      controls: [['feed', 'Feed', 12, 80, 1], ['kill', 'Kill', 45, 75, 1], ['iters', 'Steps', 1, 40, 1], ['depth', 'Depth', 20, 100, 1], ['seed', 'Seed', 1, 99, 1]],
      apply(g, p) { grayScott(g, p.feed / 1000, p.kill / 1000, p.iters * 36, p.seed + SEED_OFFSET, p.depth); }
    },
  };

  // ── shared appliers — used by BOTH the live preview and the font export ──
  function blendField(a, b, mode) {
    const o = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      const x = a[i], y = b[i];
      o[i] = mode === 'multiply' ? x * y
        : mode === 'subtract' ? x * (1 - y)
        : mode === 'xor' ? Math.min(1, Math.max(0, x + y - 2 * x * y))
        : mode === 'add' ? Math.min(1, x + y)
        : mode === 'screen' ? 1 - (1 - x) * (1 - y)
        : Math.max(x, y); // union
    }
    return o;
  }
  function rasterFieldFromGroups(base, groups) {
    let acc = null;
    for (const grp of groups) {
      if (!grp.on) continue;
      const g = { w: base.w, h: base.h, f: new Float32Array(base.f) };   // each group starts from source
      for (const layer of grp.layers) { if (layer.on) RFX[layer.type].apply(g, layer.params); }
      acc = acc === null ? g : { w: g.w, h: g.h, f: blendField(acc.f, g.f, grp.blend) };
    }
    return acc || base;
  }
  function applyVectorGroups(subs, groups) {
    for (const grp of groups) {
      if (!grp.on) continue;
      for (const layer of grp.layers) { if (layer.on) subs = FX[layer.type].apply(subs, layer.params); }
    }
    return subs;
  }

  // ── presets — `fx:` = one group; `groups:` = multiple (with blend) ──
  const PRESETS = {
    vector: {
      'Type-safe': { safe: true, fx: [['roughen', { detail: 2, amount: 4, seed: 7 }], ['wobble', { amp: 6, freq: 5, phase: 0 }]] },
      'Eroded': { fx: [['roughen', { detail: 4, amount: 14, seed: 13 }], ['wobble', { amp: 12, freq: 7, phase: 20 }]] },
      'Liquid': { fx: [['smooth', { iter: 3, strength: 60 }], ['inflate', { dist: 10 }], ['wobble', { amp: 16, freq: 4, phase: 0 }]] },
      'Vortex': { fx: [['twist', { angle: 90, falloff: 70 }], ['roughen', { detail: 3, amount: 8, seed: 5 }]] },
      'Shatter': { fx: [['scatter', { dist: 50, seed: 5 }], ['jitter', { amount: 10, seed: 21 }]] },
    },
    raster: {
      'Avulsion': { safe: true, fx: [['dilate', { amount: 1 }], ['blur', { radius: 3 }], ['threshold', { level: 48 }], ['noise', { amount: 22, scale: 11, seed: 7 }]] },
      'Flood': { fx: [['dilate', { amount: 3 }], ['blur', { radius: 5 }], ['threshold', { level: 50 }]] },
      'Bulbs': { fx: [['dilate', { amount: 1 }], ['blur', { radius: 6 }], ['threshold', { level: 38 }]] },
      'Grain': { fx: [['noise', { amount: 45, scale: 6, seed: 11 }], ['threshold', { level: 52 }]] },
      'Bubbles': { fx: [['particles', { count: 320, size: 6, spread: 5, seed: 5 }], ['blur', { radius: 2 }], ['threshold', { level: 45 }]] },
      'Stream': { fx: [['skeleton', { width: 3 }], ['blur', { radius: 2 }], ['threshold', { level: 42 }]] },
      // multi-group: solid letter body MINUS a sparse bubble field → cellular
      // holes ("roe"). Keep particles few/small so the glyph stays readable.
      'Frog-eggs': {
        safe: false, groups: [
          { blend: 'union', layers: [['dilate', { amount: 2 }], ['blur', { radius: 2 }], ['threshold', { level: 45 }]] },
          { blend: 'subtract', layers: [['particles', { count: 90, size: 3, spread: 7, seed: 5, body: 0 }]] },
        ]
      },
      'Coral': { fx: [['dilate', { amount: 3 }], ['reaction', { feed: 55, kill: 62, iters: 18, depth: 90, seed: 5 }]] },

      // ── styles echoing Ivan Murit's production examples ──
      // cahn hiliard: thin outline with a cellular texture inside
      'Cahn cells': {
        outline: true, groups: [
          { blend: 'union', layers: [['dilate', { amount: 1 }], ['blur', { radius: 1 }], ['threshold', { level: 50 }]] },
          { blend: 'subtract', layers: [['particles', { count: 150, size: 2, spread: 6, seed: 9, body: 0 }]] },
        ]
      },
      // Clear_LivingPath cahn: bolder outline, coarser cells
      'Cahn bold': {
        outline: true, groups: [
          { blend: 'union', layers: [['dilate', { amount: 3 }], ['blur', { radius: 2 }], ['threshold', { level: 46 }]] },
          { blend: 'subtract', layers: [['particles', { count: 110, size: 3, spread: 8, seed: 4, body: 0 }]] },
        ]
      },
      // LivingPath-com: beaded / dotted outline (frog-eggs, stroked)
      'Beaded': {
        outline: true, groups: [
          { blend: 'union', layers: [['dilate', { amount: 2 }], ['blur', { radius: 2 }], ['threshold', { level: 45 }]] },
          { blend: 'subtract', layers: [['particles', { count: 70, size: 3, spread: 8, seed: 5, body: 0 }]] },
        ]
      },
      // LivingPath-dilated-line: clean bold outline, minimal texture
      'Dilated': { outline: true, fx: [['dilate', { amount: 3 }], ['blur', { radius: 2 }], ['threshold', { level: 44 }]] },
      // hillard bold: solid bold letters, rough speckled edge
      'Rough bold': { fx: [['dilate', { amount: 2 }], ['noise', { amount: 38, scale: 5, seed: 11 }], ['threshold', { level: 55 }]] },
      // random1: low-res dotted / pixel-dust texture
      'Pixel dust': {
        groups: [
          { blend: 'union', layers: [['dilate', { amount: 1 }]] },
          { blend: 'multiply', layers: [['particles', { count: 520, size: 2, spread: 2, seed: 7, body: 0 }], ['blur', { radius: 1 }]] },
        ]
      },
      // LivingPath-test: exploded particle fragments
      'Exploded': { fx: [['particles', { count: 220, size: 5, spread: 16, seed: 5, body: 1 }], ['blur', { radius: 1 }], ['threshold', { level: 44 }]] },

      // ── styles from production sheet (2) ──
      // Dotty_lineal-Bold: bold outline packed with dense small dots
      'Dotty bold': {
        outline: true, groups: [
          { blend: 'union', layers: [['dilate', { amount: 3 }], ['blur', { radius: 1 }], ['threshold', { level: 48 }]] },
          { blend: 'subtract', layers: [['particles', { count: 300, size: 2, spread: 3, seed: 6, body: 0 }]] },
        ]
      },
      // Dotty_lineal-Light: thin outline, sparse dots
      'Dotty light': {
        outline: true, groups: [
          { blend: 'union', layers: [['blur', { radius: 1 }], ['threshold', { level: 56 }]] },
          { blend: 'subtract', layers: [['particles', { count: 130, size: 2, spread: 6, seed: 3, body: 0 }]] },
        ]
      },
      // LivingPath-light: thin clean outline (eroded body)
      'Thin line': { outline: true, fx: [['dilate', { amount: -1 }], ['blur', { radius: 1 }], ['threshold', { level: 55 }]] },
      // Sin-out: solid bold letters with big chunks bitten out
      'Sliced': {
        groups: [
          { blend: 'union', layers: [['dilate', { amount: 2 }], ['blur', { radius: 2 }], ['threshold', { level: 44 }]] },
          { blend: 'subtract', layers: [['particles', { count: 14, size: 13, spread: 11, seed: 8, body: 0 }]] },
        ]
      },
      // gridouille: dense rough speckle over a bold body
      'Gridouille': { fx: [['dilate', { amount: 2 }], ['noise', { amount: 55, scale: 4, seed: 9 }], ['threshold', { level: 52 }]] },
      // 34567: faceted / low-poly outline (polygonize + no contour smoothing)
      'Faceted': { outline: true, smooth: 0, fx: [['dilate', { amount: 1 }], ['polygonize', { block: 9 }]] },
      // faceted solid fill variant
      'Low-poly': { smooth: 0, fx: [['dilate', { amount: 2 }], ['polygonize', { block: 11 }]] },
      // Sin-out: bold letters sliced/pinched by content-aware seam carving
      'Sin-out': { fx: [['dilate', { amount: 2 }], ['blur', { radius: 1 }], ['threshold', { level: 48 }], ['seam', { count: 34, dir: 0 }]] },
      'Sin-vert': { fx: [['dilate', { amount: 2 }], ['blur', { radius: 1 }], ['threshold', { level: 48 }], ['seam', { count: 34, dir: 1 }]] },
    },
  };

  Organica.pathfx = {
    // path model
    cubicPts, quadPts, fromSVGString, bboxOf, normalise, dFromSubs,
    // effects
    FX, RFX,
    // raster pipeline
    RES, rasterize, morph, boxBlur, addNoise, grayScott, particles, skeleton,
    seamCarve, polygonize, contours, smoothPoly, rasterFieldToSubs,
    // groups/blend appliers
    blendField, rasterFieldFromGroups, applyVectorGroups,
    // presets
    PRESETS,
    // internal knobs
    setSeedOffset, getSeedOffset, setContourSmooth, getContourSmooth,
  };
})(window);
