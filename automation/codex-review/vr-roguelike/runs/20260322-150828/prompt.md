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
- Base SHA: b8bb96305a63407f9d18d9668a5777fa11042cb6
- Head SHA: b04f5086436a472120c5cb7c7b7827e798ea0172
- Commit count in scope: 1
- Include uncommitted changes: 1

## Changed files
 audio.js            |  18 ------------------
 game-screenshot.png | Bin 87967 -> 538929 bytes
 main.js             |  16 ++++++----------
 3 files changed, 6 insertions(+), 28 deletions(-)

## Unified diff
diff --git a/audio.js b/audio.js
index 420b475..2f40a0e 100644
--- a/audio.js
+++ b/audio.js
@@ -1364,32 +1364,14 @@ function playNextTrack() {
   const track = currentPlaylist[currentTrackIndex];
   console.log(`[music] Playing track ${currentTrackIndex + 1}/${currentPlaylist.length}: ${track}`);
 
   const ctx = getAudioContext();
 
-  // Create analyser if it doesn't exist
-  if (!musicAnalyser) {
-    musicAnalyser = ctx.createAnalyser();
-    musicAnalyser.fftSize = 64;  // Small for performance (32 frequency bins)
-    musicAnalyser.smoothingTimeConstant = 0.8;
-    musicAnalyser.connect(ctx.destination);
-  }
-
   currentMusic = new Audio(track);
   currentMusic.volume = musicVolume;
   currentMusic.loop = false;  // Don't loop individual tracks
 
-  // Connect same-origin music through analyser for visualization.
-  // Cross-origin CDN tracks can still play directly, but should not be routed
-  // through Web Audio unless the CDN sends permissive CORS headers.
-  musicSource = null;
-  const isCrossOriginTrack = /^https?:\/\//i.test(track);
-  if (!isCrossOriginTrack) {
-    musicSource = ctx.createMediaElementSource(currentMusic);
-    musicSource.connect(musicAnalyser);
-  }
-
   // Auto-advance to next track when current ends (only if playlist looping is enabled)
   currentMusic.addEventListener('ended', () => {
     if (!loopPlaylist) return;  // Don't loop for single-play tracks like game over
     currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length;
     playNextTrack();
diff --git a/game-screenshot.png b/game-screenshot.png
index 9852630..40864f5 100644
Binary files a/game-screenshot.png and b/game-screenshot.png differ
diff --git a/main.js b/main.js
index 5d98b67..9a6cbf1 100644
--- a/main.js
+++ b/main.js
@@ -211,10 +211,13 @@ const chargeGlowSpheres = [null, null];
 const chargeParticleSystems = [null, null];
 
 // Holographic blaster displays (per controller)
 const blasterDisplays = [null, null];
 
+// Mountain visualizer references (for per-theme color updates)
+const mountainLines = [];
+
 // Environment refs for level-based scaling (sun, ominous horizon)
 let sunMeshRef = null;
 let sunGlowRef = null;
 let ominousRef = null;
 let gridHelper = null;
@@ -1148,15 +1151,10 @@ function applyThemeForLevel(level) {
   const hideBaseEnv = !!theme.hideBaseEnv;
   if (gridHelper) gridHelper.visible = !hideBaseEnv;
   if (horizonRingRef) horizonRingRef.visible = !hideBaseEnv;
   if (horizonInnerRingRef) horizonInnerRingRef.visible = !hideBaseEnv;
   if (sunMeshRef) sunMeshRef.visible = !hideBaseEnv;
-  // Hide base environment mountains when custom biome scene replaces them
-  mountainLines.forEach((layer) => {
-    if (layer.fillMesh) layer.fillMesh.visible = !hideBaseEnv;
-    if (layer.line) layer.line.visible = !hideBaseEnv;
-  });
   if (atmosphereRef) atmosphereRef.visible = !hideBaseEnv;
   if (sunGlowRef) sunGlowRef.visible = !hideBaseEnv;
   if (starsRef) starsRef.visible = theme.keepStars ? true : !hideBaseEnv;
 
   rebuildBiomeProps(getBiomeForLevel(level), theme);
@@ -1666,11 +1664,11 @@ function createAtmosphere() {
 function createMountains() {
   const layers = [
     { z: -85, color: 0x0d001a, peaks: generatePeaks(12, 6, 20), layerIndex: 0 },
     { z: -75, color: MTN_DARK, peaks: generatePeaks(10, 4, 14), layerIndex: 1 },
   ];
-  layers.forEach(({ z, color, peaks }) => {
+  layers.forEach(({ z, color, peaks, layerIndex }) => {
     const shape = new THREE.Shape();
     shape.moveTo(-100, 0);
     peaks.forEach(([x, y]) => shape.lineTo(x, y));
     shape.lineTo(100, 0);
     shape.closePath();
@@ -1689,10 +1687,12 @@ function createMountains() {
     const edgeLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: MTN_WIRE, transparent: true, opacity: 0.5 }));
     edgeLine.matrixAutoUpdate = false;
     scene.add(edgeLine);
     registerFadeMaterial(edgeLine.material);
 
+    // Store for theme color updates
+    mountainLines[layerIndex] = { line: edgeLine, geometry, z, fillMesh };
   });
 }
 
 function generatePeaks(count, minH, maxH) {
   const peaks = [];
@@ -11223,9 +11223,5 @@ function buildHellscapeLavaScene(group) {
 
   // Hellscape floor HUD height: group.position.y = 0.05
   group.position.set(26.599, 0.05, -0.486);
   group.rotation.y = 0.248; // yaw: 14.21°
 }
-.05
-  group.position.set(26.599, 0.05, -0.486);
-  group.rotation.y = 0.248; // yaw: 14.21°
-}

--- UNCOMMITTED CHANGES ---
 AGENTS.md | 11 +++++++++++
 1 file changed, 11 insertions(+)

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
