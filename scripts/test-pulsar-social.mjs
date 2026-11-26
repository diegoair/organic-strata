#!/usr/bin/env node
// Pulsar › Export › Social (Nov 25, 2026 — docs/SOCIAL-EXPORT.md P2): the block's ticks drive the button's count and the
// hint; Export makes one ZIP (stills + one-loop MP4s per size) through Organica.socialExport without touching #preview;
// the reel's length = the loop; Cancel stops it and puts the panel back; the ticks are remembered.
// Usage: scripts/test-pulsar-social.sh
import { openChrome } from './lib/chrome-page.mjs';

const P = await openChrome({ timeoutMs: 4 * 60 * 1000 });
await P.goto('/pulsar/', 'typeof runSocial === "function" && window.Organica && Organica.socialExport');
const out = await P.ev(`const r = [], ck = (n, ok, got) => r.push((ok ? '✓ ' : '✗ ') + n + (ok ? '' : ' — ' + JSON.stringify(got)));
  const tick = (id, v) => { const e = ctrl(id); e.checked = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
  ck('8 files by default', ctrl('btn-social').textContent === 'Export 8 files' && !ctrl('btn-social').disabled, ctrl('btn-social').textContent);
  ['sz-9x16', 'sz-16x9'].forEach(id => tick(id, false)); tick('soc-video', false);
  ck('count follows the ticks', ctrl('btn-social').textContent === 'Export 2 files', ctrl('btn-social').textContent);
  ['sz-4x5', 'sz-1x1'].forEach(id => tick(id, false));
  ck('no size → disabled + says so', ctrl('btn-social').disabled && ctrl('social-hint').textContent === 'Tick at least one size and one kind of file.', ctrl('social-hint').textContent);
  ck('ticks remembered', JSON.parse(localStorage.getItem('organica.pulsar.social'))['sz-4x5'] === false);
  tick('sz-1x1', true); tick('soc-video', true);
  ck('hint names the loop', /one loop \\(\\d+ s\\)\\.$/.test(ctrl('social-hint').textContent), ctrl('social-hint').textContent);
  // Export: capture the download, check #preview untouched
  let got = null; const dl = Organica.download; Organica.download = (b, name) => { got = { b, name }; };
  const pv = ctrl('preview').toDataURL();
  const t0 = performance.now(); await runSocial(); const ms = performance.now() - t0;
  ck('a ZIP named after the scene', got && got.b.type === 'application/zip' && /^pulsar-.+\\.zip$/.test(got.name), got && got.name);
  ck('#preview untouched', ctrl('preview').toDataURL() === pv);
  ck('panel back after', ctrl('btn-social').textContent === 'Export 2 files' && !ctrl('btn-video').disabled && ctrl('social-progress').hidden, [ctrl('btn-social').textContent, ctrl('social-progress').hidden]);
  // read the ZIP's local headers (STORE): names + the MP4's duration
  const z = new Uint8Array(await got.b.arrayBuffer()), dv = new DataView(z.buffer), names = []; let mp4 = null;
  for (let p = 0; dv.getUint32(p, true) === 0x04034b50;) { const csz = dv.getUint32(p + 18, true), nl = dv.getUint16(p + 26, true), xl = dv.getUint16(p + 28, true);
    const name = new TextDecoder().decode(z.subarray(p + 30, p + 30 + nl)); names.push(name); if (/\\.mp4$/.test(name)) mp4 = z.slice(p + 30 + nl + xl, p + 30 + nl + xl + csz); p += 30 + nl + xl + csz; }
  ck('ZIP holds the 1:1 still and video', names.length === 2 && names.some(n => /-1x1\\.png$/.test(n)) && names.some(n => /-1x1\\.mp4$/.test(n)), names);
  const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(new Blob([mp4], { type: 'video/mp4' }));
  await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = rej; });
  ck('video = one loop, 1080×1080', v.videoWidth === 1080 && Math.abs(v.duration - socialLoopSec()) < 0.05, [v.videoWidth, v.duration, socialLoopSec()]);
  r.push('· 1:1 still + ' + socialLoopSec() + ' s video in ' + Math.round(ms) + ' ms');
  // Cancel
  let seen = 0; const ss = setStatus; window.setStatus = (ph, m) => { ss(ph, m); };
  const run = runSocial(); await new Promise(res => setTimeout(res, 30));
  ck('running → Cancel, Video locked', ctrl('btn-social').textContent === 'Cancel' && ctrl('btn-video').disabled, ctrl('btn-social').textContent);
  got = null; await runSocial(); await run;
  ck('Cancel stops, no file', got === null && ctrl('btn-social').textContent === 'Export 2 files' && !ctrl('sz-1x1').disabled, [got, ctrl('btn-social').textContent]);
  // one job at a time: while recording, a tick does not re-enable Social
  const rec = pulsarRecorder.isRecording; pulsarRecorder.isRecording = () => true;
  tick('sz-4x5', true); ck('recording → Social stays disabled', ctrl('btn-social').disabled);
  pulsarRecorder.isRecording = rec; tick('sz-4x5', false); ck('after → enabled again', !ctrl('btn-social').disabled);
  Organica.download = dl;
  return r.join('\\n');`);
console.log(out);
const bad = out.split('\n').filter(l => l.startsWith('✗')).length + P.errors.length;
if (P.errors.length) console.log('page errors:', P.errors);
console.log(bad ? 'Pulsar social: FAIL — ' + bad : 'Pulsar social: PASS — ' + out.split('\n').filter(l => l.startsWith('✓')).length + ' checks');
await P.close(bad ? 1 : 0);   // close() exits the process: the code must go through it
