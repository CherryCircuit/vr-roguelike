# Shootable Boss Projectiles Feature

## Overview
Since the player is stationary in SPACE-OM-ICIDE, ALL boss projectiles must be shootable to ensure fair gameplay.

## Implementation

### Boss Projectile System
All boss attacks that deal damage are implemented as projectiles or destructible objects:

#### 1. Scrap Golem - Debris Projectiles
**Attack:** Ground slam shockwave
**Projectiles:** 5-8 debris chunks launched outward
- **Type:** Box geometry (0.15³)
- **Color:** Brown (0x886644)
- **Speed:** 8 units/sec
- **Damage:** 2-4 per debris (total 15-30 split among debris)
- **Duration:** 1.5 seconds
- **Shootable:** ✅ Yes
- **Flag:** `isBossProjectile: true`

**Code Location:** `main.js` → `window.createBossShockwave()`

#### 2. Holo Phantom - Decoy Spheres
**Attack:** Hologram decoys that explode
**Projectiles:** Cyan spheres that detonate after 2.5s
- **Type:** Sphere geometry (0.4 radius)
- **Color:** Cyan (0x00ffff)
- **Opacity:** 0.7
- **Explosion:** 2-unit radius, 10-25 damage
- **Duration:** 2.5 seconds
- **Shootable:** ✅ Yes
- **Flag:** `isBossProjectile: true`, `isDecoy: true`

**Code Location:** `main.js` → `window.createHoloDecoy()`

#### 3. Pulse Emitter - Pulse Waves
**Attack:** Energy pulse projectiles
**Projectiles:** Pink spheres tracking player
- **Type:** Sphere geometry (0.3 radius)
- **Color:** Pink (0xff0088)
- **Speed:** 15 units/sec
- **Damage:** 20-50
- **Duration:** 3 seconds
- **Shootable:** ✅ Yes
- **Flag:** `isBossProjectile: true`

**Code Location:** `main.js` → `window.fireBossPulse()`

#### 4. Pulse Emitter - Shield Sphere
**Attack:** Defensive shield activation
**Object:** Large pink sphere around boss
- **Type:** Sphere geometry (2 radius)
- **Color:** Pink (0xff0088)
- **Opacity:** 0.3 (pulsing)
- **Duration:** 3 seconds
- **Shootable:** ✅ Yes (can be destroyed early)
- **Flag:** `isBossProjectile: true`, `isBossShield: true`

**Code Location:** `main.js` → `window.createBossShield()`

#### 5. Rust Serpent - Toxic Pools
**Attack:** Area denial toxic pools
**Object:** Orange circles on ground
- **Type:** Circle geometry (2.5 radius)
- **Color:** Orange (0xcc4400)
- **Damage:** 5-14 DoT per 0.5s
- **Duration:** 5 seconds
- **Shootable:** ✅ Yes (can be destroyed to remove DoT)
- **Flag:** `isBossProjectile: true`, `isToxicPool: true`

**Code Location:** `main.js` → `window.createToxicPool()`

#### 6. Static Wisp - Lightning Bolts
**Attack:** Fast lightning projectiles
**Projectiles:** Yellow spheres
- **Type:** Sphere geometry (0.25 radius)
- **Color:** Yellow (0xffff00)
- **Speed:** 20 units/sec
- **Damage:** 15-39
- **Duration:** 2 seconds
- **Shootable:** ✅ Yes
- **Flag:** `isBossProjectile: true`

**Code Location:** `main.js` → `window.fireBossLightning()`

## Collision Detection

### Player Projectiles vs Boss Projectiles
**Code Location:** `main.js` → `updateProjectiles()`

**Algorithm:**
1. For each player projectile, check against all boss projectiles
2. Distance check: `dist < 0.5` (collision radius)
3. On collision:
   - Destroy boss projectile
   - Create small explosion visual
   - If decoy, trigger explosion at destroyed position
   - Destroy player projectile (unless piercing)

**Collision Radius:** 0.5 units (generous for stationary player)

### Player Projectiles vs Explosion Visuals
**Code Location:** `main.js` → `updateProjectiles()`

**Additional Check:**
- Also checks `explosionVisuals` array for toxic pools, shields
- Larger collision radius: 1.0 units (for area effects)
- On collision: Remove visual, stop DoT/damage

## Visual Feedback

