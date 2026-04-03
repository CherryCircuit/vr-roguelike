# Ruthless Performance Code Audit — VR Roguelike
**Date:** 2026-04-03
**Scope:** Read-only audit of the requested files.

## Cross-reference vs existing docs
- `docs/perf-findings-final.md` and `docs/FIX-PRIORITY-LIST.md` identify baseline 12–14 FPS (66–73ms) with 0 enemies and 0 projectiles.
- **Important contradiction (code appears ahead of the docs):**
  - Spatial hash rebuild: current `main.js` already guards rebuild behind `if (enemies.length > 0)` (see around `main.js:108xx`). So the “rebuild even at 0 enemies” culprit is likely **already fixed** or docs reflect older code.
  - Telemetry: current `shouldCollectTelemetrySample()` samples at **1/6 frame rate** (`frameCount % 6 !== 0`) (see `main.js:11420+`). So the “telemetry every frame” claim is also **already mitigated**.
  - Ambient particle update: current `scenery.js` uses a **lookup table** for per-type update functions, not a giant switch. That fix is **partially implemented**, but there are still per-frame allocations (see below).

Given those mitigations are already present, the baseline 66–73ms is very likely dominated by **other per-frame CPU and allocation hotspots** listed below.

---

## Findings (grouped by file)

## `vr-roguelike/main.js`

1) **Per-frame allocation: `getAdjustedCameraPosition()` creates a new `THREE.Vector3()` every call**
- **Location:** `main.js:450-455`
- **Category:** allocation
- **Severity:** **CRITICAL**
- **Estimated impact:** 1–5ms CPU per frame plus GC pressure. Higher if called multiple times per frame (it is).
- **Why it matters:** Called in the render loop for ambient particles and other systems. Each call allocates a fresh Vector3, guaranteed GC churn.
- **Fix approach:** Reuse a module-level scratch vector, or accept an output param.
- **Snippet:**
  ```js
  450 function getAdjustedCameraPosition() {
  451   const worldPos = new THREE.Vector3();
  452   camera.getWorldPosition(worldPos);
  453   return worldPos;
  454 }
  ```

2) **Render loop does per-frame DOM query and style mutation** (`scanlines` overlay)
- **Location:** `main.js:11388-11390`
- **Category:** redundant
- **Severity:** **CRITICAL**
- **Estimated impact:** 0.5–5ms CPU per frame (can be worse on some browsers), plus potential main-thread style overhead.
- **Why it matters:** `document.getElementById()` in the hot path every frame is unnecessary. Setting `style.display` every frame is also unnecessary when state does not change.
- **Fix approach:** Cache `scanlinesEl` once at init. Only update when `renderer.xr.isPresenting` changes (XR session start/end events).
- **Snippet:**
  ```js
  11388 const scanlinesEl = document.getElementById('scanlines');
  11389 if (scanlinesEl) scanlinesEl.style.display = renderer.xr.isPresenting ? 'none' : '';
  ```

3) **Per-frame debug “visual tuning” work always runs, allocates, and touches many materials**
- **Location:** render loop `main.js:11393-11398`, `getVisualTuning()` at `main.js:1299+`
- **Category:** redundant + allocation + architecture
- **Severity:** **CRITICAL**
- **Estimated impact:** 2–15ms CPU per frame depending on `playerProjectileMaterials.length` and number of tuned materials.
- **Why it matters:** Even if debug UI is not being used, the loop does:
  - a fresh object allocation from `getVisualTuning()` every frame,
  - multiple clamp operations,
  - multiple per-material `userData` checks and writes,
  - per-frame iteration of `playerProjectileMaterials`.
- **Fix approach:**
  - Gate it behind a debug flag.
  - Cache the last tuning values and only apply on change.
  - Replace per-frame object creation with a reused struct.
  - Precompute `baseOpacity` once when registering materials.
- **Snippet:**
  ```js
  11393 const visualTuning = getVisualTuning();
  11394 applyVisualTuning(visualTuning);
  11395 updateVHSRetroShell(now, visualTuning);
  ```

4) **Per-frame closure allocation inside render loop** (`updateKillChainPopups` callback)
- **Location:** `main.js:11353-11361`
- **Category:** allocation
- **Severity:** **HIGH**
- **Estimated impact:** 0.1–1ms CPU per frame plus GC churn, compounded with other allocators.
- **Why it matters:** A new arrow function is created every frame. This is pure overhead, even if there are no popups.
- **Fix approach:** Use a static function defined once, or only pass the callback when `killChainPopups.length > 0`.
- **Snippet:**
  ```js
  11353 updateKillChainPopups(dt, now, (multiplier) => {
  11356   if (game.accuracyMultiplier <= multiplier) {
  11358     game.accuracyBonus = 0;
  11359     game.accuracyMultiplier = 1;
  11360   }
  11361 });
  ```

