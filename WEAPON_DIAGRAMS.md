# Weapon System - Architecture Diagrams

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    GAME STATE (game.js)                  │
│                                                          │
│  mainWeapon: { left: ID, right: ID }                    │
│  altWeapon: { left: ID, right: ID }                     │
│  upgrades: { left: {...}, right: {...} }                │
│  mainWeaponLocked: { left: bool, right: bool }          │
│  altCooldowns: { left: ms, right: ms }                  │
└─────────────────────────────────────────────────────────┘
                           │
                           │ reads/writes
                           ▼
┌─────────────────────────────────────────────────────────┐
│              WEAPON FACTORY (weapons.js)                 │
│                                                          │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │ MAIN_WEAPONS  │  │  ALT_WEAPONS  │  │ UPGRADES    │ │
│  │               │  │               │  │             │ │
│  │ standard_     │  │ shield        │  │ universal   │ │
│  │   blaster     │  │ grenade       │  │ weapon_     │ │
│  │ shotgun       │  │ mine          │  │   specific  │ │
│  │ assault_      │  │ drone         │  │             │ │
│  │   rifle       │  │ emp           │  │             │ │
│  │ sniper        │  │ teleport      │  │             │ │
│  │ cannon        │  │               │  │             │ │
│  │ laser_beam    │  │               │  │             │ │
│  └───────────────┘  └───────────────┘  └─────────────┘ │
│                                                          │
│  Functions:                                              │
│  - getWeaponStats(mainId, upgrades) → stats             │
│  - getAvailableUpgrades(mainId) → upgrades[]            │
│  - getRandomUpgrades(count, mainId) → upgrades[]        │
└─────────────────────────────────────────────────────────┘
                           │
                           │ provides data to
                           ▼
┌─────────────────────────────────────────────────────────┐
│                GAME LOOP (main.js)                       │
│                                                          │
│  Triggers:                                               │
│  - select trigger → fireMainWeapon()                    │
│  - squeeze trigger → fireAltWeapon()                    │
│                                                          │
│  Functions:                                              │
│  - fireMainWeapon(controller, index)                    │
│    • Get stats from getWeaponStats()                    │
│    • Fire projectiles using stats                       │
│  - fireAltWeapon(controller, index)                     │
│    • Check cooldown                                     │
│    • Execute ALT weapon effect                          │
│    • Set cooldown                                       │
└─────────────────────────────────────────────────────────┘
                           │
                           │ updates
                           ▼
┌─────────────────────────────────────────────────────────┐
│              UPGRADE UI (hud.js)                         │
│                                                          │
│  - showMainWeaponSelection(weapons)                     │
│  - showUpgradeCards(upgrades, hand)                     │
│  - updateBlasterDisplay(display, stats)                 │
└─────────────────────────────────────────────────────────┘
```

## Upgrade Flow

```
Level Complete
      │
      ▼
┌─────────────────────┐
│ Check Level         │
│ 1 → 2?              │
└─────────────────────┘
      │
      ├─── YES ──────────────────┐
      │                          │
      │                          ▼
      │                ┌──────────────────┐
      │                │ Show 6 MAIN      │
      │                │ Weapon Cards     │
      │                └──────────────────┘
      │                          │
      │                          │ Player selects
      │                          ▼
      │                ┌──────────────────┐
      │                │ setMainWeapon()  │
      │                │ Lock weapon      │
      │                └──────────────────┘
      │
      ├─── NO ───────────────────┐
      │                          │
      │                          ▼
      │                ┌──────────────────┐
      │                │ Get next hand    │
      │                │ (alternating)    │
      │                └──────────────────┘
      │                          │
      │                          ▼
      │                ┌──────────────────┐
      │                │ Get MAIN weapon  │
      │                │ for that hand    │
      │                └──────────────────┘
      │                          │
      │                          ▼
      │                ┌──────────────────┐
      │                │ Get available    │
      │                │ upgrades (filter)│
      │                └──────────────────┘
      │                          │
      │                          ▼
      │                ┌──────────────────┐
      │                │ Show 3 Upgrade   │
      │                │ Cards            │
      │                └──────────────────┘
      │                          │
      │                          │ Player selects
      │                          ▼
      │                ┌──────────────────┐
      │                │ addUpgrade()     │
      │                │ Stack upgrade    │
      │                └──────────────────┘
      │
      └──────────────────────┘
```

## Weapon Stat Calculation

```
Base Stats (from MAIN_WEAPONS)
      │
      ▼
┌─────────────────────┐
│ Universal Upgrades  │
│ - scope (+10 dmg)   │
│ - barrel (+15% FR)  │
│ - piercing          │
│ - etc.              │
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Weapon-Specific     │
│ Upgrades            │
│ - IF matches weapon │
│   THEN apply        │
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ Global Multipliers  │
│ - overcharge (+20%) │
│ - etc.              │
└─────────────────────┘
      │
      ▼
