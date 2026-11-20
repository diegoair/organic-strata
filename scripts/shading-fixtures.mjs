// Shared fixtures + headless loader for the shading engine tests (scripts/test-shading.mjs).
// The fixtures are the definitions TuneSutra draws: every preset of shadeDefs(), every shadow
// render (specks · dots · bands · smooth · the shade-marks textures), linear / radial / flat
// fills, the hue rules, all the parts, a transparent stop — on a fixed three-colour palette.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A context with the shared modules the engine needs (core → color → noise → shade-marks), DOM stubbed.
export function sharedContext(extra) {
  const noop = () => {};
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, setAttribute: noop, appendChild: noop, addEventListener: noop, querySelectorAll: () => [], querySelector: () => null });
  const ctx = vm.createContext({
    Math, String, Number, Object, Array, Map, Set, JSON, Error, Boolean, parseInt, parseFloat, isNaN, isFinite,
    Uint8Array, Float32Array, Float64Array, Int32Array, Uint32Array, Uint16Array, Int16Array, Uint8ClampedArray, console,
    document: { addEventListener: noop, createElement: el, documentElement: el(), body: el(), querySelector: () => null, querySelectorAll: () => [], head: el() },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, getComputedStyle: () => ({ getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false, addEventListener: noop }), addEventListener: noop, location: { pathname: '/test/', hash: '' }, navigator: {},
    setTimeout, clearTimeout, requestAnimationFrame: noop, MutationObserver: function () { return { observe: noop, disconnect: noop }; }, CustomEvent: function () {}, Event: function () {},
  });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ['core.js', 'color.js', 'noise.js', 'shade-marks.js'].concat(extra || []).forEach(f => vm.runInContext(fs.readFileSync(path.join(root, 'shared', f), 'utf8'), ctx, { filename: f }));
  ctx.Organica.contentColor = () => '#ffffff';   // the paper, fixed (the real one reads the theme)
  return ctx;
}

export const PALETTE = ['#c93ed6', '#3e7bc9', '#e8b04a'];
export const BOXES = [[60, 40], [23, 31]];

// The definitions, built from the engine's own presets (shadeDefs) so a preset change shows here too.
export function fixtures(E) {
  const out = [];
  const add = (name, def) => out.push({ name, def });
  PALETTE.forEach((hex, i) => {
    const D = E.shadeDefs(hex);
    Object.keys(D).forEach(k => add(`c${i}/${k}`, D[k]));
  });
  const D = E.shadeDefs(PALETTE[0]), sp = D.speckle, base = D.base;
  const v = (name, o, from) => add(name, Object.assign(JSON.parse(JSON.stringify(from || sp)), o));
  v('linear-smooth', { type: 'linear', angle: 45, shadow: false }, base);
  v('radial-smooth', { type: 'radial', shadow: false }, base);
  v('linear-specks', { type: 'linear', angle: 120 });
  v('radial-dots', { type: 'radial', specks: 'dots' });
  v('flat-dots', { specks: 'dots', speck: 3 });
  v('flat-bands', { specks: 'bands' });
  v('linear-bands', { type: 'linear', specks: 'bands' });
  v('linear-soft', { type: 'linear', specks: 'smooth' });
  v('linear-mottle', { type: 'linear', specks: 'mottle', speck: 3 });
  v('hue-complement', { hue: 'complement', snap: false, shift: 80 });
  v('hue-analogous', { hue: 'analogous', snap: false });
  v('hue-cool-snap', { hue: 'cool', snap: true });
  v('hue-triadic', { hue: 'triadic', snap: false, depth: 50, lose: 30, glow: 40 });
  v('parts-all', { parts: { half: false, term: true, core: true, refl: true, high: true } });
  v('no-core', { parts: { half: true, term: false, core: false, refl: false, high: false } });
  v('hand-inks', { inkMid: '#224466', inkCore: '#112233' });
  v('light-90', { light: 90, falloff: 80 });
  v('transparent-stop', { type: 'linear', shadow: false, stops: [PALETTE[0], 'transparent'] }, base);
  v('three-stops', { type: 'linear', stops: PALETTE.slice(), pos: [0, 0.3, 1], shadow: true });
  v('reverse', { type: 'linear', colourAt: 1, stops: ['#3e7bc9', PALETTE[0]] });
  return out;
}

// Legacy definitions normalizeGrad must upgrade.
export const LEGACY = [
  { type: 'conic', angle: 30, stops: ['#c93ed6', '#3e7bc9'], amount: 40, size: 4, pattern: 'dots', seed: 3 },
  { type: 'linear', stops: ['#c93ed6', '#3e7bc9'], paper: true, shadow: true, specks: 'noise', ink: '#101010', hue: 'impressionist' },
  { type: 'radial', stops: ['#e8b04a'], hue: 'warm', snap: false, kind: 'tone', amount: 30 },
  {},
];

// Everything the tests compare: plates per definition and box, inks, normalize, withColour.
export function snapshot(E, tintsOf) {
  const snap = { plates: {}, inks: {}, normalize: [], withColour: [], defs: {} };
  const ctx = { tints: [].concat.apply([], PALETTE.map(tintsOf)) };
  fixtures(E).forEach(({ name, def }) => {
    BOXES.forEach(([w, h]) => { snap.plates[name + '@' + w + 'x' + h] = E.gradPlates(JSON.parse(JSON.stringify(def)), w, h, ctx); });
    snap.inks[name] = E.shadowInks(def, def.stops[E.colourStop(def)], ctx);
  });
  PALETTE.forEach(hex => { snap.defs[hex] = E.shadeDefs(hex); });
  LEGACY.forEach(g => snap.normalize.push(E.normalizeGrad(JSON.parse(JSON.stringify(g)))));
  const wc = E.shadeDefs(PALETTE[0]);
  snap.withColour.push(E.withColour(JSON.parse(JSON.stringify(Object.assign({}, wc.base, { auto2: true }))), '#2a9d4b'));
  snap.withColour.push(E.withColour(JSON.parse(JSON.stringify(Object.assign({}, wc.base, { auto2: false }))), '#2a9d4b'));
  snap.withColour.push(E.withColour({ stops: ['#000000'] }, '#2a9d4b'));
  return JSON.parse(JSON.stringify(snap));
}
