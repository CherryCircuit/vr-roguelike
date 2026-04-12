// ============================================================
//  DEV TOOLS LAUNCHER
//  Dev-only HTML controls and console mirroring for the separate launcher.
// ============================================================

import { game, saveDebugSettings } from './game.js';
import {
  getRuntimeConfig,
  setDevFlag,
  setSeedSelection,
  queueDebugJump,
  invokeRuntimeAction,
} from './runtime-config.js';

const runtimeConfig = getRuntimeConfig();
if (!runtimeConfig.dev.enabled) {
  // Safety: dev tools should do nothing if accidentally loaded by the live page.
} else {
  installDevPanel();
}

function hashSeedString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function installDevPanel() {
  const params = new URLSearchParams(location.search);
  const panel = document.getElementById('debug-panel');
  const toggle = document.getElementById('debug-toggle');
  const consolePanel = document.getElementById('console-panel');
  const consoleLogs = document.getElementById('console-logs');
  const seedControls = document.getElementById('seed-controls');
  const seedInput = document.getElementById('seed-input');
  const seedTier = document.getElementById('seed-tier');
  const dailySeedBtn = document.getElementById('daily-seed-btn');
  const weeklySeedBtn = document.getElementById('weekly-seed-btn');
  const copyLogBtn = document.getElementById('copy-log-btn');
  const perfCheckbox = document.getElementById('debug-perf-monitor');
  const fpsCheckbox = document.getElementById('debug-show-fps');
  const consoleCheckbox = document.getElementById('debug-console');
  const positionCheckbox = document.getElementById('debug-position-panel');
  const seedCheckbox = document.getElementById('debug-seed-controls');
  const jumpButton = document.getElementById('debug-jump');
  const jumpInput = document.getElementById('debug-level');
  const nextBiomeBtn = document.getElementById('debug-next-biome');

  if (!panel || !toggle) return;

  panel.style.display = params.get('debug') === '1' ? 'block' : 'none';
  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  runtimeConfig.dev.showFPS = game.debugShowFPS === true;
  runtimeConfig.dev.perfMonitor = game.debugPerfMonitor === true;
  runtimeConfig.dev.positionPanel = game.debugShowPosition === true;
  setDevFlag('seedControls', false);

  if (fpsCheckbox) fpsCheckbox.checked = runtimeConfig.dev.showFPS;
  if (perfCheckbox) perfCheckbox.checked = runtimeConfig.dev.perfMonitor;
  if (positionCheckbox) positionCheckbox.checked = runtimeConfig.dev.positionPanel;
  if (seedCheckbox) seedCheckbox.checked = runtimeConfig.dev.seedControls;
  if (consoleCheckbox) consoleCheckbox.checked = runtimeConfig.dev.debugConsole;
  if (consolePanel) consolePanel.style.display = runtimeConfig.dev.debugConsole ? 'block' : 'none';
  if (seedControls) seedControls.style.display = runtimeConfig.dev.seedControls ? 'block' : 'none';

  invokeRuntimeAction('setFpsVisible', runtimeConfig.dev.showFPS);

  if (jumpButton && jumpInput) {
    jumpButton.addEventListener('click', () => {
      const level = parseInt(jumpInput.value, 10) || 1;
      queueDebugJump(Math.max(1, Math.min(20, level)));
    });
  }

  if (perfCheckbox) {
    perfCheckbox.addEventListener('change', function onPerfToggle() {
      runtimeConfig.dev.perfMonitor = this.checked;
      game.debugPerfMonitor = this.checked;
      saveDebugSettings();
    });
  }

  if (fpsCheckbox) {
    fpsCheckbox.addEventListener('change', function onFpsToggle() {
      runtimeConfig.dev.showFPS = this.checked;
      game.debugShowFPS = this.checked;
      saveDebugSettings();
      invokeRuntimeAction('setFpsVisible', this.checked);
    });
  }

  if (positionCheckbox) {
    positionCheckbox.addEventListener('change', function onPositionToggle() {
      runtimeConfig.dev.positionPanel = this.checked;
      game.debugShowPosition = this.checked;
      saveDebugSettings();
    });
  }

  if (consoleCheckbox && consolePanel) {
    consoleCheckbox.addEventListener('change', function onConsoleToggle() {
      runtimeConfig.dev.debugConsole = this.checked;
      consolePanel.style.display = this.checked ? 'block' : 'none';
    });
  }

  if (seedCheckbox && seedControls) {
    seedCheckbox.addEventListener('change', function onSeedToggle() {
      setDevFlag('seedControls', this.checked);
      seedControls.style.display = this.checked ? 'block' : 'none';
    });
  }

  if (nextBiomeBtn) {
    nextBiomeBtn.addEventListener('click', () => {
      invokeRuntimeAction('cycleBiomeWithFade');
    });
  }

  if (seedInput) {
    seedInput.addEventListener('change', function onSeedChange() {
      const value = this.value.trim();
      const seed = value ? hashSeedString(value) : null;
      setSeedSelection(seed, runtimeConfig.seed.tier);
      console.log('[seed] User seed set:', runtimeConfig.seed.value);
    });
  }

  if (seedTier) {
    seedTier.value = runtimeConfig.seed.tier;
    seedTier.addEventListener('change', function onTierChange() {
      setSeedSelection(runtimeConfig.seed.value, this.value);
      console.log('[seed] Tier set:', runtimeConfig.seed.tier);
    });
  }

  if (dailySeedBtn) {
    dailySeedBtn.addEventListener('click', () => {
      const dailySeed = Math.floor(Date.now() / 86400000);
      setSeedSelection(dailySeed, runtimeConfig.seed.tier);
      if (seedInput) seedInput.value = 'DAILY';
      console.log('[seed] Daily seed:', dailySeed);
    });
  }

  if (weeklySeedBtn) {
    weeklySeedBtn.addEventListener('click', () => {
      const weeklySeed = Math.floor(Date.now() / 604800000);
      setSeedSelection(weeklySeed, runtimeConfig.seed.tier);
      if (seedInput) seedInput.value = 'WEEKLY';
      console.log('[seed] Weekly seed:', weeklySeed);
    });
  }

  if (copyLogBtn && consoleLogs) {
    copyLogBtn.addEventListener('click', () => {
      const logs = consoleLogs.textContent || '';
      navigator.clipboard.writeText(logs).then(() => {
        copyLogBtn.textContent = 'COPIED';
        setTimeout(() => { copyLogBtn.textContent = 'COPY LOG'; }, 2000);
      }).catch((err) => {
        console.error('Copy failed:', err);
      });
    });
  }

  if (consolePanel) {
    consolePanel.addEventListener('click', () => {
      consolePanel.style.display = 'none';
      if (consoleCheckbox) consoleCheckbox.checked = false;
      runtimeConfig.dev.debugConsole = false;
    });
  }

  installConsoleMirroring(consoleLogs);
}

