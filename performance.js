// ============================================================
//  PERFORMANCE MONITORING SYSTEM
//  Tracks FPS, frame times, memory usage, and object counts
// ============================================================

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: [],
      frameTime: [],
      memoryUsage: [],
      objectCounts: {
        projectiles: 0,
        enemies: 0,
        explosions: 0,
        particles: 0,
      },
      lastUpdate: Date.now(),
    };

    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
    this.maxHistorySize = 300; // 5 seconds at 60fps

    this.enabled = false;
    this.logInterval = 5000; // Log every 5 seconds
    this.lastLog = 0;
  }

  /**
   * Start monitoring
   */
  start() {
    this.enabled = true;
    this.lastTime = performance.now();
    console.log('[Performance] Monitoring started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.enabled = false;
    console.log('[Performance] Monitoring stopped');
  }

  /**
   * Record a frame
   */
  recordFrame(frameTime) {
    if (!this.enabled) return;

    this.frameCount++;
    const now = performance.now();

    // Calculate FPS
    const fps = 1000 / frameTime;
    this.fpsHistory.push(fps);

    // Keep history bounded
    if (this.fpsHistory.length > this.maxHistorySize) {
      this.fpsHistory.shift();
    }

    // Log periodically
    if (now - this.lastLog > this.logInterval) {
      this.logMetrics();
      this.lastLog = now;
    }
  }

  /**
   * Update object counts
   */
  updateObjectCounts(counts) {
    Object.assign(this.metrics.objectCounts, counts);
  }

  /**
   * Get current FPS
   */
  getCurrentFPS() {
    if (this.fpsHistory.length === 0) return 60;
    return this.fpsHistory[this.fpsHistory.length - 1];
  }

  /**
   * Get average FPS over last N frames
   */
  getAverageFPS(n = 60) {
    if (this.fpsHistory.length === 0) return 60;
    const samples = this.fpsHistory.slice(-n);
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  }

  /**
   * Get FPS percentile (e.g., 95th percentile)
   */
  getFPSPercentile(percentile) {
    if (this.fpsHistory.length === 0) return 60;
    const sorted = [...this.fpsHistory].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[index];
  }

  /**
   * Check if performance is degraded
   */
  isPerformanceDegraded() {
    const avgFPS = this.getAverageFPS(60);
    const p95FPS = this.getFPSPercentile(5); // 5th percentile (worst frames)

    // Degraded if average < 50fps or 5th percentile < 30fps
    return avgFPS < 50 || p95FPS < 30;
  }

  /**
   * Log current metrics to console
   */
  logMetrics() {
    if (!this.enabled) return;

    const avgFPS = this.getAverageFPS(60).toFixed(1);
    const minFPS = Math.min(...this.fpsHistory.slice(-60)).toFixed(1);
    const maxFPS = Math.max(...this.fpsHistory.slice(-60)).toFixed(1);
    const p5FPS = this.getFPSPercentile(5).toFixed(1);

    const counts = this.metrics.objectCounts;
    const total = counts.projectiles + counts.enemies + counts.explosions + counts.particles;

    console.log(`[Performance] FPS: ${avgFPS} avg (${minFPS}-${maxFPS}, p5=${p5FPS}) | Objects: ${total} (${counts.projectiles} proj, ${counts.enemies} enemies, ${counts.explosions} explosions, ${counts.particles} particles)`);

    // Warn if degraded
    if (this.isPerformanceDegraded()) {
      console.warn('[Performance] ⚠️ Performance degraded! Consider optimizing or reducing object counts.');
    }
  }

  /**
   * Get metrics as JSON (for saving)
   */
  toJSON() {
    return {
      timestamp: Date.now(),
      fps: {
        current: this.getCurrentFPS(),
        average: this.getAverageFPS(60),
        min: Math.min(...this.fpsHistory.slice(-60)),
        max: Math.max(...this.fpsHistory.slice(-60)),
        p5: this.getFPSPercentile(5),
        p95: this.getFPSPercentile(95),
      },
      objectCounts: { ...this.metrics.objectCounts },
      degraded: this.isPerformanceDegraded(),
    };
  }

  /**
   * Export metrics to localStorage
   */
  exportToStorage() {
    const data = this.toJSON();
    localStorage.setItem('performance_metrics', JSON.stringify(data));
    console.log('[Performance] Metrics exported to localStorage');
  }

  /**
   * Load metrics from localStorage
   */
  loadFromStorage() {
    const stored = localStorage.getItem('performance_metrics');
    if (stored) {
      const data = JSON.parse(stored);
      console.log('[Performance] Loaded previous metrics:', data);
      return data;
    }
    return null;
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();
