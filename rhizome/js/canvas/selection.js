/* ─────────────────────────────────────────────────────────────
   Rhizome — multi-select / marquee-select on the canvas.

   Gesture: Shift+drag on empty canvas draws a marquee rect and selects
   every node whose card intersects it; plain click on empty canvas
   clears the selection; Shift+click on a node header toggles it in/out.

   Deliberately gated on Shift, not plain left-drag: plain left-drag on
   empty canvas is already `Organica.createZoomPan`'s own pan gesture
   (panAlways, added for Rhizome this session) — the two can't share the
   same bare gesture, and re-purposing plain-drag-on-canvas away from pan
   would regress an already-shipped, already-verified interaction rather
   than add a new one. A capture-phase listener on graphEl (same
   technique ports.js already uses for its own connect-drag) intercepts
   the Shift+drag case with stopImmediatePropagation before pan-zoom's
   own bubble-phase mousedown listener ever sees it.
   ───────────────────────────────────────────────────────────── */

export function bindSelection({ graphEl, wrapEl, marqueeEl, model, cardRefs, zoomPanRef, onSelectionChange }) {
  let dragging = false, startX = 0, startY = 0, additive = false;
  const selected = new Set();

  function zoom() { return zoomPanRef.current ? zoomPanRef.current.zoom : 1; }

  function graphPoint(clientX, clientY) {
    const g = graphEl.getBoundingClientRect();
    return { x: (clientX - g.left) / zoom(), y: (clientY - g.top) / zoom() };
  }

  function cardGraphRect(nodeId) {
    const ref = cardRefs.get(nodeId);
    if (!ref) return null;
    const g = graphEl.getBoundingClientRect();
    const r = ref.el.getBoundingClientRect();
    const z = zoom();
    return { x: (r.left - g.left) / z, y: (r.top - g.top) / z, w: r.width / z, h: r.height / z };
  }

  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function applySelection(next) {
    selected.clear();
    for (const id of next) selected.add(id);
    for (const node of model.nodes) {
      const ref = cardRefs.get(node.id);
      if (ref) ref.el.classList.toggle('is-multi-selected', selected.has(node.id));
    }
    onSelectionChange(new Set(selected));
  }

  graphEl.addEventListener('mousedown', e => {
    if (!e.shiftKey) return;   // plain drag stays pan-zoom's own gesture
    const hitNode = e.target.closest ? e.target.closest('.rz-node') : null;
    const hitPort = e.target.closest ? e.target.closest('[data-port-dir]') : null;
    if (hitPort) return;   // let ports.js's own connect-drag run
    if (hitNode) return;   // Shift+click-on-node is handled by main.js's onSelect toggle instead
    e.stopImmediatePropagation();
    e.preventDefault();
    dragging = true; additive = true;   // Shift+drag on empty canvas always adds to selection
    const p = graphPoint(e.clientX, e.clientY);
    startX = p.x; startY = p.y;
    marqueeEl.style.display = 'block';
  }, true);

  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const p = graphPoint(e.clientX, e.clientY);
    const x = Math.min(startX, p.x), y = Math.min(startY, p.y);
    const w = Math.abs(p.x - startX), h = Math.abs(p.y - startY);
    marqueeEl.setAttribute('x', x); marqueeEl.setAttribute('y', y);
    marqueeEl.setAttribute('width', w); marqueeEl.setAttribute('height', h);
    const rect = { x, y, w, h };
    const hits = model.nodes.filter(n => {
      const cr = cardGraphRect(n.id);
      return cr && intersects(cr, rect);
    }).map(n => n.id);
    applySelection(additive ? new Set([...selected, ...hits]) : hits);
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    marqueeEl.style.display = 'none';
  });

  // Plain click on empty canvas (no Shift, no drag) clears the selection —
  // matches Strata's own Refine-editor convention for click-to-deselect.
  graphEl.addEventListener('click', e => {
    if (e.shiftKey) return;
    const hitNode = e.target.closest ? e.target.closest('.rz-node') : null;
    if (hitNode) return;
    if (selected.size) applySelection([]);
  });

  return {
    get current() { return new Set(selected); },
    toggle(nodeId) {
      const next = new Set(selected);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      applySelection(next);
    },
    set(nodeIds) { applySelection(nodeIds); },
    clear() { applySelection([]); },
  };
}
