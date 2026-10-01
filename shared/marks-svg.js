/* ─────────────────────────────────────────────────────────────────────────────
 * marks-svg.js — Organica.marksSVG: a Pollen / Spore / Halide SVG export → marks.
 *
 * Extracted from murmur/index.html (Oct 1, 2026) at the gallery's arrival — the
 * second consumer — verbatim, so Murmur's behaviour is unchanged (checked by a
 * fingerprint of the parse output on real exports before and after the move).
 *
 *   const s = Organica.marksSVG.parse(svgText, { maxMarks: 100000 });
 *   // → { W, H, tool, bg, count, styles, homes: { hx, hy, r, angle, style, geo } }
 *   // feed styles/homes straight into Organica.swarm.create({homes, styles, W, H, …})
 *
 * Pure parsing, no layout: a transform parser, a path-extent parser and a paint
 * resolver. Every transformed <g> (Pollen / Spore: one per mark) is decomposed
 * into position · angle · scale (· aspect) around its own centre; its inner
 * geometry becomes Path2Ds shared by every mark with the same shape. Halide's
 * rects are split back into its dither cells. Tone-band exports (Warping /
 * Komorebi) are refused with a pointer to their own animators.
 *
 * DOM: DOMParser + a 2D canvas context (colour canonicaliser, Halide "Simplify").
 * LOAD ORDER: after core.js; before the tool script. Manual: docs/MURMUR.md.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
  const nums = s => (String(s || '').match(NUM) || []).map(Number);
  const ID = [1, 0, 0, 1, 0, 0];
  function mul(A, B) {
    return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1],
            A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3],
            A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  }
  const apply = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
  function parseTransform(str) {
    let M = ID;
    if (!str) return M;
    const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
    let m;
    while ((m = re.exec(str))) {
      const v = nums(m[2]);
      let T = ID;
      if (m[1] === 'matrix' && v.length === 6) T = v;
      else if (m[1] === 'translate') T = [1, 0, 0, 1, v[0] || 0, v[1] || 0];
      else if (m[1] === 'scale') T = [v[0], 0, 0, v.length > 1 ? v[1] : v[0], 0, 0];
      else if (m[1] === 'rotate') {
        const a = (v[0] || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        T = [c, s, -s, c, 0, 0];
        if (v.length === 3) T = mul(mul([1, 0, 0, 1, v[1], v[2]], T), [1, 0, 0, 1, -v[1], -v[2]]);
      }
      else if (m[1] === 'skewX') T = [1, 0, Math.tan(v[0] * Math.PI / 180), 1, 0, 0];
      else if (m[1] === 'skewY') T = [1, Math.tan(v[0] * Math.PI / 180), 0, 1, 0, 0];
      M = mul(M, T);
    }
    return M;
  }

  // Extent of a path's d (end + control points — plenty for a centre).
  const TOK = /[a-df-zA-DF-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;
  const ARGS = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7 };
  function pathPoints(d, add) {
    const tk = d.match(TOK) || [];
    let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
    const isCmd = t => /^[a-zA-Z]$/.test(t);
    while (i < tk.length) {
      if (isCmd(tk[i])) cmd = tk[i++];
      const C = cmd.toUpperCase(), rel = cmd !== C;
      if (C === 'Z') { x = sx; y = sy; if (i < tk.length && !isCmd(tk[i])) i++; continue; }
      const n = ARGS[C];
      if (!n || i + n > tk.length) break;
      const v = [];
      for (let k = 0; k < n; k++) { if (isCmd(tk[i])) return; v.push(+tk[i++]); }
      if (C === 'H') { x = rel ? x + v[0] : v[0]; add(x, y); }
      else if (C === 'V') { y = rel ? y + v[0] : v[0]; add(x, y); }
      else if (C === 'A') { x = rel ? x + v[5] : v[5]; y = rel ? y + v[6] : v[6]; add(x, y); }
      else {
        const x0 = x, y0 = y;
        for (let k = 0; k < n; k += 2) { const px = rel ? x0 + v[k] : v[k], py = rel ? y0 + v[k + 1] : v[k + 1]; add(px, py); x = px; y = py; }
        if (C === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
      }
    }
  }

  // One drawable element → { d, pts } in its own coords, or null.
  function elGeom(el) {
    const t = el.localName, a = k => parseFloat(el.getAttribute(k)) || 0;
    const pts = [];
    if (t === 'circle' || t === 'ellipse') {
      const cx = a('cx'), cy = a('cy'), rx = t === 'circle' ? a('r') : a('rx'), ry = t === 'circle' ? a('r') : a('ry');
      if (!(rx > 0) || !(ry > 0)) return null;
      pts.push([cx - rx, cy - ry], [cx + rx, cy + ry]);
      return { d: `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`, pts,
               circle: rx === ry ? rx : 0, ell: [cx, cy, rx, ry] };
    }
    if (t === 'rect') {
      const x = a('x'), y = a('y'), w = a('width'), h = a('height');
      if (!(w > 0) || !(h > 0)) return null;
      pts.push([x, y], [x + w, y + h]);
      return { d: `M${x} ${y}h${w}v${h}h${-w}Z`, pts };
    }
    if (t === 'line') {
      pts.push([a('x1'), a('y1')], [a('x2'), a('y2')]);
      return { d: `M${a('x1')} ${a('y1')}L${a('x2')} ${a('y2')}`, pts };
    }
    if (t === 'polygon' || t === 'polyline') {
      const v = nums(el.getAttribute('points'));
      if (v.length < 4) return null;
      for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]]);
      return { d: 'M' + v.join(' ') + (t === 'polygon' ? 'Z' : ''), pts };
    }
    if (t === 'path') {
      const d = el.getAttribute('d');
      if (!d) return null;
      pathPoints(d, (x, y) => pts.push([x, y]));
      return pts.length ? { d, pts } : null;
    }
    return null;
  }
  const DRAWABLE = new Set(['circle', 'ellipse', 'rect', 'line', 'polygon', 'polyline', 'path']);
  const SKIP = new Set(['metadata', 'title', 'desc', 'defs', 'style', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'pattern', 'symbol', 'script']);

  // Paint inheritance. `var(--ink)` / `inherit` (Genesis forms) → inherit.
  const PAINT_KEYS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule'];
  function readPaint(el, inh) {
    const o = Object.assign({}, inh);
    const style = {};
    (el.getAttribute('style') || '').split(';').forEach(kv => { const i = kv.indexOf(':'); if (i > 0) style[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
    PAINT_KEYS.forEach(k => {
      const v = style[k] != null ? style[k] : el.getAttribute(k);
      if (v == null || v === '' || /var\(|inherit/.test(v)) return;
      o[k] = v === 'currentColor' ? inh.fill : v;
    });
    const op = parseFloat(style.opacity != null ? style.opacity : el.getAttribute('opacity'));
    if (!isNaN(op)) o.opacity = (inh.opacity == null ? 1 : inh.opacity) * op;
    return o;
  }

  // Colour canonicaliser (+ optional quantiser when a file has too many colours).
  const _cc = document.createElement('canvas').getContext('2d');
  const colourCache = new Map();
  let quantize = false;
  function colour(c) {
    if (!c || c === 'none' || c === 'transparent') return null;
    const key = c + (quantize ? '|q' : '');
    if (colourCache.has(key)) return colourCache.get(key);
    _cc.fillStyle = '#000'; _cc.fillStyle = c;
    let out = _cc.fillStyle;
    if (quantize && out[0] === '#') {
      const q = h => Math.min(255, Math.round(parseInt(h, 16) / 17) * 17).toString(16).padStart(2, '0');
      out = '#' + q(out.slice(1, 3)) + q(out.slice(3, 5)) + q(out.slice(5, 7));
    }
    colourCache.set(key, out);
    return out;
  }

  function parse(text, opts) {
    const MAX_MARKS = (opts && opts.maxMarks) || 100000;
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length) throw new Error('Not a valid SVG file.');
    if (/(mm|cm|in)\s*$/.test(root.getAttribute('width') || '')) throw new Error('This looks like a Print-mode export (physical units). Export in Screen mode and drop that file.');
    let meta = {};
    const mEl = root.querySelector('metadata#organica, metadata');
    if (mEl) { try { meta = JSON.parse(mEl.textContent) || {}; } catch (e) { meta = {}; } }

    // Tone-band exports (stacked evenodd paths, not marks) have their own animators.
    const BAND_TWINS = { warping: ['Warping', 'Undertow', '/undertow/'], komorebi: ['Komorebi', 'Dapple', '/dapple/'] };
    if (BAND_TWINS[meta.tool]) { const t = BAND_TWINS[meta.tool]; throw new Error(`This is a ${t[0]} export (tone bands, not marks) — open it in ${t[1]} (${t[2]}), which animates it.`); }

    const vb = nums(root.getAttribute('viewBox'));
    const W = vb.length === 4 ? vb[2] : parseFloat(root.getAttribute('width')) || 0;
    const H = vb.length === 4 ? vb[3] : parseFloat(root.getAttribute('height')) || 0;
    if (!(W > 0 && H > 0)) throw new Error('The SVG has no size (viewBox or width/height).');
    const R0 = vb.length === 4 ? [1, 0, 0, 1, -vb[0], -vb[1]] : ID;

    const uniq = new Set();
    root.querySelectorAll('[fill],[stroke]').forEach(e => { uniq.add(e.getAttribute('fill')); uniq.add(e.getAttribute('stroke')); });
    quantize = uniq.size > 256;

    // Detect the source when the file predates <metadata>.
    let tool = meta.tool;
    if (!tool) {
      const rects = root.getElementsByTagName('rect').length, gs = root.querySelectorAll('g[transform]').length;
      tool = root.querySelector('use') ? 'spore'            // older Spore exports: <symbol> + <use>
        : rects > gs * 2 && rects > 20 ? 'halide' : gs ? (root.querySelector('g[transform] > g') ? 'spore' : 'pollen') : 'pollen';
      tool = tool + '?';   // heuristic — shown as such
    }
    const isHalide = tool.startsWith('halide');

    const hx = [], hy = [], rr = [], ang = [], sty = [], geo = [];
    const styles = [], styleIx = new Map(), shapeCache = new Map();
    let bg = null, count = 0;
    const paper = meta.paper ? colour(meta.paper) : null;
    function styleOf(key, make) {
      let i = styleIx.get(key);
      if (i == null) { i = styles.length; styles.push(make()); styleIx.set(key, i); }
      return i;
    }
    function guard(add) { count += add; if (count > MAX_MARKS) throw new Error(`Too many marks (${count.toLocaleString()}+, the cap is ${MAX_MARKS.toLocaleString()}). Export with fewer points / a lower resolution.`); }
    function push(x, y, r, a, s, g) { hx.push(x); hy.push(y); rr.push(r); ang.push(a); sty.push(s); geo.push(g || null); }

    // ── Halide: cells ──
    let block = +meta.block || 0;
    if (isHalide && !block) {
      let mn = Infinity;
      root.querySelectorAll('rect').forEach(r => { const w = parseFloat(r.getAttribute('width')), h = parseFloat(r.getAttribute('height')); if (w > 0 && w < W) mn = Math.min(mn, w); if (h > 0 && h < H) mn = Math.min(mn, h); });
      block = isFinite(mn) ? mn : 4;
    }
    function halideCells(el, M, paint) {
      const c = colour(paint.fill && paint.fill !== 'none' ? paint.fill : paint.stroke);
      if (!c || c === paper || c === bg) return;
      const si = styleOf('sq|' + c, () => ({ kind: 'square', color: c }));
      const half = block / 2;
      if (el.localName === 'rect') {
        const x = +el.getAttribute('x') || 0, y = +el.getAttribute('y') || 0, w = +el.getAttribute('width'), h = +el.getAttribute('height');
        const nx = Math.max(1, Math.round(w / block)), ny = Math.max(1, Math.round(h / block));
        guard(nx * ny);
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const p = apply(M, x + (i + .5) * block, y + (j + .5) * block);
          push(p[0], p[1], half, 0, si);
        }
      } else if (el.localName === 'path') {
        // "Simplify shapes": one evenodd path per region → read the cells back.
        const cw = Math.ceil(W / block), ch = Math.ceil(H / block);
        const oc = document.createElement('canvas'); oc.width = cw; oc.height = ch;
        const o = oc.getContext('2d');
        o.setTransform(M[0] / block, M[1] / block, M[2] / block, M[3] / block, M[4] / block, M[5] / block);
        o.fill(new Path2D(el.getAttribute('d')), paint['fill-rule'] || 'nonzero');
        const data = o.getImageData(0, 0, cw, ch).data;
        for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
          if (data[(j * cw + i) * 4 + 3] > 127) { guard(1); push((i + .5) * block, (j + .5) * block, half, 0, si); }
        }
      }
    }

    // ── a mark: everything drawable under `el`, placed by M ──
    function collect(node, M, inh, out) {
      for (const ch of node.children) {
        if (SKIP.has(ch.localName)) continue;
        const Mc = ch.hasAttribute('transform') ? mul(M, parseTransform(ch.getAttribute('transform'))) : M;
        const p = readPaint(ch, inh);
        if (ch.localName === 'g' || ch.localName === 'svg') collect(ch, Mc, p, out);
        else if (DRAWABLE.has(ch.localName)) { const g = elGeom(ch); if (g) out.push({ g, M: Mc, p }); }
      }
    }
    function mark(parts, M, alpha) {
      if (!parts.length) return;
      // centre of the parts in the mark's own (inner) coords
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      parts.forEach(pt => pt.g.pts.forEach(q => { const t = apply(pt.M, q[0], q[1]); x0 = Math.min(x0, t[0]); y0 = Math.min(y0, t[1]); x1 = Math.max(x1, t[0]); y1 = Math.max(y1, t[1]); }));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      // decompose M's linear part: rotation · scale(sx, sy) (no skew in these exports)
      const sx = Math.hypot(M[0], M[1]) || 1, a = Math.atan2(M[1], M[0]);
      const aspect = +(((M[0] * M[3] - M[1] * M[2]) / sx) / sx).toFixed(3) || 1;
      const home = apply(M, cx, cy);
      const al = +(alpha == null ? 1 : alpha).toFixed(2);
      // A lone filled circle (Pollen / Spore's default dot) → the batched circle
      // kind: one path per colour, and exactly the rasterisation of the source.
      if (parts.length === 1 && parts[0].g.circle && aspect === 1) {
        const pt = parts[0], f = colour(pt.p.fill), s = colour(pt.p.stroke);
        const L = pt.M, k = Math.hypot(L[0], L[1]);
        if (f && !s && Math.abs(k - Math.hypot(L[2], L[3])) < 1e-6) {
          const si = styleOf('c|' + f + '|' + al, () => ({ kind: 'circle', color: f, alpha: al }));
          guard(1);
          push(home[0], home[1], pt.g.circle * k * sx, 0, si);
          return;
        }
      }
      // Geometry is baked at the first mark's own scale (b0), so every mark
      // draws with a transform near 1 — a 100-unit form drawn at ×0.02 loses
      // ~15% of its ink to curve flattening at that scale (measured).
      const gkey = parts.map(pt => pt.g.d + '@' + pt.M.map(v => +v.toFixed(3)).join(',')).join(';') + '#' + cx.toFixed(2) + ',' + cy.toFixed(2);
      let G = shapeCache.get(gkey);
      if (!G) {
        const b0 = sx;
        G = { b0, paths: parts.map(pt => {
          const L = mul(mul([b0, 0, 0, b0, 0, 0], [1, 0, 0, 1, -cx, -cy]), pt.M);
          // An axis-aligned circle/ellipse stays an ellipse primitive: Chrome
          // rasterises a lone oval with its own AA, as the source SVG does; the
          // same oval as a general Path2D comes out ~8% lighter at 3–4 px.
          if (pt.g.ell && Math.abs(L[1]) < 1e-9 && Math.abs(L[2]) < 1e-9) {
            const e = pt.g.ell, c0 = apply(L, e[0], e[1]);
            return [c0[0], c0[1], Math.abs(e[2] * L[0]), Math.abs(e[3] * L[3])];
          }
          const path = new Path2D();
          path.addPath(new Path2D(pt.g.d), new DOMMatrix(L));
          return path;
        }) };
        shapeCache.set(gkey, G);
      }
      const g = G.paths, b0 = G.b0;
      const paints = parts.map(pt => {
        const f = colour(pt.p.fill), s = colour(pt.p.stroke);
        const o = {};
        if (f) { o.fill = f; if (pt.p['fill-rule'] === 'evenodd') o.rule = 'evenodd'; }
        if (s) { o.stroke = s; o.lw = (parseFloat(pt.p['stroke-width']) || 1) * b0; o.cap = pt.p['stroke-linecap'] || 'butt'; o.join = pt.p['stroke-linejoin'] || 'miter'; }
        return o;
      });
      const key = JSON.stringify(paints) + '|' + al + '|' + aspect + '|' + b0;
      const size = Math.max(x1 - x0, y1 - y0) / 2 * b0;
      const si = styleOf(key, () => ({ kind: 'shape', paints, alpha: al, aspect, size,
        color: paints[0].fill || paints[0].stroke || '#000' }));
      guard(1);
      push(home[0], home[1], sx / b0, a, si, g);
    }

    const DEF = { fill: '#000', stroke: 'none', 'stroke-width': '1' };
    function walk(node, M, inh) {
      for (const el of node.children) {
        const t = el.localName;
        if (SKIP.has(t)) continue;
        const p = readPaint(el, inh);
        // a full-canvas rect = the background, not a mark
        if (t === 'rect' && !el.hasAttribute('transform') && (+el.getAttribute('x') || 0) <= 0 && (+el.getAttribute('y') || 0) <= 0 &&
            (/%$/.test(el.getAttribute('width') || '') || +el.getAttribute('width') >= W - 0.5) &&
            (/%$/.test(el.getAttribute('height') || '') || +el.getAttribute('height') >= H - 0.5)) {
          if (!bg) bg = colour(p.fill);
          continue;
        }
        if (t === 'g' && !el.hasAttribute('transform')) { walk(el, M, p); continue; }   // a colour/region wrapper
        if (t === 'use') {                                 // older Spore exports: <use href="#mk" x y width height transform>
          const ref = (el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '').replace(/^#/, '');
          const target = ref && doc.getElementById(ref);
          if (!target) continue;
          const ux = +el.getAttribute('x') || 0, uy = +el.getAttribute('y') || 0;
          // the use's own transform, then its x/y, then (a <symbol>) viewBox → the width×height box
          let Mu = mul(mul(M, parseTransform(el.getAttribute('transform'))), [1, 0, 0, 1, ux, uy]);
          const svb = target.localName === 'symbol' ? nums(target.getAttribute('viewBox')) : [];
          if (svb.length === 4) {
            const bw = +el.getAttribute('width') || svb[2], bh = +el.getAttribute('height') || svb[3];
            Mu = mul(Mu, [bw / svb[2], 0, 0, bh / svb[3], -svb[0] * bw / svb[2], -svb[1] * bh / svb[3]]);
          }
          const parts = [];
          if (target.localName === 'symbol' || target.localName === 'g') collect(target, ID, p, parts);
          else if (DRAWABLE.has(target.localName)) { const g = elGeom(target); if (g) parts.push({ g, M: ID, p: readPaint(target, p) }); }
          mark(parts, Mu, p.opacity);
          continue;
        }
        if (isHalide && (t === 'rect' || t === 'path')) { halideCells(el, M, p); continue; }
        if (t === 'g') {                                   // Pollen / Spore: one transformed group = one mark
          const Mg = mul(M, parseTransform(el.getAttribute('transform')));
          const parts = [];
          collect(el, ID, p, parts);
          mark(parts, Mg, p.opacity);
          continue;
        }
        if (t === 'circle' && !el.hasAttribute('transform')) {  // a plain dot — the fast path
          const f = colour(p.fill);
          if (!f) { const g = elGeom(el); if (g) mark([{ g, M: ID, p }], M, p.opacity); continue; }
          const r = +el.getAttribute('r') || 0; if (!(r > 0)) continue;
          const al = p.opacity == null ? 1 : +p.opacity.toFixed(2);
          const si = styleOf('c|' + f + '|' + al, () => ({ kind: 'circle', color: f, alpha: al }));
          const c = apply(M, +el.getAttribute('cx') || 0, +el.getAttribute('cy') || 0);
          guard(1); push(c[0], c[1], r * Math.hypot(M[0], M[1]), 0, si);
          continue;
        }
        if (DRAWABLE.has(t)) {                            // e.g. Pollen's field streamlines: absolute paths
          const g = elGeom(el);
          if (g) mark([{ g, M: el.hasAttribute('transform') ? parseTransform(el.getAttribute('transform')) : ID, p }], M, p.opacity);
        }
      }
    }
    walk(root, R0, readPaint(root, DEF));
    if (!hx.length) throw new Error('Found no marks in this SVG.');
    return { W, H, tool, bg: bg || paper, count: hx.length, styles,
             homes: { hx, hy, r: rr, angle: ang, style: sty, geo } };
  }

  Organica.marksSVG = { parse };
})(typeof window !== 'undefined' ? window : this);
