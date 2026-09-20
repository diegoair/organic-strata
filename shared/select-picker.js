/* ─────────────────────────────────────────────────────────────────────────────
 * select-picker.js — Organica.selectPicker: a thumbnail dropdown in front of a
 * hidden <select>. The design-system "preset picker" (panel.css:
 * .presets / .preset-trigger / .pt-ico / .pi-ico / .preset-menu / .preset-item)
 * applied to an ordinary <select>.
 *
 * The real <select> stays in the DOM (display:none) and stays the source of
 * truth: picking an item sets `select.value` and dispatches a real `change`
 * event, so every existing `.value` reader/writer and `change` listener keeps
 * working untouched. Extracted from Loom's buildGeneratorPicker at its second
 * consumer (FVS's Seed picker).
 *
 * usage:
 *   const picker = Organica.selectPicker(selectEl, hostEl, {
 *     registry: { key: { name: 'Triangle', icon: '<svg viewBox="0 0 26 26">…</svg>' } },
 *     ariaLabel: 'Seed type',
 *   });
 *   picker.refresh();   // after changing select.value or its options from code
 *
 * Icons: 26×26 viewBox SVG, `currentColor` (fill or stroke) so the CSS
 * component supplies --ink. Options in the <select> that are missing from the
 * registry (e.g. an option added at runtime) still get a row, with a generic
 * icon and the option's own text. Host needs class "presets" (position:relative).
 *
 * LOAD ORDER: after core.js; needs panel.css.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  let seq = 0;
  const FALLBACK_ICON = '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="20" height="20"/></svg>';

  Organica.selectPicker = function (sel, host, opts) {
    opts = opts || {};
    const registry = opts.registry || {};
    const id = 'selpick' + (++seq);
    sel.style.display = 'none';
    host.classList.add('presets');
    host.innerHTML = `<button type="button" class="preset-trigger" id="${id}-trigger" aria-label="${opts.ariaLabel || 'Choose'}">
        <span class="pt-ico" id="${id}-ico"></span><span class="pt-name" id="${id}-name"></span><span class="pt-chev">▾</span>
      </button><div class="preset-menu" id="${id}-menu" hidden></div>`;
    const trigger = host.querySelector('#' + id + '-trigger'), menu = host.querySelector('#' + id + '-menu');
    const icoEl = host.querySelector('#' + id + '-ico'), nameEl = host.querySelector('#' + id + '-name');

    const optText = v => { const o = [...sel.options].find(x => x.value === v); return o ? o.textContent : v; };
    const iconOf = v => (registry[v] && registry[v].icon) || opts.fallbackIcon || FALLBACK_ICON;
    const labelOf = v => (registry[v] && registry[v].name) || optText(v);

    function refresh() {
      icoEl.innerHTML = iconOf(sel.value);
      nameEl.textContent = labelOf(sel.value);
    }
    function keys() {
      const present = [...sel.options].map(o => o.value);
      const ordered = Object.keys(registry).filter(k => present.includes(k));
      return ordered.concat(present.filter(k => !ordered.includes(k)));
    }
    function populate() {
      menu.innerHTML = '';
      keys().forEach(key => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'preset-item' + (key === sel.value ? ' on' : '');
        row.innerHTML = `<span class="pi-ico">${iconOf(key)}</span><span class="pi-name">${labelOf(key)}</span>`;
        row.addEventListener('click', () => {
          sel.value = key;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          refresh();
          menu.hidden = true;
        });
        menu.appendChild(row);
      });
    }
    function position() {
      const t = trigger.getBoundingClientRect(), gap = 5, margin = 12;
      const below = global.innerHeight - t.bottom - margin, above = t.top - margin;
      menu.style.left = t.left + 'px'; menu.style.width = t.width + 'px';
      if (below >= 200 || below >= above) { menu.style.top = (t.bottom + gap) + 'px'; menu.style.bottom = 'auto'; menu.style.maxHeight = Math.max(160, below) + 'px'; }
      else { menu.style.bottom = (global.innerHeight - t.top + gap) + 'px'; menu.style.top = 'auto'; menu.style.maxHeight = Math.max(160, above) + 'px'; }
    }
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      if (menu.hidden) { populate(); position(); menu.hidden = false; } else menu.hidden = true;
    });
    document.addEventListener('click', e => {
      if (!menu.hidden && !host.contains(e.target) && !menu.contains(e.target)) menu.hidden = true;
    });
    refresh();
    return { refresh };
  };
})(window);
