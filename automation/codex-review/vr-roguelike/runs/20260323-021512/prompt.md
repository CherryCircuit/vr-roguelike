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
- Branch: gh-pages
- Base SHA: b04f5086436a472120c5cb7c7b7827e798ea0172
- Head SHA: 6668338e3771b3ba6cf2531624956b0d0cabc342
- Commit count in scope: 2
- Include uncommitted changes: 1

## Changed files
 .codex/review/nightly-review-schema.json |   60 +++++++++
 .codex/review/nightly-review-template.md |   59 +++++++++
 AGENTS.md                                |   11 ++
 desktop-controls.js                      |   21 ++-
 game-screenshot.png                      |  Bin 538929 -> 532852 bytes
 game.js                                  |   17 +++
 hud.js                                   |  283 +++++++++++++++++++++++++++--------------
 index.html                               |   92 +++++++++++---
 main.js                                  | 1054 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++------------------------------
 scenery.js                               |   20 ++-
 test-result.png                          |  Bin 387277 -> 511212 bytes
 11 files changed, 1293 insertions(+), 324 deletions(-)

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
diff --git a/desktop-controls.js b/desktop-controls.js
index 80ba53b..594131d 100644
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
+  // Default ON unless explicitly disabled from the HTML debug panel.
+  if (typeof window === 'undefined') return true;
+  return window.debugPositionPanel !== false;
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
diff --git a/game-screenshot.png b/game-screenshot.png
index 40864f5..013ccd9 100644
Binary files a/game-screenshot.png and b/game-screenshot.png differ
diff --git a/game.js b/game.js
index bb39c8f..860f284 100644
--- a/game.js
+++ b/game.js
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
diff --git a/hud.js b/hud.js
index 14262f9..268f836 100644
--- a/hud.js
+++ b/hud.js
@@ -2040,10 +2040,23 @@ export function showDebugMenu() {
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
@@ -2117,16 +2130,16 @@ export function showDebugMenu() {
 
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
@@ -3904,25 +3917,53 @@ let pauseCountdownInitialized = false;
 
 /**
  * Show the pause menu with stats and blaster upgrade info
  */
 let pauseMenuBasePosition = new THREE.Vector3();
+const PAUSE_MENU_SCALE = 0.78;          // ~40% smaller than previous 1.3 scale
+const PAUSE_MENU_DISTANCE = 2.6;        // Slightly farther from player in VR
+const PAUSE_MENU_RENDER_ORDER = 10000;  // Draw over floor HUD layers
+const PAUSE_MENU_FONT_MULTIPLIER = 2.5;
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
+      mat.depthTest = false;
+      mat.depthWrite = false;
+    });
+
+    child.renderOrder = PAUSE_MENU_RENDER_ORDER;
+  });
+}
 
 export function showPauseMenu() {
   pauseMenuGroup.visible = true;
-  pauseMenuGroup.scale.set(1.3, 1.3, 1.3);
+  pauseMenuGroup.scale.set(PAUSE_MENU_SCALE, PAUSE_MENU_SCALE, PAUSE_MENU_SCALE);
 
-  // Position menu at fixed world position (2m in front of camera when paused)
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
@@ -3931,10 +3972,11 @@ export function showPauseMenu() {
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
@@ -3985,12 +4027,12 @@ export function updatePauseMenu(now) {
  */
 function createPauseMenu() {
   const group = pauseMenuGroup;
 
   // Main panel with holographic border
-  const panelWidth = 3.5;
-  const panelHeight = 2.5;
+  const panelWidth = 4.6;
+  const panelHeight = 4.1;
 
   // Background panel
   const panelGeo = new THREE.PlaneGeometry(panelWidth, panelHeight);
   const panelMat = new THREE.MeshBasicMaterial({
     color: 0x0a0015,
@@ -4019,94 +4061,114 @@ function createPauseMenu() {
   });
 
   pauseMenuElements.panel = panel;
 
   // Left blaster section
-  const leftSection = createBlasterSection('left', -1.2);
-  leftSection.position.set(-0.9, 0.5, 0.02);
+  const leftSection = createBlasterSection('left', -1.25);
+  leftSection.position.set(-1.25, 0.72, 0.02);
   group.add(leftSection);
   pauseMenuElements.leftBlasterSection = leftSection;
 
   // Right blaster section
-  const rightSection = createBlasterSection('right', 1.2);
-  rightSection.position.set(0.9, 0.5, 0.02);
+  const rightSection = createBlasterSection('right', 1.25);
+  rightSection.position.set(1.25, 0.72, 0.02);
   group.add(rightSection);
   pauseMenuElements.rightBlasterSection = rightSection;
 
-  // Stats section
+  // Stats section (centered under blasters)
   const statsSection = createStatsSection();
-  statsSection.position.set(0, -0.5, 0.02);
+  statsSection.position.set(0, -0.58, 0.02);
   group.add(statsSection);
   pauseMenuElements.statsSection = statsSection;
 
-  // Resume button
+  // Resume button (moved up)
   const resumeBtn = createResumeButton();
-  resumeBtn.position.set(0, -1.0, 0.03);
+  resumeBtn.position.set(0, -1.38, 0.03);
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
  * Create blaster upgrade section for one hand
  */
 function createBlasterSection(hand, panelX) {
   const group = new THREE.Group();
 
   // Section background
   const bg = new THREE.Mesh(
-    new THREE.PlaneGeometry(1.3, 1.2),
+    new THREE.PlaneGeometry(1.9, 1.8),
     new THREE.MeshBasicMaterial({ color: 0x1a0033, transparent: true, opacity: 0.7, depthWrite: false })
   );
   bg.renderOrder = 0;  // Render before text
   group.add(bg);
 
   // Section border (pink)
   const borderMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
-  const borderWidth = 1.3;
-  const borderHeight = 0.05;
+  const borderWidth = 1.9;
+  const borderHeight = 0.06;
   [
-    { w: borderWidth, h: borderHeight, x: 0, y: 0.6 },
-    { w: borderWidth, h: borderHeight, x: 0, y: -0.6 },
+    { w: borderWidth, h: borderHeight, x: 0, y: 0.9 },
+    { w: borderWidth, h: borderHeight, x: 0, y: -0.9 },
   ].forEach(b => {
     const border = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), borderMat);
     border.position.set(b.x, b.y, 0.01);
     group.add(border);
   });
 
   // Title
-  const titleText = makeSprite(`${hand.toUpperCase()} BLASTER`, { fontSize: 48, color: '#00ffff', scale: 0.15 });
-  titleText.position.set(0, 0.45, 0.02);
+  const titleText = makeSprite(`${hand.toUpperCase()} BLASTER`, {
+    fontSize: scalePauseFont(48),
+    color: '#00ffff',
+    scale: scalePauseText(0.15)
+  });
+  titleText.position.set(0, 0.68, 0.02);
   group.add(titleText);
 
   // Weapon name
   const weaponId = game.mainWeapon[hand];
   const weaponName = weaponId.replace(/_/g, ' ').toUpperCase();
-  const weaponText = makeSprite(weaponName, { fontSize: 36, color: '#ffffff', scale: 0.1 });
-  weaponText.position.set(0, 0.32, 0.02);
+  const weaponText = makeSprite(weaponName, {
+    fontSize: scalePauseFont(36),
+    color: '#ffffff',
+    scale: scalePauseText(0.1)
+  });
+  weaponText.position.set(0, 0.38, 0.02);
   group.add(weaponText);
 
   // Upgrades list
   const upgrades = game.upgrades[hand] || {};
   const upgradeEntries = Object.entries(upgrades);
-  const yOffset = 0.15;
+  const yOffset = 0.08;
 
   if (upgradeEntries.length > 0) {
     upgradeEntries.forEach(([id, count], index) => {
-      const upgradeText = makeSprite(`${id.replace(/_/g, ' ').toUpperCase()} x${count}`, { fontSize: 36, color: '#ffffff', scale: 0.1 });
-      const yPos = yOffset - (index * 0.12);
+      const upgradeText = makeSprite(`${id.replace(/_/g, ' ').toUpperCase()} x${count}`, {
+        fontSize: scalePauseFont(36),
+        color: '#ffffff',
+        scale: scalePauseText(0.1)
+      });
+      const yPos = yOffset - (index * 0.24);
       upgradeText.position.set(0, yPos, 0.02);
+      upgradeText.userData = { isUpgradeSprite: true };
       group.add(upgradeText);
     });
   } else {
-    const noUpgradesText = makeSprite('No upgrades', { fontSize: 36, color: '#888888', scale: 0.1 });
-    noUpgradesText.position.set(0, 0.1, 0.02);
+    const noUpgradesText = makeSprite('NO UPGRADES', {
+      fontSize: scalePauseFont(36),
+      color: '#888888',
+      scale: scalePauseText(0.1)
+    });
+    noUpgradesText.position.set(0, 0.08, 0.02);
+    noUpgradesText.userData = { isUpgradeSprite: true };
     group.add(noUpgradesText);
   }
 
   return group;
 }
@@ -4117,43 +4179,58 @@ function createBlasterSection(hand, panelX) {
 function createStatsSection() {
   const group = new THREE.Group();
 
   // Background
   const bg = new THREE.Mesh(
-    new THREE.PlaneGeometry(3.2, 1.1),
+    new THREE.PlaneGeometry(4.2, 2.2),
     new THREE.MeshBasicMaterial({ color: 0x15002a, transparent: true, opacity: 0.7, depthWrite: false })
   );
   bg.renderOrder = 0;  // Render before text
   group.add(bg);
 
   // Title
-  const titleText = makeSprite('RUN STATISTICS', { fontSize: 48, color: '#ff00ff', scale: 0.15 });
-  titleText.position.set(0, 0.45, 0.02);
+  const titleText = makeSprite('RUN STATISTICS', {
+    fontSize: scalePauseFont(48),
+    color: '#ff00ff',
+    scale: scalePauseText(0.15)
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
+      scale: scalePauseText(0.1)
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
+      scale: scalePauseText(0.1)
+    });
+    text.position.set(-1.08, -0.34 - (index * 0.22), 0.02);
+    text.userData = { isPauseStatText: true };
     group.add(text);
   });
 
   // Canvas for charts (accuracy donut + damage bars)
   const canvas = document.createElement('canvas');
@@ -4163,12 +4240,12 @@ function createStatsSection() {
   const chartMat = new THREE.MeshBasicMaterial({
     map: chartTexture,
     transparent: true,
     side: THREE.DoubleSide
   });
-  const chartMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), chartMat);
-  chartMesh.position.set(0, -0.2, 0.02);
+  const chartMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.9), chartMat);
+  chartMesh.position.set(1.1, -0.82, 0.02);
   group.add(chartMesh);
 
   pauseMenuElements.chartCanvas = { canvas, texture: chartTexture, mesh: chartMesh };
 
   return group;
