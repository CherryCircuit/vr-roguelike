# Combat Spike Diagnostic — 2026-04-03

## Setup
- Scenario: combat-spike-diag at level 14 (125 kill target)
- 20 seconds active combat with per-frame timing
- Spike threshold: 50ms
- Compared MINIMAL (68 visual objects hidden) vs FULL_VISUALS

## Results

### MINIMAL mode (gameplay only, no scenery)

| Metric | Value |
|--------|-------|
| Total frames | 1746 |
| Avg frame time | **17.1ms** (~58 FPS) |
| p50 | 16.7ms |
| p90 | 16.7ms |
| p95 | 16.8ms |
| p99 | 33.3ms |
| **Spikes (>50ms)** | **1** |
| Max spike | 100ms |

**Slow-mo frame analysis (20 events):**
Every single activation and ramp-out shows: before=16.7ms, during=16.6ms, after=16.7ms.
**Slow-mo activation adds ZERO measurable frame cost in minimal mode.**

### FULL_VISUALS mode

| Metric | Value |
|--------|-------|
| Total frames | 1023 |
| Avg frame time | **29.4ms** (~34 FPS) |
| p50 | 33.3ms |
| p90 | 33.4ms |
| p95 | 49.9ms |
| p99 | 50.1ms |
| **Spikes (>50ms)** | **18** |
| Max spike | 100ms |

**Slow-mo frame analysis (11 events):**
- Activation: before=33.3ms, during=33.3ms, after=33.4ms — consistent, no spike
- Ramp-out: before=16.8ms, **during=99.9ms**, after=16.7ms — **RAMP-OUT CAUSES SPIKES**
- One ramp-out frame hit 99.9ms with full visuals

## Key Findings

### 1. The game logic is fast. Rendering is the bottleneck.
In minimal mode: 17ms/frame with 8 enemies, active combat, slow-mo cycling.
In full visuals: 29ms/frame doing the exact same thing. The 12ms difference is purely visual rendering.

### 2. Slow-mo activation itself is free
In both modes, the frame where bullet-time ACTIVATED shows identical timing to surrounding frames. No spike on activation.

### 3. Slow-mo RAMP-OUT can spike with full visuals
The ramp-out frame (transitioning back to full speed) showed a 99.9ms spike in full visuals mode. This is likely the renderer suddenly rendering a full scene again after being in a low-res timeScale.

### 4. The Quest 3 problem is GPU, not JS
The Quest 3 has an Adreno 740 GPU, which is much faster than SwiftShader but still mobile-class. With 68+ visual objects, the GPU render pass is the bottleneck. When slow-mo ramps out and timeScale snaps back to 1.0, the engine may flush the render pipeline causing a visible hitch.

### 5. 13 "unknown" spikes in full visuals
Most spikes in full visuals happened during no specific game event (no enemy spawn, no slow-mo). These are GPU pipeline stalls from the rendering workload itself.

## Recommendations

1. **Reduce scene complexity during slow-mo:** When bullet-time activates, temporarily lower pixel ratio or reduce visible detail. When it ramps out, ease back instead of snapping.

2. **Profile on actual Quest 3:** The headless SwiftShader results are directional but not definitive for Quest. Run the combat-spike-diag scenario on device via WebXR test mode if possible.

3. **Consider LOD system:** Lower triangle counts for distant biome objects. The synthwave floor alone is 16K triangles.

4. **Throttle slow-mo ramp-out:** Instead of instantly restoring full render quality, ramp visual fidelity back over 2-3 frames to avoid pipeline stalls.

## Diagnostic Tool
The `combat-spike-diag` scenario is version-resilient:
- Uses Three.js scene traversal (not internal APIs) to strip visuals
- Uses patched RAF for per-frame timing
- Uses console.log interception for event correlation
- Works with any version that has `__test` hooks and `debugJumpToLevel`

Usage:
```bash
# Minimal mode (gameplay only)
node tests/perf/run-perf.mjs --scenarios=combat-spike-diag --targetLevel=14

# Full visuals for comparison
node tests/perf/run-perf.mjs --scenarios=combat-spike-diag --targetLevel=14 --minimal=false

# Higher levels
node tests/perf/run-perf.mjs --scenarios=combat-spike-diag --targetLevel=17 --profileDurationMs=30000
```
