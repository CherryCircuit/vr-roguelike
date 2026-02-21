# Weapon System Architecture Design

## Overview

This document defines the architecture for the refactored weapon system, implementing a clear separation between MAIN weapons, ALT weapons, and the UPGRADE system.

## Architecture Principles

1. **Separation of Concerns**: MAIN weapons, ALT weapons, and upgrades are distinct systems
2. **Scalability**: Easy to add new weapons and upgrades without modifying core logic
3. **Data-Driven**: Weapon behavior defined in data structures, not hardcoded logic
4. **Composability**: Upgrades stack and combine in predictable ways
5. **Hand Independence**: Each hand tracks its own weapon state independently

---

## 1. System Components

### 1.1 MAIN Weapons (Top/Select Trigger)

**Purpose**: Primary damage-dealing tools

**Characteristics**:
- Infinite ammo
- Always available
- Locked after choice (at level 2)
- Modified by upgrades

**Data Structure**:
```typescript
interface MainWeapon {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  desc: string;                  // Description
  color: string;                 // Hex color for UI
  type: 'main';                  // Weapon type
  baseStats: WeaponStats;        // Base statistics
}

interface WeaponStats {
  damage: number;                // Damage per projectile
  fireInterval: number;          // Ms between shots
  projectileCount: number;       // Projectiles per shot
  critChance: number;            // 0-1 crit probability
  critMultiplier: number;        // Crit damage multiplier
  piercing: boolean;             // Pass through enemies
  aoeRadius: number;             // Explosion radius (0 = no AOE)
  spreadAngle: number;           // Spread angle in radians
  lightning?: boolean;           // Auto-lock beam weapon
  lightningRange?: number;       // Beam range
  lightningTickInterval?: number;// Beam damage frequency
}
```

**Implemented Weapons**:
1. **Standard Blaster**: Balanced all-rounder
2. **Shotgun**: Multi-pellet spread, close range
3. **Assault Rifle**: High fire rate, lower damage
4. **Sniper**: High damage, slow fire, piercing
5. **Cannon**: Explosive shots, AOE damage
6. **Laser Beam**: Continuous beam, auto-lock

### 1.2 ALT Weapons (Squeeze Trigger)

**Purpose**: Utility abilities on cooldowns

**Characteristics**:
- Cooldown-based
- Limited duration or charges
- Unlockable via upgrades
- Independent of MAIN weapon

**Data Structure**:
```typescript
interface AltWeapon {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  desc: string;                  // Description
  color: string;                 // Hex color for UI
  type: 'alt';                   // Weapon type
  cooldown: number;              // Cooldown in ms
  duration?: number;             // Duration for ongoing effects
  damage?: number;               // Damage (if applicable)
  aoeRadius?: number;            // AOE radius (if applicable)
  range?: number;                // Range (if applicable)
  maxActive?: number;            // Max active instances (e.g., mines)
}
```

**Implemented ALT Weapons**:
1. **Shield**: Blocks enemy projectiles (2s duration, 3s cooldown)
2. **Grenade**: Throwable explosive (4s cooldown)
3. **Mine**: Placeable trap (6s cooldown)
4. **Drone**: Auto-targeting helper (10s duration, 8s cooldown)
5. **EMP**: Disables nearby enemies (3s duration, 10s cooldown)
6. **Teleport**: Instant movement (5s cooldown)

### 1.3 Upgrades

**Purpose**: Modify and enhance weapons

**Types**:
1. **Universal**: Apply to all MAIN weapons
2. **Weapon-Specific**: Only for matching MAIN weapon type

**Data Structure**:
```typescript
interface Upgrade {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  desc: string;                  // Description
  color: string;                 // Hex color for UI
  type: 'universal' | 'weapon_specific';  // Upgrade type
  weapon?: string;               // Required MAIN weapon ID (for weapon-specific)
}
```

**Implemented Upgrades**:

*Universal*:
- Scope: Damage +10
- Barrel: Fire rate +15%
- Piercing: Shots pass through enemies
- Critical: +15% crit chance
- Double Shot: +1 projectile
- Vampiric: Heal on kills
- Status effects: Shock, Fire, Freeze, Ricochet

*Weapon-Specific*:
- Shotgun: Choke (tighter spread), Drum Mag (+3 pellets)
- Assault Rifle: Burst Fire (3-round burst)
- Sniper: Sniper Scope (+50% crit damage)
- Cannon: Napalm (fire DoT on explosion)
- Laser Beam: Overcharge (+20% damage)

---

## 2. State Management

### 2.1 Game State (game.js)