@@ -4234,11 +4311,11 @@ function updatePauseCharts() {
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
@@ -4253,116 +4330,138 @@ function updatePauseStatsNumbers() {
 
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
+      scale: scalePauseText(0.1)
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
+      scale: scalePauseText(0.1)
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
   // Update blaster section with current stats
   const upgrades = game.upgrades[hand] || {};
   const upgradeEntries = Object.entries(upgrades);
-  const yOffset = 0.15;
-
-  upgradeEntries.forEach(([id, count], index) => {
-    const upgradeText = makeSprite(`${id.replace(/_/g, ' ').toUpperCase()} x${count}`, { fontSize: 0.07, color: '#ffffff' });
-    const yPos = yOffset - (index * 0.12);
-    upgradeText.position.set(0, yPos, 0.03);
-    upgradeText.userData = { isUpgradeSprite: true };
-    section.add(upgradeText);
-  });
+  const yOffset = 0.08;
+
+  if (upgradeEntries.length > 0) {
+    upgradeEntries.forEach(([id, count], index) => {
+      const upgradeText = makeSprite(`${id.replace(/_/g, ' ').toUpperCase()} x${count}`, {
+        fontSize: scalePauseFont(36),
+        color: '#ffffff',
+        scale: scalePauseText(0.1)
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
+      scale: scalePauseText(0.1)
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
 
   // Button background
-  const btnWidth = 1.5;
-  const btnHeight = 0.4;
+  const btnWidth = 2.0;
+  const btnHeight = 0.56;
   const btnBg = new THREE.Mesh(
     new THREE.PlaneGeometry(btnWidth, btnHeight),
     new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 })
   );
   group.add(btnBg);
 
   // Button border
   const borderMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
   const borderWidth = btnWidth;
-  const borderHeight = 0.05;
+  const borderHeight = 0.06;
   [
     { w: borderWidth, h: borderHeight, x: 0, y: btnHeight / 2 },
     { w: borderWidth, h: borderHeight, x: 0, y: -btnHeight / 2 },
   ].forEach(b => {
     const border = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), borderMat);
     border.position.set(b.x, b.y, 0.01);
     group.add(border);
   });
 
   // Button text
-  const text = makeSprite('RESUME', { fontSize: 42, color: '#00ffff', scale: 0.14 });
+  const text = makeSprite('RESUME', {
+    fontSize: scalePauseFont(38),
+    color: '#00ffff',
+    scale: scalePauseText(0.12)
+  });
   text.position.set(0, 0, 0.02);
   group.add(text);
 
   // Store button data for raycasting
   group.userData = {
diff --git a/index.html b/index.html
index a9f401b..6b177f1 100644
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
diff --git a/main.js b/main.js
index 9a6cbf1..5a69126 100644
--- a/main.js
+++ b/main.js
@@ -70,11 +70,11 @@ import {
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
@@ -226,10 +226,14 @@ let horizonRingRef = null;
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
@@ -257,10 +261,17 @@ let floorFlashTimer = 0;
 let floorFlashing = false;
 
 // Pre-allocated raycasters (reused to avoid per-frame GC)
 const _uiRaycaster = new THREE.Raycaster();
 
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
@@ -407,10 +418,34 @@ const MAX_REFLECTOR_DRONES = 2;
 
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
@@ -420,10 +455,15 @@ function init() {
 
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
@@ -642,11 +682,11 @@ function initSelectiveBloom() {
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
@@ -655,10 +695,198 @@ function resizeBloomComposer() {
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
 //  ENVIRONMENT
 // ============================================================
 function createEnvironment() {
   // Grid floor - reduced size to cut ugly distant static
@@ -749,13 +977,16 @@ function createEnvironment() {
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
@@ -809,10 +1040,15 @@ function clearBiomeScene() {
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
@@ -1185,15 +1421,21 @@ function applyThemeForLevel(level) {
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
@@ -1276,10 +1518,11 @@ function hideBaseEnvironment() {
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
 
@@ -1290,10 +1533,11 @@ function restoreBaseEnvironment() {
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
@@ -1309,10 +1553,11 @@ function enterDreamWorldScene() {
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
 
@@ -1331,11 +1576,11 @@ function enterDreamWorldScene() {
 
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
@@ -1347,11 +1592,11 @@ function exitDreamWorldScene() {
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
@@ -1404,10 +1649,138 @@ function startEnvironmentFade(direction, duration, onComplete) {
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
+    showFloatingMessage('DREAM FRAGMENT ACQUIRED', '#cc88ff', 3.0, false);
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
 
@@ -1659,10 +2032,144 @@ function createAtmosphere() {
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
@@ -5719,10 +6226,16 @@ function beginGameplayFromReady() {
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
@@ -5801,10 +6314,17 @@ function startGame() {
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
@@ -6375,10 +6895,11 @@ function initProjectilePool() {
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
@@ -6386,10 +6907,11 @@ function initProjectilePool() {
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
@@ -6397,10 +6919,11 @@ function initProjectilePool() {
 
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
@@ -6408,10 +6931,11 @@ function initProjectilePool() {
 
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
@@ -8199,20 +8723,49 @@ function updateProjectiles(dt) {
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
@@ -8622,10 +9175,13 @@ function render(timestamp) {
   // Update desktop controls (WASD + mouse) in all states when enabled AND NOT in VR
   if (!renderer.xr.isPresenting) {
     updateDesktopControls(dt);
   }
 
+  // Poll VR menu/thumbstick buttons so at least one hardware button can pause.
+  updateVRPauseButton(now);
+
   let st = game.state;
   if (bossDeathCinematic.active && st !== State.BOSS_DEATH_CINEMATIC) {
     st = State.BOSS_DEATH_CINEMATIC;
     game.state = st;
   }
@@ -8649,11 +9205,19 @@ function render(timestamp) {
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
@@ -9472,10 +10036,19 @@ function render(timestamp) {
 
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
@@ -9489,13 +10062,10 @@ function render(timestamp) {
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
@@ -9540,10 +10110,15 @@ function rebuildBiomeScene(biomeId, theme) {
     buildAlienPlanetScene(biomeSceneGroup);
   } else if (theme.customScene === 'hellscape_lava') {
     buildHellscapeLavaScene(biomeSceneGroup);
   }
 
+  // Cleanup stale legacy meshes and give all biome PlaneGeometry meshes
+  // unique, readable names for debug look-at tooling.
+  cleanupLegacyShapeGeometry(scene);
+  assignBiomePlaneNames(biomeSceneGroup, biomeId);
+
   // Register all biome scene materials for environment fade
   // This ensures everything fades to black during boss death cinematic
   if (biomeSceneGroup) {
     biomeSceneGroup.traverse((child) => {
       if (child.isMesh && child.material) {
@@ -9624,10 +10199,17 @@ function logCylinderColors() {
 }
 
 function buildSynthwaveValleyScene(group) {
   const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
   const floorY = floorHeight;
+
+  // Reset synth visual tuning refs each time this biome scene is rebuilt.
+  synthVisualRefs.terrainUniforms = null;
+  synthVisualRefs.sunOuterGlowMat = null;
+  synthVisualRefs.sunGlowMat = null;
+  synthVisualRefs.sunCoreMat = null;
+
   // Fix for synthwave valley lighting regression: the extracted scene lost the
   // original standalone scene's punch after we removed postprocessing, so raise
   // the local material brightness without affecting other biomes.
   const brightness = 1.0;
 
@@ -9660,10 +10242,12 @@ function buildSynthwaveValleyScene(group) {
   const terrainUniforms = {
     uGridColor: { value: new THREE.Color(0x4368AC) },     // Gridlines
     uBaseColor: { value: new THREE.Color(0x0C1347) },     // Primary/base color
     uFogColor: { value: new THREE.Color(0x2C0051) },      // EXACT: Sun top purple fog
     uFlashIntensity: { value: 0.0 },
+    uGlowIntensity: { value: getVisualTuning().glowStrength },
+    uFogIntensity: { value: getVisualTuning().fogIntensity },
   };
   const terrainGeo = new THREE.PlaneGeometry(2000, 2000, 240, 240);
   terrainGeo.rotateX(-Math.PI / 2);
   const terrainMat = new THREE.ShaderMaterial({
     uniforms: terrainUniforms,
@@ -9674,23 +10258,28 @@ function buildSynthwaveValleyScene(group) {
     polygonOffsetFactor: 2.0,
     polygonOffsetUnits: 8.0,
     // Fix for synthwave floor popping in VR: keep the terrain static and use the
     // built-in modelViewMatrix projection instead of manual projection math.
     vertexShader: `varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; varying float vFogDistance; vec2 hash2(vec2 p){ p=vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return -1.0+2.0*fract(sin(p)*43758.5453123);} float noise(in vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(dot(hash2(i+vec2(0.0,0.0)), f-vec2(0.0,0.0)), dot(hash2(i+vec2(1.0,0.0)), f-vec2(1.0,0.0)), u.x), mix(dot(hash2(i+vec2(0.0,1.0)), f-vec2(0.0,1.0)), dot(hash2(i+vec2(1.0,1.0)), f-vec2(1.0,1.0)), u.x), u.y);} float fbm(vec2 p){ float value=0.0; float amp=0.5; for(int i=0;i<5;i++){ value+=amp*noise(p); p*=2.0; amp*=0.5;} return value;} float ridgeNoise(vec2 p){ float sum=0.0; float amp=0.55; for(int i=0;i<5;i++){ float n=noise(p); n=1.0-abs(n); n*=n; sum+=n*amp; p*=2.15; amp*=0.5;} return sum;} void main(){ vec3 pos=position; vec2 p=pos.xz; float valleyMask=smoothstep(0.0,1.0, clamp(abs(pos.x)/240.0,0.0,1.0)); float broad=fbm(p*vec2(0.0035,0.0024))*16.0; float detail=fbm(p*vec2(0.012,0.01))*5.0; float ridges=ridgeNoise((p+vec2(0.0,-260.0))*0.008)*180.0; float mountainMask=pow(valleyMask,1.55); float centerDip=-10.0*(1.0-valleyMask); float distanceFade=smoothstep(750.0,120.0, abs(pos.z+120.0)); float h=broad+detail+centerDip; h+=ridges*mountainMask*distanceFade; if(pos.z>700.0){ h*=smoothstep(1000.0,700.0,pos.z);} pos.y=h; vec4 world=modelMatrix*vec4(pos,1.0); vec4 mvPosition=modelViewMatrix*vec4(pos,1.0); vWorldPos=world.xyz; vObjPos=pos; vHeight=h; vFogDistance=length(mvPosition.xyz); gl_Position=projectionMatrix*mvPosition; }`,
-    fragmentShader: `uniform vec3 uGridColor; uniform vec3 uBaseColor; uniform vec3 uFogColor; uniform float uFlashIntensity; varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; varying float vFogDistance; float gridLine(float coord,float width){ float g=abs(fract(coord-0.5)-0.5)/fwidth(coord); return 1.0-smoothstep(width,width+1.0,g);} void main(){ float gridScale=1.0/6.0; float dist=length(vObjPos.xz); float lineW=0.25*smoothstep(1000.0,100.0,dist); float gx=gridLine(vObjPos.x*gridScale,lineW); float gz=gridLine(vObjPos.z*gridScale,lineW); float grid=max(gx,gz); float glowPath=exp(-abs(vObjPos.x)*0.014)*smoothstep(350.0,-150.0,vObjPos.z); grid=max(grid, glowPath*0.34); vec3 col=mix(uBaseColor, uGridColor, grid); float ridgeGlow=smoothstep(48.0,160.0,vHeight)*smoothstep(100.0,350.0,abs(vObjPos.x)); col+=uGridColor*ridgeGlow*0.18; float fogAmount=1.0-exp(-0.0000012*vFogDistance*vFogDistance); col=mix(col,uFogColor, clamp(fogAmount*0.58,0.0,1.0)); vec3 flashColor=vec3(1.0,0.0,0.0); col=mix(col,flashColor,uFlashIntensity); gl_FragColor=vec4(col*${brightness.toFixed(2)},1.0); }`,
+    fragmentShader: `uniform vec3 uGridColor; uniform vec3 uBaseColor; uniform vec3 uFogColor; uniform float uFlashIntensity; uniform float uGlowIntensity; uniform float uFogIntensity; varying vec3 vWorldPos; varying vec3 vObjPos; varying float vHeight; varying float vFogDistance; float gridLine(float coord,float width){ float g=abs(fract(coord-0.5)-0.5)/fwidth(coord); return 1.0-smoothstep(width,width+1.0,g);} void main(){ float gridScale=1.0/6.0; float dist=length(vObjPos.xz); float lineW=0.25*smoothstep(1000.0,100.0,dist); float gx=gridLine(vObjPos.x*gridScale,lineW); float gz=gridLine(vObjPos.z*gridScale,lineW); float grid=max(gx,gz); float glowPath=exp(-abs(vObjPos.x)*0.014)*smoothstep(350.0,-150.0,vObjPos.z); grid=max(grid, glowPath*0.34*uGlowIntensity); vec3 col=mix(uBaseColor, uGridColor, clamp(grid*uGlowIntensity,0.0,1.0)); float ridgeGlow=smoothstep(48.0,160.0,vHeight)*smoothstep(100.0,350.0,abs(vObjPos.x)); col+=uGridColor*ridgeGlow*0.18*uGlowIntensity; float fogAmount=1.0-exp(-0.0000012*vFogDistance*vFogDistance); col=mix(col,uFogColor, clamp(fogAmount*uFogIntensity,0.0,1.0)); vec3 flashColor=vec3(1.0,0.0,0.0); col=mix(col,flashColor,uFlashIntensity); gl_FragColor=vec4(col*${brightness.toFixed(2)},1.0); }`,
   });
   const terrain = new THREE.Mesh(terrainGeo, terrainMat);
+  terrain.name = 'synthwave-valley-floor-and-mountains';
+  terrain.userData.planeName = 'synthwave-valley-floor-and-mountains';
   terrain.position.set(0, floorY + 1.5, -700);
   terrain.frustumCulled = false;
   terrain.layers.enable(BLOOM_LAYER);  // Selective bloom: floor grid glows
   group.add(terrain);
   registerFadeMaterial(terrainMat);
   // Store terrain material for damage flash
   biomeTerrainMaterials.push({ type: 'shader', material: terrainMat });
 
+  synthVisualRefs.terrainUniforms = terrainUniforms;
+
   // Sun + glow - flat planes (no billboard), using retro synthwave PNG
   const sunGroup = new THREE.Group();
+  sunGroup.name = 'synthwave-sun-group';
   sunGroup.position.set(0, 270, -1700);  // Y raised so full circle is above horizon
   group.add(sunGroup);
 
   const makeRadial = (inner, outer) => {
     const c = document.createElement('canvas');
@@ -9708,23 +10297,29 @@ function buildSynthwaveValleyScene(group) {
   const sunGlowTex = makeRadial('rgba(255,255,255,1.0)', 'rgba(254,151,83,0.85)');
   const sunOuterGlowTex = makeRadial('rgba(254,151,83,0.9)', 'rgba(224,1,134,0.3)');
 
   // Outer massive glow (flat plane, no billboard, fog-proof, no depth test)
   const sunOuterGlowMat = new THREE.MeshBasicMaterial({ map: sunOuterGlowTex, color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
-  const sunOuterGlow = new THREE.Mesh(new THREE.PlaneGeometry(1080, 1080), sunOuterGlowMat);
+  const sunOuterGlow = new THREE.Mesh(new THREE.PlaneGeometry(875, 875), sunOuterGlowMat); // 10% smaller again (81% of original)
+  sunOuterGlow.name = 'synthwave-sun-outer-glow';
+  sunOuterGlow.userData.planeName = 'synthwave-sun-outer-glow';
   sunOuterGlow.frustumCulled = false;
   sunOuterGlow.renderOrder = -3;
   sunGroup.add(sunOuterGlow);
   registerFadeMaterial(sunOuterGlowMat);
+  synthVisualRefs.sunOuterGlowMat = sunOuterGlowMat;
 
   // Main bright glow (fog-proof, no depth test)
   const sunGlowMat = new THREE.MeshBasicMaterial({ map: sunGlowTex, color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
-  const sunGlow = new THREE.Mesh(new THREE.PlaneGeometry(864, 864), sunGlowMat);
+  const sunGlow = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), sunGlowMat); // 10% smaller again (81% of original)
+  sunGlow.name = 'synthwave-sun-main-glow';
+  sunGlow.userData.planeName = 'synthwave-sun-main-glow';
   sunGlow.frustumCulled = false;
   sunGlow.renderOrder = -2;
   sunGroup.add(sunGlow);
   registerFadeMaterial(sunGlowMat);
+  synthVisualRefs.sunGlowMat = sunGlowMat;
 
   // Retro synthwave sun disc from PNG (flat plane, no billboard)
   // PNG has white background - process to make white pixels transparent
   const sunDiscTex = new THREE.TextureLoader().load('assets/sun-retro.png');
   const sunCoreMat = new THREE.MeshBasicMaterial({ map: sunDiscTex, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, fog: false });
@@ -9747,15 +10342,18 @@ function buildSynthwaveValleyScene(group) {
     sunCoreMat.map = new THREE.CanvasTexture(c);
     sunCoreMat.map.needsUpdate = true;
     sunCoreMat.needsUpdate = true;
   };
   sunDiscImg.src = 'assets/sun-retro.png';
-  const sunCore = new THREE.Mesh(new THREE.PlaneGeometry(576, 576), sunCoreMat);
+  const sunCore = new THREE.Mesh(new THREE.PlaneGeometry(466, 466), sunCoreMat); // 10% smaller again (81% of original)
+  sunCore.name = 'synthwave-sun-core-disc';
+  sunCore.userData.planeName = 'synthwave-sun-core-disc';
   sunCore.frustumCulled = false;
   sunCore.renderOrder = -1;
   sunGroup.add(sunCore);
   registerFadeMaterial(sunCoreMat);
+  synthVisualRefs.sunCoreMat = sunCoreMat;
 
   // Log cylinder colors for debugging
   logCylinderColors();
 
   // Fix for synthwave valley "jiggle": keep the imported scene static in-game.
@@ -9834,10 +10432,12 @@ function buildDesertNightScene(group) {
   }
   geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
   geometry.computeVertexNormals();
   const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
   const terrain = new THREE.Mesh(geometry, material);
+  terrain.name = 'desert-night-terrain';
+  terrain.userData.planeName = 'desert-night-terrain';
   terrain.position.y = floorY;
   terrain.frustumCulled = false;
   terrain.receiveShadow = true;  // Sand dunes receive cactus shadows
   group.add(terrain);
   registerFadeMaterial(material);
@@ -9850,10 +10450,12 @@ function buildDesertNightScene(group) {
     opacity: 0,
     depthWrite: false,
     side: THREE.DoubleSide
   });
   const flashPlane = new THREE.Mesh(flashGeo, flashMat);
+  flashPlane.name = 'desert-night-damage-flash-plane';
+  flashPlane.userData.planeName = 'desert-night-damage-flash-plane';
   flashPlane.rotation.x = -Math.PI / 2;
   flashPlane.position.y = floorY + 0.02; // Very close to terrain surface
   flashPlane.frustumCulled = false;
   group.add(flashPlane);
   biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });
@@ -10110,20 +10712,22 @@ function buildDesertNightScene(group) {
 function buildAlienPlanetScene(group) {
   const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
   const floorY = floorHeight - 0.3; // Move everything down 0.3 units to fix floor HUD being under floor
 
   // Ground
-  const groundGeo = new THREE.PlaneGeometry(300, 300, 120, 120);
+  const groundGeo = new THREE.PlaneGeometry(300, 300, 84, 84);
   const groundPositions = groundGeo.attributes.position;
   for (let i = 0; i < groundPositions.count; i++) {
     const x = groundPositions.getX(i);
     const y = groundPositions.getY(i);
     groundPositions.setZ(i, Math.sin(x * 0.03) * Math.cos(y * 0.03) * 0.3);
   }
   groundGeo.computeVertexNormals();
   const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0510, roughness: 1, metalness: 0, flatShading: true });
   const ground = new THREE.Mesh(groundGeo, groundMat);
+  ground.name = 'alien-planet-ground-plane';
+  ground.userData.planeName = 'alien-planet-ground-plane';
   ground.rotation.x = -Math.PI / 2;
   ground.position.y = floorY;
   ground.frustumCulled = false;
   group.add(ground);
 
@@ -10135,10 +10739,12 @@ function buildAlienPlanetScene(group) {
     opacity: 0,
     depthWrite: false,
     side: THREE.DoubleSide
   });
   const flashPlane = new THREE.Mesh(flashGeo, flashMat);
+  flashPlane.name = 'alien-planet-damage-flash-plane';
+  flashPlane.userData.planeName = 'alien-planet-damage-flash-plane';
   flashPlane.rotation.x = -Math.PI / 2;
   flashPlane.position.y = floorY + 0.1;
   flashPlane.frustumCulled = false;
   group.add(flashPlane);
   biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });
@@ -10186,101 +10792,114 @@ function buildAlienPlanetScene(group) {
     const z = t * 120 - 60;
     riverPoints.push(new THREE.Vector3(x, 0.1, z));
   }
   // Green river-object REMOVED - was blocking view and looking out of place
 
-  // Mountains - 3 rings of procedural jagged mountains
+  // Mountains - keep silhouette, reduce per-biome geometry churn by reusing assets.
+  const alienMountainMaterial = new THREE.MeshStandardMaterial({
+    color: 0x1a1020,
+    roughness: 0.9,
+    metalness: 0.1,
+    flatShading: true
+  });
+  const alienMountainGeometries = [5, 6, 7].map((segments) => new THREE.ConeGeometry(1, 1, segments));
+
   const createMountain = (x, z, scale) => {
-    const peakCount = 1 + Math.floor(Math.random() * 3);
+    const peakCount = 1 + Math.floor(Math.random() * 2);
     const mountainGroup = new THREE.Group();
     for (let p = 0; p < peakCount; p++) {
       const height = (12 + Math.random() * 18) * scale;
-      const radius = Math.max(2.5, (2 + Math.random() * 3) * scale); // Minimum radius of 2.5 for no skinny pyramids
-      const peakGeo = new THREE.ConeGeometry(radius, height, 5 + Math.floor(Math.random() * 3));
-      const peakMat = new THREE.MeshStandardMaterial({
-        color: 0x1a1020,
-        roughness: 0.9,
-        metalness: 0.1,
-        flatShading: true
-      });
-      const peak = new THREE.Mesh(peakGeo, peakMat);
+      const radius = Math.max(2.5, (2 + Math.random() * 3) * scale);
+      const peakGeo = alienMountainGeometries[Math.floor(Math.random() * alienMountainGeometries.length)];
+      const peak = new THREE.Mesh(peakGeo, alienMountainMaterial);
       peak.position.set(
         (Math.random() - 0.5) * 4 * scale,
         height / 2,
         (Math.random() - 0.5) * 4 * scale
       );
-      // Issue 5: Enable shadows for mountains
+      peak.scale.set(radius, height, radius);
       peak.castShadow = true;
       peak.receiveShadow = true;
       mountainGroup.add(peak);
     }
     mountainGroup.position.set(x, floorY, z);
-    mountainGroup.frustumCulled = false; // Prevent culling at distance
+    mountainGroup.frustumCulled = false;
     return mountainGroup;
   };
 
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
+  // Mountains - trimmed ring count. Still surrounds the arena, fewer draw calls.
+  const mountainCount = 10;
+  const mountainRadius = 40;
+  for (let i = 0; i < mountainCount; i++) {
+    const angle = (i / mountainCount) * Math.PI * 2 + Math.random() * 0.3;
+    const r = mountainRadius + (Math.random() - 0.5) * 10;
+    const x = Math.cos(angle) * r;
+    const z = Math.sin(angle) * r;
+    group.add(createMountain(x, z, 1.2 + Math.random() * 0.6));
   }
 
   // Alien Plants - 3 types along river (removed fern type - too expensive with 40-72 meshes)
   const alienPlants = [];
+  const alienPlantAssets = {
+    spireGeo: new THREE.ConeGeometry(1, 1, 6),
+    spireMat: new THREE.MeshStandardMaterial({
+      color: 0x00aa33,
+      emissive: 0x00ff44,
+      emissiveIntensity: 0.6,
+      roughness: 0.5
+    }),
+    orbGeo: new THREE.IcosahedronGeometry(1, 1),
+    orbMat: new THREE.MeshBasicMaterial({ color: 0x00ff66 }),
+    crystalGeo: new THREE.ConeGeometry(1, 1, 3),
+    crystalMat: new THREE.MeshStandardMaterial({
+      color: 0x00cc55,
+      emissive: 0x00ff66,
+      emissiveIntensity: 0.7,
+      roughness: 0.3
+    }),
+    stemGeo: new THREE.CylinderGeometry(1, 1, 1, 8),
+    stemMat: new THREE.MeshStandardMaterial({ color: 0x204020, roughness: 0.8 }),
+    capGeo: new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
+    capMat: new THREE.MeshStandardMaterial({
+      color: 0x00aa44,
+      emissive: 0x00ff55,
+      emissiveIntensity: 0.5,
+      roughness: 0.6
+    })
+  };
 
   const createAlienPlant = (x, z, type) => {
     const plantGroup = new THREE.Group();
 
     if (type === 0) {
-      // Glowing Spire - tall thin cone with glowing orb on top
+      // Glowing spire
       const height = 3 + Math.random() * 5;
-      const spireGeo = new THREE.ConeGeometry(0.2, height, 6);
-      const spireMat = new THREE.MeshStandardMaterial({
-        color: 0x00aa33,
-        emissive: 0x00ff44,
-        emissiveIntensity: 0.6,
-        roughness: 0.5
-      });
-      const spire = new THREE.Mesh(spireGeo, spireMat);
+      const spire = new THREE.Mesh(alienPlantAssets.spireGeo, alienPlantAssets.spireMat);
       spire.position.y = height / 2;
+      spire.scale.set(0.2, height, 0.2);
       spire.castShadow = false;
       spire.receiveShadow = false;
       plantGroup.add(spire);
 
-      // Glowing orb on top
-      const orbGeo = new THREE.IcosahedronGeometry(0.3, 1);
-      const orbMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
-      const orb = new THREE.Mesh(orbGeo, orbMat);
+      const orb = new THREE.Mesh(alienPlantAssets.orbGeo, alienPlantAssets.orbMat);
       orb.position.y = height + 0.2;
+      orb.scale.setScalar(0.3);
       orb.castShadow = false;
       orb.receiveShadow = false;
       plantGroup.add(orb);
 
     } else if (type === 1) {
-      // Crystal Cluster - 3 small angular cones
+      // Crystal cluster
       for (let c = 0; c < 3; c++) {
         const height = 0.8 + Math.random() * 1.2;
-        const crystalGeo = new THREE.ConeGeometry(0.15, height, 3);
-        const crystalMat = new THREE.MeshStandardMaterial({
-          color: 0x00cc55,
-          emissive: 0x00ff66,
-          emissiveIntensity: 0.7,
-          roughness: 0.3
-        });
-        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
+        const crystal = new THREE.Mesh(alienPlantAssets.crystalGeo, alienPlantAssets.crystalMat);
         crystal.position.set(
           (Math.random() - 0.5) * 0.4,
           height / 2,
           (Math.random() - 0.5) * 0.4
         );
+        crystal.scale.set(0.15, height, 0.15);
         crystal.rotation.set(
           (Math.random() - 0.5) * 0.4,
           Math.random() * Math.PI,
           (Math.random() - 0.5) * 0.4
         );
@@ -10288,29 +10907,22 @@ function buildAlienPlanetScene(group) {
         crystal.receiveShadow = false;
         plantGroup.add(crystal);
       }
 
     } else if (type === 2) {
-      // Mushroom - cylinder stem + hemisphere cap
+      // Mushroom
       const stemHeight = 0.5 + Math.random() * 0.5;
-      const stemGeo = new THREE.CylinderGeometry(0.1, 0.15, stemHeight, 8);
-      const stemMat = new THREE.MeshStandardMaterial({ color: 0x204020, roughness: 0.8 });
-      const stem = new THREE.Mesh(stemGeo, stemMat);
+      const stem = new THREE.Mesh(alienPlantAssets.stemGeo, alienPlantAssets.stemMat);
       stem.position.y = stemHeight / 2;
+      stem.scale.set(0.1, stemHeight, 0.15);
       stem.castShadow = false;
       stem.receiveShadow = false;
       plantGroup.add(stem);
 
-      const capGeo = new THREE.SphereGeometry(0.4, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
-      const capMat = new THREE.MeshStandardMaterial({
-        color: 0x00aa44,
-        emissive: 0x00ff55,
-        emissiveIntensity: 0.5,
-        roughness: 0.6
-      });
-      const cap = new THREE.Mesh(capGeo, capMat);
+      const cap = new THREE.Mesh(alienPlantAssets.capGeo, alienPlantAssets.capMat);
       cap.position.y = stemHeight;
+      cap.scale.setScalar(0.4);
       cap.castShadow = false;
       cap.receiveShadow = false;
       plantGroup.add(cap);
     }
 
@@ -10320,12 +10932,12 @@ function buildAlienPlanetScene(group) {
     // REMOVED: Sway animation data - per-frame rotation is too expensive
 
     return plantGroup;
   };
 
-  // Place 15 plants along river with random offsets (reduced for FPS)
-  for (let i = 0; i < 15; i++) {
+  // Place plants along river with random offsets
+  for (let i = 0; i < 12; i++) {
     const t = Math.random();
     const riverT = t * 59;
     const idx = Math.floor(riverT);
     const frac = riverT - idx;
 
@@ -10356,11 +10968,11 @@ function buildAlienPlanetScene(group) {
     group.add(plant);
   }
 
   // Extra flora spread around the player (reduced for FPS)
   // AGGRESSIVE: Only spawn in front of player (negative Z, front 180-degree arc)
-  for (let i = 0; i < 15; i++) {  // Reduced from 50 to 15 (total plants: 30 instead of 100)
+  for (let i = 0; i < 12; i++) {  // Reduced from 50 to 12 (total target: ~24 before culling)
     const angle = Math.random() * Math.PI * 2;
     const radius = 8 + Math.random() * 40;
     const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 8;
     const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 8;
 
@@ -10391,29 +11003,29 @@ function buildAlienPlanetScene(group) {
 
   // Small fauna critters (reduced for FPS)
   // AGGRESSIVE: Only spawn in front of player (negative Z)
   const critterGeo = new THREE.SphereGeometry(0.18, 8, 6);
   const critterGlowGeo = new THREE.SphereGeometry(0.3, 8, 6);
+  const critterBodyMat = new THREE.MeshStandardMaterial({ color: 0x00aa55, emissive: 0x00ff66, emissiveIntensity: 0.4 });
+  const critterGlowMat = new THREE.MeshBasicMaterial({ color: 0x33ffaa, transparent: true, opacity: 0.3 });
   for (let i = 0; i < 5; i++) {  // Reduced from 10 to 5 for FPS
     const angle = Math.random() * Math.PI * 2;
     const radius = 6 + Math.random() * 35;
     const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 4;
     const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 4;
 
     // AGGRESSIVE: Skip critters behind player (positive Z)
     if (z > 0) continue;
 
     const critterGroup = new THREE.Group();
-    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00aa55, emissive: 0x00ff66, emissiveIntensity: 0.4 });
-    const body = new THREE.Mesh(critterGeo, bodyMat);
+    const body = new THREE.Mesh(critterGeo, critterBodyMat);
     body.position.y = 0.2;
     body.castShadow = false;
     body.receiveShadow = false;
     critterGroup.add(body);
 
-    const glowMat = new THREE.MeshBasicMaterial({ color: 0x33ffaa, transparent: true, opacity: 0.3 });
-    const glow = new THREE.Mesh(critterGlowGeo, glowMat);
+    const glow = new THREE.Mesh(critterGlowGeo, critterGlowMat);
     glow.position.y = 0.2;
     critterGroup.add(glow);
 
     critterGroup.position.set(x, floorY, z);
     critterGroup.rotation.y = Math.random() * Math.PI * 2;
@@ -10504,42 +11116,43 @@ function buildAlienPlanetScene(group) {
     megaMesh.setMatrixAt(i, dummy.matrix);
   }
   cityMeshes.push(megaMesh);
   group.add(megaMesh);
 
-  // Issue 7: Distant low-poly mountains at ~100 units (alien planet colors) - closer and larger for visibility
+  // Distant low-poly mountains at ~100 units.
+  const distantMountainMaterial = new THREE.MeshStandardMaterial({
+    color: 0x0a2015,
+    roughness: 0.9,
+    metalness: 0.1,
+    flatShading: true
+  });
+  const distantMountainGeometries = [5, 6, 7].map((segments) => new THREE.ConeGeometry(1, 1, segments));
+
   const createDistantMountain = (x, z, scale) => {
     const peakCount = 1 + Math.floor(Math.random() * 2);
     const mountainGroup = new THREE.Group();
     for (let p = 0; p < peakCount; p++) {
       const height = (30 + Math.random() * 50) * scale;
       const radius = Math.max(6, (6 + Math.random() * 10) * scale);
-      // Low-poly cone with 5-7 segments
-      const peakGeo = new THREE.ConeGeometry(radius, height, 5 + Math.floor(Math.random() * 3));
-      const peakMat = new THREE.MeshStandardMaterial({
-        color: 0x0a2015, // Dark teal-green
-        roughness: 0.9,
-        metalness: 0.1,
-        flatShading: true
-      });
-      const peak = new THREE.Mesh(peakGeo, peakMat);
+      const peakGeo = distantMountainGeometries[Math.floor(Math.random() * distantMountainGeometries.length)];
+      const peak = new THREE.Mesh(peakGeo, distantMountainMaterial);
       peak.position.set(
         (Math.random() - 0.5) * 6 * scale,
         height / 2,
         (Math.random() - 0.5) * 6 * scale
       );
+      peak.scale.set(radius, height, radius);
       peak.castShadow = false;
       peak.receiveShadow = false;
       mountainGroup.add(peak);
     }
     mountainGroup.position.set(x, floorY, z);
-    mountainGroup.frustumCulled = false; // Prevent culling at distance
+    mountainGroup.frustumCulled = false;
     return mountainGroup;
   };
 
-  // Ring of 10 distant mountains at ~100 units (closer for visibility with fog)
-  const distantMountainCount = 10;
+  const distantMountainCount = 8;
   const distantMountainRadius = 100;
   for (let i = 0; i < distantMountainCount; i++) {
     const angle = (i / distantMountainCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
     const r = distantMountainRadius + (Math.random() - 0.5) * 20;
     const x = Math.cos(angle) * r;
@@ -10582,12 +11195,12 @@ function buildHellscapeLavaScene(group) {
   // ========================================
   // Red moonlight with shadows
   const moonLight = new THREE.DirectionalLight(0xff3333, 2.5);
   moonLight.position.set(20, 30, -100);
   moonLight.castShadow = true;
-  moonLight.shadow.mapSize.width = 2048;
-  moonLight.shadow.mapSize.height = 2048;
+  moonLight.shadow.mapSize.width = 1024;
+  moonLight.shadow.mapSize.height = 1024;
   moonLight.shadow.camera.near = 0.5;
   moonLight.shadow.camera.far = 500;
   moonLight.shadow.camera.left = -100;
   moonLight.shadow.camera.right = 100;
   moonLight.shadow.camera.top = 100;
@@ -10604,11 +11217,11 @@ function buildHellscapeLavaScene(group) {
   group.add(lavaGlow);
 
   // ========================================
   // TERRAIN (existing logic)
   // ========================================
-  const geometry = new THREE.PlaneGeometry(300, 300, 200, 200);
+  const geometry = new THREE.PlaneGeometry(300, 300, 140, 140);
   geometry.rotateX(-Math.PI / 2);
   const positions = geometry.attributes.position;
   for (let i = 0; i < positions.count; i++) {
     const x = positions.getX(i);
     const z = positions.getZ(i);
@@ -10654,10 +11267,12 @@ function buildHellscapeLavaScene(group) {
       material.userData.shader = shader;
     }
   });
 
   const terrain = new THREE.Mesh(geometry, material);
+  terrain.name = 'hellscape-lava-terrain';
+  terrain.userData.planeName = 'hellscape-lava-terrain';
   terrain.receiveShadow = true;
   terrain.position.y = floorY;
   terrain.position.x = -10.0;  // Shift terrain left so player spawns on riverbank (not riverbed)
   terrain.position.z = 0.0;  // Player on flat valley floor
   group.add(terrain);
@@ -10670,118 +11285,146 @@ function buildHellscapeLavaScene(group) {
     opacity: 0,
     depthWrite: false,
     side: THREE.DoubleSide
   });
   const flashPlane = new THREE.Mesh(flashGeo, flashMat);
+  flashPlane.name = 'hellscape-lava-damage-flash-plane';
+  flashPlane.userData.planeName = 'hellscape-lava-damage-flash-plane';
   flashPlane.rotation.x = -Math.PI / 2;
   flashPlane.position.y = floorY + 0.05;
   flashPlane.frustumCulled = false;
   group.add(flashPlane);
   biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });
 
+  const placementDummy = new THREE.Object3D();
+
   // ========================================
-  // 2. JAGGED ROCKS (50 scattered)
+  // 2. JAGGED ROCKS (instanced)
   // ========================================
+  const rockCount = 36;
   const rockGeo = new THREE.TetrahedronGeometry(1, 0);
   const rockMat = new THREE.MeshStandardMaterial({
     color: 0x1a1a1a,
     roughness: 0.8,
     metalness: 0.2,
     flatShading: true
   });
+  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
 
-  for (let i = 0; i < 50; i++) {
-    const rock = new THREE.Mesh(rockGeo, rockMat);
+  for (let i = 0; i < rockCount; i++) {
     let x, z, riverX, distToRiver;
     let attempts = 0;
     do {
       x = (Math.random() - 0.5) * 60;
       z = (Math.random() - 0.5) * 100;
       riverX = Math.sin(z * 0.03) * 15.0;
       distToRiver = Math.abs(x - riverX);
       attempts++;
     } while (distToRiver < 8 && attempts < 20);
 
-    rock.position.set(x, floorY + 0.5, z);
-    // Scale: taller than wide (0.5-4.0)
-    const scaleY = 0.5 + Math.random() * 3.5;
-    const scaleX = 0.5 + Math.random() * 1.5;
-    rock.scale.set(scaleX, scaleY, scaleX);
-    rock.rotation.set(
+    const scaleY = 0.5 + Math.random() * 3.0;
+    const scaleX = 0.5 + Math.random() * 1.3;
+    placementDummy.position.set(x, floorY + 0.5, z);
+    placementDummy.scale.set(scaleX, scaleY, scaleX);
+    placementDummy.rotation.set(
       Math.random() * Math.PI,
       Math.random() * Math.PI * 2,
       Math.random() * Math.PI
     );
-    rock.castShadow = true;
-    rock.receiveShadow = true;
-    group.add(rock);
+    placementDummy.updateMatrix();
+    rockMesh.setMatrixAt(i, placementDummy.matrix);
   }
+  rockMesh.instanceMatrix.needsUpdate = true;
+  rockMesh.castShadow = true;
+  rockMesh.receiveShadow = true;
+  rockMesh.frustumCulled = false;
+  group.add(rockMesh);
 
   // ========================================
-  // 3. DEAD TREES (25 procedural)
+  // 3. DEAD TREES (instanced + simplified)
   // ========================================
-  const treeMat = new THREE.MeshStandardMaterial({
+  const treeMaterial = new THREE.MeshStandardMaterial({
     color: 0x0a0a0a,
     roughness: 0.9,
     metalness: 0.1,
     flatShading: true
   });
+  const trunkGeo = new THREE.CylinderGeometry(0.8, 1.0, 1, 5);
+  const branchGeo = new THREE.CylinderGeometry(0.6, 0.8, 1, 5);
 
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
+  const treeDefs = [];
+  let totalBranches = 0;
+  const treeCount = 18;
 
-  for (let i = 0; i < 25; i++) {
+  for (let i = 0; i < treeCount; i++) {
     let x, z, riverX, distToRiver;
     let attempts = 0;
     do {
       x = (Math.random() - 0.5) * 60;
       z = (Math.random() - 0.5) * 100;
       riverX = Math.sin(z * 0.03) * 15.0;
       distToRiver = Math.abs(x - riverX);
       attempts++;
     } while (distToRiver < 8 && attempts < 20);
 
-    const tree = createBranch(0, 3, 3 + Math.random() * 2, 0.2 + Math.random() * 0.1);
-    tree.position.set(x, floorY, z);
-    tree.rotation.y = Math.random() * Math.PI * 2;
-    const treeScale = 0.8 + Math.random() * 0.6;
-    tree.scale.setScalar(treeScale);
-    group.add(tree);
+    const trunkHeight = 2.6 + Math.random() * 2.0;
+    const trunkRadius = 0.16 + Math.random() * 0.07;
+    const treeYaw = Math.random() * Math.PI * 2;
+    const branchCount = 2 + Math.floor(Math.random() * 2);
+
+    treeDefs.push({ x, z, trunkHeight, trunkRadius, treeYaw, branchCount });
+    totalBranches += branchCount;
+  }
+
+  const trunkMesh = new THREE.InstancedMesh(trunkGeo, treeMaterial, treeDefs.length);
+  const branchMesh = new THREE.InstancedMesh(branchGeo, treeMaterial, totalBranches);
+
+  let branchIdx = 0;
+  for (let i = 0; i < treeDefs.length; i++) {
+    const tree = treeDefs[i];
+
+    placementDummy.position.set(tree.x, floorY + tree.trunkHeight * 0.5, tree.z);
+    placementDummy.rotation.set(0, tree.treeYaw, (Math.random() - 0.5) * 0.08);
+    placementDummy.scale.set(tree.trunkRadius, tree.trunkHeight, tree.trunkRadius);
+    placementDummy.updateMatrix();
+    trunkMesh.setMatrixAt(i, placementDummy.matrix);
+
+    for (let b = 0; b < tree.branchCount; b++) {
+      const branchLength = tree.trunkHeight * (0.35 + Math.random() * 0.25);
+      const branchRadius = tree.trunkRadius * (0.62 + Math.random() * 0.2);
+      const branchYaw = tree.treeYaw + ((b / tree.branchCount) * Math.PI * 2) + (Math.random() - 0.5) * 0.6;
+      const branchTilt = (0.45 + Math.random() * 0.7) * (Math.random() > 0.5 ? 1 : -1);
+      const baseHeight = floorY + tree.trunkHeight * (0.45 + Math.random() * 0.35);
+
+      placementDummy.position.set(
+        tree.x + Math.cos(branchYaw) * (tree.trunkRadius * 0.5),
+        baseHeight,
+        tree.z + Math.sin(branchYaw) * (tree.trunkRadius * 0.5)
+      );
+      placementDummy.rotation.set(0, branchYaw, branchTilt);
+      placementDummy.scale.set(branchRadius, branchLength, branchRadius * 0.9);
+      placementDummy.updateMatrix();
+      branchMesh.setMatrixAt(branchIdx, placementDummy.matrix);
+      branchIdx++;
+    }
   }
 
+  trunkMesh.instanceMatrix.needsUpdate = true;
+  branchMesh.instanceMatrix.needsUpdate = true;
+  trunkMesh.castShadow = true;
+  trunkMesh.receiveShadow = true;
+  branchMesh.castShadow = true;
+  branchMesh.receiveShadow = true;
+  trunkMesh.frustumCulled = false;
+  branchMesh.frustumCulled = false;
+  group.add(trunkMesh);
+  group.add(branchMesh);
+
   // ========================================
-  // 4. TWINKLING STARS (1500 particles with red tint)
+  // 4. TWINKLING STARS (1000 particles with red tint)
   // ========================================
-  const starCount = 1500;
+  const starCount = 1000;
   const starPositions = new Float32Array(starCount * 3);
   const starColors = new Float32Array(starCount * 3);
   const starSizes = new Float32Array(starCount);
   const starPhases = new Float32Array(starCount);
 
@@ -10847,30 +11490,31 @@ function buildHellscapeLavaScene(group) {
 
   const stars = new THREE.Points(starGeo, starMat);
   group.add(stars);
 
   // ========================================
-  // 5. SPARK PARTICLES (200 rising from lava)
+  // 5. SPARK PARTICLES (lifetime-based, deterministic)
   // ========================================
-  const sparkCount = 200;
+  const sparkCount = 140;
   const sparkPositions = new Float32Array(sparkCount * 3);
   const sparkVelocities = new Float32Array(sparkCount * 3);
   const sparkLifetimes = new Float32Array(sparkCount);
   const sparkMaxLifetimes = new Float32Array(sparkCount);
 
   const initSpark = (idx) => {
     const i3 = idx * 3;
     const z = (Math.random() - 0.5) * 100;
-    const riverX = Math.sin(z * 0.03) * 15.0 + 10.0;  // Account for terrain X shift
+    const riverX = Math.sin(z * 0.03) * 15.0 + 10.0;
     sparkPositions[i3] = riverX + (Math.random() - 0.5) * 4;
-    sparkPositions[i3 + 1] = floorY - 0.5 + Math.random() * 0.5;  // Account for terrain Y offset
+    sparkPositions[i3 + 1] = floorY - 0.9 + Math.random() * 0.3;
     sparkPositions[i3 + 2] = z;
-    sparkVelocities[i3] = (Math.random() - 0.5) * 0.02;
-    sparkVelocities[i3 + 1] = 0.03 + Math.random() * 0.05;
-    sparkVelocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
+    // Velocity units are per-second.
+    sparkVelocities[i3] = (Math.random() - 0.5) * 1.0;
+    sparkVelocities[i3 + 1] = 2.0 + Math.random() * 2.2;
+    sparkVelocities[i3 + 2] = (Math.random() - 0.5) * 1.0;
     sparkLifetimes[idx] = 0;
-    sparkMaxLifetimes[idx] = 2 + Math.random() * 3;
+    sparkMaxLifetimes[idx] = 0.9 + Math.random() * 1.2;
   };
 
   for (let i = 0; i < sparkCount; i++) {
     initSpark(i);
     sparkLifetimes[i] = Math.random() * sparkMaxLifetimes[i]; // Stagger initial lifetimes
@@ -10892,21 +11536,22 @@ function buildHellscapeLavaScene(group) {
   group.add(sparks);
 
   // ========================================
   // 5b. ASH PARTICLES (dark floating)
   // ========================================
-  const ashCount = 260;
+  const ashCount = 180;
   const ashPositions = new Float32Array(ashCount * 3);
   const ashVelocities = new Float32Array(ashCount * 3);
   for (let i = 0; i < ashCount; i++) {
     const i3 = i * 3;
     ashPositions[i3] = (Math.random() - 0.5) * 80;
     ashPositions[i3 + 1] = 1 + Math.random() * 10;
     ashPositions[i3 + 2] = (Math.random() - 0.5) * 80;
-    ashVelocities[i3] = (Math.random() - 0.5) * 0.02;
-    ashVelocities[i3 + 1] = 0.01 + Math.random() * 0.015;
-    ashVelocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
+    // Velocity units are per-second.
+    ashVelocities[i3] = (Math.random() - 0.5) * 0.55;
+    ashVelocities[i3 + 1] = 0.08 + Math.random() * 0.18;
+    ashVelocities[i3 + 2] = (Math.random() - 0.5) * 0.55;
   }
   const ashGeo = new THREE.BufferGeometry();
   ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPositions, 3));
   const ashMat = new THREE.PointsMaterial({
     color: 0x2b2b2b,
@@ -10936,15 +11581,16 @@ function buildHellscapeLavaScene(group) {
     for (let i = 0; i < particleCount; i++) {
       geyserParticles.push({
         x: x + (Math.random() - 0.5) * 2,
         y: baseY,
         z: z + (Math.random() - 0.5) * 2,
-        vx: (Math.random() - 0.5) * 0.1,
-        vy: 0.8 + Math.random() * 0.5, // Strong upward velocity
-        vz: (Math.random() - 0.5) * 0.1,
+        // Velocity units are per-second.
+        vx: (Math.random() - 0.5) * 3.5,
+        vy: 14 + Math.random() * 8,
+        vz: (Math.random() - 0.5) * 3.5,
         life: 0,
-        maxLife: 1.5 + Math.random() * 1.5
+        maxLife: 0.9 + Math.random() * 0.7
       });
     }
   };
 
   const geyserGeo = new THREE.BufferGeometry();
@@ -10965,12 +11611,12 @@ function buildHellscapeLavaScene(group) {
   group.add(geyserPoints);
 
   // ========================================
   // 7. FLAME PILLARS (distant fire columns)
   // ========================================
-  const PILLAR_COUNT = 7;
-  const PARTICLES_PER_PILLAR = 35;
+  const PILLAR_COUNT = 6;
+  const PARTICLES_PER_PILLAR = 28;
   const TOTAL_FLAME_PILLAR_PARTICLES = PILLAR_COUNT * PARTICLES_PER_PILLAR;
 
   // Canvas-drawn flame sprite texture (64x64, soft radial gradient)
   const flameCanvas = document.createElement('canvas');
   flameCanvas.width = 64;
@@ -10994,11 +11640,11 @@ function buildHellscapeLavaScene(group) {
     pillarDefs.push({
       x: Math.cos(angle) * dist + 10.0, // Account for terrain X shift
       z: Math.sin(angle) * dist,
       height: 12 + Math.random() * 10, // Pillar height 12-22 units
       radius: 1.5 + Math.random() * 1.5, // Base radius 1.5-3 units
-      speed: 0.6 + Math.random() * 0.4 // Rise speed multiplier
+      speed: 0.9 + Math.random() * 0.5 // Rise speed multiplier
     });
   }
 
   // Particle arrays
   const flamePositions = new Float32Array(TOTAL_FLAME_PILLAR_PARTICLES * 3);
@@ -11017,11 +11663,16 @@ function buildHellscapeLavaScene(group) {
     flamePositions[i3 + 1] = floorY + t * pillar.height;
     flamePositions[i3 + 2] = pillar.z + Math.sin(angle) * r;
     flameSizes[idx] = 1.0 + (1.0 - t) * 2.0; // Larger at base, smaller at top
 
     if (!flameParticleData[idx]) {
-      flameParticleData[idx] = { pillarIdx, speed: 0.3 + Math.random() * 0.3 };
+      flameParticleData[idx] = {
+        pillarIdx,
+        speed: 2.0 + Math.random() * 1.2,
+        driftPhase: Math.random() * Math.PI * 2,
+        driftAmp: 0.18 + Math.random() * 0.12
+      };
     }
     flameParticleData[idx].t = t;
     flameParticleData[idx].pillarIdx = pillarIdx;
   };
 
@@ -11114,46 +11765,43 @@ function buildHellscapeLavaScene(group) {
     lavaGlow.position.y = 5 + Math.sin(time * 0.5) * 2;
 
     // Lava glow intensity pulse
     lavaGlow.intensity = 2.0 + Math.sin(time * 2) * 0.5;
 
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
+    const dtSec = Math.min(dt, 0.05);
 
+    // Spark particles: lifetime + height-capped respawn (fixes "fly upward forever").
+    const sparkPos = sparkGeo.attributes.position.array;
     for (let i = 0; i < sparkCount; i++) {
       const i3 = i * 3;
-      sparkLifetimes[i] += dt * 0.001;
+      sparkLifetimes[i] += dtSec;
 
-      if (sparkLifetimes[i] > sparkMaxLifetimes[i]) {
+      if (sparkLifetimes[i] >= sparkMaxLifetimes[i] || sparkPos[i3 + 1] > floorY + 7.5) {
         initSpark(i);
-      } else {
-        sparkPos[i3] += sparkVelocities[i3];
-        sparkPos[i3 + 1] += sparkVelocities[i3 + 1];
-        sparkPos[i3 + 2] += sparkVelocities[i3 + 2];
+        continue;
       }
+
+      sparkVelocities[i3 + 1] = Math.max(0.45, sparkVelocities[i3 + 1] - 3.2 * dtSec);
+      sparkPos[i3] += sparkVelocities[i3] * dtSec;
+      sparkPos[i3 + 1] += sparkVelocities[i3 + 1] * dtSec;
+      sparkPos[i3 + 2] += sparkVelocities[i3 + 2] * dtSec;
     }
     sparkGeo.attributes.position.needsUpdate = true;
 
     // Ash drift
     const ashPos = ashGeo.attributes.position.array;
     for (let i = 0; i < ashCount; i++) {
       const i3 = i * 3;
-      ashPos[i3] += ashVelocities[i3] * dt * 0.6;
-      ashPos[i3 + 1] += ashVelocities[i3 + 1] * dt * 0.6;
-      ashPos[i3 + 2] += ashVelocities[i3 + 2] * dt * 0.6;
-      if (ashPos[i3 + 1] > 12) ashPos[i3 + 1] = 1;
+      ashPos[i3] += ashVelocities[i3] * dtSec;
+      ashPos[i3 + 1] += ashVelocities[i3 + 1] * dtSec;
+      ashPos[i3 + 2] += ashVelocities[i3 + 2] * dtSec;
+
+      if (ashPos[i3 + 1] > 12) {
+        ashPos[i3] = (Math.random() - 0.5) * 80;
+        ashPos[i3 + 1] = 1;
+        ashPos[i3 + 2] = (Math.random() - 0.5) * 80;
+      }
       if (ashPos[i3] > 40) ashPos[i3] = -40;
       if (ashPos[i3] < -40) ashPos[i3] = 40;
       if (ashPos[i3 + 2] > 40) ashPos[i3 + 2] = -40;
       if (ashPos[i3 + 2] < -40) ashPos[i3 + 2] = 40;
     }
@@ -11163,26 +11811,25 @@ function buildHellscapeLavaScene(group) {
     if (now - lastGeyserTime > geyserInterval) {
       createGeyserBurst(now);
       lastGeyserTime = now;
     }
 
-    // Update geyser particles
     const geyserPos = geyserGeo.attributes.position.array;
     let activeCount = 0;
     for (let i = geyserParticles.length - 1; i >= 0; i--) {
       const p = geyserParticles[i];
-      p.life += dt * 0.001;
+      p.life += dtSec;
 
       if (p.life > p.maxLife) {
         geyserParticles.splice(i, 1);
         continue;
       }
 
-      p.x += p.vx;
-      p.y += p.vy;
-      p.z += p.vz;
-      p.vy -= 0.03; // Gravity
+      p.x += p.vx * dtSec;
+      p.y += p.vy * dtSec;
+      p.z += p.vz * dtSec;
+      p.vy -= 18 * dtSec;
 
       const idx = activeCount * 3;
       geyserPos[idx] = p.x;
       geyserPos[idx + 1] = p.y;
       geyserPos[idx + 2] = p.z;
@@ -11196,26 +11843,21 @@ function buildHellscapeLavaScene(group) {
     const fpSizes = flamePillarGeo.attributes.aSize.array;
     for (let i = 0; i < TOTAL_FLAME_PILLAR_PARTICLES; i++) {
       const pd = flameParticleData[i];
       const pillar = pillarDefs[pd.pillarIdx];
       const i3 = i * 3;
-      const dtSec = dt * 0.001;
 
-      // Advance particle up the pillar
-      pd.t += dtSec * pd.speed * pillar.speed / pillar.height;
+      pd.t += (pd.speed * dtSec * pillar.speed) / Math.max(1, pillar.height);
 
       if (pd.t >= 1.0) {
-        // Respawn at base
         initFlameParticle(i);
       } else {
-        // Slight horizontal drift as particle rises
-        const drift = (Math.random() - 0.5) * 0.05;
-        fpPos[i3] += drift;
+        const driftWave = Math.sin(time * 2.2 + pd.driftPhase) * pd.driftAmp * dtSec;
+        fpPos[i3] += Math.cos(pd.driftPhase) * driftWave;
         fpPos[i3 + 1] += pd.speed * dtSec * pillar.speed;
-        fpPos[i3 + 2] += drift;
+        fpPos[i3 + 2] += Math.sin(pd.driftPhase) * driftWave;
 
-        // Shrink as particle rises
         fpSizes[i] = Math.max(0.3, (1.0 - pd.t) * 3.0);
       }
     }
     flamePillarGeo.attributes.position.needsUpdate = true;
     flamePillarGeo.attributes.aSize.needsUpdate = true;
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
diff --git a/test-result.png b/test-result.png
index 6ec6733..c0b11cd 100644
Binary files a/test-result.png and b/test-result.png differ

--- UNCOMMITTED CHANGES ---
 test-result.png | Bin 511212 -> 561886 bytes
 1 file changed, 0 insertions(+), 0 deletions(-)

diff --git a/test-result.png b/test-result.png
index c0b11cd..acc7eb6 100644
Binary files a/test-result.png and b/test-result.png differ
