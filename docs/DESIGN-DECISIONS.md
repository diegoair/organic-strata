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

*Diego, Oct 2, 2026: O-1 … O-5 noted, to be decided later — do not act on the recommendations until he answers. (O-6 … O-10, the templates, were answered the same day — "sì a tutte e cinque" — and are in §2.)*

| # | Opened | Question | Options · recommendation | Evidence |
|---|---|---|---|---|
| O-11 | 2026-10-02 | **Header actions: should the skeleton lint require zero buttons in the header?** Colornet is done (Diego, Oct 2: Open → a floatbar icon, Batch → a section of the Export popover). What remains is **Mote's Fullscreen**: move it to the floatbar too, or keep it as the one written exception? | **Keep Mote's as a written exception, then make the lint require zero elsewhere** (recommended — Fullscreen is a view mode of the whole page, not an action on the canvas) · or move it to the floatbar as an icon · or leave header actions allowed | `design-system/templates.json` `headerActions`: Mote 1, the other 25 tools 0 |
| O-1 | 2026-10-02 | **`--hit-min: 24px`** was added in the audit's long tail as a new token "to confirm". Keep it? | **Keep** (recommended — it is used by Loom, Rhizome, the glyph editor and Mycel, and has a `/design-system/#hit-areas` entry) · or replace with `--space-7` (same 24px, but a spacing step, not a role) | `shared/tokens.css:357`; `docs/DESIGN-SYSTEM.md` never names it |
| O-2 | 2026-10-02 | **`shared/tokens.json` calls itself the single source of truth and is stale.** What is it? | **A mirror of `tokens.css` for Figma** (recommended — the live reference already says `tokens.css` is first; then bring the JSON in line once and let `ds-audit.py` keep it there) · or the real source, and `tokens.css` is regenerated from it (a build step the project does not have) | `ds-audit.py`: says Manrope / `weight.light 300` / `size.display`; `lineHeight.tight` 1.2 vs 1.15; 10 scale tokens and 8 tool accents missing; 4 accents differ from what the pages run |
| O-3 | 2026-10-02 | **Four tool accents differ between the docs and the pages** (Halide and Spore both run `#5a7a96`; Pollen `#c8a83a`; Genesis `#6a9c2e`). Which side is right? | **The pages** (recommended — they are what users see; then the doc table and the JSON follow) · or the doc values, and the pages change. Separately: Halide and Spore share one accent — intended? | `docs/DESIGN-SYSTEM.md` §5 lists `#7a9cb8`, `#a0c8f0`, `#e8c84a`, `#c8f060` |
| O-5 | 2026-10-02 | **Should `ds-audit.py --diff` run in the pre-commit hook and block the commit?** | **Yes, blocking on the strict categories only** (recommended once it has run clean on a few real commits — no new raw value can slip through) · or keep it a rule in `CLAUDE.md` only (today; nothing enforces it, but a false positive can never stop a commit) | `.githooks/pre-commit` runs `scripts/check.py` only; `--diff` tested with one injected regression |
| O-4 | 2026-10-02 | **Four tokens have no consumer**: `--dur-reveal`, `--dur-stagger`, `--ease-in-out`, `--t-display-lh`. | **Keep the three motion tokens** (recommended — one day old, the remaining raw `ms` in the home page / FVS keyframes are their intended consumers) and decide `--t-display-lh` · or retire all four | `ds-audit.py` "Tokens with no consumer" |

## 2. Decisions

Newest first. One line each; the reason and the place it is enforced are what make it stick.

