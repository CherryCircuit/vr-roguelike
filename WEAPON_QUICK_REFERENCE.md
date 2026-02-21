# Weapon System - Developer Quick Reference

## File Structure

```
vr-roguelike/
├── weapons.js           # Weapon definitions and factory functions
├── game.js              # Game state (including weapon state)
├── main.js              # Main loop (weapon firing)
├── hud.js               # UI (upgrade cards)
├── WEAPON_ARCHITECTURE.md    # Full architecture docs
├── WEAPON_INTEGRATION_PLAN.md # Integration steps
└── WEAPON_QUICK_REFERENCE.md  # This file
```

## Key Data Structures

### MAIN Weapon
```javascript
{
  id: 'standard_blaster',
  name: 'Standard Blaster',
  desc: 'Balanced all-rounder',
  color: '#00ffff',
  type: 'main',
  baseStats: {
    damage: 15,
    fireInterval: 180,
    projectileCount: 1,
    critChance: 0,
    critMultiplier: 2,
    piercing: false,
    aoeRadius: 0,
    spreadAngle: 0
  }
}
```

### ALT Weapon
```javascript
{
  id: 'shield',
  name: 'Shield',
  desc: 'Blocks enemy projectiles',
  color: '#4488ff',
  type: 'alt',
  cooldown: 3000,  // 3 seconds
  duration: 2000   // 2 seconds
}
```

### Upgrade
```javascript
{
  id: 'scope',
  name: 'Scope',
  desc: 'Damage +10 per stack',
  color: '#00ff44',
  type: 'universal'  // or 'weapon_specific'
}
```

## Game State

```javascript
game = {
  // MAIN weapon per hand
  mainWeapon: { left: 'standard_blaster', right: 'standard_blaster' },
  
  // ALT weapon per hand
  altWeapon: { left: null, right: null },
  
  // ALT cooldowns (ms)
  altCooldowns: { left: 0, right: 0 },
  
  // Upgrades per hand
  upgrades: { left: {}, right: {} },
  
  // MAIN weapon locked per hand
  mainWeaponLocked: { left: false, right: false },
  
  // Next hand for upgrade selection
  nextUpgradeHand: 'left'
}
```

## Common Operations

### Get Weapon Stats
```javascript
import { getWeaponStats } from './weapons.js';

const hand = 'left';
const mainWeaponId = game.mainWeapon[hand];
const upgrades = game.upgrades[hand];
const stats = getWeaponStats(mainWeaponId, upgrades);

// Use stats.damage, stats.fireInterval, etc.
```

### Get Available Upgrades
```javascript
import { getAvailableUpgrades, getRandomUpgrades } from './weapons.js';

const mainWeaponId = game.mainWeapon[hand];
const available = getAvailableUpgrades(mainWeaponId);
const random3 = getRandomUpgrades(3, mainWeaponId);
```

### Set MAIN Weapon
```javascript
import { setMainWeapon } from './game.js';

setMainWeapon('shotgun', 'left');
// game.mainWeapon.left = 'shotgun'
// game.mainWeaponLocked.left = true
```

### Add Upgrade
```javascript
import { addUpgrade } from './game.js';

addUpgrade('scope', 'left');
// game.upgrades.left.scope = (game.upgrades.left.scope || 0) + 1
```

### Get Next Upgrade Hand
```javascript
import { getNextUpgradeHand } from './game.js';

const hand = getNextUpgradeHand();  // Returns 'left', then 'right', etc.
```

## MAIN Weapon List

| ID | Name | Type | Key Stats |
|----|------|------|-----------|
| standard_blaster | Standard Blaster | Balanced | 15 dmg, 180ms |
| shotgun | Shotgun | Spread | 18 dmg, 540ms, 5 pellets |
| assault_rifle | Assault Rifle | Rapid | 8 dmg, 90ms |
| sniper | Sniper | Precision | 50 dmg, 800ms, piercing |
| cannon | Cannon | AOE | 25 dmg, 600ms, 1.2 radius |
| laser_beam | Laser Beam | Beam | 10 dmg, 80ms, auto-lock |

## ALT Weapon List

| ID | Name | Cooldown | Duration/Effect |
|----|------|----------|-----------------|
| shield | Shield | 3s | 2s protection |
| grenade | Grenade | 4s | 40 dmg, 2.0 radius |
| mine | Mine | 6s | 60 dmg, 2.5 radius |
| drone | Drone | 8s | 10s helper |
| emp | EMP | 10s | 3s disable |
| teleport | Teleport | 5s | Instant movement |

