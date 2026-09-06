# CSS rules

Written September 6, 2026, after an audit of all 24 pages and the 8 shared
stylesheets. Every rule below exists because the audit found that exact bug —
none of it is style preference.

**The executable half is `scripts/css-lint.py`.** Run it from the repo root:

```bash
python3 scripts/css-lint.py
```

It exits 1 on a regression. Genesis's known local panel implementation is
listed as **known debt**: reported every run so it stays visible, never
blocking. Deferred work belongs in that list; a lint that is green only
because everything is allow-listed tells you nothing.

---

## Why this document exists

Three separate bugs in one week had the same shape: a tool carried local CSS
that quietly disagreed with the shared system, and nothing caught it.

- Living Path's panel ran at `--fs-large` while every other tool ran at
  `--fs-base` — a 27 % type-size difference, shipped, for a month.
- Its markup used `class="sec"` and `class="panel"`, which the shared sheets
  never styled, so the rules everyone assumed were applying were not.
- Mote redefined `.preset-trigger` and `.preset-menu` — the exact shared class
  names — while setting only *some* of their properties, so its padding,
  background and border came from `panel.css` by accident. An edit to the
  shared picker would have changed Mote with no warning.

Each was found by hand, by diffing computed styles against Loom. That does not
scale, and it does not happen unless someone already suspects a problem.

---

## (a) Creating a new tool

1. Start from `shared/_template.html`. **Never copy a neighbouring tool** —
   that is how every divergence in the audit began.
2. Link the shared sheets **in this order**, then your own `<style>` last:
   `tokens` → `header` → `panel` → `floatbar` → `shell` → `palette`(opt-in)
   → `seeds-panel`(opt-in) → `mobile-gate`.
   Order is load-bearing: tokens first so you can override without
   `!important`, your own sheet last so your deltas win.
3. Your `:root` declares **`--tool` and nothing else**, unless an override is
   genuine — and then it carries a one-line comment saying why. Never
   redeclare `--ink`/`--paper`/`--mid`/`--accent`/`--panel`/`--border` at
   their default values; that was pure noise in three tools.
4. Add the `.mobile-gate` div as the first child of `<body>`. Every tool
   assumes desktop width and a mouse.
5. Register `--tool` in `docs/DESIGN-SYSTEM.md` §5 and in the hub nav in the
   **same commit** as the tool itself.

Legal, auth and documentation pages (`privacy/`, `terms/`, `sign-in/`,
`design-system/`) deliberately skip 4 — a phone visitor must be able to read a
privacy policy. The lint knows about that exclusion.

## (b) Migrating a tool onto a shared component

1. **Diff before deleting.** For every property in the local rule, compare it
   to the shared one, and record the divergences in the commit message.
2. **Adjudicate per property, not per file.** The question is never "who was
   here first", it is *which value is consistent with the rest of the system*.
   Reconciling the presets picker promoted three of Living Path's values and
   rejected three — that is the normal outcome, not a tie-break failure.
3. If a local value wins, **promote it to `shared/` as its own commit first**,
   then delete the local copy in a second. Never delete-and-restyle at once.
4. If the tool's component is genuinely different, **rename it to a tool
   prefix** (`.mote-preset-trigger`). Never leave a local rule sitting under a
   shared class name — see the Mote bug above.
5. Verify with a computed-style diff against Loom, which has effectively no
   local panel CSS and is the reference.

## (c) When a value may be hardcoded

**Must be a token**
- any `font-size` on UI chrome → `--fs-*` (or a `--t-*` role token)
- any `font-weight` → `--w-*`
- margin/padding/gap that lands on the 4px grid → `--space-*`
- any non-zero `border-radius` → `--radius-*`
- any colour that already has a token (`#a03828` is `--danger`; `#696256` is
  `--mid`)

**May be raw**
- 1px and 2px borders and outlines
- this tool's own layout geometry — but as a *named* local custom property
  (`--panel-width-right: 260px`), not a bare value
