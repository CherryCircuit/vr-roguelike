// ============================================================
//  DESKTOP CONTROLS MANUAL TEST SCRIPT
//  Run this in browser console after loading the game
// ============================================================

/**
 * Desktop Controls Test Suite
 * Tests keyboard/mouse controls, pointer lock, weapon firing, and movement
 */
function runDesktopControlsTest() {
  console.log('='.repeat(60));
  console.log('DESKTOP CONTROLS MANUAL TEST');
  console.log('='.repeat(60));

  // Start test session
  testTracker.startSession(
    'Desktop Controls',
    'Testing keyboard/mouse input, pointer lock, weapon firing, and movement'
  );

  // Test 1: Check if desktop mode is available
  console.log('\n--- Test 1: Desktop Mode Detection ---');
  try {
    const hasDesktopControls = typeof window.toggleDesktopMode !== 'undefined';
    testTracker.addStep(
      'Check desktop controls available',
      'window.toggleDesktopMode exists',
      hasDesktopControls ? 'window.toggleDesktopMode exists' : 'window.toggleDesktopMode not found',
      hasDesktopControls
    );

    if (!hasDesktopControls) {
      testTracker.reportIssue('Desktop controls not initialized', 'critical');
      return;
    }
  } catch (e) {
    testTracker.reportIssue(`Desktop mode check failed: ${e.message}`, 'critical');
    return;
  }

  // Test 2: Check keyboard event listeners
  console.log('\n--- Test 2: Keyboard Input Detection ---');
  try {
    // Check if game state allows input
    const gameState = game.state;
    const canInput = gameState === 1 || gameState === 2; // PLAYING or LEVEL_COMPLETE
    testTracker.addStep(
      'Check if input is possible',
      'Game state allows input',
      `Game state: ${gameState}, Can input: ${canInput}`,
      canInput
    );

    if (!canInput) {
      testTracker.addNote('Game is not in playable state. Start a game first.');
    }
  } catch (e) {
    testTracker.reportIssue(`Keyboard check failed: ${e.message}`, 'high');
  }

  // Test 3: Performance monitoring status
  console.log('\n--- Test 3: Performance Monitoring ---');
  try {
    const perfActive = perfMonitor && perfMonitor.enabled;
    testTracker.addStep(
      'Check performance monitoring',
      'perfMonitor is enabled',
      perfActive ? 'perfMonitor enabled' : 'perfMonitor not active',
      perfActive
    );

    if (perfActive) {
      const currentFPS = perfMonitor.getCurrentFPS();
      const avgFPS = perfMonitor.getAverageFPS();
      testTracker.addNote(`Current FPS: ${currentFPS.toFixed(1)}, Average: ${avgFPS.toFixed(1)}`);

      // Record performance
      testTracker.recordPerformance(currentFPS, 0);
    }
  } catch (e) {
    testTracker.reportIssue(`Performance monitoring check failed: ${e.message}`, 'medium');
  }

  // Test 4: Object pools status
  console.log('\n--- Test 4: Object Pools ---');
  try {
    const poolsInitialized = projectilePool && explosionPool;
    testTracker.addStep(
      'Check object pools',
      'Projectile and explosion pools exist',
      poolsInitialized ? 'Pools initialized' : 'Pools not found',
      poolsInitialized
    );

    if (poolsInitialized) {
      const projStats = projectilePool.getStats();
      const explStats = explosionPool.getStats();
      testTracker.addNote(`Projectiles: ${projStats.active} active, ${projStats.poolSize} available`);
      testTracker.addNote(`Explosions: ${explStats.active} active, ${explStats.poolSize} available`);
    }
  } catch (e) {
    testTracker.reportIssue(`Object pool check failed: ${e.message}`, 'medium');
  }

  // Test 5: Manual input verification (user-guided)
  console.log('\n--- Test 5: Manual Input Verification ---');
  console.log('Please perform the following actions:');

  const manualTests = [
    {
      action: 'Press W key',
      expected: 'Player moves forward',
      instruction: 'Press W and verify player moves toward crosshair'
    },
    {
      action: 'Press S key',
      expected: 'Player moves backward',
      instruction: 'Press S and verify player moves away from crosshair'
    },
    {
      action: 'Press A key',
      expected: 'Player moves left',
      instruction: 'Press A and verify player strafes left'
    },
    {
      action: 'Press D key',
      expected: 'Player moves right',
      instruction: 'Press D and verify player strafes right'
    },
    {
      action: 'Mouse look',
      expected: 'Camera rotates with mouse',
      instruction: 'Click to lock pointer, then move mouse to look around'
    },
    {
      action: 'Left click or Space',
      expected: 'Weapons fire',
      instruction: 'Click or press Space and verify projectiles fire'
    }
  ];

  console.log('\nManual Test Checklist:');
  manualTests.forEach((test, i) => {
    console.log(`${i + 1}. ${test.action}`);
    console.log(`   Expected: ${test.expected}`);
    console.log(`   ${test.instruction}`);
  });

  console.log('\nTo record results for each test, run:');
  console.log('  testTracker.addStep("ACTION", "EXPECTED", "ACTUAL", PASSED)');

  // Test 6: Performance baseline
  console.log('\n--- Test 6: Performance Baseline ---');
  try {
    if (perfMonitor && perfMonitor.enabled) {
      setTimeout(() => {
        const fpsAfterWait = perfMonitor.getCurrentFPS();
        const avgFPSAfterWait = perfMonitor.getAverageFPS();
        testTracker.addNote(`After 2 seconds - FPS: ${fpsAfterWait.toFixed(1)}, Avg: ${avgFPSAfterWait.toFixed(1)}`);
        testTracker.recordPerformance(fpsAfterWait, 0);

        const degraded = perfMonitor.isPerformanceDegraded();
        testTracker.addStep(
          'Check performance degradation',
          'FPS >= 50 and p5 >= 30',
          degraded ? 'Performance degraded' : 'Performance acceptable',
          !degraded
        );

        if (degraded) {
          testTracker.reportIssue('Performance degraded detected', 'high');
        }
      }, 2000);
    }
  } catch (e) {
    testTracker.reportIssue(`Performance baseline failed: ${e.message}`, 'medium');
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test suite started. Manual verification required.');
  console.log('Run testTracker.endSession("completed") when finished.');
  console.log('='.repeat(60));
}

/**
 * Quick test - just check if systems are initialized
 */
function quickTest() {
  console.log('--- Quick Desktop Controls Check ---');

  const checks = [
    {
      name: 'Desktop Controls',
      check: () => typeof window.toggleDesktopMode !== 'undefined'
    },
    {
      name: 'Performance Monitor',
      check: () => perfMonitor && typeof perfMonitor.getCurrentFPS === 'function'
    },
    {
      name: 'Projectile Pool',
      check: () => projectilePool && typeof projectilePool.spawn === 'function'
    },
    {
      name: 'Explosion Pool',
      check: () => explosionPool && typeof explosionPool.spawn === 'function'
    },
    {
      name: 'Test Tracker',
      check: () => testTracker && typeof testTracker.startSession === 'function'
    }
  ];

  checks.forEach(({ name, check }) => {
    const result = check();
    const status = result ? '✓' : '✗';
    console.log(`${status} ${name}: ${result ? 'OK' : 'FAIL'}`);
  });
}

/**
 * Enable debug performance monitoring
 */
function enableDebugPerf() {
  window.debugPerfMonitor = true;
  console.log('Debug performance monitoring enabled');
  console.log('Run perfMonitor.logMetrics() to see current stats');
}

/**
 * Show pool statistics
 */
function showPoolStats() {
  console.log('--- Object Pool Statistics ---');
  if (projectilePool) {
    projectilePool.logStats('Projectiles');
  }
  if (explosionPool) {
    explosionPool.logStats('Explosions');
  }
}

/**
 * Export test results
 */
function exportTestResults() {
  const data = testTracker.exportJSON();
  console.log('--- Test Results ---');
  console.log(data);

  // Also save to file (if in browser)
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test-results-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log('Test results exported to file');
}

// Expose functions to window
if (typeof window !== 'undefined') {
  window.runDesktopControlsTest = runDesktopControlsTest;
  window.quickTest = quickTest;
  window.enableDebugPerf = enableDebugPerf;
  window.showPoolStats = showPoolStats;
  window.exportTestResults = exportTestResults;

  console.log('Desktop controls test suite loaded.');
  console.log('Run runDesktopControlsTest() to start testing.');
  console.log('Run quickTest() for a quick system check.');
}
