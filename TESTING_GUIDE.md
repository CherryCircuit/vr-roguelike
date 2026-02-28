# Desktop Controls Testing Guide

## Overview

This guide explains how to manually test the desktop controls using the new test tracking system. The simple JSON-based tracking replaces complex DevClaw labels for faster iteration.

## Quick Start

### 1. Start the Local Server

```bash
cd ~/Github/vr-roguelike.worktrees/feature/93-performance-monitoring
python3 -m http.server 8000
```

### 2. Open the Game

Navigate to: http://localhost:8000

### 3. Load the Test Suite

Open the browser console (F12) and load the test script:

```javascript
// Load the test script (add to index.html or paste in console)
import('./test-desktop-controls.js').then(() => {
  console.log('Test suite loaded');
});
```

Or if using the script tag in HTML, the test functions will be available immediately.

### 4. Run Tests

```javascript
// Quick system check
quickTest();

// Full test suite
runDesktopControlsTest();
```

## Test Functions

### `quickTest()`
Performs a quick check of all systems:
- Desktop controls availability
- Performance monitor status
- Object pools status
- Test tracker availability

### `runDesktopControlsTest()`
Runs the full automated test suite:
1. Desktop mode detection
2. Keyboard input detection
3. Performance monitoring status
4. Object pools status
5. Manual input verification prompts
6. Performance baseline check

### `enableDebugPerf()`
Enables detailed performance monitoring in the console.

### `showPoolStats()`
Displays current object pool statistics.

### `exportTestResults()`
Exports test results to a JSON file.

## Manual Testing Workflow

### Step 1: System Initialization Check

```javascript
quickTest();
```

Expected output:
```
✓ Desktop Controls: OK
✓ Performance Monitor: OK
✓ Projectile Pool: OK
✓ Explosion Pool: OK
✓ Test Tracker: OK
```

### Step 2: Start the Game

Click to start the game (or use debug mode):
```javascript
// Jump to a specific level for testing
window.debugJumpToLevel = 1;
```

### Step 3: Run Full Test Suite

```javascript
runDesktopControlsTest();
```

This will:
- Start a test session
- Run automated checks
- Prompt for manual verification steps
- Record performance metrics

### Step 4: Manual Verification

The test suite will prompt you to verify:

1. **Movement**
   - Press W → Player moves forward
   - Press S → Player moves backward
   - Press A → Player moves left
   - Press D → Player moves right
   - Hold Shift → Sprint (1.5x speed)

2. **Aiming**
   - Click to enable pointer lock
   - Move mouse → Camera rotates
   - Press ESC → Exit pointer lock

3. **Weapons**
   - Left click or Space → Fire weapons
   - Press 1 → Fire left weapon only
   - Press 2 → Fire right weapon only
   - Press 3 → Fire both weapons (default)
   - Mouse scroll → Cycle fire modes

For each manual test, record results:
```javascript
testTracker.addStep(
  'Press W key',
  'Player moves forward',
  'Player moved forward correctly',
  true
);
```

### Step 5: Performance Monitoring

After the test suite runs for 2 seconds, it will:
- Record FPS metrics
- Check for performance degradation
- Report any issues

You can also manually check performance:
```javascript
// Enable detailed logging
enableDebugPerf();

// Show current stats
perfMonitor.logMetrics();

// Check pool usage
showPoolStats();
```

### Step 6: End Session

```javascript
testTracker.endSession('completed');
```

This will display a summary:
```
[TestTracker] ✓ Session completed
  Duration: 5.2s
  Steps: 12/12 passed
  Issues: 0
  Avg FPS: 58.3
```

### Step 7: Export Results

```javascript
exportTestResults();
```

This downloads a JSON file with all test data.

## Test Tracker API

### Session Management

```javascript
// Start a session
testTracker.startSession('Feature Name', 'Description');

// End a session
testTracker.endSession('completed'); // or 'failed', 'blocked'
```

### Test Steps

```javascript
// Add a test step
testTracker.addStep(
  'Action performed',
  'Expected result',
  'Actual result',
  true/false  // pass/fail
);

// Add a note
testTracker.addNote('Additional information');

// Report an issue
testTracker.reportIssue('Description of issue', 'severity'); // low, medium, high, critical
```

