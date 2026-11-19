# BISCAYNE DASH

Play: https://phillywonkamia.github.io/biscayne-dash/  (phone or computer)
Local: double-click `PLAY.command`

## How it plays
- Weave through traffic. Cars can never fully box you in (fair-play rule).
- Green rings = coins → nitro + garage money.
- CLOSE CALLS: be in a car's lane, swerve out at the last second → points + nitro, chain them for x2…x5.
  Two cars passing on both sides at once = THREADED THE NEEDLE.
- The route (one mile each, heading north): Biscayne → Brickell → Ocean Drive → MacArthur Causeway → Overtown → Wynwood → Little Haiti → Liberty City → Miami Gardens (runs forever).
- Every mile or so the cops roll a ROADBLOCK across two lanes: find the open lane (coins in the gap).
- GARAGE (title screen): spend coins on paint, underglow, rims.
- Top 10 + career stats are saved on each device.

Keys: ← → / A D lanes · SPACE nitro · G garage · M sound · B blueprint (raw Blender models) · C camera
Phone: tap left/right · hold NITRO · ♪ = sound (flip the silent switch off on iPhone)

## The Blender demo
1. Open `assets/world.blend`: every car, palm, tower, deco building, lamp and coin
   was built by `build_world.py` (a script, not by hand).
2. Change the car color on the `PINK` line in `build_world.py`, double-click
   `REBUILD-IN-BLENDER.command`, refresh the game: new FACTORY paint.

Pipeline: Blender (models) → `assets/world.glb` → Three.js (`game.js` rules, `audio.js` all sound, made in code).
