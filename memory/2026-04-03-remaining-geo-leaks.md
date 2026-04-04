# Geometry Leak Investigation Report
**Date:** 2026-04-03
**Status:** Analysis Complete

## Executive Summary

Found **2 confirmed geometry leaks** and **1 potential issue** that explain the ~3.4 GEO/kills growth pattern observed in stress testing.

## Confirmed Leaks

### 1. [CRITICAL] Lightning Beam Geometry Leak
**File:** `main.js`  
**Lines:** 8773-8776

**What leaks:**
- `THREE.BufferGeometry` (per bolt)
- `THREE.LineBasicMaterial` (per bolt)

**Root cause:**
When the lightning weapon is active, `beamGroup` (containing lightning bolts) is replaced every frame. The old `lightningBeams[index]` is removed from scene but **NOT disposed**:
```javascript
// Line 8773-8776
if (lightningBeams[index]) {
  scene.remove(lightningBeams[index]);  // <-- Only removes, doesn't dispose!
}
```

The new beam group is then created with fresh geometries/materials:
```javascript
const bolt = createLightningBolt(lastPos, targetPos);  // Creates BufferGeometry + LineBasicMaterial
beamGroup.add(bolt);
```

**Estimated impact:**
- If lightning weapon used for 10 seconds: ~600 BufferGeometry + 600 LineBasicMaterial
- This scales with USAGE, not kills
- Could easily account for 100-300 GEO per level if lightning is the primary weapon

**Fix:**
```javascript
// In the lightning beam creation section (around line 8773)
if (lightningBeams[index]) {
  // Dispose all children before removing
  lightningBeams[index].traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
  scene.remove(lightningBeams[index]);
}
```

**Priority:** P1 - If player uses lightning weapon extensively, this is the dominant leak

---

### 2. [HIGH] Enemy Hitbox Geometry Leak
**File:** `enemies.js`  
**Lines:** 2112-2116 (creation), 3145-3155 (cleanup)

**What leaks:**
- `THREE.BoxGeometry` or `THREE.SphereGeometry` (1 per enemy)

**Root cause:**
Every enemy creates an invisible hitbox mesh:
```javascript
// Line 2112-2116
const hitboxGeo = new THREE.BoxGeometry(def.hitboxRadius * 2, ...);
const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
hitbox.userData.isEnemyHitbox = true;
group.add(hitbox);
```

But `clearAllEnemies()` only disposes children with `isMergedGeometry`:
```javascript
// Line 3151-3155
e.mesh.traverse(c => {
  if (c.isMesh && c.userData.isMergedGeometry && c.geometry) {
    c.geometry.dispose();  // <-- Only isMergedGeometry, not isEnemyHitbox!
  }
});
```

Hitboxes have `userData.isEnemyHitbox = true`, not `isMergedGeometry`, so their geometries are never disposed.

**Estimated impact:**
- 1 geometry per enemy killed
- With 284 total kills: 284 GEO leaked
- Does NOT explain the scaling pattern (linear, not exponential)

**Fix:**
```javascript
// In clearAllEnemies() around line 3151
e.mesh.traverse(c => {
  if (c.isMesh) {
    // Dispose merged geometry
    if (c.userData.isMergedGeometry && c.geometry) {
      c.geometry.dispose();
    }
    // Also dispose hitbox geometry
    if (c.userData.isEnemyHitbox && c.geometry) {
      c.geometry.dispose();
    }
  }
});
```

**Priority:** P2 - Consistent leak but smaller impact than lightning

---

## Potential Issues (Not Confirmed Leaks)

### 3. [LOW] Shared Geometry Over-Disposal
**File:** `enemies.js`  
**Lines:** 3177, 3196

**Issue:**
Baby spiders and shield shards use shared geometry from `getGeo()` pool, but `clearAllEnemies()` disposes them individually:
```javascript
// These use shared geometry from getGeo(0.12) / getGeo(0.25)
if (spider.mesh.geometry) spider.mesh.geometry.dispose();
if (shard.mesh.geometry) shard.mesh.geometry.dispose();
```

This doesn't cause a LEAK (memory grows), but it could cause rendering errors if new enemies spawn before old ones are cleared and the shared geometry is corrupted.

**Fix:** Don't dispose geometry that came from `getGeo()` - it's shared.

---

## Systems Verified Clean

The following systems were checked and **properly dispose** geometries/materials:

1. **Electric arcs** (conductor links) - 200ms lifetime, proper disposal
2. **Pulse bomber rings** - proper disposal in update and clear
3. **Telegraph effects** - `removeEffect()` disposes geometry/material
4. **Boss debris** - proper disposal with lifetime tracking
5. **Boss minions** - proper disposal
6. **Status effect bubbles** - proper disposal, capped at 20
7. **Explosion visuals** - capped at 15, proper disposal
8. **Alt weapon effects** (grenades, mines, drones, etc.) - `clearAllAltWeaponEffects()` is thorough
9. **HUD elements** - `updateHUD()` disposes old textures/geometries before creating new ones
10. **Upgrade cards** - `hideUpgradeCards()` calls `disposeGroupChildren()`
11. **Biome scenes** - `clearBiomeScene()` disposes all children
12. **Damage numbers/popups** - using object pooling (already fixed)

---

## Leak Analysis vs Observed Data

| Level | Kills | GEO Delta | GEO/Kill |
|-------|-------|-----------|----------|
| 1 | 15 | +22 | 1.47 |
| 4 | 24 | +90 | 3.75 |
| 7 | 41 | +102 | 2.49 |
| 8 | 49 | +165 | 3.37 |
| 9 | 57 | +191 | 3.35 |

**Interpretation:**
- Hitbox leak: 1 GEO per kill (linear) = ~284 GEO total
- Lightning leak: Scales with TIME weapon is used, not kills
- If lightning is used more in later levels (tougher enemies, more health), this explains the increasing GEO/kills ratio

**Missing factor:** The 855 total GEO - 284 (hitboxes) = 571 GEO unaccounted for
- If lightning weapon was used extensively, this gap is explained
- Alternative: There may be additional per-frame leaks in systems not covered

---

## Recommended Fix Order

1. **P1:** Fix lightning beam disposal (likely dominant contributor)
2. **P2:** Fix enemy hitbox disposal (guaranteed 1 GEO per kill)
3. **P3:** Review shared geometry over-disposal (correctness, not leak)

---

## Testing Recommendations

After fixes:
1. Run stress test WITHOUT using lightning weapon - should see ~1 GEO/kills (hitbox only)
2. Run stress test WITH lightning weapon extensively - verify no accumulation
3. Verify total GEO after 9 levels stays near baseline (~35) + minimal growth