## Upgrade Categories

### Universal Upgrades
- **Damage**: scope (+10), mega_scope (+25)
- **Fire Rate**: barrel (+15%), turbo_barrel (+30%)
- **Projectiles**: double_shot (+1), triple_shot (+2)
- **Critical**: critical (15% @ 2x), super_crit (25% @ 3x)
- **Utility**: piercing, vampiric, ricochet
- **Status Effects**: fire, shock, freeze

### Weapon-Specific Upgrades

**Shotgun**:
- shotgun_choke: Tighter spread (60% spread reduction)
- shotgun_drum: +3 pellets

**Assault Rifle**:
- rifle_burst: 3-round burst (3x projectiles, 2x fire interval)

**Sniper**:
- sniper_scope: +50% crit damage (3x → 4.5x)

**Cannon**:
- cannon_napalm: Fire DoT on explosion

**Laser Beam**:
- laser_overcharge: +20% damage

## Implementation Checklist

### Phase 1: Data Structures ✅
- [x] Create weapons.js with MAIN/ALT/UPGRADE definitions
- [x] Update game.js with weapon state
- [x] Create factory functions

### Phase 2: Integration ⏳
- [ ] Update main.js imports
- [ ] Add squeeze trigger handling
- [ ] Refactor fireMainWeapon()
- [ ] Create fireAltWeapon()
- [ ] Update upgrade flow

### Phase 3: UI ⏳
- [ ] Update hud.js for MAIN weapon cards
- [ ] Show ALT weapon cooldowns
- [ ] Different UI for weapon types

### Phase 4: Testing ⏳
- [ ] Test all MAIN weapons
- [ ] Test all ALT weapons
- [ ] Test upgrade filtering
- [ ] Test level 1→2 MAIN weapon choice

## Common Pitfalls

### 1. Wrong Import Path
❌ `import { getWeaponStats } from './upgrades.js';`
✅ `import { getWeaponStats } from './weapons.js';`

### 2. Forgetting Hand Parameter
❌ `getWeaponStats(game.mainWeapon, game.upgrades);`
✅ `getWeaponStats(game.mainWeapon[hand], game.upgrades[hand]);`

### 3. Not Checking Weapon Lock
❌ `setMainWeapon('shotgun', 'left');` (when already locked)
✅ `if (!game.mainWeaponLocked[hand]) { setMainWeapon('shotgun', hand); }`

### 4. Not Updating Cache
After changing upgrades, the cached stats may be stale. Clear cache if needed:
```javascript
// In weapons.js, consider adding:
export function clearStatsCache() {
  statsCache.clear();
}
```

## Testing Commands

### Test MAIN Weapon Firing
```javascript
// In browser console
game.mainWeapon.left = 'shotgun';
game.upgrades.left = { scope: 5, shotgun_drum: 1 };
const stats = getWeaponStats('shotgun', game.upgrades.left);
console.log(stats);
```

### Test Upgrade Filtering
```javascript
import { getAvailableUpgrades } from './weapons.js';
const upgrades = getAvailableUpgrades('sniper');
console.log(upgrades);  // Should show universal + sniper-specific
```

### Test State Management
```javascript
import { setMainWeapon, getNextUpgradeHand } from './game.js';
setMainWeapon('cannon', 'left');
console.log(game.mainWeaponLocked.left);  // true
console.log(getNextUpgradeHand());  // 'left' (then alternates)
```

## Performance Tips

1. **Cache Stats**: Don't recalculate every frame
2. **Pre-compute Pools**: Cache upgrade pools per weapon
3. **Object Pooling**: Reuse projectile objects
4. **Limit Checks**: Only check cooldowns when needed

## Debug Mode

Enable debug logging:
```javascript
localStorage.setItem('debug_weapons', 'true');
```

Then in weapons.js:
```javascript
if (localStorage.getItem('debug_weapons') === 'true') {
  console.log('[Weapon] Stats calculated:', stats);
}
```

## Next Steps

1. Read WEAPON_ARCHITECTURE.md for full design
2. Follow WEAPON_INTEGRATION_PLAN.md for integration
3. Use this quick reference during implementation
4. Test thoroughly using the checklist

## Questions?

- Architecture decisions: See WEAPON_ARCHITECTURE.md
- Integration steps: See WEAPON_INTEGRATION_PLAN.md
- Code examples: This file
- Testing: See WEAPON_ARCHITECTURE.md section 7
