/* ─────────────────────────────────────────────────────────────
   Rhizome — node card renderer. Builds the DOM for one node: header
   (drag handle), input/output port rows, and a small live preview.
   Full parameter editing lives in the shared right panel (inspector-
   panel.js) once the node is selected — the card itself stays minimal,
   the same "one control surface" discipline every other Organica tool
   follows (Piano Parte 3.4e).
   ───────────────────────────────────────────────────────────── */

import { PORT_META } from '../port-types.js';
import { bindNodeDrag } from '../canvas/node-drag.js';

export function createNodeCard(node, nodeType, { zoomPanRef, portEls, onMove, onSelect }) {
  const el = document.createElement('div');
  el.className = 'rz-node';
  el.dataset.nodeId = node.id;
  el.style.left = node.x + 'px';
  el.style.top = node.y + 'px';

  const header = document.createElement('div');
  header.className = 'rz-node__header';
  header.textContent = nodeType.meta.label;
  el.appendChild(header);

  if (nodeType.meta.inputs.length) {
    const inWrap = document.createElement('div');
    inWrap.className = 'rz-node__ports rz-node__ports--in';
    for (const port of nodeType.meta.inputs) {
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
    el.appendChild(inWrap);
  }

  const preview = document.createElement('div');
  preview.className = 'rz-node__preview';
  el.appendChild(preview);

  const status = document.createElement('div');
  status.className = 'rz-node__status';
  el.appendChild(status);

  if (nodeType.meta.outputs.length) {
    const outWrap = document.createElement('div');
    outWrap.className = 'rz-node__ports rz-node__ports--out';
    for (const port of nodeType.meta.outputs) {
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

  bindNodeDrag(header, node, zoomPanRef.current, () => {
    el.style.left = node.x + 'px';
    el.style.top = node.y + 'px';
    onMove();
  });
  el.addEventListener('mousedown', () => onSelect(node.id));

  return { el, previewEl: preview, statusEl: status };
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
  if (portType === 'points') {
    previewEl.textContent = `${value.length} points`;
    return;
  }
  previewEl.textContent = String(value).slice(0, 40);
}
