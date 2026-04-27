// ============================================================
//  GAME STATE & LEVEL CONFIGURATION
//  Central game data — imported by all other modules.
// ============================================================

import { SeedDeck, getBiomePool } from './seed.js';

// Reset hooks — allow main.js to register cleanup callbacks called from resetGame()
const _resetHooks = [];
export function registerResetHook(fn) { _resetHooks.push(fn); }

export const State = {
  TITLE: 'title',
  PLAYING: 'playing',
  LEVEL_COMPLETE: 'level_complete',
  UPGRADE_SELECT: 'upgrade_select',
  GAME_OVER: 'game_over',
  VICTORY: 'victory',
  NAME_ENTRY: 'name_entry',
  SCOREBOARD: 'scoreboard',
  COUNTRY_SELECT: 'country_select',
  REGIONAL_SCORES: 'regional_scores',
  READY_SCREEN: 'ready_screen',
  BOSS_ALERT: 'boss_alert',
  BOSS_DEATH_CINEMATIC: 'boss_death_cinematic',
  PAUSED: 'paused',
};

// ── Seed Deck System ─────────────────────────────────────────
let seedDeck = null;

export function getSeedDeck() {
  return seedDeck;
}

export function initSeedDeck(seed, tier = 'standard') {
  seedDeck = new SeedDeck(seed, tier);
  console.log(`[seed] Initialized seed deck: ${seed} (tier: ${tier})`);
  return seedDeck;
}

// ── Enemy types available per level ────────────────────────
function getEnemyTypes(level) {
  if (level === 19) return ['tank', 'swarm'];
  const types = ['basic'];
  if (level >= 3) types.push('fast');
  if (level >= 4) types.push('tank');
  if (level >= 6) types.push('swarm');
  if (level >= 11) types.push('spiral_swimmer');
  if (level >= 13) types.push('jelly');
  if (level >= 14) types.push('conductor');
  if (level >= 17) types.push('mortar');
  return types;
}

// ── Boss tier: level 5 = tier 1, 10 = tier 2, 15 = tier 3, 20 = tier 4 ──
export function getBossTier(level) {
  if (level % 5 !== 0) return 0;
  return level / 5; // 1..4
}

// Pool of bosses per tier (randomly picked for that level)
const BOSS_POOLS = {
  // Level 5: Skull Boss
  1: ['skull_boss'],
  // Level 10: The Prism
  2: ['the_prism'],
  // Level 15: Neon Minotaur
  3: ['neon_minotaur'],
  // Level 20: Authored final boss
  4: ['eclipse_engine'],
};

