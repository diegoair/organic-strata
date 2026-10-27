// Flexible Visual System · engine/03-drive — what drives a zone cell by cell (Oct 27, 2026 — Diego: "campi" and "ritmo e
// progressione"; lifted from the Tropism test page, explorations/tropism T3 signals and walks). Pure maths, no state.
//   signal(kind, u, v, p) → 0..1 at a place (u, v in 0..1 across the zone): a gradient at an angle, the distance from
//     the centre, rings, value noise, a photo's luminance (a 32 × 32 sample the UI made, p.lum = base64 of 1024 bytes).
//   walkOrder(idxs, ctxs, kind) → the zone's cells in the order a rhythm visits them: reading, snake, spiral (from the
//     outside in), rings (from the centre out), diagonal.
// The internal name is drive: shared/fvs-field.js (Organica.fvsField) is something else. Map docs/FVS.md §6c.

const clamp = v => Math.min(1, Math.max(0, v));
const lumCache = new Map();
function lumOf(b64) {
  if (lumCache.has(b64)) return lumCache.get(b64);
  let arr = null;
  try { const s = atob(b64); arr = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i); } catch (e) { arr = null; }
  lumCache.set(b64, arr);
  return arr;
}
export const SIGNALS = ['gradient', 'centre', 'rings', 'noise', 'photo'];
export function signal(kind, u, v, p = {}) {
  if (kind === 'photo') {
    const L = p.lum && lumOf(p.lum), N = 32;
    if (!L || L.length < N * N) return 0.5;
    return L[Math.min(N - 1, Math.floor(v * N)) * N + Math.min(N - 1, Math.floor(u * N))] / 255;
  }
  if (kind === 'noise') {
    const s = +p.seed || 0, k = +p.scale || 3, n = Organica.noise;
    return clamp(n.vnoise(u * k + s * 17.3, v * k + s * 7.1) * 0.65 + n.vnoise(u * k * 2.3 + s * 3.7, v * k * 2.3 + s * 11.9) * 0.35);
  }
  if (kind === 'gradient') { const a = (+p.angle || 0) * Math.PI / 180; return clamp(0.5 + (u - 0.5) * Math.cos(a) + (v - 0.5) * Math.sin(a)); }
  const r = Math.hypot(u - 0.5, v - 0.5) / Math.SQRT1_2;
  if (kind === 'centre') return clamp(r);
  return (Math.floor(clamp(r) * (+p.rings || 3) * 0.9999) % 2) ? 0.85 : 0.15;   // rings: alternate bands
}
// u, v of each zone cell, 0..1 across the zone's own extent (from the cells' grid-centred nx / ny)
export function zoneUV(idxs, ctxs) {
  const xs = idxs.map(i => ctxs[i].nx), ys = idxs.map(i => ctxs[i].ny);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const m = new Map();
  idxs.forEach(i => m.set(i, [x1 > x0 ? (ctxs[i].nx - x0) / (x1 - x0) : 0.5, y1 > y0 ? (ctxs[i].ny - y0) / (y1 - y0) : 0.5]));
  return m;
}
export const WALKS = ['reading', 'snake', 'spiral', 'rings', 'diagonal'];
export function walkOrder(idxs, ctxs, kind) {
  const c = i => ctxs[i], list = idxs.slice();
  const cx = list.reduce((t, i) => t + c(i).nx, 0) / (list.length || 1), cy = list.reduce((t, i) => t + c(i).ny, 0) / (list.length || 1);
  const ang = i => Math.atan2(c(i).ny - cy, c(i).nx - cx), rad = i => Math.hypot(c(i).nx - cx, c(i).ny - cy);
  if (kind === 'snake') return list.sort((a, b) => (c(a).row - c(b).row) || ((c(a).row % 2 ? -1 : 1) * (c(a).col - c(b).col)));
  if (kind === 'diagonal') return list.sort((a, b) => (c(a).col + c(a).row) - (c(b).col + c(b).row) || c(a).row - c(b).row);
  if (kind === 'rings') return list.sort((a, b) => (rad(a) - rad(b)) || (ang(a) - ang(b)));
  if (kind === 'spiral') {   // the outer ring first, clockwise from the top left, then inwards (square lattices: by the cell's depth from the edge)
    const cols = list.map(i => c(i).col), rows = list.map(i => c(i).row), c0 = Math.min(...cols), c1 = Math.max(...cols), r0 = Math.min(...rows), r1 = Math.max(...rows);
    const depth = i => Math.min(c(i).col - c0, c1 - c(i).col, c(i).row - r0, r1 - c(i).row);
    const a = i => { const t = ang(i) + Math.PI * 0.75; return ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); };
    return list.sort((p, q) => (depth(p) - depth(q)) || (a(p) - a(q)));
  }
  return list.sort((a, b) => (c(a).row - c(b).row) || (c(a).col - c(b).col));
}
