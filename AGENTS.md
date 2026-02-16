# AGENTS.md

Guidelines for automated coder bots working on Synthwave VR Blaster.

## 1. STICK TO THE PLAN

- **Read the instruction set completely** before writing any code
- **Follow the steps in order** - don't skip ahead or reorder tasks
- **Complete one feature at a time** - don't start implementing feature B while feature A is half-done
- **Don't add extra features** - if the instruction says "add FPS monitor", don't also add a memory monitor or refactor unrelated code
- **Mark tasks as done** only when they actually work, not when you think they might work

## 2. DON'T GET HUNG UP ON LOOPING

If you encounter an error or bug:

- **Try a different approach after 2 failed attempts** - don't keep retrying the exact same code
- **Don't loop on the same error** - if you get the same error 3 times, STOP and try a completely different solution
- **Recognize when you're stuck** - if you've spent more than 5 iterations on the same issue, it's time to research or ask for help
- **Avoid infinite retry loops** - don't implement retry logic without max attempts and exponential backoff

Common loop traps:
- Trying to fix a syntax error with the same syntax
- Retrying failed API calls without changing the request
- Re-reading the same file hoping it changed
- Debugging the same function without adding console logs

## 3. COMMENT YOUR CODE THOROUGHLY

Every code change should include comments for debugging:

```javascript
// ✅ GOOD: Explains WHY, not just what
// Fix for Issue #47: Lightning weapon wasn't filtering dead enemies
// causing null reference errors in damage calculation
const aliveEnemies = enemies.filter(e => e.health > 0);

// ❌ BAD: States the obvious
// Filter enemies
const aliveEnemies = enemies.filter(e => e.health > 0);
```

**Comment requirements:**
- **Function headers**: What it does, params, return value
- **Complex logic**: Why you chose this approach
- **Bug fixes**: Reference the issue number and root cause
- **Temporary code**: Mark with `// TODO:` or `// FIXME:`
- **Performance-critical sections**: Note why optimization matters
- **Magic numbers**: Explain why `0.25` or `72` or `5000`

**Special comments for VR code:**
```javascript
// VR-CRITICAL: This runs every frame at 72fps - keep it fast
// WebXR: Controller input only available in VR session
// Pool: Reusing objects to avoid GC pauses in VR
// Perf: Merged geometries to reduce draw calls from 500 to 50
```

## 4. SEARCH ONLINE RESOURCES FIRST

Before implementing any feature:

1. **Search for existing solutions**: Google, MDN, Three.js docs, Stack Overflow
2. **Find 2-3 examples** of similar implementations
3. **Understand the pattern** before copying code
4. **Adapt, don't copy-paste** - this project has specific requirements

**Resources for this project:**
- Three.js docs: https://threejs.org/docs/
- WebXR API: https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- Supabase JS client: https://supabase.com/docs/reference/javascript/introduction
- Three.js examples: https://threejs.org/examples/

**Example search workflow:**
```
Task: "Add Stats.js FPS monitor to WebXR scene"

1. Search: "three.js stats fps monitor webxr"
2. Find: Official example at https://threejs.org/examples/webxr_vr_sandbox.html
3. Read: How they initialize Stats and update it in render loop
4. Adapt: Our render loop is in main.js:animate(), add stats.update() there
5. Test: Verify FPS counter shows in VR headset, not just desktop
```

## 5. TEST INCREMENTALLY

- **Don't write 500 lines before testing** - test every 50-100 lines
- **Use console.log liberally** during development (remove before commit)
- **Test in the actual environment** - if it's VR code, test in VR headset
- **Verify edge cases**: What if health = 0? What if array is empty? What if user spam-clicks?

**Testing checklist for VR features:**
```
[ ] Works in desktop browser preview
[ ] Works in Meta Quest Browser
[ ] Doesn't cause frame drops (stays above 60fps)
[ ] Handles controller disconnection gracefully
[ ] Doesn't break when user exits/re-enters VR
[ ] Survives rapid state transitions (title → playing → game over)
```

## 6. UNDERSTAND THE ARCHITECTURE BEFORE CHANGING IT

Read these files first:
- **`game.js`**: Central state machine and data
- **`main.js`**: Game loop and Three.js scene
- **`CLAUDE.md`**: Project architecture and patterns

