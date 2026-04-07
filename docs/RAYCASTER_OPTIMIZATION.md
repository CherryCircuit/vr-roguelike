# UI Hover Raycaster Pooling Optimization

## What Raycaster Allocations Were Found

### Hot Path (Fixed)
**Line 9680** (now ~9693 after edits): Unified UI hover detection in render loop
- Created new `THREE.Raycaster()` per controller per frame
- Created new `THREE.Vector3()` for origin per controller per frame
- Created new `THREE.Quaternion()` for rotation per controller per frame
- Created new `THREE.Vector3()` for direction per controller per frame
- **Impact**: At 60fps with 2 controllers = 480 allocations/second
- **States affected**: TITLE, UPGRADE_SELECT, SCOREBOARD, REGIONAL_SCORES, COUNTRY_SELECT, READY_SCREEN, NAME_ENTRY

### Event Handlers (Not Changed)
**Lines 2590, 2920, 2968, 3001, 3129**: Event handler allocations
- These are in trigger press handlers (not called every frame)
- Low frequency (user-triggered, maybe 1-2 per second max)
- Not worth optimizing for this task

## What Was Changed

### 1. Added Pooled Objects (main.js lines 273-279)
```javascript
// Pooled UI hover raycasters for controller/desktop hover detection
// Avoids creating new Raycaster/Vector3/Quaternion every frame in menu states
const _uiHoverRaycasters = [new THREE.Raycaster(), new THREE.Raycaster()];
const _uiHoverOrigins = [new THREE.Vector3(), new THREE.Vector3()];
const _uiHoverQuats = [new THREE.Quaternion(), new THREE.Quaternion()];
const _uiHoverDirs = [new THREE.Vector3(), new THREE.Vector3()];
```

### 2. Modified Hot Path (main.js lines 9673-9710)
**Before** (allocating every frame):
```javascript
const raycasters = [];
for (let i = 0; i < controllers.length; i++) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  raycasters.push(new THREE.Raycaster(origin, dir, 0, 10));
}
```

**After** (reusing pooled objects):
```javascript
const raycasters = [];
for (let i = 0; i < controllers.length; i++) {
  const origin = _uiHoverOrigins[i];
  const quat = _uiHoverQuats[i];
  const dir = _uiHoverDirs[i];
  ctrl.getWorldPosition(origin);
  ctrl.getWorldQuaternion(quat);
  dir.set(0, 0, -1).applyQuaternion(quat);
  const rc = _uiHoverRaycasters[i];
  rc.set(origin, dir, 0, 10);
  raycasters.push(rc);
}
```

## Files Changed
- `main.js` (2 sections modified, ~15 lines total)

## Exact QA Steps Run
1. Syntax check: `node -c main.js` ✓
2. Started localhost server: `python3 -m http.server 8000` ✓
3. Verified server responds: `curl http://localhost:8000/index.html` (HTTP 200) ✓
4. Ran Puppeteer test: `node test-game.mjs` ✓
   - **0 page errors**
   - Game initialized successfully
   - All console messages normal (initialization logs only)
   - Desktop mode enabled correctly
   - Game started from title screen

## Performance Impact
- **Before**: 480 object allocations/second (2 controllers × 4 objects × 60fps)
- **After**: 0 allocations/second (pooled objects reused)
- **GC Pressure**: Eliminated in UI hover hot path
- **Affected scenarios**:
  - Title screen navigation
  - Upgrade selection menu
  - Scoreboard browsing
  - Regional scores navigation
  - Country selection
  - **Scoreboard keyboard name entry** (specifically mentioned as performance pain point)

## Final Status: PASS ✓

## Handoff Note: Safe to Queue Next Worker
✅ **YES** - Safe to queue the next worker for hot-path temp Vector3 reuse

**Rationale**:
- This optimization was conservative and focused only on UI hover raycasters
- Zero impact on gameplay systems (weapons, enemies, projectiles)
- Behavior preserved exactly (same raycast calculations, just reused objects)
- QA passed with 0 errors
- Pattern established: pooled objects at module level, reuse in render loop

**Recommended next hot-path targets** (if continuing optimization):
1. Desktop aim raycaster in desktop-controls.js (if called every frame)
2. Temporary vectors in projectile update loops (already partially optimized with _proj* objects)
3. Enemy spawn/update loops (check for temp vector allocations)

**NOT recommended for next worker**:
- Gameplay raycasters (weapon systems, enemy AI) - higher risk, needs careful testing
- Event handler allocations - low frequency, minimal impact
