# Missing Features Analysis

## Summary

After searching git branches and history, here are the findings for features that were developed but may not be fully implemented in gh-pages:

---

## 1. NEW BOSSES - ✅ NOT MISSING

**Status:** All bosses ARE present in gh-pages branch.

### Location
- **Branch:** `origin/gh-pages`, `origin/main`
- **File:** `enemies.js`
- **Commit:** `4ecabf3` - "Replace old bosses with new feature branch bosses"

### Boss Tiers

#### Level 5 (Tier 1)
- `chrono_wraith` - Teleporting dodger boss

#### Level 10 (Tier 2 - HARDER)
- `hunter_breakenridge` - Bounty hunter with rifle and drone (behavior: hunter)
- `dj_drax` - DJ booth with speaker stacks and fan minions (behavior: dj)
- `captain_kestrel` - Starship captain with cannons and missiles (behavior: starfighter)
- `dr_aster` - Scientist with minion spawning (behavior: scientist)
- `sunflare_seraph` - Monk with meditation phases (behavior: monk)

#### Level 15 (Tier 3 - TOUGH)
- `theodore_breakenridge` - Outlaw with vanish and shadow bullets (behavior: outlaw)
- `commander_halcyon` - Military commander with lasers (behavior: commander)
- `madame_coda` - Diva with performance phases (behavior: diva)
- `twin_glitch` - Twin units with vulnerability swapping (behavior: twin_glitch)
- `neon_minotaur` - Charging minotaur with slam attacks (behavior: minotaur)

#### Level 20 (Tier 4 - VERY TOUGH)
- `walter_breakenridge` - Family patriarch with minions (behavior: walter)
- `kernel_monolith` - AI kernel with projectiles (behavior: kernel)
- `synth_kraken` - Kraken with tentacle minions (behavior: kraken)
- `afterimage_seraphim` - Angelic being with afterimages (behavior: seraphim)
- `sun_eater_train` - Train boss (behavior: train)

### Boss Behaviors Implemented
- `dodger`, `hunter`, `dj`, `starfighter`, `scientist`, `monk`
- `outlaw`, `commander`, `diva`, `twin_glitch`, `minotaur`
- `walter`, `kernel`, `kraken`, `seraphim`, `train`
- Also: `spawner`, `turret`, `shielded`, `charger` (from older system)

---

## 2. NEW BIOMES - ✅ NOT MISSING

**Status:** All biomes ARE present in gh-pages branch.

### Location
- **Branch:** `origin/gh-pages`, `origin/main`
- **File:** `scenery.js`
- **Commit:** `8654da2` - "Implement complete visual overhaul for SPACEOMICIDE"

### Biomes Implemented

| Biome | Levels | Theme |
|-------|--------|-------|
| `synthwave` | 1-4 | Classic pink/cyan neon |
| `hellscape` | 6-9 | Red/orange embers, dark sky |
| `frozen` | 11-14 | Blue/white ice, snow particles |
| `corruption` | 16-19 | Purple void, corruption particles |
| `boss` | 5, 10, 15, 20 | Red alert, danger particles |

### Theme System
```javascript
export function getThemeForLevel(level) {
  if (level % 5 === 0) return THEMES.boss;
  if (level <= 4) return THEMES.synthwave;
  if (level <= 9) return THEMES.hellscape;
  if (level <= 14) return THEMES.frozen;
  return THEMES.corruption;
}
```

### Theme Properties
Each theme includes:
- `skyColor`, `fogColor`, `fogDensity`
- `gridColor`, `gridOpacity`
- `mountainFill`, `mountainWire`, `mountainWireOpacity`
- `sunColors[]`, `sunGlowColor`, `starColor`
- `particles: { type, color, count, speed }`

---

## 3. ALT WEAPON SYSTEM - ⚠️ PARTIALLY MISSING

**Status:** Basic ALT weapons are present, but ADVANCED ALT weapons are missing from gh-pages.

### Location of Advanced ALT Weapons
- **Branch:** Various feature branches (not fully merged to gh-pages)
- **File:** `weapons.js`, `upgrades.js`, `main.js`
- **Commits:** `5f7d88a`, `6822e5c`, `b7e5c55`

### ALT Weapons IN gh-pages (Basic Set)
| Weapon | Description | Cooldown |
|--------|-------------|----------|
| `shield` | Blocks enemy projectiles | 3s |
| `grenade` | Throwable explosive | 4s |
| `mine` | Placeable explosive trap | 6s |
| `drone` | Auto-targeting helper | 8s |
| `emp` | Disables nearby enemies | 10s |
| `teleport` | Instant movement | 5s |

### ALT Weapons MISSING from gh-pages (Advanced Set)
| Weapon | Description | Cooldown | Location |
|--------|-------------|----------|----------|
| `rocket` | High damage explosive | 15s | `issue-35-alt-weapons` |
| `helper_bot` | Turret robot that orbits and shoots | 30s | `issue-35-alt-weapons` |
| `gravity_well` | Pulls enemies to center | 25s | `issue-35-alt-weapons` |
| `ion_mortar` | Arcing high-damage shot | 20s | `issue-35-alt-weapons` |
| `hologram` | Decoy that attracts enemies | 28s | `issue-35-alt-weapons` |

