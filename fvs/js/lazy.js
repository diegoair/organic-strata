// Flexible Visual System — the on-demand part: Figure (./figure.js, ~91 KB) loads the first time it is needed.
let pending = null, loaded = false;
export function loadFigureTier() {
  if (!pending) pending = import('./figure.js').then(() => { loaded = true; });
  return pending;
}
export function isFigureLoaded() { return loaded; }
