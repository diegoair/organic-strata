/* ─────────────────────────────────────────────────────────────
   print-size.js — physical-unit math, PNG DPI metadata, and bleed/crop-
   mark geometry. Pure functions only, no DOM.

   Why this exists: no tool in the suite has ever embedded a real,
   verifiable DPI in an exported PNG, and Loom's own "Bleed (mm)" field
   was cosmetic — stored, displayed, never read by either of its
   renderers. Screen-printing/riso production needs both to be real.

   Plain classic script (IIFE → window.Organica.printSize), same shape as
   every other shared/*.js file — NOT an ES module. Loom's own modules
   (js/main.js, js/canvas-manager.js) reference Organica.printSize.* as a
   bare global directly, exactly how they already reference
   Organica.noise/Organica.download/Organica.presetStore from core.js —
   an ES module can freely read globals with no `import` needed, as long
   as the classic <script> defining them runs first. `export` statements
   would make this a SyntaxError when loaded as a plain <script> by the
   four classic-script tools (Pollen/Spore/Halide/FVS), so this file is
   deliberately single-mode, matching the rest of shared/.

   LOAD ORDER: core.js → print-size.js → print-size-panel.js → tool
   script (classic tools), or → js/main.js (Loom, type="module", must
   still load AFTER this script tag in document order).

   lpiToPx (real lines-per-inch screen ruling) and registration marks
   (crosshair-in-circle multi-plate alignment marks, alongside crop marks
   above) were added in the Colornet print-production phase (2026-09-07,
   later same week) — Colornet's own per-channel AM screening consumes
   lpiToPx, and its per-plate exports draw registration marks.

   Deliberately NOT built here (see docs/CSS-RULES.md's "known debt"
   discipline — named, not silently skipped):
     - JPG DPI — JPEG carries density in a JFIF APP0 field, not a PNG
       pHYs chunk. A different, similarly-simple writer. Not built until
       actually asked for (Pollen/Spore's exportJPG still export without
       DPI metadata).
   ───────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  // 'in' is new — none of the five tools exposed inches before this file;
  // US screen printers and the DPI/pHYs conversion both think natively in
  // inches, so it belongs in the canonical table now, not bolted on later.
  const UNIT_TO_MM = { mm: 1, cm: 10, m: 1000, in: 25.4 };

  // null for 'px': a CSS pixel has no fixed physical size, so "converting"
  // it to mm would mean silently assuming a DPI nobody asked for — the
  // same reasoning loom/js/canvas-manager.js already documents for its own
  // toCanonical().
  function toMM(value, unit) {
    return unit === 'px' ? null : value * (UNIT_TO_MM[unit] || 1);
  }

  function mmToPx(mm, dpi) { return (mm / 25.4) * dpi; }
  function pxToMm(px, dpi) { return (px / dpi) * 25.4; }

  // A screen ruling of `lpi` lines-per-inch means each halftone cell is
  // 1/lpi inch wide; a raster canvas has `dpi` pixels/inch — so a cell's
  // pixel width is (1/lpi)·dpi = dpi/lpi. Note this has NO dependency on
  // trim size: doubling the trim at the same dpi/lpi produces more cells,
  // not bigger ones — lpi is a property of the paper, not of an arbitrary
  // internal working resolution (which is exactly the bug this fixes in
  // Colornet's own "Lineature" control). Corollary: a cell's size in mm is
  // pxToMm(lpiToPx(lpi,dpi),dpi) === 25.4/lpi, independent of dpi — dpi
  // only controls how many raster samples exist per cell, not the count.
  function lpiToPx(lpi, dpi) { return dpi / lpi; }

  // ── PNG pHYs chunk writer ──────────────────────────────────────────
  // Standard, well-documented technique — every PNG encoder does the same
  // thing. Parses the signature + IHDR, builds a 9-byte pHYs payload
  // (pixels-per-metre, both axes, unit=1 for "metres"), splices it in
  // immediately after IHDR (the position every reader expects; a pHYs
  // chunk elsewhere is technically legal but some naive parsers only look
  // right after IHDR). Returns a NEW Uint8Array — never mutates the input.
  const CRC_TABLE = (function () {
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
  function writeU32BE(arr, offset, value) {
    arr[offset] = (value >>> 24) & 0xFF;
    arr[offset + 1] = (value >>> 16) & 0xFF;
    arr[offset + 2] = (value >>> 8) & 0xFF;
    arr[offset + 3] = value & 0xFF;
  }

  function embedPngDpi(arrayBuffer, dpi) {
    const src = new Uint8Array(arrayBuffer);
    // PNG signature (8 bytes) + IHDR chunk: 4-byte length + 4-byte type
    // ("IHDR") + 13 bytes of data + 4-byte CRC = 8 + 8 + 13 + 4 = 33.
    // Computed generically off the length field rather than hardcoded, in
    // case of ancillary chunks before IHDR — there never are in a
    // canvas.toBlob() output, but don't assume.
    const ihdrLength = (src[8] << 24 | src[9] << 16 | src[10] << 8 | src[11]) >>> 0;
    const ihdrEnd = 8 + 8 + ihdrLength + 4;

    const ppu = Math.round(dpi / 0.0254); // pHYs unit is pixels-per-METRE; 1 inch = 0.0254m
    const payload = new Uint8Array(9);
    writeU32BE(payload, 0, ppu);   // pixels per unit, X
    writeU32BE(payload, 4, ppu);   // pixels per unit, Y — always square/uniform here
    payload[8] = 1;                // unit specifier: 1 = metre

    const type = new Uint8Array([0x70, 0x48, 0x59, 0x73]); // "pHYs"
    const crcInput = new Uint8Array(type.length + payload.length);
    crcInput.set(type, 0);
    crcInput.set(payload, type.length);
    const crc = crc32(crcInput);

    const chunk = new Uint8Array(4 + 4 + 9 + 4);
    writeU32BE(chunk, 0, 9); // length of the DATA only, not type/crc
    chunk.set(type, 4);
    chunk.set(payload, 8);
    writeU32BE(chunk, 17, crc);

    const out = new Uint8Array(src.length + chunk.length);
    out.set(src.subarray(0, ihdrEnd), 0);
    out.set(chunk, ihdrEnd);
    out.set(src.subarray(ihdrEnd), ihdrEnd + chunk.length);
    return out;
  }

  // ── Bleed / crop-mark geometry — pure, unit-agnostic ────────────────
  // Caller decides whether trimW/trimH/bleed are mm or px; everything
  // returned is in the same units as the input.
  function bleedBox(trimW, trimH, bleed) {
    return { x: -bleed, y: -bleed, width: trimW + 2 * bleed, height: trimH + 2 * bleed };
  }

  // 8 short line segments, 2 per corner, offset out from the trim line
  // into the bleed zone — the universal print "cut here" mark.
  function cropMarks(trimW, trimH, opts) {
    opts = opts || {};
    const markLen = opts.markLen != null ? opts.markLen : 5;
    const gap = opts.gap != null ? opts.gap : 2;
    const segs = [];
    const corners = [
      { cx: 0, cy: 0, hx: 1, hy: 1 },           // top-left
      { cx: trimW, cy: 0, hx: -1, hy: 1 },      // top-right
      { cx: 0, cy: trimH, hx: 1, hy: -1 },      // bottom-left
      { cx: trimW, cy: trimH, hx: -1, hy: -1 }, // bottom-right
    ];
    corners.forEach(function (c) {
      // horizontal mark, offset outward on the vertical axis by `gap`
      segs.push({ x1: c.cx + c.hx * gap, y1: c.cy, x2: c.cx + c.hx * (gap + markLen), y2: c.cy });
      // vertical mark, offset outward on the horizontal axis by `gap`
      segs.push({ x1: c.cx, y1: c.cy + c.hy * gap, x2: c.cx, y2: c.cy + c.hy * (gap + markLen) });
    });
    return segs;
  }

  function cropMarksSVG(trimW, trimH, opts, strokeColor, strokeWidth) {
    strokeColor = strokeColor || '#000';
    strokeWidth = strokeWidth != null ? strokeWidth : 0.25;
    const segs = cropMarks(trimW, trimH, opts);
    let s = '<g stroke="' + strokeColor + '" stroke-width="' + strokeWidth + '">';
    segs.forEach(function (seg) {
      s += '<line x1="' + seg.x1 + '" y1="' + seg.y1 + '" x2="' + seg.x2 + '" y2="' + seg.y2 + '"/>';
    });
    s += '</g>';
    return s;
  }

  // Draws the same marks onto an existing canvas 2D context. Caller has
  // already translated ctx so (0,0) = the trim origin (i.e. the same
  // coordinate space cropMarks()/cropMarksSVG() assume).
  function drawCropMarksCanvas(ctx, trimW, trimH, opts, strokeColor, strokeWidth) {
    const segs = cropMarks(trimW, trimH, opts);
    ctx.save();
    ctx.strokeStyle = strokeColor || '#000';
    ctx.lineWidth = strokeWidth != null ? strokeWidth : 0.25;
    segs.forEach(function (seg) {
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    });
    ctx.restore();
  }

  // ── Registration marks — multi-plate alignment ──────────────────────
  // A crosshair-in-circle, the print-industry standard register mark:
  // an unfilled circle (radius r) with 4 short arm ticks starting at the
  // circle's own edge and extending outward armLen past it — the arms
  // deliberately do NOT cross into the circle's interior (a solid "+"
  // reads as a blob at small render sizes; a ring with 4 ticks is what a
  // real register mark looks like).
  //
  // Placed at the MIDPOINT of each trim edge (top/bottom/left/right
  // centre), not the corners — crop marks (above) already occupy the
  // corners, so this placement guarantees zero collision by construction,
  // and an edge-midpoint pair on each axis gives a print operator both an
  // X-shift and a Y-shift reference, which corner-only marks can't
  // cleanly separate.
  //
  // opts.bleed is the caller's REAL bleed (not necessarily gap +
  // 2·(r+armLen)) — if there isn't enough room for a mark to fit inside
  // it without being clipped or colliding with the trim line, this
  // returns an empty array rather than drawing a broken mark. Same
  // "no space, don't crash" posture as the rest of this file.
  function registrationMarks(trimW, trimH, opts) {
    opts = opts || {};
    const r = opts.r != null ? opts.r : 1.5;
    const armLen = opts.armLen != null ? opts.armLen : 0.75;
    const gap = opts.gap != null ? opts.gap : 2;
    const half = r + armLen;
    const bleed = opts.bleed != null ? opts.bleed : (gap + 2 * half);
    if (bleed < gap + 2 * half) return [];
    const midX = trimW / 2, midY = trimH / 2;
    return [
      { cx: midX, cy: -(gap + half), r: r, armLen: armLen },          // top
      { cx: midX, cy: trimH + gap + half, r: r, armLen: armLen },     // bottom
      { cx: -(gap + half), cy: midY, r: r, armLen: armLen },          // left
      { cx: trimW + gap + half, cy: midY, r: r, armLen: armLen },     // right
    ];
  }

  function registrationMarksSVG(trimW, trimH, opts, strokeColor, strokeWidth) {
    strokeColor = strokeColor || '#000';
    strokeWidth = strokeWidth != null ? strokeWidth : 0.25;
    const marks = registrationMarks(trimW, trimH, opts);
    let s = '<g stroke="' + strokeColor + '" stroke-width="' + strokeWidth + '" fill="none">';
    marks.forEach(function (m) {
      s += '<circle cx="' + m.cx + '" cy="' + m.cy + '" r="' + m.r + '"/>';
      s += '<line x1="' + m.cx + '" y1="' + (m.cy - m.r) + '" x2="' + m.cx + '" y2="' + (m.cy - m.r - m.armLen) + '"/>';
      s += '<line x1="' + m.cx + '" y1="' + (m.cy + m.r) + '" x2="' + m.cx + '" y2="' + (m.cy + m.r + m.armLen) + '"/>';
      s += '<line x1="' + (m.cx - m.r) + '" y1="' + m.cy + '" x2="' + (m.cx - m.r - m.armLen) + '" y2="' + m.cy + '"/>';
      s += '<line x1="' + (m.cx + m.r) + '" y1="' + m.cy + '" x2="' + (m.cx + m.r + m.armLen) + '" y2="' + m.cy + '"/>';
    });
    s += '</g>';
    return s;
  }

  // Same coordinate-space contract as drawCropMarksCanvas: caller has
  // already translated ctx so (0,0) = the trim origin.
  function drawRegistrationMarksCanvas(ctx, trimW, trimH, opts, strokeColor, strokeWidth) {
    const marks = registrationMarks(trimW, trimH, opts);
    ctx.save();
    ctx.strokeStyle = strokeColor || '#000';
    ctx.lineWidth = strokeWidth != null ? strokeWidth : 0.25;
    marks.forEach(function (m) {
      ctx.beginPath();
      ctx.arc(m.cx, m.cy, m.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.cx, m.cy - m.r); ctx.lineTo(m.cx, m.cy - m.r - m.armLen);
      ctx.moveTo(m.cx, m.cy + m.r); ctx.lineTo(m.cx, m.cy + m.r + m.armLen);
      ctx.moveTo(m.cx - m.r, m.cy); ctx.lineTo(m.cx - m.r - m.armLen, m.cy);
      ctx.moveTo(m.cx + m.r, m.cy); ctx.lineTo(m.cx + m.r + m.armLen, m.cy);
      ctx.stroke();
    });
    ctx.restore();
  }

  const api = {
    UNIT_TO_MM: UNIT_TO_MM,
    toMM: toMM,
    mmToPx: mmToPx,
    pxToMm: pxToMm,
    lpiToPx: lpiToPx,
    embedPngDpi: embedPngDpi,
    bleedBox: bleedBox,
    cropMarks: cropMarks,
    cropMarksSVG: cropMarksSVG,
    drawCropMarksCanvas: drawCropMarksCanvas,
    registrationMarks: registrationMarks,
    registrationMarksSVG: registrationMarksSVG,
    drawRegistrationMarksCanvas: drawRegistrationMarksCanvas,
  };

  // Both Loom's ES modules and the four classic-script tools read this
  // same global — see the file header for why there is no `export` form.
  const g = typeof window !== 'undefined' ? window : this;
  const Organica = g.Organica || (g.Organica = {});
  Organica.printSize = api;
})(typeof window !== 'undefined' ? window : this);
