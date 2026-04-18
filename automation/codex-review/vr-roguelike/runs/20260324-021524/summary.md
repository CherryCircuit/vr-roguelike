# Nightly review: pause menu per-hand stats don’t refresh

- Verdict: **issues found**
- Overall risk: **medium**
- Focus areas: pause menu HUD correctness, runtime UI updates

One correctness issue found: per-hand stats/enemy kill lines in the pause menu are created once and never updated, so values become stale after the first pause menu build.

## Findings (1)

### 1. Pause menu per-hand stats/enemy kills never refresh after initial build

- Severity: **medium**
- Category: `correctness`
- Confidence: `0.62`
- Location: `hud.js:4381-4435`
- Impact: Pause menu shows stale KILLS/SHOTS/HITS/ACC and enemy-type kills after the first time it’s created, which misleads players and makes the new per-hand stats unreliable.
- Evidence: `updateSectionStats` only removes and rebuilds entries tagged `isUpgradeSprite`. The newly added stat lines (`isStatSprite`) and enemy kill lines are created in `createBlasterSection` and never refreshed or removed, so their values freeze at initial creation time.
- Recommendation: Extend `updateSectionStats` to also remove and rebuild stat sprites and enemy-kill entries (or add a dedicated refresh path for those sections). Consider tagging the enemy-kill lines and stat lines with distinct `userData` flags and rebuilding them alongside upgrades.
