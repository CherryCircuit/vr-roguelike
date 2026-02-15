# Phase 5: Special Upgrades - Implementation Status

**Build:** DEF LEPPARD | v0.2.0
**Status:** ✅ COMPLETE (Framework + Mechanics Implemented)
**Last Updated:** February 15, 2026

---

## Overview

Phase 5 introduces a tiered special upgrade system with global upgrades that persist across weapon hands. After defeating bosses at levels 5, 10, 15, and 20, players choose from increasingly powerful upgrade pools.

---

## ✅ Completed Implementation

### 1. Upgrade Pools Created (`upgrades.js`)

#### RARE Pool (Tier 1 - Level 5 Boss)
| ID | Name | Effect | Type |
|----|------|--------|------|
| `add_heart` | Add 1 Heart | +2 max HP permanently | Global |
| `volatile` | Volatile | Enemies explode on death (3m radius, 25 dmg) | Global |
| `second_wind` | Second Wind | Survive death once (restores 4 HP) | Global |
| `crit_core` | Crit Core | +50% crit damage, +10% crit chance | Per-hand |
| `cooldown_tuner` | Cooldown Tuner | -30% alt-fire cooldowns | Per-hand |

#### EPIC Pool (Tier 2 - Level 10 Boss)
| ID | Name | Effect | Type |
|----|------|--------|------|
| `neon_overdrive` | Neon Overdrive | 30 kills = 8s buff (2x fire rate, 2x damage, invincibility) | Global |
| `heavy_hunter` | Heavy Hunter | +35% damage to tanks/bosses | Per-hand |

#### ULTRA Pool (Tier 3 - Level 15 Boss)
| ID | Name | Effect | Type |
|----|------|--------|------|
| `time_lord` | Time Lord | Alt-fire slows time 75% for 5s | Global |
| `death_aura` | Death Aura | 3m aura deals 5 dmg/sec | Global |
| `infinity_loop` | Infinity Loop | Repeats last alt weapon every 10s | Global |
| `hyper_crit` | Hyper Crit | +50% crit chance, shockwave on crit (5m, 30 dmg) | Per-hand |

#### LEGENDARY Pool (Tier 4 - Level 20 Boss)
| ID | Name | Effect | Type |
|----|------|--------|------|
| `god_caliber` | GOD CALIBER | ALL attacks deal 3x damage | Global |
| `chrono_shift` | CHRONO SHIFT | Teleport on damage (2s cooldown) | Global |
| `final_form` | FINAL FORM | Start each level at max power | Global |
| `soul_harvest` | SOUL HARVEST | Kills permanently add +1 damage | Global |
| `reality_tear` | REALITY TEAR | Shots rift to hit 3 extra enemies | Per-hand |
| `cosmic_shield` | COSMIC SHIELD | Block all damage for 2s every 15s | Global |

### 2. Global Upgrades System (`game.js`)

**New State Object:** `game.globalUpgrades`
```javascript
game.globalUpgrades = {
  // RARE
  volatile: false,
  second_wind: false,
  second_wind_used: false,
  
  // EPIC
  neon_overdrive: false,
  neon_overdrive_active: false,
  neon_overdrive_kills: 0,
  neon_overdrive_timer: 0,
  
  // ULTRA
  time_lord: false,
  time_lord_active: false,
  time_lord_timer: 0,
  death_aura: false,
  infinity_loop: false,
  infinity_loop_alt: null,
  infinity_loop_timer: 0,
  
  // LEGENDARY
  god_caliber: false,
  chrono_shift: false,
  chrono_shift_cooldown: 0,
  final_form: false,
  soul_harvest: false,
  soul_harvest_kills: 0,
  cosmic_shield: false,
  cosmic_shield_cooldown: 0,
  cosmic_shield_active: false,
  
  // Time slow effect
  time_slow_active: false,
  time_slow_multiplier: 1.0,
};
```

**New Helper Functions:**
- `addGlobalUpgrade(id)` - Applies a global upgrade by ID
- `hasGlobalUpgrade(id)` - Checks if a global upgrade is active
- `getGlobalUpgradesState()` - Returns state object for weapon stats
- `resetGlobalUpgrades()` - Called on new game

### 3. Mechanics Implementation (`main.js`)

