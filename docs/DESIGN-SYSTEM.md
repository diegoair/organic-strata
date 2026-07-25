# Organica — Design System

> Studio Rann · Organica · Typography, tokens, and the Figma mapping
> Last updated: July 25, 2026
> Source of truth: `shared/organica-tokens.css`

---

## 1. One typeface

**Manrope**, everywhere. Nothing else.

Manrope is a **variable font** with a single weight axis running 200–800, so
the entire weight range costs one file. Loaded once, from `organica-tokens.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap');
```

### What this replaced

Organica had accumulated four typefaces under four different variable names:

| Was | Where | Problem |
|---|---|---|
| Syne + Syne Mono | hub | a third and fourth family for one page |
| DM Sans + DM Mono | Strata, Living Path | loaded properly, but two more families |
| Georgia (serif) | Genesis pages | a fifth voice, unrelated to the rest |
| `ui-monospace` | Genesis pages | system-dependent — different on every OS |
| `'DM Mono'` **declared but never loaded** | Spore, Pollen, Halide, Komorebi, Genesis Library, Genesis Creator | six pages silently rendered system monospace; the design was never what the CSS claimed |

Four names described the same idea — `--font`, `--sans`, `--mono`, `--display`.
With one family the distinction is meaningless, so **`--font` is now the only
name**. The other three still resolve (as aliases at the bottom of the tokens
file) so old rules keep working, but new code uses `--font`.

---

## 2. Type scale

A **1.2 ratio (minor third)** anchored at **11px** — the size the tool panels
were already built around. Steps are rounded to whole pixels so text lands on
the pixel grid in a dense UI.

| Token | Size | Weight | Tracking | Line height | Used for |
|---|---|---|---|---|---|
| `--fs-micro` | 9px | 500 | 0.12em | 1.2 | hint text, unit labels |
| `--fs-small` | 10px | 500 | 0.08em | 1.2 | buttons, selects, control values |
| `--fs-base` | 11px | 400 | 0.05em | 1.45 | panel body — **the anchor** |
| `--fs-medium` | 12px | 600 | 0.10em | 1.2 | panel section titles |
| `--fs-large` | 14px | 500 | 0.05em | 1.45 | headings inside a tool |
| `--fs-xl` | 17px | 700 | 0 | 1.2 | tool title |
| `--fs-display` | fluid | 800 | −0.03em | 0.88 | hub wordmark only |

`--fs-display` is `clamp(1.5rem, 9vw, 13rem)` — it scales with the viewport and
exists only on the hub. Everything else is fixed, because a tool panel that
reflows with the window is harder to use, not easier.

### Weights

Manrope's axis is 200–800. Organica defines four stops. Anything between them
is *available* but **undefined by the system** — don't reach for it without
adding it here first.

| Token | Value | Used for |
|---|---|---|
| `--w-light` | 300 | long-form body, captions in dense panels |
| `--w-regular` | 400 | default body |
| `--w-medium` | 500 | control labels, table headers, sub-labels |
| `--w-bold` | 700 | section titles, wordmark, emphasis |

### Letter spacing

Organica's UI voice is **uppercase and tracked**. The rule the tools already
followed, now formalised: *the smaller and more uppercase the text, the more
tracking it needs to stay legible.*

| Token | Value | Used for |
|---|---|---|
| `--ls-tight` | −0.02em | display / wordmark — big type needs negative |
| `--ls-normal` | 0 | body copy |
| `--ls-wide` | 0.05em | values, hex fields, readouts |
| `--ls-wider` | 0.08em | buttons, control labels |
| `--ls-widest` | 0.15em | uppercase micro-labels, the tool logo |

### Line height

Unitless, so it scales with the element's own size.

| Token | Value | Used for |
|---|---|---|
| `--lh-tight` | 1.2 | headings, single-line controls |
| `--lh-snug` | 1.45 | multi-line labels in panels |
| `--lh-normal` | 1.7 | body copy, docs, help text |

---

## 3. Porting to Figma

Create these as **text styles** in Figma. Font: **Manrope**, from Google Fonts —
Figma exposes the variable weight axis directly, so pick the numeric weight.

| Figma style name | Font | Size | Weight | Letter spacing | Line height |
|---|---|---|---|---|---|
| `UI/Micro` | Manrope | 9 | 500 | 12% | 120% |
| `UI/Small` | Manrope | 10 | 500 | 8% | 120% |
| `UI/Base` | Manrope | 11 | 400 | 5% | 145% |
| `UI/Section` | Manrope | 12 | 600 | 10% | 120% |
| `UI/Heading` | Manrope | 14 | 500 | 5% | 145% |
| `UI/Title` | Manrope | 17 | 700 | 0% | 120% |
| `Display/Wordmark` | Manrope | 96* | 800 | −3% | 88% |

\* The web wordmark is fluid (`clamp(1.5rem, 9vw, 13rem)`); 96 is a sensible
fixed stand-in for a Figma frame. Adjust per artboard — the *ratio* matters
(0.88 line height, −3% tracking), not the absolute size.

**Figma letter-spacing note:** Figma expresses tracking as a **percentage**,
CSS as **em**. They map 1:1 — `0.08em` = `8%`. Don't enter `0.08` in Figma.

**Figma line-height note:** enter these as **percentages**, not pixels, so the
styles survive a size change.

---

## 4. Spacing & radius

A **4px base grid**. The panel layout was already built on these values; they
are written down now so the next tool doesn't invent its own.

| Token | Value | | Token | Value |
|---|---|---|---|---|
| `--space-1` | 4px | | `--radius-sm` | 2px |
| `--space-2` | 6px | | `--radius-md` | 4px |
| `--space-3` | 8px | | `--radius-lg` | 8px |
| `--space-4` | 10px | | | |
| `--space-5` | 14px | | | |
| `--space-6` | 16px | | | |
| `--space-7` | 24px | | | |
| `--space-8` | 32px | | | |

Organica's surfaces are flat and near-square — **radius is a whisper, not a
feature**. `--radius-lg` (8px) is already the loudest the system gets.

---

## 5. Colour — per-tool accents

Colour is *not* centralised in the tokens file, deliberately: each tool owns a
light/dark palette suited to what it renders (Halide is a darkroom, Komorebi is
a forest floor). What **is** systematic is the **accent per tool**, used on the
hub nav and as the tool's identity colour.

| Tool | Accent | Reading |
|---|---|---|
| Creator | `#5fc9b4` | teal |
| Genesis | `#c8f060` | acid green — organic vitality |
| Strata | `#f06030` | warm ember |
| Spore | `#a0c8f0` | cool blue-grey |
| Pollen | `#e8c84a` | pollen yellow |
| Living Path | `#b48cf0` | vital violet |
| Halide | `#7a9cb8` | darkroom steel-blue |
| Komorebi | `#8aa054` | dappled forest-green |

The palette spans green → yellow → orange → blue → violet → teal. When adding a
tool, pick a hue that isn't already taken and note it here.

---

## 6. Rules

1. **One family.** If a design needs a second typeface, that is a system-level
   decision — change it here, not in a tool.
2. **Use the tokens.** A hardcoded `font-size: 13px` in a tool is a bug; either
   use a step or add one.
3. **`--font` only** in new code. `--sans` / `--mono` / `--display` are legacy
   aliases kept so old rules render; they all resolve to Manrope.
4. **Load order matters.** `organica-tokens.css` must come *before* the tool's
   own `<style>`, so a tool can override a token without `!important`.
5. **Weights are the four defined stops.** 200, 600 and 800 exist in the font
   but aren't in the system — add them here before using them.

---

*Studio Rann · Organica System v0.1 · July 25, 2026*
