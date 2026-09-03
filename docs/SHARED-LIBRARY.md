# Organica — Shared Library & Storage Conventions

> Organica
> Last updated: August 30, 2026

The shared library is the one piece of Organica that more than one tool depends on.
This document is the contract: what the files are, what a consumer must provide, and
how user data is keyed.

---

## 1. The files

All live in `genesis/` and are served static — no build step, no bundler.

| File | Contents | Link it when… |
|---|---|---|
| **`animations.css`** | 77 `@keyframes` + the 55 `.aNN` rules that bind them + `.defs` | you want the forms **animated inside your own UI**. Neither Genesis nor the hub bento links it any more — both render the 13 Base Seeds static (since 2026-09-03). The only live consumer is the archived 55-form gallery (`genesis/archive/indicators-55.html`) |
| **`page.css`** | `:root` palette + `body` / `header` / `.grid` / `.cell` / `.num` | you are building a **Genesis catalog-style page** (the archived gallery) |

(The old `organic-library.css` `@import` shim that pulled both — "you want everything" — was **retired 2026-08-30**: nothing linked it. Link `page.css` then `animations.css` directly for the historic behaviour.)

Plus the two data files:

| File | Global | Shape |
|---|---|---|
| `forms.js` | `window.ORGANIC_SEEDS` | object keyed by `seed-<slug>` id (**not** an array) — one entry per seed: `{ label, type, tags:[…], bbox:[x,y,w,h], svg }`. The curated Base Seeds set, **13** organic forms: `seed-breath`, `seed-heartbeat`, `seed-metaballs`, `seed-drop-fall`, `seed-lava-detach`, `seed-flower-bloom`, `seed-petal-turn`, `seed-caterpillar`, `seed-amoeba`, `seed-mitosis`, `seed-sun`, `seed-bubble-cluster`, `seed-line`. Each `svg` is class-free and paints `fill="var(--ink)"` / `stroke="var(--ink)"`. `window.ORGANIC_FORMS` (id→svg) and `window.ORGANIC_LABELS` (id→label) are **derived** from `ORGANIC_SEEDS` at the bottom of the file for back-compat — every downstream consumer reads those two. The other 43 forms + all `class="aNN"` animation hooks live only in `genesis/archive/indicators-55.html` |
| `defs.js` | `window.ORGANIC_DEFS` | one `<svg class="defs">` string — goo filters + `#cA`…`#cG` chips |

`ORGANIC_DEFS` must be injected into the DOM **once per page**; forms reference its
filters and chips by `id`.

---

## 2. The CSS contract

`animations.css` is deliberately **not** self-sufficient on colour. A consumer
that links it without `page.css` **must define two custom properties**:

```css
:root {
  --ink:      #0a0a0a;   /* the form colour — used by 79 rules */
  --bg-cell:  #f5f2ec;   /* the surface behind a form, used to punch holes */
}
```

`--ink` is the recolouring hook — per the critical rule in `CLAUDE.md`, forms never
hardcode a hex, which is exactly why Spore and Pollen can retint them freely.

`--bg-cell` is easy to forget and fails quietly: only **form 29** (eye iris) and
**form 36** (moon mask) use it, to cut a hole out of the shape. Both are among the 43
archived forms, so this only bites the archived gallery now — but the rule stands for
any page that links `animations.css`.

Forms also use per-instance locals (`--c`, `--tx`, `--ty`, `--x`) but those are set
inline in the SVG markup itself, so a consumer never supplies them.

### Append-only

`animations.css` carries the rule that used to apply to the old bundle:
**never modify an existing rule — only append new ones.** Fifty-five forms depend on the
exact timings and selectors already in there.

### Why the split

Before July 25, 2026 there was a single `organic-library.css` that mixed the animations
with the layout of the Genesis catalog page (`body{padding:48px 48px 96px}`, `header`,
`.grid`, `.cell`). Any tool that wanted the animations inherited that page chrome too.
The split makes the reusable half linkable on its own.