5) **Bullet-time logic allocates arrays and closures every frame via `filter()` and `some()`**
- **Location:** `main.js:10780-10786`
- **Category:** allocation + redundant
- **Severity:** **HIGH**
- **Estimated impact:** 0.3–3ms CPU per frame even when empty arrays (still allocates).
- **Why it matters:** This runs in PLAYING state. `projectiles.filter(...)` allocates a new array every frame. `.some(...)` uses new closure lambdas each frame.
- **Fix approach:**
  - Avoid `filter` in hot paths. Iterate once and early-exit.
  - Cache arrays lengths first, skip checks entirely when lengths are 0.
  - Prefer `for` loops over `some` for early-exit without closure.
- **Snippet:**
  ```js
  10783 const hostileShotsForRamp = projectiles.filter(isHostileProjectile);
  10784 const anyNear = enemiesForRamp.some(e => ... ) ||
  10785   bossProjsForRamp.some(p => ... ) ||
  10786   hostileShotsForRamp.some(p => ... );
  ```

6) **Shadows enabled globally and a shadow-casting directional light is always active**
- **Location:** `main.js:1013-1040`
- **Category:** Three.js
- **Severity:** **CRITICAL**
- **Estimated impact:** 2–20ms GPU time per frame (or CPU time under SwiftShader/headless), depending on casters, scene complexity, and device.
- **Why it matters:** Shadow mapping adds at least one extra render pass per frame. In VR, this is especially expensive. In headless SwiftShader, it is catastrophic.
- **Fix approach:**
  - Default `renderer.shadowMap.enabled = false` for baseline.
  - Add a quality tier, or only enable shadows in biomes that truly require them.
  - Ensure only a small subset of meshes cast/receive shadows.
- **Snippet:**
  ```js
  1018 renderer.shadowMap.enabled = true;
  1019 renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  1030 biomeDirectionalLight.castShadow = true;
  ```

7) **Renderer created with `antialias: true` and `alpha: true` unconditionally**
- **Location:** `main.js:1013`
- **Category:** Three.js
- **Severity:** **HIGH**
- **Estimated impact:** 1–8ms GPU time per frame, device-dependent.
- **Why it matters:** MSAA and alpha blending both add cost, and alpha can disable certain fast paths.
- **Fix approach:** Add device/quality gates. For Quest/VR consider disabling MSAA, and avoid alpha unless it is required.
- **Snippet:**
  ```js
  1013 renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  ```

8) **Render loop calls `updateAmbientParticles(rawDt, currentTheme, getAdjustedCameraPosition())`**
- **Location:** `main.js:10452-10455`
- **Category:** allocation + redundant
- **Severity:** **HIGH**
- **Estimated impact:** stacked with Finding #1 and ambient particle work. If theme particles enabled, expect 0.5–5ms CPU per frame.
- **Fix approach:**
  - Stop allocating camera vectors (Finding #1).
  - Consider skipping ambient particles in TITLE/menus.
- **Snippet:**
  ```js
  10452 if (currentTheme) {
  10453   updateAmbientParticles(rawDt, currentTheme, getAdjustedCameraPosition());
  10454 }
  ```

9) **Architecture: monolithic render loop with dozens of cross-cutting responsibilities**
- **Location:** `main.js:~10400-11415` (render)
- **Category:** architecture
- **Severity:** **MEDIUM** (enables perf bugs, blocks optimization)
- **Estimated impact:** indirect. In practice, it causes “always-on” debug code and hidden allocations to sneak into the hot path.
- **Fix approach:** Split render loop into explicitly profiled phases, with hard gates per game state and per system activity.

10) **Potential leak and per-frame cost amplifier: `playerProjectileMaterials` grows and is iterated every frame**
- **Location:** `main.js:516`, `main.js:1329-1340`, `main.js:1368-1385`
- **Category:** memory + redundant
- **Severity:** **HIGH**
- **Estimated impact:** frame time grows with run length. The loop cost is O(n) every frame, and materials can be kept alive by references.
- **Why it matters:**
  - Registration uses `includes()` which is O(n) per register.
  - The array has no obvious prune path when materials are disposed, so it can retain dead materials and keep them in the per-frame `forEach`.
  - This aligns with the memory-growth concern in `docs/perf-findings-final.md` (heap growth over progression).