export function getRandomBossIdForLevel(level) {
  const tier = getBossTier(level);
  if (tier === 0) return null;
  const pool = BOSS_POOLS[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Build config for a single level ────────────────────────
function buildLevel(n) {
  let killTarget;
  const isBoss = n % 5 === 0;
  if (isBoss) killTarget = 1;
  else if (n === 20) killTarget = 50;
  else if (n <= 5) killTarget = 12 + n * 3;
  else if (n <= 10) killTarget = 25 + (n - 5) * 8;
  else if (n <= 15) killTarget = 65 + (n - 10) * 15;
  else killTarget = 140 + (n - 15) * 25;

  return {
    level: n,
    isBoss,
    killTarget,
    hpMultiplier: 1 + Math.pow(n - 1, 1.5) * 0.15,
    speedMultiplier: (1 + (n - 1) * 0.09) * 1.75,
    spawnInterval: Math.max(0.25, (2.0 - n * 0.08) * 0.57),
    enemyTypes: getEnemyTypes(n),
    airSpawns: n >= 6,
  };
}

export const LEVELS = Array.from({ length: 20 }, (_, i) => buildLevel(i + 1));

// ── Mutable game state (shared object reference) ───────────
export const game = {
  state: State.TITLE,
  level: 1,
  health: 6,
  maxHealth: 6,
  kills: 0,
  totalKills: 0,
  score: 0,
  nukes: 3,
  
  // NEW: Seed Deck system
  seed: null,
  seedTier: 'standard',
  biomeChunks: {},
  
  // NEW: Weapon system
  mainWeapon: { left: 'standard_blaster', right: 'standard_blaster' },  // MAIN weapon per hand
  altWeapon: { left: null, right: null },  // ALT weapon per hand (unlocked via upgrades)
  altCooldowns: { left: 0, right: 0 },  // ALT weapon cooldowns (ms)
  upgrades: { left: {}, right: {} },  // Upgrades per hand
  mainWeaponLocked: { left: false, right: false },  // Whether MAIN weapon is locked (chosen)
  
  stateTimer: 0,
  spawnTimer: 0,
  killsWithoutHit: 0,

  handStats: {
    left: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0, enemyKills: {} },
    right: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0, enemyKills: {} }
  },

  justBossKill: false,
  nextUpgradeHand: Math.random() < 0.5 ? 'left' : 'right',  // Random first hand for upgrades

  finalScore: 0,
  finalLevel: 0,

  // Accuracy Bonus system (replaces kill chain)
  accuracyBonus: 0,  // 0-100 meter
  accuracyMultiplier: 1,  // 1x-5x based on accuracy bonus
  lastHitTime: 0,
  missPenaltyMultiplier: 0.7,  // Lose ~70% on miss (was 0.5 - faster deterioration)

  // Slow-mo death camera
  slowmoActive: false,
  slowmoIntensity: 0.25, // 0.25x speed
  slowmoDuration: 1500, // 1.5 seconds
  slowmoTimer: 0,
  timeScale: 1.0,

  // DEBUG: Performance monitoring settings
  debugPerfMonitor: false,  // Extended FPS stats (frame time, memory)
  debugShowFPS: false,  // FPS counter off by default (toggle in DEBUG panel)
  debugShowPosition: false,  // Show debug position box (desktop DOM + VR toggle)
  debugBiomeOverride: null,  // Force a specific biome for previews
  inDreamWorld: false,
  dreamCompleted: false,

  // Kill tracking for Game Over display
  killedBy: null, // { type: 'enemy'|'boss'|'boss_projectile'|'explosion'|'environment', name: string, enemyType: string }

  // Run statistics for pause menu
  runStats: {
    shotsFired: 0,
    shotsHit: 0,
    totalDamageDealt: 0,
    bossesKilled: 0,
    timePlayed: 0,
    longestKillStreak: 0,
    currentKillStreak: 0,
    damageTaken: 0,
    nukesUsed: 0,
    critsLanded: 0,
    levelsCompleted: 0,
  },
};

// ── Helpers ────────────────────────────────────────────────
export function resetGame() {
  // Preserve debug settings and seed info across resets
  const preservedDebug = {
    debugPerfMonitor: game.debugPerfMonitor,
    debugShowFPS: game.debugShowFPS,
    debugShowPosition: game.debugShowPosition,
    debugBiomeOverride: game.debugBiomeOverride,
  };
  
  const preservedSeed = {
    seed: game.seed,
    seedTier: game.seedTier,
  };

  const preservedDream = {
    dreamCompleted: game.dreamCompleted,
  };
  
  Object.assign(game, {
    state: State.TITLE,
    level: 1,
    health: 6,
    kills: 0,
    totalKills: 0,
    score: 0,
    nukes: 3,

    // NEW: Weapon system
    mainWeapon: { left: 'standard_blaster', right: 'standard_blaster' },
    altWeapon: { left: null, right: null },
    altCooldowns: { left: 0, right: 0 },
    upgrades: { left: {}, right: {} },
    mainWeaponLocked: { left: false, right: false },

    // Biome chunk assignments
    biomeChunks: {},

    stateTimer: 0,
    spawnTimer: 0,
    killsWithoutHit: 0,
    handStats: {
      left: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0, enemyKills: {} },
      right: { kills: 0, totalDamage: 0, shotsFired: 0, shotsHit: 0, enemyKills: {} }
    },
    justBossKill: false,
    nextUpgradeHand: Math.random() < 0.5 ? 'left' : 'right',  // Random first hand for upgrades
    finalScore: 0,
    finalLevel: 0,

    // Accuracy Bonus reset
    accuracyBonus: 0,
    accuracyMultiplier: 1,
    lastHitTime: 0,

    // Reset kill chain system
    comboCount: 0,
    comboTimer: 0,
    comboMultiplier: 1,
    lastKillTime: 0,
    comboResetTime: 3000, // 3 seconds

    // Reset kill tracking
    killedBy: null,

    // Reset run statistics
    runStats: {
      shotsFired: 0,
      shotsHit: 0,
      totalDamageDealt: 0,
      bossesKilled: 0,
      timePlayed: 0,
      longestKillStreak: 0,
      currentKillStreak: 0,
      damageTaken: 0,
      nukesUsed: 0,
      critsLanded: 0,
      levelsCompleted: 0,
    },

    // Reset slow-mo death camera
    slowmoActive: false,
    slowmoTimer: 0,
    timeScale: 1.0,

    // Reset level config to prevent stale data
    _levelConfig: null,
    _combo: 1,

    // Restore debug settings
    ...preservedDebug,
    
    // Restore seed info
    ...preservedSeed,
  });
  

  // Restore dream state
  game.inDreamWorld = false;
  game.dreamCompleted = preservedDream.dreamCompleted;
  if (game.dreamCompleted) {
    addUpgrade('dream_fragment', 'left');
    addUpgrade('dream_fragment', 'right');
  }

  // Reinitialize seed deck if seed was set
  if (preservedSeed.seed !== null) {
    initSeedDeck(preservedSeed.seed, preservedSeed.seedTier);
  }

  // Call registered reset hooks (e.g. clearAllAltWeaponEffects from main.js)
  for (const hook of _resetHooks) hook();
}

