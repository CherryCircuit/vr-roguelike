# Synthwave Biome Sun Brightness Fix

## Problem
The sun in the Synthwave Valley biome was too dim and appeared to darken the area it should illuminate.

## Root Cause
The sun's glow texture had very low opacity values (0.34 alpha) and the outer gradient was completely transparent (0.0 alpha). Additionally, the glow sprite wasn't using additive blending, which is necessary for light emission effects.

## Solution
Modified `/home/graeme/.openclaw/workspace-codey/vr-roguelike/main.js` in the `buildSynthwaveValleyScene()` function (around line 7734):

### Changes Made:

1. **Sun Glow Texture Brightness**
   - Inner color: `rgba(255,190,235,0.34)` → `rgba(255,230,245,0.95)` (3x brighter, nearly opaque)
   - Outer color: `rgba(255,102,204,0.0)` → `rgba(255,150,220,0.5)` (now visible instead of transparent)

2. **Sun Core Texture Brightness**
   - Outer color: `rgba(255,196,232,0.84)` → `rgba(255,220,240,0.98)` (brighter pink-white)

3. **Sun Glow Sprite**
   - Color: `0xff7fd4` (pink) → `0xffffff` (white for maximum brightness)
   - Opacity: `0.92` → `1.0` (fully opaque)
   - Scale: `340` → `480` (41% larger glow radius)
   - **Added:** `blending: THREE.AdditiveBlending` (critical for light emission)

4. **Sun Core Sprite**
   - Scale: `185` → `220` (19% larger)

5. **Horizon Glow**
   - Color 1: `0xfff6c8` → `0xffffff` (pure white)
   - Color 2: `0xff86da` → `0xffaadd` (brighter pink)
   - Size: `900x70` → `1200x100` (larger glow area)
   - Alpha multiplier: `0.62` → `0.85` (37% more visible)

## Impact
- ✅ Only affects Synthwave Valley biome (levels 1-5)
- ✅ Other biomes unchanged (desert_night, alien_planet, hellscape_lava)
- ✅ No performance impact (same number of objects, just brighter)
- ✅ Syntax validated

## Testing
Run syntax check:
```bash
node -c main.js
```

Visual testing needed in browser to confirm brightness levels are appropriate.
