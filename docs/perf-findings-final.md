# Final Performance Findings Report — Cross-Biome Progression Analysis
**Date:** 2026-04-02  
**Run:** `tests/perf/artifacts/2026-04-02T19-20-16-671Z/progression-run`  
**Status:** Progression run completed successfully (4 biomes, 7 levels)  
**Critical Issue:** Baseline frame time 66-73ms (12-14 FPS) with near-zero gameplay activity

---

## Executive Summary

The progression run completed successfully across 4 biomes (synthwave_valley → desert_night → alien_planet → hellscape_lava) with **zero errors and zero request failures**. However, telemetry reveals a **severe baseline performance problem**: the game runs at only 12-14 FPS even when there are 0 enemies, 0 projectiles, and minimal scene complexity. Frame time degrades progressively from 66.8ms → 73.3ms across biomes (10% increase), and memory grows 42% (21.92MB → 31.2MB), indicating state accumulation or leak patterns.

**The primary issue is not combat stress or enemy density**—it is baseline per-frame overhead that exists even when the game is nearly idle.

---

## Ranked Findings

### 🔴 PRIORITY: NOW — Baseline Frame-Time Crisis

#### Finding 1: Per-Frame Overhead Causing 66-73ms Frame Times with Zero Enemies
**Issue:** The render loop takes 66-73ms per frame even with `counts.enemies: 0`, `projectiles: 0`, and minimal scene activity. This indicates expensive per-frame operations unrelated to gameplay intensity.

**Evidence:**
- **Telemetry across all biomes** shows frameTimeMs.avgHistory between 66.8ms and 73.3ms with 0 enemies and 0 projectiles
- **Renderer stats** show reasonable load: 364-400 draw calls, 87K triangles, 829-833 geometries
- **P95/P99 frame times** hit 100ms ceiling consistently, indicating frames are hitting timeouts
- **FPS averages** 12-14 across all biomes, far below playable threshold

**Biome/Level Context:**
- Synthwave Valley (levels 1-2): 66.8ms avg, 14 FPS
- Desert Night (levels 3-4): 67.9ms avg, 14 FPS  
- Alien Planet (level 5, boss): 69.3ms avg, 13 FPS
- Hellscape Lava (level 6): 70.9ms avg, 13 FPS
- Final (level 7): 73.3ms avg, 12 FPS

**Code Surfaces Inspected:**
- `main.js:10700-11300` — Render loop with multiple per-frame subsystems
- `enemies.js:2231-2381` — Enemy update with multiple behavior branches
- `scenery.js:660-922` — Ambient particle system (60 primary + 30 secondary particles)
- `telemetry.js:1-145` — Telemetry collection overhead

**Likely Culprits (from code inspection):**
1. **Spatial hash rebuild every frame** (`main.js:10815-10825`) — Clears and rebuilds hash for all enemies every frame, even when enemy count is zero
2. **Telemetry collection every frame** (`main.js:11380-11390`) — Calls `collectRuntimeCounts()`, `collectRendererStats()`, `collectHeapStats()` every frame when telemetry enabled
3. **Ambient particle updates** — 90 particles (60 primary + 30 secondary) updated every frame via switch statement with many branches
4. **Multiple subsystem updates** — Decoys, mines, black holes, tethers, nanite swarms, reflector drones, laser mines all checked every frame even when count is 0
5. **HUD update every 3rd frame** — Still expensive if HUD geometry recreation not optimized

**Confidence:** HIGH (artifact-confirmed + code-inspected)

**Recommended Fix Direction:**
1. **Profile the render loop** using Chrome DevTools Performance tab to identify exact hotspots
2. **Guard subsystem updates** — Skip updates for systems with zero active instances (e.g., `if (activeDecoys.length > 0) updateDecoys(...)`)
3. **Optimize spatial hash rebuild** — Only rebuild if enemy positions changed, or use incremental updates
4. **Reduce telemetry overhead** — Sample telemetry every N frames instead of every frame
5. **Flatten particle switch statement** — Use lookup table or function pointer per particle type

**Priority:** NOW — This is the blocker preventing playable framerates

---

#### Finding 2: Progressive Frame-Time Degradation Across Biomes (+10%)
**Issue:** Frame time increases from 66.8ms → 73.3ms (10% degradation) as player progresses through biomes, even though telemetry samples were taken at similar activity levels (0 enemies, 0 projectiles).