### Advanced ALT Weapon Definitions (from issue-35-alt-weapons)
```javascript
export const ALT_WEAPON_DEFS = {
  rocket: {
    name: 'Rocket Launcher',
    damage: 250,
    splashRadius: 3,
    cooldown: 15000,
    color: '#ff4444',
    iconMesh: 'rocket',
  },
  helper_bot: {
    name: 'Helper Bot',
    duration: 15000,
    damage: 15,
    fireRate: 200,
    cooldown: 30000,
    color: '#44ff44',
    iconMesh: 'robot',
  },
  gravity_well: {
    name: 'Gravity Well',
    duration: 4000,
    pullRadius: 5,
    pullForce: 15,
    cooldown: 25000,
    color: '#aa44ff',
    iconMesh: 'sphere',
  },
  ion_mortar: {
    name: 'Ion Mortar',
    damage: 400,
    splashRadius: 4,
    arcingHeight: 10,
    cooldown: 20000,
    color: '#44ffaa',
    iconMesh: 'mortar',
  },
  hologram: {
    name: 'Hologram Decoy',
    duration: 6000,
    cooldown: 28000,
    color: '#44ffff',
    iconMesh: 'figure',
  },
};
```

### Implementation Functions (in upgrades.js)
```javascript
// These functions exist in feature branches but may not be in gh-pages:
export function fireRocket(controller, hand, scene) { ... }
export function spawnHelperBot(controller, hand) { ... }
export function activateShield(hand) { ... }
export function createGravityWell(controller, scene) { ... }
export function fireIonMortar(controller, scene) { ... }
export function spawnHologram(controller, scene) { ... }
```

---

## 4. COOLDOWN SYSTEM - ⚠️ PARTIALLY IMPLEMENTED

**Status:** Basic cooldown exists, but advanced features may be missing.

### What's in gh-pages
- Basic `altCooldowns` tracking in game.js
- Simple cooldown check before firing

### What's Missing (from feature branches)
- `playAltWeaponReadySound()` - Sound when cooldown completes
- `altReadySoundPlayed` flag to prevent sound spam
- Visual cooldown indicators on controllers
- Star pickup system for acquiring ALT weapons

---

## 5. ADDITIONAL FEATURES (From Creative Expansion Plan)

**Status:** Planned but NOT IMPLEMENTED

### Location
- **File:** `CREATIVE_EXPANSION_PLAN.md`
- **Commit:** `e0c443a`

### Planned Main Weapons (Not Yet Implemented)
- Boomerang Disc
- Gravity Well Launcher (different from ALT weapon)
- Chain Lightning Rod
- Ricochet Pistol
- Vortex Beam
- Time Skip Rifle

### Planned ALT Weapons (Not Yet Implemented)
- Decoy Hologram (different from basic hologram)
- Tether Harpoon
- Phase Dash
- Singularity Mine
- Nanite Swarm
- Reflector Drone

### Planned Enemy Types (Not Yet Implemented)
- Spiral Swimmers
- Geometry Shifters
- Pulse Bomber
- Clone Mimic
- Spider Walker
- Mirror Knight
- Portal Mantis
- Black Hole Totem
- Conductor
- Phase Wraith

### Planned Biomes (Not Yet Implemented)
- The Stack (Brutalist architecture)
- Ocean Floor (Underwater synthwave)
- And more in the expansion plan...

---

## Key Branches for Missing Features

| Branch | Feature | Status |
|--------|---------|--------|
| `origin/issue-35-alt-weapons` | Advanced ALT weapons | Not merged to gh-pages |
| `origin/fix/89-alt-fire-tutorial` | ALT fire tutorial | Partially merged |
| `origin/feature/89-alt-fire-tutorial` | ALT fire tutorial | Partially merged |
| `origin/feature/96-merge-bosses` | All boss implementations | MERGED to gh-pages |
| `origin/feature/44-boss-architecture` | Boss framework | MERGED to gh-pages |
| `origin/feature/30-level10-bosses` | Level 10 bosses | MERGED to gh-pages |
| `origin/feature/31-level-15-bosses` | Level 15 bosses | MERGED to gh-pages |
| `origin/issue-32-level20-bosses` | Level 20 bosses | MERGED to gh-pages |

---

## Action Items

1. **Merge Advanced ALT Weapons** from `issue-35-alt-weapons` branch
   - Files: `weapons.js`, `upgrades.js`, `main.js`
   - Functions: `fireRocket`, `spawnHelperBot`, `createGravityWell`, `fireIonMortar`, `spawnHologram`

2. **Verify Cooldown System** is fully functional
   - Check `playAltWeaponReadySound` is called when cooldown completes
   - Verify visual indicators work

3. **Test All Boss Behaviors** are working
   - Some boss behaviors (hunter, dj, starfighter, etc.) may need verification

4. **Test All Biomes** are applying correctly
   - Verify theme transitions at levels 5, 6, 10, 11, 15, 16

---

## Research Completed
- Date: 2026-03-03
- Branches searched: 50+ remote branches
- Commits analyzed: 100+ commits with relevant keywords
- Files examined: `enemies.js`, `weapons.js`, `upgrades.js`, `main.js`, `scenery.js`, `environment.js`
