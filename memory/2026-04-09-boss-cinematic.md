# Boss Cinematic Universal Implementation

## Task
Add boss cinematic intro for The Prism (#17) - make the Skull Boss cinematic universal for ALL boss battles.

## What Was Found
The Skull Boss cinematic at level 5 had a 3-second cinematic during BOSS_ALERT state that:
- Moves the sun downward
- Fades skydome opacity to 20%
- Shifts floor grid/base/fog colors to dark red
- Shifts skydome gradient to dark reds
- Changes sun glow materials to red

However, this cinematic was hardcoded to only run for `game.level === 5`.

## Changes Made (main.js)
Made the boss cinematic universal for all boss levels (5, 10, 15, 20):

1. **Line 9487**: Changed condition from `game.level === 5` to `game._levelConfig && game._levelConfig.isBoss`
2. **Line 9542**: Same change for the cinematic update loop
3. **Line 9617**: Same change for the cinematic cleanup
4. Renamed all `_skullCinematic*` variables to `_bossCinematic*` for clarity
5. Updated log messages to reflect universal boss cinematic with dynamic level number

## Biomes Affected
- Level 5: Synthwave Valley (Skull Boss) - already had cinematic
- Level 10: Desert Night (Prism Boss) - NOW has cinematic
- Level 15: Alien Planet (Minotaur Boss) - NOW has cinematic
- Level 20: Final Boss - NOW has cinematic

## Verification
- `node -c main.js` - syntax check passed

## How It Works
The cinematic works universally because:
1. It uses generic color lerping (not biome-specific)
2. It finds the sun group and sky material dynamically via `biomeSceneGroup.traverse()`
3. It handles missing elements gracefully (e.g., moonGlowColor only applies to desert biome)
4. All visual elements are animated to red/scary colors regardless of the starting biome theme
