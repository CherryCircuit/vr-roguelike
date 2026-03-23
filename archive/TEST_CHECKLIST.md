# Boss System Refactor - Testing Checklist

## Manual Testing Steps

### Basic Functionality
1. [ ] Start game from title screen
2. [ ] Progress to level 5 (first boss level)
3. [ ] Verify boss spawns correctly
4. [ ] Verify boss health bar appears (3 segments)
5. [ ] Verify boss takes damage and health bar updates
6. [ ] Verify boss defeat triggers level complete

### Boss Mechanics (Teleporting Boss)
7. [ ] Verify boss teleports to random positions
8. [ ] Verify boss charges at player
9. [ ] Verify player can dodge charge attacks
10. [ ] Verify boss shows telegraphing visual warning
11. [ ] Verify boss plays teleport reappearance sound
12. [ ] Verify boss plays explosion sound on charge
13. [ ] Verify boss becomes stunned when hit during charge
14. [ ] Verify stun duration is reasonable (2 seconds)
15. [ ] Verify boss resumes normal behavior after stun

### Phase Transitions
16. [ ] Verify phase changes at 66% health
17. [ ] Verify phase changes at 33% health
18. [ ] Verify boss becomes faster in phase 2
19. [ ] Verify boss teleports more aggressively in phase 3
20. [ ] Verify boss health bar shows 3 segments for all phases

### Weak Points
21. [ ] Verify weak points exist on boss (visual indicator)
22. [ ] Verify weak points deal double damage
23. [ ] Verify normal body hits deal normal damage

### Minions (Future Enhancement)
24. [ ] Verify no minions spawn by default (framework in place)
25. [ ] Verify spawnMinion() function works (if called manually)

### Projectiles (Future Enhancement)
26. [ ] Verify no projectiles fire by default (framework in place)
27. [ ] Verify spawnBossProjectile() function works (if called manually)

### Performance
28. [ ] Verify frame rate stays above 30 FPS during boss fight
29. [ ] Verify telegraphing effects cleanup properly
30. [ ] Verify boss health bar doesn't flicker
31. [ ] Verify no memory leaks over multiple boss fights

### Edge Cases
32. [ ] Verify boss defeat when player has full health
33. [ ] Verify boss defeat when player has no health
34. [ ] Verify boss defeat when player hits weak point
35. [ ] Verify teleporting boss teleports correctly at all phases
36. [ ] Verify boss doesn't teleport when stunned

### Audio
37. [ ] Verify teleport reappearance sound plays
38. [ ] Verify teleport disappear sound plays
39. [ ] Verify explosion sound plays on charge
40. [ ] Verify boss stunned sound plays
41. [ ] Verify boss death sound plays

## Integration Testing

42. [ ] Verify boss spawn doesn't break normal enemy spawning
43. [ ] Verify boss death properly cleans up all resources
44. [ ] Verify level completion sequence works with boss defeat
45. [ ] Verify upgrade screen shows after boss defeat
46. [ ] Verify score is added when boss is defeated

## Regression Testing

47. [ ] Verify normal enemy spawning still works (levels 1-4)
48. [ ] Verify enemy types (basic, fast, tank, swarm) still work
49. [ ] Verify enemy collision detection still works
50. [ ] Verify status effects still apply to enemies

## Browser Compatibility

51. [ ] Test in Chrome
52. [ ] Test in Firefox
53. [ ] Test in Safari (if available)
54. [ ] Test in Quest browser (if testing on VR)

## Debugging

55. [ ] Check browser console for errors
56. [ ] Verify no TypeScript errors (if using TS)
57. [ ] Verify no console warnings about undefined functions
58. [ ] Verify performance monitor shows stable FPS

## Expected Results

- Boss should appear at level 5, 10, 15, 20
- Boss should have 3 health phases
- Boss should show telegraphing warnings
- Boss should teleport randomly during fight
- Boss should charge at player with explosion
- Boss should stun when hit during charge
- Boss defeat should trigger level complete
- No old boss types should spawn
- Game performance should remain stable

## Known Limitations

1. Telegraphing system is not fully integrated into main attack patterns
2. Additional boss types (turret, spawner, charger) removed but framework exists for them
3. Minion spawning is in place but not called by default
4. Projectile firing is in place but not called by default

## Testing Notes

- Test each boss level (5, 10, 15, 20) multiple times
- Test weak point hitting multiple times
- Test dodging all charge directions
- Test playing with full health and low health
- Test at different difficulty levels
