# GEO Leak Deep Dive - 2026-04-03

## Summary

The geometry leak is caused by **every HUD screen transition removing children from groups without disposing their GPU resources**. The pattern `while (group.children.length) group.remove(group.children[0])` appears 11 times across hud.js and never calls `.dispose()` on textures, geometries, or materials.

The scoreboard has a proper cleanup function (`disposeScoreboardNode`) that does dispose before remove. Every other screen skips this step.

## Leak #1: Upgrade Cards (CRITICAL - ~63-75 objects per level)

**File:** `hud.js` line 1321
**Function:** `hideUpgradeCards()`

```js
export function hideUpgradeCards() {
  while (upgradeGroup.children.length) upgradeGroup.remove(upgradeGroup.children[0]);
  upgradeGroup.visible = false;
  upgradeCards = [];
  upgradeChoices = [];
}
```

**What leaks per call:**
- Header: 1 CanvasTexture + 1 PlaneGeometry + 1 MeshBasicMaterial
- Cooldown sprite: 1 CanvasTexture + 1 PlaneGeometry + 1 MeshBasicMaterial
- 3 upgrade cards, each with:
  - Card mesh: 1 PlaneGeometry + 1 MeshBasicMaterial
  - Border: 1 EdgesGeometry + 1 LineBasicMaterial
  - Name sprite: 1 CanvasTexture + 1 PlaneGeometry + 1 MeshBasicMaterial
  - Desc sprite: 1 CanvasTexture + 1 PlaneGeometry + 1 MeshBasicMaterial
  - Optional note sprite: 1 CanvasTexture + 1 PlaneGeometry + 1 MeshBasicMaterial
  - Icon mesh: 1 OctahedronGeometry + 1 MeshBasicMaterial
  - Total per card: 14-17 objects
- 1 skip card: same as upgrade card (14 objects)

**Total: ~63-75 Three.js objects leak per level.**

This fires EVERY level after level 1 (upgrade screen shown after each level completion).

**Estimated GEO contribution:** ~45-55 GEO per level (geometries only: PlaneGeometry, EdgesGeometry, OctahedronGeometry per card, plus PlaneGeometry per sprite)

**Fix:** Create a `disposeGroupChildren(group)` helper and call it before the remove loop:
```js
function disposeGroupChildren(group) {
  group.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(mat => {
        if (mat.map) { mat.map.dispose(); mat.map = null; }
        mat.dispose();
      });
    }
  });
  while (group.children.length) group.remove(group.children[0]);
}
```

The scoreboard already has `disposeScoreboardNode()` (line 3263) that does exactly this. Extract and reuse it.

## Leak #2: Ready Screen (~12 objects per show)

**File:** `hud.js` line 2451
**Function:** `hideReadyScreen()`

```js
export function hideReadyScreen() {
  readyGroup.visible = false;
}
```

Doesn't remove OR dispose children. Children are only cleaned when `showReadyScreen()` is called next (line 2419), and even then it's the bare `remove()` without disposal.

**What leaks:** 3 makeSprite calls (READY?, SHOOT TO BEGIN, countdown) = 3 CanvasTexture + 3 PlaneGeometry + 3 MeshBasicMaterial = 9 objects, plus countdown sprite (reused via updateSpriteText which does dispose properly).

But note: `updateReadyCountdownText` calls `updateSpriteText` which properly disposes. So the countdown texture is fine.

**Estimated GEO contribution:** ~6-9 GEO per level (6 geometries from 3 sprites)

**Fix:** Add disposal in `hideReadyScreen()` or before the `while(children) remove` in `showReadyScreen()`.

## Leak #3: Level Complete Screen (~4 objects per show)

**File:** `hud.js` line 1060
**Function:** `showLevelComplete()` (clears old children)

```js
while (levelTextGroup.children.length) levelTextGroup.remove(levelTextGroup.children[0]);
```

And `hideLevelComplete()` (line 1073) just sets `visible = false` without cleanup.

**What leaks:** 1 makeSprite ("LEVEL COMPLETE!") = CanvasTexture + PlaneGeometry + MeshBasicMaterial

**Estimated GEO contribution:** ~2 GEO per level

**Fix:** Dispose before remove.

## Leak #4: Kills Remaining Alert (~4 objects per show)

**File:** `hud.js` line 2589
**Function:** `showKillsRemainingAlert()` (clears old children)

```js
while (levelTextGroup.children.length) {
  levelTextGroup.remove(levelTextGroup.children[0]);
}
```

Fires once per level. Creates 1 makeSprite.

Also `hideKillsAlert()` (line 2707) does NOT remove children at all:
```js
export function hideKillsAlert() {
  killsAlertActive = false;
  levelTextGroup.visible = false;
  if (killsAlertMesh) {
    killsAlertMesh = null;  // Just nulls the reference, doesn't remove from group or dispose!
  }
}
```

