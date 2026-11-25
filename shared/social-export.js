/* ─────────────────────────────────────────────────────────────────────────────
 * social-export.js — Organica.socialExport: a piece → posts.
 *
 * Nov 25, 2026 (docs/SOCIAL-EXPORT.md, P1; ledger §2 "Social export"). Stills
 * (PNG, + SVG for an SVG source) and reels (MP4, one seamless cycle, encoded
 * frame by frame with WebCodecs and boxed by Organica.mp4) in the social
 * formats, bundled as one ZIP (Organica.zip). No UI: each tool keeps its own
 * controls and calls this. Screen only — Print has its own path.
 *
 * ── The source — what a tool hands over (the module never reaches into a tool)
 *   name        file-name stem ('leaf-wave')
 *   paper       the frame's background colour (content colour, default #ffffff)
 *   cycleMs     one full cycle; 0 / absent = a still-only source
 *   fps         the source's own clock (default 30)
 *   stillMs     where a still is taken (default 0)
 *   layout(W, H)   lay the piece out for this format (optional)
 *   seek(ms)       put the piece at ms from the cycle start — deterministic:
 *                  seek(0) and seek(cycleMs) must draw the same frame
 *   svg()          the current frame as a standalone SVG string   ┐ one of the
 *   draw(ctx, W, H) draw the current frame on a 2D canvas          ┘ two
 *
 * ── API
 *   FORMATS                    { '4x5': [1080, 1350], '9x16': …, '1x1': …, '16x9': … }
 *   support(keys?)             → Promise<{ stills: true, reel: { '4x5': bool, … } }>
 *   fitSVG(svg, W, H, o?)      a piece's SVG fitted whole in a W×H frame, Paper around it
 *                              (O-106 b) — o: { paper, margin (0..0.4 of the short side) }
 *   still(source, key)         → Promise<{ png: Blob, svg?: string }>
 *   reel(source, key, o?)      → Promise<Blob video/mp4> — o: { onProgress(f, n), signal, bitrate }
 *   bundle(source, o)          → Promise<{ blob: Blob (application/zip), files: [names], skipped: [{ key, why }] }>
 *                              o: { formats: [keys], stills = true, reels = true, onProgress(done, total, label), signal }
 *
 * LOAD ORDER: core.js → zip.js → mp4.js → social-export.js.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  const FORMATS = { '4x5': [1080, 1350], '9x16': [1080, 1920], '1x1': [1080, 1080], '16x9': [1920, 1080] };   // O-106 e
  const CODEC = 'avc1.640028';   // H.264 High, level 4.0: up to 8192 macroblocks a frame — 1080×1920 is 8160
  const TIMESCALE = 90000;
  const SVGNS = 'http://www.w3.org/2000/svg';

  const sizeOf = key => { const f = FORMATS[key]; if (!f) throw new Error('socialExport: unknown format ' + key); return f; };
  const bitrateFor = (W, H, fps) => Math.round(Math.min(20e6, Math.max(6e6, W * H * fps * 0.2)));   // ≈ 0.2 bit a pixel: 12.4 Mbps at 1080×1920 / 30
  const aborted = signal => { if (signal && signal.aborted) throw new DOMException('Export cancelled', 'AbortError'); };

  async function support(keys = Object.keys(FORMATS)) {
    const reel = {};
    for (const k of keys) {
      const [W, H] = sizeOf(k);
      try {
        reel[k] = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
          && !!(await VideoEncoder.isConfigSupported({ codec: CODEC, width: W, height: H, bitrate: bitrateFor(W, H, 30), framerate: 30, avc: { format: 'avc' } })).supported;
      } catch (e) { reel[k] = false; }
    }
    return { stills: true, reel };
  }

  // A piece's SVG, whole and centred in the W×H frame, Paper around it. The piece's own viewBox (or width × height) is
  // its box; the nested <svg> keeps its proportion (xMidYMid meet).
  function fitSVG(svg, W, H, o = {}) {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml'), root = doc.documentElement;
    if (!root || root.nodeName !== 'svg') throw new Error('socialExport.fitSVG: not an SVG');
    if (!root.getAttribute('viewBox')) {
      const w = parseFloat(root.getAttribute('width')), h = parseFloat(root.getAttribute('height'));
      if (!(w > 0 && h > 0)) throw new Error('socialExport.fitSVG: the SVG has no viewBox and no size');
      root.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    }
    const m = Math.round(Math.min(W, H) * Math.max(0, Math.min(0.4, o.margin || 0)));
    root.setAttribute('x', m); root.setAttribute('y', m); root.setAttribute('width', W - 2 * m); root.setAttribute('height', H - 2 * m);
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    root.removeAttribute('style');
    const inner = new XMLSerializer().serializeToString(root);
    return '<svg xmlns="' + SVGNS + '" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'
      + '<rect width="' + W + '" height="' + H + '" fill="' + (o.paper || '#ffffff') + '"/>' + inner + '</svg>';
  }

  // the current frame on a W×H canvas: Paper first, then the source's drawing
  const scratch = { cv: null };
  async function frameCanvas(source, W, H) {
    let cv = scratch.cv;
    if (!cv) cv = scratch.cv = document.createElement('canvas');
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = source.paper || '#ffffff'; ctx.fillRect(0, 0, W, H);
    if (source.draw) { ctx.save(); source.draw(ctx, W, H); ctx.restore(); return cv; }
    const url = URL.createObjectURL(new Blob([source.svg()], { type: 'image/svg+xml' }));
    try { const img = new Image(); img.src = url; await img.decode(); ctx.drawImage(img, 0, 0, W, H); }
    finally { URL.revokeObjectURL(url); }
    return cv;
  }
  const toPNG = cv => new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('socialExport: the PNG could not be made'))), 'image/png'));

  async function still(source, key) {
    const [W, H] = sizeOf(key);
    if (source.layout) source.layout(W, H);
    if (source.seek) source.seek(source.stillMs || 0);
    const png = await toPNG(await frameCanvas(source, W, H));
    return source.svg ? { png, svg: source.svg() } : { png };
  }

  // One cycle, frame by frame: frame i is seek(i · cycleMs / n), so frame n would be frame 0 again — a seamless loop for
  // any source whose seek is periodic (O-106 c). Encoded samples are kept until the MP4 is written; frames are closed at once.
  async function reel(source, key, o = {}) {
    if (!(source.cycleMs > 0)) throw new Error('socialExport.reel: the source has no cycle');
    if (typeof VideoEncoder === 'undefined') throw new Error('socialExport.reel: this browser has no video encoder');
    const [W, H] = sizeOf(key), fps = source.fps || 30, n = Math.max(1, Math.round(source.cycleMs / 1000 * fps));
    const sampleDuration = Math.round(TIMESCALE / fps), frameUs = 1e6 / fps;
    if (source.layout) source.layout(W, H);
    const samples = []; let avcC = null, err = null;
    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        if (meta && meta.decoderConfig && meta.decoderConfig.description) avcC = new Uint8Array(meta.decoderConfig.description);
        const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); samples.push({ data: d, key: chunk.type === 'key' });
      },
      error: e => { err = e; },
    });
    try {
      enc.configure({ codec: CODEC, width: W, height: H, bitrate: o.bitrate || bitrateFor(W, H, fps), framerate: fps, avc: { format: 'avc' } });
      const keyEvery = Math.max(1, Math.round(fps * 2));   // a keyframe every 2 s: seekable, and cheap enough
      for (let i = 0; i < n; i++) {
        aborted(o.signal);
        if (source.seek) source.seek(i * source.cycleMs / n);
        const vf = new VideoFrame(await frameCanvas(source, W, H), { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
        enc.encode(vf, { keyFrame: i % keyEvery === 0 }); vf.close();
        while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 4));
        if (err) throw err;
        if (o.onProgress) o.onProgress(i + 1, n);
      }
      await enc.flush();
      if (err) throw err;
    } finally { if (enc.state !== 'closed') enc.close(); }
    return new Blob([Organica.mp4.write({ samples, avcC, width: W, height: H, timescale: TIMESCALE, sampleDuration })], { type: 'video/mp4' });
  }

  async function bundle(source, o = {}) {
    const keys = o.formats && o.formats.length ? o.formats : Object.keys(FORMATS);
    const wantStills = o.stills !== false, wantReels = o.reels !== false && source.cycleMs > 0;
    const can = wantReels ? await support(keys) : { reel: {} };
    const z = Organica.zip(), files = [], skipped = [], stem = (source.name || 'organica').replace(/[^\w.-]+/g, '-');
    const jobs = [];
    keys.forEach(k => {
      if (wantStills) jobs.push({ k, kind: 'still' });
      if (wantReels) { if (can.reel[k]) jobs.push({ k, kind: 'reel' }); else skipped.push({ key: k, why: 'no-encoder' }); }   // O-106 d: stills only, the caller says so
    });
    const add = async (name, blob) => { z.add(name, new Uint8Array(await blob.arrayBuffer())); files.push(name); };
    for (let j = 0; j < jobs.length; j++) {
      aborted(o.signal);
      const { k, kind } = jobs[j];
      if (o.onProgress) o.onProgress(j, jobs.length, k + ' ' + kind);
      if (kind === 'still') {
        const s = await still(source, k);
        await add(stem + '-' + k + '.png', s.png);
        if (s.svg) { z.add(stem + '-' + k + '.svg', s.svg); files.push(stem + '-' + k + '.svg'); }
      } else {
        await add(stem + '-' + k + '.mp4', await reel(source, k, { signal: o.signal }));
      }
    }
    if (o.onProgress) o.onProgress(jobs.length, jobs.length, 'done');
    return { blob: z.blob(), files, skipped };
  }

  Organica.socialExport = { FORMATS, CODEC, support, fitSVG, still, reel, bundle };
})(window);
