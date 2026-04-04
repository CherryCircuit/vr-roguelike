# GEO Leak Hunt - 2026-04-03/04

## Session Progress

### Fixes Applied
1. **Popup pooling** (TextPopupPool): 35 reusable meshes instead of ~5/kill
2. **disposeGroupChildren()**: Applied to all screen transitions (19 locations)
3. **Hitbox geometry disposal**: Fixed both `destroyEnemy()` and `clearAllEnemies()` to dispose ALL mesh children, not just `isMergedGeometry`
4. **Instanced enemy hitbox leak**: The traverse skipped instanced enemies entirely ("geometry lives in pool"), but hitbox geometry (BoxGeometry + MeshBasicMaterial) was per-enemy and never disposed. Fixed to always dispose hitboxes regardless of instance status.
5. **HUD text caching**: `updateSpriteText()` now caches by text+opts key, skips when unchanged

### Results
| Metric | Start | After all fixes |
|--------|-------|----------------|
| Total GEO (9 levels) | 1197 | 622 |
| L1 delta | +22 | +7 |
| L9 delta | +241 | +135 |
| Frame spikes | 148 | 6 |
| Clean reset | YES | YES |

**48% reduction total.** GEO still grows ~2.3/kill at higher levels.

### Remaining GEO Sources (~622 after 9 levels)
1. `updateSpriteText()` creates new PlaneGeometry when score/kill text changes (unavoidable without cached geometry pool for variable-width text)
2. Upgrade card geometry (disposed properly but contributes during level)
3. Per-enemy hitbox geometry (now disposed on kill, but accumulates while enemies alive)

### Key Insight: Enemy Types
- **Instanced (levels 1-9):** basic, fast, tank, swarm - all use InstancedMesh pools
- **NOT instanced (level 11+):** jelly, spiral_swimmer, conductor, mirror_knight, phase_wraith
- dream_slime, dream_eye exist in ENEMY_DEFS but never appear in spawn pools

### Next Steps
1. **Extend instancing to level 11+ enemy types** for extended play sessions
2. **Pool HUD text geometry** - cache PlaneGeometry by aspect ratio bins
3. **Pool hitbox geometry** - share a few BoxGeometry sizes across enemies

### Files Modified
- `enemies.js`: destroyEnemy(), clearAllEnemies() dispose fixes
- `hud.js`: TextPopupPool class, disposeGroupChildren(), updateSpriteText() caching
- `main.js`: Registered cleanup hooks, completeLevel() cleanup calls
