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
 *     size: 'preview',            // optional — see below
 *   });
 *   picker.refresh();             // after changing select.value or its options from code
 *   picker.invalidate(key);       // a thumbnail's source changed (a preset re-saved); no key = all
 *
 * WHEN TO GIVE A DROPDOWN THUMBNAILS (the design-system rule): only when the
 * options differ visibly, the name doesn't predict the look, and the image
 * comes from the tool's own renderer. Size follows what differs:
 *   icon    (default) 26×26 pictogram in `currentColor` — structure: shape
 *           kinds, aspect ratios, motion diagrams. Takes --ink in both themes.
 *   preview (size:'preview') 60×40 in the menu, 33×22 in the trigger — look
 *           and texture: dither, stipple, grain, light, palettes, grids. A
 *           rendered image (content colours — stays light in dark mode).
 *
 * Registry entry: { name, icon } — icon is SVG/HTML markup — or
 *   { name, thumb: () => string | Promise<string> } — rendered LAZILY: only
 *   when the menu first opens (or the entry is current in the trigger),
 *   paced one per animation frame so opening is instant, then cached. The
 *   result is markup, or a data:/blob: URL (wrapped in an <img>).
 *
 * Options inside an <optgroup> are listed under the group's label (.pi-group).
 * Options with an empty value ("Presets…", "Load a grid…") are placeholders:
 * never a row; when current, the trigger shows their text and no thumbnail.
 * A disabled option is never a row either; if nothing is pickable, the menu
 * shows the first disabled option's text as its empty-state hint.
 * Options missing from the registry still get a row, with a generic icon and
 * the option's own text. Host needs class "presets" (position:relative).
 *
 * LOAD ORDER: after core.js; needs panel.css.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  let seq = 0;
  const FALLBACK_ICON = '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="20" height="20"/></svg>';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const asMarkup = r => (typeof r === 'string' && /^(data:|blob:)/.test(r)) ? `<img alt="" src="${r}">` : (r || '');

  Organica.selectPicker = function (sel, host, opts) {
    opts = opts || {};
    const registry = opts.registry || {};
    const id = 'selpick' + (++seq);
    sel.style.display = 'none';
    host.classList.add('presets');
    if (opts.size === 'preview') host.classList.add('presets--preview');
    host.innerHTML = `<button type="button" class="preset-trigger" id="${id}-trigger" aria-label="${opts.ariaLabel || 'Choose'}">
        <span class="pt-ico" id="${id}-ico"></span><span class="pt-name" id="${id}-name"></span><span class="pt-chev">▾</span>
      </button><div class="preset-menu" id="${id}-menu" hidden></div>`;
    const trigger = host.querySelector('#' + id + '-trigger'), menu = host.querySelector('#' + id + '-menu');
    const icoEl = host.querySelector('#' + id + '-ico'), nameEl = host.querySelector('#' + id + '-name');
    if (opts.size === 'preview') menu.classList.add('preset-menu--preview');

    // ── lazy thumbnails: cache + a one-per-frame queue ──
    const cache = new Map();      // key → markup
    const queued = new Set();
    let pumping = false;
    function paint(key) {
      const html = cache.get(key) || '';
      menu.querySelectorAll('.pi-ico[data-key]').forEach(el => { if (el.dataset.key === key) el.innerHTML = html; });
      if (sel.value === key) icoEl.innerHTML = html;
    }
    function pump() {
      if (pumping) return;
      pumping = true;
      global.requestAnimationFrame(async function step() {
        const key = queued.values().next().value;
        if (key === undefined) { pumping = false; return; }
        queued.delete(key);
        const entry = registry[key];
        if (entry && entry.thumb && !cache.has(key)) {
          try { cache.set(key, asMarkup(await entry.thumb())); }
          catch (e) { console.warn('[selectPicker] thumbnail failed for', key, e); cache.set(key, ''); }
          paint(key);
        }
        global.requestAnimationFrame(step);
      });
    }
    function want(key) {
      const entry = registry[key];
      if (!entry || !entry.thumb || cache.has(key) || queued.has(key)) return;
      queued.add(key); pump();
    }

    const optOf = v => [...sel.options].find(x => x.value === v);
    const optText = v => { const o = optOf(v); return o ? esc(o.textContent) : esc(v); };
    function iconOf(v) {
      const e = registry[v];
      if (e && e.thumb) { if (cache.has(v)) return cache.get(v); want(v); return ''; }
      return (e && e.icon) || opts.fallbackIcon || FALLBACK_ICON;
    }
    const labelOf = v => (registry[v] && registry[v].name) || optText(v);

    function refresh() {
      const placeholder = !sel.value;
      icoEl.hidden = placeholder;
      icoEl.innerHTML = placeholder ? '' : iconOf(sel.value);
      nameEl.innerHTML = labelOf(sel.value);
    }
    function keys() {
      const present = [...sel.options].filter(o => o.value !== '' && !o.disabled).map(o => o.value);
      const ordered = Object.keys(registry).filter(k => present.includes(k));
      return ordered.concat(present.filter(k => !ordered.includes(k)));
    }
    function populate() {
      menu.innerHTML = '';
      let lastGroup = null;
      keys().forEach(key => {
        const opt = optOf(key);
        const grp = opt && opt.parentElement && opt.parentElement.tagName === 'OPTGROUP' ? opt.parentElement.label : null;
        if (grp && grp !== lastGroup) {
          const h = document.createElement('div');
          h.className = 'pi-group'; h.textContent = grp;
          menu.appendChild(h);
        }
        lastGroup = grp;
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'preset-item' + (key === sel.value ? ' on' : '');
        row.innerHTML = `<span class="pi-ico"></span><span class="pi-name">${labelOf(key)}</span>`;
        const ico = row.querySelector('.pi-ico');
        ico.dataset.key = key;
        ico.innerHTML = iconOf(key);
        row.addEventListener('click', () => {
          sel.value = key;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          refresh();
          menu.hidden = true;
        });
        menu.appendChild(row);
      });
      // Nothing to pick: say why (a disabled option is the tool's own hint,
      // e.g. "No saved grids yet — design one in /loom/") instead of an empty box.
      if (!menu.querySelector('.preset-item')) {
        const hint = [...sel.options].find(o => o.disabled);
        const note = document.createElement('div');
        note.className = 'pi-group'; note.textContent = hint ? hint.textContent : 'Nothing to choose yet';
        menu.appendChild(note);
      }
    }
    function position() {
      const t = trigger.getBoundingClientRect(), gap = 5, margin = 12;
      const below = global.innerHeight - t.bottom - margin, above = t.top - margin;
      // at least wide enough for a thumbnail + a readable name, kept on screen
      const w = Math.min(global.innerWidth - 2 * margin, Math.max(t.width, opts.size === 'preview' ? 220 : 180));
      menu.style.left = Math.max(margin, Math.min(t.left, global.innerWidth - margin - w)) + 'px';
      menu.style.width = w + 'px';
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
    function invalidate(key) {
      if (key == null) cache.clear(); else cache.delete(key);
      refresh();
      if (!menu.hidden) populate();
    }
    refresh();
    return { refresh, invalidate };
  };
})(window);