### Performance Tracking

```javascript
// Record performance metrics
testTracker.recordPerformance(fps, objectCount);
```

### Data Management

```javascript
// Get all sessions
testTracker.getAllSessions();

// Get specific session summary
testTracker.getSessionSummary(sessionId);

// Export as JSON
testTracker.exportJSON();

// Clear all data
testTracker.clear();
```

## Performance Metrics

### FPS Monitoring

The performance monitor tracks:
- **Current FPS**: Instantaneous frame rate
- **Average FPS**: Rolling average over 60 frames
- **Min/Max FPS**: Extremes over last 60 frames
- **5th Percentile**: Worst 5% of frames (indicates frame drops)
- **95th Percentile**: Best 95% of frames

### Performance Degradation

Degraded if:
- Average FPS < 50 OR
- 5th percentile FPS < 30

### Object Count Tracking

Tracks active objects:
- Projectiles
- Enemies
- Explosions
- Particles

### Logging

Performance metrics are logged every 5 seconds:
```
[Performance] FPS: 58.3 avg (52.1-62.4, p5=48.2) | Objects: 15 (8 proj, 5 enemies, 2 explosions, 0 particles)
```

## Troubleshooting

### Test Suite Not Loading

**Problem**: Test functions not available in console

**Solution**: 
```javascript
// Load the test script explicitly
const script = document.createElement('script');
script.src = 'test-desktop-controls.js';
document.head.appendChild(script);
```

### Desktop Controls Not Responding

**Problem**: Keyboard/mouse input not working

**Check**:
```javascript
// Verify desktop controls are loaded
typeof window.toggleDesktopMode !== 'undefined';

// Check game state
game.state; // Should be 1 (PLAYING) or 2 (LEVEL_COMPLETE)
```

### Performance Monitoring Not Working

**Problem**: FPS not being tracked

**Check**:
```javascript
// Verify monitor is enabled
perfMonitor.enabled;

// Manually start
perfMonitor.start();
```

### Pointer Lock Fails

**Problem**: Mouse look doesn't work

**Solution**:
- Click anywhere on the page first
- Use Chrome or Firefox
- Ensure you're on localhost (not HTTPS required for localhost)
- Press ESC to exit pointer lock, then click again

## Best Practices

1. **Test on clean state**: Clear browser cache and localStorage before testing
   ```javascript
   localStorage.clear();
   location.reload();
   ```

2. **Test in different browsers**: Chrome, Firefox, Edge

3. **Test different scenarios**:
   - Title screen
   - Gameplay
   - Level transition
   - Boss fight
   - Game over

4. **Record all issues**: Even minor issues should be reported with severity levels

5. **Export results**: Always export test results for documentation

6. **Check performance**: Run performance tests in different scenarios (few enemies, many enemies)

## Continuous Integration

This manual testing workflow is designed for rapid iteration. For automated testing in CI/CD:

1. Run `quickTest()` for smoke tests
2. Check performance baseline
3. Compare against previous runs

## Example Test Session

```javascript
// 1. Start session
testTracker.startSession('Desktop Controls v2', 'Testing new input system');

// 2. Quick check
quickTest();

// 3. Start game
window.debugJumpToLevel = 1;

// 4. Run automated tests
runDesktopControlsTest();

// 5. Manual verification
testTracker.addStep('W key moves forward', 'Forward movement', 'Moved forward', true);
testTracker.addStep('A key moves left', 'Left strafe', 'Strafed left', true);

// 6. Record performance
testTracker.recordPerformance(58, 15);

// 7. End session
testTracker.endSession('completed');

// 8. Export results
exportTestResults();
```

## Next Steps

After manual testing:

1. Review test results
2. Fix any critical issues
3. Update test cases for new features
4. Document edge cases
5. Share results with team

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify all test functions are loaded
3. Check performance monitor is enabled
4. Review test logs in localStorage

For more information, see:
- `LOCAL_TESTING.md` - General local testing guide
- `PERFORMANCE_IMPLEMENTATION.md` - Performance monitoring details
- `test-tracker.js` - Test tracker implementation
- `performance.js` - Performance monitor implementation
