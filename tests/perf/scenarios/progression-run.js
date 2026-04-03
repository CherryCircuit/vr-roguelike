const DEFAULT_PLAN = 'synthwave_valley:2,desert_night:2,alien_planet:2,hellscape_lava:1!boss';
const SEGMENT_RUNNERS = ['runSegment', 'runTarget', 'advanceSegment', 'advanceTarget'];
const PLAN_RUNNERS = ['runPlan', 'runTargets', 'playPlan'];

function parsePlanSpec(options = {}) {
  const {
    plan,
    biomes,
    levels,
    maxLevels,
    stopAfterBoss,
  } = options;
  const planInput = Array.isArray(plan) && plan.length > 0
    ? plan
    : typeof plan === 'string' && plan.trim()
      ? plan
      : (biomes || '').trim()
        ? `${biomes.trim()}:${levels || ''}`
        : DEFAULT_PLAN;

  if (Array.isArray(planInput)) {
    return planInput
      .map((segment) => ({
        biome: segment.biome,
        levelCount: Number(segment.levelCount) || Number(segment.levels) || 1,
        stopAfterBoss: Boolean(segment.stopAfterBoss || stopAfterBoss),
        label: segment.label,
      }))
      .filter((segment) => segment.biome);
  }

  const maxTotal = Number(maxLevels) && Number(maxLevels) > 0 ? Number(maxLevels) : Infinity;
  const normalized = [];
  let accumulated = 0;
  for (const rawSegment of planInput.split(',')) {
    const trimmed = rawSegment.trim();
    if (!trimmed) continue;
    const [biomePart, restPart] = trimmed.split(':');
    const biome = (biomePart || '').trim();
    if (!biome) continue;
    let levelCount = 1;
    let stopHere = Boolean(stopAfterBoss);
    if (restPart) {
      const detailPart = restPart.trim();
      if (detailPart) {
        const [countPart, ...flags] = detailPart.split('!');
        const parsedCount = Number(countPart);
        if (Number.isFinite(parsedCount) && parsedCount > 0) {
          levelCount = parsedCount;
        }
        if (flags.includes('boss')) {
          stopHere = true;
        }
      }
    }
    if (accumulated >= maxTotal) break;
    const allowed = Math.min(levelCount, Math.max(0, maxTotal - accumulated));
    if (allowed <= 0) break;
    normalized.push({
      biome,
      levelCount: allowed,
      stopAfterBoss: stopHere,
    });
    accumulated += allowed;
  }
  return normalized;
}

async function detectProgression(page) {
  return page.evaluate(() => {
    const progression = window.__perf?.progression || window.__test?.progression || window.__progression || null;
    if (!progression) {
      return { available: false };
    }
    const methods = Object.keys(progression).filter((key) => typeof progression[key] === 'function');
    let describe = null;
    if (typeof progression.describe === 'function') {
      try {
        describe = progression.describe();
      } catch (err) {
        describe = { error: err?.message || String(err) };
      }
    }
    return { available: true, methods, describe };
  });
}

async function runPlanOnPage({ page, runnerName, mode, plan, autoStrategy }) {
  return page.evaluate(async ({ runnerName, mode, plan, autoStrategy }) => {
    const wrapError = (error) => ({
      ok: false,
      reason: error?.message || String(error),
      stack: error?.stack || null,
    });
    const progression = window.__perf?.progression || window.__test?.progression || window.__progression || null;
    if (!progression) {
      return { ok: false, reason: 'progression API missing while executing plan' };
    }
    const runner = progression[runnerName];
    if (typeof runner !== 'function') {
      return { ok: false, reason: `progression.${runnerName} is not a function` };
    }
    const autoUpgrades = autoStrategy ? { strategy: autoStrategy } : null;
    try {
      if (mode === 'segment') {
        const segments = [];
        for (const segment of plan) {
          const payload = { ...segment };
          if (autoUpgrades) payload.autoUpgrades = autoUpgrades;
          const result = await runner.call(progression, payload);
          segments.push({ segment: payload, result });
        }
        return { ok: true, mode, runner: runnerName, segments };
      }
      const payload = { segments: plan.map((segment) => ({ ...segment })), autoUpgrades };
      const result = await runner.call(progression, payload);
      return { ok: true, mode, runner: runnerName, segments: [{ segment: payload, result }] };
    } catch (error) {
      return wrapError(error);
    }
  }, { runnerName, mode, plan, autoStrategy });
}

export default async function runProgressionRun(context) {
  const {
    log,
    ensurePlayingState,
    captureTelemetry,
    screenshot,
    wait,
    page,
  } = context;

  const plan = parsePlanSpec(context.options || {});
  if (plan.length === 0) {
    throw new Error('Progression plan resolved to zero segments. Provide --progressionPlan or --progressionBiomes.');
  }

  const autoStrategy = (context.options?.autoUpgradeStrategy || 'first-card').toString();

  log(`[progression] Plan contains ${plan.length} segment(s)`);
  plan.forEach((segment, index) => {
    log(`  Segment ${index + 1}: biome=${segment.biome}, levels=${segment.levelCount}${segment.stopAfterBoss ? ' (stopAfterBoss)' : ''}`);
  });

  await ensurePlayingState();

  const progressionInfo = await detectProgression(page);
  if (!progressionInfo.available) {
    log('[progression] API missing, marking scenario as blocked.');
    return {
      blocked: 'progression API missing',
      plan,
      progression: progressionInfo,
    };
  }

  const methods = progressionInfo.methods || [];
  const runnerName = SEGMENT_RUNNERS.find((name) => methods.includes(name))
    || PLAN_RUNNERS.find((name) => methods.includes(name));

  if (!runnerName) {
    log('[progression] No supported runner methods (runSegment/runPlan) were detected.');
    return {
      blocked: 'progression API present but no runner method (need runSegment or runPlan)',
      plan,
      progression: progressionInfo,
    };
  }

  const mode = SEGMENT_RUNNERS.includes(runnerName) ? 'segment' : 'plan';
  log(`[progression] Using progression.${runnerName} in ${mode} mode with strategy ${autoStrategy}`);

  const execution = await runPlanOnPage({ page, runnerName, mode, plan, autoStrategy });
  if (!execution.ok) {
    log(`[progression] Runner failed: ${execution.reason || 'unknown error'}`);
  }

  const telemetry = [];
  if (execution.ok) {
    const captureCount = mode === 'segment' ? plan.length : 1;
    for (let i = 0; i < captureCount; i += 1) {
      const segment = mode === 'segment' ? plan[i] : { summary: `plan-${i + 1}` };
      const labelParts = [segment.biome || segment.summary || 'progression', `step-${i + 1}`];
      if (segment.levelCount) {
        labelParts.push(`levels-${segment.levelCount}`);
      }
      const telemetryTag = labelParts.filter(Boolean).join('-');
      const snapshot = await captureTelemetry(telemetryTag);
      telemetry.push({
        segment,
        telemetry: snapshot.data,
        file: snapshot.file,
      });
      await wait(300);
    }
    await screenshot('progression-run-end').catch(() => {});
  }

  return {
    plan,
    progression: progressionInfo,
    runner: runnerName,
    mode,
    autoUpgradeStrategy: autoStrategy,
    result: execution,
    telemetry: telemetry.map((entry) => ({
      segment: entry.segment,
      file: entry.file,
    })),
    blocked: execution.ok ? null : (execution.reason || 'runner error'),
  };
}
