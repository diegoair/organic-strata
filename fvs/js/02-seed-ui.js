// Flexible Visual System · 02-seed-ui — Element panel — Seed extras, seed picker, freehand, getSeed / getPanelSeed, SVG upload.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §Architecture.
import { rt } from './rt.js';
import { hooks } from './hooks.js';
import {
  state
} from './engine/00-core.js';
import {
  INNER_APEX, withCellShape
} from './engine/01-geometry.js';
import {
  CIRCLE_PARAMS, RETIRED_PREFIX, RETIRED_SEED, SEED_EXTRAS, SEED_ICONS, SHAPE_SELECTOR, cap,
  ensureSvgNamespace, shapeToPathD, xrId
} from './engine/02-seed-ui.js';
import {
  DEFAULT_APPEARANCE, appearanceMatrix, svgToTileGeo
} from './engine/04-appearance.js';
import {
  layerPlace
} from './engine/05-render-component.js';
import {
  ctrl, val
} from './00-core.js';
import {
  SEED_TYPES
} from './01-geometry.js';

export const seedPicker = Organica.selectPicker(ctrl('sel-seed-type'), ctrl('seedtype-picker'), { registry: SEED_ICONS, ariaLabel: 'Shape' });

// Show only the rows of the active Interior / Trim mode / Lobes (dead-control rule).
export function syncCircleRows() {
  const interior = ctrl('sel-circle-interior').value, trim = ctrl('sel-circle-trim').value;
  const show = (suffix, on) => { ctrl('row-circle-' + suffix).style.display = on ? '' : 'none'; };
  show('lobedepth', val('rg-circle-lobes') >= 2);
  show('inner', interior === 'ring');
  show('ringcount', interior === 'rings'); show('ringratio', interior === 'rings');
  show('holes', interior === 'holes'); show('holesize', interior === 'holes'); show('holering', interior === 'holes');
  show('cutpos', trim === 'cut'); show('cutangle', trim === 'cut');
  show('biteradius', trim === 'bite'); show('biteoffset', trim === 'bite'); show('biteangle', trim === 'bite');
  show('slices', trim === 'slices'); show('slicegap', trim === 'slices');
}

