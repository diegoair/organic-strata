# Organica — Roadmap

> Studio Rann · Development Priorities  
> Last updated: June 11, 2026 — v0.1

---

## Current State — v0.1

### Live & Working
- [x] Organica hub — `theorganicalanguage.vercel.app`
- [x] Strata — sketch → SVG pipeline with Smart+ algorithm
- [x] Genesis — 55 animated organic forms + grid composer
- [x] Genesis Indicators — full form catalog
- [x] Spore — generative stippling from images (`/spore/`) — mark library, zoom/pan preview, PNG + hi-def JPG + SVG export, Send to Figma
- [x] Pollen — advanced stippling from images (`/pollen/`) — variable-radius blue-noise engine, Circle/Polygon/Line points, Adaptive duotone, presets, PNG/JPG/SVG export, Send to Figma
- [x] Vercel deployment — auto-deploy on push to `main`
- [x] Animation system documentation

### Known Gaps
- [ ] Figma integration — export is manual
- [ ] No print/large-format export pipeline
- [ ] No pattern/tiling engine
- [ ] No typography module
- [ ] No color system tool beyond Genesis palettes
- [ ] No persistent storage — compositions reset on reload

---

## Spore — Post-Launch Backlog

Shipped to production June 5, 2026 (commit `e44c857`). Open follow-ups from the launch:

### Now — QA & verification
- [ ] **Verify SVG ↔ raster parity in Figma** — re-export an SVG from Spore after a real render and re-import into Figma; confirm the new inlined-geometry vector now matches the PNG/JPG raster. *(The fix was reasoned from the Figma "Spore results" artboard — node `91:51639` — not yet validated with a live export.)*
- [ ] **Verify zoom/pan + JPG export in-browser** — confirm wheel-zoom-to-cursor, drag-pan, reset, and the high-def JPG export all behave on a real image in a live browser session.

### Next — polish & correctness
- [ ] **Implement `adaptive` color mode** — currently a stub returning `markColor` unchanged (see comment "simplified — full impl would parse HSL" in `spore/index.html`); add real brightness-driven hue/lightness shift.
- [ ] **Reconcile brushdot transform** — the `brushdot` mark has an element-level `transform="rotate(-25 …)"` that the canvas renderer ignores but the SVG export now applies; align so raster and vector match exactly.

### Docs hygiene
- [x] **Document Spore** — added Spore to the CLAUDE.md tools table and the repo README (June 9, 2026).

---

## Pollen — Post-Launch Backlog

Advanced stippling tool, shipped to production June 2026. The engine is variable-radius
Poisson-disk (blue noise): spacing follows image brightness (dark = dense, bright = sparse).
The preview is downscaled for responsiveness; **export is WYSIWYG** — it serialises the exact
preview points (SVG is resolution-independent, PNG/JPG scale the same points up).

### Done
- [x] Engine (variable-radius Poisson blue-noise), 400% preview
- [x] Symbols from the centralized Genesis library (primordial subset of 8) + Upload SVG;
  bbox-based sizing + stroke-min floor so every form renders
- [x] Sizing: Size + Range, **Scale** (global ×), **Width/Length** (non-uniform stretch)
- [x] Stippling: Gamma, Contrast, Overpaint, Hide Zone, Phases, **Spacing ×** (master)
- [x] Image: Rotation, Flip, Invert
- [x] **Image & Stippling is live** — debounced auto-recompute (300ms) + "Recomputing…" overlay
- [x] Colour: Solid / Adaptive (duotone) / **RMX palette** (Tone/Posterize/Random/Tone+Random)
- [x] **RMX shapes** — remix up to 3 symbols by tone
- [x] Export PNG / JPG / SVG / Figma — WYSIWYG; **Export Scale moved to the top bar**
- [x] Presets (built-ins + user localStorage) — now persist colour mode, RMX palette,
  mapping and RMX shapes

### Open follow-ups
- [ ] **Aggiornare i preset** — rivedere/riscrivere i preset built-in per il nuovo set di
  forme (8 primordiali) e le nuove feature (RMX shapes/colours, Scale, Width/Length,
  Spacing ×); sync dell'etichetta del dropdown dopo Apply. *(extends "Complete presets")*