#### Exported Functions for Integration:
```javascript
// Apply upgrade when selected
export function applyPhase5Upgrade(upgrade, hand = 'left')

// Volatile explosion on enemy death
export function triggerVolatileExplosion(position, scene)

// Second Wind death prevention
export function checkSecondWind(scene) → boolean

// Neon Overdrive kill tracking
export function trackNeonOverdriveKill()

// Death Aura continuous damage
export function updateDeathAura(deltaTime, scene, enemies)

// Infinity Loop auto-fire
export function updateInfinityLoop(deltaTime)
export function recordAltWeaponUse(altType)

// Hyper Crit shockwave
export function triggerHyperCritShockwave(position, scene, enemies)

// Soul Harvest tracking
export function trackSoulHarvestKill()

// Main update loop for all timed effects
export function updatePhase5Effects(deltaTime, scene, enemies)

// Get time multiplier for game speed
export function getTimeMultiplier() → number
```

### 4. Weapon Stats Integration (`upgrades.js`)

Updated `getWeaponStats(upgrades, globalUpgrades)` to include:
- Crit Core: +10% crit chance per stack
- Hyper Crit: +50% crit chance per stack  
- Crit multiplier bonuses
- Heavy Hunter: +35% damage to tanks/bosses
- Cooldown Tuner: -30% alt cooldowns
- Soul Harvest: Permanent damage from kills
- GOD CALIBER: 3x all damage
- Neon Overdrive buff: 2x damage, 2x fire rate

---

## 🔧 Integration Points Needed

These functions are implemented but need to be called from other modules:

### From `enemies.js`:
```javascript
import { triggerVolatileExplosion, trackNeonOverdriveKill, trackSoulHarvestKill } from './main.js';

// In enemy death handler:
triggerVolatileExplosion(enemy.mesh.position, scene);
trackNeonOverdriveKill();
trackSoulHarvestKill();
```

### From `hud.js`:
```javascript
import { applyPhase5Upgrade } from './main.js';
import { getSpecialUpgradesForBossTier } from './upgrades.js';

// When boss dies, get tiered upgrades:
const bossTier = game.getBossTier(game.level);  // 1, 2, 3, or 4
const upgrades = getSpecialUpgradesForBossTier(bossTier, 3);

// When player selects upgrade:
applyPhase5Upgrade(selectedUpgrade, hand);
```

### From `main.js` render loop:
```javascript
// Already implemented - call every frame:
updatePhase5Effects(delta, scene, enemies);
```

### From player damage handler:
```javascript
import { checkSecondWind } from './main.js';

// When player would die:
if (game.health <= 0) {
  if (!checkSecondWind(scene)) {
    // Proceed to GAME_OVER
  }
}
```

---

## 📊 Tier Access by Boss Level

| Boss Level | Tier | Pools Available | Total Upgrades |
|------------|------|-----------------|----------------|
| Level 5 | 1 (RARE) | RARE only | 5 |
| Level 10 | 2 (EPIC) | RARE + EPIC | 7 |
| Level 15 | 3 (ULTRA) | RARE + EPIC + ULTRA | 11 |
| Level 20 | 4 (LEGENDARY) | All pools | 17 |

---

## 🎮 Design Decisions Implemented

Per AGENTS.md preferences:
- **Death Aura**: 3m radius, 5 damage/second ✅
- **Neon Overdrive**: 30 kills = 8s buff with 2x fire rate, 2x damage, invincibility ✅
- **Time Lord**: 75% slow (enemies move at 25% speed for 5s) ✅
- **Second Wind**: Dramatic visual effect (expanding yellow sphere) ✅

---

## 📁 Files Modified

| File | Changes |
|------|---------|
| `upgrades.js` | Added 4 new upgrade pools, `getSpecialUpgradesForBossTier()`, updated `getWeaponStats()` |
| `game.js` | Added `globalUpgrades` state, helper functions (`addGlobalUpgrade`, `hasGlobalUpgrade`, etc.) |
| `main.js` | Added Phase 5 mechanics section with all upgrade implementations |
| `index.html` | Updated build name to DEF LEPPARD v0.2.0 |
| `AGENTS.md` | Added v0.2.0 to build history |

---

## ✅ Syntax Validation

All JavaScript files pass `node --check` with no errors.

---

## Next Steps for Full Integration

1. **Wire up `hud.js`** to use `getSpecialUpgradesForBossTier()` for boss rewards
2. **Wire up `enemies.js`** to call death-related upgrade functions
3. **Add visual feedback** for active upgrades (Neon Overdrive glow, Death Aura particles, etc.)
4. **Add audio feedback** for upgrade activation (Second Wind sound, Time Lord sound)
5. **Test in VR** on Meta Quest 2 for performance

---

## Summary

Phase 5 special upgrades framework is **complete and ready for integration**. All 17 upgrades across 4 tiers are defined, the global upgrades state system is in place, and the mechanics functions are implemented. The next developer needs to wire up the function calls from the appropriate game systems (enemy deaths, HUD selection, player damage).