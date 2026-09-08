/* ─────────────────────────────────────────────────────────────────────────────
 * zip.js — Organica.zip(): a minimal STORE-only ZIP writer (no compression).
 *
 * Re-added Sep 2026 for Living Path's variable-font bundle export
 * (`.designspace` + one UFO directory per master). It was deleted Sep 1 2026
 * with the Mote SVG-sequence feature; this is the same ~STORE + CRC32
 * implementation, brought back for a real second use.
 *
 *   const z = Organica.zip();
 *   z.add('family.designspace', xmlString);
 *   z.add('masters/Base.ufo/metainfo.plist', bytesOrString);
 *   const blob = z.blob();                     // → Blob, type application/zip
 *
 * `add(path, data)` — data may be a string (UTF-8 encoded), Uint8Array, or
 * ArrayBuffer. Directory entries are synthesised automatically from the paths,
 * so `.ufo` folders unzip as real directories.
 *
 * LOAD ORDER: any time after core.js (independent).
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  // CRC-32 (IEEE 802.3), table built once
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  Organica.zip = function () {
    const enc = new TextEncoder();
    const entries = [];          // { name, bytes, crc, dir:bool }
    const seenDirs = new Set();

    function ensureDirs(path) {
      const parts = path.split('/');
      let acc = '';
      for (let i = 0; i < parts.length - 1; i++) {
        acc += parts[i] + '/';
        if (!seenDirs.has(acc)) {
          seenDirs.add(acc);
          entries.push({ name: acc, bytes: new Uint8Array(0), crc: 0, dir: true });
        }
      }
    }

    return {
      add(path, data) {
        path = String(path).replace(/^\/+/, '');
        const bytes = typeof data === 'string' ? enc.encode(data)
          : (data instanceof Uint8Array ? data : new Uint8Array(data));
        ensureDirs(path);
        entries.push({ name: path, bytes, crc: crc32(bytes), dir: false });
      },
      blob() {
        const chunks = [];
        const central = [];
        let offset = 0;
        const u16 = n => new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]);
        const u32 = n => new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]);
        // fixed DOS timestamp (1980-01-01) — reproducible output
        const dosTime = u16(0), dosDate = u16(0x21);

        for (const e of entries) {
          const nameBytes = enc.encode(e.name);
          const local = concat([
            u32(0x04034b50), u16(20), u16(0), u16(0),          // sig, version, flags, method(STORE)
            dosTime, dosDate,
            u32(e.crc), u32(e.bytes.length), u32(e.bytes.length),
            u16(nameBytes.length), u16(0),                      // name len, extra len
            nameBytes, e.bytes,
          ]);
          chunks.push(local);
          central.push(concat([
            u32(0x02014b50), u16(20), u16(20), u16(0), u16(0),  // sig, made-by, need, flags, method
            dosTime, dosDate,
            u32(e.crc), u32(e.bytes.length), u32(e.bytes.length),
            u16(nameBytes.length), u16(0), u16(0),              // name, extra, comment
            u16(0), u16(0),                                     // disk, internal attrs
            u32(e.dir ? 0x10 : 0),                              // external attrs (dir flag)
            u32(offset),
            nameBytes,
          ]));
          offset += local.length;
        }
        const cdStart = offset;
        let cdSize = 0;
        for (const c of central) { chunks.push(c); cdSize += c.length; }
        chunks.push(concat([
          u32(0x06054b50), u16(0), u16(0),
          u16(entries.length), u16(entries.length),
          u32(cdSize), u32(cdStart), u16(0),
        ]));
        return new Blob(chunks, { type: 'application/zip' });

        function concat(arrs) {
          let len = 0;
          for (const a of arrs) len += a.length;
          const out = new Uint8Array(len);
          let p = 0;
          for (const a of arrs) { out.set(a, p); p += a.length; }
          return out;
        }
      },
    };
  };
})(typeof window !== 'undefined' ? window : this);
