# Preliminary Performance Findings — 2026-04-02

## Perf harness snapshot
| Run directory | Scenarios | Result | Notes |
| --- | --- | --- | --- |
| `tests/perf/artifacts/2026-04-02T17-50-06-503Z` | `idle-soak`, `combat-stress`, `restart-churn` | Idle/combat passed, restart-churn timed out on the first reload | `hooks.hasPerfApi` stayed `false`, so telemetry samples were never exposed. Console logs show hundreds of `[basic-instance]` messages per combat volley and repeated Supabase/music chatter. Each scenario reported at least one aborted audio request. |
| `tests/perf/artifacts/2026-04-02T17-52-18-205Z` | `restart-churn` retry | Passed but logged three aborted audio requests per reload cycle | Instrumentation was still not wired (`instrumentation: null`). Renderer stats stayed flat even though we restarted repeatedly, suggesting we cannot observe leaks yet. |
| `tests/perf/artifacts/2026-04-02T18-11-57-723Z` | `idle-soak`, `combat-stress` | Passed with telemetry enabled | `instrumentation.frameTimeMs.avgHistory` stayed near 50 ms even with `counts.enemies ≤ 5` and `projectiles = 0`, so we are CPU bound before the renderer works. `counts.voxelsActive` already reported `2` at `idle-start` even though `kills = 0`, which means restart cleanup leaves pooled voxels alive. Each scenario still logged a single aborted MP3 request before the audio guard landed. |
| `tests/perf/artifacts/2026-04-02T18-33-32-447Z` | `restart-churn` | Passed with telemetry + audio guard | `[audio] Skipping remote streaming audio under automation` confirms the new guard. Telemetry still shows ~50 ms frame times while standing idle, so baseline CPU load has not changed. Supabase + scoreboard logging still fires on every reload. |

_Per instructions these findings are preliminary and code-grounded. No runtime counters beyond the harness exports were available because the telemetry bridge is not wired into the perf runner yet._

## Ranked suspect list

### 1. Projectile collision loop is still `O(projectiles × enemies)`
- **Location:** `main.js`, `updateProjectiles()` lines 9611‑9648.
- **Why it is suspicious:** Every projectile still iterates over **all** active enemies each frame to build `nearbyEnemies`, then raycasts that subset. We already build an `enemySpatialHash` earlier in the frame, but this loop never queries it. When the volley count spikes (e.g., stress tests or alternate weapons), this becomes quadratic. The perf harness’ `combat-stress` trace already shows frame-time spikes when only a handful of enemies are alive, which strongly implicates CPU work outside of rendering.
- **Likely symptoms:** CPU-bound frame dips during heavy fire, especially when seeker rounds or AoE weapons spawn dozens of projectiles. Telemetry would show `frameTimeMs` spikes while `renderer.info.render.calls` remains low (~30‑40, as in current artifacts).
- **Signals to confirm:** Enable telemetry and chart `frameTimeMs` vs `telemetry.counts.projectiles` and `getEnemyCount()`. Instrument `enemySpatialHash` to emit counts to verify how many cells would have been queried if we used it. In perf harness, log how long `updateProjectiles` takes by sampling `performance.now()` around the loop.
- **Confidence:** High.
- **Suggested direction:** Replace the manual distance scan with `enemySpatialHash.query(proj.position, broadRadius)` so each projectile only inspects enemies in overlapping cells. Cache a normalized direction vector per projectile instead of cloning `proj.userData.velocity` for every raycast, and reuse a scratch array to avoid allocations.

### 2. FPS overlay recreates geometry every 250 ms
- **Location:** `hud.js` `updateFPS()` lines 1911‑1992.
- **Why it is suspicious:** Every quarter second we `dispose()` the existing `PlaneGeometry` and construct a new one to match the text aspect ratio. That triggers GPU buffer churn and allocations even though the plane size can be adjusted by tweaking `fpsSprite.scale`. On Desktop the FPS widget is always running, so we are guaranteed four disposals + re-creations per second.
- **Likely symptoms:** Micro hitching and GPU-driver warnings when the perf HUD is visible, especially in VR where context loss is more expensive. Telemetry would show periodic bumps in `frameTimeMs` even when the rest of the scene is idle. Renderer stats would show a stable draw-call count but Chrome’s GPU profiler would report buffer reallocation.
- **Signals to confirm:** Capture a perf trace with the FPS overlay enabled and watch `renderer.info.memory.geometries` — it should stay flat, but if it climbs or oscillates we know the geometry churn is measurable. Headless perf harness can also sample `performance.memory.usedJSHeapSize` to see a sawtooth pattern every 250 ms.
- **Confidence:** High.
- **Suggested direction:** Keep a single `PlaneGeometry` and update `fpsSprite.scale.set(width, height, 1)` when aspect ratio changes. The canvas texture already supports resizing without disposal, so geometry should follow the same pattern.

