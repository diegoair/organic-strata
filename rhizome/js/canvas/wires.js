/* ─────────────────────────────────────────────────────────────
   Rhizome — live wire rendering (Piano Parte 3.4b).

   Extends Mycel's curve math (mycel/index.html:521 edgeToPathD / :540
   catmullSegD) — the FORMULA is reused (a quadratic Bézier with a
   horizontal control-point offset, same shape as Mycel's own edge
   curves), the INTERACTIVE recompute loop is new: Mycel computes this
   once per algorithm run, Rhizome recomputes it on every node drag /
   pending-connection mousemove.

   Wires are click-selectable (onWireClick) so Delete can remove a
   connection without deleting either node — the natural pairing once
   node multi-select + Delete existed, so an edge needed the same.
   ───────────────────────────────────────────────────────────── */

export function wirePathD(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

export function portCenter(portEl, graphEl, zoom) {
  const g = graphEl.getBoundingClientRect();
  const p = portEl.getBoundingClientRect();
  return {
    x: (p.left + p.width / 2 - g.left) / zoom,
    y: (p.top + p.height / 2 - g.top) / zoom,
  };
}

// One <path> per edge, keyed by edge.id, plus one extra "pending" path
// for a wire currently being dragged from a port.
export class WireLayer {
  constructor(svgEl, onWireClick) {
    this.svgEl = svgEl;
    this.paths = new Map();
    this.pendingPath = null;
    this.onWireClick = onWireClick || null;
    this.selectedEdgeId = null;
  }

  updateAll(model, portEls, graphEl, zoom) {
    const seen = new Set();
    for (const edge of model.edges) {
      seen.add(edge.id);
      const fromEl = portEls.get(`${edge.from.nodeId}:out:${edge.from.port}`);
      const toEl = portEls.get(`${edge.to.nodeId}:in:${edge.to.port}`);
      if (!fromEl || !toEl) continue;
      let path = this.paths.get(edge.id);
      if (!path) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'rz-wire');
        path.style.pointerEvents = 'stroke';   // clickable along the stroke, not just its bbox
        if (this.onWireClick) path.addEventListener('click', (e) => { e.stopPropagation(); this.onWireClick(edge.id); });
        this.svgEl.appendChild(path);
        this.paths.set(edge.id, path);
      }
      path.classList.toggle('is-selected', edge.id === this.selectedEdgeId);
      const a = portCenter(fromEl, graphEl, zoom), b = portCenter(toEl, graphEl, zoom);
      path.setAttribute('d', wirePathD(a.x, a.y, b.x, b.y));
    }
    for (const [id, path] of this.paths) {
      if (!seen.has(id)) { path.remove(); this.paths.delete(id); }
    }
  }

  setSelectedEdge(edgeId) {
    this.selectedEdgeId = edgeId;
    for (const [id, path] of this.paths) path.classList.toggle('is-selected', id === edgeId);
  }

  setPending(x1, y1, x2, y2) {
    if (!this.pendingPath) {
      this.pendingPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this.pendingPath.setAttribute('class', 'rz-wire rz-wire--pending');
      this.svgEl.appendChild(this.pendingPath);
    }
    this.pendingPath.setAttribute('d', wirePathD(x1, y1, x2, y2));
  }

  clearPending() {
    if (this.pendingPath) { this.pendingPath.remove(); this.pendingPath = null; }
  }
}
