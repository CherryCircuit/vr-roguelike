// ============================================================
//  GAME STATE & LEVEL CONFIGURATION
//  Central game data — imported by all other modules.
// ============================================================

export const State = {
  TITLE:           'title',
  PLAYING:         'playing',
  LEVEL_COMPLETE:  'level_complete',
  UPGRADE_SELECT:  'upgrade_select',
  GAME_OVER:       'game_over',
  VICTORY:         'victory',
};

// ── Enemy types available per level ────────────────────────
function getEnemyTypes(level) {
  const types = ['basic'];
  if (level >= 3)  types.push('fast');
  if (level >= 6)  types.push('tank');
  if (level >= 8)  types.push('swarm');
  return types;
}

// ── Boss tier: level 5 = tier 1, 10 = tier 2, 15 = tier 3, 20 = tier 4 ──
export function getBossTier(level) {
  if (level % 5 !== 0) return 0;
  return level / 5; // 1..4
}

// Pool of 5 boss ids per tier (picked at random for that level)
const BOSS_POOL_TIER1 = ['skull', 'cowboy', 'orb', 'serpent', 'turret'];
const BOSS_POOL_TIER2 = ['skull2', 'cowboy2', 'orb2', 'serpent2', 'turret2'];
const BOSS_POOL_TIER3 = ['skull3', 'cowboy3', 'orb3', 'serpent3', 'turret3'];
const BOSS_POOL_TIER4 = ['skull4', 'cowboy4', 'orb4', 'serpent4', 'turret4'];

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
  if (isBoss)         killTarget = 1;    // boss level: kill the boss
  else if (n === 20)  killTarget = 50;   // (non-boss final would be 50)
  else if (n <= 5)    killTarget = 12 + n * 3;          // 15–27
  else if (n <= 10)  killTarget = 25 + (n - 5) * 8;   // 33–65
  else if (n <= 15)  killTarget = 65 + (n - 10) * 15;  // 80–140
  else                killTarget = 140 + (n - 15) * 25; // 165–240

  return {
    level: n,
    isBoss,
    killTarget,
    hpMultiplier:    1 + Math.pow(n - 1, 1.5) * 0.15,
    // OLD: speedMultiplier: 1 + (n - 1) * 0.09,
    speedMultiplier: (1 + (n - 1) * 0.09) * 1.75,  // +75% enemy speed
    // OLD: spawnInterval: Math.max(0.4, 2.0 - n * 0.08),
    spawnInterval:   Math.max(0.25, (2.0 - n * 0.08) * 0.57),  // +75% spawn rate
    enemyTypes:      getEnemyTypes(n),
    airSpawns:       n >= 6,
  };
}

export const LEVELS = Array.from({ length: 20 }, (_, i) => buildLevel(i + 1));

// ── Mutable game state (shared object reference) ───────────
export const game = {
  state:        State.TITLE,
  level:        1,
  health:       6,
  maxHealth:    6,
  kills:        0,
  totalKills:   0,
  score:        0,
  nukes:        3,
  upgrades:     { left: {}, right: {} },  // separate per hand
  stateTimer:   0,
  spawnTimer:   0,
  killsWithoutHit: 0,    // for combo tracking

  // Per-hand statistics for holographic display
  handStats:    {
    left:  { kills: 0, totalDamage: 0 },
    right: { kills: 0, totalDamage: 0 }
  },

  // After boss kill, show special upgrades
  justBossKill: false,
};

// ── Helpers ────────────────────────────────────────────────
export function resetGame() {
  Object.assign(game, {
    state:        State.TITLE,
    level:        1,
    health:       6,
    kills:        0,
    totalKills:   0,
    score:        0,
    nukes:        3,
    upgrades:     { left: {}, right: {} },
    stateTimer:   0,
    spawnTimer:   0,
    killsWithoutHit: 0,
    handStats:    {
      left:  { kills: 0, totalDamage: 0 },
      right: { kills: 0, totalDamage: 0 }
    },
    justBossKill: false,
  });
}

export function getLevelConfig() {
  return LEVELS[game.level - 1];
}

export function addScore(points) {
  // Combo multiplier: every 10 kills without getting hit raises it (max 5×)
  const combo = Math.min(5, 1 + Math.floor(game.killsWithoutHit / 10));
  game.score += Math.floor(points * combo);
}

export function getComboMultiplier() {
  return Math.min(5, 1 + Math.floor(game.killsWithoutHit / 10));
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
