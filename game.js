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

// ── Build config for a single level ────────────────────────
function buildLevel(n) {
  let killTarget;
  if (n === 20)       killTarget = 50;   // final level (boss placeholder)
  else if (n <= 5)    killTarget = 12 + n * 3;          // 15–27
  else if (n <= 10)   killTarget = 25 + (n - 5) * 8;   // 33–65
  else if (n <= 15)   killTarget = 65 + (n - 10) * 15;  // 80–140
  else                killTarget = 140 + (n - 15) * 25; // 165–240

  return {
    level: n,
    isBoss: n % 5 === 0,
    killTarget,
    hpMultiplier:    1 + Math.pow(n - 1, 1.5) * 0.15,
    speedMultiplier: 1 + (n - 1) * 0.09,
    spawnInterval:   Math.max(0.4, 2.0 - n * 0.08),
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
  upgrades:     {},      // { upgradeId: stackCount }
  stateTimer:   0,
  spawnTimer:   0,
  killsWithoutHit: 0,    // for combo tracking
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
    upgrades:     {},
    stateTimer:   0,
    spawnTimer:   0,
    killsWithoutHit: 0,
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

export function addUpgrade(id) {
  game.upgrades[id] = (game.upgrades[id] || 0) + 1;
}
