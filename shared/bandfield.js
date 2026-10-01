/* ─────────────────────────────────────────────────────────────────────────────
 * bandfield.js — Organica.bandField: animate a tone-band SVG export.
 *
 * Warping and Komorebi export the same shape of SVG: one full-canvas <rect>
 * (the lightest/darkest ground) plus N-1 cumulative fill-rule="evenodd"
 * <path>s of straight-segment (M/L/Z) boundaries, one per tone band, painted
 * in order. This module parses that file, turns every boundary into a closed
 * polyline, and moves the vertices with ONE time-varying displacement field,
 * so the stacked bands keep nesting (no gaps) while their edges flow.
 *
 *   const model = Organica.bandField.parse(svgText, {expect:'warping'});
 *   const bf = Organica.bandField.create({ model, params });
 *   bf.advance(t);               // t in seconds — a PURE function of t
 *   bf.draw(ctx);                // in source units; the caller sets the transform
 *
 * LOOPING IS BY CONSTRUCTION, not by pre-rolling: there is no integrated state.
 * Every term of the field is periodic in phase a = 2π·t/loop·cycles (cycles is
 * a whole number), and the noise terms travel on a CIRCLE through the noise
 * plane (the same trick as shared/swarm.js), so frame t ≡ frame t+loop exactly.
 *
 * Cost model: the field is evaluated on a coarse lattice (LATTICE nodes along
 * the long edge) and bilinearly sampled per vertex, so noise evaluations do
 * not scale with vertex count. The vertex budget (BUDGET) is set by the
 * evenodd fill, which is the real per-frame cost.
 *
 * The rest state is the source SVG: with amp = 0, smooth = 0 the first frame is
 * the file's own geometry (subdivision only adds collinear points).
 *
 * DOM: parse() uses DOMParser; the rest is pure. LOAD ORDER: after core.js and
 * noise.js. Manuals: docs/UNDERTOW.md, docs/DAPPLE.md.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  const TAU = Math.PI * 2;
  const BUDGET = 120000;      // vertices after subdivision — the evenodd fill is the limit
  const RAW_LIMIT = 220000;   // a file with more raw corners than this is refused, not thinned
  const LATTICE = 144;        // field nodes along the long edge
  const MARK_TOOLS = { pollen: 'Pollen', spore: 'Spore', halide: 'Halide' };

  // ═══════════════ parse: SVG text → bands of closed polylines ═══════════════
  function parsePath(d) {
    if (/[CcSsQqTtAa]/.test(d)) throw new Error('This SVG has curved paths — band exports are straight-segment (M/L/Z) only.');
    const tok = d.match(/[MmLlHhVvZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
    const loops = [];
    let cur = [], x = 0, y = 0, sx = 0, sy = 0, cmd = '', i = 0;
    const flush = () => { if (cur.length >= 6) loops.push(Float32Array.from(cur)); cur = []; };
    const num = () => parseFloat(tok[i++]);
    while (i < tok.length) {
      if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
      else if (cmd === 'M') cmd = 'L'; else if (cmd === 'm') cmd = 'l';   // implicit lineto after a moveto
      switch (cmd) {
        case 'M': case 'm': flush(); { const a = num(), b = num(); x = cmd === 'm' ? x + a : a; y = cmd === 'm' ? y + b : b; } sx = x; sy = y; cur.push(x, y); break;
        case 'L': case 'l': { const a = num(), b = num(); x = cmd === 'l' ? x + a : a; y = cmd === 'l' ? y + b : b; } cur.push(x, y); break;
        case 'H': case 'h': { const a = num(); x = cmd === 'h' ? x + a : a; } cur.push(x, y); break;
        case 'V': case 'v': { const b = num(); y = cmd === 'v' ? y + b : b; } cur.push(x, y); break;
        case 'Z': case 'z': flush(); x = sx; y = sy; break;
        default: i++;
      }
    }
    flush();
    return loops;
  }

  function parse(text, opts) {
    opts = opts || {};
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('That file is not a valid SVG.');
    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== 'svg') throw new Error('That file is not an SVG.');
    // size: viewBox in source units; refuse Print-mode files (physical units — no screen geometry)
    const wAttr = root.getAttribute('width') || '';
    if (/(mm|cm|in|pt|pc)\s*$/i.test(wAttr)) throw new Error('Print-mode SVGs (mm/cm/in) can’t be animated — export in Screen mode.');
    let W, H;
    const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) { W = vb[2]; H = vb[3]; }
    else { W = parseFloat(wAttr); H = parseFloat(root.getAttribute('height')); }
    if (!(W > 0 && H > 0)) throw new Error('The SVG has no usable size (viewBox or width/height).');

    let meta = null;
    const m = root.querySelector('metadata#organica, metadata');
    if (m) { try { meta = JSON.parse(m.textContent); } catch (e) { meta = null; } }
    const markTool = meta && MARK_TOOLS[meta.tool];
    const isMarks = markTool || root.querySelector('circle, ellipse, use, image, text, polygon, polyline, line, g[transform], symbol') || root.querySelectorAll('rect').length > 1;
    if (isMarks) throw new Error('This is a mark export' + (markTool ? ' from ' + markTool : '') + ' (separate dots / rectangles) — open it in Murmur. This tool animates tone-band exports from ' + (opts.expectName || 'Warping or Komorebi') + '.');
    if (opts.expect && meta && meta.tool && meta.tool !== opts.expect && /^(warping|komorebi)$/.test(meta.tool)) {
      throw new Error('This is a ' + meta.tool[0].toUpperCase() + meta.tool.slice(1) + ' export — open it in its own animator (Warping → Undertow, Komorebi → Dapple).');
    }

    let bg = '#ffffff';
    const rect = root.querySelector('rect');
    if (rect && rect.getAttribute('fill')) bg = rect.getAttribute('fill');
    const bands = [];
    let raw = 0;
    root.querySelectorAll('path').forEach(p => {
      const loops = parsePath(p.getAttribute('d') || '');
      if (!loops.length) return;
      loops.forEach(l => { raw += l.length / 2; });
      bands.push({ fill: p.getAttribute('fill') || '#000000', loops });
    });
    if (!bands.length) throw new Error('No tone-band paths found — this doesn’t look like a Warping or Komorebi export.');
    if (raw > RAW_LIMIT) throw new Error('This SVG is too detailed to animate smoothly (' + raw.toLocaleString() + ' boundary points; limit ' + RAW_LIMIT.toLocaleString() + '). Export fewer bands or a lower detail.');
    return { W, H, bg, bands, meta, raw };
  }

  // ═══════════════ prepare: subdivide + smooth ═══════════════
  // A staircase boundary has long straight edges whose only vertices are their
  // ends; displacing just those would shear them. Edges are cut to ≤ maxSeg
  // (raised automatically until the total fits BUDGET); smoothing is a
  // 1-2-1 Laplacian along each closed loop (rounds the staircase, shrinks
  // a loop very slightly — so the rest frame equals the source only at smooth 0).
  function prepare(model, o) {
    const M = Math.max(model.W, model.H);
    let seg = M / (200 * Math.max(0.25, o.detail || 1));
    const seg0 = seg;
    const count = s => {
      let n = 0;
      model.bands.forEach(b => b.loops.forEach(l => {
        const k = l.length / 2;
        for (let i = 0; i < k; i++) {
          const j = (i + 1) % k, d = Math.hypot(l[j * 2] - l[i * 2], l[j * 2 + 1] - l[i * 2 + 1]);
          n += Math.max(1, Math.ceil(d / s));
        }
      }));
      return n;
    };
    let total = count(seg);
    for (let g = 0; total > BUDGET && g < 60; g++) { seg *= 1.2; total = count(seg); }
    const passes = Math.max(0, Math.round(o.smooth || 0));
    const bands = model.bands.map(b => ({
      fill: b.fill,
      loops: b.loops.map(l => {
        const k = l.length / 2, out = [];
        for (let i = 0; i < k; i++) {
          const j = (i + 1) % k, x0 = l[i * 2], y0 = l[i * 2 + 1], x1 = l[j * 2], y1 = l[j * 2 + 1];
          const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / seg));
          for (let s = 0; s < n; s++) out.push(x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n);
        }
        let a = Float32Array.from(out);
        for (let p = 0; p < passes; p++) {
          const n = a.length / 2, b2 = new Float32Array(a.length);
          for (let i = 0; i < n; i++) {
            const pI = ((i + n - 1) % n) * 2, nI = ((i + 1) % n) * 2, c = i * 2;
            b2[c] = (a[pI] + 2 * a[c] + a[nI]) / 4; b2[c + 1] = (a[pI + 1] + 2 * a[c + 1] + a[nI + 1]) / 4;
          }
          a = b2;
        }
        return a;
      }),
    }));
    let n = 0; bands.forEach(b => b.loops.forEach(l => { n += l.length / 2; }));
    return { W: model.W, H: model.H, bg: model.bg, bands, vertices: n, seg, thinned: seg > seg0 };
  }

  // ═══════════════ the field ═══════════════
  const DEFAULTS = {
    amp: 14,         // displacement scale, in px of a 1200-unit canvas (scaled to the source)
    cycles: 1,       // whole cycles of every periodic term per loop
    scale: 1.4,      // spatial frequency of the flow noise (features across the long edge)
    loop: 8,         // seconds per loop (whole cycles snap to it)
    flow: 1,         // noise flow (the contours drift)
    wave: 0,         // a travelling transverse wave
    waveLen: 0.35,   // wavelength, fraction of the long edge
    waveAngle: 0,    // wave direction, degrees
    swirl: 0,        // rotate the field about the centre
    breathe: 0,      // scale about the centre, rippling outward
    rustle: 0,       // fine, fast shimmer
    stagger: 0,      // per-band phase lag (layers slide against each other)
    flicker: 0,      // per-band alpha pulse (light that comes and goes)
    smooth: 0,       // rounds the staircase (rebuilds geometry)
    detail: 1,       // subdivision density (rebuilds geometry)
  };
  const REBUILD = ['smooth', 'detail'];

  const SCHEMA = [
    { title: 'Motion', hint: 'how far, how fast', controls: [
      { key: 'amp', label: 'Amplitude', min: 0, max: 60, step: 0.5 },
      { key: 'cycles', label: 'Cycles', min: 1, max: 6, step: 1 },
      { key: 'scale', label: 'Scale', min: 0.2, max: 6, step: 0.05 },
    ]},
    { title: 'Fields', hint: 'what moves the edges', controls: [
      { key: 'flow', label: 'Flow', min: 0, max: 1, step: 0.01 },
      { key: 'wave', label: 'Wave', min: 0, max: 1, step: 0.01 },
      { key: 'waveLen', label: 'Wavelength', min: 0.08, max: 1.2, step: 0.01 },
      { key: 'waveAngle', label: 'Wave angle', min: 0, max: 180, step: 1 },
      { key: 'swirl', label: 'Swirl', min: 0, max: 1, step: 0.01 },
      { key: 'breathe', label: 'Breathe', min: 0, max: 1, step: 0.01 },
      { key: 'rustle', label: 'Rustle', min: 0, max: 1, step: 0.01 },
    ]},
    { title: 'Layers', hint: 'band against band', controls: [
      { key: 'stagger', label: 'Stagger', min: 0, max: 1, step: 0.01 },
      { key: 'flicker', label: 'Flicker', min: 0, max: 1, step: 0.01 },
    ]},
    { title: 'Edge', hint: 'geometry', controls: [
      { key: 'smooth', label: 'Smooth', min: 0, max: 8, step: 1 },
      { key: 'detail', label: 'Detail', min: 0.5, max: 3, step: 0.25 },
    ]},
  ];

  function create(cfg) {
    const model = cfg.model;
    let P = Object.assign({}, DEFAULTS, cfg.params);
    let prep = prepare(model, P);
    const W = model.W, H = model.H, M = Math.max(W, H);
    const GX = Math.max(8, Math.round(W >= H ? LATTICE : LATTICE * W / H));
    const GY = Math.max(8, Math.round(W >= H ? LATTICE * H / W : LATTICE));
    const cw = W / (GX - 1), ch = H / (GY - 1);
    const nBands = prep.bands.length;
    const lat = [];                      // one lattice (2 floats/node) per phase lag
    const makeOut = () => prep.bands.map(b => b.loops.map(l => new Float32Array(l.length)));
    let out = makeOut();
    let ph = 0, time = 0;                // phase of the base lattice
    const N = global.Organica.noise;

    function fieldInto(f, a, unit) {
      const cyc = Math.max(1, Math.round(P.cycles));
      const A = P.amp * unit, aa = a * cyc;
      const fl = P.flow, wv = P.wave, sw = P.swirl, br = P.breathe, ru = P.rustle;
      const fs = P.scale, rr = 0.55;
      const th = P.waveAngle * Math.PI / 180, dirX = Math.cos(th), dirY = Math.sin(th);
      const k = TAU / Math.max(0.05, P.waveLen);
      const cx0 = W / 2, cy0 = H / 2, half = M / 2;
      const ca = Math.cos(aa), sa = Math.sin(aa);
      const ca2 = Math.cos(a * (cyc + 2)), sa2 = Math.sin(a * (cyc + 2));
      let o = 0;
      for (let j = 0; j < GY; j++) {
        const y = j * ch, v = y / M;
        for (let i = 0; i < GX; i++, o += 2) {
          const x = i * cw, u = x / M;
          let dx = 0, dy = 0;
          if (fl > 0) {
            const nx = u * fs, ny = v * fs;
            dx += N.simplex2(nx + rr * ca, ny + rr * sa) * A * fl;
            dy += N.simplex2(nx + 37.1 + rr * Math.cos(aa + 1.7), ny + 11.3 + rr * Math.sin(aa + 1.7)) * A * fl;
          }
          if (wv > 0) {
            const s = Math.sin(k * (u * dirX + v * dirY) - aa) * A * wv;
            dx += -dirY * s; dy += dirX * s;
          }
          if (sw > 0 || br > 0) {
            const rx = x - cx0, ry = y - cy0, r = Math.hypot(rx, ry) / half;
            if (sw > 0) {
              const ang = sw * 0.6 * sa * Math.exp(-r * r * 1.5), c = Math.cos(ang), s = Math.sin(ang);
              dx += rx * c - ry * s - rx; dy += rx * s + ry * c - ry;
            }
            if (br > 0) {
              const sc = br * 0.08 * Math.sin(aa - r * 2.2);
              dx += rx * sc; dy += ry * sc;
            }
          }
          if (ru > 0) {
            const nx = u * fs * 5, ny = v * fs * 5;
            dx += N.simplex2(nx + 0.8 * ca2, ny + 0.8 * sa2) * A * 0.22 * ru;
            dy += N.simplex2(nx + 71.7 + 0.8 * sa2, ny + 5.9 + 0.8 * ca2) * A * 0.22 * ru;
          }
          f[o] = dx; f[o + 1] = dy;
        }
      }
    }

    const eps = M * 0.001;
    function displace(src, dst, f) {
      for (let i = 0, n = src.length; i < n; i += 2) {
        let gx = src[i] / cw, gy = src[i + 1] / ch;
        if (gx < 0) gx = 0; else if (gx > GX - 1.0001) gx = GX - 1.0001;
        if (gy < 0) gy = 0; else if (gy > GY - 1.0001) gy = GY - 1.0001;
        const ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy;
        const o = (iy * GX + ix) * 2, o2 = o + GX * 2;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        let dx = f[o] * w00 + f[o + 2] * w10 + f[o2] * w01 + f[o2 + 2] * w11;
        let dy = f[o + 1] * w00 + f[o + 3] * w10 + f[o2 + 1] * w01 + f[o2 + 3] * w11;
        // a vertex on the canvas border stays ON it (it may slide along it) — otherwise
        // the full-canvas band pulls in from the edge and exposes the ground rect
        const x = src[i], y = src[i + 1];
        if (x <= eps || x >= W - eps) dx = 0;
        if (y <= eps || y >= H - eps) dy = 0;
        dst[i] = x + dx; dst[i + 1] = y + dy;
      }
    }

    function advance(t) {
      time = t;
      const L = Math.max(1, P.loop);
      ph = TAU * (t / L);
      const unit = M / 1200;
      const lagged = P.stagger > 0.001 && nBands > 1;
      const need = lagged ? nBands : 1;
      for (let b = 0; b < need; b++) {
        if (!lat[b]) lat[b] = new Float32Array(GX * GY * 2);
        // band b lags the base phase by a fraction of a whole turn — still periodic in the loop
        fieldInto(lat[b], ph - (lagged ? P.stagger * TAU * b / nBands : 0), unit);
      }
      for (let b = 0; b < nBands; b++) {
        const f = lat[lagged ? b : 0];
        prep.bands[b].loops.forEach((l, i) => displace(l, out[b][i], f));
      }
    }

    function draw(ctx) {
      ctx.fillStyle = prep.bg;
      ctx.fillRect(0, 0, W, H);
      for (let b = 0; b < nBands; b++) {
        ctx.beginPath();
        const loops = out[b];
        for (let li = 0; li < loops.length; li++) {
          const a = loops[li], n = a.length;
          ctx.moveTo(a[0], a[1]);
          for (let i = 2; i < n; i += 2) ctx.lineTo(a[i], a[i + 1]);
          // no closePath(): fill() closes every subpath itself, and closePath() costs ~12µs PER subpath
          // in Chrome (measured: 3,120 loops = 37 ms with it, 0.3 ms without)
        }
        ctx.fillStyle = prep.bands[b].fill;
        ctx.globalAlpha = P.flicker > 0 ? 1 - P.flicker * 0.55 * (0.5 + 0.5 * Math.sin(Math.max(1, Math.round(P.cycles)) * ph + b * 2.1)) : 1;
        ctx.fill('evenodd');
      }
      ctx.globalAlpha = 1;
    }

    function setParams(p) {
      const before = REBUILD.map(k => P[k]);
      P = Object.assign({}, P, p);
      if (REBUILD.some((k, i) => P[k] !== before[i])) {
        prep = prepare(model, P);
        out = makeOut();
      }
      advance(time);
    }
    advance(0);
    return {
      advance, draw, setParams,
      get params() { return P; },
      get vertices() { return prep.vertices; },
      get thinned() { return prep.thinned; },
      get bandCount() { return nBands; },
      W, H, bg: model.bg,
    };
  }

  // ═══════════════ panel (the one DOM helper) + diff ═══════════════
  function panel(target, params, onChange, idPrefix) {
    const pre = idPrefix || 'bf-', doc = target.ownerDocument, rows = [];
    const fmt = (c, v) => (c.step >= 1 ? String(Math.round(v)) : String(+(+v).toFixed(c.step < 0.01 ? 3 : 2)));
    SCHEMA.forEach(g => {
      const sec = doc.createElement('div');
      sec.className = 'panel-section';
      sec.innerHTML = '<h3>' + g.title + ' <span class="hint">' + g.hint + '</span></h3>';
      g.controls.forEach(c => {
        const id = pre + c.key, row = doc.createElement('div');
        row.className = 'ctrl-row';
        row.innerHTML = '<label class="ctrl-label" for="' + id + '">' + c.label + '</label>' +
          '<input type="range" id="' + id + '" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '"><span class="ctrl-val"></span>';
        const el = row.querySelector('input'), out = row.querySelector('.ctrl-val');
        el.addEventListener('input', () => { out.textContent = fmt(c, el.value); onChange(c.key, parseFloat(el.value)); });
        rows.push(p => { el.value = p[c.key]; out.textContent = fmt(c, p[c.key]); });
        sec.appendChild(row);
      });
      target.appendChild(sec);
    });
    const api = { sync(p) { rows.forEach(r => r(p)); } };
    api.sync(params);
    return api;
  }
  function diff(p) {
    const o = {};
    Object.keys(DEFAULTS).forEach(k => { if (k !== 'loop' && p[k] !== DEFAULTS[k]) o[k] = p[k]; });
    return o;
  }

  // ═══════════════ preset thumbnails ═══════════════
  // A square 80px PNG drawn by the REAL engine on a small synthetic model (three
  // nested wobbly bands): the source outline in a hairline, the displaced
  // bands a quarter-loop in. Amplitude is exaggerated (×4) so the motion reads
  // at 40px, like Murmur's trajectory thumbnails.
  const THUMB_PALETTES = {
    warm:  { bg: '#f5f2ec', fills: ['#e8d3ab', '#a9683e', '#3c2a1c'], line: '#3c2a1c' },
    leaf:  { bg: '#10140f', fills: ['#2c3a22', '#6b8a45', '#e9efc2'], line: '#e9efc2' },
  };
  const sampleModels = {};
  function sampleModel(kind) {
    if (sampleModels[kind]) return sampleModels[kind];
    const pal = THUMB_PALETTES[kind] || THUMB_PALETTES.warm, S = 120;
    const ring = (R, ph) => {
      const pts = [];
      for (let i = 0; i < 96; i++) { const a = i / 96 * TAU, r = R * (1 + 0.12 * Math.sin(3 * a + ph) + 0.07 * Math.sin(5 * a + 1 + ph)); pts.push(S / 2 + r * Math.cos(a), S / 2 + r * Math.sin(a)); }
      return Float32Array.from(pts);
    };
    return (sampleModels[kind] = { W: S, H: S, bg: pal.bg, raw: 0, meta: null,
      bands: [{ fill: pal.fills[0], loops: [ring(54, 0)] }, { fill: pal.fills[1], loops: [ring(38, 1.3)] }, { fill: pal.fills[2], loops: [ring(20, 2.4)] }] });
  }
  function thumb(params, kind) {
    const m = sampleModel(kind), pal = THUMB_PALETTES[kind] || THUMB_PALETTES.warm;
    const P = Object.assign({}, DEFAULTS, params, { amp: (params.amp != null ? params.amp : DEFAULTS.amp) * 4, loop: 8, detail: 2 });
    const bf = create({ model: m, params: P });
    bf.advance(8 * 0.25);
    const c = document.createElement('canvas'); c.width = c.height = 80;
    const g = c.getContext('2d'); g.setTransform(80 / 120, 0, 0, 80 / 120, 0, 0);
    bf.draw(g);
    g.strokeStyle = pal.line; g.globalAlpha = 0.35; g.lineWidth = 0.7;
    m.bands.forEach(b => { b.loops.forEach(l => { g.beginPath(); g.moveTo(l[0], l[1]); for (let i = 2; i < l.length; i += 2) g.lineTo(l[i], l[i + 1]); g.closePath(); g.stroke(); }); });
    return c.toDataURL('image/png');
  }

  Organica.bandField = { parse, prepare, create, panel, diff, thumb, DEFAULTS, SCHEMA, BUDGET, LATTICE };
})(typeof window !== 'undefined' ? window : this);
