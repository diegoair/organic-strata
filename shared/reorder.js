/* ─────────────────────────────────────────────────────────────────────────────
 * reorder.js — Organica.reorder: move items of a list by pointer drag or keyboard, on either axis.
 *
 * Nov 21, 2026 (design-system CONSULT: the third list reorder — FVS layers, Living Path, TuneSutra's colour order —
 * fires the Oct 3 trigger, ledger). The behaviour is FVS's layer drag (fvs/js/07-library.js), made generic: a
 * POINTER drag, not native HTML5 drag and drop (it would not start from a <button> in Safari / Firefox); press an
 * item, move 4px, drop on another — its first half = before it, its second half = after. Keyboard: ⌥← / ⌥→
 * (axis 'x') or ⌥↑ / ⌥↓ ('y') moves the focused item; focus follows it; a polite live region says where it is.
 *
 *   const r = Organica.reorder(listEl, {
 *     item: '.my-item',               // the items (each a focusable element, in DOM order)
 *     axis: 'x' | 'y',                // default 'x'
 *     onMove(from, to),               // the host moves its data and redraws the list
 *     say(i, n) → string,             // optional: the live region's words after a move (default "‹i+1› of ‹n›")
 *   });
 *   r.destroy()
 *
 * Classes it sets: .is-dragging on the dragged item, .drop-before / .drop-after on the target (styles: panel.css,
 * .org-reorder). LOAD ORDER: core.js → this.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  function reorder(list, opts) {
    const axis = opts.axis === 'y' ? 'y' : 'x', sel = opts.item;
    const items = () => Array.prototype.slice.call(list.querySelectorAll(sel));
    list.classList.add('org-reorder', 'org-reorder--' + axis);
    const live = document.createElement('span');
    live.className = 'org-reorder__live'; live.setAttribute('aria-live', 'polite');
    list.after(live);
    const say = (i, n) => { live.textContent = opts.say ? opts.say(i, n) : (i + 1) + ' of ' + n; };
    const clear = () => list.querySelectorAll('.drop-before, .drop-after, .is-dragging').forEach(el => el.classList.remove('drop-before', 'drop-after', 'is-dragging'));
    const focusAt = i => { const el = items()[i]; if (el) el.focus({ preventScroll: true }); };
    function move(from, to) {
      const n = items().length;
      to = Math.max(0, Math.min(n - 1, to));
      if (to === from) return;
      opts.onMove(from, to);
      focusAt(to);
      say(to, n);
    }
    // where a drop on `el` sends the dragged item
    function target(e, el, from) {
      const all = items(), t = all.indexOf(el), r = el.getBoundingClientRect();
      const first = axis === 'x' ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
      let to = first ? t : t + 1;
      if (from < to) to--;
      return { to: Math.max(0, Math.min(all.length - 1, to)), before: first };
    }
    let press = null;
    const itemAt = e => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest(sel); };
    function down(e) {
      const el = e.button === 0 && e.target.closest(sel);
      if (!el || !list.contains(el)) return;
      press = { from: items().indexOf(el), x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, el: el };
    }
    function moveP(e) {
      if (!press || e.pointerId !== press.id) return;
      if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 4) return;
      if (!press.moved) { press.moved = true; press.el.classList.add('is-dragging'); try { list.setPointerCapture(e.pointerId); } catch (err) { /* */ } }
      list.querySelectorAll('.drop-before, .drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after'));
      const over = itemAt(e);
      if (over && over !== press.el && list.contains(over)) over.classList.add(target(e, over, press.from).before ? 'drop-before' : 'drop-after');
    }
    function up(e) {
      if (!press || e.pointerId !== press.id) return;
      const p = press; press = null;
      if (!p.moved) { clear(); return; }
      const over = itemAt(e);
      clear();
      // a drag is not a click on the item
      const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); list.removeEventListener('click', swallow, true); };
      list.addEventListener('click', swallow, true);
      setTimeout(() => list.removeEventListener('click', swallow, true), 0);
      if (over && over !== p.el && list.contains(over)) move(p.from, target(e, over, p.from).to);
    }
    function key(e) {
      const el = e.target.closest(sel);
      if (!el || !e.altKey) return;
      const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp', fwd = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
      if (e.key !== back && e.key !== fwd) return;
      e.preventDefault(); e.stopPropagation();
      const i = items().indexOf(el);
      move(i, i + (e.key === fwd ? 1 : -1));
    }
    list.addEventListener('pointerdown', down);
    list.addEventListener('pointermove', moveP);
    list.addEventListener('pointerup', up);
    const cancel = () => { press = null; clear(); };
    list.addEventListener('pointercancel', cancel);
    list.addEventListener('keydown', key);
    return {
      destroy() {
        list.removeEventListener('pointerdown', down); list.removeEventListener('pointermove', moveP);
        list.removeEventListener('pointerup', up); list.removeEventListener('keydown', key); list.removeEventListener('pointercancel', cancel);
        list.classList.remove('org-reorder', 'org-reorder--' + axis);
        live.remove();
      },
    };
  }
  Organica.reorder = reorder;
})(typeof window !== 'undefined' ? window : this);