```typescript
interface GameState {
  // Weapon state
  mainWeapon: {
    left: string;                // MAIN weapon ID for left hand
    right: string;               // MAIN weapon ID for right hand
  };
  
  altWeapon: {
    left: string | null;         // ALT weapon ID for left hand
    right: string | null;        // ALT weapon ID for right hand
  };
  
  altCooldowns: {
    left: number;                // Cooldown remaining (ms) for left hand
    right: number;               // Cooldown remaining (ms) for right hand
  };
  
  upgrades: {
    left: Record<string, number>; // Upgrade stacks for left hand
    right: Record<string, number>; // Upgrade stacks for right hand
  };
  
  mainWeaponLocked: {
    left: boolean;               // Whether left MAIN weapon is locked
    right: boolean;              // Whether right MAIN weapon is locked
  };
  
  nextUpgradeHand: 'left' | 'right'; // Next hand for upgrade selection
}
```

### 2.2 State Flow

```
Game Start
    ↓
Both hands: mainWeapon = 'standard_blaster'
Both hands: upgrades = {}
Both hands: mainWeaponLocked = false
    ↓
Level 1 Complete
    ↓
Show MAIN weapon selection (6 options)
    ↓
Player chooses MAIN weapon for one hand
    ↓
mainWeapon[hand] = chosen_weapon
mainWeaponLocked[hand] = true
    ↓
Level 2+ Complete
    ↓
Show UPGRADE selection (3 options, filtered by MAIN weapon)
    ↓
Player chooses upgrade
    ↓
upgrades[hand][upgrade_id] += 1
    ↓
Repeat
```

---

## 3. Factory Pattern

### 3.1 Weapon Factory

**Purpose**: Centralized weapon creation and stat calculation

**Implementation**:
```javascript
class WeaponFactory {
  // Get MAIN weapon definition
  static getMainWeapon(id) {
    return MAIN_WEAPONS[id] || null;
  }
  
  // Get ALT weapon definition
  static getAltWeapon(id) {
    return ALT_WEAPONS[id] || null;
  }
  
  // Get available upgrades for a MAIN weapon
  static getAvailableUpgrades(mainWeaponId) {
    return UPGRADE_POOL.filter(u => 
      u.type === 'universal' || 
      (u.type === 'weapon_specific' && u.weapon === mainWeaponId)
    );
  }
  
  // Calculate final weapon stats from base + upgrades
  static computeStats(mainWeaponId, upgrades) {
    const weapon = this.getMainWeapon(mainWeaponId);
    if (!weapon) return null;
    
    let stats = { ...weapon.baseStats };
    
    // Apply universal upgrades
    stats.damage += (upgrades.scope || 0) * 10;
    stats.fireInterval /= (1 + (upgrades.barrel || 0) * 0.15);
    // ... more upgrade applications
    
    // Apply weapon-specific upgrades
    if (mainWeaponId === 'shotgun' && upgrades.shotgun_drum) {
      stats.projectileCount += 3;
    }
    // ... more weapon-specific logic
    
    return stats;
  }
}
```

### 3.2 Upgrade Factory

**Purpose**: Generate upgrade selections

**Implementation**:
```javascript
class UpgradeFactory {
  // Get random MAIN weapon (for level 1-2 choice)
  static getRandomMainWeapon() {
    const keys = Object.keys(MAIN_WEAPONS);
    return keys[Math.floor(Math.random() * keys.length)];
  }
  
  // Get random upgrades filtered by MAIN weapon
  static getRandomUpgrades(count, mainWeaponId, excludeIds) {
    const pool = WeaponFactory.getAvailableUpgrades(mainWeaponId);
    const filtered = pool.filter(u => !excludeIds.includes(u.id));
    return this.shuffle(filtered).slice(0, count);
  }
  
  // Get special upgrades (after boss)
  static getRandomSpecialUpgrades(count, mainWeaponId) {
    const pool = SPECIAL_UPGRADE_POOL;
    return this.shuffle(pool).slice(0, count);
  }
  
  static shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
  }
}
```

---

## 4. Upgrade Path Logic

### 4.1 Guaranteed MAIN Weapon Choice

**Trigger**: Level 1 → Level 2 transition

**Logic**:
```javascript
function needsMainWeaponChoice() {
  return game.level === 1 && 
         !game.mainWeaponLocked.left && 
         !game.mainWeaponLocked.right;
}

function showMainWeaponSelection() {
  const weapons = Object.values(MAIN_WEAPONS);
  const hand = game.nextUpgradeHand;
  // Show 6 MAIN weapon cards
  // On selection:
  //   setMainWeapon(weaponId, hand);
  //   mainWeaponLocked[hand] = true;
}
```

### 4.2 Alternating Hand Upgrades

