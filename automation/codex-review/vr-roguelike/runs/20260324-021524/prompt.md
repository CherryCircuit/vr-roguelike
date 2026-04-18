# Nightly Codex Review

You are performing a nightly automated review for the `vr-roguelike` repository.

Your job is to find high-value, actionable issues in the supplied diff and nearby code context.

## Review priorities

Prioritize findings in this order:
1. Correctness bugs and regressions
2. Runtime stability issues and console-error risks
3. Performance hotspots, especially VR or per-frame costs
4. Wasteful code paths, repeated work, and unnecessary allocations
5. Maintainability issues that materially increase bug risk
6. Security issues, if the changed code creates realistic exposure

## Project-specific rules

This is a WebXR VR game. Performance matters.

Focus especially on:
- per-frame object allocation
- repeated scans over large arrays in hot paths
- unnecessary DOM or HUD updates every frame
- expensive math in update loops
- state-machine regressions during pause, level transitions, death, restart, and boss phases
- stale pooled-object state
- missing cleanup on level transition or reset
- controller-specific or XR-session-specific null/undefined risks

## Findings policy

Only report actionable findings.

Do not report:
- cosmetic style issues
- tiny refactors without clear payoff
- naming preferences
- speculative concerns without evidence
- issues that already existed outside the supplied change unless the change makes them worse

For each finding:
- cite the exact file path
- cite the exact line range if you can verify it from the provided diff/context
- explain the impact briefly and concretely
- suggest a fix only if it is reasonably clear
- keep the wording direct and specific

## Severity guide

- `critical`: crash, save/progression break, security exposure, or severe performance cliff
- `high`: likely bug, serious regression, or hot-path waste that will matter in play
- `medium`: real maintainability/performance/correctness issue worth fixing soon
- `low`: minor but valid issue with clear practical value

## Output expectations

Favor fewer, better findings over many weak ones.
If there are no meaningful findings, say so in the structured output rather than inventing noise.

## Review context
- Repository: /home/graeme/.openclaw/workspace-codey/vr-roguelike
- Branch: main
- Base SHA: b04f5086436a472120c5cb7c7b7827e798ea0172
- Head SHA: acba39b5724712d155b01abc03672df76329d532
- Commit count in scope: 17
- Include uncommitted changes: 1

## Changed files
 .codex/review/nightly-review-schema.json                                                     |   60 +++
 .codex/review/nightly-review-template.md                                                     |   59 +++
 AGENTS.md                                                                                    |   11 +
 RAYCASTER_OPTIMIZATION.md                                                                    |  105 ++++
 BIOME_SAFETY_CHECK.md => archive/BIOME_SAFETY_CHECK.md                                       |    0
 BIOME_UPGRADE_REPORT.md => archive/BIOME_UPGRADE_REPORT.md                                   |    0
 BIOME_UPGRADE_SUMMARY.md => archive/BIOME_UPGRADE_SUMMARY.md                                 |    0
 BOSS_ARCHITECTURE.md => archive/BOSS_ARCHITECTURE.md                                         |    0
 BOSS_DIAGRAMS.md => archive/BOSS_DIAGRAMS.md                                                 |    0
 BOSS_QUICK_REFERENCE.md => archive/BOSS_QUICK_REFERENCE.md                                   |    0
 BRANCH_ANALYSIS.md => archive/BRANCH_ANALYSIS.md                                             |    0
 archive/BRANCH_PRESERVATION_MANIFEST_2026-03-23.md                                           |   99 ++++
 CREATIVE_EXPANSION_PLAN.md => archive/CREATIVE_EXPANSION_PLAN.md                             |    0
 DEBUG_POSITIONING_QUICK_REFERENCE.md => archive/DEBUG_POSITIONING_QUICK_REFERENCE.md         |    0
 DEBUG_POSITIONING_TOOL_REPORT.md => archive/DEBUG_POSITIONING_TOOL_REPORT.md                 |    0
 ENEMY_IMPLEMENTATION_STATUS.md => archive/ENEMY_IMPLEMENTATION_STATUS.md                     |    0
 FIXES_APPLIED.md => archive/FIXES_APPLIED.md                                                 |    0
 FIX_SUMMARY.md => archive/FIX_SUMMARY.md                                                     |    0
 IMPLEMENTATION_SUMMARY.md => archive/IMPLEMENTATION_SUMMARY.md                               |    0
 INSTRUCTION_1_WEAPONS.md => archive/INSTRUCTION_1_WEAPONS.md                                 |    0
 INSTRUCTION_2_FPS_MONITOR.md => archive/INSTRUCTION_2_FPS_MONITOR.md                         |    0
 INSTRUCTION_3_KEYBOARD_MOUSE.md => archive/INSTRUCTION_3_KEYBOARD_MOUSE.md                   |    0
 INSTRUCTION_4_GLTF_SPHERE.md => archive/INSTRUCTION_4_GLTF_SPHERE.md                         |    0
 INSTRUCTION_5_BOSS_FIGHTS.md => archive/INSTRUCTION_5_BOSS_FIGHTS.md                         |    0
 INSTRUCTION_6_SUPABASE_PERFORMANCE.md => archive/INSTRUCTION_6_SUPABASE_PERFORMANCE.md       |    0
 LEVEL_5_BOSSES_FINAL_REPORT.md => archive/LEVEL_5_BOSSES_FINAL_REPORT.md                     |    0
 LEVEL_5_BOSSES_IMPLEMENTATION_SUMMARY.md => archive/LEVEL_5_BOSSES_IMPLEMENTATION_SUMMARY.md |    0
 LEVEL_5_BOSSES_TEST_CHECKLIST.md => archive/LEVEL_5_BOSSES_TEST_CHECKLIST.md                 |    0
 LOCAL_TESTING.md => archive/LOCAL_TESTING.md                                                 |    0
 LOCAL_TEST_CHECKLIST.md => archive/LOCAL_TEST_CHECKLIST.md                                   |    0
 MISSING_FEATURES.md => archive/MISSING_FEATURES.md                                           |    0
 PERFORMANCE_FIXES.md => archive/PERFORMANCE_FIXES.md                                         |    0
 PERFORMANCE_IMPLEMENTATION.md => archive/PERFORMANCE_IMPLEMENTATION.md                       |    0
 PHYSICS_DEATH_IMPLEMENTATION.md => archive/PHYSICS_DEATH_IMPLEMENTATION.md                   |    0
 REFACTOR_SUMMARY.md => archive/REFACTOR_SUMMARY.md                                           |    0
 RESEARCH_BIOMES_ALT.md => archive/RESEARCH_BIOMES_ALT.md                                     |    0
 SCOREBOARD_README.md => archive/SCOREBOARD_README.md                                         |    0
 SCOREBOARD_TROUBLESHOOTING.md => archive/SCOREBOARD_TROUBLESHOOTING.md                       |    0
 SHOOTABLE_PROJECTILES_FEATURE.md => archive/SHOOTABLE_PROJECTILES_FEATURE.md                 |    0
 SUN_FIX_SUMMARY.md => archive/SUN_FIX_SUMMARY.md                                             |    0
 SUPABASE_SETUP.md => archive/SUPABASE_SETUP.md                                               |    0
 TESTING_GUIDE.md => archive/TESTING_GUIDE.md                                                 |    0
 TEST_CHECKLIST.md => archive/TEST_CHECKLIST.md                                               |    0
 TEST_CHECKLIST_PROJECTILE_FIX.md => archive/TEST_CHECKLIST_PROJECTILE_FIX.md                 |    0
 UI_HOVER_TEST_CHECKLIST.md => archive/UI_HOVER_TEST_CHECKLIST.md                             |    0
 WEAPON_ARCHITECTURE.md => archive/WEAPON_ARCHITECTURE.md                                     |    0
 WEAPON_DIAGRAMS.md => archive/WEAPON_DIAGRAMS.md                                             |    0
 WEAPON_INTEGRATION_PLAN.md => archive/WEAPON_INTEGRATION_PLAN.md                             |    0
 WEAPON_QUICK_REFERENCE.md => archive/WEAPON_QUICK_REFERENCE.md                               |    0
 WEAPON_SYSTEM_STATUS.md => archive/WEAPON_SYSTEM_STATUS.md                                   |    0
 fog-check.mjs => archive/dev-scraps/fog-check.mjs                                            |    0
 hud.js.backup => archive/dev-scraps/hud.js.backup                                            |    0
 object-pool.js => archive/dev-scraps/object-pool.js                                          |    0
 old_main.txt => archive/dev-scraps/old_main.txt                                              |    0
 patch_diagnostic.ps1 => archive/dev-scraps/patch_diagnostic.ps1                              |    0
 patch_main.ps1 => archive/dev-scraps/patch_main.ps1                                          |    0
 patch_main_2.ps1 => archive/dev-scraps/patch_main_2.ps1                                      |    0
 patch_visuals.ps1 => archive/dev-scraps/patch_visuals.ps1                                    |    0
 performance.js => archive/dev-scraps/performance.js                                          |    0
 temp_imports.txt => archive/dev-scraps/temp_imports.txt                                      |    0
 test-imports.html => archive/dev-scraps/test-imports.html                                    |    0
 test-projectile-hits.js => archive/dev-scraps/test-projectile-hits.js                        |    0
 test-server.js => archive/dev-scraps/test-server.js                                          |    0
 test-server.log => archive/dev-scraps/test-server.log                                        |    0
 test-tracker.js => archive/dev-scraps/test-tracker.js                                        |    0
 test-tracking.json => archive/dev-scraps/test-tracking.json                                  |    0
 scenery-upgrade-plan.md => archive/scenery-upgrade-plan.md                                   |    0
 deployed-screenshot.png => archive/screenshots/deployed-screenshot.png                       |  Bin
 archive/screenshots/game-screenshot.png                                                      |  Bin 0 -> 532852 bytes
 game-screenshot2.png => archive/screenshots/game-screenshot2.png                             |  Bin
 game-screenshot3.png => archive/screenshots/game-screenshot3.png                             |  Bin
 game-screenshot4.png => archive/screenshots/game-screenshot4.png                             |  Bin
 puppeteer-after-click.png => archive/screenshots/puppeteer-after-click.png                   |  Bin
 puppeteer-final.png => archive/screenshots/puppeteer-final.png                               |  Bin
 puppeteer-screenshot.png => archive/screenshots/puppeteer-screenshot.png                     |  Bin
 test-1-title.png => archive/screenshots/test-1-title.png                                     |  Bin
 test-2-after-click.png => archive/screenshots/test-2-after-click.png                         |  Bin
 test-3-state-check.png => archive/screenshots/test-3-state-check.png                         |  Bin
 test-after-mouse.png => archive/screenshots/test-after-mouse.png                             |  Bin
 test-after-rapid-fire.png => archive/screenshots/test-after-rapid-fire.png                   |  Bin
 test-after-shooting.png => archive/screenshots/test-after-shooting.png                       |  Bin
 test-after-space.png => archive/screenshots/test-after-space.png                             |  Bin
 test-comprehensive-result.png => archive/screenshots/test-comprehensive-result.png           |  Bin
 test-enemies-spawned.png => archive/screenshots/test-enemies-spawned.png                     |  Bin
 test-enemies.png => archive/screenshots/test-enemies.png                                     |  Bin
 test-final-result.png => archive/screenshots/test-final-result.png                           |  Bin
 test-final.png => archive/screenshots/test-final.png                                         |  Bin
 test-gameplay-start.png => archive/screenshots/test-gameplay-start.png                       |  Bin
 test-projectile-hits.png => archive/screenshots/test-projectile-hits.png                     |  Bin
 archive/screenshots/test-result.png                                                          |  Bin 0 -> 511212 bytes
 upgrades.js => archive/upgrades.js.archived                                                  |    0
 biome-scenes.js                                                                              | 1302 ++++++++++++++++++++++++++++++++++++++++++++++
 boss-death-cinematic.js                                                                      |  288 +++++++++++
 desktop-controls.js                                                                          |   21 +-
 enemies.js                                                                                   |   22 +-
 environment.js                                                                               |    5 +
 game-screenshot.png                                                                          |  Bin 538929 -> 569981 bytes
 game.js                                                                                      |   35 +-
 hud.js                                                                                       |  445 ++++++++++------
 index.html                                                                                   |  100 +++-
 investigation-projectile-pool-sharing.md                                                     |  244 +++++++++
 main.js                                                                                      | 2783 +++++++++++++++++++++++++++++---------------------------------------------------------------------
 scenery.js                                                                                   |   20 +-
 worker-monitor.js => scripts/worker-monitor.js                                               |    8 +-
 test-result.png                                                                              |  Bin 387277 -> 0 bytes
 test-game-comprehensive.js => tests/automation/test-game-comprehensive.js                    |    0
 test-game.js => tests/automation/test-game.js                                                |    2 +-
 supabase-test.js => tests/manual/supabase-test.js                                            |    0
 test-desktop-controls.js => tests/manual/test-desktop-controls.js                            |    0
 vfx.js                                                                                       |  241 +--------
 110 files changed, 3482 insertions(+), 2368 deletions(-)

## Unified diff
diff --git a/.codex/review/nightly-review-schema.json b/.codex/review/nightly-review-schema.json
new file mode 100644
index 0000000..cf7c462
--- /dev/null
+++ b/.codex/review/nightly-review-schema.json
@@ -0,0 +1,60 @@
+{
+  "$schema": "http://json-schema.org/draft-07/schema#",
+  "type": "object",
+  "additionalProperties": false,
+  "properties": {
+    "headline": { "type": "string", "minLength": 1 },
+    "overall_risk": {
+      "type": "string",
+      "enum": ["none", "low", "medium", "high", "critical"]
+    },
+    "verdict": {
+      "type": "string",
+      "enum": ["no material issues found", "issues found"]
+    },
+    "summary": { "type": "string", "minLength": 1 },
+    "focus_areas": {
+      "type": "array",
+      "items": { "type": "string", "minLength": 1 },
+      "maxItems": 8
+    },
+    "findings": {
+      "type": "array",
+      "items": {
+        "type": "object",
+        "additionalProperties": false,
+        "properties": {
+          "title": { "type": "string", "minLength": 1, "maxLength": 120 },
+          "category": {
+            "type": "string",
+            "enum": ["correctness", "performance", "stability", "maintainability", "security", "waste"]
+          },
+          "severity": {
+            "type": "string",
+            "enum": ["low", "medium", "high", "critical"]
+          },
+          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
+          "file": { "type": "string", "minLength": 1 },
+          "start_line": { "type": "integer", "minimum": 1 },
+          "end_line": { "type": "integer", "minimum": 1 },
+          "impact": { "type": "string", "minLength": 1 },
+          "evidence": { "type": "string", "minLength": 1 },
+          "recommendation": { "type": "string", "minLength": 1 }
+        },
+        "required": [
+          "title",
+          "category",
+          "severity",
+          "confidence",
+          "file",
+          "start_line",
+          "end_line",
+          "impact",
+          "evidence",
+          "recommendation"
+        ]
+      }
+    }
+  },
+  "required": ["headline", "overall_risk", "verdict", "summary", "focus_areas", "findings"]
+}
diff --git a/.codex/review/nightly-review-template.md b/.codex/review/nightly-review-template.md
new file mode 100644
index 0000000..11a0647
--- /dev/null
+++ b/.codex/review/nightly-review-template.md
@@ -0,0 +1,59 @@
+# Nightly Codex Review
+
+You are performing a nightly automated review for the `vr-roguelike` repository.
+
+Your job is to find high-value, actionable issues in the supplied diff and nearby code context.
+
+## Review priorities
+
+Prioritize findings in this order:
+1. Correctness bugs and regressions
+2. Runtime stability issues and console-error risks
+3. Performance hotspots, especially VR or per-frame costs
+4. Wasteful code paths, repeated work, and unnecessary allocations
+5. Maintainability issues that materially increase bug risk
+6. Security issues, if the changed code creates realistic exposure
+
+## Project-specific rules
+
+This is a WebXR VR game. Performance matters.
+
+Focus especially on:
+- per-frame object allocation
+- repeated scans over large arrays in hot paths
+- unnecessary DOM or HUD updates every frame
+- expensive math in update loops
+- state-machine regressions during pause, level transitions, death, restart, and boss phases
+- stale pooled-object state
+- missing cleanup on level transition or reset
+- controller-specific or XR-session-specific null/undefined risks
+
+## Findings policy
+
+Only report actionable findings.
+
+Do not report:
+- cosmetic style issues
+- tiny refactors without clear payoff
+- naming preferences
+- speculative concerns without evidence
+- issues that already existed outside the supplied change unless the change makes them worse
+
+For each finding:
+- cite the exact file path
+- cite the exact line range if you can verify it from the provided diff/context
+- explain the impact briefly and concretely
+- suggest a fix only if it is reasonably clear
+- keep the wording direct and specific
+
+## Severity guide
+
+- `critical`: crash, save/progression break, security exposure, or severe performance cliff
+- `high`: likely bug, serious regression, or hot-path waste that will matter in play
+- `medium`: real maintainability/performance/correctness issue worth fixing soon
+- `low`: minor but valid issue with clear practical value
+
+## Output expectations
+
+Favor fewer, better findings over many weak ones.
+If there are no meaningful findings, say so in the structured output rather than inventing noise.
diff --git a/AGENTS.md b/AGENTS.md
index 5fbdc36..e32ef97 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -353,10 +353,21 @@ if (enemy && enemy.position) {
 if (controller?.userData?.weapon?.fire) {
   controller.userData.weapon.fire();
 }
 ```
 
+## Review guidelines
+
+When running automated code review on this repository:
+
+- Prioritize correctness, runtime stability, and VR performance over style.
+- Treat per-frame allocations, repeated full-array scans in hot paths, and missed cleanup on reset or level transitions as high-value findings.
+- Flag console-error risks, null/undefined controller or XR-session access, and state-machine regressions around pause, restart, death, and boss transitions.
+- Ignore cosmetic naming or formatting feedback unless it blocks understanding or hides a bug.
+- Prefer a few precise findings with file and line references over broad advice.
+- Call out duplicate logic only when it creates real maintenance or bug risk.
+
 ## 15. FINAL REMINDER
 
 **You are building a VR game that people play in headsets.**
 
 - Every frame drop causes motion sickness
diff --git a/RAYCASTER_OPTIMIZATION.md b/RAYCASTER_OPTIMIZATION.md
new file mode 100644
index 0000000..8404edc
--- /dev/null
+++ b/RAYCASTER_OPTIMIZATION.md
@@ -0,0 +1,105 @@
+# UI Hover Raycaster Pooling Optimization
+
+## What Raycaster Allocations Were Found
+
+### Hot Path (Fixed)
+**Line 9680** (now ~9693 after edits): Unified UI hover detection in render loop
+- Created new `THREE.Raycaster()` per controller per frame
+- Created new `THREE.Vector3()` for origin per controller per frame
+- Created new `THREE.Quaternion()` for rotation per controller per frame
+- Created new `THREE.Vector3()` for direction per controller per frame
+- **Impact**: At 60fps with 2 controllers = 480 allocations/second
+- **States affected**: TITLE, UPGRADE_SELECT, SCOREBOARD, REGIONAL_SCORES, COUNTRY_SELECT, READY_SCREEN, NAME_ENTRY
+
+### Event Handlers (Not Changed)
+**Lines 2590, 2920, 2968, 3001, 3129**: Event handler allocations
+- These are in trigger press handlers (not called every frame)
+- Low frequency (user-triggered, maybe 1-2 per second max)
+- Not worth optimizing for this task
+
+## What Was Changed
+
+### 1. Added Pooled Objects (main.js lines 273-279)
+```javascript
+// Pooled UI hover raycasters for controller/desktop hover detection
+// Avoids creating new Raycaster/Vector3/Quaternion every frame in menu states
+const _uiHoverRaycasters = [new THREE.Raycaster(), new THREE.Raycaster()];
+const _uiHoverOrigins = [new THREE.Vector3(), new THREE.Vector3()];
+const _uiHoverQuats = [new THREE.Quaternion(), new THREE.Quaternion()];
+const _uiHoverDirs = [new THREE.Vector3(), new THREE.Vector3()];
+```
+
+### 2. Modified Hot Path (main.js lines 9673-9710)
+**Before** (allocating every frame):
+```javascript
+const raycasters = [];
+for (let i = 0; i < controllers.length; i++) {
+  const origin = new THREE.Vector3();
+  const quat = new THREE.Quaternion();
+  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
+  raycasters.push(new THREE.Raycaster(origin, dir, 0, 10));
+}
+```
+
+**After** (reusing pooled objects):
+```javascript
+const raycasters = [];
+for (let i = 0; i < controllers.length; i++) {
+  const origin = _uiHoverOrigins[i];
+  const quat = _uiHoverQuats[i];
+  const dir = _uiHoverDirs[i];
+  ctrl.getWorldPosition(origin);
+  ctrl.getWorldQuaternion(quat);
+  dir.set(0, 0, -1).applyQuaternion(quat);
+  const rc = _uiHoverRaycasters[i];
+  rc.set(origin, dir, 0, 10);
+  raycasters.push(rc);
+}
+```
+
+## Files Changed
+- `main.js` (2 sections modified, ~15 lines total)
+
+## Exact QA Steps Run
+1. Syntax check: `node -c main.js` ✓
+2. Started localhost server: `python3 -m http.server 8000` ✓
+3. Verified server responds: `curl http://localhost:8000/index.html` (HTTP 200) ✓
+4. Ran Puppeteer test: `node test-game.mjs` ✓
+   - **0 page errors**
+   - Game initialized successfully
+   - All console messages normal (initialization logs only)
+   - Desktop mode enabled correctly
+   - Game started from title screen
+
+## Performance Impact
+- **Before**: 480 object allocations/second (2 controllers × 4 objects × 60fps)
+- **After**: 0 allocations/second (pooled objects reused)
+- **GC Pressure**: Eliminated in UI hover hot path
+- **Affected scenarios**:
+  - Title screen navigation
+  - Upgrade selection menu
+  - Scoreboard browsing
+  - Regional scores navigation
+  - Country selection
+  - **Scoreboard keyboard name entry** (specifically mentioned as performance pain point)
+
+## Final Status: PASS ✓
+
+## Handoff Note: Safe to Queue Next Worker
+✅ **YES** - Safe to queue the next worker for hot-path temp Vector3 reuse
+
+**Rationale**:
+- This optimization was conservative and focused only on UI hover raycasters
+- Zero impact on gameplay systems (weapons, enemies, projectiles)
+- Behavior preserved exactly (same raycast calculations, just reused objects)
+- QA passed with 0 errors
+- Pattern established: pooled objects at module level, reuse in render loop
+
+**Recommended next hot-path targets** (if continuing optimization):
+1. Desktop aim raycaster in desktop-controls.js (if called every frame)
+2. Temporary vectors in projectile update loops (already partially optimized with _proj* objects)
+3. Enemy spawn/update loops (check for temp vector allocations)
+
+**NOT recommended for next worker**:
+- Gameplay raycasters (weapon systems, enemy AI) - higher risk, needs careful testing
+- Event handler allocations - low frequency, minimal impact
diff --git a/BIOME_SAFETY_CHECK.md b/archive/BIOME_SAFETY_CHECK.md
similarity index 100%
rename from BIOME_SAFETY_CHECK.md
rename to archive/BIOME_SAFETY_CHECK.md
diff --git a/BIOME_UPGRADE_REPORT.md b/archive/BIOME_UPGRADE_REPORT.md
similarity index 100%
rename from BIOME_UPGRADE_REPORT.md
rename to archive/BIOME_UPGRADE_REPORT.md
diff --git a/BIOME_UPGRADE_SUMMARY.md b/archive/BIOME_UPGRADE_SUMMARY.md
similarity index 100%
rename from BIOME_UPGRADE_SUMMARY.md
rename to archive/BIOME_UPGRADE_SUMMARY.md
diff --git a/BOSS_ARCHITECTURE.md b/archive/BOSS_ARCHITECTURE.md
similarity index 100%
rename from BOSS_ARCHITECTURE.md
rename to archive/BOSS_ARCHITECTURE.md
diff --git a/BOSS_DIAGRAMS.md b/archive/BOSS_DIAGRAMS.md
similarity index 100%
rename from BOSS_DIAGRAMS.md
rename to archive/BOSS_DIAGRAMS.md
diff --git a/BOSS_QUICK_REFERENCE.md b/archive/BOSS_QUICK_REFERENCE.md
similarity index 100%
rename from BOSS_QUICK_REFERENCE.md
rename to archive/BOSS_QUICK_REFERENCE.md
diff --git a/BRANCH_ANALYSIS.md b/archive/BRANCH_ANALYSIS.md
similarity index 100%
rename from BRANCH_ANALYSIS.md
rename to archive/BRANCH_ANALYSIS.md
diff --git a/archive/BRANCH_PRESERVATION_MANIFEST_2026-03-23.md b/archive/BRANCH_PRESERVATION_MANIFEST_2026-03-23.md
new file mode 100644
index 0000000..f09914f
--- /dev/null
+++ b/archive/BRANCH_PRESERVATION_MANIFEST_2026-03-23.md
@@ -0,0 +1,99 @@
+# Branch preservation manifest — 2026-03-23
+
+Preserved boss-history refs before branch cleanup. Tags are immutable archive anchors; branches are intentionally kept for now.
+
+## Preserved boss refs
+
+| Ref | Commit | Archive tag | Subject |
+|---|---|---|---|
+| `feature/96-merge-bosses` | `f83d1ec92e87` | `archive/boss-feature-96-merge-bosses-2026-03-23` | feat: implement all 20 boss fights across 4 tiers (#96) |
+| `origin/openclaw-feb26` | `b8b8bd674183` | `archive/boss-openclaw-feb26-2026-03-23` | Merge pull request #101 from CherryCircuit/feature/96-merge-bosses |
+| `origin/feature/93-performance-monitoring-object-pooling` | `a4dda69e9cce` | `archive/boss-feature-93-perf-pooling-2026-03-23` | feat: implement automated performance monitoring with object pooling (#93) |
+| `origin/issue-32-level20-bosses` | `51b741fe0767` | `archive/boss-issue-32-level20-bosses-2026-03-23` | feat: Implement 5 Level 20 final bosses |
+| `origin/issue-27-fix-teleport-boss` | `da9378849a9d` | `archive/boss-issue-27-fix-teleport-boss-2026-03-23` | feat: implement improved teleporting boss mechanics (#27) |
+| `origin/feature/65-boss-framework` | `40fff3c0130b` | `archive/boss-feature-65-boss-framework-2026-03-23` | feat: implement Boss Framework with new boss types (#65) |
+| `origin/feature/19-boss-death-effects` | `2abb1b5d1a3c` | `archive/boss-feature-19-boss-death-effects-2026-03-23` | feat: boss death effects - music stop, death sound, voxel physics (#19) |
+
+## Kept branches after cleanup target
+
+- `feature/96-merge-bosses`
+- `gh-pages`
+- `main`
+- `origin/HEAD`
+- `origin/feature/19-boss-death-effects`
+- `origin/feature/65-boss-framework`
+- `origin/feature/93-performance-monitoring-object-pooling`
+- `origin/feature/96-merge-bosses`
+- `origin/gh-pages`
+- `origin/issue-27-fix-teleport-boss`
+- `origin/issue-32-level20-bosses`
+- `origin/main`
+- `origin/openclaw-feb26`
+
+## Delete candidates executed in this cleanup
+
+### Local branches to delete
+
+### Remote branches to delete from origin
+- `origin/CherryCircuit/webxr-synthwave-demo` at `6dbd8c3`: feat: Major gameplay improvements - bosses, UI feedback, combat balance
+- `origin/GLM-5-time` at `8f3107c`: Tried editing some code without bots
+- `origin/docs/brain-dump-docs` at `af9e496`: docs: add AGENTS.TLDR.md, PROJECT_CONTEXT.md, TASK_INBOX.md, DECISIONS.md
+- `origin/feature/102-fix-runtime-errors` at `a933bf2`: fix: resolve runtime errors - missing imports and variable scope (#102)
+- `origin/feature/107-fix-aurora-sky` at `db84f3d`: fix: Make aurora/sky effects visible (#107)
+- `origin/feature/108-fix-button-hover` at `ac879d2`: fix: Button hover effects and sound now work with both controllers (#108)
+- `origin/feature/109-restore-kills-alerts` at `1672d1d`: fix: Restore "kills remaining" alerts (#109)
+- `origin/feature/111-fix-upgrade-cards` at `28c1ea5`: fix: Upgrade cards - restore proper text sizes and fix glow clipping (#111)
+- `origin/feature/111-upgrade-cards-fix` at `0a4bdb9`: fix: Upgrade cards - restore proper text sizes and fix glow clipping
+- `origin/feature/112-keyboard-upgrade-selection` at `f502404`: fix: Enable keyboard/mouse upgrade selection (#112)
+- `origin/feature/113-verify-upgrade-system` at `75c7494`: docs: Add upgrade system verification report (#113)
+- `origin/feature/114-fix-scoreboard` at `a42485c`: fix: Improve scoreboard error handling and add configuration validation (#114)
+- `origin/feature/14-fps-monitor` at `f2884a3`: feat: implement WebXR FPS monitor with debug menu toggle (#14)
+- `origin/feature/15-debug-menu-improvements` at `081a8ca`: feat: improve DEBUG menu with diagnostic info (#15)
+- `origin/feature/28-boss-framework` at `e08d16f`: feat: Boss system refactor - create framework with telegraphing (#28)
+- `origin/feature/30-level10-bosses` at `89844ed`: feat: Implement 5 Level 10 bosses with unique mechanics (#30)
+- `origin/feature/31-level-15-bosses` at `67fa5f5`: feat: implement 5 Level 15 TOUGH bosses (#31)
+- `origin/feature/43-weapon-architecture` at `f2057db`: docs: Weapon system architecture design (#43)
+- `origin/feature/44-boss-architecture` at `40d5110`: feat: Complete MAIN/ALT/UPGRADE weapon system integration (#33)
+- `origin/feature/78-fix-js-syntax` at `5bd1f5b`: fix: resolve merge conflict - keep main branch version
+- `origin/feature/89-alt-fire-tutorial` at `dfac37c`: feat: Add alt fire tutorial system with improved visuals and HUD (#89)
+- `origin/feature/93-performance-monitoring` at `0504581`: feat: integrate performance monitoring and add desktop controls testing
+- `origin/fix/102-runtime-errors` at `b4d0ac6`: fix: resolve runtime errors preventing game from loading
+- `origin/fix/105-charge-beam-fix` at `836c3fa`: fix: Remove duplicate beamInner/beamOuter references in onTriggerRelease
+- `origin/fix/106-post-level-text` at `518e900`: fix: post-level text not appearing (#106)
+- `origin/fix/109-kills-remaining-alerts` at `3819c66`: fix: restore kills remaining alerts visibility in VR (#109)
+- `origin/fix/110-hud-kill-count` at `94f5abf`: fix: HUD kill count showing 14/15 instead of 15/15 (#110)
+- `origin/fix/110-reapply-hud-fix` at `9337b73`: fix: Upgrade cards - restore proper text sizes and fix glow clipping
+- `origin/fix/113-upgrade-overhaul-syntax` at `069fbe6`: fix: upgrade overhaul syntax error - missing closing bracket for UPGRADE_POOL array (#113)
+- `origin/fix/115-showReadyScreen-import` at `aae8ba9`: fix: showReadyScreen undefined error in debugJumpToLevel (#115)
+- `origin/fix/13-scoreboard-performance` at `ed42b5b`: fix: optimize scoreboard and country select screen performance (#13)
+- `origin/fix/78-syntax-errors` at `d9464dd`: fix: add missing playBossTeleportDisappear function to audio.js
+- `origin/fix/80-zombie-worker-detection` at `75ee253`: docs: add zombie worker diagnostic script and fix documentation for #80
+- `origin/fix/84-code-review-verification` at `5399194`: fix: correct import syntax in main.js (enable as enableDesktop)
+- `origin/fix/87-weapon-upgrade-filter` at `aa0a58e`: fix: Filter weapon-specific upgrades for all weapon types (#87)
+- `origin/fix/88-charge-gun-improvements` at `dbe3db8`: fix: charge gun improvements for issue #88
+- `origin/fix/89-alt-fire-tutorial` at `241ec3d`: feat: add alt weapon tutorial foundation (partial #89)
+- `origin/fix/94-score-display-update` at `c6cb455`: fix: Restore broken functions to fix HUD score display
+- `origin/fix/95-upgrade-card-font-size` at `80d28ee`: fix: Reduce upgrade card font size to prevent text overflow (#95)
+- `origin/issue-11-scoreboard-padding` at `b8c69f9`: feat: add padding to Scoreboard and Diagnostics buttons on main menu
+- `origin/issue-16-desktop-controls` at `46484f6`: feat: implement keyboard/mouse desktop controls (#16)
+- `origin/issue-17-level-transition-fade` at `425b7a6`: fix: implement sound effect matching sfxr parameters exactly
+- `origin/issue-18-level-intro` at `6c812e3`: feat: implement level intro sequence before each standard level
+- `origin/issue-20-kills-alert` at `754b045`: feat: improve kills remaining alert positioning and sound
+- `origin/issue-21-kills-threshold` at `de74e7e`: feat: change kills remaining alert threshold to 10 at level 11+
+- `origin/issue-22-levelup-hud` at `0c596cf`: fix: show HUD during UPGRADE_SELECT state (actual level-up screen)
+- `origin/issue-23-hover-sound` at `501791d`: fix: add dual-controller hover detection in PLAYING state
+- `origin/issue-24-lowhealth-alert` at `ec5d7bb`: fix: complete sfxr parameters and fix floor pulse/hit flash conflict
+- `origin/issue-25-tank-weak-point` at `a8c4fde`: feat: Add weak point visual indicator to tank enemies
+- `origin/issue-26-aurora-skydome` at `b40d87f`: feat: Add animated aurora borealis sky-dome effect
+- `origin/issue-34-main-weapons` at `ee88f8c`: feat: Add 6 main weapons with specific upgrades
+- `origin/issue-35-alt-weapons` at `5f7d88a`: feat: Add 6 ALT WEAPONS with cooldown system
+- `origin/issue-36-universal-upgrades` at `2424ae4`: feat: Implement 6 universal upgrades (issue #36)
+- `origin/issue-37-boss-upgrades` at `f7b9c44`: feat: Implement boss-specific special upgrades (RARE/EPIC/ULTRA)
+- `origin/issue-8-fix-kills-counter` at `8052b43`: fix: reset level config and fix kills counter display (#8)
+- `origin/last-working` at `dee903b`: REVERT PHASE 1 CHANGES ALTOGETHER MOTHER
+- `origin/merge-weapons-from-babylon` at `9b425a4`: feat: Implement Mega Man-style charge shot system with audio and visual effects
+- `origin/noclue` at `acdf548`: fix: Update HUD positions and rotations for VR elements; adjust proximity alert system and slow-mo mechanics
+- `origin/verify/84-js-syntax` at `ee6214d`: docs: verify JavaScript syntax errors fixed for issue #84
+- `origin/verify/94-score-display-fixed` at `fe871ba`: Merge pull request #90 from CherryCircuit/fix/87-weapon-upgrade-filter
+- `origin` at `a9abf3f`: fix: restore desktop controls (WASD + mouse) in render loop
+
diff --git a/CREATIVE_EXPANSION_PLAN.md b/archive/CREATIVE_EXPANSION_PLAN.md
similarity index 100%
rename from CREATIVE_EXPANSION_PLAN.md
rename to archive/CREATIVE_EXPANSION_PLAN.md
diff --git a/DEBUG_POSITIONING_QUICK_REFERENCE.md b/archive/DEBUG_POSITIONING_QUICK_REFERENCE.md
similarity index 100%
rename from DEBUG_POSITIONING_QUICK_REFERENCE.md
rename to archive/DEBUG_POSITIONING_QUICK_REFERENCE.md
diff --git a/DEBUG_POSITIONING_TOOL_REPORT.md b/archive/DEBUG_POSITIONING_TOOL_REPORT.md
similarity index 100%
rename from DEBUG_POSITIONING_TOOL_REPORT.md
rename to archive/DEBUG_POSITIONING_TOOL_REPORT.md
diff --git a/ENEMY_IMPLEMENTATION_STATUS.md b/archive/ENEMY_IMPLEMENTATION_STATUS.md
similarity index 100%
rename from ENEMY_IMPLEMENTATION_STATUS.md
rename to archive/ENEMY_IMPLEMENTATION_STATUS.md
diff --git a/FIXES_APPLIED.md b/archive/FIXES_APPLIED.md
similarity index 100%
rename from FIXES_APPLIED.md
rename to archive/FIXES_APPLIED.md
diff --git a/FIX_SUMMARY.md b/archive/FIX_SUMMARY.md
similarity index 100%
rename from FIX_SUMMARY.md
rename to archive/FIX_SUMMARY.md
diff --git a/IMPLEMENTATION_SUMMARY.md b/archive/IMPLEMENTATION_SUMMARY.md
similarity index 100%
rename from IMPLEMENTATION_SUMMARY.md
rename to archive/IMPLEMENTATION_SUMMARY.md
diff --git a/INSTRUCTION_1_WEAPONS.md b/archive/INSTRUCTION_1_WEAPONS.md
similarity index 100%
rename from INSTRUCTION_1_WEAPONS.md
rename to archive/INSTRUCTION_1_WEAPONS.md
diff --git a/INSTRUCTION_2_FPS_MONITOR.md b/archive/INSTRUCTION_2_FPS_MONITOR.md
similarity index 100%
rename from INSTRUCTION_2_FPS_MONITOR.md
rename to archive/INSTRUCTION_2_FPS_MONITOR.md
diff --git a/INSTRUCTION_3_KEYBOARD_MOUSE.md b/archive/INSTRUCTION_3_KEYBOARD_MOUSE.md
similarity index 100%
rename from INSTRUCTION_3_KEYBOARD_MOUSE.md
rename to archive/INSTRUCTION_3_KEYBOARD_MOUSE.md
diff --git a/INSTRUCTION_4_GLTF_SPHERE.md b/archive/INSTRUCTION_4_GLTF_SPHERE.md
similarity index 100%
rename from INSTRUCTION_4_GLTF_SPHERE.md
rename to archive/INSTRUCTION_4_GLTF_SPHERE.md
diff --git a/INSTRUCTION_5_BOSS_FIGHTS.md b/archive/INSTRUCTION_5_BOSS_FIGHTS.md
similarity index 100%
rename from INSTRUCTION_5_BOSS_FIGHTS.md
rename to archive/INSTRUCTION_5_BOSS_FIGHTS.md
diff --git a/INSTRUCTION_6_SUPABASE_PERFORMANCE.md b/archive/INSTRUCTION_6_SUPABASE_PERFORMANCE.md
similarity index 100%
rename from INSTRUCTION_6_SUPABASE_PERFORMANCE.md
rename to archive/INSTRUCTION_6_SUPABASE_PERFORMANCE.md
diff --git a/LEVEL_5_BOSSES_FINAL_REPORT.md b/archive/LEVEL_5_BOSSES_FINAL_REPORT.md
similarity index 100%
rename from LEVEL_5_BOSSES_FINAL_REPORT.md
rename to archive/LEVEL_5_BOSSES_FINAL_REPORT.md
diff --git a/LEVEL_5_BOSSES_IMPLEMENTATION_SUMMARY.md b/archive/LEVEL_5_BOSSES_IMPLEMENTATION_SUMMARY.md
similarity index 100%
rename from LEVEL_5_BOSSES_IMPLEMENTATION_SUMMARY.md
rename to archive/LEVEL_5_BOSSES_IMPLEMENTATION_SUMMARY.md
diff --git a/LEVEL_5_BOSSES_TEST_CHECKLIST.md b/archive/LEVEL_5_BOSSES_TEST_CHECKLIST.md
similarity index 100%
rename from LEVEL_5_BOSSES_TEST_CHECKLIST.md
rename to archive/LEVEL_5_BOSSES_TEST_CHECKLIST.md
diff --git a/LOCAL_TESTING.md b/archive/LOCAL_TESTING.md
similarity index 100%
rename from LOCAL_TESTING.md
rename to archive/LOCAL_TESTING.md
diff --git a/LOCAL_TEST_CHECKLIST.md b/archive/LOCAL_TEST_CHECKLIST.md
similarity index 100%
rename from LOCAL_TEST_CHECKLIST.md
rename to archive/LOCAL_TEST_CHECKLIST.md
diff --git a/MISSING_FEATURES.md b/archive/MISSING_FEATURES.md
similarity index 100%
rename from MISSING_FEATURES.md
rename to archive/MISSING_FEATURES.md
diff --git a/PERFORMANCE_FIXES.md b/archive/PERFORMANCE_FIXES.md
similarity index 100%
rename from PERFORMANCE_FIXES.md
rename to archive/PERFORMANCE_FIXES.md
diff --git a/PERFORMANCE_IMPLEMENTATION.md b/archive/PERFORMANCE_IMPLEMENTATION.md
similarity index 100%
rename from PERFORMANCE_IMPLEMENTATION.md
rename to archive/PERFORMANCE_IMPLEMENTATION.md
diff --git a/PHYSICS_DEATH_IMPLEMENTATION.md b/archive/PHYSICS_DEATH_IMPLEMENTATION.md
similarity index 100%
rename from PHYSICS_DEATH_IMPLEMENTATION.md
rename to archive/PHYSICS_DEATH_IMPLEMENTATION.md
diff --git a/REFACTOR_SUMMARY.md b/archive/REFACTOR_SUMMARY.md
similarity index 100%
rename from REFACTOR_SUMMARY.md
rename to archive/REFACTOR_SUMMARY.md
diff --git a/RESEARCH_BIOMES_ALT.md b/archive/RESEARCH_BIOMES_ALT.md
similarity index 100%
rename from RESEARCH_BIOMES_ALT.md
rename to archive/RESEARCH_BIOMES_ALT.md
diff --git a/SCOREBOARD_README.md b/archive/SCOREBOARD_README.md
similarity index 100%
rename from SCOREBOARD_README.md
rename to archive/SCOREBOARD_README.md
diff --git a/SCOREBOARD_TROUBLESHOOTING.md b/archive/SCOREBOARD_TROUBLESHOOTING.md
similarity index 100%
rename from SCOREBOARD_TROUBLESHOOTING.md
rename to archive/SCOREBOARD_TROUBLESHOOTING.md
diff --git a/SHOOTABLE_PROJECTILES_FEATURE.md b/archive/SHOOTABLE_PROJECTILES_FEATURE.md
similarity index 100%
rename from SHOOTABLE_PROJECTILES_FEATURE.md
rename to archive/SHOOTABLE_PROJECTILES_FEATURE.md
diff --git a/SUN_FIX_SUMMARY.md b/archive/SUN_FIX_SUMMARY.md
similarity index 100%
rename from SUN_FIX_SUMMARY.md
rename to archive/SUN_FIX_SUMMARY.md
diff --git a/SUPABASE_SETUP.md b/archive/SUPABASE_SETUP.md
similarity index 100%
rename from SUPABASE_SETUP.md
rename to archive/SUPABASE_SETUP.md
diff --git a/TESTING_GUIDE.md b/archive/TESTING_GUIDE.md
similarity index 100%
rename from TESTING_GUIDE.md
rename to archive/TESTING_GUIDE.md
diff --git a/TEST_CHECKLIST.md b/archive/TEST_CHECKLIST.md
similarity index 100%
rename from TEST_CHECKLIST.md
rename to archive/TEST_CHECKLIST.md
diff --git a/TEST_CHECKLIST_PROJECTILE_FIX.md b/archive/TEST_CHECKLIST_PROJECTILE_FIX.md
similarity index 100%
rename from TEST_CHECKLIST_PROJECTILE_FIX.md
rename to archive/TEST_CHECKLIST_PROJECTILE_FIX.md
diff --git a/UI_HOVER_TEST_CHECKLIST.md b/archive/UI_HOVER_TEST_CHECKLIST.md
similarity index 100%
rename from UI_HOVER_TEST_CHECKLIST.md
rename to archive/UI_HOVER_TEST_CHECKLIST.md
diff --git a/WEAPON_ARCHITECTURE.md b/archive/WEAPON_ARCHITECTURE.md
similarity index 100%
rename from WEAPON_ARCHITECTURE.md
rename to archive/WEAPON_ARCHITECTURE.md
diff --git a/WEAPON_DIAGRAMS.md b/archive/WEAPON_DIAGRAMS.md
similarity index 100%
rename from WEAPON_DIAGRAMS.md
rename to archive/WEAPON_DIAGRAMS.md
diff --git a/WEAPON_INTEGRATION_PLAN.md b/archive/WEAPON_INTEGRATION_PLAN.md
similarity index 100%
rename from WEAPON_INTEGRATION_PLAN.md
rename to archive/WEAPON_INTEGRATION_PLAN.md
diff --git a/WEAPON_QUICK_REFERENCE.md b/archive/WEAPON_QUICK_REFERENCE.md
similarity index 100%
rename from WEAPON_QUICK_REFERENCE.md
rename to archive/WEAPON_QUICK_REFERENCE.md
diff --git a/WEAPON_SYSTEM_STATUS.md b/archive/WEAPON_SYSTEM_STATUS.md
similarity index 100%
rename from WEAPON_SYSTEM_STATUS.md
rename to archive/WEAPON_SYSTEM_STATUS.md
diff --git a/fog-check.mjs b/archive/dev-scraps/fog-check.mjs
similarity index 100%
rename from fog-check.mjs
rename to archive/dev-scraps/fog-check.mjs
diff --git a/hud.js.backup b/archive/dev-scraps/hud.js.backup
similarity index 100%
rename from hud.js.backup
rename to archive/dev-scraps/hud.js.backup
diff --git a/object-pool.js b/archive/dev-scraps/object-pool.js
similarity index 100%
rename from object-pool.js
rename to archive/dev-scraps/object-pool.js
diff --git a/old_main.txt b/archive/dev-scraps/old_main.txt
similarity index 100%
rename from old_main.txt
rename to archive/dev-scraps/old_main.txt
diff --git a/patch_diagnostic.ps1 b/archive/dev-scraps/patch_diagnostic.ps1
similarity index 100%
rename from patch_diagnostic.ps1
rename to archive/dev-scraps/patch_diagnostic.ps1
diff --git a/patch_main.ps1 b/archive/dev-scraps/patch_main.ps1
similarity index 100%
rename from patch_main.ps1
rename to archive/dev-scraps/patch_main.ps1
diff --git a/patch_main_2.ps1 b/archive/dev-scraps/patch_main_2.ps1
similarity index 100%
rename from patch_main_2.ps1
rename to archive/dev-scraps/patch_main_2.ps1
diff --git a/patch_visuals.ps1 b/archive/dev-scraps/patch_visuals.ps1
similarity index 100%
rename from patch_visuals.ps1
rename to archive/dev-scraps/patch_visuals.ps1
diff --git a/performance.js b/archive/dev-scraps/performance.js
similarity index 100%
rename from performance.js
rename to archive/dev-scraps/performance.js
diff --git a/temp_imports.txt b/archive/dev-scraps/temp_imports.txt
similarity index 100%
rename from temp_imports.txt
rename to archive/dev-scraps/temp_imports.txt
diff --git a/test-imports.html b/archive/dev-scraps/test-imports.html
similarity index 100%
rename from test-imports.html
rename to archive/dev-scraps/test-imports.html
diff --git a/test-projectile-hits.js b/archive/dev-scraps/test-projectile-hits.js
similarity index 100%
rename from test-projectile-hits.js
rename to archive/dev-scraps/test-projectile-hits.js
diff --git a/test-server.js b/archive/dev-scraps/test-server.js
similarity index 100%
rename from test-server.js
rename to archive/dev-scraps/test-server.js
diff --git a/test-server.log b/archive/dev-scraps/test-server.log
similarity index 100%
rename from test-server.log
rename to archive/dev-scraps/test-server.log
diff --git a/test-tracker.js b/archive/dev-scraps/test-tracker.js
similarity index 100%
rename from test-tracker.js
rename to archive/dev-scraps/test-tracker.js
diff --git a/test-tracking.json b/archive/dev-scraps/test-tracking.json
similarity index 100%
rename from test-tracking.json
rename to archive/dev-scraps/test-tracking.json
diff --git a/scenery-upgrade-plan.md b/archive/scenery-upgrade-plan.md
similarity index 100%
rename from scenery-upgrade-plan.md
rename to archive/scenery-upgrade-plan.md
diff --git a/deployed-screenshot.png b/archive/screenshots/deployed-screenshot.png
similarity index 100%
rename from deployed-screenshot.png
rename to archive/screenshots/deployed-screenshot.png
diff --git a/archive/screenshots/game-screenshot.png b/archive/screenshots/game-screenshot.png
new file mode 100644
index 0000000..013ccd9
Binary files /dev/null and b/archive/screenshots/game-screenshot.png differ
diff --git a/game-screenshot2.png b/archive/screenshots/game-screenshot2.png
similarity index 100%
rename from game-screenshot2.png
rename to archive/screenshots/game-screenshot2.png
diff --git a/game-screenshot3.png b/archive/screenshots/game-screenshot3.png
similarity index 100%
rename from game-screenshot3.png
rename to archive/screenshots/game-screenshot3.png
diff --git a/game-screenshot4.png b/archive/screenshots/game-screenshot4.png
similarity index 100%
rename from game-screenshot4.png
rename to archive/screenshots/game-screenshot4.png
diff --git a/puppeteer-after-click.png b/archive/screenshots/puppeteer-after-click.png
similarity index 100%
rename from puppeteer-after-click.png
rename to archive/screenshots/puppeteer-after-click.png
diff --git a/puppeteer-final.png b/archive/screenshots/puppeteer-final.png
similarity index 100%
rename from puppeteer-final.png
rename to archive/screenshots/puppeteer-final.png
diff --git a/puppeteer-screenshot.png b/archive/screenshots/puppeteer-screenshot.png
similarity index 100%
rename from puppeteer-screenshot.png
rename to archive/screenshots/puppeteer-screenshot.png
diff --git a/test-1-title.png b/archive/screenshots/test-1-title.png
similarity index 100%
rename from test-1-title.png
rename to archive/screenshots/test-1-title.png
diff --git a/test-2-after-click.png b/archive/screenshots/test-2-after-click.png
similarity index 100%
rename from test-2-after-click.png
rename to archive/screenshots/test-2-after-click.png
diff --git a/test-3-state-check.png b/archive/screenshots/test-3-state-check.png
similarity index 100%
rename from test-3-state-check.png
rename to archive/screenshots/test-3-state-check.png
diff --git a/test-after-mouse.png b/archive/screenshots/test-after-mouse.png
similarity index 100%
rename from test-after-mouse.png
rename to archive/screenshots/test-after-mouse.png
diff --git a/test-after-rapid-fire.png b/archive/screenshots/test-after-rapid-fire.png
similarity index 100%
rename from test-after-rapid-fire.png
rename to archive/screenshots/test-after-rapid-fire.png
diff --git a/test-after-shooting.png b/archive/screenshots/test-after-shooting.png
similarity index 100%
rename from test-after-shooting.png
rename to archive/screenshots/test-after-shooting.png
diff --git a/test-after-space.png b/archive/screenshots/test-after-space.png
similarity index 100%
rename from test-after-space.png
rename to archive/screenshots/test-after-space.png
diff --git a/test-comprehensive-result.png b/archive/screenshots/test-comprehensive-result.png
similarity index 100%
rename from test-comprehensive-result.png
rename to archive/screenshots/test-comprehensive-result.png
diff --git a/test-enemies-spawned.png b/archive/screenshots/test-enemies-spawned.png
similarity index 100%
rename from test-enemies-spawned.png
rename to archive/screenshots/test-enemies-spawned.png
diff --git a/test-enemies.png b/archive/screenshots/test-enemies.png
similarity index 100%
rename from test-enemies.png
rename to archive/screenshots/test-enemies.png
diff --git a/test-final-result.png b/archive/screenshots/test-final-result.png
similarity index 100%
rename from test-final-result.png
rename to archive/screenshots/test-final-result.png
diff --git a/test-final.png b/archive/screenshots/test-final.png
similarity index 100%
rename from test-final.png
rename to archive/screenshots/test-final.png
diff --git a/test-gameplay-start.png b/archive/screenshots/test-gameplay-start.png
similarity index 100%
rename from test-gameplay-start.png
rename to archive/screenshots/test-gameplay-start.png
diff --git a/test-projectile-hits.png b/archive/screenshots/test-projectile-hits.png
similarity index 100%
rename from test-projectile-hits.png
rename to archive/screenshots/test-projectile-hits.png
diff --git a/archive/screenshots/test-result.png b/archive/screenshots/test-result.png
new file mode 100644
index 0000000..c0b11cd
Binary files /dev/null and b/archive/screenshots/test-result.png differ
diff --git a/upgrades.js b/archive/upgrades.js.archived
similarity index 100%
rename from upgrades.js
rename to archive/upgrades.js.archived
diff --git a/biome-scenes.js b/biome-scenes.js
new file mode 100644
index 0000000..d27657b
--- /dev/null
+++ b/biome-scenes.js
@@ -0,0 +1,1302 @@
+// ============================================================
+//  BIOME SCENES — Custom visual scene builders for biomes
+//  Extracted from main.js for modular architecture
+// ============================================================
+
+import * as THREE from 'three';
+
+// ── Exports ────────────────────────────────────────────────
+
+/**
+ * Rebuild the biome scene for a given biome ID.
+ * Called from main.js when level/theme changes.
+ * 
+ * @param {Object} deps - Dependencies from main.js
+ * @param {THREE.Scene} deps.scene - The main scene
+ * @param {string} deps.biomeId - The biome ID to build
+ * @param {Object} deps.theme - The theme object with colors/settings
+ * @param {Object} deps.state - State object with biomeSceneGroup, biomeSceneBiome setters
+ * @param {Function} deps.clearBiomeScene - Function to clear previous biome scene
+ * @param {Function} deps.registerFadeMaterial - Function to register materials for fade
+ * @param {Function} deps.updateAuroraColors - Function to update aurora for theme
+ * @param {Function} deps.cleanupLegacyShapeGeometry - Function to cleanup stale meshes
+ * @param {Function} deps.assignBiomePlaneNames - Function to name plane geometries
+ * @param {Object} deps.refs - Reference objects (floorMaterial, synthVisualRefs, etc.)
+ * @param {Array} deps.biomeTerrainMaterials - Array to push terrain materials to
+ */
+export function rebuildBiomeScene(deps) {
+  const {
+    scene,
+    biomeId,
+    theme,
+    state,
+    clearBiomeScene,
+    registerFadeMaterial,
+    updateAuroraColors,
+    cleanupLegacyShapeGeometry,
+    assignBiomePlaneNames,
+    refs,
+    biomeTerrainMaterials,
+  } = deps;
+
+  console.log('[debug] rebuildBiomeScene: biomeId=', biomeId, 'customScene=', theme?.customScene);
+  
+  if (!scene || !theme || !theme.customScene) {
+    console.log('[debug] Clearing biome scene (no custom scene)');
+    clearBiomeScene();
+    return;
+  }
+  
+  if (state.biomeSceneGroup && state.biomeSceneBiome === biomeId) {
+    console.log('[debug] Biome scene already built for', biomeId, ', skipping');
+    return;
+  }
+
+  console.log('[debug] Building new biome scene for', biomeId);
+  clearBiomeScene();
+
+  // Update aurora colors for new biome
+  updateAuroraColors(theme);
+
+  const biomeSceneGroup = new THREE.Group();
+  biomeSceneGroup.name = `biome-scene-${biomeId}`;
+  scene.add(biomeSceneGroup);
+  
+  // Update state
+  state.biomeSceneGroup = biomeSceneGroup;
+  state.biomeSceneBiome = biomeId;
+
+  // Build the appropriate scene
+  const buildDeps = {
+    registerFadeMaterial,
+    floorMaterial: refs.floorMaterial,
+    synthVisualRefs: refs.synthVisualRefs,
+    biomeTerrainMaterials,
+    BLOOM_LAYER: refs.BLOOM_LAYER,
+    getVisualTuning: refs.getVisualTuning,
+  };
+
+  if (theme.customScene === 'synthwave_valley') {
+    buildSynthwaveValleyScene(biomeSceneGroup, buildDeps);
+  } else if (theme.customScene === 'desert_night') {
+    buildDesertNightScene(biomeSceneGroup, buildDeps);
+  } else if (theme.customScene === 'alien_planet') {
+    buildAlienPlanetScene(biomeSceneGroup, buildDeps);
+  } else if (theme.customScene === 'hellscape_lava') {
+    buildHellscapeLavaScene(biomeSceneGroup, buildDeps);
+  }
+
+  // Cleanup stale legacy meshes and give all biome PlaneGeometry meshes
+  // unique, readable names for debug look-at tooling.
+  cleanupLegacyShapeGeometry(scene);
+  assignBiomePlaneNames(biomeSceneGroup, biomeId);
+
+  // Register all biome scene materials for environment fade
+  // This ensures everything fades to black during boss death cinematic
+  if (biomeSceneGroup) {
+    biomeSceneGroup.traverse((child) => {
+      if (child.isMesh && child.material) {
+        if (Array.isArray(child.material)) {
+          child.material.forEach(m => registerFadeMaterial(m));
+        } else {
+          registerFadeMaterial(child.material);
+        }
+      }
+      if (child.isPoints && child.material) {
+        registerFadeMaterial(child.material);
+      }
+      if (child.isLine && child.material) {
+        registerFadeMaterial(child.material);
+      }
+    });
+  }
+}
+
+/**
+ * Get the physics floor Y for current biome (matches visual floor HUD height)
+ * @param {string} biomeSceneBiome - Current biome ID
+ * @param {number} SCENE_Y_OFFSET - Scene Y offset constant
+ * @returns {number} Floor Y position
+ */
+export function getBiomeFloorY(biomeSceneBiome, SCENE_Y_OFFSET) {
+  const floorY = (() => {
+    switch (biomeSceneBiome) {
+      case 'synthwave_valley': return 0.10;
+      case 'desert_night': return -0.20;
+      case 'alien_planet': return -0.28;
+      case 'hellscape_lava': return 0.05;
+      default: return 0.05;
+    }
+  })();
+  // Apply scene Y offset for VR camera height fix
+  return floorY + SCENE_Y_OFFSET;
+}
+
+/**
+ * Log cylinder colors for debugging
+ * @param {Object} refs - Reference objects (auroraRef, atmosphereRef)
+ */
+export function logCylinderColors(refs) {
+  const { auroraRef, atmosphereRef } = refs;
+  
+  console.log('=== CYLINDER COLORS ===');
+  
+  // atmosphereRef
+  if (typeof atmosphereRef !== 'undefined' && atmosphereRef && atmosphereRef.material) {
+    if (atmosphereRef.material.uniforms) {
+      const uni = atmosphereRef.material.uniforms;
+      console.log('atmosphereRef (atmosphere cylinder):');
+      console.log('  - uFogColor:', uni.uFogColor?.value?.getHexString());
+      console.log('  - Gradient stops:');
+      console.log('    0% (base): rgba(254,144,83,1.0) -> #FE9053 (horizon orange)');
+      console.log('    20%: rgba(224,1,134,0.9) -> #E00186 (pink)');
+      console.log('    50%: rgba(44,0,81,0.6) -> #2C0051 (sun top purple)');
+      console.log('    100% (top): rgba(26,0,74,0.0) -> #1A004A (dark purple)');
+    }
+  }
+  
+  // auroraRef
+  if (auroraRef && auroraRef.material) {
+    const tex = auroraRef.material.map;
+    if (tex && tex.image) {
+      const canvas = tex.image;
+      const ctx = canvas.getContext('2d');
+      if (ctx) {
+        console.log('auroraRef (aurora cylinder):');
+        const imageData = ctx.getImageData(0, 0, canvas.width, 1);
+        console.log('  - Bottom pixel:', imageData.data);
+      }
+    }
+    
+    // Use scenery.js theme colors
+    if (typeof window !== 'undefined' && window.THEMES && window.THEMES.synthwave_valley && window.THEMES.synthwave_valley.aurora) {
+      const colors = window.THEMES.synthwave_valley.aurora.colors;
+      console.log('  - Theme colors:', colors);
+    }
+  }
+  
+  // horizonRingRef and horizonInnerRingRef - REMOVED
+  console.log('horizonRingRef: REMOVED');
+  console.log('horizonInnerRingRef: REMOVED');
+  
+  console.log('====================');
+}
+
+// ── Scene Builders ──────────────────────────────────────────
+
+function buildSynthwaveValleyScene(group, deps) {
+  const { registerFadeMaterial, floorMaterial, synthVisualRefs, biomeTerrainMaterials, BLOOM_LAYER, getVisualTuning } = deps;
+  
+  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
+  const floorY = floorHeight;
+
+  // Reset synth visual tuning refs each time this biome scene is rebuilt.
+  synthVisualRefs.terrainUniforms = null;
+  synthVisualRefs.sunOuterGlowMat = null;
+  synthVisualRefs.sunGlowMat = null;
+  synthVisualRefs.sunCoreMat = null;
+
+  // Fix for synthwave valley lighting regression: the extracted scene lost the
+  // original standalone scene's punch after we removed postprocessing, so raise
+  // the local material brightness without affecting other biomes.
+  const brightness = 1.0;
+
+  // Sky dome (no stars, we use global starfield)
+  // EXACT colors: Horizon #FE9053 (orange) → Mountain tips #E00186 (pink) → Sun top #2C0051 (purple) → Top #1A004A (dark purple) → Black
+  const skyGeo = new THREE.SphereGeometry(2800, 32, 24);
+  const skyMat = new THREE.ShaderMaterial({
+    side: THREE.BackSide,
+    uniforms: {
+      topColor: { value: new THREE.Color(0x1A004A) },      // Top: dark purple
+      midColor: { value: new THREE.Color(0x71006E) },      // 75% from equator: deep purple
+      horizonColor: { value: new THREE.Color(0xFF8626) },  // Equator: bright orange
+      glowColor: { value: new THREE.Color(0xF30787) },     // 40% from equator: pink
+    },
+    // VR-CRITICAL: Use the standard modelViewMatrix path so the sky remains
+    // stable in stereo rendering and does not rely on manual clip-space math.
+    vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 worldPosition=modelMatrix*vec4(position,1.0); vWorldPosition=worldPosition.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
+    fragmentShader: `varying vec3 vWorldPosition; uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor; uniform vec3 glowColor; void main(){ float worldY=vWorldPosition.y; float t1=smoothstep(0.0,550.0,worldY); float t2=smoothstep(0.0,950.0,worldY); float t3=smoothstep(0.0,1400.0,worldY); vec3 col=horizonColor; col=mix(col,glowColor,t1); col=mix(col,midColor,t2); col=mix(col,topColor,t3); col=pow(col,vec3(1.0/2.2)); gl_FragColor=vec4(col*${brightness.toFixed(2)},1.0); }`,
+    depthWrite: false,
+  });
+  const sky = new THREE.Mesh(skyGeo, skyMat);
+  sky.frustumCulled = false;
+  sky.renderOrder = -20;  // Draw before sun (which is at -3 to -1)
+  group.add(sky);
+  registerFadeMaterial(skyMat);
+
+  // Terrain - EXACT colors: Gridlines #015CC1 (bright blue), Between gridlines #0C0E3E (dark blue)
+  // PERFORMANCE FIX: Reduced from 240x240 (57,600 vertices) to 120x120 (14,400 vertices) for 75% reduction
+  // Still provides good visual quality while improving FPS at level start
+  const terrainUniforms = {
+    uGridColor: { value: new THREE.Color(0x4368AC) },     // Gridlines
+    uBaseColor: { value: new THREE.Color(0x0C1347) },     // Primary/base color
+    uFogColor: { value: new THREE.Color(0x2C0051) },      // EXACT: Sun top purple fog
+    uFlashIntensity: { value: 0.0 },
+    uGlowIntensity: { value: getVisualTuning().glowStrength },
+    uFogIntensity: { value: getVisualTuning().fogIntensity },
+  };
+  const terrainGeo = new THREE.PlaneGeometry(2000, 2000, 240, 240);
+  terrainGeo.rotateX(-Math.PI / 2);
+  const terrainMat = new THREE.ShaderMaterial({
+    uniforms: terrainUniforms,
+    side: THREE.DoubleSide,
+    depthWrite: true,
+    depthTest: true,
+    polygonOffset: true,
+    polygonOffsetFactor: 2.0,
+    polygonOffsetUnits: 8.0,
+    // Fix for synthwave floor popping in VR: keep the terrain static and use the
+    // built-in modelViewMatrix projection instead of manual projection math.
+    vertexShader: `varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; varying float vFogDistance; vec2 hash2(vec2 p){ p=vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return -1.0+2.0*fract(sin(p)*43758.5453123);} float noise(in vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(dot(hash2(i+vec2(0.0,0.0)), f-vec2(0.0,0.0)), dot(hash2(i+vec2(1.0,0.0)), f-vec2(1.0,0.0)), u.x), mix(dot(hash2(i+vec2(0.0,1.0)), f-vec2(0.0,1.0)), dot(hash2(i+vec2(1.0,1.0)), f-vec2(1.0,1.0)), u.x), u.y);} float fbm(vec2 p){ float value=0.0; float amp=0.5; for(int i=0;i<5;i++){ value+=amp*noise(p); p*=2.0; amp*=0.5;} return value;} float ridgeNoise(vec2 p){ float sum=0.0; float amp=0.55; for(int i=0;i<5;i++){ float n=noise(p); n=1.0-abs(n); n*=n; sum+=n*amp; p*=2.15; amp*=0.5;} return sum;} void main(){ vec3 pos=position; vec2 p=pos.xz; float valleyMask=smoothstep(0.0,1.0, clamp(abs(pos.x)/240.0,0.0,1.0)); float broad=fbm(p*vec2(0.0035,0.0024))*16.0; float detail=fbm(p*vec2(0.012,0.01))*5.0; float ridges=ridgeNoise((p+vec2(0.0,-260.0))*0.008)*180.0; float mountainMask=pow(valleyMask,1.55); float centerDip=-10.0*(1.0-valleyMask); float distanceFade=smoothstep(750.0,120.0, abs(pos.z+120.0)); float h=broad+detail+centerDip; h+=ridges*mountainMask*distanceFade; if(pos.z>700.0){ h*=smoothstep(1000.0,700.0,pos.z);} pos.y=h; vec4 world=modelMatrix*vec4(pos,1.0); vec4 mvPosition=modelViewMatrix*vec4(pos,1.0); vWorldPos=world.xyz; vObjPos=pos; vHeight=h; vFogDistance=length(mvPosition.xyz); gl_Position=projectionMatrix*mvPosition; }`,
+    fragmentShader: `uniform vec3 uGridColor; uniform vec3 uBaseColor; uniform vec3 uFogColor; uniform float uFlashIntensity; uniform float uGlowIntensity; uniform float uFogIntensity; varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; varying float vFogDistance; float gridLine(float coord,float width){ float g=abs(fract(coord-0.5)-0.5)/fwidth(coord); return 1.0-smoothstep(width,width+1.0,g);} void main(){ float gridScale=1.0/6.0; float dist=length(vObjPos.xz); float lineW=0.25*smoothstep(1000.0,100.0,dist); float gx=gridLine(vObjPos.x*gridScale,lineW); float gz=gridLine(vObjPos.z*gridScale,lineW); float grid=max(gx,gz); float glowPath=exp(-abs(vObjPos.x)*0.014)*smoothstep(350.0,-150.0,vObjPos.z); grid=max(grid, glowPath*0.34*uGlowIntensity); vec3 col=mix(uBaseColor, uGridColor, clamp(grid*uGlowIntensity,0.0,1.0)); float ridgeGlow=smoothstep(48.0,160.0,vHeight)*smoothstep(100.0,350.0,abs(vObjPos.x)); col+=uGridColor*ridgeGlow*0.18*uGlowIntensity; float fogAmount=1.0-exp(-0.0000012*vFogDistance*vFogDistance); col=mix(col,uFogColor, clamp(fogAmount*uFogIntensity,0.0,1.0)); vec3 flashColor=vec3(1.0,0.0,0.0); col=mix(col,flashColor,uFlashIntensity); gl_FragColor=vec4(col*${brightness.toFixed(2)},1.0); }`,
+  });
+  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
+  terrain.name = 'synthwave-valley-floor-and-mountains';
+  terrain.userData.planeName = 'synthwave-valley-floor-and-mountains';
+  terrain.position.set(0, floorY + 1.5, -700);
+  terrain.frustumCulled = false;
+  terrain.layers.enable(BLOOM_LAYER);  // Selective bloom: floor grid glows
+  group.add(terrain);
+  registerFadeMaterial(terrainMat);
+  // Store terrain material for damage flash
+  biomeTerrainMaterials.push({ type: 'shader', material: terrainMat });
+
+  synthVisualRefs.terrainUniforms = terrainUniforms;
+
+  // Sun + glow - flat planes (no billboard), using retro synthwave PNG
+  const sunGroup = new THREE.Group();
+  sunGroup.name = 'synthwave-sun-group';
+  sunGroup.position.set(0, 270, -1700);  // Y raised so full circle is above horizon
+  group.add(sunGroup);
+
+  const makeRadial = (inner, outer) => {
+    const c = document.createElement('canvas');
+    c.width = 512; c.height = 512;
+    const ctx = c.getContext('2d');
+    const g = ctx.createRadialGradient(256,256,0,256,256,256);
+    g.addColorStop(0.0, inner);
+    g.addColorStop(0.35, inner);
+    g.addColorStop(0.6, outer);
+    g.addColorStop(1.0, 'rgba(255,102,204,0)');
+    ctx.fillStyle = g; ctx.fillRect(0,0,512,512);
+    return new THREE.CanvasTexture(c);
+  };
+
+  const sunGlowTex = makeRadial('rgba(255,255,255,1.0)', 'rgba(254,151,83,0.85)');
+  const sunOuterGlowTex = makeRadial('rgba(254,151,83,0.9)', 'rgba(224,1,134,0.3)');
+
+  // Outer massive glow (flat plane, no billboard, fog-proof, no depth test)
+  const sunOuterGlowMat = new THREE.MeshBasicMaterial({ map: sunOuterGlowTex, color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
+  const sunOuterGlow = new THREE.Mesh(new THREE.PlaneGeometry(875, 875), sunOuterGlowMat); // 10% smaller again (81% of original)
+  sunOuterGlow.name = 'synthwave-sun-outer-glow';
+  sunOuterGlow.userData.planeName = 'synthwave-sun-outer-glow';
+  sunOuterGlow.frustumCulled = false;
+  sunOuterGlow.renderOrder = -3;
+  sunGroup.add(sunOuterGlow);
+  registerFadeMaterial(sunOuterGlowMat);
+  synthVisualRefs.sunOuterGlowMat = sunOuterGlowMat;
+
+  // Main bright glow (fog-proof, no depth test)
+  const sunGlowMat = new THREE.MeshBasicMaterial({ map: sunGlowTex, color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
+  const sunGlow = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), sunGlowMat); // 10% smaller again (81% of original)
+  sunGlow.name = 'synthwave-sun-main-glow';
+  sunGlow.userData.planeName = 'synthwave-sun-main-glow';
+  sunGlow.frustumCulled = false;
+  sunGlow.renderOrder = -2;
+  sunGroup.add(sunGlow);
+  registerFadeMaterial(sunGlowMat);
+  synthVisualRefs.sunGlowMat = sunGlowMat;
+
+  // Retro synthwave sun disc from PNG (flat plane, no billboard)
+  // PNG has white background - process to make white pixels transparent
+  const sunDiscTex = new THREE.TextureLoader().load('assets/sun-retro.png');
+  const sunCoreMat = new THREE.MeshBasicMaterial({ map: sunDiscTex, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false });
+  // Process: load PNG, threshold white pixels to transparent, replace material map
+  const sunDiscImg = new Image();
+  sunDiscImg.crossOrigin = 'anonymous';
+  sunDiscImg.onload = () => {
+    const c = document.createElement('canvas');
+    c.width = sunDiscImg.width;
+    c.height = sunDiscImg.height;
+    const ctx = c.getContext('2d');
+    ctx.drawImage(sunDiscImg, 0, 0);
+    const id = ctx.getImageData(0, 0, c.width, c.height);
+    const d = id.data;
+    for (let i = 0; i < d.length; i += 4) {
+      if ((d[i] + d[i+1] + d[i+2]) / 3 > 240) d[i+3] = 0;
+    }
+    ctx.putImageData(id, 0, 0);
+    if (sunCoreMat.map) sunCoreMat.map.dispose();
+    sunCoreMat.map = new THREE.CanvasTexture(c);
+    sunCoreMat.map.needsUpdate = true;
+    sunCoreMat.needsUpdate = true;
+  };
+  sunDiscImg.src = 'assets/sun-retro.png';
+  const sunCore = new THREE.Mesh(new THREE.PlaneGeometry(466, 466), sunCoreMat); // 10% smaller again (81% of original)
+  sunCore.name = 'synthwave-sun-core-disc';
+  sunCore.userData.planeName = 'synthwave-sun-core-disc';
+  sunCore.frustumCulled = false;
+  sunCore.renderOrder = -1;
+  sunGroup.add(sunCore);
+  registerFadeMaterial(sunCoreMat);
+  synthVisualRefs.sunCoreMat = sunCoreMat;
+
+  // Log cylinder colors for debugging
+  // logCylinderColors(refs); // Disabled - only for debugging
+
+  // Fix for synthwave valley "jiggle": keep the imported scene static in-game.
+  // The standalone HTML used perpetual scrolling and pulsing, but the game
+  // version should behave like a stable biome backdrop.
+  group.userData.update = null;
+
+  // Synthwave floor HUD height: group.position.y = 5.82
+  group.position.set(0, 5.82, 0);
+
+  // Rotate so player faces sun
+  group.rotation.y = 0;
+}
+
+function buildDesertNightScene(group, deps) {
+  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
+  
+  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
+  const floorY = floorHeight;
+  const sceneColor = 0x06080c;
+
+  // === LIGHTING (CRITICAL) ===
+  // Pale moonlight
+  const moonLight = new THREE.DirectionalLight(0xd4e5f7, 2.34);
+  moonLight.position.set(-30, 50, -30);
+  group.add(moonLight);
+
+  // Point light for long moon-like shadows from cacti
+  const shadowLight = new THREE.PointLight(0xd4e5f7, 1.5, 100);
+  shadowLight.position.set(-45, 35, -60); // Same as moon position
+  shadowLight.castShadow = true;
+  shadowLight.shadow.mapSize.width = 1024;
+  shadowLight.shadow.mapSize.height = 1024;
+  shadowLight.shadow.camera.near = 10;
+  shadowLight.shadow.camera.far = 100;
+  group.add(shadowLight);
+
+  // Very dim ambient
+  const ambientLight = new THREE.AmbientLight(0x1a2035, 0.15);
+  group.add(ambientLight);
+
+  // Hemisphere light for sky/ground color
+  const hemiLight = new THREE.HemisphereLight(0x1a2035, 0x2d1f1a, 0.2);
+  group.add(hemiLight);
+
+  // Ground
+  const geometry = new THREE.PlaneGeometry(140, 140, 70, 70);
+  geometry.rotateX(-Math.PI / 2);
+  const positions = geometry.attributes.position;
+  const colors = [];
+  const flatRadius = 12.0;
+  const mountainStart = 18.0;
+  for (let i = 0; i < positions.count; i++) {
+    const x = positions.getX(i);
+    const z = positions.getZ(i);
+    const dist = Math.sqrt(x * x + z * z);
+    let heightFactor = Math.min(Math.max((dist - flatRadius) / (mountainStart - flatRadius), 0), 1);
+    heightFactor = heightFactor * heightFactor * (3 - 2 * heightFactor);
+    let height = 0;
+    height += Math.sin(x * 0.08 + 0.5) * Math.cos(z * 0.06) * 4.0;
+    height += Math.sin(x * 0.04 + 2) * Math.sin(z * 0.05 + 1) * 3.0;
+    height += Math.sin(x * 0.15 + z * 0.1) * 1.5;
+    height += Math.cos(z * 0.12 - x * 0.08) * 1.0;
+    height += Math.sin(x * 0.3) * Math.cos(z * 0.25) * 0.5;
+    if (dist > mountainStart) {
+      height += Math.sin(x * 0.4 + z * 0.3) * 2.0;
+      height += Math.cos(x * 0.2 - z * 0.5) * 2.5;
+    }
+    const finalHeight = height * heightFactor;
+    positions.setY(i, finalHeight);
+    const heightNorm = (finalHeight + 5) / 15;
+    const baseColor = new THREE.Color(0x2a241b);
+    const highlightColor = new THREE.Color(0x585144);
+    const moonTint = new THREE.Color(0x404a5a);
+    let color = baseColor.clone().lerp(highlightColor, Math.max(0, Math.min(1, heightNorm)));
+    color.lerp(moonTint, heightNorm * 0.2);
+    colors.push(color.r, color.g, color.b);
+  }
+  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
+  geometry.computeVertexNormals();
+  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
+  const terrain = new THREE.Mesh(geometry, material);
+  terrain.name = 'desert-night-terrain';
+  terrain.userData.planeName = 'desert-night-terrain';
+  terrain.position.y = floorY;
+  terrain.frustumCulled = false;
+  terrain.receiveShadow = true;  // Sand dunes receive cactus shadows
+  group.add(terrain);
+  registerFadeMaterial(material);
+
+  // Flash overlay plane for damage feedback (entire sand floor turns red)
+  const flashGeo = new THREE.PlaneGeometry(140, 140);
+  const flashMat = new THREE.MeshBasicMaterial({
+    color: 0xff0000,
+    transparent: true,
+    opacity: 0,
+    depthWrite: false,
+    side: THREE.DoubleSide
+  });
+  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
+  flashPlane.name = 'desert-night-damage-flash-plane';
+  flashPlane.userData.planeName = 'desert-night-damage-flash-plane';
+  flashPlane.rotation.x = -Math.PI / 2;
+  flashPlane.position.y = floorY + 0.02; // Very close to terrain surface
+  flashPlane.frustumCulled = false;
+  group.add(flashPlane);
+  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });
+
+  // === CACTUSES (9 procedural) ===
+  const createCactus = (height) => {
+    const cactusGroup = new THREE.Group();
+    const bodyColor = 0x1a3d20;
+    const armColor = 0x2d5535;
+    const segments = 3 + Math.floor(Math.random() * 2); // 3-4 segments
+    let currentY = 0;
+    const segmentHeight = height / segments;
+
+    // Main body segments
+    for (let i = 0; i < segments; i++) {
+      const radius = 0.12 + (segments - i) * 0.03; // Taper upward
+      const segGeo = new THREE.CylinderGeometry(radius * 0.9, radius, segmentHeight, 5);
+      const segMat = new THREE.MeshLambertMaterial({ color: bodyColor, flatShading: true });
+      const segment = new THREE.Mesh(segGeo, segMat);
+      segment.position.y = currentY + segmentHeight / 2;
+      segment.castShadow = true;  // Cacti cast shadows
+      segment.receiveShadow = true;
+      cactusGroup.add(segment);
+      currentY += segmentHeight;
+    }
+
+    // Random arms (0-2)
+    const numArms = Math.floor(Math.random() * 3);
+    for (let a = 0; a < numArms; a++) {
+      const armY = segmentHeight * (1 + Math.floor(Math.random() * (segments - 1)));
+      const side = Math.random() > 0.5 ? 1 : -1;
+      const armLength = 0.4 + Math.random() * 0.4;
+
+      // Horizontal part
+      const hArmGeo = new THREE.CylinderGeometry(0.08, 0.1, armLength, 5);
+      const hArmMat = new THREE.MeshLambertMaterial({ color: armColor, flatShading: true });
+      const hArm = new THREE.Mesh(hArmGeo, hArmMat);
+      hArm.castShadow = true;
+      hArm.receiveShadow = true;
+      hArm.rotation.z = Math.PI / 2;
+      hArm.position.set(side * armLength / 2, armY, 0);
+      cactusGroup.add(hArm);
+
+      // Vertical part (upward)
+      const vArmHeight = 0.5 + Math.random() * 0.5;
+      const vArmGeo = new THREE.CylinderGeometry(0.06, 0.08, vArmHeight, 5);
+      const vArmMat = new THREE.MeshLambertMaterial({ color: armColor, flatShading: true });
+      const vArm = new THREE.Mesh(vArmGeo, vArmMat);
+      vArm.castShadow = true;
+      vArm.receiveShadow = true;
+      vArm.position.set(side * armLength, armY + vArmHeight / 2, 0);
+      cactusGroup.add(vArm);
+    }
+
+    // REMOVED: Fake circle shadow - now using point light for realistic moon shadows
+    // Cacti will cast natural shadows from the shadowLight
+
+    return cactusGroup;
+  };
+
+  const cactusPositions = [
+    { x: 6, z: 4, h: 2.5 },
+    { x: -4, z: 6, h: 3 },
+    { x: 8, z: -3, h: 2 },
+    { x: -7, z: -5, h: 2.8 },
+    { x: 3, z: -8, h: 1.8 },
+    { x: -10, z: 1, h: 2.2 },
+    { x: 0, z: 10, h: 2.3 },
+    // Removed cactus at {x: 5, z: 9, h: 1.9} - player now spawns there
+    { x: -5, z: -9, h: 2.4 },
+  ];
+
+  cactusPositions.forEach(pos => {
+    const cactus = createCactus(pos.h);
+    cactus.position.set(pos.x, floorY, pos.z);
+    cactus.rotation.y = Math.random() * Math.PI * 2;
+    group.add(cactus);
+  });
+
+  // === TWINKLING STARS (400 particles - reduced from 800 for performance) ===
+  const starCount = 400;
+  const starPositions = new Float32Array(starCount * 3);
+  const starPhases = new Float32Array(starCount);
+
+  for (let i = 0; i < starCount; i++) {
+    // Hemisphere distribution
+    const theta = Math.random() * Math.PI * 2;
+    const radius = 80 + Math.random() * 40; // 80-120
+    const phi = Math.random() * Math.PI * 0.5; // Upper hemisphere
+
+    starPositions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
+    starPositions[i * 3 + 1] = Math.cos(phi) * radius + 10; // Offset up
+    starPositions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
+    starPhases[i] = Math.random() * Math.PI * 2;
+  }
+
+  const starGeometry = new THREE.BufferGeometry();
+  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
+  starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
+
+  const starMaterial = new THREE.ShaderMaterial({
+    uniforms: {
+      uTime: { value: 0 },
+      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
+    },
+    vertexShader: `
+      attribute float aPhase;
+      uniform float uTime;
+      uniform float uPixelRatio;
+      varying float vTwinkle;
+      void main() {
+        vTwinkle = 0.5 + 0.5 * sin(uTime * 2.0 + aPhase);
+        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
+        float size = 2.0 * uPixelRatio * vTwinkle;
+        gl_PointSize = size * (200.0 / -mvPosition.z);
+        gl_Position = projectionMatrix * mvPosition;
+      }
+    `,
+    fragmentShader: `
+      varying float vTwinkle;
+      void main() {
+        float dist = length(gl_PointCoord - vec2(0.5));
+        if (dist > 0.5) discard;
+        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
+        vec3 color = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.95, 0.9), vTwinkle);
+        gl_FragColor = vec4(color * (0.7 + vTwinkle * 0.3), alpha * vTwinkle);
+      }
+    `,
+    transparent: true,
+    depthWrite: false,
+    fog: false,
+    blending: THREE.AdditiveBlending
+  });
+
+  const stars = new THREE.Points(starGeometry, starMaterial);
+  stars.frustumCulled = false; // Fix disappearing when looking up
+  stars.renderOrder = 999;
+  group.add(stars);
+  registerFadeMaterial(starMaterial);
+
+  // === DUST PARTICLES (300 particles - reduced from 600 for performance) ===
+  const dustCount = 300;
+  const dustPositions = new Float32Array(dustCount * 3);
+  const dustPhases = new Float32Array(dustCount);
+
+  for (let i = 0; i < dustCount; i++) {
+    dustPositions[i * 3] = (Math.random() - 0.5) * 60;
+    dustPositions[i * 3 + 1] = Math.random() * 15 + floorY;
+    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
+    dustPhases[i] = Math.random() * Math.PI * 2;
+  }
+
+  const dustGeometry = new THREE.BufferGeometry();
+  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
+  dustGeometry.setAttribute('aPhase', new THREE.BufferAttribute(dustPhases, 1));
+
+  const dustMaterial = new THREE.ShaderMaterial({
+    uniforms: {
+      uTime: { value: 0 },
+      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
+    },
+    vertexShader: `
+      attribute float aPhase;
+      uniform float uTime;
+      uniform float uPixelRatio;
+      varying float vAlpha;
+      void main() {
+        vAlpha = 0.5 + 0.3 * sin(uTime + aPhase);
+        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
+        gl_PointSize = 4.0 * uPixelRatio;
+        gl_Position = projectionMatrix * mvPosition;
+      }
+    `,
+    fragmentShader: `
+      varying float vAlpha;
+      void main() {
+        float dist = length(gl_PointCoord - vec2(0.5));
+        if (dist > 0.5) discard;
+        float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha * 1.2;
+        vec3 dustColor = vec3(0.8, 0.85, 0.9);
+        gl_FragColor = vec4(dustColor, alpha);
+      }
+    `,
+    transparent: true,
+    depthWrite: false,
+    fog: false,
+    blending: THREE.AdditiveBlending
+  });
+
+  const dust = new THREE.Points(dustGeometry, dustMaterial);
+  dust.renderOrder = 999;
+  group.add(dust);
+  registerFadeMaterial(dustMaterial);
+
+  // Moon
+  const moonGroup = new THREE.Group();
+  const moonGeometry = new THREE.IcosahedronGeometry(8, 2);
+  const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xfffef8 });
+  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
+  moonGroup.add(moon);
+  registerFadeMaterial(moonMaterial);
+  const innerGlowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
+  const innerGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(9.5, 2), innerGlowMat);
+  const outerGlowMat = new THREE.MeshBasicMaterial({ color: 0xd4e5f7, transparent: true, opacity: 0.12 });
+  const outerGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(13, 2), outerGlowMat);
+  const farGlowMat = new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.06 });
+  const farGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(18, 2), farGlowMat);
+  moonGroup.add(innerGlow, outerGlow, farGlow);
+  registerFadeMaterial(innerGlowMat);
+  registerFadeMaterial(outerGlowMat);
+  registerFadeMaterial(farGlowMat);
+  moonGroup.position.set(-45, 35, -60);
+  group.add(moonGroup);
+
+  // Desert floor HUD height: Y = -0.20, rotated 25 degrees (-0.436 rad)
+  group.rotation.y = -0.436; // yaw: -25 degrees
+  group.position.set(-2.12, -0.20, -4.82);  // Moved 5 units +X and +Z
+
+  // Frame counter for throttling dust particle updates (Issue 4: reduce CPU cost)
+  let desertFrameCount = 0;
+
+  // === ANIMATION UPDATE ===
+  group.userData.update = (now, dt) => {
+    const time = now * 0.001;
+    // Update stars twinkle (shader-based, already efficient)
+    starMaterial.uniforms.uTime.value = time;
+    // Update dust shader time
+    dustMaterial.uniforms.uTime.value = time;
+
+    // Throttle dust particle position updates to every 5th frame (Issue 4: reduce CPU cost)
+    desertFrameCount++;
+    if (desertFrameCount % 5 === 0) {
+      const dustPos = dustGeometry.attributes.position.array;
+      for (let i = 0; i < dustCount; i++) {
+        const idx = i * 3;
+        // Gentle wind drift (scaled by 5 since we only update every 5th frame)
+        dustPos[idx] += 0.025 * dt;
+        dustPos[idx + 1] += Math.sin(time + dustPhases[i]) * 0.005 * dt;
+        dustPos[idx + 2] += Math.cos(time * 0.7 + dustPhases[i]) * 0.01 * dt;
+
+        // Wrap around boundaries
+        if (dustPos[idx] > 30) dustPos[idx] = -30;
+        if (dustPos[idx] < -30) dustPos[idx] = 30;
+        if (dustPos[idx + 1] > floorY + 15) dustPos[idx + 1] = floorY;
+        if (dustPos[idx + 1] < floorY) dustPos[idx + 1] = floorY + 15;
+        if (dustPos[idx + 2] > 30) dustPos[idx + 2] = -30;
+        if (dustPos[idx + 2] < -30) dustPos[idx + 2] = 30;
+      }
+      dustGeometry.attributes.position.needsUpdate = true;
+    }
+  };
+}
+
+function buildAlienPlanetScene(group, deps) {
+  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
+  
+  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
+  const floorY = floorHeight - 0.3; // Move everything down 0.3 units to fix floor HUD being under floor
+
+  // Ground
+  const groundGeo = new THREE.PlaneGeometry(300, 300, 84, 84);
+  const groundPositions = groundGeo.attributes.position;
+  for (let i = 0; i < groundPositions.count; i++) {
+    const x = groundPositions.getX(i);
+    const y = groundPositions.getY(i);
+    groundPositions.setZ(i, Math.sin(x * 0.03) * Math.cos(y * 0.03) * 0.3);
+  }
+  groundGeo.computeVertexNormals();
+  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0510, roughness: 1, metalness: 0, flatShading: true });
+  const ground = new THREE.Mesh(groundGeo, groundMat);
+  ground.name = 'alien-planet-ground-plane';
+  ground.userData.planeName = 'alien-planet-ground-plane';
+  ground.rotation.x = -Math.PI / 2;
+  ground.position.y = floorY;
+  ground.frustumCulled = false;
+  group.add(ground);
+
+  // Flash overlay plane for damage feedback (Issue 2: 320x320 for full floor coverage)
+  const flashGeo = new THREE.PlaneGeometry(320, 320);
+  const flashMat = new THREE.MeshBasicMaterial({
+    color: 0xff0000,
+    transparent: true,
+    opacity: 0,
+    depthWrite: false,
+    side: THREE.DoubleSide
+  });
+  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
+  flashPlane.name = 'alien-planet-damage-flash-plane';
+  flashPlane.userData.planeName = 'alien-planet-damage-flash-plane';
+  flashPlane.rotation.x = -Math.PI / 2;
+  flashPlane.position.y = floorY + 0.1;
+  flashPlane.frustumCulled = false;
+  group.add(flashPlane);
+  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });
+
+  // Moon and glow
+  const moonGeo = new THREE.IcosahedronGeometry(24, 1);
+  const moonMat = new THREE.MeshBasicMaterial({ color: 0xddaaff, transparent: true, opacity: 0.95 });
+  const moon = new THREE.Mesh(moonGeo, moonMat);
+  moon.position.set(60, 80, -40);
+  moon.frustumCulled = false; // Fix disappearing when looking up
+  group.add(moon);
+  const moonGlowGeo = new THREE.IcosahedronGeometry(36, 1);
+  const moonGlowMat = new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.15, side: THREE.BackSide });
+  const moonGlow = new THREE.Mesh(moonGlowGeo, moonGlowMat);
+  moonGlow.position.copy(moon.position);
+  moonGlow.frustumCulled = false; // Fix disappearing when looking up
+  group.add(moonGlow);
+  registerFadeMaterial(moonMat);
+  registerFadeMaterial(moonGlowMat);
+
+  // Floating crystals (5)
+  const crystalGeo = new THREE.OctahedronGeometry(1.2, 0);
+  const crystalMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.8 });
+  const crystalPositions = [
+    { x: 10, z: 10 },
+    { x: -12, z: 8 },
+    { x: 8, z: -15 },
+    { x: -15, z: -10 },
+    { x: 0, z: 20 },
+  ];
+  const crystals = [];
+  crystalPositions.forEach((pos) => {
+    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
+    crystal.position.set(pos.x, floorY + 4 + Math.random() * 2, pos.z);
+    crystal.scale.set(1, 2, 1);
+    crystal.rotation.y = Math.random() * Math.PI;
+    crystal.frustumCulled = false;
+    group.add(crystal);
+    crystals.push(crystal);
+  });
+  registerFadeMaterial(crystalMat);
+
+  // Glowing orbs (4)
+  const orbGeo = new THREE.SphereGeometry(0.8, 16, 16);
+  const orbMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 });
+  const orbPositions = [
+    { x: 5, z: -5 },
+    { x: -8, z: 12 },
+    { x: 15, z: 5 },
+    { x: -3, z: -18 },
+  ];
+  const orbs = [];
+  orbPositions.forEach((pos) => {
+    const orb = new THREE.Mesh(orbGeo, orbMat);
+    orb.position.set(pos.x, floorY + 3 + Math.random() * 3, pos.z);
+    orb.frustumCulled = false;
+    group.add(orb);
+    orbs.push(orb);
+  });
+  registerFadeMaterial(orbMat);
+
+  // Atmospheric fog (very light, to add depth)
+  // Removed THREE.Fog - causes visibility issues at distance
+
+  // Stars
+  const starCount = 200;
+  const starPositions = new Float32Array(starCount * 3);
+  for (let i = 0; i < starCount; i++) {
+    starPositions[i * 3] = (Math.random() - 0.5) * 200;
+    starPositions[i * 3 + 1] = Math.random() * 100 + 20;
+    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 200;
+  }
+  const starGeo = new THREE.BufferGeometry();
+  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
+  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.8 });
+  const stars = new THREE.Points(starGeo, starMat);
+  stars.frustumCulled = false; // Fix disappearing when looking up
+  group.add(stars);
+  registerFadeMaterial(starMat);
+
+  // Animation
+  group.userData.update = (now, dt) => {
+    const t = now * 0.001;
+    // Float crystals
+    crystals.forEach((crystal, i) => {
+      crystal.position.y = floorY + 4 + Math.sin(t + i * 2) * 0.5;
+      crystal.rotation.y += dt * 0.5;
+    });
+    // Float orbs
+    orbs.forEach((orb, i) => {
+      orb.position.y = floorY + 3 + Math.sin(t * 1.5 + i * 3) * 0.8;
+    });
+  };
+
+  // Alien floor HUD height: Y = -0.28, no rotation
+  group.position.set(-0.048, -0.28, -2.475);
+}
+
+function buildHellscapeLavaScene(group, deps) {
+  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
+  
+  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
+  const floorY = floorHeight;
+  const sceneColor = 0x1a0505;
+
+  // Sky dome (dark red/black)
+  const skyGeo = new THREE.SphereGeometry(500, 32, 24);
+  const skyMat = new THREE.MeshBasicMaterial({
+    color: sceneColor,
+    side: THREE.BackSide,
+  });
+  const sky = new THREE.Mesh(skyGeo, skyMat);
+  sky.frustumCulled = false;
+  sky.renderOrder = -20;
+  group.add(sky);
+  registerFadeMaterial(skyMat);
+
+  // Lighting
+  const ambientLight = new THREE.AmbientLight(0x331111, 0.3);
+  group.add(ambientLight);
+
+  // Ground with lava rivers
+  const groundGeo = new THREE.PlaneGeometry(200, 200, 100, 100);
+  groundGeo.rotateX(-Math.PI / 2);
+  const groundPos = groundGeo.attributes.position;
+  const groundColors = [];
+  for (let i = 0; i < groundPos.count; i++) {
+    const x = groundPos.getX(i);
+    const z = groundPos.getZ(i);
+    // Lava river pattern
+    const lavaPattern = Math.sin(x * 0.05) * Math.cos(z * 0.05) + Math.sin(x * 0.1 + z * 0.1) * 0.5;
+    const isLava = lavaPattern > 0.3;
+    const height = isLava ? -0.5 : Math.sin(x * 0.02) * Math.cos(z * 0.02) * 2;
+    groundPos.setY(i, height);
+    const color = isLava ? new THREE.Color(0xff2200) : new THREE.Color(0x1a0505);
+    groundColors.push(color.r, color.g, color.b);
+  }
+  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3));
+  groundGeo.computeVertexNormals();
+  const groundMat = new THREE.MeshBasicMaterial({ vertexColors: true });
+  const ground = new THREE.Mesh(groundGeo, groundMat);
+  ground.name = 'hellscape-lava-ground';
+  ground.userData.planeName = 'hellscape-lava-ground';
+  ground.position.y = floorY;
+  ground.frustumCulled = false;
+  group.add(ground);
+  registerFadeMaterial(groundMat);
+
+  // Flash overlay for damage feedback
+  const flashGeo = new THREE.PlaneGeometry(200, 200);
+  const flashMat = new THREE.MeshBasicMaterial({
+    color: 0xff0000,
+    transparent: true,
+    opacity: 0,
+    depthWrite: false,
+    side: THREE.DoubleSide
+  });
+  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
+  flashPlane.name = 'hellscape-lava-damage-flash-plane';
+  flashPlane.userData.planeName = 'hellscape-lava-damage-flash-plane';
+  flashPlane.rotation.x = -Math.PI / 2;
+  flashPlane.position.y = floorY + 0.1;
+  flashPlane.frustumCulled = false;
+  group.add(flashPlane);
+  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });
+
+  // Lava glow plane (below ground for glow effect)
+  const glowGeo = new THREE.PlaneGeometry(200, 200);
+  const glowMat = new THREE.MeshBasicMaterial({
+    color: 0xff4400,
+    transparent: true,
+    opacity: 0.5,
+    depthWrite: false,
+    side: THREE.DoubleSide
+  });
+  const glowPlane = new THREE.Mesh(glowGeo, glowMat);
+  glowPlane.rotation.x = -Math.PI / 2;
+  glowPlane.position.y = floorY - 0.6;
+  glowPlane.frustumCulled = false;
+  group.add(glowPlane);
+  registerFadeMaterial(glowMat);
+
+  // Fire particles
+  const fireCount = 150;
+  const firePositions = new Float32Array(fireCount * 3);
+  const fireVelocities = [];
+  const fireLifetimes = [];
+  for (let i = 0; i < fireCount; i++) {
+    firePositions[i * 3] = (Math.random() - 0.5) * 80;
+    firePositions[i * 3 + 1] = floorY - 0.3;
+    firePositions[i * 3 + 2] = (Math.random() - 0.5) * 80;
+    fireVelocities.push({
+      x: (Math.random() - 0.5) * 0.1,
+      y: 0.5 + Math.random() * 1.5,
+      z: (Math.random() - 0.5) * 0.1
+    });
+    fireLifetimes.push(Math.random() * 2);
+  }
+  const fireGeo = new THREE.BufferGeometry();
+  fireGeo.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));
+  const fireMat = new THREE.PointsMaterial({
+    color: 0xff6600,
+    size: 0.8,
+    transparent: true,
+    opacity: 0.8,
+    blending: THREE.AdditiveBlending
+  });
+  const fire = new THREE.Points(fireGeo, fireMat);
+  fire.frustumCulled = false;
+  group.add(fire);
+  registerFadeMaterial(fireMat);
+
+  // Ember particles (smaller, faster)
+  const emberCount = 200;
+  const emberPositions = new Float32Array(emberCount * 3);
+  const emberVelocities = [];
+  for (let i = 0; i < emberCount; i++) {
+    emberPositions[i * 3] = (Math.random() - 0.5) * 100;
+    emberPositions[i * 3 + 1] = floorY + Math.random() * 30;
+    emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
+    emberVelocities.push({
+      x: (Math.random() - 0.5) * 0.2,
+      y: 0.3 + Math.random() * 0.5,
+      z: (Math.random() - 0.5) * 0.2
+    });
+  }
+  const emberGeo = new THREE.BufferGeometry();
+  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
+  const emberMat = new THREE.PointsMaterial({
+    color: 0xffaa00,
+    size: 0.3,
+    transparent: true,
+    opacity: 0.6,
+    blending: THREE.AdditiveBlending
+  });
+  const embers = new THREE.Points(emberGeo, emberMat);
+  embers.frustumCulled = false;
+  group.add(embers);
+  registerFadeMaterial(emberMat);
+
+  // Rocky outcrops (procedural)
+  const createRock = () => {
+    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
+    const rockMat = new THREE.MeshBasicMaterial({ color: 0x2a1515, flatShading: true });
+    const rock = new THREE.Mesh(rockGeo, rockMat);
+    rock.scale.set(
+      1 + Math.random() * 2,
+      1 + Math.random() * 3,
+      1 + Math.random() * 2
+    );
+    rock.rotation.set(
+      Math.random() * Math.PI,
+      Math.random() * Math.PI,
+      Math.random() * Math.PI
+    );
+    registerFadeMaterial(rockMat);
+    return rock;
+  };
+
+  const rockPositions = [
+    { x: 15, z: 15 },
+    { x: -20, z: 10 },
+    { x: 10, z: -25 },
+    { x: -15, z: -20 },
+    { x: 25, z: -10 },
+    { x: -30, z: 25 },
+  ];
+  rockPositions.forEach((pos) => {
+    const rock = createRock();
+    rock.position.set(pos.x, floorY + 1, pos.z);
+    group.add(rock);
+  });
+
+  // Ash particles (floating grey particles)
+  const ashCount = 100;
+  const ashPositions = new Float32Array(ashCount * 3);
+  for (let i = 0; i < ashCount; i++) {
+    ashPositions[i * 3] = (Math.random() - 0.5) * 80;
+    ashPositions[i * 3 + 1] = Math.random() * 20 + floorY;
+    ashPositions[i * 3 + 2] = (Math.random() - 0.5) * 80;
+  }
+  const ashGeo = new THREE.BufferGeometry();
+  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPositions, 3));
+  const ashMat = new THREE.PointsMaterial({
+    color: 0x666666,
+    size: 0.2,
+    transparent: true,
+    opacity: 0.4
+  });
+  const ash = new THREE.Points(ashGeo, ashMat);
+  ash.frustumCulled = false;
+  group.add(ash);
+  registerFadeMaterial(ashMat);
+
+  // Geyser particles (periodic bursts)
+  const GEYSER_PARTICLE_COUNT = 50;
+  const geyserPos = new Float32Array(GEYSER_PARTICLE_COUNT * 3);
+  const geyserSizes = new Float32Array(GEYSER_PARTICLE_COUNT);
+  const geyserParticleData = [];
+  for (let i = 0; i < GEYSER_PARTICLE_COUNT; i++) {
+    geyserPos[i * 3] = 0;
+    geyserPos[i * 3 + 1] = -1000; // Hidden initially
+    geyserPos[i * 3 + 2] = 0;
+    geyserSizes[i] = 0;
+    geyserParticleData.push({
+      active: false,
+      x: 0, y: 0, z: 0,
+      vx: 0, vy: 0, vz: 0,
+      life: 0,
+      maxLife: 0
+    });
+  }
+  const geyserGeo = new THREE.BufferGeometry();
+  geyserGeo.setAttribute('position', new THREE.BufferAttribute(geyserPos, 3));
+  geyserGeo.setAttribute('aSize', new THREE.BufferAttribute(geyserSizes, 1));
+  const geyserMat = new THREE.ShaderMaterial({
+    uniforms: {
+      uColor: { value: new THREE.Color(0xff6600) }
+    },
+    vertexShader: `
+      attribute float aSize;
+      void main() {
+        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
+        gl_PointSize = aSize * (300.0 / -mvPosition.z);
+        gl_Position = projectionMatrix * mvPosition;
+      }
+    `,
+    fragmentShader: `
+      uniform vec3 uColor;
+      void main() {
+        float dist = length(gl_PointCoord - vec2(0.5));
+        if (dist > 0.5) discard;
+        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
+        gl_FragColor = vec4(uColor, alpha * 0.8);
+      }
+    `,
+    transparent: true,
+    depthWrite: false,
+    blending: THREE.AdditiveBlending
+  });
+  const geyserParticles = new THREE.Points(geyserGeo, geyserMat);
+  geyserParticles.frustumCulled = false;
+  group.add(geyserParticles);
+  registerFadeMaterial(geyserMat);
+
+  // Flame pillars (3 locations with constant particle streams)
+  const FLAME_PILLAR_PARTICLES = 60;
+  const TOTAL_FLAME_PILLAR_PARTICLES = FLAME_PILLAR_PARTICLES * 3;
+  const flamePillarPos = new Float32Array(TOTAL_FLAME_PILLAR_PARTICLES * 3);
+  const flamePillarSizes = new Float32Array(TOTAL_FLAME_PILLAR_PARTICLES);
+  const flameParticleData = [];
+  const pillarDefs = [
+    { x: -20, z: -15, height: 15, speed: 8 },
+    { x: 15, z: -20, height: 12, speed: 10 },
+    { x: 0, z: 20, height: 18, speed: 7 }
+  ];
+
+  const initFlameParticle = (i) => {
+    const pillarIdx = Math.floor(i / FLAME_PILLAR_PARTICLES);
+    const pillar = pillarDefs[pillarIdx];
+    const pd = flameParticleData[i];
+    pd.pillarIdx = pillarIdx;
+    pd.t = Math.random();
+    pd.speed = 0.8 + Math.random() * 0.4;
+    pd.driftPhase = Math.random() * Math.PI * 2;
+    pd.driftAmp = 0.3 + Math.random() * 0.4;
+
+    const i3 = i * 3;
+    flamePillarPos[i3] = pillar.x + (Math.random() - 0.5) * 2;
+    flamePillarPos[i3 + 1] = floorY + pd.t * pillar.height;
+    flamePillarPos[i3 + 2] = pillar.z + (Math.random() - 0.5) * 2;
+    flamePillarSizes[i] = 2.0;
+  };
+
+  for (let i = 0; i < TOTAL_FLAME_PILLAR_PARTICLES; i++) {
+    flameParticleData.push({
+      pillarIdx: 0,
+      t: 0,
+      speed: 1,
+      driftPhase: 0,
+      driftAmp: 0
+    });
+    initFlameParticle(i);
+  }
+
+  const flamePillarGeo = new THREE.BufferGeometry();
+  flamePillarGeo.setAttribute('position', new THREE.BufferAttribute(flamePillarPos, 3));
+  flamePillarGeo.setAttribute('aSize', new THREE.BufferAttribute(flamePillarSizes, 1));
+  const flamePillarMat = new THREE.ShaderMaterial({
+    uniforms: {
+      uColor: { value: new THREE.Color(0xff4400) }
+    },
+    vertexShader: `
+      attribute float aSize;
+      void main() {
+        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
+        gl_PointSize = aSize * (200.0 / -mvPosition.z);
+        gl_Position = projectionMatrix * mvPosition;
+      }
+    `,
+    fragmentShader: `
+      uniform vec3 uColor;
+      void main() {
+        float dist = length(gl_PointCoord - vec2(0.5));
+        if (dist > 0.5) discard;
+        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
+        gl_FragColor = vec4(uColor, alpha * 0.9);
+      }
+    `,
+    transparent: true,
+    depthWrite: false,
+    blending: THREE.AdditiveBlending
+  });
+  const flamePillars = new THREE.Points(flamePillarGeo, flamePillarMat);
+  flamePillars.frustumCulled = false;
+  group.add(flamePillars);
+  registerFadeMaterial(flamePillarMat);
+
+  // Geyser state
+  let lastGeyserTime = 0;
+  const geyserInterval = 2000; // ms between bursts
+  const activeGeyserParticles = [];
+
+  const createGeyserBurst = (now) => {
+    const burstX = (Math.random() - 0.5) * 60;
+    const burstZ = (Math.random() - 0.5) * 60;
+
+    for (let i = 0; i < 15; i++) {
+      const particleIdx = activeGeyserParticles.length % GEYSER_PARTICLE_COUNT;
+      const pd = geyserParticleData[particleIdx];
+      pd.active = true;
+      pd.x = burstX + (Math.random() - 0.5) * 2;
+      pd.y = floorY;
+      pd.z = burstZ + (Math.random() - 0.5) * 2;
+      pd.vx = (Math.random() - 0.5) * 4;
+      pd.vy = 10 + Math.random() * 8;
+      pd.vz = (Math.random() - 0.5) * 4;
+      pd.life = 0;
+      pd.maxLife = 1.5 + Math.random() * 1;
+
+      if (activeGeyserParticles.length < GEYSER_PARTICLE_COUNT) {
+        activeGeyserParticles.push(particleIdx);
+      }
+    }
+  };
+
+  // Animation update
+  group.userData.update = (now, dt) => {
+    const time = now * 0.001;
+    const dtSec = dt * 0.001;
+
+    // Fire particles
+    const firePos = fireGeo.attributes.position.array;
+    for (let i = 0; i < fireCount; i++) {
+      const idx = i * 3;
+      firePos[idx] += fireVelocities[i].x * dt;
+      firePos[idx + 1] += fireVelocities[i].y * dt;
+      firePos[idx + 2] += fireVelocities[i].z * dt;
+      fireLifetimes[i] += dtSec;
+
+      if (fireLifetimes[i] > 2 || firePos[idx + 1] > floorY + 10) {
+        firePos[idx] = (Math.random() - 0.5) * 80;
+        firePos[idx + 1] = floorY - 0.3;
+        firePos[idx + 2] = (Math.random() - 0.5) * 80;
+        fireLifetimes[i] = 0;
+      }
+    }
+    fireGeo.attributes.position.needsUpdate = true;
+
+    // Ember particles
+    const emberPosArr = emberGeo.attributes.position.array;
+    for (let i = 0; i < emberCount; i++) {
+      const idx = i * 3;
+      emberPosArr[idx] += emberVelocities[i].x * dt;
+      emberPosArr[idx + 1] += emberVelocities[i].y * dt;
+      emberPosArr[idx + 2] += emberVelocities[i].z * dt;
+
+      if (emberPosArr[idx + 1] > floorY + 30) {
+        emberPosArr[idx] = (Math.random() - 0.5) * 100;
+        emberPosArr[idx + 1] = floorY;
+        emberPosArr[idx + 2] = (Math.random() - 0.5) * 100;
+      }
+    }
+    emberGeo.attributes.position.needsUpdate = true;
+
+    // Ash particles
+    const ashPosArr = ashGeo.attributes.position.array;
+    for (let i = 0; i < ashCount; i++) {
+      const idx = i * 3;
+      ashPosArr[idx] += Math.sin(time + i) * 0.02;
+      ashPosArr[idx + 1] += 0.01 * dt;
+      ashPosArr[idx + 2] += Math.cos(time + i) * 0.02;
+
+      if (ashPosArr[idx] > 40) ashPosArr[idx] = -40;
+      if (ashPosArr[idx] < -40) ashPosArr[idx] = 40;
+      if (ashPosArr[idx + 1] > floorY + 20) ashPosArr[idx + 1] = floorY;
+      if (ashPosArr[idx + 2] > 40) ashPosArr[idx + 2] = -40;
+      if (ashPosArr[idx + 2] < -40) ashPosArr[idx + 2] = 40;
+    }
+    ashGeo.attributes.position.needsUpdate = true;
+
+    // Geyser trigger and update
+    if (now - lastGeyserTime > geyserInterval) {
+      createGeyserBurst(now);
+      lastGeyserTime = now;
+    }
+
+    const geyserPosArr = geyserGeo.attributes.position.array;
+    let activeCount = 0;
+    for (let i = geyserParticleData.length - 1; i >= 0; i--) {
+      const p = geyserParticleData[i];
+      if (!p.active) continue;
+
+      p.life += dtSec;
+
+      if (p.life > p.maxLife) {
+        p.active = false;
+        continue;
+      }
+
+      p.x += p.vx * dtSec;
+      p.y += p.vy * dtSec;
+      p.z += p.vz * dtSec;
+      p.vy -= 18 * dtSec;
+
+      const idx = activeCount * 3;
+      geyserPosArr[idx] = p.x;
+      geyserPosArr[idx + 1] = p.y;
+      geyserPosArr[idx + 2] = p.z;
+      activeCount++;
+    }
+    geyserGeo.setDrawRange(0, activeCount);
+    geyserGeo.attributes.position.needsUpdate = true;
+
+    // Flame pillar animation
+    const fpPos = flamePillarGeo.attributes.position.array;
+    const fpSizes = flamePillarGeo.attributes.aSize.array;
+    for (let i = 0; i < TOTAL_FLAME_PILLAR_PARTICLES; i++) {
+      const pd = flameParticleData[i];
+      const pillar = pillarDefs[pd.pillarIdx];
+      const i3 = i * 3;
+
+      pd.t += (pd.speed * dtSec * pillar.speed) / Math.max(1, pillar.height);
+
+      if (pd.t >= 1.0) {
+        initFlameParticle(i);
+      } else {
+        const driftWave = Math.sin(time * 2.2 + pd.driftPhase) * pd.driftAmp * dtSec;
+        fpPos[i3] += Math.cos(pd.driftPhase) * driftWave;
+        fpPos[i3 + 1] += pd.speed * dtSec * pillar.speed;
+        fpPos[i3 + 2] += Math.sin(pd.driftPhase) * driftWave;
+
+        fpSizes[i] = Math.max(0.3, (1.0 - pd.t) * 3.0);
+      }
+    }
+    flamePillarGeo.attributes.position.needsUpdate = true;
+    flamePillarGeo.attributes.aSize.needsUpdate = true;
+  };
+
+  // Hellscape floor HUD height: group.position.y = 0.05
+  group.position.set(26.599, 0.05, -0.486);
+  group.rotation.y = 0.248; // yaw: 14.21°
+}
diff --git a/boss-death-cinematic.js b/boss-death-cinematic.js
new file mode 100644
index 0000000..22d75d1
--- /dev/null
+++ b/boss-death-cinematic.js
@@ -0,0 +1,288 @@
+// ============================================================
+//  Boss Death Cinematic System
+//  Extracted from main.js for modularity
+//  Handles the visual cinematic sequence when a boss is defeated
+// ============================================================
+
+import * as THREE from 'three';
+
+// Timing constants for the cinematic sequence
+export const BOSS_DEATH_FREEZE = 0.18;
+export const BOSS_DEATH_EXPLOSION_TIME = 0.9;
+export const BOSS_DEATH_WHITE_FADE = 0.35;
+export const BOSS_DEATH_BLACK_FADE = 0.55;
+export const BOSS_DEATH_EXPLOSION_INTERVAL = 0.12;
+
+// Internal state
+let bossDeathFreezeTimer = 0;
+let bossDeathWhiteOverlay = null;
+let bossDeathBlackOverlay = null;
+let bossDeathCinematic = {
+  active: false,
+  timer: 0,
+  explosionTimer: 0,
+  bossPos: new THREE.Vector3(),
+  wasFinalBoss: false,
+};
+
+// External dependencies (injected via init)
+let deps = {
+  camera: null,
+  game: null,
+  State: null,
+  spawnBossDebris: null,
+  spawnExplosionVisual: null,
+  hideBossHealthBar: null,
+  clearBoss: null,
+  clearAllTelegraphs: null,
+  playExplosionSound: null,
+  stopMusic: null,
+  completeLevel: null,
+  endGame: null,
+  applyEnvironmentFade: null,
+  resetAllSlowMoState: null,
+  hideKillsAlert: null,
+};
+
+/**
+ * Initialize the boss death cinematic system with external dependencies
+ * @param {Object} options - Dependency injection
+ * @param {THREE.Camera} options.camera - The main camera
+ * @param {Object} options.game - The game state object
+ * @param {Object} options.State - The game state enum
+ * @param {Function} options.spawnBossDebris - Spawn boss debris function
+ * @param {Function} options.spawnExplosionVisual - Spawn explosion visual function
+ * @param {Function} options.hideBossHealthBar - Hide boss health bar function
+ * @param {Function} options.clearBoss - Clear boss function
+ * @param {Function} options.clearAllTelegraphs - Clear all telegraphs function
+ * @param {Function} options.playExplosionSound - Play explosion sound function
+ * @param {Function} options.stopMusic - Stop music function
+ * @param {Function} options.completeLevel - Complete level function
+ * @param {Function} options.endGame - End game function
+ * @param {Function} options.applyEnvironmentFade - Apply environment fade function
+ * @param {Function} options.resetAllSlowMoState - Reset slow-mo state function
+ * @param {Function} options.hideKillsAlert - Hide kills alert function
+ */
+export function initBossDeathCinematic(options) {
+  deps = { ...deps, ...options };
+}
+
+/**
+ * Get the current freeze timer value (for main.js render loop)
+ * @returns {number} The freeze timer value
+ */
+export function getBossDeathFreezeTimer() {
+  return bossDeathFreezeTimer;
+}
+
+/**
+ * Check if boss death cinematic is currently active
+ * @returns {boolean} True if cinematic is active
+ */
+export function isBossDeathCinematicActive() {
+  return bossDeathCinematic.active;
+}
+
+/**
+ * Initialize the white and black overlay meshes attached to the camera
+ * These are used for the death cinematic fade effects
+ */
+export function initBossDeathOverlays() {
+  if (!deps.camera) {
+    console.warn('[boss-cinematic] Camera not set, cannot init overlays');
+    return;
+  }
+
+  const geo = new THREE.PlaneGeometry(6, 6);
+  bossDeathWhiteOverlay = new THREE.Mesh(
+    geo,
+    new THREE.MeshBasicMaterial({
+      color: 0xffffff,
+      transparent: true,
+      opacity: 0,
+      depthTest: false,
+      depthWrite: false,
+      side: THREE.DoubleSide,
+    }),
+  );
+  bossDeathWhiteOverlay.renderOrder = 1002;
+  bossDeathWhiteOverlay.visible = false;
+  bossDeathWhiteOverlay.frustumCulled = false;  // Prevent disappearing when looking around
+  bossDeathWhiteOverlay.position.set(0, 0, -0.26);
+  deps.camera.add(bossDeathWhiteOverlay);
+
+  bossDeathBlackOverlay = new THREE.Mesh(
+    geo,
+    new THREE.MeshBasicMaterial({
+      color: 0x000000,
+      transparent: true,
+      opacity: 0,
+      depthTest: false,
+      depthWrite: false,
+      side: THREE.DoubleSide,
+    }),
+  );
+  bossDeathBlackOverlay.renderOrder = 1003;
+  bossDeathBlackOverlay.visible = false;
+  bossDeathBlackOverlay.frustumCulled = false;  // Prevent disappearing when looking around
+  bossDeathBlackOverlay.position.set(0, 0, -0.25);
+  deps.camera.add(bossDeathBlackOverlay);
+}
+
+/**
+ * Start the boss death cinematic sequence
+ * @param {Object} boss - The boss object that was killed
+ */
+export function startBossDeathCinematic(boss) {
+  if (!boss || bossDeathCinematic.active) return;
+
+  console.log('[boss-cinematic] Starting boss death cinematic');
+
+  if (deps.resetAllSlowMoState) deps.resetAllSlowMoState();
+  bossDeathCinematic.active = true;
+  bossDeathCinematic.timer = 0;
+  bossDeathCinematic.explosionTimer = 0;
+  bossDeathCinematic.bossPos.copy(boss.mesh.position);
+  bossDeathCinematic.wasFinalBoss = deps.game && deps.game.level >= 20;
+  bossDeathFreezeTimer = BOSS_DEATH_FREEZE;
+
+  // Ensure overlays exist and are properly initialized
+  if (bossDeathWhiteOverlay) {
+    bossDeathWhiteOverlay.material.opacity = 0;
+    bossDeathWhiteOverlay.visible = true;  // Set visible so opacity changes take effect
+  } else {
+    console.warn('[boss-cinematic] White overlay not initialized!');
+  }
+  if (bossDeathBlackOverlay) {
+    bossDeathBlackOverlay.material.opacity = 0;
+    bossDeathBlackOverlay.visible = true;  // Set visible so opacity changes take effect
+  } else {
+    console.warn('[boss-cinematic] Black overlay not initialized!');
+  }
+
+  if (deps.spawnBossDebris) deps.spawnBossDebris(boss);
+  if (typeof window !== 'undefined' && window.playBossDeath) {
+    window.playBossDeath();
+  }
+  if (deps.stopMusic) deps.stopMusic();
+  if (deps.playExplosionSound) deps.playExplosionSound();
+  if (deps.hideBossHealthBar) deps.hideBossHealthBar();
+  if (deps.clearBoss) deps.clearBoss();
+  if (deps.clearAllTelegraphs) deps.clearAllTelegraphs();
+
+  if (deps.game && deps.State) {
+    deps.game.state = deps.State.BOSS_DEATH_CINEMATIC;
+  }
+  console.log('[boss-cinematic] State set to BOSS_DEATH_CINEMATIC');
+}
+
+/**
+ * Finish the boss death cinematic and transition to next state
+ */
+export function finishBossDeathCinematic() {
+  bossDeathCinematic.active = false;
+  bossDeathCinematic.timer = 0;
+  bossDeathCinematic.explosionTimer = 0;
+
+  if (bossDeathWhiteOverlay) {
+    bossDeathWhiteOverlay.material.opacity = 0;
+    bossDeathWhiteOverlay.visible = false;
+  }
+  if (bossDeathBlackOverlay) {
+    bossDeathBlackOverlay.material.opacity = 0;
+    bossDeathBlackOverlay.visible = false;
+  }
+
+  if (bossDeathCinematic.wasFinalBoss) {
+    bossDeathCinematic.wasFinalBoss = false;
+    if (deps.endGame) deps.endGame(true);
+    return;
+  }
+
+  bossDeathCinematic.wasFinalBoss = false;
+  if (deps.completeLevel) deps.completeLevel();
+}
+
+/**
+ * Update the boss death cinematic each frame
+ * @param {number} rawDt - Unscaled delta time in seconds
+ */
+export function updateBossDeathCinematic(rawDt) {
+  if (!bossDeathCinematic.active) return;
+
+  bossDeathCinematic.timer += rawDt;
+  const t = bossDeathCinematic.timer;
+  const explosionStart = BOSS_DEATH_FREEZE;
+  const explosionEnd = explosionStart + BOSS_DEATH_EXPLOSION_TIME;
+  const whiteStart = explosionEnd;
+  const whiteEnd = whiteStart + BOSS_DEATH_WHITE_FADE;
+  const blackEnd = whiteEnd + BOSS_DEATH_BLACK_FADE;
+
+  if (t >= explosionStart && t <= explosionEnd) {
+    bossDeathCinematic.explosionTimer -= rawDt;
+    if (bossDeathCinematic.explosionTimer <= 0) {
+      const offset = new THREE.Vector3(
+        (Math.random() - 0.5) * 1.8,
+        (Math.random() - 0.5) * 1.2,
+        (Math.random() - 0.5) * 1.8,
+      );
+      const explosionPos = bossDeathCinematic.bossPos.clone().add(offset);
+      if (deps.spawnExplosionVisual) deps.spawnExplosionVisual(explosionPos, 0.7 + Math.random() * 0.8);
+      if (deps.playExplosionSound) deps.playExplosionSound();  // Play explosion sound for each boss death explosion
+      bossDeathCinematic.explosionTimer = BOSS_DEATH_EXPLOSION_INTERVAL;
+    }
+  }
+
+  let whiteOpacity = 0;
+  let blackOpacity = 0;
+  let envFade = 0;  // Environment fade synced with black overlay
+  if (t >= whiteStart && t < whiteEnd) {
+    whiteOpacity = (t - whiteStart) / BOSS_DEATH_WHITE_FADE;
+  } else if (t >= whiteEnd && t < blackEnd) {
+    const progress = (t - whiteEnd) / BOSS_DEATH_BLACK_FADE;
+    whiteOpacity = 1 - progress;
+    blackOpacity = progress;
+    envFade = progress;  // Fade environment with black overlay
+  } else if (t >= blackEnd) {
+    blackOpacity = 1;
+    envFade = 1;  // Full fade
+  }
+
+  // Apply environment fade - ALL scene elements fade to black
+  if (deps.applyEnvironmentFade) deps.applyEnvironmentFade(envFade);
+
+  if (bossDeathWhiteOverlay) {
+    bossDeathWhiteOverlay.visible = whiteOpacity > 0;
+    bossDeathWhiteOverlay.material.opacity = Math.min(1, Math.max(0, whiteOpacity));
+  }
+  if (bossDeathBlackOverlay) {
+    bossDeathBlackOverlay.visible = blackOpacity > 0;
+    bossDeathBlackOverlay.material.opacity = Math.min(1, Math.max(0, blackOpacity));
+  }
+
+  if (t >= blackEnd) {
+    finishBossDeathCinematic();
+  }
+}
+
+/**
+ * Update the freeze timer (called from main.js render loop)
+ * @param {number} rawDt - Unscaled delta time in seconds
+ * @returns {boolean} True if freeze is active (time should be stopped)
+ */
+export function updateBossDeathFreeze(rawDt) {
+  if (bossDeathFreezeTimer > 0) {
+    bossDeathFreezeTimer -= rawDt;
+    if (bossDeathFreezeTimer < 0) bossDeathFreezeTimer = 0;
+    return true;
+  }
+  return false;
+}
+
+/**
+ * Check if the current frame should use zero time scale due to freeze
+ * @returns {boolean} True if time should be frozen
+ */
+export function shouldFreezeTime() {
+  return bossDeathFreezeTimer > 0;
+}
diff --git a/desktop-controls.js b/desktop-controls.js
index 80ba53b..710f4e3 100644
--- a/desktop-controls.js
+++ b/desktop-controls.js
@@ -136,11 +136,11 @@ export function enable() {
     }
   }
 
   // Show desktop mode indicator and debug panel
   showDesktopHUD();
-  showDebugPositionPanel();
+  syncDebugPositionPanelVisibility();
 }
 
 /**
  * Disable desktop controls.
  * Call when entering VR mode.
@@ -320,10 +320,13 @@ export function update(dt) {
   if (cameraRef.rotation) {
     cameraRef.rotation.z = 0;
   }
   player.rotation.z = 0;
 
+  // Keep debug-position panel visibility synced with HTML debug toggle.
+  syncDebugPositionPanelVisibility();
+
   // Update debug position display
   updateDebugPositionPanel();
 
   return {
     moved: player.isMoving,
@@ -399,11 +402,11 @@ function setupEventListeners() {
   document.addEventListener('pointerlockerror', onPointerLockError);
 
   // Click to request pointer lock
   document.addEventListener('click', (e) => {
     if (!enabled || mouse.locked) return;
-    if (e && e.target && e.target.closest && (e.target.closest('#debug-panel') || e.target.closest('#debug-toggle'))) {
+    if (e && e.target && e.target.closest && (e.target.closest('#debug-panel') || e.target.closest('#debug-toggle') || e.target.closest('#debug-position-panel'))) {
       return;
     }
     document.body.requestPointerLock = document.body.requestPointerLock ||
       document.body.mozRequestPointerLock ||
       document.body.webkitRequestPointerLock;
@@ -565,10 +568,24 @@ function handleFireInput() {
 let debugPanelElement = null;
 let lookAtRaycaster = null;
 let currentLookTarget = null;
 let originalMaterials = new Map(); // Store original materials for highlight reset
 
+function shouldShowDebugPositionPanel() {
+  // Default OFF unless explicitly enabled through DEBUG menu checkbox
+  if (typeof window === 'undefined') return false;
+  return window.debugPositionPanel === true;
+}
+
+function syncDebugPositionPanelVisibility() {
+  if (shouldShowDebugPositionPanel()) {
+    showDebugPositionPanel();
+  } else {
+    hideDebugPositionPanel();
+  }
+}
+
 function showDebugPositionPanel() {
   if (debugPanelElement) {
     debugPanelElement.style.display = 'block';
     return;
   }
diff --git a/enemies.js b/enemies.js
index f2e61bd..e63c193 100644
--- a/enemies.js
+++ b/enemies.js
@@ -7831,10 +7831,12 @@ export function releaseBossProjIndex(idx) {
 
   // Hide instance by scaling to 0
   _bossProjMatrix.makeScale(0, 0, 0);
   bossProjCorePool.setMatrixAt(idx, _bossProjMatrix);
   bossProjGlowPool.setMatrixAt(idx, _bossProjMatrix);
+  bossProjCorePool.instanceMatrix.needsUpdate = true;
+  bossProjGlowPool.instanceMatrix.needsUpdate = true;
 
   bossProjData[idx] = null;
   bossProjFreeIndices.push(idx);
 }
 
@@ -7847,12 +7849,28 @@ export function clearBossProjectiles() {
     if (bossProjData[i] !== null) {
       releaseBossProjIndex(i);
     }
   }
   bossProjectiles.length = 0;
-  if (bossProjCorePool) bossProjCorePool.instanceMatrix.needsUpdate = true;
-  if (bossProjGlowPool) bossProjGlowPool.instanceMatrix.needsUpdate = true;
+
+  // Reset count to 0 so instances are properly hidden
+  // (releasing scales them to 0, but count must also be reset)
+  if (bossProjCorePool) {
+    bossProjCorePool.count = 0;
+    bossProjCorePool.instanceMatrix.needsUpdate = true;
+  }
+  if (bossProjGlowPool) {
+    bossProjGlowPool.count = 0;
+    bossProjGlowPool.instanceMatrix.needsUpdate = true;
+  }
+
+  // Reset free indices to initial state
+  bossProjFreeIndices.length = 0;
+  for (let i = 0; i < BOSS_PROJ_POOL_SIZE; i++) {
+    bossProjFreeIndices.push(i);
+    bossProjData[i] = null;
+  }
 }
 
 export function spawnBossProjectile(fromPos, targetPos) {
   // Initialize pools if needed (called once on first spawn)
   initBossProjPools();
diff --git a/environment.js b/environment.js
index b54ee0d..4e020e4 100644
--- a/environment.js
+++ b/environment.js
@@ -314,10 +314,11 @@ export function createSun(scene) {
 
   // Main sun mesh
   const sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), sunMat);
   sunMesh.position.set(0, 12, -89);
   sunMesh.renderOrder = -10;
+  sunMesh.frustumCulled = false;  // Prevent disappearing when looking around
   scene.add(sunMesh);
   sunMeshRef = sunMesh;
 
   // Primary glow
   const glowMat = new THREE.MeshBasicMaterial({
@@ -329,10 +330,11 @@ export function createSun(scene) {
     depthWrite: false
   });
   const glow = new THREE.Mesh(new THREE.CircleGeometry(24, 32), glowMat);
   glow.position.set(0, 12, -89.5);
   glow.renderOrder = -11;
+  glow.frustumCulled = false;  // Prevent disappearing when looking around
   scene.add(glow);
   sunGlowRef = glow;
 
   // Extra glow layers for more drama
   const extraGlows = [
@@ -350,10 +352,11 @@ export function createSun(scene) {
       depthWrite: false,
     });
     const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), mat);
     mesh.position.set(0, 12, -89.8);
     mesh.renderOrder = -12;
+    mesh.frustumCulled = false;  // Prevent disappearing when looking around
     scene.add(mesh);
   });
 
   return { sunMesh, glowMesh: glow };
 }
@@ -439,10 +442,11 @@ export function createStars(scene) {
     depthWrite: false,
   });
 
   const stars = new THREE.Points(starsGeo, starsMat);
   stars.renderOrder = -15;
+  stars.frustumCulled = false;  // Prevent disappearing when looking around
   scene.add(stars);
 
   return { stars, starsMat };
 }
 
@@ -481,10 +485,11 @@ export function createAtmosphere(scene) {
   });
 
   const cylinder = new THREE.Mesh(cylGeo, cylMat);
   cylinder.position.set(0, height / 2 - 2, 0);
   cylinder.renderOrder = -13;
+  cylinder.frustumCulled = false;  // Prevent disappearing when looking around
   scene.add(cylinder);
 
   return cylinder;
 }
 
diff --git a/game-screenshot.png b/game-screenshot.png
index 40864f5..add32a4 100644
Binary files a/game-screenshot.png and b/game-screenshot.png differ
diff --git a/game.js b/game.js
index bb39c8f..480682f 100644
--- a/game.js
+++ b/game.js
@@ -127,12 +127,12 @@ export const game = {
   stateTimer: 0,
   spawnTimer: 0,
   killsWithoutHit: 0,
 
   handStats: {
-    left: { kills: 0, totalDamage: 0 },
-    right: { kills: 0, totalDamage: 0 }
+    left: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0 },
+    right: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0 }
   },
 
   justBossKill: false,
   nextUpgradeHand: 'left',  // Alternating hand for upgrades (left → right → left...)
 
@@ -153,10 +153,11 @@ export const game = {
   timeScale: 1.0,
 
   // DEBUG: Performance monitoring settings
   debugPerfMonitor: false,  // Extended FPS stats (frame time, memory)
   debugShowFPS: true,  // Always show FPS counter in VR
+  debugShowPosition: false,  // Show debug position box (desktop DOM + VR toggle)
   debugBiomeOverride: null,  // Force a specific biome for previews
   inDreamWorld: false,
   dreamCompleted: false,
 
   // Run statistics for pause menu
@@ -179,10 +180,11 @@ export const game = {
 export function resetGame() {
   // Preserve debug settings and seed info across resets
   const preservedDebug = {
     debugPerfMonitor: game.debugPerfMonitor,
     debugShowFPS: game.debugShowFPS,
+    debugShowPosition: game.debugShowPosition,
     debugBiomeOverride: game.debugBiomeOverride,
   };
   
   const preservedSeed = {
     seed: game.seed,
@@ -214,12 +216,12 @@ export function resetGame() {
 
     stateTimer: 0,
     spawnTimer: 0,
     killsWithoutHit: 0,
     handStats: {
-      left: { kills: 0, totalDamage: 0 },
-      right: { kills: 0, totalDamage: 0 }
+      left: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0 },
+      right: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0 }
     },
     justBossKill: false,
     nextUpgradeHand: 'left',
     finalScore: 0,
     finalLevel: 0,
@@ -292,10 +294,11 @@ export function loadDebugSettings() {
     const stored = localStorage.getItem('spaceomicide_debug');
     if (stored) {
       const settings = JSON.parse(stored);
       game.debugPerfMonitor = settings.debugPerfMonitor ?? false;
       game.debugShowFPS = settings.debugShowFPS ?? true;
+      game.debugShowPosition = settings.debugShowPosition ?? false;
       // NOTE: debugBiomeOverride is NOT loaded - it resets on page refresh
       console.log('[debug] Loaded settings:', settings);
     }
   } catch (e) {
     console.warn('[debug] Failed to load settings:', e);
@@ -308,10 +311,11 @@ export function loadDebugSettings() {
 export function saveDebugSettings() {
   try {
     const settings = {
       debugPerfMonitor: game.debugPerfMonitor,
       debugShowFPS: game.debugShowFPS,
+      debugShowPosition: game.debugShowPosition,
       // NOTE: debugBiomeOverride is NOT saved - it resets on page refresh
     };
     localStorage.setItem('spaceomicide_debug', JSON.stringify(settings));
     console.log('[debug] Saved settings:', settings);
   } catch (e) {
@@ -360,10 +364,23 @@ function toggleFPSDisplay() {
   game.debugShowFPS = !game.debugShowFPS;
   saveDebugSettings();
   return game.debugShowFPS;
 }
 
+/**
+ * Toggle debug position box
+ */
+function togglePositionDisplay() {
+  game.debugShowPosition = !game.debugShowPosition;
+  // Sync with desktop DOM panel
+  if (typeof window !== 'undefined') {
+    window.debugPositionPanel = game.debugShowPosition;
+  }
+  saveDebugSettings();
+  return game.debugShowPosition;
+}
+
 export function getLevelConfig() {
   return LEVELS[game.level - 1];
 }
 
 export function addScore(points) {
@@ -418,19 +435,25 @@ export function trackKill(isBoss = false) {
   if (isBoss) {
     game.runStats.bossesKilled++;
   }
 }
 
-export function trackShot() {
+export function trackShot(hand) {
   game.runStats.shotsFired++;
+  if (hand) {
+    game.handStats[hand].shotsFired++;
+  }
 }
 
-export function trackShotHit(damage = 0) {
+export function trackShotHit(damage = 0, hand) {
   game.runStats.shotsHit++;
   if (damage > 0) {
     game.runStats.totalDamageDealt += damage;
   }
+  if (hand) {
+    game.handStats[hand].shotsHit++;
+  }
 }
 
 export function trackCrit() {
   game.runStats.critsLanded++;
 }
diff --git a/hud.js b/hud.js
index 14262f9..48c9855 100644
--- a/hud.js
+++ b/hud.js
@@ -426,10 +426,18 @@ export function initHUD(camera, scene) {
   // Pause menu in 3D world space (fixed position, not camera-locked)
   pauseMenuGroup.visible = false;
   pauseMenuGroup.rotation.set(0, 0, 0);
   scene.add(pauseMenuGroup);
 
+  // Disable frustum culling on all UI groups to prevent disappearing when looking around
+  // UI elements have unreliable bounding boxes/spheres that cause false culling
+  [
+    titleGroup, hudGroup, floatingMessageGroup, levelTextGroup, upgradeGroup,
+    gameOverGroup, nameEntryGroup, scoreboardGroup, countrySelectGroup,
+    readyGroup, debugMenuGroup, pauseMenuGroup, pauseCountdownGroup
+  ].forEach(g => { if (g) g.frustumCulled = false; });
+
   // Countdown still follows camera so player can see it
   pauseCountdownGroup.visible = false;
   pauseCountdownGroup.rotation.set(0, 0, 0);
   camera.add(pauseCountdownGroup);
 
@@ -448,10 +456,11 @@ export function initHUD(camera, scene) {
       blending: THREE.AdditiveBlending,  // Makes flash visible even on bright backgrounds
     }),
   );
   hitFlash.renderOrder = 999;
   hitFlash.visible = false;
+  hitFlash.frustumCulled = false;  // Prevent disappearing when looking around
   hitFlash.position.set(0, 0, -0.25);  // Very close to camera for full coverage
   camera.add(hitFlash);
 
   // ── FPS Counter (top left, attached to camera, more visible in VR) ──
   // Optimized: reuse canvas/texture to avoid creating/disposing every 250ms
@@ -471,10 +480,11 @@ export function initHUD(camera, scene) {
     side: THREE.DoubleSide,
   });
   fpsSprite = new THREE.Mesh(fpsGeo, fpsMat);
   fpsSprite.position.set(-0.15, 0.12, -0.5);  // Moved closer to center
   fpsSprite.renderOrder = 1001;
+  fpsSprite.frustumCulled = false;  // Prevent disappearing when looking around
   camera.add(fpsSprite);
 
   // ── Boss health bar (top center, camera-attached, 3 segments) ──
   bossHealthGroup = new THREE.Group();
   bossHealthGroup.position.set(0, 0.3, -0.6);
@@ -489,10 +499,11 @@ export function initHUD(camera, scene) {
     bar.position.x = (i - 1) * (barWidth + gap);
     bar.renderOrder = 1000;
     bossHealthGroup.add(bar);
     bossHealthBars.push(bar);
   }
+  bossHealthGroup.frustumCulled = false;  // Prevent disappearing when looking around
   camera.add(bossHealthGroup);
 }
 
 export function showBossHealthBar(hp, maxHp, phases = 3) {
   if (!bossHealthGroup) return;
@@ -915,10 +926,13 @@ export function updateHUD(gameState) {
 
   // #23: Removed continuous glow pulse animation for performance
   // Hearts are now static - only animate when health changes (hitFlash, healthGain)
   const now = performance.now();
 
+  // Update floating message (auto-hide after duration)
+  updateFloatingMessage(now);
+
   // Decay hit flash
   if (heartAnimationState.hitFlash > 0) {
     heartAnimationState.hitFlash -= 0.05;
     if (heartAnimationState.hitFlash < 0) heartAnimationState.hitFlash = 0;
     // Shake effect
@@ -2040,10 +2054,23 @@ export function showDebugMenu() {
       type: 'toggle',
       label: 'FPS COUNTER',
       getState: () => game.debugShowFPS,
       toggle: () => { game.debugShowFPS = !game.debugShowFPS; }
     },
+    {
+      id: 'position',
+      type: 'toggle',
+      label: 'POSITION BOX',
+      getState: () => game.debugShowPosition,
+      toggle: () => {
+        game.debugShowPosition = !game.debugShowPosition;
+        // Sync with desktop DOM panel so both stay in lock-step
+        if (typeof window !== 'undefined') {
+          window.debugPositionPanel = game.debugShowPosition;
+        }
+      }
+    },
     {
       id: 'perf',
       type: 'toggle',
       label: 'PERF MONITOR',
       getState: () => game.debugPerfMonitor,
@@ -2117,16 +2144,16 @@ export function showDebugMenu() {
 
   // Instructions
   const instructions = makeSprite('CLICK TO TOGGLE OR CYCLE', {
     fontSize: 24, color: '#888888', scale: 0.15,
   });
-  instructions.position.set(0, -0.3, 0);
+  instructions.position.set(0, -0.65, 0);
   debugMenuGroup.add(instructions);
 
   // BACK button
   const backGroup = new THREE.Group();
-  backGroup.position.set(0, -0.7, 0);
+  backGroup.position.set(0, -1.05, 0);
   const backGeo = new THREE.PlaneGeometry(0.8, 0.28);
   const backMat = new THREE.MeshBasicMaterial({
     color: 0x330000, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
   });
   const backMesh = new THREE.Mesh(backGeo, backMat);
@@ -3904,25 +3931,84 @@ let pauseCountdownInitialized = false;
 
 /**
  * Show the pause menu with stats and blaster upgrade info
  */
 let pauseMenuBasePosition = new THREE.Vector3();
+const PAUSE_MENU_SCALE = 0.78;          // ~40% smaller than previous 1.3 scale
+const PAUSE_MENU_DISTANCE = 2.6;        // Slightly farther from player in VR
+const PAUSE_MENU_RENDER_ORDER = 10000;  // Draw over floor HUD layers
+const PAUSE_MENU_FONT_MULTIPLIER = 2.5;
+
+// Render order constants for pause menu elements (layered back to front)
+const PAUSE_PANEL_RENDER_ORDER = 10000;
+const PAUSE_BORDER_RENDER_ORDER = 10001;
+const PAUSE_SECTION_BG_RENDER_ORDER = 10002;
+const PAUSE_TEXT_RENDER_ORDER = 10010;
+
+function scalePauseFont(baseFontSize) {
+  return Math.round(baseFontSize * PAUSE_MENU_FONT_MULTIPLIER);
+}
+
+function scalePauseText(baseScale) {
+  return baseScale * PAUSE_MENU_FONT_MULTIPLIER;
+}
+
+function applyPauseMenuRenderPriority(root) {
+  if (!root) return;
+  root.traverse((child) => {
+    if (!child.material) return;
+
+    const materials = Array.isArray(child.material) ? child.material : [child.material];
+    materials.forEach((mat) => {
+      if (!mat) return;
+      // CRITICAL: Both must be false for UI to render correctly over scene
+      mat.depthTest = false;
+      mat.depthWrite = false;
+      // Ensure transparency is enabled
+      if (mat.opacity !== undefined && mat.opacity < 1) {
+        mat.transparent = true;
+      }
+    });
+
+    // Set render order if not already set
+    if (child.renderOrder === 0 || child.renderOrder === undefined) {
+      child.renderOrder = PAUSE_TEXT_RENDER_ORDER;
+    }
+  });
+}
+
+/**
+ * Create a consistent UI material for pause menu elements
+ */
+function createPauseMaterial(color, opacity = 0.85) {
+  return new THREE.MeshBasicMaterial({
+    color,
+    transparent: true,
+    opacity,
+    depthTest: false,
+    depthWrite: false,
+    side: THREE.DoubleSide,
+  });
+}
 
 export function showPauseMenu() {
   pauseMenuGroup.visible = true;
-  pauseMenuGroup.scale.set(1.3, 1.3, 1.3);
+  pauseMenuGroup.scale.set(PAUSE_MENU_SCALE, PAUSE_MENU_SCALE, PAUSE_MENU_SCALE);
 
-  // Position menu at fixed world position (2m in front of camera when paused)
+  // Hide floor HUD while pause menu is open
+  if (hudGroup) hudGroup.visible = false;
+
+  // Position menu at fixed world position slightly farther from camera when paused.
   // This makes it stay in 3D space so player can walk around it
   if (cameraRef) {
     const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraRef.quaternion);
     forward.y = 0;
     forward.normalize();
     pauseMenuBasePosition.set(
-      cameraRef.position.x + forward.x * 2,
+      cameraRef.position.x + forward.x * PAUSE_MENU_DISTANCE,
       cameraRef.position.y,
-      cameraRef.position.z + forward.z * 2
+      cameraRef.position.z + forward.z * PAUSE_MENU_DISTANCE
     );
     pauseMenuGroup.position.copy(pauseMenuBasePosition);
     // Face the camera once (billboard on pause, not every frame)
     pauseMenuGroup.lookAt(cameraRef.position.x, cameraRef.position.y, cameraRef.position.z);
   }
@@ -3931,10 +4017,11 @@ export function showPauseMenu() {
     // Already initialized
     pauseMenuAnimation.targetSlideIn = 1;
     pauseMenuAnimation.startTime = performance.now();
     pauseMenuAnimation.chartAnimation = 0;
     pauseMenuAnimation.numbersAnimated = false;
+    applyPauseMenuRenderPriority(pauseMenuGroup);
     return;
   }
 
   createPauseMenu();
 }
@@ -3942,10 +4029,13 @@ export function showPauseMenu() {
 /**
  * Hide the pause menu
  */
 export function hidePauseMenu() {
   pauseMenuGroup.visible = false;
+
+  // Restore floor HUD
+  if (hudGroup) hudGroup.visible = true;
 }
 
 /**
  * Update pause menu animations and charts
  */
@@ -3984,176 +4074,211 @@ export function updatePauseMenu(now) {
  * Create the pause menu UI
  */
 function createPauseMenu() {
   const group = pauseMenuGroup;
 
-  // Main panel with holographic border
-  const panelWidth = 3.5;
-  const panelHeight = 2.5;
+  // Main panel - ONE dark see-through plane
+  const panelWidth = 4.6;
+  const panelHeight = 3.2;  // Shorter since no separate stats section
 
-  // Background panel
+  // Background panel - semi-transparent black, no depth interaction
   const panelGeo = new THREE.PlaneGeometry(panelWidth, panelHeight);
-  const panelMat = new THREE.MeshBasicMaterial({
-    color: 0x0a0015,
-    transparent: true,
-    opacity: 0.95,  // Increased from 0.85 for VR visibility
-    side: THREE.DoubleSide,
-    depthWrite: false
-  });
+  const panelMat = createPauseMaterial(0x0a0015, 0.85);
   const panel = new THREE.Mesh(panelGeo, panelMat);
-  panel.renderOrder = 0;  // Render before text (text has renderOrder=999)
+  panel.renderOrder = PAUSE_PANEL_RENDER_ORDER;
   group.add(panel);
 
-  // Neon border (cyan)
+  // Neon border (cyan) - no depth interaction
   const borderThickness = 0.03;
-  const borderMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
+  const borderMat = createPauseMaterial(0x00ffff, 1.0);
   [
     { w: panelWidth, h: borderThickness, x: 0, y: panelHeight / 2 },
     { w: panelWidth, h: borderThickness, x: 0, y: -panelHeight / 2 },
     { w: borderThickness, h: panelHeight, x: panelWidth / 2, y: 0 },
     { w: borderThickness, h: panelHeight, x: -panelWidth / 2, y: 0 },
   ].forEach(b => {
     const border = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), borderMat);
     border.position.set(b.x, b.y, 0.01);
-    border.renderOrder = 1;  // Render after panel, before text
+    border.renderOrder = PAUSE_BORDER_RENDER_ORDER;
     group.add(border);
   });
 
   pauseMenuElements.panel = panel;
 
-  // Left blaster section
-  const leftSection = createBlasterSection('left', -1.2);
-  leftSection.position.set(-0.9, 0.5, 0.02);
+  // Left blaster section (includes stats now)
+  const leftSection = createBlasterSection('left');
+  leftSection.position.set(-1.25, 0.4, 0.02);
   group.add(leftSection);
   pauseMenuElements.leftBlasterSection = leftSection;
 
-  // Right blaster section
-  const rightSection = createBlasterSection('right', 1.2);
-  rightSection.position.set(0.9, 0.5, 0.02);
+  // Right blaster section (includes stats now)
+  const rightSection = createBlasterSection('right');
+  rightSection.position.set(1.25, 0.4, 0.02);
   group.add(rightSection);
   pauseMenuElements.rightBlasterSection = rightSection;
 
-  // Stats section
-  const statsSection = createStatsSection();
-  statsSection.position.set(0, -0.5, 0.02);
-  group.add(statsSection);
-  pauseMenuElements.statsSection = statsSection;
+  // No more separate stats section - stats are in blaster sections
 
   // Resume button
   const resumeBtn = createResumeButton();
-  resumeBtn.position.set(0, -1.0, 0.03);
+  resumeBtn.position.set(0, -1.2, 0.03);
   group.add(resumeBtn);
   pauseMenuElements.resumeButton = resumeBtn;
 
   // Initialize animation
   pauseMenuAnimation.startTime = performance.now();
   pauseMenuAnimation.slideIn = 0;
   pauseMenuAnimation.chartAnimation = 0;
   pauseMenuAnimation.numbersAnimated = false;
+
+  applyPauseMenuRenderPriority(group);
 }
 
 /**
- * Create blaster upgrade section for one hand
+ * Create blaster upgrade section for one hand (no nested background)
  */
 function createBlasterSection(hand, panelX) {
   const group = new THREE.Group();
 
-  // Section background
-  const bg = new THREE.Mesh(
-    new THREE.PlaneGeometry(1.3, 1.2),
-    new THREE.MeshBasicMaterial({ color: 0x1a0033, transparent: true, opacity: 0.7, depthWrite: false })
-  );
-  bg.renderOrder = 0;  // Render before text
-  group.add(bg);
-
-  // Section border (pink)
-  const borderMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
-  const borderWidth = 1.3;
-  const borderHeight = 0.05;
-  [
-    { w: borderWidth, h: borderHeight, x: 0, y: 0.6 },
-    { w: borderWidth, h: borderHeight, x: 0, y: -0.6 },
-  ].forEach(b => {
-    const border = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), borderMat);
-    border.position.set(b.x, b.y, 0.01);
-    group.add(border);
-  });
-
   // Title
-  const titleText = makeSprite(`${hand.toUpperCase()} BLASTER`, { fontSize: 48, color: '#00ffff', scale: 0.15 });
-  titleText.position.set(0, 0.45, 0.02);
+  const titleText = makeSprite(`${hand.toUpperCase()} BLASTER`, {
+    fontSize: scalePauseFont(48),
+    color: '#00ffff',
+    scale: scalePauseText(0.15),
+    renderOrder: PAUSE_TEXT_RENDER_ORDER
+  });
+  titleText.position.set(0, 1.1, 0.02);
   group.add(titleText);
 
   // Weapon name
   const weaponId = game.mainWeapon[hand];
   const weaponName = weaponId.replace(/_/g, ' ').toUpperCase();
-  const weaponText = makeSprite(weaponName, { fontSize: 36, color: '#ffffff', scale: 0.1 });
-  weaponText.position.set(0, 0.32, 0.02);
+  const weaponText = makeSprite(weaponName, {
+    fontSize: scalePauseFont(36),
+    color: '#ffffff',
+    scale: scalePauseText(0.1),
+    renderOrder: PAUSE_TEXT_RENDER_ORDER
+  });
+  weaponText.position.set(0, 0.85, 0.02);
   group.add(weaponText);
 
-  // Upgrades list
+  // Upgrades list (exclude dream_fragment - it's a collectible, not an upgrade)
   const upgrades = game.upgrades[hand] || {};
-  const upgradeEntries = Object.entries(upgrades);
-  const yOffset = 0.15;
+  const upgradeEntries = Object.entries(upgrades).filter(([id]) => id !== 'dream_fragment');
+  let yPos = 0.55;
 
   if (upgradeEntries.length > 0) {
     upgradeEntries.forEach(([id, count], index) => {
-      const upgradeText = makeSprite(`${id.replace(/_/g, ' ').toUpperCase()} x${count}`, { fontSize: 36, color: '#ffffff', scale: 0.1 });
-      const yPos = yOffset - (index * 0.12);
-      upgradeText.position.set(0, yPos, 0.02);
+      const upgradeText = makeSprite(`${id.replace(/_/g, ' ').toUpperCase()} x${count}`, {
+        fontSize: scalePauseFont(32),
+        color: '#ffffff',
+        scale: scalePauseText(0.09),
+        renderOrder: PAUSE_TEXT_RENDER_ORDER
+      });
+      upgradeText.position.set(0, yPos - (index * 0.22), 0.02);
+      upgradeText.userData = { isUpgradeSprite: true };
       group.add(upgradeText);
     });
+    yPos -= (upgradeEntries.length * 0.22 + 0.15);
   } else {
-    const noUpgradesText = makeSprite('No upgrades', { fontSize: 36, color: '#888888', scale: 0.1 });
-    noUpgradesText.position.set(0, 0.1, 0.02);
+    const noUpgradesText = makeSprite('NO UPGRADES', {
+      fontSize: scalePauseFont(32),
+      color: '#888888',
+      scale: scalePauseText(0.09),
+      renderOrder: PAUSE_TEXT_RENDER_ORDER
+    });
+    noUpgradesText.position.set(0, yPos, 0.02);
+    noUpgradesText.userData = { isUpgradeSprite: true };
     group.add(noUpgradesText);
+    yPos -= 0.37;
   }
 
+  // Stats for this hand: KILLS, SHOTS, HITS, ACCURACY
+  const stats = game.handStats[hand] || { kills: 0, shotsFired: 0, shotsHit: 0 };
+  const accuracy = stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0;
+
+  const statLines = [
+    { label: 'KILLS', value: stats.kills, color: '#ff00ff' },
+    { label: 'SHOTS', value: stats.shotsFired, color: '#00ffff' },
+    { label: 'HITS', value: stats.shotsHit, color: '#00ffff' },
+    { label: 'ACC', value: `${accuracy}%`, color: accuracy >= 50 ? '#00ff00' : '#ff4444' },
+  ];
+
+  statLines.forEach((stat, index) => {
+    const statText = makeSprite(`${stat.label}: ${stat.value}`, {
+      fontSize: scalePauseFont(32),
+      color: stat.color,
+      scale: scalePauseText(0.09),
+      renderOrder: PAUSE_TEXT_RENDER_ORDER
+    });
+    statText.position.set(0, yPos - (index * 0.22), 0.02);
+    statText.userData = { isStatSprite: true, hand, statKey: stat.label };
+    group.add(statText);
+  });
+
   return group;
 }
 
 /**
  * Create stats section with charts
  */
 function createStatsSection() {
   const group = new THREE.Group();
 
-  // Background
+  // Background (higher opacity for readability)
   const bg = new THREE.Mesh(
-    new THREE.PlaneGeometry(3.2, 1.1),
-    new THREE.MeshBasicMaterial({ color: 0x15002a, transparent: true, opacity: 0.7, depthWrite: false })
+    new THREE.PlaneGeometry(4.2, 2.2),
+    createPauseMaterial(0x15002a, 0.85)
   );
-  bg.renderOrder = 0;  // Render before text
+  bg.renderOrder = PAUSE_SECTION_BG_RENDER_ORDER;
   group.add(bg);
 
   // Title
-  const titleText = makeSprite('RUN STATISTICS', { fontSize: 48, color: '#ff00ff', scale: 0.15 });
-  titleText.position.set(0, 0.45, 0.02);
+  const titleText = makeSprite('RUN STATISTICS', {
+    fontSize: scalePauseFont(48),
+    color: '#ff00ff',
+    scale: scalePauseText(0.15),
+    renderOrder: PAUSE_TEXT_RENDER_ORDER
+  });
+  titleText.position.set(0, 0.84, 0.02);
   group.add(titleText);
 
-  // Stats text columns
-  const leftStats = [
+  // KILLS/SHOTS/HITS centered under the blaster sections
+  const primaryStats = [
     `KILLS: ${game.runStats.totalKills || game.totalKills || 0}`,
     `SHOTS: ${game.runStats.shotsFired}`,
     `HITS: ${game.runStats.shotsHit}`,
   ];
 
-  const rightStats = [
+  primaryStats.forEach((stat, index) => {
+    const text = makeSprite(stat, {
+      fontSize: scalePauseFont(36),
+      color: '#00ffff',
+      scale: scalePauseText(0.1),
+      renderOrder: PAUSE_TEXT_RENDER_ORDER
+    });
+    text.position.set(0, 0.44 - (index * 0.24), 0.02);
+    text.userData = { isPauseStatText: true };
+    group.add(text);
+  });
+
+  // Everything else sits below KILLS/SHOTS/HITS
+  const secondaryStats = [
     `ACCURACY: ${calculateAccuracy()}%`,
     `STREAK: ${game.runStats.longestKillStreak}`,
     `BOSS: ${game.runStats.bossesKilled}`,
   ];
 
-  leftStats.forEach((stat, index) => {
-    const text = makeSprite(stat, { fontSize: 36, color: '#00ffff', scale: 0.1 });
-    text.position.set(-1.1, 0.25 - (index * 0.1), 0.02);
-    group.add(text);
-  });
-
-  rightStats.forEach((stat, index) => {
-    const text = makeSprite(stat, { fontSize: 36, color: '#00ffff', scale: 0.1 });
-    text.position.set(1.1, 0.25 - (index * 0.1), 0.02);
+  secondaryStats.forEach((stat, index) => {
+    const text = makeSprite(stat, {
+      fontSize: scalePauseFont(36),
+      color: '#00ffff',
+      scale: scalePauseText(0.1),
+      renderOrder: PAUSE_TEXT_RENDER_ORDER
+    });
+    text.position.set(-1.08, -0.34 - (index * 0.22), 0.02);
+    text.userData = { isPauseStatText: true };
     group.add(text);
   });
 
   // Canvas for charts (accuracy donut + damage bars)
   const canvas = document.createElement('canvas');
@@ -4161,14 +4286,17 @@ function createStatsSection() {
   canvas.height = 128;
   const chartTexture = new THREE.CanvasTexture(canvas);
   const chartMat = new THREE.MeshBasicMaterial({
     map: chartTexture,
     transparent: true,
+    depthTest: false,
+    depthWrite: false,
     side: THREE.DoubleSide
   });
-  const chartMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), chartMat);
-  chartMesh.position.set(0, -0.2, 0.02);
+  const chartMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.9), chartMat);
+  chartMesh.position.set(1.1, -0.82, 0.02);
+  chartMesh.renderOrder = PAUSE_TEXT_RENDER_ORDER;
   group.add(chartMesh);
 
   pauseMenuElements.chartCanvas = { canvas, texture: chartTexture, mesh: chartMesh };
 
   return group;
@@ -4234,11 +4362,11 @@ function updatePauseCharts() {
     ctx.fillStyle = hand === 'left' ? '#ff00ff' : '#00ffff';
     ctx.fillRect(barBaseX + (i * barSpacing), barBaseY - barHeight, barWidth, barHeight);
 
     // Label
     ctx.fillStyle = '#888888';
-    ctx.font = '10px monospace';
+    ctx.font = `${scalePauseFont(10)}px monospace`;
     ctx.textAlign = 'center';
     ctx.fillText(hand.toUpperCase(), barBaseX + (i * barSpacing) + barWidth / 2, barBaseY + 10);
   });
 
   // Update texture
@@ -4253,124 +4381,129 @@ function updatePauseStatsNumbers() {
 
   // Update left blaster section
   updateSectionStats(pauseMenuElements.leftBlasterSection, 'left');
   updateSectionStats(pauseMenuElements.rightBlasterSection, 'right');
   updateStatsSectionText();
+  applyPauseMenuRenderPriority(pauseMenuGroup);
 }
 
 /**
  * Update stats section text
  */
 function updateStatsSectionText() {
-  // Remove old stats sprites
-  pauseMenuElements.statsSection.children.forEach(child => {
-    if (child.material && child.material.map) {
-      // Keep the chart mesh, remove text sprites
-      if (!child.geometry.type.includes('Plane')) {
-        pauseMenuElements.statsSection.remove(child);
-      }
+  if (!pauseMenuElements.statsSection) return;
+
+  // Remove old stat text sprites, keep panel/title/chart mesh.
+  const section = pauseMenuElements.statsSection;
+  [...section.children].forEach((child) => {
+    if (child.userData && child.userData.isPauseStatText) {
+      section.remove(child);
     }
   });
 
-  // Add updated stats
-  const leftStats = [
-    `KILLS: ${game.totalKills}`,
+  // Add updated centered KILLS/SHOTS/HITS block.
+  const primaryStats = [
+    `KILLS: ${game.runStats.totalKills || game.totalKills || 0}`,
     `SHOTS: ${game.runStats.shotsFired}`,
     `HITS: ${game.runStats.shotsHit}`,
   ];
 
-  const rightStats = [
+  primaryStats.forEach((stat, index) => {
+    const text = makeSprite(stat, {
+      fontSize: scalePauseFont(36),
+      color: '#00ffff',
+      scale: scalePauseText(0.1),
+      renderOrder: PAUSE_TEXT_RENDER_ORDER
+    });
+    text.position.set(0, 0.44 - (index * 0.24), 0.03);
+    text.userData = { isPauseStatText: true };
+    section.add(text);
+  });
+
+  // Add the rest of the stats below.
+  const secondaryStats = [
     `ACCURACY: ${calculateAccuracy()}%`,
     `STREAK: ${game.runStats.longestKillStreak}`,
     `BOSS: ${game.runStats.bossesKilled}`,
   ];
 
-  let leftIndex = 0;
-  let rightIndex = 0;
-
-  leftStats.forEach((stat) => {
-    const text = makeSprite(stat, { fontSize: 0.075, color: '#00ffff' });
-    text.position.set(-1.1, 0.25 - (leftIndex * 0.1), 0.03);
-    pauseMenuElements.statsSection.add(text);
-    leftIndex++;
-  });
-
-  rightStats.forEach((stat) => {
-    const text = makeSprite(stat, { fontSize: 0.075, color: '#00ffff' });
-    text.position.set(1.1, 0.25 - (rightIndex * 0.1), 0.03);
-    pauseMenuElements.statsSection.add(text);
-    rightIndex++;
+  secondaryStats.forEach((stat, index) => {
+    const text = makeSprite(stat, {
+      fontSize: scalePauseFont(36),
+      color: '#00ffff',
+      scale: scalePauseText(0.1),
+      renderOrder: PAUSE_TEXT_RENDER_ORDER
+    });
+    text.position.set(-1.08, -0.34 - (index * 0.22), 0.03);
+    text.userData = { isPauseStatText: true };
+    section.add(text);
   });
 }
 
 /**
  * Update section stats for blasters
  */
 function updateSectionStats(section, hand) {
   // Remove old upgrade sprites
-  section.children.forEach(child => {
+  [...section.children].forEach((child) => {
     if (child.userData && child.userData.isUpgradeSprite) {
       section.remove(child);
     }
   });
 
-  // Add updated weapon name
-  const weaponId = game.mainWeapon[hand];
-  const weaponName = weaponId.replace(/_/g, ' ').toUpperCase();
-
-  // Update blaster section with current stats
+  // Update blaster section with current stats (exclude dream_fragment)
   const upgrades = game.upgrades[hand] || {};
-  const upgradeEntries = Object.entries(upgrades);
-  const yOffset = 0.15;
-
-  upgradeEntries.forEach(([id, count], index) => {
-    const upgradeText = makeSprite(`${id.replace(/_/g, ' ').toUpperCase()} x${count}`, { fontSize: 0.07, color: '#ffffff' });
-    const yPos = yOffset - (index * 0.12);
-    upgradeText.position.set(0, yPos, 0.03);
-    upgradeText.userData = { isUpgradeSprite: true };
-    section.add(upgradeText);
-  });
+  const upgradeEntries = Object.entries(upgrades).filter(([id]) => id !== 'dream_fragment');
+  const yOffset = 0.08;
+
+  if (upgradeEntries.length > 0) {
+    upgradeEntries.forEach(([id, count], index) => {
+      const upgradeText = makeSprite(`${id.replace(/_/g, ' ').toUpperCase()} x${count}`, {
+        fontSize: scalePauseFont(36),
+        color: '#ffffff',
+        scale: scalePauseText(0.1),
+        renderOrder: PAUSE_TEXT_RENDER_ORDER
+      });
+      const yPos = yOffset - (index * 0.24);
+      upgradeText.position.set(0, yPos, 0.03);
+      upgradeText.userData = { isUpgradeSprite: true };
+      section.add(upgradeText);
+    });
+  } else {
+    const noUpgradesText = makeSprite('NO UPGRADES', {
+      fontSize: scalePauseFont(36),
+      color: '#888888',
+      scale: scalePauseText(0.1),
+      renderOrder: PAUSE_TEXT_RENDER_ORDER
+    });
+    noUpgradesText.position.set(0, 0.08, 0.03);
+    noUpgradesText.userData = { isUpgradeSprite: true };
+    section.add(noUpgradesText);
+  }
 }
 
 /**
  * Create resume button
  */
 function createResumeButton() {
   const group = new THREE.Group();
 
-  // Button background
-  const btnWidth = 1.5;
-  const btnHeight = 0.4;
-  const btnBg = new THREE.Mesh(
-    new THREE.PlaneGeometry(btnWidth, btnHeight),
-    new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 })
-  );
-  group.add(btnBg);
-
-  // Button border
-  const borderMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
-  const borderWidth = btnWidth;
-  const borderHeight = 0.05;
-  [
-    { w: borderWidth, h: borderHeight, x: 0, y: btnHeight / 2 },
-    { w: borderWidth, h: borderHeight, x: 0, y: -btnHeight / 2 },
-  ].forEach(b => {
-    const border = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), borderMat);
-    border.position.set(b.x, b.y, 0.01);
-    group.add(border);
+  // Button text (no background, just text)
+  const text = makeSprite('RESUME', {
+    fontSize: scalePauseFont(42),
+    color: '#00ffff',
+    scale: scalePauseText(0.14),
+    renderOrder: PAUSE_TEXT_RENDER_ORDER
   });
-
-  // Button text
-  const text = makeSprite('RESUME', { fontSize: 42, color: '#00ffff', scale: 0.14 });
   text.position.set(0, 0, 0.02);
   group.add(text);
 
-  // Store button data for raycasting
+  // Store button data for raycasting (hitbox is larger than text)
   group.userData = {
     isResumeButton: true,
-    width: btnWidth,
-    height: btnHeight
+    width: 2.0,
+    height: 0.5
   };
 
   return group;
 }
 
diff --git a/index.html b/index.html
index a9f401b..a0ffe0f 100644
--- a/index.html
+++ b/index.html
@@ -208,21 +208,38 @@
     <div style="color:#00ffff;margin-bottom:8px;">DEBUG</div>
     <label>Jump to level: <input type="number" id="debug-level" min="1" max="20" value="5" style="width:40px;background:#220044;color:#fff;border:1px solid #ff00ff;"></label>
     <button id="debug-jump" style="margin-left:8px;background:#220044;color:#00ffff;border:1px solid #00ffff;cursor:pointer;padding:4px 8px;">Jump</button>
     <label style="display:block;margin-top:8px;"><input type="checkbox" id="debug-perf-monitor"> Performance monitor</label>
     <label style="display:block;margin-top:8px;"><input type="checkbox" id="debug-console"> Console log</label>
+    <label style="display:block;margin-top:8px;"><input type="checkbox" id="debug-position-panel"> Debug position box</label>
     <label style="display:block;margin-top:8px;"><input type="checkbox" id="debug-seed-controls"> Seed deck settings</label>
     <button id="debug-next-biome" style="margin-top:8px;background:#220044;color:#00ffff;border:1px solid #00ffff;cursor:pointer;padding:4px 8px;">Next biome</button>
 
     <!-- Visual Tuning Section (collapsible) -->
     <div style="margin-top:12px;border-top:1px solid #333;padding-top:8px;">
       <div id="visual-toggle" style="color:#ff00ff;cursor:pointer;user-select:none;">▶ Visual Tuning</div>
       <div id="visual-controls" style="display:none;margin-top:8px;padding-left:8px;">
-        <label style="display:block;margin-top:4px;"><input type="checkbox" id="debug-glow"> Glow effect</label>
-        <label style="display:block;margin-top:4px;"><input type="checkbox" id="debug-bloom" checked> Bloom</label>
-        <label style="display:block;margin-top:4px;"><input type="checkbox" id="debug-smoke"> Smoke/fog particles</label>
-        <label style="display:block;margin-top:4px;">Fog intensity: <input type="range" id="debug-fog-intensity" min="0" max="100" value="58" style="width:80px;vertical-align:middle;"></label>
+        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
+          <label for="debug-glow-strength" style="width:150px;">Glow strength</label>
+          <input type="range" id="debug-glow-strength" min="0" max="2" step="0.01" value="1" style="width:90px;">
+          <input type="number" id="debug-glow-strength-value" min="0" max="2" step="0.01" value="1.00" style="width:58px;background:#220044;color:#fff;border:1px solid #ff00ff;">
+        </div>
+        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
+          <label for="debug-bloom-strength" style="width:150px;">Bloom strength</label>
+          <input type="range" id="debug-bloom-strength" min="0" max="2" step="0.01" value="1" style="width:90px;">
+          <input type="number" id="debug-bloom-strength-value" min="0" max="2" step="0.01" value="1.00" style="width:58px;background:#220044;color:#fff;border:1px solid #ff00ff;">
+        </div>
+        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
+          <label for="debug-smoke-strength" style="width:150px;">Smoke particles</label>
+          <input type="range" id="debug-smoke-strength" min="0" max="2" step="0.01" value="1" style="width:90px;">
+          <input type="number" id="debug-smoke-strength-value" min="0" max="2" step="0.01" value="1.00" style="width:58px;background:#220044;color:#fff;border:1px solid #ff00ff;">
+        </div>
+        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
+          <label for="debug-fog-intensity" style="width:150px;">Fog intensity</label>
+          <input type="range" id="debug-fog-intensity" min="0" max="1" step="0.01" value="0.58" style="width:90px;">
+          <input type="number" id="debug-fog-intensity-value" min="0" max="1" step="0.01" value="0.58" style="width:58px;background:#220044;color:#fff;border:1px solid #ff00ff;">
+        </div>
       </div>
     </div>
 
     <button id="copy-log-btn" style="margin-top:8px;background:#220044;color:#ff00ff;border:1px solid #ff00ff;cursor:pointer;padding:4px 8px;">📋 COPY LOG</button>
   </div>
@@ -279,10 +296,30 @@
       });
       document.getElementById('debug-console').addEventListener('change', function() {
         consolePanel.style.display = this.checked ? 'block' : 'none';
       });
 
+      const debugPositionToggle = document.getElementById('debug-position-panel');
+      if (debugPositionToggle) {
+        let debugPositionDefault = false;
+        try {
+          const storedDebug = localStorage.getItem('spaceomicide_debug');
+          if (storedDebug) {
+            const parsedDebug = JSON.parse(storedDebug);
+            debugPositionDefault = parsedDebug.debugShowPosition === true;
+          }
+        } catch (err) {
+          debugPositionDefault = false;
+        }
+
+        window.debugPositionPanel = debugPositionDefault;
+        debugPositionToggle.checked = debugPositionDefault;
+        debugPositionToggle.addEventListener('change', function() {
+          window.debugPositionPanel = this.checked;
+        });
+      }
+
       const debugNextBiomeBtn = document.getElementById('debug-next-biome');
       if (debugNextBiomeBtn) {
         debugNextBiomeBtn.addEventListener('click', function() {
           if (window.debugCycleBiomeWithFade) {
             window.debugCycleBiomeWithFade();
@@ -298,33 +335,48 @@
           const isExpanded = visualControls.style.display !== 'none';
           visualControls.style.display = isExpanded ? 'none' : 'block';
           visualToggle.textContent = (isExpanded ? '▶' : '▼') + ' Visual Tuning';
         });
 
-        // Glow toggle
-        document.getElementById('debug-glow').addEventListener('change', function() {
-          window.debugGlow = this.checked;
-        });
+        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
+        const bindRangeAndNumber = (rangeId, numberId, min, max, fallback, setter) => {
+          const range = document.getElementById(rangeId);
+          const number = document.getElementById(numberId);
+          if (!range || !number) return;
+
+          const apply = (raw) => {
+            const parsed = Number(raw);
+            const value = Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
+            const fixed = value.toFixed(2);
+            range.value = fixed;
+            number.value = fixed;
+            setter(value);
+          };
+
+          range.addEventListener('input', () => apply(range.value));
+          number.addEventListener('change', () => apply(number.value));
+          apply(fallback);
+        };
 
-        // Bloom toggle
-        document.getElementById('debug-bloom').addEventListener('change', function() {
-          window.debugBloom = this.checked;
+        bindRangeAndNumber('debug-glow-strength', 'debug-glow-strength-value', 0, 2, 1.0, (value) => {
+          window.debugGlowStrength = value;
+          window.debugGlow = value > 0;
         });
 
-        // Smoke/fog particles toggle
-        document.getElementById('debug-smoke').addEventListener('change', function() {
-          window.debugSmoke = this.checked;
+        bindRangeAndNumber('debug-bloom-strength', 'debug-bloom-strength-value', 0, 2, 1.0, (value) => {
+          window.debugBloomStrength = value;
+          window.debugBloom = value > 0;
         });
 
-        // Fog intensity slider
-        document.getElementById('debug-fog-intensity').addEventListener('input', function() {
-          window.debugFogIntensity = parseInt(this.value, 10) / 100;
+        bindRangeAndNumber('debug-smoke-strength', 'debug-smoke-strength-value', 0, 2, 1.0, (value) => {
+          window.debugSmokeStrength = value;
+          window.debugSmoke = value > 0;
         });
 
-        // Initialize defaults
-        window.debugBloom = true;
-        window.debugFogIntensity = 0.58;
+        bindRangeAndNumber('debug-fog-intensity', 'debug-fog-intensity-value', 0, 1, 0.58, (value) => {
+          window.debugFogIntensity = value;
+        });
       }
 
       // Seed Deck Controls
       const seedInput = document.getElementById('seed-input');
       const seedTier = document.getElementById('seed-tier');
@@ -501,15 +553,23 @@
           });
         };
       };
 
       window.addEventListener('error', function(e) {
+        // Suppress pointer lock SecurityError - expected when user exits via ESC
+        if (e.message && e.message.includes('Pointer lock')) return;
         const where = `${e.filename || 'unknown'}:${e.lineno || 0}:${e.colno || 0}`;
         window.showWebError(`${e.message} @ ${where}`, e.error?.stack || e.stack || '');
       });
 
       window.addEventListener('unhandledrejection', function(e) {
+        // Suppress pointer lock SecurityError - expected when user exits via ESC
+        const reason = String(e.reason || '');
+        if (reason.includes('Pointer lock') || reason.includes('SecurityError')) {
+          console.debug('[game] Suppressed pointer lock error');
+          return;
+        }
         window.showWebError('Unhandled Promise Rejection: ' + e.reason, e.reason?.stack || '');
       });
     })();
   </script>
 
diff --git a/investigation-projectile-pool-sharing.md b/investigation-projectile-pool-sharing.md
new file mode 100644
index 0000000..5f13916
--- /dev/null
+++ b/investigation-projectile-pool-sharing.md
@@ -0,0 +1,244 @@
+# Projectile Pool Sharing Investigation Report
+
+## Executive Summary
+
+**Investigation Date**: 2026-03-23
+**Bug Description**: Sideways projectile orientation when using plasma carbine (LEFT hand) and standard blaster (RIGHT hand)
+**Hypothesis**: Pool sharing between weapon types causes orientation issues
+
+**Key Finding**: **Plasma carbine and standard blaster use DIFFERENT pools. They do NOT share projectile instances.**
+
+## Detailed Analysis
+
+### 1. Pool Initialization (main.js:6802-6873)
+
+Four separate InstancedMesh pools are created:
+
+| Pool Type | Geometry | Size | Rotation |
+|-----------|----------|------|----------|
+| **laser** | CylinderGeometry(0.035, 0.035, 1.0, 6) | 120 instances | `rotateX(Math.PI/2)` |
+| **plasma_carbine** | CylinderGeometry(0.026, 0.026, 0.5, 6) | 30 instances | `rotateX(Math.PI/2)` |
+| **buckshot** | SphereGeometry(0.025, 6, 6) | 20 instances | None |
+| **seeker** | SphereGeometry(0.03, 8, 8) | 28 instances | None |
+
+**Code Reference** (main.js:6816-6856):
+```javascript
+// Laser pool
+const laserGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6);
+laserGeo.rotateX(Math.PI / 2); // Rotate to align with -Z direction
+const laserIM = new THREE.InstancedMesh(laserGeo, laserMat, 120);
+instancedProjectiles['laser'] = { mesh: laserIM, maxCount: 120, freeIndices: new Set() };
+
+// Plasma carbine pool
+const plasmaGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.5, 6);
+plasmaGeo.rotateX(Math.PI / 2); // Rotate to align with -Z direction
+const plasmaIM = new THREE.InstancedMesh(plasmaGeo, plasmaMat, 30);
+instancedProjectiles['plasma_carbine'] = { mesh: plasmaIM, maxCount: 30, freeIndices: new Set() };
+```
+
+**Finding**: Each weapon type has its OWN InstancedMesh with its OWN geometry. No sharing.
+
+### 2. Pool Type Selection (main.js:7907-7908)
+
+Pool type is determined by weapon stats:
+
+```javascript
+const isPlasmaCarbine = stats.mainWeaponId === 'plasma_carbine';
+const poolType = stats.homing ? 'seeker' : (isPlasmaCarbine ? 'plasma_carbine' : (isBuckshot ? 'buckshot' : 'laser'));
+```
+
+**Logic Flow**:
+- If homing → 'seeker' pool
+- Else if plasma carbine → 'plasma_carbine' pool
+- Else if buckshot (spread > 5°) → 'buckshot' pool
+- Else → 'laser' pool
+
+**Specific Scenario**:
+- LEFT hand fires plasma carbine → poolType = 'plasma_carbine'
+- RIGHT hand fires standard blaster → poolType = 'laser'
+
+**Result**: **Different weapons use different pools. No cross-contamination possible.**
+
+### 3. Quaternion Handling
+
+#### 3.1 Quaternion Initialization (main.js:6912)
+```javascript
+data.quaternion = new THREE.Quaternion();
+```
+A new quaternion is created EVERY TIME a projectile is acquired from the pool.
+
+#### 3.2 Quaternion Setting (main.js:7972-7974)
+```javascript
+// Orient bolt along direction
+if (!isBuckshot) {
+  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
+}
+```
+The quaternion is ALWAYS set for non-buckshot projectiles (including both laser and plasma_carbine).
+
+#### 3.3 Quaternion Commit (main.js:6970-6973)
+```javascript
+proxy.commit = function() {
+  _projMatrix.compose(pos, data.quaternion, _projScale);
+  pool.mesh.setMatrixAt(instanceIndex, _projMatrix);
+  pool.mesh.instanceMatrix.needsUpdate = true;
+};
+```
+The quaternion is committed to the InstancedMesh instance matrix.
+
+#### 3.4 Quaternion in Recycling (main.js:6980-7023)
+**Critical Observation**: `returnProjectileToPool` does NOT explicitly reset `data.quaternion`.
+
+However, this is **NOT a bug** because:
+1. The quaternion is ALWAYS set when spawning (line 7972)
+2. A new Quaternion object is created when acquiring from pool (line 6912)
+3. The commit() function applies the quaternion to the instance matrix
+
+**Result**: Quaternion handling appears correct.
+
+### 4. Geometry Orientation
+
+Both laser and plasma_carbine geometries use:
+- CylinderGeometry (cylinder along Y-axis by default)
+- `rotateX(Math.PI / 2)` to align with -Z direction
+
+This rotation is applied ONCE during initialization and is correct for both weapon types.
+
+### 5. Recycling Logic Analysis
+
+#### 5.1 Global Cap Recycling (main.js:7893-7897)
+```javascript
+if (projectiles.length >= MAX_PROJECTILES) {
+  const recycled = projectiles.shift();
+  if (recycled) {
+    returnProjectileToPool(recycled);
+  }
+}
+```
+
+#### 5.2 Per-Pool Exhaustion Recycling (main.js:7922-7929)
+```javascript
+if (!mesh) {
+  const recycled = projectiles.shift();
+  if (recycled) {
+    returnProjectileToPool(recycled);
+    mesh = getPooledProjectile(poolType, color);
+  }
+}
+```
+
+**Critical Finding**: In both cases, projectiles are recycled from a **global array** that contains projectiles from **all pool types**.
+
+However, `returnProjectileToPool` uses `proj.userData.poolType` to return to the **correct pool**. So even if we recycle a plasma_carbine projectile while trying to get a laser projectile, the plasma_carbine goes back to its own pool.
+
+**Potential Issue**: If the laser pool is empty and all active projectiles are plasma_carbine, recycling won't help because:
+1. Recycle plasma_carbine projectile → goes to plasma_carbine pool
+2. Try to get from laser pool → still empty
+3. Return null, don't fire
+
+But this would cause **no projectile**, not a **sideways projectile**.
+
+### 6. Per-Controller/Hand State
+
+The direction is calculated per-controller (main.js:7379-7380):
+```javascript
+controller.getWorldQuaternion(quat);
+const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
+```
+
+Each hand has its own controller with its own orientation. This appears correct.
+
+### 7. Weapon Definitions (weapons.js)
+
+**Plasma Carbine** (weapons.js:86-113):
+- Not homing
+- spreadAngle: 0.0262 (1.5 degrees)
+- Uses 'plasma_carbine' pool
+
+**Standard Blaster** (weapons.js:1-17):
+- Not homing
+- spreadAngle: 0
+- Uses 'laser' pool
+
+## Conclusions
+
+### What I Found
+1. ✅ Plasma carbine and standard blaster use **SEPARATE pools**
+2. ✅ Quaternion is **always set** when spawning non-buckshot projectiles
+3. ✅ Quaternion is **committed** to the instance matrix
+4. ✅ Geometry rotation is **identical** for both weapon types
+5. ✅ Pool recycling returns projectiles to the **correct pool**
+
+### What I Did NOT Find
+1. ❌ No obvious bug in pool sharing (pools are separate)
+2. ❌ No obvious bug in quaternion handling (always set and committed)
+3. ❌ No obvious bug in geometry orientation (both use same rotation)
+4. ❌ No state persistence that could cause orientation issues
+
+### Root Cause Analysis
+
+**The user's hypothesis appears to be incorrect.** The sideways projectile bug is **NOT caused by pool sharing** between plasma carbine and standard blaster, because:
+1. They use completely separate pools
+2. There's no way for a plasma_carbine projectile instance to be reused for a laser shot
+3. The quaternion is always set correctly
+
+### Alternative Hypotheses to Investigate
+
+Since pool sharing is not the cause, the sideways orientation bug might be caused by:
+
+1. **Controller tracking issue**
+   - One controller reporting incorrect orientation
+   - Check VR controller calibration
+   - Check if bug persists with swapped weapons
+
+2. **Direction calculation issue**
+   - The direction vector might be wrong for one controller
+   - Add debug logging to compare directions from left vs right controller
+
+3. **Visual rendering issue**
+   - The projectile might be oriented correctly but rendered incorrectly
+   - Check if bug is visible from different camera angles
+   - Check if bug affects both VR and desktop modes
+
+4. **Specific weapon configuration issue**
+   - Bug might only occur with this specific weapon combination
+   - Test with other weapon combinations:
+     - Plasma carbine (LEFT) + plasma carbine (RIGHT)
+     - Standard blaster (LEFT) + standard blaster (RIGHT)
+     - Standard blaster (LEFT) + plasma carbine (RIGHT)
+
+5. **Race condition or timing issue**
+   - Unlikely, but could be related to InstancedMesh update timing
+   - Check if bug is consistent or intermittent
+
+## Recommended Next Steps
+
+1. **Verify the bug exists**: Test with plasma carbine (LEFT) + standard blaster (RIGHT) and confirm sideways projectiles are visible
+
+2. **Isolate the weapon**: Test each weapon individually to see if the bug occurs with only one weapon type
+
+3. **Swap hands**: Test with plasma carbine (RIGHT) + standard blaster (LEFT) to see if the bug follows the weapon or the hand
+
+4. **Add debug logging**: Log the direction vector and quaternion for each projectile spawn to identify if values are incorrect
+
+5. **Check controller data**: Verify that both controllers are reporting correct orientations
+
+6. **Test in desktop mode**: Check if bug occurs without VR controllers
+
+## Relevant Line Numbers
+
+- Pool initialization: main.js:6802-6873
+- Pool type selection: main.js:7907-7908
+- Quaternion creation: main.js:6912
+- Quaternion setting: main.js:7972-7974
+- Quaternion commit: main.js:6970-6973
+- Projectile recycling (global cap): main.js:7893-7897
+- Projectile recycling (pool exhaustion): main.js:7922-7929
+- Direction calculation: main.js:7379-7380
+- Weapon definitions: weapons.js:1-17 (standard_blaster), 86-113 (plasma_carbine)
+
+---
+
+**Investigation Status**: Complete
+**Bug Found**: No (pool sharing hypothesis disproven)
+**Action Required**: User should investigate alternative hypotheses listed above
diff --git a/main.js b/main.js
index 9a6cbf1..a64faa3 100644
--- a/main.js
+++ b/main.js
@@ -1,10 +1,18 @@
 // ============================================================
 //  SPACEOMICIDE — Main Game Controller
 //  Phase 1: Core game loop with levels, enemies, upgrades, HUD
 // ============================================================
 
+// ============================================================
+// MODULE IMPORTS
+// Dependencies: game.js, weapons.js, audio.js, enemies.js,
+//   stasis.js, vfx.js, biome-scenes.js, boss-death-cinematic.js,
+//   hud.js, desktop-controls.js, scoreboard.js, scenery.js,
+//   dream-world.js, spatial-hash.js
+// ============================================================
+
 import * as THREE from 'three';
 import { VRButton } from 'three/addons/webxr/VRButton.js';
 import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
 import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
 import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
@@ -37,10 +45,16 @@ import {
   updateBossDebris, clearBossDebris, spawnBossDebris, setVFXReference, clearBossProjectiles, clearAllElectricArcs,
   clearAllTelegraphs, spawnHealthGainPopup
 } from './enemies.js';
 import { setActiveStasisFields, getStasisSlowFactor } from './stasis.js';
 import { initVFX, updateVFX } from './vfx.js';
+import { rebuildBiomeScene as rebuildBiomeSceneModule, getBiomeFloorY as getBiomeFloorYModule } from './biome-scenes.js';
+import {
+  initBossDeathCinematic, initBossDeathOverlays, startBossDeathCinematic,
+  updateBossDeathCinematic, updateBossDeathFreeze, shouldFreezeTime,
+  isBossDeathCinematicActive, BOSS_DEATH_FREEZE
+} from './boss-death-cinematic.js';
 import {
   initHUD, showTitle, hideTitle, updateTitle, showHUD, hideHUD, updateHUD,
   showLevelComplete, hideLevelComplete, showUpgradeCards, hideUpgradeCards,
   updateUpgradeCards, getUpgradeCardHit, showGameOver, showVictory, updateEndScreen,
   hideGameOver, triggerHitFlash, updateHitFlash, spawnDamageNumber, spawnCritIndicator, updateDamageNumbers, updateFPS,
@@ -70,17 +84,25 @@ import {
   submitScore, fetchTopScores, fetchScoresByCountry, fetchScoresByContinent,
   isNameClean, COUNTRIES, CONTINENTS,
   getStoredCountry, setStoredCountry, getStoredName, setStoredName
 } from './scoreboard.js';
 import { getThemeForLevel, initAmbientParticles, updateAmbientParticles, createInnkeeper } from './scenery.js';
-import { initDreamWorld, enterDreamWorld, exitDreamWorld, getDreamFogSettings, getDreamSpawnPosition } from './dream-world.js';
+import { initDreamWorld, enterDreamWorld, exitDreamWorld, getDreamFogSettings, getDreamSpawnPosition, handleDreamProjectileHit, updateDreamWorld } from './dream-world.js';
 import { SpatialHash } from './spatial-hash.js';
 
 // Expose game state to window for debugging/testing
 window.State = State;
 window.game = game;
 
+// Debug flag for projectile firing investigation
+window.DEBUG_PROJECTILES = false;
+
+// ============================================================
+// CONSTANTS & CONFIGURATION
+// Color palette, timing, physics constants
+// ============================================================
+
 // ── Constants ──────────────────────────────────────────────
 const NEON_PINK = 0xff00ff;
 const NEON_CYAN = 0x00aaaa;  // Muted teal (not bright neon cyan)
 const DARK_BG = 0x0a0015;
 const SUN_CORE = 0xffaa00;
@@ -107,10 +129,16 @@ function getCountryDisplayLabel() {
   }
   const prefix = flag ? `${flag} ` : '';
   return `COUNTRY: ${prefix}${label}`;
 }
 
+// ============================================================
+// MODULE STATE
+// Scene, camera, renderer, controller state, pools, queues
+// COUPLING: Many functions reference these globals directly
+// ============================================================
+
 // ── Module State ───────────────────────────────────────────
 let scene, camera, renderer;
 // Camera added directly to scene (no rig - VR hands need direct camera)
 // floorHUDDebugMarker removed - was debug white plane
 const controllers = [];
@@ -226,10 +254,14 @@ let horizonRingRef = null;
 let horizonInnerRingRef = null;
 let auroraRef = null;
 let auroraCanvas = null;
 let auroraCtx = null;
 let atmosphereRef = null;
+let vhsRetroShellRef = null;
+let vhsRetroScanlineMatRef = null;
+let vhsRetroGlowMatRef = null;
+let vhsRetroScanlineTexRef = null;
 let currentTheme = null;
 let biomePropsGroup = null;
 let biomePropsBiome = null;
 const biomePropFloaters = [];
 let biomeSceneGroup = null;
@@ -254,13 +286,33 @@ let levelFadeReady = false;
 let floorMaterial = null;
 let floorBaseColor = new THREE.Color(0x220044);
 let floorFlashTimer = 0;
 let floorFlashing = false;
 
+// ============================================================
+// POOLED OBJECTS (HOT PATH OPTIMIZATION)
+// Pre-allocated Raycasters, Vector3, Quaternion to avoid GC
+// COUPLING: Reused across render loop, projectile updates, UI hover
+// ============================================================
+
 // Pre-allocated raycasters (reused to avoid per-frame GC)
 const _uiRaycaster = new THREE.Raycaster();
 
+// Pooled UI hover raycasters for controller/desktop hover detection
+// Avoids creating new Raycaster/Vector3/Quaternion every frame in menu states
+const _uiHoverRaycasters = [new THREE.Raycaster(), new THREE.Raycaster()];
+const _uiHoverOrigins = [new THREE.Vector3(), new THREE.Vector3()];
+const _uiHoverQuats = [new THREE.Quaternion(), new THREE.Quaternion()];
+const _uiHoverDirs = [new THREE.Vector3(), new THREE.Vector3()];
+
+// Dream trigger hit-test temp vectors (avoid per-frame allocations in projectile loop)
+const _dreamPrevProjectilePos = new THREE.Vector3();
+const _dreamSegment = new THREE.Vector3();
+const _dreamToCenter = new THREE.Vector3();
+const _dreamClosestPoint = new THREE.Vector3();
+const _vhsPlayerPos = new THREE.Vector3();
+
 // Low health warning
 let lowHealthWarningActive = false;
 let lowHealthPulseTimer = 0;
 
 // Biome terrain materials for damage flash
@@ -296,25 +348,25 @@ let killsAlertTriggerKill = null;
 
 // Accuracy bonus shot tracking
 let accuracyShotId = 0;
 const accuracyShots = new Map();
 
-function startAccuracyShot(pelletCount) {
+function startAccuracyShot(pelletCount, hand) {
   const shotId = ++accuracyShotId;
-  accuracyShots.set(shotId, { remaining: pelletCount, hit: false });
-  trackShot();
+  accuracyShots.set(shotId, { remaining: pelletCount, hit: false, hand });
+  trackShot(hand);
   return shotId;
 }
 
 // Track previous accuracy multiplier for popup triggers
 let prevAccuracyMultiplier = 1;
 
-function markAccuracyHit(shotId) {
+function markAccuracyHit(shotId, hand) {
   const shot = accuracyShots.get(shotId);
   if (!shot || shot.hit) return;
   shot.hit = true;
-  trackShotHit();
+  trackShotHit(0, hand);
 
   // Store previous multiplier before hit
   const oldMultiplier = game.accuracyMultiplier || 1;
   registerAccuracyHit();
   const newMultiplier = game.accuracyMultiplier || 1;
@@ -362,26 +414,11 @@ function getAdjustedCameraPosition() {
 
 // Screen shake system
 let screenShakeIntensity = 0;
 let screenShakeTime = 0;
 
-// Boss death cinematic overlays
-const BOSS_DEATH_FREEZE = 0.18;
-const BOSS_DEATH_EXPLOSION_TIME = 0.9;
-const BOSS_DEATH_WHITE_FADE = 0.35;
-const BOSS_DEATH_BLACK_FADE = 0.55;
-const BOSS_DEATH_EXPLOSION_INTERVAL = 0.12;
-let bossDeathFreezeTimer = 0;
-let bossDeathWhiteOverlay = null;
-let bossDeathBlackOverlay = null;
-let bossDeathCinematic = {
-  active: false,
-  timer: 0,
-  explosionTimer: 0,
-  bossPos: new THREE.Vector3(),
-  wasFinalBoss: false,
-};
+// Boss death cinematic state is now in boss-death-cinematic.js module
 
 // Decoy system
 const activeDecoys = [];
 const MAX_DECOYS = 3;
 
@@ -401,16 +438,46 @@ const MAX_NANITE_SWARMS = 2;
 
 // Reflector drone system
 const activeReflectorDrones = [];
 const MAX_REFLECTOR_DRONES = 2;
 
+// ============================================================
+// BOOTSTRAP & INITIALISATION
+// Entry point: init() called at module load
+// Dependencies: All module state must be declared above
+// ============================================================
+
 // ── Bootstrap ──────────────────────────────────────────────
 
 // Bloom layer constant — must be before init() since buildSynthwaveValleyScene
 // references it during init execution. All other bloom code uses lazy init.
 const BLOOM_LAYER = 1;
 
+// Visual tuning defaults for debug sliders in index.html.
+const VISUAL_TUNING_DEFAULTS = {
+  glowStrength: 1.0,
+  bloomStrength: 1.0,
+  smokeStrength: 1.0,
+  fogIntensity: 0.58,
+};
+
+// References that let debug visual tuning affect synthwave valley elements.
+const synthVisualRefs = {
+  terrainUniforms: null,
+  sunOuterGlowMat: null,
+  sunGlowMat: null,
+  sunCoreMat: null,
+};
+
+// Player projectile materials that should respond to visual tuning sliders.
+const playerProjectileMaterials = [];
+
+// VR pause button edge tracking (gamepad/menu style buttons).
+const vrPauseButtonPressed = new Map();
+let lastVRPauseToggleTime = 0;
+const VR_PAUSE_DEBOUNCE_MS = 350;
+
 init();
 
 // ============================================================
 //  INITIALISATION
 // ============================================================
@@ -420,10 +487,15 @@ function init() {
 
   // Load debug settings from localStorage
   loadDebugSettings();
   loadDreamState();
 
+  // Sync desktop position panel with game state (may differ from HTML checkbox default)
+  if (typeof window !== 'undefined') {
+    window.debugPositionPanel = game.debugShowPosition;
+  }
+
   // Scene — use black background for Adreno GPU "Fast clear" optimization on Quest
   scene = new THREE.Scene();
   scene.background = new THREE.Color(0x000000);
   // Camera - added directly to scene for proper VR hand positioning
   camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
@@ -480,10 +552,29 @@ function init() {
   createEnvironment();
   applyThemeForLevel(1);
   applyEnvironmentFade(0);
   setupControllers();
 
+  // Init boss death cinematic module with dependencies
+  initBossDeathCinematic({
+    camera,
+    game,
+    State,
+    spawnBossDebris,
+    spawnExplosionVisual,
+    hideBossHealthBar,
+    clearBoss,
+    clearAllTelegraphs,
+    playExplosionSound,
+    stopMusic,
+    completeLevel,
+    endGame,
+    applyEnvironmentFade,
+    resetAllSlowMoState,
+    hideKillsAlert,
+  });
+
   // Init subsystems
   initEnemies(scene);
   initHUD(camera, scene);
   initBossDeathOverlays();
   initVFX(scene);
@@ -581,13 +672,13 @@ function init() {
 
   console.log('[init] SPACEOMICIDE ready — pull trigger at title screen to start');
 }
 
 // ============================================================
-//  SELECTIVE BLOOM (desktop only, synthwave_valley biome)
-//  Lazy-initialized on first render frame when synthwave biome
-//  is active in desktop mode. No bootstrap ordering dependency.
+// SELECTIVE BLOOM (Desktop only, synthwave_valley biome)
+// Lazy-initialized on first render frame
+// COUPLING: References BLOOM_LAYER, synthVisualRefs, renderer
 // ============================================================
 
 let bloomComposer = null;
 
 const SelectiveBloomCompositeShader = {
@@ -642,11 +733,11 @@ function initSelectiveBloom() {
   const compositePass = new ShaderPass(SelectiveBloomCompositeShader);
   compositePass.uniforms.baseTexture.value = baseComposer.renderTarget1.texture;
   compositePass.uniforms.bloomTexture.value = bloomComposer_.renderTarget2.texture;
   baseComposer.addPass(compositePass);
 
-  bloomComposer = { baseComposer, bloomComposer: bloomComposer_, compositePass, bloomCamera };
+  bloomComposer = { baseComposer, bloomComposer: bloomComposer_, compositePass, bloomCamera, bloomPass };
   console.log('[bloom] Selective bloom initialized (desktop only)');
 }
 
 function resizeBloomComposer() {
   if (!bloomComposer) return;
@@ -655,13 +746,204 @@ function resizeBloomComposer() {
   bloomComposer.baseComposer.setSize(w, h);
   bloomComposer.bloomComposer.setSize(w, h);
   bloomComposer.bloomComposer.passes[1].resolution.set(w, h);
 }
 
+function clampDebugValue(value, min, max, fallback) {
+  const n = Number(value);
+  if (!Number.isFinite(n)) return fallback;
+  return Math.min(max, Math.max(min, n));
+}
+
+function getVisualTuning() {
+  if (typeof window === 'undefined') {
+    return { ...VISUAL_TUNING_DEFAULTS };
+  }
+
+  return {
+    glowStrength: clampDebugValue(window.debugGlowStrength, 0, 2, VISUAL_TUNING_DEFAULTS.glowStrength),
+    bloomStrength: clampDebugValue(window.debugBloomStrength, 0, 2, VISUAL_TUNING_DEFAULTS.bloomStrength),
+    smokeStrength: clampDebugValue(window.debugSmokeStrength, 0, 2, VISUAL_TUNING_DEFAULTS.smokeStrength),
+    fogIntensity: clampDebugValue(window.debugFogIntensity, 0, 1, VISUAL_TUNING_DEFAULTS.fogIntensity),
+  };
+}
+
+function registerPlayerProjectileMaterial(material) {
+  if (!material) return;
+  if (!material.userData) material.userData = {};
+  if (material.userData.baseOpacity === undefined) {
+    material.userData.baseOpacity = material.opacity !== undefined ? material.opacity : 1;
+  }
+  if (!playerProjectileMaterials.includes(material)) {
+    playerProjectileMaterials.push(material);
+  }
+}
+
+function applyVisualTuning() {
+  const tuning = getVisualTuning();
+
+  if (synthVisualRefs.terrainUniforms) {
+    if (synthVisualRefs.terrainUniforms.uGlowIntensity) {
+      synthVisualRefs.terrainUniforms.uGlowIntensity.value = tuning.glowStrength;
+    }
+    if (synthVisualRefs.terrainUniforms.uFogIntensity) {
+      synthVisualRefs.terrainUniforms.uFogIntensity.value = tuning.fogIntensity;
+    }
+  }
+
+  const glowOpacityScale = 0.2 + (tuning.glowStrength * 0.8);
+  [
+    synthVisualRefs.sunOuterGlowMat,
+    synthVisualRefs.sunGlowMat,
+    synthVisualRefs.sunCoreMat,
+  ].forEach((mat) => {
+    if (!mat) return;
+    if (!mat.userData) mat.userData = {};
+    if (mat.userData.baseOpacity === undefined) {
+      mat.userData.baseOpacity = mat.opacity !== undefined ? mat.opacity : 1;
+    }
+    mat.opacity = mat.userData.baseOpacity * glowOpacityScale;
+  });
+
+  // Also apply glow tuning to all pooled player projectile materials.
+  const projectileOpacityScale = 0.35 + (tuning.glowStrength * 0.65);
+  playerProjectileMaterials.forEach((mat) => {
+    if (!mat) return;
+    if (!mat.userData) mat.userData = {};
+    if (mat.userData.baseOpacity === undefined) {
+      mat.userData.baseOpacity = mat.opacity !== undefined ? mat.opacity : 1;
+    }
+    mat.opacity = mat.userData.baseOpacity * projectileOpacityScale;
+  });
+
+  if (bloomComposer?.bloomPass) {
+    bloomComposer.bloomPass.strength = 0.3 * tuning.bloomStrength;
+  }
+}
+
+function cleanupLegacyShapeGeometry(targetGroup) {
+  if (!targetGroup) return;
+
+  const staleMeshes = [];
+  const worldPos = new THREE.Vector3();
+  const boundsSize = new THREE.Vector3();
+
+  targetGroup.traverse((child) => {
+    if (!child?.isMesh || !child.geometry) return;
+    if (child.geometry.type !== 'ShapeGeometry') return;
+
+    child.getWorldPosition(worldPos);
+    const atWorldOrigin = worldPos.lengthSq() <= 0.0001;
+
+    // Non-obvious safety guard: legacy audio-peak mountains were large flat
+    // ShapeGeometry meshes locked at world origin. Keep this strict so we do
+    // not remove gameplay hex meshes that also use ShapeGeometry.
+    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
+    if (!child.geometry.boundingBox) return;
+    child.geometry.boundingBox.getSize(boundsSize);
+    const isLargeLegacyPlane = boundsSize.lengthSq() >= (25 * 25);
+
+    if (!atWorldOrigin || !isLargeLegacyPlane) return;
+    staleMeshes.push(child);
+  });
+
+  staleMeshes.forEach((mesh, idx) => {
+    if (mesh.parent) mesh.parent.remove(mesh);
+    disposeObject3D(mesh);
+    console.log(`[biome] Removed stale ShapeGeometry legacy mountain at world origin (${idx + 1}/${staleMeshes.length})`);
+  });
+}
+
+function sanitizeBiomeMeshName(name) {
+  return String(name || '')
+    .toLowerCase()
+    .replace(/[^a-z0-9_-]+/g, '-')
+    .replace(/-+/g, '-')
+    .replace(/^-|-$/g, '');
+}
+
+function assignBiomePlaneNames(targetGroup, biomeId) {
+  if (!targetGroup) return;
+
+  const usedPlaneNames = new Set();
+
+  targetGroup.traverse((child) => {
+    if (!child?.isMesh || !child.geometry) return;
+    if (child.geometry.type !== 'PlaneGeometry') return;
+
+    const geoParams = child.geometry.parameters || {};
+    const widthTag = Number.isFinite(geoParams.width) ? `w${Math.round(geoParams.width)}` : 'w';
+    const heightTag = Number.isFinite(geoParams.height) ? `h${Math.round(geoParams.height)}` : 'h';
+
+    const preferredName =
+      sanitizeBiomeMeshName(child.userData?.planeName) ||
+      sanitizeBiomeMeshName(child.name) ||
+      sanitizeBiomeMeshName(child.parent?.name) ||
+      `${biomeId}-plane-${widthTag}-${heightTag}`;
+
+    let baseName = preferredName || `${biomeId}-plane-${widthTag}-${heightTag}`;
+    let uniqueName = baseName;
+    let suffix = 2;
+
+    while (usedPlaneNames.has(uniqueName)) {
+      uniqueName = `${baseName}-${suffix++}`;
+    }
+
+    // Keep userData + mesh name in sync so debug tooling and inspector searches
+    // both resolve to the same human-readable PlaneGeometry label.
+    child.name = uniqueName;
+    child.userData.planeName = uniqueName;
+    usedPlaneNames.add(uniqueName);
+  });
+}
+
+function updateVRPauseButton(now) {
+  const session = renderer?.xr?.getSession?.();
+  if (!session) {
+    vrPauseButtonPressed.clear();
+    return;
+  }
+
+  let pausePressedThisFrame = false;
+
+  session.inputSources.forEach((source, sourceIndex) => {
+    const gamepad = source.gamepad;
+    if (!gamepad?.buttons || gamepad.buttons.length === 0) return;
+
+    // WebXR mappings vary by controller. Check common non-trigger buttons so
+    // at least one hardware button can open pause on most headsets/controllers.
+    const pressed = !!(
+      gamepad.buttons[3]?.pressed || // thumbstick click
+      gamepad.buttons[4]?.pressed || // X/A
+      gamepad.buttons[5]?.pressed || // Y/B
+      gamepad.buttons[2]?.pressed    // touchpad/menu fallback on some mappings
+    );
+
+    const key = `${source.handedness || 'none'}-${sourceIndex}`;
+    const wasPressed = vrPauseButtonPressed.get(key) === true;
+    vrPauseButtonPressed.set(key, pressed);
+
+    if (pressed && !wasPressed) {
+      pausePressedThisFrame = true;
+    }
+  });
+
+  if (!pausePressedThisFrame) return;
+  if (now - lastVRPauseToggleTime < VR_PAUSE_DEBOUNCE_MS) return;
+
+  if (game.state === State.PLAYING || game.state === State.PAUSED) {
+    lastVRPauseToggleTime = now;
+    togglePause();
+  }
+}
+
 // ============================================================
-//  ENVIRONMENT
+// ENVIRONMENT CREATION
+// Sun, aurora, mountains, stars, horizon, VHS retro shell
+// COUPLING: Updates scene directly, registers fade materials
 // ============================================================
+
 function createEnvironment() {
   // Grid floor - reduced size to cut ugly distant static
   gridHelper = new THREE.GridHelper(120, 48, NEON_PINK, 0xff0088);
   if (Array.isArray(gridHelper.material)) {
     gridHelper.material.forEach(m => { m.transparent = true; m.opacity = 0.85; registerFadeMaterial(m); });
@@ -749,13 +1031,16 @@ function createEnvironment() {
   // horizonInnerRingRef.renderOrder = -2;
   // scene.add(horizonInnerRingRef);
   // registerFadeMaterial(horizonInnerRingRef.material);
 
   createSun();
-  createMountains();
+  createVHSRetroShell();
+  // Removed legacy flat ShapeGeometry mountain layers. They were stale overlays
+  // that conflicted with the biome-specific terrain scenes.
   createStars();
   initAmbientParticles(scene);
+  createDreamTrigger();
 
   // NOTE: Lights removed — all materials are MeshBasicMaterial (unlit)
   // so lights have zero visual effect but cost GPU overhead.
   // If PBR materials are added later, re-add lights here.
 }
@@ -809,10 +1094,15 @@ function clearBiomeScene() {
     }
   });
   biomeSceneGroup = null;
   biomeSceneBiome = null;
   biomeTerrainMaterials = [];  // Clear terrain flash references
+
+  synthVisualRefs.terrainUniforms = null;
+  synthVisualRefs.sunOuterGlowMat = null;
+  synthVisualRefs.sunGlowMat = null;
+  synthVisualRefs.sunCoreMat = null;
 }
 
 function disposeObject3D(obj) {
   if (!obj) return;
   // Guard: only traverse if obj is a THREE.Object3D (proxy objects from InstancedMesh pools don't have .traverse)
@@ -1185,15 +1475,21 @@ function applyThemeForLevel(level) {
     floorMaterial.__fadeBase = floorMaterial.opacity;
   }
 
   const mountainScale = theme.mountainScale !== undefined ? theme.mountainScale : 1;
   mountainLines.forEach((layer) => {
+    if (layer.fillMesh) {
+      layer.fillMesh.visible = !hideBaseEnv;
+    }
     if (layer.fillMesh && layer.fillMesh.material) {
       layer.fillMesh.material.color.setHex(theme.mountainFill);
       layer.fillMesh.material.__fadeBase = 1;
       layer.fillMesh.scale.set(1, mountainScale, 1);
     }
+    if (layer.line) {
+      layer.line.visible = !hideBaseEnv;
+    }
     if (layer.line && layer.line.material) {
       layer.line.material.color.setHex(theme.mountainWire);
       layer.line.material.opacity = theme.mountainWireOpacity;
       layer.line.material.__fadeBase = theme.mountainWireOpacity;
       layer.line.material.transparent = true;
@@ -1276,10 +1572,11 @@ function hideBaseEnvironment() {
   if (horizonInnerRingRef) horizonInnerRingRef.visible = false;
   if (sunMeshRef) sunMeshRef.visible = false;
   if (sunGlowRef) sunGlowRef.visible = false;
   if (starsRef) starsRef.visible = false;
   if (auroraRef) auroraRef.visible = false;
+  if (vhsRetroShellRef) vhsRetroShellRef.visible = false;
   if (floorMaterial) floorMaterial.opacity = 0;
   if (biomePropsGroup) biomePropsGroup.visible = false;
   if (biomeSceneGroup) biomeSceneGroup.visible = false;
 }
 
@@ -1290,10 +1587,11 @@ function restoreBaseEnvironment() {
   if (horizonInnerRingRef) horizonInnerRingRef.visible = dreamOriginalEnv.horizonInnerVisible;
   if (sunMeshRef) sunMeshRef.visible = dreamOriginalEnv.sunVisible;
   if (sunGlowRef) sunGlowRef.visible = dreamOriginalEnv.sunGlowVisible;
   if (starsRef) starsRef.visible = dreamOriginalEnv.starsVisible;
   if (auroraRef) auroraRef.visible = dreamOriginalEnv.auroraVisible;
+  if (vhsRetroShellRef) vhsRetroShellRef.visible = dreamOriginalEnv.vhsRetroVisible !== false;
   if (floorMaterial && typeof dreamOriginalEnv.floorOpacity === 'number') {
     floorMaterial.opacity = dreamOriginalEnv.floorOpacity;
   }
   if (biomePropsGroup) biomePropsGroup.visible = dreamOriginalEnv.biomePropsVisible;
   if (biomeSceneGroup) biomeSceneGroup.visible = dreamOriginalEnv.biomeSceneVisible;
@@ -1309,10 +1607,11 @@ function enterDreamWorldScene() {
     horizonInnerVisible: horizonInnerRingRef ? horizonInnerRingRef.visible : true,
     sunVisible: sunMeshRef ? sunMeshRef.visible : true,
     sunGlowVisible: sunGlowRef ? sunGlowRef.visible : true,
     starsVisible: starsRef ? starsRef.visible : true,
     auroraVisible: auroraRef ? auroraRef.visible : false,
+    vhsRetroVisible: vhsRetroShellRef ? vhsRetroShellRef.visible : true,
     floorOpacity: floorMaterial ? floorMaterial.opacity : 1,
     biomePropsVisible: biomePropsGroup ? biomePropsGroup.visible : true,
     biomeSceneVisible: biomeSceneGroup ? biomeSceneGroup.visible : true,
   };
 
@@ -1331,11 +1630,11 @@ function enterDreamWorldScene() {
 
   // Only modify camera position in desktop mode (in VR, WebXR controls camera)
   if (!renderer.xr.isPresenting) {
     camera.position.copy(getDreamSpawnPosition());
   }
-  if (dreamTriggerMesh) dreamTriggerMesh.visible = false;
+  refreshDreamTriggerVisibility();
 }
 
 function exitDreamWorldScene() {
   if (!game.inDreamWorld) return;
   game.inDreamWorld = false;
@@ -1347,11 +1646,11 @@ function exitDreamWorldScene() {
   restoreBaseEnvironment();
   // Only modify camera position in desktop mode (in VR, WebXR controls camera)
   if (!renderer.xr.isPresenting) {
     camera.position.copy(dreamReturnPosition);
   }
-  if (dreamTriggerMesh) dreamTriggerMesh.visible = true;
+  refreshDreamTriggerVisibility();
 }
 
 function startDreamFragmentTrail() {
   if (!camera) return;
   if (dreamTrail && dreamTrail.group) {
@@ -1404,10 +1703,138 @@ function startEnvironmentFade(direction, duration, onComplete) {
     timer: duration,
     onComplete,
   };
 }
 
+function createDreamTrigger() {
+  if (!scene || dreamTriggerMesh) return;
+
+  const triggerGroup = new THREE.Group();
+  triggerGroup.name = 'dream-secret-trigger';
+
+  const core = new THREE.Mesh(
+    new THREE.IcosahedronGeometry(0.35, 1),
+    new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.9, depthWrite: false })
+  );
+  core.name = 'dream-trigger-core';
+  triggerGroup.add(core);
+
+  const glow = new THREE.Mesh(
+    new THREE.SphereGeometry(0.7, 12, 12),
+    new THREE.MeshBasicMaterial({
+      color: 0xcc88ff,
+      transparent: true,
+      opacity: 0.3,
+      blending: THREE.AdditiveBlending,
+      depthWrite: false,
+      side: THREE.DoubleSide,
+    })
+  );
+  glow.name = 'dream-trigger-glow';
+  triggerGroup.add(glow);
+
+  triggerGroup.userData = {
+    radius: 0.85,
+    pulseBaseScale: 1,
+    glow,
+    core,
+    placedForRun: false,
+  };
+
+  scene.add(triggerGroup);
+  dreamTriggerMesh = triggerGroup;
+  placeDreamTriggerBehindPlayer(true);
+  refreshDreamTriggerVisibility();
+}
+
+function placeDreamTriggerBehindPlayer(force = false) {
+  if (!dreamTriggerMesh || !camera) return;
+  if (dreamTriggerMesh.userData.placedForRun && !force) return;
+
+  const playerPos = getAdjustedCameraPosition();
+  const facing = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
+  facing.y = 0;
+  if (facing.lengthSq() < 0.0001) facing.set(0, 0, -1);
+  facing.normalize();
+
+  const behind = facing.clone().multiplyScalar(-8.0);
+  dreamTriggerMesh.position.set(
+    playerPos.x + behind.x,
+    Math.max(1.2, playerPos.y - 0.05),
+    playerPos.z + behind.z,
+  );
+  dreamTriggerMesh.lookAt(playerPos.x, dreamTriggerMesh.position.y, playerPos.z);
+  dreamTriggerMesh.userData.placedForRun = true;
+}
+
+function refreshDreamTriggerVisibility() {
+  if (!dreamTriggerMesh) return;
+  dreamTriggerMesh.visible = !game.inDreamWorld && !game.dreamCompleted;
+}
+
+function didProjectileHitDreamTrigger(previousPos, currentPos) {
+  if (!dreamTriggerMesh?.visible) return false;
+
+  const radius = dreamTriggerMesh.userData?.radius || 0.85;
+  const radiusSq = radius * radius;
+  const center = dreamTriggerMesh.position;
+
+  // Segment-vs-sphere test so fast projectiles cannot tunnel through the trigger.
+  _dreamSegment.subVectors(currentPos, previousPos);
+  const segmentLenSq = _dreamSegment.lengthSq();
+
+  if (segmentLenSq < 1e-6) {
+    return previousPos.distanceToSquared(center) <= radiusSq;
+  }
+
+  _dreamToCenter.subVectors(center, previousPos);
+  const t = THREE.MathUtils.clamp(_dreamToCenter.dot(_dreamSegment) / segmentLenSq, 0, 1);
+  _dreamClosestPoint.copy(previousPos).addScaledVector(_dreamSegment, t);
+  return _dreamClosestPoint.distanceToSquared(center) <= radiusSq;
+}
+
+function triggerDreamWorldFromSecret() {
+  if (game.inDreamWorld || dreamTransition) return;
+
+  dreamTransition = { state: 'entering' };
+  dreamReturnPosition.copy(getAdjustedCameraPosition());
+
+  // Fade through black so the secret transfer feels intentional in VR.
+  startEnvironmentFade('out', 0.45, () => {
+    enterDreamWorldScene();
+    refreshDreamTriggerVisibility();
+    startEnvironmentFade('in', 0.45, () => {
+      dreamTransition = null;
+    });
+  });
+}
+
+function completeDreamWorldRun() {
+  if (!game.dreamCompleted) {
+    game.dreamCompleted = true;
+    addUpgrade('dream_fragment', 'left');
+    addUpgrade('dream_fragment', 'right');
+    saveDreamState();
+    showFloatingMessage('DREAM FRAGMENT ACQUIRED', { color: '#cc88ff', duration: 3000 });
+  }
+
+  exitDreamWorldScene();
+  refreshDreamTriggerVisibility();
+}
+
+function updateDreamTriggerVisual(now) {
+  if (!dreamTriggerMesh?.visible) return;
+
+  const pulse = 1 + Math.sin(now * 0.0022) * 0.08;
+  dreamTriggerMesh.scale.setScalar(pulse);
+
+  const glow = dreamTriggerMesh.userData?.glow;
+  if (glow?.material) {
+    glow.material.opacity = 0.22 + (Math.sin(now * 0.0031) * 0.08 + 0.08);
+  }
+}
+
 function createSun() {
   // TODO: Replace canvas-generated sun with a hand-crafted PNG texture for best quality.
   // To swap: load a transparent PNG with `new THREE.TextureLoader().load('sun.png', tex => { ... })`
   // and apply it to the sunMat below. The PNG should be a circle with horizontal cutout bands.
 
@@ -1659,10 +2086,144 @@ function createAtmosphere() {
   scene.add(cylinder);
   atmosphereRef = cylinder;
   registerFadeMaterial(atmosphereRef.material);
 }
 
+function createVHSScanlineTexture() {
+  const canvas = document.createElement('canvas');
+  canvas.width = 128;
+  canvas.height = 256;
+  const ctx = canvas.getContext('2d');
+
+  // Transparent base keeps the effect subtle in VR.
+  ctx.clearRect(0, 0, canvas.width, canvas.height);
+
+  for (let y = 0; y < canvas.height; y += 2) {
+    const alpha = 0.06 + Math.random() * 0.045;
+    ctx.fillStyle = `rgba(210, 230, 255, ${alpha.toFixed(3)})`;
+    ctx.fillRect(0, y, canvas.width, 1);
+  }
+
+  // Add sparse tape-noise streaks for a light VHS feel.
+  for (let i = 0; i < 22; i++) {
+    const y = Math.floor(Math.random() * canvas.height);
+    const h = 1 + Math.floor(Math.random() * 2);
+    const alpha = 0.03 + Math.random() * 0.03;
+    ctx.fillStyle = `rgba(255, 200, 235, ${alpha.toFixed(3)})`;
+    ctx.fillRect(0, y, canvas.width, h);
+  }
+
+  const texture = new THREE.CanvasTexture(canvas);
+  texture.wrapS = THREE.RepeatWrapping;
+  texture.wrapT = THREE.RepeatWrapping;
+  texture.repeat.set(1, 2);
+  return texture;
+}
+
+function createVHSGlowTexture() {
+  const canvas = document.createElement('canvas');
+  canvas.width = 16;
+  canvas.height = 256;
+  const ctx = canvas.getContext('2d');
+
+  const grad = ctx.createLinearGradient(0, 256, 0, 0);
+  grad.addColorStop(0.0, 'rgba(255, 120, 165, 0.18)');
+  grad.addColorStop(0.35, 'rgba(180, 130, 255, 0.10)');
+  grad.addColorStop(0.7, 'rgba(120, 180, 255, 0.04)');
+  grad.addColorStop(1.0, 'rgba(120, 180, 255, 0.0)');
+  ctx.fillStyle = grad;
+  ctx.fillRect(0, 0, canvas.width, canvas.height);
+
+  const texture = new THREE.CanvasTexture(canvas);
+  texture.wrapS = THREE.RepeatWrapping;
+  texture.wrapT = THREE.ClampToEdgeWrapping;
+  return texture;
+}
+
+function createVHSRetroShell() {
+  if (!scene || vhsRetroShellRef) return;
+
+  // VR-safe VHS effect: world-space cylinders, not a full-screen post process.
+  // This avoids eye strain from head-locked overlays and keeps stereo depth intact.
+  const shellGroup = new THREE.Group();
+  shellGroup.name = 'vhsRetroShellRef';
+
+  const radius = 86;
+  const height = 46;
+  const segments = 40;
+
+  const scanlineGeo = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true);
+  const scanlineTex = createVHSScanlineTexture();
+  const scanlineMat = new THREE.MeshBasicMaterial({
+    map: scanlineTex,
+    color: 0x99b8ff,
+    transparent: true,
+    opacity: 0.10,
+    side: THREE.BackSide,
+    depthWrite: false,
+    blending: THREE.AdditiveBlending,
+  });
+  const scanlineShell = new THREE.Mesh(scanlineGeo, scanlineMat);
+  scanlineShell.name = 'vhs-scanline-shell';
+  scanlineShell.renderOrder = -14;
+  shellGroup.add(scanlineShell);
+
+  const glowGeo = new THREE.CylinderGeometry(radius - 1.5, radius - 1.5, height, segments, 1, true);
+  const glowTex = createVHSGlowTexture();
+  const glowMat = new THREE.MeshBasicMaterial({
+    map: glowTex,
+    color: 0xff7aa6,
+    transparent: true,
+    opacity: 0.06,
+    side: THREE.BackSide,
+    depthWrite: false,
+    blending: THREE.AdditiveBlending,
+  });
+  const glowShell = new THREE.Mesh(glowGeo, glowMat);
+  glowShell.name = 'vhs-glow-shell';
+  glowShell.renderOrder = -15;
+  shellGroup.add(glowShell);
+
+  shellGroup.position.set(0, (height * 0.5) - 1 + SCENE_Y_OFFSET, 0);
+  shellGroup.frustumCulled = false;
+  scene.add(shellGroup);
+
+  vhsRetroShellRef = shellGroup;
+  vhsRetroScanlineMatRef = scanlineMat;
+  vhsRetroGlowMatRef = glowMat;
+  vhsRetroScanlineTexRef = scanlineTex;
+
+  registerFadeMaterial(scanlineMat);
+  registerFadeMaterial(glowMat);
+}
+
+function updateVHSRetroShell(now) {
+  if (!vhsRetroShellRef || !camera) return;
+
+  camera.getWorldPosition(_vhsPlayerPos);
+  vhsRetroShellRef.position.x = _vhsPlayerPos.x;
+  vhsRetroShellRef.position.z = _vhsPlayerPos.z;
+
+  if (vhsRetroScanlineTexRef) {
+    vhsRetroScanlineTexRef.offset.y = (now * 0.000035) % 1;
+    vhsRetroScanlineTexRef.offset.x = Math.sin(now * 0.0001) * 0.01;
+  }
+
+  const fadeScale = 1 - environmentFade;
+  if (vhsRetroScanlineMatRef) {
+    const base = vhsRetroScanlineMatRef.__fadeBase ?? 0.10;
+    const flicker = 0.95 + Math.sin(now * 0.0018) * 0.05;
+    vhsRetroScanlineMatRef.opacity = base * fadeScale * flicker;
+  }
+
+  if (vhsRetroGlowMatRef) {
+    const base = vhsRetroGlowMatRef.__fadeBase ?? 0.06;
+    const pulse = 0.9 + Math.sin(now * 0.0011) * 0.1;
+    vhsRetroGlowMatRef.opacity = base * fadeScale * pulse;
+  }
+}
+
 function createMountains() {
   const layers = [
     { z: -85, color: 0x0d001a, peaks: generatePeaks(12, 6, 20), layerIndex: 0 },
     { z: -75, color: MTN_DARK, peaks: generatePeaks(10, 4, 14), layerIndex: 1 },
   ];
@@ -1825,11 +2386,14 @@ function rebuildStars(theme) {
   starsRef = stars;
   registerFadeMaterial(starsRef.material);
 }
 
 // ============================================================
-//  CONTROLLERS
+// CONTROLLER SETUP & INPUT HANDLING
+// VR controllers, trigger press/release, squeeze, desktop click
+// HOT PATH: onTriggerPress called every frame when trigger held
+// COUPLING: Directly calls fireMainWeapon, fireAltWeapon
 // ============================================================
 function setupControllers() {
   for (let i = 0; i < 2; i++) {
     const controller = renderer.xr.getController(i);
 
@@ -2557,11 +3121,15 @@ function onTriggerRelease(index) {
     stopLightningSound();
   }
 }
 
 // ============================================================
-//  ALT WEAPON HANDLERS (squeeze trigger)
+// ALT WEAPON SYSTEMS
+// Shield, laser mines, decoys, black holes, tethers, nanites,
+// phase dash, reflector drones, stasis, plasma orbs, grenades,
+// proximity mines, attack drones, EMP, teleport
+// COUPLING: Updates scene, activeShields/activeLaserMines/etc arrays
 // ============================================================
 function onSqueezePress(controller, index) {
   const st = game.state;
   
   // Only fire ALT weapons during gameplay
@@ -3295,10 +3863,13 @@ function fireBlackHole(origin, direction, hand, altWeapon) {
   activeMines.push(mineData);
 
   playShoothSound();
 }
 
+// Pooled temp vector for black hole pull (per-enemy per-frame)
+const _bhPullToCenter = new THREE.Vector3();
+
 function updateMinesAndBlackHoles(dt, now, playerPos) {
   // Update mines (projectiles that haven't triggered yet)
   for (let i = activeMines.length - 1; i >= 0; i--) {
     const mine = activeMines[i];
     const age = now - mine.createdAt;
@@ -3362,12 +3933,12 @@ function updateMinesAndBlackHoles(dt, now, playerPos) {
       if (dist < bh.pullRadius) {
         affectedEnemies.push({ index: idx, enemy: e, dist });
 
         // Pull strength increases toward center, fades at end
         const pullStrength = (1 - dist / bh.pullRadius) * (1 - progress * 0.5) * 8;
-        const toCenter = new THREE.Vector3().subVectors(bh.position, e.mesh.position).normalize();
-        e.mesh.position.addScaledVector(toCenter, pullStrength * dt);
+        _bhPullToCenter.subVectors(bh.position, e.mesh.position).normalize();
+        e.mesh.position.addScaledVector(_bhPullToCenter, pullStrength * dt);
 
         // Record that this enemy was affected (for stun)
         if (!bh.affectedEnemies.has(idx)) {
           bh.affectedEnemies.add(idx);
         }
@@ -5719,10 +6290,16 @@ function beginGameplayFromReady() {
   game.state = State.PLAYING;
   showHUD();
 
   // Stagger setup
   game.spawnTimer = 1.0;
+
+  if (dreamTriggerMesh) {
+    dreamTriggerMesh.userData.placedForRun = false;
+    placeDreamTriggerBehindPlayer(true);
+    refreshDreamTriggerVisibility();
+  }
 }
 
 function startReadyCountdown() {
   if (readyCountdownActive) return;
   readyCountdownActive = true;
@@ -5776,10 +6353,15 @@ function handleDebugMenuTrigger(controller) {
     return;
   }
   // Toggle clicks are handled in getDebugMenuHit with visual updates
 }
 
+// ============================================================
+// GAME FLOW & STATE MANAGEMENT
+// startGame, completeLevel, togglePause, endGame, debug jump
+// COUPLING: Transitions game.state, calls HUD show/hide, audio
+// ============================================================
 function startGame() {
   console.log('[game] Starting new game');
   hideTitle();
   
   // Hide HTML overlays for desktop mode
@@ -5801,10 +6383,17 @@ function startGame() {
     console.log('[seed] No seed set, using random seed');
     resetGame();
   }
 
   resetAllSlowMoState();
+  dreamTransition = null;
+
+  if (dreamTriggerMesh) {
+    dreamTriggerMesh.userData.placedForRun = false;
+    placeDreamTriggerBehindPlayer(true);
+    refreshDreamTriggerVisibility();
+  }
   
   game.state = State.READY_SCREEN;
   game.level = 1;
   game._levelConfig = getLevelConfig();
   applyThemeForLevel(1);
@@ -5855,170 +6444,14 @@ function resetAllSlowMoState() {
     window._timeScale = 1.0;
     window._wasCloseEnemy = false;
   }
 }
 
-function initBossDeathOverlays() {
-  const geo = new THREE.PlaneGeometry(6, 6);
-  bossDeathWhiteOverlay = new THREE.Mesh(
-    geo,
-    new THREE.MeshBasicMaterial({
-      color: 0xffffff,
-      transparent: true,
-      opacity: 0,
-      depthTest: false,
-      depthWrite: false,
-      side: THREE.DoubleSide,
-    }),
-  );
-  bossDeathWhiteOverlay.renderOrder = 1002;
-  bossDeathWhiteOverlay.visible = false;
-  bossDeathWhiteOverlay.position.set(0, 0, -0.26);
-  camera.add(bossDeathWhiteOverlay);
-
-  bossDeathBlackOverlay = new THREE.Mesh(
-    geo,
-    new THREE.MeshBasicMaterial({
-      color: 0x000000,
-      transparent: true,
-      opacity: 0,
-      depthTest: false,
-      depthWrite: false,
-      side: THREE.DoubleSide,
-    }),
-  );
-  bossDeathBlackOverlay.renderOrder = 1003;
-  bossDeathBlackOverlay.visible = false;
-  bossDeathBlackOverlay.position.set(0, 0, -0.25);
-  camera.add(bossDeathBlackOverlay);
-}
-
-function startBossDeathCinematic(boss) {
-  if (!boss || bossDeathCinematic.active) return;
-
-  console.log('[boss-cinematic] Starting boss death cinematic');
-  
-  resetAllSlowMoState();
-  bossDeathCinematic.active = true;
-  bossDeathCinematic.timer = 0;
-  bossDeathCinematic.explosionTimer = 0;
-  bossDeathCinematic.bossPos.copy(boss.mesh.position);
-  bossDeathCinematic.wasFinalBoss = game.level >= 20;
-  bossDeathFreezeTimer = BOSS_DEATH_FREEZE;
-
-  // Ensure overlays exist and are properly initialized
-  if (bossDeathWhiteOverlay) {
-    bossDeathWhiteOverlay.material.opacity = 0;
-    bossDeathWhiteOverlay.visible = true;  // Set visible so opacity changes take effect
-  } else {
-    console.warn('[boss-cinematic] White overlay not initialized!');
-  }
-  if (bossDeathBlackOverlay) {
-    bossDeathBlackOverlay.material.opacity = 0;
-    bossDeathBlackOverlay.visible = true;  // Set visible so opacity changes take effect
-  } else {
-    console.warn('[boss-cinematic] Black overlay not initialized!');
-  }
-
-  spawnBossDebris(boss);
-  if (typeof window !== 'undefined' && window.playBossDeath) {
-    window.playBossDeath();
-  }
-  stopMusic();
-  playExplosionSound();
-  hideBossHealthBar();
-  clearBoss();
-  clearAllTelegraphs();
-
-  game.state = State.BOSS_DEATH_CINEMATIC;
-  console.log('[boss-cinematic] State set to BOSS_DEATH_CINEMATIC');
-}
-
-function finishBossDeathCinematic() {
-  bossDeathCinematic.active = false;
-  bossDeathCinematic.timer = 0;
-  bossDeathCinematic.explosionTimer = 0;
-
-  if (bossDeathWhiteOverlay) {
-    bossDeathWhiteOverlay.material.opacity = 0;
-    bossDeathWhiteOverlay.visible = false;
-  }
-  if (bossDeathBlackOverlay) {
-    bossDeathBlackOverlay.material.opacity = 0;
-    bossDeathBlackOverlay.visible = false;
-  }
-
-  if (bossDeathCinematic.wasFinalBoss) {
-    bossDeathCinematic.wasFinalBoss = false;
-    endGame(true);
-    return;
-  }
-
-  bossDeathCinematic.wasFinalBoss = false;
-  completeLevel();
-}
-
-function updateBossDeathCinematic(rawDt) {
-  if (!bossDeathCinematic.active) return;
-
-  bossDeathCinematic.timer += rawDt;
-  const t = bossDeathCinematic.timer;
-  const explosionStart = BOSS_DEATH_FREEZE;
-  const explosionEnd = explosionStart + BOSS_DEATH_EXPLOSION_TIME;
-  const whiteStart = explosionEnd;
-  const whiteEnd = whiteStart + BOSS_DEATH_WHITE_FADE;
-  const blackEnd = whiteEnd + BOSS_DEATH_BLACK_FADE;
-
-  if (t >= explosionStart && t <= explosionEnd) {
-    bossDeathCinematic.explosionTimer -= rawDt;
-    if (bossDeathCinematic.explosionTimer <= 0) {
-      const offset = new THREE.Vector3(
-        (Math.random() - 0.5) * 1.8,
-        (Math.random() - 0.5) * 1.2,
-        (Math.random() - 0.5) * 1.8,
-      );
-      const explosionPos = bossDeathCinematic.bossPos.clone().add(offset);
-      spawnExplosionVisual(explosionPos, 0.7 + Math.random() * 0.8);
-      playExplosionSound();  // Play explosion sound for each boss death explosion
-      bossDeathCinematic.explosionTimer = BOSS_DEATH_EXPLOSION_INTERVAL;
-    }
-  }
-
-  let whiteOpacity = 0;
-  let blackOpacity = 0;
-  let envFade = 0;  // Environment fade synced with black overlay
-  if (t >= whiteStart && t < whiteEnd) {
-    whiteOpacity = (t - whiteStart) / BOSS_DEATH_WHITE_FADE;
-  } else if (t >= whiteEnd && t < blackEnd) {
-    const progress = (t - whiteEnd) / BOSS_DEATH_BLACK_FADE;
-    whiteOpacity = 1 - progress;
-    blackOpacity = progress;
-    envFade = progress;  // Fade environment with black overlay
-  } else if (t >= blackEnd) {
-    blackOpacity = 1;
-    envFade = 1;  // Full fade
-  }
-
-  // Apply environment fade - ALL scene elements fade to black
-  applyEnvironmentFade(envFade);
-
-  if (bossDeathWhiteOverlay) {
-    bossDeathWhiteOverlay.visible = whiteOpacity > 0;
-    bossDeathWhiteOverlay.material.opacity = Math.min(1, Math.max(0, whiteOpacity));
-  }
-  if (bossDeathBlackOverlay) {
-    bossDeathBlackOverlay.visible = blackOpacity > 0;
-    bossDeathBlackOverlay.material.opacity = Math.min(1, Math.max(0, blackOpacity));
-  }
-
-  if (t >= blackEnd) {
-    finishBossDeathCinematic();
-  }
-}
+// Boss death cinematic functions are now in boss-death-cinematic.js (imported at top)
 
 function completeLevel() {
-  if (bossDeathCinematic.active) return;
+  if (isBossDeathCinematicActive()) return;
 
   console.log(`[game] Level ${game.level} complete`);
 
   // Hide kills remaining alert if showing
   hideKillsAlert();
@@ -6306,13 +6739,18 @@ function updatePauseCountdown(now) {
   if (remaining <= 0) {
     pauseCountdownActive = false;
     pauseCountdown = 0;
     hidePauseCountdown();
     game.state = State.PLAYING;
-    // Re-request pointer lock when resuming
+    // Re-request pointer lock when resuming (suppress error if user just exited)
     if (!renderer.xr.isPresenting && isDesktopEnabled()) {
-      document.body.requestPointerLock?.();
+      try {
+        document.body.requestPointerLock?.();
+      } catch (e) {
+        // SecurityError is expected if user just exited pointer lock via ESC
+        console.debug('[pause] Pointer lock request deferred (user exit)');
+      }
     }
     return;
   }
 
   pauseCountdown = remaining;
@@ -6353,20 +6791,29 @@ function endGame(victory) {
     playMusic('gameOver', false);
   }
 }
 
 // ============================================================
-//  SHOOTING & COMBAT
+// SHOOTING & COMBAT
+// Projectile pool, weapon firing, hit detection, explosions
+// HOT PATH: updateProjectiles() called every frame
 // ============================================================
 
 // Screen shake trigger function
 function triggerScreenShake(intensity, duration) {
   screenShakeIntensity = intensity;
   screenShakeTime = performance.now() + duration;
   console.log(`[Shake] Intensity: ${intensity}, Duration: ${duration}ms`);
 }
 
+// ============================================================
+// PROJECTILE POOL MANAGEMENT
+// InstancedMesh pools for laser, buckshot, seeker, plasma_carbine
+// HOT PATH: getPooledProjectile, returnProjectileToPool, commit()
+// COUPLING: instancedProjectiles, projectileInstanceData arrays
+// ============================================================
+
 // PERFORMANCE: Initialize InstancedMesh projectile pools
 // One InstancedMesh per projectile type = minimal draw calls.
 // Each instance is positioned via setMatrixAt(), colored via setColorAt().
 function initProjectilePool() {
   // Guard against re-init on game restart — pools persist across games
@@ -6375,10 +6822,11 @@ function initProjectilePool() {
   // ── Laser bolts (most common, cyan & pink) ──
   // Use merged bolt+glow geometry for a single draw call per instance
   const laserGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6);
   laserGeo.rotateX(Math.PI / 2); // Rotate to align with -Z direction
   const laserMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85 });
+  registerPlayerProjectileMaterial(laserMat);
   const laserIM = new THREE.InstancedMesh(laserGeo, laserMat, 120);
   laserIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   laserIM.count = 0;  // Start with 0 visible instances
   laserIM.frustumCulled = false;  // We manage visibility manually
   laserIM.layers.enable(BLOOM_LAYER);  // Selective bloom: laser bolts glow
@@ -6386,10 +6834,11 @@ function initProjectilePool() {
   instancedProjectiles['laser'] = { mesh: laserIM, maxCount: 120, freeIndices: new Set() };
 
   // ── Buckshot pellets ──
   const buckGeo = new THREE.SphereGeometry(0.025, 6, 6);
   const buckMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
+  registerPlayerProjectileMaterial(buckMat);
   const buckIM = new THREE.InstancedMesh(buckGeo, buckMat, 20);
   buckIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   buckIM.count = 0;
   buckIM.frustumCulled = false;
   scene.add(buckIM);
@@ -6397,10 +6846,11 @@ function initProjectilePool() {
 
   // ── Seeker burst bolts (homing) ──
   // Head sphere for seekers
   const seekerGeo = new THREE.SphereGeometry(0.03, 8, 8);
   const seekerMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
+  registerPlayerProjectileMaterial(seekerMat);
   const seekerIM = new THREE.InstancedMesh(seekerGeo, seekerMat, 28);
   seekerIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   seekerIM.count = 0;
   seekerIM.frustumCulled = false;
   scene.add(seekerIM);
@@ -6408,10 +6858,11 @@ function initProjectilePool() {
 
   // ── Plasma carbine darts ──
   const plasmaGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.5, 6);
   plasmaGeo.rotateX(Math.PI / 2); // Rotate to align with -Z direction
   const plasmaMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
+  registerPlayerProjectileMaterial(plasmaMat);
   const plasmaIM = new THREE.InstancedMesh(plasmaGeo, plasmaMat, 30);
   plasmaIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   plasmaIM.count = 0;
   plasmaIM.frustumCulled = false;
   scene.add(plasmaIM);
@@ -6669,11 +7120,14 @@ function updateHostileProjectileVisual(proj, now) {
     });
   }
 }
 
 // ============================================================
-//  PHYSICS DEATH SYSTEM - Voxel Pool
+// VOXEL PHYSICS DEATH SYSTEM
+// Pooled voxels for enemy death explosions
+// HOT PATH: updateVoxelPhysics() called every frame
+// COUPLING: voxelPool, activeVoxels arrays, scene.add/remove
 // ============================================================
 
 /**
  * Initialize voxel pool for physics-based death explosions
  */
@@ -6901,11 +7355,14 @@ function updateVoxelPhysics(dt, now) {
     voxel.rotation.y += dt * 3;
   }
 }
 
 // ============================================================
-//  MAIN WEAPON FIRING
+// MAIN WEAPON FIRING
+// fireMainWeapon, lightning beams, charge shots, plasma carbine
+// HOT PATH: Called every frame when trigger held during PLAYING
+// COUPLING: weaponCooldowns, chargeShotStartTime, projectiles[]
 // ============================================================
 function fireMainWeapon(controller, index) {
   const now = performance.now();
   const hand = getHandForController(index);
   const mainWeaponId = game.mainWeapon[hand];
@@ -6929,13 +7386,19 @@ function fireMainWeapon(controller, index) {
   const quat = new THREE.Quaternion();
   controller.getWorldPosition(origin);
   controller.getWorldQuaternion(quat);
   const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
 
+  // Debug logging for projectile investigation
+  if (window.DEBUG_PROJECTILES) {
+    const handLabel = index === 0 ? 'LEFT' : 'RIGHT';
+    console.log(`[PROJECTILE DEBUG] hand=${handLabel} weapon=${mainWeaponId} quat=(${quat.x.toFixed(3)}, ${quat.y.toFixed(3)}, ${quat.z.toFixed(3)}, ${quat.w.toFixed(3)}) dir=(${direction.x.toFixed(3)}, ${direction.y.toFixed(3)}, ${direction.z.toFixed(3)})`);
+  }
+
   // Fire projectile(s)
   const count = stats.projectileCount;
-  const shotId = startAccuracyShot(count);
+  const shotId = startAccuracyShot(count, hand);
   const isBuckshot = stats.spreadAngle > 0 && !stats.homing;
 
   // Calculate perpendicular offset axis for multi-shot
   const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
   const upAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
@@ -7110,10 +7573,14 @@ function updateLightningBeam(controller, index, stats, dt) {
     stopLightningSound();
     lightningTimers[index] = 0;
   }
 }
 
+// Pooled temp vectors for lightning bolt generation (per-segment)
+const _lightningDir = new THREE.Vector3();
+const _lightningPerp = new THREE.Vector3();
+
 // Create zigzag lightning bolt between two points
 function createLightningBolt(start, end) {
   const points = [start.clone()];
   const segments = 8;
   const zigzagAmount = 0.15;
@@ -7121,13 +7588,13 @@ function createLightningBolt(start, end) {
   for (let i = 1; i < segments; i++) {
     const t = i / segments;
     const mid = new THREE.Vector3().lerpVectors(start, end, t);
 
     // Random perpendicular offset
-    const dir = new THREE.Vector3().subVectors(end, start).normalize();
-    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
-    const offset = perp.multiplyScalar((Math.random() - 0.5) * zigzagAmount);
+    _lightningDir.subVectors(end, start).normalize();
+    _lightningPerp.set(-_lightningDir.z, 0, _lightningDir.x).normalize();
+    const offset = _lightningPerp.clone().multiplyScalar((Math.random() - 0.5) * zigzagAmount);
 
     mid.add(offset);
     points.push(mid);
   }
   points.push(end.clone());
@@ -7281,22 +7748,30 @@ function hideChargeVisuals(index) {
   if (chargeParticleSystems[index]) {
     chargeParticleSystems[index].visible = false;
   }
 }
 
+// Pooled temp vectors for pointToSegmentDist (hot path)
+const _ptsAb = new THREE.Vector3();
+const _ptsAp = new THREE.Vector3();
+const _ptsProj = new THREE.Vector3();
+
 /** Distance from point to line segment (a to b) */
 function pointToSegmentDist(p, a, b) {
-  const ab = new THREE.Vector3().subVectors(b, a);
-  const ap = new THREE.Vector3().subVectors(p, a);
-  const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.lengthSq()));
-  const proj = new THREE.Vector3().copy(a).addScaledVector(ab, t);
-  return p.distanceTo(proj);
+  _ptsAb.subVectors(b, a);
+  _ptsAp.subVectors(p, a);
+  const t = Math.max(0, Math.min(1, _ptsAp.dot(_ptsAb) / _ptsAb.lengthSq()));
+  _ptsProj.copy(a).addScaledVector(_ptsAb, t);
+  return p.distanceTo(_ptsProj);
 }
 
 const _chargeBeamA = new THREE.Vector3();
 const _chargeBeamB = new THREE.Vector3();
 const _playerForward = new THREE.Vector3();
+const _chargeBeamOrigin = new THREE.Vector3();
+const _chargeBeamQuat = new THREE.Quaternion();
+const _chargeBeamDir = new THREE.Vector3(0, 0, -1);
 
 function fireChargeBeam(controller, index, chargeTimeSec, stats) {
   if (chargeTimeSec < CHARGE_SHOT_MIN_FIRE) return; // minimum charge to fire
 
   // Use Mega Man style damage curve
@@ -7308,18 +7783,16 @@ function fireChargeBeam(controller, index, chargeTimeSec, stats) {
 
   // Beam width scales with progress (0.2 at min, 1.5 at max)
   const beamWidth = 0.2 + progress * 1.3;
   const range = 50;
 
-  const origin = new THREE.Vector3();
-  const quat = new THREE.Quaternion();
-  controller.getWorldPosition(origin);
-  controller.getWorldQuaternion(quat);
-  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
+  controller.getWorldPosition(_chargeBeamOrigin);
+  controller.getWorldQuaternion(_chargeBeamQuat);
+  _chargeBeamDir.set(0, 0, -1).applyQuaternion(_chargeBeamQuat);
 
-  _chargeBeamA.copy(origin);
-  _chargeBeamB.copy(origin).addScaledVector(direction, range);
+  _chargeBeamA.copy(_chargeBeamOrigin);
+  _chargeBeamB.copy(_chargeBeamOrigin).addScaledVector(_chargeBeamDir, range);
 
   const controllerIndex = index;
   const hand = getHandForController(index);
 
   const chargeStats = { ...stats, damage: Math.round(damage) };
@@ -7417,12 +7890,12 @@ function fireChargeBeam(controller, index, chargeTimeSec, stats) {
     side: THREE.DoubleSide,
     depthWrite: false,
     blending: THREE.AdditiveBlending,  // Glow effect
   });
   const beamMesh = new THREE.Mesh(beamGeo, beamMat);
-  beamMesh.position.copy(origin).addScaledVector(direction, range * 0.5);
-  beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
+  beamMesh.position.copy(_chargeBeamOrigin).addScaledVector(_chargeBeamDir, range * 0.5);
+  beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _chargeBeamDir);
   beamMesh.userData.createdAt = performance.now();
   beamMesh.userData.duration = 200; // Longer duration for fade effect
   beamMesh.userData.isChargeBeam = true;
   beamMesh.userData.pulsePhase = 0; // For pulse animation
   beamMesh.userData.maxOpacity = 0.8;
@@ -7446,10 +7919,16 @@ function spawnProjectile(origin, direction, controllerIndex, stats, shotId, opti
   const BUCKSHOT_SPREAD_THRESHOLD = 0.087; // ~5 degrees
   const isBuckshot = (stats.spreadAngle || 0) > BUCKSHOT_SPREAD_THRESHOLD && !stats.homing;
   const isPlasmaCarbine = stats.mainWeaponId === 'plasma_carbine';
   const poolType = stats.homing ? 'seeker' : (isPlasmaCarbine ? 'plasma_carbine' : (isBuckshot ? 'buckshot' : 'laser'));
 
+  // Debug logging for projectile investigation
+  if (window.DEBUG_PROJECTILES) {
+    const handLabel = controllerIndex === 0 ? 'LEFT' : 'RIGHT';
+    console.log(`[PROJECTILE DEBUG SPAWN] hand=${handLabel} pool=${poolType} weapon=${stats.mainWeaponId || 'unknown'} dir=(${direction.x.toFixed(3)}, ${direction.y.toFixed(3)}, ${direction.z.toFixed(3)})`);
+  }
+
   // Big Boom: only one exploding shot per hand every 2.75s
   let isExploding = false;
   if (stats.aoeRadius > 0) {
     if (now - lastExplodingShotTime[controllerIndex] >= BIG_BOOM_COOLDOWN_MS) {
       isExploding = true;
@@ -7463,11 +7942,13 @@ function spawnProjectile(origin, direction, controllerIndex, stats, shotId, opti
   if (!mesh) {
     // Pool exhausted - recycle oldest active projectile to keep fire continuous
     const recycled = projectiles.shift();
     if (recycled) {
       returnProjectileToPool(recycled);
-      mesh = recycled;
+      // BUG FIX: Don't reuse the recycled proxy - get a fresh one from the pool
+      // The recycled proxy's instance index may have been invalidated by count adjustment
+      mesh = getPooledProjectile(poolType, color);
     }
   }
 
   if (!mesh) {
     // No available projectile to recycle
@@ -8081,10 +8562,25 @@ function markProjectileHit(proj) {
 function resolveProjectileAccuracy(proj) {
   if (!proj?.userData?.shotId) return;
   resolveAccuracyPellet(proj.userData.shotId);
 }
 
+// Pooled temp vectors for projectile hot paths (per-frame allocations)
+const _projHomingDesired = new THREE.Vector3();
+const _projHomingQuatDir = new THREE.Vector3(0, 0, -1);
+const _projHomingVelNorm = new THREE.Vector3();
+const _hostileProjDesired = new THREE.Vector3();
+const _hostileProjCurrent = new THREE.Vector3();
+const _hostileProjSide = new THREE.Vector3();
+
+// ============================================================
+// PROJECTILE UPDATE LOOP
+// Movement, homing, hostile projectiles, collision detection
+// HOT PATH: Called every frame from render()
+// COUPLING: projectiles[], instancedProjectiles, enemies spatial hash
+// RISK: Changes here affect hit detection, game feel, performance
+// ============================================================
 function updateProjectiles(dt) {
   const now = performance.now();
 
   for (let i = projectiles.length - 1; i >= 0; i--) {
     const proj = projectiles[i];
@@ -8108,22 +8604,21 @@ function updateProjectiles(dt) {
         }
 
         const slowFactor = getStasisSlowFactor(proj.position);
         const adjustedDt = dt * slowFactor;
         const playerPos = camera.position;
-        const prevPos = proj.position.clone();
 
         // Mini-swarm style steering and visual pop so hostile shots feel alive.
-        const desiredDir = new THREE.Vector3().subVectors(playerPos, proj.position).normalize();
-        const currentDir = proj.userData.direction.clone().normalize();
-        currentDir.lerp(desiredDir, Math.min(1, adjustedDt * 2.8));
-        proj.userData.direction.copy(currentDir.normalize());
+        _hostileProjDesired.subVectors(playerPos, proj.position).normalize();
+        _hostileProjCurrent.copy(proj.userData.direction).normalize();
+        _hostileProjCurrent.lerp(_hostileProjDesired, Math.min(1, adjustedDt * 2.8));
+        proj.userData.direction.copy(_hostileProjCurrent.normalize());
 
         const wigglePhase = (proj.userData.wigglePhase || Math.random() * Math.PI * 2) + adjustedDt * 8;
         proj.userData.wigglePhase = wigglePhase;
-        const side = new THREE.Vector3(-proj.userData.direction.z, 0, proj.userData.direction.x).normalize();
-        proj.position.addScaledVector(side, Math.sin(wigglePhase) * 0.015);
+        _hostileProjSide.set(-proj.userData.direction.z, 0, proj.userData.direction.x).normalize();
+        proj.position.addScaledVector(_hostileProjSide, Math.sin(wigglePhase) * 0.015);
         proj.position.addScaledVector(proj.userData.direction, proj.userData.speed * adjustedDt);
         updateHostileProjectileVisual(proj, now);
 
         const dist = proj.position.distanceTo(playerPos);
         if (dist < 1.0) {
@@ -8176,43 +8671,71 @@ function updateProjectiles(dt) {
         proj.userData.homingTarget = targetMesh || null;
       }
 
       const baseSpeed = proj.userData.baseSpeed || proj.userData.velocity.length();
       if (targetMesh) {
-        const desired = new THREE.Vector3()
-          .subVectors(targetMesh.position, proj.position)
-          .normalize()
-          .multiplyScalar(baseSpeed);
+        _projHomingDesired.subVectors(targetMesh.position, proj.position).normalize().multiplyScalar(baseSpeed);
         // Use high homing strength so seekers directly target enemies
         // instead of circling them at low turn rates
         const homingStrength = proj.userData.homingStrength || 15;
-        proj.userData.velocity.lerp(desired, Math.min(1, homingStrength * adjustedDt));
+        proj.userData.velocity.lerp(_projHomingDesired, Math.min(1, homingStrength * adjustedDt));
         if (proj.userData.velocity.lengthSq() > 0.0001) {
           proj.userData.velocity.setLength(baseSpeed);
         }
       } else if (proj.userData.velocity.lengthSq() > 0.0001) {
         proj.userData.velocity.setLength(baseSpeed);
       }
 
       if (proj.userData.velocity.lengthSq() > 0.0001) {
-        proj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), proj.userData.velocity.clone().normalize());
+        _projHomingQuatDir.set(0, 0, -1);
+        _projHomingVelNorm.copy(proj.userData.velocity).normalize();
+        proj.quaternion.setFromUnitVectors(_projHomingQuatDir, _projHomingVelNorm);
       }
       updateSeekerProjectileVisual(proj, adjustedDt);
     }
 
     // Move projectile (apply stasis slow effect)
     const moveDistance = proj.userData.velocity.length() * adjustedDt;
+    _dreamPrevProjectilePos.copy(proj.position);
     proj.position.addScaledVector(proj.userData.velocity, adjustedDt);
 
     // Commit position to InstancedMesh (sync GPU buffer)
     if (proj.commit) {
       proj.commit();
     }
 
     // Check if projectile passes through nanite swarm and gains nanite damage
     checkProjectileNaniteInteraction(proj);
 
+    // Secret dream trigger: shoot the hidden object behind spawn to enter dream mode.
+    // Use segment-vs-sphere test so high-speed shots still register.
+    if (proj.userData.stats && !game.inDreamWorld && didProjectileHitDreamTrigger(_dreamPrevProjectilePos, proj.position)) {
+      markProjectileHit(proj);
+      resolveProjectileAccuracy(proj);
+      if (proj.userData.isPooled) {
+        returnProjectileToPool(proj);
+      } else {
+        scene.remove(proj);
+      }
+      projectiles.splice(i, 1);
+      triggerDreamWorldFromSecret();
+      continue;
+    }
+
+    // Dream-world interactions (torches can be lit by shooting them).
+    if (proj.userData.stats && game.inDreamWorld && handleDreamProjectileHit(proj)) {
+      markProjectileHit(proj);
+      resolveProjectileAccuracy(proj);
+      if (proj.userData.isPooled) {
+        returnProjectileToPool(proj);
+      } else {
+        scene.remove(proj);
+      }
+      projectiles.splice(i, 1);
+      continue;
+    }
+
     // Check collision with plasma orbs (player can shoot orbs to detonate early)
     if (checkPlasmaOrbDetonation(proj)) {
       markProjectileHit(proj);
       resolveProjectileAccuracy(proj);
       if (proj.userData.isPooled) {
@@ -8467,11 +8990,14 @@ function selectUpgrade(controller) {
     selectUpgradeAndAdvance(result.upgrade, result.hand);
   }
 }
 
 // ============================================================
-//  ENEMY SPAWNING
+// ENEMY WAVE SPAWNING
+// spawnEnemyWave, fast enemy proximity alerts
+// Called every frame during PLAYING state
+// COUPLING: game._levelConfig, getBoss/spawnBoss, enemies.js
 // ============================================================
 function spawnEnemyWave(dt) {
   if (game.state !== State.PLAYING) return;
 
   const cfg = game._levelConfig;
@@ -8567,11 +9093,18 @@ function updateFastEnemyAlerts(dt, playerPos) {
     }
   });
 }
 
 // ============================================================
-//  RENDER / UPDATE LOOP
+// RENDER LOOP (THE BIG ONE)
+// Core game loop: time scaling, state machine, all subsystems
+// HOT PATH: Called every frame (60fps target)
+// SUB-SECTIONS: Title, Playing, Boss Death Cinematic, Paused,
+//   Ready Screen, Boss Alert, Level Complete, Upgrade Select,
+//   Game Over/Victory, UI Hover, Universal Updates
+// COUPLING: Reads/writes game.state, calls ALL update functions
+// RISK: Any change here affects frame timing, game feel, audio sync
 // ============================================================
 function render(timestamp) {
   frameCount++;
   const now = timestamp || performance.now();
   const rawDt = Math.min((now - lastTime) / 1000, 0.1);
@@ -8601,13 +9134,12 @@ function render(timestamp) {
     game.timeScale = window._timeScale || 1.0;
   }
 
   // Use game.timeScale if death sequence is active, otherwise use bullet-time timeScale
   let effectiveTimeScale = game.slowmoActive ? game.timeScale : timeScale;
-  if (bossDeathFreezeTimer > 0) {
-    bossDeathFreezeTimer -= rawDt;
-    if (bossDeathFreezeTimer < 0) bossDeathFreezeTimer = 0;
+  if (shouldFreezeTime()) {
+    updateBossDeathFreeze(rawDt);
     effectiveTimeScale = 0;
   }
 
   const dt = rawDt * effectiveTimeScale;  // Scaled time for game logic
 
@@ -8622,12 +9154,15 @@ function render(timestamp) {
   // Update desktop controls (WASD + mouse) in all states when enabled AND NOT in VR
   if (!renderer.xr.isPresenting) {
     updateDesktopControls(dt);
   }
 
+  // Poll VR menu/thumbstick buttons so at least one hardware button can pause.
+  updateVRPauseButton(now);
+
   let st = game.state;
-  if (bossDeathCinematic.active && st !== State.BOSS_DEATH_CINEMATIC) {
+  if (isBossDeathCinematicActive() && st !== State.BOSS_DEATH_CINEMATIC) {
     st = State.BOSS_DEATH_CINEMATIC;
     game.state = st;
   }
 
   // ── Title screen ──
@@ -8649,11 +9184,19 @@ function render(timestamp) {
     updateKillsAlert(now);
 
     // SAFEGUARD: Ensure blaster displays are visible during gameplay
     // Prevents text/billboard elements from disappearing
     blasterDisplays.forEach(d => { if (d) d.visible = false; });  // Hidden during gameplay
-    spawnEnemyWave(dt);
+
+    if (!game.inDreamWorld) {
+      spawnEnemyWave(dt);
+    } else {
+      const dreamState = updateDreamWorld(now, dt, getAdjustedCameraPosition());
+      if (dreamState?.exit) {
+        completeDreamWorldRun();
+      }
+    }
 
     // Full-auto shooting / Lightning beams / Charge shots (VR controllers)
     for (let i = 0; i < 2; i++) {
       if (controllerTriggerPressed[i]) {
         const hand = getHandForController(i);
@@ -9248,21 +9791,27 @@ function render(timestamp) {
 
   // ── Unified UI hover detection for all menu states ──
   if (st === State.TITLE || st === State.UPGRADE_SELECT || st === State.SCOREBOARD || 
       st === State.REGIONAL_SCORES || st === State.COUNTRY_SELECT || st === State.READY_SCREEN ||
       st === State.NAME_ENTRY) {
-    // Collect all raycasters from controllers
+    // PERFORMANCE: Reuse pooled raycasters instead of creating new ones each frame
+    // This reduces GC pressure during menu navigation and keyboard name entry
     const raycasters = [];
     for (let i = 0; i < controllers.length; i++) {
       const ctrl = controllers[i];
       if (!ctrl) continue;
-      const origin = new THREE.Vector3();
-      const quat = new THREE.Quaternion();
+      // Reuse pooled objects instead of creating new ones
+      const origin = _uiHoverOrigins[i];
+      const quat = _uiHoverQuats[i];
+      const dir = _uiHoverDirs[i];
       ctrl.getWorldPosition(origin);
       ctrl.getWorldQuaternion(quat);
-      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
-      raycasters.push(new THREE.Raycaster(origin, dir, 0, 10));
+      dir.set(0, 0, -1).applyQuaternion(quat);
+      // Reuse pooled raycaster and update its properties
+      const rc = _uiHoverRaycasters[i];
+      rc.set(origin, dir, 0, 10);
+      raycasters.push(rc);
     }
     // Also add desktop aim raycaster if available
     if (isDesktopEnabled()) {
       const desktopRC = getAimRaycaster();
       if (desktopRC) raycasters.push(desktopRC);
@@ -9472,10 +10021,19 @@ function render(timestamp) {
 
   // Hide scanlines overlay in VR — it creates a dark box that follows the head and obscures the view
   const scanlinesEl = document.getElementById('scanlines');
   if (scanlinesEl) scanlinesEl.style.display = renderer.xr.isPresenting ? 'none' : '';
 
+  // Keep visual tuning and secret trigger visuals responsive every frame.
+  applyVisualTuning();
+  updateVHSRetroShell(now);
+  updateDreamTriggerVisual(now);
+
+  // Update pause countdown BEFORE any early-return render path.
+  // This fixes countdown freeze when selective bloom is active.
+  updatePauseCountdown(now);
+
   // Selective bloom: lazy-init + render, only in desktop mode for synthwave_valley biome
   if (!renderer.xr.isPresenting && biomeSceneBiome === 'synthwave_valley') {
     if (!bloomComposer) initSelectiveBloom();  // Lazy init on first frame
     if (bloomComposer) {
       bloomComposer.bloomCamera.position.copy(camera.position);
@@ -9489,13 +10047,10 @@ function render(timestamp) {
       renderer.toneMappingExposure = 1.0;
       return;
     }
   }
 
-  // Update pause countdown if active
-  updatePauseCountdown(now);
-
   renderer.render(scene, camera);
 }
 
 // ============================================================
 //  WINDOW RESIZE
@@ -9505,1723 +10060,45 @@ function onWindowResize() {
   camera.updateProjectionMatrix();
   renderer.setSize(window.innerWidth, window.innerHeight);
   resizeBloomComposer();
 }
 
-// ── Custom biome scenes (new HTML-extracted biomes) ─────────
+// ============================================================
+// BIOME SCENE ORCHESTRATION
+// Delegates to biome-scenes.js module for scene building
+// COUPLING: biomeSceneGroup, biomeSceneBiome state shared via getters
+// ============================================================
 
+// Wrapper that delegates to biome-scenes.js module
 function rebuildBiomeScene(biomeId, theme) {
-  console.log('[debug] rebuildBiomeScene: biomeId=', biomeId, 'customScene=', theme?.customScene);
-  if (!scene || !theme || !theme.customScene) {
-    console.log('[debug] Clearing biome scene (no custom scene)');
-    clearBiomeScene();
-    return;
-  }
-  if (biomeSceneGroup && biomeSceneBiome === biomeId) {
-    console.log('[debug] Biome scene already built for', biomeId, ', skipping');
-    return;
-  }
-
-  console.log('[debug] Building new biome scene for', biomeId);
-  clearBiomeScene();
-
-  // Update aurora colors for new biome
-  updateAuroraColors(theme);
-
-  biomeSceneGroup = new THREE.Group();
-  biomeSceneGroup.name = `biome-scene-${biomeId}`;
-  scene.add(biomeSceneGroup);
-  biomeSceneBiome = biomeId;
-
-  if (theme.customScene === 'synthwave_valley') {
-    buildSynthwaveValleyScene(biomeSceneGroup);
-  } else if (theme.customScene === 'desert_night') {
-    buildDesertNightScene(biomeSceneGroup);
-  } else if (theme.customScene === 'alien_planet') {
-    buildAlienPlanetScene(biomeSceneGroup);
-  } else if (theme.customScene === 'hellscape_lava') {
-    buildHellscapeLavaScene(biomeSceneGroup);
-  }
-
-  // Register all biome scene materials for environment fade
-  // This ensures everything fades to black during boss death cinematic
-  if (biomeSceneGroup) {
-    biomeSceneGroup.traverse((child) => {
-      if (child.isMesh && child.material) {
-        if (Array.isArray(child.material)) {
-          child.material.forEach(m => registerFadeMaterial(m));
-        } else {
-          registerFadeMaterial(child.material);
-        }
-      }
-      if (child.isPoints && child.material) {
-        registerFadeMaterial(child.material);
-      }
-      if (child.isLine && child.material) {
-        registerFadeMaterial(child.material);
-      }
-    });
-  }
-}
-
-// Get physics floor Y for current biome (matches visual floor HUD height)
-function getBiomeFloorY() {
-  const floorY = (() => {
-    switch (biomeSceneBiome) {
-      case 'synthwave_valley': return 0.10;
-      case 'desert_night': return -0.20;
-      case 'alien_planet': return -0.28;
-      case 'hellscape_lava': return 0.05;
-      default: return 0.05;
-    }
-  })();
-  // Apply scene Y offset for VR camera height fix
-  return floorY + SCENE_Y_OFFSET;
-}
-
-// Log cylinder colors for debugging
-function logCylinderColors() {
-  console.log('=== CYLINDER COLORS ===');
-  
-  // atmosphereRef
-  if (typeof atmosphereRef !== 'undefined' && atmosphereRef.material) {
-    if (atmosphereRef.material.uniforms) {
-      const uni = atmosphereRef.material.uniforms;
-      console.log('atmosphereRef (atmosphere cylinder):');
-      console.log('  - uFogColor:', uni.uFogColor?.value?.getHexString());
-      console.log('  - Gradient stops:');
-      console.log('    0% (base): rgba(254,144,83,1.0) -> #FE9053 (horizon orange)');
-      console.log('    20%: rgba(224,1,134,0.9) -> #E00186 (pink)');
-      console.log('    50%: rgba(44,0,81,0.6) -> #2C0051 (sun top purple)');
-      console.log('    100% (top): rgba(26,0,74,0.0) -> #1A004A (dark purple)');
-    }
-  }
-  
-  // auroraRef
-  if (auroraRef && auroraRef.material) {
-    const tex = auroraRef.material.map;
-    if (tex && tex.image) {
-      const canvas = tex.image;
-      const ctx = canvas.getContext('2d');
-      if (ctx) {
-        console.log('auroraRef (aurora cylinder):');
-        const imageData = ctx.getImageData(0, 0, canvas.width, 1);
-        console.log('  - Bottom pixel:', imageData.data);
-      }
-    }
-    
-    // Use scenery.js theme colors
-    if (window.THEMES && window.THEMES.synthwave_valley && window.THEMES.synthwave_valley.aurora) {
-      const colors = window.THEMES.synthwave_valley.aurora.colors;
-      console.log('  - Theme colors:', colors);
-    }
-  }
-  
-  // horizonRingRef and horizonInnerRingRef - REMOVED
-  console.log('horizonRingRef: REMOVED');
-  console.log('horizonInnerRingRef: REMOVED');
-  
-  console.log('====================');
-}
-
-function buildSynthwaveValleyScene(group) {
-  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
-  const floorY = floorHeight;
-  // Fix for synthwave valley lighting regression: the extracted scene lost the
-  // original standalone scene's punch after we removed postprocessing, so raise
-  // the local material brightness without affecting other biomes.
-  const brightness = 1.0;
-
-  // Sky dome (no stars, we use global starfield)
-  // EXACT colors: Horizon #FE9053 (orange) → Mountain tips #E00186 (pink) → Sun top #2C0051 (purple) → Top #1A004A (dark purple) → Black
-  const skyGeo = new THREE.SphereGeometry(2800, 32, 24);
-  const skyMat = new THREE.ShaderMaterial({
-    side: THREE.BackSide,
-    uniforms: {
-      topColor: { value: new THREE.Color(0x1A004A) },      // Top: dark purple
-      midColor: { value: new THREE.Color(0x71006E) },      // 75% from equator: deep purple
-      horizonColor: { value: new THREE.Color(0xFF8626) },  // Equator: bright orange
-      glowColor: { value: new THREE.Color(0xF30787) },     // 40% from equator: pink
-    },
-    // VR-CRITICAL: Use the standard modelViewMatrix path so the sky remains
-    // stable in stereo rendering and does not rely on manual clip-space math.
-    vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 worldPosition=modelMatrix*vec4(position,1.0); vWorldPosition=worldPosition.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
-    fragmentShader: `varying vec3 vWorldPosition; uniform vec3 topColor; uniform vec3 midColor; uniform vec3 horizonColor; uniform vec3 glowColor; void main(){ float worldY=vWorldPosition.y; float t1=smoothstep(0.0,550.0,worldY); float t2=smoothstep(0.0,950.0,worldY); float t3=smoothstep(0.0,1400.0,worldY); vec3 col=horizonColor; col=mix(col,glowColor,t1); col=mix(col,midColor,t2); col=mix(col,topColor,t3); col=pow(col,vec3(1.0/2.2)); gl_FragColor=vec4(col*${brightness.toFixed(2)},1.0); }`,
-    depthWrite: false,
-  });
-  const sky = new THREE.Mesh(skyGeo, skyMat);
-  sky.frustumCulled = false;
-  sky.renderOrder = -20;  // Draw before sun (which is at -3 to -1)
-  group.add(sky);
-  registerFadeMaterial(skyMat);
-
-  // Terrain - EXACT colors: Gridlines #015CC1 (bright blue), Between gridlines #0C0E3E (dark blue)
-  // PERFORMANCE FIX: Reduced from 240x240 (57,600 vertices) to 120x120 (14,400 vertices) for 75% reduction
-  // Still provides good visual quality while improving FPS at level start
-  const terrainUniforms = {
-    uGridColor: { value: new THREE.Color(0x4368AC) },     // Gridlines
-    uBaseColor: { value: new THREE.Color(0x0C1347) },     // Primary/base color
-    uFogColor: { value: new THREE.Color(0x2C0051) },      // EXACT: Sun top purple fog
-    uFlashIntensity: { value: 0.0 },
-  };
-  const terrainGeo = new THREE.PlaneGeometry(2000, 2000, 240, 240);
-  terrainGeo.rotateX(-Math.PI / 2);
-  const terrainMat = new THREE.ShaderMaterial({
-    uniforms: terrainUniforms,
-    side: THREE.DoubleSide,
-    depthWrite: true,
-    depthTest: true,
-    polygonOffset: true,
-    polygonOffsetFactor: 2.0,
-    polygonOffsetUnits: 8.0,
-    // Fix for synthwave floor popping in VR: keep the terrain static and use the
-    // built-in modelViewMatrix projection instead of manual projection math.
-    vertexShader: `varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; varying float vFogDistance; vec2 hash2(vec2 p){ p=vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return -1.0+2.0*fract(sin(p)*43758.5453123);} float noise(in vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(dot(hash2(i+vec2(0.0,0.0)), f-vec2(0.0,0.0)), dot(hash2(i+vec2(1.0,0.0)), f-vec2(1.0,0.0)), u.x), mix(dot(hash2(i+vec2(0.0,1.0)), f-vec2(0.0,1.0)), dot(hash2(i+vec2(1.0,1.0)), f-vec2(1.0,1.0)), u.x), u.y);} float fbm(vec2 p){ float value=0.0; float amp=0.5; for(int i=0;i<5;i++){ value+=amp*noise(p); p*=2.0; amp*=0.5;} return value;} float ridgeNoise(vec2 p){ float sum=0.0; float amp=0.55; for(int i=0;i<5;i++){ float n=noise(p); n=1.0-abs(n); n*=n; sum+=n*amp; p*=2.15; amp*=0.5;} return sum;} void main(){ vec3 pos=position; vec2 p=pos.xz; float valleyMask=smoothstep(0.0,1.0, clamp(abs(pos.x)/240.0,0.0,1.0)); float broad=fbm(p*vec2(0.0035,0.0024))*16.0; float detail=fbm(p*vec2(0.012,0.01))*5.0; float ridges=ridgeNoise((p+vec2(0.0,-260.0))*0.008)*180.0; float mountainMask=pow(valleyMask,1.55); float centerDip=-10.0*(1.0-valleyMask); float distanceFade=smoothstep(750.0,120.0, abs(pos.z+120.0)); float h=broad+detail+centerDip; h+=ridges*mountainMask*distanceFade; if(pos.z>700.0){ h*=smoothstep(1000.0,700.0,pos.z);} pos.y=h; vec4 world=modelMatrix*vec4(pos,1.0); vec4 mvPosition=modelViewMatrix*vec4(pos,1.0); vWorldPos=world.xyz; vObjPos=pos; vHeight=h; vFogDistance=length(mvPosition.xyz); gl_Position=projectionMatrix*mvPosition; }`,
-    fragmentShader: `uniform vec3 uGridColor; uniform vec3 uBaseColor; uniform vec3 uFogColor; uniform float uFlashIntensity; varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; varying float vFogDistance; float gridLine(float coord,float width){ float g=abs(fract(coord-0.5)-0.5)/fwidth(coord); return 1.0-smoothstep(width,width+1.0,g);} void main(){ float gridScale=1.0/6.0; float dist=length(vObjPos.xz); float lineW=0.25*smoothstep(1000.0,100.0,dist); float gx=gridLine(vObjPos.x*gridScale,lineW); float gz=gridLine(vObjPos.z*gridScale,lineW); float grid=max(gx,gz); float glowPath=exp(-abs(vObjPos.x)*0.014)*smoothstep(350.0,-150.0,vObjPos.z); grid=max(grid, glowPath*0.34); vec3 col=mix(uBaseColor, uGridColor, grid); float ridgeGlow=smoothstep(48.0,160.0,vHeight)*smoothstep(100.0,350.0,abs(vObjPos.x)); col+=uGridColor*ridgeGlow*0.18; float fogAmount=1.0-exp(-0.0000012*vFogDistance*vFogDistance); col=mix(col,uFogColor, clamp(fogAmount*0.58,0.0,1.0)); vec3 flashColor=vec3(1.0,0.0,0.0); col=mix(col,flashColor,uFlashIntensity); gl_FragColor=vec4(col*${brightness.toFixed(2)},1.0); }`,
-  });
-  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
-  terrain.position.set(0, floorY + 1.5, -700);
-  terrain.frustumCulled = false;
-  terrain.layers.enable(BLOOM_LAYER);  // Selective bloom: floor grid glows
-  group.add(terrain);
-  registerFadeMaterial(terrainMat);
-  // Store terrain material for damage flash
-  biomeTerrainMaterials.push({ type: 'shader', material: terrainMat });
-
-  // Sun + glow - flat planes (no billboard), using retro synthwave PNG
-  const sunGroup = new THREE.Group();
-  sunGroup.position.set(0, 270, -1700);  // Y raised so full circle is above horizon
-  group.add(sunGroup);
-
-  const makeRadial = (inner, outer) => {
-    const c = document.createElement('canvas');
-    c.width = 512; c.height = 512;
-    const ctx = c.getContext('2d');
-    const g = ctx.createRadialGradient(256,256,0,256,256,256);
-    g.addColorStop(0.0, inner);
-    g.addColorStop(0.35, inner);
-    g.addColorStop(0.6, outer);
-    g.addColorStop(1.0, 'rgba(255,102,204,0)');
-    ctx.fillStyle = g; ctx.fillRect(0,0,512,512);
-    return new THREE.CanvasTexture(c);
+  // State object that the module can update
+  const state = {
+    get biomeSceneGroup() { return biomeSceneGroup; },
+    set biomeSceneGroup(val) { biomeSceneGroup = val; },
+    get biomeSceneBiome() { return biomeSceneBiome; },
+    set biomeSceneBiome(val) { biomeSceneBiome = val; },
   };
 
-  const sunGlowTex = makeRadial('rgba(255,255,255,1.0)', 'rgba(254,151,83,0.85)');
-  const sunOuterGlowTex = makeRadial('rgba(254,151,83,0.9)', 'rgba(224,1,134,0.3)');
-
-  // Outer massive glow (flat plane, no billboard, fog-proof, no depth test)
-  const sunOuterGlowMat = new THREE.MeshBasicMaterial({ map: sunOuterGlowTex, color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
-  const sunOuterGlow = new THREE.Mesh(new THREE.PlaneGeometry(1080, 1080), sunOuterGlowMat);
-  sunOuterGlow.frustumCulled = false;
-  sunOuterGlow.renderOrder = -3;
-  sunGroup.add(sunOuterGlow);
-  registerFadeMaterial(sunOuterGlowMat);
-
-  // Main bright glow (fog-proof, no depth test)
-  const sunGlowMat = new THREE.MeshBasicMaterial({ map: sunGlowTex, color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
-  const sunGlow = new THREE.Mesh(new THREE.PlaneGeometry(864, 864), sunGlowMat);
-  sunGlow.frustumCulled = false;
-  sunGlow.renderOrder = -2;
-  sunGroup.add(sunGlow);
-  registerFadeMaterial(sunGlowMat);
-
-  // Retro synthwave sun disc from PNG (flat plane, no billboard)
-  // PNG has white background - process to make white pixels transparent
-  const sunDiscTex = new THREE.TextureLoader().load('assets/sun-retro.png');
-  const sunCoreMat = new THREE.MeshBasicMaterial({ map: sunDiscTex, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false });
-  // Process: load PNG, threshold white pixels to transparent, replace material map
-  const sunDiscImg = new Image();
-  sunDiscImg.crossOrigin = 'anonymous';
-  sunDiscImg.onload = () => {
-    const c = document.createElement('canvas');
-    c.width = sunDiscImg.width;
-    c.height = sunDiscImg.height;
-    const ctx = c.getContext('2d');
-    ctx.drawImage(sunDiscImg, 0, 0);
-    const id = ctx.getImageData(0, 0, c.width, c.height);
-    const d = id.data;
-    for (let i = 0; i < d.length; i += 4) {
-      if ((d[i] + d[i+1] + d[i+2]) / 3 > 240) d[i+3] = 0;
-    }
-    ctx.putImageData(id, 0, 0);
-    if (sunCoreMat.map) sunCoreMat.map.dispose();
-    sunCoreMat.map = new THREE.CanvasTexture(c);
-    sunCoreMat.map.needsUpdate = true;
-    sunCoreMat.needsUpdate = true;
-  };
-  sunDiscImg.src = 'assets/sun-retro.png';
-  const sunCore = new THREE.Mesh(new THREE.PlaneGeometry(576, 576), sunCoreMat);
-  sunCore.frustumCulled = false;
-  sunCore.renderOrder = -1;
-  sunGroup.add(sunCore);
-  registerFadeMaterial(sunCoreMat);
-
-  // Log cylinder colors for debugging
-  logCylinderColors();
-
-  // Fix for synthwave valley "jiggle": keep the imported scene static in-game.
-  // The standalone HTML used perpetual scrolling and pulsing, but the game
-  // version should behave like a stable biome backdrop.
-  group.userData.update = null;
-
-  // Synthwave floor HUD height: group.position.y = 5.82
-  group.position.set(0, 5.82, 0);
-
-  // Rotate so player faces sun
-  group.rotation.y = 0;
-}
-
-function buildDesertNightScene(group) {
-  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
-  const floorY = floorHeight;
-  const sceneColor = 0x06080c;
-
-  // === LIGHTING (CRITICAL) ===
-  // Pale moonlight
-  const moonLight = new THREE.DirectionalLight(0xd4e5f7, 2.34);
-  moonLight.position.set(-30, 50, -30);
-  group.add(moonLight);
-
-  // Point light for long moon-like shadows from cacti
-  const shadowLight = new THREE.PointLight(0xd4e5f7, 1.5, 100);
-  shadowLight.position.set(-45, 35, -60); // Same as moon position
-  shadowLight.castShadow = true;
-  shadowLight.shadow.mapSize.width = 1024;
-  shadowLight.shadow.mapSize.height = 1024;
-  shadowLight.shadow.camera.near = 10;
-  shadowLight.shadow.camera.far = 100;
-  group.add(shadowLight);
-
-  // Very dim ambient
-  const ambientLight = new THREE.AmbientLight(0x1a2035, 0.15);
-  group.add(ambientLight);
-
-  // Hemisphere light for sky/ground color
-  const hemiLight = new THREE.HemisphereLight(0x1a2035, 0x2d1f1a, 0.2);
-  group.add(hemiLight);
-
-  // Ground
-  const geometry = new THREE.PlaneGeometry(140, 140, 70, 70);
-  geometry.rotateX(-Math.PI / 2);
-  const positions = geometry.attributes.position;
-  const colors = [];
-  const flatRadius = 12.0;
-  const mountainStart = 18.0;
-  for (let i = 0; i < positions.count; i++) {
-    const x = positions.getX(i);
-    const z = positions.getZ(i);
-    const dist = Math.sqrt(x * x + z * z);
-    let heightFactor = Math.min(Math.max((dist - flatRadius) / (mountainStart - flatRadius), 0), 1);
-    heightFactor = heightFactor * heightFactor * (3 - 2 * heightFactor);
-    let height = 0;
-    height += Math.sin(x * 0.08 + 0.5) * Math.cos(z * 0.06) * 4.0;
-    height += Math.sin(x * 0.04 + 2) * Math.sin(z * 0.05 + 1) * 3.0;
-    height += Math.sin(x * 0.15 + z * 0.1) * 1.5;
-    height += Math.cos(z * 0.12 - x * 0.08) * 1.0;
-    height += Math.sin(x * 0.3) * Math.cos(z * 0.25) * 0.5;
-    if (dist > mountainStart) {
-      height += Math.sin(x * 0.4 + z * 0.3) * 2.0;
-      height += Math.cos(x * 0.2 - z * 0.5) * 2.5;
-    }
-    const finalHeight = height * heightFactor;
-    positions.setY(i, finalHeight);
-    const heightNorm = (finalHeight + 5) / 15;
-    const baseColor = new THREE.Color(0x2a241b);
-    const highlightColor = new THREE.Color(0x585144);
-    const moonTint = new THREE.Color(0x404a5a);
-    let color = baseColor.clone().lerp(highlightColor, Math.max(0, Math.min(1, heightNorm)));
-    color.lerp(moonTint, heightNorm * 0.2);
-    colors.push(color.r, color.g, color.b);
-  }
-  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
-  geometry.computeVertexNormals();
-  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
-  const terrain = new THREE.Mesh(geometry, material);
-  terrain.position.y = floorY;
-  terrain.frustumCulled = false;
-  terrain.receiveShadow = true;  // Sand dunes receive cactus shadows
-  group.add(terrain);
-  registerFadeMaterial(material);
-
-  // Flash overlay plane for damage feedback (entire sand floor turns red)
-  const flashGeo = new THREE.PlaneGeometry(140, 140);
-  const flashMat = new THREE.MeshBasicMaterial({
-    color: 0xff0000,
-    transparent: true,
-    opacity: 0,
-    depthWrite: false,
-    side: THREE.DoubleSide
-  });
-  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
-  flashPlane.rotation.x = -Math.PI / 2;
-  flashPlane.position.y = floorY + 0.02; // Very close to terrain surface
-  flashPlane.frustumCulled = false;
-  group.add(flashPlane);
-  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });
-
-  // === CACTUSES (9 procedural) ===
-  const createCactus = (height) => {
-    const cactusGroup = new THREE.Group();
-    const bodyColor = 0x1a3d20;
-    const armColor = 0x2d5535;
-    const segments = 3 + Math.floor(Math.random() * 2); // 3-4 segments
-    let currentY = 0;
-    const segmentHeight = height / segments;
-
-    // Main body segments
-    for (let i = 0; i < segments; i++) {
-      const radius = 0.12 + (segments - i) * 0.03; // Taper upward
-      const segGeo = new THREE.CylinderGeometry(radius * 0.9, radius, segmentHeight, 5);
-      const segMat = new THREE.MeshLambertMaterial({ color: bodyColor, flatShading: true });
-      const segment = new THREE.Mesh(segGeo, segMat);
-      segment.position.y = currentY + segmentHeight / 2;
-      segment.castShadow = true;  // Cacti cast shadows
-      segment.receiveShadow = true;
-      cactusGroup.add(segment);
-      currentY += segmentHeight;
-    }
-
-    // Random arms (0-2)
-    const numArms = Math.floor(Math.random() * 3);
-    for (let a = 0; a < numArms; a++) {
-      const armY = segmentHeight * (1 + Math.floor(Math.random() * (segments - 1)));
-      const side = Math.random() > 0.5 ? 1 : -1;
-      const armLength = 0.4 + Math.random() * 0.4;
-
-      // Horizontal part
-      const hArmGeo = new THREE.CylinderGeometry(0.08, 0.1, armLength, 5);
-      const hArmMat = new THREE.MeshLambertMaterial({ color: armColor, flatShading: true });
-      const hArm = new THREE.Mesh(hArmGeo, hArmMat);
-      hArm.castShadow = true;
-      hArm.receiveShadow = true;
-      hArm.rotation.z = Math.PI / 2;
-      hArm.position.set(side * armLength / 2, armY, 0);
-      cactusGroup.add(hArm);
-
-      // Vertical part (upward)
-      const vArmHeight = 0.5 + Math.random() * 0.5;
-      const vArmGeo = new THREE.CylinderGeometry(0.06, 0.08, vArmHeight, 5);
-      const vArmMat = new THREE.MeshLambertMaterial({ color: armColor, flatShading: true });
-      const vArm = new THREE.Mesh(vArmGeo, vArmMat);
-      vArm.castShadow = true;
-      vArm.receiveShadow = true;
-      vArm.position.set(side * armLength, armY + vArmHeight / 2, 0);
-      cactusGroup.add(vArm);
-    }
-
-    // REMOVED: Fake circle shadow - now using point light for realistic moon shadows
-    // Cacti will cast natural shadows from the shadowLight
-
-    return cactusGroup;
-  };
-
-  const cactusPositions = [
-    { x: 6, z: 4, h: 2.5 },
-    { x: -4, z: 6, h: 3 },
-    { x: 8, z: -3, h: 2 },
-    { x: -7, z: -5, h: 2.8 },
-    { x: 3, z: -8, h: 1.8 },
-    { x: -10, z: 1, h: 2.2 },
-    { x: 0, z: 10, h: 2.3 },
-    // Removed cactus at {x: 5, z: 9, h: 1.9} - player now spawns there
-    { x: -5, z: -9, h: 2.4 },
-  ];
-
-  cactusPositions.forEach(pos => {
-    const cactus = createCactus(pos.h);
-    cactus.position.set(pos.x, floorY, pos.z);
-    cactus.rotation.y = Math.random() * Math.PI * 2;
-    group.add(cactus);
-  });
-
-  // === TWINKLING STARS (400 particles - reduced from 800 for performance) ===
-  const starCount = 400;
-  const starPositions = new Float32Array(starCount * 3);
-  const starPhases = new Float32Array(starCount);
-
-  for (let i = 0; i < starCount; i++) {
-    // Hemisphere distribution
-    const theta = Math.random() * Math.PI * 2;
-    const radius = 80 + Math.random() * 40; // 80-120
-    const phi = Math.random() * Math.PI * 0.5; // Upper hemisphere
-
-    starPositions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
-    starPositions[i * 3 + 1] = Math.cos(phi) * radius + 10; // Offset up
-    starPositions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
-    starPhases[i] = Math.random() * Math.PI * 2;
-  }
-
-  const starGeometry = new THREE.BufferGeometry();
-  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
-  starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
-
-  const starMaterial = new THREE.ShaderMaterial({
-    uniforms: {
-      uTime: { value: 0 },
-      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
-    },
-    vertexShader: `
-      attribute float aPhase;
-      uniform float uTime;
-      uniform float uPixelRatio;
-      varying float vTwinkle;
-      void main() {
-        vTwinkle = 0.5 + 0.5 * sin(uTime * 2.0 + aPhase);
-        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
-        float size = 2.0 * uPixelRatio * vTwinkle;
-        gl_PointSize = size * (200.0 / -mvPosition.z);
-        gl_Position = projectionMatrix * mvPosition;
-      }
-    `,
-    fragmentShader: `
-      varying float vTwinkle;
-      void main() {
-        float dist = length(gl_PointCoord - vec2(0.5));
-        if (dist > 0.5) discard;
-        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
-        vec3 color = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.95, 0.9), vTwinkle);
-        gl_FragColor = vec4(color * (0.7 + vTwinkle * 0.3), alpha * vTwinkle);
-      }
-    `,
-    transparent: true,
-    depthWrite: false,
-    fog: false,
-    blending: THREE.AdditiveBlending
-  });
-
-  const stars = new THREE.Points(starGeometry, starMaterial);
-  stars.frustumCulled = false; // Fix disappearing when looking up
-  stars.renderOrder = 999;
-  group.add(stars);
-  registerFadeMaterial(starMaterial);
-
-  // === DUST PARTICLES (300 particles - reduced from 600 for performance) ===
-  const dustCount = 300;
-  const dustPositions = new Float32Array(dustCount * 3);
-  const dustPhases = new Float32Array(dustCount);
-
-  for (let i = 0; i < dustCount; i++) {
-    dustPositions[i * 3] = (Math.random() - 0.5) * 60;
-    dustPositions[i * 3 + 1] = Math.random() * 15 + floorY;
-    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
-    dustPhases[i] = Math.random() * Math.PI * 2;
-  }
-
-  const dustGeometry = new THREE.BufferGeometry();
-  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
-  dustGeometry.setAttribute('aPhase', new THREE.BufferAttribute(dustPhases, 1));
-
-  const dustMaterial = new THREE.ShaderMaterial({
-    uniforms: {
-      uTime: { value: 0 },
-      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
+  rebuildBiomeSceneModule({
+    scene,
+    biomeId,
+    theme,
+    state,
+    clearBiomeScene,
+    registerFadeMaterial,
+    updateAuroraColors,
+    cleanupLegacyShapeGeometry,
+    assignBiomePlaneNames,
+    refs: {
+      floorMaterial,
+      synthVisualRefs,
+      BLOOM_LAYER,
+      getVisualTuning,
     },
-    vertexShader: `
-      attribute float aPhase;
-      uniform float uTime;
-      uniform float uPixelRatio;
-      varying float vAlpha;
-      void main() {
-        vAlpha = 0.5 + 0.3 * sin(uTime + aPhase);
-        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
-        gl_PointSize = 4.0 * uPixelRatio;
-        gl_Position = projectionMatrix * mvPosition;
-      }
-    `,
-    fragmentShader: `
-      varying float vAlpha;
-      void main() {
-        float dist = length(gl_PointCoord - vec2(0.5));
-        if (dist > 0.5) discard;
-        float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha * 1.2;
-        vec3 dustColor = vec3(0.8, 0.85, 0.9);
-        gl_FragColor = vec4(dustColor, alpha);
-      }
-    `,
-    transparent: true,
-    depthWrite: false,
-    fog: false,
-    blending: THREE.AdditiveBlending
+    biomeTerrainMaterials,
   });
-
-  const dust = new THREE.Points(dustGeometry, dustMaterial);
-  dust.renderOrder = 999;
-  group.add(dust);
-  registerFadeMaterial(dustMaterial);
-
-  // Moon
-  const moonGroup = new THREE.Group();
-  const moonGeometry = new THREE.IcosahedronGeometry(8, 2);
-  const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xfffef8 });
-  const moon = new THREE.Mesh(moonGeometry, moonMaterial);
-  moonGroup.add(moon);
-  registerFadeMaterial(moonMaterial);
-  const innerGlowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 });
-  const innerGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(9.5, 2), innerGlowMat);
-  const outerGlowMat = new THREE.MeshBasicMaterial({ color: 0xd4e5f7, transparent: true, opacity: 0.12 });
-  const outerGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(13, 2), outerGlowMat);
-  const farGlowMat = new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.06 });
-  const farGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(18, 2), farGlowMat);
-  moonGroup.add(innerGlow, outerGlow, farGlow);
-  registerFadeMaterial(innerGlowMat);
-  registerFadeMaterial(outerGlowMat);
-  registerFadeMaterial(farGlowMat);
-  moonGroup.position.set(-45, 35, -60);
-  group.add(moonGroup);
-
-  // Desert floor HUD height: Y = -0.20, rotated 25 degrees (-0.436 rad)
-  group.rotation.y = -0.436; // yaw: -25 degrees
-  group.position.set(-2.12, -0.20, -4.82);  // Moved 5 units +X and +Z
-
-  // Frame counter for throttling dust particle updates (Issue 4: reduce CPU cost)
-  let desertFrameCount = 0;
-
-  // === ANIMATION UPDATE ===
-  group.userData.update = (now, dt) => {
-    const time = now * 0.001;
-    // Update stars twinkle (shader-based, already efficient)
-    starMaterial.uniforms.uTime.value = time;
-    // Update dust shader time
-    dustMaterial.uniforms.uTime.value = time;
-
-    // Throttle dust particle position updates to every 5th frame (Issue 4: reduce CPU cost)
-    desertFrameCount++;
-    if (desertFrameCount % 5 === 0) {
-      const dustPos = dustGeometry.attributes.position.array;
-      for (let i = 0; i < dustCount; i++) {
-        const idx = i * 3;
-        // Gentle wind drift (scaled by 5 since we only update every 5th frame)
-        dustPos[idx] += 0.025 * dt;
-        dustPos[idx + 1] += Math.sin(time + dustPhases[i]) * 0.005 * dt;
-        dustPos[idx + 2] += Math.cos(time * 0.7 + dustPhases[i]) * 0.01 * dt;
-
-        // Wrap around boundaries
-        if (dustPos[idx] > 30) dustPos[idx] = -30;
-        if (dustPos[idx] < -30) dustPos[idx] = 30;
-        if (dustPos[idx + 1] > floorY + 15) dustPos[idx + 1] = floorY;
-        if (dustPos[idx + 1] < floorY) dustPos[idx + 1] = floorY + 15;
-        if (dustPos[idx + 2] > 30) dustPos[idx + 2] = -30;
-        if (dustPos[idx + 2] < -30) dustPos[idx + 2] = 30;
-      }
-      dustGeometry.attributes.position.needsUpdate = true;
-    }
-  };
 }
 
-function buildAlienPlanetScene(group) {
-  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
-  const floorY = floorHeight - 0.3; // Move everything down 0.3 units to fix floor HUD being under floor
-
-  // Ground
-  const groundGeo = new THREE.PlaneGeometry(300, 300, 120, 120);
-  const groundPositions = groundGeo.attributes.position;
-  for (let i = 0; i < groundPositions.count; i++) {
-    const x = groundPositions.getX(i);
-    const y = groundPositions.getY(i);
-    groundPositions.setZ(i, Math.sin(x * 0.03) * Math.cos(y * 0.03) * 0.3);
-  }
-  groundGeo.computeVertexNormals();
-  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0510, roughness: 1, metalness: 0, flatShading: true });
-  const ground = new THREE.Mesh(groundGeo, groundMat);
-  ground.rotation.x = -Math.PI / 2;
-  ground.position.y = floorY;
-  ground.frustumCulled = false;
-  group.add(ground);
-
-  // Flash overlay plane for damage feedback (Issue 2: 320x320 for full floor coverage)
-  const flashGeo = new THREE.PlaneGeometry(320, 320);
-  const flashMat = new THREE.MeshBasicMaterial({
-    color: 0xff0000,
-    transparent: true,
-    opacity: 0,
-    depthWrite: false,
-    side: THREE.DoubleSide
-  });
-  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
-  flashPlane.rotation.x = -Math.PI / 2;
-  flashPlane.position.y = floorY + 0.1;
-  flashPlane.frustumCulled = false;
-  group.add(flashPlane);
-  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });
-
-  // Moon and glow
-  const moonGeo = new THREE.IcosahedronGeometry(24, 1);
-  const moonMat = new THREE.MeshBasicMaterial({ color: 0xddaaff, transparent: true, opacity: 0.95 });
-  const moon = new THREE.Mesh(moonGeo, moonMat);
-  moon.position.set(60, 80, -40);
-  moon.frustumCulled = false; // Fix disappearing when looking up
-  group.add(moon);
-  const moonGlowGeo = new THREE.IcosahedronGeometry(36, 1);
-  const moonGlowMat = new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.15, side: THREE.BackSide });
-  const moonGlow = new THREE.Mesh(moonGlowGeo, moonGlowMat);
-  moonGlow.position.copy(moon.position);
-  moonGlow.frustumCulled = false; // Fix disappearing when looking up
-  group.add(moonGlow);
-
-  // Lighting - moonLight for ambient scene lighting (shadows DISABLED for FPS)
-  const moonLight = new THREE.DirectionalLight(0xcc88ff, 8.4);
-  moonLight.position.set(60, 80, -40);
-  // SHADOWS DISABLED - major FPS cost in this biome
-  moonLight.castShadow = false;
-  group.add(moonLight);
-
-  // Green light - moved HIGH (y: 35) to not block view
-  const greenLight = new THREE.PointLight(0x00ff66, 1.2, 80);
-  greenLight.position.set(0, 35, 0);
-  group.add(greenLight);
-
-  // Purple accent lights
-  const purpleLight1 = new THREE.PointLight(0x6622aa, 1.5, 50);
-  purpleLight1.position.set(-30, 20, -30);
-  group.add(purpleLight1);
-
-  const purpleLight2 = new THREE.PointLight(0x8833cc, 1.2, 45);
-  purpleLight2.position.set(25, 18, 35);
-  group.add(purpleLight2);
-
-  // River path used for plant placement (but no visible river mesh)
-  const riverPoints = [];
-  for (let i = 0; i < 60; i++) {
-    const t = i / 59;
-    const x = Math.sin(t * Math.PI * 2.5) * 12 + Math.sin(t * Math.PI * 5) * 4;
-    const z = t * 120 - 60;
-    riverPoints.push(new THREE.Vector3(x, 0.1, z));
-  }
-  // Green river-object REMOVED - was blocking view and looking out of place
-
-  // Mountains - 3 rings of procedural jagged mountains
-  const createMountain = (x, z, scale) => {
-    const peakCount = 1 + Math.floor(Math.random() * 3);
-    const mountainGroup = new THREE.Group();
-    for (let p = 0; p < peakCount; p++) {
-      const height = (12 + Math.random() * 18) * scale;
-      const radius = Math.max(2.5, (2 + Math.random() * 3) * scale); // Minimum radius of 2.5 for no skinny pyramids
-      const peakGeo = new THREE.ConeGeometry(radius, height, 5 + Math.floor(Math.random() * 3));
-      const peakMat = new THREE.MeshStandardMaterial({
-        color: 0x1a1020,
-        roughness: 0.9,
-        metalness: 0.1,
-        flatShading: true
-      });
-      const peak = new THREE.Mesh(peakGeo, peakMat);
-      peak.position.set(
-        (Math.random() - 0.5) * 4 * scale,
-        height / 2,
-        (Math.random() - 0.5) * 4 * scale
-      );
-      // Issue 5: Enable shadows for mountains
-      peak.castShadow = true;
-      peak.receiveShadow = true;
-      mountainGroup.add(peak);
-    }
-    mountainGroup.position.set(x, floorY, z);
-    mountainGroup.frustumCulled = false; // Prevent culling at distance
-    return mountainGroup;
-  };
-
-  // Mountains - single ring for FPS (was 2 rings = 24 mountains)
-  for (let ring = 0; ring < 1; ring++) {
-    const count = 14;  // Single ring of 14 mountains (was 8+16=24)
-    const radius = 40;
-    for (let i = 0; i < count; i++) {
-      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
-      const r = radius + (Math.random() - 0.5) * 10;
-      const x = Math.cos(angle) * r;
-      const z = Math.sin(angle) * r;
-      group.add(createMountain(x, z, 1.2 + Math.random() * 0.6));
-    }
-  }
-
-  // Alien Plants - 3 types along river (removed fern type - too expensive with 40-72 meshes)
-  const alienPlants = [];
-
-  const createAlienPlant = (x, z, type) => {
-    const plantGroup = new THREE.Group();
-
-    if (type === 0) {
-      // Glowing Spire - tall thin cone with glowing orb on top
-      const height = 3 + Math.random() * 5;
-      const spireGeo = new THREE.ConeGeometry(0.2, height, 6);
-      const spireMat = new THREE.MeshStandardMaterial({
-        color: 0x00aa33,
-        emissive: 0x00ff44,
-        emissiveIntensity: 0.6,
-        roughness: 0.5
-      });
-      const spire = new THREE.Mesh(spireGeo, spireMat);
-      spire.position.y = height / 2;
-      spire.castShadow = false;
-      spire.receiveShadow = false;
-      plantGroup.add(spire);
-
-      // Glowing orb on top
-      const orbGeo = new THREE.IcosahedronGeometry(0.3, 1);
-      const orbMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
-      const orb = new THREE.Mesh(orbGeo, orbMat);
-      orb.position.y = height + 0.2;
-      orb.castShadow = false;
-      orb.receiveShadow = false;
-      plantGroup.add(orb);
-
-    } else if (type === 1) {
-      // Crystal Cluster - 3 small angular cones
-      for (let c = 0; c < 3; c++) {
-        const height = 0.8 + Math.random() * 1.2;
-        const crystalGeo = new THREE.ConeGeometry(0.15, height, 3);
-        const crystalMat = new THREE.MeshStandardMaterial({
-          color: 0x00cc55,
-          emissive: 0x00ff66,
-          emissiveIntensity: 0.7,
-          roughness: 0.3
-        });
-        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
-        crystal.position.set(
-          (Math.random() - 0.5) * 0.4,
-          height / 2,
-          (Math.random() - 0.5) * 0.4
-        );
-        crystal.rotation.set(
-          (Math.random() - 0.5) * 0.4,
-          Math.random() * Math.PI,
-          (Math.random() - 0.5) * 0.4
-        );
-        crystal.castShadow = false;
-        crystal.receiveShadow = false;
-        plantGroup.add(crystal);
-      }
-
-    } else if (type === 2) {
-      // Mushroom - cylinder stem + hemisphere cap
-      const stemHeight = 0.5 + Math.random() * 0.5;
-      const stemGeo = new THREE.CylinderGeometry(0.1, 0.15, stemHeight, 8);
-      const stemMat = new THREE.MeshStandardMaterial({ color: 0x204020, roughness: 0.8 });
-      const stem = new THREE.Mesh(stemGeo, stemMat);
-      stem.position.y = stemHeight / 2;
-      stem.castShadow = false;
-      stem.receiveShadow = false;
-      plantGroup.add(stem);
-
-      const capGeo = new THREE.SphereGeometry(0.4, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
-      const capMat = new THREE.MeshStandardMaterial({
-        color: 0x00aa44,
-        emissive: 0x00ff55,
-        emissiveIntensity: 0.5,
-        roughness: 0.6
-      });
-      const cap = new THREE.Mesh(capGeo, capMat);
-      cap.position.y = stemHeight;
-      cap.castShadow = false;
-      cap.receiveShadow = false;
-      plantGroup.add(cap);
-    }
-
-    plantGroup.position.set(x, floorY, z);
-    plantGroup.castShadow = false;
-    plantGroup.receiveShadow = false;
-    // REMOVED: Sway animation data - per-frame rotation is too expensive
-
-    return plantGroup;
-  };
-
-  // Place 15 plants along river with random offsets (reduced for FPS)
-  for (let i = 0; i < 15; i++) {
-    const t = Math.random();
-    const riverT = t * 59;
-    const idx = Math.floor(riverT);
-    const frac = riverT - idx;
-
-    const p1 = riverPoints[Math.min(idx, 59)];
-    const p2 = riverPoints[Math.min(idx + 1, 59)];
-
-    const x = p1.x + (p2.x - p1.x) * frac + (Math.random() - 0.5) * 8;
-    const z = p1.z + (p2.z - p1.z) * frac + (Math.random() - 0.5) * 8;
-
-    // Keep plants away from river center
-    const distToCenter = Math.abs(x - (p1.x + (p2.x - p1.x) * frac));
-    if (distToCenter < 3) continue;
-
-    // AGGRESSIVE: Skip plants behind player (positive Z)
-    if (z > 0) continue;
-
-    // Clearance zone: no tall plants within 12 units directly in front of player spawn
-    const clearanceRadius = 12;
-    const distToPlayer = Math.sqrt(x * x + z * z);
-    if (distToPlayer < clearanceRadius && z < 5) {
-      continue; // Skip this plant to keep front area clear
-    }
-
-    const plantType = Math.floor(Math.random() * 3);  // Only 3 types (removed fern)
-    const plant = createAlienPlant(x, z, plantType);
-    // Shadow casting disabled for FPS
-    alienPlants.push(plant);
-    group.add(plant);
-  }
-
-  // Extra flora spread around the player (reduced for FPS)
-  // AGGRESSIVE: Only spawn in front of player (negative Z, front 180-degree arc)
-  for (let i = 0; i < 15; i++) {  // Reduced from 50 to 15 (total plants: 30 instead of 100)
-    const angle = Math.random() * Math.PI * 2;
-    const radius = 8 + Math.random() * 40;
-    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 8;
-    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 8;
-
-    // AGGRESSIVE: Skip objects behind player (positive Z)
-    if (z > 0) continue;
-
-    // Clearance zone: no tall plants within 12 units directly in front of player spawn
-    const clearanceRadius = 12;
-    const distToPlayer = Math.sqrt(x * x + z * z);
-    if (distToPlayer < clearanceRadius && z < 5) {
-      continue; // Skip this plant to keep front area clear
-    }
-
-    const plantType = Math.floor(Math.random() * 3);  // Only 3 types (removed fern)
-    const plant = createAlienPlant(x, z, plantType);
-    // Shadow casting disabled for FPS
-    plant.castShadow = false;
-    plant.receiveShadow = false;
-    plant.traverse((child) => {
-      if (child.isMesh) {
-        child.castShadow = false;
-        child.receiveShadow = false;
-      }
-    });
-    alienPlants.push(plant);
-    group.add(plant);
-  }
-
-  // Small fauna critters (reduced for FPS)
-  // AGGRESSIVE: Only spawn in front of player (negative Z)
-  const critterGeo = new THREE.SphereGeometry(0.18, 8, 6);
-  const critterGlowGeo = new THREE.SphereGeometry(0.3, 8, 6);
-  for (let i = 0; i < 5; i++) {  // Reduced from 10 to 5 for FPS
-    const angle = Math.random() * Math.PI * 2;
-    const radius = 6 + Math.random() * 35;
-    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 4;
-    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 4;
-
-    // AGGRESSIVE: Skip critters behind player (positive Z)
-    if (z > 0) continue;
-
-    const critterGroup = new THREE.Group();
-    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00aa55, emissive: 0x00ff66, emissiveIntensity: 0.4 });
-    const body = new THREE.Mesh(critterGeo, bodyMat);
-    body.position.y = 0.2;
-    body.castShadow = false;
-    body.receiveShadow = false;
-    critterGroup.add(body);
-
-    const glowMat = new THREE.MeshBasicMaterial({ color: 0x33ffaa, transparent: true, opacity: 0.3 });
-    const glow = new THREE.Mesh(critterGlowGeo, glowMat);
-    glow.position.y = 0.2;
-    critterGroup.add(glow);
-
-    critterGroup.position.set(x, floorY, z);
-    critterGroup.rotation.y = Math.random() * Math.PI * 2;
-    group.add(critterGroup);
-  }
-
-  // Fireflies - 25 particles with gentle drift (reduced from 60 for FPS)
-  // AGGRESSIVE: Only spawn in front of player (negative Z)
-  const fireflyPositions = [];
-  const fireflyGeo = new THREE.BufferGeometry();
-
-  for (let i = 0; i < 25; i++) {
-    const angle = Math.random() * Math.PI * 2;
-    const radius = 4 + Math.random() * 35;
-    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 3;
-    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 3;
-    const y = 0.5 + Math.random() * 3;  // Float above ground
-
-    // AGGRESSIVE: Skip fireflies behind player (positive Z)
-    if (z > 0) continue;
-
-    fireflyPositions.push(x, y, z);
-  }
-
-  fireflyGeo.setAttribute('position', new THREE.Float32BufferAttribute(fireflyPositions, 3));
-  const fireflyMat = new THREE.PointsMaterial({
-    color: 0x44ff88,
-    size: 0.12,
-    transparent: true,
-    opacity: 0.9,
-    sizeAttenuation: true
-  });
-  const fireflies = new THREE.Points(fireflyGeo, fireflyMat);
-  fireflies.frustumCulled = false; // Fix disappearing when looking up
-  group.add(fireflies);
-
-  // River sparkles removed along with river mesh
-
-  // Instanced city - FAR on horizon (was too close at 55-100)
-  const cityShaderMat = new THREE.ShaderMaterial({
-    uniforms: {
-      uTime: { value: 0 },
-      uMoonDir: { value: new THREE.Vector3(60, 80, -40).normalize() },
-      uMoonColor: { value: new THREE.Color(0xcc88ff) },
-      uBaseColor: { value: new THREE.Color(0x0a0a15) }
-    },
-    vertexShader: `varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorldPos; void main(){ vUv=uv; vNormal=normalize(normalMatrix*normal); vec4 worldPos=modelMatrix*instanceMatrix*vec4(position,1.0); vWorldPos=worldPos.xyz; gl_Position=projectionMatrix*viewMatrix*worldPos; }`,
-    fragmentShader: `uniform float uTime; uniform vec3 uMoonDir; uniform vec3 uMoonColor; uniform vec3 uBaseColor; varying vec2 vUv; varying vec3 vNormal; float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233)))*43758.5453);} void main(){ float moonLight=max(dot(vNormal,uMoonDir),0.0); vec3 finalColor=uBaseColor*(0.2+moonLight*0.8)*uMoonColor; vec2 uv=vUv; float numWindowsX=6.0; float numWindowsY=15.0; vec2 grid=floor(vec2(uv.x*numWindowsX, uv.y*numWindowsY)); vec2 gridUv=fract(vec2(uv.x*numWindowsX, uv.y*numWindowsY)); float windowMask=step(0.15,gridUv.x)*step(gridUv.x,0.85)*step(0.1,gridUv.y)*step(gridUv.y,0.9); float r=rand(grid); float isLit=step(0.5,r); if(windowMask>0.5 && isLit>0.5){ vec3 windowColor=mix(vec3(0.0,1.0,0.5), vec3(0.5,0.0,1.0), rand(grid*0.5)); float flicker=0.9+0.1*sin(uTime*2.0+rand(grid)*10.0); finalColor=windowColor*flicker*1.5; } gl_FragColor=vec4(finalColor,1.0); }`
-  });
-  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
-  const cylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
-  const coneGeo = new THREE.BoxGeometry(1, 1, 1);
-  const dummy = new THREE.Object3D();
-  const cityMeshes = [];
-
-  const generateCityLayer = (geometry, count, minDist, maxDist, minHeight, maxHeight) => {
-    const mesh = new THREE.InstancedMesh(geometry, cityShaderMat, count);
-    for (let i = 0; i < count; i++) {
-      const angle = Math.random() * Math.PI * 2;
-      const dist = minDist + Math.random() * (maxDist - minDist);
-      const height = minHeight + Math.random() * (maxHeight - minHeight);
-      const width = 1.5 + Math.random() * 4.5; // 3x thicker (was 0.5 + Math.random() * 1.5)
-      dummy.position.set(Math.cos(angle) * dist, (height / 2) - 3, Math.sin(angle) * dist);
-      dummy.scale.set(width, height, width);
-      dummy.rotation.y = Math.random() * Math.PI;
-      dummy.updateMatrix();
-      mesh.setMatrixAt(i, dummy.matrix);
-    }
-    return mesh;
-  };
-
-  // Far background city on horizon (REDUCED for FPS: was 100+80+60=240, now 30+25+20=75)
-  cityMeshes.push(generateCityLayer(boxGeo, 30, 120, 150, 30, 60));
-  cityMeshes.push(generateCityLayer(cylinderGeo, 25, 140, 180, 40, 80));
-  cityMeshes.push(generateCityLayer(coneGeo, 20, 160, 200, 50, 100));
-  cityMeshes.forEach((mesh) => group.add(mesh));
-
-  // Mega towers - far on horizon (REDUCED for FPS: was 10)
-  const megaGeo = new THREE.CylinderGeometry(1, 1.5, 1, 5);
-  const megaMesh = new THREE.InstancedMesh(megaGeo, cityShaderMat, 5);
-  for (let i = 0; i < 5; i++) {
-    const angle = (i / 5) * Math.PI * 2;
-    const dist = 160 + Math.random() * 20;
-    const h = 110 + Math.random() * 20;
-    dummy.position.set(Math.cos(angle) * dist, (h / 2) - 3, Math.sin(angle) * dist); // Issue 5: Lower mega towers by 3 units
-    dummy.scale.set(5, h, 5);
-    dummy.updateMatrix();
-    megaMesh.setMatrixAt(i, dummy.matrix);
-  }
-  cityMeshes.push(megaMesh);
-  group.add(megaMesh);
-
-  // Issue 7: Distant low-poly mountains at ~100 units (alien planet colors) - closer and larger for visibility
-  const createDistantMountain = (x, z, scale) => {
-    const peakCount = 1 + Math.floor(Math.random() * 2);
-    const mountainGroup = new THREE.Group();
-    for (let p = 0; p < peakCount; p++) {
-      const height = (30 + Math.random() * 50) * scale;
-      const radius = Math.max(6, (6 + Math.random() * 10) * scale);
-      // Low-poly cone with 5-7 segments
-      const peakGeo = new THREE.ConeGeometry(radius, height, 5 + Math.floor(Math.random() * 3));
-      const peakMat = new THREE.MeshStandardMaterial({
-        color: 0x0a2015, // Dark teal-green
-        roughness: 0.9,
-        metalness: 0.1,
-        flatShading: true
-      });
-      const peak = new THREE.Mesh(peakGeo, peakMat);
-      peak.position.set(
-        (Math.random() - 0.5) * 6 * scale,
-        height / 2,
-        (Math.random() - 0.5) * 6 * scale
-      );
-      peak.castShadow = false;
-      peak.receiveShadow = false;
-      mountainGroup.add(peak);
-    }
-    mountainGroup.position.set(x, floorY, z);
-    mountainGroup.frustumCulled = false; // Prevent culling at distance
-    return mountainGroup;
-  };
-
-  // Ring of 10 distant mountains at ~100 units (closer for visibility with fog)
-  const distantMountainCount = 10;
-  const distantMountainRadius = 100;
-  for (let i = 0; i < distantMountainCount; i++) {
-    const angle = (i / distantMountainCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
-    const r = distantMountainRadius + (Math.random() - 0.5) * 20;
-    const x = Math.cos(angle) * r;
-    const z = Math.sin(angle) * r;
-    group.add(createDistantMountain(x, z, 1.0 + Math.random() * 0.5));
-  }
-
-  // Animation update - OPTIMIZED: stagger updates to reduce per-frame cost
-  let frameCounter = 0;
-  group.userData.update = (now, dt) => {
-    frameCounter++;
-    const time = now * 0.001;
-
-    // City shader: update every frame (cheap - just uniform)
-    cityShaderMat.uniforms.uTime.value = time;
-
-    // Green light pulse: every frame (cheap - single value)
-    greenLight.intensity = 1.2 + Math.sin(time * 2) * 0.3;
-
-    // REMOVED: Firefly drift animation - per-frame position updates were too expensive
-    // Fireflies are now static for better FPS
-
-    // REMOVED: Plant sway animation - per-frame rotation was too expensive
-    // Plants are now static for better FPS
-  };
-
-  group.rotation.y = -0.062; // yaw: 3.55°
-
-  // Alien floor HUD height: group.position.y = -0.28
-  group.position.set(6.628, -0.28, -13.926);
-}
-
-function buildHellscapeLavaScene(group) {
-  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
-  const floorY = floorHeight;  // Player stands on riverbanks at correct height
-  const valleyWidth = 35.0;
-
-  // ========================================
-  // 1. LIGHTING (CRITICAL)
-  // ========================================
-  // Red moonlight with shadows
-  const moonLight = new THREE.DirectionalLight(0xff3333, 2.5);
-  moonLight.position.set(20, 30, -100);
-  moonLight.castShadow = true;
-  moonLight.shadow.mapSize.width = 2048;
-  moonLight.shadow.mapSize.height = 2048;
-  moonLight.shadow.camera.near = 0.5;
-  moonLight.shadow.camera.far = 500;
-  moonLight.shadow.camera.left = -100;
-  moonLight.shadow.camera.right = 100;
-  moonLight.shadow.camera.top = 100;
-  moonLight.shadow.camera.bottom = -100;
-  group.add(moonLight);
-
-  // Very dim ambient
-  const ambientLight = new THREE.AmbientLight(0x220505, 0.1);
-  group.add(ambientLight);
-
-  // Lava glow point light (will animate)
-  const lavaGlow = new THREE.PointLight(0xff3300, 2.5, 60);
-  lavaGlow.position.set(0, 5, 0);
-  group.add(lavaGlow);
-
-  // ========================================
-  // TERRAIN (existing logic)
-  // ========================================
-  const geometry = new THREE.PlaneGeometry(300, 300, 200, 200);
-  geometry.rotateX(-Math.PI / 2);
-  const positions = geometry.attributes.position;
-  for (let i = 0; i < positions.count; i++) {
-    const x = positions.getX(i);
-    const z = positions.getZ(i);
-    const riverX = Math.sin(z * 0.03) * 15.0;
-    const distToRiver = Math.abs(x - riverX);
-    const riverWidth = 5.0;
-    const distFromCenter = Math.abs(x);
-    let height = 0;
-    const valleyFloorHeight = 0.0;  // Fixed: was 1.5, causing camera to appear below ground
-    if (distFromCenter > valleyWidth) {
-      const mountainFactor = (distFromCenter - valleyWidth) / 15.0;
-      let mHeight = 0;
-      mHeight += Math.abs(Math.sin(x * 0.05) * Math.cos(z * 0.04)) * 15.0;
-      mHeight += Math.abs(Math.sin(z * 0.08 + 1.0)) * 10.0;
-      mHeight += Math.abs(Math.cos(x * 0.12 - z * 0.08)) * 6.0;
-      mHeight += (Math.random() * 3.0);
-      height = valleyFloorHeight + mHeight * Math.min(mountainFactor, 1.0);
-    } else {
-      height = valleyFloorHeight;
-      height += (Math.sin(x * 0.5) * Math.cos(z * 0.5)) * 0.3;
-      if (distToRiver < riverWidth) {
-        height = -1.0;
-      } else if (distToRiver < riverWidth + 3.0) {
-        height = Math.min(height, valleyFloorHeight - (riverWidth + 3.0 - distToRiver) * 0.5);
-      }
-    }
-    positions.setY(i, height);
-  }
-  geometry.computeVertexNormals();
-
-  const material = new THREE.MeshStandardMaterial({
-    color: 0x110505,
-    roughness: 0.9,
-    metalness: 0.1,
-    flatShading: true,
-    onBeforeCompile: (shader) => {
-      shader.uniforms.uTime = { value: 0 };
-      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vPosition; varying float vElevation; uniform float uTime;`);
-      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nvPosition = position; vElevation = position.y;`);
-      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vPosition; varying float vElevation; uniform float uTime;`);
-      shader.fragmentShader = shader.fragmentShader.replace('#include <emissive_fragment>', `float lavaThreshold = 0.5; if (vElevation < lavaThreshold) { } else { float distToLava = vElevation - lavaThreshold; float glowReflection = smoothstep(5.0, 0.0, distToLava); float pulse = sin(uTime * 0.8 + vPosition.x * 0.5 + vPosition.z * 0.5) * 0.5 + 0.5; totalEmissiveRadiance = vec3(0.6, 0.1, 0.0) * glowReflection * pulse; } #include <emissive_fragment>`);
-      shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `float lavaThreshold = 0.5; if (vElevation < lavaThreshold) { vec3 lavaColorBase = vec3(1.0, 0.05, 0.05); vec3 lavaColorBright = vec3(1.0, 0.25, 0.2); float pulse = sin(uTime * 0.8 + vPosition.x * 0.5 + vPosition.z * 0.5) * 0.5 + 0.5; float glow = 0.7 + 0.3 * pulse; vec3 finalLavaColor = mix(lavaColorBase, lavaColorBright, glow); gl_FragColor = vec4(finalLavaColor, 0.9); } else { gl_FragColor = vec4( outgoingLight, diffuseColor.a ); }`);
-      material.userData.shader = shader;
-    }
-  });
-
-  const terrain = new THREE.Mesh(geometry, material);
-  terrain.receiveShadow = true;
-  terrain.position.y = floorY;
-  terrain.position.x = -10.0;  // Shift terrain left so player spawns on riverbank (not riverbed)
-  terrain.position.z = 0.0;  // Player on flat valley floor
-  group.add(terrain);
-
-  // Flash overlay plane for damage feedback
-  const flashGeo = new THREE.PlaneGeometry(300, 300);
-  const flashMat = new THREE.MeshBasicMaterial({
-    color: 0xff0000,
-    transparent: true,
-    opacity: 0,
-    depthWrite: false,
-    side: THREE.DoubleSide
-  });
-  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
-  flashPlane.rotation.x = -Math.PI / 2;
-  flashPlane.position.y = floorY + 0.05;
-  flashPlane.frustumCulled = false;
-  group.add(flashPlane);
-  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });
-
-  // ========================================
-  // 2. JAGGED ROCKS (50 scattered)
-  // ========================================
-  const rockGeo = new THREE.TetrahedronGeometry(1, 0);
-  const rockMat = new THREE.MeshStandardMaterial({
-    color: 0x1a1a1a,
-    roughness: 0.8,
-    metalness: 0.2,
-    flatShading: true
-  });
-
-  for (let i = 0; i < 50; i++) {
-    const rock = new THREE.Mesh(rockGeo, rockMat);
-    let x, z, riverX, distToRiver;
-    let attempts = 0;
-    do {
-      x = (Math.random() - 0.5) * 60;
-      z = (Math.random() - 0.5) * 100;
-      riverX = Math.sin(z * 0.03) * 15.0;
-      distToRiver = Math.abs(x - riverX);
-      attempts++;
-    } while (distToRiver < 8 && attempts < 20);
-
-    rock.position.set(x, floorY + 0.5, z);
-    // Scale: taller than wide (0.5-4.0)
-    const scaleY = 0.5 + Math.random() * 3.5;
-    const scaleX = 0.5 + Math.random() * 1.5;
-    rock.scale.set(scaleX, scaleY, scaleX);
-    rock.rotation.set(
-      Math.random() * Math.PI,
-      Math.random() * Math.PI * 2,
-      Math.random() * Math.PI
-    );
-    rock.castShadow = true;
-    rock.receiveShadow = true;
-    group.add(rock);
-  }
-
-  // ========================================
-  // 3. DEAD TREES (25 procedural)
-  // ========================================
-  const treeMat = new THREE.MeshStandardMaterial({
-    color: 0x0a0a0a,
-    roughness: 0.9,
-    metalness: 0.1,
-    flatShading: true
-  });
-
-  const createBranch = (depth, maxDepth, length, radius) => {
-    const branchGroup = new THREE.Group();
-
-    // Main branch cylinder (5 sides)
-    const branchGeo = new THREE.CylinderGeometry(radius * 0.7, radius, length, 5);
-    const branch = new THREE.Mesh(branchGeo, treeMat);
-    branch.position.y = length / 2;
-    branch.castShadow = true;
-    branch.receiveShadow = true;
-    branchGroup.add(branch);
-
-    // Add child branches if not at max depth
-    if (depth < maxDepth) {
-      const numChildren = 2 + Math.floor(Math.random() * 2); // 2-3 children
-      for (let i = 0; i < numChildren; i++) {
-        const childBranch = createBranch(
-          depth + 1,
-          maxDepth,
-          length * 0.6,
-          radius * 0.6
-        );
-        childBranch.position.y = length;
-        childBranch.rotation.z = (Math.random() - 0.5) * 1.2;
-        childBranch.rotation.y = (i / numChildren) * Math.PI * 2 + Math.random() * 0.5;
-        branchGroup.add(childBranch);
-      }
-    }
-
-    return branchGroup;
-  };
-
-  for (let i = 0; i < 25; i++) {
-    let x, z, riverX, distToRiver;
-    let attempts = 0;
-    do {
-      x = (Math.random() - 0.5) * 60;
-      z = (Math.random() - 0.5) * 100;
-      riverX = Math.sin(z * 0.03) * 15.0;
-      distToRiver = Math.abs(x - riverX);
-      attempts++;
-    } while (distToRiver < 8 && attempts < 20);
-
-    const tree = createBranch(0, 3, 3 + Math.random() * 2, 0.2 + Math.random() * 0.1);
-    tree.position.set(x, floorY, z);
-    tree.rotation.y = Math.random() * Math.PI * 2;
-    const treeScale = 0.8 + Math.random() * 0.6;
-    tree.scale.setScalar(treeScale);
-    group.add(tree);
-  }
-
-  // ========================================
-  // 4. TWINKLING STARS (1500 particles with red tint)
-  // ========================================
-  const starCount = 1500;
-  const starPositions = new Float32Array(starCount * 3);
-  const starColors = new Float32Array(starCount * 3);
-  const starSizes = new Float32Array(starCount);
-  const starPhases = new Float32Array(starCount);
-
-  for (let i = 0; i < starCount; i++) {
-    const i3 = i * 3;
-    // Position in a dome
-    const theta = Math.random() * Math.PI * 2;
-    const phi = Math.random() * Math.PI * 0.5; // Upper hemisphere
-    const r = 120 + Math.random() * 80;
-    starPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
-    starPositions[i3 + 1] = r * Math.cos(phi) + 20;
-    starPositions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);
-
-    // Red-tinted colors: mix between (0.6, 0.2, 0.2) and (1.0, 0.8, 0.8)
-    const colorMix = Math.random();
-    starColors[i3] = 0.6 + colorMix * 0.4;     // R
-    starColors[i3 + 1] = 0.2 + colorMix * 0.6; // G
-    starColors[i3 + 2] = 0.2 + colorMix * 0.6; // B
-
-    starSizes[i] = 0.5 + Math.random() * 1.5;
-    starPhases[i] = Math.random() * Math.PI * 2;
-  }
-
-  const starGeo = new THREE.BufferGeometry();
-  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
-  starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
-  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
-  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
-
-  const starMat = new THREE.ShaderMaterial({
-    uniforms: {
-      uTime: { value: 0 }
-    },
-    vertexShader: `
-      attribute vec3 aColor;
-      attribute float aSize;
-      attribute float aPhase;
-      varying vec3 vColor;
-      varying float vTwinkle;
-      uniform float uTime;
-      void main() {
-        vColor = aColor;
-        vTwinkle = 0.5 + 0.5 * sin(uTime * 2.0 + aPhase);
-        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
-        gl_PointSize = aSize * (300.0 / -mvPosition.z) * vTwinkle;
-        gl_Position = projectionMatrix * mvPosition;
-      }
-    `,
-    fragmentShader: `
-      varying vec3 vColor;
-      varying float vTwinkle;
-      void main() {
-        float dist = length(gl_PointCoord - vec2(0.5));
-        if (dist > 0.5) discard;
-        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
-        gl_FragColor = vec4(vColor * vTwinkle, alpha);
-      }
-    `,
-    transparent: true,
-    depthWrite: false,
-    blending: THREE.AdditiveBlending
-  });
-
-  const stars = new THREE.Points(starGeo, starMat);
-  group.add(stars);
-
-  // ========================================
-  // 5. SPARK PARTICLES (200 rising from lava)
-  // ========================================
-  const sparkCount = 200;
-  const sparkPositions = new Float32Array(sparkCount * 3);
-  const sparkVelocities = new Float32Array(sparkCount * 3);
-  const sparkLifetimes = new Float32Array(sparkCount);
-  const sparkMaxLifetimes = new Float32Array(sparkCount);
-
-  const initSpark = (idx) => {
-    const i3 = idx * 3;
-    const z = (Math.random() - 0.5) * 100;
-    const riverX = Math.sin(z * 0.03) * 15.0 + 10.0;  // Account for terrain X shift
-    sparkPositions[i3] = riverX + (Math.random() - 0.5) * 4;
-    sparkPositions[i3 + 1] = floorY - 0.5 + Math.random() * 0.5;  // Account for terrain Y offset
-    sparkPositions[i3 + 2] = z;
-    sparkVelocities[i3] = (Math.random() - 0.5) * 0.02;
-    sparkVelocities[i3 + 1] = 0.03 + Math.random() * 0.05;
-    sparkVelocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
-    sparkLifetimes[idx] = 0;
-    sparkMaxLifetimes[idx] = 2 + Math.random() * 3;
-  };
-
-  for (let i = 0; i < sparkCount; i++) {
-    initSpark(i);
-    sparkLifetimes[i] = Math.random() * sparkMaxLifetimes[i]; // Stagger initial lifetimes
-  }
-
-  const sparkGeo = new THREE.BufferGeometry();
-  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
-
-  const sparkMat = new THREE.PointsMaterial({
-    color: 0xffaa00,
-    size: 0.3,
-    transparent: true,
-    opacity: 0.8,
-    blending: THREE.AdditiveBlending,
-    depthWrite: false
-  });
-
-  const sparks = new THREE.Points(sparkGeo, sparkMat);
-  group.add(sparks);
-
-  // ========================================
-  // 5b. ASH PARTICLES (dark floating)
-  // ========================================
-  const ashCount = 260;
-  const ashPositions = new Float32Array(ashCount * 3);
-  const ashVelocities = new Float32Array(ashCount * 3);
-  for (let i = 0; i < ashCount; i++) {
-    const i3 = i * 3;
-    ashPositions[i3] = (Math.random() - 0.5) * 80;
-    ashPositions[i3 + 1] = 1 + Math.random() * 10;
-    ashPositions[i3 + 2] = (Math.random() - 0.5) * 80;
-    ashVelocities[i3] = (Math.random() - 0.5) * 0.02;
-    ashVelocities[i3 + 1] = 0.01 + Math.random() * 0.015;
-    ashVelocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
-  }
-  const ashGeo = new THREE.BufferGeometry();
-  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPositions, 3));
-  const ashMat = new THREE.PointsMaterial({
-    color: 0x2b2b2b,
-    size: 0.06,  // Smaller than alien particles (0.0875)
-    transparent: true,
-    opacity: 0.5,
-    depthWrite: false
-  });
-  const ash = new THREE.Points(ashGeo, ashMat);
-  group.add(ash);
-
-  // ========================================
-  // 6. FLAME GEYSERS (periodic eruptions)
-  // ========================================
-  const geyserParticles = [];
-  let lastGeyserTime = 0;
-  const geyserInterval = 5000; // 5 seconds
-
-  const createGeyserBurst = (now) => {
-    const particleCount = 100;
-    // Spawn from mountainsides (outside valleyWidth), accounting for terrain X shift
-    const side = Math.random() > 0.5 ? 1 : -1;
-    const x = side * (valleyWidth + 5 + Math.random() * 20) + 10.0;  // Account for terrain X shift
-    const z = (Math.random() - 0.5) * 80;
-    const baseY = floorY + 5;
-
-    for (let i = 0; i < particleCount; i++) {
-      geyserParticles.push({
-        x: x + (Math.random() - 0.5) * 2,
-        y: baseY,
-        z: z + (Math.random() - 0.5) * 2,
-        vx: (Math.random() - 0.5) * 0.1,
-        vy: 0.8 + Math.random() * 0.5, // Strong upward velocity
-        vz: (Math.random() - 0.5) * 0.1,
-        life: 0,
-        maxLife: 1.5 + Math.random() * 1.5
-      });
-    }
-  };
-
-  const geyserGeo = new THREE.BufferGeometry();
-  const geyserPositions = new Float32Array(500 * 3); // Max 500 particles
-  geyserGeo.setAttribute('position', new THREE.BufferAttribute(geyserPositions, 3));
-  geyserGeo.setDrawRange(0, 0);
-
-  const geyserMat = new THREE.PointsMaterial({
-    color: 0xff6600,
-    size: 0.4,
-    transparent: true,
-    opacity: 0.9,
-    blending: THREE.AdditiveBlending,
-    depthWrite: false
-  });
-
-  const geyserPoints = new THREE.Points(geyserGeo, geyserMat);
-  group.add(geyserPoints);
-
-  // ========================================
-  // 7. FLAME PILLARS (distant fire columns)
-  // ========================================
-  const PILLAR_COUNT = 7;
-  const PARTICLES_PER_PILLAR = 35;
-  const TOTAL_FLAME_PILLAR_PARTICLES = PILLAR_COUNT * PARTICLES_PER_PILLAR;
-
-  // Canvas-drawn flame sprite texture (64x64, soft radial gradient)
-  const flameCanvas = document.createElement('canvas');
-  flameCanvas.width = 64;
-  flameCanvas.height = 64;
-  const fCtx = flameCanvas.getContext('2d');
-  const flameGrad = fCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
-  flameGrad.addColorStop(0, 'rgba(255,255,200,1.0)');
-  flameGrad.addColorStop(0.2, 'rgba(255,200,50,0.9)');
-  flameGrad.addColorStop(0.5, 'rgba(255,100,0,0.6)');
-  flameGrad.addColorStop(0.8, 'rgba(200,30,0,0.2)');
-  flameGrad.addColorStop(1, 'rgba(100,0,0,0.0)');
-  fCtx.fillStyle = flameGrad;
-  fCtx.fillRect(0, 0, 64, 64);
-  const flameTexture = new THREE.CanvasTexture(flameCanvas);
-
-  // Pillar positions: spread around the arena at 30-70 units distance
-  const pillarDefs = [];
-  for (let i = 0; i < PILLAR_COUNT; i++) {
-    const angle = (i / PILLAR_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
-    const dist = 35 + Math.random() * 40; // 35-75 units away
-    pillarDefs.push({
-      x: Math.cos(angle) * dist + 10.0, // Account for terrain X shift
-      z: Math.sin(angle) * dist,
-      height: 12 + Math.random() * 10, // Pillar height 12-22 units
-      radius: 1.5 + Math.random() * 1.5, // Base radius 1.5-3 units
-      speed: 0.6 + Math.random() * 0.4 // Rise speed multiplier
-    });
-  }
-
-  // Particle arrays
-  const flamePositions = new Float32Array(TOTAL_FLAME_PILLAR_PARTICLES * 3);
-  const flameSizes = new Float32Array(TOTAL_FLAME_PILLAR_PARTICLES);
-  const flameParticleData = []; // Per-particle: { pillarIdx, t (0-1 life progress) }
-
-  const initFlameParticle = (idx) => {
-    const pillarIdx = idx % PILLAR_COUNT;
-    const pillar = pillarDefs[pillarIdx];
-    const i3 = idx * 3;
-    const angle = Math.random() * Math.PI * 2;
-    const r = Math.random() * pillar.radius;
-    const t = Math.random(); // Start at random height for stagger
-
-    flamePositions[i3] = pillar.x + Math.cos(angle) * r;
-    flamePositions[i3 + 1] = floorY + t * pillar.height;
-    flamePositions[i3 + 2] = pillar.z + Math.sin(angle) * r;
-    flameSizes[idx] = 1.0 + (1.0 - t) * 2.0; // Larger at base, smaller at top
-
-    if (!flameParticleData[idx]) {
-      flameParticleData[idx] = { pillarIdx, speed: 0.3 + Math.random() * 0.3 };
-    }
-    flameParticleData[idx].t = t;
-    flameParticleData[idx].pillarIdx = pillarIdx;
-  };
-
-  for (let i = 0; i < TOTAL_FLAME_PILLAR_PARTICLES; i++) {
-    initFlameParticle(i);
-  }
-
-  const flamePillarGeo = new THREE.BufferGeometry();
-  flamePillarGeo.setAttribute('position', new THREE.BufferAttribute(flamePositions, 3));
-  flamePillarGeo.setAttribute('aSize', new THREE.BufferAttribute(flameSizes, 1));
-
-  // Use ShaderMaterial for per-particle size with sizeAttenuation
-  const flamePillarMat = new THREE.ShaderMaterial({
-    uniforms: {
-      uTexture: { value: flameTexture },
-      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
-    },
-    vertexShader: `
-      attribute float aSize;
-      varying float vAlpha;
-      uniform float uPixelRatio;
-      void main() {
-        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
-        gl_PointSize = aSize * uPixelRatio * (200.0 / -mvPosition.z);
-        gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
-        gl_Position = projectionMatrix * mvPosition;
-        // Fade particles that are very high (near top of pillar)
-        vAlpha = aSize / 3.0;
-      }
-    `,
-    fragmentShader: `
-      uniform sampler2D uTexture;
-      varying float vAlpha;
-      void main() {
-        vec4 texColor = texture2D(uTexture, gl_PointCoord);
-        gl_FragColor = vec4(texColor.rgb, texColor.a * vAlpha);
-      }
-    `,
-    transparent: true,
-    depthWrite: false,
-    blending: THREE.AdditiveBlending
-  });
-
-  const flamePillarPoints = new THREE.Points(flamePillarGeo, flamePillarMat);
-  group.add(flamePillarPoints);
-
-  // ========================================
-  // MOONS (existing)
-  // ========================================
-  const createMoon = (size, color, glowColor) => {
-    const mGroup = new THREE.Group();
-    const moonGeo = new THREE.IcosahedronGeometry(size, 2);
-    const moonMat = new THREE.MeshBasicMaterial({ color });
-    mGroup.add(new THREE.Mesh(moonGeo, moonMat));
-    const glowGeo = new THREE.IcosahedronGeometry(size * 1.2, 2);
-    const glowMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.3 });
-    mGroup.add(new THREE.Mesh(glowGeo, glowMat));
-    const farGlowGeo = new THREE.IcosahedronGeometry(size * 1.5, 2);
-    const farGlowMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.1 });
-    mGroup.add(new THREE.Mesh(farGlowGeo, farGlowMat));
-    return mGroup;
-  };
-  const moon1 = createMoon(10.5, 0xaa1111, 0xff2200);
-  moon1.position.set(20, 25, -100);
-  group.add(moon1);
-  const moon2 = createMoon(7.5, 0x880000, 0xaa0000);
-  moon2.position.set(-40, 20, -90);
-  group.add(moon2);
-  const moon3 = createMoon(5.4, 0x550000, 0x770000);
-  moon3.position.set(-20, 35, -95);
-  group.add(moon3);
-
-  // ========================================
-  // ANIMATION UPDATE
-  // ========================================
-  group.userData.update = (now, dt) => {
-    const time = now * 0.001;
-
-    // Terrain shader
-    if (material.userData.shader) {
-      material.userData.shader.uniforms.uTime.value = time;
-    }
-
-    // Star twinkle
-    starMat.uniforms.uTime.value = time;
-
-    // Lava glow position animation (circle)
-    lavaGlow.position.x = Math.sin(time * 0.3) * 15;
-    lavaGlow.position.z = Math.cos(time * 0.3) * 20;
-    lavaGlow.position.y = 5 + Math.sin(time * 0.5) * 2;
-
-    // Lava glow intensity pulse
-    lavaGlow.intensity = 2.0 + Math.sin(time * 2) * 0.5;
-
-    // Update spark particles - continuously spawn from lava river
-    const sparkPos = sparkGeo.attributes.position.array;
-
-    // Continuously spawn 10-15 new sparks each frame from random positions along the river
-    // (increased spawn rate for more dynamic lava effect)
-    const sparksToSpawn = 10 + Math.floor(Math.random() * 6);  // Was 6 + Math.floor(Math.random() * 4)
-    for (let s = 0; s < sparksToSpawn; s++) {
-      const randomIdx = Math.floor(Math.random() * sparkCount);
-      // Only respawn if lifetime is mostly elapsed or just starting fresh
-      if (sparkLifetimes[randomIdx] > sparkMaxLifetimes[randomIdx] * 0.8) {
-        initSpark(randomIdx);
-      }
-    }
-
-    for (let i = 0; i < sparkCount; i++) {
-      const i3 = i * 3;
-      sparkLifetimes[i] += dt * 0.001;
-
-      if (sparkLifetimes[i] > sparkMaxLifetimes[i]) {
-        initSpark(i);
-      } else {
-        sparkPos[i3] += sparkVelocities[i3];
-        sparkPos[i3 + 1] += sparkVelocities[i3 + 1];
-        sparkPos[i3 + 2] += sparkVelocities[i3 + 2];
-      }
-    }
-    sparkGeo.attributes.position.needsUpdate = true;
-
-    // Ash drift
-    const ashPos = ashGeo.attributes.position.array;
-    for (let i = 0; i < ashCount; i++) {
-      const i3 = i * 3;
-      ashPos[i3] += ashVelocities[i3] * dt * 0.6;
-      ashPos[i3 + 1] += ashVelocities[i3 + 1] * dt * 0.6;
-      ashPos[i3 + 2] += ashVelocities[i3 + 2] * dt * 0.6;
-      if (ashPos[i3 + 1] > 12) ashPos[i3 + 1] = 1;
-      if (ashPos[i3] > 40) ashPos[i3] = -40;
-      if (ashPos[i3] < -40) ashPos[i3] = 40;
-      if (ashPos[i3 + 2] > 40) ashPos[i3 + 2] = -40;
-      if (ashPos[i3 + 2] < -40) ashPos[i3 + 2] = 40;
-    }
-    ashGeo.attributes.position.needsUpdate = true;
-
-    // Geyser trigger and update
-    if (now - lastGeyserTime > geyserInterval) {
-      createGeyserBurst(now);
-      lastGeyserTime = now;
-    }
-
-    // Update geyser particles
-    const geyserPos = geyserGeo.attributes.position.array;
-    let activeCount = 0;
-    for (let i = geyserParticles.length - 1; i >= 0; i--) {
-      const p = geyserParticles[i];
-      p.life += dt * 0.001;
-
-      if (p.life > p.maxLife) {
-        geyserParticles.splice(i, 1);
-        continue;
-      }
-
-      p.x += p.vx;
-      p.y += p.vy;
-      p.z += p.vz;
-      p.vy -= 0.03; // Gravity
-
-      const idx = activeCount * 3;
-      geyserPos[idx] = p.x;
-      geyserPos[idx + 1] = p.y;
-      geyserPos[idx + 2] = p.z;
-      activeCount++;
-    }
-    geyserGeo.setDrawRange(0, activeCount);
-    geyserGeo.attributes.position.needsUpdate = true;
-
-    // Flame pillar animation
-    const fpPos = flamePillarGeo.attributes.position.array;
-    const fpSizes = flamePillarGeo.attributes.aSize.array;
-    for (let i = 0; i < TOTAL_FLAME_PILLAR_PARTICLES; i++) {
-      const pd = flameParticleData[i];
-      const pillar = pillarDefs[pd.pillarIdx];
-      const i3 = i * 3;
-      const dtSec = dt * 0.001;
-
-      // Advance particle up the pillar
-      pd.t += dtSec * pd.speed * pillar.speed / pillar.height;
-
-      if (pd.t >= 1.0) {
-        // Respawn at base
-        initFlameParticle(i);
-      } else {
-        // Slight horizontal drift as particle rises
-        const drift = (Math.random() - 0.5) * 0.05;
-        fpPos[i3] += drift;
-        fpPos[i3 + 1] += pd.speed * dtSec * pillar.speed;
-        fpPos[i3 + 2] += drift;
-
-        // Shrink as particle rises
-        fpSizes[i] = Math.max(0.3, (1.0 - pd.t) * 3.0);
-      }
-    }
-    flamePillarGeo.attributes.position.needsUpdate = true;
-    flamePillarGeo.attributes.aSize.needsUpdate = true;
-  };
-
-  // Hellscape floor HUD height: group.position.y = 0.05
-  group.position.set(26.599, 0.05, -0.486);
-  group.rotation.y = 0.248; // yaw: 14.21°
+// Get physics floor Y for current biome (matches visual floor HUD height)
+function getBiomeFloorY() {
+  return getBiomeFloorYModule(biomeSceneBiome, SCENE_Y_OFFSET);
 }
diff --git a/scenery.js b/scenery.js
index 686c843..e9a999c 100644
--- a/scenery.js
+++ b/scenery.js
@@ -656,24 +656,33 @@ export function initAmbientParticles(scene) {
 
   console.log('[scenery] Initialized ambient particles (60 primary, 30 secondary)');
 }
 
 export function updateAmbientParticles(dt, theme, playerPos) {
+  const smokeStrengthRaw = typeof window !== 'undefined' ? Number(window.debugSmokeStrength) : NaN;
+  const smokeStrength = Number.isFinite(smokeStrengthRaw)
+    ? Math.min(2, Math.max(0, smokeStrengthRaw))
+    : 1.0;
+
   // Update primary particles
-  if (!ambientParticles || !theme.particles) {
+  if (!ambientParticles || !theme.particles || smokeStrength <= 0.001) {
     if (ambientParticles) ambientParticles.visible = false;
   } else {
     ambientParticles.visible = true;
 
-    const maxCount = Math.min(theme.particles.count || AMBIENT_POOL, AMBIENT_POOL);
+    const baseCount = Math.min(theme.particles.count || AMBIENT_POOL, AMBIENT_POOL);
+    const maxCount = Math.max(1, Math.min(AMBIENT_POOL, Math.round(baseCount * smokeStrength)));
     ambientGeo.setDrawRange(0, maxCount);
 
     const particleSize = theme.particles.size || 0.05;
     if (ambientParticles.material.size !== particleSize) {
       ambientParticles.material.size = particleSize;
     }
 
+    const baseOpacity = theme.particles.opacity !== undefined ? theme.particles.opacity : 0.6;
+    ambientParticles.material.opacity = Math.min(1, baseOpacity * Math.max(0.05, smokeStrength));
+
     // Kaleidoscope: Color-shifting particles
     if (theme.particles.type === 'prism') {
       const now = performance.now();
       const hue = (now * 0.0001) % 1.0;
       const color = new THREE.Color().setHSL(hue, 1.0, 0.5);
@@ -894,23 +903,26 @@ export function updateAmbientParticles(dt, theme, playerPos) {
 
     ambientGeo.attributes.position.needsUpdate = true;
   }
 
   // Update secondary particles
-  if (!secondaryParticles || !theme.secondaryParticles) {
+  if (!secondaryParticles || !theme.secondaryParticles || smokeStrength <= 0.001) {
     if (secondaryParticles) secondaryParticles.visible = false;
   } else {
     secondaryParticles.visible = true;
 
-    const maxCount = Math.min(theme.secondaryParticles.count || SECONDARY_POOL, SECONDARY_POOL);
+    const baseCount = Math.min(theme.secondaryParticles.count || SECONDARY_POOL, SECONDARY_POOL);
+    const maxCount = Math.max(1, Math.min(SECONDARY_POOL, Math.round(baseCount * smokeStrength)));
     secondaryGeo.setDrawRange(0, maxCount);
 
     const particleSize = theme.secondaryParticles.size || 0.08;
     if (secondaryParticles.material.size !== particleSize) {
       secondaryParticles.material.size = particleSize;
     }
 
+    const baseOpacity = theme.secondaryParticles.opacity !== undefined ? theme.secondaryParticles.opacity : 0.5;
+    secondaryParticles.material.opacity = Math.min(1, baseOpacity * Math.max(0.05, smokeStrength));
     secondaryParticles.material.color.setHex(theme.secondaryParticles.color);
 
     const positions = secondaryGeo.attributes.position.array;
     const speed = theme.secondaryParticles.speed;
     const now = performance.now();
diff --git a/worker-monitor.js b/scripts/worker-monitor.js
similarity index 90%
rename from worker-monitor.js
rename to scripts/worker-monitor.js
index 0db856c..0b8b48c 100755
--- a/worker-monitor.js
+++ b/scripts/worker-monitor.js
@@ -2,27 +2,29 @@
 // ============================================================
 //  WORKER MONITOR - Quick zombie detection
 // ============================================================
 
 const { execSync } = require('child_process');
+const path = require('path');
+const REPO_ROOT = path.resolve(__dirname, '..');
 
 console.log('\n🐵 WORKER MONITOR - Quick health check\n');
 
 try {
   // Check git status
-  const gitStatus = execSync('git status --short', { encoding: 'utf8', cwd: __dirname });
+  const gitStatus = execSync('git status --short', { encoding: 'utf8', cwd: REPO_ROOT });
   console.log('📝 GIT STATUS:');
   console.log('  ' + gitStatus.trim() + '\n');
 
   // Show last 5 commits
-  const gitLog = execSync('git log --oneline -5', { encoding: 'utf8', cwd: __dirname });
+  const gitLog = execSync('git log --oneline -5', { encoding: 'utf8', cwd: REPO_ROOT });
   console.log('📜 RECENT COMMITS:');
   const lines = gitLog.trim().split('\n');
   lines.forEach(line => console.log('  ' + line + '\n'));
 
   // Simple zombie check based on git history
-  const lastCommitTime = execSync('git log -1 --format=%ct', { encoding: 'utf8', cwd: __dirname });
+  const lastCommitTime = execSync('git log -1 --format=%ct', { encoding: 'utf8', cwd: REPO_ROOT });
   const lastCommitSeconds = parseInt(lastCommitTime.trim());
   const now = Math.floor(Date.now() / 1000);
   const minutesSinceCommit = (now - lastCommitSeconds) / 60;
 
   if (minutesSinceCommit > 120) { // 2 hours since last commit
diff --git a/test-result.png b/test-result.png
deleted file mode 100644
index 6ec6733..0000000
Binary files a/test-result.png and /dev/null differ
diff --git a/test-game-comprehensive.js b/tests/automation/test-game-comprehensive.js
similarity index 100%
rename from test-game-comprehensive.js
rename to tests/automation/test-game-comprehensive.js
diff --git a/test-game.js b/tests/automation/test-game.js
similarity index 99%
rename from test-game.js
rename to tests/automation/test-game.js
index 494dcd9..2314c60 100644
--- a/test-game.js
+++ b/tests/automation/test-game.js
@@ -18,11 +18,11 @@ const MIME_TYPES = {
   '.glb': 'model/gltf-binary',
   '.gltf': 'model/gltf+json',
   '.ico': 'image/x-icon'
 };
 
-const ROOT_DIR = __dirname;
+const ROOT_DIR = path.resolve(__dirname, '../..');
 const PORT = 8000;
 
 function getMimeType(filePath) {
   return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
 }
diff --git a/supabase-test.js b/tests/manual/supabase-test.js
similarity index 100%
rename from supabase-test.js
rename to tests/manual/supabase-test.js
diff --git a/test-desktop-controls.js b/tests/manual/test-desktop-controls.js
similarity index 100%
rename from test-desktop-controls.js
rename to tests/manual/test-desktop-controls.js
diff --git a/vfx.js b/vfx.js
index 7b82bf8..2a24d05 100644
--- a/vfx.js
+++ b/vfx.js
@@ -1,237 +1,36 @@
 // ============================================================
-//  VFX — Voxel Death Explosions, Sparks, Projectile Trails
+//  VFX — Visual Effects Module
+//  Currently a stub - voxel death system remains in main.js
+//  due to tight coupling with triggerScreenShake and scene.
 // ============================================================
 
 import * as THREE from 'three';
 
-// ── Constants ─────────────────────────────────────────────
-const VOXEL_POOL_SIZE = 200;
-const SPARK_POOL_SIZE = 100;
-const GRAVITY = -9.8;
-
 // ── Module State ───────────────────────────────────────────
 let sceneRef = null;
-const sharedVoxelGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
-let voxelPool = [];
-let sparkPool = [];
-let activeVoxels = [];
-let activeSparks = [];
-let activeShockwaves = [];
 
 // ── Initialization ─────────────────────────────────────────
 export function initVFX(scene) {
   sceneRef = scene;
-
-  // Voxel pool
-  for (let i = 0; i < VOXEL_POOL_SIZE; i++) {
-    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
-    const mesh = new THREE.Mesh(sharedVoxelGeo, mat);
-    mesh.visible = false;
-    scene.add(mesh);
-    voxelPool.push({
-      mesh,
-      velocity: new THREE.Vector3(),
-      angularVel: new THREE.Vector3(),
-      life: 0,
-      maxLife: 0,
-      grounded: false,
-      groundTimer: 0,
-    });
-  }
-
-  // Spark sprite pool
-  const sparkCanvas = document.createElement('canvas');
-  sparkCanvas.width = 8;
-  sparkCanvas.height = 8;
-  const sCtx = sparkCanvas.getContext('2d');
-  sCtx.fillStyle = '#ffaa44';
-  sCtx.beginPath();
-  sCtx.arc(4, 4, 4, 0, Math.PI * 2);
-  sCtx.fill();
-  const sparkTex = new THREE.CanvasTexture(sparkCanvas);
-
-  for (let i = 0; i < SPARK_POOL_SIZE; i++) {
-    const mat = new THREE.SpriteMaterial({
-      map: sparkTex,
-      transparent: true,
-      opacity: 1,
-      blending: THREE.AdditiveBlending,
-      depthWrite: false,
-    });
-    const sprite = new THREE.Sprite(mat);
-    sprite.visible = false;
-    sprite.scale.set(0.05, 0.05, 1);
-    scene.add(sprite);
-    sparkPool.push({
-      sprite,
-      velocity: new THREE.Vector3(),
-      life: 0,
-      maxLife: 0,
-    });
-  }
-
-  console.log('[vfx] Initialized voxel pool (200) and spark pool (100)');
-}
-
-// ── Voxel Explosions ─────────────────────────────────────
-export function spawnVoxelExplosion(center, color, voxelCount = 6) {
-  for (let i = 0; i < voxelCount; i++) {
-    const v = voxelPool.find(v => !v.mesh.visible);
-    if (!v) break;
-
-    v.mesh.visible = true;
-    v.mesh.material.color.setHex(color);
-    v.mesh.position.copy(center);
-    v.mesh.position.x += (Math.random() - 0.5) * 0.5;
-    v.mesh.position.y += (Math.random() - 0.5) * 0.5;
-    v.mesh.position.z += (Math.random() - 0.5) * 0.5;
-    v.mesh.scale.setScalar(1);
-
-    v.velocity.set(
-      (Math.random() - 0.5) * 6,
-      Math.random() * 4 + 2,
-      (Math.random() - 0.5) * 6,
-    );
-    v.angularVel.set(
-      (Math.random() - 0.5) * 10,
-      (Math.random() - 0.5) * 10,
-      (Math.random() - 0.5) * 10,
-    );
-    v.life = 0;
-    v.maxLife = 2.0 + Math.random();
-    v.grounded = false;
-    v.groundTimer = 0;
-    activeVoxels.push(v);
-  }
-}
-
-// ── Sparks ─────────────────────────────────────────────────
-function spawnSparks(position, count) {
-  for (let i = 0; i < count; i++) {
-    const s = sparkPool.find(s => !s.sprite.visible);
-    if (!s) break;
-
-    s.sprite.visible = true;
-    s.sprite.position.copy(position);
-    s.sprite.material.opacity = 1;
-    s.velocity.set(
-      (Math.random() - 0.5) * 3,
-      Math.random() * 3 + 1,
-      (Math.random() - 0.5) * 3
-    );
-    s.life = 0;
-    s.maxLife = 0.3 + Math.random() * 0.3;
-    activeSparks.push(s);
-  }
-}
-
-// ── Shockwave (for charge shot) ───────────────────────────
-function spawnShockwave(position, direction, progress) {
-  const ring = new THREE.Mesh(
-    new THREE.TorusGeometry(0.3, 0.05, 8, 24),
-    new THREE.MeshBasicMaterial({
-      color: 0x00ffff,
-      transparent: true,
-      opacity: 0.6,
-      blending: THREE.AdditiveBlending,
-      depthWrite: false,
-    })
-  );
-  ring.position.copy(position);
-  ring.lookAt(position.clone().add(direction));
-  ring.userData = {
-    life: 0,
-    maxLife: 0.3,
-    expandRate: 8 + progress * 12,
-  };
-  sceneRef.add(ring);
-  activeShockwaves.push(ring);
+  console.log('[vfx] Initialized (stub - voxel system in main.js)');
 }
 
 // ── Update Loop ────────────────────────────────────────────
 export function updateVFX(dt) {
-  // Voxels
-  for (let i = activeVoxels.length - 1; i >= 0; i--) {
-    const v = activeVoxels[i];
-    v.life += dt;
-
-    if (v.life > v.maxLife) {
-      v.mesh.visible = false;
-      v.mesh.scale.setScalar(1);
-      activeVoxels.splice(i, 1);
-      continue;
-    }
-
-    if (!v.grounded) {
-      // Falling phase
-      v.velocity.y += GRAVITY * dt;
-      v.mesh.position.addScaledVector(v.velocity, dt);
-      v.mesh.rotation.x += v.angularVel.x * dt;
-      v.mesh.rotation.y += v.angularVel.y * dt;
-      v.mesh.rotation.z += v.angularVel.z * dt;
-
-      // Check ground collision
-      if (v.mesh.position.y <= 0.1) {
-        v.mesh.position.y = 0.1;
-        v.grounded = true;
-        v.groundTimer = 0;
-        spawnSparks(v.mesh.position, 3);
-      }
-    } else {
-      // Grounded burning phase
-      v.groundTimer += dt;
-      const burnT = v.groundTimer / 0.8;
-      v.mesh.scale.setScalar(Math.max(0, 1 - burnT));
-
-      // Shift to orange/red color
-      v.mesh.material.color.lerp(new THREE.Color(0xff4400), dt * 3);
-
-      // Spawn occasional sparks
-      if (Math.random() < dt * 5) {
-        spawnSparks(v.mesh.position, 1);
-      }
-
-      if (burnT >= 1) {
-        v.mesh.visible = false;
-        v.mesh.scale.setScalar(1);
-        activeVoxels.splice(i, 1);
-      }
-    }
-  }
-
-  // Sparks
-  for (let i = activeSparks.length - 1; i >= 0; i--) {
-    const s = activeSparks[i];
-    s.life += dt;
-
-    if (s.life > s.maxLife) {
-      s.sprite.visible = false;
-      activeSparks.splice(i, 1);
-      continue;
-    }
-
-    s.sprite.position.addScaledVector(s.velocity, dt);
-    s.velocity.y += GRAVITY * 0.5 * dt;
-
-    const t = s.life / s.maxLife;
-    s.sprite.material.opacity = 1 - t;
-    s.sprite.scale.setScalar(0.05 * (1 - t * 0.5));
-  }
-
-  // Shockwaves
-  for (let i = activeShockwaves.length - 1; i >= 0; i--) {
-    const ring = activeShockwaves[i];
-    ring.userData.life += dt;
-
-    if (ring.userData.life > ring.userData.maxLife) {
-      sceneRef.remove(ring);
-      activeShockwaves.splice(i, 1);
-      continue;
-    }
-
-    const t = ring.userData.life / ring.userData.maxLife;
-    const scale = 1 + t * ring.userData.expandRate * 0.3;
-    ring.scale.setScalar(scale);
-    ring.material.opacity = 0.6 * (1 - t);
-  }
+  // Voxel physics and explosion visuals are updated in main.js
+  // This stub exists for future VFX extraction if needed
 }
+
+// NOTE: The voxel death explosion system (spawnVoxelExplosion, voxelPool,
+// activeVoxels, updateVoxelPhysics, getDeathPattern) remains in main.js
+// because it depends on:
+// - triggerScreenShake() - defined in main.js
+// - playExplosionSound() - imported from audio.js in main.js
+// - scene access for mesh management
+//
+// The explosion visual system (spawnExplosionVisual, explosionVisuals,
+// updateExplosionVisuals) also remains in main.js due to similar dependencies
+// and usage by boss-death-cinematic.js.
+//
+// Future refactoring could extract these if we create a proper VFX
+// dependency injection pattern.

--- UNCOMMITTED CHANGES ---
 enemies.js          |   2 +-
 game-screenshot.png | Bin 569981 -> 570934 bytes
 game.js             |   8 ++++----
 hud.js              | 149 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++--------
 main.js             |   8 ++++++++
 5 files changed, 154 insertions(+), 13 deletions(-)

diff --git a/enemies.js b/enemies.js
index e63c193..45b369b 100644
--- a/enemies.js
+++ b/enemies.js
@@ -3052,11 +3052,11 @@ export function destroyEnemy(index, isCritical = false, isOverkill = false) {
   // Dispose material
   e.material.dispose();
   activeEnemies.splice(index, 1);
   _enemyMeshesDirty = true;  // Invalidate cache
 
-  return { position: pos, scoreValue: e.scoreValue, baseColor: color };
+  return { position: pos, scoreValue: e.scoreValue, baseColor: color, type: e.type };
 }
 
 /**
  * Remove all enemies (for level transitions).
  */
diff --git a/game-screenshot.png b/game-screenshot.png
index add32a4..b87d282 100644
Binary files a/game-screenshot.png and b/game-screenshot.png differ
diff --git a/game.js b/game.js
index 480682f..1c0ff92 100644
--- a/game.js
+++ b/game.js
@@ -127,12 +127,12 @@ export const game = {
   stateTimer: 0,
   spawnTimer: 0,
   killsWithoutHit: 0,
 
   handStats: {
-    left: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0 },
-    right: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0 }
+    left: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0, enemyKills: {} },
+    right: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0, enemyKills: {} }
   },
 
   justBossKill: false,
   nextUpgradeHand: 'left',  // Alternating hand for upgrades (left → right → left...)
 
@@ -216,12 +216,12 @@ export function resetGame() {
 
     stateTimer: 0,
     spawnTimer: 0,
     killsWithoutHit: 0,
     handStats: {
-      left: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0 },
-      right: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0 }
+      left: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0, enemyKills: {} },
+      right: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0, enemyKills: {} }
     },
     justBossKill: false,
     nextUpgradeHand: 'left',
     finalScore: 0,
     finalLevel: 0,
diff --git a/hud.js b/hud.js
index 48c9855..bfb7879 100644
--- a/hud.js
+++ b/hud.js
@@ -4131,48 +4131,114 @@ function createPauseMenu() {
   pauseMenuAnimation.numbersAnimated = false;
 
   applyPauseMenuRenderPriority(group);
 }
 
+// Upgrade icons and colors
+const UPGRADE_ICONS = {
+  rapid_fire: { icon: '🔥', color: '#ff6600' },
+  damage_up: { icon: '⚡', color: '#ffff00' },
+  spread_shot: { icon: '💫', color: '#00ffff' },
+  piercing: { icon: '🗡️', color: '#ff0000' },
+  homing: { icon: '🎯', color: '#00ff00' },
+  magnetize: { icon: '🧲', color: '#ff00ff' },
+  charge_shot: { icon: '💥', color: '#ff8800' },
+  bounce: { icon: '🔄', color: '#88ff00' },
+  chain_lightning: { icon: '⚡', color: '#00ffff' },
+};
+
+// Enemy type icons for kill tracking
+const ENEMY_ICONS = {
+  grunt: '👾',
+  tank: '🤖',
+  speeder: '💨',
+  shooter: '🔫',
+  bomber: '💣',
+  boss: '👹',
+};
+
+/**
+ * Create a separator line (glowing cyan)
+ */
+function createSeparator(width = 1.8) {
+  const group = new THREE.Group();
+  const lineGeo = new THREE.PlaneGeometry(width, 0.02);
+  const lineMat = createPauseMaterial(0x00ffff, 0.6);
+  const line = new THREE.Mesh(lineGeo, lineMat);
+  line.renderOrder = PAUSE_TEXT_RENDER_ORDER;
+  group.add(line);
+  
+  // Glow effect
+  const glowGeo = new THREE.PlaneGeometry(width, 0.06);
+  const glowMat = createPauseMaterial(0x00ffff, 0.15);
+  const glow = new THREE.Mesh(glowGeo, glowMat);
+  glow.position.z = -0.01;
+  glow.renderOrder = PAUSE_TEXT_RENDER_ORDER - 1;
+  group.add(glow);
+  
+  return group;
+}
+
 /**
  * Create blaster upgrade section for one hand (no nested background)
  */
 function createBlasterSection(hand, panelX) {
   const group = new THREE.Group();
+  let yPos = 1.1;
 
   // Title
   const titleText = makeSprite(`${hand.toUpperCase()} BLASTER`, {
     fontSize: scalePauseFont(48),
     color: '#00ffff',
     scale: scalePauseText(0.15),
     renderOrder: PAUSE_TEXT_RENDER_ORDER
   });
-  titleText.position.set(0, 1.1, 0.02);
+  titleText.position.set(0, yPos, 0.02);
   group.add(titleText);
+  yPos -= 0.3;
 
   // Weapon name
-  const weaponId = game.mainWeapon[hand];
+  const weaponId = game.mainWeapon[hand] || 'BLASTER';
   const weaponName = weaponId.replace(/_/g, ' ').toUpperCase();
   const weaponText = makeSprite(weaponName, {
     fontSize: scalePauseFont(36),
     color: '#ffffff',
     scale: scalePauseText(0.1),
     renderOrder: PAUSE_TEXT_RENDER_ORDER
   });
-  weaponText.position.set(0, 0.85, 0.02);
+  weaponText.position.set(0, yPos, 0.02);
   group.add(weaponText);
+  yPos -= 0.25;
+
+  // Separator
+  const sep1 = createSeparator(1.8);
+  sep1.position.set(0, yPos, 0.02);
+  group.add(sep1);
+  yPos -= 0.25;
+
+  // Upgrades header
+  const upgradesHeader = makeSprite('[UPGRADES]', {
+    fontSize: scalePauseFont(28),
+    color: '#888888',
+    scale: scalePauseText(0.08),
+    renderOrder: PAUSE_TEXT_RENDER_ORDER
+  });
+  upgradesHeader.position.set(0, yPos, 0.02);
+  group.add(upgradesHeader);
+  yPos -= 0.25;
 
   // Upgrades list (exclude dream_fragment - it's a collectible, not an upgrade)
   const upgrades = game.upgrades[hand] || {};
   const upgradeEntries = Object.entries(upgrades).filter(([id]) => id !== 'dream_fragment');
-  let yPos = 0.55;
 
   if (upgradeEntries.length > 0) {
     upgradeEntries.forEach(([id, count], index) => {
-      const upgradeText = makeSprite(`${id.replace(/_/g, ' ').toUpperCase()} x${count}`, {
+      const iconData = UPGRADE_ICONS[id] || { icon: '•', color: '#ffffff' };
+      const displayName = id.replace(/_/g, ' ').toUpperCase();
+      const upgradeText = makeSprite(`${iconData.icon} ${displayName} x${count}`, {
         fontSize: scalePauseFont(32),
-        color: '#ffffff',
+        color: iconData.color,
         scale: scalePauseText(0.09),
         renderOrder: PAUSE_TEXT_RENDER_ORDER
       });
       upgradeText.position.set(0, yPos - (index * 0.22), 0.02);
       upgradeText.userData = { isUpgradeSprite: true };
@@ -4180,22 +4246,44 @@ function createBlasterSection(hand, panelX) {
     });
     yPos -= (upgradeEntries.length * 0.22 + 0.15);
   } else {
     const noUpgradesText = makeSprite('NO UPGRADES', {
       fontSize: scalePauseFont(32),
-      color: '#888888',
+      color: '#666666',
       scale: scalePauseText(0.09),
       renderOrder: PAUSE_TEXT_RENDER_ORDER
     });
     noUpgradesText.position.set(0, yPos, 0.02);
     noUpgradesText.userData = { isUpgradeSprite: true };
     group.add(noUpgradesText);
     yPos -= 0.37;
   }
 
+  // Separator
+  const sep2 = createSeparator(1.8);
+  sep2.position.set(0, yPos, 0.02);
+  group.add(sep2);
+  yPos -= 0.25;
+
+  // Stats header
+  const statsHeader = makeSprite('[STATS]', {
+    fontSize: scalePauseFont(28),
+    color: '#888888',
+    scale: scalePauseText(0.08),
+    renderOrder: PAUSE_TEXT_RENDER_ORDER
+  });
+  statsHeader.position.set(0, yPos, 0.02);
+  group.add(statsHeader);
+  yPos -= 0.25;
+
   // Stats for this hand: KILLS, SHOTS, HITS, ACCURACY
-  const stats = game.handStats[hand] || { kills: 0, shotsFired: 0, shotsHit: 0 };
+  const handData = game.handStats[hand] || {};
+  const stats = {
+    kills: handData.kills ?? 0,
+    shotsFired: handData.shotsFired ?? 0,
+    shotsHit: handData.shotsHit ?? 0
+  };
   const accuracy = stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0;
 
   const statLines = [
     { label: 'KILLS', value: stats.kills, color: '#ff00ff' },
     { label: 'SHOTS', value: stats.shotsFired, color: '#00ffff' },
@@ -4212,10 +4300,55 @@ function createBlasterSection(hand, panelX) {
     });
     statText.position.set(0, yPos - (index * 0.22), 0.02);
     statText.userData = { isStatSprite: true, hand, statKey: stat.label };
     group.add(statText);
   });
+  yPos -= (statLines.length * 0.22 + 0.15);
+
+  // Separator
+  const sep3 = createSeparator(1.8);
+  sep3.position.set(0, yPos, 0.02);
+  group.add(sep3);
+  yPos -= 0.25;
+
+  // Enemies Killed section
+  const enemiesHeader = makeSprite('[ENEMIES KILLED]', {
+    fontSize: scalePauseFont(28),
+    color: '#888888',
+    scale: scalePauseText(0.08),
+    renderOrder: PAUSE_TEXT_RENDER_ORDER
+  });
+  enemiesHeader.position.set(0, yPos, 0.02);
+  group.add(enemiesHeader);
+  yPos -= 0.25;
+
+  // Enemy kills by type
+  const enemyKills = handData.enemyKills || {};
+  const enemyEntries = Object.entries(enemyKills).filter(([_, count]) => count > 0);
+
+  if (enemyEntries.length > 0) {
+    enemyEntries.forEach(([type, count], index) => {
+      const icon = ENEMY_ICONS[type] || '💀';
+      const enemyText = makeSprite(`${icon} ${type.toUpperCase()} x${count}`, {
+        fontSize: scalePauseFont(28),
+        color: '#ff6666',
+        scale: scalePauseText(0.08),
+        renderOrder: PAUSE_TEXT_RENDER_ORDER
+      });
+      enemyText.position.set(0, yPos - (index * 0.2), 0.02);
+      group.add(enemyText);
+    });
+  } else {
+    const noEnemiesText = makeSprite('NO ENEMIES', {
+      fontSize: scalePauseFont(28),
+      color: '#666666',
+      scale: scalePauseText(0.08),
+      renderOrder: PAUSE_TEXT_RENDER_ORDER
+    });
+    noEnemiesText.position.set(0, yPos, 0.02);
+    group.add(noEnemiesText);
+  }
 
   return group;
 }
 
 /**
diff --git a/main.js b/main.js
index a64faa3..2fa3dd6 100644
--- a/main.js
+++ b/main.js
@@ -8145,10 +8145,18 @@ function handleHit(enemyIndex, enemy, stats, hitPoint, controllerIndex, isExplod
 
       // Track kills for hand stats
       if (controllerIndex !== undefined) {
         const hand = getHandForController(controllerIndex);
         game.handStats[hand].kills++;
+        
+        // Track enemy kills by type
+        if (destroyData.type) {
+          if (!game.handStats[hand].enemyKills) {
+            game.handStats[hand].enemyKills = {};
+          }
+          game.handStats[hand].enemyKills[destroyData.type] = (game.handStats[hand].enemyKills[destroyData.type] || 0) + 1;
+        }
       }
 
       // Vampiric healing
       if (stats.vampiricInterval > 0 && game.totalKills % stats.vampiricInterval === 0) {
         game.health = Math.min(game.maxHealth, game.health + 1);
