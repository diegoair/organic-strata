#!/bin/sh
cd "$(dirname "$0")/.." && exec node --experimental-websocket --no-warnings scripts/test-dark-audit.mjs "$@"
