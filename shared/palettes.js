/* ─────────────────────────────────────────────────────────────────────────────
 * palettes.js — Organica.palettes: the suite's palettes, as every tool reads them.
 *
 * One source (Nov 20, 2026 — Diego: "nel picker … voglio vedere solo quelle salvate e poterle
 * caricare con tutti i loro shadow, grain e parametri"): the palettes saved in TuneSutra
 * (store 'tunesutra'), then the ones starred there (store 'tunesutra-favs') that are not saved.
 * No built-ins. A palette comes out WHOLE — every colour with its role, house part, ten tints and
 * its own shading (a GradDef for Organica.shading, or null = flat). Saving from a tool always makes
 * a NEW palette (Diego: the original in TuneSutra never changes), written in TuneSutra's own format
 * so TuneSutra opens it whole.
 *
 *   const P = Organica.palettes;
 *   P.list()                 → [{ id, name, source, colors:[{id,name,hex}] }]   cheap, for menus
 *   P.get(id)                → Palette | null   (below)
 *   P.pull()                 → Promise — both stores from the cloud, once per page (no-op signed out)
 *   P.onChange(fn)           → unsubscribe — after a pull, a background sync, or another tab's save
 *   P.saveAsNew(pal, { tool }) → the new palette's name ('<name> · <Tool>', numbered when taken)
 *   P.ctx(pal)               → the Organica.shading context of a palette (its tints)
 *
 * A Palette:
 *   { id: 'saved:<name>' | 'star:<key>', name, source: 'saved' | 'starred', pid, house,
 *     colours: [{ id, hex, name, part, tints: { 50: hex, 100: hex … 900: hex }, shade: GradDef | null }] }
 *
 * LOAD ORDER: core.js → (store.js) → color.js → shading.js → this → palette.js.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  // The house parts per count — mirrors Organica.hueTone.ROLE_PARTS (shared/hue-tone.js), which a
  // tool may not load. Keep the two in step.
  const ROLE_PARTS = {
    2: ['main', 'accent'],
    3: ['main', 'sub', 'accent'],
    4: ['main', 'sub', 'accent', 'accent2'],
    5: ['background', 'ground', 'main', 'sub', 'accent'],
    6: ['background', 'ground', 'main', 'sub', 'accent', 'accent2'],
    7: ['background', 'ground', 'middle', 'main', 'sub', 'accent', 'accent2'],
    8: ['background', 'ground', 'middle', 'far', 'main', 'sub', 'accent', 'accent2'],
    9: ['background', 'ground', 'middle', 'far', 'main', 'sub', 'accent', 'accent2', 'accent3'],
  };
  function partsFor(n) { return (global.Organica.hueTone && Organica.hueTone.ROLE_PARTS[n]) || ROLE_PARTS[n] || []; }
  // The roles — semantic, one word each, largest share first (Diego, Nov 18, 2026: "each color has a token name that
  // is built correctly"). The set follows the count, so the smallest colour is always the Accent (at 5 the Highlight
  // below it; from 6 the Spark, Nov 19, 2026; 2, 8, 9: content design, the redesign's step 3). The one copy: TuneSutra
  // and its colour guide read it from here (tunesutra/palette-figures.js); colour names are roles (UI-COPY).
  const ROLE_SETS = {
    2: ['Base', 'Accent'],
    3: ['Base', 'Secondary', 'Accent'],
    4: ['Base', 'Secondary', 'Tertiary', 'Accent'],
    5: ['Base', 'Secondary', 'Tertiary', 'Accent', 'Highlight'],
    6: ['Base', 'Secondary', 'Tertiary', 'Accent', 'Highlight', 'Spark'],
    7: ['Base', 'Secondary', 'Tertiary', 'Support', 'Accent', 'Highlight', 'Spark'],
    8: ['Base', 'Secondary', 'Tertiary', 'Support', 'Backdrop', 'Accent', 'Highlight', 'Spark'],
    9: ['Base', 'Secondary', 'Tertiary', 'Support', 'Backdrop', 'Touch', 'Accent', 'Highlight', 'Spark'],
  };
  function roleName(i, n) { const set = ROLE_SETS[n] || ROLE_SETS[5]; return set[i] || ('Extra ' + (i - 4)); }
  function hex(v) { return Organica.normalizeHex ? Organica.normalizeHex(v, '#888888') : String(v).toLowerCase(); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function seedOf(text) { let h = 2166136261; for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 9999) + 1; }

  function make(tool) { const m = Organica.store || Organica.presetStore; return m ? m(tool) : null; }
  let savedStore = null, favStore = null;
  function saved() { if (!savedStore) savedStore = make('tunesutra'); return savedStore; }
  function favsStore() { if (!favStore) favStore = make('tunesutra-favs'); return favStore; }
  function readOf(st) {
    if (!st) return {};
    try { return (st.peek ? st.peek() : st.read()) || {}; } catch (e) { return {}; }
  }

  function savedEntries() {
    const all = readOf(saved());
    return Object.keys(all).filter(n => all[n] && Array.isArray(all[n].colors) && all[n].colors.length).map(n => ({ key: n, rec: all[n] }));
  }
  function starEntries(savedNames) {
    const all = readOf(favsStore());
    return Object.keys(all).filter(k => {
      const e = all[k];
      if (!e || !Array.isArray(e.colors) || !e.colors.length) return false;
      return !(k.indexOf('p:') === 0 && savedNames.has(k.slice(2)));   // a starred saved palette is listed once, as saved
    }).sort((a, b) => String(all[b].at || '').localeCompare(String(all[a].at || ''))).map(k => ({ key: k, rec: all[k] }));
  }

  // ── list(): what a menu shows ──
  function list() {
    const S = savedEntries(), names = new Set(S.map(e => e.key));
    const out = S.map(({ key, rec }) => ({
      id: 'saved:' + key, name: key, source: 'saved', builtin: false,
      colors: rec.colors.map((h, i) => ({ id: (rec.ids && rec.ids[i]) || null, name: (rec.names && rec.names[i]) || '', hex: hex(h) })),
    }));
    starEntries(names).forEach(({ key, rec }) => {
      const n = rec.colors.length;
      out.push({ id: 'star:' + key, name: rec.name || 'Starred palette', source: 'starred', builtin: false,
        colors: rec.colors.map((h, i) => ({ id: null, name: roleName(i, n), hex: hex(h) })) });
    });
    return out;
  }

  // ── get(id): the palette whole ──
  function tintsOf(h) {
    const t = {};
    if (Organica.color) Organica.color.scale(h).forEach(st => { t[st.step || 50] = st.hex; });   // color.js: a page without it gets no tints
    return t;
  }
  function get(id) {
    if (!id) return null;
    const S = Organica.shading;
    if (id.indexOf('saved:') === 0) {
      const name = id.slice(6), rec = readOf(saved())[name];
      if (!rec || !Array.isArray(rec.colors)) return null;
      const n = rec.colors.length, P = partsFor(n), set = rec.set && Array.isArray(rec.set.colours) ? rec.set.colours : [];
      return {
        id: id, name: name, source: 'saved', pid: rec.pid || null,
        house: rec.house >= 1 && rec.house <= 9999 ? Math.round(rec.house) : seedOf(rec.colors.join('')),
        colours: rec.colors.map((h0, i) => {
          const h = hex(h0), own = rec.shades && rec.shades[i];
          const tints = set[i] && set[i].hex && set[i].hex.toLowerCase() === h && set[i].tints ? Object.assign({}, set[i].tints) : tintsOf(h);
          return { id: (rec.ids && rec.ids[i]) || null, hex: h, name: (rec.names && rec.names[i]) || roleName(i, n),
            part: (rec.parts && rec.parts[i]) || P[i] || null, tints: tints,
            shade: own && S ? S.withColour(S.normalize(clone(own)), h) : null };
        }),
      };
    }
    if (id.indexOf('star:') === 0) {
      const key = id.slice(5), rec = readOf(favsStore())[key];
      if (!rec || !Array.isArray(rec.colors)) return null;
      const n = rec.colors.length, P = partsFor(n);
      return {
        id: id, name: rec.name || 'Starred palette', source: 'starred', pid: null,
        house: rec.house >= 1 && rec.house <= 9999 ? Math.round(rec.house) : seedOf(rec.colors.join('')),
        colours: rec.colors.map((h0, i) => { const h = hex(h0); return { id: null, hex: h, name: roleName(i, n), part: P[i] || null, tints: tintsOf(h), shade: null }; }),
      };
    }
    return null;
  }

  // The shading context of a palette (or of plain hexes): the pool its shadow inks snap to.
  function ctx(pal) {
    const hexes = !pal ? [] : Array.isArray(pal) ? pal : (pal.colours || []).map(c => c.hex);
    return { tints: Organica.color ? [].concat.apply([], hexes.map(h => Organica.color.scale(h).map(st => st.hex))) : [] };
  }

  // ── saveAsNew: always a new palette, in TuneSutra's format ──
  function newPid() { return 'pal-' + Math.random().toString(36).slice(2, 10); }
  function freeName(base, tool, taken) {
    const tail = tool ? ' · ' + tool : '';
    let root = String(base || 'Palette').trim();
    if (tail && root.slice(-tail.length) === tail) root = root.slice(0, -tail.length);
    let name = root + tail, k = 2;
    while (Object.prototype.hasOwnProperty.call(taken, name)) name = root + tail + ' ' + (k++);
    return name;
  }
  // The name a copy would take: '<name> · <Tool>', numbered while taken (the save dialog proposes it).
  function nameFor(pal, opts) {
    opts = opts || {};
    return freeName(opts.name || (pal && pal.name), opts.tool, readOf(saved()));
  }
  // opts.name: the name chosen in the dialog — used as it is, numbered only if it is taken (never overwrites).
  function saveAsNew(pal, opts) {
    opts = opts || {};
    const st = saved();
    if (!st) throw new Error('palettes: no store');
    const all = st.read() || {}, S = Organica.shading;
    const cols = (pal.colours || []).slice(0, 9).map(c => Object.assign({}, c, { hex: hex(c.hex) }));
    if (!cols.length) throw new Error('palettes: a palette needs a colour');
    const n = cols.length, P = partsFor(n), name = opts.name ? freeName(opts.name, null, all) : freeName(pal.name, opts.tool, all);
    const names = cols.map((c, i) => c.name || roleName(i, n));
    const shades = cols.map(c => c.shade ? clone(c.shade) : null);
    const prefix = String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    all[name] = {
      n: n, harmony: 'complementary', spread: 0,
      colors: cols.map(c => c.hex),
      names: names,
      ids: cols.map(c => c.id || ('c-' + Math.random().toString(36).slice(2, 8))),
      parts: cols.map((c, i) => c.part || P[i] || null),
      locks: cols.map(() => false),
      shades: shades,
      scaleFrom: cols.map(() => null),
      zoneShades: {},
      gradient: S ? S.normalize({ stops: cols.slice(0, 2).map(c => c.hex) }) : { stops: cols.slice(0, 2).map(c => c.hex) },
      view: 'garment',
      house: pal.house >= 1 && pal.house <= 9999 ? Math.round(pal.house) : seedOf(cols.map(c => c.hex).join('')),
      shading: 'none',
      set: {
        v: 1, prefix: /^[a-z]/.test(prefix) ? prefix : 'palette' + (prefix ? '-' + prefix : ''),
        colours: cols.map((c, i) => {
          const shading = {};
          if (S) { const d = S.defs(c.hex); S.SHADE_MODES.forEach(m => { shading[S.SHADE_NAME[m].toLowerCase()] = clone(d[m]); }); }
          const key = String(names[i]).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          return { role: names[i], key: key, hex: c.hex, tints: tintsOf(c.hex), shading: shading, own: shades[i] };
        }),
      },
      pid: newPid(),
      from: pal.pid || pal.name ? { pid: pal.pid || null, name: pal.name || null } : null,
      tool: opts.tool || null,
      savedAt: new Date().toISOString(),
    };
    if (st.write(all) === false) return null;   // storage full: Organica.storageFull has said so
    emit();
    return name;
  }

  // ── sync ──
  let pulled = null;
  function pull() {
    if (pulled) return pulled;
    const ps = [saved(), favsStore()].filter(st => st && st.pull).map(st => st.pull().catch(() => {}));
    pulled = Promise.all(ps).then(() => { emit(); });
    return pulled;
  }
  const subs = new Set();
  function emit() { subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    [saved(), favsStore()].forEach(st => { if (st && st.onSync) st.onSync(emit); });
    // TuneSutra open in another tab: its save lands here too
    if (global.addEventListener) global.addEventListener('storage', e => {
      if (e.key === 'organica.tunesutra.presets' || e.key === 'organica.tunesutra-favs.presets') emit();
    });
  }
  function onChange(fn) { wire(); subs.add(fn); return () => subs.delete(fn); }

  Organica.palettes = { list: list, get: get, pull: pull, onChange: onChange, saveAsNew: saveAsNew, nameFor: nameFor, ctx: ctx, roleName: roleName, ROLE_PARTS: ROLE_PARTS, ROLE_SETS: ROLE_SETS };
})(typeof window !== 'undefined' ? window : this);