### 3. Scoreboard rebuild leaks GPU objects and spins a costly re-render timer
- **Location:** `hud.js` `showScoreboard()` lines 3235‑3305, `renderScoreboardCanvas()` lines 3373‑3524, and `makeSprite()`/`makeTextTexture()` lines 188‑299.
- **Why it is suspicious:** Each call to `renderScoreboardCanvas()` allocates a brand new `<canvas>`, `THREE.CanvasTexture`, and often `PlaneGeometry`. When the leaderboard is empty we also `setInterval` a 200 ms redraw loop that keeps creating canvases/textures until the request resolves. `showScoreboard` removes meshes from the group but never disposes the geometries or textures generated by `makeSprite`, so every visit to the screen leaks GPU memory.
- **Likely symptoms:** Memory usage climbs (renderer textures/geometries counts grow) after flipping to the scoreboard multiple times or after a long “loading” spinner. Restart-churn perf runs would slowly eat GPU memory and eventually trigger WebGL context loss.
- **Signals to confirm:** Track `telemetry.renderer.textures` across repeated scoreboard opens. In headless perf runs, script `showScoreboard()` repeatedly via test hooks and record `renderer.info.memory`. Chrome’s `about:gpu` would also show context resets if the leak is severe.
- **Confidence:** Medium-high.
- **Suggested direction:** Reuse a single off-screen canvas and `CanvasTexture`, call `.dispose()` on any sprite textures/geometries when removing them, and throttle the loading spinner by animating via shader uniforms instead of a render timer.

### 4. Instanced enemy pools spam `console.log` on every spawn/despawn
- **Location:** `enemies.js` `acquireBasicInstance()/releaseBasicInstance()` lines 503‑532 and equivalent functions for the `fast`, `tank`, and `swarm` pools.
- **Why it is suspicious:** The instanced pools log every acquisition, release, and “all slots released” event. During combat the perf harness captured dozens of `[basic-instance]` lines per second (see `tests/perf/.../combat-stress/.../console.json`). Console I/O and string formatting are notoriously expensive in headless Chrome and will dominate CPU time before the renderer even gets work.
- **Likely symptoms:** Unbounded console output in perf artifacts, larger `console.json` files, and slower frame times as the JS thread waits on DevTools logging. In the harness we already observe ~200 log lines during a single 6-shot volley.
- **Signals to confirm:** Compare perf runs with DevTools logging enabled vs disabled; frame time should improve when logs are suppressed. Instrumentation could also measure time spent inside `acquireBasicInstance` once the logging is removed.
- **Confidence:** High.
- **Suggested direction:** Guard these logs behind a debug flag (e.g., `if (window.debugInstancing)`), or remove them entirely once the pool was validated. For telemetry, expose the pool fill level via `collectRuntimeCounts()` instead of printing it every frame.

### 5. Audio system downloads multi‑MB MP3s on every reload with no headless guard
- **Location:** `audio.js` `playMusic()`/`playNextTrack()` lines 1379‑1450.
- **Why it is suspicious:** Each restart calls `playMusic()` which shuffles the playlist and instantiates a fresh `new Audio(track)` for every MP3 URL (R2 public bucket). The perf harness reloads the page repeatedly (`restart-churn`), so every cycle triggers multiple full HTTP downloads. We already observe `request-failures.json` entries for each MP3 (all `net::ERR_ABORTED`) because Puppeteer reloads faster than the music can stream. Those blocked requests contribute to the 30‑second navigation timeout we hit in the first run.
- **Likely symptoms:** Slow or stalled reloads, aborted network requests, and wasted bandwidth during automated tests. On slower machines the autoplay rejection also leaves dangling Audio elements, keeping memory alive longer than necessary.
- **Signals to confirm:** Record network panel while hitting restart; the same MP3 URLs will queue every time. In perf harness artifacts, keep an eye on `console.requestFailures` (currently 1‑3 per scenario) and `errors.json` for audio warnings.
- **Confidence:** Medium.
- **Suggested direction:** In headless/test mode skip streaming entirely (stub out `playMusic`), or cache decoded buffers in an `AudioBufferSourceNode` so reloads reuse data. At minimum, gate remote fetches behind a `window.debugAudio` flag during perf runs so navigation is not blocked by aborted audio.

