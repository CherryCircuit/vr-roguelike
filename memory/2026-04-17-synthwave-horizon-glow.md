# Synthwave Horizon Glow - Implementation Notes

## Horizon Glow Cylinder
- Radius 1155 (7 units inside mountain wrap at 1162)
- Canvas-baked gradient: transparent top → cyan → white-cyan core at bottom
- Additive blending, open cylinder, BackSide
- Position Y=16, scale Y=0.3, renderOrder=0

## Known Issue: renderOrder 0 + Looking Down
When renderOrder is 0 (same as mountains), the glow cylinder renders behind upgrade cards and UI elements correctly. However, looking down in VR causes the cylinder to disappear because the player's head goes below the cylinder's bottom edge.

**Potential fixes to explore:**
1. Make the cylinder taller but keep the gradient concentrated at the bottom (so visually it's the same height but the mesh extends lower)
2. Use two cylinders: the main visible one at renderOrder 1, plus a second larger one at renderOrder 0 that only covers the lower hemisphere
3. Adjust the cylinder to be a full ring (not open-ended) so it's visible from below
4. Set the cylinder's bottom edge below the player's minimum head height (e.g., y=-2 for floor level)
5. Use `side: THREE.DoubleSide` so it renders from both inside and outside

## Floor Glow Bleed (Shader)
- `1 - exp(-max(0, -(z+100)) * 0.005)` ramp from zero near player to ~1.0 at far edges
- Height-masked to avoid tinting mountains
- Color: bright white-cyan (0.7, 1.0, 1.0) at 55% intensity

## Sun Floor Reflection (Shader)
- `uSunGroundPos` uniform at (0, -1700) matching sun group position
- `exp(-dist * 0.0006)` falloff, height-masked, orange tint
- Applied before fog so atmosphere naturally attenuates at distance
