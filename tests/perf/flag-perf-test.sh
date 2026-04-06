#!/bin/bash
# Systematic perf test: enable/disable each visual effect flag and measure impact
set -e

VR_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$VR_DIR"

PERF_CMD="node tests/perf/run-perf.mjs idle-soak combat-stress"
RESULTS_DIR="/tmp/flag-perf-results"
rm -rf "$RESULTS_DIR"
mkdir -p "$RESULTS_DIR"

# Flags and their files
declare -A FLAGS
FLAGS["FLOOR_BLOOM"]="biomes/synthwave-valley.js"
FLAGS["SPEED_LINES"]="hud.js"
FLAGS["MUZZLE_FLASH"]="main.js"
FLAGS["SPAWN_WARP"]="enemies.js"

run_test() {
  local label="$1"
  echo ""
  echo "=========================================="
  echo "  TEST: $label"
  echo "=========================================="
  $PERF_CMD 2>&1 | tee "$RESULTS_DIR/${label}.log" || true
  # Extract latest artifact
  LATEST=$(ls -td tests/perf/artifacts/*/ | head -1)
  if [ -d "$LATEST" ]; then
    for s in idle-soak combat-stress; do
      if [ -f "$LATEST$s/iteration-1/result.json" ]; then
        echo "--- $s ---"
        python3 -c "
import json
d=json.load(open('${LATEST}${s}/iteration-1/result.json'))
t=d.get('telemetry',{}).get('instrumentation',{})
c=d.get('console',{})
print(f'  FPS avg: {t.get(\"fps\",{}).get(\"avgHistory\",\"?\")}')
print(f'  FrameTime avg: {t.get(\"frameTimeMs\",{}).get(\"avgHistory\",\"?\")}ms')
print(f'  Draw calls: {t.get(\"renderer\",{}).get(\"drawCalls\",\"?\")}')
print(f'  Triangles: {t.get(\"renderer\",{}).get(\"triangles\",\"?\")}')
print(f'  Memory: {t.get(\"memory\",{}).get(\"usedMB\",\"?\")}MB')
print(f'  Errors: console={c.get(\"consoleErrors\",\"?\")} page={c.get(\"pageErrors\",\"?\")}')
" 2>/dev/null || echo "  (no data)"
        # Save to summary
        python3 -c "
import json
d=json.load(open('${LATEST}${s}/iteration-1/result.json'))
t=d.get('telemetry',{}).get('instrumentation',{})
c=d.get('console',{})
print('${label},${s},' + str(t.get('frameTimeMs',{}).get('avgHistory','?')) + ',' + str(t.get('renderer',{}).get('drawCalls','?')) + ',' + str(t.get('memory',{}).get('usedMB','?')) + ',' + str(c.get('consoleErrors','?')))
" >> "$RESULTS_DIR/summary.csv" 2>/dev/null || true
      fi
    done
    # Copy artifacts for this run
    cp -r "$LATEST" "$RESULTS_DIR/${label}/" 2>/dev/null || true
  fi
}

set_flag() {
  local flag="$1"
  local file="$2"
  local value="$3"
  sed -i "s/const ENABLE_${flag} = true;/const ENABLE_${flag} = ${value};/" "$file"
  sed -i "s/const ENABLE_${flag} = false;/const ENABLE_${flag} = ${value};/" "$file"
}

echo "Flag,Scenario,FrameTimeAvg,DrawCalls,MemoryMB,ConsoleErrors" > "$RESULTS_DIR/summary.csv"

# Save original flags
echo "Saving original flag states..."
for flag in "${!FLAGS[@]}"; do
  file="${FLAGS[$flag]}"
  state=$(grep "const ENABLE_${flag}" "$file" | head -1)
  echo "$flag=$state" >> "$RESULTS_DIR/originals.txt"
done

# Ensure all enabled first
for flag in "${!FLAGS[@]}"; do
  set_flag "$flag" "${FLAGS[$flag]}" "true"
done

echo ""
echo "===== PHASE 1: Baseline (all enabled) ====="
run_test "ALL_ENABLED"

echo ""
echo "===== PHASE 2: Disable each one individually ====="
for flag in "${!FLAGS[@]}"; do
  file="${FLAGS[$flag]}"
  set_flag "$flag" "$file" "false"
  run_test "DISABLED_${flag}"
  set_flag "$flag" "$file" "true"
done

echo ""
echo "===== PHASE 3: All disabled ====="
for flag in "${!FLAGS[@]}"; do
  set_flag "$flag" "${FLAGS[$flag]}" "false"
done
run_test "ALL_DISABLED"

# Restore all to true
for flag in "${!FLAGS[@]}"; do
  set_flag "$flag" "${FLAGS[$flag]}" "true"
done

echo ""
echo "=========================================="
echo "  SUMMARY"
echo "=========================================="
cat "$RESULTS_DIR/summary.csv"
echo ""
echo "Original flag states preserved. All flags restored to true."
