# Projectile Visibility + Style Fix - Summary

## Files Inspected
- `main.js` (lines 192-275, 8078-8170)

## Issues Found

### 1. Depth/Visibility Problem
**Root cause:** No `renderOrder` set on projectile InstancedMesh objects
- Projectiles had no explicit render order
- Transparent objects were fighting with scene geometry for depth priority
- Result: Projectiles would appear behind or clip through terrain

### 2. Angle-Dependent Glow
**Root cause:** Glow material used `THREE.BackSide` rendering
- Glow only visible from "inside" the glow mesh
- Looking up/down would cause glow to disappear
- Unreliable visibility at different head angles

### 3. Weak Visual Impact
**Root causes:**
- Core was warm white (0xfff6e8) instead of hot white
- Glow opacity too low (0.6)
- Falloff too gradual (0.15)
- Shader didn't emphasize hot core

## Approach Chosen

### Depth Sorting Fix
- Set `renderOrder = 950` on all core projectile meshes
- Set `renderOrder = 951` on all glow twin meshes
- Ensures projectiles render AFTER scene geometry (which uses orders -20 to 500)
- Core renders before glow for proper layering

### All-Angle Visibility
- Changed glow material from `THREE.BackSide` to `THREE.DoubleSide`
- Glow now visible from any viewing angle
- No more disappearing when looking up/down

### Enhanced Visuals
- Core color: Pure white (0xffffff) for hot center
- Glow opacity: Increased to 0.85 for visibility
- Falloff: Tightened to 0.08 for punchier effect
- Internal radius: Increased to 5.0 for stronger rim
- Shader: Added hot core blend (mix white + glow color)

## Files Changed

### main.js

**Lines 192-206:** Enhanced projectile constants
```javascript
const PROJECTILE_BOLT = {
  coreColor: 0xffffff,  // Pure white hot core
  opacity: 1.0,
};

const PROJECTILE_GLOW = {
  falloff: 0.08,  // Tighter falloff
  internalRadius: 5.0,  // Stronger rim
  opacity: 0.85,  // More visible
};
```

**Lines 220-242:** Enhanced glow shader
```glsl
// Hot white core + colored glow blend
vec3 hotCore = vec3(1.0, 1.0, 1.0);
vec3 glow = mix(hotCore, uGlowColor, 0.4) * (centerFade * 1.2 + rim * 0.6);
```

**Line 270:** DoubleSide rendering
```javascript
side: THREE.DoubleSide,  // Visible from all angles
```

**Lines 8097-8098:** Glow twin renderOrder (helper function)
```javascript
mesh.renderOrder = 951;  // Render after scene geometry
```

**Lines 8114, 8127, 8140, 8156:** Core mesh renderOrder (each weapon type)
```javascript
laserIM.renderOrder = 950;
buckIM.renderOrder = 950;
seekerIM.renderOrder = 950;
plasmaIM.renderOrder = 950;
```

## Commands Run

```bash
# Syntax validation
node -c main.js

# Automated verification
node test-projectile-visibility.js
```

## Verification Results

✓ All renderOrder assignments present
✓ DoubleSide rendering enabled
✓ Enhanced glow constants applied
✓ Pure white core color set
✓ Shader enhancement applied
✓ No syntax errors

## Manual Testing Required

1. Start server: `python3 -m http.server 8000`
2. Open browser: `http://localhost:8000`
3. Fire each weapon type
4. Verify:
   - Projectiles visible against all backgrounds
   - Glow visible from all angles (look up/down/left/right)
   - Hot white core + colored glow effect
   - No depth fighting with scene geometry

## Remaining Hand-Tuning Notes

If visibility still needs adjustment after testing:

1. **Too bright:** Reduce `PROJECTILE_GLOW.opacity` (currently 0.85)
2. **Too dim:** Increase `PROJECTILE_GLOW.opacity` or `internalRadius`
3. **Core too prominent:** Adjust shader mix ratio (currently 0.4)
4. **Glow too large:** Reduce glow geometry sizes in `initProjectilePool()`
5. **Depth issues persist:** Increase renderOrder values (try 960/961)

The architecture remains instanced for performance. All changes maintain the twin-mesh (core + glow) approach.