// Every other shape follows the same dead-control rule: a row that changes nothing until another
// control moves stays hidden until then (Seed without Irregularity, a gap with one segment, a corner
// style with no corner…). One table, read after every Seed-panel edit and every load.
export const SEED_DEPENDS = [
  ['rg-arc-gap', () => val('rg-arc-segs') > 1],
  ['rg-tru-gap', () => val('rg-tru-segs') > 1],
  ['sel-poly-style', () => val('rg-poly-corner') > 0],
  ['sel-star-style', () => val('rg-star-tip') > 0 || val('rg-star-valley') > 0],
  ['sel-rr-style', () => val('rg-rr-corner') > 0],
  ['sel-rr-mask', () => val('rg-rr-corner') > 0],
  ['sel-chev-style', () => val('rg-chev-round') > 0],
  ['rg-chev-gap', () => val('rg-chev-stack') > 1],
  ['sel-cross-style', () => val('rg-cross-corner') > 0],
  ['rg-seg-cycles', () => val('rg-seg-wave') > 0],
  ['rg-seg-gap', () => val('rg-seg-dashes') > 1],
  ['rg-seg-spacing', () => val('rg-seg-lines') > 1],
  // Space X/Y squeeze each tile's copy along that axis — nothing to squeeze on a flat (or upright) bar
  ['rg-seg-spaceX', () => val('rg-seg-repeatX') > 1 && (Math.abs(val('rg-seg-angle')) !== 90 || segHasBody())],
  ['rg-seg-spaceY', () => val('rg-seg-repeatY') > 1 && (val('rg-seg-angle') !== 0 || segHasBody())],
];
export const segHasBody = () => val('rg-seg-bend') !== 0 || val('rg-seg-wave') > 0 || val('rg-seg-lines') > 1 || val('rg-seg-rays') > 1;
export function syncLegacyNote() {
  const type = ctrl('sel-seed-type').value, sd = getPanelSeed();
  const kept = RETIRED_SEED.some(([k, def]) => RETIRED_PREFIX[k.match(/^[a-z]+/)[0]] === type && sd[k] != null && sd[k] !== def);
  ctrl('seed-legacy-note').style.display = kept ? '' : 'none';
}
// Copies (ex Inner seed) follow Appearance → Cut out (Diego's option B, Oct 4, 2026). Cut out 0: the legacy
// alternating bands, Ratio = each copy's size. Cut out > 0: copies of the rim, each fitted inside the previous
// one's hole — Ratio then reads "Spacing" (how much of that hole the next copy fills) and Anchor offers only
// Inner centre / Apex (the geometry ignores Bbox / Centroid there, withInnerHollowCopies). Ratio + Anchor hide
// at Count 0. Labels and options only: the stored keys stay innerCount / innerRatio / innerAnchor.
export function syncCopiesRows() {
  const on = val('rg-inner-count') > 0, cut = val('rg-element-cutout') > 0;
  const hasApex = !!INNER_APEX[ctrl('sel-seed-type').value];
  ctrl('rg-inner-ratio').closest('.ctrl-row').style.display = on ? '' : 'none';
  ctrl('sel-inner-anchor').closest('.ctrl-row').style.display = on && (!cut || hasApex) ? '' : 'none';   // with Cut out, no apex → Inner centre is the only choice
  const lr = ctrl('lbl-inner-ratio'), lc = ctrl('lbl-inner-count');
  lr.textContent = cut ? 'Spacing' : 'Ratio';
  lr.title = cut ? 'How much of the previous copy\'s hole the next copy fills — high packs the rings close together, low spaces them out. Rings never merge.'
    : 'Each copy\'s size as a % of the previous one (70 → 70%, 49%, 34%…).';
  lc.title = cut ? 'Copies of the cut-out shape nested inside its hole, one inside the next. 0 turns it off.'
    : 'Nested copies of the shape drawn inside itself, alternating ring and gap. 0 turns it off.';
  const sel = ctrl('sel-inner-anchor');
  ['bbox', 'centroid'].forEach(v => { const o = sel.querySelector('option[value="' + v + '"]'); o.hidden = o.disabled = cut; });   // Safari ignores `hidden` on an <option> — disabled too
  // Cut out ignores Bbox / Centroid, so the select shows Inner centre meanwhile — and gives the user's own choice
  // back when Cut out returns to 0 (or another shape without it), so the classic bands never change centre by themselves.
  if (cut && (sel.value === 'bbox' || sel.value === 'centroid')) { sel.dataset.before = sel.value; sel.value = 'incentre'; }
  else if (!cut && sel.dataset.before) { if (sel.value === 'incentre') sel.value = sel.dataset.before; delete sel.dataset.before; }
  else if (cut && sel.value !== 'incentre') delete sel.dataset.before;   // picked Apex by hand: that is the choice now
}
export function syncDependentRows() {
  syncCircleRows();
  syncCopiesRows();
  hooks.syncIrregularRows();
  syncLegacyNote();
  SEED_DEPENDS.forEach(([id, on]) => {
    const el = ctrl(id), row = el && el.closest('.ctrl-row');
    if (row) row.style.display = on() ? '' : 'none';
  });
}

