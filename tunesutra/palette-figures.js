/* palette-figures.js — what TuneSutra and the colour guide (/design-system/colour/) both draw (Nov 20, 2026).
   The guide moved out of TuneSutra into the design system (Diego: "Sposta How colour works nella documentazione del
   design system"); these pieces moved here so the two pages share one copy instead of two.
   Needs shared/core.js (normalizeHex), shared/color.js, shared/hue-tone.js and tunesutra/house.js.

   window.TUNESUTRA_FIG = {
     ROLE_SETS, roleName(i, n)                       a colour's role name by its place and the palette's count
     HARMONY_LABEL, TONE_LABEL, PURITY_LABEL, FAM_LABEL(k)   the relations in TuneSutra's words (docs/UI-COPY.md)
     houseFig(seed, n), houseSvg(colors, seed), paleOnPaper(hex)   the house, drawn as an <svg> string
     MOOD_X(x), MOOD_Y(y), moodSvg(byMood, withWords)   the mood map's square: one disc per word (area ∝ palettes)
     esc(s), capWord(w)
   } */
(function (global) {
  'use strict';
  const O = global.Organica, C = O.color, HT = O.hueTone, HOUSE = global.TUNESUTRA_HOUSE;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const capWord = w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '';

  // The roles — semantic, one word each, largest share first: one copy, in shared/palettes.js
  // (Organica.palettes.ROLE_SETS / roleName), so every tool names a palette's colours the same way.
  const ROLE_SETS = O.palettes.ROLE_SETS, roleName = O.palettes.roleName;

  const HARMONY_LABEL = { monochromatic: 'Monochromatic', analogous: 'Analogous', complementary: 'Complementary', split: 'Split-complementary', triadic: 'Triadic', tetradic: 'Tetradic', varied: 'Varied' };
  const TONE_LABEL = { same: 'Same tone', near: 'Near tones', far: 'Far tones' };
  const PURITY_LABEL = { clear: 'All pure', dull: 'All greyed', mixed: 'Mixed purity' };   // not "clear": a Mood word and the Clear verb
  const FAM_LABEL = k => HT.FAMS[k] + ' tones';   // not bare Casual / Elegant: those are Mood words too

  // The house (tunesutra/house.js): same seed + same count → the same house.
  const houseCache = new Map();
  function houseFig(seed, n) {
    const key = seed + ':' + n;
    if (!houseCache.has(key)) { houseCache.set(key, HOUSE.generate(seed, n)); if (houseCache.size > 200) houseCache.delete(houseCache.keys().next().value); }
    return houseCache.get(key);
  }
  // A zone too pale to see on the paper gets a hairline.
  function paleOnPaper(hex) { return C.contrast(hex, '#ffffff') < 1.12; }
  // 2–9 colours on their house, as an <svg> string (null outside 2–9).
  function houseSvg(colors, seed) {
    const cols = colors.map(c => O.normalizeHex(c, '#888888')), n = cols.length;
    if (n < 2 || n > 9) return null;
    const fig = houseFig(seed, n), pad = n >= 5 ? 0 : fig.h * 0.06;
    // 5–9 colours have a background: it fills the box (slice), no paper band above or below (Diego, Nov 20, 2026)
    return `<svg viewBox="${-pad} ${-pad} ${fig.w + 2 * pad} ${fig.h + 2 * pad}"${n >= 5 ? ' preserveAspectRatio="xMidYMid slice"' : ''} aria-hidden="true">` +
      fig.zones.map(z => { const hex = cols[z.role]; return `<path d="${z.d}" fill="${hex}"${n < 5 && paleOnPaper(hex) ? ` stroke="var(--border)" stroke-width="${fig.h / 220}"` : ''}/>`; }).join('') + '</svg>';
  }

  // The mood map: x warm (−1) … cool (+1) across, y soft (+1) … hard (−1) down, the 16 mood words where their colours
  // sit (Organica.hueTone.WORDS). byMood: { word: [palettes] } — a disc per word, its area ∝ palettes ({} draws none).
  // withWords draws the words as text (the guide's static copy); TuneSutra lays buttons over it instead.
  const MOOD_X = x => 210 + x * 180, MOOD_Y = y => 210 - y * 180;   // a 360 square, centred in 420
  function moodSvg(byMood, withWords) {
    const max = Math.max(1, ...HT.WORDS.map(w => (byMood[w[0]] || []).length));
    let svg = '<rect x="30" y="30" width="360" height="360" fill="none" stroke="var(--border-strong)"/><line x1="30" y1="210" x2="390" y2="210" stroke="var(--border)"/><line x1="210" y1="30" x2="210" y2="390" stroke="var(--border)"/>';
    HT.WORDS.forEach(w => { const n = (byMood[w[0]] || []).length; if (n) svg += `<circle cx="${MOOD_X(w[1])}" cy="${MOOD_Y(w[2])}" r="${(6 + 34 * Math.sqrt(n / max)).toFixed(1)}" fill="currentColor" opacity="0.08"/>`; });
    svg += '<text x="210" y="20" text-anchor="middle">Soft</text><text x="210" y="410" text-anchor="middle">Hard</text>' +
      '<text x="24" y="214" text-anchor="end">Warm</text><text x="396" y="214">Cool</text>';
    if (withWords) HT.WORDS.forEach(w => { svg += `<text x="${MOOD_X(w[1])}" y="${MOOD_Y(w[2]) + 4}" text-anchor="middle" class="tf-mood-word">${esc(capWord(w[0]))}</text>`; });
    return svg;
  }

  global.TUNESUTRA_FIG = { ROLE_SETS, roleName, HARMONY_LABEL, TONE_LABEL, PURITY_LABEL, FAM_LABEL, houseFig, houseSvg, paleOnPaper, MOOD_X, MOOD_Y, moodSvg, esc, capWord };
})(typeof window !== 'undefined' ? window : globalThis);
