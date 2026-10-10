// Stage-shadow test (Oct 10, 2026 — LOCAL, not committed). Variant C ("rest"): html.is-moving while the user pans,
// zooms or drags, cleared 180 ms after the last move — the soft shadow is drawn only when nothing moves.
// Injected into FVS by _stage-shadow.html and scripts/_test-stage-shadow.mjs; the variant is <html data-stage-shadow>.
(function () {
  if (window.__stageShadow) return;
  const root = document.documentElement;
  let timer = 0, down = false;
  const move = () => {
    if (root.dataset.stageShadow !== 'rest') return;
    root.classList.add('is-moving');
    clearTimeout(timer);
    if (!down) timer = setTimeout(() => root.classList.remove('is-moving'), 180);
  };
  addEventListener('wheel', move, { passive: true, capture: true });
  addEventListener('pointerdown', () => { down = true; }, true);
  addEventListener('pointermove', e => { if (down && e.buttons) move(); }, { passive: true, capture: true });
  addEventListener('pointerup', () => { down = false; move(); }, true);
  addEventListener('pointercancel', () => { down = false; move(); }, true);
  window.__stageShadow = { set: v => { root.dataset.stageShadow = v; root.classList.remove('is-moving'); } };
})();