| Date | Decision | Reason | Enforced by |
|---|---|---|---|
| 2026-10-02 | **One shared footer**: `.org-page__foot` — “© Organica” + Privacy · Terms · Design System, the same three links wherever a page has a footer (optional on a Page), the current one `aria-current="page"`. Used on privacy, terms, the 404 and the hub. Tools have no footer. `.org-page__card` promoted with it (privacy, terms, 404). | Three local copies (`.hub-foot`, two `.doc__foot`) with two different link sets; the 404 was the third consumer of both parts (`docs/CSS-RULES.md` (d)). | `shared/page.css`; `/design-system/#template-page` (live demo + self-check assertions) |
| 2026-10-02 | **A 404 page** on the Page template (`/404.html`, public, card + footer). No pages for other status codes. | A wrong link showed the host's unstyled 404. The suite is static files: 404 is the only error a visitor can reach. | `scripts/templates.py` lints it; the host serves `/404.html` for unmatched addresses |
| 2026-10-02 | **O-10 — a skeleton lint per template, blocking**, and the starter is linted with the same rules. Sheet order is `tokens → icons → header → page → prose → auth-card → panel → floatbar → shell → palette → seeds-panel → mobile-gate`. | Nothing linted `shared/_template.html` and a tool copied from it failed css-lint; the order list had no `icons`. | `python3 scripts/templates.py --check`, run by `scripts/check.py` ("page templates"); `ORDER` in `scripts/templates.py` and `scripts/css-lint.py` (kept identical by hand) |
| 2026-10-02 | **O-9 — Mycel and TuneSutra use the shared canvas region**: `#stage-wrap` carries `.org-canvas-wrap`; only the real deltas stay local (Mycel: no padding; TuneSutra: scrolls, top-aligned). | Two local copies of a region `shell.css` already owns. | `mycel/index.html`, `tunesutra/index.html`; the inventory shows the surface of every tool (`design-system/templates.json`) |
| 2026-10-02 | **O-8 — the panel is paper in every tool.** Membrane's and Vortex's grey `#panel` override and their stale `#app { height: calc(100vh - var(--header-h, 40px)) }` are removed. | 2 pages against 23; the fallback named a header height that has not existed since Sep 29. | `shared/panel.css` (no local override left); css-lint `shadow` |
| 2026-10-02 | **O-7 — one shared page column**: `shared/page.css` — `body.org-page` (+ `--paper`), `.org-page__col` (660) + `--wide` (1040) + `--full` (1500); the widths are the component's own `--page-col-w`, not global tokens. Privacy, terms, admin and gallery migrated. A page never links `shell.css`. | Four local copies, four body rules; privacy and terms linked `shell.css` and could not scroll. the card and the footer were promoted the same day (see the footer row above).md` (d)). | `scripts/templates.py` rules `sheets`, `page-body`, `page-col`; `/design-system/#template-page` |
| 2026-10-02 | **O-6 — three page templates: Tool · Page · Auth card.** Own-surface tools (Apostate, FVS, Rhizome, Genesis) are a variant of Tool; the hub and the design-system page are "own layout" variants of Page. No fourth template. The page list is generated, never typed. | The four own-surface tools share no skeleton with each other and measure the same as Tool (panel 248, floatbar 16px from the bottom). | `scripts/templates.py` → `design-system/templates.json` → `/design-system/#templates`, `#template-tool`, `#template-page`, `#sign-in`; `check.py` fails when the JSON is out of date |
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
(`scripts/css-lint.py`: `ALLOW_SHADOW`, `ALLOW_RADIUS`, `ALLOW_HEX`, `KNOWN_DEBT`; `scripts/templates.py`:
`OWN_SURFACE`, `OWN_LAYOUT`, `ALLOW`) are the executable half of this list — an exception lives there **and** here, or it is not one.

