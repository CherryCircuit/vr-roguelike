# Dead Code Inventory & Dormant Feature Registry

**Last updated:** 2026-08-02 (Phases 0-2 optimization pass)

This document catalogs every piece of dead, dormant, or placeholder code found in the
codebase, what it was written FOR, and what was done with it. Anything marked **KEEP**
is a dormant feature that should NOT be removed — it is part of a feature the owner
may still want implemented. Anything marked **REMOVED** was scaffolding (no-op stubs,
unused constants, unreachable legacy branches) deleted during the Phase 2 cleanup.

Legend:
- **REMOVED** — deleted during cleanup; rationale recorded here for git archaeology
- **KEEP (dormant)** — functional code with zero callers, written for a real feature
- **KEEP (live)** — exported API surface with no callers; harmless, possibly useful

---

## main.js

| Symbol | Status | What it was written for |
|---|---|---|
| `BIOME_LIGHTING` config | REMOVED | Legacy per-biome lighting config; superseded when biomes got their own lighting (comment at the old site already said so) |
| `LASER_RANGE`, `LASER_DURATION` | REMOVED | Constants from an earlier laser-beam iteration; current lightning/charge code uses inline values |
| `seekerProfile` CurvePath | REMOVED | Leftover from an earlier seeker lathe-profile attempt; actual profile uses `seekerPts`/`seekerCurve` |
| `_projPosition`, `_projQuaternion` | REMOVED | "Reusable temp objects" predating the projectile proxy system; the proxy uses `data.position`/`data.quaternion` |
| `applyBiomeLighting(biome)` | KEEP (live) | Documented no-op stub — biomes provide their own lighting; called from `applyThemeForLevel` |
| `createEnvironment()` | KEEP (live) | Documented no-op stub — "No base environment needed — biomes provide everything" |
| `pointToSegmentDist` | KEEP (live) | sqrt wrapper around `pointToSegmentDistSq`; kept for future precise-distance use |
| `vfx.js` (`initVFX`/`updateVFX`) | KEEP (dormant) | Extraction seam for the voxel-explosion system; no-op bodies still called from main.js |
| `updateWristHolograms` (commented out) | KEEP (dormant) | Wrist-hologram DPS system disabled in favor of `blasterDisplay`; comment at main.js marks the swap |
| `playShoothSound()` in `fireAltWeapon` | KEEP (dormant) | Placeholder sound for alt weapons pending per-weapon SFX |
| `handLabel` in `if (window.DEBUG_PROJECTILES)` blocks | REMOVED | Dead debug scaffolding (assigned, never used) — note: the blocks themselves remain for debugging |
| `initProjectilePool()` second call | REMOVED | Duplicate guarded call (was already guarded by `if (instancedProjectiles['laser'])`) |
| Perf log "seeker(28)" | FIXED | Log said 28 but pool is 60 — message corrected |

## enemies.js

