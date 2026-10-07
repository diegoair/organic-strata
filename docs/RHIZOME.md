# Rhizome — node-based workflow canvas

`/rhizome/` — a node graph editor that chains Organica's own tools together as pipeline stages: infinite pan/zoom canvas, typed input/output ports, drag-to-connect wires, DAG execution — since Oct 2026 all of it is the shared node canvas (`Organica.nodeCanvas`, §5), the same board as FVS's Figure graph. Not a new visual engine — every node either wraps a real shared function (`Organica.loadLoomGrid`, `Organica.traceContours`, a Loom generator) or drives an actual Organica tool page inside a hidden iframe and reads its real output back. Nothing in Rhizome re-implements a tool's own algorithm.

Named after the botanical rhizome — an underground stem that sends up independent shoots from one connected network — matching what the tool actually does: one graph, many tool "shoots" wired together.

---

## 1. Model

Two-tier node model, decided to avoid two failure modes: re-implementing a tool's algorithm a second time (drifts from the original as the tool evolves) and paying iframe/postMessage latency for something that's already a cheap pure function.

- **Tier 1 — native.** Zero porting: a thin wrapper around a function the tool already exports as a pure, DOM-free call. `compute(inputs, params)` returns a value synchronously.
- **Tier 2 — bridge.** A hidden sandboxed `<iframe src="/<tool>/">` loads the real tool page. On run, Rhizome posts `{type:'rhizome-set-input', nodeId, payload}`; a small listener block (~20–30 lines, added directly to the tool's own `index.html`/`main.js`) writes the payload into the tool's real internal state, triggers its own render, waits for it to actually finish, then calls the tool's own export function and posts back `{type:'rhizome-output-ready', nodeId, payload}`. `compute()` for a Tier 2 node returns a Promise.

The canonical model is the shared node canvas's plain JSON, no derived/cached fields persisted:
```js
{ version: 2, nodes: [{ id, type, x, y, params, name }], edges: [{ id, from:{node,port}, to:{node,port} }], frames: [] }
```
A graph saved before Oct 2026 (`version: '1.0'`, edges by `nodeId`, nodes without names) opens unchanged: `migrateModel()` (`js/main.js`) rewires `nodeId` → `node` and names each node (*Loom grid 1*). Saved graphs stay in `Organica.presetStore('rhizome')`.
Everything else (resolved values, dirty flags, topological order) is recomputed on demand — the same "don't store what you can derive" discipline Loom's own `json-model.js` documents.

## 2. Node registry (16 types)

Names are words (`docs/UI-COPY.md` §2): `node-registry.js` gives every type, parameter and port a `label` on load — ids, param names and port names stay as they were, since saved graphs use them. Options read in sentence case (`optionLabel`, the value stays the id). The node bar groups the types as **Source · Process · Output**.

**Tier 1 (native, 7):**
| Node | Wraps | Group |
|---|---|---|
| Loom grid | `loom/js/generators/*.js` — bento / hexagonal / triangular / diamond / circular | Source |
| Loom grid file | `Organica.loadLoomGrid` on an uploaded grid JSON | Source |
| Image | file → dataURL source node (not a bridge) | Source |
| Contour trace | `Organica.traceContours` / `contoursToPathD` | Process |
| SVG to points | `Organica.motion.parsePrimitives` | Process |
| Merge | composites N SVG inputs with a per-input offset (variable inputs — see §4) | Process |
| Export | PNG / SVG / Send to Figma | Output |

**Tier 2 (bridge, 9):**
| Node | Tool | Params | Group |
|---|---|---|---|
| Genesis seed | `/genesis/` | Shape | Source |
| Komorebi pattern | `/komorebi/` | Pattern | Source |
| Warping pattern | `/warping/` | Pattern | Source |
| Camo Turing pattern | `/camo-turing/` | Preset, Steps | Source |
| Membrane trail | `/membrane/` | Pattern (Mouse / Linear / Orbit / Zigzag / Figure 8 / Sine), Duration (s) | Source |
| Sinew effect | `/sinew/` | Preset — 29 (`vector:` / `raster:` name, shown *Vector · Coral*) | Source |
| Spore stipple | `/spore/` | — | Process |
| Pollen stipple | `/pollen/` | Preset (6) | Process |
| Halide dither | `/halide/` | Preset (8) | Process |

`makeBridgeNode({id, label, src, inputs, outputs, params, buildPayload})` (`nodes/bridge-iframe.js`) is the one factory every Tier 2 node goes through — a node file is just its own `buildPayload(inputs, params)`.

## 3. The async image-load race (found across 3 bridges, one root cause)

Spore/Pollen/Halide all gate rendering on `loadImage(input)`, whose `img.onload` fires **asynchronously even for `data:` URLs**. A poll loop that checks the tool's own render-completion signal immediately after calling `loadImage()` sees the signal's pre-render (stale) state and exits before rendering has even started — silently returning empty/stale output with no console error.

Fixed identically in all three listener blocks with a **two-phase wait**:
1. Poll `#drop-hint.classList.contains('hidden')` — each tool's own reliable "image finished decoding" signal (added inside the tool's own `onload`, before this fix existed for other reasons).
2. Only then poll the tool's own actual render-completion signal (`#btn-save-svg.disabled` for Spore, `#btn-stop.disabled` for Pollen, the equivalent for Halide).

