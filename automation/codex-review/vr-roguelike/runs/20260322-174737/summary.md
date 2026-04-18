# Nightly Codex Review: 1 actionable issue found

- Verdict: **issues found**
- Overall risk: **medium**
- Focus areas: correctness, runtime stability, performance

Theme-based hiding no longer affects base mountains, so custom biomes that set `hideBaseEnv` will still render mountain meshes. This is a visual correctness regression that can cause overlap/clutter in custom scenes.

## Findings (1)

### 1. Base mountains no longer hide when `theme.hideBaseEnv` is true

- Severity: **medium**
- Category: `correctness`
- Confidence: `0.63`
- Location: `main.js:1151-1202`
- Impact: Custom biomes that rely on `hideBaseEnv` to replace the base environment will still render the default mountain meshes and wirelines. This can cause visible overlap and depth/visual clutter in those scenes, and defeats the intent of the flag.
- Evidence: In `applyThemeForLevel`, `hideBaseEnv` toggles visibility for grid, horizon, sun, atmosphere, stars, etc., but there is no visibility toggle for `mountainLines` (unlike other base env refs). The mountains are created in `createMountains` and stored in `mountainLines`, and are always rendered unless explicitly hidden elsewhere.
- Recommendation: Add a visibility toggle for `mountainLines` when `hideBaseEnv` is true (similar to other base env elements), or explicitly hide them inside `rebuildBiomeScene`/`rebuildBiomeProps` when a custom scene replaces the base environment.
