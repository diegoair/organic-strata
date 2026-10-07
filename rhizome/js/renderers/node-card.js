/* ─────────────────────────────────────────────────────────────
   Rhizome — the preview in a node card's body. The card itself (head, ports, status) is the shared node
   canvas's (Organica.nodeCanvas); main.js's renderBody() calls this with the node's output.
   An SVG is shown as an <img> from a blob URL — never parsed into the page (an imported SVG can carry script).
   ───────────────────────────────────────────────────────────── */

const urls = new WeakMap();   // preview box → its current blob URL (revoked when replaced)

function caption(box, text) {
  const p = document.createElement('p'); p.className = 'rz-preview__caption'; p.textContent = text;
  box.replaceChildren(p);
}
function image(box, src) {
  const img = document.createElement('img'); img.alt = ''; img.src = src;
  box.replaceChildren(img);
}

export function renderPreview(box, kind, value) {
  const old = urls.get(box); if (old) { URL.revokeObjectURL(old); urls.delete(box); }
  if (value == null) { caption(box, '—'); return; }
  if (kind === 'svg') {
    const url = URL.createObjectURL(new Blob([value], { type: 'image/svg+xml' }));
    urls.set(box, url); image(box, url); return;
  }
  if (kind === 'grid') { caption(box, `${value.cells.length} cells`); return; }
  if (kind === 'image') { if (value.dataURL) image(box, value.dataURL); else caption(box, `${value.width} × ${value.height} mask`); return; }
  if (kind === 'points') { caption(box, `${value.length} points`); return; }
  caption(box, String(value).slice(0, 40));
}
