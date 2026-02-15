# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: READ THIS FILE FIRST

**At the START of every ACT MODE session, you MUST:**
1. Read this entire AGENTS.md file
2. Check against ALL rules below
3. Include the MANDATORY CHECKLIST in your task_progress
4. NEVER skip the checklist

**Failure to follow this = you are not doing your job.**

## Build Versioning

**CRITICAL: Every edit must update the build name and version number!**

In `index.html`, update the build info in the `#info` div:
```html
<p>Build: BAND_NAME | Babylon.js Port v0.X.Y | ...</p>
```

And update the header in `main.js`:
```javascript
// Build: BAND_NAME
```

**Version number**: Increment Y for bug fixes, X for features.
**Build name**: Use a new 80s hair band name for each significant change.

### Build History
- **v0.1.2 - MÖTLEY CRÜE**: Initial Babylon.js port with environment and controllers
- **v0.1.3 - POISON**: Fixed glTF loader import, controller mesh hiding via doNotLoadControllerMeshes

## Project Overview

**Synthwave VR Blaster** (aka "Spaceomicide") is a WebXR roguelike shooter for VR headsets. Built with Babylon.js, it runs entirely in the browser with no build step—just open `index.html` in a WebXR-capable browser (Meta Quest Browser, Chrome on VR devices).

**NOTE: Ported from Three.js to Babylon.js due to unfixable framebuffer alpha bug.**

## Development Workflow

### MANDATORY PRE-COMPLETION CHECKLIST

**Include this checklist in EVERY task_progress you create. Check off items as you complete them.**

- [ ] Read AGENTS.md fully before starting
- [ ] **SEARCH BEFORE FIXING** - Research Babylon.js docs, GitHub issues, Stack Overflow
- [ ] Start local server: `python3 -m http.server 8000`
- [ ] Open browser to `http://localhost:8000`
- [ ] Open DevTools (F12) → Console tab
- [ ] Read ALL console output (logs, warnings, errors)
- [ ] Fix ANY red errors before proceeding
- [ ] Fix warnings that break functionality
- [ ] Test in VR headset if WebXR-related changes
- [ ] Verify build name is visible in UI
- [ ] Only THEN use `attempt_completion`

**VIOLATION OF THIS CHECKLIST = YOU ARE NOT DOING YOUR JOB**

### CRITICAL: Test Locally Before Marking Done

**Before marking ANY task as "done", you MUST:**

1. Start a local web server:
   ```bash
   python3 -m http.server 8000
   ```

2. Check the page loads: `http://localhost:8000`

3. Open browser DevTools (F12) and check the Console tab for:
   - Module import errors (`Failed to resolve module specifier`)
   - JavaScript syntax errors
   - Red error messages
   - Yellow warnings that break functionality
   - Babylon.js loader warnings (e.g., "glTF loader was not registered")

4. Verify no console errors exist before using `attempt_completion`

5. After making changes, stop and restart the server to ensure fresh cache:
   ```bash
   pkill -f "python3 -m http.server"
   python3 -m http.server 8000
   ```

**Why?** Issues that are obvious in browser console (like import resolution errors) should never reach the user. Local testing catches these before marking work complete.

### Known Errors to Watch For

These errors have happened before. Do NOT repeat them:

1. **glTF Loader Not Registered**
   - Error: `glTF / glb loader was not registered, using generic controller instead`
   - Cause: Using bundle scripts instead of ES module import
   - Fix: `import "@babylonjs/loaders";` in main.js (NOT bundle script)

2. **Generic Controllers in VR**
   - Error: Seeing ugly box controllers instead of custom blasters
   - Cause: Didn't hide `motionController.mesh` or didn't create custom blasters
   - Fix: `motionController.mesh.isVisible = false;` then call `createCustomBlaster()`

3. **Cache Issues on Quest Browser**
   - Error: Changes not showing up after refresh
   - Cause: Quest browser aggressive caching
   - Fix: Add cache-busting headers to index.html:
     ```html
     <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
     <meta http-equiv="Pragma" content="no-cache">
     <meta http-equiv="Expires" content="0">
     ```

4. **Missing Build Name in UI**
   - Error: Build name not visible in browser
   - Cause: Updated code but forgot to update index.html text
   - Fix: Update `<p>` tag in #info div to show current build name

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

- **`main.js`**: Game loop, Babylon.js scene setup, WebXR session management, controller input, rendering
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

When adding new particle effects, follow the existing pool pattern: pre-allocate, set `.isVisible = false`, reuse by toggling visibility.

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

## CRITICAL RULE: SEARCH BEFORE FIXING

**MANDATORY: Before making ANY "fixes", you MUST do a thorough web search for solutions.**