Lesson for any future bridge on an image-gated tool: check for this same two-phase shape before assuming a single poll is sufficient.

## 4. Variable inputs — Merge

Merge's input count (`inputCount`, 1–6) is per node, so it exports `getInputs(node)` (ports *SVG 1 … SVG 6*), which the shared registry reads as `meta.inputs(node)`. When the count changes, `main.js` drops the wires to ports that are gone and refreshes the board; the shared board rebuilds a card whose port list changed (`portSig`, `shared/node-canvas.js`). Undo brings the count and the wires back.

## 5. The board — `Organica.nodeCanvas` (Oct 2026)

Rhizome's own canvas (`canvas/` pan-zoom, node drag, wires, ports, selection), `graph-model.js`, `execution-engine.js` and `history.js` were replaced by the shared node canvas (`shared/node-canvas.js` / `.css`, API in `docs/SHARED-COMPONENTS.md` §2d), built for FVS's Figure graph from what Rhizome taught and fixed on the way. Rhizome adapts its types with `sharedTypes()` (`node-registry.js`): `compute()` returns `{ <output>: value, _v: value }` (`_v` = the preview and Export's value), the three adapters are passed to `createRegistry`.

- **Engine** — every node computes, on screen or not (`isActive: () => true`: a bridge's output feeds what follows, Export reads it); recompute is downstream-only, keyed by versions, serialized; each node has a state — ok · error · waiting · upstream · stale — shown on its card.
- **Board** — wheel zooms, Space-drag / middle-drag pans, a plain drag draws the marquee (Shift adds), ⌘A / ⌘D / ⌘C ⌘V / ⌘G (section), arrows nudge, Delete, Shift+1 / Shift+2 fit; wires drawn from the model in their port colour; Weave wiring (drop a wire on a card → its first input that fits; release it on the board → the node search, the picked node arrives wired).
- **Adding nodes** — the **node bar** (left dock, `Organica.nodeCanvas.nodeBar`: Source · Process · Output, drag onto the board or click) and the **node search** (`/`, right-click, double-click on the board, a released wire — `Organica.nodeCanvas.search`; from a wire it lists only what connects, adapters included).
- **Cards** — the type above the node's own name (*Merge 2*); the body is a preview on a light work surface (`.rz-preview`, `data-theme="light"`): an SVG as an `<img>` from a blob URL (never parsed into the page), *N cells*, *N points*, an image.
- **Port colours** — Rhizome's types on the seven `--port-*` tokens (ledger O-34): SVG → content, Image → figure, Grid → grid, Color → palette, Number → rule, Points → composition.
- **Floatbar** — the Figure graph's: **Graph** menu (Saved graphs · Graph name · Save · Delete · New graph · Open file… · Save as file; a graph never saved is kept as *Untitled n* before another replaces it; a dot on *Graph* while unsaved) · Undo · Redo · Delete · Fit all · Fit selection.

## 6. Undo / redo

The shared history: a snapshot stack pushed at checkpoints — add / remove, connect / disconnect, drag end, a parameter commit (a slider recomputes on every tick, commits once on release) — with the selection restored. ⌘Z / ⌘⇧Z while focus is not in a field.

## 7. Known limits / deferred

- Bridge timeout is 20s (`bridge-iframe.js`), covering Camo Turing's step-count cost and Membrane's own real wall-clock wait (up to 10s).
- Not covered by a bridge yet: Vortex, TuneSutra, Mycel (explicitly excluded from this phase — Diego's own "fai solo Living Path, Spore, Pollen, Halide" scoping).
- A thumbnail picker for saved graphs — deferred; the Graph menu lists them by name.

## 8. Verification standard

`scripts/test-rhizome.sh` (headless Chrome, run by the pre-commit hook when Rhizome or the shared node canvas is staged, and by CI): every type named in words; a native graph through the three adapters; a Warping bridge answering through its iframe; Merge's input count rebuilding its card and dropping the orphaned wire, undo bringing both back; a wire no adapter carries refused; a graph saved before Oct 2026 opening and computing; the node search from a wire; the node bar.

Every bridge in this doc was also verified by actually connecting real nodes (Image → bridge, or Genesis seed → downstream), waiting for real completion, and checking BOTH a screenshot of genuine tool-specific output (not a placeholder) and a fresh-tab console for zero errors — never "no error" alone, since a clean console only proves something if the exact interaction that would trigger a bug was actually exercised.
