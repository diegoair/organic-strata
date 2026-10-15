# Release workflow

Local first, preview second, production last. Nothing reaches `main` without an explicit
**"commit in prod" / "porta in prod"** from Diego.

```
 local dev ──► local commit ──► staging push ──► preview check ──► "porta in prod" ──► main ──► deploy check
 (test here)   (checks run)     (Vercel preview)  (smoke test)     (merge + push)              (READY + smoke)
```

## 1. Build and test locally
- Serve the repo on a no-store dev server; exercise the change in the browser pane.
- Check the console is clean and that preview and exports (PNG/SVG) match.
- Flexible Visual System (or `shared/shapes.js`, `palette.js`, `print-size*.js`, `plate-export.js`) changed → the regression suite
  runs **automatically** in the pre-commit hook (headless Chrome, ~4 s). Run it by hand any time with
  `scripts/regression.sh`. An intended change re-records `fvs/_regression-baseline.json` in the same commit
  (`scripts/regression.sh --record`, then review the `git diff`).
- Flexible Visual System also has `scripts/test-fvs-qa.sh` (~1 min: boot health, every view in light + dark, export
  parity against `fvs/_qa-baseline.json`, the `/fvs/` files and the lazy Figure tier) and `scripts/test-fvs-ui.sh`
  (~25 min: real mouse journeys). Its code is ES modules in `fvs/js/` — see docs/FVS.md §11 before adding any.
- **Every FVS headless suite at once:** `scripts/test-fvs.sh` (~3.5 min on this Mac; was ~17 min one after another) —
  regression, QA, UI (journeys + the 120 variants in 4 shards + design), step boards (clean / held / extra), Figure
  board (clean / held), Figure graph + eval, element units, Component generate transitions (`generate`: every rule
  generated after Exhaustive / another rule = the same rule on a fresh page — Components, drawings, selection, nothing left
  behind; `scripts/test-fvs-generate.sh`), Rhizome, the rule atlas (`atlas`: `design-system/_fvs-rules.html`
  still equals the engine — re-capture with `scripts/capture-fvs-atlas.mjs`), each its own server + Chrome, 6 at a time. One line
  per job with its time; the full output of a failed job. `--only boards,regression` (jobs or groups, `--list`),
  `--jobs N`, `--verbose`. The board tests wait for the page to settle (`QUIET_INIT` in `scripts/lib/chrome-page.mjs`:
  two frames and no short timer pending, reduced motion on) instead of fixed sleeps. Perf stays separate (timing).
- FVS speed: `scripts/test-fvs-perf.sh` (~2–3 min; `--quick` ~30 s) — real clicks on the save circle, click → painted
  frame: up to 12 saves in a row (circle, grid 1 — 10 since Oct 14), every cell shape × grid shape × size on a ~300-Component library, and a
  traced hover sweep per cell shape at 2× density (GPU / paint work). Fails on a save over 500 ms or a save not stored.
  Before/after: `git worktree add /tmp/old <commit>` then `--root /tmp/old`; try a CSS change with `--css '…'`.

## 2. Local commit (always local first)
When a release is ready to test, leave it as a **local commit**. Never push at this stage.

```bash
scripts/install-hooks.sh     # once per clone: enables the pre-commit hook + commit template
scripts/check.sh             # what the hook runs on every commit
```

`scripts/check.py` fails the commit on:
- **`vercel.json`** — invalid JSON, any key outside the Vercel schema (a stray `_comment_*` fails every deploy
  silently), or a rewrite pointing at a missing folder
- any tracked `.json` that does not parse
- a JS syntax error in any inline `<script>` or tracked `.js` (`js/` folders are checked as ES modules)
- a `/shared/…` or `/genesis/…` reference to a file that does not exist
- `scripts/css-lint.py` findings

When Flexible Visual System, Rhizome, the node canvas or a shared module they use is staged, the hook also runs the headless
suites those paths need — regression, Rhizome, Figure board, step boards, the rule atlas — in one `scripts/test-fvs.sh --only …` call, side by
side, and blocks the commit if one fails (its output is printed).
Emergency bypass: `git commit --no-verify`.

Fill in the release checklist from `.gitmessage` in the commit body (changed / affects / checks /
regression / manual verify / console).

Keep commits small and focused — one feature per commit — and keep the working tree clean
between them, so anything ready can be pushed without dragging unrelated changes along.

## 3. Preview gate (staging)
Local tests can't catch Vercel-specific failures (config validation, rewrites, headers, case-sensitive
paths). Before production, push to `staging`; Vercel builds a preview URL.

```bash
git push origin main:staging          # or your branch → staging
python3 scripts/smoke.py https://<preview-url>
```

Vercel builds a preview for **every** pushed branch automatically. Previews sit behind Vercel Authentication
(verified 2026-09-28: they 302 to `vercel.com/sso`), and the smoke test reports that as `PROTECTED` rather than
a false pass. To smoke-test a preview from the terminal, create a *Protection Bypass for Automation* secret
(Project → Settings → Deployment Protection) and `export VERCEL_PROTECTION_BYPASS=<secret>`; otherwise fetch pages
through the Vercel MCP (`web_fetch_vercel_url`).

## 4. Production
Only on **"commit in prod" / "porta in prod"**: `git push origin main`.

## 5. Deploy check (after every prod push)
A successful `git push` does **not** mean the deploy succeeded.

1. Vercel MCP: `list_deployments` → the newest production deployment must be **READY**
   (on ERROR, `get_deployment_build_logs`; empty logs usually means config validation — re-run `check.py`).
2. Smoke test production (also runs by itself in CI, see below):
   ```bash
   python3 scripts/smoke.py
   ```
   Every tool page + key shared assets must return 200 **with the right content type and real content**.
3. Open the tool that changed and confirm the console is clean.

If prod is broken: `request_rollback` (Vercel MCP) to the previous READY deployment first, diagnose second.

## End of the working day
1. Add the day to the **Organica test log** artifact (https://claude.ai/artifact/FsEoGMwKmWeKinrXfUhvyh): one row per commit, each with a concrete "try this" and a link, written to its database (`commits/<sha>` + `days/<date>`), so Diego ticks each one while testing and writes a note where something fails. The page is not republished for a new day.
2. Figure work that day: `scripts/gate-figure.sh <base>` (automated half) and the day's manual checklist in `docs/FIGURE-GATE.md` §3.
3. Next session, first thing: read the notes left in the log — each is a bug to fix or a question for the ledger.

## CI (GitHub Actions)
- `.github/workflows/ci.yml` — every push/PR: `scripts/check.py` + the Flexible Visual System regression. Catches a bypassed hook
  (`--no-verify`) or a push from another machine.
- `.github/workflows/deploy-verify.yml` — when Vercel reports a **Production** deployment `success`, runs
  `scripts/smoke.py` against the live site. A red ✗ on the commit means the deploy is broken.
  *(Verified 2026-09-28: `ci.yml` green on Linux; `deploy-verify.yml` fires on every deployment and correctly skips previews. Its Production path is confirmed on the first real prod push.)*

## Not automated (yet)
- Regression suites for tools other than Flexible Visual System (Loom, Rhizome, shared modules) — deliberately deferred.
- Safari/Firefox pass — see the cross-browser backlog in `CLAUDE.md`; needs real browsers.
- Automatic rollback on a failed deploy (do it by hand: Vercel MCP `request_rollback`).
