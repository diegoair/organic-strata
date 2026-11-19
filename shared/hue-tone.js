/* hue-tone.js — Organica.hueTone: the Hue × tone colour system (Nov 19, 2026).
   Moved out of the Hue × tone lab (explorations/tunesutra-hue-tone/, which stays as the colour workbench)
   so TuneSutra can use it. Pure: no DOM; needs Organica.color (shared/color.js) and core.js's
   rgbToHex / hexToRGB255.

   THE MODEL — a tone is the hue's Vivid colour mixed with white (w) and black (b) in OKLab:
     L = V.L·v + w,   C = V.C·v,   v = 1 − w − b
   10 hues (HUES: the V anchor of each, OKLCH) × 12 tones (TONES: w, b, family, clear) + 10 greys (NEUTRALS).
   Anchors and the tone table were fitted to a reference set of printed palettes (mean ΔE ≈ 2.5).

   API
     HUES, TONES, FAMS, NEUTRALS, METAL           the model's tables
     toneColour(hi, ti) → hex                      a cell's colour
     read(hex) → { neutral, hi, ti, v, w, b, label, l, c, h }   (neutral: { neutral, n, label, … })
     hueIndex(h), hueStep(a, b), toneDist(a, b)
     nameOf(tok), settleNames(toks) → shared names left   names (tok = '#hex', 'r-g-b' or a metal key)
     readPalette(hexes) → { rs, hueRel, toneRel, purity, pos }   pos = image-scale x (warm −1 … cool +1), y (soft +1 … hard −1)
     WORDS                                          the image-scale words and their positions
     generate(baseHex, opts, seed)                  hue × tone generator (opts: image, hue, tone, purity, n, neutral)
     ROLE_SPEC, ROLE_PARTS, generateRoles(mainHex, n, seed)   the role generator, 2–9 colours, in house.js's role order
   Deterministic: the same arguments always give the same result. */
