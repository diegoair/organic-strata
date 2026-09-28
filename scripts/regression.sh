#!/usr/bin/env bash
# Headless FVS regression (needs Chrome + Node >= 20.10). Exits 0 only if every case matches the baseline.
exec node --experimental-websocket --no-warnings "$(dirname "$0")/regression.mjs" "$@"
