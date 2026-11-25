/* ─────────────────────────────────────────────────────────────────────────────
 * mp4.js — Organica.mp4: a minimal MP4 writer for one H.264 video track.
 *
 * Nov 25, 2026 (docs/SOCIAL-EXPORT.md, P1), lifted from the home-hero capture
 * page (explorations/home-mockups/ig-export.html). MediaRecorder's MP4 is
 * fragmented and declares only its first fragment's length (a 41 s clip read
 * as 3.35 s), so a frame-accurate clip is encoded with WebCodecs
 * (VideoEncoder, avc format) and boxed here: ftyp · moov · mdat, moov first,
 * one chunk — plays and seeks everywhere, and Instagram takes it.
 *
 *   const bytes = Organica.mp4.write({
 *     samples,            // [{ data: Uint8Array, key: bool }] in decode order (EncodedVideoChunk.copyTo)
 *     avcC,               // Uint8Array — the encoder's decoderConfig.description
 *     width, height,
 *     timescale: 90000,   // ticks per second
 *     sampleDuration,     // ticks per frame (timescale / fps, rounded)
 *   });                   // → Uint8Array (video/mp4)
 *
 * No B-frames (VideoEncoder's avc output with the default latency mode has
 * none), so there is no ctts box: decode order = presentation order.
 *
 * LOAD ORDER: independent.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  const u32 = v => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const u16 = v => [(v >>> 8) & 255, v & 255];
  const str = t => t.split('').map(ch => ch.charCodeAt(0));
  const flat = parts => [].concat.apply([], parts.map(x => (x instanceof Uint8Array ? Array.from(x) : x)));
  const box = (type, parts) => { const body = flat(parts); return u32(8 + body.length).concat(str(type), body); };
  const full = (type, v, flags, parts) => box(type, [[v, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]].concat(parts));
  // the identity matrix of mvhd / tkhd
  const MATRIX = [].concat(u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000));

  function write(o) {
    const samples = o.samples, W = o.width, H = o.height, TS = o.timescale || 90000, dur = o.sampleDuration;
    if (!samples || !samples.length) throw new Error('mp4.write: no samples');
    if (!o.avcC || !o.avcC.length) throw new Error('mp4.write: no avcC (the encoder gave no decoderConfig.description)');
    const n = samples.length, total = n * dur;
    const stsd = full('stsd', 0, 0, [u32(1), box('avc1', [[0, 0, 0, 0, 0, 0], u16(1), u16(0), u16(0), u32(0), u32(0), u32(0), u16(W), u16(H),
      u32(0x480000), u32(0x480000), u32(0), u16(1), new Array(32).fill(0), u16(0x18), u16(0xffff), box('avcC', [o.avcC])])]);
    const keys = [];
    samples.forEach((sm, k) => { if (sm.key) keys.push(k + 1); });
    const moovWith = off => {
      const stbl = box('stbl', [stsd,
        full('stts', 0, 0, [u32(1), u32(n), u32(dur)]),
        full('stss', 0, 0, [u32(keys.length)].concat(keys.map(u32))),
        full('stsc', 0, 0, [u32(1), u32(1), u32(n), u32(1)]),
        full('stsz', 0, 0, [u32(0), u32(n)].concat(samples.map(sm => u32(sm.data.length)))),
        full('stco', 0, 0, [u32(1), u32(off)])]);
      const minf = box('minf', [full('vmhd', 0, 1, [u16(0), u16(0), u16(0), u16(0)]), box('dinf', [full('dref', 0, 0, [u32(1), full('url ', 0, 1, [])])]), stbl]);
      const mdia = box('mdia', [full('mdhd', 0, 0, [u32(0), u32(0), u32(TS), u32(total), u16(0x55c4), u16(0)]),
        full('hdlr', 0, 0, [u32(0), str('vide'), u32(0), u32(0), u32(0), str('VideoHandler'), [0]]), minf]);
      const trak = box('trak', [full('tkhd', 0, 3, [u32(0), u32(0), u32(1), u32(0), u32(total), u32(0), u32(0), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(W << 16), u32(H << 16)]), mdia]);
      return box('moov', [full('mvhd', 0, 0, [u32(0), u32(0), u32(TS), u32(total), u32(0x10000), u16(0x100), u16(0), u32(0), u32(0), MATRIX, new Array(24).fill(0), u32(2)]), trak]);
    };
    const ftyp = box('ftyp', [str('isom'), u32(512), str('isom'), str('iso2'), str('avc1'), str('mp41')]);
    // the chunk offset sits inside moov, so measure moov once with a dummy offset (same length), then write it for real
    const moov = moovWith(ftyp.length + moovWith(0).length + 8);
    const size = samples.reduce((a, sm) => a + sm.data.length, 0);
    const out = new Uint8Array(ftyp.length + moov.length + 8 + size);
    let at = 0;
    out.set(ftyp, at); at += ftyp.length;
    out.set(moov, at); at += moov.length;
    out.set(u32(8 + size).concat(str('mdat')), at); at += 8;
    samples.forEach(sm => { out.set(sm.data, at); at += sm.data.length; });
    return out;
  }

  // the boxes of an MP4, for tests: [{ type, start, size }] at one level (pass a box's body to go deeper)
  function boxes(bytes, from = 0, to = bytes.length) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), list = [];
    for (let p = from; p + 8 <= to;) {
      const size = dv.getUint32(p), type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
      if (size < 8) break;
      list.push({ type, start: p, size });
      p += size;
    }
    return list;
  }

  Organica.mp4 = { write, boxes };
})(window);