// Does `geoA` placed by `pa` cover the same points as `geoB` placed by `pb`? (pa/pb = appearance-shaped)
export function samePicture(geoA, pa, geoB, pb) {
  if (!geoA || !geoB || !geoA.d || !geoB.d) return false;
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden');
  const mk = g => { const el = document.createElementNS(NS, 'path'); el.setAttribute('d', g.d); if (g.fillRule) el.setAttribute('fill-rule', g.fillRule); svg.appendChild(el); return el; };
  const full = (g, a) => appearanceMatrix({ ...DEFAULT_APPEARANCE, ...a }).translate(g.normTx * g.normScale, g.normTy * g.normScale).scale(g.normScale).inverse();
  const A = mk(geoA), B = mk(geoB), ia = full(geoA, pa), ib = full(geoB, pb);
  document.body.appendChild(svg);
  let bad = 0;
  try {
    const N = 64, pt = svg.createSVGPoint();
    for (let i = 0; i < N && bad <= 2; i++) for (let j = 0; j < N; j++) {
      const x = -20 + (i + 0.5) * 140 / N, y = -20 + (j + 0.5) * 140 / N;
      const qa = ia.transformPoint({ x, y }), qb = ib.transformPoint({ x, y });
      pt.x = qa.x; pt.y = qa.y; const inA = A.isPointInFill(pt);
      pt.x = qb.x; pt.y = qb.y; const inB = B.isPointInFill(pt);
      if (inA !== inB) bad++;
    }
  } catch (e) { bad = Infinity; }
  document.body.removeChild(svg);
  return bad <= 2;   // a sample landing exactly on the outline may fall either way
}
// seed: one shape's params · place: {scale, rotate, w, l, fillMode} → the converted pair (new objects).
export function foldRetiredShape(seed, place) {
  if (!seed || !SEED_TYPES[seed.type]) return { seed, place };
  let sd = { ...seed }, pl = { ...place };
  const geo = s => { try { return SEED_TYPES[s.type].geometry(s); } catch (e) { return null; } };
  for (const [k, def, kind] of RETIRED_SEED) {
    const v = sd[k];
    if (v == null || v === def) continue;
    if (kind === 'keep') continue;
    if (kind === 'dead') { if (pl.fillMode !== 'stroke') sd[k] = def; continue; }   // fitted away by the shape itself — invisible, except as the outline's relative width
    const next = { ...sd, [k]: def }, np = { ...pl };
    if (kind === 'scale') { if (pl.fillMode === 'stroke') continue; np.scale = +((pl.scale == null ? 1 : pl.scale) * v / 100).toFixed(4); }
    else if (kind === 'length') { if (pl.fillMode === 'stroke' || pl.rotate) continue; np.l = +((pl.l == null ? 1 : pl.l) * v / 100).toFixed(4); }
    else { if (pl.rotate || (pl.w == null ? 1 : pl.w) !== (pl.l == null ? 1 : pl.l)) continue; let r = ((v % 360) + 540) % 360 - 180; np.rotate = r; }
    if (samePicture(geo(sd), pl, geo(next), np)) { sd = next; pl = np; }
  }
  return { seed: sd, place: pl };
}
// A whole snapshot: single shape → Appearance, stack → each layer's place (scale/rotate) + look (Length).
export function foldLegacySeed(seed, app) {
  if (!seed) return { seed, app };
  if (seed.type === 'stack' && Array.isArray(seed.layers)) {
    const layers = seed.layers.map(l => {
      if (!l.look) return l;   // a layer from before per-layer looks rides the Element-wide stretch — leave it as saved
      const pl0 = layerPlace(l), lk = { w: 1, l: 1, ...(l.look || {}) };
      const { seed: s2, place } = foldRetiredShape(l.seed, { scale: pl0.scale, rotate: pl0.rotate, w: lk.w, l: lk.l, fillMode: lk.fillMode || (app && app.fillMode) });
      return { ...l, seed: s2, place: { ...pl0, scale: place.scale, rotate: place.rotate }, look: { ...l.look, l: place.l } };
    });
    return { seed: { ...seed, layers }, app };
  }
  const a = { ...DEFAULT_APPEARANCE, ...(app || {}) };
  const { seed: s2, place } = foldRetiredShape(seed, a);
  return { seed: s2, app: app ? { ...app, scale: place.scale, rotate: place.rotate, l: place.l } : (place.scale !== 1 || place.rotate || place.l !== 1 ? { ...a, scale: place.scale, rotate: place.rotate, l: place.l } : app) };
}

// The Seed as a snapshot stores it: freehand also carries its editable
// path data plus the fitted geometry, so it renders with no editor present.
// Extras registry → getSeed keys (numbers for sliders, strings for selects).
export function getSeedExtras() {
  const o = {};
  Object.values(SEED_EXTRAS).forEach(sh => sh.rows.forEach(r => { const el = ctrl(xrId(sh, r)); o[r.key] = r.kind === 'select' ? el.value : parseFloat(el.value); }));
  return o;
}
// The Seed panel's own controls as ONE shape (the active layer, when the
// Element is a stack). getSeed()/seedForSnapshot() below are the stack-aware
// versions every other consumer uses.
export function panelSeedSnapshot() {
  const seed = { ...getPanelSeed(), customSeed: state.customSeed };
  if (seed.type === 'freehand') {
    seed.customSeed = state.freehand.seed;
    seed.freehandData = state.freehand.data;
    seed.freehandRaw = state.freehand.raw;
  }
  return seed;
}
export function seedForSnapshot() {
  if (!state.layers) return withCellShape(panelSeedSnapshot());
  hooks.syncActiveLayer();
  return withCellShape({ type: 'stack', active: state.layers.active, layers: state.layers.items.map(l => JSON.parse(JSON.stringify(l))) });
}

// ── Freehand Seed — Genesis Create's Paper.js draw editor, hosted on the
// Element stage. The stage shows the drawing raw (so it doesn't rescale
// under the cursor); every other step reads it fitted to the cell (the
// same bbox fit an uploaded SVG gets). One Paper editor per page.
state.freehand = { data: null, raw: '', seed: null };
export let fhEditor = null, fhSize = 0, fhSyncing = false;

