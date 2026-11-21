import { openChrome } from './lib/chrome-page.mjs';
const P = await openChrome({ timeoutMs: 180000 });
const out = [];
const SEED = `const S = Organica.shading, cols = ['#f4efe4', '#2a3a8c', '#e8b04a'];
  const sp = S.withColour(JSON.parse(JSON.stringify(S.defs(cols[1]).speckle)), cols[1]);
  Organica.store('tunesutra').write({ 'Test shading': { n: 3, colors: cols, names: ['Back', 'Base', 'Accent'], ids: ['c-a','c-b','c-c'], parts: ['background','main','accent'], shades: [null, sp, null], house: 42 } });`;
const PICK = `const w = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('#hex-ink').parentNode.querySelector('.pal-btn').click(); await w(300);
  const menu = document.querySelector('.pal-menu');
  const it = menu && [...menu.querySelectorAll('.preset-item, button')].find(b => b.textContent.trim() === 'Test shading');
  if (!it) return 'no menu item: ' + (menu && menu.innerText);
  it.click(); await w(600);`;
// ── Radial
await P.goto('/radial/', 'window.Organica && Organica.radial && document.getElementById("hex-ink")');
await P.sleep(800);
out.push(await P.ev(`${SEED}
  const flatSVG = document.querySelector('#frame, svg') && currentSVG();
  ${PICK}
  const r = [];
  r.push('ink ' + ctrl('hex-ink').value + ' paper ' + ctrl('hex-paper').value);
  r.push('inkShade ' + (inkShade && inkShade.specks));
  ctrl('sel-render').value = 'fill'; ctrl('sel-render').dispatchEvent(new Event('change', { bubbles: true })); await w(400);
  const svg = currentSVG();
  r.push('fill svg clip ' + (svg.match(/clip-path="url\\(#rsh/g) || []).length + ' size ' + Math.round(svg.length/1024) + 'KB');
  r.push('editor mounted ' + !!document.querySelector('#ink-shade .org-shade-editor') + ' hidden ' + ctrl('ink-shade').hidden);
  const Pp = buildParams(), prim = buildScene(Pp, SIZE, SIZE);
  const draw = PP => { const c = document.createElement('canvas'); c.width = c.height = 380; const x = c.getContext('2d'); drawSceneCanvas(x, prim, PP, 0.5); return x.getImageData(0,0,380,380).data; };
  const t0 = performance.now(); const a = draw(Pp); const t1 = performance.now(); const b = draw(Object.assign({}, Pp, { inkShade: null }));
  let d = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]) > 30) d++;
  r.push('canvas differs px ' + d + ' (' + Math.round(t1-t0) + 'ms)');
  const t2 = performance.now(); renderPreview(); r.push('preview ms ' + Math.round(performance.now() - t2));
  // preset round trip
  const st = readState(); r.push('readState inkshade ' + !!st.inkshade);
  applyPreset('Nested Polygons'); r.push('builtin preset -> inkShade ' + inkShade);
  applyState(st); r.push('applyState back -> ' + (inkShade && inkShade.specks));
  // hand edit keeps it, re-coloured
  ctrl('hex-ink').value = '#112233'; ctrl('hex-ink').dispatchEvent(new Event('input', { bubbles: true })); await w(200);
  r.push('hand edit -> inkShade ' + (inkShade && inkShade.specks) + ' svg clip ' + /clip-path="url\\(#rsh/.test(currentSVG()));
  // flat preset byte-identical check: Broken Ring flat svg has no clip
  applyPreset('Broken Ring'); r.push('flat Broken Ring clip ' + /clip-path/.test(currentSVG()));
  return r.join(' | ');`));
out.push('radial errors: ' + JSON.stringify(P.errors.splice(0))); console.log(out.join('\n'));
// ── Pulsar
await P.goto('/pulsar/', 'window.Organica && Organica.radial && document.getElementById("hex-ink")');
await P.sleep(800);
out.push(await P.ev(`
  const ctrl = id => document.getElementById(id);
  ${PICK}
  return 'pulsar ink ' + ctrl('hex-ink').value + ' paper ' + ctrl('hex-paper').value;`));
out.push('pulsar errors: ' + JSON.stringify(P.errors.splice(0)));
console.log(out.join('\n'));
await P.close(0);
