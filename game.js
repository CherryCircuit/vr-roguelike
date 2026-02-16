// ============================================================
//  GAME STATE & LEVEL CONFIGURATION
//  Central game data — imported by all other modules.
// ============================================================

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
  // [Power Outage Update] #3: Boss alert state before boss spawns
  BOSS_ALERT: 'boss_alert',
  // [Power Outage Update] #6: Slow-mo level complete finale
  LEVEL_COMPLETE_SLOWMO: 'level_complete_slowmo',
};

// ── Enemy types available per level ────────────────────────
function getEnemyTypes(level) {
  const types = ['basic'];
  if (level >= 3) types.push('fast');
  if (level >= 6) types.push('tank');
  if (level >= 8) types.push('swarm');
  return types;
}

// ── Boss tier: level 5 = tier 1, 10 = tier 2, 15 = tier 3, 20 = tier 4 ──
export function getBossTier(level) {
  if (level % 5 !== 0) return 0;
  return level / 5; // 1..4
}

// Pool of 5 boss ids per tier (picked at random for that level)
const BOSS_POOL_TIER1 = ['grave_voxel', 'iron_sentry', 'chrono_wraith', 'siege_ram', 'core_guardian'];
const BOSS_POOL_TIER2 = ['grave_voxel2', 'iron_sentry2', 'chrono_wraith2', 'siege_ram2', 'core_guardian2'];
const BOSS_POOL_TIER3 = ['grave_voxel3', 'iron_sentry3', 'chrono_wraith3', 'siege_ram3', 'core_guardian3'];
const BOSS_POOL_TIER4 = ['grave_voxel4', 'iron_sentry4', 'chrono_wraith4', 'siege_ram4', 'core_guardian4'];

