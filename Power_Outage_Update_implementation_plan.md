# Implementation Plan: 15 Feature Changes

## Overview

15 changes across combat, boss, transitions, audio, and UI. Grouped into 6 phases by dependency and file locality to minimize conflicts.

---

## Phase 1 — Combat & Feedback (#1, #14)

### #1: Buckshot Cone Spread

#### [MODIFY] [main.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/main.js)

**Current:** In `shootWeapon` (L1126-1166), all buckshot pellets share `_tempDir` — they fire in parallel lines offset horizontally.

**Change:** When `isBuckshot`, apply a random conical deviation of ±3° to each pellet's direction before passing to `spawnProjectile`.

```diff
 for (let i = 0; i < count; i++) {
   let spawnOrigin = _tempVec.clone();
-  if (count > 1) {
-    const offsetIndex = i - (count - 1) / 2;
-    spawnOrigin.addScaledVector(rightAxis, offsetIndex * gap);
-  }
-  spawnProjectile(spawnOrigin, _tempDir.clone(), index, stats);
+  let pelletDir = _tempDir.clone();
+  if (stats.spreadAngle > 0) {
+    // Apply random cone spread (~3° = 0.0524 radians)
+    const spreadRad = (stats.spreadAngle * Math.PI) / 180;
+    const theta = Math.random() * Math.PI * 2;
+    const phi = Math.random() * spreadRad;
+    const perturbX = Math.sin(phi) * Math.cos(theta);
+    const perturbY = Math.sin(phi) * Math.sin(theta);
+    const up = new THREE.Vector3(0, 1, 0);
+    const right = new THREE.Vector3().crossVectors(pelletDir, up).normalize();
+    const trueUp = new THREE.Vector3().crossVectors(right, pelletDir).normalize();
+    pelletDir.addScaledVector(right, perturbX);
+    pelletDir.addScaledVector(trueUp, perturbY);
+    pelletDir.normalize();
+  }
+  spawnProjectile(spawnOrigin, pelletDir, index, stats);
 }
```

> [!NOTE]
> The parallel offset logic (`rightAxis * gap`) is removed — cone spread replaces it. Pellets all start from `_tempVec` (same origin point) but diverge angularly.

**Impact check:** `spawnProjectile` (L1422) already accepts direction — no downstream changes needed.

---

### #14: Crit Hit Visual Feedback

#### [MODIFY] [main.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/main.js)

**Current:** `handleHit` (L1483-1553) calculates crit damage but calls `spawnDamageNumber(hitPoint, damage, '#ffffff')` with a generic white color regardless.

**Change:**
- Track whether hit was a crit (boolean flag)
- Pass crit info to `spawnDamageNumber` so it can render differently

```diff
-  if (stats.critChance > 0 && Math.random() < stats.critChance) {
-    damage *= (stats.critMultiplier || 2);
-  }
+  let isCrit = false;
+  if (stats.critChance > 0 && Math.random() < stats.critChance) {
+    damage *= (stats.critMultiplier || 2);
+    isCrit = true;
+  }
   ...
-  spawnDamageNumber(hitPoint, damage, '#ffffff');
+  spawnDamageNumber(hitPoint, damage, isCrit ? '#ffff00' : '#ffffff', isCrit);
```

#### [MODIFY] [hud.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/hud.js)

**Current:** `spawnDamageNumber` (L956-1019) uses a fixed scale and no special text.

**Changes:**
1. Accept optional `isCrit` parameter
2. For crits: double the scale, use gold/yellow color
3. Spawn a **second** floating text mesh that says `"CRIT!"` in a bright distinct color (e.g. `#ff4400`), offset slightly above the damage number, using the same drift/fade logic

```js
export function spawnDamageNumber(position, damage, color, isCrit = false) {
  // ... existing canvas setup ...
  const fontSize = isCrit
    ? Math.min(48, 28 + damage / 6) * 2   // 2x size for crits
    : Math.min(48, 28 + damage / 6);
  // Use isCrit color override
  const displayColor = isCrit ? '#ffff00' : (color || '#ffffff');
  // ... rest of rendering ...
  const scale = isCrit
    ? (0.25 + Math.min(damage / 100, 0.15)) * 2  // 2x mesh scale
    : (0.25 + Math.min(damage / 100, 0.15));
  // After damage number is spawned, also spawn "CRIT!" text:
  if (isCrit) {
    spawnCritLabel(position); // new helper
  }
}
```

