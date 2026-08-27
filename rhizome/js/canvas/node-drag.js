/* ─────────────────────────────────────────────────────────────
   Rhizome — per-node drag-and-reposition (Piano Parte 3.4a), extended
   for multi-select (dragging one selected node moves the whole current
   selection together — the standard node-editor expectation once
   marquee-select exists) and for undo/redo (onDragEnd fires once per
   drag, not per pixel, so history gets one snapshot per drag instead
   of one per mousemove tick).

   Extends FVS's threshold-drag technique (fvs/index.html:2409-2470) but
   WRITES a new x/y back into the model — that write-back path didn't
   exist anywhere in the repo before this. The card's own header is the
   drag handle (no click-vs-drag ambiguity to resolve: the header has no
   other purpose), so no 5px threshold is needed here unlike FVS's own
   cell-select case.
   ───────────────────────────────────────────────────────────── */

// `getDragGroup(node)` returns the array of nodes that should move
// together — just [node] normally, or the full current multi-selection
// when node is part of one (main.js supplies this from its own
// selection Set). `onMove(nodes)` fires every tick; `onDragEnd(nodes,
// moved)` fires once on release, `moved` false if it was really just a
// click (no history snapshot wanted for a no-op drag).
export function bindNodeDrag(handleEl, node, zoomPan, onMove, onDragEnd, getDragGroup) {
  let dragging = false, moved = false, startX = 0, startY = 0;
  let group = [node];
  let origins = new Map();

  handleEl.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();   // don't also trigger the canvas's own pan
    dragging = true; moved = false;
    startX = e.clientX; startY = e.clientY;
    group = (getDragGroup ? getDragGroup(node) : null) || [node];
    origins = new Map(group.map(n => [n.id, { x: n.x, y: n.y }]));
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const zoom = zoomPan ? zoomPan.zoom : 1;
    const dx = (e.clientX - startX) / zoom, dy = (e.clientY - startY) / zoom;
    if (dx !== 0 || dy !== 0) moved = true;
    for (const n of group) {
      const o = origins.get(n.id);
      n.x = o.x + dx; n.y = o.y + dy;
    }
    onMove(group);
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    if (onDragEnd) onDragEnd(group, moved);
  });
}
