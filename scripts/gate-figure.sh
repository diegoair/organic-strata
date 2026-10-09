#!/usr/bin/env bash
# Figure closing gate — the automated half (docs/FIGURE-GATE.md is the whole gate, with the manual pass).
# Runs every check that covers the FVS Figure graph, one after the other, and keeps going when one fails, so a
# single run reports everything. Logs go to a temp dir (printed at the end); nothing in the repo is written.
# Usage: scripts/gate-figure.sh [BASE]   — BASE = the commit the day's work started from (default: 7a358d1, Oct 9, 2026)
cd "$(dirname "$0")/.." || exit 2
BASE="${1:-7a358d1}"
LOGS="$(mktemp -d "${TMPDIR:-/tmp}/figure-gate.XXXXXX")"
fail=0; summary=()

step() {   # step <name> <command…>
  local name="$1"; shift
  local log="$LOGS/$(echo "$name" | tr ' /' '__').log"
  printf '… %s\n' "$name"
  local t0=$SECONDS
  if "$@" >"$log" 2>&1; then summary+=("PASS  $name  ($((SECONDS - t0)) s)")
  else summary+=("FAIL  $name  ($((SECONDS - t0)) s) — $log"); fail=1; fi
}

git rev-parse -q --verify "$BASE^{commit}" >/dev/null || { echo "BASE $BASE is not a commit"; exit 2; }
echo "Figure closing gate — $(git log --oneline "$BASE"..HEAD | wc -l | tr -d ' ') commits since $BASE, HEAD $(git rev-parse --short HEAD)"
[ -n "$(git status --porcelain)" ] && echo "note: the working tree has uncommitted changes — they are tested too"

step "repo checks"                 python3 scripts/check.py
step "design-system diff"          python3 scripts/ds-audit.py --diff "$BASE"
step "figure graph engine"         scripts/test-figure-graph.sh
step "figure evaluation"           scripts/test-figure-eval.sh
step "figure board light"          scripts/test-figure-board.sh --theme light
step "figure board dark"           scripts/test-figure-board.sh --theme dark
step "fvs regression"              scripts/regression.sh
step "fvs qa"                      scripts/test-fvs-qa.sh
step "fvs ui"                      scripts/test-fvs-ui.sh --out "$LOGS/fvs-ui"
step "rhizome (shared node canvas)" scripts/test-rhizome.sh
step "fvs perf"                    scripts/test-fvs-perf.sh

echo; printf '%s\n' "${summary[@]}"; echo
echo "logs: $LOGS"
if [ $fail -eq 0 ]; then echo "AUTOMATED GATE PASSED — now the manual pass in docs/FIGURE-GATE.md §3"
else echo "AUTOMATED GATE FAILED — fix before the manual pass"; fi
exit $fail
