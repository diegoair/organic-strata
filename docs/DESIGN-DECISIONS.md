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

*Diego, Oct 2, 2026: O-1 … O-5 noted, to be decided later — do not act on the recommendations until he answers.*

| # | Opened | Question | Options · recommendation | Evidence |
|---|---|---|---|---|
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

Drift that needs no decision — only doing. The agent adds to it in REVIEW / AUDIT / CONSULT and
strikes an item in DOCUMENT.

| Found | What | Where |
|---|---|---|
| 2026-10-02 | `docs/DESIGN-SYSTEM.md` §1 and §3 still describe one typeface (Wix Madefor / Manrope) and a Light weight; the header says "Last updated: August 26, 2026". The two-typeface rule is only in the appendix at the end. | `docs/DESIGN-SYSTEM.md:1-52`, `:136-142` |
| 2026-10-02 | §5 accent table misses Apostate, Pulsar, Radial, Rhizome, Sinew, Trellis (and Murmur has no row of its own). Values for Halide / Spore / Pollen / Genesis wait on O-3. | `docs/DESIGN-SYSTEM.md` §5 |
| 2026-10-02 | The floatbar example in the live reference uses inline SVGs with stroke attributes and types "Export ▾" as a glyph — it predates the icon registry, so it cannot be copied from. Its "Used in" list omits Mote, Dapple, Undertow, Murmur, Trellis. | `design-system/index.html` `#floatbar` |
| 2026-10-02 | `#behaviours` says the thumbnail picker has no Esc; it has. | `design-system/index.html` `#behaviours`, `shared/select-picker.js` |
| 2026-10-02 | `.org-out`, `.org-panel`, `.org-theme` exist in the shared sheets with no mention in the live reference. | `ds-audit.py` |
| 2026-10-02 | A stacked "choice list with a current item" inside a popover now has two instances (Rhizome's add-node menu, Mote's camera list when built). Propose promotion at the third (`docs/CSS-RULES.md` (d)). | `rhizome/index.html` `#add-node-menu .org-formats` |

## 5. Audit log

One line per full audit (`python3 scripts/ds-audit.py`), so the next one can say what moved.

| Date | Tokens | Undocumented | Unused | tokens.json gone / differ / missing | Accents not in doc | Raw values — strict | to judge | Note |
|---|---|---|---|---|---|---|---|---|
| 2026-10-02 | 143 | 1 | 4 | 3 / 6 / 10 (+8 accents) | 10 | 88 | 77 | First run. Strict debt is concentrated: Genesis 27 (known), design-system page 16, home page 13 (keyframe `ms`), FVS 6 (motion). `docs/DESIGN-SYSTEM.md` §1 still describes one typeface and says "Last updated: August 26". |