**Key patterns in this codebase:**

**Object Pooling:**
```javascript
// Pre-allocate objects, toggle visibility instead of create/destroy
const pool = Array.from({ length: 50 }, () => new THREE.Sprite());
pool.forEach(s => s.visible = false);

// To use: find invisible one, configure it, set visible = true
const sprite = pool.find(s => !s.visible);
sprite.position.copy(target);
sprite.visible = true;
```

**State Machine:**
```javascript
// Don't bypass the state machine - always use game.state
if (game.state === State.PLAYING) {
  // spawn enemies, update projectiles, etc.
}

// Transition states properly
game.state = State.LEVEL_COMPLETE;
game.stateTimer = 0; // Reset timer for next state
```

**Per-Hand Tracking:**
```javascript
// Weapons are per-hand, not global
game.upgrades.left = { buckshot: 2, damage: 5 };
game.upgrades.right = { lightning: 1, range: 3 };

// Always specify which hand when calling weapon functions
const stats = getWeaponStats(game.upgrades.left);
```

## 7. PERFORMANCE MATTERS IN VR

**Never do these in the render loop:**
- Create new objects (`new THREE.Mesh()`)
- Parse JSON or strings
- Search the entire scene graph
- Run expensive calculations on every frame

**Always do these instead:**
- Reuse pooled objects
- Cache calculations
- Update only visible/active objects
- Stagger updates across frames (`frameCount % 10 === 0`)

**Example - BAD:**
```javascript
function animate() {
  // BAD: Creating 100 new objects every frame (7200/second at 72fps!)
  for (let i = 0; i < 100; i++) {
    const particle = new THREE.Sprite(particleMaterial);
    scene.add(particle);
  }
}
```

**Example - GOOD:**
```javascript
const particlePool = Array.from({ length: 100 }, () => new THREE.Sprite(particleMaterial));
particlePool.forEach(p => { p.visible = false; scene.add(p); });

function animate() {
  // GOOD: Reusing pre-allocated objects
  const particle = particlePool.find(p => !p.visible);
  if (particle) {
    particle.position.set(x, y, z);
    particle.visible = true;
  }
}
```

## 8. HANDLE ERRORS GRACEFULLY

- **Don't crash the game** - wrap risky code in try/catch for VR (user can't see console)
- **Fail silently in production** - log errors but keep rendering
- **Validate inputs** - check for null/undefined before using

```javascript
// Wrap risky operations
try {
  const stats = getWeaponStats(game.upgrades[hand]);
  fireLaser(controller, stats);
} catch (err) {
  console.error('Weapon fire failed:', err);
  // Fall back to basic shot instead of crashing
  fireBasicShot(controller);
}

// Validate before using
if (!enemy || !enemy.mesh || enemy.health <= 0) {
  return; // Skip dead/invalid enemies
}
```

## 9. GIT COMMIT HYGIENE

- **Commit working code** - don't commit broken/untested code
- **One feature per commit** - "Add FPS monitor", not "Add FPS monitor and fix 3 bugs and refactor enemies"
- **Write descriptive messages**:
  - ✅ "Fix buckshot upgrade filtering bug - only offer when player has buckshot"
  - ❌ "fix bug"
- **Test before committing** - run the game and verify the feature works

## 10. DEBUGGING CHECKLIST

When something doesn't work:

1. **Check the console** - read the actual error message
2. **Add console.logs** - trace the execution path
3. **Verify assumptions** - is the object actually what you think it is?
4. **Check state** - is `game.state` what you expect?
5. **Isolate the problem** - comment out code until it works, then add back
6. **Read the stack trace** - which line actually threw the error?
7. **Check for typos** - `game.heath` vs `game.health`, `contorller` vs `controller`
8. **Verify scope** - is the variable accessible here?

**Common VR bugs:**
- Code runs on desktop but not in VR → probably accessing `renderer.xr` before session starts
- Works first time but not after level restart → forgot to reset state in `resetGame()`
- FPS drops over time → memory leak, probably creating objects in loop without cleanup
- Controller input doesn't work → reading controller index wrong or session not active

## 11. WHEN TO ASK FOR HELP

