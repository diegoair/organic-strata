#!/usr/bin/env node
// FVS Paper › Pattern = Element (tile) as one SVG <pattern> (Oct 26, 2026 — Diego: "le performance sul browser mi sembrano
// pessime"): a dense Paper was one <use> per tile in every drawing (102 thumbnails at Spacing 4 = 200,000 nodes). The
// pattern draws the same tiles — checked against the one-<use>-per-tile drawing, rasterised: no pixel far apart — and a
// Component's SVG keeps a few dozen nodes whatever the spacing. Usage: scripts/test-fvs-paper-tile.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const rows = await P.ev(`const F = window.__fvs, q = id => document.getElementById(id), w = ms => new Promise(r => setTimeout(r, ms));
  const rows = [], check = (n, ok, got) => rows.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + got));
  F.setTier('element'); const s = q('sel-seed-type'); s.value = 'lens'; s.dispatchEvent(new Event('change', { bubbles: true })); await w(300);
  // the drawing as it was: one <use> per tile of elementTileLayout
  const oldSVG = (g, W, H) => { const t = F.resolveTile(g), L = F.elementTileLayout(g, W, H), sc = L.size / 100, id = 'o' + Math.random().toString(36).slice(2);
    const attrs = Organica.shapeAppearance.styleAttrs({ fillMode: t.style.fillMode, color: '#000000', strokeW: t.style.strokeW, rounded: t.style.rounded }) + (t.geo.fillRule && t.style.fillMode !== 'stroke' ? ' fill-rule="' + t.geo.fillRule + '"' : '');
    return '<defs><path id="' + id + '" d="' + t.geo.d + '" transform="' + F.tileNormAttr(t.geo) + '" ' + attrs + '/></defs><g transform="scale(' + L.k.toFixed(4) + ')">' + L.tiles.map(p => '<use href="#' + id + '" transform="translate(' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + ') rotate(' + p.rot + ') scale(' + sc.toFixed(4) + ') translate(-50,-50)"/>').join('') + '</g>'; };
  const raster = async (inner, W, H) => { const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"><rect width="' + W + '" height="' + H + '" fill="#fff"/>' + inner + '</svg>';
    const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); });
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, W, H).data; };
  for (const [layout, turn, ang, sp, sz, W, H] of [['grid', 'none', -45, 4, 70, 640, 320], ['brick', 'quarter', -20, 6, 50, 500, 400], ['halfdrop', 'alternate', 30, 12, 90, 400, 300], ['grid', 'none', 0, 8, 70, 400, 400]]) {
    const g = { patType: 'element', src: 'element', layout, turn, patAngle: ang, patSpacing: sp, patSize: sz, ink: 0 };
    const nw = F.elementTileSVG(g, W, H, 'cmp' + rows.length).replace(/<clipPath id="[^"]+"><rect[^>]*\\/><\\/clipPath><g clip-path="url\\(#[^)]+\\)">/, '<g>')
      .replace(/(<path id="[^"]+" d="[^"]*" transform="[^"]*" )([^/]*)\\/>/, (m, a, b) => a + b.replace(/fill="[^"]*"/, 'fill="#000000"').replace(/stroke="[^"]*"/, 'stroke="#000000"') + '/>');
    const A = await raster(oldSVG(g, W, H), W, H), B = await raster(nw, W, H);
    let hard = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) > 200) hard++;
    check(layout + ' · ' + turn + ' · ' + ang + '° · spacing ' + sp + ': the same tiles (no pixel far apart), ' + (nw.match(/<use/g) || []).length + ' <use>', hard === 0 && (nw.match(/<use/g) || []).length <= 16 && /<pattern /.test(nw), hard + ' px');
  }
  F.showGroundControls({ patType: 'element', src: 'element', patSpacing: 4, patAngle: -45, patSize: 70, patWeight: 0.75, layout: 'grid', turn: 'none', ink: 0 }); F.onAppearanceChange(); await w(300);
  const comp = { cells: Array.from({ length: 16 }, () => ({ rotation: 0, flipH: false, flipV: false, scale: 1 })) }, grid = { kind: 'square', cols: 4, rows: 4, cellSize: 160, gap: 0 };
  const svg = F.buildComponentSVG(F.buildComponentItems(comp, grid), F.getSeed(), F.frameDims(grid)), host = document.createElement('div'); host.innerHTML = svg;
  const nodes = host.getElementsByTagName('*').length;
  check('a 4×4 Component on a Spacing 4 Paper: a few dozen nodes, not thousands (' + nodes + ')', nodes < 120, nodes);
  // a Symbol full of Components (Oct 27, 2026 — Diego: "su symbol ho provato a cambiare il pattern ma non lo visualizza"):
  // a cell's own Paper the Symbol's colour is not painted over the Symbol's pattern; a different one stays
  { F.setTier('component'); await w(500); q('btn-generate').click(); await w(1000);
    F.quickSaveComponentToLibrary(F.state.components[0].id); await w(300); const nm = F.getSelectedComponent().savedName;
    F.setTier('symbol'); await w(500);
    const model = await F.symbolGridModel('rectangular', { cols: 6, rows: 6 }, { ...F.readSymbolCanvas(), margin: 0 }); F.loadSymbolGrid(model); await w(300);
    const patch = F.railPatch('component', nm); F.state.symbolCells.forEach(c => F.patchCell(c, patch));
    const paperRects = () => F.buildSymbolSVG().split('" fill="' + F.state.paperColor + '"/>').length - 1;
    const onTile = paperRects();   // the Element (tile) Paper from above is still on
    F.showGroundControls({ patType: 'lines', patSpacing: 8, patWeight: 2, patAngle: 45, ink: 0 }); F.onAppearanceChange(); await w(300);
    const onLines = paperRects();
    check('Symbol Paper pattern over cells of the same Paper: the cells’ Paper not painted over it (tile ' + onTile + ', lines ' + onLines + ' — only the Symbol’s)', onTile === 1 && onLines === 1, onTile + ' / ' + onLines);
    F.showGroundControls(null); F.onAppearanceChange(); await w(200);
    check('…and without a pattern every cell keeps its Paper (the drawing as before)', paperRects() === 1 + F.state.symbolCells.length, paperRects()); }
  F.showGroundControls(null); F.onAppearanceChange();
  return rows;`);
const fails = rows.filter(x => x.startsWith('✗'));
for (const x of rows) console.log('  ' + x);
const errs = P.errors.filter(e => !/Failed to load resource/.test(e));
if (errs.length) console.log('  console: ' + errs.slice(0, 3).join(' | '));
const ok = !fails.length && !errs.length;
console.log(`\nFVS paper tile: ${ok ? 'PASS' : 'FAIL'} — ${rows.length} checks${fails.length ? `, ${fails.length} failed` : ''}`);
await P.close(ok ? 0 : 1);
