// Flexible Visual System · 16-cell-shadow — the stage shadow under a cell-shape sheet, drawn once instead of every frame.
//
// A circle / triangle / hexagon sheet has no square box, so it cast the stage shadow along its own outline with
// `filter: drop-shadow(var(--stage-shadow))` on the SVG (fvs.css). That filter is a 40px blur the browser re-runs on
// every repaint of anything near it — hovering a thumbnail, a selection ring, the save circle — measured 5–10× the
// GPU work of a square sheet (scripts/test-fvs-perf.sh --only paint, Oct 6, 2026), the CPU/GPU fan Diego heard.
//
// Here the same shadow is drawn ONCE into an image (canvas filter blur(σ); a CSS drop-shadow's blur length IS σ —
// Filter Effects spec, unlike box-shadow's radius — measured against Chrome's own drop-shadow: equal within 1–2 levels)
// and put behind the sheet as the SVG's first child; the SVG then gets data-shadow and fvs.css drops its filter.
// The outline is the sheet's own cell clip (clipPath cellclip-* / cellsclip-*, the polygons the Paper is cut to).
// One image per outline × size × density × theme, shared by every sheet that matches (a gallery of 12 thumbnails
// with one grid = one image). Re-drawn when a sheet changes size or the theme changes. Screen only: exports are
// built from strings and never see it. Without JS / before the image is ready the CSS filter still draws it.
// Standalone: reads only the DOM and the --stage-shadow token, imports nothing.

const SVG_NS = 'http://www.w3.org/2000/svg';
// Exactly the sheets fvs.css gives the stage shadow (the drop-shadow rules) — a cell-shape SVG anywhere else
// (Library rail tiles, Library view, Symbol previews) never had one and gets none.
const SEL = '#element-svg > svg.is-cell, #component-edit-frame > svg.is-cell, .fvs-thumb > svg.is-cell, .fvs-seed-tile__box > svg.is-cell';
const cache = new Map();          // key → Promise<objectURL>
const CACHE_MAX = 60;
let spec = null;                  // --stage-shadow parsed: { x, y, blur, color }

function readSpec() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--stage-shadow').trim();
  const m = v.match(/^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+([\d.]+)(?:px)?\s+(.+)$/);
  return m ? { x: +m[1], y: +m[2], blur: +m[3], color: m[4].trim(), key: v } : null;
}

// The sheet's outline in its own CSS px (before any ancestor transform) + the user-unit ↔ CSS-px mapping.
function measure(svg) {
  const clip = svg.querySelector('clipPath[id^="cellsclip-"], clipPath[id^="cellclip-"]');
  const w = svg.clientWidth, h = svg.clientHeight;
  if (!clip || !w || !h) return null;
  const ctm = svg.getScreenCTM(), r = svg.getBoundingClientRect();
  if (!ctm || !r.width) return null;
  const k = r.width / w;                                   // an ancestor's zoom transform
  const ax = ctm.a / k, ay = ctm.d / k, ex = (ctm.e - r.left) / k, ey = (ctm.f - r.top) / k;   // user → local CSS px
  const polys = [...clip.querySelectorAll('polygon')].map(pg => {
    const t = pg.transform.baseVal.consolidate(), m = t && t.matrix;
    return [...pg.points].map(p => {
      const x = m ? m.a * p.x + m.c * p.y + m.e : p.x, y = m ? m.b * p.x + m.d * p.y + m.f : p.y;
      return [ax * x + ex, ay * y + ey];
    });
  }).filter(p => p.length > 2);
  return polys.length ? { w, h, k, ax, ay, ex, ey, polys } : null;
}

