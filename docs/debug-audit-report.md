# Debug vs Core Code Audit Report

**File:** `main.js`  
**Date:** 2026-04-08  
**Total lines:** ~10,210  
**Syntax check:** PASS (`node -c main.js`)

---

## Summary

| Category | Estimated Lines | % of Total |
|----------|----------------|------------|
| Core game code | ~7,900 | 77% |
| Debug/test code | ~1,500 | 15% |
| Shared/ambiguous | ~810 | 8% |

**Debug code:** 37 `[DEBUG]` tags added  
**Core code:** 169 `[CORE]` tags added

---

## [DEBUG] Sections by Category

### 1. Window Exposures & Debug Flags
**Lines:** 106-122  
**Size:** ~17 lines  
**Description:** `window.State`, `window.game`, `window.DEBUG_PROJECTILES`, `const DEBUG`, `_log`, `_warn` helpers  
**Coupling:** Reads `State` and `game` from game.js (core). Zero write coupling to core.  
**Extraction:** Trivial. Move to a `debug-bridge.js` module.

### 2. Visual Tuning / Debug Sliders
**Lines:** 691-730 (defaults), 1504-1660 (functions)  
**Size:** ~200 lines  
**Description:** `VISUAL_TUNING_DEFAULTS`, `synthVisualRefs`, `desktopEffectRefs`, `clampDebugValue()`, `getVisualTuning()`, `registerPlayerProjectileMaterial()`, `applyVisualTuning()`, `getDesktopRenderMode()`, `renderDesktopDebugEffect()`, `initDesktopStereoEffects()`, `resizeDesktopStereoEffects()`  
**Coupling:** Writes to material uniforms (core materials). Reads `renderer.xr.isPresenting`.  
**Extraction:** Medium. Needs reference to shared material sets. Extract as `debug-visual-tuning.js`.

### 3. Progression Automation (Test Hooks)
**Lines:** 790-1183  
**Size:** ~394 lines  
**Description:** `normalizeBiomeInput()`, `clampLevelNumber()`, `sleep()`, `waitForCondition()`, `waitForStateMatch()`, `getPendingUpgradeSummaries()`, `trySelectUpgradeByIdForTests()`, `trySelectUpgradeByIndexForTests()`, `normalizeUpgradeStrategy()`, `autoSelectUpgradeByStrategy()`, `waitForUpgradeEntry()`, `settlePostUpgradeState()`, `settlePendingUpgradeIfNeeded()`, `ensureReadyForProgression()`, `restartRunForProgression()`, `configureAutoStrategy()`, `applyBiomeOverrideForProgression()`, `startRunAtLevelForProgression()`, `concludeUpgradeSelection()`, `forceLevelCompleteForTests()`, `runSingleLevelCycle()`, `normalizeProgressionSegment()`, `executeProgressionSegments()`, `createProgressionAPI()`  
**Coupling:** Heavy. Calls `completeLevel()`, `resetGame()`, `startGame()`, `showTitle()`, `selectUpgradeAndAdvance()`, `getLevelConfig()`, `applyThemeForLevel()`, `saveDebugSettings()`. Reads/writes `game.state`, `game.level`, `game.kills`.  
**Extraction:** Hard. Deeply coupled to game state machine. Would need event/callback injection to decouple. Recommended to keep in place but gate behind a `__TEST__` flag.

### 4. Puppeteer/Headless Detection
**Lines:** 1216, 1225 (in `init()`)  
**Size:** ~5 lines  
**Description:** `!navigator.webdriver` checks for antialiasing and shadows  
**Coupling:** None beyond renderer config.  
**Extraction:** Trivial. Inline check, can be moved to renderer config module.

### 5. Desktop Controls Integration
**Lines:** 1349 (init call), 1480-1500 (stereo effects), 2246-2252 (click handler), 2560-2850 (desktop click handlers), 8953-8957 (update in render loop), 9051-9104 (desktop firing in render), 9784-9776 (desktop raycaster in hover), 9984-9987 (desktop debug render)  
**Size:** ~400 lines (scattered across file)  
**Description:** `handleDesktopClick()` and all `handleDesktop*Click()` variants, desktop firing logic in render loop, desktop stereo/anaglyph rendering  
**Coupling:** Calls core HUD functions (`showDebugMenu`, `hideDebugMenu`, etc.), reads `game.state`, calls `selectUpgradeAndAdvance()`, `activateNuke()`. Desktop firing calls `fireMainWeapon()` and `fireAltWeapon()`.  
**Extraction:** Medium-Hard. Desktop handlers are thin wrappers over core state transitions. Desktop firing in render loop is tightly coupled to weapon system. Recommend extracting click handlers to `desktop-controls.js` (already partially done), but render-loop desktop integration stays.

