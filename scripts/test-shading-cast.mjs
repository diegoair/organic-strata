// Headless check for the CAST shadow (shared/shading.js, Nov 22, 2026 — the Shadow outside the shape; FVS draws it,
// test page explorations/cast-shadow/). Run: node scripts/test-shading-cast.mjs   — exits 1 when a check fails.
import { sharedContext, PALETTE } from './shading-fixtures.mjs';

const ctx = sharedContext(['shading.js']);
const S = ctx.Organica.shading, C = ctx.Organica.color;
const pctx = { tints: [].concat(...PALETTE.map(h => C.scale(h).map(s => s.hex))) };
let failed = 0;
function check(label, ok, detail) { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); }

const hex = PALETTE[0], square = [[[20, 20], [80, 20], [80, 80], [20, 80]]];
const base = (extra) => Object.assign(JSON.parse(JSON.stringify(S.defs(hex, pctx).speckle)), { light: 0, falloff: 50, amount: 90 }, extra || {});
const out = base({ place: 'outside', reach: 40 });

// Place
check('castOf: Inside (absent) casts nothing', S.castOf(base()) === null && S.shadesInside(base()));
check('castOf: Outside casts, shades nothing inside', S.castOf(out) === out && !S.shadesInside(out));
check('castOf: Both casts and shades inside', !!S.castOf(base({ place: 'both' })) && S.shadesInside(base({ place: 'both' })));
check('castOf: no shadow, no cast', S.castOf(Object.assign({}, out, { shadow: false })) === null);

// geometry: light from the top → the cast falls down by reach; one quad per edge not along the cast
{
  const G = S.castGeometry(square, 0, 30);
  check('geometry: the box runs from the shape down by reach', G && G.box.x === 20 && G.box.y === 20 && G.box.w === 60 && Math.abs(G.box.h - 90) < 1e-9, G && JSON.stringify(G.box));
  check('geometry: the two vertical edges sweep nothing', G && G.quads.length === 2, G && G.quads.length + ' quads');
  check('geometry: reach 0 is no cast', S.castGeometry(square, 0, 0) === null);
}

// plates: only the shadow's two inks, never the colour; every mark outside the shape, within reach, below it
{
  const R = S.castPlates(out, hex, square, { ctx: pctx }), reach = 0.4 * Math.hypot(60, 60);
  const inks = S.shadowInks(out, hex, pctx).map(h => h.toLowerCase());
  check('plates: only the Halftone and Core inks', R && R.plates.length > 0 && R.plates.every(p => inks.includes(String(p.hex).toLowerCase())), R && R.plates.map(p => p.hex).join(' '));
  let inside = 0, beyond = 0, n = 0;
  (R ? R.plates : []).forEach(p => String(p.d).replace(/M(-?[\d.]+) (-?[\d.]+)/g, (m, x, y) => {
    const X = R.box.x + +x, Y = R.box.y + +y; n++;
    if (X > 20.01 && X < 79.99 && Y > 20.01 && Y < 79.99) inside++;
    if (Y > 80 + reach + 2) beyond++;
    return m;
  }));
  check('plates: no mark under the shape', n > 0 && inside === 0, n + ' marks, ' + inside + ' inside');
  check('plates: no mark past reach', beyond === 0, beyond + ' beyond');
  check('plates: cached', S.castPlates(out, hex, square, { ctx: pctx }) === R);
  const far = S.castPlates(Object.assign({}, out, { reach: 80 }), hex, square, { ctx: pctx });
  check('plates: a longer reach, a taller box', far && far.box.h > R.box.h);
}

// every texture draws a cast (and Soft is one smooth plate)
{
  const D = S.defs(hex, pctx), bad = [];
  ['speckle', 'soft'].concat(S.TEXTURES).forEach(t => {
    const R = S.castPlates(Object.assign({}, D[t], { place: 'outside', light: 315 }), hex, square, { ctx: pctx });
    if (!R || !R.plates.length) bad.push(t);
  });
  check('every texture casts', !bad.length, bad.join(', '));
  const soft = S.castPlates(Object.assign({}, D.soft, { place: 'outside' }), hex, square, { ctx: pctx });
  check('Soft: one smooth plate', soft && soft.plates.length === 1 && !!soft.plates[0].smooth);
}

// SVG: a clip of the quads, the plates in the box
{
  const svg = S.castSVG(out, hex, square, { ctx: pctx, idPrefix: 't' });
  check('castSVG: clipPath of the quads + plates', /<clipPath id="t[^"]+"><path d="M/.test(svg) && (svg.match(/<clipPath/g) || []).length === 1 && svg.includes('translate(20,20)'));
  check('castSVG: Inside draws nothing', S.castSVG(base(), hex, square, { ctx: pctx }) === '');
}

// a ring (a hole): the cast reaches into the hole, never onto the ring itself
{
  const circle = (r, n) => Array.from({ length: n }, (_, i) => [50 + r * Math.cos(i / n * 2 * Math.PI), 50 + r * Math.sin(i / n * 2 * Math.PI)]);
  const ring = [circle(40, 64), circle(20, 48)];
  const R = S.castPlates(Object.assign({}, out, { light: 0 }), hex, ring, { ctx: pctx });
  let onRing = 0, inHole = 0;
  R.plates.forEach(p => String(p.d).replace(/M(-?[\d.]+) (-?[\d.]+)/g, (m, x, y) => {
    const X = R.box.x + +x + 0.5, Y = R.box.y + +y + 0.5, d = Math.hypot(X - 50, Y - 50);
    if (d > 21.5 && d < 38.5) onRing++;
    if (d < 18) inHole++;
    return m;
  }));
  check('ring: no mark on the ring', onRing === 0, onRing + ' on the ring');
  check('ring: the cast reaches into the hole', inHole > 0, inHole + ' in the hole');
}

// normalize keeps a valid cast and drops a broken one; a palette saved before stays as it was
{
  const n = S.normalize(Object.assign({}, out, { fall: 'shapes', edge: 'cell' }));
  check('normalize keeps Place, Reach, Falls on, Cell edge', n.place === 'outside' && n.reach === 40 && n.fall === 'shapes' && n.edge === 'cell');
  const b = S.normalize(Object.assign({}, out, { place: 'nowhere', reach: -3, fall: 'x', edge: 'y' }));
  check('normalize drops what is not valid', !('place' in b) && !('reach' in b) && !('fall' in b) && !('edge' in b));
  check('normalize adds nothing to an old palette', !('place' in S.normalize(base())));
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
process.exit(failed ? 1 : 0);
