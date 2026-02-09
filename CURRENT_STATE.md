# SPACEOMICIDE — Current State Assessment (Feb 8, 2026)

## Version: 0.022

## Git Status
- **Branch:** `CherryCircuit/webxr-synthwave-demo`
- **Uncommitted changes** in `main.js` and `audio.js` (172 lines changed)
- These uncommitted changes represent in-progress work from the previous helper — they are partially-applied fixes for issues #2–#6 from the user's feedback

---

## What's Working

### Core Gameplay (Solid)
- 20-level roguelike progression with escalating difficulty
- Dual-hand VR shooting with raycasting hit detection
- 4 enemy types (basic, fast, tank, swarm) with voxel pixel-art models
- 12 stackable upgrades per hand (scope, barrel, buckshot, piercing, fire, shock, freeze, etc.)
- Full-auto trigger hold firing with per-hand cooldowns
- Lightning beam weapon (continuous trigger hold)
- Combo system (kills without damage = multiplier up to 5x)
- Score tracking
- Level complete → upgrade selection → next level flow
- Game over / victory screens with restart
- Nuke mechanic (3 nukes)
- Bullet-time slow-mo

### Audio (Working, needs tuning)
- Procedural 8-bit Web Audio sounds (shoot, hit, explosion, damage, proximity alerts)
- Sound pitch/waveform variety (uncommitted: wider ranges + random waveform selection)
- Dynamic music system with level-based tracks
- Spatial audio for proximity alerts

### Environment (Partially working)
- Neon pink grid floor
- Dark purple floor plane
- Mountain silhouettes (2 layers) with wireframe edges
- Music-reactive mountain visualizer
- Star field
- Fog

### HUD (Working)
- Floor-based HUD (Space Pirate Trainer style) — hearts, kills, score, level, combo
- Pixel hearts for health
- FPS counter
- Damage numbers (floating text)
- Hit flash (red sphere)
- Title screen with version number and blinking "Press Trigger"
- Upgrade selection cards with raycasting
- SKIP upgrade option

### Holographic Blaster Display (Partially working)
- Per-hand hologram above controllers with kill/damage/upgrade stats
- Scan lines exist in code
- Border outline (no solid background panel)

---

## What's Broken / Incomplete

### 1. Hologram Scan Line Animation (Broken → In-Progress Fix)
**Status:** Uncommitted fix exists but likely still has issues.
- **Problem:** The original code had scan line animation inside `updateBlasterDisplay()`, which only runs when `needsUpdate` is true (data changes). So scan lines only animated on data updates, not every frame.
- **Uncommitted fix:** Extracted animation into separate `animateBlasterScanLines()` called every frame in the render loop. This is architecturally correct.
- **Remaining concern:** User reported "text boxes are still there occluding the scan lines" — the text meshes use `alphaTest: 0.05` (added in uncommitted changes) which should help, but the text planes still have a rectangular footprint that may visually occlude scan lines behind them. The z-ordering (text at z=0.002, scan lines at z=0.001) means text renders in front, potentially covering scan lines.

### 2. Sun Cutout Bands (Broken → Rewritten)
**Status:** Uncommitted rewrite uses canvas texture approach.
- **Old approach:** Black `PlaneGeometry` strips placed in front of sun mesh — user said "looks really bad"
- **New approach (uncommitted):** Generates sun as a 512x512 canvas texture with gradient + `destination-out` compositing to cut bands directly into the texture. This is architecturally much better (single draw call, proper transparency).
- **Potential issue:** The sun mesh is now a `PlaneGeometry(30, 30)` which is square — the bands in the canvas are cut from a circular sun drawn with `ctx.arc()`, so the cutout effect should look correct. However, user hasn't tested this version yet.
- **User suggestion:** They offered to create a transparent PNG texture instead, which would be cheapest and look best.

### 3. Horizon Glow (Not Visible)
**Status:** Still broken in both committed and uncommitted code.
- The horizon band (200x8 plane) is positioned at `y=0.02, z=-58` with `rotation.x = -Math.PI/2` — this makes it lie flat on the ground. At the player's eye height (1.6m), a nearly-flat plane 58 units away is essentially invisible (viewed edge-on).
- The vertical horizon wall (200x4) at `y=2, z=-60` should be visible but the user says it's not. Likely obscured by mountains (z=-75 and z=-85) which have `renderOrder: -5` while horizon wall has `renderOrder: -3` — the mountains at z=-75 are closer and would block the view of the wall at z=-60, but z ordering means the wall is in front... The issue is likely that it's just not bright/large enough compared to the dark scene.

### 4. Atmosphere / Horizon Gradient (Wrong Direction → In-Progress Fix)
**Status:** Uncommitted rewrite uses cylinder approach.
- **Old approach:** Stacked transparent planes behind the sun — only visible from one direction and faded horizontally (user complaint).
- **New approach (uncommitted):** `CylinderGeometry` at radius=92 with `BackSide` rendering and a canvas vertical gradient texture. This wraps 360° around the player.
- **Issue:** The canvas gradient uses RGBA colors in a CSS gradient string, but `CanvasTexture` with a `MeshBasicMaterial` may not correctly handle pre-multiplied alpha from the canvas. The gradient goes from `rgba(255, 68, 0, 0.6)` at base to `rgba(100, 20, 60, 0.0)` at top. This might work but the effective opacity may be lower than expected since the material's own opacity defaults to 1.0 and the texture alpha is pre-multiplied.

### 5. Sound Variety (In Progress)
**Status:** Uncommitted changes increase variation further.
- Shoot: pitch range `0.4–1.6` (was `0.6–1.4`), random waveform (square/sawtooth/triangle)
- Hit: pitch range `0.3–1.7` (was `0.5–1.5`), random waveform
- User wanted even MORE variation — uncommitted changes are a step but may still not be enough

---

## Prioritization Recommendation

### Immediate (commit or discard uncommitted work)
1. **Decide on uncommitted changes** — The uncommitted diff has good architectural fixes (scan line animation separation, canvas sun texture, atmosphere cylinder). These should be committed to preserve the work, even if further iteration is needed.

### High Priority (visual impact)
2. **Fix horizon glow** — The flat-plane approach fundamentally doesn't work (edge-on viewing). Need either:
   - A larger vertical plane/ring visible from the player's position
   - Integrate with the atmosphere cylinder (add brighter base glow)
   - Emissive ring around the grid edge
3. **Sun texture** — Accept user's offer to create a PNG texture. A hand-crafted retrowave sun PNG would look best and be cheapest to render (1 draw call, 1 texture sample, no canvas generation).
4. **Hologram text occlusion** — Fix z-ordering so scan lines render in front of text, or make scan lines wider/brighter so they're visible through the semi-transparent text.

### Medium Priority
5. **Atmosphere gradient** — The cylinder approach is correct but may need opacity/color tuning after testing in-headset.
6. **Sound variety** — Further iteration on pitch ranges, possibly adding more sound variations (multiple base frequencies, filter sweeps).

### Lower Priority
7. Version numbering system (currently hardcoded, would benefit from auto-increment)
8. Upgrade card title sizing (previously reduced 25%)

---

## Architecture Notes
- No build tools — pure ES modules via CDN import maps
- All UI is Three.js 3D objects (no DOM in VR)
- Shared mutable `game` singleton for state
- Performance-conscious: MeshBasicMaterial, staggered updates, object pooling patterns, black clear color for Adreno fast-clear
- The `.context/` folder contains attachments and plans from the previous tool