**New function `spawnCritLabel(position)`:** Creates a small floating "CRIT!" text in bright orange/red that drifts upward and fades out, similar to damage numbers but with:
- Canvas text: bold `"CRIT!"`, orange (`#ff4400`)
- Position: slightly above the damage number (y + 0.2)
- Pushed into `damageNumbers` array with identical lifecycle management

---

## Phase 2 — Boss System (#2, #3, #4)

### #2: Boss Music & Pre-Boss Silence

#### [MODIFY] [audio.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/audio.js)

**Current:** Music playlists only cover `levels1to5` and `levels6to10`. Music plays continuously.

**Changes:**
1. Add `stopMusic()` export function (pauses and resets `currentMusic`)
2. Add 4 boss playlists to `musicTracks` with confirmed file paths:
   - `boss5`: `B101_Level_05_Boss.mp3` through `B104_Level_05_Boss.mp3`
   - `boss10`: `B201_Level_10_Boss.mp3` through `B204_Level_10_Boss.mp3`
   - `boss15`: `B301_Level_15_Boss.mp3` through `B304_Level_15_Boss.mp3`
   - `boss20`: `B401_Level_20_Boss.mp3` through `B404_Level_20_Boss.mp3`
   - All in `mnt/project/music/`
3. Existing `playMusic` already handles category switching

```js
export function stopMusic() {
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }
}
```

#### [MODIFY] [main.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/main.js)

