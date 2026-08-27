/* ─────────────────────────────────────────────────────────────
   Rhizome — port hit-testing + drag-to-connect (Piano Parte 3.4c).
   No precedent in the repo — genuinely new interaction. Mousedown on an
   output port starts a pending edge that follows the cursor (wires.js's
   setPending); mouseup over a compatible input port commits it.
   ───────────────────────────────────────────────────────────── */

import { canAdapt } from '../adapters.js';
import { addEdge } from '../graph-model.js';
import { topoSort, CycleError } from '../execution-engine.js';

export function bindPortInteractions({ graphEl, wireLayer, portEls, model, getNodeOutputType, getNodeInputType, zoomPanRef, onConnected, onRejected }) {
  let connecting = null;   // { fromNodeId, fromPort, type }

  function zoom() { return zoomPanRef.current ? zoomPanRef.current.zoom : 1; }

  function graphPoint(clientX, clientY) {
    const g = graphEl.getBoundingClientRect();
    return { x: (clientX - g.left) / zoom(), y: (clientY - g.top) / zoom() };
  }

  // Delegated on graphEl, not bound per-port at setup time: portEls gains
  // new entries every time a node is added after boot (i.e. every node,
  // since the graph starts empty) — a listener attached once over the
  // map's contents at call time would silently never fire for any of
  // them. Found live: connecting a freshly-added node's ports did
  // nothing at all, no error, because this loop had bound zero listeners.
  // Captured (not bubble) and stopImmediatePropagation: Organica.createZoomPan
  // binds its own pan-start mousedown listener directly on this same
  // graphEl (it's the `canvas` element passed to createZoomPan) — plain
  // stopPropagation only blocks the event reaching ANCESTOR elements, not
  // sibling listeners already on graphEl itself, so a port drag would
  // otherwise also start a canvas pan at the same time.
  graphEl.addEventListener('mousedown', e => {
    const row = e.target.closest ? e.target.closest('[data-port-dir="out"]') : null;
    if (!row) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const nodeId = row.dataset.nodeId, portName = row.dataset.portName;
    const type = getNodeOutputType(nodeId, portName);
    connecting = { fromNodeId: nodeId, fromPort: portName, type };
  }, true);

  window.addEventListener('mousemove', e => {
    if (!connecting) return;
    const fromEl = portEls.get(`${connecting.fromNodeId}:out:${connecting.fromPort}`);
    if (!fromEl) return;
    const fr = fromEl.getBoundingClientRect(), g = graphEl.getBoundingClientRect();
    const p1 = { x: (fr.left + fr.width / 2 - g.left) / zoom(), y: (fr.top + fr.height / 2 - g.top) / zoom() };
    const p2 = graphPoint(e.clientX, e.clientY);
    wireLayer.setPending(p1.x, p1.y, p2.x, p2.y);
  });

  window.addEventListener('mouseup', e => {
    if (!connecting) return;
    const from = connecting;
    connecting = null;
    wireLayer.clearPending();

    const target = document.elementFromPoint(e.clientX, e.clientY);
    const portEl = target && target.closest ? target.closest('[data-port-dir="in"]') : null;
    if (!portEl) return;
    const toNodeId = portEl.dataset.nodeId, toPort = portEl.dataset.portName;
    const toType = getNodeInputType(toNodeId, toPort);
    if (!canAdapt(from.type, toType)) {
      onRejected && onRejected(`No connection: "${from.type}" → "${toType}" isn't compatible.`);
      return;
    }

    const trial = { ...model, edges: [...model.edges, { id: '__trial', from: { nodeId: from.fromNodeId, port: from.fromPort }, to: { nodeId: toNodeId, port: toPort } }] };
    try {
      topoSort(trial);
    } catch (err) {
      if (err instanceof CycleError) { onRejected && onRejected(err.message); return; }
      throw err;
    }

    addEdge(model, { nodeId: from.fromNodeId, port: from.fromPort }, { nodeId: toNodeId, port: toPort });
    onConnected && onConnected();
  });
}
