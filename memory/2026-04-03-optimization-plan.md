# Performance Optimization Master Plan — 2026-04-03

## Current State

| Metric | Value | Target |
|--------|-------|--------|
| Baseline FPS (headless) | ~20 FPS | 50+ FPS |
| Baseline frame time | ~50ms | <20ms |
| Profiled work per frame | ~2.4ms | N/A |
| **Unprofiled gap per frame** | **~46ms** | **<15ms** |
| Hellscape geometries | 198 | <80 |
| Hellscape draw calls | 130-142 | <50 |
| Memory (normal) | 10-20 MB | Stable |
| Memory (anomaly) | 73-74 MB | Eliminate spikes |
| Stability | Zero errors | Maintain |

## The Mystery: Where is the 46ms Going?

Profile buckets account for only 2.4ms/frame. GPU render is 1.9ms/frame. But actual frame time is ~50ms/frame. The remaining ~46ms is in **unprofiled render loop code**.

Likely culprits (in order of probability):
1. **Three.js internal updates** (matrixWorld, bounding box, bounding sphere) across the scene graph before rendering
2. **JS garbage collection** from per-frame allocations creating pressure
3. **desktop-controls.js update()** running expensive math every frame (not profiled)
4. **Enemy AI update** running for all enemies even during idle (not profiled)
5. **Unprofiled sections of the render loop** between instrumented buckets

## Phase 1: Eliminate the 50ms Floor (Highest Impact)

### Fix 1.1: desktop-controls.js — Default debugMode to false
**Complexity:** T3 (trivial) | **Model:** GLM-5-turbo | **File:** `desktop-controls.js:249`
**Impact:** CRITICAL — currently runs heavy Vector3 allocations every frame even when not needed
**Change:** Set `debugMode = false` by default. Only enable when desktop controls are explicitly activated.
**Verify:** Run idle-soak, check frame time drops.

### Fix 1.2: desktop-controls.js — Pre-allocate all scratch vectors
**Complexity:** T3 (light) | **Model:** GLM-5-turbo | **File:** `desktop-controls.js:238-334`
**Impact:** HIGH — eliminates 5+ Vector3 allocations per frame
**Change:** Move `moveDir`, `forward`, `right`, `horizontal`, `targetVelocity` to module scope. Reuse by `.set()` instead of `new`.
**Verify:** Run idle-soak, check frame time.

### Fix 1.3: main.js — Cache scanlines DOM element
**Complexity:** T4 (trivial) | **Model:** GLM-4.7 | **File:** `main.js:11388-11390`
**Impact:** MEDIUM — eliminates DOM query + style write every frame
**Change:** Cache `scanlinesEl` once at init. Only update on XR session change.
**Verify:** Run profile-buckets, check scanlines_misc stays flat.

### Fix 1.4: main.js — Gate visual tuning behind debug flag
**Complexity:** T3 (light) | **Model:** GLM-5-turbo | **File:** `main.js:11393-11398`
**Impact:** HIGH — allocates fresh object + iterates materials every frame
**Change:** Skip `getVisualTuning()`/`applyVisualTuning()` unless debug panel is open. Cache last values and only apply on change.
**Verify:** Run profile-buckets, check visual_tuning drops to 0 when debug off.

### Fix 1.5: main.js — Scratch vector for getAdjustedCameraPosition()
**Complexity:** T4 (trivial) | **Model:** GLM-4.7 | **File:** `main.js:450-455`
**Impact:** HIGH — called multiple times per frame, allocates Vector3 each time
**Change:** Reuse module-level scratch vector instead of `new THREE.Vector3()`.
**Verify:** Run idle-soak, check frame time.

### Fix 1.6: main.js — Eliminate per-frame closures in bullet-time
**Complexity:** T3 (light) | **Model:** GLM-5-turbo | **File:** `main.js:10780-10786`
**Impact:** MEDIUM — filter() + some() allocate arrays and closures every frame
**Change:** Use for loops with early exit. Skip entirely when projectile/enemy counts are 0.
**Verify:** Run combat-stress, check frame time under fire.