function bake(m, s, dpr) {
  const pad = Math.ceil(s.blur * 3 + Math.max(Math.abs(s.x), Math.abs(s.y)));   // 3σ of the blur + the offset
  const W = Math.ceil((m.w + 2 * pad) * dpr), H = Math.ceil((m.h + 2 * pad) * dpr);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const path = new Path2D();
  m.polys.forEach(p => p.forEach(([x, y], i) => (i ? path.lineTo(x + pad, y + pad) : path.moveTo(x + pad, y + pad))));
  if ('filter' in ctx) {
    // σ = the drop-shadow's blur length. Not shadowBlur: Chrome's canvas maps it to σ ≈ 0.29·blur + 0.5.
    ctx.filter = `blur(${s.blur * dpr}px)`;
    ctx.setTransform(dpr, 0, 0, dpr, s.x * dpr, s.y * dpr);
    ctx.fillStyle = s.color;
    ctx.fill(path, 'nonzero');
  } else {
    // No canvas filter (older Safari): the shape off the canvas, only its shadow kept (offset / blur in canvas px)
    const away = W + 50;
    ctx.setTransform(dpr, 0, 0, dpr, -away, 0);
    ctx.shadowColor = s.color; ctx.shadowBlur = 2 * s.blur * dpr;   // spec canvas: σ = shadowBlur / 2
    ctx.shadowOffsetX = away + s.x * dpr; ctx.shadowOffsetY = s.y * dpr;
    ctx.fillStyle = '#000';
    ctx.fill(path, 'nonzero');
  }
  return new Promise(res => cv.toBlob(b => res({ url: b ? URL.createObjectURL(b) : '', pad }), 'image/png'));
}

function shadowFor(m, s) {
  const dpr = Math.min(3, (window.devicePixelRatio || 1) * m.k);
  const key = [s.key, dpr.toFixed(2), m.w, m.h, m.polys.map(p => p.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')).join('|')].join('#');
  let hit = cache.get(key);
  if (!hit) {
    hit = bake(m, s, dpr);
    cache.set(key, hit);
    if (cache.size > CACHE_MAX) {                               // oldest first
      const [old, p] = cache.entries().next().value;
      cache.delete(old); p.then(r => setTimeout(() => r.url && URL.revokeObjectURL(r.url), 5000));
    }
  }
  return hit;
}

const pending = new WeakMap();    // svg → the request in flight (a newer one wins)
async function apply(svg) {
  if (!svg.isConnected) return;
  spec = spec || readSpec();
  const m = spec && measure(svg);
  if (!m) return;
  const ticket = {};
  pending.set(svg, ticket);
  const { url, pad } = await shadowFor(m, spec);
  if (pending.get(svg) !== ticket || !svg.isConnected || !url) return;
  let img = svg.querySelector(':scope > image.cell-shadow');
  if (!img) {
    img = document.createElementNS(SVG_NS, 'image');
    img.setAttribute('class', 'cell-shadow');
    img.setAttribute('preserveAspectRatio', 'none');
    img.setAttribute('pointer-events', 'none');
    img.setAttribute('aria-hidden', 'true');
    svg.insertBefore(img, svg.firstChild);                     // under everything, the ring included
  }
  // the image covers the sheet's CSS box grown by pad, in user units
  img.setAttribute('x', ((-pad - m.ex) / m.ax).toFixed(3));
  img.setAttribute('y', ((-pad - m.ey) / m.ay).toFixed(3));
  img.setAttribute('width', ((m.w + 2 * pad) / m.ax).toFixed(3));
  img.setAttribute('height', ((m.h + 2 * pad) / m.ay).toFixed(3));
  img.setAttribute('href', url);
  svg.setAttribute('data-shadow', '');
}

// Every cell-shape sheet that appears is watched for size (0 → visible when its step opens, a resize, a zoom).
const sized = new ResizeObserver(entries => entries.forEach(e => apply(e.target)));
const watch = el => { if (el.matches && el.matches(SEL)) sized.observe(el); el.querySelectorAll && el.querySelectorAll(SEL).forEach(s => sized.observe(s)); };
const unwatch = el => { if (el.matches && el.matches(SEL)) sized.unobserve(el); el.querySelectorAll && el.querySelectorAll(SEL).forEach(s => sized.unobserve(s)); };
new MutationObserver(list => list.forEach(r => {
  r.removedNodes.forEach(n => n.nodeType === 1 && unwatch(n));
  r.addedNodes.forEach(n => n.nodeType === 1 && watch(n));
})).observe(document.body, { childList: true, subtree: true });
watch(document.body);

// A theme change re-colours the shadow (--stage-shadow differs in dark).
const retheme = () => { const s = readSpec(); if (s && spec && s.key === spec.key) return; spec = s; document.querySelectorAll(SEL).forEach(apply); };
new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);
