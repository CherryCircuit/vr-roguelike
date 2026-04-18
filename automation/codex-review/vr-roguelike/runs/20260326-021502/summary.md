# Nightly Review: 2 actionable findings

- Verdict: **issues found**
- Overall risk: **medium**
- Focus areas: boss projectile cleanup, kill counters/progression

Two changes introduce risk: boss projectile cleanup now skips non-instanced meshes (potential leak/artifacts), and nuked enemies no longer increment `game.totalKills` (possible stat/progression regression).

## Findings (2)

### 1. Boss projectiles may leak if `_instIdx` is missing

- Severity: **high**
- Category: `stability`
- Confidence: `0.63`
- Location: `main.js:8127-9903`
- Impact: If any boss projectile is still backed by a unique mesh (or `_instIdx` isn’t set for some spawn path), the new removal path only calls `releaseBossProjIndex` and skips `scene.remove`/`disposeObject3D`. The projectile is spliced from the array but its mesh remains in the scene, causing invisible collision risks or visible artifacts and a memory leak that can degrade VR performance over time.
- Evidence: All three removal sites now do `if (proj._instIdx !== undefined) releaseBossProjIndex(...)` and then splice, with no fallback removal/dispose when `_instIdx` is undefined (previously always removed/disposed).
- Recommendation: Add a fallback: if `_instIdx` is undefined, remove and dispose the mesh as before. Alternatively, guarantee `_instIdx` is always set for every boss projectile creation path.

### 2. Nuke kills no longer increment `game.totalKills`

- Severity: **medium**
- Category: `correctness`
- Confidence: `0.55`
- Location: `main.js:3352-3376`
- Impact: Total-kill-based stats, unlocks, or end-of-level reporting may undercount nuked enemies, creating progression or UI inconsistencies.
- Evidence: `game.totalKills++` was removed from the nuke loop while `game.kills++` and `trackKill(false)` remain.
- Recommendation: Either restore `game.totalKills++` for nuked enemies or confirm `trackKill(false)` updates `totalKills` and remove other redundant increments for consistency.
