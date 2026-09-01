/* ─────────────────────────────────────────────────────────────────────────────
 * zip.js — Organica.zip(): a minimal STORE-ONLY zip writer.
 *
 * No compression (method 0) and no dependency. Intended for bundling files that
 * are already compressed — Mote's per-frame `.svgz` (gzipped SVG) sequence
 * export. If you need to pack raw text and want it small, gzip each entry first
 * (CompressionStream) and give it a `.gz`/`.svgz` name.
 *
 * LOAD ORDER: after core.js (by convention — uses nothing from it).
 *
 *   const z = Organica.zip();
 *   z.add('frames/frame-00001.svgz', uint8);
 *   z.add('sequence.json', new TextEncoder().encode(json));
 *   Organica.download(z.blob(), Organica.stamp('mote-seq', 'zip'));
 *
 * Format: one local file header (0x04034b50) + data per entry, then the central
 * directory (0x02014b50 per entry), then the end-of-central-directory record
 * (0x06054b50). DOS date/time fixed at 1980-01-01. UTF-8 names (bit 11 set).
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  let CRC_TABLE = null;
  function crcTable() {
    if (CRC_TABLE) return CRC_TABLE;
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return (CRC_TABLE = t);
  }
  function crc32(bytes) {
    const t = crcTable();
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  Organica.zip = function () {
    const entries = [];   // { nameBytes, data, crc }
    const enc = new TextEncoder();
    return {
      add(name, bytes) {
        const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        entries.push({ nameBytes: enc.encode(name), data: data, crc: crc32(data) });
      },
      blob() {
        const parts = [];
        const central = [];
        let offset = 0;
        const u16 = v => new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF]);
        const u32 = v => new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]);
        const FLAG = 0x0800;   // bit 11: filename is UTF-8

        for (const e of entries) {
          const n = e.nameBytes, len = e.data.length;
          const lfh = concat([
            u32(0x04034b50), u16(20), u16(FLAG), u16(0),   // sig, ver, flags, method(store)
            u16(0), u16(0x21),                             // mod time, mod date (1980-01-01)
            u32(e.crc), u32(len), u32(len),                // crc, compressed, uncompressed
            u16(n.length), u16(0), n,                      // name len, extra len, name
          ]);
          parts.push(lfh, e.data);

          central.push(concat([
            u32(0x02014b50), u16(20), u16(20), u16(FLAG), u16(0),
            u16(0), u16(0x21),
            u32(e.crc), u32(len), u32(len),
            u16(n.length), u16(0), u16(0), u16(0), u16(0),
            u32(0), u32(offset), n,
          ]));
          offset += lfh.length + len;
        }
        const cd = concat(central);
        const eocd = concat([
          u32(0x06054b50), u16(0), u16(0),
          u16(entries.length), u16(entries.length),
          u32(cd.length), u32(offset), u16(0),
        ]);
        return new Blob([...parts, cd, eocd], { type: 'application/zip' });
      },
    };

    function concat(arrs) {
      let total = 0;
      for (const a of arrs) total += a.length;
      const out = new Uint8Array(total);
      let p = 0;
      for (const a of arrs) { out.set(a, p); p += a.length; }
      return out;
    }
  };
})(typeof window !== 'undefined' ? window : this);
