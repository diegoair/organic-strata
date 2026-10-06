// Flexible Visual System · engine/06-component-ui — the engine part of 06-component-ui.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically by scripts/fvs-engine.mjs. Map: docs/FVS.md §Architecture.
import { hooks } from '../hooks.js';
import {
  COLOR_RULES, DEFAULT_COLOR_RULE, colorRuleCR, paletteInk, state
} from './00-core.js';
import {
  resolvedComponentDims
} from './03-rules.js';
// The big canvas: buildComponentSVGBody's normal visual output plus an
// invisible (or, for the selected cell, outlined) hit-rect per cell —
// exactly Symbol's own data-cell-index pattern, just built as an overlay
// layer instead of threading the attribute through every <g> in the body.
export function componentEditHitLayer(items, size) {
  const dims = resolvedComponentDims(size);
  const halfX = dims.w / 2, halfY = dims.h / 2;
  return items.map((it, i) => {
    const x = halfX + it.cx - it.cellSize / 2, y = halfY + it.cy - it.cellSize / 2;
    const sel = i === state.componentEditSelectedCell;
    const style = sel ? 'fill:transparent;stroke:var(--tool);stroke-width:3px;' : 'fill:transparent;';
    if (it.poly) return `<polygon data-cell-index="${i}" points="${it.poly.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" style="${style}"/>`;   // a cell-shape lattice: the cell's own outline
    return `<rect data-cell-index="${i}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${it.cellSize}" height="${it.cellSize}" style="${style}"/>`;
  }).join('');
}
export function componentCaption(comp) {
  const cells = comp.cells.slice(0, 6).map(c => c.rotation + ((c.flipH || c.flipV) ? 'f' : '')).join(' ');
  const inks = comp.layerInks ? ' · inks ' + Object.values(comp.layerInks).map(v => v === 'cell' ? 'c' : v + 1).join('/') : '';
  const cw = comp.colourway;
  const colour = cw ? ` · ${cw.label} · ${cw.minContrast.toFixed(1)}:1${cw.minDeltaE == null ? '' : ' · ΔE ' + Math.round(cw.minDeltaE)}` : '';
  return `${comp.ruleSource} · ${cells}${comp.cells.length > 6 ? ' …' : ''}${inks}${colour}`;
}
export function getSelectedComponent() {
  return state.components.find(c => c.id === state.selectedId) || null;
}
// Which FAMILIES entry backs each standalone named rule, so the axis-note
// below can read its requiresAxis/eligible directly — Lines/Oscillator/
// Identity/Random/Exhaustive/Manual have no entry here (Lines/Oscillator only
// take Scale, handled inline in ruleLines/ruleOscillator; the rest need no
// note at all).
export const RULE_TO_FAMILY = { pinwheel: 'pinwheel', mirror: 'mirror', diagonal: 'diagonal', checkerboard: 'checkerboard', rowmirror: 'rowmirror', columnmirror: 'columnmirror', radial: 'radial' };
// Component-tier undo: a stack of the last 20 snapshots of the gallery (the
// Components, which one is selected, and the Component the Grid tiles), taken
// before Generate / Add to gallery / Clear / Tile / a recipe. The Seed and every
// other control are left alone.
export const UNDO_MAX = 20;
export const undoStack = [];
// The Component tier's own "several different rules at once" starter gallery —
// up to STARTER_VARIANTS_PER_RULE candidates (each rule's own first N, in the
// order it already curates them) from a subset of the named rules, NOT the full
// enumeration any one rule can itself produce (that's what Generate + the
// dropdown is for). Radial only when the grid is eligible (radialEligible(),
// the same gate the Rules dropdown already applies).
export const STARTER_VARIANTS_PER_RULE = 4;
// ── Layer-ink variants (multi-layer Element) ──
// Every Fill layer can take "Follow cell colour" or any palette ink; a
// candidate carries its pick as comp.layerInks {layerId: 'cell'|slot}.
// The Element's CURRENT inks come first, so the default-selected first
// candidate paints exactly like the live Element.
export const fillLayers = () => (state.layers ? state.layers.items.filter(l => (l.role || 'fill') === 'fill' && !l.hidden) : []);
export function currentLayerInks() {
  const out = {};
  for (const l of fillLayers()) out[l.id] = l.ink == null ? 'cell' : l.ink;
  return out;
}
// A clone of the Element snapshot with a candidate's own layer inks baked in.
export function seedWithLayerInks(seed, layerInks) {
  if (!layerInks || !seed || seed.type !== 'stack') return seed;
  const out = JSON.parse(JSON.stringify(seed));
  out.layers.forEach(l => { if (l.id in layerInks) l.ink = layerInks[l.id]; });
  return out;
}
// ── Colourways (Component) ───────────────────────────────────────────────
// Colour variants of ONE component, built from the palette's main colours and
// their shade scales (Organica.color.scale — the 0…900 steps TuneSutra shows).
// The schemes are named (COLOUR_SCHEMES), not a search over every combination.
// Every result is solved: an ink that does not reach CW_MIN_CONTRAST on its
// paper moves along its own scale (hue kept) to the nearest step that does, and
// away from an ink it could be mistaken for (deltaE under DISTINCT_MIN); a
// scheme that cannot be solved is dropped. Colours stay plain hex — a palette
// is a source here, never a link. The order of the palette is the role (Base,
// Secondary, Accent…), as in TuneSutra.
export const CW_MIN_CONTRAST = 3;   // WCAG 1.4.11 — graphic objects
export const cwGround = p => (hooks.isPaperNone(p) ? '#ffffff' : hooks.hexKey(p));
export function cwSolve(inks, paper) {
  const C = Organica.color, ground = cwGround(paper), out = [];
  for (const ink of inks) {
    const twin = out.find(o => o.src === ink);   // the same main twice (a proportion) stays one colour
    if (twin) { out.push(twin); continue; }
    const clear = hex => out.every(o => C.deltaE(o.hex, hex) >= C.DISTINCT_MIN);
    let pick = C.stepFor(ink, ground, CW_MIN_CONTRAST);
    if (pick && !clear(pick.hex)) {
      const sc = C.scale(ink), at = sc.findIndex(x => x.anchor);
      pick = sc.map((x, i) => ({ hex: x.hex, d: Math.abs(i - at), c: C.contrast(x.hex, ground) }))
        .filter(x => x.c >= CW_MIN_CONTRAST && clear(x.hex)).sort((a, b) => a.d - b.d || b.c - a.c)[0];
    }
    if (!pick) return null;
    out.push({ src: ink, hex: pick.hex });
  }
  return out.map(o => o.hex);
}
export function cwMetrics(cw) {
  const C = Organica.color, ground = cwGround(cw.paper), inks = [...new Set(cw.colors)];
  let minC = Infinity, minD = Infinity, lo = 1, hi = 0;
  inks.forEach((a, i) => {
    minC = Math.min(minC, C.contrast(a, ground));
    const l = C.hexToOklch(a).l; lo = Math.min(lo, l); hi = Math.max(hi, l);
    inks.forEach((b, j) => { if (j > i) minD = Math.min(minD, C.deltaE(a, b)); });
  });
  return { minContrast: minC, minDeltaE: inks.length > 1 ? minD : null, spread: hi - lo };
}
export const cwScore = m => 0.5 * Math.min(1, (m.minContrast - 1) / 6) + 0.3 * (m.minDeltaE == null ? 1 : Math.min(1, m.minDeltaE / 40)) + 0.2 * Math.min(1, m.spread / 0.5);
// build(mains, paper, ctx) → [{ paper, colors, colorRule?, note? }], unsolved. ctx = { grid, count, rule }.
export const COLOUR_SCHEMES = {
  roles: { label: 'Roles', build: (m, paper) => m.map((_, k) => ({ paper, colors: m.slice(k).concat(m.slice(0, k)), note: k ? 'turn ' + k : '' })) },
  tonal: { label: 'Tonal', build: (m) => [...new Set(m)].slice(0, 4).map((c, k) => {
    const C = Organica.color, sc = C.scale(c), paper = sc[1].hex;
    const pass = sc.filter(x => C.contrast(x.hex, paper) >= CW_MIN_CONTRAST);   // light → dark
    const n = Math.min(m.length, pass.length);
    if (!n) return null;
    const at = n === 1 ? [Math.floor(pass.length / 2)] : Array.from({ length: n }, (_, j) => Math.round(j * (pass.length - 1) / (n - 1)));
    return { paper, colors: [...new Set(at)].reverse().map(i => pass[i].hex), note: 'colour ' + (k + 1) };   // darkest first = the Base
  }).filter(Boolean) },
  tint: { label: 'Tint ground', build: (m) => [{ paper: Organica.color.scale(m[0])[1].hex, colors: m }] },
  dark: { label: 'Dark ground', build: (m) => [{ paper: Organica.color.scale(m[0])[9].hex, colors: m }] },
  // Base everywhere, the Accent on the share of cells nearest the Accent's role share (of three roles)
  accent: { label: 'Accent', build: (m, paper, ctx) => {
    if (m.length < 2 || ctx.count < 2) return [];
    const base = m[0], acc = m[m.length >= 3 ? 2 : 1], want = Organica.color.roleShares(3)[2] / 100;
    let best = null;
    [[base, acc], [base, base, acc], [base, base, base, acc]].forEach(colors => Object.keys(COLOR_RULES).filter(m => m !== 'own').forEach(mode => {
      for (let offset = 0; offset < colors.length; offset++) {
        const rule = { mode, offset }, cr = colorRuleCR(ctx.grid, rule);
        let hit = 0;
        for (let i = 0; i < ctx.count; i++) if (paletteInk(colors, rule, i, cr) === acc) hit++;
        const share = hit / ctx.count;
        if (share <= 0 || share >= 1) continue;
        const d = Math.abs(share - want);
        if (!best || d < best.d - 1e-9) best = { d, colors, rule };
      }
    }));
    return best ? [{ paper, colors: best.colors, colorRule: best.rule }] : [];
  } },
  // the two mains that are furthest apart
  pair: { label: 'Pair', build: (m, paper) => {
    if (m.length < 3) return [];
    let best = null;
    m.forEach((a, i) => m.forEach((b, j) => { if (j > i) { const d = Organica.color.deltaE(a, b); if (!best || d > best.d) best = { d, a, b }; } }));
    return best ? [{ paper, colors: [best.a, best.b] }] : [];
  } },
};
// base = { colors, paper, colorRule }. The first entry is the base itself, as it is; then up to
// `limit - 1` solved colourways, best first (contrast on the paper, distance between inks, lightness range).
export function buildColourways(base, grid, count, limit) {
  const mains = base.colors.map(hooks.hexKey);
  const keyOf = cw => [cw.paper, cw.colors.join(','), cw.colorRule.mode, cw.colorRule.offset || 0].join('|');
  const cur = { scheme: 'current', label: 'Current', colors: mains, paper: base.paper, colorRule: { ...DEFAULT_COLOR_RULE, ...base.colorRule } };
  Object.assign(cur, cwMetrics(cur));
  const seen = new Set([keyOf(cur)]), out = [];
  Object.entries(COLOUR_SCHEMES).forEach(([id, def]) => def.build(mains, base.paper, { grid, count, rule: cur.colorRule }).forEach(raw => {
    const colors = cwSolve(raw.colors, raw.paper);
    if (!colors) return;
    const cw = { scheme: id, label: def.label + (raw.note ? ' · ' + raw.note : ''), colors, paper: raw.paper, colorRule: { ...(raw.colorRule || cur.colorRule) } };
    if (cw.colorRule.offset >= colors.length) cw.colorRule.offset = 0;
    const k = keyOf(cw);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(Object.assign(cw, cwMetrics(cw)));
  }));
  out.forEach((cw, i) => { cw._i = i; });
  out.sort((a, b) => cwScore(b) - cwScore(a) || a._i - b._i).forEach(cw => { delete cw._i; });
  return [cur, ...out.slice(0, (limit || 12) - 1)];
}
// A candidate's own colours (comp.colourway) in place of the live palette, for the length of fn.
export function withComponentColours(comp, fn) {
  const cw = comp && comp.colourway;
  if (!cw) return fn();
  const prev = { colors: state.colors, rule: state.colorRule, paper: state.paperColor };
  state.colors = cw.colors; state.colorRule = cw.colorRule; state.paperColor = cw.paper;
  try { return fn(); } finally { state.colors = prev.colors; state.colorRule = prev.rule; state.paperColor = prev.paper; }
}
export const liveColourKey = () => JSON.stringify([state.colors, state.colorRule.mode, state.colorRule.offset || 0, state.paperColor]);
export const cwColourKey = cw => JSON.stringify([cw.colors, cw.colorRule.mode, cw.colorRule.offset || 0, cw.paper]);
// The selected colourway follows the palette: editing an ink, the paper or the
// colour rule by hand turns it into a "Custom" one instead of leaving a
// thumbnail that no longer matches what Export would give.
export function syncSelectedColourway() {
  const comp = getSelectedComponent();
  if (!comp || !comp.colourway || !state.selectionExplicit || cwColourKey(comp.colourway) === liveColourKey()) return;
  const cw = { scheme: 'custom', label: 'Custom', colors: state.colors.slice(), paper: state.paperColor, colorRule: { ...state.colorRule } };
  comp.colourway = Object.assign(cw, cwMetrics(cw));
  comp.savedName = null;
}