### 6. Telemetry API is not exposed to the perf harness
- **Location:** `main.js` test hook setup lines 793‑809 and `tests/perf/run-perf.mjs` hook detection lines 240‑320, 380‑420.
- **Why it is suspicious:** The runtime exposes telemetry via `window.__test.telemetry`, but the perf runner only looks for `window.__perf`. No bridge is created, so `hooks.hasPerfApi` stays `false`, and every artifact’s `instrumentation` field is `null`. That leaves us blind: even when telemetry is enabled manually we cannot read the rolling `frameTimeMs` samples or runtime counts from Puppeteer.
- **Likely symptoms:** Perf harness summary files contain only renderer stats and heap sizes. There is no way to validate the suspects above with automated data, so regressions go unnoticed until a human reproduces them.
- **Signals to confirm:** Run `window.__test.telemetry.enable()` manually in the browser and check that `window.__perf` still does not exist. Update the harness to call `window.__test.telemetry.snapshot()` and the data gap disappears.
- **Confidence:** High.
- **Suggested direction:** In `main.js`, assign `window.__perf = window.__test.telemetry` (or a read-only proxy). In `run-perf.mjs`, call `window.__test.telemetry.enable()` once the game boots. Persist the snapshot JSON alongside existing artifacts so we can graph frame-time quantiles per scenario.

## Second-wave suspects (2026-04-02 telemetry runs)

### Second-wave 1. Reset path leaves pooled VFX alive for the next run
- **Issue:** `resetGame()` resets the `game` object but never calls `clearAllAltWeaponEffects()`, so pooled voxels, grenades, mines, etc. live into the next session.
- **Evidence:** In `tests/perf/artifacts/2026-04-02T18-11-57-723Z/idle-soak/iteration-1/telemetry-idle-start.json`, telemetry captured immediately after entering `playing` shows `counts.voxelsActive: 2` while `kills: 0` and `projectiles: 0`. These voxels can only exist if a prior run spawned the physics-death system and the arrays were not cleared.
- **Code / region:** `game.js` `resetGame()` (lines 92‑210) vs `main.js` `clearAllAltWeaponEffects()` (lines 7036‑7275). The reset path never invokes the cleanup helper, while level transitions (`completeLevel()`) do.
- **Repro:** Finish any run, restart, and immediately capture telemetry (or call `window.__test.telemetry.snapshot()`). The new game starts with `voxelsActive > 0` and `updateVoxelPhysics()` keeps ticking legacy instances for ~2 seconds, spiking CPU on every restart.
- **Confidence:** High (artifact-confirmed).
- **Fix direction:** Call `clearAllAltWeaponEffects()` (or a narrower helper that clears `activeVoxels`, grenades, drones, etc.) from `resetGame()` and `startGameWithSeed()`. That guarantees pooled meshes are returned before the next run begins.
- **Priority:** Tackle now. It is a slow leak that compounds during restart-churn and creates unnecessary frame-time spikes.

