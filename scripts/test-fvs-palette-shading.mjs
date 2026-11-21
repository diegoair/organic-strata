#!/usr/bin/env node
// FVS · a TuneSutra palette taken whole (Nov 20, 2026 — Diego: "poterle caricare con tutti i loro shadow, grain e parametri …
// modificare i colori tramite il picker … salvarla"). The Palette menu lists TuneSutra's saved palettes; taking one sets
// the inks AND each ink's shading (state.inkShades); every shape of a shaded ink draws Organica.shading's plates in its
// own box, clipped to it; editing the colour keeps its shading; the Gradient + Shadow editor changes it; Save as palette…
// writes a NEW TuneSutra palette (the original never changes); a flat Palette draws exactly as before.
// Usage: node --experimental-websocket scripts/test-fvs-palette-shading.mjs
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  const S = Organica.shading, cols = ['#2a3a8c', '#e8b04a', '#c93ed6'];
  const sp = S.withColour(JSON.parse(JSON.stringify(S.defs(cols[0]).speckle)), cols[0]);
  const pol = S.withColour(JSON.parse(JSON.stringify(S.defs(cols[2])['pollen-dot'])), cols[2]);
  const ts = Organica.store('tunesutra');
  ts.write({ 'Test shading': { n: 3, colors: cols, names: ['Base', 'Secondary', 'Accent'], ids: ['c-a', 'c-b', 'c-c'], parts: ['main', 'sub', 'accent'], shades: [sp, null, pol], house: 42 } });
  F.setTier('element'); await w(300);
  // a flat Palette: the markup of before (no shading drawn)
  const flat = F.buildSeedPreviewSVG(F.getSeed(), 0, false, false, 200);
  check('a flat Palette draws no shading', !/clip-path="url\\(#shd/.test(flat) && Object.keys(F.state.inkShades).length === 0, flat.slice(0, 80));
  // the menu: TuneSutra's saved palettes, grouped
  [...document.querySelectorAll('#fvs-palette button')].pop().click(); await w(300);
  const menu = document.querySelector('.pal-menu');
  check('the Palette menu lists Saved, with the TuneSutra palette', menu && !menu.hidden && /Saved/.test(menu.innerText) && /Test shading/.test(menu.innerText) && !/Riso/.test(menu.innerText), menu && menu.innerText);
  [...menu.querySelectorAll('.preset-item')].find(b => b.textContent === 'Test shading').click(); await w(500);
  check('taken whole: its colours', JSON.stringify(F.state.colors) === JSON.stringify(cols), JSON.stringify(F.state.colors));
  check('…and each colour\\'s own shading', F.state.inkShades[cols[0]] && F.state.inkShades[cols[0]].specks === 'specks' && F.state.inkShades[cols[2]].specks === 'pollen-dot' && !F.state.inkShades[cols[1]], JSON.stringify(Object.keys(F.state.inkShades)));
  const chips = [...document.querySelectorAll('#fvs-palette .rmx-color')].map(c => /data:image/.test(c.style.backgroundImage));
  check('a shaded chip shows its shading, a flat one is flat', chips.join() === 'true,false,true', chips.join());
  // the Element: its shape draws the plates in its own box, clipped to it — every plate an ink path
  const el = F.buildSeedPreviewSVG(F.getSeed(), 0, false, false, 200);
  const inks = S.shadowInks(F.state.inkShades[cols[0]], cols[0], { tints: [] });
  check('the shape draws its shadow (a clip to the shape + the shadow inks as fill paths)', /clipPath id="shd/.test(el) && /clip-path="url\\(#shd/.test(el) && (el.match(/<path fill="#[0-9a-f]{6}" fill-rule="evenodd"/g) || []).length >= 2, el.length);
  // a Component of four cells: the shading in every cell, the same plates (cached)
  F.setTier('component'); await w(400); q('btn-generate').click(); await w(1000);
  const comp = F.state.components[0], grid = { kind: 'square', cols: 2, rows: 2, cellSize: 100, gap: 0 };
  const csvg = F.buildComponentSVG(F.buildComponentItems(comp, grid), F.getSeed(), 200);
  check('a Component: the shading in its cells', (csvg.match(/clip-path="url\\(#shd/g) || []).length >= 4, (csvg.match(/clip-path="url\\(#shd/g) || []).length);
  // canvas twin: draws without error and paints the halftone / core inks
  { const draw = () => { const c = document.createElement('canvas'); c.width = c.height = 200; const x = c.getContext('2d'); F.drawComponentCanvas(x, F.buildComponentItems(comp, grid), F.getSeed(), 200); return x.getImageData(0, 0, 200, 200).data; };
    let err = '', diff = 0;
    try { const a = draw(), keep = F.state.inkShades; F.state.inkShades = {}; const b = draw(); F.state.inkShades = keep;
      for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) diff++; } catch (e) { err = e.message; }
    check('the canvas draws the shading too (' + diff + ' px differ from flat)', !err && diff > 200, err || diff); }
  // a saved Component keeps the Palette's shading
  const entry = F.libraryEntryFromLive(comp);
  check('a saved Component carries the shading (inkShades)', entry.inkShades && entry.inkShades[cols[0]] && entry.inkShades[cols[0]].specks === 'specks', JSON.stringify(Object.keys(entry.inkShades || {})));
  // a Symbol of saved Components and a saved Element, with ANOTHER Palette: each cell draws its entry's own shading
  // (Diego, Nov 20, 2026: "non vedo gli element e component con le shadow")
  { F.quickSaveComponentToLibrary(comp.id, 'Shaded comp'); await w(200);
    F.setTier('element'); await w(300);
    F.saveElementVariant(0, false, false, 'Shaded', 'Shaded element'); await w(200);
    const eSaved = JSON.parse(localStorage.getItem('organica.fvs-element.presets') || '{}')['Shaded element'];
    check('a saved Element carries the shading (inkShades)', eSaved && eSaved.inkShades && eSaved.inkShades[cols[0]], JSON.stringify(eSaved && Object.keys(eSaved.inkShades || {})));
    F.setTier('symbol'); await w(500);
    const keep = F.state.inkShades; F.state.inkShades = {};   // the Symbol's own Palette: flat
    const model = await F.symbolGridModel('rectangular', { cols: 2, rows: 1 }, { ...F.readSymbolCanvas(), margin: 0 }); F.loadSymbolGrid(model); await w(300);
    const was = F.state.colorRule.mode; F.state.colorRule = { ...F.state.colorRule, mode: 'element' };
    F.patchCell(F.state.symbolCells[0], F.railPatch('component', 'Shaded comp'));
    F.patchCell(F.state.symbolCells[1], F.railPatch('element', 'Shaded element'));
    const sv = F.buildSymbolSVG(), n = (sv.match(/clip-path="url\\(#shd/g) || []).length;
    check('Symbol: a saved Component and a saved Element draw their shading on a flat Palette (' + n + ')', n >= 5, n);
    // on the Symbol step a shadow changed is one Undo step (Diego, Nov 20, 2026: "prova in symbol a cambiare colori e shadows")
    F.state.inkShades = keep; F.state.colorRule = { ...F.state.colorRule, mode: 'index' }; F.renderSymbol(); await w(700);
    const sel = q('fvs-shade').querySelector('select[aria-label="Shading"]'); document.querySelector('#fvs-palette .rmx-color__pick').click(); await w(150); Organica.colorPicker.close();
    const was0 = sel.value; sel.value = 'cells'; sel.dispatchEvent(new Event('change', { bubbles: true })); await w(700);
    const hex0 = F.state.colors[0], mid = (F.state.inkShades[hex0] || {}).specks;
    q('btn-board-undo-symbol').click(); await w(700);
    check('Symbol: a shadow changed, then Undo — back to the shadow before, the colours kept', mid === 'cells' && (F.state.inkShades[hex0] || {}).specks === (was0 === 'speckle' ? 'specks' : undefined) && F.state.colors[0] === hex0 && sel.value === was0, was0 + ' → ' + mid + ' → ' + ((F.state.inkShades[hex0] || {}).specks) + ' / ' + sel.value);
    F.state.colorRule = { ...F.state.colorRule, mode: was }; F.state.inkShades = keep;
    F.setTier('element'); await w(300); }
  // the colour edited in the picker: its shading follows it
  document.querySelector('#fvs-palette .rmx-color__pick').click(); await w(200);
  { const x = document.querySelector('.org-cpick__hex'); x.value = '#1c6b3a'; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); Organica.colorPicker.close(); await w(400); }
  const moved = F.state.inkShades['#1c6b3a'];
  check('a colour edited keeps its shading, on the new colour', moved && moved.specks === 'specks' && moved.stops[S.colourStop(moved)] === '#1c6b3a' && !F.state.inkShades[cols[0]], JSON.stringify(Object.keys(F.state.inkShades)));
  // the editor: the chip opened last; a texture picked there
  const host = q('fvs-shade'), sel = host.querySelector('select[aria-label="Shading"]');
  check('the Gradient + Shadow editor shows the colour\\'s shadow', !!host.querySelector('.org-shade-editor') && sel.value === 'speckle', sel && sel.value);
  sel.value = 'camo-maze'; sel.dispatchEvent(new Event('change', { bubbles: true })); await w(300);
  check('Shadow › Maze changes that colour\\'s shading', F.state.inkShades['#1c6b3a'].specks === 'camo-maze', F.state.inkShades['#1c6b3a'].specks);
  sel.value = 'none'; sel.dispatchEvent(new Event('change', { bubbles: true })); await w(300);
  check('Shadow › None, Gradient Flat: no shading left (flat again)', !F.state.inkShades['#1c6b3a'], JSON.stringify(F.state.inkShades['#1c6b3a'] || null));
  sel.value = 'cells'; sel.dispatchEvent(new Event('change', { bubbles: true })); await w(300);
  // Save as palette…: a NEW palette, the original unchanged
  const before = JSON.stringify(ts.read()['Test shading']);
  [...document.querySelectorAll('.row-btns .mini-btn')].find(b => /^Save as palette/.test(b.textContent)).click(); await w(300);
  const dlg = [...document.querySelectorAll('.org-modal')].find(d => d.getAttribute('aria-label') === 'Save as palette');
  const proposed = dlg && dlg.querySelector('input').value;
  check('Save as palette… proposes "<name> · Flexible Visual System"', proposed === 'Test shading · Flexible Visual System', proposed);
  dlg.querySelector('[data-ok]').click(); await w(400);
  const all = ts.read(), rec = all['Test shading · Flexible Visual System'];
  check('…a new TuneSutra palette with the edited colour and its shading', rec && rec.colors[0] === '#1c6b3a' && rec.shades[0].specks === 'cells' && rec.shades[2].specks === 'pollen-dot' && rec.house === 42 && /^pal-/.test(rec.pid), JSON.stringify(rec && rec.shades.map(s => s && s.specks)));
  check('…and the original never changes', JSON.stringify(all['Test shading']) === before);
  check('only one Save as palette… under the strip', document.querySelectorAll('[data-pal-save]').length === 1, document.querySelectorAll('[data-pal-save]').length);
  // the Element keeps its Palette's shading (the board's save)
  document.body.click(); await w(1500);
  const els = JSON.parse(localStorage.getItem('organica.fvs-elements.presets') || '{}'), act = els[F.state.activeElement];
  check('the Element saves its Palette with the shading', act && act.palette && act.palette.shades && act.palette.shades['#1c6b3a'] && act.palette.shades['#1c6b3a'].specks === 'cells', JSON.stringify(act && act.palette));
  // the layers of an Element, one by one (Diego, Nov 20, 2026: "un test di debug sui singoli layers degli elements"):
  // each fill layer takes its own ink's shading in its own box; a flat ink, a Tonal step, a hidden layer, a Stroke or a
  // Pattern layer draws none; a mask still cuts the shading; the canvas matches the SVG pixel for pixel
  { const S2 = Organica.shading, lc = ['#2a3a8c', '#e8b04a', '#c93ed6'];
    F.setTier('element'); await w(300);
    while (F.state.layers && F.state.layers.items.length > 1) { F.removeLayer(F.state.layers.items.length - 1); await w(100); }
    q('btn-layer-add').click(); await w(250); q('btn-layer-add').click(); await w(250); q('btn-layer-add').click(); await w(250);
    F.state.colors = lc.slice();
    const L = F.state.layers.items;
    L[0].ink = 'cell'; L[1].ink = 1; L[1].place = { mx: 20, my: 0, scale: 0.5, rotate: 0 }; L[2].ink = 2; L[2].place = { mx: -25, my: 20, scale: 0.4, rotate: 30 }; L[3].ink = 0; L[3].place = { mx: 10, my: -25, scale: 0.35, rotate: 0 };
    F.state.inkShades = { [lc[0]]: S2.withColour(JSON.parse(JSON.stringify(S2.defs(lc[0]).speckle)), lc[0]), [lc[2]]: S2.withColour(JSON.parse(JSON.stringify(S2.defs(lc[2])['pollen-dot'])), lc[2]) };
    F.layersChanged(); await w(300);
    const shd = () => { const s = F.buildSeedPreviewSVG(F.getSeed(), 0, false, false, 300); return { n: s.split('url(#shd').length - 1, s }; };
    const where = s => { const d = new DOMParser().parseFromString(s, 'image/svg+xml'); return [...d.querySelectorAll('clipPath[id^="shd"] > path')].map(p => (p.getAttribute('transform') || '').split(' ')[0]); };
    const a = shd();
    check('layers: the cell-ink layer, Ink 3 and Ink 1 draw their shading; Ink 2 (flat) none (' + a.n + ')', a.n === 3 && !where(a.s).includes('translate(70.000,50.000)'), where(a.s).join(' '));
    L[1].ink = 0; L[1].tone = 3; F.layersChanged(); await w(200);
    check('layers: a Tonal step of a shaded ink draws no shading (another colour)', shd().n === 3, shd().n);
    delete L[1].tone; L[1].ink = 1;
    L[2].hidden = true; F.layersChanged(); await w(200);
    check('layers: a hidden shaded layer draws no shading', shd().n === 2, shd().n);
    delete L[2].hidden;
    L[1].role = 'mask'; F.layersChanged(); await w(200);
    const m = shd().s;
    check('layers: a mask layer cuts the shading of the layers below it too', (() => { const d = new DOMParser().parseFromString(m, 'image/svg+xml'), g = [...d.querySelectorAll('g[mask]')].pop(); return !!g && !!g.querySelector('g[clip-path^="url(#shd"]'); })(), m.length);
    L[1].role = 'fill'; F.layersChanged(); await w(200);
    // Style of the top layer (the active one) through the panel: Stroke, then Pattern
    F.selectLayer(3); await w(200);
    const st = q('sel-element-fillmode'), setStyle = async v => { st.value = v; st.dispatchEvent(new Event('change', { bubbles: true })); await w(400); };
    await setStyle('stroke');
    check('layers: a Stroke layer of a shaded ink draws no shading', shd().n === 2, shd().n + ' / ' + JSON.stringify(F.layerLook ? F.layerLook(L[3], F.getElementAppearance()).fillMode : ''));
    await setStyle('pattern');
    check('layers: a Pattern layer of a shaded ink draws no shading', shd().n === 2, shd().n);
    await setStyle('fill');
    // canvas = SVG, pixel for pixel, in the overlap of two shaded layers
    const s0 = shd().s, svgNow = s0.indexOf('xmlns') > 0 ? s0 : s0.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(new Blob([svgNow], { type: 'image/svg+xml' })); });
    const ca = document.createElement('canvas'); ca.width = ca.height = 300; ca.getContext('2d').drawImage(img, 0, 0); const A = ca.getContext('2d').getImageData(0, 0, 300, 300).data;
    const cb = document.createElement('canvas'); cb.width = cb.height = 300;
    F.drawComponentCanvas(cb.getContext('2d'), F.buildComponentItems({ cells: [{ rotation: 0, flipH: false, flipV: false, scale: 1 }] }, { kind: 'square', cols: 1, rows: 1, cellSize: 300, gap: 0 }), F.getSeed(), 300);
    const B = cb.getContext('2d').getImageData(0, 0, 300, 300).data;
    let diff = 0; for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 60) diff++;
    const px = (D, ux, uy) => { const k = (Math.round(uy * 3) * 300 + Math.round(ux * 3)) * 4; return '#' + [D[k], D[k + 1], D[k + 2]].map(v => v.toString(16).padStart(2, '0')).join(''); };
    const core = S2.shadowInks(F.state.inkShades[lc[0]], lc[0], { tints: [].concat.apply([], lc.map(h => Organica.color.scale(h).map(x => x.hex))) })[1];
    check('layers: canvas = SVG (' + diff + ' px differ), one light across the whole Element', diff < 900 && px(A, 65, 40) === px(B, 65, 40), diff + ' · ' + px(A, 65, 40) + ' / ' + px(B, 65, 40));
    // the boxes the shading is laid out in: one for the whole Element (default) — Light › Each layer, every layer its own
    const boxes = s => { const d = new DOMParser().parseFromString(s, 'image/svg+xml'); return [...d.querySelectorAll('g[clip-path^="url(#shd"] > g[transform]')].map(g => g.getAttribute('transform')); };
    const uniq = a => a.filter((v, k) => a.indexOf(v) === k).length;
    check('Light: shown for a shaded stack, Whole element by default', !q('layer-light-row').hidden && q('seg-layer-light').querySelector('.active').dataset.v === 'element', q('layer-light-row').hidden);
    check('Light › Whole element: every shaded layer in the one box of the Element', uniq(boxes(shd().s)) === 1, boxes(shd().s).join(' '));
    q('seg-layer-light').querySelector('[data-v="layer"]').click(); await w(300);
    check('Light › Each layer: every shaded layer in its own box (saved on the layers)', F.state.layers.light === 'layer' && F.getSeed().light === 'layer' && uniq(boxes(shd().s)) === 3, boxes(shd().s).join(' '));
    { const s1 = shd().s, sv = s1.indexOf('xmlns') > 0 ? s1 : s1.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(new Blob([sv], { type: 'image/svg+xml' })); });
      const c1 = document.createElement('canvas'); c1.width = c1.height = 300; c1.getContext('2d').drawImage(im, 0, 0); const A1 = c1.getContext('2d').getImageData(0, 0, 300, 300).data;
      const c2 = document.createElement('canvas'); c2.width = c2.height = 300;
      F.drawComponentCanvas(c2.getContext('2d'), F.buildComponentItems({ cells: [{ rotation: 0, flipH: false, flipV: false, scale: 1 }] }, { kind: 'square', cols: 1, rows: 1, cellSize: 300, gap: 0 }), F.getSeed(), 300);
      const B1 = c2.getContext('2d').getImageData(0, 0, 300, 300).data;
      check('Light › Each layer: canvas = SVG; the top layer’s own shadow over the gold one below', px(A1, 65, 40) === core && px(B1, 65, 40) === core, px(A1, 65, 40) + ' / ' + px(B1, 65, 40) + ' want ' + core); }
    q('seg-layer-light').querySelector('[data-v="element"]').click(); await w(300);
    check('Light › Whole element again: no key left on the layers', !('light' in F.state.layers) && !('light' in F.getSeed()), JSON.stringify(F.state.layers.light));
    while (F.state.layers && F.state.layers.items.length > 1) { F.removeLayer(F.state.layers.items.length - 1); await w(100); }
    // a divided Element: one light across its parts (the Element's box), Each layer = every part its own
    const t = q('sel-seed-type'); t.value = 'polygon'; t.dispatchEvent(new Event('change', { bubbles: true })); await w(400);
    const pm = q('sel-part-method'); pm.value = 'fan'; pm.dispatchEvent(new Event('change', { bubbles: true })); await w(600);
    F.state.colors = lc.slice(); F.layersChanged(); await w(300);
    const parts = (F.state.layers ? F.state.layers.items : []).filter(l => l.part).length, ps = shd();
    check('layers: a divided Element — its ' + parts + ' parts draw the shading in one box, the Element’s', parts >= 3 && ps.n === parts && uniq(boxes(ps.s)) === 1, ps.n + ' / ' + parts + ' · ' + uniq(boxes(ps.s)));
    q('seg-layer-light').querySelector('[data-v="layer"]').click(); await w(300);
    check('layers: a divided Element with Each layer — every part in its own box', uniq(boxes(shd().s)) === parts, uniq(boxes(shd().s)) + ' / ' + parts);
    q('seg-layer-light').querySelector('[data-v="element"]').click(); await w(300);
    pm.value = 'none'; pm.dispatchEvent(new Event('change', { bubbles: true })); await w(400);
    F.state.inkShades = {}; }
  // a colourway (Recolour, the Figure's Palette node) keeps the shading by place: colour n takes colour n's
  { const S3 = Organica.shading, pc = ['#2a3a8c', '#e8b04a', '#c93ed6'], cw = ['#aa2222', '#22aa88', '#3355cc'];
    F.setTier('element'); await w(300);
    F.state.colors = pc.slice(); F.state.inkShades = { [pc[0]]: S3.withColour(JSON.parse(JSON.stringify(S3.defs(pc[0]).speckle)), pc[0]) };
    F.layersChanged(); await w(200);
    const fm = F.shadesFollow(pc, F.state.inkShades, cw);
    check('a colourway: colour 1 takes colour 1’s shading, on its own colour; the flat ones stay flat', fm && fm['#aa2222'] && fm['#aa2222'].specks === 'specks' && fm['#aa2222'].stops[S3.colourStop(fm['#aa2222'])] === '#aa2222' && !fm['#22aa88'], JSON.stringify(fm && Object.keys(fm)));
    const svg = F.withComponentColours({ colourway: { colors: cw, colorRule: { mode: 'index', offset: 0 }, paper: '#ffffff' } }, () => F.buildSeedPreviewSVG(F.getSeed(), 0, false, false, 200));
    check('a colourway draws its colours shaded (Component › colourways)', svg.indexOf('url(#shd') > 0 && svg.indexOf('#aa2222') > 0 && F.state.colors[0] === pc[0] && F.state.inkShades[pc[0]], svg.length);
    F.state.inkShades = {}; }
  // Nov 20, 2026 (Diego: "le palette starred and saved devono arrivare con tutto"): a palette saved with a Shading on
  // the house arrives with it on every colour of its own; a starred one arrives with its base set; the shared editor's
  // stop bar and Use on every colour
  { const S4 = Organica.shading, pc = ['#2a3a8c', '#e8b04a', '#c93ed6'];
    F.setTier('element'); await w(300);
    while (F.state.layers && F.state.layers.items.length > 1) { F.removeLayer(F.state.layers.items.length - 1); await w(100); }
    const all = ts.read(); all['House speckle'] = { n: 3, colors: pc, shading: 'speckle', house: 7 }; ts.write(all);
    Organica.store('tunesutra-favs').write({ 'l:test': { name: 'A star', colors: ['#d94e66', '#f2c14e', '#1f6f8b'], house: 9 } });
    const pick = async name => { [...document.querySelectorAll('#fvs-palette button')].pop().click(); await w(300); [...document.querySelector('.pal-menu').querySelectorAll('.preset-item')].find(b => b.textContent === name).click(); await w(500); };
    await pick('House speckle');
    check('a palette saved with Shading › Speckle arrives with it on every colour', pc.every(h => F.state.inkShades[h] && F.state.inkShades[h].specks === 'specks'), JSON.stringify(Object.keys(F.state.inkShades)));
    const st = Organica.palettes.get('star:l:test');
    check('a starred palette arrives whole: tints, role names, its base set (Soft, Speckle) per colour', st && st.shading === 'none' && st.colours.every(c => c.tints[500] && c.set.soft && c.set.speckle && c.set.speckle.specks === 'specks') && st.colours[0].name === 'Base', JSON.stringify(st && st.colours[0].set && Object.keys(st.colours[0].set)));
    await pick('A star');
    check('…taken from the menu: its colours, flat', F.state.colors[0] === '#d94e66' && !Object.keys(F.state.inkShades).length, JSON.stringify(F.state.inkShades));
    const host = q('fvs-shade'), ssel = host.querySelector('select[aria-label="Shading"]');
    ssel.value = 'pollen-dot'; ssel.dispatchEvent(new Event('change', { bubbles: true })); await w(300);
    host.querySelector('[data-act="every"]').click(); await w(400);
    check('Use on every colour: this colour’s Shading on all of them, each on its own colour', F.state.colors.every(h => F.state.inkShades[h] && F.state.inkShades[h].specks === 'pollen-dot' && F.state.inkShades[h].stops[S4.colourStop(F.state.inkShades[h])] === h), JSON.stringify(Object.keys(F.state.inkShades)));
    // the stop bar: Linear shows it; a click on the bar adds a stop, Delete on a stop removes it (and never reaches the board)
    host.querySelector('[data-seg="type"] [data-v="linear"]').click(); await w(300);
    const bar = host.querySelector('.org-stopbar'), h0 = F.state.colors[0];
    check('the stop bar shows with a Linear gradient, one knob per stop', !host.querySelector('[data-block="stops"]').hidden && bar.querySelectorAll('.org-stopbar__stop').length === F.state.inkShades[h0].stops.length, bar.querySelectorAll('.org-stopbar__stop').length);
    const rb = bar.getBoundingClientRect(), pe = (t, x) => bar.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: rb.top + rb.height / 2, pointerId: 9 }));
    pe('pointerdown', rb.left + rb.width * 0.5); pe('pointerup', rb.left + rb.width * 0.5); await w(300);
    check('a click on the bar adds a stop there', F.state.inkShades[h0].stops.length === 3 && Math.abs(F.state.inkShades[h0].pos[1] - 0.5) < 0.08, JSON.stringify(F.state.inkShades[h0].pos));
    { const kb = bar.querySelectorAll('.org-stopbar__stop')[1].getBoundingClientRect(), x0 = kb.left + kb.width / 2, p0 = F.state.inkShades[h0].pos[1];
      const kev = (t, x, el) => (el || bar).dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: rb.top + rb.height / 2, pointerId: 11 }));
      kev('pointerdown', x0, bar.querySelectorAll('.org-stopbar__stop')[1]); kev('pointermove', x0 + 20); kev('pointermove', x0 + 40); await w(100);
      const mid = F.state.inkShades[h0].pos[1];
      kev('pointerup', x0 + 40); await w(300);
      check('a stop dragged: the palette changes once, on release (one Undo step)', mid === p0 && F.state.inkShades[h0].pos[1] > p0, p0 + ' → ' + mid + ' → ' + F.state.inkShades[h0].pos[1]); }
    const elsBefore = Object.keys(F.state.elements || {}).length, k1 = bar.querySelectorAll('.org-stopbar__stop')[1];
    k1.focus(); k1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); await w(300);
    check('Delete on a stop removes it — not the Element', F.state.inkShades[h0].stops.length === 2 && Object.keys(F.state.elements || {}).length === elsBefore, F.state.inkShades[h0].stops.length);
    F.state.inkShades = {}; F.buildPalette(); await w(200); }
  // Plates (Export › Plates): a shaded palette separates into its colours AND every shadow ink, a plate each; on every
  // plate only black (or clear) is left — no ink stays in colour; a Soft shading's gradient goes on its inks' plates
  { const S5 = Organica.shading, pc = ['#2a3a8c', '#e8b04a', '#c93ed6'];
    F.setTier('element'); await w(300);
    F.state.colors = pc.slice();
    F.state.inkShades = { [pc[0]]: S5.withColour(JSON.parse(JSON.stringify(S5.defs(pc[0]).speckle)), pc[0]), [pc[2]]: S5.withColour(JSON.parse(JSON.stringify(S5.defs(pc[2]).soft)), pc[2]) };
    F.layersChanged(); await w(300);
    const svg = F.buildSeedPreviewSVG(F.getSeed(), 0, false, false, 300), inks = F.plateInks(svg, F.state.colors, '#ffffff');
    const sh0 = S5.shadowInks(F.state.inkShades[pc[0]], pc[0], { tints: [].concat.apply([], pc.map(h => Organica.color.scale(h).map(x => x.hex))) });
    check('Plates: the palette’s inks first, then the shadow inks (' + inks.length + ')', inks.slice(0, 3).join() === pc.join() && inks.length > 3 && sh0.some(h => inks.includes(h.toLowerCase())), inks.join(' '));
    const bad = [];
    inks.forEach((ink, i) => {
      const pl = F.plateSVG(svg, inks, i, '#ffffff');
      const left = (pl.match(/(?:fill|stroke|stop-color)="#[0-9a-fA-F]{6}"/g) || []).map(x => x.slice(-8, -1).toLowerCase()).filter(h => h !== '#000000' && h !== '#ffffff');
      if (left.length) bad.push(ink + ': ' + left.slice(0, 3).join(','));
      if (svg.toLowerCase().indexOf('"' + ink + '"') >= 0 && !/="#000000"/.test(pl)) bad.push(ink + ': empty');   // an ink the drawing uses has something on its plate
    });
    check('Plates: on every plate only its own ink, in black — none left in colour; a Soft gradient on its plate', !bad.length, bad.slice(0, 4).join(' | '));
    // a Wash (O-92 c): its stops are the inks, not its ~60 bands; its bands are dot screens on the stops' plates
    F.state.inkShades = { [pc[0]]: S5.normalize({ type: 'field', angle: 90, stops: [pc[0], '#5a2a10', '#fbe6c2'] }) };
    F.layersChanged(); await w(300);
    const wsvg = F.buildSeedPreviewSVG(F.getSeed(), 0, false, false, 300), winks = F.plateInks(wsvg, F.state.colors, '#ffffff');
    const wbad = [];
    winks.forEach((ink, i) => {
      const pl = F.plateSVG(wsvg, winks, i, '#ffffff');
      const left = (pl.match(/(?:fill|stroke|stop-color)="#[0-9a-fA-F]{6}"/g) || []).map(x => x.slice(-8, -1).toLowerCase()).filter(h => h !== '#000000' && h !== '#ffffff');
      if (left.length) wbad.push(ink + ': ' + left.slice(0, 3).join(','));
      if ([pc[0], '#5a2a10', '#fbe6c2'].includes(ink) && !/<pattern /.test(pl)) wbad.push(ink + ': no screen');
    });
    check('Plates of a Wash: one plate per stop (' + winks.length + ' inks for ' + (wsvg.match(/data-mix=/g) || []).length + ' bands), each band a dot screen, nothing left in colour',
      winks.length === 5 && winks.includes('#5a2a10') && winks.includes('#fbe6c2') && !wbad.length, winks.join(' ') + (wbad.length ? ' — ' + wbad.slice(0, 4).join(' | ') : ''));
    F.state.inkShades = {}; F.buildPalette(); await w(200); }
  // the editor follows the selected layer (Diego, Nov 21, 2026: "se scelto un element e un layer quando cambio il layer
  // i colori non si applicano"): select a layer, choose Wash — it lands on THAT layer's ink; another layer, another ink
  { F.setTier('element'); await w(300);
    while (F.state.layers && F.state.layers.items.length > 1) { F.removeLayer(F.state.layers.items.length - 1); await w(100); }
    q('btn-layer-add').click(); await w(250); q('btn-layer-add').click(); await w(250);
    const fc = ['#2a3a8c', '#e8b04a', '#c93ed6']; F.state.colors = fc.slice(); F.state.inkShades = {}; F.buildPalette();
    const L = F.state.layers.items; L[0].ink = 0; L[1].ink = 1; L[2].ink = 2; F.layersChanged(); await w(300);
    const ed = q('fvs-shade'), typeBtn = t => ed.querySelector('[data-seg="type"] [data-v="' + t + '"]');
    F.selectLayer(1); await w(300); typeBtn('field').click(); await w(300);
    const a1 = Object.keys(F.state.inkShades).map(h => h + ':' + F.state.inkShades[h].type).join(' ');
    F.selectLayer(2); await w(300); typeBtn('radial').click(); await w(300);
    const a2 = Object.keys(F.state.inkShades).map(h => h + ':' + F.state.inkShades[h].type).join(' ');
    F.selectLayer(1); await w(300);
    const back = ed.querySelector('[data-seg="type"] .active, [data-seg="type"] [aria-pressed="true"]');
    check('the Gradient follows the selected layer: Wash on layer 2 lands on its ink, Radial on layer 3 on its ink, back on layer 2 the editor shows Wash',
      a1 === fc[1] + ':field' && a2 === fc[1] + ':field ' + fc[2] + ':radial' && back && back.dataset.v === 'field', a1 + ' → ' + a2 + ' → ' + (back && back.dataset.v));
    F.state.inkShades = {}; F.buildPalette(); await w(200); }
  // the menu: up to 9 colours
  check('FVS takes up to 9 colours (TuneSutra\\'s palettes)', F.PALETTE_MAX === 9, F.PALETTE_MAX);
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS palette shading: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
