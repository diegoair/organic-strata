# TuneSutra — System view (archived)

Archived on **Nov 18, 2026** — Diego: *"il system per ora togliamolo ma teniamolo in un
archivio nel caso ci dovesse servire un domani"*. Frozen: never edited.

`index.html` here is the whole of `tunesutra/index.html` on that day, **with** the System
view, just before it was removed from the live tool. (Built Oct 1, 2026.) It still loads the
live `/shared/*` scripts and `/tunesutra/collections.js` + `/tunesutra/house.js`, so a later
change to those can break this copy — it is a reference to port from, not a page to keep running.

## What System was

A view of TuneSutra that **proposed Organica's own interface colours from a palette**, beside
today's values. Nothing was ever applied: the output was a file to review and paste into
`shared/tokens.css`.

- **Ten chrome roles**, light + dark: `ink paper mid accent accent-hover panel border
  border-strong danger canvas-dot` (`SYS_ROLES`). Lightness targets were today's own (OKLCH);
  the text and boundary roles were pushed until they cleared the contrast rule
  (text ≥ 4.5:1, boundaries ≥ 3:1, on `--paper` and `--panel`; `SYS_RULE`).
- **Controls** (panel section *System*): Neutral (which colour's hue tints the greys) ·
  Tint 0–100 · Canvas dot · Tool accents (Keep hues / Even hues) · Lightness · Chroma ·
  Preview on this page (applied the proposal to the page's own `:root`, never saved).
- **The sheet** (`buildSystemScene`): a role table today vs proposed with contrast, a small
  mock-up, and every tool's `--tool` accent today vs proposed (`loadToolAccents` read each
  tool page's `--tool`).
- **Exports**: *System proposal* → CSS (`systemCSS`: the two theme rules + one `--tool` per
  tool) and DTCG JSON (`systemJSON`).
- **Saved** with a palette as `system: { neutral, tint, dot, mode, accL, accC }` — palettes
  saved before Nov 18 still carry that field; the live tool ignores it and no longer writes it.

## Where the code is in `index.html`

Search for `// ── SYSTEM — the interface's own colours` (the logic, from `SYS_ROLES` to the
end of `initSystem`), `<h3>System</h3>` (the panel section), `System proposal` (the export
popover), `buildSystemScene` (the sheet), `state.sys` (state, undo, load / save) and
`data-v="system"` (the View button).

## To bring it back

Port those pieces into the live `tunesutra/index.html` (the sheet is still one
`buildScene()` list, the View section a toggle group — Gradient is the model to follow), and
add the System row back to `docs/TUNESUTRA.md`. Since Nov 18 the main view is the generated
house (`tunesutra/house.js`), so System returns as a second toggle beside Gradient.
