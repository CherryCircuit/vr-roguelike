# Projectile Pool Sharing Investigation Report

## Executive Summary

**Investigation Date**: 2026-03-23
**Bug Description**: Sideways projectile orientation when using plasma carbine (LEFT hand) and standard blaster (RIGHT hand)
**Hypothesis**: Pool sharing between weapon types causes orientation issues

**Key Finding**: **Plasma carbine and standard blaster use DIFFERENT pools. They do NOT share projectile instances.**

## Detailed Analysis

### 1. Pool Initialization (main.js:6802-6873)

Four separate InstancedMesh pools are created:

| Pool Type | Geometry | Size | Rotation |
|-----------|----------|------|----------|
| **laser** | CylinderGeometry(0.035, 0.035, 1.0, 6) | 120 instances | `rotateX(Math.PI/2)` |
| **plasma_carbine** | CylinderGeometry(0.026, 0.026, 0.5, 6) | 30 instances | `rotateX(Math.PI/2)` |
| **buckshot** | SphereGeometry(0.025, 6, 6) | 20 instances | None |
| **seeker** | SphereGeometry(0.03, 8, 8) | 28 instances | None |

**Code Reference** (main.js:6816-6856):
```javascript
// Laser pool
const laserGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6);
laserGeo.rotateX(Math.PI / 2); // Rotate to align with -Z direction
const laserIM = new THREE.InstancedMesh(laserGeo, laserMat, 120);
instancedProjectiles['laser'] = { mesh: laserIM, maxCount: 120, freeIndices: new Set() };

// Plasma carbine pool
const plasmaGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.5, 6);
plasmaGeo.rotateX(Math.PI / 2); // Rotate to align with -Z direction
const plasmaIM = new THREE.InstancedMesh(plasmaGeo, plasmaMat, 30);
instancedProjectiles['plasma_carbine'] = { mesh: plasmaIM, maxCount: 30, freeIndices: new Set() };
```

**Finding**: Each weapon type has its OWN InstancedMesh with its OWN geometry. No sharing.

### 2. Pool Type Selection (main.js:7907-7908)

Pool type is determined by weapon stats:

```javascript
const isPlasmaCarbine = stats.mainWeaponId === 'plasma_carbine';
const poolType = stats.homing ? 'seeker' : (isPlasmaCarbine ? 'plasma_carbine' : (isBuckshot ? 'buckshot' : 'laser'));
```

**Logic Flow**:
- If homing → 'seeker' pool
- Else if plasma carbine → 'plasma_carbine' pool
- Else if buckshot (spread > 5°) → 'buckshot' pool
- Else → 'laser' pool

**Specific Scenario**:
- LEFT hand fires plasma carbine → poolType = 'plasma_carbine'
- RIGHT hand fires standard blaster → poolType = 'laser'

**Result**: **Different weapons use different pools. No cross-contamination possible.**

### 3. Quaternion Handling

#### 3.1 Quaternion Initialization (main.js:6912)
```javascript
data.quaternion = new THREE.Quaternion();
```
A new quaternion is created EVERY TIME a projectile is acquired from the pool.

#### 3.2 Quaternion Setting (main.js:7972-7974)
```javascript
// Orient bolt along direction
if (!isBuckshot) {
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
}
```
The quaternion is ALWAYS set for non-buckshot projectiles (including both laser and plasma_carbine).

#### 3.3 Quaternion Commit (main.js:6970-6973)
```javascript
proxy.commit = function() {
  _projMatrix.compose(pos, data.quaternion, _projScale);
  pool.mesh.setMatrixAt(instanceIndex, _projMatrix);
  pool.mesh.instanceMatrix.needsUpdate = true;
};
```
The quaternion is committed to the InstancedMesh instance matrix.

#### 3.4 Quaternion in Recycling (main.js:6980-7023)
**Critical Observation**: `returnProjectileToPool` does NOT explicitly reset `data.quaternion`.

However, this is **NOT a bug** because:
1. The quaternion is ALWAYS set when spawning (line 7972)
2. A new Quaternion object is created when acquiring from pool (line 6912)
3. The commit() function applies the quaternion to the instance matrix

**Result**: Quaternion handling appears correct.

### 4. Geometry Orientation

Both laser and plasma_carbine geometries use:
- CylinderGeometry (cylinder along Y-axis by default)
- `rotateX(Math.PI / 2)` to align with -Z direction

This rotation is applied ONCE during initialization and is correct for both weapon types.

### 5. Recycling Logic Analysis

#### 5.1 Global Cap Recycling (main.js:7893-7897)
```javascript
if (projectiles.length >= MAX_PROJECTILES) {
  const recycled = projectiles.shift();
  if (recycled) {
    returnProjectileToPool(recycled);
  }
}
```

