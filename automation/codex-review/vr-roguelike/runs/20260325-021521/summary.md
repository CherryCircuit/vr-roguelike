# Nightly Review: 2 actionable issues in nuke flow

- Verdict: **issues found**
- Overall risk: **medium**
- Focus areas: Correctness, Runtime stability, VR gameplay progression

Found one high-risk progression bug and one stats correctness bug in the new nuke flow. Both are localized to `main.js` and are straightforward to fix.

## Findings (2)

### 1. Nuke kills can leave the level stuck (no completion check after mass kill)

- Severity: **high**
- Category: `correctness`
- Confidence: `0.48`
- Location: `main.js:3325-3363`
- Impact: If a nuke kills the remaining enemies needed to reach `killTarget`, `completeLevel()` is never called. With no enemies left, the level can stall indefinitely until another kill event occurs (which may never happen).
- Evidence: `activateNuke()` increments `game.kills` in a loop but does not run the same kill-target/level-complete checks used in `handleHit()` and other kill handlers.
- Recommendation: After the loop, run the same completion path used in other kill handlers: update HUD, compute remaining, show kills-remaining alert if needed, and call `completeLevel()` if `game.kills >= cfg.killTarget`. If you want to keep logic centralized, factor the kill-completion check into a helper and call it from both `handleHit()` and `activateNuke()`.

### 2. `game.totalKills` is incremented twice per nuked enemy

- Severity: **medium**
- Category: `correctness`
- Confidence: `0.55`
- Location: `main.js:3353-3359`
- Impact: `game.totalKills` and kill streak stats are double-counted for each nuke kill, inflating run stats and any logic that depends on `totalKills` (e.g., vampiric intervals, streaks).
- Evidence: In `activateNuke()`, each kill does both `game.totalKills++` and `trackKill(false)`, and `trackKill()` already increments `game.totalKills`.
- Recommendation: Remove the explicit `game.totalKills++` in `activateNuke()` and rely on `trackKill(false)` for total kill and streak tracking.