### 6. Debug Menu / Biome Override
**Lines:** 6054-6166  
**Size:** ~112 lines  
**Description:** `debugJumpToLevel()`, `cycleDebugBiome()`, `cycleDebugBiomeWithFade()`, `window.debugCycleBiomeWithFade`, `handleDebugMenuTrigger()`, `handleDesktopDebugMenuClick()`  
**Coupling:** Calls `resetGame()`, `applyThemeForLevel()`, `saveDebugSettings()`, `showReadyScreen()`, `hideDebugMenu()`, `showDebugMenu()`, `startEnvironmentFade()`.  
**Extraction:** Medium. Can be extracted to `debug-menu.js` if it receives references to core functions.

### 7. Test Helpers on window.__test
**Lines:** 1370-1480 (in `init()`)  
**Size:** ~110 lines  
**Description:** `window.__test.getEnemies`, `window.__test.fireAtEnemy`, telemetry bridge, `window.__perf` profiler API, `window.__progression` API  
**Coupling:** Reads core state (`getEnemies`, `camera`, `renderer`, `scene`). `fireAtEnemy` calls `fireMainWeapon()`.  
**Extraction:** Trivial. All on `window`. Move to `test-bridge.js`.

### 8. Debug Logging (_log calls)
**Lines:** Scattered (118 occurrences)  
**Size:** ~118 lines (one per call)  
**Description:** All `_log()` calls throughout the file. Already zero-cost when `DEBUG=false` due to V8 inlining.  
**Coupling:** Read-only. Logs core state values.  
**Extraction:** Leave in place. Already conditionally compiled away.

### 9. console.log / console.warn / console.debug
**Lines:** Scattered (15 occurrences)  
**Size:** ~15 lines  
**Description:** Direct console calls for initialization warnings and debug-mode-only logs  
**Coupling:** Read-only.  
**Extraction:** Leave in place or wrap with `_log`.

### 10. DEBUG_PROJECTILES blocks
**Lines:** 7156, 7723  
**Size:** ~10 lines (2 blocks)  
**Description:** Runtime-togglable projectile investigation logging  
**Coupling:** Read-only.  
**Extraction:** Trivial.

---

## [CORE] Sections (Major Function Groups)

| Section | Lines | Description |
|---------|-------|-------------|
| Muzzle flash | 134-195 | Sprite creation, show, update |
| Constants & config | 200-280 | Color palette, physics, timing |
| Projectile materials & explosion pool | 332-500 | Pool initialization |
| Slow-mo quality | 502-530 | Performance scaling |
| Kills alert & enemy death | 524-680 | Kill tracking, scoring, accuracy |
| Camera position | 652-685 | Adjusted camera for VR/desktop |
| Init | 1195-1480 | Scene, renderer, VR, subsystems |
| Environment & biome | 1740-1960 | Scene creation, fade system |
| Biome themes | 1936-2200 | Theme application, sun, stars |
| Controllers | 2212-2470 | VR controller setup, blaster display |
| Trigger handlers | 2479-2550 | VR trigger press/release |
| Game over/name/score/country VR | 2827-3006 | VR UI state handlers |
| Nuke | 3038-3090 | Kill all enemies |
| Alt weapon fire dispatch | 3097-3220 | Route to weapon-specific function |
| Shield | 3224-3286 | Active shield system |
| Laser mine | 3288-3580 | Mine placement, arming, detonation |
| Decoy | 3579-3750 | Hologram decoy system |
| Black hole | 3751-4040 | Gravity well weapon |
| Nanite swarm | 4065-4300 | Swarm drone weapon |
| Tether harpoon | 4304-4535 | Grapple weapon |
| Phase dash | 4535-4720 | Teleport weapon |
| Reflector drone | 4720-5040 | Reflecting shield drone |
| Stasis field | 5036-5130 | Slow field weapon |
| Plasma orb | 5131-5340 | Explosive orb weapon |
| Grenade | 5337-5450 | Thrown explosive |
| Proximity mine | 5451-5580 | Placeable mine |
| Attack drone | 5580-5755 | Autonomous turret drone |
| EMP | 5755-5860 | Area stun weapon |
| Teleport | 5857-5940 | Blink weapon |
| Game state transitions | 6215-6500 | startGame, completeLevel, upgrades |
| Pause system | 6668-6720 | Pause/resume/countdown |
| End game | 6723-6760 | Victory/game over |
| Screen shake | 6764-6780 | Camera shake effect |
| Projectile pool | 6781-7060 | Instanced mesh pooling |
| Main weapon fire | 7112-7200 | Pistol/shotgun/rifle firing |
| Lightning beam | 7214-7530 | Continuous beam weapon |
| Charge beam | 7530-7700 | Charge cannon weapon |
| Projectile spawn | 7683-7810 | Generic projectile creation |
| Hit handling | 7816-8100 | Enemy/boss hit, AOE, explosions |
| Projectile update | 8323-8750 | Movement, collision, lifetime |
| Upgrade selection (VR) | 8742-8760 | VR card selection |
| Enemy wave spawning | 8764-8860 | Wave management |
| Render loop | 8871-9990 | Main frame loop |
| Telemetry | 9998-10115 | Stats collection |
| Window resize | 10123-10130 | Resize handler |
| Biome scene rebuild | 10137-10170 | Scene rebuild on level change |

