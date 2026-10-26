// Flexible Visual System · engine/06-component-ui — the engine part of 06-component-ui.js: model + logic, no DOM UI.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import { hooks } from '../hooks.js';
import {
  COLOR_RULES, DEFAULT_COLOR_RULE, colorRuleCR, paletteInk, pc, pv, state
} from './00-core.js';
import {
  resolveGridCells
} from './01-geometry.js';
import {
  getSeed, seedForSnapshot
} from './02-seed-ui.js';
import {
  EXHAUSTIVE_CAP, getGrid, radialEligible, resolvedComponentDims, ruleCheckerboard, ruleMirror,
  rulePinwheel, ruleRadial
} from './03-rules.js';
import {
  getElementAppearance
} from './04-appearance.js';
// The big canvas: buildComponentSVGBody's normal visual output plus an
// invisible (or, for the selected cell, outlined) hit-rect per cell —
// exactly Symbol's own data-cell-index pattern, just built as an overlay
// layer instead of threading the attribute through every <g> in the body.
export function componentEditHitLayer(items, size, picked) {
  const dims = resolvedComponentDims(size);
  const halfX = dims.w / 2, halfY = dims.h / 2;
  return items.map((it, i) => {
    const w = it.cellW || it.cellSize, h = it.cellH || it.cellSize, x = halfX + it.cx + (it.ox || 0) - w / 2, y = halfY + it.cy + (it.oy || 0) - h / 2;   // a Tile Offset moves the cell
    const sel = i === state.componentEditSelectedCell;
    const style = sel ? 'fill:transparent;stroke:var(--ink);stroke-width:3px;' : 'fill:transparent;';
    const cls = picked && picked.has(i) && !sel ? ' class="is-picked"' : '';   // picked for part colours, beside the edited cell
    if (it.poly) return `<polygon data-cell-index="${i}"${cls} points="${it.poly.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" style="${style}"/>`;   // a cell-shape lattice: the cell's own outline
    return `<rect data-cell-index="${i}"${cls} x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w}" height="${h}" style="${style}"/>`;
  }).join('');
}
export function componentCaption(comp) {
  const cells = comp.cells.slice(0, 6).map(c => c.rotation + ((c.flipH || c.flipV) ? 'f' : '')).join(' ');
  const inks = comp.layerInks ? ' · inks ' + Object.values(comp.layerInks).map(v => v === 'cell' ? 'c' : v && typeof v === 'object' ? (v.ink + 1) + '·' + v.tone : v + 1).join('/') : '';
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
// before Generate / Add component / Clear / Tile / a recipe. The Seed and every
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
  out.layers.forEach(l => { if (!(l.id in layerInks)) return; const v = layerInks[l.id]; if (v && typeof v === 'object') { l.ink = v.ink; l.tone = v.tone; } else { l.ink = v; delete l.tone; } });
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
    [[base, acc], [base, base, acc], [base, base, base, acc]].forEach(colors => Object.keys(COLOR_RULES).filter(m => m !== 'own' && m !== 'element').forEach(mode => {
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
// The Element is Freehand with nothing drawn: every candidate would be blank.
export function elementIsEmpty() {
  return pv('sel-seed-type') === 'freehand' && !state.freehand.seed;
}
export const COMPONENT_STARTER_RULES = [
  { name: 'checkerboard', fn: ruleCheckerboard },
  { name: 'pinwheel', fn: rulePinwheel },
  { name: 'mirror', fn: ruleMirror },
  { name: 'radial', fn: ruleRadial, eligible: radialEligible },
];
export function componentElementSignature() {
  return JSON.stringify({ seed: getSeed(), appearance: getElementAppearance(), cells: resolveGridCells(getGrid()).length });
}
// ── Colour groups (Diego, Oct 12, 2026) ─────────────────────────────────────────────────────────────────────
// A set of an Element's layers (plain layers, or the parts of a divided Element) that change colour TOGETHER by one
// rule, so the form they make stays one form: `l.group = id` on the members, `layers.groups[id] = {name, rule, ink}`.
// Rules: 'same' (every member on the group's ink) · 'tonal' (the group's ink, members spread on its scale light → dark,
// the top layer lightest — `l.tone`) · 'shift' (members keep their differences and move with the group's ink).
// Colour only: geometry and transforms are untouched. A layer is in one group at most.
export const COLOUR_GROUP_RULES = { same: 'Same ink', tonal: 'Tonal', shift: 'Shift together' };
// Oct 12, 2026 (Diego): the rule is chosen on the Component step and acts on the colour variants; grouping on the Element
// leaves its inks as they are. groupTone = a Tonal member's step (top lightest).
export const groupTone = (j, count) => (count === 1 ? 5 : Math.round(2 + j * 6 / (count - 1)));
// the value a group member takes when its group's ink is `base` (k = how far the base moved, for Shift together)
export function groupMemberValue(g, l, j, count, base, k, n) {
  if (g.rule === 'tonal') return { ink: base, tone: groupTone(j, count) };
  if (g.rule === 'shift') return typeof l.ink === 'number' ? ((l.ink + k) % n + n) % n : l.ink;
  return base;   // 'same'
}
export const groupMembers = (L, id) => L.items.map((l, i) => ({ l, i })).filter(x => x.l.group === id).sort((a, b) => b.i - a.i).map(x => x.l);   // top first
export function applyColourGroup(L, id, nInks) {
  const g = L.groups && L.groups[id];
  if (!g) return;
  const ms = groupMembers(L, id), n = Math.max(1, nInks);
  if (g.rule === 'same') ms.forEach(l => { l.ink = g.ink; delete l.tone; });
  else if (g.rule === 'tonal') ms.forEach((l, j) => { l.ink = g.ink; l.tone = ms.length === 1 ? 5 : Math.round(2 + j * 6 / (ms.length - 1)); });
  else if (g.rule === 'shift') {   // the members' own inks, moved by how far the group's ink moved
    const d = g.ink - (g.from == null ? g.ink : g.from);
    ms.forEach(l => { if (typeof l.ink === 'number') l.ink = ((l.ink + d) % n + n) % n; delete l.tone; });
    g.from = g.ink;
  }
}
// drop the groups left with fewer than two members (a layer deleted, the Division changed)
export function pruneColourGroups(L) {
  if (!L || !L.groups) return;
  Object.keys(L.groups).forEach(id => { const ms = groupMembers(L, id); if (ms.length < 2) { ms.forEach(l => { delete l.group; }); delete L.groups[id]; } });
  L.items.forEach(l => { if (l.group && !L.groups[l.group]) delete l.group; });
  if (!Object.keys(L.groups).length) delete L.groups;
}

// A divided Element (Diego, Oct 12, 2026 — a Polygon in 8 parts × 6 inks gave 7⁸ = 5,764,801 combinations, the first
// 512 shown): the switch is OFF by default and kept on its Division (`parts.layerInks`); ON, it gives ONE variant per
// ink — every part's ink moved along the Palette by k (a part on the cell's colour stays) — not every combination.
const dividedNow = () => !!(state.layers && state.layers.parts);
export const layerInksOn = () => (dividedNow() ? !!state.layers.parts.layerInks : pc('chk-layer-inks'));
function partInkTurns() {
  const cur = currentLayerInks(), n = state.colors.length, out = [], seen = new Set(), L = state.layers, groups = (L && L.groups) || {};
  const pos = {};   // a group member: its group, its place in it (top first), the group's size
  Object.keys(groups).forEach(id => { const ms = groupMembers(L, id); ms.forEach((l, j) => { pos[l.id] = { g: groups[id], l, j, c: ms.length }; }); });
  for (let k = 0; k < n; k++) {
    const c = {};
    Object.entries(cur).forEach(([id, ink]) => {
      const p = pos[id];
      if (p) { const base = (((p.g.ink || 0) + k) % n + n) % n; c[id] = groupMemberValue(p.g, p.l, p.j, p.c, base, k, n); }
      else c[id] = typeof ink === 'number' ? (ink + k) % n : ink;
    });
    const key = JSON.stringify(c);
    if (!seen.has(key)) { seen.add(key); out.push(c); }
  }
  return out;
}
export function layerInkCombos() {
  if (!layerInksOn()) return [];
  const layers = fillLayers();
  if (!layers.length) return [];
  if (dividedNow()) return partInkTurns();   // a turn moves every ink by the same step: a group stays a group
  // a colour group is ONE unit: its ink takes each Palette ink, its members follow its rule; the free layers vary alone
  const n = state.colors.length, L = state.layers, units = [];
  const groups = (L && L.groups) || {};
  Object.keys(groups).forEach(id => {
    const ms = groupMembers(L, id).filter(l => layers.includes(l));
    if (!ms.length) return;
    const g = groups[id];
    units.push(state.colors.map((_, k) => { const o = {}; ms.forEach((l, j) => { o[l.id] = groupMemberValue(g, l, j, ms.length, k, k - (g.ink || 0), n); }); return o; }));
  });
  layers.filter(l => !l.group || !groups[l.group]).forEach(l => units.push(['cell', ...state.colors.map((_, k) => k)].map(o => ({ [l.id]: o }))));
  let combos = [{}];
  for (const u of units) combos = combos.flatMap(c => u.map(o => ({ ...c, ...o })));
  const curKey = JSON.stringify(currentLayerInks());
  const cur = combos.findIndex(c => JSON.stringify(c) === curKey);
  if (cur > 0) combos.unshift(combos.splice(cur, 1)[0]);
  return combos;
}
export function layerInkComboCount() {
  const n = layerInksOn() ? fillLayers().length : 0;
  if (n && dividedNow()) return partInkTurns().length;
  if (!n) return 1;
  const L = state.layers, groups = (L && L.groups) || {}, layers = fillLayers();
  const gUnits = Object.keys(groups).filter(id => layers.some(l => l.group === id)).length;
  const free = layers.filter(l => !l.group || !groups[l.group]).length;
  return Math.pow(state.colors.length, gUnits) * Math.pow(state.colors.length + 1, free);
}
// geometry × combos, geometry-major, capped at EXHAUSTIVE_CAP (the total is reported).
export function expandLayerInks(list) {
  const combos = layerInkCombos();
  if (!combos.length) return { list: list.slice(0, EXHAUSTIVE_CAP), total: list.length };   // every rule stops at the cap, not only Exhaustive (Checkerboard reached 816 — Diego, Oct 15, 2026)
  const out = [];
  for (const comp of list) {
    for (let j = 0; j < combos.length && out.length < EXHAUSTIVE_CAP; j++) out.push({ ...comp, id: `${comp.id}-k${j}`, layerInks: combos[j] });
  }
  return { list: out, total: list.length * combos.length };
}
// Whichever pre-split seed is live right now (freshly snapshotted the first
// time a chip is toggled on, reused across further toggles while it's ours).
export function splitCurrentOriginal() {
  const stillOurs = state.splitOriginal && state.customSeed && state.customSeed === state.splitApplied;
  return { stillOurs, original: stillOurs ? state.splitOriginal : seedForSnapshot() };
}