| Symbol | Status | What it was written for |
|---|---|---|
| `recordPlayerPosition()` + `playerMovementHistory` | KEEP (dormant) | Feeds Clone Mimic chase behavior — never called, so mimics stand frozen. Call it from the frame loop to enable the feature |
| `updateShieldShards()` | KEEP (dormant) | Mirror Knight death shard ground hazards — spawns exist, update never wired; returns collision arrays ready for main.js |
| `updateBabySpiders()` / `getBabySpiderMeshes()` / `hitBabySpider()` | KEEP (dormant) | Spider Walker death babies — spawn code exists; wire the update/collision/raycast to enable |
| `setOnEnemyDestroyedCallback()` | KEEP (dormant) | Documented "alt weapon star drop (3% chance)" hook — never assigned |
| `getTelegraphingSystem()` / `updateTelegraphing()` | KEEP (live) | Accessors for the (live) telegraphing system; `updateBoss` already calls `telegraphingSystem.update` |
| `getBossMinionMeshes()` / `getBossMinionByMesh()` + `rebuildBossMinionMeshCache` | KEEP (dormant) | Written for raycasting minions; main.js now uses direct segment-vs-sphere math |
| `Boss.getBoss()` (method) | KEEP (live) | Class method with no callers (module-level `getBoss()` is the used one) |
| `TelegraphingSystem.finish(type)` | KEEP (live) | No callers; `removeEffect` used instead |
| `electricArcs` + `clearConductorArcs` / `clearTargetEnemyArcs` / `clearAllElectricArcs` | REMOVED | Vestigial conductor arc visuals — array was NEVER populated; all three functions were no-ops. Glow pool + emissive replaced the system |
| `enemyDebris` array | KEEP (live) | Documented "unused placeholder array, clean anyway" — placeholder for physics debris that moved to `bossDebris` |
| `statusBubbles` legacy array + update branch | KEEP (live) | Legacy status-bubble system replaced by pooled `statusBubblePool`/`statusBubbleActive`; legacy branch is unreachable but harmless |
| `_conductorGlowScale0` | KEEP (live) | Declared zero-scale Vector3 (was unused); the zero MATRIX it implied is now used as `_conductorGlowZeroMatrix` |
| Legacy Phase Wraith branches (`e.isPhase`, `spawnPhaseEcho`, echoes) | KEEP (dormant) | Phase Wraith was replaced by Mortar, but the code is still cleaned up properly — may belong to a planned enemy |
| Unimplemented enemy IDs (`geometry_shifter`, `pulse_bomber`, `clone_mimic`, `spider_walker`, `portal_mantis`, `blackhole_totem`, `phoenix_husk`, `void_walker`) | KEEP (dormant) | Behavior code EXISTS in enemies.js (split logic, babies, telegraphs) but no ENEMY_DEFS entries — spawns silently no-op. The seed deck list was fixed to real IDs; re-add these when implemented |

## weapons.js

| Symbol | Status | What it was written for |
|---|---|---|
| `getWeaponStats` branches for `shotgun`/`sniper`/`assault_rifle`/`cannon`/`laser_beam` + their upgrades | KEEP (dormant) | Planned weapons/upgrades that don't exist yet — NOT removed. Fixed the latent TDZ crash (`critMultiplier` const → let) so the sniper branch can't throw if wired up |
| `u.big_boom` check | KEEP (dormant) | Upgrade ID that doesn't exist (only `mega_boom`); likely an early name |

## game.js / seed.js

| Symbol | Status | What it was written for |
|---|---|---|
| `getEnemiesForLevel()` | KEEP (dormant) | Only consumer of the seed deck's enemy list — deck created but never drawn; biomes/levels currently hardcoded |
| `SeedDeck.draw/reshuffle/discard` + `deck.biomes`/`deck.weapons` | KEEP (dormant) | Run-variety system — built, never wired into level generation |
| `getDailySeed`/`getWeeklySeed`/`getRandomSeed`/`parseSeed` | KEEP (dormant) | Seed helpers; dev-tools reimplements daily/weekly inline |
| `BIOME_POOL` (14 biomes) | KEEP (dormant) | Only 4 themes exist in scenery.js under different IDs — would silently fall back to `synthwave_valley` if wired |
| Seed deck enemy list with unimplemented IDs | FIXED | Now lists only spawnable IDs (see enemies.js row); unimplemented roster documented in the comment |
| `'proximity_mine'` in seed deck | FIXED | Doesn't exist — real ID is `'mine'`; also added missing `grenade`, `drone`, `emp`, `teleport`, `decoy` |
| `getDifficultyModifiers` default case recursion | KEEP (live) | `this.getDifficultyModifiers('standard')` — works, just looks like a stub |

## hud.js

| Symbol | Status | What it was written for |
|---|---|---|
| `updateKeyboardHover()` | REMOVED | Empty stub "kept for backward compatibility" — hover handled by `updateHUDHover` |
| `updateUpgradeHandHighlights()` | REMOVED | Empty no-op stub, never called |
| `updateTitleDebugIndicator()` | REMOVED | Debug menu indicator — debug menu deleted; would recreate a texture per call if ever wired |
| `getDebugJumpHit()` / `showDebugJumpScreen()` | REMOVED | Debug level-jump menu — deleted; `getDebugJumpHit` just delegated to `getReadyScreenHit` |
| `isKillsAlertActive()` | KEEP (live) | Not exported/called; small helper that may be useful |
| `disposePools()` (damage-numbers.js) | KEEP (live) | Pool disposal helper with no caller — useful for page-unload handling |

