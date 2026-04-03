# Performance Harness

This directory houses a Puppeteer-driven performance harness for the VR roguelike. It launches a local static server, drives deterministic gameplay scenarios, and writes telemetry plus artifacts for later inspection.

## Quick Start

```bash
cd vr-roguelike
node tests/perf/run-perf.mjs
```

By default the harness runs every scenario once (idle-soak, combat-stress, restart-churn) and writes artifacts under `tests/perf/artifacts/<timestamp>/`.

### Selecting scenarios

```
node tests/perf/run-perf.mjs --scenarios=idle-soak,combat-stress
```

### Iterations

```
node tests/perf/run-perf.mjs --iterations=3
```

### Scenario tuning overrides

| Flag | Scenario | Description |
|------|----------|-------------|
| `--idleDurationMs=20000` | idle-soak | Total idle duration |
| `--idleSampleIntervalMs=1000` | idle-soak | Snapshot cadence |
| `--combatWaves=5` | combat-stress | Number of deterministic firing waves |
| `--combatVolleyDelayMs=250` | combat-stress | Delay between scripted shots |
| `--combatPrepareDelayMs=1500` | combat-stress | Wait time before each wave |
| `--restartCycles=5` | restart-churn | Number of reload cycles |
| `--restartSoakMs=4000` | restart-churn | Time spent in playing state before reload |

### Progression run scenario

`progression-run` is a plan-driven harness that exercises the progression hooks exposed by the runtime. It can march across specific biomes, auto-choose upgrades, and stop once a boss encounter is reached. The plan syntax mirrors the default value:

```
--progressionPlan="synthwave_valley:2,desert_night:2,alien_planet:2,hellscape_lava:1!boss"
```

Each comma-separated segment is `biome:levelCount` and you can append `!boss` to request that the segment stops once a boss room is encountered. Additional flags:

- `--progressionBiomes="synthwave_valley:3,desert_night:2"` alternative way to define the plan.
- `--progressionLevels=2` default level count applied to every biome when using `--progressionBiomes`.
- `--progressionPlan='<json>'` pass a JSON array of `{ biome, levelCount, stopAfterBoss }` objects.
- `--progressionAutoUpgrades=random` set the upgrade strategy (`first-card` is the default).
- `--progressionMaxLevels=8` clamp the total number of levels in the plan.
- `--progressionStopAfterBoss=true` ensure the final segment stops on a boss even if `!boss` is missing.

The scenario reports a `blocked` reason in its `result.json` whenever the game build is missing the progression hooks, so perf runs stay green while still signalling the gap.

### Progression hook contract

The harness looks for `window.__perf.progression`, falling back to `window.__test.progression` or `window.__progression`. To participate in `progression-run`, expose at least:

- `describe()` → optional metadata ({ `biomes`, `supports`, etc. }). Errors are ignored but logged.
- `runSegment({ biome, levelCount, stopAfterBoss, autoUpgrades })` **or** `runPlan({ segments: [...], autoUpgrades })`. Each method should return a summary once the requested chunk has completed.

`autoUpgrades.strategy` receives the CLI string (`first-card`, `random`, etc.) and should configure whatever automation the runtime supports (picking the leftmost card, randomizing, favouring offhand, ...). The runner promises resolve only after the requested number of levels (or boss) finish so the harness can capture telemetry between segments. If neither `runSegment` nor `runPlan` exists, the scenario flags itself as blocked.

### Other flags

- `--headed=true` to watch the browser instead of headless new.
- `--output=/tmp/perf-artifacts` to change the artifact root directory.

## Artifact layout

```
artifacts/
  2026-04-02T17-51-12-345Z/
    idle-soak/
      iteration-1/
        console.json
        errors.json
        request-failures.json
        telemetry-*.json
        result.json
        *.png
    summary.json
```

Each `result.json` contains the scenario metrics as well as the console/error counts captured for that iteration.

## Instrumentation hooks

The harness automatically probes `window.__perf` and `window.__test`:

- `window.__perf.*` should expose optional helpers such as `getSnapshot(label)` or `snapshot(label)`. When present, the harness includes those payloads in `telemetry-*.json` entries. If hooks are missing, it gracefully falls back to renderer + `window.game` stats.
- `window.__test.*` is used by combat-stress to aim deterministic shots. Missing hooks mark that scenario as blocked instead of failing the entire run.

Add new hooks under `window.__perf` to expose metrics such as GPU counters or frame spikes, and the harness will automatically record them whenever a snapshot is requested.
