# Rhizome — node-based workflow canvas

`/rhizome/` — a node graph editor that chains Organica's own tools together as pipeline stages: infinite pan/zoom canvas, typed input/output ports, drag-to-connect wires, DAG execution. Not a new visual engine — every node either wraps a real shared function (`Organica.loadLoomGrid`, `Organica.traceContours`, a Loom generator) or drives an actual Organica tool page inside a hidden iframe and reads its real output back. Nothing in Rhizome re-implements a tool's own algorithm.

Named after the botanical rhizome — an underground stem that sends up independent shoots from one connected network — matching what the tool actually does: one graph, many tool "shoots" wired together.

---

## 1. Model

Two-tier node model, decided to avoid two failure modes: re-implementing a tool's algorithm a second time (drifts from the original as the tool evolves) and paying iframe/postMessage latency for something that's already a cheap pure function.

- **Tier 1 — native.** Zero porting: a thin wrapper around a function the tool already exports as a pure, DOM-free call. `compute(inputs, params)` returns a value synchronously.
- **Tier 2 — bridge.** A hidden sandboxed `<iframe src="/<tool>/">` loads the real tool page. On run, Rhizome posts `{type:'rhizome-set-input', nodeId, payload}`; a small listener block (~20–30 lines, added directly to the tool's own `index.html`/`main.js`) writes the payload into the tool's real internal state, triggers its own render, waits for it to actually finish, then calls the tool's own export function and posts back `{type:'rhizome-output-ready', nodeId, payload}`. `compute()` for a Tier 2 node returns a Promise.

The canonical model is plain JSON, no derived/cached fields persisted:
```js
{ version, nodes: [{ id, type, x, y, params }], edges: [{ id, from:{nodeId,port}, to:{nodeId,port} }] }
```
Everything else (resolved values, dirty flags, topological order) is recomputed on demand — the same "don't store what you can derive" discipline Loom's own `json-model.js` documents.

## 2. Node registry (17 types)

**Tier 1 (native, 5):**
| Node | Wraps |
|---|---|
| Loom Grid Generator | `loom/js/generators/*.js` — bento/sinusoidal generators, ES-module import |
| Loom Grid → Geometry | `Organica.loadLoomGrid` |
| Contour Trace | `Organica.traceContours`/`contoursToPathD` |
| SVG → Points | `Organica.motion.parsePrimitives` |
| Merge | composites N SVG inputs with a per-input offset (variadic — see §4) |
| Image Upload | file→dataURL source node (not a bridge; no tool page needed) |
| Export | PNG / SVG / → Figma, terminal node |

**Tier 2 (bridge, 10):**
| Node | Tool | Params |
|---|---|---|
| Genesis Seed | `/genesis/creator.html` | seed picker |
| Komorebi Pattern | `/komorebi/` | preset |
| Warping Pattern | `/warping/` | preset |
| Soul (pass-through) | `/soul/` | — |
| Camo Turing Pattern | `/camo-turing/` | preset |
| Membrane Trail | `/membrane/` | pattern (mouse/linear/orbit/zigzag/figure8/sine), seconds |
| Living Path Preset | `/livingpath/` | 29 presets (`tech:name`, 5 vector + 24 raster) |
| Spore Stipple | `/spore/` | — (Spore has no preset dropdown) |
| Pollen Stipple | `/pollen/` | 6 presets (Fine Dots/Felt-tip/Lines Flow/Duotone/Hatch Flow/Hatch Swirl) |
| Halide Dither | `/halide/` | 8 presets (Ditherface, Atkinson, Bayer, etc.) |

`makeBridgeNode({id, label, src, inputs, outputs, params, buildPayload})` (`nodes/bridge-iframe.js`) is the one factory every Tier 2 node goes through — a node file is just its own `buildPayload(inputs, params)`.

## 3. The async image-load race (found across 3 bridges, one root cause)

Spore/Pollen/Halide all gate rendering on `loadImage(input)`, whose `img.onload` fires **asynchronously even for `data:` URLs**. A poll loop that checks the tool's own render-completion signal immediately after calling `loadImage()` sees the signal's pre-render (stale) state and exits before rendering has even started — silently returning empty/stale output with no console error.

Fixed identically in all three listener blocks with a **two-phase wait**:
1. Poll `#drop-hint.classList.contains('hidden')` — each tool's own reliable "image finished decoding" signal (added inside the tool's own `onload`, before this fix existed for other reasons).
2. Only then poll the tool's own actual render-completion signal (`#btn-save-svg.disabled` for Spore, `#btn-stop.disabled` for Pollen, the equivalent for Halide).