**Logic**:
```javascript
function getNextUpgradeHand() {
  const hand = game.nextUpgradeHand;
  game.nextUpgradeHand = hand === 'left' ? 'right' : 'left';
  return hand;
}

// Usage in upgrade selection:
const hand = getNextUpgradeHand();
// Show upgrades filtered by game.mainWeapon[hand]
// On selection: addUpgrade(upgradeId, hand);
```

### 4.3 Upgrade Filtering

**Logic**:
```javascript
function getAvailableUpgrades(mainWeaponId) {
  return UPGRADE_POOL.filter(upgrade => {
    if (upgrade.type === 'universal') return true;
    if (upgrade.type === 'weapon_specific') {
      return upgrade.weapon === mainWeaponId;
    }
    return false;
  });
}
```

### 4.4 Stacking Logic

**Damage Calculation**:
```javascript
// Base damage
let damage = weapon.baseStats.damage;

// Universal upgrades
damage += (upgrades.scope || 0) * 10;      // +10 per stack
damage += (upgrades.mega_scope || 0) * 25; // +25 per stack (special)

// Weapon-specific upgrades
if (mainWeaponId === 'laser_beam' && upgrades.laser_overcharge) {
  damage *= 1.2;  // +20%
}

// Global multipliers
if (upgrades.overcharge) {
  damage *= 1.2;  // +20% from overcharge
}
```

**Fire Rate Calculation**:
```javascript
// Base fire interval
let interval = weapon.baseStats.fireInterval;

// Universal upgrades
interval /= (1 + (upgrades.barrel || 0) * 0.15);        // +15% per stack
interval /= (1 + (upgrades.turbo_barrel || 0) * 0.30);  // +30% per stack (special)

// Weapon-specific modifications
if (mainWeaponId === 'assault_rifle' && upgrades.rifle_burst) {
  interval *= 2;  // Slower between bursts, but 3x projectiles
}
```

---

## 5. Integration Points

### 5.1 main.js Integration

**Weapon Firing**:
```javascript
function fireMainWeapon(controller, index) {
  const hand = index === 0 ? 'left' : 'right';
  const mainWeaponId = game.mainWeapon[hand];
  const stats = getWeaponStats(mainWeaponId, game.upgrades[hand]);
  
  // Use stats to fire weapon
  // stats.damage, stats.fireInterval, stats.projectileCount, etc.
}

function fireAltWeapon(controller, index) {
  const hand = index === 0 ? 'left' : 'right';
  const altWeaponId = game.altWeapon[hand];
  
  if (!altWeaponId) return;
  
  const now = performance.now();
  if (now < game.altCooldowns[hand]) return;  // Still on cooldown
  
  const altWeapon = getAltWeapon(altWeaponId);
  // Execute ALT weapon logic
  // Set cooldown: game.altCooldowns[hand] = now + altWeapon.cooldown;
}
```

**Trigger Handling**:
```javascript
// Top/select trigger → MAIN weapon
controller.addEventListener('selectstart', () => {
  fireMainWeapon(controller, index);
});

// Squeeze trigger → ALT weapon
controller.addEventListener('squeezestart', () => {
  fireAltWeapon(controller, index);
});
```

### 5.2 hud.js Integration

**Upgrade Card Display**:
```javascript
function showUpgradeCards(upgrades, hand) {
  // Differentiate between MAIN weapon selection and upgrade selection
  if (isMainWeaponSelection) {
    // Show 6 MAIN weapon cards
    // Display weapon name, description, base stats
  } else {
    // Show 3 upgrade cards
    // Display upgrade name, description, effect
    // Filter by game.mainWeapon[hand]
  }
}
```

### 5.3 Data Files

**weapons.js**:
- Exports: MAIN_WEAPONS, ALT_WEAPONS, UPGRADE_POOL, SPECIAL_UPGRADE_POOL
- Functions: getWeaponStats, getRandomUpgrades, getAvailableUpgrades, etc.

**game.js**:
- State: mainWeapon, altWeapon, altCooldowns, upgrades, mainWeaponLocked
- Functions: setMainWeapon, setAltWeapon, getNextUpgradeHand, needsMainWeaponChoice

---

## 6. Extensibility

### 6.1 Adding New MAIN Weapons

1. Add definition to MAIN_WEAPONS object:
```javascript
MAIN_WEAPONS.new_weapon = {
  id: 'new_weapon',
  name: 'New Weapon',
  desc: 'Description',
  color: '#color',
  type: 'main',
  baseStats: {
    damage: 20,
    fireInterval: 200,
    // ... other stats
  }
};
```