### Destroying Boss Projectiles
- Small explosion effect (0.3-0.5 radius)
- Color matches projectile color
- Brief opacity flash

### Decoy Special Case
- If decoy destroyed before timer:
  - Triggers explosion at destruction position
  - Player can be damaged if too close
  - Rewards quick reaction to destroy from distance

## Balance Considerations

### Damage Distribution
- **Scrap Golem:** Total damage split among debris (encourages shooting multiple)
- **Holo Phantom:** Full damage if not destroyed (high priority target)
- **Pulse Emitter:** Single high-damage projectile (priority target)
- **Rust Serpent:** DoT removed when pool destroyed (immediate relief)
- **Static Wisp:** Fast projectile (requires quick reaction)

### Player Skill Expression
- **Beginner:** Can tank some damage, learn boss patterns
- **Intermediate:** Learn to shoot down projectiles, reduce damage taken
- **Expert:** Destroy all projectiles, take minimal damage

### Weapon Interaction
- **Rapid-fire weapons:** Good for multiple small projectiles (debris)
- **High-damage weapons:** Good for single targets (pulses, lightning)
- **Piercing weapons:** Pass through boss projectiles, hit boss behind
- **Area weapons:** Can destroy multiple projectiles at once

## Testing Requirements

### Critical Test Cases
1. **All projectile types can be shot**
   - Test each boss individually
   - Verify each projectile type is destructible

2. **Visual feedback works**
   - Explosion appears when projectile destroyed
   - Sound effect plays

3. **Damage prevention**
   - Destroyed projectiles don't damage player
   - DoT stops when pool destroyed

4. **Edge cases**
   - Piercing weapons pass through
   - Multiple projectiles can be hit in one shot
   - Very close range still works

5. **Performance**
   - Many projectiles on screen doesn't lag
   - Collision detection is efficient

## Known Issues / Notes

### Current Implementation
- Debris damage is split from total (not individual high damage)
- Decoys still explode when destroyed (can damage player if too close)
- Toxic pools use larger collision radius (easier to hit)
- Shield destruction gives immediate relief from invulnerability

### Future Improvements
- Add sound effects for projectile destruction
- Add score bonus for destroying projectiles
- Visual indicator for projectile health (if multi-hit)
- Combo system for destroying multiple projectiles

## Files Modified

### main.js
- `updateProjectiles()` - Added boss projectile collision checking
- `window.createBossShockwave()` - Spawns debris projectiles
- `window.createHoloDecoy()` - New function for shootable decoys
- `window.fireBossPulse()` - Marks pulse as boss projectile
- `window.createBossShield()` - Marks shield as destructible
- `window.createToxicPool()` - Marks pool as destructible
- `window.fireBossLightning()` - Creates lightning projectile
- `updateExplosionVisuals()` - Handles toxic pool DoT

### enemies.js
- `HoloPhantomBoss.createDecoy()` - Updated to use new decoy system

### Test Files
- `LEVEL_5_BOSSES_TEST_CHECKLIST.md` - Updated with shootable projectile tests
- `LEVEL_5_BOSSES_IMPLEMENTATION_SUMMARY.md` - Updated with feature details
- `SHOOTABLE_PROJECTILES_FEATURE.md` - This document

## Validation

### Syntax Checks ✅
```bash
✓ node -c main.js
✓ node -c enemies.js
✓ node -c game.js
```

### Manual Testing Required
See `LEVEL_5_BOSSES_TEST_CHECKLIST.md` → "Shootable Projectiles Tests" section

## Commit Message (Updated)
```
feat(bosses): Replace Chrono Wraith with 5 new Level 5 bosses

- Added Scrap Golem (tank, spawns minions, ground slam)
- Added Holo Phantom (decoys, teleporting, evasive)
- Added Pulse Emitter (ranged, shield phases, projectiles)
- Added Rust Serpent (slithering, toxic trail, DoT)
- Added Static Wisp (lightning, fast, burst damage)

CRITICAL: All boss projectiles can be shot down
- Player is stationary, so all attacks are destructible
- Debris, decoys, pulses, pools, lightning all shootable
- Visual feedback when destroying projectiles
- Piercing weapons pass through boss projectiles

Files modified:
- enemies.js: 5 new boss classes + definitions
- main.js: Boss attack helpers + projectile collision system
- game.js: Updated BOSS_POOLS

Ready for testing on localhost:8000
```
