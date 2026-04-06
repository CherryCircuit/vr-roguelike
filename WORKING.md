# WORKING.md - SPACE-OMICIDE Active Project State

**Last updated:** 2026-04-05 18:01 PDT

## Current Version: v2026.04.05.1730

## Recent Work (2026-04-05 session)

### Completed This Session
- [x] Cloud dome seam fix (3D noise for seamless spheres)
- [x] Phase wraith floating bob + charge telegraph
- [x] Scoreboard page navigation fix
- [x] Pause menu layout compression
- [x] Enemy explosions deferred to after upgrade screen
- [x] Desert cactus lights, moon shadows
- [x] Hellscape repositioning, lava river, embers, skydome
- [x] Alien planet lights, mountain wrap, dark clouds, floor
- [x] Ominous horizon disabled
- [x] Seeker projectile tadpole shape
- [x] Massive dead code cleanup (~2,341 lines deleted, 3 files removed)
- [x] Performance optimizations (geyser ring buffer, embers 400→100, clouds FBM 4→3, shadows 1024→512, lava segments halved)
- [x] Quest browser detection (debug panel auto-disabled)
- [x] Debug panel click regression fix
- [x] startEnvironmentFade regression fix (accidentally removed in cleanup)
- [x] Stars persist per-biome (no more visual jump between levels)
- [x] Debug position panel: delta offsets (0/0/0 default, additive apply)
- [x] Debug highlight: yellow wireframe overlay for all material types
- [x] Upgrade cards: uniform opacity 0.91, SKIP card repositioned, wider title maxWidth
- [x] Floor HUD: score/kill gap tripled, accuracy bonus spacing halved
- [x] Nuke emoji split: ☢ at 2x size, X count same size

### Pending from Graeme's Edit List
- [ ] Graeme wants to update some upgrade titles/descriptions (waiting on his list)
- [ ] Accuracy bonus indicator bar: code exists but Graeme says it disappeared, needs investigation on Quest

### Known Issues
- `startEnvironmentFade` was accidentally removed during dead code cleanup - already fixed but serves as a reminder that the cleanup was aggressive. Check git history if other functions seem missing.

## Architecture Notes

### Deleted Files (2026-04-05)
These files were removed. Content lives in git history if needed:
- `environment.js` (515 lines)
- `weapon-models.js` (308 lines)
- `dream-world.js` (removed by worker + references cleaned from main.js)

### Biome Position Reference
| Biome | Group Position | Notes |
|-------|---------------|-------|
| Hellscape | (11.599, -1.55, -42.0) | Lava river Y:-0.70 group = world Y:-2.25 |
| Synthwave | Origin | Mountain cylinder radius 148 |
| Alien | Origin | Dark mountain wrap, radius 148 |
| Desert | Origin | Moon with shadow map (512x512) |

### Key Constants
- Lava river: width 25, length 350, segments 16x32
- Geyser particles: pre-allocated ring buffer, MAX_GEYSER=350
- Cloud FBM: 3 layers (was 4)
- Shadow maps: 512x512 (desert only)

### Upgrade Card System
- Cards defined in `weapons.js` (WEAPON_DEFS, UPGRADE_DEFS)
- Card rendering in `hud.js` (`createUpgradeCard`, `createSkipCard`)
- Title fontSize: 45, scale: 0.24, maxWidth: 600
- Desc fontSize: 32, scale: 0.36, maxWidth: 280
- All cards: opacity 0.91, MeshBasicMaterial
- Text rendering: `makeSprite()` → `makeTextTexture()` (canvas-based, word wrapping)

### Debug Panel (desktop-controls.js)
- Position panel uses delta offsets (0/0/0 default, additive apply)
- Highlight: emissive yellow + yellow WireframeGeometry overlay
- Quest detection: `/Quest|OculusBrowser|Oculus/i` → auto-disable panel
- Debug panel check happens BEFORE mouse.locked guard in document click handler

## File Sizes (post-cleanup)
| File | Lines |
|------|-------|
| main.js | ~10,935 |
| enemies.js | ~8,773 |
| hud.js | ~5,097 |
| desktop-controls.js | ~1,156 |
| audio.js | ~1,457 |
| weapons.js | ~603 |
| game.js | ~528 |
| Total | ~30,492 |
