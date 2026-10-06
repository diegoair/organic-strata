// Flexible Visual System · 09-symbol-render — Symbol render — spans, outlines, buildSymbolItems / buildSymbolSVG / drawSymbolCanvas.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
// resolveCellPlacement(cellW, cellH, natural, cell) — moved to
// shared/shapes.js, aliased at the top of this script. Shared by both
// source types and both render paths (SVG string, Canvas2D) — turns fit
// mode + anchor + padding + scale/fixedSize into a concrete {scaleX,
// scaleY, offsetX, offsetY} for one cell.
