# Design decisions — the register

> Kept by the design-system agent (`.claude/agents/design-system.md`), decided by the owner.
> Four lists and a log. An agent or a teammate reads this **before** proposing anything: an
> exception written here is not a finding, and a question already asked is not asked twice.
>
> The narrative of *why* the system looks the way it does stays in `docs/DESIGN-SYSTEM.md`
> and the session notes. This file is only the ledger: what is open, what was decided, what
> is allowed to differ.

---

## 1. Open — waiting for the owner

Each entry is a question that can be answered in a word. Newest first.

*Diego, Oct 2, 2026: O-1 … O-5 noted, to be decided later — do not act on the recommendations until he answers. O-6 … O-10 (templates) asked the same day.*

| # | Opened | Question | Options · recommendation | Evidence |
|---|---|---|---|---|
| O-6 | 2026-10-02 | **Page templates: three (Tool · Page · Auth card), with the own-surface tools (Apostate, FVS, Rhizome, Genesis) as documented variants of Tool, not a fourth?** | **Yes** (recommended — the four share no skeleton with each other and measure the same as Tool: panel 248 at x=1192, floatbar 16px from the bottom) · or a fourth "own surface" template | Template audit, 33 pages: Tool 22 · own-surface 4 · Page 5 (privacy, terms, admin, gallery, hub) · Auth card 1 · the design-system layout as a one-off |
| O-7 | 2026-10-02 | **Promote one shared page column (a class + a width modifier) and migrate `.doc` / `.wrap` / the gallery's `main`?** | **Yes** (recommended — four local copies, four different body rules, and two of them cannot scroll) · or fix locally and document as-is | `privacy/index.html:11`, `terms/index.html:11` link `shell.css` → `body { height:100vh; overflow:hidden }`; `admin/index.html:13` overrides it by hand |
| O-8 | 2026-10-02 | **Membrane / Vortex panel is `--panel` grey; the other 23 tools are paper white. Fix or standing exception?** | **Fix** (recommended — 2 pages against 23; also a stale `var(--header-h, 40px)` fallback) · or exception | local `#panel` / `#app` rules in `membrane/index.html`, `vortex/index.html` |
| O-9 | 2026-10-02 | **Mycel / TuneSutra `#stage-wrap` is a local copy of the canvas region. Move to `.org-canvas-wrap` or exception?** | **Fix, low priority** (recommended) · or exception. Apostate's 3-column grid is recorded as a standing exception either way | `mycel/index.html:25-29`, `tunesutra/index.html:26-30`, `apostate/index.html:30-33` |
| O-10 | 2026-10-02 | **A skeleton lint per template (sheet order incl. `icons`, mobile gate first, `#app` = surface + `#panel`, floatbar a body child, no Export in the header, `data-theme-support`), blocking in `check.py`, and applied to `shared/_template.html` too?** | **Yes, after the template is refreshed** (recommended — nothing lints the template today and a tool copied from it fails css-lint) · or documentation only | `scripts/css-lint.py:21` excludes `shared/`; `ORDER` at `:198` has no `icons` |
| O-1 | 2026-10-02 | **`--hit-min: 24px`** was added in the audit's long tail as a new token "to confirm". Keep it? | **Keep** (recommended — it is used by Loom, Rhizome, the glyph editor and Mycel, and has a `/design-system/#hit-areas` entry) · or replace with `--space-7` (same 24px, but a spacing step, not a role) | `shared/tokens.css:357`; `docs/DESIGN-SYSTEM.md` never names it |
| O-2 | 2026-10-02 | **`shared/tokens.json` calls itself the single source of truth and is stale.** What is it? | **A mirror of `tokens.css` for Figma** (recommended — the live reference already says `tokens.css` is first; then bring the JSON in line once and let `ds-audit.py` keep it there) · or the real source, and `tokens.css` is regenerated from it (a build step the project does not have) | `ds-audit.py`: says Manrope / `weight.light 300` / `size.display`; `lineHeight.tight` 1.2 vs 1.15; 10 scale tokens and 8 tool accents missing; 4 accents differ from what the pages run |
| O-3 | 2026-10-02 | **Four tool accents differ between the docs and the pages** (Halide and Spore both run `#5a7a96`; Pollen `#c8a83a`; Genesis `#6a9c2e`). Which side is right? | **The pages** (recommended — they are what users see; then the doc table and the JSON follow) · or the doc values, and the pages change. Separately: Halide and Spore share one accent — intended? | `docs/DESIGN-SYSTEM.md` §5 lists `#7a9cb8`, `#a0c8f0`, `#e8c84a`, `#c8f060` |
| O-5 | 2026-10-02 | **Should `ds-audit.py --diff` run in the pre-commit hook and block the commit?** | **Yes, blocking on the strict categories only** (recommended once it has run clean on a few real commits — no new raw value can slip through) · or keep it a rule in `CLAUDE.md` only (today; nothing enforces it, but a false positive can never stop a commit) | `.githooks/pre-commit` runs `scripts/check.py` only; `--diff` tested with one injected regression |
| O-4 | 2026-10-02 | **Four tokens have no consumer**: `--dur-reveal`, `--dur-stagger`, `--ease-in-out`, `--t-display-lh`. | **Keep the three motion tokens** (recommended — one day old, the remaining raw `ms` in the home page / FVS keyframes are their intended consumers) and decide `--t-display-lh` · or retire all four | `ds-audit.py` "Tokens with no consumer" |

