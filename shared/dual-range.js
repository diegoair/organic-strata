/* Organica.dualRange — a slider with two handles: a From–To span on one track (Oct 15, 2026, FVS Rule › Axes —
   Diego: "nuovo slider a due maniglie", with "blockers" on the key values).

     const r = Organica.dualRange(host, { min, max, from, to, step, detents, catchBy, label, fmt, onInput, onChange });
     r.get() → [from, to] · r.set(from, to, silent) · r.setDetents(list) · r.setBounds(min, max, step)

   - Two knobs (role="slider", aria-valuemin/max/now/text, aria-label "<label> from" / "<label> to"); they never cross.
   - detents: values a knob catches when it comes within catchBy (the key angles, 100 %); drawn as dots on the track.
   - Pointer: press anywhere on the track and the nearer knob jumps there and follows; keyboard: ←/→ (↑/↓) by step,
     Shift by 10 steps, Home / End to the bounds.
   - onInput(from, to) while moving, onChange(from, to) once on release / key.
   Styles: .org-dual in panel.css (tokens only — the track and knob of the one-handle slider). No dependencies. */
(function () {
  'use strict';
  window.Organica = window.Organica || {};
  window.Organica.dualRange = function dualRange(host, opts) {
    const o = Object.assign({ min: 0, max: 100, from: 0, to: 100, step: 1, detents: [], catchBy: 0, label: 'Range', fmt: v => String(v) }, opts || {});
    host.classList.add('org-dual');
    host.innerHTML = '';
    const rail = document.createElement('div'); rail.className = 'org-dual__rail'; host.appendChild(rail);
    const fill = document.createElement('div'); fill.className = 'org-dual__fill'; rail.appendChild(fill);
    const tickBox = document.createElement('div'); tickBox.className = 'org-dual__ticks'; rail.appendChild(tickBox);
    const knobs = [0, 1].map(i => {
      const k = document.createElement('div');
      k.className = 'org-dual__knob'; k.tabIndex = 0; k.setAttribute('role', 'slider');
      k.setAttribute('aria-label', o.label + (i ? ' to' : ' from'));
      rail.appendChild(k); return k;
    });
    let v = [o.from, o.to], detents = o.detents.slice();
    const pct = x => (o.max === o.min ? 0 : (x - o.min) / (o.max - o.min) * 100);
    const roundStep = x => Math.round((x - o.min) / o.step) * o.step + o.min;
    const snap = x => { for (const d of detents) if (Math.abs(x - d) <= o.catchBy) return d; return roundStep(x); };
    function drawTicks() {
      tickBox.innerHTML = '';
      detents.forEach(d => { if (d < o.min || d > o.max) return; const t = document.createElement('span'); t.className = 'org-dual__tick'; t.style.left = pct(d) + '%'; t.dataset.v = d; tickBox.appendChild(t); });
    }
    function draw() {
      knobs.forEach((k, i) => {
        k.style.left = pct(v[i]) + '%';
        k.setAttribute('aria-valuemin', i ? v[0] : o.min); k.setAttribute('aria-valuemax', i ? o.max : v[1]);
        k.setAttribute('aria-valuenow', v[i]); k.setAttribute('aria-valuetext', o.fmt(v[i]));
      });
      fill.style.left = pct(v[0]) + '%'; fill.style.width = (pct(v[1]) - pct(v[0])) + '%';
      tickBox.querySelectorAll('.org-dual__tick').forEach(t => t.classList.toggle('is-in', +t.dataset.v >= v[0] && +t.dataset.v <= v[1]));
    }
    const clamp = x => Math.max(o.min, Math.min(o.max, x));
    function setKnob(i, x) {
      x = clamp(x); const nv = v.slice(); nv[i] = i ? Math.max(v[0], x) : Math.min(v[1], x);
      if (nv[0] === v[0] && nv[1] === v[1]) return false;
      v = nv; draw(); if (o.onInput) o.onInput(v[0], v[1]); return true;
    }
    const at = e => { const r = rail.getBoundingClientRect(); return o.min + (e.clientX - r.left) / Math.max(1, r.width) * (o.max - o.min); };
    let drag = -1;
    host.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      // the nearer knob; on a tie (stacked knobs) the one on the side you pressed
      const x = at(e), d0 = Math.abs(x - v[0]), d1 = Math.abs(x - v[1]);
      drag = d0 < d1 ? 0 : d1 < d0 ? 1 : (x > v[1] ? 1 : 0);
      host.setPointerCapture(e.pointerId); setKnob(drag, snap(x)); knobs[drag].focus({ preventScroll: true }); host.classList.add('is-dragging');
      e.preventDefault();
    });
    host.addEventListener('pointermove', e => { if (drag >= 0) setKnob(drag, snap(at(e))); });
    const end = () => { if (drag < 0) return; drag = -1; host.classList.remove('is-dragging'); if (o.onChange) o.onChange(v[0], v[1]); };
    host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end); host.addEventListener('lostpointercapture', end);
    knobs.forEach((k, i) => k.addEventListener('keydown', e => {
      const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      let x = null;
      if (dir) x = v[i] + dir * o.step * (e.shiftKey ? 10 : 1);
      else if (e.key === 'Home') x = o.min; else if (e.key === 'End') x = o.max;
      if (x === null) return;
      e.preventDefault();
      if (setKnob(i, x) && o.onChange) o.onChange(v[0], v[1]);
    }));
    drawTicks(); draw();
    return {
      get: () => v.slice(),
      set(from, to, silent) { v = [clamp(Math.min(from, to)), clamp(Math.max(from, to))]; draw(); if (!silent && o.onChange) o.onChange(v[0], v[1]); },
      setDetents(list) { detents = (list || []).slice(); drawTicks(); draw(); },
      setBounds(min, max, step) { o.min = min; o.max = max; if (step) o.step = step; v = [clamp(v[0]), clamp(v[1])]; drawTicks(); draw(); },
    };
  };
})();