**Evidence:**
- **Synthwave Valley:** frameTimeMs.avgHistory = 66.8ms
- **Desert Night:** frameTimeMs.avgHistory = 67.9ms (+1.1ms)
- **Alien Planet:** frameTimeMs.avgHistory = 69.3ms (+2.5ms from start)
- **Hellscape Lava:** frameTimeMs.avgHistory = 70.9ms (+4.1ms from start)
- **Final:** frameTimeMs.avgHistory = 73.3ms (+6.5ms from start, +10%)

**Biome/Level Context:**
- Progressive degradation observed across all 4 biomes
- Each biome transition adds ~1.5-2ms to average frame time
- P95/P99 remain at 100ms ceiling (not biome-specific)

**Code Surfaces Inspected:**
- `biome-scenes.js:1-100` — Biome scene building and switching
- `main.js:11500-11530` — `rebuildBiomeScene()` wrapper
- `game.js` — Level transition and state management

**Likely Culprits:**
1. **Scene graph accumulation** — Biome-specific meshes not fully cleaned between transitions
2. **Material/texture leakage** — Biome themes load new textures/materials that persist in memory
3. **State accumulation** — Game state objects growing across levels (upgrade history, kill tracking, etc.)

**Confidence:** MEDIUM-HIGH (artifact-confirmed pattern, code surfaces identified)

**Recommended Fix Direction:**
1. **Audit biome scene cleanup** — Verify `clearBiomeScene()` disposes all geometries/materials
2. **Track renderer.info.memory** across biome transitions — Should stay flat, not grow
3. **Profile memory snapshots** — Compare heap after each biome transition
4. **Review upgrade/progression state** — Ensure old upgrades aren't retaining references

**Priority:** NOW — Contributes to baseline frame-time crisis

---

#### Finding 3: Memory Growth Across Biomes (+42%, 9.3MB)
**Issue:** JavaScript heap grows from 21.92MB → 31.2MB (42% increase) across biome progression, indicating state accumulation or memory leaks.

**Evidence:**
- **Synthwave Valley:** memory.usedMB = 21.92
- **Desert Night:** memory.usedMB = 23.71 (+1.79MB)
- **Alien Planet:** memory.usedMB = 25.23 (+3.31MB from start)
- **Hellscape Lava:** memory.usedMB = 27.35 (+5.43MB from start)
- **Final:** memory.usedMB = 31.2 (+9.28MB from start, +42%)

**Biome/Level Context:**
- Linear growth pattern across all biomes
- Each biome adds ~2MB to heap
- Growth continues even when gameplay state is minimal (0 enemies, 0 projectiles)

**Code Surfaces Inspected:**
- `biome-scenes.js` — Scene construction and cleanup
- `main.js:clearBiomeScene()` — Cleanup implementation
- `hud.js` — HUD element lifecycle
- `game.js` — State reset on level transitions

**Likely Culprits:**
1. **Biome scene meshes/materials** — Not fully disposed during transitions
2. **HUD elements** — Scoreboard, FPS counter, or other HUD components leaking
3. **Upgrade cards** — Previous upgrade selection UI not cleaned up
4. **Particle system pools** — Ambient particle geometry/texture accumulation

**Confidence:** MEDIUM-HIGH (artifact-confirmed, cleanup audit needed)

**Recommended Fix Direction:**
1. **Heap snapshot diff** — Capture Chrome heap snapshots before/after each biome transition
2. **Audit dispose() calls** — Verify all biome scene meshes call `geometry.dispose()` and `material.dispose()`
3. **Track renderer.info.memory.geometries/textures** — Should reset between biomes, not grow
4. **Review HUD cleanup** — Ensure upgrade card selection UI is destroyed after selection

**Priority:** NOW — Memory growth will cause crashes in longer runs

---

### 🟡 PRIORITY: LATER — Optimization Opportunities

#### Finding 4: Spatial Hash Rebuilt Every Frame (Even When Empty)
**Issue:** The enemy spatial hash is cleared and rebuilt every frame, even when no enemies exist. This adds unnecessary per-frame overhead.

**Evidence:**
- **Code inspection** (`main.js:10815-10825`) shows:
  ```javascript
  enemySpatialHash.clear();
  const enemies = getEnemies();
  for (const e of enemies) {
    if (e.mesh) {
      const pos = e.mesh.position;
      enemySpatialHash.insert(e, pos.x, pos.z);
    }
  }
  ```
