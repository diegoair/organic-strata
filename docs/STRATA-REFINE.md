# Strata — Refine paths (Paper.js)

> Studio Rann · Organica · post-trace vector refinement
> Added July 27, 2026 · **shipped to production for real-case testing, expect iteration**

---

## 1. What it is

A second view on Strata's vector output. **Preview** shows the traced SVG as before;
**Refine** opens the same SVG in an editable Paper.js canvas, with the source sketch behind it
as a dim underlay, so you can clean up the trace before exporting.

The contract is deliberately narrow: *raster sketch → backend trace → refine → export*. This
module never loads user SVG files; it only ingests trace output.

---

## 2. Controls

| Control | What it does |
|---|---|
| **Preview / Refine** | Switches the output panel between the read-only preview and the editor. |
| **Drag an anchor** | Click directly on an anchor point and drag to move it. |
| **Smooth** | Runs `path.smooth()` on every path — rounds the polygonal trace into curves. |
| **Simplify** | Runs `path.simplify(tolerance)` — fits curves and drops redundant nodes. |
| **Simplify tolerance** | 0.5 (faithful, many nodes) → 8 (loose, few nodes). |
| **Unite all** | Boolean-unions every path into one compound path. Overlaps merge; disjoint shapes are preserved. |
| **Reset trace** | Reloads the original trace, discarding all edits. |
| **Show sketch underlay** | Toggles the dim source sketch behind the paths. |

### Sharp edge worth knowing

**Anchors must be clicked precisely** (~8px tolerance). Clicking the *stroke* between two
anchors selects the path but does **not** drag it — only a hit on the anchor itself starts a
drag. There is no persistent visual indicator of anchor positions until a path is selected,
which makes them harder to find than in a conventional vector editor. If this proves annoying
in real use, the fix is to raise the hit tolerance and/or draw the anchors of the path under
the cursor.

---

## 3. Export behaviour

Export (Download SVG · Copy SVG code · → Figma) reads through `getExportSvg()`:

- **Untouched** → the raw trace, byte-for-byte.
- **After any edit** → the refined geometry from the editor.

Two properties are deliberately preserved so a refined export is a drop-in replacement for an
unrefined one:

- **Style survives.** The editor does not force a fill. A "stroke only" trace exports as
  outlines, a "filled" trace exports as fills — Strata's own Fill mode is respected.
  (`ensureVisible()` only intervenes for a path with *neither* fill nor stroke, which would
  otherwise be invisible and unclickable.)
- **Units survive.** The `<svg>` `width`/`height`/`viewBox` attributes are re-emitted verbatim
  from the source (`Organica.parseSvgHeader`), including the unit suffix. Re-emitting the
  parsed numbers instead turned `570.000000pt` into `570` — a different physical size (570pt
  is 760px at 96dpi), so a refined export landed **1.33× smaller** in Figma.

### Region behaviour changed

Export now follows the selected region tab: with `region_1` active you export `region_1`, not
the full trace. Previously every export emitted the full SVG regardless of which tab you were
looking at. This is the same WYSIWYG rule Komorebi/Halide/Pollen follow — you export what you
are looking at. Switching regions clears the edited state and reloads the editor, so a refined
region can never leak into another region's export.

---

## 4. Vendored dependency — Paper.js

`shared/paper-full.min.js` — **Paper.js v0.12.17**, MIT licence, 239,435 bytes,
`sha256 85790dee03e8d19fa523847f4656a95e7df2669f26dfb4a4bdddfd801f37c614`.

This is the **first third-party runtime library in Organica**, and it is vendored rather than
loaded from a CDN on purpose:

- the project has no build step and no `node_modules` — vendoring is the only option that fits
- a CDN would be the system's only external runtime dependency, and would break Strata's
  offline / local-backend workflow
- 239 KB is irrelevant on a static Vercel deploy

It earns its place: `smooth`, `simplify` and especially the **boolean union** are not things
to hand-roll. Keep the version pinned; if it is ever upgraded, re-run the checks in §5.

Load order is load-bearing — `organica-core.js` → `paper-full.min.js` → `organica-paper.js`.
`organica-paper.js` merges into the existing `Organica` namespace (`const Organica =
global.Organica || {}` … `global.Organica = Organica`), so loading it *before* core would let
core clobber it.

---

## 5. Development notes — five defects found on first run

This feature had been written but **never actually executed**. Everything below was found by
running it, not by reading it; all are fixed.

1. **`paper.view.fitBounds is not a function`** — fatal. `fitBounds` is an `Item` method, not a
   `View` method. It threw inside `importSVG`'s `onLoad`, so the editor never finished loading
   and clicking Refine did nothing but log an error. Fixed by setting `view.zoom` + `view.center`.
