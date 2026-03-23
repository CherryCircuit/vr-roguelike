# Performance Monitoring & Object Pooling Implementation

## Overview

This implementation adds automated performance monitoring and object pooling to the VR roguelike game to improve performance and provide better testing workflow.

## Files Created

### 1. performance.js
- **PerformanceMonitor class**: Tracks FPS, frame times, and object counts
- **Features**:
  - Real-time FPS monitoring with history
  - Percentile calculations (5th, 95th)
  - Performance degradation detection
  - Console logging every 5 seconds
  - LocalStorage export/import
  - Object count tracking

### 2. object-pool.js
- **ObjectPool class**: Generic pool for reusable objects
- **MeshPool**: Specialized pool for Three.js meshes
- **ProjectilePool**: Specialized pool for projectiles
  - Pre-allocates 100 projectile meshes
  - Handles spawning/despawning with scene management
- **ExplosionPool**: Specialized pool for explosion effects
  - Pre-allocates 30 explosion meshes
  - Automatic animation updates
- **Features**:
  - Reuse statistics (created vs reused)
  - Peak usage tracking
  - Utilization percentage
  - Pool statistics logging

### 3. test-tracker.js
- **TestTracker class**: Simple JSON-based manual testing workflow
- **Features**:
  - Session management (start/end)
  - Step tracking with pass/fail status
  - Performance metrics recording
  - Issue reporting with severity levels
  - Note-taking
  - LocalStorage persistence
  - Summary generation
  - Console logging

### 4. test-tracking.json
- Initial structure for test tracking data

## Integration

### Main.js Changes
- Added imports for all three new modules
- Ready for integration into game loop

## Usage

### Performance Monitoring

```javascript
// Start monitoring
perfMonitor.start();

// In game loop
perfMonitor.recordFrame(frameTimeMs);

// Update object counts
perfMonitor.updateObjectCounts({
  projectiles: projectiles.length,
  enemies: getEnemyCount(),
  explosions: explosionVisuals.length,
  particles: 0,
});

// Get metrics
const metrics = perfMonitor.toJSON();

// Stop monitoring
perfMonitor.stop();
```

### Object Pooling

```javascript
// Initialize pools (call once in init)
initPools(scene);

// Spawn projectile
const proj = projectilePool.spawn(origin, direction, controllerIndex, stats, color);

// Despawn projectile
projectilePool.despawn(proj);

// Get pool counts
const counts = getPoolCounts();

// Log statistics
logAllPoolStats();
```

### Test Tracking

```javascript
// Start test session
testTracker.startSession('Desktop Controls', 'Testing keyboard/mouse input');

// Add test steps
testTracker.addStep('Press W key', 'Move forward', 'Player moved forward', true);

// Record performance
testTracker.recordPerformance(fps, objectCount);

// Report issue
testTracker.reportIssue('Pointer lock fails in Firefox', 'medium');

// End session
testTracker.endSession('completed');

// Get summary
const summary = testTracker.getSessionSummary(sessionId);

// Access via console
window.testTracker.startSession('Feature Name');
```

## Benefits

### Performance
- **Reduced GC pressure**: Objects are reused instead of created/destroyed
- **Consistent frame times**: Pre-allocated pools avoid allocation spikes
- **Better monitoring**: Real-time FPS and object count tracking
- **Performance insights**: Identify degradation and bottlenecks

### Development Workflow
- **Simple tracking**: JSON-based instead of complex label system
- **Manual testing**: Faster iteration without sub-agent spawning
- **Persistent sessions**: Test data saved to localStorage
- **Easy access**: Console API for quick testing

### Object Pooling Benefits
- **100 projectiles** pre-allocated (reduced creation overhead)
- **30 explosions** pre-allocated (smoother combat)
- **Statistics**: Track reuse rates and pool efficiency
- **Automatic cleanup**: Built-in lifecycle management

## Next Steps

To fully integrate:

1. **Update render() loop** to call `perfMonitor.recordFrame()`
2. **Update spawnProjectile()** to use `projectilePool.spawn()`
3. **Update updateExplosionVisuals()** to use `explosionPool.update()`
4. **Update updateProjectiles()** to use `projectilePool.despawn()`
5. **Call initPools(scene)** in `init()` function
6. **Call perfMonitor.start()** when game starts
7. **Call perfMonitor.stop()** when game ends

## Example Integration

```javascript
// In init()
initPools(scene);
perfMonitor.start();

// In render()
perfMonitor.recordFrame(rawDt * 1000);
perfMonitor.updateObjectCounts({
  projectiles: projectiles.length,
  enemies: getEnemyCount(),
  explosions: explosionVisuals.length,
  particles: 0,
});
```

## Testing

Run local server:
```bash
cd ~/Github/vr-roguelike
python3 -m http.server 8000
```

Open http://localhost:8000 and check console for performance metrics.

## Notes

- All modules use ES6 export/import
- No external dependencies required
- Compatible with existing codebase
- Ready for full integration
- Simple JSON tracking as requested in issue #93
