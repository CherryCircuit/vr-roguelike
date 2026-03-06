// ============================================================
//  GAME STATE & LEVEL CONFIGURATION
//  Central game data — imported by all other modules.
// ============================================================

import { SeedDeck, getBiomePool } from './seed.js';

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
  DEBUG_MENU: 'debug_menu',
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
  const types = ['basic'];
  if (level >= 3) types.push('fast');
  if (level >= 5) types.push('spiral_swimmer');
  if (level >= 6) types.push('tank', 'swarm');
  if (level >= 7) types.push('geometry_shifter');
  if (level >= 9) types.push('clone_mimic');
  if (level >= 10) types.push('spider_walker', 'pulse_bomber');
  if (level >= 12) types.push('mirror_knight');
  if (level >= 14) types.push('portal_mantis');
  if (level >= 15) types.push('blackhole_totem', 'conductor');
  if (level >= 17) types.push('phase_wraith');
  return types;
}

// ── Boss tier: level 5 = tier 1, 10 = tier 2, 15 = tier 3, 20 = tier 4 ──
export function getBossTier(level) {
  if (level % 5 !== 0) return 0;
  return level / 5; // 1..4
}

// Pool of bosses per tier (randomly picked for that level)
const BOSS_POOLS = {
  // Level 5: 5 new Tier 1 bosses
  1: ['scrap_golem', 'holo_phantom', 'pulse_emitter', 'rust_serpent', 'static_wisp'],
  // Level 10: Medium bosses
  2: ['hunter_breakenridge', 'dj_drax', 'captain_kestrel', 'dr_aster', 'sunflare_seraph'],
  // Level 15: Hard bosses
  3: ['theodore_breakenridge', 'commander_halcyon', 'madame_coda', 'twin_glitch', 'neon_minotaur'],
  // Level 20: Final bosses
  4: ['walter_breakenridge', 'kernel_monolith', 'synth_kraken', 'afterimage_seraphim', 'sun_eater_train'],
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
    left: { kills: 0, totalDamage: 0 },
    right: { kills: 0, totalDamage: 0 }
  },

  justBossKill: false,
  nextUpgradeHand: 'left',  // Alternating hand for upgrades (left → right → left...)

  finalScore: 0,
  finalLevel: 0,
  accuracyStreak: 0,

  // Kill chain system (separate from accuracy streaks)
  comboCount: 0,
  comboTimer: 0,
  comboMultiplier: 1,
  lastKillTime: 0,
  comboResetTime: 3000, // 3 seconds

  // Slow-mo death camera
  slowmoActive: false,
  slowmoIntensity: 0.25, // 0.25x speed
  slowmoDuration: 1500, // 1.5 seconds
  slowmoTimer: 0,
  timeScale: 1.0,

  // DEBUG: Performance monitoring settings
  debugPerfMonitor: false,  // Extended FPS stats (frame time, memory)
  debugShowFPS: true,  // Always show FPS counter in VR
};

// ── Helpers ────────────────────────────────────────────────
export function resetGame() {
  // Preserve debug settings and seed info across resets
  const preservedDebug = {
    debugPerfMonitor: game.debugPerfMonitor,
    debugShowFPS: game.debugShowFPS,
  };
  
  const preservedSeed = {
    seed: game.seed,
    seedTier: game.seedTier,
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
      left: { kills: 0, totalDamage: 0 },
      right: { kills: 0, totalDamage: 0 }
    },
    justBossKill: false,
    nextUpgradeHand: 'left',
    finalScore: 0,
    finalLevel: 0,
    accuracyStreak: 0,

    // Reset kill chain system
    comboCount: 0,
    comboTimer: 0,
    comboMultiplier: 1,
    lastKillTime: 0,

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
  
  // Reinitialize seed deck if seed was set
  if (preservedSeed.seed !== null) {
    initSeedDeck(preservedSeed.seed, preservedSeed.seedTier);
  }
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
      game.debugShowFPS = settings.debugShowFPS ?? true;
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
    };
    localStorage.setItem('spaceomicide_debug', JSON.stringify(settings));
    console.log('[debug] Saved settings:', settings);
  } catch (e) {
    console.warn('[debug] Failed to save settings:', e);
  }
}

/**
 * Toggle performance monitor mode
 */
export function togglePerfMonitor() {
  game.debugPerfMonitor = !game.debugPerfMonitor;
  saveDebugSettings();
  return game.debugPerfMonitor;
}

/**
 * Toggle FPS display
 */
export function toggleFPSDisplay() {
  game.debugShowFPS = !game.debugShowFPS;
  saveDebugSettings();
  return game.debugShowFPS;
}

export function getLevelConfig() {
  return LEVELS[game.level - 1];
}

export function addScore(points) {
  // Apply BOTH kill chain multiplier AND accuracy multiplier
  const killChainMult = game.comboMultiplier || 1;
  const accuracyMult = getComboMultiplier();
  game.score += Math.floor(points * killChainMult * accuracyMult);
}

export function getComboMultiplier() {
  return Math.min(5, 1 + Math.floor(game.accuracyStreak / 10));
}

export function damagePlayer(amount) {
  game.health = Math.max(0, game.health - amount);
  game.killsWithoutHit = 0;
  return game.health <= 0;
}

export function healPlayer(amount) {
  game.health = Math.min(game.maxHealth, game.health + amount);
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
  if (level <= 5) {
    return 'synthwave';
  }

  const chunkIndex = Math.floor((level - 6) / 5); // 0: 6-10, 1: 11-15, 2: 16-20

  if (!game.biomeChunks) {
    game.biomeChunks = {};
  }

  if (game.biomeChunks[chunkIndex]) {
    return game.biomeChunks[chunkIndex];
  }

  const deck = getSeedDeck();
  let biomeId = null;

  if (deck && deck.deck && deck.deck.biomes.length > 0) {
    const biomePool = deck.deck.biomes;
    const biomeIndex = chunkIndex % biomePool.length;
    biomeId = biomePool[biomeIndex];
  } else {
    const biomePool = getBiomePool();
    biomeId = biomePool[Math.floor(Math.random() * biomePool.length)];
  }

  game.biomeChunks[chunkIndex] = biomeId;

  const chunkStart = 6 + chunkIndex * 5;
  const chunkEnd = chunkStart + 4;
  console.log(`[biome] Assigned biome "${biomeId}" to levels ${chunkStart}-${chunkEnd}`);

  return biomeId;
}

/**
 * Get available enemies for current level from seed deck
 */
export function getEnemiesForLevel(level) {
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
