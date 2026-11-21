/* ─────────────────────────────────────────────────────────────────────────────
 * palette-kit.js — Organica.paletteKit: a TuneSutra palette, whole, in any tool.
 *
 * Nov 21, 2026 (Diego: "porta il nuovo palette su tutti gli altri tools"). FVS's wiring (Nov 20) made generic, so
 * every tool takes a palette the same way: its colours, each colour's shading (Gradient + Shadow, Organica.shading),
 * its Colour mode (mapping) — and gives it back with Save as palette… (always a NEW TuneSutra palette).
 *
 * A STRIP (a tool with a list of colours — FVS, Trellis, Spore, Pollen …):
 *   const kit = Organica.paletteKit.strip(stripHost, editorHost | null, {
 *     get() → { colors: [hex], shades: { hex: GradDef } },   // the tool's own state, read live
 *     set(patch, why),          // patch ⊂ { colors, shades, mapping, name, house }; why: 'edit' | 'set' | 'palette' | 'shade'
 *     tool,                     // the tool's visible name — Save as palette… names the copy '‹name› · ‹tool›'
 *     min, max,                 // default 1, 9
 *     paper: () => hex,         // the tool's paper (a shading that fades to paper fades to it)
 *     order: 'palette' | 'ramp',// a palette taken whole: in its own order, or dark → bright (its Colour mode's order —
 *                               // a tool with Inks reads the strip dark → bright). Default 'palette'.
 *     mapping: () => mapping,   // optional: the tool's own Colour mode now (saved by Save as palette…)
 *     shading: true,            // false: colours only (the editor, the chips' shading and the shades are left out)
 *     sheet: () => rect,        // optional: the tool's sheet — the editor then offers Wash › All the shapes (each draw
 *                               // passes the sheet in the shape's own units as ctx.sheet; Organica.shading, FIELD)
 *   });
 *   kit.rebuild()   kit.setActive(i)   kit.name()   kit.strip (the palette.swatch handle)
 *
 * ROLES (a tool with fixed colours — Ink · Paper, Komorebi's Sun · Sky · Ground · Shadow …): roles() below gives the
 * handler every colour row's ▦ takes (opts.onPalette): a palette's name fills every row by the house role.
 *
 * Without an editorHost (or shading:false) a tool takes the colours only. LOAD ORDER: core.js → color.js →
 * (noise.js → shade-marks.js → shading.js → select-picker.js → shade-editor.js) → palettes.js → palette.js → this.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  const lc = h => String(h).toLowerCase();

  // The shading context of a list of colours: the pool their shadow inks snap to, and the paper.
  let _ctx = { key: '', v: null };   // drawn per shape, every frame: the last one kept
  function ctxOf(colors, paper) {
    const key = colors.join('') + '|' + paper;
    if (_ctx.key === key) return _ctx.v;
    const C = Organica.color;
    _ctx = { key: key, v: { tints: C ? [].concat.apply([], colors.map(h => C.scale(h).map(st => st.hex))) : [], paper: paper || '#ffffff' } };
    return _ctx.v;
  }
  // A palette taken whole → { colors, shades, mapping, name, house } in the order asked: each colour with its own
  // shading, and a colour with none takes the house Shading the palette was saved with (FVS, Nov 20).
  function take(pal, n, order, ctx) {
    const S = Organica.shading, P = Organica.palettes;
    let cols = (pal.colours || []).slice();
    if (order === 'ramp' && pal.mapping) cols = pal.mapping.order.map(i => pal.colours[i]).filter(Boolean);
    cols = cols.slice(0, n);
    const colors = cols.map(c => lc(c.hex)), shades = {}, mode = pal.shading && pal.shading !== 'none' && S ? pal.shading : null;
    const cx = ctx(colors);
    cols.forEach(c => {
      const h = lc(c.hex);
      if (c.shade) shades[h] = clone(c.shade);
      else if (mode) { const d = S.defs(h, cx)[mode]; if (d) shades[h] = clone(d); }
    });
    // the mapping follows the colours as they now stand (the strip's order)
    const mapping = pal.mapping && P ? P.mappingFor(colors, order === 'ramp'
      ? Object.assign({}, pal.mapping, { order: colors.map((_, i) => i), pair: pal.mapping.pair.map(i => cols.indexOf(pal.colours[i])).map(i => (i < 0 ? 0 : i)) })
      : pal.mapping) : null;
    return { colors, shades, mapping, name: pal.name || '', house: pal.house || null };
  }

  function strip(stripHost, editorHost, o) {
    const S = () => Organica.shading, max = o.max || 9, withShading = o.shading !== false && !!editorHost;
    // A tool may build its strip again (a board switching Element, an Undo): what the kit holds — the editor, the
    // colour last opened, the palette's name and house — lives on the strip's host, so a rebuild finds it again and the
    // editor's callbacks always reach the latest strip and options (K.o, K.sw).
    const K = stripHost.__paletteKit || (stripHost.__paletteKit = { at: 0, name: '', house: null, ed: null });
    K.o = o;
    const paper = () => (K.o.paper ? K.o.paper() : null) || '#ffffff';
    const ctx = () => { const c = ctxOf(K.o.get().colors, paper()); return K.o.sheet ? Object.assign({}, c, { sheet: K.o.sheet() }) : c; };
    const label = i => 'Palette colour ' + (i + 1);   // the chip's own name (palette.js)
    function repaint() { if (K.sw) { K.sw.rebuild(); K.sw.setActive(withShading ? K.at : null); } }
    function syncEditor() {
      if (!withShading || !Organica.shadeEditor || !S()) return;
      const { colors, shades } = K.o.get();
      K.at = Math.max(0, Math.min(K.at, colors.length - 1));
      const hex = colors[K.at], v = { hex: hex, def: (shades || {})[hex] || null, label: label(K.at) };
      if (K.ed && editorHost.firstChild) { K.ed.set(v); return; }
      K.ed = Organica.shadeEditor.mount(editorHost, Object.assign(v, {
        ctx: ctx,
        // the colour's own stop on the bar: the chip's colour, picked as on the chip
        onColourStop: anchor => Organica.colorPicker.open(anchor, { value: K.o.get().colors[K.at], label: label(K.at), onChange: h => { if (K.sw && h !== K.o.get().colors[K.at]) K.sw.setColor(K.at, h); } }),
        // Use on every colour: this colour's Gradient + Shadow on all, each on its own colour (hand-picked inks left out)
        everyColour: d => {
          const m = {}, colors = K.o.get().colors;
          if (d && (d.type !== 'flat' || S().hasNoise(d))) colors.forEach((h, j) => { m[h] = j === K.at ? d : S().withColour(Object.assign(clone(d), { inkMid: null, inkCore: null }), h, ctx()); });
          K.o.set({ shades: m }, 'shade');
          repaint(); syncEditor();
        },
        onChange: def => {
          const h = K.o.get().colors[K.at], m = Object.assign({}, K.o.get().shades || {});
          if (def) m[h] = def; else delete m[h];
          K.o.set({ shades: m }, 'shade');
          repaint();
        },
      }));
    }
    K.sw = Organica.palette.swatch(stripHost, {
      colors: o.get().colors,
      min: o.min || 1,
      max: max,
      activeIndex: withShading ? Math.min(K.at, o.get().colors.length - 1) : null,
      shadeOf: withShading ? (i, hex) => { const d = (K.o.get().shades || {})[hex]; return d ? { def: d, ctx: ctx() } : null; } : undefined,
      onOpen: withShading ? i => { K.at = i; K.sw.setActive(i); syncEditor(); } : undefined,
      onChange: (colors, i, action) => {
        const before = K.o.get().colors, next = colors.map(lc), shades = Object.assign({}, K.o.get().shades || {});
        // a colour changed by hand keeps its shading, moved onto the new colour (its first stop; the 900 follows)
        if (action === 'edit' && S() && before[i] && shades[before[i]] && before[i] !== next[i]) {
          const def = shades[before[i]];
          if (!before.some((h, j) => j !== i && h === before[i])) delete shades[before[i]];
          shades[next[i]] = S().withColour(clone(def), next[i], ctxOf(next, paper()));
        }
        if (action === 'set') { K.name = ''; K.house = null; }
        K.o.set({ colors: next, shades: shades }, action === 'set' ? 'set' : 'edit');
        syncEditor();
      },
      onPalette: pal => {
        const t = take(pal, max, K.o.order, cs => ctxOf(cs, paper()));
        K.name = t.name; K.house = t.house; K.at = 0;
        K.o.set(withShading ? t : { colors: t.colors, mapping: t.mapping, name: t.name, house: t.house }, 'palette');
        K.sw.setColors(t.colors);   // the chips in the order taken (dark → bright with order 'ramp')
        repaint(); syncEditor();
      },
      saveAs: {
        tool: o.tool,
        get: () => {
          const { colors, shades } = K.o.get();
          const pal = { name: K.name || 'Palette', house: K.house, colours: colors.map(h => ({ hex: h, shade: withShading ? (shades || {})[h] || null : null })) };
          if (K.o.mapping) pal.mapping = K.o.mapping();
          return pal;
        },
      },
    });
    syncEditor();
    return {
      strip: K.sw,
      rebuild() { K.sw.setColors(K.o.get().colors); repaint(); syncEditor(); },
      setActive(i) { K.at = i; repaint(); syncEditor(); },
      name: () => K.name,
      syncEditor: syncEditor,
    };
  }

  // ── ROLES: a tool's fixed colours filled from a palette by the house role (Diego, Nov 20, 2026) ──
  // slots: [{ key, parts: ['main', …] (house parts, in order of preference), fallback: 'darkest' | 'lightest' | i }]
  // → { key: { hex, shade } }. A palette colour is used once while another is left; parts come from
  // Organica.palettes (ROLE_PARTS: background, ground, middle, far, main, sub, accent, accent2, accent3).
  function rolesFor(pal, slots) {
    const cols = (pal.colours || []).map((c, i) => Object.assign({ i: i }, c)), used = new Set(), out = {};
    const light = c => Organica.color && Organica.color.hexToOklch ? Organica.color.hexToOklch(c.hex).l : 0;
    const byL = cols.slice().sort((a, b) => light(a) - light(b));
    const pick = c => { used.add(c.i); return { hex: lc(c.hex), shade: c.shade ? clone(c.shade) : null, name: c.name || '' }; };
    slots.forEach(s => {
      const free = c => !used.has(c.i) || used.size >= cols.length;
      let c = null;
      (s.parts || []).some(p => (c = cols.find(x => x.part === p && free(x))));
      if (!c && typeof s.fallback === 'number') c = cols[Math.min(cols.length - 1, s.fallback)];
      if (!c && s.fallback === 'lightest') c = byL.slice().reverse().find(free) || byL[byL.length - 1];
      if (!c) c = byL.find(free) || byL[0];   // 'darkest', the default
      out[s.key] = pick(c);
    });
    return out;
  }
  // A role tool: every colour row's ▦ takes a palette WHOLE — pass the returned handler as the rows' opts.onPalette
  // (Organica.palette.swatch attach mode); it fills every slot by the house role and calls onRoles once.
  //   const take = Organica.paletteKit.roles({ slots, onRoles({ key: { hex, shade, name } }, pal) });
  //   Organica.palette.swatch('ink', { …, onPalette: take });   Organica.palette.swatch('paper', { …, onPalette: take });
  function roles(o) { return pal => o.onRoles(rolesFor(pal, o.slots), pal); }

  Organica.paletteKit = { strip: strip, roles: roles, rolesFor: rolesFor, take: take, ctxOf: ctxOf };
})(typeof window !== 'undefined' ? window : this);
