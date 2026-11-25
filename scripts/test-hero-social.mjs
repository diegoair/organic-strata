#!/usr/bin/env node
// Home-hero loops as social sources (Nov 25, 2026 — docs/SOCIAL-EXPORT.md P3): Organica.heroSocial.source(a…h) on the
// public home — each of the eight loops loads off screen at a size, gives a still of that size + its SVG, and is
// removed by close(); one reel (H · Stacks, 1:1 — a loop that is exactly periodic) is one OBSERVED cycle long, plays in a <video>, its first
// frame is a fresh still, and its last frame runs into its first (seamless). Six of the eight carry state across cycles
// (docs/SOCIAL-EXPORT.md §6c): their wrap is not checked here.
// Usage: scripts/test-hero-social.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 6 * 60 * 1000 });
await P.goto('/', 'window.Organica && Organica.hero');
const out = await P.ev(`
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src)); document.head.appendChild(s); });
  for (const f of ['zip', 'mp4', 'social-export', 'hero-social']) await load('/shared/' + f + '.js');
  const S = Organica.socialExport, r = [], ck = (n, ok, got) => r.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + JSON.stringify(got)));
  ck('unknown loop throws', (() => { try { Organica.heroSocial.source('z'); return false; } catch (e) { return true; } })());
  const hosts0 = document.body.children.length, shown0 = Organica.hero.current;
  for (const k of 'abcdefgh') {
    const src = Organica.heroSocial.source(k);
    try { const s = await S.still(src, k === 'g' ? '9x16' : '4x5'), bmp = await createImageBitmap(s.png), [W, H] = S.FORMATS[k === 'g' ? '9x16' : '4x5'];
      ck(k + ' · ' + src.title + ': still ' + W + '×' + H + ' + SVG, cycle ' + Math.round(src.cycleMs / 1000) + ' s', bmp.width === W && bmp.height === H && /^<svg/.test(s.svg) && src.cycleMs > 5000, [bmp.width, bmp.height, src.cycleMs]);
    } catch (e) { ck(k + ' loads', false, e.message); } finally { src.close(); }
  }
  ck('close() removes the off-screen loops', document.body.children.length === hosts0, [hosts0, document.body.children.length]);
  const src = Organica.heroSocial.source('h');
  const blob = await S.reel(src, '1x1'), still = await S.still(src, '1x1'); src.close();
  const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(blob);
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('video')); });
  ck('reel = one cycle (' + (src.cycleMs / 1000) + ' s), 1080×1080', v.videoWidth === 1080 && Math.abs(v.duration - src.cycleMs / 1000) < 0.1, [v.videoWidth, v.duration]);
  const c = document.createElement('canvas'); c.width = c.height = 108; const x = c.getContext('2d');
  // every video frame through a real seek (a frame drawn at loadeddata may not be painted yet)
  const grab = t => new Promise(res => { v.onseeked = () => { x.drawImage(v, 0, 0, 108, 108); res(x.getImageData(0, 0, 108, 108).data); }; v.currentTime = t; });
  const diff = (P, Q) => { let e = 0; for (let i = 0; i < P.length; i += 4) e += Math.abs(P[i] - Q[i]) + Math.abs(P[i + 1] - Q[i + 1]) + Math.abs(P[i + 2] - Q[i + 2]); return e / (P.length / 4 * 3); };
  const F0 = await grab(0.001), FL = await grab(v.duration - 0.5 / src.fps), F2 = await grab(2);
  x.drawImage(await createImageBitmap(still.png), 0, 0, 108, 108); const B = x.getImageData(0, 0, 108, 108).data;
  ck('first frame = a fresh still (mean < 8/255)', diff(F0, B) < 8, diff(F0, B).toFixed(2));
  r.push('· last→first ' + diff(FL, F0).toFixed(2) + ' · first→2 s ' + diff(F0, F2).toFixed(2));
  ck('seamless: last frame ≈ first (mean < 8/255)', diff(FL, F0) < 8, diff(FL, F0).toFixed(2));
  ck('O.hero.current left as it was', Organica.hero.current === shown0, Organica.hero.current && Organica.hero.current.key);
  return r.join('\\n');`);
console.log(out);
const bad = out.split('\n').filter(l => l.startsWith('✗')).length + P.errors.length;
if (P.errors.length) console.log('page errors:', P.errors);
console.log(bad ? 'Hero social: FAIL — ' + bad : 'Hero social: PASS — ' + out.split('\n').filter(l => l.startsWith('✓')).length + ' checks');
await P.close();
process.exit(bad ? 1 : 0);
