import { openChrome } from './lib/chrome-page.mjs';
const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
const SEED = `const SH = Organica.shading, cols = ['#f2efe6', '#2a3a8c', '#e8b04a', '#c93ed6'];
  const sp = SH.withColour(JSON.parse(JSON.stringify(SH.defs(cols[1]).speckle)), cols[1]);
  Organica.store('tunesutra').write({ 'Test roles': { n: 4, colors: cols, names: ['Paper','Base','Accent','Other'], ids: ['a','b','c','d'], parts: ['background','main','accent','sub'], shades: [null, sp, null, null], house: 7 } });
  const w = ms => new Promise(r => setTimeout(r, ms));
  async function take(rowHexId){ const row = document.getElementById(rowHexId).parentNode; row.querySelector('.pal-btn').click(); await w(300);
    const it = [...document.querySelectorAll('.preset-item')].find(b => b.textContent.trim() === 'Test roles'); if (!it) return 'no item: ' + (document.querySelector('.pal-menu')||{}).innerText; it.click(); await w(500); return 'ok'; }`;
const out = {};
// Blob Boundary
await P.goto('/blob-boundary/', 'window.Organica && Organica.paletteKit');
out.blob = await P.ev(`${SEED}
  const t = await take('hex-mask');
  const svg = document.getElementById('art').outerHTML;
  return { t, bg: document.getElementById('hex-bg').value, mask: document.getElementById('hex-mask').value, dot: document.getElementById('hex-dot').value,
    shadeLen: document.getElementById('mask-shading').innerHTML.length, clip: /clip-path="url\\(#/.test(svg),
    ...(await (async () => { // the mask's shade editor: mounted, a Shading change redraws the mask
      const ed = document.querySelectorAll('#mask-shade .panel-section').length, sel = document.querySelector('#mask-shade select[aria-label="Shading"]');
      const before = document.getElementById('mask-shading').innerHTML;
      sel.value = 'dither-bayer'; sel.dispatchEvent(new Event('change', { bubbles: true })); await w(300);
      const after = document.getElementById('mask-shading').innerHTML;
      // a hand edit keeps the shading, re-coloured
      document.getElementById('hex-mask').value = '#336699'; document.getElementById('hex-mask').dispatchEvent(new Event('input', { bubbles: true })); await w(200);
      const kept = document.getElementById('mask-shading').innerHTML;
      sel.value = 'none'; sel.dispatchEvent(new Event('change', { bubbles: true })); await w(300);
      const noShadow = document.getElementById('mask-shading').innerHTML;
      return { editor: ed, shadingChanged: before !== after, handKeeps: kept.length > 0 && kept !== after, noneChanged: kept !== noShadow };
    })()) };`);
out.blobErr = P.errors.splice(0);
// Sinew
await P.goto('/sinew/', 'window.Organica && Organica.paletteKit && window.ORGANIC_FORMS');
out.sinew = await P.ev(`${SEED}
  setSource(fromSVGString(window.ORGANIC_FORMS['seed-breath'] || Object.values(window.ORGANIC_FORMS)[0]), false, 'genesis', 'g'); await w(300);
  const t = await take('hex-ink');
  const b = document.getElementById('board').innerHTML, ex = currentSVGString();
  return { t, ink: document.getElementById('hex-ink').value, bg: document.getElementById('hex-bg').value, board: /clip-path="url\\(#sns/.test(b), exp: /clip-path="url\\(#sns/.test(ex),
    editor: document.querySelectorAll('#ink-shade .panel-section').length, preset: !!stateSnapshot().inkShade };`);
out.sinewErr = P.errors.splice(0);
// Living Path
await P.goto('/livingpath/', 'window.Organica && Organica.paletteKit && window.opentype');
out.lp = await P.ev(`${SEED}
  const buf = await (await fetch('/shared/vendor/manrope-variable.ttf')).arrayBuffer();
  loadFontBuffer(buf, 'Manrope'); await w(1500);
  const t = await take('hex-bg');
  await w(500);
  try { currentSVGString(); } catch(x) { return { stack: x.stack, shade: JSON.stringify(inkShade).slice(0,300) }; }
  const b = document.getElementById('board').innerHTML, ex = currentSVGString();
  const n = (b.match(/clip-path="url\\(#lps/g)||[]).length;
  const proj = JSON.parse(projectJSON());
  // flat after a palette with no shading on main
  return { t, ink: document.getElementById('cp-ink').value, bg: document.getElementById('cp-bg').value, glyphClips: n, exp: /clip-path="url\\(#lps/.test(ex),
    editor: document.querySelectorAll('#ink-shade .panel-section').length, lvp: !!proj.inkShade };`);
out.lpErr = P.errors.splice(0);
// Colornet: synthetic image
await P.goto('/colornet/', 'window.Organica && Organica.paletteKit');
out.cn = await P.ev(`${SEED}
  const c = document.createElement('canvas'); c.width = c.height = 120; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0,0,120,0); gr.addColorStop(0,'#000'); gr.addColorStop(1,'#fff'); g.fillStyle = gr; g.fillRect(0,0,120,120);
  const img = new Image(); await new Promise(r => { img.onload = r; img.src = c.toDataURL(); });
  S.img = img; separate(false); await w(500);
  const n = S.channels.length;
  const t = await take('hex-bg');
  const svg = svgFromPlan(buildPlan(1)).svg;
  const plate = svgFromPlan({ ...buildPlan(1), items: buildPlateItems(buildPlan(1).items) }).svg;
  render();
  return { t, n, colors: S.channels.map(c => c.color), bg: S.bg, shaded: S.channels.map(c => !!c.shade), clip: /clip-path="url\\(#cns/.test(svg), plateClean: !/clip-path/.test(plate),
    notice: (document.querySelector('.org-notice')||{}).textContent || '',
    ...(await (async () => { // the selected channel's shade editor
      const host = document.getElementById('channel-shade');
      const card = document.querySelectorAll('#chan-stack .org-layer-card')[1];
      card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await w(200);
      const sel1 = S.selId === S.channels[1].id, shown = !host.hidden, ed = host.querySelectorAll('.panel-section').length;
      const sel = host.querySelector('select[aria-label="Shading"]');
      const before = svgFromPlan(buildPlan(1)).svg;
      sel.value = 'dither-bayer'; sel.dispatchEvent(new Event('change', { bubbles: true })); await w(300);
      const after = svgFromPlan(buildPlan(1)).svg;
      const ch = S.channels[1];
      ch.screenMode = 'am'; buildChannelUI(); const hiddenAm = host.hidden; ch.screenMode = 'flat'; buildChannelUI();
      // a hand edit keeps the shading
      const cp = document.querySelectorAll('#chan-stack .org-layer-card')[1].querySelector('input[type=color]');
      cp.value = '#336699'; cp.dispatchEvent(new Event('input', { bubbles: true })); await w(200);
      return { cnSel: sel1, cnShown: shown, cnEditor: ed, cnShade: S.channels[1].shade && S.channels[1].shade.specks, cnChanged: before !== after, cnHiddenAm: hiddenAm,
        cnHandKeeps: !!S.channels[1].shade && /clip-path="url\\(#cns/.test(svgFromPlan(buildPlan(1)).svg), cnLabel: (host.querySelector('.hint')||{}).textContent };
    })()) };`);
out.cnErr = P.errors.splice(0);
console.log(JSON.stringify(out, null, 1));
P.close(0);