Lesson for any future bridge on an image-gated tool: check for this same two-phase shape before assuming a single poll is sufficient.

## 4. Variadic ports — Merge

`meta.inputs` is a static array for every other node type. Merge needs a runtime-variable port count (`inputCount`, 1–6), so it instead exports `getInputs(node)`, and every consumer goes through `getNodeInputs(node)` (`node-registry.js`) rather than reading `meta.inputs` directly — the execution engine, `node-card.js`'s port rows, and main.js's connect-time type checks all dispatch through this one function. `node-card.js`'s `buildPortRows` is a standalone rebuildable function (not baked into construction) so changing `inputCount` can rebuild just the port rows without rebuilding the whole card; edges pointing at a now-dropped port are pruned in `main.js`.

## 5. Canvas interaction

- **Pan/zoom** — `Organica.createZoomPan` with a new opt-in `panAlways` option (added to `organica-core.js`, no effect on any existing caller that doesn't pass it) so the empty canvas pans without needing to zoom past 100% first.
- **Node drag** — `bindNodeDrag(handleEl, node, zoomPan, onMove, onDragEnd, getDragGroup)`. `getDragGroup(node)` returns either `[node]` or the full current multi-selection, so dragging one selected node moves the whole group together.
- **Multi-select / marquee** — `canvas/selection.js`, gated on **Shift+drag** specifically (plain drag is the canvas pan gesture). A capture-phase `mousedown` listener with `stopImmediatePropagation()` intercepts Shift+drag before the pan handler sees it. Plain click on empty canvas clears the selection.
- **Wires** — `WireLayer` draws Catmull-Rom-style curves (same curve technique as Mycel's own `catmullSegD`), recalculated on every `mousemove` during a drag (not a separate rAF loop — sufficient at this node count). Clicking a wire selects it (`setSelectedEdge`) for Delete.

## 6. Undo / redo

`history.js` — a plain JSON-snapshot stack (`push`/`undo`/`redo`/`canUndo`/`canRedo`, `MAX_HISTORY=100`, dedupes no-op pushes, truncates the redo branch on a new push). Pushed only at meaningful checkpoints, never on continuous ticks:
- add/remove node, connect/disconnect
- drag **end** (not every intermediate tick)
- param **commit** — a slider fires `onChange` (live recompute) on every `input` tick but `onCommit` (history push) only once, on `change`/release

Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z are bound at the document level but skip when `document.activeElement` is an INPUT/SELECT/TEXTAREA, so undo doesn't fight text editing. Undo/Redo/Delete-selected buttons live in the floatbar; their disabled state is refreshed after every push **and** after every undo/redo click (a real bug: it was originally only refreshed on push, so the button stayed enabled at the empty baseline).

## 7. Known limits / deferred

- Bridge timeout is 20s (`bridge-iframe.js`), covering Camo Turing's step-count cost and Membrane's own real wall-clock wait (up to 10s).
- Not covered by a bridge yet: Vortex, TuneSutra, Mycel (explicitly excluded from this phase — Diego's own "fai solo Living Path, Spore, Pollen, Halide" scoping).
- A real preset-picker UI (thumbnails, not a plain dropdown) — deferred; Graph save/load uses `Organica.presetStore('rhizome')` with a plain named-preset dropdown today.
- Figma export inherits the product-wide `Organica.sendToFigma` gap (the plugin's `onmessage` never listens for `'organica-svg'`) — not fixed as part of this tool, same as every other tool's own "→ Figma" button.

## 8. Verification standard

Every bridge in this doc was verified by actually connecting real nodes (Image Upload → bridge, or Genesis Seed → downstream), waiting for real completion, and checking BOTH a screenshot of genuine tool-specific output (not a placeholder) and a fresh-tab console for zero errors — never "no error" alone, since a clean console only proves something if the exact interaction that would trigger a bug was actually exercised (the lesson repeated several times elsewhere in this project's own history).