Final Stats
(damage, fireInterval, etc.)
```

## Trigger Input Flow

```
Controller Input
      │
      ├─── select trigger (top) ────┐
      │                              │
      │                              ▼
      │                    ┌──────────────────┐
      │                    │ fireMainWeapon() │
      │                    │                  │
      │                    │ 1. Get hand      │
      │                    │ 2. Get weapon ID │
      │                    │ 3. Get upgrades  │
      │                    │ 4. Calculate     │
      │                    │    stats         │
      │                    │ 5. Fire weapon   │
      │                    └──────────────────┘
      │
      ├─── squeeze trigger (side) ───┐
      │                               │
      │                               ▼
      │                     ┌──────────────────┐
      │                     │ fireAltWeapon()  │
      │                     │                  │
      │                     │ 1. Get hand      │
      │                     │ 2. Check cooldown│
      │                     │ 3. Execute ALT   │
      │                     │ 4. Set cooldown  │
      │                     └──────────────────┘
      │
      └─────────────────────────────
```

## Data Dependencies

```
weapons.js
    │
    ├─── MAIN_WEAPONS ────────────┐
    │    standard_blaster         │
    │    shotgun                  │
    │    assault_rifle            │
    │    sniper                   │
    │    cannon                   │
    │    laser_beam               │
    │                             │
    ├─── ALT_WEAPONS ─────────────┤
    │    shield                   │
    │    grenade                  │
    │    mine                     │
    │    drone                    │
    │    emp                      │
    │    teleport                 │
    │                             │
    └─── UPGRADE_POOL ────────────┤
         universal:               │
           scope                  │
           barrel                 │
           piercing               │
           ...                    │
                                 │
         weapon_specific:        │
           shotgun_choke ────────┼─── requires: shotgun
           rifle_burst ──────────┼─── requires: assault_rifle
           sniper_scope ─────────┼─── requires: sniper
           cannon_napalm ────────┼─── requires: cannon
           laser_overcharge ─────┼─── requires: laser_beam
                                 │
                                 │
game.js ◄────────────────────────┘
    │
    └─── State:
         mainWeapon: { left, right } ──────► references MAIN_WEAPONS
         altWeapon: { left, right } ───────► references ALT_WEAPONS
         upgrades: { left, right } ────────► references UPGRADE_POOL
```

## Hand Alternation Pattern

```
Level 1 Complete
      │
      ▼
┌─────────────┐
│ Choose MAIN │
│ weapon      │
│ (random     │
│  hand)      │
└─────────────┘
      │
      ▼
nextUpgradeHand: 'left'

Level 2 Complete
      │
      ▼
┌─────────────┐
│ Upgrade for │
│ LEFT hand   │
└─────────────┘
      │
      ▼
nextUpgradeHand: 'right'

Level 3 Complete
      │
      ▼
┌─────────────┐
│ Upgrade for │
│ RIGHT hand  │
└─────────────┘
      │
      ▼
nextUpgradeHand: 'left'

Level 4 Complete
      │
      ▼
┌─────────────┐
│ Upgrade for │
│ LEFT hand   │
└─────────────┘
      │
      ▼
nextUpgradeHand: 'right'

... (repeats)
```

## Cooldown Management (ALT Weapons)

```
Timeline (ms):
0        3000       4000       7000       8000
│         │          │          │          │
├─────────┼──────────┼──────────┼──────────┤
│         │          │          │          │
│  Ready  │ Cooldown │  Ready   │ Cooldown │
│         │          │          │          │
         ▲          ▲          ▲          ▲
         │          │          │          │
     Fire ALT    Can fire  Fire ALT    Can fire
     (shield)    again     (shield)    again
```

## Upgrade Stacking Example

```
Standard Blaster + Upgrades

Base Stats:
  damage: 15
  fireInterval: 180
  projectileCount: 1

Add scope: 2
  → damage: 15 + (2 × 10) = 35

Add barrel: 3
  → fireInterval: 180 / (1 + 3 × 0.15) = 180 / 1.45 = 124ms

Add double_shot: 1
  → projectileCount: 1 + 1 = 2

Final Stats:
  damage: 35
  fireInterval: 124
  projectileCount: 2
```

## Weapon Lock Logic

```
Game Start
      │
      ▼
mainWeapon: {
  left: 'standard_blaster',
  right: 'standard_blaster'
}
mainWeaponLocked: {
  left: false,
  right: false
}
      │
      ▼
Level 1 Complete
      │
      ▼
Player chooses 'shotgun' for LEFT hand
      │
      ▼
setMainWeapon('shotgun', 'left')
      │
      ▼
mainWeapon: {
  left: 'shotgun', ◄─── Changed
  right: 'standard_blaster'
}
mainWeaponLocked: {
  left: true, ◄─── Locked
  right: false
}
      │
      ▼
Future upgrades for LEFT hand
MUST work with shotgun
(filter by shotgun)
      │
      ▼
Cannot change LEFT MAIN weapon
(mainWeaponLocked.left === true)
```

## Cache Strategy

```
┌─────────────────────────────────────────┐
│          Stats Cache                     │
│                                          │
│  Key: "shotgun:{scope:2,barrel:3}"      │
│  Value: { damage: 35, fireInterval: ... }│
└─────────────────────────────────────────┘
         ▲                    │
         │                    │
         │                    ▼
    Cache Hit?          Return cached stats
         │
         │ No
         ▼
    Calculate stats
         │
         ▼
    Store in cache
         │
         ▼
    Return stats
```

These diagrams provide a visual understanding of the weapon system architecture and data flow.