## 2. Decisions

Newest first. One line each; the reason and the place it is enforced are what make it stick.

| Date | Decision | Reason | Enforced by |
|---|---|---|---|
| 2026-10-02 | A change may not **add** raw values where a token exists; legacy debt is mapped, not blocking. | The legacy pages cannot all be cleaned at once; what matters is that the number only goes down. | `scripts/ds-audit.py --diff` (run by the design-system agent in REVIEW) |
| 2026-10-02 | UI work passes two agent gates: **CONSULT** before building, **REVIEW** before the commit; **DOCUMENT** after it ships. | Every refactor so far started as a local divergence nobody saw at the time. | `CLAUDE.md` → "Design-system agent" |
| 2026-10-02 | Icons come from one registry; motion from `--dur-*` / `--ease-*`; destructive buttons carry `data-armed`. | UI audit, `docs/audit-2026-10/`. | `scripts/check.py` (icons), `ds-audit.py` (motion), `CLAUDE.md` Critical Rules |
| 2026-10-02 | Hover has three tiers and one wash (`--track-bg`); focus ring is `--ink`. | `docs/audit-2026-10/HOVER.md` | shared sheets; `/design-system/#hover` |
| 2026-10-01 | `--control-bg` is the ground of every editable control. | A role, not a grey step — follows each tool's ink/paper and both themes. | `shared/tokens.css`; `/design-system/#panel-controls` |
| 2026-09-29 | Everything new works in **light and dark**; dark flips the chrome, never the work. | Diego's rule. | `/design-system/_dark-audit.html`, contrast self-check, css-lint `shared-hex` |
| 2026-09-29 | Two typefaces by role: Space Grotesk (display, controls, numbers, panel labels), IBM Plex Mono (the rest). | The mono is ~20% wider and does not fit the panel. | `shared/tokens.css` (`--font-display` / `--font-mono`) |
| 2026-09-29 | One button (`.org-btn`), one field (`.org-field`); legacy names are aliases. | 78 button looks and 24 field looks before. | `/design-system/_control-audit.html` |
| 2026-09-06 | A shared CSS component needs three consumers, reconcilable values, token-only dependencies and one home sheet. | `docs/CSS-RULES.md` (d) — `.icon-btn` lived in the wrong sheet with seven consumers. | css-lint `missing-sheet`, `shadow` |

*Earlier decisions are in `docs/DESIGN-SYSTEM.md`, `docs/CSS-RULES.md` and `docs/SESSION-LOG.md`; move one here when it is next relied on.*

## 3. Standing exceptions

Things that look like violations and are not. The lint allow-lists
(`scripts/css-lint.py`: `ALLOW_SHADOW`, `ALLOW_RADIUS`, `ALLOW_HEX`, `KNOWN_DEBT`) are the
executable half of this list — an exception lives there **and** here, or it is not one.

| What | Where | Why it is allowed |
|---|---|---|
| Content colours typed as hex | every tool's ink / paper / point / grid colour (e.g. Loom's guide blue, Halide's ink and paper) | User data, not chrome (`CLAUDE.md` Critical Rules) |
| Stadium radii off the 2/4/8 scale | switch track, scrollbar thumbs, Camo Turing's toggle | Half the element's height is a capsule, not a corner |
| Canvas text and colour drawn in the artwork | Loom cell labels, TuneSutra bar labels | Output, not UI (`docs/CSS-RULES.md` (c)) |
| Genesis's local panel implementation | `genesis/index.html` | Retiring — left alone by decision (Sep 2026, confirmed Oct 2, 2026) |
| The floatbar pill animates `width` | `shared/floatbar.css` | Measured 60 fps (233 frames, max 17.7 ms); `scaleX` would squash its ends |
| Raw `1ms` durations | reduced-motion blocks | The collapse value itself |
| `.hud-btn` raw hex `#f5f2ec` | `shared/shell.css` | A dark HUD pill over the canvas, identical in both themes |
| The test gallery and `explorations/*` | `/gallery/`, `explorations/` | Development pages; not held to the tool contract |

## 4. Maintenance queue

Drift that needs no decision — only doing. The agent reports items in REVIEW / AUDIT / CONSULT (read-only modes — the main session
writes them here) and strikes them in DOCUMENT.

