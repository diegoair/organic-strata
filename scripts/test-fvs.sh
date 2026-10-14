#!/bin/sh
cd "$(dirname "$0")/.." && exec node scripts/test-fvs.mjs "$@"
