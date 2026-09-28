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
- FVS (or `shared/shapes.js`, `palette.js`, `print-size*.js`, `plate-export.js`) changed → the regression suite
  runs **automatically** in the pre-commit hook (headless Chrome, ~4 s). Run it by hand any time with
  `scripts/regression.sh`. An intended change re-records `fvs/_regression-baseline.json` in the same commit
  (open `fvs/_test-regression.html` in the browser → Run → "Show JSON to record").

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

When FVS or a shared module it uses is staged, the hook also runs `scripts/regression.sh` (headless Chrome via
the DevTools protocol; names the changed cases on failure) and blocks the commit if any case differs.
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

## CI (GitHub Actions)
- `.github/workflows/ci.yml` — every push/PR: `scripts/check.py` + the FVS regression. Catches a bypassed hook
  (`--no-verify`) or a push from another machine.
- `.github/workflows/deploy-verify.yml` — when Vercel reports a **Production** deployment `success`, runs
  `scripts/smoke.py` against the live site. A red ✗ on the commit means the deploy is broken.
  *(Both are validated as YAML but only run once pushed to GitHub — check the Actions tab after the first push.)*

## Not automated (yet)
- Regression suites for tools other than FVS (Loom, Rhizome, shared modules) — deliberately deferred.
- Safari/Firefox pass — see the cross-browser backlog in `CLAUDE.md`; needs real browsers.
- Automatic rollback on a failed deploy (do it by hand: Vercel MCP `request_rollback`).
