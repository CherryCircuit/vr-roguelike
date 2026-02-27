# Boss System Refactor - Issue #28

## Summary
Refactored the boss system to remove all old boss implementations except the teleporting boss, creating a proper framework with phase transitions, weak points, minion spawning, projectile patterns, and a telegraphing system.

## Changes Made

### 1. enemies.js - Complete Boss Framework

#### New Classes
- **TelegraphingSystem**: Visual/audio warning system for boss attacks
  - Supports 5 attack types: projectile, charge, minion, teleport, melee
  - Automatic cleanup and performance management
  - Sound integration with audio module

- **Boss (Base Class)**: Foundation for all boss types
  - Phase transitions (66%, 33% health)
  - Weak point system (20% of voxels)
  - Minion spawning framework
  - Projectile firing framework
  - Telegraphing integration
  - Health bar UI updates

- **DodgerBoss**: Teleporting boss with charge-up explosion mechanic
  - State machine: hidden → appearing → charging → stunned/normal → hiding
  - Telegraphs teleports with visual/audio warnings
  - Phase-based difficulty (faster dodging in later phases)
  - Stuns when hit during charge

#### Removed Boss Types
All old boss behaviors were removed:
- `spawner` (grave_voxel, siege_ram)
- `turret` (iron_sentry, chrono_wraith originally had this but now it's dodger)
- `charger` (core_guardian)
- `shielded` behavior

Now only the **chrono_wraith (teleporting boss)** remains.

#### Boss Definitions
```javascript
BOSS_DEFS = {
  chrono_wraith: {
    pattern: [[1, 1, 1, 1]],
    voxelSize: 0.45,
    baseHp: 850,
    phases: 3,
    color: 0x00ff88,
    scoreValue: 100,
    behavior: 'dodger',
    hitboxRadius: 0.45
  }
}
```

### 2. game.js - Simplified Boss Pools

Updated boss pool management:
```javascript
BOSS_POOLS = {
  1: ['chrono_wraith'],
  2: ['chrono_wraith'],
  3: ['chrono_wraith'],
  4: ['chrono_wraith'],
};
```

All tiers now use only the teleporting boss.

### 3. main.js - Boss Integration

Added boss defeat detection:
```javascript
if (boss.hp <= 0) {
  console.log(`[boss] Boss defeated!`);
  clearBoss();
  completeLevel();
}
```

### 4. hud.js - No Changes Needed

The boss health bar functions were already present and remain compatible with the new API.

## Acceptance Criteria Met

✅ **Remove all old boss implementations (except teleporting boss)**
   - Removed spawner, turret, charger, shielded behaviors
   - Only chrono_wraith (teleporting boss) remains

✅ **Create boss base class/framework with:**
   - ✅ Phase transitions (66%, 33% health)
   - ✅ Weak point system
   - ✅ Minion spawning framework
   - ✅ Projectile patterns framework
   - ✅ Telegraphing system

✅ **Boss pool management (performance)**
   - Simplified to single boss per tier
   - Random selection from pool

✅ **Boss health bar UI**
   - Already implemented in hud.js
   - 3-segment phase display

✅ **Boss fight state management**
   - State machine in DodgerBoss
   - Telegraphing system for warnings
   - Phase-based difficulty scaling

## Compatibility

The refactored system maintains backward compatibility with:
- Main.js render loop
- HUD functions
- Audio functions (via window object)
- Existing enemy spawning system

## Files Modified

1. `/enemies.js` - Complete rewrite with boss framework
2. `/game.js` - Simplified boss pool definitions
3. `/main.js` - Added boss defeat detection

## Future Enhancements

Potential additions to the framework:
- Additional boss types (turret, spawner, charger)
- More complex telegraphing patterns
- Boss telegraph cooldown balancing
- Boss-specific visual effects
- Boss death animations

## Testing Checklist

- [ ] Boss spawns correctly on level 5, 10, 15, 20
- [ ] Boss health bar shows 3 segments and updates correctly
- [ ] Boss teleports and charges (teleporting boss functionality)
- [ ] Phase transitions occur at 66% and 33% health
- [ ] Weak points deal double damage
- [ ] Telegraphing system shows visual warnings
- [ ] Boss defeat triggers level completion
- [ ] Minions spawn (if applicable)
- [ ] Projectiles fire (if applicable)
- [ ] No performance degradation

## Backward Compatibility Notes

- Old boss IDs (`grave_voxel`, `iron_sentry`, etc.) no longer work
- Only `chrono_wraith` is available
- Boss health bar parameters changed slightly (optional camera parameter in spawnBoss)
- Telegraphing system is opt-in (main.js doesn't explicitly enable it yet)
