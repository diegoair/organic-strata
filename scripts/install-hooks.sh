#!/usr/bin/env bash
# One-time per clone: point git at the tracked hooks and commit template.
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
git config commit.template .gitmessage
chmod +x .githooks/pre-commit scripts/check.sh
echo "Hooks enabled (core.hooksPath=.githooks, commit.template=.gitmessage)."
