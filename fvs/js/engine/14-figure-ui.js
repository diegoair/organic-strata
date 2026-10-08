// Flexible Visual System · engine/14-figure-ui — what the Figure graph still uses of the old Figure UI's engine: the catalog,
// describeRule (rule chips), FG_HUE_TURNS (palette variations), figureChecks. The rest is test-only: 14-figure-legacy.js.
// Uses no panel control, page element or timer — only the model (state, the saved-item stores), pure Organica maths
// and the offscreen measuring helpers. Chosen mechanically at the split (Oct 2026); check.py "fvs engine" keeps it so. Map: docs/FVS.md §11.
import {
  COLOR_RULES, DEFAULT_COLOR_RULE, offscreenCanvas, pc, pv, state
} from './00-core.js';
import {
  mulberry32
} from './03-rules.js';
import {
  CW_MIN_CONTRAST, buildColourways, cwMetrics, cwSolve, getSelectedComponent
} from './06-component-ui.js';
import {
  hexKey
} from './07-library.js';
import {
  buildSymbolSVG
} from './09-symbol-render.js';
import {
  FIGURE_RECIPES_V1_AS_V2, hexFigureRecipes, isSealedSymbol, recursiveFigureRecipes, triangleFigureRecipes,
  validateFigureRecipe
} from './13-figure-engine.js';
// ── Figure tier: the form, the recipe JSON, the checks, the reference overlay ──
export const FIGURE_CLASSIC_LABELS = { circle: 'Circle from four arcs', 'leaf-block': 'Leaf block 2×2', 'leaf-wave': 'Leaf wave (tiled 2×2)', 'leaf-wave-outline': 'Leaf wave, outline', 'leaf-two-ink': 'Leaf wave, two inks (4×4)', pinwheel: 'Triangle pinwheels (3×3)', kaleidoscope: 'Arc kaleidoscope' };
export const figureCatalog = () => {
  const cat = {};
  Object.entries(triangleFigureRecipes()).forEach(([k, r]) => {
    const [a, c] = k.split(':');
    cat['Triangle · ' + { sierpinski: 'Sierpinski', trapezoid: 'Trapezoid', lattice4: 'Lattice 4' }[a] + ' · ' + { asset: 'asset', repeated: 'repeated', 'mirror-1': 'mirrored, one axis', 'mirror-2': 'mirrored, two axes' }[c]] = r;
  });
  Object.entries(FIGURE_RECIPES_V1_AS_V2).forEach(([k, r]) => { cat['Classic · ' + FIGURE_CLASSIC_LABELS[k]] = { tool: 'fvs-recipe', version: 2, ...r }; });
  Object.entries(hexFigureRecipes()).forEach(([k, r]) => { cat[k] = r; });
  Object.entries(recursiveFigureRecipes()).forEach(([k, r]) => { cat[k] = r; });
  return cat;
};
// Colour moves come from colour theory, not a fixed list: a hue turned by a harmony
// angle (OKLCH, lightness and chroma kept), a colourway of the recipe's own palette
// (COLOUR_SCHEMES — its shade scales), another colour rule. Each result is solved
// against the paper (cwSolve), so an ink never ends up unreadable.
export const FG_HUE_TURNS = [30, -30, 60, -60, 120, -120, 180];   // analogous · split · triadic · complementary
// Rule chips
export function describeRule(r) {
  const w = r.when || {}, d = r.do || {}, parts = [];
  if (w.class != null) parts.push([].concat(w.class).join('/') + ' cells');
  if (w.ring != null) parts.push('ring ' + [].concat(w.ring).join('/'));
  if (w.sector != null) parts.push('sector ' + [].concat(w.sector).join('/'));
  if (w.row != null) parts.push('row ' + [].concat(w.row).map(x => x + 1).join('/'));
  if (w.col != null) parts.push('column ' + [].concat(w.col).map(x => x + 1).join('/'));
  if (w.index != null) parts.push('cell ' + [].concat(w.index).map(x => x + 1).join('/'));
  if (w.parity != null) parts.push(w.parity + ' cells');
  const what = [];
  if (d.content === 'empty') what.push('Empty'); if (d.content === 'filled') what.push('Filled');   // the option the user picked (a Seed is a shape in FVS)
  if (d.rotate != null) what.push(d.rotate === 'sector' ? 'Rotate by sector' : 'Rotate ' + d.rotate + '°');
  if (d.flipH === false && d.flipV === false) what.push('No flip'); else { if (d.flipH != null) what.push(d.flipH ? 'Flip horizontal' : 'No flip'); if (d.flipV != null) what.push(d.flipV ? 'Flip vertical' : 'No flip'); }
  if (d.scale != null) what.push('Scale ' + Math.round(d.scale * 100) + '%');
  return (parts.length ? parts.join(' + ') : 'all cells') + ' → ' + (what.join(', ') || '—');
}
// Checks — every one reads the drawn result, none reads the recipe's own intent back.
export function figureChecks(def, svg) {
  const out = [];
  const add = (ok, label, detail) => out.push({ ok, label, detail });
  const noDefs = svg.replace(/<defs>[\s\S]*?<\/defs>/g, '');
  add(!/NaN|undefined|Infinity/.test(svg), 'Numbers are valid', '');
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]), ids = new Set([...svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
  add(refs.every(r => ids.has(r)), 'Every clip reference resolves', refs.length + ' refs');
  add((svg.match(/<metadata>/g) || []).length <= 1 && (svg.match(/<defs>/g) || []).length <= 1, 'Defs and metadata appear once', '');
  const paths = (noDefs.match(/<path /g) || []).length;
  const first = def.levels[0];
  let slots = null;
  if (isSealedSymbol(first)) {
    add(state.symbolCells.length === first.cells.length, 'Lattice has the expected number of slots', `${state.symbolCells.length} of ${first.cells.length}`);
    // a cell may hold a whole Component (many shapes): count what the Symbol itself draws
    slots = (buildSymbolSVG().replace(/<defs>[\s\S]*?<\/defs>/g, '').match(/<path /g) || []).length;
  } else if (first.kind === 'symbol') {
    const l = first.lattice, total = l.type === 'triangle' ? l.rows * l.rows : l.type === 'hexagon' ? 3 * l.rings * (l.rings - 1) + 1 : l.cols * (l.rows || l.cols);
    add(state.symbolCells.length === total, 'Lattice has the expected number of slots', `${state.symbolCells.length} of ${total}`);
    slots = state.symbolCells.filter(c => c.source !== 'empty').length;
  } else slots = getSelectedComponent() ? getSelectedComponent().cells.length : 0;
  const stats = state.figureLevelStats || [];
  const expected = stats.reduce((acc, st) => acc * st.tiles * st.copies, slots);
  add(paths === expected, 'Shapes drawn = filled slots × tiles × mirror copies (per level)', `${paths} of ${expected}`);
  add(svg.length < 400000, 'File size is reasonable', Math.round(svg.length / 1024) + ' KB');
  // colour, read from what was drawn with (the live palette after the run)
  // the inks the drawing really uses (Keep own colours, Components' own palettes), else the live palette
  const drawn = [...new Set((svg.match(/(?:fill|stroke)="#[0-9a-fA-F]{6}"/g) || []).map(m => hexKey(m.slice(m.indexOf('#'), m.indexOf('#') + 7))))].filter(h => h !== hexKey(state.paperColor));
  const cm = cwMetrics({ colors: drawn.length ? drawn : state.colors.map(hexKey), paper: state.paperColor });
  add(cm.minContrast >= CW_MIN_CONTRAST, `Inks read on the paper (${CW_MIN_CONTRAST}:1 or more)`, cm.minContrast.toFixed(1) + ':1');
  if (cm.minDeltaE != null) add(cm.minDeltaE >= Organica.color.DISTINCT_MIN, 'Inks are distinct', 'ΔE ' + Math.round(cm.minDeltaE));
  return out;
}
