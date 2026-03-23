# Physics Death System Implementation

## Overview
Implemented physics-based death system with voxel separation for enemy deaths.

## Core Features

### 1. Voxel Pool System
- **Pool Size:** 200 pre-allocated voxels
- **Geometry:** BoxGeometry(0.05, 0.05, 0.05)
- **Performance:** No create/destroy on death, only pool recycling
- **Hard Cap:** 200 active voxels maximum

### 2. Physics System
- **Gravity:** -9.8 m/s²
- **Bounce:** 0.3 coefficient on floor collision
- **Lifetime:** 2-3 seconds before fade
- **Floor Collision:** y = 0 plane
- **Fade-out:** Last 0.5 seconds of lifetime

### 3. Enemy-Specific Death Patterns

#### Basic Enemy
- Random scatter pattern
- 6 voxels
- Moderate velocity (±3 m/s)

#### Tank Enemy
- Slow, heavy chunks
- 10 voxels
- Low velocity (±1 m/s, +1.5 m/s upward)

#### Fast Enemy
- Rapid explosion trail
- 4 voxels
- High velocity (±5 m/s, +4.5 m/s upward)

#### Swarm Enemy
- Tiny scatter
- 4 voxels
- High velocity (±4 m/s, +4.5 m/s upward)

#### Boss Enemy
- Massive burst + shockwave
- Circular pattern
- Very high velocity (8-12 m/s radial)

### 4. Critical Kills
- **Trigger:** Damage > 30 or weak point hit
- **Visual:** Gold particles (0xffd700)
- **Effect:** Screen shake (0.3 intensity, 200ms)
- **Voxels:** Standard count but gold-colored

### 5. Overkill
- **Trigger:** Excess damage after enemy HP reaches 0
- **Visual:** Double voxel count
- **Audio:** Double explosion sound (LOUDER)

### 6. Performance Safeguards
- **Max Active Voxels:** 200 total
- **Per-Enemy Cap:** 20 voxels maximum
- **Pool Recycling:** Automatic return to pool on lifetime expiry
- **Detail Culling:** Future enhancement for far voxels

## Files Modified

### main.js
- Added voxel pool system (lines ~125-128)
- Added initVoxelPool() function (after line 3920)
- Added spawnVoxelExplosion() function (after line 3990)
- Added updateVoxelPhysics() function (after line 4180)
- Added getDeathPattern() function (after line 4100)
- Updated init() to call initVoxelPool()
- Updated render loop to call updateVoxelPhysics()
- Updated handleHit() to pass critical/overkill flags to destroyEnemy()

### enemies.js
- Updated destroyEnemy() signature to accept isCritical and isOverkill parameters
- Updated destroyEnemy() to pass enemy type and flags to spawnVoxelExplosion()

## Testing Checklist

- [ ] Voxel pool initializes correctly
- [ ] Enemies spawn voxels on death
- [ ] Voxels fall with gravity
- [ ] Voxels bounce off floor
- [ ] Voxels fade out over 2-3 seconds
- [ ] Critical kills show gold particles
- [ ] Critical kills trigger screen shake
- [ ] Overkill doubles voxel count
- [ ] Overkill plays double explosion sound
- [ ] Performance cap prevents > 200 voxels
- [ ] Different enemy types have different patterns
- [ ] No console errors
- [ ] No memory leaks

## Performance Impact

**Before:**
- Simple sprite-based explosion particles
- No physics simulation

**After:**
- Physics-based voxel particles
- Gravity + bounce physics per voxel
- Pool recycling (no GC pressure)

**Expected Impact:**
- Minimal with 200 voxel cap
- Pool system prevents allocation/deallocation
- Physics calculations are lightweight (simple vector math)

## Future Enhancements

1. **Detail Culling:** Far voxels could be larger and fewer
2. **Voxel Variations:** Different sizes/shapes per enemy type
3. **Trail Effects:** Motion blur or trails for fast-moving voxels
4. **Impact Effects:** Voxels could damage environment/other enemies
5. **Sound Variations:** Different sounds for different materials