// ── Debug Settings Helpers ──────────────────────────────────

/**
 * Load debug settings from localStorage
 */
export function loadDebugSettings() {
  try {
    const stored = localStorage.getItem('spaceomicide_debug');
    if (stored) {
      const settings = JSON.parse(stored);
      game.debugPerfMonitor = settings.debugPerfMonitor ?? false;
      game.debugShowFPS = settings.debugShowFPS ?? false;
      game.debugShowPosition = settings.debugShowPosition ?? false;
      // NOTE: debugBiomeOverride is NOT loaded - it resets on page refresh
      console.log('[debug] Loaded settings:', settings);
    }
  } catch (e) {
    console.warn('[debug] Failed to load settings:', e);
  }
}

/**
 * Save debug settings to localStorage
 */
export function saveDebugSettings() {
  try {
    const settings = {
      debugPerfMonitor: game.debugPerfMonitor,
      debugShowFPS: game.debugShowFPS,
      debugShowPosition: game.debugShowPosition,
      // NOTE: debugBiomeOverride is NOT saved - it resets on page refresh
    };
    localStorage.setItem('spaceomicide_debug', JSON.stringify(settings));
    console.log('[debug] Saved settings:', settings);
  } catch (e) {
    console.warn('[debug] Failed to save settings:', e);
  }
}

export function loadDreamState() {
  try {
    const stored = localStorage.getItem('spaceomicide_dream');
    if (stored) {
      const data = JSON.parse(stored);
      game.dreamCompleted = !!data.dreamCompleted;
      console.log('[dream] Loaded state:', data);
    }
  } catch (e) {
    console.warn('[dream] Failed to load state:', e);
  }
}

export function saveDreamState() {
  try {
    const data = {
      dreamCompleted: !!game.dreamCompleted,
    };
    localStorage.setItem('spaceomicide_dream', JSON.stringify(data));
    console.log('[dream] Saved state:', data);
  } catch (e) {
    console.warn('[dream] Failed to save state:', e);
  }
}

export function getLevelConfig() {
  return LEVELS[game.level - 1];
}

export function addScore(points) {
  const accuracyMult = game.accuracyMultiplier || 1;
  game.score += Math.floor(points * accuracyMult);
}

function getAccuracyMultiplier() {
  return game.accuracyMultiplier || 1;
}

function updateAccuracyMultiplier() {
  game.accuracyMultiplier = 1 + (game.accuracyBonus / 100) * 4;
}

export function registerAccuracyHit() {
  const bonusGain = 8;
  game.accuracyBonus = Math.min(100, game.accuracyBonus + bonusGain);
  game.lastHitTime = performance.now();
  updateAccuracyMultiplier();
}

