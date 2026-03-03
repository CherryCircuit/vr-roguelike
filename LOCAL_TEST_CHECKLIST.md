# LOCAL TESTING CHECKLIST
# Run this checklist before EVERY commit to GitHub

---

## HOW TO TEST LOCALLY

### Step 1: Start Local Server
```bash
cd /home/graeme/.openclaw/workspace-codey/vr-roguelike
python3 -m http.server 8000
```

**Do not proceed until server is running.**

---

### Step 2: Open Game in Browser

**Desktop Mode:**
- Open: http://localhost:8000
- Press F12 to open console
- Check for errors on page load
- Look for "[GAME ERROR]" messages

**VR Mode (requires headset):**
- Load game in headset browser
- Open console (F12 or equivalent)
- Check for errors

---

### Step 3: Test Core Gameplay

**MUST TEST ALL:**

#### Basic Gameplay:
- [ ] Click START button works
- [ ] Movement works (WASD in desktop, controllers in VR)
- [ ] Aiming works (mouse in desktop, headset in VR)
- [ ] Shooting works (click/space in desktop, trigger in VR)
- [ ] Enemies spawn correctly
- [ ] Enemies move toward player
- [ ] Projectiles fire and hit enemies
- [ ] Enemies die when health reaches 0

#### HUD Features:
- [ ] Health hearts display correctly
- [ ] Score counter updates
- [ ] Kill counter works
- [ ] Level text shows correct level
- [ ] Upgrade cards appear between levels
- [ ] Upgrade cards show weapon stats
- [ ] Combo popups appear on multi-kills
- [ ] Slow-mo triggers on last enemy death
- [ ] Debug menu opens (click DEBUG button or press ?debug=1)

#### Performance:
- [ ] FPS is stable (>60)
- [ ] No frame drops below 45
- [ ] Loading time is acceptable

---

### Step 4: Test New Features (If Added)

**Screen Shake:**
- [ ] Screen shakes on player damage
- [ ] Screen shakes on explosions
- [ ] Shake intensity is reasonable (not nausea-inducing)

**Impact Freeze:**
- [ ] Critical hits freeze frame briefly
- [ ] White flash overlay appears
- [ ] Camera jolt is noticeable but not disorienting

**Kill Chains:**
- [ ] Killing 2nd enemy within 3 seconds shows "x2"
- [ ] Killing 3rd enemy within 3 seconds shows "x3"
- [ ] Combo multiplier caps at x5
- [ ] Combo popup animates and fades
- [ ] Combo sounds play correctly
- [ ] Combo resets after 3 seconds of no kills

**Slow-Mo Death:**
- [ ] Last enemy of wave triggers slow-mo (0.25x speed)
- [ ] Slow-mo lasts 1.5 seconds
- [ ] Death particles move in slow-mo
- [ ] Speed ramps back to normal after slow-mo

---

### Step 5: Check Console Errors

**After ALL tests, check console for:**
- [ ] No "[GAME ERROR]" messages
- [ ] No "Uncaught" exceptions
- [ ] No "ReferenceError" for undefined functions
- [ ] No "SyntaxError" for parsing issues
- [ ] No 404 errors for missing assets

**If ANY errors appear: STOP. Do NOT commit. Fix errors first.**

---

### Step 6: Verify WebGL & Audio

**WebGL:**
- [ ] Renderer initializes without errors
- [ ] Scene displays correctly
- [ ] No black/white screen of death
- [ ] VR black box is GONE (was plane geometry issue)

**Audio:**
- [ ] Music plays on menu
- [ ] Music plays during gameplay
- [ ] Sound effects play on shoot
- [ ] Sound effects play on enemy death
- [ ] Combo sounds play correctly
- [ ] No audio clipping or distortion

---

### Step 7: Full Level Runthrough

**Play ONE complete level to test:**
- [ ] Can start level
- [ ] Can move and aim
- [ ] Can kill enemies
- [ ] Level completes when all enemies dead
- [ ] Upgrade screen appears
- [ ] Can select upgrade
- [ ] Next level starts
- [ ] HUD updates correctly throughout

---

## BEFORE COMMITTING TO GITHUB

**ALL of these checkboxes MUST be checked:**
- [ ] Core gameplay works
- [ ] New features work
- [ ] No console errors
- [ ] WebGL renders correctly
- [ ] Audio works
- [ ] Full level runthrough works

**IF ANY CHECKBOX IS UNCHECKED - STOP AND FIX BEFORE COMMITTING**

---

## COMMIT REQUIREMENTS

Before pushing to GitHub, update version in index.html:

```html
<p style="font-size: 0.7em; opacity: 0.4; margin-top: 12px;">ver. YYYY/MM/DD/HH:MM - Full local test passed</p>
```

Commit format:
```bash
git add -A
git commit -m "test: Full local test passed - all features verified

Tested:
- Game loads without errors
- Core gameplay works (movement, aiming, shooting, enemies, death)
- New features tested (screen shake, impact freeze, kill chains, slow-mo)
- WebGL renders correctly
- Audio works
- Full level runthrough completed"
git push origin gh-pages
```

---

## CRITICAL RULE

**NEVER COMMIT WITHOUT RUNNING THIS CHECKLIST FIRST.**

If browser control service is down, use a workaround:
- View game via file:// protocol in VSCode
- Or wait for service to come back up

**NO MORE UNTETED DEPLOYS.**

---

Created: 2026-03-02
For: Local testing infrastructure
Purpose: Ensure every commit is fully tested before pushing
