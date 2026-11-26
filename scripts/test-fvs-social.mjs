#!/usr/bin/env node
// FVS Export › Social (Nov 25, 2026 — docs/SOCIAL-EXPORT.md P4): four size checks, one button (a size is PNG + SVG), the
// hint names the step, says why on an empty step and adds the Print line in Print mode; Export makes one ZIP of the step's
// SVG fitted in each size (PNG at the format's pixels, SVG at its size), the ticks are remembered, Cancel leaves no file.
// Usage: scripts/test-fvs-social.sh
import { openChrome } from './lib/chrome-page.mjs';
const P = await openChrome({ timeoutMs: 180000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const out = await P.ev(`const F = window.__fvs, r = [], ck = (n, ok, got) => r.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + JSON.stringify(got)));
  const $ = id => document.getElementById(id), tick = (id, v) => { const e = $(id); e.checked = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
  F.setTier('element'); $('btn-export').click();
  ck('block between Plates and Recipe', !!$('social-block') && $('social-block').compareDocumentPosition($('btn-recipe-export')) & Node.DOCUMENT_POSITION_FOLLOWING);
  ck('8 files by default', $('btn-social').textContent === 'Export 8 files' && !$('btn-social').disabled, $('btn-social').textContent);
  ck('hint names the step', $('social-hint').textContent === 'One ZIP: a PNG and an SVG for each size, the Element fitted whole with Paper around it.', $('social-hint').textContent);
  // the files
  let got = null; const dl = Organica.download; Organica.download = (b, name) => { got = { b, name }; };
  await F.runSocial();
  ck('a ZIP named after the step', got && got.b.type === 'application/zip' && /^fvs-element.*\\.zip$/.test(got.name), got && got.name);
  const z = new Uint8Array(await got.b.arrayBuffer()), dv = new DataView(z.buffer), files = {};
  for (let p = 0; dv.getUint32(p, true) === 0x04034b50;) { const csz = dv.getUint32(p + 18, true), nl = dv.getUint16(p + 26, true), xl = dv.getUint16(p + 28, true); files[new TextDecoder().decode(z.subarray(p + 30, p + 30 + nl))] = z.subarray(p + 30 + nl + xl, p + 30 + nl + xl + csz); p += 30 + nl + xl + csz; }
  const names = Object.keys(files);
  ck('8 files: PNG + SVG per size', names.length === 8 && ['4x5', '9x16', '1x1', '16x9'].every(k => files['fvs-element-' + k + '.png'] && files['fvs-element-' + k + '.svg']), names);
  const pngWH = b => { const d = new DataView(b.buffer, b.byteOffset); return [d.getUint32(16), d.getUint32(20)]; };
  ck('PNGs at the format pixels', JSON.stringify(['4x5', '9x16', '1x1', '16x9'].map(k => pngWH(files['fvs-element-' + k + '.png']))) === JSON.stringify([[1080, 1350], [1080, 1920], [1080, 1080], [1920, 1080]]));
  const svg9 = new TextDecoder().decode(files['fvs-element-9x16.svg']);
  ck('SVG at the format size, the piece nested and fitted', /^<svg[^>]*width="1080" height="1920"/.test(svg9) && /preserveAspectRatio="xMidYMid meet"/.test(svg9), svg9.slice(0, 200));
  // the 1:1 PNG is not an empty sheet: some pixels differ from the corner (Paper)
  const bmp = await createImageBitmap(new Blob([files['fvs-element-1x1.png']], { type: 'image/png' })), cv = new OffscreenCanvas(108, 108), cx = cv.getContext('2d');
  cx.drawImage(bmp, 0, 0, 108, 108); const px = cx.getImageData(0, 0, 108, 108).data; let ink = 0;
  for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - px[0]) + Math.abs(px[i + 1] - px[1]) + Math.abs(px[i + 2] - px[2]) > 60) ink++;
  ck('the still has the piece on it', ink > 50, ink);
  // ticks, remembered
  ['sz-4x5', 'sz-9x16', 'sz-16x9'].forEach(id => tick(id, false));
  ck('one size → 2 files', $('btn-social').textContent === 'Export 2 files', $('btn-social').textContent);
  ck('ticks remembered', JSON.parse(localStorage.getItem('organica.fvs.social'))['sz-4x5'] === false);
  tick('sz-1x1', false);
  ck('none ticked → disabled + why', $('btn-social').disabled && $('social-hint').textContent === 'Tick at least one size.', $('social-hint').textContent);
  tick('sz-1x1', true);
  // Print mode: the block stays, its hint says Print does not apply
  const pr = document.querySelector('#print-size-host .seg-btn[data-v="print"]'); pr && pr.click();
  ck('Print mode: block kept, Print line', !$('social-block').hidden && / Always screen pixels — Print settings don’t apply\\.$/.test($('social-hint').textContent), [!!pr, $('social-hint').textContent]);
  document.querySelector('#print-size-host .seg-btn[data-v="screen"]').click();
  ck('Screen again: no Print line', !/Print settings/.test($('social-hint').textContent), $('social-hint').textContent);
  // an empty step
  F.state.symbolGrid = null; F.setTier('symbol'); F.syncSocial();
  if (!F.tierSVG()) ck('empty Symbol → disabled + why', $('btn-social').disabled && $('social-hint').textContent === 'No symbol grid loaded.', $('social-hint').textContent);
  else r.push('· Symbol step had a grid — empty case not reached');
  // Cancel
  F.setTier('element'); F.syncSocial(); ['sz-4x5', 'sz-9x16', 'sz-16x9'].forEach(id => tick(id, true));
  got = null; const run = F.runSocial(); await new Promise(res => setTimeout(res, 0));
  ck('running: Cancel, sizes + other exports locked', $('btn-social').textContent === 'Cancel' && $('sz-1x1').disabled && $('btn-export-png').disabled && $('btn-plates-export').disabled, $('btn-social').textContent);
  await F.runSocial(); await run;
  ck('Cancel: no file, back to Export', got === null && $('btn-social').textContent === 'Export 8 files' && !$('sz-1x1').disabled && !$('btn-export-png').disabled, $('btn-social').textContent);
  Organica.download = dl;
  return r.join('\\n');`);
console.log(out);
const bad = out.split('\n').filter(l => l.startsWith('✗')).length + P.errors.length;
if (P.errors.length) console.log('page errors:', P.errors);
console.log(bad ? 'FVS social: FAIL — ' + bad : 'FVS social: PASS — ' + out.split('\n').filter(l => l.startsWith('✓')).length + ' checks');
await P.close(bad ? 1 : 0);   // close() exits the process: the code must go through it
