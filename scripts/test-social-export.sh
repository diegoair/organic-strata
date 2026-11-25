#!/bin/sh
cd "$(dirname "$0")/.." && exec node --experimental-websocket --no-warnings scripts/test-social-export.mjs "$@"
