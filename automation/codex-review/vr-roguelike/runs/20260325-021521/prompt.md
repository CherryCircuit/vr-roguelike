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
- Base SHA: acba39b5724712d155b01abc03672df76329d532
- Head SHA: 02018d9e2ac488ef268f36a4392873f469a46ad3
- Commit count in scope: 1
- Include uncommitted changes: 0

## Changed files
 boss-death-cinematic.js |  42 ++++++++++++++++++---
 desktop-controls.js     |  12 ++++++
 enemies.js              |   2 +-
 game-screenshot.png     | Bin 569981 -> 680224 bytes
 game.js                 |   8 ++--
 hud.js                  | 197 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++-------
 index.html              |  91 ++++++++++++++++++++++++++++++++++++++++++--
 main.js                 | 347 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++--------------
 weapons.js              |   3 ++
 9 files changed, 646 insertions(+), 56 deletions(-)

## Unified diff
diff --git a/boss-death-cinematic.js b/boss-death-cinematic.js
index 22d75d1..78c5c28 100644
--- a/boss-death-cinematic.js
+++ b/boss-death-cinematic.js
@@ -15,10 +15,11 @@ export const BOSS_DEATH_EXPLOSION_INTERVAL = 0.12;
 
 // Internal state
 let bossDeathFreezeTimer = 0;
 let bossDeathWhiteOverlay = null;
 let bossDeathBlackOverlay = null;
+let bossDeathOverlayDismissed = false;  // True after dismissBossDeathOverlay() is called
 let bossDeathCinematic = {
   active: false,
   timer: 0,
   explosionTimer: 0,
   bossPos: new THREE.Vector3(),
@@ -175,36 +176,62 @@ export function startBossDeathCinematic(boss) {
   }
   console.log('[boss-cinematic] State set to BOSS_DEATH_CINEMATIC');
 }
 
 /**
- * Finish the boss death cinematic and transition to next state
+ * Finish the boss death cinematic and transition to next state.
+ * The black overlay is intentionally kept visible to prevent the old biome
+ * from popping back while completeLevel sets up the transition.
  */
 export function finishBossDeathCinematic() {
   bossDeathCinematic.active = false;
   bossDeathCinematic.timer = 0;
   bossDeathCinematic.explosionTimer = 0;
 
+  // Hide white overlay (done with), but KEEP black overlay visible.
+  // The black overlay prevents any pop-back of the old biome scene.
+  // It will be dismissed later via dismissBossDeathOverlay().
   if (bossDeathWhiteOverlay) {
     bossDeathWhiteOverlay.material.opacity = 0;
     bossDeathWhiteOverlay.visible = false;
   }
-  if (bossDeathBlackOverlay) {
-    bossDeathBlackOverlay.material.opacity = 0;
-    bossDeathBlackOverlay.visible = false;
-  }
+  // Black overlay stays at opacity 1, visible = true
+  bossDeathOverlayDismissed = false;
 
   if (bossDeathCinematic.wasFinalBoss) {
     bossDeathCinematic.wasFinalBoss = false;
+    // For final boss, dismiss overlay and end game
+    dismissBossDeathOverlay();
     if (deps.endGame) deps.endGame(true);
     return;
   }
 
   bossDeathCinematic.wasFinalBoss = false;
   if (deps.completeLevel) deps.completeLevel();
 }
 