- **Fix approach:**
  - Track active projectile materials per pool and clear on pool dispose.
  - Replace `Array.includes` with a `Set`.
  - Remove disposed materials from the collection.
- **Snippet:**
  ```js
  1338 if (!playerProjectileMaterials.includes(material)) {
  1339   playerProjectileMaterials.push(material);
  1340 }

  1370 playerProjectileMaterials.forEach((mat) => {
  1371   if (!mat) return;
  1372   ...
  1384 });
  ```

11) **High fill-rate default: pixel ratio can still hit 2.0**
- **Location:** `main.js:1015`
- **Category:** Three.js
- **Severity:** **HIGH**
- **Estimated impact:** 1–10ms GPU time per frame depending on resolution. It is a multiplier on everything.
- **Why it matters:** DPR 2 doubles both dimensions, quadruples pixel count. In VR/headless it can be disastrous.
- **Fix approach:** Use a lower cap for VR, or dynamic resolution scaling based on frame time.
- **Snippet:**
  ```js
  1015 renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  ```

---

## `vr-roguelike/desktop-controls.js`

1) **Per-frame allocations: multiple `new THREE.Vector3()` in `update(dt)`**
- **Location:** `desktop-controls.js:238-334`
- **Category:** allocation
- **Severity:** **CRITICAL**
- **Estimated impact:** 2–20ms CPU per frame (this is the kind of allocator that alone can explain 12–14 FPS on SwiftShader).
- **Why it matters:** Called every frame from `main.js` when not presenting XR (`main.js:10467-10470`). It allocates at least:
  - `moveDir`, `forward`, `right`, `up`, `horizontal`, `targetVelocity` per frame.
- **Fix approach:** Pre-allocate scratch vectors at module scope and reuse.
- **Snippet:**
  ```js
  252 const moveDir = new THREE.Vector3();
  255 const forward = new THREE.Vector3();
  256 const right = new THREE.Vector3();
  257 const up = new THREE.Vector3(0, 1, 0);
  303 const horizontal = new THREE.Vector3(moveDir.x, 0, moveDir.z);
  319 const targetVelocity = new THREE.Vector3(horizontal.x, moveDir.y, horizontal.z);
  ```

2) **Always-on heavy desktop movement even when desktop mode is not enabled**
- **Location:** `desktop-controls.js:249-251` (`debugMode` default true), plus `main.js:10467-10470` calls update unconditionally when not in XR
- **Category:** redundant + architecture
- **Severity:** **CRITICAL**
- **Estimated impact:** same scale as Finding #1, because the heavy code path is taken.
- **Why it matters:** `debugMode` is initialized to `true`, and the condition is `if (debugMode || enabled)`. So the expensive movement math runs on desktop even if “desktop controls” are notionally off.
- **Fix approach:** Default `debugMode` false, or make `update()` a no-op unless `enabled` (or unless an explicit debug flag is set).
- **Snippet:**
  ```js
  249 // Allow debug movement whenever desktop mode is available
  250 if (debugMode || enabled) {
  ```

3) **Per-frame clone allocation in return value that is likely unused**
- **Location:** `desktop-controls.js:354-358`
- **Category:** allocation
- **Severity:** **HIGH**
- **Estimated impact:** 0.2–2ms CPU per frame plus GC.
- **Why it matters:** `player.position.clone()` allocates every frame. In `main.js`, the return value is not obviously consumed.
- **Fix approach:** Remove return object, or return stable references, or only compute when needed by callers.
- **Snippet:**
  ```js
  354 return {
  355   moved: player.isMoving,
  356   position: player.position.clone(),
  357   direction: getShootDirection()
  358 };
  ```

4) **If debug position panel is enabled, it raycasts against the entire scene and does many DOM queries every frame**
- **Location:** `desktop-controls.js:701-729`
- **Category:** redundant + Three.js
- **Severity:** **CRITICAL** (when enabled)
- **Estimated impact:** 5–30ms CPU per frame depending on scene size, because `intersectObjects(scene.children, true)` traverses deep.
- **Fix approach:**
  - Cache DOM element refs once.
  - Throttle updates (e.g. 4 Hz).
  - Raycast only against a curated list of pickable meshes, not the entire scene.
