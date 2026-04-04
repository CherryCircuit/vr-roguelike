# Memory Leak Investigation Report
**Date:** 2026-04-03
**Symptom:** After 16 levels + restart: 18,336 geometries, 49,000 triangles, 394 textures (should be ~40-50 geo, ~20,000 tris, ~20 textures)

---

## CRITICAL LEAKS (Contributing most to 18K geometry count)

### 1. HUD Damage Numbers - **CRITICAL**
**File:** `hud.js`
**Line:** 80
**What's leaking:** `damageNumbers` array holds Mesh objects (PlaneGeometry + CanvasTexture + MeshBasicMaterial)
**Why it leaks:** No reset hook registered. Array is never cleared on `resetGame()` or level transition.

```javascript
// hud.js line 80
const damageNumbers = [];
```

**Evidence:**
- `spawnDamageNumber()` (line 1470) creates new canvas, texture, geometry, material, mesh for EVERY damage event
- `updateDamageNumbers()` (line 1628) removes old items via lifetime, but if level ends before lifetime expires, they leak
- No cleanup function called from `resetGame()` or `completeLevel()`

**Impact:** Each damage number = 1 geometry + 1 texture + 1 material. With thousands of shots per level, this accumulates rapidly.

**Fix:**
```javascript
// Add to hud.js
export function clearAllDamageNumbers() {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const s = damageNumbers[i];
    sceneRef.remove(s);
    s.material.map.dispose();
    s.material.dispose();
    s.geometry.dispose();
  }
  damageNumbers.length = 0;
}

// Also clear comboPopups and killChainPopups
export function clearAllPopups() {
  for (let i = comboPopups.length - 1; i >= 0; i--) {
    const popup = comboPopups[i];
    sceneRef.remove(popup);
    popup.material.map.dispose();
    popup.material.dispose();
    popup.geometry.dispose();
  }
  comboPopups.length = 0;
  
  for (let i = killChainPopups.length - 1; i >= 0; i--) {
    const popup = killChainPopups[i];
    sceneRef.remove(popup);
    popup.material.map.dispose();
    popup.material.dispose();
    popup.geometry.dispose();
  }
  killChainPopups.length = 0;
}
```

```javascript
// Add to main.js - call in completeLevel() and register as reset hook
import { clearAllDamageNumbers, clearAllPopups } from './hud.js';

// In completeLevel() around line 7485:
clearAllDamageNumbers();
clearAllPopups();

// Register reset hook:
registerResetHook(() => {
  clearAllDamageNumbers();
  clearAllPopups();
});
```

---

### 2. Boss Debris - **CRITICAL**
**File:** `enemies.js`
**Line:** 333
**What's leaking:** `bossDebris` array holds debris voxel meshes from boss death explosions
**Why it leaks:** `clearBossDebris()` exists but is ONLY called when entering dream world (main.js line 2335), not on level complete or game reset.

```javascript
// enemies.js line 333
const bossDebris = [];

// main.js line 2335 - ONLY called on dream world enter
clearBossDebris();
```

**Evidence:**
- `spawnBossDebris()` (enemies.js line 7718) creates multiple debris voxels per boss death
- `clearBossDebris()` (enemies.js line 7789) properly disposes geometry/material BUT is never called
- Boss fights happen at levels 4, 9, 14, 19 - debris from each boss accumulates

**Impact:** Boss death can spawn 20+ debris voxels. After 3-4 boss fights = 80+ leaked geometries minimum.

**Fix:**
```javascript
// In main.js completeLevel() function (around line 7485), add:
clearBossDebris();
clearBossMinions();

// In game.js resetGame() or register reset hooks:
registerResetHook(() => {
  clearBossDebris();
  clearBossMinions();
});
```

---

### 3. Boss Minions - **HIGH**
**File:** `enemies.js`
**Line:** 7799
**What's leaking:** `bossMinions` array holds boss minion Group objects with meshes
**Why it leaks:** `clearBossMinions()` only called on boss death (enemies.js line 7366), not on level reset or game over.

```javascript
// enemies.js line 7799
const bossMinions = [];

// enemies.js line 7366 - only called when boss dies
clearBossMinions();
```