**Estimated GEO contribution:** ~2 GEO per level (cumulative, fires once per level)

**Fix:** Dispose in `hideKillsAlert()` before nulling, and dispose before remove in `showKillsRemainingAlert()`.

## Leak #5: Boss Alert (~4 objects per show)

**File:** `hud.js` line 2600
**Function:** `showBossAlert()` (clears old children)

Same pattern as kills alert. `hideBossAlert()` (line 2686) does remove but without disposal.

**Estimated GEO contribution:** ~2 GEO per level (only on boss levels: 4, 9, 14, 19)

## Leak #6: Level Intro Screen (~8 objects per show)

**File:** `hud.js` line 2529
**Function:** `updateLevelIntro()` (clears during stage transition)

```js
while (levelTextGroup.children.length) levelTextGroup.remove(levelTextGroup.children[0]);
```

Creates "LEVEL" + level number sprites (stage 1), then "START!" sprite (stage 2). Total: ~3 makeSprite calls = 12 objects.

`hideLevelIntro()` just sets `visible = false` and `levelIntroActive = false`. Children remain.

**Note:** I don't see `showLevelIntro` called from main.js. It may be dead code or called indirectly. Worth verifying.

## Leak #7: Game Over Screen (~12 objects per show)

**File:** `hud.js` line 1383
**Function:** `showGameOver()` (clears old children)

```js
while (gameOverGroup.children.length) gameOverGroup.remove(gameOverGroup.children[0]);
```

Creates 3-4 makeSprite calls. Only fires at end of game, not per level. Low priority.

## Leak #8: Name Entry Screen (~100+ objects per show)

**File:** `hud.js` line 2835

```js
while (nameEntryGroup.children.length) nameEntryGroup.remove(nameEntryGroup.children[0]);
```

Uses a keyboard pool system, but the initial show still clears without disposal. Only fires at game end for leaderboard entry. Low priority for per-level leak.

## Leak #9: Debug Jump Screen (~6 objects per show)

**File:** `hud.js` line 2383

Same pattern. Only fires on debug use. Low priority.

## Leak #10: Pause Countdown (~4 objects per show)

**File:** `hud.js` line 4915

Same pattern. Fires on pause/unpause. Low frequency.

## Quantitative Analysis

Per level, the following screens are shown and hidden:
1. `showLevelComplete()` → `hideLevelComplete()`: ~4 objects leak
2. `showUpgradeCards()` → `hideUpgradeCards()`: ~63-75 objects leak
3. `showReadyScreen()` → `hideReadyScreen()`: ~9 objects leak
4. `showKillsRemainingAlert()` → `hideKillsAlert()`: ~4 objects leak (uses same `levelTextGroup`)

**Per level total: ~80-92 objects leak (geometries, textures, materials)**

**GEO counts geometries specifically. Per level geometry leak:**
- Upgrade cards: 3 cards x (1 PlaneGeo + 1 EdgesGeo + 1 OctahedronGeo) + 1 skip card x (1 PlaneGeo + 1 EdgesGeo + 1 OctahedronGeo) + 1 header PlaneGeo + 1 cooldown PlaneGeo + 3 name PlaneGeo + 3 desc PlaneGeo + skip name PlaneGeo + skip desc PlaneGeo = ~24-30 geometries
- Ready screen: 3 PlaneGeo = 3 geometries
- Level complete: 1 PlaneGeo = 1 geometry
- Kills alert: 1 PlaneGeo = 1 geometry

**Geometry-only per level: ~29-35 GEO**

Over 9 levels that's 261-315 GEO from geometries alone. The observed leak is ~963 GEO (1001 - 38 baseline). The discrepancy suggests Three.js's internal tracking counts more than just BufferGeometry objects (it may count texture GPU buffers, material programs, etc.).

However, the OBSERVED deltas (+33, +60, +87, +116, +240...) grow with level number. This is because:
1. Higher levels have more enemies → more kills → `showKillsRemainingAlert` may fire more often (though it has a guard)
2. More importantly: the upgrade card system shows MORE sprites when side-grade notes are present
3. The update loop for HUD calls `updateHUD()` many times per level, creating/disposing correctly. But the accumulated GPU memory from leaked textures across levels may fragment GPU memory and cause additional internal allocations.

Wait, actually, the growing delta pattern needs another explanation. Let me reconsider.

## Re-examining Growing Deltas

The per-level deltas grow: +33, +60, +87, +116, +240...

The upgrade screen leaks the same amount each level (it always creates 4 cards). So why do the deltas grow?

**Additional hypothesis: `updateHUD()` called during gameplay creates per-frame textures that accumulate.**

Wait, `updateHUD()` DOES dispose old textures before creating new ones (line 1001 for hearts, `updateSpriteText` disposes old texture at line 953). So per-frame HUD updates are not leaking.