- **Snippet:**
  ```js
  704 const posXEl = debugPanelElement.querySelector('#debug-pos-x');
  ...
  727 lookAtRaycaster.setFromCamera({ x: 0, y: 0 }, cameraRef);
  728 const intersects = lookAtRaycaster.intersectObjects(sceneRef.children, true);
  ```

---

## `vr-roguelike/hud.js`

1) **FPS tracking uses `Array.shift()` in the per-frame path**
- **Location:** `hud.js:1930-1939`
- **Category:** redundant
- **Severity:** **MEDIUM** (can be HIGH under slow JS engines)
- **Estimated impact:** 0.1–1ms CPU per frame. `shift()` is O(n) and causes element moves.
- **Fix approach:** Use a ring buffer, or keep simple counters (frames in last 1s) without shifts.
- **Snippet:**
  ```js
  1936 while (fpsFrames.length > 0 && fpsFrames[0] < now - 1000) {
  1937   fpsFrames.shift();
  1938   if (fpsFrameTimes.length > 0) fpsFrameTimes.shift();
  1939 }
  ```

2) **When perf monitor is enabled, frequent string building and `split('\n')` allocations**
- **Location:** `hud.js:1950+`
- **Category:** allocation
- **Severity:** **LOW-MEDIUM**
- **Estimated impact:** small, but shows up as GC spikes every 250ms.
- **Fix approach:** Pre-allocate line buffers, avoid split when possible.

---

## `vr-roguelike/scenery.js`

1) **Per-frame allocation bug: prism particle type creates a new `THREE.Color()` every frame and assigns it**
- **Location:** `scenery.js:857-863`
- **Category:** allocation + Three.js
- **Severity:** **HIGH**
- **Estimated impact:** 0.2–2ms CPU per frame plus steady GC, worse if multiple particle systems do similar work.
- **Fix approach:** Reuse a module-level scratch `Color` or mutate `ambientParticles.material.color.setHSL(...)`.
- **Snippet:**
  ```js
  861 const color = new THREE.Color().setHSL(hue, 1.0, 0.5);
  862 ambientParticles.material.color = color;
  ```

2) **Ambient particle loops are still always-on in gameplay states where they add no value**
- **Location:** `scenery.js:updateAmbientParticles`, called from `main.js:10452-10454`
- **Category:** redundant
- **Severity:** **MEDIUM**
- **Estimated impact:** 0.5–5ms CPU per frame depending on device.
- **Fix approach:** Disable or reduce counts when targeting VR performance, or only enable in biomes that need it.

---

## `vr-roguelike/biome-scenes.js`

1) **Scene traversal per rebuild to register fade materials**
- **Location:** `biome-scenes.js:~70-105`
- **Category:** Three.js
- **Severity:** **LOW** (not per-frame)
- **Estimated impact:** affects biome transition hitching, not baseline FPS.
- **Fix approach:** None urgent. Could register materials during construction instead of traverse.

---

## `vr-roguelike/enemies.js`

1) **InstancedMesh update path sets `instanceMatrix.needsUpdate = true` per enemy**
- **Location:** `enemies.js:2260-2266`
- **Category:** Three.js
- **Severity:** **HIGH**
- **Estimated impact:** 1–10ms CPU/GPU per frame at moderate enemy counts, because it can trigger full buffer uploads many times.
- **Fix approach:**
  - Update matrices for all instances, then set `needsUpdate = true` once per pool per frame.
  - Use `instanceMatrix.updateRange` to upload only the changed range.
- **Snippet:**
  ```js
  2264 e.mesh.userData.instancePool.mesh.setMatrixAt(iid, e.mesh.matrix);
  2265 e.mesh.userData.instancePool.mesh.instanceMatrix.needsUpdate = true;
  ```

2) **Hot-path `traverse()` inside per-enemy updates (multiple behaviors)**
- **Location:** e.g. `enemies.js:2313-2319`, `2344-2351`
- **Category:** Three.js
- **Severity:** **HIGH**
- **Estimated impact:** 1–20ms CPU per frame with multiple enemies, due to scenegraph iteration and function callbacks.
- **Fix approach:**
  - Cache mesh child lists that need material edits.
  - Store direct references to emissive materials.
  - Avoid traverse in update loops.
- **Snippet:**
  ```js
  2315 e.mesh.traverse(c => {
  2316   if (c.isMesh && c.material && !c.userData.isEnemyHitbox) {
  2317     c.material.color.setHex(...);
  2318   }
  2319 });
  ```