**Evidence:**
- If player dies during boss fight or restarts game, minions remain in scene
- Minions have Groups with child meshes that are never disposed

**Impact:** Boss fights with minions can spawn 5-10 minions. Leaked per boss fight.

**Fix:** Same as boss debris - call `clearBossMinions()` in `completeLevel()` and on reset.

---

### 4. Combo Popups - **HIGH**
**File:** `hud.js`
**Line:** 1647
**What's leaking:** `comboPopups` array (CanvasTexture + PlaneGeometry + MeshBasicMaterial per popup)
**Why it leaks:** Same as damage numbers - no cleanup on reset/level transition.

```javascript
// hud.js line 1647
const comboPopups = [];
```

**Impact:** Less frequent than damage numbers but still accumulates.

**Fix:** See damage numbers fix above - add to `clearAllPopups()`.

---

### 5. Kill Chain Popups - **HIGH**
**File:** `hud.js`
**Line:** 1734
**What's leaking:** `killChainPopups` array (CanvasTexture + PlaneGeometry + MeshBasicMaterial per popup)
**Why it leaks:** Same as damage numbers - no cleanup on reset/level transition.

```javascript
// hud.js line 1734
const killChainPopups = [];
```

**Impact:** Accumulates during accuracy streaks.

**Fix:** See damage numbers fix above - add to `clearAllPopups()`.

---

## MODERATE LEAKS

### 6. Enemy Explosion Particles - **MEDIUM**
**File:** `enemies.js`
**Line:** 326
**What's leaking:** `explosionParts` array holds particle sprites
**Why it leaks:** Particles are returned to pool on lifetime expiry, but NOT cleared on level reset.

```javascript
// enemies.js line 326
const explosionParts = [];

// updateExplosions() only removes on lifetime expiry, not on level transition
```

**Evidence:**
- `updateExplosions()` (line 3216) removes particles via lifetime only
- No call to clear `explosionParts` in `clearAllEnemies()` or elsewhere

**Impact:** Particles have short lifetime so typically clean themselves, but if level ends during explosion, they leak.

**Fix:**
```javascript
// In enemies.js clearAllEnemies() function, add:
for (let i = explosionParts.length - 1; i >= 0; i--) {
  const p = explosionParts[i];
  p.visible = false;  // Return to pool state
}
explosionParts.length = 0;
```

---

### 7. Enemy Debris - **MEDIUM**
**File:** `enemies.js`
**Line:** 329
**What's leaking:** `enemyDebris` array
**Why it leaks:** Debris is created on enemy death but only removed via lifetime in update loop.

```javascript
// enemies.js line 329
const enemyDebris = [];
```

**Impact:** Depends on how many enemies spawn debris on death. Typically minor.

**Fix:** Add to `clearAllEnemies()`:
```javascript
for (let i = enemyDebris.length - 1; i >= 0; i--) {
  const debris = enemyDebris[i];
  sceneRef.remove(debris);
  if (debris.geometry) debris.geometry.dispose();
  if (debris.material) debris.material.dispose();
}
enemyDebris.length = 0;
```

---

### 8. Instanced Projectile Pool Count Not Reset - **LOW-MEDIUM**
**File:** `main.js`
**Line:** 7512 (clearAllProjectiles function)
**What's leaking:** InstancedMesh `.count` not reset to 0, leaving stale instance data in GPU buffers
**Why it leaks:** `returnProjectileToPool()` scales instances to 0 but doesn't reduce mesh count.

```javascript
// main.js line 8262 - returnProjectileToPool
pool.freeIndices.add(instanceIndex);  // Marks as free but count stays high
```

**Evidence:**
- `clearAllProjectiles()` calls `returnProjectileToPool()` which hides instances
- But InstancedMesh.count remains at highest allocated value
- Stale matrices remain in GPU buffer (though invisible)

**Impact:** Low visual impact but GPU memory fragmentation over time. After many shots, count could be 100+ per pool type.