2. **Layout feedback runaway** — `#paper-editor-wrap` is a flex item with the default
   `min-height:auto`, and the canvas was in normal flow: canvas grows → wrap grows → canvas
   grows. Measured reaching **16,777,215 px**. Fixed with `min-height:0` + `overflow:hidden` on
   the wrap and `position:absolute; inset:0` on the canvas, so the canvas can never feed back
   into layout.
3. **Device pixel ratio applied twice** — `fitToView` set the canvas `width`/`height`
   attributes *and* `viewSize`, but paper.js already multiplies by its own `pixelRatio`. On a
   HiDPI screen the canvas came out twice its container (623×1870 inside 311×935). Fixed by
   setting `viewSize` in CSS pixels only and letting paper own the backing store.
   - Root cause behind it: `fitToView` measured **the canvas**, which paper.js resizes via
     inline style — a one-way ratchet, since once paper shrank it the next measurement read the
     shrunken size. It now measures the **container** (which is also what `bindResize()`
     observes, so a re-fit happens automatically once layout settles).
4. **Style silently rewritten** — `styleTraceItem()` forced `strokeColor=null`,
   `strokeWidth=0`, `fillColor=black` on every path. Since export reads back from those same
   items, touching Refine rewrote a stroke-only trace into filled shapes and discarded Strata's
   Fill mode. Replaced with `ensureVisible()` (see §3).
5. **Units dropped on export** — see §3.

### Two false alarms, recorded so they are not re-investigated

- **"Unite all loses geometry"** — it does not. Uniting overlapping blobs reduces total area
  because overlaps merge, which is what union means. Verified with three *disjoint* squares:
  area preserved exactly (7500), result is a proper `CompoundPath`.
- **"Anchor drag does not work"** — it does. Two failed attempts were coordinate-space errors
  in the test harness (screenshot pixels vs CSS pixels), not in the feature. Verified: hit type
  `segment`, and the moved distance matches the drag exactly once converted through
  `view.zoom`.

---

---

## 6. Running in production (July 31, 2026)

Strata used to be local-only: `BACKEND_URL` was `null` on any non-localhost
host, so tracing never worked on the deployed site. The same pipeline now also
runs as **Vercel Python functions** under `/api`, and the frontend picks
whichever is there — `http://localhost:5050` locally, `/api` deployed. Same
endpoints, same response shapes, so nothing downstream knows the difference.

`backend/process.py` stays the **single source of truth** and is shared
verbatim; `api/*.py` only supply the serverless request plumbing.

### What had to change for a read-only filesystem

| Problem | Fix |
|---|---|
| `cv2.imwrite('output/debug_trace_input.png', …)` — an unconditional write to a **relative** path, so it depended on the process's cwd and on that folder existing. Raises on any read-only filesystem. | Only dumps when a writable `output_dir` is actually passed in. |
| Server wrote into `backend/output/` unconditionally. | All writes go through `writable_dir()`, which honours `STRATA_WORK_DIR` (`/tmp/strata-work` on Vercel, `backend/output/` locally). |
| `potrace` is an external **binary**, used by the fallback when contour detection finds nothing. It does not exist on a serverless host. | Missing binary is caught and returns a valid empty SVG, so the caller sees "nothing traced" instead of a 500 from a missing executable. |
| `/trace` wrote SVGs to disk and a later request read them back. Serverless invocations do not share a filesystem. | Every response already carried the SVGs inline; the per-invocation scratch dir is now created under `/tmp` and removed in a `finally`. Verified clean after repeated invocations — Fluid Compute reuses instances, so a leak would accumulate. |

### Bundle size

Measured from the actual x86_64 manylinux wheels: opencv-python-headless
143 MB, numpy 57 MB, pillow 19 MB, vtracer 3 MB — **222 MB unzipped against
Vercel's 500 MB limit** for Python functions. `opencv-python-headless`
replaces `opencv-python` because the GUI/X11 bindings cannot load there
anyway. `vercel.json` gives the functions 2048 MB memory and a 60 s ceiling.

### Still local-only: the Figma push

`/api/send-to-figma` deliberately does **not** exist. The Figma route works by
the plugin fetching an SVG from a URL the local server keeps on disk, which
serverless has nowhere to put. The plugin is shared by every Organica tool, so
it gets one unified pass rather than a Strata-specific workaround. Until then,
pressing → Figma on the deployed site downloads the SVG and says so.

### A bug this uncovered

`handle_send_to_figma` preferred `output/full.svg` whenever that file existed,
and only fell back to the SVG the client posted. So the Refine editor's edited
geometry — and any region other than "full" — never reached Figma; it silently
sent the last raw full-frame trace instead. Verified with a marker SVG: the
POSTed body was discarded. The client now wins, since it is the only side that
knows which SVG the user is actually looking at.

---

*Studio Rann · Organica System v0.1 · July 31, 2026*
