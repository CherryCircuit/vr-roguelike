# VR Roguelike - Merged Features Testing Checklist

**Branch:** `openclaw-feb26`
**Deployed at:** https://cherrycircuit.github.io/vr-roguelike/

---

## 🎮 WEAPONS SYSTEM

### Main Weapons (6 types)
- [ ] Test all 6 main weapon types exist
- [ ] Test weapon switching works
- [ ] Test weapon-specific upgrades appear
- [ ] Test weapon projectiles fire correctly

**Weapons:**
- Plasma
- Seeker
- (4 more types)

### Alternate Weapons (6 types)
- [ ] Test all 6 alt weapon types exist
- [ ] Test cooldown indicators display
- [ ] Test "ready" sound when cooldown completes
- [ ] Test star drops and projectile types
- [ ] Test cooldown timers work correctly

### Charge Shot System
- [ ] Hold trigger to charge weapon
- [ ] Visual feedback while charging (glow/effect)
- [ ] Audio feedback while charging
- [ ] Charged shot does more damage
- [ ] Release trigger fires charged shot

### Weapon Upgrades
- [ ] Weapon-specific upgrades appear for current weapon
- [ ] Buckshot upgrades only appear if you have buckshot
- [ ] Upgrades actually modify weapon behavior

---

## 💪 UPGRADES SYSTEM

### Universal Upgrades (6 types)
- [ ] Test all 6 universal upgrades exist
- [ ] Test upgrades apply correctly
- [ ] Test upgrade stacking works

### Global Upgrades (RARE/EPIC/ULTRA/LEGENDARY)
- [ ] Test RARE upgrades appear and work
- [ ] Test EPIC upgrades appear and work
- [ ] Test ULTRA upgrades appear and work
- [ ] Test LEGENDARY upgrades appear and work
- [ ] Test tier system works correctly

### Boss-Specific Upgrades
- [ ] Test boss-specific special upgrades appear
- [ ] Test RARE boss upgrades
- [ ] Test EPIC boss upgrades
- [ ] Test ULTRA boss upgrades

---

## 👾 BOSSES

### Level 10 Bosses (5 types)
- [ ] Test all 5 Level 10 bosses spawn
- [ ] Test boss health bars display
- [ ] Test boss special attacks
- [ ] Test boss death effects
- [ ] Test boss death sound

**Boss types to test:**
1. [ ] Boss 1
2. [ ] Boss 2
3. [ ] Boss 3
4. [ ] Boss 4
5. [ ] Boss 5

### Level 15 Bosses (5 types - TOUGH)
- [ ] Test all 5 Level 15 bosses spawn
- [ ] Test they're harder than Level 10
- [ ] Test boss mechanics work

**Boss types to test:**
1. [ ] TOUGH Boss 1
2. [ ] TOUGH Boss 2
3. [ ] TOUGH Boss 3
4. [ ] TOUGH Boss 4
5. [ ] TOUGH Boss 5

### Boss Framework
- [ ] Test boss spawning system
- [ ] Test boss telegraphing (visual warnings)
- [ ] Test boss health bars
- [ ] Test boss death animations

---

## 🎵 AUDIO SYSTEM

### Sound Effects
- [ ] Test weapon fire sounds
- [ ] Test enemy spawn sounds (basic, fast, swarm, tank)
- [ ] Test boss spawn sound
- [ ] Test hit/damage sounds
- [ ] Test explosion sounds
- [ ] Test upgrade pickup sound
- [ ] Test menu click/hover sounds
- [ ] Test error sound

### Music System
- [ ] Test menu music plays
- [ ] Test music starts on VR session start
- [ ] Test audio context resumes properly
- [ ] Test music doesn't restart for same category
- [ ] Test boss death music/sound
- [ ] Test music fade out

### Special Audio
- [ ] Test charge shot charging sound
- [ ] Test charge shot fire sound
- [ ] Test alt weapon ready sound
- [ ] Test slow-mo sound effects
- [ ] Test proximity alerts
- [ ] Test kills alert sound
- [ ] Test low health alert
- [ ] Test vampire heal sound

---

## 🖥️ HUD SYSTEM

### Title Screen
- [ ] Test title screen displays
- [ ] Test "pull trigger to start" works
- [ ] Test scoreboard button works
- [ ] Test diagnostics button works

### In-Game HUD
- [ ] Test health hearts display
- [ ] Test score display
- [ ] Test level indicator
- [ ] Test combo multiplier
- [ ] Test damage numbers spawn
- [ ] Test hit flash effect

### Level-Up Screen
- [ ] Test upgrade cards appear
- [ ] Test 3 upgrade choices display
- [ ] Test can select upgrades with controller
- [ ] Test health/score on level-up floor HUD
- [ ] Test HUD shows during UPGRADE_SELECT state

### Alerts
- [ ] Test kills remaining alert
- [ ] Test alert positioning
- [ ] Test alert sound
- [ ] Test low health alert
- [ ] Test vampire heal alert

### Boss Health Bar
- [ ] Test boss health bar appears
- [ ] Test health bar updates correctly
- [ ] Test health bar hides on boss death

---

## 🎯 CONTROLS

### VR Controls
- [ ] Test controller tracking
- [ ] Test trigger shooting
- [ ] Test weapon switching gesture
- [ ] Test upgrade selection with pointer

### Desktop Controls (non-VR)
- [ ] Test keyboard/mouse mode activates when no VR
- [ ] Test mouse look works
- [ ] Test WASD movement (if implemented)
- [ ] Test click to shoot
- [ ] Test pointer lock
- [ ] Test ESC to unlock pointer

---

## 🌟 VISUAL EFFECTS

### Environment
- [ ] Test aurora borealis skydome (if enabled)
- [ ] Test stars display
- [ ] Test sun/moon
- [ ] Test mountains
- [ ] Test ominous horizon (if enabled)

### Enemy Effects
- [ ] Test tank enemy weak point indicator
- [ ] Test enemy hit effects
- [ ] Test explosion visuals

### Level Transition
- [ ] Test level intro sequence
- [ ] Test level complete screen
- [ ] Test fade transitions

---

## 🏆 SCOREBOARD SYSTEM

### Local Scoreboard
- [ ] Test score submission
- [ ] Test name entry
- [ ] Test country selection
- [ ] Test local storage persistence

### Global Scoreboard
- [ ] Test Supabase connection
- [ ] Test global scores display
- [ ] Test country filtering
- [ ] Test continent filtering
- [ ] Test scroll functionality

---

## 🐛 KNOWN ISSUES TO CHECK

### From Previous Testing
- [ ] Check if "updateHUDHover is not defined" error appears
- [ ] Check if duplicate function errors appear
- [ ] Check if black void/flickering occurs
- [ ] Check if WebGL context errors appear

### Desktop Mode
- [ ] Check if pointer lock error appears
- [ ] Check if game still playable without VR

---

## 📝 TESTING NOTES

**Test Date:** _______________
**Tester:** _______________
**Device:** Quest 3 / Desktop

**Issues Found:**
1. 
2. 
3. 

**Working Features:**
1. 
2. 
3. 

**Overall Status:** ⬜ PASS / ⬜ FAIL

---

## 🔧 QUICK REFERENCE

**Live URL:** https://cherrycircuit.github.io/vr-roguelike/
**Branch:** openclaw-feb26
**Last Deployed:** 2026-02-26 18:46 PST

**To report issues:**
Include browser console logs, screenshots, and steps to reproduce.
