#!/usr/bin/env node
// Social export (Nov 25, 2026 — docs/SOCIAL-EXPORT.md, P1): shared/mp4.js + shared/social-export.js, headless, on two
// synthetic sources (an SVG one: a square going round; a canvas one: a disc). Stills are their format's size; fitSVG keeps a
// piece whole with Paper around it; a reel is a well-formed MP4 (ftyp · moov · mdat, duration = frames × sample duration)
// that a <video> plays at the right size and length, whose first frame matches the still; the ZIP holds every file; Cancel stops.
// Usage: scripts/test-social-export.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/fvs/', 'window.__fvs && window.__fvs.isReady');
const out = await P.ev(`
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src)); document.head.appendChild(s); });
  if (!Organica.zip) await load('/shared/zip.js');
  await load('/shared/mp4.js'); await load('/shared/social-export.js');
  const S = Organica.socialExport, M = Organica.mp4, r = [];
  const ck = (n, ok, got) => r.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + JSON.stringify(got)));
  ck('FORMATS', JSON.stringify(S.FORMATS) === JSON.stringify({ '4x5': [1080, 1350], '9x16': [1080, 1920], '1x1': [1080, 1080], '16x9': [1920, 1080] }), S.FORMATS);
  // an SVG source: a 100×50 piece (a square going round once a cycle), fitted whole in each format
  let t = 0, W = 0, H = 0;
  const piece = () => { const a = t / 1000 * 2 * Math.PI, x = 50 + 15 * Math.cos(a), y = 25 + 15 * Math.sin(a);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="#e8e0d0"/><rect x="' + (x - 6).toFixed(3) + '" y="' + (y - 6).toFixed(3) + '" width="12" height="12" fill="#1a1a1a"/></svg>'; };
  const svgSrc = { name: 'test piece', paper: '#ffffff', cycleMs: 1000, fps: 30, layout: (w, h) => { W = w; H = h; }, seek: ms => { t = ((ms % 1000) + 1000) % 1000; }, svg: () => S.fitSVG(piece(), W, H, { paper: '#ffffff' }) };
  // fitSVG: the 2:1 piece in 4:5 → full width, centred vertically
  const f = new DOMParser().parseFromString(S.fitSVG(piece(), 1080, 1350), 'image/svg+xml').documentElement;
  const inner = f.querySelector('svg');
  ck('fitSVG frame + Paper', f.getAttribute('width') === '1080' && f.getAttribute('height') === '1350' && f.querySelector('rect').getAttribute('fill') === '#ffffff' && inner.getAttribute('preserveAspectRatio') === 'xMidYMid meet', f.outerHTML.slice(0, 200));
  ck('fitSVG margin', new DOMParser().parseFromString(S.fitSVG(piece(), 1000, 1000, { margin: 0.1 }), 'image/svg+xml').querySelector('svg svg').getAttribute('x') === '100');
  // stills
  for (const k of Object.keys(S.FORMATS)) {
    const s = await S.still(svgSrc, k), bmp = await createImageBitmap(s.png);
    ck('still ' + k + ' ' + S.FORMATS[k].join('×'), bmp.width === S.FORMATS[k][0] && bmp.height === S.FORMATS[k][1] && s.png.type === 'image/png' && /^<svg/.test(s.svg), [bmp.width, bmp.height]);
  }
  ck('seek is periodic', (svgSrc.seek(0), svgSrc.layout(1080, 1080), svgSrc.svg()) === (svgSrc.seek(1000), svgSrc.svg()));
  const sup = await S.support();
  ck('support() answers every format', Object.keys(S.FORMATS).every(k => typeof sup.reel[k] === 'boolean'), sup);
  r.push('· H.264 encoder here: ' + JSON.stringify(sup.reel));
  if (sup.reel['4x5']) {
    let prog = 0;
    const t0 = performance.now(), blob = await S.reel(svgSrc, '4x5', { onProgress: (i, n) => { prog = i + '/' + n; } }), ms = performance.now() - t0;
    const bytes = new Uint8Array(await blob.arrayBuffer()), top = M.boxes(bytes);
    ck('reel boxes ftyp · moov · mdat', top.map(b => b.type).join(' ') === 'ftyp moov mdat', top.map(b => b.type));
    const moov = top[1], mv = M.boxes(bytes, moov.start + 8, moov.start + moov.size), mvhd = mv.find(b => b.type === 'mvhd');
    const dv = new DataView(bytes.buffer), ts = dv.getUint32(mvhd.start + 20), dur = dv.getUint32(mvhd.start + 24);
    ck('reel duration = 30 frames × 3000 ticks', ts === 90000 && dur === 90000 && prog === '30/30', [ts, dur, prog]);
    r.push('· 30 frames at 1080×1350 in ' + Math.round(ms) + ' ms, ' + Math.round(bytes.length / 1024) + ' KB');
    // plays back: size, length, first frame ≈ the still
    const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(blob);
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('video error ' + (v.error && v.error.code))); });
    ck('<video> reads it', v.videoWidth === 1080 && v.videoHeight === 1350 && Math.abs(v.duration - 1) < 0.05, [v.videoWidth, v.videoHeight, v.duration]);
    v.currentTime = 0; await new Promise(res => { v.onseeked = res; setTimeout(res, 500); });
    const c = document.createElement('canvas'); c.width = 108; c.height = 135; const x = c.getContext('2d');
    x.drawImage(v, 0, 0, 108, 135); const A = x.getImageData(0, 0, 108, 135).data;
    x.drawImage(await createImageBitmap((await S.still(svgSrc, '4x5')).png), 0, 0, 108, 135); const B = x.getImageData(0, 0, 108, 135).data;
    let d = 0; for (let i = 0; i < A.length; i += 4) d += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    const mean = d / (A.length / 4 * 3);
    ck('first frame = the still (mean < 6/255)', mean < 6, mean.toFixed(2));
    URL.revokeObjectURL(v.src);
    // a canvas source, and the bundle
    const disc = { name: 'disc', paper: '#f4efe6', cycleMs: 500, fps: 24, seek: ms => { t = ms; }, draw: (ctx, w, h) => { ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(w / 2 + Math.cos(t / 500 * 6.283) * w / 4, h / 2, Math.min(w, h) / 8, 0, 6.283); ctx.fill(); } };
    const b = await S.bundle(disc, { formats: ['1x1', '9x16'] });
    ck('bundle files', JSON.stringify(b.files) === JSON.stringify(['disc-1x1.png', 'disc-1x1.mp4', 'disc-9x16.png', 'disc-9x16.mp4']) && b.blob.type === 'application/zip' && !b.skipped.length, b);
    const zb = new Uint8Array(await b.blob.arrayBuffer());
    ck('ZIP signature', zb[0] === 0x50 && zb[1] === 0x4b && zb[2] === 3 && zb[3] === 4);
    // Cancel
    const ac = new AbortController(); let n = 0;
    const p = S.reel(svgSrc, '1x1', { signal: ac.signal, onProgress: () => { if (++n === 3) ac.abort(); } }).then(() => 'finished', e => e.name);
    ck('Cancel stops a reel', (await p) === 'AbortError');
  } else r.push('· no H.264 encoder in this browser: reel checks skipped');
  {   // no encoder (O-106 d): stills only, and the caller is told
    const VE = window.VideoEncoder; window.VideoEncoder = undefined;
    const b = await S.bundle(svgSrc, { formats: ['1x1'] }); window.VideoEncoder = VE;
    ck('no encoder → stills only, said', JSON.stringify(b.files) === '["test-piece-1x1.png","test-piece-1x1.svg"]' && b.skipped[0].why === 'no-encoder', b);
  }
  return r.join('\\n');`);
console.log(out);
const bad = out.split('\n').filter(l => l.startsWith('✗')).length + P.errors.length;
if (P.errors.length) console.log('page errors:', P.errors);
console.log(bad ? 'Social export: FAIL — ' + bad : 'Social export: PASS — ' + out.split('\n').filter(l => l.startsWith('✓')).length + ' checks');
await P.close();
process.exit(bad ? 1 : 0);
