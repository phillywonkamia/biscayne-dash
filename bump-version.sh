#!/bin/bash
# Stamps a fresh version tag on game.js / audio.js / world.glb so phones never mix old and new files. Run before each push.
cd "$(dirname "$0")"
V=$(date +%Y%m%d%H%M)
sed -i '' -E "s/(game\.js\?v=)[0-9]+/\1$V/; s/(BD_VERSION = ')[0-9]+/\1$V/" index.html
sed -i '' -E "s/(audio\.js\?v=)[0-9]+/\1$V/; s/(world\.glb\?v=)[0-9]+/\1$V/" game.js
echo "version $V"