2. Add weapon-specific upgrades (optional):
```javascript
UPGRADE_POOL.push({
  id: 'new_weapon_upgrade',
  name: 'New Weapon Upgrade',
  desc: 'Description',
  color: '#color',
  type: 'weapon_specific',
  weapon: 'new_weapon'
});
```

3. Add weapon-specific logic in getWeaponStats() (if needed)

### 6.2 Adding New ALT Weapons

1. Add definition to ALT_WEAPONS object:
```javascript
ALT_WEAPONS.new_alt = {
  id: 'new_alt',
  name: 'New ALT',
  desc: 'Description',
  color: '#color',
  type: 'alt',
  cooldown: 5000,
  // ... other properties
};
```

2. Implement firing logic in fireAltWeapon()

### 6.3 Adding New Upgrades

1. Add definition to appropriate pool:
```javascript
// Universal upgrade
UPGRADE_POOL.push({
  id: 'new_upgrade',
  name: 'New Upgrade',
  desc: 'Description',
  color: '#color',
  type: 'universal'
});

// Weapon-specific upgrade
UPGRADE_POOL.push({
  id: 'new_weapon_upgrade',
  name: 'New Weapon Upgrade',
  desc: 'Description',
  color: '#color',
  type: 'weapon_specific',
  weapon: 'weapon_id'
});
```

2. Add upgrade logic in getWeaponStats()

---

## 7. Testing Strategy

### 7.1 Unit Tests

- **Weapon Factory**: Test stat calculations with various upgrade combinations
- **Upgrade Factory**: Test filtering, randomization
- **State Management**: Test weapon locking, hand alternation

### 7.2 Integration Tests

- **MAIN Weapon Firing**: Test all 6 weapon types
- **ALT Weapon Firing**: Test all 6 ALT types
- **Upgrade Application**: Test stacking, weapon-specific filters
- **Cooldown Management**: Test ALT weapon cooldowns

### 7.3 Gameplay Tests

- **Level 1→2**: MAIN weapon choice appears correctly
- **Upgrade Filtering**: Only relevant upgrades shown
- **Hand Alternation**: Upgrades alternate left/right correctly
- **Weapon Locking**: Cannot change MAIN weapon after choice

---

## 8. Performance Considerations

### 8.1 Stat Caching

Cache computed stats to avoid recalculation every frame:
```javascript
const statsCache = new Map();

function getWeaponStats(mainWeaponId, upgrades) {
  const cacheKey = `${mainWeaponId}:${JSON.stringify(upgrades)}`;
  
  if (statsCache.has(cacheKey)) {
    return statsCache.get(cacheKey);
  }
  
  const stats = computeStats(mainWeaponId, upgrades);
  statsCache.set(cacheKey, stats);
  return stats;
}
```

### 8.2 Upgrade Pool Caching

Pre-compute available upgrades for each MAIN weapon:
```javascript
const upgradePoolCache = new Map();

function getAvailableUpgrades(mainWeaponId) {
  if (upgradePoolCache.has(mainWeaponId)) {
    return upgradePoolCache.get(mainWeaponId);
  }
  
  const pool = UPGRADE_POOL.filter(u => 
    u.type === 'universal' || u.weapon === mainWeaponId
  );
  
  upgradePoolCache.set(mainWeaponId, pool);
  return pool;
}
```

---

## 9. Future Enhancements

### 9.1 Weapon Synergies

Allow upgrades to interact with each other:
```javascript
if (upgrades.fire && upgrades.shock) {
  // Fire + Shock = Plasma (combined effect)
  damage *= 1.5;
}
```

### 9.2 Weapon Mastery

Track usage stats and unlock bonuses:
```javascript
interface WeaponMastery {
  weaponId: string;
  kills: number;
  damage: number;
  level: number;  // Mastery level (1-5)
  bonus: number;  // Bonus per level
}
```

### 9.3 Dynamic Upgrades

Upgrades that change behavior based on context:
```javascript
{
  id: 'adaptive_damage',
  name: 'Adaptive Damage',
  desc: 'More damage to low-health enemies',
  type: 'universal',
  dynamic: (context) => {
    if (context.enemyHealthPercent < 0.3) {
      return { damage: 50 };
    }
    return {};
  }
}
```

---

## 10. Conclusion

This architecture provides:

✅ **Clear Separation**: MAIN weapons, ALT weapons, and upgrades are distinct systems
✅ **Scalability**: Easy to add new weapons and upgrades
✅ **Data-Driven**: Behavior defined in data structures
✅ **Extensibility**: Well-defined extension points
✅ **Performance**: Caching strategies for efficiency
✅ **Testability**: Clear testing strategy

The implementation is ready for developer integration following the WEAPON_INTEGRATION_PLAN.md document.