#### 5.2 Per-Pool Exhaustion Recycling (main.js:7922-7929)
```javascript
if (!mesh) {
  const recycled = projectiles.shift();
  if (recycled) {
    returnProjectileToPool(recycled);
    mesh = getPooledProjectile(poolType, color);
  }
}
```

**Critical Finding**: In both cases, projectiles are recycled from a **global array** that contains projectiles from **all pool types**.

However, `returnProjectileToPool` uses `proj.userData.poolType` to return to the **correct pool**. So even if we recycle a plasma_carbine projectile while trying to get a laser projectile, the plasma_carbine goes back to its own pool.

**Potential Issue**: If the laser pool is empty and all active projectiles are plasma_carbine, recycling won't help because:
1. Recycle plasma_carbine projectile → goes to plasma_carbine pool
2. Try to get from laser pool → still empty
3. Return null, don't fire

But this would cause **no projectile**, not a **sideways projectile**.

### 6. Per-Controller/Hand State

The direction is calculated per-controller (main.js:7379-7380):
```javascript
controller.getWorldQuaternion(quat);
const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
```

Each hand has its own controller with its own orientation. This appears correct.

### 7. Weapon Definitions (weapons.js)

**Plasma Carbine** (weapons.js:86-113):
- Not homing
- spreadAngle: 0.0262 (1.5 degrees)
- Uses 'plasma_carbine' pool

**Standard Blaster** (weapons.js:1-17):
- Not homing
- spreadAngle: 0
- Uses 'laser' pool

## Conclusions

### What I Found
1. ✅ Plasma carbine and standard blaster use **SEPARATE pools**
2. ✅ Quaternion is **always set** when spawning non-buckshot projectiles
3. ✅ Quaternion is **committed** to the instance matrix
4. ✅ Geometry rotation is **identical** for both weapon types
5. ✅ Pool recycling returns projectiles to the **correct pool**

### What I Did NOT Find
1. ❌ No obvious bug in pool sharing (pools are separate)
2. ❌ No obvious bug in quaternion handling (always set and committed)
3. ❌ No obvious bug in geometry orientation (both use same rotation)
4. ❌ No state persistence that could cause orientation issues

### Root Cause Analysis

**The user's hypothesis appears to be incorrect.** The sideways projectile bug is **NOT caused by pool sharing** between plasma carbine and standard blaster, because:
1. They use completely separate pools
2. There's no way for a plasma_carbine projectile instance to be reused for a laser shot
3. The quaternion is always set correctly

### Alternative Hypotheses to Investigate

Since pool sharing is not the cause, the sideways orientation bug might be caused by:

1. **Controller tracking issue**
   - One controller reporting incorrect orientation
   - Check VR controller calibration
   - Check if bug persists with swapped weapons

2. **Direction calculation issue**
   - The direction vector might be wrong for one controller
   - Add debug logging to compare directions from left vs right controller

3. **Visual rendering issue**
   - The projectile might be oriented correctly but rendered incorrectly
   - Check if bug is visible from different camera angles
   - Check if bug affects both VR and desktop modes

4. **Specific weapon configuration issue**
   - Bug might only occur with this specific weapon combination
   - Test with other weapon combinations:
     - Plasma carbine (LEFT) + plasma carbine (RIGHT)
     - Standard blaster (LEFT) + standard blaster (RIGHT)
     - Standard blaster (LEFT) + plasma carbine (RIGHT)

5. **Race condition or timing issue**
   - Unlikely, but could be related to InstancedMesh update timing
   - Check if bug is consistent or intermittent

## Recommended Next Steps

1. **Verify the bug exists**: Test with plasma carbine (LEFT) + standard blaster (RIGHT) and confirm sideways projectiles are visible

2. **Isolate the weapon**: Test each weapon individually to see if the bug occurs with only one weapon type

3. **Swap hands**: Test with plasma carbine (RIGHT) + standard blaster (LEFT) to see if the bug follows the weapon or the hand

4. **Add debug logging**: Log the direction vector and quaternion for each projectile spawn to identify if values are incorrect

5. **Check controller data**: Verify that both controllers are reporting correct orientations

6. **Test in desktop mode**: Check if bug occurs without VR controllers

## Relevant Line Numbers

- Pool initialization: main.js:6802-6873
- Pool type selection: main.js:7907-7908
- Quaternion creation: main.js:6912
- Quaternion setting: main.js:7972-7974
- Quaternion commit: main.js:6970-6973
- Projectile recycling (global cap): main.js:7893-7897
- Projectile recycling (pool exhaustion): main.js:7922-7929
- Direction calculation: main.js:7379-7380
- Weapon definitions: weapons.js:1-17 (standard_blaster), 86-113 (plasma_carbine)

---

**Investigation Status**: Complete
**Bug Found**: No (pool sharing hypothesis disproven)
**Action Required**: User should investigate alternative hypotheses listed above
