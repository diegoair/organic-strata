// Headless smoke for the Wash fill (Organica.shading type 'field', Nov 21, 2026) in the tools that pass their sheet:
// Trellis (each cell sees the frame in its own units) and Radial (the cells on the W×H sheet). Each: the editor offers
// Wash and Wash over; a wash over Each shape draws the same picture in every cell, over All the shapes a different
// one per cell; the SVG holds the bands; no page errors.
// Run: node --experimental-websocket scripts/test-wash-tools.mjs   — exits 1 when a check fails.
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 240000 });
let failed = 0;
const check = (label, ok, detail) => { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + label + (detail ? ' — ' + detail : '')); };
const WASH = span => `Organica.shading.normalize({ type: 'field', angle: 90, stops: ['#2a0f2e', '#d2465a', '#fbe6c2'], field: { span: '${span}' } })`;

// ── Trellis: a 4 × 4 grid, the first ink washed
await P.goto('/trellis/', 'window.Organica && document.getElementById("rmx-ink")');
await P.sleep(800);
const T = await P.ev(`
  const w = ms => new Promise(r => setTimeout(r, ms));
  loadGrid({ canvas: { width: 400, height: 400, margin: 0 }, grid: { tracks: { cols: [100, 100, 100, 100], rows: [100, 100, 100, 100] }, gap: 0, cellShape: 'rect' },
    cells: Array.from({ length: 16 }, (_, i) => ({ col: i % 4, row: i >> 2, colSpan: 1, rowSpan: 1 })) });
  await w(300);
  const ed = document.querySelector('#trellis-shade');
  const out = { wash: !!ed.querySelector('[data-seg="type"] [data-v="field"]') };
  ed.querySelector('[data-seg="type"] [data-v="field"]').click(); await w(200);
  out.typeSet = (inkShades[inkColors[0]] || {}).type;
  out.overShown = !ed.querySelector('[data-row="span"]').hidden;
  const groups = svg => (svg.match(/<g clip-path="url\\(#tsh[^"]*\\)"><g transform="[^"]*">(.*?)<\\/g><\\/g>/g) || []).map(g => g.replace(/tsh[0-9a-z]+/g, '').replace(/<g transform="[^"]*">/, ''));
  inkShades = { [inkColors[0]]: ${WASH('shape')} }; const a = groups(buildSVG());
  inkShades = { [inkColors[0]]: ${WASH('sheet')} }; const b = groups(buildSVG());
  // an animated frame changes every cell's place: All the shapes then draws every cell's piece again (not cached)
  const tA = performance.now(); for (let k = 0; k < 4; k++) { inkShades = { [inkColors[0]]: Object.assign(${WASH('sheet')}, { angle: 90 + k }) }; buildSVG(); } out.coldMs = Math.round((performance.now() - tA) / 4);
  inkShades = { [inkColors[0]]: ${WASH('sheet')} };
  out.cells = a.length; out.eachSame = new Set(a).size; out.acrossDiffer = new Set(b).size;
  out.bands = (a[0] || '').split('<path').length - 1;
  out.kb = Math.round(buildSVG().length / 1024);
  const t0 = performance.now(); renderFrameAt(0); out.canvasMs = Math.round(performance.now() - t0);
  return out;`);
check('Trellis: the editor offers Wash, and Wash over (a sheet is given)', T.wash && T.typeSet === 'field' && T.overShown, JSON.stringify({ type: T.typeSet, over: T.overShown }));
check('Trellis: Each shape = one picture in every cell', T.cells === 16 && T.eachSame === 1, T.cells + ' cells, ' + T.eachSame + ' distinct');
check('Trellis: All the shapes = a different piece per cell', T.acrossDiffer === 16, T.acrossDiffer + ' distinct, ' + T.kb + ' KB, canvas ' + T.canvasMs + ' ms, a frame redrawn from cold ' + T.coldMs + ' ms');
check('Trellis: the bands are drawn', T.bands > 20, T.bands + ' paths a cell');
check('Trellis: no page errors', !P.errors.length, P.errors.splice(0).join(' | '));

// ── Radial: Fill mode, the ink washed
await P.goto('/radial/', 'window.Organica && Organica.radial && document.getElementById("hex-ink")');
await P.sleep(800);
const R = await P.ev(`
  const w = ms => new Promise(r => setTimeout(r, ms));
  ctrl('sel-render').value = 'fill'; ctrl('sel-render').dispatchEvent(new Event('change', { bubbles: true })); await w(300);
  const hex = ctrl('hex-ink').value.toLowerCase(), out = {};
  const groups = svg => (svg.match(/<g clip-path="url\\(#rsh[^"]*\\)"><g transform="[^"]*">(.*?)<\\/g><\\/g>/g) || []).map(g => g.replace(/rsh[0-9a-z]+/g, '').replace(/<g transform="[^"]*">/, ''));
  setInkShade(Organica.shading.withColour(${WASH('shape')}, hex), hex); await w(200); const a = groups(currentSVG());
  setInkShade(Organica.shading.withColour(${WASH('sheet')}, hex), hex); await w(200); const b = groups(currentSVG());
  out.over = !document.querySelector('#ink-shade [data-row="span"]').hidden;
  out.kb0 = Math.round(currentSVG().length / 1024); setInkShade(null, hex); await w(200); out.flatKb = Math.round(currentSVG().length / 1024);
  out.cells = a.length; out.acrossDiffer = new Set(b).size; out.kb = out.kb0;
  const t0 = performance.now(); renderPreview(); out.ms = Math.round(performance.now() - t0);
  return out;`);
check('Radial: Wash over shown', R.over);
check('Radial: Each shape = a wash per cell; All the shapes = one wash clipped by every cell', R.cells > 4 && R.acrossDiffer === 1 && R.kb < 2 * R.flatKb + 300, R.cells + ' cells → ' + R.acrossDiffer + ' wash, ' + R.kb + ' KB (flat ' + R.flatKb + ' KB), preview ' + R.ms + ' ms');
check('Radial: no page errors', !P.errors.length, P.errors.splice(0).join(' | '));

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks pass');
await P.close(failed ? 1 : 0);