export function registerAccuracyMiss() {
  if (game.accuracyBonus <= 0) return;
  // Quick deterioration: lose 70% on miss, plus extra decay at higher bonuses
  const baseDecay = game.missPenaltyMultiplier ?? 0.7;
  const extraDecay = (game.accuracyBonus / 100) * 0.3;  // Higher bonus = more decay
  const decayFactor = Math.max(0.15, baseDecay - extraDecay);  // Floor at 15% retained
  game.accuracyBonus = Math.max(0, Math.round(game.accuracyBonus * decayFactor));
  updateAccuracyMultiplier();
}

export function damagePlayer(amount) {
  game.health = Math.max(0, game.health - amount);
  game.killsWithoutHit = 0;
  game.runStats.damageTaken += amount;
  // Reset kill streak on damage taken
  game.runStats.currentKillStreak = 0;
  return game.health <= 0;
}

function healPlayer(amount) {
  game.health = Math.min(game.maxHealth, game.health + amount);
}

export function trackKill(isBoss = false) {
  game.totalKills++;
  game.runStats.currentKillStreak++;
  if (game.runStats.currentKillStreak > game.runStats.longestKillStreak) {
    game.runStats.longestKillStreak = game.runStats.currentKillStreak;
  }
  if (isBoss) {
    game.runStats.bossesKilled++;
  }
}

export function trackShot(hand) {
  game.runStats.shotsFired++;
  if (hand) {
    game.handStats[hand].shotsFired++;
  }
}

export function trackShotHit(damage = 0, hand) {
  game.runStats.shotsHit++;
  if (damage > 0) {
    game.runStats.totalDamageDealt += damage;
  }
  if (hand) {
    game.handStats[hand].shotsHit++;
  }
}

export function trackCrit() {
  game.runStats.critsLanded++;
}

export function addUpgrade(id, hand) {
  const h = hand || 'left';
  game.upgrades[h][id] = (game.upgrades[h][id] || 0) + 1;
}

// ── NEW: Weapon System Helpers ───────────────────────────────

/**
 * Set the MAIN weapon for a hand (locks it)
 */
export function setMainWeapon(weaponId, hand) {
  const h = hand || 'left';
  game.mainWeapon[h] = weaponId;
  game.mainWeaponLocked[h] = true;
}

/**
 * Set the ALT weapon for a hand
 */
export function setAltWeapon(weaponId, hand) {
  const h = hand || 'left';
  game.altWeapon[h] = weaponId;
}

/**
 * Get the next hand for upgrade selection (alternating)
 */
export function getNextUpgradeHand() {
  const hand = game.nextUpgradeHand;
  game.nextUpgradeHand = hand === 'left' ? 'right' : 'left';
  return hand;
}

/**
 * Check if player needs to choose a MAIN weapon (level 2, first upgrade)
 */
export function needsMainWeaponChoice() {
  // After level 1 completion, before level 2 starts
  // If neither hand has locked a main weapon yet
  return game.level === 1 && !game.mainWeaponLocked.left && !game.mainWeaponLocked.right;
}

// ── Seed Deck Helpers ───────────────────────────────────────

/**
 * Start a new game with a specific seed and tier
 */
export function startGameWithSeed(seed, tier = 'standard') {
  game.seed = seed;
  game.seedTier = tier;
  initSeedDeck(seed, tier);
  resetGame();
  game.state = State.READY_SCREEN;
  console.log(`[seed] Starting game with seed: ${seed}, tier: ${tier}`);
}

/**
 * Get current biome from seed deck (based on level)
 */
export function getBiomeForLevel(level) {
  if (game.debugBiomeOverride) {
    return game.debugBiomeOverride;
  }

  if (level <= 5) return 'synthwave_valley';
  if (level <= 10) return 'desert_night';
  if (level <= 15) return 'alien_planet';
  return 'hellscape_lava';
}

/**
 * Get available enemies for current level from seed deck
 */
function getEnemiesForLevel(level) {
  const deck = getSeedDeck();
  if (!deck) {
    // Fallback to default enemy system
    const types = ['basic'];
    if (level >= 3) types.push('fast');
    if (level >= 6) types.push('tank');
    if (level >= 8) types.push('swarm');
    return types;
  }
  
  // Determine enemy pool based on level
  const poolSize = Math.min(
    deck.deck.enemies.length,
    1 + Math.floor(level / 2)  // More enemy types at higher levels
  );
  
  return deck.deck.enemies.slice(0, poolSize);
}
