#!/bin/sh
cd "$(dirname "$0")/.." && exec node --experimental-websocket --no-warnings scripts/test-fvs-figure-symbols.mjs "$@"
