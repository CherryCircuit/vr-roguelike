# 2026-04-17 Synthwave Valley Polish Session

## Summary
Final visual polish on synthwave valley biome for beta launch.

## Commits (chronological)
- `46115fe` - Horizon glow VR culling, error overlay, title/logo
- `5681047` - Horizon glow culling + gradient smoothing, remove sun drift
- `5b68401` - Sun floor reflection with slow drift animation
- `ee1c2f7` - Horizon glow bounding sphere, downsample sun 4000→512
- `236d4c4` - Revert floor shader, fix horizon glow, rotate mountains
- `cb57c24` - Synthwave glow tuning
- `6efdd88` - Horizon glow reverted to original size, bounding box added
- `312baa5` - Sun reflection from Needle settings, remove shimmer
- `d005c81` - Disable frustum culling on biome group (didn't help)
- `374496a` - depthTest=false (didn't help, caused mountain bleed)
- `5b986fa` - Taller cylinder on scene root (didn't help)
- `dd92978` - renderOrder=0.5 **THE FIX**
- `27e9ec8` - Reverted all hacks, kept renderOrder=0.5
- `1e64cc3` - Final polish: additive blending, scales, gradient, BackSide
- `c8e009f` - Horizon glow + sun reflection turn red in boss cinematic

## Key Lesson
Horizon glow disappearing when looking down was NOT frustum culling, depth testing, bounding volumes, or geometry size. It was **renderOrder**. The glow at renderOrder=0 conflicted with mountains at renderOrder=0. Fix: renderOrder=0.5.

**Moral: check renderOrder first when transparent objects vanish at certain angles.**

## Final Settings
### Sun Floor Reflection
- Pos: (0, 1.5, -600), scale: (0.075, 1.525, 1)
- Rotation: (-90°, 0, -180°)
- Material: FrontSide, opacity 0.8, color #f5f906, AdditiveBlending
- renderOrder: 1, no animation
- Turns red during boss cinematic

### Horizon Glow
- Cylinder: radius 1155, height 120, open-ended
- Pos: (0, 61, 0), scale: (1, 1, 1)
- Material: BackSide, depthWrite false, AdditiveBlending
- renderOrder: 0.5 (between mountains=0 and cards=1)
- Gradient: 512px canvas, 11 stops, pure cyan transparent top → near-white full opacity bottom
- Turns red during boss cinematic

### Terrain
- X scale: 2.25
- frustumCulled: false

## Also Done
- Error overlay moved to bottom-right, filters chrome-extension errors
- Page title: "SPACE☢️MICIDE VR ROGUELIKE SHOOTER"
- Logo: SVG with white filter, 48px max height
- Boss invulnerable ting throttled to 120ms
- Eclipse Engine seal hitbox, vulnerability windows, homing projectiles
- ENEMY_DISPLAY_NAMES consolidated across all screens
- Bestiary screen with discovery system