### Fix 1.7: scenery.js — Scratch Color for prism particles
**Complexity:** T4 (trivial) | **Model:** GLM-4.7 | **File:** `scenery.js:857-863`
**Impact:** MEDIUM — allocates new THREE.Color() every frame
**Change:** Module-level scratch Color, mutate with `.setHSL()`.
**Verify:** Run idle-soak in a biome that uses prism particles.

### Fix 1.8: Disable shadows by default
**Complexity:** T3 (light) | **Model:** GLM-5-turbo | **File:** `main.js:1018-1019`
**Impact:** CRITICAL — adds full extra render pass, catastrophic in SwiftShader
**Change:** `renderer.shadowMap.enabled = false` by default. Add quality tier that enables for real devices only.
**Verify:** Run idle-soak, check render_gpu drops.

### Fix 1.9: Add more profile buckets to find the 46ms
**Complexity:** T3 (light) | **Model:** GLM-5-turbo | **File:** `main.js` render loop
**Impact:** CRITICAL — without finding where the 46ms goes, we're guessing
**Change:** Add profile buckets around: desktop-controls.update(), enemy update, Three.js render(), matrix updates, any large unprofiled blocks.
**Verify:** Run profile-buckets, identify new hotspots.

## Phase 2: GPU & Rendering Optimization

### Fix 2.1: Hellscape geometry reduction
**Complexity:** T2 (medium) | **Model:** GLM-5 | **File:** `biomes/hellscape-lava.js`
**Impact:** HIGH — 198 geometries, 142 draw calls (4x other biomes)
**Change:** Audit for redundant meshes, merge static geometry, use instancing for repeated elements.
**Verify:** Run progression through hellscape, check geometry/draw call counts.

### Fix 2.2: Replace MeshStandardMaterial with MeshLambertMaterial
**Complexity:** T3 (light) | **Model:** GLM-5-turbo | **File:** `biomes/alien-planet.js:23-24`, other biome files
**Impact:** HIGH — StandardMaterial is the most expensive common Three.js material
**Change:** Switch to Lambert or Basic for stylized visuals. Keep Standard only where PBR is truly needed.
**Verify:** Run progression, check render_gpu drops.

### Fix 2.3: Lower pixel ratio cap
**Complexity:** T4 (trivial) | **Model:** GLM-4.7 | **File:** `main.js:1015`
**Impact:** HIGH — DPR 2 quadruples pixel count
**Change:** Cap at 1.5 or make dynamic based on frame time.
**Verify:** Run idle-soak, check render time.

### Fix 2.4: Disable antialias for headless
**Complexity:** T4 (trivial) | **Model:** GLM-4.7 | **File:** `main.js:1013`
**Impact:** MEDIUM — MSAA adds cost
**Change:** Set `antialias: false` when `navigator.webdriver` is true.
**Verify:** Run profile-buckets, check render_gpu.

## Phase 3: Memory & Stability

### Fix 3.1: Investigate 73MB memory spikes
**Complexity:** T3 (light) | **Model:** GLM-5 | **File:** Likely `main.js` combat or restart paths
**Impact:** HIGH — intermittent 5-6x memory spike
**Change:** Add heap snapshots before/after combat and restart cycles. Look for retained arrays or Three.js objects.
**Verify:** Run combat-stress with heap snapshots, check for leaks.

### Fix 3.2: Fix resetGame() not clearing alt weapon effects
**Complexity:** T3 (light) | **Model:** GLM-5-turbo | **File:** `game.js:92-210`
**Impact:** MEDIUM — voxels persist across restarts (confirmed: voxelsActive > 0 after fresh start)
**Change:** Call `clearAllAltWeaponEffects()` from `resetGame()`.
**Verify:** Run restart-churn, check voxelsActive stays at 0.

