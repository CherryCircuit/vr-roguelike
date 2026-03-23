# Research Report: Biomes & ALT Weapons
**Date:** 2026-03-03  
**Researcher:** DevClaw Worker  
**Project:** VR Roguelike

---

## PART 1: BIOMES

### Status: ✅ IMPLEMENTED

Biomes ARE in the current code. They're called "themes" and implemented in `scenery.js`.

### Location
- **File:** `scenery.js`
- **Functions:** `getThemeForLevel()`, `applyTheme()`, `initAmbientParticles()`, `updateAmbientParticles()`

### Current Biomes (5 Total)

1. **synthwave** (Levels 1-4)
   - Classic synthwave aesthetic
   - Magenta grid, cyan mountains
   - Default theme

2. **hellscape** (Levels 6-9)
   - Red/orange palette
   - Ember particles rising
   - Foggy atmosphere

3. **frozen** (Levels 11-14)
   - Blue/ice colors
   - Snow particles falling
   - Cold digital theme

4. **corruption** (Levels 16-19)
   - Purple/void colors
   - Swirling corruption particles
   - Dark atmosphere

5. **boss** (Levels 5, 10, 15, 20)
   - Red alert theme
   - Danger particles
   - Boss fight indicator

### Git History

**Commits:**
- `4ecabf3` - "Make hellscape particles smaller (0.05 vs 0.15)"
- `c424a33` - "Phase 6 Visual Overhaul - Neon Dreams environment"
- `d066b8c` - "Fix visual overhaul integration"

**Branches:** None found (all in main branch)

### Implementation Details

The biome system works by:
1. `getThemeForLevel(level)` returns the appropriate theme based on level number
2. `applyTheme(theme, refs)` updates:
   - Scene background and fog
   - Grid texture (redrawn with new color)
   - Mountain wireframe colors
   - Sun texture (regenerated with gradient)
   - Sun glow color
3. Ambient particles change behavior based on theme:
   - **Embers:** Rising particles (hellscape)
   - **Snow:** Falling particles (frozen)
   - **Corruption:** Swirling particles (corruption/danger)

### Missing Biomes?

❌ **No missing biomes found.** The "10-15 biomes including hellscape" mentioned in the problem statement appears to be a misunderstanding. The current system has exactly 5 themes (biomes) and hellscape IS one of them.

### Recommendation

✅ **No action needed.** Biome system is complete and working.

---

## PART 2: ALT WEAPONS

### Status: ⚠️ PARTIALLY IMPLEMENTED

ALT weapons are DEFINED but NOT FUNCTIONAL. All implementations are placeholders.

### Current ALT Weapons (6 Total)

**Location:** `weapons.js` lines 128-193

1. **shield** - Blocks enemy projectiles
   - Cooldown: 3000ms (3s)
   - Duration: 2000ms (2s)
   - Status: ❌ Not implemented

2. **grenade** - Throwable explosive
   - Cooldown: 4000ms (4s)
   - Damage: 40
   - AoE Radius: 2.0
   - Status: ❌ Not implemented

3. **mine** - Placeable explosive trap
   - Cooldown: 6000ms (6s)
   - Damage: 60
   - AoE Radius: 2.5
   - Max Active: 3
   - Status: ❌ Not implemented

4. **drone** - Auto-targeting helper
   - Cooldown: 8000ms (8s)
   - Duration: 10000ms (10s)
   - Damage: 8 per shot
   - Fire Interval: 200ms
   - Status: ❌ Not implemented

5. **emp** - Disables nearby enemies
   - Cooldown: 10000ms (10s)
   - Duration: 3000ms (3s)
   - Range: 5
   - Status: ❌ Not implemented

6. **teleport** - Instant movement
   - Cooldown: 5000ms (5s)
   - Range: 10
   - Status: ❌ Not implemented

### Firing Implementation

**Location:** `main.js` lines 1157-1248

**Code Structure:**
```javascript
function onSqueezePress(controller, index) {
  // Only fires during gameplay
  if (st === State.PLAYING) {
    fireAltWeapon(controller, index);
  }
}

function fireAltWeapon(controller, index) {
  // Checks:
  // 1. ALT weapon equipped
  // 2. Cooldown ready
  // 3. Gets controller position/direction
  
  // All implementations are TODO:
  switch (altWeaponId) {
    case 'shield':
      console.log('[ALT] Shield activated (not implemented yet)');
      break;
    // ... all others also "not implemented yet"
  }
}
```

### Upgrade System