`organic-library.css` was first kept as an `@import` shim (page chrome first, animations
second — load-bearing order) so existing links stayed unchanged. On 2026-08-30 the shim
was **retired** — the rename pass confirmed nothing `<link>`ed it. Pages that want both
now link `page.css` then `animations.css` directly, which reproduces the original
cascade.

The split was verified rule-for-rule against `genesis/index.html`, `library.html` and
`creator.html`: same computed variables, same `body` box metrics, same 77 reachable
keyframes, same flattened rule count, and forms 1 / 29 / 36 / 48 computing identical
`fill` / `stroke` / `animation-name` / `stroke-dasharray`.

---

## 3. Three ways the forms get consumed

One source, three interpretations — this is the Flexible-Visual-Systems grammar
expressed in code:

| Mode | Tools | How |
|---|---|---|
| **Static DOM** | Genesis, hub bento | `innerHTML` the SVG string, inject `ORGANIC_DEFS` once. Both render these **static** — neither links `animations.css`. The seed's own `fill="var(--ink)"` markup picks up the host's `--ink` (the hub varies it per bento cell) |
| **Animated DOM** | archived gallery only | as above, plus link `animations.css` → animated in the page (its markup carries the `class="aNN"` hooks inline) |
| **Path2D** | Spore, Pollen | parse the SVG string, pull the `d` attributes, build `Path2D` → drawn as canvas marks. Animations deliberately ignored (they don't link the CSS) |
| **Seeds panel** | Membrane, Camo Turing, Living Path (via `shared/seeds-panel.js`) | the panel's `PRIMORDIAL` list **is** the 13 ids now — one curated set, no separate subset |
| **Contours** | Living Path | parse → contours → the form becomes a glyph in the font pipeline |

Halide and Komorebi don't use the library at all — Halide makes pixels, Komorebi makes
procedural light on the GPU. They do share *code* with each other (Komorebi reuses
Halide's rectilinear contour tracer verbatim), but by copy, not by import: there is no
shared JS runtime beyond `forms.js`. That duplication is a known cost — see
the "shared core" item in `docs/ROADMAP.md`.

---

## 4. Storage conventions

### The key format

```
organica.<tool>.<thing>
```

| Key | Owner | Holds |
|---|---|---|
| `organica.pollen.presets` | Pollen | user-saved presets |
| `organica.halide.presets` | Halide | user-saved presets |
| `organica.komorebi.presets` | Komorebi | user-saved presets |
| `organica.library.forms` | Genesis Library **+** Creator (shared) | user-created form sets |
| `organica.library.view` | Genesis Library | last `{ activeSetId, filter }` — restores which set + Type filter was showing. Optional, value-whitelisted on read, no migration; deliberately separate from `organica.library.forms` so a corrupt view blob can't endanger library data |

### Legacy keys and migration

Before July 25, 2026 the keys were inconsistent — `pollen-presets`, `halide-presets`,
`organica_komorebi_presets`, `organica_library` (three different separators). Each tool
now migrates on first read:

1. read the modern key — if present, use it and stop;
2. otherwise read the legacy key;
3. if the legacy key exists, **copy it forward** to the modern key and use it.

**The legacy key is deliberately not deleted.** Saved presets and custom forms are real
user work; leaving the old copy in place costs a few KB and means rolling back to an
earlier deploy still finds them. The trade-off: a user who saves *new* presets and then
rolls back sees the pre-migration set. That is an acceptable edge case — losing the data
outright is not. The stale copies can be cleaned up in a later release once the
migration has been in production long enough.

| Legacy key | Migrates to |
|---|---|
| `pollen-presets` | `organica.pollen.presets` |
| `halide-presets` | `organica.halide.presets` |
| `organica_komorebi_presets` | `organica.komorebi.presets` |
| `organica_library` | `organica.library.forms` |

`organica.library.forms` is read and written by **one** file now — `genesis/index.html`
(the unified tool). `genesis/library.html` / `creator.html` / `indicators.html` are thin
redirect stubs.

### The blob shape

```js
{
  sets:  [ { id, name, builtIn, forms: string[] }, … ],   // forms = an ordered list of seed ids
  forms: [ { id: 'seed-…', name, svg, type, genType?, genParams? }, … ]  // user-authored seeds only
}
```

- **Uniform id scheme (2 Sep 2026).** Every seed id is **`seed-<handle>`** — the kebab
  slug for the 19 Base Seeds (`seed-breath`, `seed-square`, `seed-arc`, …), a short
  base36 token for user seeds (`seed-mf3k9a2x` — `newSeedId()` in `genesis/index.html`).
  Every set id is **`set-<handle>`** — `set-base` for the built-in, `set-<slug>-<t36>`
  for user sets (`set-my-seeds` for the auto "My Seeds"). No more `organic-N` / `basic-*`
  / `user-<ts>` / `set_*`; `migrateLibrary()` rewrites any legacy blob on load (step 0
  below). The `seeds` / `base_seeds` DB tables carry the same ids (CHECK `seed_id ~ '^seed-'`).
- **Set = a plain ordered list of ids.** No `gridConfig`, no `formLayout`, no spans,
  no alignment — the drag-fill compose lattice was removed 2026-08-30.
- One **built-in "Base Seeds" set** (id `set-base`, `builtIn:true`, no `forms`
  array): 13 organic forms + 6 procedural primitives (`seed-square` / `seed-circle` /
  `seed-triangle` / `seed-arc` / `seed-hexagon` / `seed-star`, synthesized in code).
  **Neither is stored** in the library blob — the 19 come from the `base_seeds` DB table
  (with `forms.js` `ORGANIC_SEEDS` + `PROCEDURAL_CANON` as the first-paint / offline
  fallback).
- User sets carry a real `forms: []` of ids. A duplicated seed lands in the active user
  set, or in an auto-created **"My Seeds"** set (id `set-my-seeds`) if Base Seeds is
  active.
- **`genType` also drives Genesis's Edit mode** (Aug 31, 2026): a seed with a non-freehand
  `genType` (`circle`/`arc`/`blob`/…) is **parametric** — Edit shows its generator sliders.
  A seed with `genType: 'freehand'` or none (raw SVG) is **vector** — Edit runs it through
  Paper.js `importSVG({expandShapes:true})` into a `CompoundPath` and every contour becomes
  editable bezier anchors. A **vector, `genType`-less** seed saved from Edit stays
  `genType`-less (only its `svg` is rewritten); a freehand seed's `genParams` is the Paper
  `serialize()` blob (single-path `{json,closed,smooth,manual}`, or `{kind:'compound',json,smooth}`).
  The Library tile shows a matching `parametric` / `vector` badge.

### `migrateLibrary()`

Runs on every load, idempotent, **never drops `forms[]`**. It:
0. **remaps legacy ids** — `LEGACY_ID_MAP` + `remapId()` / `remapSetId()` rewrite any
   `organic-N` / `basic-*` / `user-<ts>` seed id and any `organic-forms` / `set_*` set id
   in a stale localStorage blob to the `seed-<handle>` / `set-<handle>` scheme, then
   de-dupes the resulting `sets[]`;
1. ensures the `set-base` set exists, renames it to "Base Seeds", strips any
   `gridConfig`/`formLayout`;
2. removes the old separate `basic-seeds` set (its primitives are synthesized now);
3. pins the `set-base` (Base Seeds) set to `sets[0]` — set order is now array
   order (the Library's `↑`/`↓` reorder writes it), and the built-in is always first;
4. drops plain canonical primitive entries from `forms[]` (safe — re-synthesized), but
   **keeps** any primitive a user renamed or that a user set still references;
5. strips `gridConfig`/`formLayout` from every set.

---

## 5. Dev gotcha

The dev server caches aggressively. When a change appears not to take effect, hard-refresh
or append `?v=N` before concluding the code is wrong — this cost a debugging cycle during
the storage migration, where the migration looked broken and was simply a stale page.
(Same note as `docs/LIVINGPATH.md`.)

---

*Organica System v0.1 · updated August 30, 2026*