- This runs every frame, even when `enemies.length === 0`
- Telemetry shows `counts.enemies: 0` in most samples

**Biome/Level Context:**
- Affects all biomes equally
- Overhead constant regardless of biome or level

**Confidence:** HIGH (code-inspected)

**Recommended Fix Direction:**
- Only rebuild if `enemies.length > 0`
- Or use dirty flags to rebuild only when enemy positions change
- Consider incremental spatial hash updates

**Priority:** LATER — Optimization after baseline frame-time crisis resolved

---

#### Finding 5: Telemetry Collection Every Frame Adds Overhead
**Issue:** When telemetry is enabled, `collectRuntimeCounts()`, `collectRendererStats()`, and `collectHeapStats()` are called every frame, adding measurable overhead.

**Evidence:**
- **Code inspection** (`main.js:11380-11390`) shows telemetry collected every frame when enabled
- `collectRuntimeCounts()` iterates ~20 arrays and constructs object with 24+ properties
- `collectRendererStats()` and `collectHeapStats()` access browser APIs
- Progression run had telemetry enabled for all samples

**Biome/Level Context:**
- Affects all biomes equally
- Overhead constant regardless of gameplay intensity

**Confidence:** MEDIUM (code-inspected, overhead estimated)

**Recommended Fix Direction:**
- Sample telemetry every N frames (e.g., every 3-5 frames)
- Or use rolling average to reduce collection frequency
- Disable in production builds, enable only for perf testing

**Priority:** LATER — Optimization after baseline crisis resolved

---

#### Finding 6: Ambient Particle System Updates 90 Particles Per Frame
**Issue:** The ambient particle system updates 60 primary + 30 secondary particles every frame via a large switch statement with many branches.

**Evidence:**
- **Code inspection** (`scenery.js:660-922`) shows loop over 60-90 particles
- Switch statement handles ~15 particle types (dust, embers, snow, sparkle, corruption, electrons, code_rain, debris, prism, bubbles, etc.)
- Each particle type has unique math (sin/cos operations, position updates)

**Biome/Level Context:**
- Particle type varies by biome theme
- All biomes have at least 60 primary particles active

**Confidence:** MEDIUM (code-inspected, impact estimated)

**Recommended Fix Direction:**
- Flatten switch statement using lookup table
- Pre-compute particle update functions per theme
- Reduce particle count in performance-constrained environments

**Priority:** LATER — Optimization after baseline crisis resolved

---

### 🟢 PRIORITY: ENVIRONMENTAL — Headless/Test Infrastructure

#### Finding 7: No Errors or Request Failures in Progression Run
**Status:** ✅ RESOLVED

**Evidence:**
- `errors.json`: `[]` (empty)
- `request-failures.json`: `[]` (empty)
- Console shows `[audio] Skipping remote streaming audio under automation` — audio guard working
- All biome transitions completed successfully

**Confidence:** HIGH (artifact-confirmed)

**Conclusion:** Audio guard and test infrastructure are working correctly. No action needed.

---

#### Finding 8: Console Logging Reduced (9 instance logs vs hundreds previously)
**Status:** ✅ IMPROVED

**Evidence:**
- **Progression run:** 9 `[basic-instance]` logs in 1647-line console output
- **Previous runs:** Dozens of instance logs per combat volley
- **Scoreboard logs:** 2 `[scoreboard]` logs (Supabase initialization)

**Confidence:** HIGH (artifact-confirmed)

**Conclusion:** Instanced pool logging has been guarded or removed. Minor remaining logs are acceptable for debug builds.

---

## What Was Fixed Since Preliminary Findings

### ✅ Projectile Collision Now Uses Spatial Hash
**Original Finding:** "Projectile collision loop is still O(projectiles × enemies)"  
**Current Status:** Code now uses `enemySpatialHash.query()` to shrink candidate set before raycasting (`main.js:10046-10070`). This addresses the original suspect #1 from preliminary findings.

**Evidence:**
```javascript
const hashed = enemySpatialHash.query(projPos.x, projPos.z, hashRadius);
for (let ei = 0; ei < hashed.length; ei++) {
  const enemy = hashed[ei];
  // Distance check only on hashed candidates
}
```

**Confidence:** HIGH (code-inspected)

---

## Biome-Specific Observations

### Synthwave Valley (Levels 1-2)
- **Frame time:** 66.8ms avg (best performance)
- **Draw calls:** 400 (highest, likely due to synthwave visual elements)
- **Memory:** 21.92MB (baseline)
- **Notes:** Most complex scene visually, but best baseline performance

