# Weapon System Refactor - Integration Plan

## Summary
Refactor from current "shot type" vs "upgrade" system to MAIN/ALT/UPGRADE architecture.

## Architecture Changes

### 1. New File: weapons.js ✅ COMPLETE
- **MAIN_WEAPONS**: 6 types (standard_blaster, shotgun, assault_rifle, sniper, cannon, laser_beam)
- **ALT_WEAPONS**: 6 types (shield, grenade, mine, drone, emp, teleport)
- **UPGRADE_POOL**: Universal + weapon-specific upgrades
- **Helper functions**: getWeaponStats(), getRandomUpgrades(), etc.

### 2. game.js Updates ✅ COMPLETE
- **New state**:
  - `mainWeapon`: { left: 'standard_blaster', right: 'standard_blaster' }
  - `altWeapon`: { left: null, right: null }
  - `altCooldowns`: { left: 0, right: 0 }
  - `mainWeaponLocked`: { left: false, right: false }
  - `nextUpgradeHand`: 'left' (alternating)

- **New helpers**:
  - `setMainWeapon(weaponId, hand)`
  - `setAltWeapon(weaponId, hand)`
  - `getNextUpgradeHand()`
  - `needsMainWeaponChoice()`

### 3. main.js Updates (IN PROGRESS)

#### 3.1 Import Changes
```javascript
// OLD:
import { getWeaponStats, ... } from './upgrades.js';

// NEW:
import { getWeaponStats, getRandomUpgrades, getRandomSpecialUpgrades, MAIN_WEAPONS, getMainWeapon } from './weapons.js';
```

#### 3.2 Trigger Handling
**Current**: Only uses `select` trigger (top trigger)

**New**:
- `select` trigger → MAIN weapon
- `squeeze` trigger → ALT weapon

```javascript
controller.addEventListener('squeezestart', () => { 
  onSqueezePress(controller, index); 
});
controller.addEventListener('squeezeend', () => { 
  onSqueezeRelease(controller, index); 
});
```

#### 3.3 Weapon Firing Functions

**shootWeapon()** → **fireMainWeapon()**
- Update to use `getWeaponStats(game.mainWeapon[hand], game.upgrades[hand])`
- Keep existing projectile logic

**NEW: fireAltWeapon()**
- Check `game.altWeapon[hand]`
- Check cooldown `game.altCooldowns[hand]`
- Execute ALT weapon specific logic

#### 3.4 Upgrade Selection Flow

**Current flow**:
1. Level complete
2. Show 3 random upgrades
3. Pick one
4. Apply to alternating hand

**New flow**:
1. Level complete
2. Check if `needsMainWeaponChoice()` (level 1→2 transition)
   - **YES**: Show 6 MAIN weapons (pick one, locks it)
   - **NO**: Show 3 random upgrades (filtered by equipped MAIN weapon)
3. Pick one
4. Apply to hand returned by `getNextUpgradeHand()`

#### 3.5 Upgrade Card Display (hud.js)

**Changes needed**:
- When showing MAIN weapon cards: different UI treatment
- When showing ALT weapon cards: show cooldown info
- When showing upgrade cards: show weapon-specific icon

### 4. upgrades.js Deprecation

**Status**: Will be replaced by weapons.js

**Migration**:
- Move any remaining utility functions to weapons.js
- Update all imports from upgrades.js → weapons.js
- Eventually delete upgrades.js

## Implementation Priority

### Phase 1: Core System (DONE)
1. ✅ Create weapons.js with MAIN/ALT/UPGRADE definitions
2. ✅ Update game.js state management
3. ✅ Create helper functions

### Phase 2: Integration (IN PROGRESS)
1. ⏳ Update main.js imports
2. ⏳ Add squeeze trigger handling
3. ⏳ Refactor shootWeapon() → fireMainWeapon()
4. ⏳ Create fireAltWeapon()
5. ⏳ Update upgrade selection flow

### Phase 3: UI Updates (TODO)
1. ⏳ Update hud.js upgrade card display
2. ⏳ Show MAIN weapon selection differently
3. ⏳ Show ALT weapon availability

### Phase 4: Testing (TODO)
1. ⏳ Test MAIN weapon firing (all 6 types)
2. ⏳ Test ALT weapon firing (all 6 types)
3. ⏳ Test upgrade filtering by MAIN weapon
4. ⏳ Test level 1→2 MAIN weapon choice
5. ⏳ Test alternating hand upgrades
6. ⏳ Test weapon locking

## Key Design Decisions

### Decision 1: MAIN Weapon Locking
- **When**: After player chooses MAIN weapon at level 2
- **Why**: Prevents weapon spam, encourages strategic choice
- **How**: `game.mainWeaponLocked[hand] = true`

### Decision 2: ALT Weapon Cooldowns
- **Storage**: `game.altCooldowns[hand]` (milliseconds)
- **Check**: In squeeze trigger handler
- **Reset**: After ALT weapon fires

### Decision 3: Upgrade Filtering
- **Universal upgrades**: Always available
- **Weapon-specific**: Only shown if MAIN weapon matches
- **Implementation**: `getAvailableUpgrades(mainWeaponId)`

### Decision 4: Starting Loadout
- **MAIN weapons**: Both hands start with 'standard_blaster'
- **ALT weapons**: Unlocked via upgrades
- **Upgrades**: Empty at start

## Risks & Mitigation

### Risk 1: Breaking existing weapon functionality
**Mitigation**: Keep old getWeaponStats() logic compatible, test each weapon type

### Risk 2: Complex state management
**Mitigation**: Clear separation of MAIN/ALT/UPGRADE state, comprehensive logging

### Risk 3: UI confusion
**Mitigation**: Clear visual indicators for MAIN vs ALT vs UPGRADE cards

### Risk 4: ALT weapon cooldown balance
**Mitigation**: Test cooldowns extensively, make them adjustable

## Testing Checklist

- [ ] MAIN weapon: Standard Blaster fires correctly
- [ ] MAIN weapon: Shotgun fires correctly
- [ ] MAIN weapon: Assault Rifle fires correctly
- [ ] MAIN weapon: Sniper fires correctly
- [ ] MAIN weapon: Cannon fires correctly
- [ ] MAIN weapon: Laser Beam fires correctly
- [ ] ALT weapon: Shield works
- [ ] ALT weapon: Grenade works
- [ ] ALT weapon: Mine works
- [ ] ALT weapon: Drone works
- [ ] ALT weapon: EMP works
- [ ] ALT weapon: Teleport works
- [ ] Upgrade: Universal upgrades apply to all MAIN weapons
- [ ] Upgrade: Weapon-specific upgrades only appear for correct MAIN weapon
- [ ] Level 1→2: Shows MAIN weapon selection
- [ ] Upgrade hand alternation: left → right → left
- [ ] MAIN weapon locking: Cannot change after choice
- [ ] Cooldowns: ALT weapons respect cooldowns

## Next Steps

1. **IMMEDIATE**: Update main.js imports and weapon firing
2. **NEXT**: Add squeeze trigger handling
3. **THEN**: Update upgrade selection flow
4. **FINALLY**: Test all weapon types

## Notes

- This is a major refactor affecting core gameplay
- Must maintain backward compatibility during transition
- Extensive testing required before merge
- Consider feature flag to toggle between old/new system during testing
