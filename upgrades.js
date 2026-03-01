// ============================================================
//  UPGRADE DEFINITIONS & WEAPON STATS
//  Defines the pool of upgrades and computes weapon stats
//  from the player's stacked upgrades.
// ============================================================

// ── Weapon Type Enum ──────────────────────────────────────
export const WEAPON_TYPES = {
  STANDARD: 'standard',
  BUCKSHOT: 'buckshot',
  LIGHTNING: 'lightning',
  CHARGE: 'charge',
  PLASMA: 'plasma',
  SEEKER: 'seeker',
};

export const UPGRADE_POOL = [
  { id: 'scope', name: 'Scope', desc: 'Damage +10 per stack', color: '#00ff44' },
  { id: 'barrel', name: 'Barrel', desc: 'Fire rate +15%', color: '#ffaa00' },
  { id: 'shock', name: 'Shock', desc: 'Electrocutes: slows + shock DoT', color: '#4488ff' },
  { id: 'fire', name: 'Fire', desc: 'Ignites: weakens + fire DoT', color: '#ff4400' },
  { id: 'big_boom', name: 'Big Boom', desc: 'Explodes on impact (AOE)', color: '#ff8800' },
  
  // Side-grade weapon types (change shot type)
  { id: 'buckshot', name: 'Buckshot', desc: 'Multi-pellet spread shot', color: '#ff8800', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
  { id: 'lightning', name: 'Lightning Rod', desc: 'Hold for auto-lock beam', color: '#ff00ff', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
  { id: 'charge_shot', name: 'Charge Cannon', desc: 'Hold to charge, release for big beam', color: '#ff4444', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
  { id: 'plasma_carbine', name: 'Plasma Carbine', desc: 'Fast fire, damage ramps up', color: '#88ff88', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
  { id: 'seeker_burst', name: 'Seeker Burst', desc: 'Fires 3 homing shots', color: '#aa88ff', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
  
  // Universal upgrades
  { id: 'piercing', name: 'Piercing', desc: 'Shots pass through enemies', color: '#00ffaa' },
  { id: 'vampiric', name: 'Vampiric', desc: 'Heal half-heart every 5 kills', color: '#cc0044' },
  { id: 'critical', name: 'Critical', desc: '+15% chance for 2x damage', color: '#ffff00' },
  { id: 'double_shot', name: 'Doubleshot', desc: 'Fire an extra projectile', color: '#ff44ff' },
  { id: 'freeze', name: 'Freeze', desc: 'Greatly slows enemies', color: '#88ccff' },
  { id: 'ricochet', name: 'Ricochet', desc: 'Shots bounce to nearby enemy', color: '#aaffaa' },
];

/** RARE upgrades offered after Level 5 boss */
export const RARE_UPGRADE_POOL = [
  { id: 'add_heart', name: 'ADD 1 HEART', desc: 'Max health +1', color: '#ff4488', tier: 'rare', level: 5 },
  { id: 'volatile', name: 'VOLATILE', desc: 'Enemies explode on death', color: '#ff8844', tier: 'rare', level: 5 },
  { id: 'second_wind', name: 'SECOND WIND', desc: 'Survive fatal hit once per level', color: '#44ff88', tier: 'rare', level: 5 },
  { id: 'crit_core', name: 'CRIT CORE', desc: '+50% crit damage, +10% crit chance', color: '#ffff44', tier: 'rare', level: 5 },
  { id: 'cooldown_tuner', name: 'COOLDOWN TUNER', desc: '-30% ALT cooldowns', color: '#4488ff', tier: 'rare', level: 5 },
];

/** EPIC upgrades offered after Level 10 boss */
export const EPIC_UPGRADE_POOL = [
  { id: 'neon_overdrive', name: 'NEON OVERDRIVE', desc: 'After 30 kills: +20% damage/fire rate for 8s', color: '#ff00ff', tier: 'epic', level: 10 },
  { id: 'heavy_hunter', name: 'HEAVY HUNTER', desc: '+35% damage to tanks/bosses, heal on boss damage', color: '#00ffff', tier: 'epic', level: 10 },
];

/** ULTRA upgrades offered after Level 15 boss */
export const ULTRA_UPGRADE_POOL = [
  { id: 'time_lord', name: 'TIME LORD', desc: 'ALT usage causes 5s slow-time', color: '#aa00ff', tier: 'ultra', level: 15 },
  { id: 'death_aura', name: 'DEATH AURA', desc: 'Continuous damage to nearby enemies', color: '#ff0000', tier: 'ultra', level: 15 },
  { id: 'infinity_loop', name: 'INFINITY LOOP', desc: 'Repeat last ALT at 40% power every 10s', color: '#8800ff', tier: 'ultra', level: 15 },
  { id: 'hyper_crit', name: 'HYPER CRIT', desc: '+50% crit chance, crits create shockwaves', color: '#ffaa00', tier: 'ultra', level: 15 },
];

/** Combined special upgrade pool (for backward compatibility) */
export const SPECIAL_UPGRADE_POOL = [
  ...RARE_UPGRADE_POOL,
  ...EPIC_UPGRADE_POOL,
  ...ULTRA_UPGRADE_POOL,
];

/** Get upgrades by tier */
export function getUpgradesByTier(level) {
  if (level >= 15) return ULTRA_UPGRADE_POOL;
  if (level >= 10) return EPIC_UPGRADE_POOL;
  if (level >= 5) return RARE_UPGRADE_POOL;
  return [];
}

/** Pick `count` random special upgrades (for after boss) */
export function getRandomSpecialUpgrades(count) {
  const shuffled = [...SPECIAL_UPGRADE_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Determine the weapon type from the player's current upgrades.
 * @param {Object} upgrades  e.g. { buckshot: 1, scope: 2 }
 * @returns {string} Weapon type from WEAPON_TYPES
 */
export function getWeaponType(upgrades) {
  const u = upgrades || {};
  if (u.buckshot) return WEAPON_TYPES.BUCKSHOT;
  if (u.lightning) return WEAPON_TYPES.LIGHTNING;
  if (u.charge_shot) return WEAPON_TYPES.CHARGE;
  if (u.plasma_carbine) return WEAPON_TYPES.PLASMA;
  if (u.seeker_burst) return WEAPON_TYPES.SEEKER;
  return WEAPON_TYPES.STANDARD;
}

/**
 * Pick `count` random upgrades from the pool, optionally excluding some IDs.
 * CRITICAL FIX: Filter out weapon-specific upgrades if player doesn't have that weapon.
 * @param {number} count - Number of upgrades to return
 * @param {Array} excludeIds - IDs to exclude
 * @param {Object} currentUpgrades - Player's current upgrades for this hand (to check weapon type)
 */
export function getRandomUpgrades(count, excludeIds = [], currentUpgrades = {}) {
  const excludeSet = new Set(excludeIds);
  const currentWeaponType = getWeaponType(currentUpgrades);

  const pool = UPGRADE_POOL.filter(u => {
    // Exclude if in excludeSet
    if (excludeSet.has(u.id)) return false;

    // If upgrade requires a specific weapon, check if player has it
    if (u.requiresWeapon) {
      const requiredType = WEAPON_TYPES[u.requiresWeapon.toUpperCase()];
      if (currentWeaponType !== requiredType) {
        return false; // Don't offer weapon-specific upgrades if player doesn't have that weapon
      }
    }

    return true;
  });

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Pick one random upgrade excluding given ids (for side-grade replacement card) */
export function getRandomUpgradeExcluding(excludeIds = []) {
  const set = new Set(excludeIds);
  const pool = UPGRADE_POOL.filter(u => !set.has(u.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Look up an upgrade definition by id */
export function getUpgradeDef(id) {
  return UPGRADE_POOL.find(u => u.id === id) || null;
}

/**
 * Compute effective weapon stats from the player's upgrade inventory.
 * @param {Object} upgrades  e.g. { scope: 3, fire: 1 }
 * @returns {Object} weapon stats
 */
export function getWeaponStats(upgrades) {
  const u = upgrades || {};

  // Base values (include special boss upgrades)
  let damage = 15 + (u.scope || 0) * 10 + (u.mega_scope || 0) * 25;
  let fireInterval = (300 / (1 + (u.barrel || 0) * 0.15 + (u.turbo_barrel || 0) * 0.3)) * 0.57;
  let projectileCount = 1 + (u.double_shot || 0) + (u.triple_shot || 0) * 2;
  let critChance = Math.min((u.critical || 0) * 0.15 + (u.super_crit || 0) * 0.25, 0.9);
  
  // Crit Core: +10% crit chance
  if (u.crit_core) critChance += 0.1;
  
  // Hyper Crit: +50% crit chance
  if (u.hyper_crit) critChance += 0.5;
  
  // Cap at 100%
  critChance = Math.min(critChance, 1.0);
  let piercing = (u.piercing || 0) > 0 || (u.overcharge || 0) > 0;
  let aoeRadius = (u.big_boom || 0) > 0 || (u.mega_boom || 0) > 0
    ? 0.5 + ((u.big_boom || 0) + (u.mega_boom || 0) * 1.5) * 0.3
    : 0;
  let spreadAngle = 0;

  // Fire effect: enemies take +15% damage per stack
  const fireWeakenMult = 1 + (u.fire || 0) * 0.15;

  // Buckshot replaces normal projectiles with a spread
  if (u.buckshot) {
    const s = u.buckshot;
    projectileCount = s === 1 ? 5 : s === 2 ? 8 : s === 3 ? 11 : 11 + (s - 3);
    spreadAngle = 0.0524; // 3 degrees (PI/180 * 3)
    damage *= 1.25;      // Higher damage per pellet
    fireInterval *= 3.0; // EVEN SLOWER fire rate for heavy shotgun feel
    
    // Buckshot-specific upgrades
    if (u.focused_frenzy) {
      spreadAngle *= 0.5;  // Tighter spread
      fireInterval *= 0.7;  // Faster fire
    }
    if (u.buckshot_gentlemen) {
      projectileCount += 4;  // +4 pellets
    }
  }

  // Plasma Carbine: fast fire with damage ramp-up
  if (u.plasma_carbine) {
    damage = 6 + (u.scope || 0) * 10;  // Lower base damage
    fireInterval = 100 / (1 + (u.barrel || 0) * 0.15);  // Fast fire
    spreadAngle = 0.0262;  // 1.5 degrees
    // Damage ramp-up is handled in main.js firing logic
    if (u.hold_together) {
      // Faster ramp-up and higher max damage
      // This is a flag checked in main.js
    }
  }

  // Seeker Burst: homing projectiles
  if (u.seeker_burst) {
    damage = 12 + (u.scope || 0) * 10;
    fireInterval = 450 / (1 + (u.barrel || 0) * 0.15);
    projectileCount = 3 + (u.gimme_more || 0) * 2;  // 3 base, +2 per upgrade
    spreadAngle = 0.1745;  // 10 degrees
    // Homing is handled in main.js projectile update
  }

  // Charge Cannon charge speed
  if (u.charge_shot && u.quick_charge) {
    // 2x charge speed is handled in main.js
  }

  // Vampiric / Life Steal: heal every N kills
  const vampiricStacks = (u.vampiric || 0) + (u.life_steal || 0) * 2;
  const vampiricInterval = vampiricStacks > 0 ? Math.max(2, (u.life_steal ? 3 : 6) - vampiricStacks) : 0;
  if (u.overcharge) damage *= 1.2;

  // Hollow-Point: +15% damage (issue #36)
  if (u.hollow_point) {
    damage *= 1.15;
  }

  // Collect status effects to apply on hit
  const effects = [];
  if (u.fire) effects.push({ type: 'fire', stacks: u.fire });
  if (u.shock) effects.push({ type: 'shock', stacks: u.shock });
  if (u.freeze) effects.push({ type: 'freeze', stacks: u.freeze });

  let critMultiplier = (u.super_crit || 0) > 0 ? 3 : 2;
  
  // Crit Core: +50% crit damage
  if (u.crit_core) critMultiplier *= 1.5;

  return {
    damage: Math.round(damage),
    fireInterval,
    projectileCount,
    critChance,
    critMultiplier,
    piercing,
    aoeRadius,
    spreadAngle,
    vampiricInterval,
    fireWeakenMult,
    effects,
    ricochetBounces: u.ricochet || 0,
    lightning: (u.lightning || 0) > 0,
    lightningRange: 8 + (u.lightning || 0) * 2 + (u.chain_lightning || 0) * 4 + (u.its_electric || 0) * 2 + (u.tesla_coil || 0) * 2,
    lightningDamage: 10 + (u.lightning || 0) * 5 + (u.chain_lightning || 0) * 5 + (u.tesla_coil || 0) * 5,
    lightningTickInterval: (u.lightning || 0) > 0 ? Math.max(0.08, 0.2 / (1 + (u.barrel || 0) * 0.15)) : 0.2,
    chargeShot: (u.charge_shot || 0) > 0,
  };
}
