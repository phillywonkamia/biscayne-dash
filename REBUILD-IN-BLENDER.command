#!/bin/bash
# Re-runs the Blender script: rebuilds every model + exports world.glb. Refresh the game after.
cd "$(dirname "$0")"
echo "Blender is building the world..."
blender -b --python build_world.py 2>&1 | grep -E "BISCAYNE|Error|Traceback"
open assets/blender_preview.png
echo "Done. Refresh the game tab (Cmd+R)."