## pause-menu.js

| Symbol | Status | What it was written for |
|---|---|---|
| `createStatsSection()` + RUN TOTALS panel | KEEP (dormant) | Fully-built run-statistics panel (accuracy donut, damage bars) — never added to the menu group; `updateStatsSectionText` no-ops without it. Wire `createStatsSection()` into `createPauseMenu()` to enable |
| `createPerfButton()` | REMOVED | PERF: ON/OFF toggle wired to `window.frameProfiler`, which no longer exists |
| `PAUSE_MENU_RENDER_ORDER` | REMOVED | Unused constant (real render orders use `PAUSE_PANEL_RENDER_ORDER` etc.) |
| `pauseMenuAnimation.targetSlideIn` | REMOVED | Dead state written but never read; reopening now properly resets `slideIn = 0` |

## desktop-controls.js

| Symbol | Status | What it was written for |
|---|---|---|
| `getPositionString()` | REMOVED | Emitted `{ x, y, z }` for biome spawn positioning (see archive/DEBUG_POSITIONING_TOOL_REPORT.md) — the debug position panel does its own readout |
| `getControlScheme()` | REMOVED | HUD display string; no callers |
| `toggleMode()` | REMOVED | VR/desktop toggle; `window.toggleDesktopMode()` is the live path |
| `weaponState` cooldown/firing flags | KEEP (live) | `leftFiring`/`rightFiring`/`fireCooldown` set but main.js reads only `triggerPressed`/`fireMode` — either consume or delete |

## scoreboard.js

| Symbol | Status | What it was written for |
|---|---|---|
| `testConnection()` / `window.testSupabaseConnection` | KEEP (live, FIXED) | Console diagnostic — the write test used to leave a permanent TESTER row on the live leaderboard; now best-effort deletes its own test row |

## boss-death-cinematic.js

| Symbol | Status | What it was written for |
|---|---|---|
| `getBossDeathFreezeTimer()` | KEEP (live) | Getter for the time-freeze feature; main.js imports the update/shouldFreeze functions but not this getter |
| `window.playBossDeath` hook | REMOVED | Legacy audio hook that was never defined anywhere; real path is `deps.playSkullDeathKnell` |
| Cinematic `console.log`s | FIXED | Now debug-gated (console.log blocks the render thread on Quest) |

## scenery.js / biome-scenes.js / vfx.js

| Symbol | Status | What it was written for |
|---|---|---|
| `initAmbientParticles` / `removeAmbientParticles` + all particle theme configs | KEEP (dormant) | Ambient particle system never initialized — biomes build their own static particles; `updateAmbientParticles` early-returns each frame |
| `logCylinderColors()` (biome-scenes.js) | KEEP (live) | Debug function, never called; references `window.THEMES` which doesn't exist (THEMES is a module export) |
| `vfx.js` file | KEEP (dormant) | Documented extraction seam for voxel VFX (see main.js row) |

---

## Removed-symbol grep checklist (verify with `rg <symbol>` before re-adding)

`BIOME_LIGHTING` · `LASER_RANGE` · `LASER_DURATION` · `seekerProfile` · `_projPosition` ·
`_projQuaternion` · `electricArcs` · `clearConductorArcs` · `clearTargetEnemyArcs` ·
`clearAllElectricArcs` · `updateKeyboardHover` · `updateUpgradeHandHighlights` ·
`updateTitleDebugIndicator` · `getDebugJumpHit` · `showDebugJumpScreen` ·
`createPerfButton` · `PAUSE_MENU_RENDER_ORDER` · `pauseMenuAnimation.targetSlideIn` ·
`getPositionString` · `getControlScheme` · `toggleMode` · `window.playBossDeath`