(function (global) {
  'use strict';
  const O = global.Organica || (global.Organica = {});
  const C = O.color;
  if (!C) throw new Error('hue-tone.js needs shared/color.js');
  const hex = (r, g, b) => O.rgbToHex(r, g, b);

  // ---------- the model ----------
  // V anchors per hue (OKLCH): measured on a printed key colour, or fitted where none is printed.
  const HUES = [
    { k: 'R',  name: 'red',          h: 28,  l: 0.58,  c: 0.237 },
    { k: 'YR', name: 'orange',       h: 53,  l: 0.73,  c: 0.186 },
    { k: 'Y',  name: 'yellow',       h: 106, l: 0.94,  c: 0.200 },
    { k: 'GY', name: 'yellow-green', h: 129, l: 0.77,  c: 0.196 },
    { k: 'G',  name: 'green',        h: 154, l: 0.584, c: 0.143 },
    { k: 'BG', name: 'blue-green',   h: 189, l: 0.572, c: 0.115 },
    { k: 'B',  name: 'blue',         h: 234, l: 0.498, c: 0.135 },
    { k: 'PB', name: 'blue-violet',  h: 263, l: 0.41,  c: 0.151 },
    { k: 'P',  name: 'purple',       h: 306, l: 0.40,  c: 0.166 },
    { k: 'RP', name: 'red-purple',   h: 1,   l: 0.526, c: 0.233 },
  ];
  // Tones as (w, b): white and black in the mix. fam = the four tone families; clear = on the edge of the mix.
  const TONES = [
    { k: 'V',   name: 'Vivid',         w: 0.00, b: 0.00, fam: 'casual',  clear: true },
    { k: 'S',   name: 'Strong',        w: 0.12, b: 0.09, fam: 'casual',  clear: true },
    { k: 'B',   name: 'Bright',        w: 0.24, b: 0.00, fam: 'light',   clear: true },
    { k: 'P',   name: 'Pale',          w: 0.61, b: 0.00, fam: 'light',   clear: true },
    { k: 'Vp',  name: 'Very pale',     w: 0.83, b: 0.01, fam: 'light',   clear: true },
    { k: 'Lgr', name: 'Light greyish', w: 0.51, b: 0.15, fam: 'elegant', clear: false },
    { k: 'L',   name: 'Light',         w: 0.46, b: 0.01, fam: 'elegant', clear: false },
    { k: 'Gr',  name: 'Greyish',       w: 0.41, b: 0.38, fam: 'elegant', clear: false },
    { k: 'Dl',  name: 'Dull',          w: 0.19, b: 0.29, fam: 'elegant', clear: false },
    { k: 'Dp',  name: 'Deep',          w: 0.01, b: 0.33, fam: 'heavy',   clear: true },
    { k: 'Dk',  name: 'Dark',          w: 0.00, b: 0.47, fam: 'heavy',   clear: true },
    { k: 'Dgr', name: 'Dark greyish',  w: 0.07, b: 0.69, fam: 'heavy',   clear: true },
  ];
  const FAMS = { casual: 'Casual', light: 'Light', elegant: 'Elegant', heavy: 'Heavy' };
  // Greys N9.5 … N1.5, pinned to three printed greys (N9.5 = white, N5 = #a1a1a1, N1.5 = print black), linear in OKLab L between.
  const N_PTS = [[1.5, 0], [5, C.hexToOklch('#a1a1a1').l], [9.5, 1]];
  const nL = v => { for (let i = 1; i < N_PTS.length; i++) if (v <= N_PTS[i][0]) { const a = N_PTS[i - 1], b = N_PTS[i]; return a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]); } return 1; };
  const NEUTRALS = [9.5, 9, 8, 7, 6, 5, 4, 3, 2, 1.5].map(v => ({ k: 'N' + v, l: nL(v), hex: C.oklchToHex(nL(v), 0, 0) }));
  // Metallics have no single colour: a flat stand-in for maths, a light end for a gradient.
  const METAL = { gold: ['#b8961e', '#f2dc5d'], silver: ['#9a9a9a', '#eeeeee'], champagne: ['#bfae8e', '#efe6d2'], pinkgold: ['#c98a6c', '#f5d2bf'] };

  const toHex = tok => {
    if (METAL[tok]) return METAL[tok][0];
    if (/^#/.test(tok)) return tok.toLowerCase();
    const p = String(tok).split('-').map(Number);
    return hex(p[0], p[1], p[2]);
  };
  function toneColour(hi, ti) {
    const H = HUES[hi], T = TONES[ti], v = 1 - T.w - T.b;
    return C.oklchToHex(H.l * v + T.w, H.c * v, H.h);
  }
  function hueIndex(h) {
    let best = 0, bd = 999;
    HUES.forEach((H, i) => { const d = Math.abs(((h - H.h + 540) % 360) - 180); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  // Read any colour: a grey (chroma under 0.02), or its hue, nearest tone and its (v, w, b).
  function read(hx) {
    const o = C.hexToOklch(toHex(hx));
    if (o.c < 0.02) {
      let n = 0; NEUTRALS.forEach((N, i) => { if (Math.abs(N.l - o.l) < Math.abs(NEUTRALS[n].l - o.l)) n = i; });
      return { neutral: true, n, label: NEUTRALS[n].k, l: o.l, c: o.c, h: o.h };
    }
    const hi = hueIndex(o.h), H = HUES[hi];
    const v = Math.min(1, o.c / H.c), w = o.l - H.l * v, b = 1 - v - w;
    let ti = 0, bd = 9;
    TONES.forEach((T, i) => { const d = Math.hypot(T.w - w, T.b - b); if (d < bd) { bd = d; ti = i; } });
    return { neutral: false, hi, ti, v, w, b, label: H.k + '/' + TONES[ti].k, l: o.l, c: o.c, h: o.h };
  }
  const toneDist = (a, b) => Math.hypot(TONES[a].w - TONES[b].w, TONES[a].b - TONES[b].b);
  const hueStep = (a, b) => { const d = Math.abs(a - b) % 10; return Math.min(d, 10 - d); };

  // ---------- names (docs/UI-COPY.md, colour names) ----------
  const cap = w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
  const TONE_WORD = { V: 'vivid', S: 'strong', B: 'bright', P: 'pale', Vp: 'very pale', Lgr: 'light greyish', L: 'light', Gr: 'greyish', Dl: 'dull', Dp: 'deep', Dk: 'dark', Dgr: 'dark greyish' };
  const HUE_WORD = { R: 'red', YR: 'orange', Y: 'yellow', GY: 'yellow green', G: 'green', BG: 'blue green', B: 'blue', PB: 'blue violet', P: 'purple', RP: 'red purple' };
  const GREY_WORD = { 'N9.5': 'white', N9: 'very pale grey', N8: 'pale grey', N7: 'light grey', N6: 'medium light grey', N5: 'grey', N4: 'medium dark grey', N3: 'dark grey', N2: 'very dark grey', 'N1.5': 'black' };
  const ISH = { R: 'reddish', YR: 'orangish', Y: 'yellowish', GY: 'yellowish', G: 'greenish', BG: 'greenish', B: 'bluish', PB: 'bluish', P: 'purplish', RP: 'purplish' };
  const METAL_NAME = { gold: 'Burnished gold', silver: 'Sterling silver', champagne: 'Champagne gold', pinkgold: 'Rose gold' };
  // The key colours keep their own names.
  const KEY_NAME = { '#e5000d': 'Carmine', '#ff7f00': 'Orange', '#fff200': 'Yellow', '#119352': 'Green', '#1a439b': 'Ultramarine', '#5f238d': 'Purple', '#fbaec1': 'Mauve pink', '#963a04': 'Brown', '#0a1552': 'Dark mineral blue', '#ffffff': 'White', '#a1a1a1': 'Grey', '#000000': 'Black' };
  // Lean words: which way a colour sits from its cell's centre. Hue: towards the neighbouring hue (+ = hue angle up).
  const HUE_LEAN = { R: ['purpler', 'yellower'], YR: ['redder', 'yellower'], Y: ['redder', 'greener'], GY: ['yellower', 'greener'], G: ['yellower', 'bluer'], BG: ['greener', 'bluer'], B: ['greener', 'purpler'], PB: ['greener', 'purpler'], P: ['bluer', 'redder'], RP: ['purpler', 'redder'] };
  const cellName = (hi, ti) => cap(TONE_WORD[TONES[ti].k] + ' ' + HUE_WORD[HUES[hi].k]);
  // Leans, largest first: lightness / half a tone band (0.06), hue / half a hue step (18°), chroma / half a chroma band (0.03).
  function leans(hx, R) {
    const o = C.hexToOklch(hx), c = C.hexToOklch(toneColour(R.hi, R.ti));
    const dh = ((o.h - c.h + 540) % 360) - 180, hw = HUE_LEAN[HUES[R.hi].k];
    return [
      { m: Math.abs(o.l - c.l) / 0.06, w: o.l > c.l ? 'lighter' : 'deeper' },
      { m: Math.abs(dh) / 18, w: dh > 0 ? hw[1] : hw[0] },
      { m: Math.abs(o.c - c.c) / 0.03, w: o.c > c.c ? 'richer' : 'softer' },
    ].sort((a, b) => b.m - a.m);
  }
  function baseName(tok) {
    if (METAL_NAME[tok]) return { n: METAL_NAME[tok], l: [] };
    const hx = toHex(tok);
    if (KEY_NAME[hx]) return { n: KEY_NAME[hx], l: [] };
    const R = read(hx);
    if (R.neutral) {
      if (R.c >= 0.010 && R.label !== 'N9.5' && R.label !== 'N1.5') {
        const g = GREY_WORD[R.label].replace(/\s*grey$/, '');
        return { n: cap((g ? g + ' ' : '') + ISH[HUES[hueIndex(R.h)].k] + ' grey'), l: [] };
      }
      const N = NEUTRALS.find(x => x.k === R.label), dl = N ? R.l - N.l : 0;
      return { n: cap(GREY_WORD[R.label] || 'grey'), l: Math.abs(dl) / 0.03 >= 0.3 ? [dl > 0 ? 'lighter' : 'deeper'] : [] };
    }
    return { n: cellName(R.hi, R.ti), l: leans(hx, R).filter(x => x.m >= 0.3).map(x => x.w) };
  }
  // A name = the base name + its largest lean after a comma; settleNames adds the second lean where two known colours share one.
  const NAME_CACHE = new Map();
  function nameOf(tok) {
    const key = METAL[tok] ? tok : toHex(tok);
    if (NAME_CACHE.has(key)) return NAME_CACHE.get(key);
    const b = baseName(key);
    return b.l.length ? b.n + ', ' + b.l[0] : b.n;
  }
  function settleNames(toks) {
    const all = [...new Set(toks.map(t => METAL[t] ? t : toHex(t)))], first = new Map();
    all.forEach(t => { const b = baseName(t); first.set(t, { b, n: b.l.length ? b.n + ', ' + b.l[0] : b.n }); });
    const count = {}; first.forEach(v => { count[v.n] = (count[v.n] || 0) + 1; });
    first.forEach((v, t) => { NAME_CACHE.set(t, count[v.n] > 1 && v.b.l.length > 1 ? v.n + ', ' + v.b.l[1] : v.n); });
    const seen = {}, dup = [];
    all.forEach(t => { const n = NAME_CACHE.get(t); (seen[n] = seen[n] || []).push(t); });
    Object.keys(seen).forEach(n => { if (seen[n].length > 1) dup.push(n + ': ' + seen[n].join(', ')); });
    return dup;
  }

  // ---------- readings ----------
  // Image-scale estimate: x −1 warm … +1 cool, y +1 soft … −1 hard.
  function imagePos(hexes) {
    if (!hexes.length) return { x: 0, y: 0 };
    const os = hexes.map(h => C.hexToOklch(toHex(h)));
    let warm = 0;
    os.forEach(o => { warm += Math.cos((o.h - 45) * Math.PI / 180) * Math.min(1, o.c / 0.08); });
    const x = -warm / os.length;
    const Ls = os.map(o => o.l), mL = Ls.reduce((a, b) => a + b) / Ls.length, rL = Math.max.apply(null, Ls) - Math.min.apply(null, Ls);
    const mC = os.reduce((a, o) => a + o.c, 0) / os.length;
    const y = 2.6 * (mL - 0.62) - 0.9 * (rL - 0.3) - 1.6 * (mC - 0.1);
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }
  function readPalette(hexes) {
    const rs = hexes.map(read), ch = rs.filter(r => !r.neutral);
    let hmax = 0, tmax = 0;
    for (let i = 0; i < ch.length; i++) for (let j = i + 1; j < ch.length; j++) {
      hmax = Math.max(hmax, hueStep(ch[i].hi, ch[j].hi)); tmax = Math.max(tmax, toneDist(ch[i].ti, ch[j].ti));
    }
    const hueRel = ch.length < 2 ? '—' : hmax === 0 ? 'same hue' : hmax === 1 ? 'similar hues' : hmax === 2 ? 'near hues' : hmax === 5 ? 'complement' : 'opposite hues (' + hmax + ')';
    const toneRel = ch.length < 2 ? '—' : tmax < 0.12 ? 'same tone' : tmax < 0.4 ? 'near tones' : 'far tones';
    const clear = ch.filter(r => TONES[r.ti].clear).length;
    const purity = !ch.length ? '—' : clear === ch.length ? 'all clear' : clear === 0 ? 'all dull' : 'mixed purity';
    return { rs, hueRel, toneRel, purity, pos: imagePos(hexes) };
  }
  // The hue relation in the editor's own harmony words (Nov 19, 2026, for Explore's filter): the chromatic hues are
  // grouped on the 10-step circle (neighbours, one step apart, are one group), then the groups' spacing is read.
  //   monochromatic · analogous · complementary · split (split-complementary) · triadic · tetradic · varied
  // null when fewer than two colours carry a hue (greys only, or one colour and greys).
  function harmonyOf(hexes) {
    const ch = hexes.map(read).filter(r => !r.neutral);
    if (ch.length < 2) return null;
    const hs = [...new Set(ch.map(r => r.hi))].sort((a, b) => a - b);
    if (hs.length === 1) return 'monochromatic';
    let span = 0;
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) span = Math.max(span, hueStep(hs[i], hs[j]));
    if (span <= 2) return 'analogous';
    // groups: start after the widest gap, so a group never wraps past it
    let start = 0, wide = -1;
    hs.forEach((h, i) => { const g = (hs[(i + 1) % hs.length] - h + 10) % 10 || 10; if (g > wide) { wide = g; start = (i + 1) % hs.length; } });
    const order = hs.slice(start).concat(hs.slice(0, start)), groups = [[order[0]]];
    for (let i = 1; i < order.length; i++) {
      if ((order[i] - order[i - 1] + 10) % 10 <= 1) groups[groups.length - 1].push(order[i]); else groups.push([order[i]]);
    }
    const centre = g => (g[0] + ((g[g.length - 1] - g[0] + 10) % 10) / 2) % 10;
    const cs = groups.map(centre), gaps = cs.map((c, i) => ((cs[(i + 1) % cs.length] - c) + 10) % 10 || 10);
    if (groups.length === 2) return hueStep(Math.round(cs[0]), Math.round(cs[1])) >= 4 ? 'complementary' : 'varied';
    if (groups.length === 3) {
      if (gaps.every(g => g >= 3)) return 'triadic';
      if (gaps.some(g => g <= 2) && gaps.filter(g => g >= 4).length === 2) return 'split';
      return 'varied';
    }
    if (groups.length === 4 && gaps.every(g => g >= 2) && hueStep(Math.round(cs[0]), Math.round(cs[2])) >= 4 && hueStep(Math.round(cs[1]), Math.round(cs[3])) >= 4) return 'tetradic';
    return 'varied';
  }
  const WORDS = [['pretty', -0.6, 0.75], ['romantic', 0, 0.85], ['natural', 0.05, 0.5], ['clear', 0.75, 0.6], ['casual', -0.75, 0.25], ['elegant', 0.35, 0.2], ['cool casual', 0.8, 0.15], ['dynamic', -0.85, -0.3], ['gorgeous', -0.45, -0.35], ['chic', 0.3, -0.25], ['modern', 0.8, -0.35], ['classic', -0.25, -0.6], ['dandy', 0.3, -0.6], ['wild', -0.6, -0.85], ['classic & dandy', 0, -0.85], ['formal', 0.7, -0.75]];

  // ---------- the hue × tone generator ----------
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  function hueOffsets(rel, n, R) {
    const out = [0], pm = () => (R() < 0.5 ? 1 : -1), opp = 3 + Math.floor(R() * 5);
    for (let k = 1; k < n; k++) {
      if (rel === 'same') out.push(0);
      else if (rel === 'similar') out.push(k === 1 ? pm() : [0, 1, -1][Math.floor(R() * 3)]);
      else if (rel === 'complement') out.push(k === 1 ? 5 : (R() < 0.5 ? 0 : 5) + (R() < 0.5 ? 0 : pm()));
      else if (rel === 'opposite') out.push(k === 1 ? opp : (R() < 0.5 ? opp : 0) + (R() < 0.5 ? 0 : pm()));
      else if (rel === 'split') out.push([4, -4, 0][(k - 1) % 3]);   // split-complementary: the two hues either side of the complement; more colours repeat them at other tones
      else if (rel === 'triad') out.push([3, -3, 0][(k - 1) % 3]);   // no jitter: a neighbour would join two groups (Nov 19, 2026 REVIEW)
      else out.push(Math.floor(R() * 10));
    }
    return out;
  }
  function pickTone(baseTi, rel, fam, purity, k, R) {
    const inFam = TONES.map((T, i) => i).filter(i => fam === 'any' || TONES[i].fam === fam);
    const pur = i => purity !== 'same' || TONES[i].clear === TONES[baseTi].clear;
    let pool;
    if (rel === 'same') pool = [baseTi];
    else if (rel === 'near') pool = inFam.filter(i => toneDist(i, baseTi) < 0.4 && pur(i));
    else pool = k === 1 ? TONES.map((T, i) => i).filter(i => toneDist(i, baseTi) >= 0.45 && pur(i)) : inFam.filter(i => toneDist(i, baseTi) < 0.4 && pur(i));
    if (!pool.length) pool = inFam.length ? inFam : [baseTi];
    return pool[Math.floor(R() * pool.length)];
  }
  // opts: { image: 'base'|'casual'|'light'|'elegant'|'heavy', hue: 'same'|'similar'|'complement'|'split'|'opposite'|'triad'|'free',
  //         tone: 'same'|'near'|'far', purity: 'any'|'same', n: 2–9, neutral: 'none'|'auto'|'white'|'grey'|'black' }
  function generate(baseHex, opts, seed) {
    baseHex = toHex(baseHex);
    const R = rng(seed), b = read(baseHex);
    if (b.neutral) return [baseHex];
    const fam = opts.image === 'base' ? TONES[b.ti].fam : opts.image;
    let baseTi = b.ti;
    if (TONES[baseTi].fam !== fam) {   // move the base into the chosen family
      const f = TONES.map((T, i) => i).filter(i => TONES[i].fam === fam);
      baseTi = f.reduce((a, i) => toneDist(i, b.ti) < toneDist(a, b.ti) ? i : a, f[0]);
    }
    const nChrom = opts.n - (opts.neutral === 'none' ? 0 : 1);
    const offs = hueOffsets(opts.hue, Math.max(1, nChrom), R);
    const out = [TONES[baseTi].fam === TONES[b.ti].fam ? baseHex : toneColour(b.hi, baseTi)];
    for (let k = 1; k < offs.length; k++) {
      const hi = (b.hi + offs[k] + 20) % 10;
      let ti = pickTone(baseTi, opts.tone, fam, opts.purity, k, R), hx = toneColour(hi, ti), tries = 0;
      while (out.some(o => C.deltaE(o, hx) < 6) && tries++ < 12) { ti = pickTone(baseTi, opts.tone === 'same' ? 'near' : opts.tone, fam, opts.purity, k, R); hx = toneColour(hi, ti); }
      out.push(hx);
    }
    if (opts.neutral !== 'none') {
      const mL = out.reduce((a, h) => a + C.hexToOklch(h).l, 0) / out.length;
      const nk = opts.neutral === 'auto' ? (mL > 0.7 ? 'grey' : mL < 0.45 ? 'white' : (R() < 0.5 ? 'white' : 'black')) : opts.neutral;
      out.push(nk === 'white' ? '#ffffff' : nk === 'black' ? '#000000' : NEUTRALS[4].hex);
    }
    return out;
  }

  // ---------- the role generator, 2–9 colours ----------
  // Each role: which role it is read from, the odds (%) of each hue step 0–5, of a grey, of each tone family,
  // and whether it leans light. Measured on 555 reference palettes with roles (3, 4 and 5 colours); far and
  // accent3 (8–9 colours) are derived: far like the ground but lighter, accent3 like the accents.
  const ROLE_SPEC = {
    sub:        { from: 'main',       steps: [17, 24, 25, 14, 14, 6],  neutral: 20, fam: { casual: 33, light: 19, elegant: 15, heavy: 14 } },
    accent:     { from: 'main',       steps: [18, 25, 24, 15, 14, 5],  neutral: 23, fam: { casual: 22, light: 33, elegant: 16, heavy: 7 }, light: true },
    accent2:    { from: 'main',       steps: [28, 27, 19, 8, 8, 10],   neutral: 34, fam: { casual: 9, light: 30, elegant: 19, heavy: 8 }, light: true },
    accent3:    { from: 'main',       steps: [22, 26, 21, 12, 11, 8],  neutral: 30, fam: { casual: 15, light: 31, elegant: 18, heavy: 8 }, light: true },
    background: { from: 'main',       steps: [20, 16, 24, 12, 16, 10], neutral: 13, fam: { casual: 14, light: 35, elegant: 33, heavy: 5 } },
    ground:     { from: 'background', steps: [57, 29, 10, 2, 0, 2],    neutral: 14, fam: { casual: 8, light: 25, elegant: 46, heavy: 6 } },
    middle:     { from: 'background', steps: [57, 29, 10, 2, 0, 2],    neutral: 14, fam: { casual: 8, light: 30, elegant: 46, heavy: 6 } },
    far:        { from: 'background', steps: [57, 29, 10, 2, 0, 2],    neutral: 18, fam: { casual: 4, light: 45, elegant: 40, heavy: 2 }, light: true },
  };
  // The roles for each count, in tunesutra/house.js's role order (largest share first).
  const ROLE_PARTS = {
    2: ['main', 'accent'],
    3: ['main', 'sub', 'accent'],
    4: ['main', 'sub', 'accent', 'accent2'],
    5: ['background', 'ground', 'main', 'sub', 'accent'],
    6: ['background', 'ground', 'main', 'sub', 'accent', 'accent2'],
    7: ['background', 'ground', 'middle', 'main', 'sub', 'accent', 'accent2'],
    8: ['background', 'ground', 'middle', 'far', 'main', 'sub', 'accent', 'accent2'],
    9: ['background', 'ground', 'middle', 'far', 'main', 'sub', 'accent', 'accent2', 'accent3'],
  };
  const pickW = (w, R) => { const ks = Object.keys(w), tot = ks.reduce((a, k) => a + w[k], 0); let r = R() * tot; for (const k of ks) { r -= w[k]; if (r <= 0) return k; } return ks[ks.length - 1]; };
  function roleColour(spec, ref, R, used) {
    for (let tries = 0; tries < 20; tries++) {
      let hx;
      if (R() * 100 < spec.neutral) {
        const pool = spec.light ? NEUTRALS.slice(0, 4) : NEUTRALS;
        hx = pool[Math.floor(R() * pool.length)].hex;
      } else {
        const st = +pickW(Object.assign({}, spec.steps), R), hi = ((ref.neutral ? Math.floor(R() * 10) : ref.hi) + (R() < 0.5 ? st : -st) + 20) % 10;
        const fam = pickW(spec.fam, R), tones = TONES.map((T, i) => i).filter(i => TONES[i].fam === fam);
        let ti = tones[Math.floor(R() * tones.length)];
        if (!ref.neutral && R() < 0.74) { const same = tones.filter(i => TONES[i].clear === TONES[ref.ti].clear); if (same.length) ti = same[Math.floor(R() * same.length)]; }   // same purity 74 %
        hx = toneColour(hi, ti);
      }
      if (used.every(u => C.deltaE(u, hx) >= 8)) return hx;
    }
    return NEUTRALS[Math.floor(R() * NEUTRALS.length)].hex;
  }
  // → [{ part, hex }] in ROLE_PARTS[n] order. The main colour is the one given.
  function generateRoles(mainHex, n, seed) {
    n = Math.max(2, Math.min(9, n | 0));
    mainHex = toHex(mainHex);
    const R = rng((Math.imul(seed, 2654435761) >>> 0) || 1), parts = ROLE_PARTS[n], got = { main: mainHex }, used = [mainHex];
    for (let i = 0; i < 4; i++) R();   // xorshift on a small seed starts near 0: mix the seed and burn a few draws
    ['background', 'middle', 'far', 'ground', 'sub', 'accent', 'accent2', 'accent3'].forEach(k => {
      if (parts.indexOf(k) < 0) return;
      const spec = ROLE_SPEC[k], hx = roleColour(spec, read(got[spec.from]), R, used);
      got[k] = hx; used.push(hx);
    });
    return parts.map(part => ({ part, hex: got[part] }));
  }

  O.hueTone = {
    HUES, TONES, FAMS, NEUTRALS, METAL, WORDS, ROLE_SPEC, ROLE_PARTS,
    toHex, toneColour, hueIndex, read, toneDist, hueStep, cellName,
    nameOf, settleNames, readPalette, harmonyOf, imagePos, rng, generate, generateRoles,
  };
})(typeof window !== 'undefined' ? window : globalThis);