- [x] **Stippling effect "come da foto" — flow-field / gradient-oriented strokes**
  (rif: app *Pointillist*). DONE:
  - **Angle = Flow (follow image)** — ogni marchio si orienta sull'isophote (gradiente
    locale +90°), così i tratti seguono i contorni; l'Angle resta come offset.
  - **Simbolo procedurale "Stroke"** — polilinea multi-segmento ondulata con *Segments*
    e *Warping*; lunghezza = Size × 3. WYSIWYG (una `<polyline>` per punto).
  - Combinati → texture piume/pelo/erba che fluisce sulla forma.
  - Stroke = **linea a spessore costante** (modello Pointillist): Size = spessore,
    **Length** px, Segments, Warping (curvatura ad arco liscio), **Rounded** caps,
    **Style — / ✳** (linea singola o star a 3 bracci).
  - *Follow-up opzionale:* porting Flow + Stroke in Spore.
- [ ] **Higher detail ceiling** — preview point cap (~70k) bounds export richness; raise the
  cap and/or move point placement to a **Web Worker** to stay fluid on large images.
- [ ] **Animated stippling for video** (point 6) — animate the stored points (Reveal /
  Breathe / Drift / Twinkle / Rotate) for visualisation + WebM/GIF export.
- [ ] **RMX in Spore shapes** — Spore has RMX colours; add RMX shapes too for parity.
- [ ] **Optional** — more built-in presets; Gamma/Contrast on the 400% preview readout.

---

## Phase 2 — Genesis Depth

Deepen the Genesis composer into a real production tool.

- [ ] **Export compositions** — download as SVG, PNG, or animated GIF
- [ ] **Save/load** — persist compositions to localStorage or file
- [ ] **More forms** — extend library beyond 55 (forms 56+)
- [ ] **Form scale** — allow forms to break outside their grid cell
- [ ] **Rotation** — per-form rotation control in composer
- [ ] **Opacity** — per-form opacity control
- [ ] **Drop mark forms** — new forms derived from the drop marking gesture specifically

---

## Phase 3 — Figma Integration

Direct push from Organica tools into Figma.

- [ ] **Genesis → Figma** — place composed grid directly into a Figma file as components
- [ ] **Strata → Figma** — push traced SVGs directly (current: manual download + import)
- [ ] **Component library** — Organica forms as a Figma component library
- [ ] **Variable system** — color and scale tokens synced between Organica and Figma

---

## Phase 4 — Pattern Engine

Systematic tiling and repetition — a core module of Flexible Visual Systems.

- [ ] **Tile from form** — take any Genesis form, generate a repeating pattern
- [ ] **Grid variants** — square, hexagonal, brick, random scatter
- [ ] **Density control** — sparse to dense
- [ ] **Export** — pattern as SVG tile, CSS `background`, or high-res PNG

---

## Phase 5 — Strata AI

Make the shape grammar extraction smarter.

- [ ] **Auto-element detection** — identify discrete forms in a sketch automatically
- [ ] **Form matching** — match extracted shapes to Genesis library forms
- [ ] **Style consistency** — ensure extracted forms follow Organica grammar rules
- [ ] **Batch processing** — multiple images → unified form library

---

## Phase 6 — Output Pipeline

Production-ready exports for every medium.

- [ ] **Print** — high-res PDF, CMYK-ready
- [ ] **Mural schema** — tiled large-format output with registration marks
- [ ] **Web** — animated SVG bundles, CSS animation exports
- [ ] **Installation** — generative loop output (canvas/WebGL)
- [ ] **Social** — sized presets (Instagram, poster formats)

---

## Open Questions

These need decisions before building:

1. **Typography module** — what role does type play in Organica? System font or custom?
2. **Color system** — beyond the 3 Genesis palettes, how are colors managed across outputs?
3. **Client workflow** — when Organica is used for client branding, what does the handoff look like?
4. **Mural scale** — what's the largest output format needed? What DPI/size?

---

*Studio Rann · Organica System v0.1 · June 5, 2026*
