# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Synthwave VR Blaster** (aka "Spaceomicide") is a WebXR roguelike shooter for VR headsets. Built with Three.js, it runs entirely in the browser with no build step—just open `index.html` in a WebXR-capable browser (Meta Quest Browser, Chrome on VR devices).

## Development Workflow

### Running the Game

The game requires a local web server (not file://) to load ES modules:

```bash
# Using Python 3
python3 -m http.server 8000

# Using Python 2
python -m SimpleHTTPServer 8000

# Using Node.js (if http-server is installed)
npx http-server -p 8000
```

Then navigate to `http://localhost:8000` in a WebXR-compatible browser.

### Debug Mode

Access debug utilities via URL parameter `?debug=1` or clicking the "DEBUG" link in the bottom-left corner:
- **Jump to Level**: Skip to any level (1-20) for testing boss fights and difficulty scaling
- **Performance Monitor**: Shows FPS and render stats
- **Console Log**: In-VR console output overlay

Debug commands are also available programmatically:
```javascript
window.debugJumpToLevel = 10;  // Set before entering VR
window.debugPerfMonitor = true;
```

### Testing

No automated tests exist. Manual testing workflow:
1. Use debug mode to jump to specific levels
2. Test boss fights at levels 5, 10, 15, 20 (each has unique mechanics)
3. Test upgrade combinations (especially side-grades: buckshot, lightning, charge_shot)
4. Verify performance on Meta Quest 2 (target: 72fps, can drop to 60fps on high-enemy levels)

## Architecture

### Module Structure

The codebase uses ES6 modules with clear separation of concerns:

- **`main.js`**: Game loop, Three.js scene setup, WebXR session management, controller input, rendering
- **`game.js`**: Central state management, level configuration, score/health/combo tracking
- **`enemies.js`**: Enemy spawning, AI movement, voxel geometry, collision detection, death explosions
- **`upgrades.js`**: Upgrade definitions, weapon stat calculation from stacked upgrades
- **`hud.js`**: All in-VR UI (3D text sprites, damage numbers, menus, boss health bars)
- **`audio.js`**: Procedural Web Audio API sound effects (no external audio files)
- **`scoreboard.js`**: Supabase backend integration, profanity filtering, country/continent leaderboards

### State Flow

The game uses a finite state machine (`game.state`) defined in `game.js`:

```
TITLE → PLAYING → LEVEL_COMPLETE_SLOWMO → LEVEL_COMPLETE → UPGRADE_SELECT
                     ↓                                            ↓
                 GAME_OVER                                (repeat PLAYING)
                     ↓
              NAME_ENTRY → COUNTRY_SELECT → SCOREBOARD
```

Boss levels (5, 10, 15, 20) insert a `BOSS_ALERT` state before `PLAYING`.

### Level Scaling

Levels 1-20 scale exponentially (`game.js:buildLevel`):
- **HP Multiplier**: `1 + (level - 1)^1.5 * 0.15`
- **Speed Multiplier**: Base speed * 1.75 (recent "Power Outage Update" buff)
- **Spawn Rate**: Increases by 75% from baseline
- **Kill Targets**: 15-27 (levels 1-5), 33-65 (6-10), 80-140 (11-15), 165-240 (16-20)
- **Boss Levels**: Every 5th level spawns 1 boss (random from 5 boss types per tier)

### Object Pooling

Performance-critical systems use object pooling to avoid GC pauses:
- **Lightning bolts** (`main.js:lightningBoltPool`): 50 pre-allocated Line objects
- **Explosion sprites** (`enemies.js:explosionPool`): 60 pre-allocated Sprite objects with shared textures
- **Damage numbers** (`hud.js`): Reused Sprite objects

When adding new particle effects, follow the existing pool pattern: pre-allocate, set `.visible = false`, reuse by toggling visibility.

### Weapon System

Weapons are per-hand with independent upgrade stacks (`game.upgrades.left` / `game.upgrades.right`).

**Shot Types** (mutually exclusive per hand):
- **Default**: Single projectile raycast
- **Buckshot**: Multi-pellet spread (side-grade)
- **Lightning**: Continuous beam that locks onto enemies (side-grade)
- **Charge Shot**: Hold trigger to charge, release for powerful beam (side-grade)

Side-grade upgrades (`upgrade.sideGrade = true`) replace the current shot type and trigger an immediate additional upgrade card after selection.

Weapon stats are computed on-demand via `getWeaponStats(hand)` in `upgrades.js`, which sums all active upgrade stacks.

### Enemy AI Patterns

Defined in `enemies.js`:
- **Basic**: Straight-line movement toward player
- **Fast**: Faster, more erratic, introduced at level 3
- **Tank**: Slow, high HP, introduced at level 6
- **Swarm**: Smallest, fastest, large groups, introduced at level 8

Air spawns (flying enemies above ground plane) enabled at level 6+.

### Boss Mechanics

Boss IDs follow the pattern `{type}` (tier 1), `{type}2` (tier 2), etc.

Each boss has unique abilities (defined in `enemies.js`):
- **Grave Voxel**: Summons minions
- **Iron Sentry**: Projectile attacks
- **Chrono Wraith**: Teleportation/phase mechanics
- **Siege Ram**: Charge attacks
- **Core Guardian**: Shield mechanics

Boss health scales with tier, displayed as a floating world-space bar above the boss (`hud.js:showBossHealthBar`).

### Supabase Integration

Scoreboard uses Supabase for persistence (`scoreboard.js`):
- **Table**: `scores` (columns: `name`, `score`, `level_reached`, `country`, `created_at`)
- **Profanity Filter**: `isNameClean()` uses a basic word list (extend for new languages/slang)
- **Leaderboards**: Global, per-country, per-continent
- **Anonymous Key**: Public read/write (rate-limited by Supabase RLS policies)

Credentials are in `scoreboard.js:2-3` (public anon key, safe to commit).

## Common Patterns

### Adding a New Upgrade

1. Add definition to `UPGRADE_POOL` or `SPECIAL_UPGRADE_POOL` in `upgrades.js`
2. Implement stat calculation in `getWeaponStats()` (e.g., damage, fire rate, effects)
3. Implement gameplay effect in `main.js` (e.g., `fireLaser()`, `updateProjectiles()`, `handleEnemyHit()`)
4. If it's a side-grade (changes shot type), set `sideGrade: true` and `sideGradeNote`

### Adding a New Enemy Type

1. Define pattern in `PATTERNS` and stats in `ENEMY_DEFS` (`enemies.js`)
2. Add to `getEnemyTypes()` level unlock logic (`game.js`)
3. Implement AI movement in `updateEnemies()` (`enemies.js`)
4. Add spawn sound in `spawnEnemy()` → `audio.js`

### Adding a New Sound

All sounds are procedural Web Audio (`audio.js`):
1. Create a new `export function play{Name}Sound()` function
2. Use `getAudioContext()` to get the shared AudioContext
3. Build sound using OscillatorNode, GainNode, and BiquadFilterNode
4. Randomize parameters for variation (see `playShoothSound()` as example)

Never use external audio files—this keeps the game asset-free and improves load times.

## Performance Considerations

- **Target**: 72fps on Meta Quest 2 (can drop to 60fps on intense levels)
- **Geometry**: Use shared geometries (`getGeo()` in `enemies.js`) and merged geometries (`mergeGeometries`) to reduce draw calls
- **Materials**: Use shared materials per enemy type to reduce state changes
- **Update Loops**: Stagger expensive updates across frames (`frameCount % N === 0`)
- **Raycasting**: Only raycast against visible enemy meshes, cache results in `_cachedEnemyMeshes`

When adding new features, profile in VR using the performance monitor (`?debug=1`). WebXR cannot drop below 60fps without causing motion sickness.

## Version History Notes

**Recent "Power Outage Update" (commit f9b68da - 17b400f):**
- Enemy speed +75% across all levels
- Spawn rate +75% (lower interval)
- Boss alert screen before boss spawns (new state: `BOSS_ALERT`)
- Slow-mo level complete finale (new state: `LEVEL_COMPLETE_SLOWMO`)
- Boss health bar changed from 3-segment camera-attached to single continuous world-space fill bar
- Crash fix: Lightning/explosion pools now initialize after scene creation (L153-176 vs L179)

When adding new particle systems, ensure pools are initialized AFTER `scene` is created to avoid null reference crashes.
