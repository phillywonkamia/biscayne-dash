#!/bin/bash
# BISCAYNE DASH — double-click to play.
cd "$(dirname "$0")"
PORT=8318
lsof -ti tcp:$PORT >/dev/null 2>&1 || (python3 -m http.server $PORT >/dev/null 2>&1 &)
sleep 1
open "http://localhost:$PORT/"
