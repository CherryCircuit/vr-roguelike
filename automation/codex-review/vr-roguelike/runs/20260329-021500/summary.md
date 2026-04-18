# Nightly Review: VR performance regressions and one correctness risk

- Verdict: **issues found**
- Overall risk: **high**
- Focus areas: VR frame budget, Correctness of cleanup logic, Hot-path performance

I found two high-severity VR performance regressions from newly enabled dynamic shadows, one medium performance miss where the intended terrain decimation wasn’t applied, and one medium correctness risk in electric-arc cleanup tied to unstable enemy indices.

## Findings (4)

### 1. Dynamic shadowing added in Desert Night will likely blow VR frame budget

- Severity: **high**
- Category: `performance`
- Confidence: `0.42`
- Location: `biomes/desert-night.js:20-90`
- Impact: Enabling shadow casting on a point light plus multiple shadow-casting cactus meshes adds a full shadow render pass every frame, which is very expensive in WebXR and likely to cause frame drops on Quest-class hardware.
- Evidence: `shadowLight.castShadow = true` with 1024x1024 shadow map, plus `segment.castShadow = true`/`receiveShadow = true` for cactus meshes in a VR scene.
- Recommendation: Disable dynamic shadows for VR, or gate them behind a desktop-only flag. If you need the look, replace with baked/faked shadow decals or a single projected blob shadow per cactus.

### 2. Hellscape Lava now uses 2048 shadow map with many shadow casters

- Severity: **high**
- Category: `performance`
- Confidence: `0.38`
- Location: `biomes/hellscape-lava.js:18-170`
- Impact: A 2048 shadow map on a directional light plus dozens of rocks and trees casting shadows will significantly increase per-frame GPU cost, risking sustained <72fps in VR.
- Evidence: `moonLight.castShadow = true` with 2048x2048 map and large camera bounds; rocks and branches set `castShadow/receiveShadow = true`.
- Recommendation: Disable shadows in VR, or reduce shadow map size (e.g. 512) and limit shadow casters to a small curated set. Consider static lighting or emissive-only styling for this biome.

### 3. Synthwave terrain decimation intended but not applied

- Severity: **medium**
- Category: `performance`
- Confidence: `0.47`
- Location: `biomes/synthwave-valley.js:63-78`
- Impact: The comment says the grid was reduced to 120x120 to cut vertices 75%, but the geometry still uses 240x240. This keeps the heavier mesh and negates the intended perf win.
- Evidence: Comment says reduced to 120x120, but code still creates `new THREE.PlaneGeometry(2000, 2000, 240, 240)`.
- Recommendation: If the optimization was intended, change the segments to `120, 120` and validate visuals. Otherwise update the comment to avoid misleading future changes.

### 4. Electric arc cleanup uses unstable enemy indices

- Severity: **medium**
- Category: `correctness`
- Confidence: `0.36`
- Location: `enemies.js:2543-3015`
- Impact: Arcs are tagged with `targetEnemyIndex` at creation and cleared when that index is destroyed. Because activeEnemies indices can shift after removals, arcs may fail to clear on the correct death or be cleared when a different enemy dies, leading to visible flicker or lingering arcs.
- Evidence: `targetEnemyIndex = j` at spawn, and `clearTargetEnemyArcs(index)` compares indices. Array indices are not stable identifiers.
- Recommendation: Store a stable id per enemy (e.g., incrementing `enemyId` on spawn) or store a direct reference to the enemy object, and compare that when clearing arcs.