3) **Per-event `clone()` allocations for positions used in spawning effects**
- **Location:** `enemies.js:2334-2336`
- **Category:** allocation
- **Severity:** **MEDIUM**
- **Estimated impact:** bursty GC under combat.
- **Fix approach:** Use scratch vectors or pass components.
- **Snippet:**
  ```js
  2335 spawnSonicRing(e.mesh.position.clone(), playerPos);
  ```

---

## `vr-roguelike/audio.js`

1) **HTMLAudio path clones nodes per play (`cloneNode`)**
- **Location:** `audio.js:~65-100` (`playSeekerBurstSound`)
- **Category:** allocation
- **Severity:** **MEDIUM**
- **Estimated impact:** not baseline, but can stutter during burst weapons.
- **Fix approach:** Use a small audio element pool per sound, or use WebAudio buffer source nodes.

---

## `vr-roguelike/game.js`

1) **No clear baseline per-frame hotspots found here**
- **Severity:** LOW
- **Note:** Mostly configuration/state, not in the render hot path.

---

## `vr-roguelike/environment.js`

1) **Biome environment uses many always-visible, non-culled meshes** (`frustumCulled=false` patterns)
- **Location:** multiple creators in this module
- **Category:** Three.js
- **Severity:** **MEDIUM**
- **Estimated impact:** GPU bound, increases draw and fill cost because large objects always render.
- **Fix approach:** Only disable frustum culling for objects that truly need it, or split giant geometry into cullable chunks.

---

## `vr-roguelike/boss-death-cinematic.js`

1) **Per-frame allocations during boss cinematic explosions**
- **Location:** `boss-death-cinematic.js:~260-290`
- **Category:** allocation
- **Severity:** LOW (not baseline)
- **Estimated impact:** cinematic-only.
- **Fix approach:** Optional scratch vectors.

---

## `vr-roguelike/biomes/*.js`

### `biomes/alien-planet.js`
1) **Uses `MeshStandardMaterial` for large terrain**
- **Location:** `alien-planet.js:23-24`
- **Category:** Three.js
- **Severity:** **HIGH**
- **Estimated impact:** 2–15ms GPU time per frame in VR/headless, especially with shadows enabled.
- **Why it matters:** StandardMaterial is among the most expensive common materials in three.js. Combined with global shadows (main.js) this can be a dominant baseline cost.
- **Fix approach:** Prefer `MeshLambertMaterial` or `MeshBasicMaterial` for stylized visuals, or add quality tier that swaps materials.
- **Snippet:**
  ```js
  23 const groundMat = new THREE.MeshStandardMaterial({ ... });
  24 const ground = new THREE.Mesh(groundGeo, groundMat);
  ```

### `biomes/desert-night.js`
1) **Lambert + terrain generation can be fine, but check for shadow/receive flags and material count**
- **Category:** Three.js
- **Severity:** MEDIUM-HIGH
- **Fix approach:** ensure terrain does not cast shadows if not needed; share materials.

### `biomes/hellscape-lava.js`
1) **Known: geometry bloat (already in docs). Additional note: StandardMaterial + shadows multiplies cost**
- **Category:** Three.js
- **Severity:** HIGH

### `biomes/synthwave-valley.js`
1) **Large transparent planes and glows increase sorting and overdraw**
- **Category:** Three.js
- **Severity:** MEDIUM
- **Fix approach:** Reduce transparent layer count, use `alphaTest` where possible, set explicit `renderOrder` and consider `renderer.sortObjects = false` if safe.

---

## Global ranking by expected frame-time impact (baseline)

1) **`desktop-controls.js:update(dt)` per-frame allocations and always-on debugMode** (CRITICAL)
2) **`main.js` per-frame visual tuning apply + per-frame DOM scanlines query** (CRITICAL)
3) **Global shadows enabled + shadow-casting light + StandardMaterials in biome scenes** (CRITICAL)
4) **`main.js:getAdjustedCameraPosition()` allocates per call, used in render loop** (CRITICAL)
5) **`main.js` bullet-time logic `filter/some` allocations in PLAYING** (HIGH)
6) **`scenery.js` prism particle new `THREE.Color()` per frame** (HIGH)
7) **`hud.js` FPS history uses `shift()` and periodic string churn** (MEDIUM)

## What I completed, what remains
- Completed deep read of render-loop surfaces in `main.js`, plus targeted inspection of enemy update hot paths, HUD FPS path, ambient particle update, and biome material choices.
- Did not exhaustively line-by-line audit every helper function in `main.js` or every biome builder loop for mesh counts, but the hotspots above are sufficient to explain a 66–73ms baseline even at 0 enemies.
