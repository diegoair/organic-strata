/* ─────────────────────────────────────────────────────────────────────────────
 * shapes.js — Organica.shapes: pure shape geometry + grid cell-placement math.
 *
 * Extracted from fvs/index.html at the second consumer (Trellis) — same
 * "extract at the second consumer" move as noise.js / motion.js / radial.js /
 * pollen-engine.js. FVS's Symbols tier was the first to solve "one shape per
 * grid cell, rect or polygon, fitted/anchored/scaled/rotated"; this file is
 * that solution with its FVS-only state coupling removed, so a new consumer
 * (Trellis) can drive it too. FVS itself now imports from here — verified
 * byte-identical output before/after.
 *
 * SCOPE:
 *   - Shape geometry: triangleGeometry / arcGeometry+arcPathD /
 *     arcTruchetGeometry+arcTruchetPathD — pure functions, no DOM. Each
 *     returns { d, normTx, normTy, normScale } — an SVG path `d` string in a
 *     0..100 box plus a bbox-fit correction transform (identity for these
 *     hand-authored shapes; the hook exists for an uploaded-SVG shape type,
 *     which stays tool-local since the upload/extraction pipeline is
 *     tool-specific).
 *   - Grid cell placement: resolveGridCells / resolveCellPlacement /
 *     cellColRow / frameSize — turn a loadLoomGrid() grid (or a plain square
 *     grid) into per-cell centres + a fit/anchor/padding/scale transform +
 *     a col/row/index/angle context for spatial rule generators.
 *
 * LOAD ORDER: core.js → palette.js → shapes.js → tool script.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  // ── SHAPE GEOMETRY ──────────────────────────────────────────────────────
  // Each shape is drawn directly in a 0..100 box. Real curves (the arcs) are
  // why this is `d` (SVG path syntax) rather than a plain polygon point-list:
  // SVG renders it via <path>, Canvas2D via `ctx.fill(new Path2D(d))` — both
  // support arc (A) commands natively.
  // Any triangle can be placed with its base on a horizontal edge and its
  // apex somewhere above — base width + height + the apex's horizontal
  // position is exactly enough freedom to reach every triangle shape up to
  // similarity (rotation/reflection are already covered by FVS's own
  // transform controls). apexPct = 0 is the old isosceles default (apex
  // centred, byte-identical `d` to the pre-generalisation output); ±100
  // would put the apex directly above a base corner (zero area), so it's
  // clamped just short of that to keep the triangle non-degenerate.
  function triangleGeometry(base, height, apexPct) {
    const halfBase = base / 2;
    const apexY = 50 - height / 2;
    const baseY = 50 + height / 2;
    const pct = Math.max(-98, Math.min(98, apexPct == null ? 0 : apexPct));
    const apexX = 50 + halfBase * (pct / 100);
    const d = `M ${apexX},${apexY} L ${50 - halfBase},${baseY} L ${50 + halfBase},${baseY} Z`;
    return { d, normTx: 0, normTy: 0, normScale: 1 };
  }

  // Apex/pivot anchored at the box's own (0,0) corner, sweeping the quadrant
  // toward (100,0) and (0,100) — outer radius fixed at 100 so the outer curve
  // always reaches the cell's own far edges. thicknessPct sets how much of
  // that radius is filled, from the outer edge inward; 100 = solid quarter-disc.
  function arcPathD(thicknessPct) {
    const ir = 100 * (1 - thicknessPct / 100);
    if (ir <= 0.5) return 'M 0,0 L 100,0 A 100,100 0 0,1 0,100 Z';
    return `M 100,0 A 100,100 0 0,1 0,100 L 0,${ir} A ${ir},${ir} 0 0,0 ${ir},0 Z`;
  }
  function arcGeometry(thicknessPct) {
    return { d: arcPathD(thicknessPct), normTx: 0, normTy: 0, normScale: 1 };
  }

  // Concentric semicircular arc bands from the top AND bottom edge midpoints,
  // mirrored into a butterfly (bookofshapes concentric_arc_truchet_3). One
  // compound `d` (each band is its own closed annular half-ring, non-
  // overlapping → no fill-rule needed). Inscribed in the 0–100 box (max
  // radius 50, the two fans meet at the centre) — no per-cell clip needed.
  // `count` = bands per fan; `ratio` = band-thickness ÷ gap.
  function arcTruchetPathD(count, ratio) {
    count = Math.max(1, Math.round(count == null ? 5 : count));
    ratio = Math.min(0.95, Math.max(0.1, ratio == null ? 0.7 : ratio));
    const cx = 50, step = 50 / count, t = step * ratio;
    const r2 = v => Math.round(v * 1000) / 1000;
    let d = '';
    // side −1 = bottom pivot (py=100, opens up); side +1 = top pivot (py=0, opens down).
    // sweep=1 from left→right bulges UP in SVG's y-down space; the inner arc
    // travels right→left so it takes the opposite flag to bulge the same way.
    const fan = (py, side) => {
      const swOut = side < 0 ? 1 : 0, swIn = side < 0 ? 0 : 1;
      for (let i = 1; i <= count; i++) {
        const R = i * step, r = R - t;
        if (r <= 0.5) {
          d += `M ${r2(cx - R)},${py} A ${r2(R)},${r2(R)} 0 0 ${swOut} ${r2(cx + R)},${py} Z`;
        } else {
          d += `M ${r2(cx - R)},${py} A ${r2(R)},${r2(R)} 0 0 ${swOut} ${r2(cx + R)},${py}`
            + ` L ${r2(cx + r)},${py} A ${r2(r)},${r2(r)} 0 0 ${swIn} ${r2(cx - r)},${py} Z`;
        }
      }
    };
    fan(100, -1);
    fan(0, 1);
    return d;
  }
  function arcTruchetGeometry(count, ratio) {
    return { d: arcTruchetPathD(count, ratio), normTx: 0, normTy: 0, normScale: 1 };
  }

  // Pie / wedge slice, pivoted at the box centre (50,50), radius 50 (touches
  // the box's edge midpoints — same "fills the box at full param" scale as
  // triangleGeometry). Symmetric about the upward vertical axis so a plain
  // rotation transform sweeps it intuitively. angle=360 falls back to a
  // full disc/annulus (two half-circle arcs, same ir<=0.5 solid-vs-ring
  // branch as arcPathD); outer/inner arcs wind opposite directions so the
  // hole reads correctly under the default nonzero fill-rule, no
  // fill-rule attribute needed.
  function wedgePathD(angle, innerRadiusPct) {
    angle = Math.min(360, Math.max(1, angle == null ? 90 : angle));
    innerRadiusPct = Math.min(95, Math.max(0, innerRadiusPct == null ? 0 : innerRadiusPct));
    const cx = 50, cy = 50, R = 50, r = R * innerRadiusPct / 100;
    const r2 = v => Math.round(v * 1000) / 1000;
    const pt = (deg, rad) => {
      const t = (deg - 90) * Math.PI / 180;
      return [r2(cx + rad * Math.cos(t)), r2(cy + rad * Math.sin(t))];
    };
    if (angle >= 359.9) {
      const outer = `M ${cx - R},${cy} A ${R},${R} 0 1,1 ${cx + R},${cy} A ${R},${R} 0 1,1 ${cx - R},${cy} Z`;
      if (r <= 0.5) return outer;
      const inner = `M ${cx - r},${cy} A ${r},${r} 0 1,0 ${cx + r},${cy} A ${r},${r} 0 1,0 ${cx - r},${cy} Z`;
      return outer + ' ' + inner;
    }
    const half = angle / 2, large = angle > 180 ? 1 : 0;
    const [ox0, oy0] = pt(-half, R), [ox1, oy1] = pt(half, R);
    if (r <= 0.5) {
      return `M ${cx},${cy} L ${ox0},${oy0} A ${R},${R} 0 ${large},1 ${ox1},${oy1} Z`;
    }
    const [ix0, iy0] = pt(-half, r), [ix1, iy1] = pt(half, r);
    return `M ${ix0},${iy0} L ${ox0},${oy0} A ${R},${R} 0 ${large},1 ${ox1},${oy1}`
      + ` L ${ix1},${iy1} A ${r},${r} 0 ${large},0 ${ix0},${iy0} Z`;
  }
  function wedgeGeometry(angle, innerRadiusPct) {
    return { d: wedgePathD(angle, innerRadiusPct), normTx: 0, normTy: 0, normScale: 1 };
  }

  // Regular polygon, centred at (50,50), radius 50 (vertices touch the box
  // edges — pointy-top). cornerRadiusPct rounds each vertex by pulling two
  // points back along its adjacent edges (capped at each edge's own
  // midpoint, so opposite corners can never overlap) and bridging them with
  // a quadratic curve through the original vertex — the standard
  // "rounded polygon" construction, same family as the corner-clamp trick
  // already used elsewhere in this project (Apostate's sharpen/polygonizevec).
  function polygonPathD(sides, cornerRadiusPct) {
    sides = Math.max(3, Math.round(sides == null ? 6 : sides));
    cornerRadiusPct = Math.min(100, Math.max(0, cornerRadiusPct == null ? 0 : cornerRadiusPct));
    const cx = 50, cy = 50, R = 50;
    const r2 = v => Math.round(v * 1000) / 1000;
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const t = (i * 360 / sides - 90) * Math.PI / 180;
      pts.push([cx + R * Math.cos(t), cy + R * Math.sin(t)]);
    }
    if (cornerRadiusPct <= 0.5) {
      return 'M ' + pts.map(p => `${r2(p[0])},${r2(p[1])}`).join(' L ') + ' Z';
    }
    const frac = cornerRadiusPct / 100 * 0.5;
    let d = '';
    for (let i = 0; i < sides; i++) {
      const prev = pts[(i - 1 + sides) % sides], cur = pts[i], next = pts[(i + 1) % sides];
      const p1 = [cur[0] + (prev[0] - cur[0]) * frac, cur[1] + (prev[1] - cur[1]) * frac];
      const p2 = [cur[0] + (next[0] - cur[0]) * frac, cur[1] + (next[1] - cur[1]) * frac];
      d += (i === 0 ? 'M ' : 'L ') + `${r2(p1[0])},${r2(p1[1])} `;
      d += `Q ${r2(cur[0])},${r2(cur[1])} ${r2(p2[0])},${r2(p2[1])} `;
    }
    return d + 'Z';
  }
  function polygonGeometry(sides, cornerRadiusPct) {
    return { d: polygonPathD(sides, cornerRadiusPct), normTx: 0, normTy: 0, normScale: 1 };
  }

  // Star: `points`-pointed, alternating outer (radius 50, box-edge-touching)
  // and inner (innerRadiusPct of outer) vertices, centred at (50,50).
  function starPathD(points, innerRadiusPct) {
    points = Math.max(3, Math.round(points == null ? 5 : points));
    innerRadiusPct = Math.min(90, Math.max(5, innerRadiusPct == null ? 45 : innerRadiusPct));
    const cx = 50, cy = 50, R = 50, r = R * innerRadiusPct / 100;
    const r2 = v => Math.round(v * 1000) / 1000;
    const n = points * 2, pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i * 360 / n - 90) * Math.PI / 180;
      const rad = i % 2 === 0 ? R : r;
      pts.push([cx + rad * Math.cos(t), cy + rad * Math.sin(t)]);
    }
    return 'M ' + pts.map(p => `${r2(p[0])},${r2(p[1])}`).join(' L ') + ' Z';
  }
  function starGeometry(points, innerRadiusPct) {
    return { d: starPathD(points, innerRadiusPct), normTx: 0, normTy: 0, normScale: 1 };
  }

  // ── GRID CELL PLACEMENT ─────────────────────────────────────────────────
  // grid = either { kind:'loom', cellShape, cells, width, height } (the shape
  // FVS wraps Organica.loadLoomGrid()'s return into — width/height = the
  // loader's own inner.width/height) or { kind:'square', cols, rows,
  // cellSize, gap } (a plain uniform lattice, no Loom import). Returns
  // grid-centred (origin at the grid's own middle) {cx, cy, cellSize, cellW,
  // cellH} per cell, row-major for 'square'.
  //
  // 'loom' cells carry ABSOLUTE canvas coordinates — Organica.loadLoomGrid's
  // loomResolveCellRects offsets every x/y by inner.x/inner.y (the margin),
  // so a cell's own (x,y) is not 0 at the grid's top-left. Centring on
  // grid.width/2 (assuming coordinates start at 0) leaves every cell shifted
  // by exactly that margin, down-and-right — most visible on a grid's shorter
  // axis, where the fixed-pixel shift is a larger fraction of the content.
  // The fix: derive the origin from the cells' own bounding box, not the
  // caller-supplied width/height.
  function resolveGridCells(grid) {
    if (grid.kind === 'loom') {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const raw = grid.cells.map(c => {
        if (grid.cellShape === 'polygon') {
          const xs = c.points.map(p => p[0]), ys = c.points.map(p => p[1]);
          const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
          minX = Math.min(minX, x0); maxX = Math.max(maxX, x1);
          minY = Math.min(minY, y0); maxY = Math.max(maxY, y1);
          const w = x1 - x0, h = y1 - y0;
          return { cx: c.centroid[0], cy: c.centroid[1], cellSize: Math.min(w, h), cellW: w, cellH: h };
        }
        minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x + c.width);
        minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y + c.height);
        return { cx: c.x + c.width / 2, cy: c.y + c.height / 2, cellSize: Math.min(c.width, c.height), cellW: c.width, cellH: c.height };
      });
      const originX = (minX + maxX) / 2, originY = (minY + maxY) / 2;
      return raw.map(r => ({ ...r, cx: r.cx - originX, cy: r.cy - originY }));
    }
    const totalW = grid.cols * grid.cellSize + (grid.cols - 1) * grid.gap;
    const totalH = grid.rows * grid.cellSize + (grid.rows - 1) * grid.gap;
    const originX = -totalW / 2, originY = -totalH / 2;
    const centers = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        centers.push({
          cx: originX + c * (grid.cellSize + grid.gap) + grid.cellSize / 2,
          cy: originY + r * (grid.cellSize + grid.gap) + grid.cellSize / 2,
          cellSize: grid.cellSize, cellW: grid.cellSize, cellH: grid.cellSize,
        });
      }
    }
    return centers;   // square grids: row-major, e.g. 2×2 = [TL, TR, BL, BR]
  }

  function frameSize(grid) {
    if (grid.kind === 'loom') return Math.max(grid.width, grid.height);
    return grid.cols * grid.cellSize + (grid.cols - 1) * grid.gap;
  }

  // Turns fit mode + anchor + padding + scale into a concrete {scaleX,
  // scaleY, offsetX, offsetY} for one cell. `natural` is the shape's own
  // untransformed box size (100 for these shapes; a nested item's own frame
  // size for a compound shape). Reduces to exactly plain centred-contain at
  // the defaults (fitMode:'contain', anchorX/Y:0, padding:0, scale:1).
  function resolveCellPlacement(cellW, cellH, natural, cell) {
    const pad = 1 - (cell.padding || 0);
    const effW = cellW * pad, effH = cellH * pad;
    const scale = cell.scale == null ? 1 : cell.scale;
    let scaleX, scaleY;
    if (cell.fitMode === 'fill') {
      scaleX = (effW / natural) * scale;
      scaleY = (effH / natural) * scale;
    } else if (cell.fitMode === 'fixed') {
      scaleX = scaleY = (cell.fixedSize || 100) / natural;
    } else {
      scaleX = scaleY = (Math.min(effW, effH) / natural) * scale;
    }
    const itemW = natural * scaleX, itemH = natural * scaleY;
    const ax = cell.anchorX || 0, ay = cell.anchorY || 0;
    return {
      scaleX, scaleY,
      offsetX: ax * (effW - itemW) / 2,
      offsetY: ay * (effH - itemH) / 2,
    };
  }

  function median(arr) { const s = [...arr].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; }

  // Per-cell {col,row,cols,rows,cx,cy,nx,ny,angle,index,count}, parallel to
  // resolveGridCells(grid)'s own output — the context spatial-rule /
  // stagger-phase generators read. Rect Loom cells carry real col/row in
  // their JSON, passed in as `rawCells` (the caller's own loadLoomGrid().cells
  // — kept as a separate arg rather than reached-into from shared state, the
  // one real change from FVS's original inline copy, which read a module
  // global); `gridMeta` is the raw loadLoomGrid().grid ({params, tracks}),
  // read only for the cols/rows count preference chain below — optional,
  // falls straight to the col/colSpan-derived count without it. Polygon
  // cells (and any rect caller that omits rawCells) fall back to binning
  // centroids into row/column bands.
  function cellColRow(grid, rawCells, gridMeta) {
    const centers = resolveGridCells(grid);   // {cx,cy,cellSize,cellW,cellH} grid-centred
    const n = centers.length;
    // 'square' grids carry no width/height (only 'loom' grids do) — fall
    // back to frameSize(grid), which already knows both kinds; a square
    // grid is square, so one dimension is exactly right for both halves.
    const halfW = (grid.width != null ? grid.width : frameSize(grid)) / 2;
    const halfH = (grid.height != null ? grid.height : frameSize(grid)) / 2;
    let colRow;
    if (grid.cellShape === 'rect' && rawCells && rawCells.length === n && rawCells.every(c => c.col != null)) {
      const g = gridMeta || {};
      const cols = (g.params && g.params.cols) || (g.tracks && g.tracks.cols && g.tracks.cols.length) ||
        Math.max(...rawCells.map(c => c.col + (c.colSpan || 1)));
      const rows = (g.params && g.params.rows) || (g.tracks && g.tracks.rows && g.tracks.rows.length) ||
        Math.max(...rawCells.map(c => c.row + (c.rowSpan || 1)));
      colRow = rawCells.map(c => ({ col: c.col, row: c.row, cols, rows }));
    } else {
      // Bin centroids: sorted unique y → rows, sorted unique x → cols.
      const medH = median(centers.map(c => c.cellH)) || 1;
      const medW = median(centers.map(c => c.cellW)) || 1;
      const bands = (vals, tol) => {
        const sorted = [...new Set(vals)].sort((a, b) => a - b);
        const reps = [];
        sorted.forEach(v => { if (!reps.length || v - reps[reps.length - 1] > tol) reps.push(v); });
        return reps;
      };
      const rowReps = bands(centers.map(c => c.cy), medH * 0.5);
      const colReps = bands(centers.map(c => c.cx), medW * 0.5);
      const nearest = (v, reps) => { let bi = 0, bd = Infinity; reps.forEach((r, i) => { const d = Math.abs(r - v); if (d < bd) { bd = d; bi = i; } }); return bi; };
      colRow = centers.map(c => ({ col: nearest(c.cx, colReps), row: nearest(c.cy, rowReps), cols: colReps.length, rows: rowReps.length }));
    }
    return centers.map((c, i) => ({
      ...colRow[i], cx: c.cx, cy: c.cy,
      nx: c.cx / (halfW || 1), ny: c.cy / (halfH || 1),
      angle: Math.atan2(c.cy, c.cx), index: i, count: n,
    }));
  }

  Organica.shapes = {
    triangleGeometry, arcGeometry, arcPathD, arcTruchetGeometry, arcTruchetPathD,
    wedgeGeometry, wedgePathD, polygonGeometry, polygonPathD, starGeometry, starPathD,
    resolveGridCells, resolveCellPlacement, cellColRow, frameSize, median,
  };
})(window);