**Location:** `upgrades.js` lines 38-41

ALT weapons ARE offered as upgrades:
```javascript
{ id: 'alt_shield', name: 'SHIELD', type: 'alt', ... }
{ id: 'alt_grenade', name: 'GRENADE', type: 'alt', ... }
{ id: 'alt_mine', name: 'MINE', type: 'alt', ... }
{ id: 'alt_drone', name: 'DRONE', type: 'alt', ... }
```

### Git History - Original ALT Weapons

**Commit:** `5f7d88a` (Feb 22, 2026)
**Title:** "feat: Add 6 ALT WEAPONS with cooldown system"

**Original 6 ALT Weapons:**
1. **Rocket Launcher** - Homing rocket, 250 damage + splash, 15s cooldown
2. **Helper Bot** - Auto-firing buddy for 15s, 30s cooldown ⭐ (This is the "turret robot")
3. **Shield** - Blocks 10 hits, 15s cooldown
4. **Gravity Well** - Pulls enemies for 4s, 25s cooldown ⭐ (This is the "gravity well grenade")
5. **Ion Mortar** - Arcing shell, 400 damage + big splash, 20s cooldown
6. **Hologram Decoy** - Distraction for 6s then explodes, 28s cooldown

**Status:** These were defined in `upgrades.js` but NEVER implemented in `weapons.js`.

### When ALT Weapons Changed

**Commit:** `f2057db` (Feb 21, 2026)
**Title:** "docs: Weapon system architecture design (#43)"

This commit created `weapons.js` with 6 NEW ALT weapons:
- shield, grenade, mine, drone, emp, teleport

**Note:** The original 6 (rocket_launcher, helper_bot, gravity_well, etc.) were only in `upgrades.js` and were replaced before being implemented.

### "Turret Robot" and "Gravity Well Grenade"

✅ **FOUND** - These were the original ALT weapon designs:

- **"Turret Robot"** = `helper_bot` (auto-firing buddy for 15s)
- **"Gravity Well Grenade"** = `gravity_well` (pulls enemies for 4s)

**Current Status:**
- ❌ Not in current code
- ❌ Never implemented
- ❌ Replaced with different ALT weapons

### Issues Found

1. **All ALT weapons are placeholders** - Every implementation just logs "not implemented yet"
2. **Original designs lost** - The turret robot and gravity well were replaced
3. **Upgrade system works** - ALT weapons ARE offered as upgrades
4. **Firing logic exists** - `onSqueezePress()` and `fireAltWeapon()` are structured correctly

### Recommendation

🔧 **Action Required:**

**Option A: Implement Current ALT Weapons**
- Keep shield, grenade, mine, drone, emp, teleport
- Implement all 6 with actual functionality
- Estimated effort: 2-3 hours per weapon = 12-18 hours total

**Option B: Restore Original ALT Weapons**
- Revert to rocket_launcher, helper_bot, gravity_well, etc.
- These may be more interesting/unique
- Still need implementation (same effort)

**Option C: Hybrid Approach**
- Keep some current (shield, grenade, mine)
- Add some original (gravity_well, helper_bot)
- Choose best 6 from both sets

---

## SUMMARY

### Biomes
- ✅ **COMPLETE** - 5 themes working in `scenery.js`
- ✅ Hellscape IS implemented (Levels 6-9)
- ✅ No missing biomes found

### ALT Weapons
- ⚠️ **DEFINED but NOT FUNCTIONAL**
- ❌ All 6 current weapons need implementation
- ❌ Original "turret robot" (helper_bot) and "gravity well" were replaced
- ✅ Firing system structure is correct
- ✅ Upgrade system includes ALT weapons

### Priority Actions

1. **Biomes:** No action needed ✅
2. **ALT Weapons:** Choose implementation approach (A/B/C) and implement 🔧
3. **Documentation:** Update design docs to reflect actual ALT weapons 📝

---

## FILES REFERENCED

- `scenery.js` - Biome/theme system
- `weapons.js` - ALT weapon definitions
- `main.js` - ALT weapon firing logic (lines 1157-1248)
- `upgrades.js` - ALT weapon upgrade cards
- `game.js` - State management for weapons

## GIT COMMITS

- `4ecabf3` - Hellscape particle fixes
- `c424a33` - Visual overhaul
- `5f7d88a` - Original 6 ALT weapons (upgrades.js only)
- `f2057db` - New 6 ALT weapons (weapons.js)
- `40d5110` - ALT weapon integration
