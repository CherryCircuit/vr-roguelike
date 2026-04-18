# Nightly Review: 2 actionable issues found

- Verdict: **issues found**
- Overall risk: **medium**
- Focus areas: correctness, performance, stability

Two issues introduced in this diff are likely to cause incorrect FPS toggle behavior and unnecessary per-frame work in the desert biome update (with lost aurora phase offsets).

## Findings (2)

### 1. FPS toggle is overridden by HUD updates, so the checkbox won’t stick

- Severity: **medium**
- Category: `correctness`
- Confidence: `0.67`
- Location: `hud.js:1953-1959`
- Impact: Users can uncheck “Show FPS counter,” but `updateFPS` reforces visibility from `game.debugShowFPS` on the next update, so the FPS display pops back on. This makes the new debug control ineffective and inconsistent with stored settings.
- Evidence: `updateFPS` forces `fpsSprite.visible = game.debugShowFPS` every refresh, while the debug checkbox only updates `window.debugShowFPS` and calls `setFPSVisible` once (see `index.html` around lines 280–285). There is no bridge from `window.debugShowFPS` to `game.debugShowFPS`.
- Recommendation: On checkbox change, update `game.debugShowFPS` (or provide a HUD setter that updates both state and visibility). Alternatively, have `updateFPS` read the same source the checkbox updates (e.g., `window.debugShowFPS`) to avoid being overwritten.

### 2. Desert aurora update does a per-frame full child scan and loses per-strip phase offsets

- Severity: **low**
- Category: `performance`
- Confidence: `0.58`
- Location: `biome-scenes.js:719-762`
- Impact: Every frame, the update loop scans all `group.children` and does string checks to find aurora strips. This adds avoidable per-frame overhead in a VR hot path. Also, the initial per-strip `uTime` offsets are overwritten each frame, so the intended staggered motion is lost.
- Evidence: Aurora strips are created with a cloned material and `uTime` offset at creation (`strip.material.uniforms.uTime.value = i * 1.8`), but the update loop later sets all strip `uTime` to the same `time` after a full `group.children.forEach` scan.
- Recommendation: Store aurora strips (and their phase offsets) in an array at creation time and update that array directly each frame, e.g., `strip.material.uniforms.uTime.value = time + strip.userData.phaseOffset`. This removes the child scan and preserves the staggered animation.
