/* ─────────────────────────────────────────────────────────────
   HTML/CSS Grid renderer — the only renderer that reads grid.tracks +
   cell spans directly instead of resolved pixel rects. This is real
   `display:grid` (grid-template-columns/rows, grid-column/row), not
   absolutely-positioned divs simulating one — the canvas preview IS the
   HTML/CSS export, same WYSIWYG rule as every raster/vector renderer
   elsewhere in Organica, just applied to a DOM target instead of a
   <canvas>.
   ───────────────────────────────────────────────────────────── */

import { innerRect } from '../canvas-manager.js';
import { catmullRomPathD } from '../json-model.js';

function r2(n) { return Math.round(n * 100) / 100; }

// Polygon grids (Voronoi) have no honest CSS Grid form — see voronoi.js's
// own header. The "live CSS Grid preview" convention above simply doesn't
// apply, so this branch embeds a real SVG instead: the preview and the
// SVG export are then AS CLOSE to byte-identical as this tool gets (same
// per-cell closed `<polygon>` shapes, same stroke colour — see
// svg-renderer.js's own header for why closed per-cell shapes replaced an
// earlier de-duplicated-line-list version), the one deliberate difference
// being that this preview also draws each cell's number at its centroid —
// numbers were always a preview/HTML-snippet-only feature for rect grids
// too (svg-renderer.js's own SVG export has never drawn them), so this
// keeps that same convention rather than inventing a new one.
function buildPolygonSVG(model, inner, lineColor) {
  const { canvas, cells } = model;
  const stroke = lineColor || '#3399ff';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(canvas.width)} ${r2(canvas.height)}" style="display:block; width:100%; height:100%;">`;
  s += `<rect width="100%" height="100%" fill="#ffffff"/>`;
  s += `<rect x="${r2(inner.x)}" y="${r2(inner.y)}" width="${r2(inner.width)}" height="${r2(inner.height)}" fill="none" stroke="#c8c0b0" stroke-width="0.75" stroke-dasharray="3 3"/>`;
  s += `<g fill="none" stroke="${stroke}" stroke-width="1">`;
  cells.forEach(cell => {
    if (cell.smooth) {
      s += `<path d="${catmullRomPathD(cell.points, r2, cell.smooth === 'sharp')}"/>`;
    } else {
      const pts = cell.points.map(p => `${r2(p[0])},${r2(p[1])}`).join(' ');
      s += `<polygon points="${pts}"/>`;
    }
  });
  s += '</g>';
  cells.forEach((c, i) => {
    const [cx, cy] = c.centroid;
    s += `<text x="${r2(cx)}" y="${r2(cy)}" font-size="13" text-anchor="middle" dominant-baseline="middle" fill="#696256">${c.number != null ? c.number : i + 1}</text>`;
  });
  s += '</svg>';
  return s;
}