function installConsoleMirroring(consoleLogs) {
  if (!consoleLogs) return;

  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalInfo = console.info.bind(console);
  const originalDebug = console.debug.bind(console);

  function appendConsoleLine(color, prefix, args) {
    if (!runtimeConfig.dev.debugConsole) return;
    const message = Array.from(args).map((arg) => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (err) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    const div = document.createElement('div');
    div.style.color = color;
    div.textContent = `[${prefix}] ${message}`;
    consoleLogs.appendChild(div);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
    if (consoleLogs.children.length > 100) {
      consoleLogs.removeChild(consoleLogs.firstChild);
    }
  }

  console.log = function devLogWrapper(...args) {
    originalLog(...args);
    appendConsoleLine('#00ffff', 'LOG', args);
  };

  console.error = function devErrorWrapper(...args) {
    originalError(...args);
    appendConsoleLine('#ff4444', 'ERROR', args);
  };

  console.warn = function devWarnWrapper(...args) {
    originalWarn(...args);
    appendConsoleLine('#ffff44', 'WARN', args);
  };

  console.info = function devInfoWrapper(...args) {
    originalInfo(...args);
    appendConsoleLine('#44ffff', 'INFO', args);
  };

  console.debug = function devDebugWrapper(...args) {
    originalDebug(...args);
    appendConsoleLine('#888888', 'DEBUG', args);
  };
}