**Growing delta explanation:** The kill count and score values grow each level, which means `updateSpriteText` creates slightly different-sized textures. But since old ones are disposed, this shouldn't accumulate.

**Alternative explanation:** There may be weapon-specific or enemy-type-specific geometry that accumulates. As new enemy types unlock (fast at 3, tank at 4, swarm at 6), their InstancedMesh pools are initialized once and persist. These would be:
- Basic enemy InstancedMesh (always present)
- Fast enemy InstancedMesh (unlocked at level 3)
- Tank enemy InstancedMesh (unlocked at level 4)
- Swarm enemy InstancedMesh (unlocked at level 6)

Each InstancedMesh + its glow twin = 2 geometries + 2 materials. But these are created once and reused, not per-level.

**Most likely explanation for growing deltas:** The upgrade card textures/materials from previous levels remain in GPU memory even after removal from the scene graph. Three.js's internal material/texture tracking (renderer.info) may count these until garbage collection, which may not happen immediately. The growing delta could reflect that previously leaked objects are now being counted in addition to the current level's leak.

## Recommended Fix

### 1. Create a reusable `disposeGroupChildren` helper (hud.js)

```js
function disposeGroupChildren(group) {
  if (!group) return;
  group.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
      child.geometry = null;
    }
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(mat => {
        if (!mat) return;
        if (mat.map) { mat.map.dispose(); mat.map = null; }
        mat.dispose();
      });
      child.material = null;
    }
  });
  while (group.children.length) group.remove(group.children[0]);
}
```

### 2. Replace all bare `while(children) remove(children[0])` patterns

These 11 locations need to call `disposeGroupChildren` instead:

| Line | Group | Called From |
|------|-------|-------------|
| 1060 | levelTextGroup | showLevelComplete |
| 1321 | upgradeGroup | hideUpgradeCards |
| 1383 | gameOverGroup | showGameOver |
| 1407 | gameOverGroup | showVictory |
| 2150 | debugMenuGroup | showDebugMenu |
| 2383 | readyGroup | showDebugJumpScreen |
| 2419 | readyGroup | showReadyScreen |
| 2529 | levelTextGroup | updateLevelIntro (stage transition) |
| 2589 | levelTextGroup | showKillsRemainingAlert |
| 2600 | levelTextGroup | showBossAlert |
| 2686 | levelTextGroup | hideBossAlert |
| 2835 | nameEntryGroup | showNameEntry |
| 3653 | countrySelectGroup | showCountrySelect |
| 4915 | pauseCountdownGroup | (pause countdown) |

### 3. Fix `hideReadyScreen()` to dispose children

```js
export function hideReadyScreen() {
  disposeGroupChildren(readyGroup);
  readyGroup.visible = false;
}
```

### 4. Fix `hideLevelIntro()` to dispose children

```js
function hideLevelIntro() {
  disposeGroupChildren(levelTextGroup);
  levelIntroActive = false;
  levelTextGroup.visible = false;
}
```

### 5. Fix `hideKillsAlert()` to dispose the mesh

```js
export function hideKillsAlert() {
  killsAlertActive = false;
  if (killsAlertMesh) {
    if (killsAlertMesh.material) {
      if (killsAlertMesh.material.map) killsAlertMesh.material.map.dispose();
      killsAlertMesh.material.dispose();
    }
    if (killsAlertMesh.geometry) killsAlertMesh.geometry.dispose();
    levelTextGroup.remove(killsAlertMesh);
    killsAlertMesh = null;
  }
}
```

## Priority Order

1. **`hideUpgradeCards()` (line 1321)** - BIGGEST leak, ~45-55 GEO per level. Fix first.
2. **`showReadyScreen()` (line 2419) / `hideReadyScreen()` (line 2451)** - ~6-9 GEO per level
3. **`showLevelComplete()` (line 1060)** - ~2 GEO per level
4. **`showKillsRemainingAlert()` (line 2589) / `hideKillsAlert()` (line 2707)** - ~2 GEO per level
5. **All other instances** - small per occurrence, but they compound

Fixing just #1 should drop the per-level GEO delta from ~80-240 to ~20-30. Fixing #1-4 should bring it to near-baseline (~5-10 GEO per level, which may be acceptable overhead from the InstancedMesh pools).

## Files Involved

- `hud.js` - All leaks are in this file
- `main.js` - Calls the show/hide functions during level transitions (no changes needed)
- `game.js` - `registerResetHook` only fires on full game reset, not per-level (no changes needed)

## Verification

After fixing, run the level 1-9 stress test and check:
1. GEO count after each level should stay near 38-50
2. `renderer.info.memory.geometries` should not grow between levels
3. `renderer.info.memory.textures` should not grow between levels