- control box sizes that are not type: a 13px checkbox, a 22px icon button
- a radius equal to half the element's height — that is a stadium, not a
  corner, and the token scale would flatten it
- **canvas content.** Type and colour drawn *inside the artwork* is user-facing
  output, not UI. Loom's 13px cell label and TuneSutra's 13px bar label are
  correct as they are. Comment each site so the next audit does not re-flag it.

**Never**: a value one step off the scale — `5px` radius where the scale is
2/4/8, `13px` type where it is 12/14. If you want it, add the step to
`tokens.css` *and* to the design-system page in the same commit, or use the
neighbouring step.

## (d) What earns a place in `shared/`

Promote when **all four** hold:
1. **three or more tools** use it (or two, plus a third planned in the same
   session);
2. the values are **reconcilable** — adjudicate per (b).2 first. A promotion
   that starts with an unresolved divergence always leaves a local copy
   behind. That is exactly how Living Path's picker survived;
3. it depends only on tokens and on sheets that load earlier;
4. it has **a home**: exactly one sheet, and every consumer links that sheet.

Point 4 is the one that failed in practice. `.icon-btn` lived in `palette.css`
with seven consumers, only one of them palette-related, and Colornet used it
without linking the file at all. It now lives in `panel.css`, which every tool
links.

A live counter-example, so the bar is legible: a standalone `.hint` paragraph
exists in Living Path and Sinew. Two consumers is one short of rule 1, so it
stays local until a third tool wants it.

**Stays local**: canvas, HUD, drop zone and content styling; a genuine variant
of a shared component (rename it with a tool prefix); a one-tool layout such as
Genesis's library grid.

## (e) Aliases

The alias mechanism is good — it let Living Path adopt the shared panel without
a markup rewrite. What was missing is the exit.

1. An alias is introduced only as a step **inside** a migration, never as a
   permanent feature.
2. It carries a greppable comment in this form:
   ```css
   /* ALIAS: .sec h3 → .panel-section h3 · for: livingpath, sinew
      · added 2026-09-04 · retire when: both use .panel-section */
   ```
3. **The commit that removes an alias's last consumer removes the alias.**
   The Living Path/Sinew markup rewrite orphaned three aliases and left them
   sitting in `panel.css` — the next audit found them, a day later, still
   looking alive. Same rule for token aliases: `--sans`/`--mono`/`--display`
   sat unused for a month because nothing tied their removal to their last
   call site.

## (f) Two meta-rules that hold the rest up

- **One commit, one kind of change.** A commit either deletes provably-dead
  code — and then the computed-style sweep must come back *identical*, which
  is the proof it was dead — or it changes appearance, and then it needs
  screenshots and a functional check. Never both. Mixing them makes a
  regression un-bisectable.
- **Verify by measuring, not by looking.** Two screenshots of a working
  animation look the same; two panels 1px apart look the same; a 16px→11px
  change on invisible SVG `<title>` elements looks like a real change and is
  not. Every claim in this cleanup came from a computed-style diff, and the
  ones that came from reading the CSS instead were wrong about a third of the
  time.

---

## The harness

Verification used a temporary page that iframes all 23 tools at 1440×900 and
records ~49 selectors × 27 properties each, then diffs before against after.
It is not committed — it is quick to rebuild and would rot — but two things
about it are worth keeping:

- **`display:none` iframes report `innerWidth: 0`**, which silently matches
  every `max-width` media query. The first mobile-gate sweep showed the gate
  firing on all 23 pages at a nominal 1440px. Park the frames off-screen
  instead.
- **Split property values on a separator that cannot appear in a value.**
  Splitting on spaces hid a real change inside `calc(50% - 130px)` and made a
  fixed bug look like a no-op.

Both are the same failure this whole cleanup is about: a measurement that
looked authoritative and was not.
