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
  READY_SCREEN: 'ready_screen',
  LEVEL_INTRO: 'level_intro',
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

// Pool of bosses per tier (randomly picked for that level)
const BOSS_POOLS = {
  1: ['chrono_wraith'], // Tier 1 (Level 5)
  2: ['hunter_breakenridge', 'dj_drax', 'captain_kestrel', 'dr_aster', 'sunflare_seraph'], // Tier 2 (Level 10) - harder bosses
  3: ['chrono_wraith'], // Tier 3 (Level 15)
  4: ['chrono_wraith'], // Tier 4 (Level 20)
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

    // NEW: Weapon system
    mainWeapon: { left: 'standard_blaster', right: 'standard_blaster' },
    altWeapon: { left: null, right: null },
    altCooldowns: { left: 0, right: 0 },
    upgrades: { left: {}, right: {} },
    mainWeaponLocked: { left: false, right: false },

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

    // Reset level config to prevent stale data
    _levelConfig: null,
    _combo: 1,
  });
}

export function getLevelConfig() {
  return LEVELS[game.level - 1];
}

export function addScore(points) {
  const combo = getComboMultiplier();
  game.score += Math.floor(points * combo);
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
