/* ─────────────────────────────────────────────────────────────────────────────
 * pollen-presets.js — Organica.pollenPresets: Pollen's presets, for Pollen and for the Shadow.
 *
 * Nov 22, 2026 (Diego: "importare i presets di Pollen in TuneSutra nei setting di Shadow relativi").
 * Pollen's built-in presets live here now (Pollen reads BUILTIN); its saved ones stay in its own store
 * (organica.pollen.presets + the cloud `presets` rows, tool 'pollen'). The Shadow's Pollen category lists
 * them all, and picking one COPIES its marks into the shadow (toMarks) — the marks only, never Pollen's
 * colours (the shadow's inks are the palette's), and a copy, so the palette keeps its shadow when the
 * preset changes or goes, in every tool, for any account.
 *
 *   Organica.pollenPresets.BUILTIN            // { name: preset } — Pollen's own built-ins
 *   Organica.pollenPresets.list()             // [{ id: 'b:<name>' | 'u:<name>', name, preset }] built-ins, then saved
 *   Organica.pollenPresets.pull() → Promise    // the saved ones from the cloud (signed in), then list() has them
 *   Organica.pollenPresets.onSync(fn)          // fn() when the saved ones change
 *   Organica.pollenPresets.toMarks(preset, name, shapeOf?) → marks   // the copy the shadow keeps (Organica.shadeMarks 'pollen-preset')
 *   Organica.pollenPresets.shapeLoops(svg) → [[x, y, …], …] | null    // a seed's outline, centred, longest side 1 (browser);
 *                                                                      // a loop of three numbers is a circle [cx, cy, r]
 *
 * marks = { v: 1, name, kind: 'shape' | 'stroke', shapes: [loops…] (1–3: RMX forms by tone), star,
 *           spMin, spMax (Pollen units, master spacing applied), sizeMin, sizeMax, sizeRange, width, length,
 *           strokeLen, strokeSeg, strokeWarp, strokeRound, angleMin, angleMax, angleRange, angleRandom, angleFlow,
 *           gamma, contrast, invert, hide: [lo, hi] | null (0..255 brightness), dropout (0..1) }
 *
 * LOAD ORDER: core.js (presetStore) → store.js (cloud) → this. Seeds: shared/seeds.js (window.ORGANIC_SEEDS)
 * when the page has it; else the seed is fetched from /shared/seeds.js once (loadSeeds).
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  // Pollen's built-in presets (moved from pollen/index.html, Nov 22, 2026 — unchanged). A preset is partial: a key
  // it omits is that control's HTML default (DEFAULTS below, the same values as pollen/index.html's inputs).
  const BUILTIN = {
    'Fine Dots':  { pointType:'g:seed-breath', colorMode:'solid', ink:'#0a0a0a', bg:'#f5f2ec',
                    'sl-size':'1.5','ck-size-range':false,'sl-sp-min':'1.5','sl-sp-max':'8','sl-phases':'16' },
    'Felt-tip':   { pointType:'g:seed-breath', colorMode:'solid', ink:'#0a0a0a', bg:'#f5f2ec',
                    'sl-size':'4','ck-size-range':true,'sl-size-max':'1','sl-sp-min':'3','sl-sp-max':'14','sl-phases':'12' },
    'Lines Flow': { pointType:'g:seed-line', colorMode:'solid', ink:'#0a0a0a', bg:'#f5f2ec',
                    'sl-size':'4','ck-angle-random':true,'sl-angle':'0','sl-angle-max':'360','sl-sp-min':'2','sl-sp-max':'10' },
    'Duotone':    { pointType:'g:seed-breath', colorMode:'adaptive', ink:'#1a3a2a', bg:'#dfe6f0',
                    'sl-size':'3','ck-size-range':false,'sl-sp-min':'1.5','sl-sp-max':'9','sl-phases':'14' },
    // Stroke streamlines (the strokes curve through the image's angle field).
    'Hatch Flow': { pointType:'stroke', strokeStyle:'line', colorMode:'solid', ink:'#0a0a0a', bg:'#f5f2ec',
                    'sl-size':'1','sl-stroke-len':'12','sl-stroke-seg':'10','sl-stroke-warp':'0.3',
                    'ck-stroke-round':true,'ck-angle-flow':true,'ck-angle-range':false,'ck-angle-random':false,
                    'sl-sp-min':'1.5','sl-sp-max':'9','sl-phases':'16','sl-dropout':'50' },
    'Hatch Swirl':{ pointType:'stroke', strokeStyle:'line', colorMode:'solid', ink:'#0a0a0a', bg:'#f5f2ec',
                    'sl-size':'1.2','sl-stroke-len':'14','sl-stroke-seg':'10','sl-stroke-warp':'0',
                    'ck-stroke-round':true,'ck-angle-flow':false,'ck-angle-range':true,'ck-angle-random':false,
                    'sl-angle':'0','sl-angle-max':'360','sl-sp-min':'2','sl-sp-max':'12','sl-phases':'16','sl-dropout':'0' },
  };
  // pollen/index.html's control defaults (value= / checked) — what a preset's missing key means
  const DEFAULTS = {
    'sl-size': 2.5, 'sl-size-max': 6, 'sl-scale': 1, 'sl-width': 1, 'sl-length': 1, 'sl-stroke-len': 10, 'sl-stroke-seg': 10,
    'sl-stroke-warp': 0, 'sl-angle': 0, 'sl-angle-max': 360, 'sl-sp-min': 2, 'sl-sp-max': 12, 'sl-sp-scale': 1, 'sl-gamma': 1,
    'sl-contrast': 0, 'sl-hide-min': 255, 'sl-hide-max': 255, 'sl-dropout': 0,
    'ck-size-range': false, 'ck-angle-range': false, 'ck-angle-random': false, 'ck-angle-flow': false, 'ck-stroke-round': true,
    'ck-invert': false, 'ck-hide': false,
  };
  // a pre-uniform-id pointType ('g:1' … 'g:56') of an old saved preset (pollen/index.html remapPointType)
  const OLD_G = { '1':'seed-breath','2':'seed-heartbeat','3':'seed-metaballs','7':'seed-drop-fall','9':'seed-lava-detach','13':'seed-flower-bloom','14':'seed-petal-turn','21':'seed-caterpillar','26':'seed-amoeba','28':'seed-mitosis','37':'seed-sun','41':'seed-bubble-cluster','56':'seed-line' };
  function remapPointType(t) {
    if (typeof t === 'string' && t.indexOf('g:') === 0 && OLD_G[t.slice(2)]) return 'g:' + OLD_G[t.slice(2)];
    return t;
  }

  // ── the saved presets: Pollen's own store (same key, same legacy key) ──
  let store = null;
  const userStore = () => store || (store = Organica.presetStore ? Organica.presetStore('pollen', 'pollen-presets') : null);
  function saved() { const s = userStore(); try { return (s && s.read()) || {}; } catch (e) { return {}; } }
  function list() {
    const out = Object.keys(BUILTIN).map(n => ({ id: 'b:' + n, name: n, preset: BUILTIN[n] }));
    const u = saved();
    Object.keys(u).forEach(n => { if (u[n] && typeof u[n] === 'object') out.push({ id: 'u:' + n, name: n, preset: u[n] }); });
    return out;
  }
  const byId = id => list().find(p => p.id === id) || null;

  // ── a seed's outline (browser): every geometry element sampled through its own transform, centred on the
  //    content, longest side 1. A stroked element (Line, the Sun's rays) becomes its stroke's outline. ──
  const STEP = 3;          // a sample every ~3 viewBox units (a 200 box) — round enough at mark size
  const r3 = v => Math.round(v * 1000) / 1000;
  function shapeLoops(svg) {
    if (!svg || typeof document === 'undefined') return null;
    const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    host.setAttribute('style', 'position:absolute;left:-9999px;top:-9999px;width:200px;height:200px;overflow:visible');
    const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    host.setAttribute('viewBox', el.getAttribute('viewBox') || '0 0 200 200');
    host.innerHTML = el.innerHTML;
    document.body.appendChild(host);
    const loops = [];
    try {
      host.querySelectorAll('path, circle, ellipse, rect, polygon, polyline, line').forEach(g => {
        const m = g.getCTM(), hm = host.getCTM(), inv = hm ? hm.inverse() : null, M = inv && m ? inv.multiply(m) : m;
        const at = (x, y) => (M ? [M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f] : [x, y]);
        const len = g.getTotalLength ? g.getTotalLength() : 0;
        if (!(len > 0)) return;
        const stroke = g.getAttribute('stroke'), fill = g.getAttribute('fill');
        const stroked = stroke && stroke !== 'none' && (fill === 'none' || !fill || g.tagName === 'line' || g.tagName === 'polyline');
        // a circle stays a circle (centre + radius — three numbers, drawn as two arcs), as long as its transform keeps it round
        if (g.tagName === 'circle' && (!M || (Math.abs(Math.hypot(M.a, M.b) - Math.hypot(M.c, M.d)) < 1e-6 && Math.abs(M.a * M.c + M.b * M.d) < 1e-6))) {
          const c = at(+g.getAttribute('cx') || 0, +g.getAttribute('cy') || 0), r = (+g.getAttribute('r') || 0) * (M ? Math.hypot(M.a, M.b) : 1);
          if (r > 0) loops.push([c[0], c[1], r]);
          return;
        }
        const n = Math.max(8, Math.min(32, Math.ceil(len / STEP)));
        const pts = [];
        for (let k = 0; k <= n; k++) { const p = g.getPointAtLength(len * k / n); pts.push(at(p.x, p.y)); }
        if (stroked) {
          const sw = parseFloat(g.getAttribute('stroke-width')) || 1, sc = M ? Math.hypot(M.a, M.b) : 1;
          loops.push(ribbon(pts, sw * sc / 2, g.getAttribute('stroke-linecap') === 'round'));
        } else {
          pts.pop();   // closed: the last sample is the first
          loops.push([].concat.apply([], pts));
        }
      });
    } finally { host.remove(); }
    if (!loops.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    loops.forEach(l => {
      if (l.length === 3) { x0 = Math.min(x0, l[0] - l[2]); x1 = Math.max(x1, l[0] + l[2]); y0 = Math.min(y0, l[1] - l[2]); y1 = Math.max(y1, l[1] + l[2]); return; }
      for (let i = 0; i < l.length; i += 2) { x0 = Math.min(x0, l[i]); x1 = Math.max(x1, l[i]); y0 = Math.min(y0, l[i + 1]); y1 = Math.max(y1, l[i + 1]); }
    });
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, s = 1 / (Math.max(x1 - x0, y1 - y0) || 1);
    return loops.map(l => (l.length === 3 ? [r3((l[0] - cx) * s), r3((l[1] - cy) * s), r3(l[2] * s)] : l.map((v, i) => r3((v - (i % 2 ? cy : cx)) * s))));
  }
  // an open polyline's outline at half-width hw (round caps: a half circle at each end)
  function ribbon(pts, hw, round) {
    const L = [], R = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / tl * hw, ny = (b[0] - a[0]) / tl * hw;
      L.push([pts[i][0] + nx, pts[i][1] + ny]); R.push([pts[i][0] - nx, pts[i][1] - ny]);
    }
    const cap = (c, from) => { const out = []; if (!round) return out; for (let k = 1; k < 6; k++) { const t = from + Math.PI * k / 6; out.push([c[0] + Math.cos(t) * hw, c[1] + Math.sin(t) * hw]); } return out; };
    const dir = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]);
    const end = cap(pts[n - 1], dir(pts[n - 2] || pts[0], pts[n - 1]) - Math.PI / 2), start = cap(pts[0], dir(pts[1] || pts[0], pts[0]) - Math.PI / 2);
    return [].concat.apply([], L.concat(end, R.reverse(), start));
  }

  // a seed's SVG: the page's seed data, Pollen's uploaded shapes are not kept anywhere (null → a round dot)
  function seedSVG(key) {
    if (!key || key.indexOf('g:') !== 0) return null;
    const S = global.ORGANIC_SEEDS, F = global.ORGANIC_FORMS, id = key.slice(2);
    return (S && S[id] && S[id].svg) || (F && F[id]) || null;
  }
  // the seed data, once, for a page that does not load it (TuneSutra): resolves when ORGANIC_SEEDS is there
  let seedsLoading = null;
  function loadSeeds() {
    if (global.ORGANIC_SEEDS || global.ORGANIC_FORMS || typeof document === 'undefined') return Promise.resolve();
    // shared/seeds.js since Genesis was retired (Nov 22, 2026); genesis/forms.js where that has not landed yet
    const load = src => new Promise(res => { const s = document.createElement('script'); s.src = src; s.onload = () => res(true); s.onerror = () => { s.remove(); res(false); }; document.head.appendChild(s); });
    return seedsLoading || (seedsLoading = load('/shared/seeds.js').then(ok => (ok ? null : load('/genesis/forms.js'))));
  }

  // ── the copy: a preset's marks, as the shadow keeps them ──
  function toMarks(preset, name, shapeOf) {
    const p = preset || {};
    const v = id => { const x = p[id] !== undefined ? parseFloat(p[id]) : DEFAULTS[id]; return isFinite(x) ? x : DEFAULTS[id]; };
    const ck = id => (p[id] !== undefined ? !!p[id] : DEFAULTS[id]);
    const loopsOf = shapeOf || (key => shapeLoops(seedSVG(key)));
    const keys = (p.rmxOn && Array.isArray(p.rmxForms) ? p.rmxForms.filter(Boolean) : []).map(remapPointType);
    const main = remapPointType(p.pointType || 'g:seed-breath');
    const set = keys.length >= 2 ? keys : [main];
    const stroke = set.every(k => k === 'stroke');
    const shapes = stroke ? [] : set.map(k => (k === 'stroke' ? null : loopsOf(k))).map(l => l || null);
    const spS = v('sl-sp-scale') || 1, sc = v('sl-scale') || 1, spMin = Math.max(0.25, v('sl-sp-min') * spS);
    return {
      v: 1, name: name || '', kind: stroke ? 'stroke' : 'shape', shapes: shapes, star: p.strokeStyle === 'star',
      spMin: spMin, spMax: Math.max(spMin, v('sl-sp-max') * spS),
      sizeMin: v('sl-size') * sc, sizeMax: v('sl-size-max') * sc, sizeRange: ck('ck-size-range'),
      width: v('sl-width') || 1, length: v('sl-length') || 1,
      strokeLen: v('sl-stroke-len') || 10, strokeSeg: v('sl-stroke-seg') || 10, strokeWarp: v('sl-stroke-warp') || 0, strokeRound: ck('ck-stroke-round'),
      angleMin: v('sl-angle'), angleMax: v('sl-angle-max'), angleRange: ck('ck-angle-range'), angleRandom: ck('ck-angle-random'), angleFlow: ck('ck-angle-flow'),
      gamma: v('sl-gamma'), contrast: v('sl-contrast'), invert: ck('ck-invert'),
      hide: ck('ck-hide') ? [Math.min(v('sl-hide-min'), v('sl-hide-max')), Math.max(v('sl-hide-min'), v('sl-hide-max'))] : null,
      dropout: (v('sl-dropout') || 0) / 100,
    };
  }

  // The built-ins' labels in sentence case (UI-COPY rule 3; ledger O-95 c, Nov 25, 2026): Pollen's own menu and the shade
  // editor's Pollen category show these; the keys stay as they are (saved presets and shadings name them).
  const LABEL = { 'Fine Dots': 'Fine dots', 'Lines Flow': 'Lines flow', 'Hatch Flow': 'Hatch flow', 'Hatch Swirl': 'Hatch swirl' };

  Organica.pollenPresets = {
    BUILTIN: BUILTIN, DEFAULTS: DEFAULTS, LABEL: LABEL,
    list: list, byId: byId, toMarks: toMarks, shapeLoops: shapeLoops, loadSeeds: loadSeeds, remapPointType: remapPointType,
    pull: () => { const s = userStore(); return s && s.pull ? s.pull().catch(() => {}) : Promise.resolve(); },
    onSync: fn => { const s = userStore(); if (s && s.onSync) s.onSync(fn); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
