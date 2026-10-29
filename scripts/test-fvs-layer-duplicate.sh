#!/bin/sh
cd "$(dirname "$0")/.." && exec node --experimental-websocket --no-warnings scripts/test-fvs-layer-duplicate.mjs "$@"