---

## Dependencies: Debug → Core

| Debug Section | Core Dependencies |
|---------------|-------------------|
| Window exposures | `State`, `game` (read-only) |
| Visual tuning | Materials, uniforms, `renderer` |
| Progression automation | `game` state machine, `completeLevel()`, `resetGame()`, `startGame()`, `applyThemeForLevel()`, `selectUpgradeAndAdvance()` |
| Desktop controls | `game.state`, HUD functions, weapon system, `camera`, `renderer` |
| Debug menu | `game`, `resetGame()`, `applyThemeForLevel()`, HUD functions |
| Test helpers | `getEnemies()`, `fireMainWeapon()`, `camera`, `renderer`, `scene` |
| _log / DEBUG_PROJECTILES | Read-only inspection of core state |
| Puppeteer detection | `renderer` config only |

---

## Recommended Extraction Order (Least Coupled First)

1. **Window exposures & debug flags** (17 lines) - Zero write coupling. Move to `debug-bridge.js`.
2. **Puppeteer detection** (5 lines) - Renderer config only. Already inline.
3. **_log / _warn / DEBUG_PROJECTILES** (128 lines) - Already zero-cost. Leave in place or move to `debug-logging.js`.
4. **Test helpers on window.__test** (110 lines) - Read-only bridges. Move to `test-bridge.js`.
5. **Visual tuning & desktop stereo** (200 lines) - Needs material references. Extract to `debug-visual-tuning.js` with injected refs.
6. **Debug menu / biome override** (112 lines) - Needs core function refs. Extract to `debug-menu.js` with dependency injection.
7. **Desktop click handlers** (290 lines) - Thin wrappers over core state. Already partially in `desktop-controls.js`.
8. **Desktop firing in render loop** (60 lines) - Tightly coupled to weapon cooldowns and fire functions. Keep inline.
9. **Progression automation** (394 lines) - Deepest coupling. Requires game state machine refactor to extract cleanly. Gate behind build flag for now.

---

## Secondary Files

### enemies.js (8,456 lines)
- Line 14-17: `_log`/`_warn` pattern (same as main.js, already zero-cost)
- No other debug-only code found

### hud.js (3,866 lines)
- `showDebugJumpScreen`, `getDebugJumpHit`, `showDebugMenu`, `hideDebugMenu`, `getDebugMenuHit`, `updateTitleDebugIndicator`, `setFPSVisible` are debug HUD functions
- Estimated debug HUD code: ~200 lines
- Core HUD code: title screen, upgrade cards, game over, boss health bar, damage numbers, pause menu, kill chain popups

### game.js (528 lines)
- `loadDebugSettings`, `saveDebugSettings`, `debugBiomeOverride`, `debugShowPosition`, `debugPerfMonitor` are debug settings on the game state object
- Estimated debug code: ~30 lines (settings properties + load/save)
- Core: game state machine, level config, scoring, damage, weapon tracking
