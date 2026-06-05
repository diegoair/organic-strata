# Organica — Roadmap

> Studio Rann · Development Priorities  
> Last updated: June 2026 — v0.1

---

## Current State — v0.1

### Live & Working
- [x] Organica hub — `theorganicalanguage.vercel.app`
- [x] Strata — sketch → SVG pipeline with Smart+ algorithm
- [x] Genesis — 55 animated organic forms + grid composer
- [x] Genesis Indicators — full form catalog
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

*Studio Rann · Organica System v0.1 · June 2026*