### Fix 3.3: Enemy instanceMatrix.needsUpdate — set once per pool
**Complexity:** T3 (light) | **Model:** GLM-5-turbo | **File:** `enemies.js:2264-2265`
**Impact:** MEDIUM — triggers full buffer upload per enemy per frame
**Change:** Update all matrices, then set `needsUpdate = true` once per pool per frame.
**Verify:** Run combat-stress with many enemies, check frame time.

### Fix 3.4: Cache enemy mesh material references (avoid traverse)
**Complexity:** T3 (light) | **Model:** GLM-5-turbo | **File:** `enemies.js:2313-2319`
**Impact:** HIGH — traverse() in hot path with multiple enemies
**Change:** Store direct references to emissive materials at spawn time. Skip traverse in update.
**Verify:** Run combat-stress, check enemy update cost.

## Phase 4: Cleanup

### Fix 4.1: Guard instanced pool logging behind debug flag
**Complexity:** T4 (trivial) | **Model:** GLM-4.7 | **File:** `enemies.js:503-532`
**Impact:** LOW — console noise, minor overhead
**Change:** Wrap in `if (window?.debugInstancing)`.

### Fix 4.2: FPS history — replace Array.shift() with ring buffer
**Complexity:** T4 (trivial) | **Model:** GLM-4.7 | **File:** `hud.js:1936-1939`
**Impact:** LOW — O(n) shift in per-frame path
**Change:** Use index-based ring buffer.

### Fix 4.3: Lazy-load Supabase client
**Complexity:** T4 (trivial) | **Model:** GLM-4.7 | **File:** `scoreboard.js`
**Impact:** LOW — unnecessary init on every reload
**Change:** Move `createClient()` into lazy `initScoreboard()`.

### Fix 4.4: playerProjectileMaterials — use Set, add prune path
**Complexity:** T4 (trivial) | **Model:** GLM-4.7 | **File:** `main.js:516, 1329-1340`
**Impact:** MEDIUM — grows unbounded, iterated every frame
**Change:** Replace array with Set. Clear on pool dispose.

## Execution Order

### Batch 1 (Quick wins, 30 min)
All Phase 1 fixes + Phase 4 fixes. Single GLM-5-turbo worker.
**Expected result:** Frame time drops from 50ms to 25-35ms. 50% of the gap found.

### Batch 2 (Profile the gap, 20 min)
Fix 1.9 (add profile buckets) + run perf harness again.
**Expected result:** Identify where the remaining 15-25ms is going.

### Batch 3 (GPU/rendering, 30 min)
Phase 2 fixes. Single GLM-5 worker.
**Expected result:** Hellscape draw calls cut by 50%, render_gpu drops further.

### Batch 4 (Memory + enemy optimization, 30 min)
Phase 3 fixes. Single GLM-5 worker.
**Expected result:** No more memory spikes, enemy update cost reduced.

### Batch 5 (Verification, 20 min)
Full perf harness re-run. All scenarios, 3 iterations.
**Expected result:** Baseline <20ms/frame, hellscape <40ms/frame, zero errors.

## Bugs Found During Testing

1. **Spawn pool exhaustion** (MEDIUM): In heavy combat (10+ waves), later waves show 0 enemies with 10s timeouts. Spawn rate or pool limits may be too restrictive.
2. **voxelsActive > 0 after fresh start** (MEDIUM): `resetGame()` doesn't clear alt weapon effects. Confirmed in telemetry.
3. **Memory spike to 73MB** (HIGH): Intermittent, happened in 2 of 20+ runs. Likely a leak in combat or restart path.
4. **Player dies during idle soak** (LOW): 60-second idle soak ends with health=0, state=game_over. Enemies are attacking during "idle" test. This is by design but worth noting.

## What We're NOT Fixing

- Boss-specific optimization (need more boss-path hooks for profiling)
- Audio system (already has headless guard)
- Scoreboard GPU leak (medium priority, only triggers on scoreboard open)
- Synthwave transparent overdraw (cosmetic, low impact on perf numbers)