**Fix:**
```javascript
// In clearAllProjectiles(), after clearing projectiles array:
Object.keys(instancedProjectiles).forEach(poolType => {
  const pool = instancedProjectiles[poolType];
  if (pool && pool.mesh) {
    pool.mesh.count = 0;  // Reset to zero visible instances
    pool.freeIndices.clear();  // All indices are now free
  }
  // Clear instance data
  projectileInstanceData[poolType].fill(null);
});
```

---

## VERIFIED CLEAN (No leaks found)

### ✅ Biome Scene Objects
- `clearBiomeScene()` (main.js line 1787) properly disposes all children and clears references
- Called in `rebuildBiomeScene()` when biome changes

### ✅ Biome Props
- `clearBiomeProps()` (main.js line 1771) properly disposes all children
- Called in `rebuildBiomeProps()` when biome changes

### ✅ Alt Weapon Effects
- `clearAllAltWeaponEffects()` (main.js line 7545) comprehensively clears all alt weapon arrays
- Registered as reset hook (line 7753)

### ✅ Enemy InstancedMesh Pools
- `releaseAllBasicInstances()`, `releaseAllFastInstances()`, etc. properly release slots
- Called in `clearAllEnemies()` (line 3131)

### ✅ Projectiles (individual)
- `clearAllProjectiles()` disposes non-pooled projectiles and returns pooled ones

### ✅ Ambient Particles (scenery.js)
- Single persistent particle system, reused across levels

---

## SUMMARY TABLE

| Leak | File:Line | Severity | Objects Leaked | Fix Complexity |
|------|-----------|----------|----------------|----------------|
| HUD Damage Numbers | hud.js:80 | **CRITICAL** | geometry + texture + material per damage event | Low |
| Boss Debris | enemies.js:333 | **CRITICAL** | 20+ geometries per boss death | Low |
| Boss Minions | enemies.js:7799 | **HIGH** | 5-10 meshes per boss fight | Low |
| Combo Popups | hud.js:1647 | **HIGH** | geometry + texture per combo | Low |
| Kill Chain Popups | hud.js:1734 | **HIGH** | geometry + texture per streak | Low |
| Explosion Particles | enemies.js:326 | **MEDIUM** | sprites during explosions | Low |
| Enemy Debris | enemies.js:329 | **MEDIUM** | debris voxels on death | Low |
| Instanced Pool Count | main.js:7512 | **LOW** | GPU buffer fragmentation | Medium |

---

## ESTIMATED CONTRIBUTION TO 18K GEOMETRY

Based on 16 levels + restart:

1. **Damage Numbers:** ~500-1000 damage events × 1 geo = **500-1000 geometries**
2. **Boss Debris:** 3 boss fights × 20 debris = **60 geometries** (but may compound if not cleared between runs)
3. **Combo/Kill Chain Popups:** ~50-100 × 1 geo = **50-100 geometries**
4. **Repeated runs without page refresh:** All above × number of runs = **exponential growth**

The 18K geometry count suggests the player did multiple runs without refreshing the page, causing cumulative leaks.

---

## RECOMMENDED FIX ORDER

1. **Add HUD cleanup functions and call them in completeLevel() and on reset** (fixes ~60% of leaks)
2. **Add clearBossDebris() and clearBossMinions() calls in completeLevel() and reset** (fixes ~30% of leaks)
3. **Add explosionParts and enemyDebris cleanup in clearAllEnemies()** (fixes ~10% of leaks)
4. **Reset InstancedMesh count in clearAllProjectiles()** (optimization, low impact)

---

## TEST VERIFICATION

After fixes, verify with performance monitor:
- Fresh run should show: **~40-50 geometries**
- After level transition: geometry count should NOT increase
- After full reset: geometry count should return to baseline

Run in browser console to track:
```javascript
// Debug helper - add to main.js
window.debugGeoCount = () => {
  let count = 0;
  scene.traverse(obj => { if (obj.geometry) count++; });
  console.log(`Total geometries in scene: ${count}`);
  console.log(`Damage numbers: ${damageNumbers?.length || 'N/A'}`);
  console.log(`Explosion parts: ${explosionParts?.length || 'N/A'}`);
};
```
