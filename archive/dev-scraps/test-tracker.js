// ============================================================
//  TEST WORKFLOW TRACKER
//  Simple JSON-based tracking for manual testing
// ============================================================

export class TestTracker {
  constructor() {
    this.data = this.load();
    this.currentSession = null;
  }

  /**
   * Load tracking data from localStorage
   */
  load() {
    const stored = localStorage.getItem('test_tracking');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('[TestTracker] Failed to load tracking data:', e);
      }
    }

    // Return default structure
    return {
      testSessions: [],
      currentSession: null,
      config: {
        autoSave: true,
        logToConsole: true,
        trackPerformance: true,
      },
    };
  }

  /**
   * Save tracking data to localStorage
   */
  save() {
    if (!this.data.config.autoSave) return;

    try {
      localStorage.setItem('test_tracking', JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('[TestTracker] Failed to save tracking data:', e);
    }
  }

  /**
   * Start a new test session
   */
  startSession(feature, description = '') {
    this.currentSession = {
      id: Date.now(),
      feature,
      description,
      startTime: Date.now(),
      endTime: null,
      status: 'in_progress',
      steps: [],
      performance: {
        avgFPS: [],
        minFPS: 60,
        maxFPS: 0,
        objectCounts: [],
      },
      issues: [],
      notes: [],
    };

    this.data.currentSession = this.currentSession;
    this.save();

    if (this.data.config.logToConsole) {
      console.log(`[TestTracker] Started session #${this.currentSession.id}: ${feature}`);
      if (description) console.log(`  Description: ${description}`);
    }

    return this.currentSession;
  }

  /**
   * Add a test step
   */
  addStep(action, expected, actual, passed = null) {
    if (!this.currentSession) {
      console.warn('[TestTracker] No active session');
      return;
    }

    const step = {
      timestamp: Date.now(),
      action,
      expected,
      actual,
      passed: passed !== null ? passed : (expected === actual),
    };

    this.currentSession.steps.push(step);
    this.save();

    if (this.data.config.logToConsole) {
      const status = step.passed ? '✓' : '✗';
      console.log(`[TestTracker] ${status} Step: ${action}`);
      if (!step.passed) {
        console.log(`  Expected: ${expected}`);
        console.log(`  Actual: ${actual}`);
      }
    }

    return step;
  }

  /**
   * Record performance metrics
   */
  recordPerformance(fps, objectCount) {
    if (!this.currentSession || !this.data.config.trackPerformance) return;

    this.currentSession.performance.avgFPS.push(fps);
    this.currentSession.performance.minFPS = Math.min(this.currentSession.performance.minFPS, fps);
    this.currentSession.performance.maxFPS = Math.max(this.currentSession.performance.maxFPS, fps);
    this.currentSession.performance.objectCounts.push(objectCount);
  }

  /**
   * Report an issue
   */
  reportIssue(description, severity = 'medium') {
    if (!this.currentSession) {
      console.warn('[TestTracker] No active session');
      return;
    }

    const issue = {
      timestamp: Date.now(),
      description,
      severity, // 'low', 'medium', 'high', 'critical'
    };

    this.currentSession.issues.push(issue);
    this.save();

    if (this.data.config.logToConsole) {
      const emoji = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : 'ℹ️';
      console.log(`[TestTracker] ${emoji} Issue (${severity}): ${description}`);
    }

    return issue;
  }

  /**
   * Add a note
   */
  addNote(note) {
    if (!this.currentSession) {
      console.warn('[TestTracker] No active session');
      return;
    }

    this.currentSession.notes.push({
      timestamp: Date.now(),
      text: note,
    });

    this.save();

    if (this.data.config.logToConsole) {
      console.log(`[TestTracker] 📝 Note: ${note}`);
    }
  }

  /**
   * End the current session
   */
  endSession(status = 'completed') {
    if (!this.currentSession) {
      console.warn('[TestTracker] No active session');
      return;
    }

    this.currentSession.endTime = Date.now();
    this.currentSession.status = status;
    this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;

    // Calculate average performance
    if (this.currentSession.performance.avgFPS.length > 0) {
      const avg = this.currentSession.performance.avgFPS.reduce((a, b) => a + b, 0) / this.currentSession.performance.avgFPS.length;
      this.currentSession.performance.overallAvgFPS = avg.toFixed(1);
    }

    // Add to sessions list
    this.data.testSessions.push(this.currentSession);

    if (this.data.config.logToConsole) {
      const duration = (this.currentSession.duration / 1000).toFixed(1);
      const steps = this.currentSession.steps.length;
      const passed = this.currentSession.steps.filter(s => s.passed).length;
      const issues = this.currentSession.issues.length;

      console.log(`[TestTracker] ✓ Session completed`);
      console.log(`  Duration: ${duration}s`);
      console.log(`  Steps: ${passed}/${steps} passed`);
      console.log(`  Issues: ${issues}`);
      if (this.currentSession.performance.overallAvgFPS) {
        console.log(`  Avg FPS: ${this.currentSession.performance.overallAvgFPS}`);
      }
    }

    this.save();
    this.currentSession = null;
    this.data.currentSession = null;

    return this.data.testSessions[this.data.testSessions.length - 1];
  }

  /**
   * Get session summary
   */
  getSessionSummary(sessionId) {
    const session = this.data.testSessions.find(s => s.id === sessionId);
    if (!session) return null;

    return {
      feature: session.feature,
      duration: session.duration,
      status: session.status,
      stepsTotal: session.steps.length,
      stepsPassed: session.steps.filter(s => s.passed).length,
      issues: session.issues.length,
      avgFPS: session.performance.overallAvgFPS,
    };
  }

  /**
   * Get all sessions
   */
  getAllSessions() {
    return this.data.testSessions.map(s => this.getSessionSummary(s.id));
  }

  /**
   * Export data as JSON
   */
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  /**
   * Clear all data
   */
  clear() {
    this.data = {
      testSessions: [],
      currentSession: null,
      config: {
        autoSave: true,
        logToConsole: true,
        trackPerformance: true,
      },
    };
    this.save();
    console.log('[TestTracker] Cleared all data');
  }

  /**
   * Update configuration
   */
  setConfig(key, value) {
    this.data.config[key] = value;
    this.save();
    console.log(`[TestTracker] Config updated: ${key} = ${value}`);
  }
}

// Singleton instance
export const testTracker = new TestTracker();

// Expose to window for console access
if (typeof window !== 'undefined') {
  window.testTracker = testTracker;
}