export function getRandomBossIdForLevel(level) {
  const tier = getBossTier(level);
  if (tier === 0) return null;
  const pools = { 1: BOSS_POOL_TIER1, 2: BOSS_POOL_TIER2, 3: BOSS_POOL_TIER3, 4: BOSS_POOL_TIER4 };
  const pool = pools[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Build config for a single level ────────────────────────
function buildLevel(n) {
  let killTarget;
  const isBoss = n % 5 === 0;
  if (isBoss) killTarget = 1;    // boss level: kill the boss
  else if (n === 20) killTarget = 50;   // (non-boss final would be 50)
  else if (n <= 5) killTarget = 12 + n * 3;          // 15–27
  else if (n <= 10) killTarget = 25 + (n - 5) * 8;   // 33–65
  else if (n <= 15) killTarget = 65 + (n - 10) * 15;  // 80–140
  else killTarget = 140 + (n - 15) * 25; // 165–240

  return {
    level: n,
    isBoss,
    killTarget,
    hpMultiplier: 1 + Math.pow(n - 1, 1.5) * 0.15,
    // OLD: speedMultiplier: 1 + (n - 1) * 0.09,
    speedMultiplier: (1 + (n - 1) * 0.09) * 1.75,  // +75% enemy speed
    // OLD: spawnInterval: Math.max(0.4, 2.0 - n * 0.08),
    spawnInterval: Math.max(0.25, (2.0 - n * 0.08) * 0.57),  // +75% spawn rate
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
  upgrades: { left: {}, right: {} },  // separate per hand
  stateTimer: 0,
  spawnTimer: 0,
  killsWithoutHit: 0,    // for combo tracking

  // Per-hand statistics for holographic display
  handStats: {
    left: { kills: 0, totalDamage: 0 },
    right: { kills: 0, totalDamage: 0 }
  },

  // After boss kill, show special upgrades
  justBossKill: false,

  // [Instruction 1] First weapon offer tracking for side-grade enforcement
  firstWeaponOffered: false,
  nextUpgradeHand: null,  // 'left' or 'right', alternates after each upgrade

  // [Instruction 1] Alt weapon system (rare drops, per-hand)
  altWeapons: {
    left: null,   // Alt weapon ID or null (rocket, helper_bot, shield, gravity_well, ion_mortar, hologram)
    right: null
  },
  altCooldowns: {
    left: 0,      // Cooldown timer in seconds
    right: 0
  },
  altReadySoundPlayed: {
    left: true,   // Track if "ready" sound played for this hand
    right: true
  },

  // Scoreboard
  finalScore: 0,
  finalLevel: 0,
  accuracyStreak: 0,

  // ── GLOBAL UPGRADES (from Babylon.js merge) ─────────────────
  // These apply to both hands and persist across levels
  globalUpgrades: {
    // RARE (Tier 1)
    volatile: false,           // Enemies explode on death
    second_wind: false,        // Survive death once
    second_wind_used: false,   // Has Second Wind been consumed?

    // EPIC (Tier 2)
    neon_overdrive: false,           // Has the upgrade
    neon_overdrive_active: false,    // Currently in buff state
    neon_overdrive_kills: 0,         // Kill counter toward activation
    neon_overdrive_timer: 0,         // Time remaining in buff

    // ULTRA (Tier 3)
    time_lord: false,                // Alt weapon slows time
    time_lord_active: false,         // Time slow currently active
    time_lord_timer: 0,              // Duration remaining
    death_aura: false,               // Continuous close-range damage
    infinity_loop: false,            // Repeat last alt weapon
    infinity_loop_alt: null,         // Last alt weapon used
    infinity_loop_timer: 0,          // Timer for auto-fire

    // LEGENDARY (Tier 4)
    god_caliber: false,              // 3x all damage
    chrono_shift: false,             // Teleport on damage
    chrono_shift_cooldown: 0,        // Cooldown timer
    final_form: false,               // Start levels at max power
    soul_harvest: false,             // Kills add permanent damage
    soul_harvest_kills: 0,           // Total kills with soul harvest
    cosmic_shield: false,            // Block damage periodically
    cosmic_shield_cooldown: 0,       // Cooldown timer
    cosmic_shield_active: false,     // Currently blocking

    // Time slow effect (for Time Lord)
    time_slow_active: false,
    time_slow_multiplier: 1.0,       // 1.0 = normal, 0.25 = 75% slow
  },
};

// ── Helpers ────────────────────────────────────────────────
export function resetGame() {
  Object.assign(game, {
    state: State.TITLE,
    level: 1,
    health: 6,
    kills: 0,
    totalKills: 0,
    score: 0,
    nukes: 3,
    upgrades: { left: {}, right: {} },
    stateTimer: 0,
    spawnTimer: 0,
    killsWithoutHit: 0,
    handStats: {
      left: { kills: 0, totalDamage: 0 },
      right: { kills: 0, totalDamage: 0 }
    },
    justBossKill: false,
    // [Instruction 1] Reset first weapon offer tracking
    firstWeaponOffered: false,
    nextUpgradeHand: null,
    // [Instruction 1] Reset alt weapon state
    altWeapons: { left: null, right: null },
    altCooldowns: { left: 0, right: 0 },
    altReadySoundPlayed: { left: true, right: true },
    finalScore: 0,
    finalLevel: 0,
    accuracyStreak: 0,
  });
  resetGlobalUpgrades();
}

export function getLevelConfig() {
  return LEVELS[game.level - 1];
}

export function addScore(points) {
  // Combo multiplier: every 10 accuracy streak hits raises it (max 5×)
  const combo = getComboMultiplier();
  game.score += Math.floor(points * combo);
}

export function getComboMultiplier() {
  return Math.min(5, 1 + Math.floor(game.accuracyStreak / 10));
}

export function damagePlayer(amount) {
  game.health = Math.max(0, game.health - amount);
  game.killsWithoutHit = 0;   // reset combo
  return game.health <= 0;
}

export function healPlayer(amount) {
  game.health = Math.min(game.maxHealth, game.health + amount);
}

export function addUpgrade(id, hand) {
  const h = hand || 'left';
  game.upgrades[h][id] = (game.upgrades[h][id] || 0) + 1;
}

// ── GLOBAL UPGRADE HELPERS (from Babylon.js merge) ─────────

/**
 * Apply a global upgrade by ID (for upgrades with global: true)
 */
export function addGlobalUpgrade(id) {
  const g = game.globalUpgrades;

  switch (id) {
    // RARE (Tier 1)
    case 'add_heart':
      game.maxHealth += 2;
      game.health = Math.min(game.health + 2, game.maxHealth);
      break;
    case 'volatile':
      g.volatile = true;
      break;
    case 'second_wind':
      g.second_wind = true;
      g.second_wind_used = false;
      break;

    // EPIC (Tier 2)
    case 'neon_overdrive':
      g.neon_overdrive = true;
      g.neon_overdrive_kills = 0;
      break;

    // ULTRA (Tier 3)
    case 'time_lord':
      g.time_lord = true;
      break;
    case 'death_aura':
      g.death_aura = true;
      break;
    case 'infinity_loop':
      g.infinity_loop = true;
      g.infinity_loop_timer = 0;
      break;

    // LEGENDARY (Tier 4)
    case 'god_caliber':
      g.god_caliber = true;
      break;
    case 'chrono_shift':
      g.chrono_shift = true;
      g.chrono_shift_cooldown = 0;
      break;
    case 'final_form':
      g.final_form = true;
      break;
    case 'soul_harvest':
      g.soul_harvest = true;
      break;
    case 'cosmic_shield':
      g.cosmic_shield = true;
      g.cosmic_shield_cooldown = 0;
      break;
  }
}

/**
 * Check if a global upgrade is active
 */
export function hasGlobalUpgrade(id) {
  const g = game.globalUpgrades;

  switch (id) {
    case 'volatile': return g.volatile;
    case 'second_wind': return g.second_wind && !g.second_wind_used;
    case 'neon_overdrive': return g.neon_overdrive;
    case 'neon_overdrive_active': return g.neon_overdrive_active;
    case 'time_lord': return g.time_lord;
    case 'death_aura': return g.death_aura;
    case 'infinity_loop': return g.infinity_loop;
    case 'god_caliber': return g.god_caliber;
    case 'chrono_shift': return g.chrono_shift;
    case 'final_form': return g.final_form;
    case 'soul_harvest': return g.soul_harvest;
    case 'cosmic_shield': return g.cosmic_shield;
    default: return false;
  }
}

/**
 * Get global upgrades state for weapon stats calculation
 */
export function getGlobalUpgradesState() {
  const g = game.globalUpgrades;
  return {
    volatile: g.volatile,
    neon_overdrive_active: g.neon_overdrive_active,
    time_lord: g.time_lord,
    death_aura: g.death_aura,
    infinity_loop: g.infinity_loop,
    god_caliber: g.god_caliber,
    chrono_shift: g.chrono_shift,
    final_form: g.final_form,
    soul_harvest: g.soul_harvest,
    soul_harvest_kills: g.soul_harvest_kills,
    cosmic_shield: g.cosmic_shield,
    cosmic_shield_active: g.cosmic_shield_active,
  };
}

/**
 * Reset global upgrades (called on new game)
 */
export function resetGlobalUpgrades() {
  game.globalUpgrades = {
    volatile: false,
    second_wind: false,
    second_wind_used: false,
    neon_overdrive: false,
    neon_overdrive_active: false,
    neon_overdrive_kills: 0,
    neon_overdrive_timer: 0,
    time_lord: false,
    time_lord_active: false,
    time_lord_timer: 0,
    death_aura: false,
    infinity_loop: false,
    infinity_loop_alt: null,
    infinity_loop_timer: 0,
    god_caliber: false,
    chrono_shift: false,
    chrono_shift_cooldown: 0,
    final_form: false,
    soul_harvest: false,
    soul_harvest_kills: 0,
    cosmic_shield: false,
    cosmic_shield_cooldown: 0,
    cosmic_shield_active: false,
    time_slow_active: false,
    time_slow_multiplier: 1.0,
  };
}
