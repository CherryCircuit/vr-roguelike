# Visibility Pitfalls for Transparent/Additive Effects

## The Charge Beam Problem (Fixed 2026-04-02)

### Symptom
Charge beam was invisible against desert terrain foreground but visible against the sky background.

### Root Cause
The beam used **only** `THREE.AdditiveBlending` for its glow effect. Additive blending works by:
```
finalColor = sourceColor + destinationColor
```

Against dark sky (0x06080c): cyan beam is clearly visible
Against bright terrain (0x2a241b + highlights): beam color gets lost in the addition

### Fix
Add a **core beam** with `NormalBlending` alongside the additive glow:
- Core: NormalBlending, higher opacity (0.9), thinner - guarantees visibility
- Glow: AdditiveBlending, lower opacity (0.7), wider - provides neon aesthetic

```javascript
// CORE BEAM: Always visible against all backgrounds
const coreMat = new THREE.MeshBasicMaterial({
  color: beamColor,
  transparent: true,
  opacity: 0.9,
  blending: THREE.NormalBlending,  // Key: normal blending ensures visibility
});

// OUTER GLOW: Additive for neon aesthetic
const glowMat = new THREE.MeshBasicMaterial({
  color: beamColor,
  transparent: true,
  opacity: 0.7,
  blending: THREE.AdditiveBlending,  // Glow effect - alone can vanish on bright terrain
});
```

## General Rules for Beam/Projectile Visibility

### 1. Never Rely Solely on Additive Blending
Additive effects vanish against bright backgrounds. Always pair with:
- A NormalBlending core, OR
- A higher-opacity inner layer, OR
- A contrasting outline

### 2. Angle-Dependent Glow is a Trap
Fresnel/rim effects that look great from one angle can disappear when looking up/down:
- Test beam effects against ground plane at multiple head angles
- Test against sky/horizon in addition to terrain
- Validate in all biomes (desert is brightest, synthwave valley is darkest)

### 3. Depth Testing + Transparent Objects
For beams that must appear in front of terrain:
- `depthWrite: false` prevents depth buffer conflicts
- `renderOrder: 100+` ensures rendering after terrain
- But neither fixes additive blending invisibility - you still need a visible core

### 4. Validation Checklist for New Effects
Before shipping any transparent beam/projectile effect:
- [ ] Visible against desert terrain foreground
- [ ] Visible against synthwave valley floor
- [ ] Visible when looking up (sky background)
- [ ] Visible when looking down (ground background)
- [ ] Visible at multiple distances (near/far)
- [ ] No z-fighting with terrain or other objects

## Related Code Locations

- Charge beam rendering: `main.js` ~line 9162 (fireChargeBeam function)
- Explosion visual updates: `main.js` ~line 9640 (updateExplosionVisuals function)
- Desert terrain colors: `biomes/desert-night.js` (baseColor 0x2a241b, highlights)

## Future Work

Consider adding a debug mode that renders all beams/projectiles with a wireframe overlay to catch visibility issues early.
