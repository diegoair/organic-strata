/* ─────────────────────────────────────────────────────────────────────────────
 * glyph-editor.js — Organica.glyphEditor: a Canvas2D outline editor that works
 * directly on Organica.glyphModel's canonical contours.
 *
 * WHY NOT FORK createPaperDrawEditor
 *   The plan called for forking shared/paper.js's createPaperDrawEditor, but
 *   that editor is built around Bézier anchors + mirrored tangent handles and
 *   serialises to an SVG `d` string. The glyph model's canonical contours are
 *   corner-flagged *polylines* (dense enough that Catmull-Rom re-emission is
 *   ~0.06% from the true outline). Editing those as handled Béziers would mean
 *   a lossy round-trip on every gesture. A direct Canvas2D editor with a
 *   soft-drag (gaussian falloff along the contour, corners held crisp) fits
 *   the one-representation model, is lighter, and keeps every edit compatible
 *   for interpolation by construction. The reused *ideas* from the paper.js
 *   editor: hit-test → drag loop, per-gesture JSON undo snapshots, a fit box
 *   mapping model space onto the canvas.
 *
 * SPACE
 *   Model space = font units, y-up (baseline at y=0). The editor maps
 *   [ -sidebearingPad .. advance+pad ] × [ descender .. ascender ] onto the
 *   canvas with a y-flip. All getters/setters below are in font units.
 *
 * LOAD ORDER: core.js → glyph-model.js → glyph-editor.js → tool script.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  const FALLOFF = 6;              // soft-drag reaches ±this many points along the contour
  const SIGMA = 3;
  const HANDLE_HIT = 9;           // px pick radius
  const UNDO_CAP = 40;

  function clone(contours) {
    return contours.map(c => ({ closed: !!c.closed, pts: c.pts.map(p => ({ x: p.x, y: p.y, corner: !!p.corner })) }));
  }

  Organica.glyphEditor = function (canvasEl, opts) {
    opts = opts || {};
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    const onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : function () {};
    const ctx = canvasEl.getContext('2d');

    let model = null, masterIdx = 0, key = null;
    let contours = [];             // live edit target (a copy; committed back to the model)
    let advance = 0;
    let metrics = { baseline: 0, xHeight: 0, capHeight: 0, ascender: 0, descender: 0 };
    let upm = 1000;
    let sel = null;               // { c, i }
    let view = { s: 1, ox: 0, oy: 0 };
    const undoStack = [];
    let drag = null;              // { c, i, moved, kind:'node'|'advance' }
    let readonly = false;         // off-master preview: show, don't edit
    let preview = null;           // { contours, advance } shown instead of the edit target

    // ── view fit ────────────────────────────────────────────────────────────
    function fit() {
      const W = canvasEl.width, H = canvasEl.height;
      const adv = preview ? preview.advance : advance;
      const padX = upm * 0.12;
      const x0 = -padX, x1 = Math.max(adv, upm * 0.1) + padX;
      const y0 = metrics.descender - upm * 0.06, y1 = metrics.ascender + upm * 0.06;
      const s = Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.92;
      view.s = s;
      view.ox = (W - (x1 - x0) * s) / 2 - x0 * s;
      view.oy = H - ((H - (y1 - y0) * s) / 2 - y0 * s);   // y-flip origin
    }
    const toPx = (p) => ({ x: p.x * view.s + view.ox, y: view.oy - p.y * view.s });
    const toModel = (px, py) => ({ x: (px - view.ox) / view.s, y: (view.oy - py) / view.s });

    // ── data in / out ───────────────────────────────────────────────────────
    function setGlyph(m, mi, k) {
      model = m; masterIdx = mi || 0; key = k;
      const g = model.masters[masterIdx].glyph(key);
      contours = clone(g.contours);
      advance = g.advance;
      upm = model.unitsPerEm || 1000;
      metrics = Object.assign({ baseline: 0 }, opts.metrics || model.metrics || {
        xHeight: upm * 0.5, capHeight: upm * 0.7, ascender: upm * 0.8, descender: -upm * 0.2,
      });
      sel = null; undoStack.length = 0; preview = null; readonly = false;
      fit(); redraw(); onSelect(null);
    }
    function setReadonly(v) { readonly = !!v; if (v) { sel = null; onSelect(null); } redraw(); }
    function previewInstance(inst) {
      preview = (inst && inst.contours) ? { contours: clone(inst.contours), advance: inst.advance } : null;
      fit(); redraw();
    }
    function commit() {                       // write the edit target back into the model
      if (!model || !key) return;
      const g = model.masters[masterIdx].glyph(key);
      g.contours = clone(contours);
      g.advance = advance;
      g.edited = true;
      onChange();
    }
    function snapshot() {
      undoStack.push({ contours: clone(contours), advance });
      if (undoStack.length > UNDO_CAP) undoStack.shift();
    }
    function getContours() { return clone(contours); }
    function getAdvance() { return advance; }
    function isEdited() { return !!(model && key && model.masters[masterIdx].glyph(key).edited); }

    // ── hit test ────────────────────────────────────────────────────────────
    function pick(px, py) {
      let best = null, bd = HANDLE_HIT * HANDLE_HIT;
      for (let ci = 0; ci < contours.length; ci++) {
        const pts = contours[ci].pts;
        for (let i = 0; i < pts.length; i++) {
          const q = toPx(pts[i]);
          const d = (q.x - px) * (q.x - px) + (q.y - py) * (q.y - py);
          if (d < bd) { bd = d; best = { c: ci, i }; }
        }
      }
      return best;
    }
    // nearest point ON a contour polyline (for insert) → {c, i, x, y} where i =
    // index to insert AFTER
    function pickEdge(px, py) {
      let best = null, bd = 14 * 14;
      for (let ci = 0; ci < contours.length; ci++) {
        const pts = contours[ci].pts, n = pts.length, segs = contours[ci].closed ? n : n - 1;
        for (let i = 0; i < segs; i++) {
          const a = toPx(pts[i]), b = toPx(pts[(i + 1) % n]);
          const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1;
          let t = ((px - a.x) * vx + (py - a.y) * vy) / L2; t = Math.max(0, Math.min(1, t));
          const cx = a.x + vx * t, cy = a.y + vy * t;
          const d = (cx - px) * (cx - px) + (cy - py) * (cy - py);
          if (d < bd) { bd = d; best = { c: ci, i, m: toModel(cx, cy) }; }
        }
      }
      return best;
    }

    // ── soft drag ───────────────────────────────────────────────────────────
    function moveNode(ci, i, dx, dy) {
      const pts = contours[ci].pts, n = pts.length;
      for (let j = -FALLOFF; j <= FALLOFF; j++) {
        const idx = contours[ci].closed ? ((i + j) % n + n) % n : i + j;
        if (idx < 0 || idx >= n) continue;
        if (j !== 0 && pts[idx].corner) continue;         // hold corners crisp
        const w = Math.exp(-(j / SIGMA) * (j / SIGMA));
        pts[idx].x += dx * w; pts[idx].y += dy * w;
      }
    }

    // ── public edits ────────────────────────────────────────────────────────
    function setSelectedPoint(x, y) {
      if (!sel) return;
      snapshot();
      const p = contours[sel.c].pts[sel.i];
      moveNode(sel.c, sel.i, x - p.x, y - p.y);
      commit(); redraw();
    }
    function nudge(dx, dy) {
      if (!sel) return;
      snapshot();
      moveNode(sel.c, sel.i, dx, dy);
      commit(); redraw(); emitSel();
    }
    function addPointAt(px, py) {
      const e = pickEdge(px, py); if (!e) return false;
      snapshot();
      contours[e.c].pts.splice(e.i + 1, 0, { x: e.m.x, y: e.m.y, corner: false });
      sel = { c: e.c, i: e.i + 1 };
      commit(); redraw(); emitSel();
      return true;
    }
    function deleteSelected() {
      if (!sel) return;
      const pts = contours[sel.c].pts;
      if (pts.length <= 4) return;                        // keep a contour meaningful
      snapshot();
      pts.splice(sel.i, 1);
      sel = null;
      commit(); redraw(); onSelect(null);
    }
    function toggleCorner() {
      if (!sel) return;
      snapshot();
      const p = contours[sel.c].pts[sel.i];
      p.corner = !p.corner;
      commit(); redraw(); emitSel();
    }
    function setAdvance(v) {
      v = Math.max(0, Math.round(+v || 0));
      if (v === advance) return;
      snapshot(); advance = v; fit(); commit(); redraw();
    }
    function resetGlyph() {
      if (!model || !key) return;
      snapshot();
      // rebuild straight from the font, discard edits for this glyph
      const g = model.masters[masterIdx].glyph(key);
      const src = model._byKey && model._byKey[key];
      if (src && Organica.glyphModel) {
        const cg = Organica.glyphModel.canonicalGlyph(src, upm, model.resampleOpts);
        g.contours = cg.contours; g.advance = cg.advance; g.edited = false;
        contours = clone(cg.contours); advance = cg.advance;
      }
      sel = null; fit(); onChange(); redraw(); onSelect(null);
    }
    function undo() {
      const s = undoStack.pop(); if (!s) return;
      contours = clone(s.contours); advance = s.advance;
      sel = null; fit(); commit(); redraw(); onSelect(null);
    }

    function emitSel() {
      if (!sel) { onSelect(null); return; }
      const p = contours[sel.c].pts[sel.i];
      onSelect({ contour: sel.c, index: sel.i, x: Math.round(p.x), y: Math.round(p.y), corner: !!p.corner });
    }

    // ── pointer + keyboard ──────────────────────────────────────────────────
    function evtPx(e) {
      const r = canvasEl.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvasEl.width / r.width), y: (e.clientY - r.top) * (canvasEl.height / r.height) };
    }
    canvasEl.addEventListener('pointerdown', (e) => {
      canvasEl.focus();
      if (readonly || preview) return;
      const { x, y } = evtPx(e);
      // advance-width line grab
      const ax = advance * view.s + view.ox;
      if (Math.abs(x - ax) < 6 && !pick(x, y)) { drag = { kind: 'advance' }; snapshot(); canvasEl.setPointerCapture(e.pointerId); return; }
      const hit = pick(x, y);
      if (hit) {
        sel = hit; drag = { kind: 'node', c: hit.c, i: hit.i, moved: false, last: toModel(x, y) };
        canvasEl.setPointerCapture(e.pointerId); emitSel(); redraw(); return;
      }
      if (e.altKey || opts.addMode && opts.addMode()) { if (addPointAt(x, y)) { canvasEl.setPointerCapture(e.pointerId); drag = { kind: 'node', c: sel.c, i: sel.i, moved: true, last: toModel(x, y) }; } return; }
      sel = null; emitSel(); redraw();
    });
    canvasEl.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const { x, y } = evtPx(e);
      if (drag.kind === 'advance') { advance = Math.max(0, Math.round(toModel(x, y).x)); fit(); redraw(); return; }
      const m = toModel(x, y);
      if (!drag.moved) { snapshot(); drag.moved = true; }
      moveNode(drag.c, drag.i, m.x - drag.last.x, m.y - drag.last.y);
      drag.last = m;
      redraw();
    });
    canvasEl.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const wasAdvance = drag.kind === 'advance';
      const moved = drag.moved || wasAdvance;
      drag = null;
      try { canvasEl.releasePointerCapture(e.pointerId); } catch (x) {}
      if (moved) { commit(); }
      emitSel();
    });
    canvasEl.addEventListener('keydown', (e) => {
      if (readonly || preview || !sel) return;
      const step = e.shiftKey ? 20 : 2;
      if (e.key === 'ArrowLeft') { nudge(-step, 0); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { nudge(step, 0); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { nudge(0, step); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { nudge(0, -step); e.preventDefault(); }
      else if (e.key === 'Backspace' || e.key === 'Delete') { deleteSelected(); e.preventDefault(); }
      else if (e.key === 'Enter') { toggleCorner(); e.preventDefault(); }
      else if (e.key === 'Escape') { sel = null; emitSel(); redraw(); }
    });
    if (!canvasEl.hasAttribute('tabindex')) canvasEl.setAttribute('tabindex', '0');

    // ── render ──────────────────────────────────────────────────────────────
    function line(y, label, col) {
      const py = view.oy - y * view.s;
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(canvasEl.width, py); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(label, 4, py - 3);
    }
    function redraw() {
      const W = canvasEl.width, H = canvasEl.height;
      const css = getComputedStyle(canvasEl);
      const ink = (opts.ink && opts.ink()) || css.getPropertyValue('--ink') || '#0a0a0a';
      const paper = (opts.paper && opts.paper()) || css.getPropertyValue('--paper') || '#f5f2ec';
      const tool = css.getPropertyValue('--tool').trim() || '#b48cf0';
      const mid = css.getPropertyValue('--mid').trim() || '#888';
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = paper.trim(); ctx.fillRect(0, 0, W, H);
      const shown = preview ? preview.contours : contours;
      const adv = preview ? preview.advance : advance;

      // metric guides
      line(metrics.baseline, 'base', mid);
      if (metrics.xHeight) line(metrics.xHeight, 'x', mid);
      if (metrics.capHeight) line(metrics.capHeight, 'cap', mid);
      if (metrics.ascender) line(metrics.ascender, 'asc', mid);
      if (metrics.descender) line(metrics.descender, 'desc', mid);
      // sidebearings + advance
      ctx.strokeStyle = mid; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      [0, adv].forEach(x => { const px = x * view.s + view.ox; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke(); });
      ctx.setLineDash([]);

      // glyph fill (even-odd across all contours)
      const p2 = new Path2D();
      shown.forEach(c => {
        const pts = c.pts; if (pts.length < 2) return;
        const a = toPx(pts[0]); p2.moveTo(a.x, a.y);
        for (let i = 1; i < pts.length; i++) { const q = toPx(pts[i]); p2.lineTo(q.x, q.y); }
        if (c.closed) p2.closePath();
      });
      ctx.fillStyle = preview ? 'rgba(128,128,128,0.20)' : 'rgba(128,128,128,0.14)'; ctx.fill(p2, 'evenodd');
      ctx.strokeStyle = ink.trim(); ctx.lineWidth = 1; ctx.stroke(p2);
      if (preview) {
        ctx.fillStyle = mid; ctx.font = '10px system-ui, sans-serif';
        ctx.fillText('interpolated — pick a master to edit', 6, H - 8);
        return;
      }

      // nodes — on a dense contour, draw only corners + every 3rd interior
      // point (all points stay pickable; this is display density only)
      contours.forEach((c, ci) => {
        const sparse = c.pts.length > 56;
        c.pts.forEach((p, i) => {
          const isSel = sel && sel.c === ci && sel.i === i;
          if (sparse && !p.corner && !isSel && (i % 3)) return;
          const q = toPx(p);
          ctx.beginPath();
          if (p.corner) { const r = isSel ? 4 : 3; ctx.rect(q.x - r, q.y - r, r * 2, r * 2); }
          else { ctx.arc(q.x, q.y, isSel ? 4 : 2.3, 0, 7); }
          ctx.fillStyle = isSel ? tool : (p.corner ? ink.trim() : paper.trim());
          ctx.strokeStyle = isSel ? tool : ink.trim(); ctx.lineWidth = 1;
          ctx.fill(); ctx.stroke();
        });
      });
    }

    function resize() { fit(); redraw(); }
    function destroy() { /* listeners are on canvasEl; caller discards it */ }

    return {
      setGlyph, redraw, resize, setReadonly, previewInstance,
      getContours, getAdvance, isEdited,
      setSelectedPoint, nudge, deleteSelected, toggleCorner, setAdvance, resetGlyph, undo,
      addPointAt,
      getSelection: () => sel && { contour: sel.c, index: sel.i },
      destroy,
    };
  };
})(typeof window !== 'undefined' ? window : this);
