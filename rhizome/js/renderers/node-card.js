/* ─────────────────────────────────────────────────────────────
   Rhizome — node card renderer. Builds the DOM for one node: header
   (drag handle), input/output port rows, and a small live preview.
   Full parameter editing lives in the shared right panel (inspector-
   panel.js) once the node is selected — the card itself stays minimal,
   the same "one control surface" discipline every other Organica tool
   follows (Piano Parte 3.4e).

   Port rows are rebuildable, not just built-once: a variadic node
   (Merge) can change its own input COUNT at runtime (node-registry.js's
   `getNodeInputs(node)`), so `buildPortRows` is a standalone function
   callable again later, not baked into construction time only.
   ───────────────────────────────────────────────────────────── */

import { PORT_META } from '../port-types.js';
import { bindNodeDrag } from '../canvas/node-drag.js';

function buildPortRows(el, node, nodeInputs, nodeOutputs, portEls) {
  el.querySelectorAll('.rz-node__ports').forEach(n => n.remove());
  // portEls entries for THIS node are stale once rebuilt — drop them so
  // a removed port can't be found as a stale connect target.
  for (const key of Array.from(portEls.keys())) {
    if (key.startsWith(node.id + ':')) portEls.delete(key);
  }

  const preview = el.querySelector('.rz-node__preview');

  if (nodeInputs.length) {
    const inWrap = document.createElement('div');
    inWrap.className = 'rz-node__ports rz-node__ports--in';
    for (const port of nodeInputs) {
      const row = document.createElement('div');
      row.className = 'rz-port-row rz-port-row--in';
      row.dataset.portDir = 'in';
      row.dataset.nodeId = node.id;
      row.dataset.portName = port.name;
      const dot = document.createElement('span');
      dot.className = 'rz-port-dot';
      dot.style.borderColor = PORT_META[port.type].color;
      row.appendChild(dot);
      const label = document.createElement('span');
      label.className = 'rz-port-label';
      label.textContent = port.name;
      row.appendChild(label);
      inWrap.appendChild(row);
      portEls.set(`${node.id}:in:${port.name}`, dot);
    }
    el.insertBefore(inWrap, preview);
  }

  if (nodeOutputs.length) {
    const outWrap = document.createElement('div');
    outWrap.className = 'rz-node__ports rz-node__ports--out';
    for (const port of nodeOutputs) {
      const row = document.createElement('div');
      row.className = 'rz-port-row rz-port-row--out';
      row.dataset.portDir = 'out';
      row.dataset.nodeId = node.id;
      row.dataset.portName = port.name;
      const label = document.createElement('span');
      label.className = 'rz-port-label';
      label.textContent = port.name;
      row.appendChild(label);
      const dot = document.createElement('span');
      dot.className = 'rz-port-dot';
      dot.style.borderColor = PORT_META[port.type].color;
      row.appendChild(dot);
      outWrap.appendChild(row);
      portEls.set(`${node.id}:out:${port.name}`, dot);
    }
    el.appendChild(outWrap);
  }
}

// `getPos(n)` — reads a node's current x/y and applies it to ITS OWN
// card element; supplied by main.js so this card doesn't need to know
// about every other card's DOM (needed because a multi-node drag group
// updates nodes this card never built). `onMove`/`onDragEnd` receive the
// full drag group so main.js can reposition every OTHER card + the wires.
export function createNodeCard(node, nodeType, nodeInputs, { zoomPanRef, portEls, onMove, onDragEnd, onSelect, getDragGroup, applyPos }) {
  const el = document.createElement('div');
  el.className = 'rz-node';
  el.dataset.nodeId = node.id;
  el.style.left = node.x + 'px';
  el.style.top = node.y + 'px';

  const header = document.createElement('div');
  header.className = 'rz-node__header';
  header.textContent = nodeType.meta.label;
  el.appendChild(header);

  const preview = document.createElement('div');
  preview.className = 'rz-node__preview';
  el.appendChild(preview);

  const status = document.createElement('div');
  status.className = 'rz-node__status';
  el.appendChild(status);

  buildPortRows(el, node, nodeInputs, nodeType.meta.outputs, portEls);

  bindNodeDrag(header, node, zoomPanRef.current, (group) => {
    for (const n of group) applyPos(n);
    onMove(group);
  }, (group, moved) => onDragEnd(group, moved), getDragGroup);
  header.addEventListener('mousedown', (e) => onSelect(node.id, e));

  return {
    el, previewEl: preview, statusEl: status,
    refreshPorts: (inputs, outputs) => buildPortRows(el, node, inputs, outputs, portEls),
  };
}

// Renders a value into a node's small preview area — the same value type
// dispatch every export/preview path in the repo already does, kept tiny
// on purpose (this is a thumbnail, not a second full renderer).
export function renderPreview(previewEl, portType, value) {
  if (value == null) { previewEl.innerHTML = '<span class="rz-node__empty">—</span>'; return; }
  if (portType === 'svg') {
    previewEl.innerHTML = value;
    const svg = previewEl.querySelector('svg');
    if (svg) { svg.removeAttribute('width'); svg.removeAttribute('height'); svg.style.width = '100%'; svg.style.height = '100%'; }
    return;
  }
  if (portType === 'grid') {
    previewEl.textContent = `${value.cells.length} cells`;
    return;
  }
  if (portType === 'image') {
    if (value.dataURL) {
      previewEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = value.dataURL;
      img.style.cssText = 'max-width:100%; max-height:100%; object-fit:contain;';
      previewEl.appendChild(img);
    } else {
      previewEl.textContent = `${value.width}×${value.height} mask`;
    }
    return;
  }
  if (portType === 'points') {
    previewEl.textContent = `${value.length} points`;
    return;
  }
  previewEl.textContent = String(value).slice(0, 40);
}