export function fhFittedSeed(d) {
  if (!d) return null;
  try { return extractSeedFromSVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="' + d + '"/></svg>'); }
  catch (e) { return null; }
}
export function onFreehandChange() {
  if (!fhEditor || fhSyncing) return;
  state.freehand.data = fhEditor.serialize();
  const d = fhEditor.getPathData();
  state.freehand.raw = d;
  state.freehand.seed = fhFittedSeed(d);
  hooks.renderGallery();
  hooks.renderSeedPreview();
}
export function syncFreehandEditor() {
  const frame = ctrl('element-frame');
  const active = state.activeTier === 'element' && ctrl('sel-seed-type').value === 'freehand';
  frame.classList.toggle('drawing', active);
  if (!active) return;
  const size = frame.clientWidth;
  if (!size || (fhEditor && fhSize === size)) return;
  // Paper fixes its zoom at setup and has no resize(): rebuild at the new size.
  const data = fhEditor ? fhEditor.serialize() : state.freehand.data;
  if (fhEditor) fhEditor.destroy();
  const canvas = ctrl('fvs-draw-canvas');
  canvas.width = canvas.height = size;
  canvas.style.width = canvas.style.height = size + 'px';
  fhSyncing = true;
  fhEditor = Organica.createPaperDrawEditor(canvas, {
    strokeColor: 'transparent',
    fitBox: { x: 0, y: 0, width: 100, height: 100 },
    onChange: onFreehandChange,
  });
  fhEditor.setClosed(ctrl('ck-fh-close').checked);
  fhEditor.setSmooth(ctrl('ck-fh-smooth').checked);
  if (data) fhEditor.load(data);
  fhSyncing = false;
  fhSize = size;
}

export function getSeed() {
  return state.layers ? seedForSnapshot() : withCellShape(getPanelSeed());
}
export function getPanelSeed() {
  return { ...getSeedExtras(),
    type: ctrl('sel-seed-type').value,
    base: val('rg-base'),
    height: val('rg-height'),
    triApex: val('rg-tri-apex') * 2 - 100,   // slider is a 0–100 position (0 left corner · 50 centred · 100 right corner); stored/geometry value stays -100..100 centred, so old snapshots need no migration
    triCorner: val('rg-tri-corner'),
    triCurve: val('rg-tri-curve'),
    triIrregular: val('rg-tri-irregular'),
    triSeed: val('rg-tri-seed'),
    triOutline: val('rg-tri-outline'),
    innerCount: val('rg-inner-count'),
    innerRatio: val('rg-inner-ratio'),
    innerAnchor: ctrl('sel-inner-anchor').value,
    cutOut: val('rg-element-cutout'),
    irregular: val('rg-element-irregular'),
    irrMode: ctrl('sel-element-irrmode').value,
    irrWaves: val('rg-element-irrwaves'),
    irrSeed: val('rg-element-irrseed'),
    thickness: val('rg-thickness'),
    arcCount: val('rg-arc-count'),
    arcRatio: val('rg-arc-ratio') / 100,
    truFans: +ctrl('sel-tru-fans').value,
    truCore: val('rg-tru-core'),
    truSpread: val('rg-tru-spread'),
    truReach: val('rg-tru-reach'),
    truRamp: val('rg-tru-ramp'),
    truCurve: val('rg-tru-curve'),
    truRound: val('rg-tru-round'),
    truSegs: val('rg-tru-segs'),
    truGap: val('rg-tru-gap'),
    wedgeAngle: val('rg-wedge-angle'),
    wedgeInner: val('rg-wedge-inner'),
    wedgeSquash: val('rg-wedge-squash'),
    wedgeRound: val('rg-wedge-round'),
    wedgeRotate: val('rg-wedge-rotate'),
    wedgeCurve: val('rg-wedge-curve'),
    wedgeIrregular: val('rg-wedge-irregular'),
    wedgeSeed: val('rg-wedge-seed'),
    polySides: val('rg-poly-sides'),
    polyCorner: val('rg-poly-corner'),
    polyRotate: val('rg-poly-rotate'),
    polyStep: val('rg-poly-step'),
    polyStyle: ctrl('sel-poly-style').value,
    polyCurve: val('rg-poly-curve'),
    polyOutline: val('rg-poly-outline'),
    polySkew: val('rg-poly-skew'),
    polyIrregular: val('rg-poly-irregular'),
    polySeed: val('rg-poly-seed'),
    starPoints: val('rg-star-points'),
    starInner: val('rg-star-inner'),
    starIrregular: val('rg-star-irregular'),
    starSeed: val('rg-star-seed'),
    rrWidth: val('rg-rr-width'),
    rrHeight: val('rg-rr-height'),
    rrCorner: val('rg-rr-corner'),
    chevNotch: val('rg-chev-notch'),
    chevArm: val('rg-chev-arm'),
    chevSquash: val('rg-chev-squash'),
    crossArmWidth: val('rg-cross-armwidth'),
    crossArmLength: val('rg-cross-armlength'),
    crossCorner: val('rg-cross-corner'),
    lensWidth: val('rg-lens-width'),
    arcPivot: ctrl('sel-arc-pivot').value,
    arcSweep: val('rg-arc-sweep'),
    arcStart: val('rg-arc-start'),
    arcRound: val('rg-arc-round'),
    arcSegs: val('rg-arc-segs'),
    arcGap: val('rg-arc-gap'),
    arcTaper: val('rg-arc-taper'),
    arcIrregular: val('rg-arc-irregular'),
    arcSeed: val('rg-arc-seed'),
    polyRadius: val('rg-poly-radius'),
    starRadius: val('rg-star-radius'),
    circleRadius: val('rg-circle-radius'),
    segLen: val('rg-seg-len'),
    segWeight: val('rg-seg-weight'),
    segRound: ctrl('ck-seg-round').checked,
    dropRadius: val('rg-drop-radius'),
    dropTail: val('rg-drop-tail'),
    blobRadius: val('rg-blob-radius'),
    blobAmount: val('rg-blob-amount'),
    blobSeed: val('rg-blob-seed'),
    circleInterior: ctrl('sel-circle-interior').value,
    circleTrim: ctrl('sel-circle-trim').value,
    ...Object.fromEntries(CIRCLE_PARAMS.map(([k, id]) => [cap(k), val('rg-circle-' + id)])),
  };
}




export function extractSeedFromSVG(svgString) {
  const doc = new DOMParser().parseFromString(ensureSvgNamespace(svgString), 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid SVG file.');
  const svgRoot = doc.querySelector('svg');
  if (!svgRoot) throw new Error('No <svg> root element found.');
  const shape = svgRoot.querySelector(SHAPE_SELECTOR);
  if (!shape) throw new Error('No drawable shape (path/circle/rect/ellipse/polygon) found in this SVG.');

  const hidden = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  hidden.setAttribute('width', '0');
  hidden.setAttribute('height', '0');
  hidden.style.cssText = 'position:absolute;overflow:hidden;';
  const clone = shape.cloneNode(true);
  hidden.appendChild(clone);
  document.body.appendChild(hidden);
  let bbox;
  try { bbox = clone.getBBox(); } finally { document.body.removeChild(hidden); }
  if (!bbox || bbox.width <= 0 || bbox.height <= 0) throw new Error('Shape has no visible area.');

  const d = shapeToPathD(clone);
  if (!d) throw new Error("Could not read this shape's geometry.");

  const normScale = 100 / Math.max(bbox.width, bbox.height);
  const fitW = bbox.width * normScale, fitH = bbox.height * normScale;
  const offX = (100 - fitW) / 2, offY = (100 - fitH) / 2;
  return { d, normScale, normTx: -bbox.x + offX / normScale, normTy: -bbox.y + offY / normScale };
}

// Any SVG → the Element's custom Shape, whole: every shape united, strokes outlined, holes kept
// (svgToTileGeo — the Library's Genesis seeds, Upload SVG, the Split save). An SVG it can't read falls
// back to the first-shape reader, whose errors say what is wrong with the file.
export function useSvgAsSeed(svgString) {
  let geo = null;
  try { geo = svgToTileGeo(svgString); } catch (e) { geo = null; }
  state.customSeed = geo ? { d: geo.d, normScale: geo.normScale, normTx: geo.normTx, normTy: geo.normTy } : extractSeedFromSVG(svgString);
  let opt = ctrl('sel-seed-type').querySelector('option[value="custom"]');
  if (!opt) {
    opt = document.createElement('option');
    opt.value = 'custom'; opt.textContent = 'Custom (uploaded)';
    ctrl('sel-seed-type').appendChild(opt);
  }
  ctrl('sel-seed-type').value = 'custom'; rt.lastShapeType = 'custom';
  hooks.syncSeedUI();
  if (state.layers) { hooks.syncActiveLayer(); hooks.renderLayersUI(); }   // the active layer's card shows "Custom" at once
  ctrl('seed-upload-error').style.display = 'none';
  hooks.renderGallery();
  hooks.renderSeedPreview();
}

export function handleSeedUpload(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      useSvgAsSeed(reader.result);
    } catch (e) {
      ctrl('seed-upload-error').textContent = e.message;
      ctrl('seed-upload-error').style.display = '';
    }
  };
  reader.onerror = () => {
    ctrl('seed-upload-error').textContent = 'Could not read that file.';
    ctrl('seed-upload-error').style.display = '';
  };
  reader.readAsText(file);
}
