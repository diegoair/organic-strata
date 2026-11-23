/* ─────────────────────────────────────────────────────────────────────────────
 * shading.js — Organica.shading: a colour's GRADIENT and SHADOW, drawn as vector plates.
 *
 * Promoted from TuneSutra (Nov 20, 2026) at its second consumer — FVS — so a palette saved in
 * TuneSutra draws the same in every tool (Diego: "caricarle con tutti i loro shadow, grain e
 * parametri"). The engine is TuneSutra's, unchanged; what it read from TuneSutra's state comes
 * in as a context. scripts/test-shading.mjs keeps it byte-identical to what TuneSutra drew.
 *
 * A DEFINITION (GradDef) is one object for the fill and its shadow — see DEFAULT below.
 * The output is PLATES: [{ hex, paper, d, cells, smooth? }] — one entry per ink, `d` the SVG
 * path (even-odd) of everything that ink owns in a w×h box. Every cell is one pure ink, so the
 * drawing is vector everywhere and splits into plates; a `smooth` plate is a real SVG gradient.
 *
 *   const S = Organica.shading;
 *   S.defs(hex, ctx)              → { soft, speckle, base, print, <texture>… }   the presets of a colour
 *   S.normalize(def)              → def   upgrades a saved definition (TuneSutra's normalizeGrad)
 *   S.withColour(def, hex, ctx)   → def   the colour's stop set to hex (the 900 follows while auto2)
 *   S.plates(def, w, h, ctx)      → plates, cached (def + box + palette)
 *   S.gradPlates(def, w, h, ctx)  → plates, uncached
 *   S.shadowInks(def, hex, ctx)   → [halftone, core]
 *   S.smoothMarkup(plate, id) · S.drawPlates(canvasCtx, plates) · S.platesSVG(plates, idPrefix)
 *
 * CONTEXT (optional everywhere):
 *   tints   array, or a function → array: every tint (50–900) of the palette's colours — the pool a
 *           shadow ink snaps to when its hue rule leaves the colour's own tints
 *   scale   function(hex) → Organica.color.scale(hex)-shaped steps — a tool's own scale (TuneSutra's
 *           keeps a moved colour's column, `scaleFrom`); default Organica.color.scale, cached
 *   paper   the paper colour of a highlight / transparent stop (default Organica.contentColor('--paper'))
 *   sheet   { x, y, w, h }: the tool's sheet in the units the shape is drawn in — a Wash (type 'field') over All the
 *           shapes reads the sheet's wash at each shape's place (shapePlates sets ctx.origin); without it, each shape's own
 *
 * WASH (type 'field', Nov 21, 2026): soft clouds + a slope + a wave, coloured through the stops — see FIELD below.
 *   S.fieldValue(def, region) → (x, y) → 0..1   ·   S.fieldPlates(def, w, h, ctx)   ·   S.fieldParams(def)
 *
 * LOAD ORDER: core.js (isoContours) → color.js → noise.js → shade-marks.js → this.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  const C = () => Organica.color;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function num(v) { return +(+v).toFixed(2); }
  function n1(v) { return Math.round(v * 10) / 10; }   // a Field's outlines: a tenth of a unit is finer than any print

  // The default definition — TuneSutra's palette gradient as it starts (tunesutra/index.html state.grad).
  const DEFAULT = {
    type: 'linear',   // 'flat' (the first stop only) | 'linear' | 'radial' | 'field' (+ def.field, see FIELD below)
    angle: 90,        // CSS convention: 0 = to top, 90 = to right
    stops: ['#c93ed6', '#c9863e'],
    pos: null,        // a 0..1 position per stop, ascending; null = evenly spaced (palettes saved before Nov 2, 2026)
    paper: false,     // fade to paper: the sheet's paper as a last, plate-less stop
    // Every grain is one pure ink — the drawing is vector everywhere (Nov 18, 2026).
    size: 0,          // GRAIN size in sheet units, 0–12 (0 = no grain: a smooth blend)
    pattern: 'noise', // the grain: 'noise' (square cells at random) | 'dots' (round dots, evenly spread)
    // SHADOW — its own switch, speck size, specks and seed since Nov 18, 2026 (Diego: Gradient · Grain · Shadow)
    shadow: false,    // on / off
    amount: 70,       // how strong, 1–100
    speck: 2,         // speck / dot size, when the shadow has its own grid (Flat, or grain 0); on a grained blend it follows the grain
    specks: 'specks', // RENDER: 'specks' (square cells) | 'dots' (a halftone screen) | 'bands' (hard steps) | 'smooth' | a shadeMarks texture
    sseed: 1,         // the shadow's own seed
    // the painter's shadow (Nov 18, 2026 — the Shadow lab): two inks made by these rules, snapped to the palette
    hue: 'same',      // on the palette: 'same' | 'cool' | 'warm' | 'complement'; free: the harmony rules — 'same' (Monochromatic) | 'analogous' | 'complement' | 'split' | 'triadic' | 'tetradic'
    shift: 60,        // how far toward that hue, 0–100
    depth: 35,        // how dark the core gets, in OKLCH lightness ×100
    lose: 0,          // chroma lost in the shadow, 0–100
    glow: 0,          // chroma gained at the turning edge (in the halftone ink), 0–100
    parts: { half: true, term: false, core: true, refl: false, high: false },
    snap: true,       // each ink → the nearest of the palette's own tints
    inkMid: null, inkCore: null,   // a hand-picked ink (null = the rule's)
    dist: 'light',    // the shadow's spread: 'light' (away from a light) | 'even' (everywhere)
    light: 315,       // Light from, degrees (0 = the top)
    falloff: 50,      // 50 = straight; higher keeps the shadow to the far side
    seed: 1,
  };
  const DEFAULT_JSON = JSON.stringify(DEFAULT);

  // ── the context ──
  const scaleCache = new Map();
  function baseScale(hex) {
    if (!scaleCache.has(hex)) scaleCache.set(hex, C().scale(hex));
    return scaleCache.get(hex);
  }
  function tokenScale(hex, ctx) { return ctx && ctx.scale ? ctx.scale(hex) : baseScale(hex); }
  function paletteTints(ctx) {
    const t = ctx && ctx.tints;
    return (typeof t === 'function' ? t() : t) || [];
  }
  function paperOf(ctx) { return ctx && ctx.paper ? ctx.paper : Organica.contentColor('--paper'); }

  // ── SHADING — each colour's shadow noise (Nov 18, 2026; Diego: "per ogni colore un set di
  // gradient con noise predefinito che mi crei delle sorte di shadow noise sulle forme").
  // The presets of one colour, each drawn in a shape's own box with the light from its top:
  // Soft (a smooth shadow), Speckle (square specks of deeper tints), and the shadeMarks textures.
  // All are ink cells — vector, in every export.
  // Two presets since Nov 18, 2026 (Diego: Shading moves into Shadow — None · Soft · Speckle; Stipple out, Pattern ›
  // Dots does it): SOFT a gentle shadow, SPECKLE square specks. 'print' (Stipple) is still read, as Soft.
  const SHADE_MODES = ['soft', 'speckle'], SHADE_NAME = { soft: 'Soft', speckle: 'Speckle', print: 'Soft' };
  // the shadow types from the lab (Organica.shadeMarks): flat colour + that texture, a size it reads at
  const TEXTURE_SIZE = { mottle: 3, 'dither-fs': 3, 'dither-blue': 3, 'dither-bayer': 3, 'pollen-dot': 4, 'pollen-stroke': 4, 'pollen-cross': 5, 'camo-spots': 4, 'camo-maze': 4, cells: 4 };
  function shadeDefs(hex, ctx) {
    const sc = tokenScale(hex, ctx), a = Math.max(0, sc.findIndex(st => st.anchor)), dir = a <= 7 ? 1 : -1;   // darker, unless already near black
    const deep = sc[clamp(a + 5 * dir, 0, 9)].hex;   // eslint-disable-line no-unused-vars
    // the gradient's second stop is the colour's own 900 (Diego, Nov 18, 2026) — its 50 when the colour is the 900
    const shade = a === 9 ? sc[0].hex : sc[9].hex;
    const base = { type: 'linear', angle: 180, stops: [hex, shade], auto2: true, pos: [0.2, 1], paper: false,
      shadow: false, amount: 70, speck: 2, specks: 'specks', sseed: 7, hue: 'same', shift: 60, depth: 35, lose: 0, glow: 0,
      parts: { half: true, term: false, core: true, refl: false, high: false }, snap: true, inkMid: null, inkCore: null, size: 0, pattern: 'noise', dist: 'light', light: 0, falloff: 50, seed: 7 };
    // Flat draws only the first stop; the second is there so that switching it to Linear / Radial blends at once.
    const speckle = Object.assign({}, base, { type: 'flat', shadow: true, amount: 70, speck: 2, falloff: 65 });
    const soft = Object.assign({}, base, { type: 'flat', shadow: true, specks: 'smooth', amount: 60, depth: 25, falloff: 50 });   // a smooth shadow, no specks
    // Wash (Nov 21, 2026, evening — Diego: "mettilo in shadow … come se fosse un camo dither etc"): a Shading preset now,
    // not a Gradient Type. The colour and its 900 washed as soft clouds; it is the fill (type 'field'), no shadow on it.
    // Its Colour by is the preset (Diego, Nov 21, 2026: "rendi le opzioni Color by dei presets … Wash una categoria come
    // Camo"): wash (Tone) · wash-posterize · wash-random · wash-tonernd.
    const washOf = by => Object.assign({}, base, { type: 'field', angle: 90, auto2: true, pos: null, field: Object.assign({}, FIELD_DEFAULT, { by: by }) });
    const out = { soft: soft, speckle: speckle, print: soft, base: base, wash: washOf('tone') };
    FIELD_BY.slice(1).forEach(by => { out['wash-' + by] = washOf(by); });
    Object.keys(TEXTURE_SIZE).forEach(t => { out[t] = Object.assign({}, speckle, { specks: t, speck: TEXTURE_SIZE[t], amount: 80 }); });
    return out;
  }
  // The flat colour, no shadow — what "None" draws, and where an edit starts from.
  function flatDef(hex, ctx) { return Object.assign({}, shadeDefs(hex, ctx).base, { type: 'flat', shadow: false }); }

  // Integer-lattice hash → 0..1. (shared/noise.js's hash2 is built for
  // continuous coordinates; on whole-number cells it repeats every 50.)
  function cellHash(x, y, seed) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed + 1, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // The threshold 0..1 of cell (c, r) for a pattern; `layer` decorrelates the
  // blend's own dither from the shadow on top of it.
  function patternThr(pattern, c, r, seed, layer) {
    if (pattern === 'dots') {
      const N = 64, ox = Math.floor(cellHash(seed, layer, 91) * N), oy = Math.floor(cellHash(layer, seed, 37) * N);
      return Organica.dither.blueNoise(N)[((r + oy) % N) * N + ((c + ox) % N)];
    }
    return cellHash(c, r, seed + layer * 7919);
  }

  // Stop positions 0..1, one per colour; missing or stale → evenly spaced.
  function evenPos(n) { return Array.from({ length: n }, (_, i) => n > 1 ? i / (n - 1) : 0); }
  function stopPos(g) {
    const n = g.stops.length;
    return g.pos && g.pos.length === n ? g.pos.slice() : evenPos(n);
  }
  function colourStop(def) { const i = def.colourAt | 0; return i >= 0 && i < def.stops.length ? i : 0; }
  function isClear(v) { return v === 'transparent'; }
  // The stops actually drawn, with their positions: the chosen colours (only the
  // first for a flat fill). A stop can be TRANSPARENT (Nov 18, 2026) — no ink there:
  // it takes no plate and leaves the shape empty (`paper`: the support shows).
  function gradStops(g, ctx) {
    if (g.type === 'flat') return [{ hex: g.stops[colourStop(g)], paper: false, at: 0 }];   // Flat = the colour itself, wherever Reverse put it
    const pos = stopPos(g);
    return g.stops.map((hex, i) => isClear(hex) ? { hex: paperOf(ctx), paper: true, clear: true, at: pos[i] } : { hex: hex, paper: false, at: pos[i] });
  }
  // Which two stops a position falls between: { a, f } — f the 0..1 share of the way to a + 1.
  function segAt(stops, t) {
    const k = stops.length;
    if (k < 2 || t <= stops[0].at) return { a: 0, f: 0 };
    for (let a = 0; a < k - 1; a++) {
      if (t <= stops[a + 1].at) { const span = stops[a + 1].at - stops[a].at; return { a: a, f: span > 1e-6 ? (t - stops[a].at) / span : 1 }; }
    }
    return { a: k - 2, f: 1 };
  }
  // A colour along the gradient — only for a new stop and the stop bar's preview:
  // the drawing itself never mixes, every cell is one of the stops.
  function colourAt(stops, t) {
    if (stops.length < 2) return stops[0].hex;
    const s = segAt(stops, t);
    return C().mixIn('oklab', stops[s.a].hex, stops[s.a + 1].hex, s.f);
  }

  // Position along the gradient, 0..1, for a point of a w×h box.
  function gradField(g, w, h) {
    const cx = w / 2, cy = h / 2;
    if (g.type === 'flat') return () => 0;
    if (g.type === 'radial') { const r = Math.hypot(w, h) / 2; return (x, y) => Math.hypot(x - cx, y - cy) / r; }
    return linearField(g.angle, w, h);
  }
  function linearField(angle, w, h) {
    const cx = w / 2, cy = h / 2, rad = angle * Math.PI / 180, dx = Math.sin(rad), dy = -Math.cos(rad);
    const len = Math.abs(w * dx) + Math.abs(h * dy) || 1;
    return (x, y) => ((x - cx) * dx + (y - cy) * dy) / len + 0.5;
  }

  // How much shadow lands at a point, 0..1, before Amount:
  //   light — away from a light that comes from `light` degrees (0 = from the top): none on the lit
  //           edge, full opposite. Falloff bends it: 50 = straight, higher keeps it to the far side.
  //   even  — everywhere alike.
  // ctx.weight (x, y) → 0..1 replaces the light's field — a CAST shadow's falloff from its shape (castPlates below).
  function noiseWeight(g, w, h, ctx) {
    if (ctx && ctx.weight) return ctx.weight;
    if (g.dist !== 'light') return () => 1;
    const bend = Math.pow(4, (g.falloff - 50) / 50), f = linearField(g.light + 180, w, h);
    return (x, y) => Math.pow(clamp(f(x, y), 0, 1), bend);
  }
  function hasNoise(g) { return !!g.shadow && g.amount > 0; }
  // Which controls change the drawing right now — a panel shows only these.
  function gradUses(g) {
    const blend = g.type !== 'flat' && g.size > 0, shadow = hasNoise(g), light = shadow && g.dist === 'light';
    return {
      angle: g.type === 'linear' || g.type === 'field',
      field: g.type === 'field',
      pattern: blend,
      seed: blend,
      speck: shadow && g.specks !== 'smooth' && g.specks !== 'bands' && (!blend || markShadow(g)),
      dist: shadow,
      light: light,
      falloff: light,
    };
  }

  // ── THE SHADOW (Nov 18, 2026 — the Shadow lab, archive/tunesutra-mockups/shadow-ink/). Two inks over the
  //    colour: HALFTONE and CORE, made by the rules (Hue · Shift · Depth · Lose · Edge glow) and, with Snap to
  //    palette, each moved to the nearest of the palette's own 50–900 tints. The PARTS decide where they fall,
  //    from the light across the shape: Halftone, Terminator, Core shadow, Reflected light, Highlight.
  //    RENDER: Specks · Dots (a halftone screen) · Bands · Smooth · a shadeMarks texture. Every cell one ink.
  const SHADOW_HUE = { cool: 285, warm: 35 };
  // Free inks follow the Palette's harmony rules: the halftone takes the rule's first hue away from the
  // colour, the core its second; Shift scales the turn (100 = the rule's own angle).
  const HARMONY_INK = { analogous: [15, 30], split: [150, 210], triadic: [120, 240], tetradic: [90, 180] };
  const towardHue = (h, t, k) => h + ((((t - h) % 360) + 540) % 360 - 180) * k;
  function ruleInk(g, hex, s) {
    const O = C().hexToOklch(hex), grey = O.c < 0.02, k = s * g.shift / 100;
    let L = O.l * (1 - s * g.depth / 100), c = O.c, h = O.h;   // Depth = the share of the colour's lightness lost at the core
    if (g.hue === 'cool' || g.hue === 'warm') { const t = SHADOW_HUE[g.hue]; h = grey ? t : towardHue(O.h, t, k); if (grey) c = 0.05 * k; }
    else if (g.hue === 'complement') { h = (grey ? 105 : O.h) + 180 * k; if (grey) c = 0.04 * k; }
    else if (HARMONY_INK[g.hue]) { h = (grey ? 105 : O.h) + HARMONY_INK[g.hue][s < 1 ? 0 : 1] * g.shift / 100; if (grey) c = 0.05 * g.shift / 100; }
    else if (g.hue === 'impressionist') { h = towardHue(grey ? 285 : O.h, 285, Math.min(1, k * 1.2)); c = Math.max(c, 0.09) * (1 + 0.6 * k); }
    c *= 1 - (g.lose / 100) * s;
    if (s < 1) c *= 1 + (g.glow / 100) * 1.4;   // the edge glow lives in the halftone ink
    return C().oklchToHex(clamp(L, 0.04, 0.99), Math.max(0, c), ((h % 360) + 360) % 360);
  }
  // The two inks for colour `hex`: [halftone, core] — a manual one wins; else the rule, snapped to the palette.
  function shadowInks(g, hex, ctx) {
    const want = [g.inkMid || ruleInk(g, hex, 0.5), g.inkCore || ruleInk(g, hex, 1)];
    if (!g.snap) return want;
    const C_ = C();
    const pool = (g.hue === 'same' ? tokenScale(hex, ctx).map(st => st.hex) : paletteTints(ctx)).filter(t => C_.deltaE(t, hex) >= 4);   // Same: the colour's own tints only; never the colour itself
    const near = (x, not) => pool.filter(t => t !== not).reduce((b, t) => C_.deltaE(t, x) < C_.deltaE(b, x) ? t : b, pool[0] || x);
    const mid = g.inkMid || near(want[0]), core = g.inkCore || near(want[1], mid);   // the core never the halftone's tint
    return [mid, core];
  }
  const MIN_CELL = 1;
  const SHADOW_CELL = 2;
  // The shadow's own grid: Bands on a fine one (its edges follow the light, not Size's steps), else Size.
  function shadowGrid(g) { return hasNoise(g) && g.specks === 'bands' ? 1 : (g.speck || SHADOW_CELL); }
  // The shadow amount 0..1 for a light weight w0 (0 = the lit edge … 1 = the far side), by the parts.
  function shadowAt(g, w0) {
    const amt = g.amount / 100, P = g.parts || {};
    let s = P.half !== false ? clamp((w0 - 0.2) / 0.65, 0, 1) : (w0 > 0.5 ? 1 : 0);
    s = s * s * (3 - 2 * s) * amt;
    if (P.core === false) s = Math.min(s, 0.5);
    if (P.term) s = Math.min(1, s + Math.exp(-Math.pow((w0 - 0.5) / 0.1, 2)) * 0.3 * amt);
    if (P.refl && w0 > 0.82) s = Math.max(0, s - (w0 - 0.82) / 0.18 * 0.5);
    return s;
  }
  // Shadow level at a point: v 0 (none) … 1 (halftone ink) … 2 (core ink), and a highlight flag.
  function shadowLevel(g, w, h, ctx) {
    const weight = noiseWeight(g, w, h, ctx), P = g.parts || {};
    return (ux, uy, c, r) => {
      const w0 = weight(ux, uy);
      const hi = !!P.high && w0 < 0.15 && cellHash(c, r, g.sseed + 5) < (0.15 - w0) / 0.15 * 0.7;
      return { v: shadowAt(g, w0) * 2, hi: hi };
    };
  }
  // SMOOTH shadow (Soft): no specks — one vector gradient over the shape along the light.
  function smoothShadow(g) { return hasNoise(g) && g.specks === 'smooth'; }
  // a shadow from Organica.shadeMarks (Mottle, the Dithers, Pollen, Camo, Cells): its own marks over the fill
  function markShadow(g) { return hasNoise(g) && !!(Organica.shadeMarks && Organica.shadeMarks.has(g.specks)); }
  function markPlates(g, w, h, ctx) {
    const SM = Organica.shadeMarks, weight = noiseWeight(g, w, h, ctx), [mid, core] = shadowInks(g, g.stops[colourStop(g)], ctx);
    const res = SM.render(g.specks, { w: w, h: h, level: (x, y) => shadowAt(g, weight(x, y)), size: Math.max(SM.minSize(g.specks), g.speck || SHADOW_CELL), angle: g.light + 90, seed: 7 });
    return [{ hex: mid, paper: false, d: res.mid.join(''), cells: res.mid.length }, { hex: core, paper: false, d: res.core.join(''), cells: res.core.length }];
  }
  function smoothShadowPlate(g, w, h, ctx) {
    const [mid, core] = shadowInks(g, g.stops[colourStop(g)], ctx), bend = Math.pow(4, (g.falloff - 50) / 50), even = g.dist !== 'light';
    const stops = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24, w0 = even ? 1 : Math.pow(t, bend), v = shadowAt(g, w0) * 2;
      stops.push(v <= 1 ? [t, mid, Math.max(0, v)] : [t, C().mixIn('oklab', mid, core, v - 1), 1]);
    }
    return { hex: core, paper: false, d: `M0 0h${num(w)}v${num(h)}h${num(-w)}z`, cells: 0,
      smooth: { geom: smoothGeom({ type: 'linear', angle: ctx && ctx.weight ? g.light : g.light + 180 }, w, h), stops: stops } };   // a cast: darkest at the shape
  }
  // One cell of the shadow over base ink `base` (an index; -1 = none, the smooth fill): → { ink, dot? }.
  // I = { mid, core, paper } — the plates' indices of the two inks and the highlight.
  function shadowCell(g, lv, base, I, c, r, cell, whole) {
    if (lv.hi) return { ink: I.paper };
    const v = lv.v, mode = g.specks;
    if (mode === 'dots') {
      // a halftone screen (AM): the share f of the next ink covers exactly f of the cell — no dot ever
      // leaves its cell (plates never overlap)
      const lo = Math.min(1, Math.floor(v)), f = clamp(v - lo, 0, 1), under = lo === 0 ? base : I.mid, over = lo === 0 ? I.mid : I.core;
      if (!whole) return { ink: f > 0.5 ? over : under };
      if (f <= 0.5) { const r = Math.sqrt(f / Math.PI) * cell; return { ink: under, dot: r > 0.06 * cell ? { ink: over, r: r } : null }; }
      const r = Math.sqrt((1 - f) / Math.PI) * cell;
      return { ink: over, dot: r > 0.06 * cell ? { ink: under, r: r } : null };
    }
    const lvl = mode === 'bands' ? Math.round(v) : (() => { const lo = Math.floor(v); return cellHash(c, r, g.sseed + 11) < v - lo ? lo + 1 : lo; })();
    return { ink: lvl <= 0 ? base : lvl === 1 ? I.mid : I.core };
  }

  // Grain 0: the blend is a smooth vector gradient, not cells. The shadow, if any, keeps its cells.
  function smoothGrad(g) { return g.size === 0 && g.type !== 'flat' && gradStops(g).length > 1; }
  // The smooth fill's stops, sampled in OKLab (16 sub-stops a span). [at, hex, opacity]:
  // the paper stop is the last ink fading out (transparent, not white).
  function smoothStops(g, ctx) {
    const stops = gradStops(g, ctx), out = [];
    const inkNear = i => { for (let d = 1; d < stops.length; d++) { const a = stops[i - d], b = stops[i + d]; if (a && !a.paper) return a.hex; if (b && !b.paper) return b.hex; } return stops[i].hex; };
    stops.forEach((st, i) => {
      out.push([st.at, st.paper ? inkNear(i) : st.hex, st.paper ? 0 : 1]);
      if (i === stops.length - 1) return;
      const nx = stops[i + 1];
      if (st.paper && nx.paper) return;
      for (let k = 1; k < 16; k++) {
        const u = k / 16, at = st.at + (nx.at - st.at) * u;
        if (nx.paper) out.push([at, st.hex, 1 - u]);          // the ink fading out
        else if (st.paper) out.push([at, nx.hex, u]);        // fading in
        else out.push([at, C().mixIn('oklab', st.hex, nx.hex, u), 1]);
      }
    });
    return out;
  }
  // Its geometry in the w×h box: the line along which t runs 0 → 1 (linear), or the circle (radial).
  function smoothGeom(g, w, h) {
    const cx = w / 2, cy = h / 2;
    if (g.type === 'radial') return { radial: true, cx: cx, cy: cy, r: Math.hypot(w, h) / 2 };
    const rad = g.angle * Math.PI / 180, dx = Math.sin(rad), dy = -Math.cos(rad), len = Math.abs(w * dx) + Math.abs(h * dy) || 1;
    return { x1: cx - dx * len / 2, y1: cy - dy * len / 2, x2: cx + dx * len / 2, y2: cy + dy * len / 2 };
  }
  function circleD(x, y, r) { return `M${num(x - r)} ${num(y)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0Z`; }

  // The drawing: → [{ hex, paper, d, cells }] — one entry per ink, `d` the SVG path of every cell that
  // ink owns (rows run-length merged), in w×h units. The blend between two stops is a dither; the shadow
  // adds its ink last: with square cells it takes them from the others; with dots each dot is also cut
  // out of the ink under it (even-odd) — so the inks never overlap either way.
  function gradPlates(g, w, h, ctx) {
    if (smoothGrad(g)) return smoothPlates(g, w, h, ctx);
    const stops = gradStops(g, ctx), k = stops.length, cell = Math.max(MIN_CELL, g.type === 'flat' ? shadowGrid(g) : g.size);
    const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell), field = gradField(g, w, h);
    const out = stops.map(s => ({ hex: s.hex, paper: s.paper, d: [], holes: [], cells: 0 }));
    const shadow = hasNoise(g) && !smoothShadow(g) && !markShadow(g), level = shadow ? shadowLevel(g, w, h, ctx) : null, I = {};
    if (shadow) {
      // a shadow ink that is one of the stops is that stop's ink: one plate, not two of the same colour
      const add = hex => { const at = out.findIndex(p => !p.paper && p.hex.toLowerCase() === hex.toLowerCase()); if (at >= 0) return at; out.push({ hex: hex, paper: false, d: [], holes: [], cells: 0 }); return out.length - 1; };
      const [mid, core] = shadowInks(g, g.stops[colourStop(g)], ctx);
      I.mid = add(mid); I.core = add(core);
      out.push({ hex: paperOf(ctx), paper: true, d: [], holes: [], cells: 0 }); I.paper = out.length - 1;
    }
    const rowPath = (c0, c1, y0, y1) => { const x0 = num(c0 * cell), x1 = num(Math.min(w, c1 * cell)); return `M${x0} ${num(y0)}h${num(x1 - x0)}v${num(y1 - y0)}h${num(x0 - x1)}z`; };
    for (let r = 0; r < rows; r++) {
      const y0 = r * cell, y1 = Math.min(h, y0 + cell);
      let run = -1, c0 = 0;
      for (let c = 0; c <= cols; c++) {
        let ink = -1;
        if (c < cols) {
          const ux = Math.min(w, (c + 0.5) * cell), uy = (y0 + y1) / 2, t = clamp(field(ux, uy), 0, 1);
          const s = segAt(stops, t);
          ink = k < 2 ? 0 : (s.f > patternThr(g.pattern, c, r, g.seed, 0) ? s.a + 1 : s.a);
          if (shadow) {
            const sc = shadowCell(g, level(ux, uy, c, r), ink, I, c, r, cell, (c + 1) * cell <= w && (r + 1) * cell <= h);
            ink = sc.ink;
            if (sc.dot && sc.dot.ink !== ink) {   // a dot only in a whole cell, cut out of the ink under it
              const dot = circleD((c + 0.5) * cell, (r + 0.5) * cell, sc.dot.r);
              out[sc.dot.ink].d.push(dot); out[sc.dot.ink].cells++; out[ink].holes.push(dot);
            }
          }
        }
        if (ink !== run) {
          if (run >= 0) { const p = out[run]; p.d.push(rowPath(c0, c, y0, y1)); p.cells += c - c0; }
          run = ink; c0 = c;
        }
      }
    }
    out.forEach(p => { p.d = p.d.join('') + p.holes.join(''); delete p.holes; });
    if (smoothShadow(g)) out.push(smoothShadowPlate(g, w, h, ctx));
    if (markShadow(g)) out.push.apply(out, markPlates(g, w, h, ctx));
    return out;
  }
  // ── FIELD — shown as WASH (Nov 21, 2026; the visible name is the ledger's O-92 — Diego, on TuneSutra's Colour mode preview: "lo trovo bellissimo", then "quello che vediamo
  //    sia uguale anche in SVG export"). A value 0..1 at every point — soft noise + a slope along `angle` + a slight
  //    wave across it — coloured through the stops (OKLab), the preview's own picture. Laid out on the preview's
  //    213-unit width, so a shape of any size shows the same picture. The drawing stays vector: the value is cut into
  //    bands wherever the colour has moved by a just-visible step (ΔE 1), each band's outline traced where the field
  //    reaches it (marching squares, linear crossings), the bands stacked dark → bright — on screen and in the file it
  //    reads as one smooth fill (explorations/field-fill: under 0.2% of pixels off by more than 6/255).
  //    def.field = { size, slope, wave, seed, span }; span 'sheet' = one field over ctx.sheet that the shapes cut (a
  //    tool that gives no sheet draws each shape's own). Plates: one per stop, the bands as halftone (WASH_PITCH below).
  const FIELD_DEFAULT = { size: 38, slope: 45, wave: 10, seed: 0, span: 'shape', by: 'tone', space: 'oklab' }, FIELD_REF = 213, FIELD_JND = 1;
  // Colour by + Mix (Diego, Nov 21, 2026: "i color by Posterize random tone + random e tone non sono stati portati") —
  // TuneSutra's Colour mode words, the same math as palette.colorAt (Pollen's RMX) with the stops as its colours:
  //   tone      the colour runs through the stops, mixed in `space` (OKLab · sRGB) — bands at every just-visible step
  //   posterize each point the nearest stop — one band per stop, flat inks
  //   random    each speck (FIELD_SPECK of the 213-unit picture) a random stop
  //   tonernd   the tone, each speck nudged up to ±0.6 of a stop — specks of the neighbouring stops
  // Posterize, Random and Tone + random draw only the stops: their plates are the stops, solid, no halftone.
  const FIELD_BY = ['tone', 'posterize', 'random', 'tonernd'], FIELD_SPECK = 2;
  // Plates of a wash (O-92 c, Nov 21, 2026): one plate per STOP, not per band — each band carries `mix` [stop a, stop b,
  // f] (where its middle sits between the two stops it blends) and `wash` { pitch, ox, oy } (the halftone screen: a
  // dot every WASH_PITCH of the picture's 213-unit width, anchored on the sheet when the wash spans it), and
  // Organica.plateExport turns each band into a dot screen of its share on each stop's plate.
  const WASH_PITCH = 0.75;
  function fieldParams(g) {
    const F = Object.assign({}, FIELD_DEFAULT, g.field || {});
    if (FIELD_BY.indexOf(F.by) < 0) F.by = 'tone';
    if (F.space !== 'srgb') F.space = 'oklab';
    return F;
  }
  // The stop index a value sits at (a + the share of the way to a + 1): Posterize rounds it, Tone + random nudges it.
  function stopIndexAt(stops, s) { const sg = segAt(stops, s); return stops.length < 2 ? 0 : sg.a + sg.f; }
  function speckHash(i, j, seed) {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed + 1, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function isField(g) { return g && g.type === 'field'; }
  // The value at a point of region R ({ x, y, w, h }, the units the shape is drawn in) → 0..1
  function fieldValue(g, R) {
    const F = fieldParams(g), N = Organica.noise, rad = g.angle * Math.PI / 180, dx = Math.sin(rad), dy = -Math.cos(rad);
    const cx = R.x + R.w / 2, cy = R.y + R.h / 2, half = (Math.abs(R.w * dx) + Math.abs(R.h * dy)) / 2 || 1;
    const ref = FIELD_REF / Math.max(1e-6, R.w), so = F.seed * 13.7, size = Math.max(1, F.size), slope = F.slope / 100, wave = F.wave / 100;
    return (x, y) => {
      const ox = x - cx, oy = y - cy, t = (ox * dx + oy * dy) / half * 0.5 + 0.5, across = (oy * dx - ox * dy) * ref;
      const f = N && N.fbm ? N.fbm((x - R.x) * ref / size + so, (y - R.y) * ref / size + so * 0.61) : 0.5;
      return clamp((1 - slope) * f + slope * t + wave * Math.sin(across / 9), 0, 1);
    };
  }
  // Where to cut: a new band each time the colour has moved by FIELD_JND; each band takes the colour at its middle.
  const _cuts = new Map();
  // Posterize: a cut where the nearest stop changes (half way between two stops), each band that stop's own ink.
  function fieldCuts(stops, space, by) {
    const key = JSON.stringify(stops) + space + by;
    if (_cuts.has(key)) return _cuts.get(key);
    const N = 1024, cuts = [], mixAt = s => { if (stops.length < 2) return stops[0].hex; const sg = segAt(stops, s); return C().mixIn(space, stops[sg.a].hex, stops[sg.a + 1].hex, sg.f); };
    let out;
    if (by === 'posterize') {
      const idx = [Math.round(stopIndexAt(stops, 0))];
      for (let i = 1; i < N; i++) { const k = Math.round(stopIndexAt(stops, i / N)); if (k !== idx[idx.length - 1]) { cuts.push(i / N); idx.push(k); } }
      out = { cuts: cuts, colours: idx.map(k => stops[k].hex), solid: true };
    } else {
      let ref = mixAt(0);
      for (let i = 1; i < N; i++) { const s = i / N, c = mixAt(s); if (C().deltaE(ref, c) >= FIELD_JND) { cuts.push(s); ref = c; } }
      const at = [0].concat(cuts, [1]);
      out = { cuts: cuts, colours: at.slice(0, -1).map((a, i) => mixAt((a + at[i + 1]) / 2)) };
    }
    if (_cuts.size > 60) _cuts.clear();
    _cuts.set(key, out);
    return out;
  }
  // The field's plates in a w×h box: [band 0 over the whole box, then each band "value ≥ cut" on the one under it].
  // ctx.origin (the box's place) + ctx.sheet: span 'sheet' reads the field of the whole sheet at the box's place.
  function fieldPlates(g, w, h, ctx) {
    const stops = gradStops(g, ctx), F = fieldParams(g);
    const across = F.span === 'sheet' && ctx && ctx.sheet && ctx.sheet.w > 0 && ctx.origin;
    const o = across ? ctx.origin : { x: 0, y: 0 }, R = across ? ctx.sheet : { x: 0, y: 0, w: w, h: h };
    const val = fieldValue(g, R);
    if (F.by === 'random' || F.by === 'tonernd') return speckPlates(g, F, stops, val, w, h, o, R);
    const { cuts, colours, solid } = fieldCuts(stops, F.space, F.by);
    // the grid follows the picture, not the units: ~16 samples across the smallest thing in it (a patch, or the wave's
    // half period) — the same file at any sheet size — at least 0.5 units, never more than ~160k samples
    const unit = R.w / FIELD_REF, cell = Math.max(Math.min(F.size, F.wave > 0 ? 28 : 1e9) * unit / 16, 0.5, Math.sqrt(w * h / 160000));
    const dx = Math.ceil(w / cell) + 4, dy = Math.ceil(h / cell) + 4, V = new Float32Array(dx * dy), x0 = -2 * cell, y0 = -2 * cell;
    for (let j = 0; j < dy; j++) for (let i = 0; i < dx; i++)
      V[j * dx + i] = i === 0 || j === 0 || i === dx - 1 || j === dy - 1 ? -1 : val(o.x + x0 + (i + 0.5) * cell, o.y + y0 + (j + 0.5) * cell);
    const out = [{ hex: colours[0], paper: false, d: `M0 0h${num(w)}v${num(h)}h${num(-w)}z`, cells: 0 }], tol = cell * 0.1;
    const at = [0].concat(cuts, [1]), wash = { pitch: unit * WASH_PITCH, ox: o.x, oy: o.y };
    const mixOf = k => { const sg = segAt(stops, (at[k] + at[k + 1]) / 2), b = stops[Math.min(sg.a + 1, stops.length - 1)]; return [stops[sg.a].hex, b.hex, stops.length < 2 ? 0 : sg.f]; };
    if (!solid) Object.assign(out[0], { mix: mixOf(0), wash: wash });
    cuts.forEach((t, k) => {
      let d = '';
      Organica.isoContours(V, dx, dy, t).forEach(r => {
        const pts = Organica.simplifyRing(r.map(p => [x0 + (p[0] + 0.5) * cell, y0 + (p[1] + 0.5) * cell]), tol);
        if (pts.length >= 3) d += 'M' + pts.map(p => n1(p[0]) + ' ' + n1(p[1])).join('L') + 'Z';
      });
      if (d) out.push(Object.assign({ hex: colours[k + 1], paper: false, d: d, cells: 0, band: k + 1 }, solid ? {} : { mix: mixOf(k + 1), wash: wash }));
    });
    return out;
  }
  // Random / Tone + random: the box cut into specks (FIELD_SPECK of the picture's 213-unit width, on the sheet's grid
  // when the wash spans it, so neighbouring shapes share it), each speck one stop; one path per stop, a row's run of
  // the same stop one rect. Plate 0 = the box in the first stop (the shape's own fill), the others on it.
  function speckPlates(g, F, stops, val, w, h, o, R) {
    const n = stops.length, cell = Math.max(FIELD_SPECK * R.w / FIELD_REF, Math.sqrt(w * h / 160000), 0.25);
    const i0 = Math.floor(o.x / cell), j0 = Math.floor(o.y / cell), i1 = Math.ceil((o.x + w) / cell), j1 = Math.ceil((o.y + h) / cell);
    const D = stops.map(() => []);
    for (let j = j0; j < j1; j++) {
      let run = -1, from = 0;
      const flush = to => { if (run > 0) D[run].push(`M${num(from * cell - o.x)} ${num(j * cell - o.y)}h${num((to - from) * cell)}v${num(cell)}h${num(-(to - from) * cell)}z`); };
      for (let i = i0; i < i1; i++) {
        const rnd = speckHash(i, j, F.seed);
        const k = n < 2 ? 0 : F.by === 'random' ? Math.min(n - 1, Math.floor(rnd * n))
          : clamp(Math.round(stopIndexAt(stops, val((i + 0.5) * cell, (j + 0.5) * cell)) + (rnd - 0.5) * 1.2), 0, n - 1);
        if (k !== run) { flush(i); run = k; from = i; }
      }
      flush(i1);
    }
    const out = [{ hex: stops[0].hex, paper: !!stops[0].clear, d: `M0 0h${num(w)}v${num(h)}h${num(-w)}z`, cells: 0 }];
    for (let k = 1; k < n; k++) if (D[k].length) out.push({ hex: stops[k].hex, paper: !!stops[k].clear, d: D[k].join(''), cells: D[k].length });
    return out;
  }

  // Grain 0: [the first stop (painted by the shape), the smooth fill over the box, the shadow's cells].
  // Field: [its bands] in place of the smooth fill.
  function smoothPlates(g, w, h, ctx) {
    const stops = gradStops(g, ctx), out = isField(g) ? fieldPlates(g, w, h, ctx) : [{ hex: stops[0].hex, paper: false, d: '', cells: 0 },
      { hex: stops[stops.length - 1].hex, paper: false, d: `M0 0h${num(w)}v${num(h)}h${num(-w)}z`, cells: 0, smooth: { geom: smoothGeom(g, w, h), stops: smoothStops(g, ctx) } }];
    if (!hasNoise(g)) return out;
    if (smoothShadow(g)) { out.push(smoothShadowPlate(g, w, h, ctx)); return out; }
    if (markShadow(g)) { out.push.apply(out, markPlates(g, w, h, ctx)); return out; }
    // the shadow over the smooth fill: its own grid; a cell with no shadow shows the fill (-1)
    const cell = shadowGrid(g), cols = Math.floor(w / cell), rows = Math.floor(h / cell), level = shadowLevel(g, w, h);
    const [mid, core] = shadowInks(g, g.stops[colourStop(g)], ctx), P = [{ hex: mid, d: [], holes: [] }, { hex: core, d: [], holes: [] }, { hex: paperOf(ctx), paper: true, d: [], holes: [] }];
    const I = { mid: 0, core: 1, paper: 2 };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const sc = shadowCell(g, level((c + 0.5) * cell, (r + 0.5) * cell, c, r), -1, I, c, r, cell, true);
      if (sc.ink >= 0) {   // run-length: a cell continuing the same ink on its row widens the last rect
        const pl = P[sc.ink], last = pl.run;
        if (last && last.r === r && last.c1 === c) { last.c1 = c + 1; pl.d[pl.d.length - 1] = `M${num(last.c0 * cell)} ${num(r * cell)}h${num((c + 1 - last.c0) * cell)}v${cell}h${num(-(c + 1 - last.c0) * cell)}z`; }
        else { pl.run = { r: r, c0: c, c1: c + 1 }; pl.d.push(`M${num(c * cell)} ${num(r * cell)}h${cell}v${cell}h-${cell}z`); }
      }
      if (sc.dot && sc.dot.ink !== sc.ink) { const dot = circleD((c + 0.5) * cell, (r + 0.5) * cell, sc.dot.r); if (sc.dot.ink >= 0) P[sc.dot.ink].d.push(dot); if (sc.ink >= 0) P[sc.ink].holes.push(dot); }
    }
    P.forEach(p => out.push({ hex: p.hex, paper: !!p.paper, d: p.d.join('') + p.holes.join(''), cells: p.d.length }));
    return out;
  }
  // A smooth plate as SVG: its gradient (user space of the box) and the box filled with it.
  function smoothMarkup(pl, id) {
    const sp = pl.smooth, g = sp.geom, st = sp.stops.map(([at, hex, op]) => `<stop offset="${num(clamp(at, 0, 1))}" stop-color="${hex}"${op < 1 ? ` stop-opacity="${num(op)}"` : ''}/>`).join('');
    const def = g.radial ? `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${num(g.cx)}" cy="${num(g.cy)}" r="${num(g.r)}">${st}</radialGradient>`
      : `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(g.x1)}" y1="${num(g.y1)}" x2="${num(g.x2)}" y2="${num(g.y2)}">${st}</linearGradient>`;
    return `<defs>${def}</defs><path fill="url(#${id})" d="${pl.d}"/>`;
  }
  function smoothFill(c, pl) {
    const g = pl.smooth.geom, gr = g.radial ? c.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.r) : c.createLinearGradient(g.x1, g.y1, g.x2, g.y2);
    pl.smooth.stops.forEach(([at, hex, op]) => { const v = Organica.hexToRGB255(hex); gr.addColorStop(clamp(at, 0, 1), op < 1 ? `rgba(${v[0]},${v[1]},${v[2]},${num(op)})` : hex); });
    return gr;
  }
  // the Path2D kept on the (cached) plate: a Field's bands are drawn every frame
  function drawPlates(c, plates) { plates.forEach(p => { if (!p.d) return; c.fillStyle = p.smooth ? smoothFill(c, p) : p.hex; if (!p._p2d) Object.defineProperty(p, '_p2d', { value: new Path2D(p.d), writable: true }); c.fill(p._p2d, 'evenodd'); }); }
  // Plates as SVG markup (in the box's own units): one even-odd path per ink, smooth plates as gradients.
  // skipFirst: the first plate is the shape's own fill (already painted by the shape) — leave it out.
  // A wash's bands go in one <g data-wash="pitch ox oy">, each path with data-mix="#a #b f" — what the plates read.
  function platesSVG(plates, idPrefix, skipFirst) {
    let n = 0, open = null;
    const out = plates.map((p, i) => {
      if (!p.d || (skipFirst && i === 0)) return '';
      let pre = '';
      const w = p.mix && p.wash ? `${num(p.wash.pitch)} ${num(p.wash.ox)} ${num(p.wash.oy)}` : null;
      if (open !== w) { pre = (open ? '</g>' : '') + (w ? `<g data-wash="${w}">` : ''); open = w; }
      if (p.smooth) return pre + smoothMarkup(p, (idPrefix || 'sh') + '-' + (n++));
      return pre + `<path fill="${p.hex}"${w ? ` data-mix="${p.mix[0]} ${p.mix[1]} ${num(p.mix[2])}"` : ''} fill-rule="evenodd" d="${p.d}"/>`;
    }).join('');
    return out + (open ? '</g>' : '');
  }

  // Rendered once per definition, box and palette: the same mark repeated is drawn once.
  const plateCache = new Map();
  function plates(def, w, h, ctx) {
    const key = JSON.stringify(def) + [num(w), num(h)] + (def.shadow ? paletteTints(ctx).join('') : '') + (ctx && ctx.paper || '')
      + (isField(def) && ctx && ctx.sheet && ctx.sheet.w > 0 && ctx.origin ? JSON.stringify([ctx.sheet, num(ctx.origin.x), num(ctx.origin.y)]) : '');
    if (!plateCache.has(key)) { plateCache.set(key, gradPlates(def, w, h, ctx)); if (plateCache.size > 240) plateCache.delete(plateCache.keys().next().value); }
    return plateCache.get(key);
  }

  function withColour(def, hex, ctx) {
    if (def.stops.length < 2) { def.colourAt = 0; def.stops = [hex, shadeDefs(hex, ctx).soft.stops[1]]; return def; }
    const ci = colourStop(def);
    def.stops[ci] = hex;
    // the other stop of two stays the colour's own 900 while it has not been chosen by hand (`auto2`)
    if (def.auto2 === true && def.stops.length === 2) def.stops[1 - ci] = shadeDefs(hex, ctx).soft.stops[1];
    return def;
  }
  function fadesToPaper(def) { return def.type !== 'flat' && def.stops.some(isClear); }

  // Saved before Nov 18, 2026: the raster options are gone — Conic becomes Linear, Ordered becomes Noise,
  // a Tone grain (a raster jitter) is dropped, Grain in Shadows / Highlights becomes Everywhere.
  function normalizeGrad(g) {
    const had = g || {};
    g = Object.assign(JSON.parse(DEFAULT_JSON), g);
    if (g.kind && g.kind !== 'speckle') g.amount = 0;   // a Tone grain (raster) was no shadow
    // Saved before Nov 18, 2026 (evening): the shadow had no switch and shared the grain's size, pattern and seed.
    if (had.shadow === undefined) {
      g.shadow = had.amount !== undefined && +g.amount > 0;
      if (!g.shadow) g.amount = 70;
      g.speck = +had.size > 0 ? clamp(+had.size, 1, 12) : SHADOW_CELL;
      g.specks = had.pattern === 'dots' ? 'dots' : 'specks';
      g.sseed = had.seed != null ? had.seed : 1;
    }
    // Saved before the painter's shadow: one Ink, Specks 'noise' — that ink becomes the core, hand-picked.
    if (g.specks === 'noise') g.specks = 'specks';
    if (had.ink && had.inkCore === undefined) g.inkCore = had.ink;
    delete g.ink;
    g.parts = Object.assign({ half: true, term: false, core: true, refl: false, high: false }, had.parts || {});
    g.auto2 = had.auto2 === true;
    // Fade to paper (until Nov 18, 2026, late) → a transparent last stop, the others squeezed as they were drawn
    if (g.paper && g.stops.length) {
      const n = g.stops.length, f = n > 1 ? (n - 1) / n : 0, pos = (g.pos && g.pos.length === n ? g.pos : evenPos(n)).map(p => Math.round(p * f * 1000) / 1000);
      g.stops = g.stops.concat('transparent'); g.pos = pos.concat(1);
    }
    g.paper = false;
    // Cast (Nov 22, 2026): kept only when valid — a palette saved before has none and stays Inside
    if (PLACES.indexOf(g.place) < 0) delete g.place;
    if (!(+g.reach > 0)) delete g.reach; else g.reach = clamp(+g.reach, 1, 100);
    if (g.fall !== 'paper' && g.fall !== 'shapes') delete g.fall;
    if (g.edge !== 'spill' && g.edge !== 'cell') delete g.edge;
    if (g.type === 'conic') g.type = 'linear';
    if (g.type === 'field') g.field = fieldParams(had); else delete g.field;
    if (g.pattern !== 'dots') g.pattern = 'noise';
    // Free Cool / Warm / Impressionist went (Free = the harmony rules): Cool / Warm move on the palette,
    // Impressionist becomes Analogous.
    if (!g.snap && (g.hue === 'cool' || g.hue === 'warm')) g.snap = true;
    if (g.hue === 'impressionist') g.hue = 'analogous';
    g.dist = 'light';   // the shadow always gathers away from the light
    // Grain removed (Diego, Nov 18, 2026): every blend is smooth. A palette saved with a grain opens smooth.
    g.size = 0;
    delete g.out; delete g.kind; delete g.space;
    return g;
  }

  // ── ON A TOOL'S SHAPES (Nov 21, 2026: FVS's overlay, made generic for every tool) ──
  // A shaded colour's shape draws its plates in a BOX, clipped to the shape, over the shape's own flat fill; the plate
  // of the shape's own colour is left out (it is the fill). Every plate is one ink as a path, so a tool's plates and
  // recolouring keep working.
  // boxOf(d, transform?): the box of a path in its parent's units (a hidden <svg>'s getBBox — the transform applied);
  // cached by d + transform. Null without a DOM or for an empty path.
  const _boxes = new Map();
  let _probe = null;
  function boxOf(d, transform) {
    const key = (transform || '') + '|' + d;
    if (_boxes.has(key)) return _boxes.get(key);
    let b = null;
    try {
      if (!_probe) {
        _probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        _probe.setAttribute('width', '0'); _probe.setAttribute('height', '0');
        _probe.setAttribute('aria-hidden', 'true');
        _probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden';
        _probe.innerHTML = '<g><path/></g>';
        document.body.appendChild(_probe);
      }
      const g = _probe.firstChild, path = g.firstChild;
      path.setAttribute('d', d);
      if (transform) path.setAttribute('transform', transform); else path.removeAttribute('transform');
      const r = g.getBBox();
      if (r.width > 0 && r.height > 0) b = { x: r.x, y: r.y, w: r.width, h: r.height };
    } catch (e) { b = null; }
    if (_boxes.size > 400) _boxes.clear();
    _boxes.set(key, b);
    return b;
  }
  function shapePlates(def, hex, box, ctx) {
    const own = String(hex).toLowerCase();
    // a Field across the sheet reads the sheet's field at the box's place
    if (isField(def) && ctx && ctx.sheet && ctx.sheet.w > 0 && fieldParams(def).span === 'sheet') ctx = Object.assign({}, ctx, { origin: { x: box.x, y: box.y } });
    return plates(def, box.w, box.h, ctx).filter((pl, i) => i > 0 || String(pl.hex).toLowerCase() !== own);
  }
  let _ovl = 0;
  // SVG markup to append right after the shape: o = { transform, fillRule, box (default boxOf), ctx, idPrefix }
  function overlaySVG(def, hex, d, o) {
    o = o || {};
    if (!def || !d) return '';
    const box = o.box || boxOf(d, o.transform);
    if (!box) return '';
    const pl = shapePlates(def, hex, box, o.ctx);
    if (!pl.some(p => p.d)) return '';
    const id = (o.idPrefix || 'shd') + (++_ovl).toString(36);
    return `<clipPath id="${id}"><path d="${d}"${o.transform ? ` transform="${o.transform}"` : ''}${o.fillRule ? ` clip-rule="${o.fillRule}"` : ''}/></clipPath>`
      + `<g clip-path="url(#${id})"><g transform="translate(${num(box.x)},${num(box.y)})">${platesSVG(pl, id)}</g></g>`;
  }
  // Canvas: c is drawing the shape's parent space (its current transform); path a Path2D in that space, box its box.
  function overlayCanvas(c, def, hex, path, box, ctx, fillRule) {
    if (!def || !box) return;
    c.save();
    c.clip(path, fillRule || 'nonzero');
    c.translate(box.x, box.y);
    drawPlates(c, shapePlates(def, hex, box, ctx));
    c.restore();
  }

  // ── CAST: the shadow OUTSIDE the shape (Nov 22, 2026 — Diego: "Shadow non sono interne ma anche esterne"; test page
  // explorations/cast-shadow/). The definition's Place says where the Shadow falls: 'inside' (absent: every palette
  // saved before), 'outside' or 'both'; outside it reaches `reach` % of the shape's box diagonal, Falls on 'paper' |
  // 'shapes', and at a tool's cell edge 'spill' | 'cell' (the host reads fall and edge — this file only draws one cast).
  // The cast area = the shape swept away from the light by reach: one quad per outline edge (edge → edge + v·reach),
  // every quad wound the same way so they UNITE under nonzero (canvas) or as a clipPath's children (SVG). It holds the
  // moved copy too (a point of the copy outside the shape is crossed by some edge on its way back), no boolean op.
  // The shape is painted over it. The texture is the shadow's own (specks · dots · bands · smooth · marks) with its
  // inks, fading along the light from the outline: full at the contact, none at reach, Falloff bending it. No fill of
  // the colour: the paper shows through.
  // polys: the outline flattened, [[x, y]…] per ring, in the frame the shape is drawn in (the host flattens it).
  const CAST_DEFAULT = { place: 'inside', reach: 35, fall: 'paper', edge: 'spill' };
  const PLACES = ['inside', 'outside', 'both'];
  function castParams(g) {
    const P = Object.assign({}, CAST_DEFAULT);
    if (g && PLACES.indexOf(g.place) >= 0) P.place = g.place;
    if (g && +g.reach > 0) P.reach = clamp(+g.reach, 1, 100);
    if (g && g.fall === 'shapes') P.fall = 'shapes';
    if (g && g.edge === 'cell') P.edge = 'cell';
    return P;
  }
  // the definition when it casts a shadow outside, else null · whether it shades inside
  function castOf(g) { return g && hasNoise(g) && castParams(g).place !== 'inside' ? g : null; }
  function shadesInside(g) { return !g || !g.shadow || castParams(g).place !== 'outside'; }
  function castDir(light) { const r = light * Math.PI / 180; return [-Math.sin(r), Math.cos(r)]; }   // away from the light
  function castGeometry(polys, light, reach) {
    const v = castDir(light), mx = v[0] * reach, my = v[1] * reach, quads = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    polys.forEach(P => P.forEach(([x, y]) => { x0 = Math.min(x0, x, x + mx); y0 = Math.min(y0, y, y + my); x1 = Math.max(x1, x, x + mx); y1 = Math.max(y1, y, y + my); }));
    if (!(reach > 0) || !(x1 > x0) || !(y1 > y0)) return null;
    polys.forEach(P => P.forEach((a, i) => {
      const b = P[(i + 1) % P.length], cr = (b[0] - a[0]) * my - (b[1] - a[1]) * mx;
      if (Math.abs(cr) < 1e-9) return;   // an edge along the cast sweeps no area
      const q = [a, b, [b[0] + mx, b[1] + my], [a[0] + mx, a[1] + my]];
      if (cr < 0) q.reverse();           // one winding for all: they unite
      quads.push('M' + q.map(p => n1(p[0]) + ' ' + n1(p[1])).join('L') + 'Z');
    }));
    return { box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, quads: quads };
  }
  // How far a point lies from the shape, measured BACK toward the light (along −v): the first outline edge the ray
  // meets. Infinity inside the shape (an odd number of crossings on the whole ray: it is under the shape) or when the
  // ray meets nothing (the point is not in the swept area) — so a texture makes marks only where the cast shows.
  function castDistance(polys, v) {
    const E = [];
    polys.forEach(P => P.forEach((a, i) => { const b = P[(i + 1) % P.length]; E.push(a[0], a[1], b[0] - a[0], b[1] - a[1]); }));
    const rx = -v[0], ry = -v[1];
    return (x, y) => {
      let best = Infinity, cross = 0;
      for (let k = 0; k < E.length; k += 4) {
        const ax = E[k], ay = E[k + 1], ex = E[k + 2], ey = E[k + 3], den = rx * ey - ry * ex;
        if (!den) continue;
        const qx = ax - x, qy = ay - y, t = (qx * ey - qy * ex) / den, u = (qx * ry - qy * rx) / den;
        if (t >= 0 && u >= 0 && u < 1) { cross++; if (t < best) best = t; }
      }
      return cross % 2 ? Infinity : best;
    };
  }
  const castCache = new Map();
  // → { box, quads, plates } or null. o = { reach (in the polys' units; default the def's % of the polys' box
  // diagonal), ctx }
  function castPlates(def, hex, polys, o) {
    o = o || {};
    if (!castOf(def) || !polys || !polys.length) return null;
    const ctx = o.ctx || {};
    let reach = o.reach;
    if (!(reach > 0)) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      polys.forEach(P => P.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }));
      reach = castParams(def).reach / 100 * Math.hypot(x1 - x0, y1 - y0);
    }
    const key = JSON.stringify([def, hex, num(reach), polys]) + paletteTints(ctx).join('') + (ctx.paper || '');
    if (castCache.has(key)) return castCache.get(key);
    const G = castGeometry(polys, def.light, reach);
    let out = null;
    if (G) {
      const g = Object.assign({}, def, { type: 'flat', dist: 'light', stops: [hex].concat(def.stops.slice(1)), colourAt: 0 });
      const dist = castDistance(polys, castDir(def.light)), bend = Math.pow(4, (def.falloff - 50) / 50), bx = G.box.x, by = G.box.y;
      const weight = (x, y) => Math.pow(clamp(1 - dist(bx + x, by + y) / reach, 0, 1), bend);
      const pl = gradPlates(g, G.box.w, G.box.h, Object.assign({}, ctx, { weight: weight }));
      out = Object.assign(G, { plates: pl.filter((p, i) => i > 0 && !p.paper && p.d) });
    }
    if (castCache.size > 160) castCache.delete(castCache.keys().next().value);
    castCache.set(key, out);
    return out;
  }
  let _cst = 0;
  // SVG markup to draw BEFORE the shape, in the polys' frame. o = { reach, ctx, idPrefix }
  function castSVG(def, hex, polys, o) {
    o = o || {};
    const C_ = castPlates(def, hex, polys, o);
    if (!C_ || !C_.plates.length) return '';
    const id = (o.idPrefix || 'cst') + (++_cst).toString(36);
    return `<clipPath id="${id}">${C_.quads.map(q => `<path d="${q}"/>`).join('')}</clipPath>`
      + `<g clip-path="url(#${id})"><g transform="translate(${num(C_.box.x)},${num(C_.box.y)})">${platesSVG(C_.plates, id)}</g></g>`;
  }
  // Canvas: c is drawing the polys' frame (its current transform).
  function castCanvas(c, def, hex, polys, o) {
    const C_ = castPlates(def, hex, polys, o);
    if (!C_ || !C_.plates.length) return;
    c.save();
    c.clip(new Path2D(C_.quads.join('')), 'nonzero');
    c.translate(C_.box.x, C_.box.y);
    drawPlates(c, C_.plates);
    c.restore();
  }

  // The shadow textures, in menu order: the two presets, then Organica.shadeMarks' types.
  const TEXTURES = Object.keys(TEXTURE_SIZE);

  Organica.shading = {
    DEFAULT: DEFAULT, SHADE_MODES: SHADE_MODES, SHADE_NAME: SHADE_NAME, TEXTURES: TEXTURES, TEXTURE_SIZE: TEXTURE_SIZE,
    SHADOW_CELL: SHADOW_CELL,
    defs: shadeDefs, flatDef: flatDef, normalize: normalizeGrad, withColour: withColour,
    plates: plates, gradPlates: gradPlates, smoothPlates: smoothPlates, shadowInks: shadowInks,
    gradStops: gradStops, smoothStops: smoothStops, smoothGeom: smoothGeom, smoothMarkup: smoothMarkup, smoothFill: smoothFill,
    drawPlates: drawPlates, platesSVG: platesSVG, boxOf: boxOf, overlaySVG: overlaySVG, overlayCanvas: overlayCanvas, shapePlates: shapePlates,
    CAST_DEFAULT: CAST_DEFAULT, castParams: castParams, castOf: castOf, shadesInside: shadesInside,
    castDir: castDir, castGeometry: castGeometry, castPlates: castPlates, castSVG: castSVG, castCanvas: castCanvas,
    FIELD_DEFAULT: FIELD_DEFAULT, WASH_PITCH: WASH_PITCH, FIELD_BY: FIELD_BY, fieldParams: fieldParams, fieldValue: fieldValue, fieldPlates: fieldPlates, isField: isField,
    gradUses: gradUses, hasNoise: hasNoise, smoothShadow: smoothShadow, markShadow: markShadow,
    colourStop: colourStop, colourAt: colourAt, segAt: segAt, isClear: isClear, evenPos: evenPos, stopPos: stopPos, fadesToPaper: fadesToPaper,
  };
})(typeof window !== 'undefined' ? window : this);