Ask for clarification when:
- The instruction is ambiguous or contradictory
- You need access to external resources (API keys, assets)
- The requested feature fundamentally conflicts with existing code
- You've tried 3 different approaches and all failed

**Don't ask for help when:**
- You haven't searched online yet
- You haven't read the error message
- You haven't tried debugging with console.log
- You could figure it out by reading the existing code

## 12. PROJECT-SPECIFIC RULES

**This is a WebXR VR game - special considerations:**

1. **No build step** - don't add webpack, babel, etc. Uses browser ES6 modules.
2. **No external assets** - all audio is Web Audio API, all visuals are procedural
3. **No npm packages** - everything loads from CDN (Three.js, Supabase)
4. **VR performance is critical** - 60fps minimum, 72fps target
5. **Test in VR** - desktop preview doesn't catch VR-specific bugs
6. **Controllers are first-class** - mouse/keyboard are debug features only

**File modification rules:**
- **main.js** - render loop and scene setup (touch carefully, it's complex)
- **game.js** - state machine (follow existing patterns)
- **enemies.js** - pooling patterns (reuse the pool pattern)
- **upgrades.js** - pure functions only (no side effects)
- **hud.js** - sprite-based UI (use existing createTextSprite pattern)
- **audio.js** - procedural Web Audio (no external files)

## 13. QUALITY CHECKLIST BEFORE MARKING DONE

Before you say a task is complete:

- [ ] Code runs without errors
- [ ] Feature works as specified in instruction
- [ ] Code is commented (especially complex logic)
- [ ] No performance regression (test with FPS monitor)
- [ ] Doesn't break existing features (play a full level)
- [ ] Handles edge cases (null checks, empty arrays, zero values)
- [ ] Follows existing code style (see similar functions)
- [ ] Git commit message is descriptive
- [ ] Tested in VR headset (not just desktop preview)

## 14. ANTI-PATTERNS TO AVOID

**Don't do these:**

```javascript
// ❌ DON'T: Modify state in getters
function getWeaponStats(upgrades) {
  game.score += 100; // NO! Getters shouldn't have side effects
  return { damage: 10 };
}

// ❌ DON'T: Ignore errors silently
try {
  dangerousOperation();
} catch (err) {
  // Empty catch - now you'll never know what broke
}

// ❌ DON'T: Use magic numbers without comments
setTimeout(doSomething, 5000); // Why 5000? What is this timing?

// ❌ DON'T: Create objects in render loop
function animate() {
  const mesh = new THREE.Mesh(geo, mat); // Happening 72 times per second!
}

// ❌ DON'T: Mutate function arguments
function updateEnemy(enemy) {
  enemy.position.x += 1; // OK if intentional
  enemy = null; // Doesn't affect caller, probably a bug
}

// ❌ DON'T: Assume things exist
controller.userData.weapon.fire(); // What if weapon is undefined?
```

**Do these instead:**

```javascript
// ✅ DO: Keep getters pure
function getWeaponStats(upgrades) {
  return { damage: 10 + (upgrades.damage || 0) };
}

// ✅ DO: Log errors for debugging
try {
  dangerousOperation();
} catch (err) {
  console.error('Operation failed:', err);
  fallbackBehavior();
}

// ✅ DO: Use named constants
const LEVEL_COMPLETE_DURATION_MS = 5000; // 5 second slow-mo finale
setTimeout(doSomething, LEVEL_COMPLETE_DURATION_MS);

// ✅ DO: Reuse pooled objects
const mesh = meshPool.find(m => !m.visible);
if (mesh) {
  mesh.visible = true;
  mesh.position.set(x, y, z);
}

// ✅ DO: Validate before using
if (enemy && enemy.position) {
  enemy.position.x += 1;
}

// ✅ DO: Check existence
if (controller?.userData?.weapon?.fire) {
  controller.userData.weapon.fire();
}
```

## 15. FINAL REMINDER

**You are building a VR game that people play in headsets.**

- Every frame drop causes motion sickness
- Every crash kicks them out of VR (losing their progress)
- Console errors are invisible in VR
- Performance > polish
- Working > perfect

**When in doubt:**
1. Search for examples
2. Test incrementally
3. Comment your code
4. Ask for clarification

**Your goal:** Ship working features, not perfect code.

---

*Updated: 2026-02-15*