Search these sources in order:
1. **Official Babylon.js documentation** - https://doc.babylonjs.com (search: "WebXR controller", "custom controller mesh", "replace controller model")
2. **Babylon.js GitHub issues** - https://github.com/BabylonJS/Babylon.js/issues (search: your exact error message)
3. **Stack Overflow** - search: "babylon.js webxr" + your error message
4. **Babylon.js forum** - https://forum.babylonjs.com/ (search: "controller", "WebXR", "custom mesh")
5. **YouTube tutorials** - search: "Babylon.js WebXR controller tutorial"

**Why?** Most common issues have known solutions documented by the community. Applying a fix without researching risks:
- Wasting time on already-solved problems
- Implementing workarounds that cause new issues
- Missing the correct, documented solution
- REPEATING MISTAKES (like this session's controller model issue)

**Example:** The glTF loader registration issue was solved in Babylon.js docs at `/features/featuresDeepDive/importers/loadingFileTypes`. Using `registerBuiltIn` without research caused repeated failures.

**THIS MUST BE DONE BEFORE ANY CODE CHANGES. NO EXCEPTIONS.**

## WARNING: USE TRANSPARENCY CAREFULLY IN VR

**This was a major issue with Three.js. Babylon.js may handle it better, but test carefully.**

In Three.js, materials with partial transparency (`transparent: true`, `alpha < 1`) caused black rectangles in WebXR on Quest Browser. The XR compositor treats any pixel with framebuffer alpha < 1.0 as see-through-to-black, creating dark head-locked overlays.

### The Warning

**AVOID transparency unless you've tested it in VR. If you use transparency, verify it works on the actual headset before proceeding.**

### What To Use Instead

| Need | Solution |
|------|----------|
| Text with alpha background | `alphaTest: 0.5` (binary discard, no partial alpha) |
| Texture with alpha gradients | `alphaTest: 0.1` (low threshold for soft gradients) |
| Semi-transparent UI panels | Fully opaque with darker color |
| Glow/bloom effects | `blending: BABYLON.Texture.ALMPHA_ADDITIVE` without transparency |
| Fade-in/fade-out animations | `mesh.isVisible = true/false` or scale animation |
| Semi-transparent enemies/shields | Solid color, or wireframe, or emissive |

### Examples

```javascript
// BAD — may cause black box in VR
new BABYLON.StandardMaterial('mat', scene);
mat.alpha = 0.8;

// GOOD — text/textures with alpha channels
mat.alphaTest = 0.5;

// GOOD — glow effects
mat.emissiveColor = new BABYLON.Color3(0, 1, 1);
mat.disableLighting = true;

// GOOD — UI panels (just use solid darker color)
mat.diffuseColor = new BABYLON.Color3(0.1, 0.05, 0.2);
mat.disableLighting = true;
```

## Performance Considerations

- **Target**: 72fps on Meta Quest 2 (can drop to 60fps on intense levels)
- **Geometry**: Use shared geometries and merged geometries to reduce draw calls
- **Materials**: Use shared materials per enemy type to reduce state changes
- **Update Loops**: Stagger expensive updates across frames (`frameCount % N === 0`)
- **Raycasting**: Only raycast against visible enemy meshes, cache results
- **Use object pooling** for projectiles, explosions, damage numbers

When adding new features, profile in VR using the performance monitor (`?debug=1`). WebXR cannot drop below 60fps without causing motion sickness.

## Version History Notes

**Babylon.js Port (Build: MÖTLEY CRÜE):**
- Ported from Three.js to Babylon.js due to unfixable framebuffer alpha bug
- Custom glowing cyan blasters replace generic controllers
- Cache-busting headers for Quest browser
- Proper glTF loader registration via ES module import
- Build name visible in UI

**Three.js "Power Outage Update" (commit f9b68da - 17b400f):**
- Enemy speed +75% across all levels
- Spawn rate +75% (lower interval)
- Boss alert screen before boss spawns (new state: `BOSS_ALERT`)
- Slow-mo level complete finale (new state: `LEVEL_COMPLETE_SLOWMO`)
- Boss health bar changed from 3-segment camera-attached to single continuous world-space fill bar
- Crash fix: Lightning/explosion pools now initialize after scene creation

## WHEN USER EXPRESSES FRUSTRATION

**If the user shows frustration (e.g., "FUCK", angry tone, or repeats instructions):**

1. **STOP immediately** - Don't continue with your current approach
2. **ACKNOWLEDGE the failure** - Admit what you did wrong
3. **INVESTIGATE root cause** - Not just symptoms, find why it's happening
4. **DON'T repeat the same fix** - If you tried it once and it didn't work, try something different
5. **READ AGENTS.md** - Re-read the relevant sections
6. **CHECK known errors** - Look at the "Known Errors to Watch For" section
7. **ASK if unsure** - Don't guess, ask clarifying questions
8. **Proceed carefully** - Only when you understand the actual problem

**Remember:** Repeating the same mistake multiple times makes the problem worse. Stop, think, and investigate.