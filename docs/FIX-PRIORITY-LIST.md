# Performance Fix Priority List
**Date:** 2026-04-02
**Status:** Ready for subagent execution
**Target:** Reduce baseline frame time from 66-73ms to <20ms

## Executive Summary

Two major performance campaigns completed:
1. **Analysis Worker (GLM):** Found baseline crisis - 12-14 FPS with zero enemies
2. **Progression Worker (GLM-5.1):** Proved game is stable across 20 levels, no accumulation

**Key insight:** The game has a baseline overhead problem, not a scaling problem. Once we fix baseline, the game scales cleanly.

---

## PRIORITY 1: Baseline Frame-Time Crisis (NOW)
**Impact:** 66-73ms frame time with 0 enemies, 0 projectiles
**Target:** <20ms baseline
**Model:** GLM-5.1 (complex multi-file optimization)

### Fix 1.1: Spatial Hash Rebuild Every Frame
**Problem:** `main.js:10815-10825` clears and rebuilds spatial hash every frame, even with 0 enemies

**Evidence:**
- Analysis worker found this as #1 baseline culprit
- Code shows `enemySpatialHash.clear()` followed by rebuild every render cycle

**Fix Approach:**
- Only rebuild if enemy positions have changed
- OR use incremental spatial hash updates
- OR guard with `if (enemyCount > 0)`

**Files:** `main.js`
**Confidence:** HIGH
**Verification:** Run idle-soak scenario, check frame time drops

---

### Fix 1.2: Telemetry Collection Overhead
**Problem:** `main.js:11380-11390` calls `collectRuntimeCounts()`, `collectRendererStats()`, `collectHeapStats()` every frame when telemetry enabled

**Evidence:**
- Analysis worker found telemetry iterates over 20+ arrays every frame
- This is measurement overhead, not game overhead

**Fix Approach:**
- Sample telemetry every N frames (e.g., every 10th frame)
- OR throttle collection to once per second
- OR make collection lazy (only when snapshot requested)

**Files:** `main.js`, `telemetry.js`
**Confidence:** HIGH
**Verification:** Run idle-soak with telemetry enabled, check frame time

---

### Fix 1.3: Ambient Particle System
**Problem:** `scenery.js:660-922` updates 90 particles (60 primary + 30 secondary) every frame via expensive switch statement

**Evidence:**
- Analysis worker found particle update as #3 baseline culprit
- Switch statement with many branches per particle

**Fix Approach:**
- Flatten switch statement to lookup table or function pointer
- OR reduce particle count when FPS < 30
- OR batch particle updates

**Files:** `scenery.js`
**Confidence:** MEDIUM-HIGH
**Verification:** Run idle-soak, check particle update cost in profiler

---

### Fix 1.4: Zero-Instance Subsystem Updates
**Problem:** Multiple subsystems (decoys, mines, black holes, tethers, nanite swarms, reflector drones, laser mines) checked every frame even when count is 0

**Evidence:**
- Analysis worker found these as #4 baseline culprit
- Code shows unconditional update calls

**Fix Approach:**
- Guard each subsystem update: `if (activeDecoys.length > 0) updateDecoys(...)`
- OR maintain active subsystem bitmask

**Files:** `main.js`
**Confidence:** HIGH
**Verification:** Run idle-soak, profile subsystem update time

---

## PRIORITY 2: Hellscape Biome Optimization (NOW)
**Impact:** 722 geometries vs 108-166 for other biomes, 2.5-3x draw calls
**Target:** Bring hellscape in line with other biomes
**Model:** GLM-5 (medium complexity scene optimization)

### Fix 2.1: Hellscape Scene Geometry Reduction
**Problem:** Hellscape has 722 geometries, 188 draw calls - far heavier than other biomes

**Evidence:**
- Progression worker found:
  - Synthwave: 108 geometries, 65 draw calls
  - Desert: 162 geometries, 91 draw calls
  - Alien: 166 geometries, 106 draw calls
  - Hellscape: 722 geometries, 188 draw calls
- Frame time nearly doubles in hellscape (92.8ms vs 48.8ms)

**Fix Approach:**
- Audit hellscape scene builder for redundant meshes
- Merge static geometry into fewer meshes
- Use instancing for repeated elements (lava rocks, flames, etc.)
- Reduce particle count or effect complexity

**Files:** `biomes/hellscape-lava.js`, `scenery.js`
**Confidence:** HIGH (artifact-confirmed)
**Verification:** Run progression-run through hellscape, check geometry count

---

