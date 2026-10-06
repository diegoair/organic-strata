# FVS split — QA report (branch `fvs-split`, Oct 6, 2026)

Branch-only report; delete it when the branch is merged. Test URL (behind Vercel login + the Organica sign-in):
**https://organic-strata-git-fvs-split-studiorann.vercel.app/fvs/**

Each stage was compared with untouched `main` (`2fcbd69`).

## Gates, per stage

| Gate | Stage 0 `8c0e1ef` | A `618f4f1` | B `430f82b` + `ebd64fe` | C `ded16ea` → final `efed8fc` |
|---|---|---|---|---|
| `check.py` | pass | pass | pass (+ new "fvs engine" guard) | pass (+ new route-pattern guard) |
| `templates.py --check` | pass | pass | pass (`modules: true`) | pass |
| `regression.sh`, unchanged baseline | 396/396 | 396/396 | 396/396 | 396/396 |
| `test-fvs-qa.sh` (new) | baseline recorded, then pass | pass | pass | pass, with Figure loaded on demand |
| `ds-audit` FVS raw values | 7 | 7 (moved to `fvs.css`) | 7 | 7 |
| UI suite J1–J4 (20 tests) | same as main | — | same as main | same as main |
| UI suite D.1–D.9 | — | — | — | 9/9, same as main |

**What `test-fvs-qa` checks:**
- boot health, with 0 exceptions, console errors or same-origin HTTP errors;
- the real Figure tab click;
- the 4 tiers plus the rail, Library view, Suggest dock, Figure gallery and Export popover, in light and in dark;
- 15 export hashes on fixed Figure recipes, against `fvs/_qa-baseline.json`, which was recorded from the untouched code;
- every `/fvs/` script returns 200 with a `javascript` content type;
- Figure is not fetched at boot and is fetched once the tab opens.

**UI suite (`scripts/test-fvs-ui.sh`):**
- 4 failures exist on main already: J1.1, J1.2, J1.3 and J4.1, all rail tests that are out of date. The branch produces exactly the same 4.
- The variants group (V) times out at 25 minutes on main and on the branch alike.

**Design-system REVIEW:** PASS WITH NOTES. No visible string changed, no new raw value, nothing new. Notes:
- The stale head comment has been fixed.
- Open question O-27, the own-sheet convention, needs Diego's answer.

**Preview:**
- The first push failed at Vercel with `invalid-route-source-pattern`. The cause was a nested group in a new `vercel.json` header source. It has been fixed, and `check.py` now catches that case.
- Fetched with Vercel auth from `efed8fc`: `/fvs/js/main.js`, `/fvs/js/figure.js` and `/fvs/fvs.css` all return 200 with the right content type and `cache-control: public, max-age=300, stale-while-revalidate=86400`.

## Sizes

| | Before | After |
|---|---|---|
| Files | 1 (`fvs/index.html`) | 41 (index, css, 21 UI/infra modules, 16 engine, figure/lazy) |
| `fvs/index.html` | 903 KB | 120 KB |
| Boot transfer (gzip -9, sum per file) | 258 KB | 265 KB |
| Figure tier | in the page | 31 KB gz, loaded on demand |
| Re-download after an edit to one area | 258 KB | the one file, 3–16 KB gz |

The decoded `/fvs/` code is 937 KB in total, up from 882 KB. The extra 55 KB is the import lists and file headers.

## What is not done

The engine/UI split is mechanical. 371 statements (171 KB) contain no DOM UI and moved to `fvs/js/engine/`.

What still reads the Element, the grid or the appearance from the panel controls stays UI:
- `getPanelSeed`, `getGrid`, `getElementAppearance`, and everything that reaches them;
- that includes the `SEED_TYPES` chain, `buildComponentSVG`, `buildSymbol*` and the Suggest weights.

The plan said "pass `state` in as an argument". `state` became the engine's model instead, and the panel → `state` move is the next refactor. Details are in `docs/FVS.md` §11.

## Before the merge

1. Run `scripts/fvs-resync.sh` if FVS changed on main. From `2fcbd69` it reproduces this branch byte for byte.
2. Delete `scripts/fvs-split.mjs`, `fvs-modules.mjs`, `fvs-engine.mjs`, `fvs-resync.sh` and this report.
3. Run a manual signed-in pass on the preview.
