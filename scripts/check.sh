#!/usr/bin/env bash
# Pre-release checks. Usage: scripts/check.sh
exec python3 "$(dirname "$0")/check.py" "$@"