## PRIORITY 3: Progressive Degradation Investigation (LATER)
**Impact:** 10% frame time degradation across biomes (66.8ms → 73.3ms)
**Target:** Flat frame time across biome transitions
**Model:** GLM-5 (investigation + potential fixes)

### Fix 3.1: Biome Scene Cleanup Audit
**Problem:** Frame time grows 10% across biome progression, suggesting accumulation

**Evidence:**
- Analysis worker found 10% degradation
- BUT progression worker showed NO geometry/texture accumulation (1,142 → 1,137)
- Contradiction suggests degradation may be SwiftShader overhead, not game

**Fix Approach:**
- First: Verify if degradation happens in non-headless Chrome
- If yes: Audit `clearBiomeScene()` for undisposed resources
- If no: Mark as environmental, deprioritize

**Files:** `biome-scenes.js`, `scenery.js`
**Confidence:** MEDIUM (conflicting evidence)
**Verification:** Run progression in headed Chrome, compare degradation

---

## PRIORITY 4: Enemy Update Optimization (LATER)
**Impact:** Enemy update loop too broad at low counts
**Target:** Sub-linear enemy update cost
**Model:** GLM-5 (after baseline fixes)

### Fix 4.1: Enemy Behavior Branch Gating
**Problem:** `enemies.js/updateEnemies()` runs every advanced behavior branch each frame

**Evidence:**
- Analysis worker found 50ms frame time with only 5 enemies
- Code inspection shows many unconditional behavior branches

**Fix Approach:**
- Gate behavior branches based on enemy state
- Use early returns for irrelevant behaviors
- Profile to identify worst branches

**Files:** `enemies.js`
**Confidence:** MEDIUM-HIGH
**Verification:** Run combat-stress, profile enemy update cost

---

## PRIORITY 5: Cleanup Items (ENVIRONMENTAL/LATER)
**Impact:** Minor, no evidence of real perf impact
**Model:** GLM-4.7 (simple edits)

### Fix 5.1: Scoreboard Supabase Eager Init
**Problem:** Supabase client initializes on every reload

**Evidence:**
- Multiple `[scoreboard] Supabase client initialized` logs per cycle
- No telemetry evidence of perf impact

**Fix Approach:**
- Lazy-load Supabase client
- OR skip in headless/automation mode

**Files:** `scoreboard.js`
**Confidence:** LOW (log noise, no perf evidence)
**Verification:** Check console logs in restart-churn

---

### Fix 5.2: Instanced Pool Logging Spam
**Problem:** `[basic-instance] ...` logging still floods console

**Evidence:**
- Progression worker noted 9 instance logs (reduced from hundreds)
- Annoying but not a perf crisis

**Fix Approach:**
- Remove or guard debug logging
- OR add verbose flag

**Files:** `enemies.js` or pooling code
**Confidence:** LOW (cosmetic)
**Verification:** Check console logs in combat-stress

---

## Execution Plan

### Phase 1: Baseline Crisis (Highest Impact)
**Worker A (GLM-5.1):** Fix spatial hash rebuild + telemetry overhead
**Worker B (GLM-5):** Fix zero-instance subsystem updates
**Worker C (GLM-5):** Fix ambient particle system

**Success criteria:** Idle-soak frame time <20ms with telemetry enabled

---

### Phase 2: Hellscape Optimization
**Worker D (GLM-5):** Reduce hellscape geometry count and draw calls

**Success criteria:** Hellscape geometries <200, draw calls <100, frame time <60ms

---

### Phase 3: Verification
**Worker E (GLM-4.7):** Re-run all scenarios, verify no regressions, update findings doc

**Success criteria:** All scenarios pass, frame times improved across board

---

## What We're NOT Fixing (Yet)

- Boss-specific optimization (need more boss-path hooks)
- Upgrade system optimization (no evidence of impact)
- Audio system optimization (already fixed in earlier pass)
- Projectile system (already optimized with spatial hash)

---

## Expected Impact

If Phase 1 succeeds:
- Baseline frame time: 66-73ms → <20ms
- FPS with zero enemies: 12-14 → 50+
- Hellscape frame time: 92ms → ~40ms (still heavy, but playable)

If Phase 2 succeeds:
- Hellscape frame time: ~40ms → ~30ms
- Hellscape geometries: 722 → <200

**Combined target:** 50+ FPS in all biomes with moderate enemy counts

---

## Notes

- All fixes should be verified with `node --check` on touched files
- All fixes should be verified with perf scenario reruns
- Do not push or commit without Graeme's approval
- GLM workers should follow Codey's worker contract: inspect, implement, verify, report

🐵 Ready for execution.