+/**
+ * Check if the boss death black overlay is still active (covering the screen).
+ * Used by main.js to know the environment is already fully faded.
+ * @returns {boolean} True if the black overlay is still visible
+ */
+export function isBossDeathOverlayActive() {
+  return !bossDeathOverlayDismissed && bossDeathBlackOverlay && bossDeathBlackOverlay.visible;
+}
+
+/**
+ * Dismiss the boss death black overlay. Call this after the new biome is set up
+ * and the environment fade-in has started, so no pop-back can occur.
+ */
+export function dismissBossDeathOverlay() {
+  bossDeathOverlayDismissed = true;
+  if (bossDeathBlackOverlay) {
+    bossDeathBlackOverlay.material.opacity = 0;
+    bossDeathBlackOverlay.visible = false;
+  }
+}
+
 /**
  * Update the boss death cinematic each frame
  * @param {number} rawDt - Unscaled delta time in seconds
  */
 export function updateBossDeathCinematic(rawDt) {
@@ -237,12 +264,15 @@ export function updateBossDeathCinematic(rawDt) {
   let blackOpacity = 0;
   let envFade = 0;  // Environment fade synced with black overlay
   if (t >= whiteStart && t < whiteEnd) {
     whiteOpacity = (t - whiteStart) / BOSS_DEATH_WHITE_FADE;
   } else if (t >= whiteEnd && t < blackEnd) {
+    // Crossfade: keep white at full opacity, fade black in ON TOP of white.
+    // This prevents ShaderMaterial elements (stars, sky) from bleeding through
+    // during the transition since at least one overlay is always fully opaque.
+    whiteOpacity = 1;
     const progress = (t - whiteEnd) / BOSS_DEATH_BLACK_FADE;
-    whiteOpacity = 1 - progress;
     blackOpacity = progress;
     envFade = progress;  // Fade environment with black overlay
   } else if (t >= blackEnd) {
     blackOpacity = 1;
     envFade = 1;  // Full fade
diff --git a/desktop-controls.js b/desktop-controls.js
index 710f4e3..ed88ab3 100644
--- a/desktop-controls.js
+++ b/desktop-controls.js
@@ -64,15 +64,20 @@ const aimRaycaster = new THREE.Raycaster();
 const aimOrigin = new THREE.Vector3();
 const aimDirection = new THREE.Vector3();
 
 // ESC/pause callback
 let onPauseCallback = null;
+let onNukeCallback = null;
 
 export function setOnPauseCallback(callback) {
   onPauseCallback = callback;
 }
 
+export function setOnNukeCallback(callback) {
+  onNukeCallback = callback;
+}
+
 // ── Public API ─────────────────────────────────────────────
 
 /**
  * Initialize desktop controls system.
  * Call from init() in main.js after scene/camera/renderer are set up.
@@ -459,10 +464,17 @@ function onKeyDown(e) {
   // Weapon switching (1-4)
   if (key === '1') weaponState.fireMode = 'left';
   if (key === '2') weaponState.fireMode = 'right';
   if (key === '3') weaponState.fireMode = 'both';
   if (key === '4') weaponState.fireMode = 'both'; // Alternate both mode
+
+  // Nuke (N key) — desktop alt-fire
+  if (key === 'n') {
+    if (onNukeCallback) {
+      onNukeCallback();
+    }
+  }
 }
 
 function onKeyUp(e) {
   const key = e.key.toLowerCase();
 
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
index add32a4..40b16e8 100644
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
index 48c9855..6e06f8c 100644
--- a/hud.js
+++ b/hud.js
@@ -38,10 +38,11 @@ let floatingMessageSticky = false;
 let heartsSprite = null;
 let killCountSprite = null;
 let levelSprite = null;
 let scoreSprite = null;
 let scoreTitleSprite = null;
+let nukeSprite = null;
 let comboSprite = null;
 let comboCooldownSprite = null;
 let fpsSprite = null;
 
 // FPS counter optimization: reuse canvas/texture to avoid churn
@@ -781,10 +782,15 @@ function createHUDElements() {
   // Level indicator — above kill counter on right
   levelSprite = makeSprite('LEVEL 1', { fontSize: 72, color: '#00ffff', glow: true, scale: 2.925 });
   levelSprite.position.set(1.5, 0.45, 0);  // #19: Same Y as hearts
   hudGroup.add(levelSprite);
 
+  // Nuke counter — left side, below hearts
+  nukeSprite = makeSprite('☢ X3', { fontSize: 60, color: '#ffff44', glow: true, glowColor: '#ffff44', scale: 1.4 });
+  nukeSprite.position.set(-1.5, -0.55, 0);
+  hudGroup.add(nukeSprite);
+
   // Accuracy bonus — below score on left side
   comboSprite = makeSprite('1x', { fontSize: 40, color: '#ff8800', shadow: true, scale: 1.8 });
   comboSprite.position.set(0, -0.85, 0);
   comboSprite.visible = false;
   hudGroup.add(comboSprite);
@@ -966,10 +972,19 @@ export function updateHUD(gameState) {
   updateSpriteText(levelSprite, `LEVEL ${gameState.level}`, { color: '#00ffff', glow: true, glowColor: '#00ffff', scale: 0.45 });
 
   // Score - increased 50% for VR readability
   updateSpriteText(scoreSprite, `${gameState.score}`, { color: '#ffff00', scale: 0.39 });
 
+  // Nuke counter
+  const nukeCount = gameState.nukes || 0;
+  if (nukeCount > 0 && nukeSprite) {
+    nukeSprite.visible = true;
+    updateSpriteText(nukeSprite, `☢ X${nukeCount}`, { color: '#ffff44', glow: true, glowColor: '#ffff44', scale: 0.28 });
+  } else if (nukeSprite) {
+    nukeSprite.visible = false;
+  }
+
   // Accuracy bonus - 200% larger with descriptive label
   const accuracyBonus = game.accuracyBonus || 0;
   if (accuracyBonus > 0) {
     comboSprite.visible = true;
     comboCooldownSprite.visible = true;
@@ -4012,11 +4027,30 @@ export function showPauseMenu() {
     // Face the camera once (billboard on pause, not every frame)
     pauseMenuGroup.lookAt(cameraRef.position.x, cameraRef.position.y, cameraRef.position.z);
   }
 
   if (pauseMenuElements.panel) {
-    // Already initialized
+    // Already initialized - rebuild blaster sections so stats are fresh
+    ['left', 'right'].forEach(hand => {
+      const oldSection = pauseMenuElements[hand + 'BlasterSection'];
+      if (oldSection) {
+        // Dispose all children properly
+        oldSection.traverse(child => {
+          if (child.geometry) child.geometry.dispose();
+          if (child.material) {
+            if (child.material.map) child.material.map.dispose();
+            child.material.dispose();
+          }
+        });
+        pauseMenuGroup.remove(oldSection);
+      }
+      const newSection = createBlasterSection(hand);
+      newSection.position.set(hand === 'left' ? -1.25 : 1.25, 0.4, 0.02);
+      pauseMenuGroup.add(newSection);
+      pauseMenuElements[hand + 'BlasterSection'] = newSection;
+    });
+
     pauseMenuAnimation.targetSlideIn = 1;
     pauseMenuAnimation.startTime = performance.now();
     pauseMenuAnimation.chartAnimation = 0;
     pauseMenuAnimation.numbersAnimated = false;
     applyPauseMenuRenderPriority(pauseMenuGroup);
@@ -4131,71 +4165,159 @@ function createPauseMenu() {
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
+  yPos -= 0.35;
 
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
+  yPos -= 0.3;
+
+  // Separator after weapon name
+  const sep1 = createSeparator(1.8);
+  sep1.position.set(0, yPos, 0.02);
+  group.add(sep1);
+  yPos -= 0.3;
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
+  yPos -= 0.3;
 
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
       group.add(upgradeText);
     });
-    yPos -= (upgradeEntries.length * 0.22 + 0.15);
+    yPos -= (upgradeEntries.length * 0.22 + 0.2);
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
-    yPos -= 0.37;
+    yPos -= 0.42;
   }
 
+  // Separator after upgrades
+  const sep2 = createSeparator(1.8);
+  sep2.position.set(0, yPos, 0.02);
+  group.add(sep2);
+  yPos -= 0.3;
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
+  yPos -= 0.3;
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
@@ -4212,10 +4334,57 @@ function createBlasterSection(hand, panelX) {
     });
     statText.position.set(0, yPos - (index * 0.22), 0.02);
     statText.userData = { isStatSprite: true, hand, statKey: stat.label };
     group.add(statText);
   });
+  yPos -= (statLines.length * 0.22 + 0.2);
+
+  // Separator after stats
+  const sep3 = createSeparator(1.8);
+  sep3.position.set(0, yPos, 0.02);
+  group.add(sep3);
+  yPos -= 0.3;
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
+  yPos -= 0.3;
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
+      enemyText.userData = { isEnemyKillSprite: true };
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
+    noEnemiesText.userData = { isEnemyKillSprite: true };
+    group.add(noEnemiesText);
+  }
 
   return group;
 }
 
 /**
@@ -4455,13 +4624,15 @@ function updateSectionStats(section, hand) {
   const upgradeEntries = Object.entries(upgrades).filter(([id]) => id !== 'dream_fragment');
   const yOffset = 0.08;
 
   if (upgradeEntries.length > 0) {
     upgradeEntries.forEach(([id, count], index) => {
-      const upgradeText = makeSprite(`${id.replace(/_/g, ' ').toUpperCase()} x${count}`, {
+      const iconData = UPGRADE_ICONS[id] || { icon: '•', color: '#ffffff' };
+      const displayName = id.replace(/_/g, ' ').toUpperCase();
+      const upgradeText = makeSprite(`${iconData.icon} ${displayName} x${count}`, {
         fontSize: scalePauseFont(36),
-        color: '#ffffff',
+        color: iconData.color,
         scale: scalePauseText(0.1),
         renderOrder: PAUSE_TEXT_RENDER_ORDER
       });
       const yPos = yOffset - (index * 0.24);
       upgradeText.position.set(0, yPos, 0.03);
diff --git a/index.html b/index.html
index a0ffe0f..060ac02 100644
--- a/index.html
+++ b/index.html
@@ -216,20 +216,60 @@
 
     <!-- Visual Tuning Section (collapsible) -->
     <div style="margin-top:12px;border-top:1px solid #333;padding-top:8px;">
       <div id="visual-toggle" style="color:#ff00ff;cursor:pointer;user-select:none;">▶ Visual Tuning</div>
       <div id="visual-controls" style="display:none;margin-top:8px;padding-left:8px;">
+        <div style="font-size:11px;line-height:1.4;opacity:0.7;color:#88d8ff;">
+          Shell controls are XR-safe and work in VR. Anaglyph/stereo are desktop-only and bypass selective bloom while active.
+        </div>
+        <div style="display:flex;align-items:center;gap:6px;margin-top:8px;">
+          <label for="debug-render-mode" style="width:150px;">Render mode</label>
+          <select id="debug-render-mode" style="width:154px;background:#220044;color:#fff;border:1px solid #ff00ff;">
+            <option value="normal" selected>Normal</option>
+            <option value="anaglyph">Anaglyph (desktop)</option>
+            <option value="stereo">Stereo (desktop)</option>
+          </select>
+        </div>
+        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
+          <label for="debug-stereo-eye-separation" style="width:150px;">Stereo eye sep</label>
+          <input type="range" id="debug-stereo-eye-separation" min="0.01" max="0.2" step="0.001" value="0.064" style="width:90px;">
+          <input type="number" id="debug-stereo-eye-separation-value" min="0.01" max="0.2" step="0.001" value="0.064" style="width:58px;background:#220044;color:#fff;border:1px solid #ff00ff;">
+        </div>
         <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
           <label for="debug-glow-strength" style="width:150px;">Glow strength</label>
           <input type="range" id="debug-glow-strength" min="0" max="2" step="0.01" value="1" style="width:90px;">
           <input type="number" id="debug-glow-strength-value" min="0" max="2" step="0.01" value="1.00" style="width:58px;background:#220044;color:#fff;border:1px solid #ff00ff;">
         </div>
         <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
           <label for="debug-bloom-strength" style="width:150px;">Bloom strength</label>
           <input type="range" id="debug-bloom-strength" min="0" max="2" step="0.01" value="1" style="width:90px;">
           <input type="number" id="debug-bloom-strength-value" min="0" max="2" step="0.01" value="1.00" style="width:58px;background:#220044;color:#fff;border:1px solid #ff00ff;">
         </div>
+        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
+          <label for="debug-shell-strength" style="width:150px;">Shell strength</label>
+          <input type="range" id="debug-shell-strength" min="0" max="2" step="0.01" value="1" style="width:90px;">
+          <input type="number" id="debug-shell-strength-value" min="0" max="2" step="0.01" value="1.00" style="width:58px;background:#220044;color:#fff;border:1px solid #ff00ff;">
+        </div>
+        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
+          <label for="debug-shell-saturation" style="width:150px;">Shell saturation</label>
+          <input type="range" id="debug-shell-saturation" min="0" max="2" step="0.01" value="1" style="width:90px;">
+          <input type="number" id="debug-shell-saturation-value" min="0" max="2" step="0.01" value="1.00" style="width:58px;background:#220044;color:#fff;border:1px solid #ff00ff;">
+        </div>
+        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
+          <label for="debug-shell-scanline-speed" style="width:150px;">Scanline speed</label>
+          <input type="range" id="debug-shell-scanline-speed" min="0" max="3" step="0.01" value="1" style="width:90px;">
+          <input type="number" id="debug-shell-scanline-speed-value" min="0" max="3" step="0.01" value="1.00" style="width:58px;background:#220044;color:#fff;border:1px solid #ff00ff;">
+        </div>
+        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
+          <label for="debug-shell-noise-amount" style="width:150px;">Noise amount</label>
+          <input type="range" id="debug-shell-noise-amount" min="0" max="2" step="0.01" value="0.35" style="width:90px;">
+          <input type="number" id="debug-shell-noise-amount-value" min="0" max="2" step="0.01" value="0.35" style="width:58px;background:#220044;color:#fff;border:1px solid #ff00ff;">
+        </div>
+        <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
+          <label for="debug-shell-tint" style="width:150px;">Shell tint</label>
+          <input type="color" id="debug-shell-tint" value="#99b8ff" style="width:58px;height:24px;background:#220044;border:1px solid #ff00ff;padding:0;">
+        </div>
         <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
           <label for="debug-smoke-strength" style="width:150px;">Smoke particles</label>
           <input type="range" id="debug-smoke-strength" min="0" max="2" step="0.01" value="1" style="width:90px;">
           <input type="number" id="debug-smoke-strength-value" min="0" max="2" step="0.01" value="1.00" style="width:58px;background:#220044;color:#fff;border:1px solid #ff00ff;">
         </div>
@@ -273,20 +313,29 @@
 
   <!-- Main game module -->
   <script type="module" src="main.js"></script>
   <script>
     (function() {
-      const GAME_VERSION = 'v2026.03.22.0322';
+      const GAME_VERSION = 'v2026.03.24.1520';
       document.title = GAME_VERSION;
       const versionEl = document.getElementById('version-text');
       if (versionEl) versionEl.textContent = GAME_VERSION;
 
       const params = new URLSearchParams(location.search);
       const panel = document.getElementById('debug-panel');
       const toggle = document.getElementById('debug-toggle');
       const consolePanel = document.getElementById('console-panel');
       const consoleLogs = document.getElementById('console-logs');
+      window.debugRenderMode = 'normal';
+      window.debugStereoEyeSeparation = 0.064;
+      window.debugGlowStrength = 1.0;
+      window.debugBloomStrength = 1.0;
+      window.debugShellStrength = 1.0;
+      window.debugShellSaturation = 1.0;
+      window.debugShellScanlineSpeed = 1.0;
+      window.debugShellNoiseAmount = 0.35;
+      window.debugShellTint = '#99b8ff';
       if (params.get('debug') === '1') panel.style.display = 'block';
       toggle.addEventListener('click', function(e) { e.preventDefault(); panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; });
       document.getElementById('debug-jump').addEventListener('click', function() {
         const level = parseInt(document.getElementById('debug-level').value, 10) || 1;
         window.debugJumpToLevel = Math.max(1, Math.min(20, level));
@@ -336,19 +385,19 @@
           visualControls.style.display = isExpanded ? 'none' : 'block';
           visualToggle.textContent = (isExpanded ? '▶' : '▼') + ' Visual Tuning';
         });
 
         const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
-        const bindRangeAndNumber = (rangeId, numberId, min, max, fallback, setter) => {
+        const bindRangeAndNumber = (rangeId, numberId, min, max, fallback, setter, digits = 2) => {
           const range = document.getElementById(rangeId);
           const number = document.getElementById(numberId);
           if (!range || !number) return;
 
           const apply = (raw) => {
             const parsed = Number(raw);
             const value = Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
-            const fixed = value.toFixed(2);
+            const fixed = value.toFixed(digits);
             range.value = fixed;
             number.value = fixed;
             setter(value);
           };
 
@@ -365,18 +414,54 @@
         bindRangeAndNumber('debug-bloom-strength', 'debug-bloom-strength-value', 0, 2, 1.0, (value) => {
           window.debugBloomStrength = value;
           window.debugBloom = value > 0;
         });
 
+        bindRangeAndNumber('debug-shell-strength', 'debug-shell-strength-value', 0, 2, 1.0, (value) => {
+          window.debugShellStrength = value;
+        });
+
+        bindRangeAndNumber('debug-shell-saturation', 'debug-shell-saturation-value', 0, 2, 1.0, (value) => {
+          window.debugShellSaturation = value;
+        });
+
+        bindRangeAndNumber('debug-shell-scanline-speed', 'debug-shell-scanline-speed-value', 0, 3, 1.0, (value) => {
+          window.debugShellScanlineSpeed = value;
+        });
+
+        bindRangeAndNumber('debug-shell-noise-amount', 'debug-shell-noise-amount-value', 0, 2, 0.35, (value) => {
+          window.debugShellNoiseAmount = value;
+        });
+
         bindRangeAndNumber('debug-smoke-strength', 'debug-smoke-strength-value', 0, 2, 1.0, (value) => {
           window.debugSmokeStrength = value;
           window.debugSmoke = value > 0;
         });
 
         bindRangeAndNumber('debug-fog-intensity', 'debug-fog-intensity-value', 0, 1, 0.58, (value) => {
           window.debugFogIntensity = value;
         });
+
+        const renderModeSelect = document.getElementById('debug-render-mode');
+        if (renderModeSelect) {
+          renderModeSelect.addEventListener('change', () => {
+            window.debugRenderMode = renderModeSelect.value;
+          });
+          window.debugRenderMode = renderModeSelect.value;
+        }
+
+        bindRangeAndNumber('debug-stereo-eye-separation', 'debug-stereo-eye-separation-value', 0.01, 0.2, 0.064, (value) => {
+          window.debugStereoEyeSeparation = value;
+        }, 3);
+
+        const shellTintInput = document.getElementById('debug-shell-tint');
+        if (shellTintInput) {
+          shellTintInput.addEventListener('input', () => {
+            window.debugShellTint = shellTintInput.value;
+          });
+          window.debugShellTint = shellTintInput.value;
+        }
       }
 
       // Seed Deck Controls
       const seedInput = document.getElementById('seed-input');
       const seedTier = document.getElementById('seed-tier');
diff --git a/main.js b/main.js
index a64faa3..31722c8 100644
--- a/main.js
+++ b/main.js
@@ -11,10 +11,12 @@
 //   dream-world.js, spatial-hash.js
 // ============================================================
 
 import * as THREE from 'three';
 import { VRButton } from 'three/addons/webxr/VRButton.js';
+import { AnaglyphEffect } from 'three/addons/effects/AnaglyphEffect.js';
+import { StereoEffect } from 'three/addons/effects/StereoEffect.js';
 import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
 import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
 import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
 import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
 
@@ -49,11 +51,12 @@ import { setActiveStasisFields, getStasisSlowFactor } from './stasis.js';
 import { initVFX, updateVFX } from './vfx.js';
 import { rebuildBiomeScene as rebuildBiomeSceneModule, getBiomeFloorY as getBiomeFloorYModule } from './biome-scenes.js';
 import {
   initBossDeathCinematic, initBossDeathOverlays, startBossDeathCinematic,
   updateBossDeathCinematic, updateBossDeathFreeze, shouldFreezeTime,
-  isBossDeathCinematicActive, BOSS_DEATH_FREEZE
+  isBossDeathCinematicActive, isBossDeathOverlayActive, dismissBossDeathOverlay,
+  BOSS_DEATH_FREEZE
 } from './boss-death-cinematic.js';
 import {
   initHUD, showTitle, hideTitle, updateTitle, showHUD, hideHUD, updateHUD,
   showLevelComplete, hideLevelComplete, showUpgradeCards, hideUpgradeCards,
   updateUpgradeCards, getUpgradeCardHit, showGameOver, showVictory, updateEndScreen,
@@ -76,11 +79,11 @@ import {
 } from './hud.js';
 
 import {
   initDesktopControls, update as updateDesktopControls, getWeaponState,
   getPosition, getAimRaycaster, getVirtualController,
-  isLocked, isEnabled as isDesktopEnabled, setOnPauseCallback
+  isLocked, isEnabled as isDesktopEnabled, setOnPauseCallback, setOnNukeCallback
 } from './desktop-controls.js';
 import {
   submitScore, fetchTopScores, fetchScoresByCountry, fetchScoresByContinent,
   isNameClean, COUNTRIES, CONTINENTS,
   getStoredCountry, setStoredCountry, getStoredName, setStoredName
@@ -257,11 +260,13 @@ let auroraCanvas = null;
 let auroraCtx = null;
 let atmosphereRef = null;
 let vhsRetroShellRef = null;
 let vhsRetroScanlineMatRef = null;
 let vhsRetroGlowMatRef = null;
+let vhsRetroNoiseMatRef = null;
 let vhsRetroScanlineTexRef = null;
+let vhsRetroNoiseTexRef = null;
 let currentTheme = null;
 let biomePropsGroup = null;
 let biomePropsBiome = null;
 const biomePropFloaters = [];
 let biomeSceneGroup = null;
@@ -308,10 +313,14 @@ const _uiHoverDirs = [new THREE.Vector3(), new THREE.Vector3()];
 const _dreamPrevProjectilePos = new THREE.Vector3();
 const _dreamSegment = new THREE.Vector3();
 const _dreamToCenter = new THREE.Vector3();
 const _dreamClosestPoint = new THREE.Vector3();
 const _vhsPlayerPos = new THREE.Vector3();
+const _debugShellColor = new THREE.Color();
+const _debugShellGlowColor = new THREE.Color(0xff8ac1);
+const _debugShellWhite = new THREE.Color(0xffffff);
+const _debugShellHSL = { h: 0, s: 0, l: 0 };
 
 // Low health warning
 let lowHealthWarningActive = false;
 let lowHealthPulseTimer = 0;
 
@@ -399,10 +408,15 @@ function resolveAccuracyPellet(shotId) {
 // Camera shake on damage
 let cameraShake = 0;
 let cameraShakeIntensity = 0;
 const originalCameraPos = new THREE.Vector3();
 
+// Nuke flash overlay
+let nukeFlash = null;
+let nukeFlashTimer = 0;
+const NUKE_FLASH_DURATION = 600; // ms
+
 // Helper: Get camera position for UI positioning and enemy targeting
 // Returns the WORLD position of the camera (including camera rig offset)
 // In VR mode, the camera rig adds a height offset, so we need to get the world position
 // to ensure enemies target the correct height.
 function getAdjustedCameraPosition() {
@@ -456,10 +470,17 @@ const BLOOM_LAYER = 1;
 const VISUAL_TUNING_DEFAULTS = {
   glowStrength: 1.0,
   bloomStrength: 1.0,
   smokeStrength: 1.0,
   fogIntensity: 0.58,
+  shellStrength: 1.0,
+  shellTint: '#99b8ff',
+  shellSaturation: 1.0,
+  shellScanlineSpeed: 1.0,
+  shellNoiseAmount: 0.35,
+  renderMode: 'normal',
+  stereoEyeSeparation: 0.064,
 };
 
 // References that let debug visual tuning affect synthwave valley elements.
 const synthVisualRefs = {
   terrainUniforms: null,
@@ -469,10 +490,16 @@ const synthVisualRefs = {
 };
 
 // Player projectile materials that should respond to visual tuning sliders.
 const playerProjectileMaterials = [];
 
+// Desktop-only post-style helpers. XR continues to use renderer.render(scene, camera).
+const desktopEffectRefs = {
+  anaglyph: null,
+  stereo: null,
+};
+
 // VR pause button edge tracking (gamepad/menu style buttons).
 const vrPauseButtonPressed = new Map();
 let lastVRPauseToggleTime = 0;
 const VR_PAUSE_DEBOUNCE_MS = 350;
 
@@ -575,10 +602,27 @@ function init() {
 
   // Init subsystems
   initEnemies(scene);
   initHUD(camera, scene);
   initBossDeathOverlays();
+
+  // Nuke flash overlay (white screen flash on nuke activation)
+  const nukeFlashGeo = new THREE.PlaneGeometry(10, 10);
+  const nukeFlashMat = new THREE.MeshBasicMaterial({
+    color: 0xffffff,
+    transparent: true,
+    opacity: 0,
+    depthTest: false,
+    depthWrite: false,
+    blending: THREE.AdditiveBlending,
+  });
+  nukeFlash = new THREE.Mesh(nukeFlashGeo, nukeFlashMat);
+  nukeFlash.renderOrder = 1001;
+  nukeFlash.frustumCulled = false;
+  nukeFlash.position.set(0, 0, -0.3);
+  camera.add(nukeFlash);
+
   initVFX(scene);
 
   // PERFORMANCE: Initialize projectile pool
   initProjectilePool();
   
@@ -595,17 +639,20 @@ function init() {
   // Desktop controls for non-VR playtesting
   initDesktopControls(scene, camera, renderer);
 
   // Set up pause callback for ESC key
   setOnPauseCallback(togglePause);
+  setOnNukeCallback(activateNuke);
 
   // Test helpers for automation
   window.__test = window.__test || {};
   window.__test.getEnemies = getEnemies;
   window.__test.getEnemyCount = getEnemyCount;
   window.__test.getCamera = () => camera;
   window.__test.getRenderer = () => renderer;
+  window.__test.activateNuke = activateNuke;
+  window.__test.getNukeCount = () => game.nukes;
 
   // Test hook: deterministic single-shot at a chosen enemy for headless runs.
   // Params: enemyIndex (number), options { distance, hp, snapToCamera }.
   // Returns true if a projectile was fired.
   window.__test.fireAtEnemy = (enemyIndex, options = {}) => {
@@ -746,10 +793,34 @@ function resizeBloomComposer() {
   bloomComposer.baseComposer.setSize(w, h);
   bloomComposer.bloomComposer.setSize(w, h);
   bloomComposer.bloomComposer.passes[1].resolution.set(w, h);
 }
 
+function initDesktopStereoEffects() {
+  if (!renderer) return;
+
+  if (!desktopEffectRefs.anaglyph) {
+    desktopEffectRefs.anaglyph = new AnaglyphEffect(renderer, window.innerWidth, window.innerHeight);
+  }
+
+  if (!desktopEffectRefs.stereo) {
+    desktopEffectRefs.stereo = new StereoEffect(renderer);
+    desktopEffectRefs.stereo.eyeSeparation = VISUAL_TUNING_DEFAULTS.stereoEyeSeparation;
+  }
+
+  resizeDesktopStereoEffects();
+}
+
+function resizeDesktopStereoEffects() {
+  if (desktopEffectRefs.anaglyph) {
+    desktopEffectRefs.anaglyph.setSize(window.innerWidth, window.innerHeight);
+  }
+  if (desktopEffectRefs.stereo) {
+    desktopEffectRefs.stereo.setSize(window.innerWidth, window.innerHeight);
+  }
+}
+
 function clampDebugValue(value, min, max, fallback) {
   const n = Number(value);
   if (!Number.isFinite(n)) return fallback;
   return Math.min(max, Math.max(min, n));
 }
@@ -762,13 +833,31 @@ function getVisualTuning() {
   return {
     glowStrength: clampDebugValue(window.debugGlowStrength, 0, 2, VISUAL_TUNING_DEFAULTS.glowStrength),
     bloomStrength: clampDebugValue(window.debugBloomStrength, 0, 2, VISUAL_TUNING_DEFAULTS.bloomStrength),
     smokeStrength: clampDebugValue(window.debugSmokeStrength, 0, 2, VISUAL_TUNING_DEFAULTS.smokeStrength),
     fogIntensity: clampDebugValue(window.debugFogIntensity, 0, 1, VISUAL_TUNING_DEFAULTS.fogIntensity),
+    shellStrength: clampDebugValue(window.debugShellStrength, 0, 2, VISUAL_TUNING_DEFAULTS.shellStrength),
+    shellSaturation: clampDebugValue(window.debugShellSaturation, 0, 2, VISUAL_TUNING_DEFAULTS.shellSaturation),
+    shellScanlineSpeed: clampDebugValue(window.debugShellScanlineSpeed, 0, 3, VISUAL_TUNING_DEFAULTS.shellScanlineSpeed),
+    shellNoiseAmount: clampDebugValue(window.debugShellNoiseAmount, 0, 2, VISUAL_TUNING_DEFAULTS.shellNoiseAmount),
+    renderMode: typeof window.debugRenderMode === 'string' ? window.debugRenderMode : VISUAL_TUNING_DEFAULTS.renderMode,
+    stereoEyeSeparation: clampDebugValue(window.debugStereoEyeSeparation, 0.01, 0.2, VISUAL_TUNING_DEFAULTS.stereoEyeSeparation),
+    shellTint: typeof window.debugShellTint === 'string' ? window.debugShellTint : VISUAL_TUNING_DEFAULTS.shellTint,
   };
 }
 
+function getDebugShellColor(tuning) {
+  _debugShellColor.set(tuning.shellTint);
+  _debugShellColor.getHSL(_debugShellHSL);
+  _debugShellColor.setHSL(
+    _debugShellHSL.h,
+    Math.min(1, _debugShellHSL.s * tuning.shellSaturation),
+    _debugShellHSL.l
+  );
+  return _debugShellColor;
+}
+
 function registerPlayerProjectileMaterial(material) {
   if (!material) return;
   if (!material.userData) material.userData = {};
   if (material.userData.baseOpacity === undefined) {
     material.userData.baseOpacity = material.opacity !== undefined ? material.opacity : 1;
@@ -776,12 +865,11 @@ function registerPlayerProjectileMaterial(material) {
   if (!playerProjectileMaterials.includes(material)) {
     playerProjectileMaterials.push(material);
   }
 }
 
-function applyVisualTuning() {
-  const tuning = getVisualTuning();
+function applyVisualTuning(tuning = getVisualTuning()) {
 
   if (synthVisualRefs.terrainUniforms) {
     if (synthVisualRefs.terrainUniforms.uGlowIntensity) {
       synthVisualRefs.terrainUniforms.uGlowIntensity.value = tuning.glowStrength;
     }
@@ -816,10 +904,55 @@ function applyVisualTuning() {
   });
 
   if (bloomComposer?.bloomPass) {
     bloomComposer.bloomPass.strength = 0.3 * tuning.bloomStrength;
   }
+
+  if (desktopEffectRefs.stereo) {
+    desktopEffectRefs.stereo.eyeSeparation = tuning.stereoEyeSeparation;
+  }
+
+  // VR-safe shell tuning. This is the supported XR path for debug effects.
+  const shellColor = getDebugShellColor(tuning);
+  if (vhsRetroScanlineMatRef) {
+    vhsRetroScanlineMatRef.color.copy(shellColor).multiplyScalar(0.95 + tuning.glowStrength * 0.25);
+  }
+  if (vhsRetroGlowMatRef) {
+    vhsRetroGlowMatRef.color.copy(shellColor).lerp(_debugShellGlowColor, 0.35);
+  }
+  if (vhsRetroNoiseMatRef) {
+    vhsRetroNoiseMatRef.color.copy(shellColor).lerp(_debugShellWhite, 0.4);
+  }
+}
+
+function getDesktopRenderMode(tuning) {
+  if (renderer?.xr?.isPresenting) return 'normal';
+  if (tuning.renderMode === 'anaglyph' || tuning.renderMode === 'stereo') {
+    return tuning.renderMode;
+  }
+  return 'normal';
+}
+
+function renderDesktopDebugEffect(tuning) {
+  const mode = getDesktopRenderMode(tuning);
+  if (mode === 'normal') return false;
+
+  initDesktopStereoEffects();
+
+  // Desktop-only caveat: these effects render straight through the renderer,
+  // so selective bloom is intentionally bypassed while they are active.
+  if (mode === 'anaglyph' && desktopEffectRefs.anaglyph) {
+    desktopEffectRefs.anaglyph.render(scene, camera);
+    return true;
+  }
+
+  if (mode === 'stereo' && desktopEffectRefs.stereo) {
+    desktopEffectRefs.stereo.render(scene, camera);
+    return true;
+  }
+
+  return false;
 }
 
 function cleanupLegacyShapeGeometry(targetGroup) {
   if (!targetGroup) return;
 
@@ -2137,91 +2270,150 @@ function createVHSGlowTexture() {
   texture.wrapS = THREE.RepeatWrapping;
   texture.wrapT = THREE.ClampToEdgeWrapping;
   return texture;
 }
 
+function createVHSNoiseTexture() {
+  const canvas = document.createElement('canvas');
+  canvas.width = 128;
+  canvas.height = 128;
+  const ctx = canvas.getContext('2d');
+  const image = ctx.createImageData(canvas.width, canvas.height);
+  const data = image.data;
+
+  for (let i = 0; i < data.length; i += 4) {
+    const value = Math.floor(Math.random() * 255);
+    data[i] = value;
+    data[i + 1] = value;
+    data[i + 2] = value;
+    data[i + 3] = 255;
+  }
+
+  ctx.putImageData(image, 0, 0);
+
+  const texture = new THREE.CanvasTexture(canvas);
+  texture.wrapS = THREE.RepeatWrapping;
+  texture.wrapT = THREE.RepeatWrapping;
+  texture.repeat.set(3, 2);
+  return texture;
+}
+
 function createVHSRetroShell() {
   if (!scene || vhsRetroShellRef) return;
 
-  // VR-safe VHS effect: world-space cylinders, not a full-screen post process.
-  // This avoids eye strain from head-locked overlays and keeps stereo depth intact.
+  // VR-CRITICAL: Keep this as geometry around the player, not a head-locked
+  // post-process. XR continues to render through renderer.render(scene, camera).
+  // The previous open cylinder was fragile from inside the head in VR. These
+  // layered spheres stay visible when looking up/down and avoid side-culling.
   const shellGroup = new THREE.Group();
   shellGroup.name = 'vhsRetroShellRef';
 
-  const radius = 86;
-  const height = 46;
+  const radius = 80;
   const segments = 40;
+  const rings = 28;
 
-  const scanlineGeo = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true);
+  const scanlineGeo = new THREE.SphereGeometry(radius, segments, rings);
   const scanlineTex = createVHSScanlineTexture();
   const scanlineMat = new THREE.MeshBasicMaterial({
     map: scanlineTex,
     color: 0x99b8ff,
     transparent: true,
-    opacity: 0.10,
-    side: THREE.BackSide,
+    opacity: 0.09,
+    side: THREE.DoubleSide,
+    depthTest: false,
     depthWrite: false,
     blending: THREE.AdditiveBlending,
   });
   const scanlineShell = new THREE.Mesh(scanlineGeo, scanlineMat);
   scanlineShell.name = 'vhs-scanline-shell';
-  scanlineShell.renderOrder = -14;
+  scanlineShell.renderOrder = 950;
   shellGroup.add(scanlineShell);
 
-  const glowGeo = new THREE.CylinderGeometry(radius - 1.5, radius - 1.5, height, segments, 1, true);
+  const glowGeo = new THREE.SphereGeometry(radius - 1.2, segments, rings);
   const glowTex = createVHSGlowTexture();
   const glowMat = new THREE.MeshBasicMaterial({
     map: glowTex,
     color: 0xff7aa6,
     transparent: true,
     opacity: 0.06,
-    side: THREE.BackSide,
+    side: THREE.DoubleSide,
+    depthTest: false,
     depthWrite: false,
     blending: THREE.AdditiveBlending,
   });
   const glowShell = new THREE.Mesh(glowGeo, glowMat);
   glowShell.name = 'vhs-glow-shell';
-  glowShell.renderOrder = -15;
+  glowShell.renderOrder = 951;
   shellGroup.add(glowShell);
 
-  shellGroup.position.set(0, (height * 0.5) - 1 + SCENE_Y_OFFSET, 0);
+  const noiseGeo = new THREE.SphereGeometry(radius - 2.6, 28, 20);
+  const noiseTex = createVHSNoiseTexture();
+  const noiseMat = new THREE.MeshBasicMaterial({
+    map: noiseTex,
+    color: 0xcad6ff,
+    transparent: true,
+    opacity: 0.02,
+    side: THREE.DoubleSide,
+    depthTest: false,
+    depthWrite: false,
+    blending: THREE.AdditiveBlending,
+  });
+  const noiseShell = new THREE.Mesh(noiseGeo, noiseMat);
+  noiseShell.name = 'vhs-noise-shell';
+  noiseShell.renderOrder = 952;
+  shellGroup.add(noiseShell);
+
   shellGroup.frustumCulled = false;
   scene.add(shellGroup);
 
   vhsRetroShellRef = shellGroup;
   vhsRetroScanlineMatRef = scanlineMat;
   vhsRetroGlowMatRef = glowMat;
+  vhsRetroNoiseMatRef = noiseMat;
   vhsRetroScanlineTexRef = scanlineTex;
+  vhsRetroNoiseTexRef = noiseTex;
 
   registerFadeMaterial(scanlineMat);
   registerFadeMaterial(glowMat);
+  registerFadeMaterial(noiseMat);
 }
 
-function updateVHSRetroShell(now) {
+function updateVHSRetroShell(now, tuning = getVisualTuning()) {
   if (!vhsRetroShellRef || !camera) return;
 
   camera.getWorldPosition(_vhsPlayerPos);
-  vhsRetroShellRef.position.x = _vhsPlayerPos.x;
-  vhsRetroShellRef.position.z = _vhsPlayerPos.z;
+  vhsRetroShellRef.position.copy(_vhsPlayerPos);
 
   if (vhsRetroScanlineTexRef) {
-    vhsRetroScanlineTexRef.offset.y = (now * 0.000035) % 1;
-    vhsRetroScanlineTexRef.offset.x = Math.sin(now * 0.0001) * 0.01;
+    const scanSpeed = 0.00002 + tuning.shellScanlineSpeed * 0.000045;
+    vhsRetroScanlineTexRef.offset.y = (now * scanSpeed) % 1;
+    vhsRetroScanlineTexRef.offset.x = Math.sin(now * 0.0001) * 0.01 * tuning.shellStrength;
+  }
+
+  if (vhsRetroNoiseTexRef) {
+    vhsRetroNoiseTexRef.offset.x = (now * 0.000037 * (0.4 + tuning.shellScanlineSpeed)) % 1;
+    vhsRetroNoiseTexRef.offset.y = (now * 0.000061 * (0.3 + tuning.shellScanlineSpeed)) % 1;
   }
 
   const fadeScale = 1 - environmentFade;
   if (vhsRetroScanlineMatRef) {
-    const base = vhsRetroScanlineMatRef.__fadeBase ?? 0.10;
+    const base = (vhsRetroScanlineMatRef.__fadeBase ?? 0.09) * tuning.shellStrength * (0.45 + tuning.glowStrength * 0.75);
     const flicker = 0.95 + Math.sin(now * 0.0018) * 0.05;
     vhsRetroScanlineMatRef.opacity = base * fadeScale * flicker;
   }
 
   if (vhsRetroGlowMatRef) {
-    const base = vhsRetroGlowMatRef.__fadeBase ?? 0.06;
+    const base = (vhsRetroGlowMatRef.__fadeBase ?? 0.06) * tuning.shellStrength * (0.25 + tuning.glowStrength * 0.35 + tuning.bloomStrength * 0.5);
     const pulse = 0.9 + Math.sin(now * 0.0011) * 0.1;
     vhsRetroGlowMatRef.opacity = base * fadeScale * pulse;
   }
+
+  if (vhsRetroNoiseMatRef) {
+    const base = (vhsRetroNoiseMatRef.__fadeBase ?? 0.02) * tuning.shellStrength * tuning.shellNoiseAmount * (0.3 + tuning.bloomStrength * 0.7);
+    const shimmer = 0.7 + Math.sin(now * 0.0031) * 0.3;
+    vhsRetroNoiseMatRef.opacity = base * fadeScale * shimmer;
+  }
 }
 
 function createMountains() {
   const layers = [
     { z: -85, color: 0x0d001a, peaks: generatePeaks(12, 6, 20), layerIndex: 0 },
@@ -3120,22 +3312,75 @@ function onTriggerRelease(index) {
     lightningBeams[index] = null;
     stopLightningSound();
   }
 }
 
+// ============================================================
+//  NUKE — ALT-FIRE SCREEN CLEAR
+//  Instantly kills all non-boss enemies. Both controllers trigger it.
+//  Cooldown: 0.5s between activations to prevent double-fire.
+// ============================================================
+let lastNukeTime = 0;
+const NUKE_COOLDOWN = 500;
+
+function activateNuke() {
+  if (game.state !== State.PLAYING) return false;
+  if (!game.nukes || game.nukes <= 0) return false;
+
+  const now = performance.now();
+  if (now - lastNukeTime < NUKE_COOLDOWN) return false;
+  lastNukeTime = now;
+
+  // Consume nuke
+  game.nukes--;
+  game.runStats.nukesUsed++;
+
+  // White flash
+  if (nukeFlash) {
+    nukeFlash.material.opacity = 1.0;
+    nukeFlashTimer = now;
+  }
+
+  // Kill all non-boss enemies
+  const enemies = getEnemies();
+  let killed = 0;
+  // Iterate backwards since destroyEnemy splices the array
+  for (let i = enemies.length - 1; i >= 0; i--) {
+    const e = enemies[i];
+    // Bosses survive (mesh.userData.isBoss or isBoss property)
+    if (e.mesh && e.mesh.userData && e.mesh.userData.isBoss) continue;
+    if (e.isBoss) continue;
+
+    // Set HP to 0 so the death system handles cleanup naturally
+    e.hp = 0;
+    destroyEnemy(i, false, true); // isCritical=false, isOverkill=true (nuke)
+    game.kills++;
+    game.totalKills++;
+    trackKill(false);
+    addScore(50); // Base score per nuked enemy
+    killed++;
+  }
+
+  console.log(`[nuke] Activated! Killed ${killed} enemies. ${game.nukes} remaining.`);
+  return true;
+}
+
 // ============================================================
 // ALT WEAPON SYSTEMS
 // Shield, laser mines, decoys, black holes, tethers, nanites,
 // phase dash, reflector drones, stasis, plasma orbs, grenades,
 // proximity mines, attack drones, EMP, teleport
 // COUPLING: Updates scene, activeShields/activeLaserMines/etc arrays
 // ============================================================
 function onSqueezePress(controller, index) {
   const st = game.state;
   
-  // Only fire ALT weapons during gameplay
   if (st === State.PLAYING) {
+    // Nuke takes priority: if player has nukes, squeeze activates nuke
+    if (game.nukes > 0) {
+      if (activateNuke()) return;
+    }
     fireAltWeapon(controller, index);
   }
 }
 
 function onSqueezeRelease(index) {
@@ -6481,11 +6726,16 @@ function completeLevel() {
   stopLightningSound();
   game.justBossKill = game._levelConfig && game._levelConfig.isBoss;
   game.stateTimer = 2.0; // cooldown before upgrade screen
   levelFadeReady = false;
   const shouldFade = shouldFadeForBiomeTransition(game.level);
-  if (shouldFade) {
+  // If the boss death overlay is still active, the environment is already fully
+  // faded to black. Skip the fade-out animation to prevent a pop-back flash.
+  if (isBossDeathOverlayActive()) {
+    console.log('[game] Boss death overlay active, skipping environment fade-out');
+    levelFadeReady = true;
+  } else if (shouldFade) {
     startEnvironmentFade('out', 0.8, () => {
       levelFadeReady = true;
       applyEnvironmentFade(1);
     });
   } else {
@@ -6603,10 +6853,17 @@ function selectUpgradeAndAdvance(upgrade, hand) {
     return;
   }
 
   // Regular upgrade
   addUpgrade(upgrade.id, hand);
+
+  // Special handling for nuke upgrade
+  if (upgrade.id === 'extra_nuke') {
+    game.nukes = (game.nukes || 0) + 1;
+    console.log(`[nuke] Extra nuke granted. Total: ${game.nukes}`);
+  }
+
   playUpgradeSound();
   hideUpgradeCards();
   advanceLevelAfterUpgrade();
 }
 
@@ -6645,10 +6902,14 @@ function advanceLevelAfterUpgrade() {
       applyEnvironmentFade(1);
 
       // CRITICAL: Apply new biome theme after boss kill
       applyThemeForLevel(game.level);
 
+      // Dismiss the boss death overlay now that the new biome is set up.
+      // The environment is at full fade so nothing pops back.
+      dismissBossDeathOverlay();
+
       // Show ready screen with countdown
       showReadyScreen(game.level, getAdjustedCameraPosition());
       resetReadyCountdown();
 
       if (game.level === 6) {
@@ -6668,13 +6929,15 @@ function advanceLevelAfterUpgrade() {
       game.justBossKill = false;
     } else {
       game.state = State.PLAYING;
       if (shouldFade) {
         applyEnvironmentFade(1);
+        dismissBossDeathOverlay();
         startEnvironmentFade('in', 0.8);
       } else {
         applyEnvironmentFade(0);
+        dismissBossDeathOverlay();
       }
       hideReadyScreen();
       showHUD();
 
       // Stagger setup
@@ -8145,10 +8408,18 @@ function handleHit(enemyIndex, enemy, stats, hitPoint, controllerIndex, isExplod
 
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
@@ -10005,10 +10276,21 @@ function render(timestamp) {
       game.accuracyMultiplier = 1;
     }
   });
   updateHitFlash(rawDt);  // Use rawDt so flash works during bullet-time
 
+  // Nuke flash decay
+  if (nukeFlash && nukeFlashTimer > 0) {
+    const elapsed = performance.now() - nukeFlashTimer;
+    const t = Math.max(0, 1 - elapsed / NUKE_FLASH_DURATION);
+    nukeFlash.material.opacity = t * t; // Quadratic ease-out
+    if (t <= 0) {
+      nukeFlashTimer = 0;
+      nukeFlash.material.opacity = 0;
+    }
+  }
+
   // ── New ALT weapon updates ──
   updateGrenades(dt, now);
   updateProximityMines(now, dt);
   updateAttackDrones(now, dt, getAdjustedCameraPosition());
   updateEMPVisuals(now, dt);
@@ -10022,20 +10304,26 @@ function render(timestamp) {
   // Hide scanlines overlay in VR — it creates a dark box that follows the head and obscures the view
   const scanlinesEl = document.getElementById('scanlines');
   if (scanlinesEl) scanlinesEl.style.display = renderer.xr.isPresenting ? 'none' : '';
 
   // Keep visual tuning and secret trigger visuals responsive every frame.
-  applyVisualTuning();
-  updateVHSRetroShell(now);
+  const visualTuning = getVisualTuning();
+  applyVisualTuning(visualTuning);
+  updateVHSRetroShell(now, visualTuning);
   updateDreamTriggerVisual(now);
 
   // Update pause countdown BEFORE any early-return render path.
   // This fixes countdown freeze when selective bloom is active.
   updatePauseCountdown(now);
 
-  // Selective bloom: lazy-init + render, only in desktop mode for synthwave_valley biome
-  if (!renderer.xr.isPresenting && biomeSceneBiome === 'synthwave_valley') {
+  // Desktop-only debug effects. XR intentionally keeps the default renderer path.
+  if (!renderer.xr.isPresenting && renderDesktopDebugEffect(visualTuning)) {
+    return;
+  }
+
+  // Selective bloom: lazy-init + render, only in normal desktop mode for synthwave_valley biome
+  if (!renderer.xr.isPresenting && getDesktopRenderMode(visualTuning) === 'normal' && biomeSceneBiome === 'synthwave_valley') {
     if (!bloomComposer) initSelectiveBloom();  // Lazy init on first frame
     if (bloomComposer) {
       bloomComposer.bloomCamera.position.copy(camera.position);
       bloomComposer.bloomCamera.quaternion.copy(camera.quaternion);
       bloomComposer.bloomCamera.projectionMatrix.copy(camera.projectionMatrix);
@@ -10058,10 +10346,11 @@ function render(timestamp) {
 function onWindowResize() {
   camera.aspect = window.innerWidth / window.innerHeight;
   camera.updateProjectionMatrix();
   renderer.setSize(window.innerWidth, window.innerHeight);
   resizeBloomComposer();
+  resizeDesktopStereoEffects();
 }
 
 // ============================================================
 // BIOME SCENE ORCHESTRATION
 // Delegates to biome-scenes.js module for scene building
diff --git a/weapons.js b/weapons.js
index 7b0253d..438c669 100644
--- a/weapons.js
+++ b/weapons.js
@@ -358,10 +358,13 @@ export const UPGRADE_POOL = [
   // Plasma Carbine specific upgrades
   { id: 'hold_together', name: 'Hold It Together', desc: 'Plasma Carbine: 40% faster wind-up, higher max damage', color: '#00ffff', type: 'weapon_specific', weapon: 'plasma_carbine' },
   
   // Seeker Burst specific upgrades
   { id: 'gimme_more', name: 'Gimme Gimme More', desc: 'Seeker Burst: +2 homing shots per burst', color: '#aa88ff', type: 'weapon_specific', weapon: 'seeker_burst' },
+
+  // Nuke upgrade (universal — grants +1 nuke charge)
+  { id: 'extra_nuke', name: 'Extra Nuke', desc: '+1 nuke charge (alt-fire)', color: '#ffff44', type: 'universal' },
 ];
 
 // Special upgrades (after boss victories)
 export const SPECIAL_UPGRADE_POOL = [
   { id: 'mega_scope', name: 'Mega Scope', desc: 'Damage +25 per stack', color: '#00ff88', type: 'universal' },
