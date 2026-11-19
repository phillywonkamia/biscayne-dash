# BISCAYNE DASH: the 5-minute demo

1. **Show the Blender side.** Double-click `assets/world.blend` to open it in Blender.
   Every car, palm, building and coin was built by `build_world.py` (a script, not by hand).
2. **Play it.** Double-click `PLAY.command`, then press SPACE.
   ← → lanes · hold SPACE = nitro · **B = blueprint** (the raw Blender models as wireframe) · C = camera
3. **The magic trick: remix it live.**
   Open `build_world.py`, change the car color on the line that starts with `PINK` (and ends with `(1.0, 0.08, 0.45)`),
   for example to `(0.1, 0.9, 1.0)` for cyan,
   then double-click `REBUILD-IN-BLENDER.command` and refresh the game (Cmd+R). New car, same game.
   Same trick for building heights, palm count, neon colors.

How it works: Blender = the art factory (models, materials) → exports `world.glb`
→ Three.js (`game.js`) = the engine (controls, traffic, cops, score). Same pipeline as Run the Block.