| What | Where | Why it is allowed |
|---|---|---|
| Content colours typed as hex | every tool's ink / paper / point / grid colour (e.g. Loom's guide blue, Halide's ink and paper) | User data, not chrome (`CLAUDE.md` Critical Rules) |
| Stadium radii off the 2/4/8 scale | switch track, scrollbar thumbs, Camo Turing's toggle | Half the element's height is a capsule, not a corner |
| Canvas text and colour drawn in the artwork | Loom cell labels, TuneSutra bar labels | Output, not UI (`docs/CSS-RULES.md` (c)) |
| Genesis's local panel implementation and skeleton | `genesis/index.html`; `ALLOW` in `scripts/templates.py` (rules `app`, `floatbar-child`, `panel-last`, `tail-scripts`) | Retiring — left alone by decision (Sep 2026, confirmed Oct 2, 2026) |
| The floatbar pill animates `width` | `shared/floatbar.css` | Measured 60 fps (233 frames, max 17.7 ms); `scaleX` would squash its ends |
| Raw `1ms` durations | reduced-motion blocks | The collapse value itself |
| `.hud-btn` raw hex `#f5f2ec` | `shared/shell.css` | A dark HUD pill over the canvas, identical in both themes |
| `explorations/*` and the `_`-prefixed dev pages | `explorations/`, `design-system/_*.html`, `*/_test-*.html` | Development pages; not held to the tool contract, skipped by `scripts/templates.py` (`SKIP`). The test gallery is on the Page template since Oct 2, 2026 — a development page in content, no longer an exception in skeleton |
| Own-surface tools — tool chrome (header, floatbar, `#panel`, mobile gate) without `shell.css` | Apostate, Flexible Visual System, Rhizome, Genesis — `OWN_SURFACE` in `scripts/templates.py`, each with its reason | A variant of the Tool template, not a fourth one (O-6). The lint still holds them to every Tool rule except linking `shell.css` |
| Apostate's three-column board | `apostate/index.html` (character picker · glyph · panel) | typoclast's own layout, kept by the "start from zero" decision; recorded as an exception under O-9 either way |
| Own-layout pages — page chrome without the `page.css` column | the hub (`index.html`: stipple hero, gallery, full-bleed sections) and `/design-system/` (a 232px section nav beside the content) — `OWN_LAYOUT` in `scripts/templates.py` | Variants of the Page template (O-6) |
| Rhizome loads every shared script in `<head>` | `rhizome/index.html`; `ALLOW[('rhizome', 'tail-scripts')]` | Native ES modules: the shared scripts must exist before the module graph runs |
| Pages without a mobile gate | privacy, terms, admin, sign-in, design-system (the gallery and the hub opt in) | A phone visitor must be able to read a policy or sign in (`docs/CSS-RULES.md` (a)); the gate is required by the Tool template only, opt-in on a page |

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
| 2026-10-02 | Small skeleton drift, still true: Camo Turing links `/genesis/animations.css`; Living Path loads opentype.js from a CDN (Apostate uses the vendored copy); Colornet has two header action buttons (Mote has one, Fullscreen — documented); `CLAUDE.md` names `shared/canvas-preset-grid.css`, which does not exist. *(Done Oct 2: Spore's duplicate `id`, Camo Turing's raw `#panel` width, Apostate's gate first in body.)* | `camo-turing/index.html:21`, `livingpath/index.html:8`, `colornet/index.html`, `CLAUDE.md` Repo Structure |
| 2026-10-02 | `#file-architecture` closes with "a tool's own `<style>` comes after all **five**" — the table above it has twelve rows. | `design-system/index.html` `#file-architecture` |
| 2026-10-02 | `CLAUDE.md` names `shared/canvas-preset-grid.js/.css` (Repo Structure, Loom's Canvas panel); neither file is in the repo or its history — to clear up with Diego. | `CLAUDE.md` |
| 2026-10-02 | `docs/SHARED-COMPONENTS.md` §3 "App shell" row still counts "14 tools link it" (a dated done-row; the live count is generated). | `docs/SHARED-COMPONENTS.md:153` |
| 2026-10-02 | A stacked "choice list with a current item" inside a popover now has two instances (Rhizome's add-node menu, Mote's camera list when built). Propose promotion at the third (`docs/CSS-RULES.md` (d)). | `rhizome/index.html` `#add-node-menu .org-formats` |
| 2026-10-02 | **`/admin/` column is now a fixed 1040px**; before the migration to `page.css` it shrank to its content (the flex-column body disabled stretch). Measured with empty tables: 580 → 1040 wide. It is what the declared max-width always meant, but it was never seen with real rows — Diego to look once after deploy. | `admin/index.html` |
| 2026-10-02 | `scripts/templates.py`: `ORDER` is duplicated in `scripts/css-lint.py` (held together by a comment); pages not named `index.html` are never linted; the `export-in-header` rule reads only `id` / `aria-label`. | `scripts/templates.py`, `scripts/css-lint.py:198` |
| 2026-10-02 | `#shell` / `#panel-shell` "Used in" now show paths (`/halide/`) where every other entry shows tool names. Membrane's `.org-panel__readout` is paper on a paper panel since O-8 (border only). | `design-system/index.html`, `membrane/index.html:52` |
| 2026-10-02 | `.org-popover__hint` (and the panel's hint under `.row-btns`) sits flush against the buttons above it — the first line of text touches the button border. Seen in Colornet's Export popover and Preset section; the rule is shared, so every tool has it. | `shared/header.css` `.org-popover__hint`, `shared/panel.css` |

## 5. Audit log

One line per full audit (`python3 scripts/ds-audit.py`), so the next one can say what moved.

| Date | Tokens | Undocumented | Unused | tokens.json gone / differ / missing | Accents not in doc | Raw values — strict | to judge | Note |
|---|---|---|---|---|---|---|---|---|
| 2026-10-02 | 143 | 1 | 4 | 3 / 6 / 10 (+8 accents) | 10 | 87 | 77 | **After the templates change (O-6 … O-10 decided and shipped, uncommitted at the time of writing).** `templates.py --check`: 26 tool · 6 page · 1 auth-card pages match their template, starter linted, JSON current. Strict debt 88 → 87. Also since the first run: `Organica.modal` treats a `.org-modal` as open only when it is a real overlay (`position: fixed`) — an inline specimen no longer makes the page inert (`shared/core.js`, commit b10e2e7). Registry numbers unchanged: O-1 … O-5 still parked. |
| 2026-10-02 | — | — | — | — | — | — | — | **Scoped audit: page templates.** 33 production pages measured (links, scripts, body landmarks; geometry at 1440×900 in light and dark). Three templates + 4 own-surface variants + 1 one-off; 9 of 22 Tool pages deviate from the canonical skeleton; the starter template is stale. Proposal: a "Templates" group in the live reference (`#templates`, `#template-tool`, `#template-page`, existing `#sign-in`), a generated `design-system/templates.json`, a skeleton lint. Waits on O-6 … O-10. |
| 2026-10-02 | 143 | 1 | 4 | 3 / 6 / 10 (+8 accents) | 10 | 88 | 77 | First run. Strict debt is concentrated: Genesis 27 (known), design-system page 16, home page 13 (keyframe `ms`), FVS 6 (motion). `docs/DESIGN-SYSTEM.md` §1 still describes one typeface and says "Last updated: August 26". |
