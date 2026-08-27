/* ─────────────────────────────────────────────────────────────
   Rhizome — per-node drag-and-reposition (Piano Parte 3.4a).

   Extends FVS's threshold-drag technique (fvs/index.html:2409-2470) but
   WRITES a new x/y back into the model — that write-back path didn't
   exist anywhere in the repo before this. The card's own header is the
   drag handle (no click-vs-drag ambiguity to resolve: the header has no
   other purpose), so no 5px threshold is needed here unlike FVS's own
   cell-select case.
   ───────────────────────────────────────────────────────────── */

export function bindNodeDrag(handleEl, node, zoomPan, onMove) {
  let dragging = false, startX = 0, startY = 0, originX = 0, originY = 0;

  handleEl.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();   // don't also trigger the canvas's own pan
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    originX = node.x; originY = node.y;
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const zoom = zoomPan ? zoomPan.zoom : 1;
    node.x = originX + (e.clientX - startX) / zoom;
    node.y = originY + (e.clientY - startY) / zoom;
    onMove(node);
  });
  window.addEventListener('mouseup', () => { dragging = false; });
}