**Change in `advanceLevelAfterUpgrade`:** When next level is a boss level (level % 5 === 0), call `stopMusic()` instead of continuing playlist. Boss music will be triggered after the alert sequence (see #3), using `playMusic('boss5')` / `playMusic('boss10')` etc. based on level number.

```diff
+  import { stopMusic } from './audio.js';
   ...
   // In advanceLevelAfterUpgrade:
+  const nextCfg = getLevelConfig();
+  if (nextCfg.isBoss) {
+    stopMusic(); // Silence before boss
+  } else if (game.level === 6) {
     playMusic('levels6to10');
+  }
```

Then in the `BOSS_ALERT` handler (after the 3s alert sequence), call:
```js
const bossCategory = `boss${game.level}`; // 'boss5', 'boss10', etc.
playMusic(bossCategory);
```

---

### #3: Boss Alert Sequence

#### [MODIFY] [main.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/main.js)

**Current:** After upgrade selection, `advanceLevelAfterUpgrade` immediately enters `PLAYING` state.

**Changes:**
1. Add a new state `BOSS_ALERT` to `State` enum in `game.js`
2. When entering a boss level, set `game.state = State.BOSS_ALERT` with a 3-second timer
3. In the render loop, handle `BOSS_ALERT`:
   - Show "⚠ ALERT! ALERT!" and "INCOMING BOSS!" text (world-space sprites via `hud.js`)
   - Play warning sound (repeating alarm from `audio.js`)
   - After timer expires → transition to `PLAYING` + spawn boss + start boss music

#### [MODIFY] [game.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/game.js)

Add `BOSS_ALERT: 'boss_alert'` to the `State` enum.

#### [NEW] Audio: `playBossAlertSound()` in [audio.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/audio.js)

A short repeating klaxon/alarm sound (3 beeps over ~2 seconds) using procedural Web Audio oscillators. Similar pattern to the existing `playBossSpawn` but more urgent and repeated.

#### [NEW] HUD: `showBossAlert()` / `hideBossAlert()` in [hud.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/hud.js)

Create world-space text sprites:
- Line 1: `"⚠ ALERT! ALERT! ⚠"` in red, large, with glow
- Line 2: `"INCOMING BOSS!"` in yellow, pulsing opacity

Position at (0, 2.0, -4) — midfield, eye level.

---

### #4: Boss Health Bar Above Head

#### [MODIFY] [hud.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/hud.js)

**Current:** Boss health bar is camera-attached (3 separate phase segments at the top of view, `bossHealthGroup` at camera position (0, 0.3, -0.6)). This needs a full redesign.

**Redesign:**
1. **Remove camera attachment** — detach `bossHealthGroup` from camera, add to scene instead
2. **Single continuous bar** instead of 3 segments:
   - Green bar background (dark) + green fill foreground
   - Width: ~1.5 units, Height: ~0.08 units
   - Color transitions: green (#00ff44) → yellow (#ffff00) → red (#ff2200) → dark red (#880000) based on HP percentage
3. **Position tracking:** In `render` loop, update `bossHealthGroup.position` to boss mesh position + offset (0, +1.0, 0) — floats above the boss's head
4. **Billboard behavior:** Make bar always face camera using `bossHealthGroup.lookAt(camera.position)`

```js
export function updateBossHealthBar(hp, maxHp, bossMesh) {
  if (!bossHealthGroup || !bossHealthGroup.visible) return;
  const t = hp / maxHp; // 0..1
  
  // Scale fill bar
  bossHealthFillBar.scale.x = Math.max(0.001, t);
  bossHealthFillBar.position.x = -(1 - t) * barWidth / 2; // Drain from right
  
  // Color: green → yellow → red → dark red
  const color = new THREE.Color();
  if (t > 0.5) color.setHex(0x00ff44).lerp(new THREE.Color(0xffff00), 1 - (t - 0.5) * 2);
  else if (t > 0.25) color.setHex(0xffff00).lerp(new THREE.Color(0xff2200), 1 - (t - 0.25) * 4);
  else color.setHex(0xff2200).lerp(new THREE.Color(0x880000), 1 - t * 4);
  bossHealthFillBar.material.color.copy(color);
  
  // Position above boss
  if (bossMesh) {
    bossHealthGroup.position.copy(bossMesh.position);
    bossHealthGroup.position.y += 1.2;
  }
}
```

**Impact:** `showBossHealthBar` / `hideBossHealthBar` callers in `main.js` need the boss mesh reference passed. `initHUD` creation of `bossHealthGroup` changes from camera child to scene child.

---

## Phase 3 — Level Transitions (#6, #8, #9)

### #6: Slow-Mo Level Complete Finale

#### [MODIFY] [main.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/main.js)

**Current:** `completeLevel` (L997-1005) immediately clears enemies and sets a 2-second timer.

**Changes:**
1. Add a new state `LEVEL_COMPLETE_SLOWMO` (add to `State` in `game.js`)
2. When the last kill happens, enter `LEVEL_COMPLETE_SLOWMO` instead of clearing enemies immediately:
   - Set `timeScale = 0.15` (heavy slow-mo)
   - Set a 3-second timer (real-time, using `rawDt`)
   - Play a large explosion sound (`playBigExplosionSound()` — new louder variant)
3. In render loop, handle `LEVEL_COMPLETE_SLOWMO`:
   - Count down using `rawDt` (not scaled dt)
   - After ~1.5s: explode all remaining enemies on screen with particle effects
   - After 3s: restore `timeScale = 1.0`, transition to `LEVEL_COMPLETE`

#### [MODIFY] [game.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/game.js)

Add `LEVEL_COMPLETE_SLOWMO: 'level_complete_slowmo'` to `State`.

#### [NEW] Audio function in [audio.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/audio.js)

`playBigExplosionSound()` — louder, deeper, longer explosion than `playExplosionSound`.

---

### #8: "5 KILLS REMAINING" Message

#### [MODIFY] [main.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/main.js)

In the kill-counting code in `handleHit` (where `game.kills++`), add a check:

```js
const remaining = cfg.killTarget - game.kills;
if (remaining === 5 && !game._shownKillsRemaining) {
  game._shownKillsRemaining = true;
  showKillsRemainingMessage(5); // New HUD function
}
```

Reset `game._shownKillsRemaining = false` in `advanceLevelAfterUpgrade` when starting a new level.

#### [NEW] HUD function in [hud.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/hud.js)

`showKillsRemainingMessage(count)` — Creates a large world-space text "5 KILLS REMAINING" at midfield (0, 2.0, -5) that fades out after ~2 seconds. Uses existing `makeSprite` with large font, yellow color, glow.

---

### #9: Kill Counter Off-By-One Fix + HUD Behavior

#### [MODIFY] [main.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/main.js)

**User confirmed:** The floor HUD shows "14/15" during the upgrade/level-up screen.

**Desired behavior:**
1. During the slow-mo finale (#6): floor HUD shows `"15/15"` **highlighted** (e.g., gold/cyan glow)
2. On the upgrade selection screen: floor HUD is **hidden**

**Root cause analysis:** The floor HUD (`updateHUD`) likely renders `game.kills` which gets reset to 0 by `advanceLevelAfterUpgrade` before the upgrade screen renders. Or the kill that triggers `completeLevel` increments `game.kills` after the HUD has already rendered for that frame.

**Fix:**
1. In `completeLevel`, store `game._completedKills = game.kills` and `game._completedKillTarget = cfg.killTarget`
2. During `LEVEL_COMPLETE_SLOWMO` state (#6): `updateHUD` uses `game._completedKills` / `game._completedKillTarget` and applies a highlighted style (gold color, glow)
3. During `UPGRADE_SELECT` state: call `hideHUD()` to hide the floor HUD entirely
4. HUD reappears when entering the next level's `PLAYING` state (already handled by `showHUD()` in `advanceLevelAfterUpgrade`)

---

## Phase 4 — Audio (#7, #15)

### #7: Spawn Sounds for Basic (5-voxel) and Tank (6-voxel) Enemies

#### [MODIFY] [audio.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/audio.js)

**Current:** `playBasicEnemySpawn` (L337) and `playTankEnemySpawn` (L356) already exist!

The user says they love the swarm (1-voxel) and fast (2-voxel) spawn sounds but wants *similar* sounds for the basic (5-voxel) and tank (6-voxel). Let me check if these are actually being called.

#### [MODIFY] [main.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/main.js)

**Current:** In `spawnEnemyWave` (L1767-1811), only `fast` and `swarm` types trigger spawn sounds:

```js
if (type === 'fast') {
  playFastEnemySpawn();
} else if (type === 'swarm') {
  playSwarmEnemySpawn();
}
```

**Fix:** Add calls for `basic` and `tank`:

```diff
 if (type === 'fast') {
   playFastEnemySpawn();
 } else if (type === 'swarm') {
   playSwarmEnemySpawn();
+} else if (type === 'basic') {
+  playBasicEnemySpawn();
+} else if (type === 'tank') {
+  playTankEnemySpawn();
 }
```

Also need to add `playBasicEnemySpawn, playTankEnemySpawn` to the import statement at the top of `main.js`.

---

### #15: Game Over Sound Effect (NEW)

#### [MODIFY] [audio.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/audio.js)

Add `playGameOverSound()` function that loads and plays `mnt/project/music/XX_Game_Over.mp3`:

```js
let gameOverAudio = null;
export function playGameOverSound() {
  if (gameOverAudio) {
    gameOverAudio.pause();
    gameOverAudio.currentTime = 0;
  }
  gameOverAudio = new Audio('mnt/project/music/XX_Game_Over.mp3');
  gameOverAudio.volume = 0.5;
  gameOverAudio.play().catch(() => {});
}
```

#### [MODIFY] [main.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/main.js)

In `endGame(false)` (player death path), call `stopMusic()` then `playGameOverSound()`. Import `playGameOverSound` from `audio.js`.

---

## Phase 5 — UI/UX (#5, #10, #11, #12, #13)

### #5: Widen Upgrade Cards by 15%

#### [MODIFY] [hud.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/hud.js)

In `createUpgradeCard` (L654-724):

```diff
-  const cardGeo = new THREE.PlaneGeometry(0.9, 1.1);
+  const cardGeo = new THREE.PlaneGeometry(1.035, 1.1);  // 0.9 * 1.15 = 1.035
```

Also update `showUpgradeCards` card positions (L608) — the 4 cards need slightly wider spacing to not overlap:

```diff
 const positions = [
-   new THREE.Vector3(-2, 0, 0),
-   new THREE.Vector3(-0.7, 0, 0),
-   new THREE.Vector3(0.7, 0, 0),
-   new THREE.Vector3(2, 0, 0),
+   new THREE.Vector3(-2.1, 0, 0),
+   new THREE.Vector3(-0.7, 0, 0),
+   new THREE.Vector3(0.7, 0, 0),
+   new THREE.Vector3(2.1, 0, 0),
 ];
```

Also widen `createSkipCard` (L726) by the same 15%:

```diff
-  const cardGeo = new THREE.PlaneGeometry(0.9, 1.1);
+  const cardGeo = new THREE.PlaneGeometry(1.035, 1.1);
```

---

### #10: Scoreboard Buttons — Wider + Moved Right

#### [MODIFY] [hud.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/hud.js)

In `showScoreboard` (L1477-1549):

```diff
 // Button positions
-  btnGroup.position.set(1.2, def.y, 0);
+  btnGroup.position.set(1.5, def.y, 0);   // Moved right

-  const btnGeo = new THREE.PlaneGeometry(0.5, 0.25);
+  const btnGeo = new THREE.PlaneGeometry(0.7, 0.25);   // Wider
```

---

### #11: Back Button Moved Down

#### [MODIFY] [hud.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/hud.js)

In `showScoreboard` (L1477-1549):

```diff
-  backGroup.position.set(0, -0.7, 0);
+  backGroup.position.set(0, -0.95, 0);  // Moved down to avoid overlap
```

---

### #12: Multi-Column Country Lists for Europe & Asia

#### [MODIFY] [hud.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/hud.js)

In `renderCountryList` (L1782-1821):

**Current:** Countries render in a single vertical column with `itemHeight + itemGap` spacing. Europe has ~20 countries, Asia has ~14 — both overflow below the floor.

**Changes:**
- Add a `MAX_ROWS_PER_COLUMN = 5` constant
- When `filtered.length > MAX_ROWS_PER_COLUMN`: arrange into columns
- Column width: ~0.95 units with ~0.1 gap
- Item width shrinks from 1.8 → 0.85 to fit multiple columns
- Columns centered horizontally
- Example layout for Europe (20 countries): 4 columns × 5 rows
- Example layout for Asia (14 countries): 2 columns × 5 + 1 column × 4

```js
const useColumns = filtered.length > MAX_ROWS_PER_COLUMN;
const colWidth = 0.85;
const colGap = 0.1;
const cols = useColumns ? Math.ceil(filtered.length / MAX_ROWS_PER_COLUMN) : 1;
const totalWidth = cols * colWidth + (cols - 1) * colGap;
const startX = -totalWidth / 2 + colWidth / 2;

for (let i = 0; i < filtered.length; i++) {
  const col = Math.floor(i / MAX_ROWS_PER_COLUMN);
  const row = i % MAX_ROWS_PER_COLUMN;
  const x = startX + col * (colWidth + colGap);
  const y = startY - row * (itemHeight + itemGap);
  // ... position and size items using x, y, narrower width ...
}
```

> [!IMPORTANT]
> `getCountrySelectHit` (raycasting against country items) does not need changes — it already iterates `countryItems` array and checks `.mesh`, which will still work regardless of position.

---

### #13: Country Leaderboard Header Split

#### [MODIFY] [hud.js](file:///c:/Users/graem/OneDrive/Documents/GitHub/vr-roguelike/hud.js)

**Current:** `showScoreboard` receives `headerText` like `"Canada Leaderboard"` and renders it as a single sprite.

**Changes:**
1. Parse `headerText` to detect country name vs "LEADERBOARD"
2. Render in two lines:
   - Line 1: Country name with flag emoji in a distinct color (e.g., cyan `#00ffff`)
   - Line 2: "LEADERBOARD" in a different color (e.g., white `#ffffff`)
3. To get the flag: derive from `headerText` by matching against `COUNTRIES` list, or pass country code as an optional parameter

The cleanest approach: modify callers in `main.js` to pass `{ country, code }` info when showing a country leaderboard, so `showScoreboard` can display the flag.

```diff
 // In showScoreboard:
-  const header = makeSprite(scoreboardHeader, { ... });
+  if (opts && opts.countryCode) {
+    // Two-line header with flag
+    const flag = countryCodeToFlag(opts.countryCode);
+    const countrySprite = makeSprite(`${flag} ${opts.countryName}`, {
+      fontSize: 52, color: '#00ffff', glow: true, scale: 0.5
+    });
+    countrySprite.position.set(0, 2.0, 0);
+    scoreboardGroup.add(countrySprite);
+    
+    const lbSprite = makeSprite('LEADERBOARD', {
+      fontSize: 42, color: '#ffffff', scale: 0.4
+    });
+    lbSprite.position.set(0, 1.6, 0);
+    scoreboardGroup.add(lbSprite);
+  } else {
+    const header = makeSprite(scoreboardHeader, { ... });
+    header.position.set(0, 1.8, 0);
+    scoreboardGroup.add(header);
+  }
```

---

## Clarified Requirements (User Confirmed)

- **#2 Boss Music:** 4 tracks per boss level, paths confirmed (see Phase 2 above)
- **#9 Kill Counter:** Shows on floor HUD during upgrade screen as "14/15". Fix: show highlighted "15/15" during slow-mo, hide HUD on upgrade screen
- **#13 Country Flag:** Country code already available from country select flow — will thread through to `showScoreboard`
- **#15 Game Over Sound:** New requirement — play `XX_Game_Over.mp3` on player death

---

## Verification Plan

There are no existing automated tests in this project. All verification will be manual, visual, in-browser.

### Manual Verification Steps

Since this is a WebXR game, testing requires running it in a browser. Open `index.html` directly or via a local server.

1. **#1 Buckshot Spread:** Equip buckshot upgrade → fire → observe pellets spreading in a cone (not parallel). Pellets should be tightly grouped at close range, noticeably spread at distance.

2. **#14 Crit Visuals:** With crit chance upgrade → shoot enemies → observe that crit hits show gold/yellow damage numbers at 2× size and a floating "CRIT!" text.

3. **#2 Boss Music Silence:** Reach level 5 → after upgrade screen, verify music stops. Silence before boss spawns.

4. **#3 Boss Alert:** On level 5 → after upgrade → "ALERT! ALERT! INCOMING BOSS!" text appears with alarm sound → after ~3s → boss spawns.

5. **#4 Boss Health Bar:** During boss fight → green bar visible above boss head → as boss takes damage, bar shrinks right-to-left, color transitions green → yellow → red → dark red.

6. **#5 Upgrade Cards:** Reach level complete → upgrade cards appear → verify all title text fits within widened cards.

7. **#6 Slow-Mo Finale:** Get the final kill of a level → everything slows down → all remaining enemies explode → big explosion sound → after 3s → upgrade screen.

8. **#7 Spawn Sounds:** Play levels 1-8 → listen for spawn sounds when basic (5-voxel) and tank (6-voxel) enemies appear.

9. **#8 Kills Remaining:** Near end of level → when 5 kills remain → "5 KILLS REMAINING" text appears midfield.

10. **#9 Kill Counter:** Complete a level → verify kill counter shows `killTarget/killTarget` (e.g., 15/15), not one less.

11. **#10 Scoreboard Buttons:** Open scoreboard → verify "COUNTRY", "CONTINENT", "SCROLL UP", "SCROLL DOWN" buttons have text fully visible and don't overlap the score box.

12. **#11 Back Button:** On scoreboard → verify "BACK" button doesn't overlap the scoreboard box.

13. **#12 Country Columns:** Go to country select → select Europe → verify countries arranged in 4 columns of 5, all clickable, no overlap. Select Asia → verify similar multi-column layout.

14. **#13 Country Leaderboard Header:** View a country leaderboard → verify header shows flag + country name in cyan on line 1, "LEADERBOARD" in white on line 2.

> [!TIP]
> Use the debug console to jump to specific levels quickly: `window.debugJumpToLevel = 4` (then trigger to jump to level 4 and test boss transition at level 5).