### Desert Night (Levels 3-4)
- **Frame time:** 67.9ms avg (+1.1ms from synthwave)
- **Draw calls:** 364
- **Memory:** 23.71MB (+1.79MB)
- **Notes:** Slight degradation, likely from biome scene accumulation

### Alien Planet (Level 5, Boss Level)
- **Frame time:** 69.3ms avg (+2.5ms from start)
- **Draw calls:** 364
- **Memory:** 25.23MB (+3.31MB)
- **Notes:** Boss active during telemetry sample, but no boss projectiles or minions spawned

### Hellscape Lava (Level 6)
- **Frame time:** 70.9ms avg (+4.1ms from start)
- **Draw calls:** 364
- **Memory:** 27.35MB (+5.43MB)
- **Notes:** Continued degradation, no biome-specific anomalies detected

### Final State (Level 7)
- **Frame time:** 73.3ms avg (+6.5ms from start, +10%)
- **Draw calls:** 365
- **Memory:** 31.2MB (+9.28MB, +42%)
- **Boss status:** Active with 1 enemy spawned
- **Notes:** Worst performance, consistent with progressive degradation pattern

---

## Recommendations by Priority

### Immediate Actions (NOW)
1. **Profile render loop** — Use Chrome DevTools to identify exact functions consuming 66-73ms per frame
2. **Guard subsystem updates** — Skip updates for systems with zero active instances
3. **Audit biome scene cleanup** — Verify all geometries/materials disposed between biomes
4. **Heap snapshot analysis** — Diff heap snapshots across biome transitions to identify leaks
5. **Target: Reduce baseline frame time to <20ms** before addressing combat-specific optimizations

### Next Wave (LATER)
1. **Optimize spatial hash rebuild** — Only rebuild when enemies exist or positions change
2. **Reduce telemetry overhead** — Sample every N frames instead of every frame
3. **Flatten particle switch statement** — Use lookup table or function pointers
4. **Optimize HUD updates** — Verify geometry reuse instead of recreation

### Environmental (ONGOING)
1. **Maintain audio guard** — Keep headless audio skip logic for test runs
2. **Keep console logs minimal** — Current level is acceptable for debug builds
3. **Monitor memory growth** — Add telemetry alerts if heap exceeds 40MB

---

## Verification Commands

```bash
# Re-run progression test
cd /home/graeme/.openclaw/workspace-codey/vr-roguelike
npm run perf:progression

# Check latest artifacts
ls -la tests/perf/artifacts/$(ls -t tests/perf/artifacts/ | head -1)/

# Profile in browser
# Open Chrome DevTools → Performance tab → Record 10s of gameplay
# Look for functions with >16ms self-time
```

---

## Files Inspected

- `tests/perf/artifacts/2026-04-02T19-20-16-671Z/progression-run/iteration-1/*.json` — Telemetry data
- `main.js:10700-11530` — Render loop, telemetry collection
- `enemies.js:2231-2400, 7580-8200` — Enemy update, boss systems
- `scenery.js:660-922` — Ambient particle system
- `biome-scenes.js:1-100` — Biome scene building
- `telemetry.js:1-145` — Telemetry implementation
- `hud.js` — HUD update patterns (from previous findings)
- `game.js` — State reset/transition logic

---

## Methodology

1. **Artifact analysis:** Inspected telemetry JSON from progression run (4 biomes, 7 levels)
2. **Code inspection:** Read source files for render loop, enemy updates, particle systems
3. **Pattern recognition:** Identified progressive degradation across biomes
4. **Root cause analysis:** Correlated telemetry data with code surfaces
5. **Prioritization:** Ranked by impact (frame-time crisis > degradation > optimization)

---

## Conclusion

The VR roguelike has a **critical baseline performance problem** that must be addressed before any combat-specific optimizations matter. The game runs at 12-14 FPS even when nearly idle, indicating fundamental per-frame overhead in the render loop. Memory growth and frame-time degradation across biomes suggest state accumulation or cleanup issues.

**The path forward:**
1. Profile to identify exact hotspots in render loop
2. Guard subsystem updates for zero-instance cases
3. Fix biome scene cleanup to halt memory/degredation
4. Target 20ms baseline frame time before optimizing combat

All progression infrastructure (audio guard, telemetry, biome transitions) is working correctly. The issue is purely runtime performance, not test harness or architectural problems.
