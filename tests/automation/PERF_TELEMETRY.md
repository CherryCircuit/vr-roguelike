# Automated Performance Telemetry

Spaceomicide now exposes a guarded telemetry API for perf automation. The hooks live under `window.__test.telemetry` so they stay invisible to regular players.

## Enabling collection

Telemetry is off by default. Enable it from DevTools or Puppeteer before sampling:

```js
await page.evaluate(() => window.__test.telemetry.enable({ historyMs: 3000 }));
```

Options:

- `historyMs` (optional): rolling window for frame-time stats. Clamped between 500 ms and 60 s (default 5000 ms). Enabling clears prior samples.

Disable when finished:

```js
await page.evaluate(() => window.__test.telemetry.disable());
```

## Snapshot API

Call `window.__test.telemetry.snapshot()` after at least one frame has rendered post-enable. Returns `null` if no samples exist yet.

Example payload (trimmed):

```json
{
  "timestamp": 1234567.89,
  "frame": 8421,
  "fps": {
    "instant": 60,
    "avg1s": 58,
    "avgHistory": 57
  },
  "frameTimeMs": {
    "last": 16.8,
    "avg1s": 17.2,
    "p95_1s": 23.5,
    "avgHistory": 17.9
  },
  "memory": {
    "usedMB": 280.3,
    "limitMB": 4096
  },
  "renderer": {
    "drawCalls": 182,
    "triangles": 296432,
    "geometries": 347,
    "textures": 219
  },
  "counts": {
    "enemies": 6,
    "bossActive": false,
    "projectiles": 18,
    "instancedProjectiles": {
      "laser": { "active": 24, "max": 120, "free": 96 }
    },
    "voxelsActive": 3,
    "voxelPoolFree": 47,
    "shields": 1,
    "laserMines": 2,
    "attackDrones": 2
  },
  "gameplay": {
    "state": "playing",
    "level": 4,
    "killTarget": 59,
    "kills": 18,
    "score": 4200,
    "slowmoActive": false,
    "runStats": {
      "timePlayed": 142.6,
      "shotsFired": 215,
      "shotsHit": 162
    }
  }
}
```

## Utility helpers

- `window.__test.telemetry.isEnabled()` → boolean
- `window.__test.telemetry.setHistoryWindow(ms)` → adjust smoothing without disabling

## Notes

- Telemetry sampling piggybacks on the main render loop and only runs when explicitly enabled or when the in-game perf monitor is on.
- Snapshots surface heap usage when Chrome exposes `performance.memory`; other browsers return `null` for the `memory` block.
- Stats are lightweight: only frame-time history is stored (default 5 s ≈ 300 samples).
- Automated perf scenarios should enable telemetry immediately after entering the scene, wait a few frames (e.g., `await page.waitForTimeout(250)`), then pull snapshots as needed.