### Second-wave 2. Idle and combat baselines are stuck at ~50 ms frames with almost no activity
- **Issue:** Even with `counts.enemies ≤ 5` and zero projectiles, the render loop never climbs above ~20 FPS. CPU is saturated before the renderer issues 35 draw calls.
- **Evidence:** Both `telemetry-idle-start.json` and `telemetry-idle-15018.json` show `frameTimeMs.avgHistory` between 48‑52 ms with `renderer.drawCalls` 29‑32, `projectiles: 0`, `instancedProjectiles.*.active: 0`, and `counts.enemies` never above 5. The same pattern appears in `tests/perf/.../restart-churn/.../telemetry-restart-1-before.json`. This points to expensive per-frame logic rather than GPU work.
- **Code / region:** `enemies.js` `updateEnemies()` (lines 2231‑2670) runs every behavior branch (mirror knights, portal mantis, spider walkers, conductor links, etc.) for every enemy, even though early levels only spawn `basic`, `fast`, `tank`, and `swarm`. Each branch performs multiple `mesh.traverse()` calls and `Math.random()` work every frame.
- **Repro:** Run `npm run perf:idle` (or the `idle-soak` scenario) without firing a shot. Telemetry will log ~50 ms frame times throughout, confirming the baseline cost.
- **Confidence:** Medium-high (artifact-confirmed, but underlying culprit inferred from code).
- **Fix direction:** Split `updateEnemies()` into light-weight paths for early-tier enemies, cache frequently accessed meshes/material lists instead of calling `traverse()` every frame, and short-circuit feature-specific code when `e.isTrain`, `e.isSpider`, etc. are false. Profiling in Chrome’s Performance tab should target this function first.
- **Priority:** Tackle now. Bringing the baseline below 20 ms per frame is prerequisite for any later combat optimizations.

### Second-wave 3. Scoreboard Supabase client always boots, even when never shown
- **Issue:** `scoreboard.js` creates the Supabase client at module load and logs helper tips on every page initialization. This runs on every reload and keeps bringing in the auth stack, even during perf harness runs that never open the leaderboard.
- **Evidence:** `tests/perf/artifacts/2026-04-02T18-33-32-447Z/restart-churn/iteration-1/console.json` shows `[scoreboard] Supabase client initialized: true` and the “Run window.testSupabaseConnection()” tip four times in the first few seconds, once for each reload. No scoreboard UI was opened during the scenario.
- **Code / region:** `scoreboard.js` top-level `const supabase = createClient(...)` plus `console.log` statements around line 18. The module executes eagerly when bundled, so every reload performs the work.
- **Repro:** Load the game, never open the scoreboard, and reload repeatedly (or run `restart-churn`). Console logs show the initialization spam and Supabase auth still attempts to interact with `localStorage`.
- **Confidence:** Medium.
- **Fix direction:** Move `createClient()` into a lazy `initScoreboard()` that only runs the first time the scoreboard or country picker is shown. For perf harnesses, short-circuit `initScoreboard()` entirely (or run it with `persistSession: false`) when `navigator.webdriver` is true.
- **Priority:** Later/medium. It is not a frame-time regression, but it wastes CPU and network at every reload.

### Second-wave 4. Instanced enemy pool logging still fills the console
- **Issue:** Debug logs in the instanced enemy pools remain enabled and flood the console in every combat run, adding measurable overhead in headless Chrome.
- **Evidence:** `tests/perf/artifacts/2026-04-02T18-11-57-723Z/combat-stress/iteration-1/console.json` records more than 30 `[basic-instance] Acquired slot …` lines during a single scripted volley plus matching “Released slot …” lines. This is identical to the pre-telemetry run and shows the noise is still present after recent fixes.
- **Code / region:** `enemies.js` `acquireBasicInstance`, `releaseBasicInstance`, and the equivalent functions for the other pools (lines 503‑576, 615‑683, etc.). Each contains multiple unconditional `console.log` calls.
- **Repro:** Run the `combat-stress` scenario and inspect `console.json`. The log file size balloons primarily because of these messages.
- **Confidence:** High.
- **Fix direction:** Wrap the logs in a `if (window?.debugInstancing)` guard or remove them. Expose pool utilization via `collectRuntimeCounts()` (already exported) so telemetry can report the same numbers without DevTools I/O.
- **Priority:** Now. Removing the noise immediately reduces scripting cost during combat stress tests.

## Next steps
1. Patch `resetGame()` to call `clearAllAltWeaponEffects()` (and friends), then rerun `restart-churn` to confirm `voxelsActive` stays at zero on fresh spawns.
2. Profile `updateEnemies()` under `idle-soak` to identify which branches dominate the 50 ms frame time, then split or gate the heavy behaviors for early-level enemy types.
3. Remove the instanced pool logging and lazy-load the Supabase scoreboard so perf harness runs no longer waste CPU on console output or unused network clients.
