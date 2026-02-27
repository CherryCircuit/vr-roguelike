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
  BOSS_ALERT: 'boss_alert',
  LEVEL_COMPLETE_SLOWMO: 'level_complete_slowmo',
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
  2: ['hunter_breakenridge', 'dj_drax', 'captain_kestrel', 'dr_aster', 'sunflare_seraph'], // Tier 2 (Level 10)
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
  // Weapon system
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
  nextUpgradeHand: 'left',  // Alternating hand for upgrades (left → right → left...)

  firstWeaponOffered: false,
  nextUpgradeHand: null,

  // Alt weapon system (rare drops, per-hand)
  altWeapons: {
    left: null,
    right: null
  },
  altReadySoundPlayed: {
    left: true,
    right: true
  },

  finalScore: 0,
  finalLevel: 0,
  accuracyStreak: 0,

  // Global upgrades (apply to both hands, persist across levels)
  globalUpgrades: {
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
    firstWeaponOffered: false,
    nextUpgradeHand: 'left',
    altWeapons: { left: null, right: null },
    altReadySoundPlayed: { left: true, right: true },
    finalScore: 0,
    finalLevel: 0,
    accuracyStreak: 0,
    _levelConfig: null,
    _combo: 1,
  });
  resetGlobalUpgrades();
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

// ── GLOBAL UPGRADE HELPERS ─────────────────────────────────

export function addGlobalUpgrade(id) {
  const g = game.globalUpgrades;
  switch (id) {
    case 'add_heart':
      game.maxHealth += 2;
      game.health = Math.min(game.health + 2, game.maxHealth);
      break;
    case 'volatile': g.volatile = true; break;
    case 'second_wind': g.second_wind = true; g.second_wind_used = false; break;
    case 'neon_overdrive': g.neon_overdrive = true; g.neon_overdrive_kills = 0; break;
    case 'time_lord': g.time_lord = true; break;
    case 'death_aura': g.death_aura = true; break;
    case 'infinity_loop': g.infinity_loop = true; g.infinity_loop_timer = 0; break;
    case 'god_caliber': g.god_caliber = true; break;
    case 'chrono_shift': g.chrono_shift = true; g.chrono_shift_cooldown = 0; break;
    case 'final_form': g.final_form = true; break;
    case 'soul_harvest': g.soul_harvest = true; break;
    case 'cosmic_shield': g.cosmic_shield = true; g.cosmic_shield_cooldown = 0; break;
  }
}

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

// ── Weapon System Helpers ───────────────────────────────────

export function setMainWeapon(weaponId, hand) {
  const h = hand || 'left';
  game.mainWeapon[h] = weaponId;
  game.mainWeaponLocked[h] = true;
}

export function setAltWeapon(weaponId, hand) {
  const h = hand || 'left';
  game.altWeapon[h] = weaponId;
}

export function getNextUpgradeHand() {
  const hand = game.nextUpgradeHand;
  game.nextUpgradeHand = hand === 'left' ? 'right' : 'left';
  return hand;
}

export function needsMainWeaponChoice() {
  return game.level === 1 && !game.mainWeaponLocked.left && !game.mainWeaponLocked.right;
}