| Found | What | Where |
|---|---|---|
| 2026-10-02 | `docs/DESIGN-SYSTEM.md` §1 and §3 still describe one typeface (Wix Madefor / Manrope) and a Light weight; the header says "Last updated: August 26, 2026". The two-typeface rule is only in the appendix at the end. | `docs/DESIGN-SYSTEM.md:1-52`, `:136-142` |
| 2026-10-02 | §5 accent table misses Apostate, Pulsar, Radial, Rhizome, Sinew, Trellis (and Murmur has no row of its own). Values for Halide / Spore / Pollen / Genesis wait on O-3. | `docs/DESIGN-SYSTEM.md` §5 |
| 2026-10-02 | The floatbar example in the live reference uses inline SVGs with stroke attributes and types "Export ▾" as a glyph — it predates the icon registry, so it cannot be copied from. Its "Used in" list omits Mote, Dapple, Undertow, Murmur, Trellis. | `design-system/index.html` `#floatbar` |
| 2026-10-02 | `#behaviours` says the thumbnail picker has no Esc; it has. | `design-system/index.html` `#behaviours`, `shared/select-picker.js` |
| 2026-10-02 | `.org-out`, `.org-panel`, `.org-theme` exist in the shared sheets with no mention in the live reference. | `ds-audit.py` |
| 2026-10-02 | **`/privacy/` and `/terms/` cannot scroll** — they link `shell.css`, which fixes the body at 100vh with `overflow: hidden`; content is 2773px / 1691px. Measured in the browser: no scrolling element at all. Public legal pages. | `privacy/index.html:11`, `terms/index.html:11` |
| 2026-10-02 | `shared/_template.html` is stale: no `data-theme-support`, no `icons.css` / `icons.js` / `select-picker.js`, no `mobile-gate.css` and no `.mobile-gate` div (a copy fails css-lint), Open / Export / Figma in the header (24 of 26 tools have Export in the floatbar), links `floatbar.css` with no `.org-floatbar`, a native preset `<select>`. | `shared/_template.html:2`, `:14-19`, `:55-85`, `:105`, `:153-160` |
| 2026-10-02 | `docs/UI-SHELL.md` disagrees with the measure: §1 draws a 40px topbar ("Last updated July 25"), §6 steps 2 and 4 still say `.logo` and a nav link in `index.html` (navigation is `shared/tools.js`), `shell.css` linkers given as 19 / 17 / 14 in three places (measured: 22 tools + 4 pages). | `docs/UI-SHELL.md:41`, `:74`, §6, §7 |
| 2026-10-02 | Live reference "Used in" lists are typed and short: `#shell` lists 13 (22 measured), `#panel-shell` 13 (25 measured); `#file-architecture` says "Eight" files, has 9 rows, `shared/` has 11 sheets (`icons.css`, `prose.css` have no row). | `design-system/index.html` |
| 2026-10-02 | Small skeleton drift: Spore has two `id` attributes on one element; Camo Turing types `#panel { width: 248px }` instead of `--panel-w` and links `/genesis/animations.css`; Living Path loads opentype.js from a CDN (Apostate uses the vendored copy); Colornet has two header action buttons; Apostate's `.mobile-gate` is the last body child; `CLAUDE.md` names `shared/canvas-preset-grid.css`, which does not exist. | `spore/index.html:200`, others in the template audit |
| 2026-10-02 | A stacked "choice list with a current item" inside a popover now has two instances (Rhizome's add-node menu, Mote's camera list when built). Propose promotion at the third (`docs/CSS-RULES.md` (d)). | `rhizome/index.html` `#add-node-menu .org-formats` |

## 5. Audit log

One line per full audit (`python3 scripts/ds-audit.py`), so the next one can say what moved.

| Date | Tokens | Undocumented | Unused | tokens.json gone / differ / missing | Accents not in doc | Raw values — strict | to judge | Note |
|---|---|---|---|---|---|---|---|---|
| 2026-10-02 | — | — | — | — | — | — | — | **Scoped audit: page templates.** 33 production pages measured (links, scripts, body landmarks; geometry at 1440×900 in light and dark). Three templates + 4 own-surface variants + 1 one-off; 9 of 22 Tool pages deviate from the canonical skeleton; the starter template is stale. Proposal: a "Templates" group in the live reference (`#templates`, `#template-tool`, `#template-page`, existing `#sign-in`), a generated `design-system/templates.json`, a skeleton lint. Waits on O-6 … O-10. |
| 2026-10-02 | 143 | 1 | 4 | 3 / 6 / 10 (+8 accents) | 10 | 88 | 77 | First run. Strict debt is concentrated: Genesis 27 (known), design-system page 16, home page 13 (keyframe `ms`), FVS 6 (motion). `docs/DESIGN-SYSTEM.md` §1 still describes one typeface and says "Last updated: August 26". |