export function buildGridCSS(model) {
  const { grid, canvas } = model;
  // Same reasoning as svg-renderer.js: canvas.width/height are already the
  // canonical mm-equivalent number for any physical unit (cm/m included —
  // CSS has no native "m" length unit either, only mm/cm/in/px/pt/pc), so
  // every non-px unit gets a literal "mm" suffix on the OUTER declared
  // size only. The grid's own internal geometry (template columns/rows,
  // gap, padding below) stays in bare canonical numbers rendered as CSS
  // px — that's the on-screen/DOM rendering unit regardless of what
  // physical size the outer box declares itself to be, matching the
  // pre-existing "1 canonical unit = 1 CSS px" convention.
  const unit = canvas.unit === 'px' ? 'px' : 'mm';
  const cols = grid.tracks.cols.map(w => `${r2(w)}px`).join(' ');
  const rows = grid.tracks.rows.map(h => `${r2(h)}px`).join(' ');
  // grid.tracks sums to the INNER rect (canvas minus margin), not the full
  // canvas — the container itself stays sized to the full canvas and gets
  // that margin as real CSS padding (border-box), so the leftover space
  // lands evenly on all four sides instead of only at the bottom-right
  // (the bug this replaced: a container sized to the full canvas with no
  // padding left every track's own unfilled remainder pinned to the
  // default grid-content start corner).
  const inner = innerRect(canvas);
  // Per-side margins (Phase 4) — padding is genuinely per-edge now, not
  // one value on all four sides: top/left come straight from inner's own
  // origin, right/bottom are back-derived from what inner didn't already
  // account for (the same rect the tracks themselves were solved inside).
  const padTop = r2(inner.y), padLeft = r2(inner.x);
  const padRight = r2(canvas.width - inner.width - inner.x), padBottom = r2(canvas.height - inner.height - inner.y);
  return {
    containerCSS: `display: grid; box-sizing: border-box; grid-template-columns: ${cols}; grid-template-rows: ${rows}; gap: ${grid.gap}px; padding: ${padTop}px ${padRight}px ${padBottom}px ${padLeft}px; width: ${r2(canvas.width)}${unit}; height: ${r2(canvas.height)}${unit};`,
    // Every cell draws its own right + bottom border; only col-0/row-0
    // cells also draw left/top. A shared edge between two adjacent cells
    // is then drawn by exactly ONE of them — the cell to its left or
    // above — instead of both cells independently bordering all 4 sides,
    // which doubles every internal boundary. Each `.loom-cell` is already
    // a real closed DOM box (unlike the old SVG/PNG line-list export this
    // avoids the doubled-border look at zero cost — a `<div>`'s border is
    // never "two lines", so there's no dedup needed here the way the
    // vector renderers used to need it; each cell is trivially fillable
    // via `background-color` in CSS already.
    cellCSS: model.cells.map(c => {
      // Fallback value inline (var(--guide-blue, #3399ff)) — the exported
      // HTML snippet is meant to stand alone in an arbitrary page that
      // won't have Loom's own :root definition loaded.
      let b = `border-right: 1px solid var(--guide-blue, #3399ff); border-bottom: 1px solid var(--guide-blue, #3399ff);`;
      if (c.col === 0) b += ` border-left: 1px solid var(--guide-blue, #3399ff);`;
      if (c.row === 0) b += ` border-top: 1px solid var(--guide-blue, #3399ff);`;
      // Padding (grid.padding) insets the VISIBLE box inward from its
      // track allocation — implemented as CSS margin, not padding: a
      // literal `padding` would only push the centred number label
      // further from an unmoved border (a no-op for symmetric content
      // that's already centred), margin is what actually shrinks the
      // bordered box within its grid area.
      const pad = grid.padding || 0;
      if (pad) b += ` margin: ${pad}px;`;
      return `grid-column: ${c.col + 1} / span ${c.colSpan}; grid-row: ${c.row + 1} / span ${c.rowSpan}; ${b}`;
    }),
  };
}

/** Paints the live preview element as a real CSS grid (rect grids) or an
 * embedded SVG (polygon grids, e.g. Voronoi — see buildPolygonSVG's own
 * note) — either way, the interactive canvas and the exported markup are
 * generated by this same function/branch, so they can't drift. */
export function paintGridDOM(el, model, inner, lineColor) {
  if (model.grid.cellShape === 'polygon') {
    el.removeAttribute('style');
    el.innerHTML = buildPolygonSVG(model, inner, lineColor);
    return;
  }
  const { containerCSS, cellCSS } = buildGridCSS(model);
  el.style.cssText = containerCSS;
  el.innerHTML = '';
  model.cells.forEach((c, i) => {
    const cell = document.createElement('div');
    cell.className = 'loom-cell';
    cell.style.cssText = cellCSS[i];
    cell.textContent = c.number != null ? c.number : i + 1;
    el.appendChild(cell);
  });
}

/** Copy/download-ready HTML snippet — literally the DOM structure
 * paintGridDOM builds, serialised, so the two can never drift. */
export function buildHTMLSnippet(model, inner, lineColor) {
  if (model.grid.cellShape === 'polygon') {
    return `<div class="loom-grid">\n${buildPolygonSVG(model, inner, lineColor)}\n</div>`;
  }
  const { containerCSS, cellCSS } = buildGridCSS(model);
  const cellsHTML = model.cells.map((c, i) =>
    `  <div class="loom-cell" style="${cellCSS[i]}">${c.number != null ? c.number : i + 1}</div>`
  ).join('\n');
  return `<div class="loom-grid" style="${containerCSS}">\n${cellsHTML}\n</div>`;
}
