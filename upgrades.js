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
  
  // New universal upgrades (issue #36)
  { id: 'execute', name: 'Execute', desc: '+40% damage to enemies below 25% health', color: '#ff0044' },
  { id: 'magnetic', name: 'Magnetic', desc: 'Shots tag enemies, tagged enemies pull together', color: '#4488ff' },
  { id: 'reflex', name: 'Reflex', desc: '+100% fire rate for 2s after taking damage (10s cooldown)', color: '#ffaa00' },
  { id: 'hollow_point', name: 'Hollow-Point', desc: '+15% damage', color: '#ff8888' },
  { id: 'nova_tip', name: 'Nova Tip', desc: 'Every 12th shot detonates AoE (60 damage)', color: '#ff44ff' },
  { id: 'siphon', name: 'Siphon', desc: 'Every 15 kills reduces ALT cooldown by 25%', color: '#aa88ff' },

  // Alt weapons (unlocked as upgrades)
  { id: 'alt_shield', name: 'SHIELD', desc: 'Blocks enemy projectiles', color: '#4488ff', type: 'alt', sideGradeNote: 'ALT FIRE ABILITY' },
  { id: 'alt_grenade', name: 'GRENADE', desc: 'Throwable explosive', color: '#ff4444', type: 'alt', sideGradeNote: 'ALT FIRE ABILITY' },
  { id: 'alt_mine', name: 'MINE', desc: 'Placeable explosive trap', color: '#ffaa00', type: 'alt', sideGradeNote: 'ALT FIRE ABILITY' },
  { id: 'alt_drone', name: 'DRONE', desc: 'Auto-targeting helper', color: '#88ff88', type: 'alt', sideGradeNote: 'ALT FIRE ABILITY' },

  // Standard Blaster specific
  { id: 'triple_shot', name: 'Triple Shot', desc: 'Fire two extra projectiles', color: '#00ffff', requiresWeapon: 'STANDARD' },

  // Buckshot specific
  { id: 'focused_frenzy', name: 'Focused Frenzy', desc: 'Buckshot: Tighter spread + faster fire', color: '#ff8800', requiresWeapon: 'BUCKSHOT' },
  { id: 'buckshot_gentlemen', name: 'Buckshot Gentlemen', desc: 'Buckshot: +4 pellets', color: '#ff8800', requiresWeapon: 'BUCKSHOT' },
  { id: 'duck_hunt', name: 'Duck Hunt', desc: 'Buckshot: Critical hits stun', color: '#ff8800', requiresWeapon: 'BUCKSHOT' },

  // Lightning Rod specific
  { id: 'its_electric', name: 'It\'s Electric!', desc: 'Lightning Rod: Chains to +2 enemies', color: '#ff00ff', requiresWeapon: 'LIGHTNING' },
  { id: 'tesla_coil', name: 'Tesla Coil', desc: 'Lightning Rod: +50% damage, +20% range', color: '#ff00ff', requiresWeapon: 'LIGHTNING' },

  // Charge Cannon specific
  { id: 'quick_charge', name: 'Ain\'t Nobody Got Time For That', desc: 'Charge Cannon: 2x charge speed', color: '#ff4444', requiresWeapon: 'CHARGE' },
  { id: 'excess_heat', name: 'Excess Heat', desc: 'Charge Cannon: Adds fire DoT to charged shots', color: '#ff4444', requiresWeapon: 'CHARGE' },
  { id: 'death_ray', name: 'Death Ray', desc: 'Charge Cannon: +100% max charge damage', color: '#ff4444', requiresWeapon: 'CHARGE' },

  // Plasma Carbine specific
  { id: 'hold_together', name: 'Hold It Together', desc: 'Plasma Carbine: Faster ramp-up, higher max', color: '#88ff88', requiresWeapon: 'PLASMA' },

  // Seeker Burst specific
  { id: 'gimme_more', name: 'Gimme Gimme More', desc: 'Seeker Burst: +2 homing shots per burst', color: '#aa88ff', requiresWeapon: 'SEEKER' },
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
 * Check if an upgrade is an alt weapon type
 */
export function isAltWeaponUpgrade(upgradeId) {
  const def = getUpgradeDef(upgradeId);
  return def && def.type === 'alt';
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
    chargeSpeedMultiplier: u.quick_charge ? 2.0 : 1.0,
    chargeDamageMultiplier: u.death_ray ? 6.0 : 3.0,  // 3x base, 6x with Death Ray
    plasmaCarbine: (u.plasma_carbine || 0) > 0,
    damageRampUp: (u.plasma_carbine || 0) > 0,
    damageRampUpMax: u.hold_together ? 3.0 : 2.0,  // 2x base, 3x with Hold Together
    seekerBurst: (u.seeker_burst || 0) > 0,
    homing: (u.seeker_burst || 0) > 0,
    homingRange: 15,
    excessHeat: u.excess_heat || false,  // Adds fire DoT to charge shots
    
    // New universal upgrades (issue #36)
    execute: (u.execute || 0) > 0,  // +40% damage to enemies below 25% health
    executeDamageMultiplier: 1.4,  // 40% more damage
    magnetic: (u.magnetic || 0) > 0,  // Shots tag enemies, tagged enemies pull together
    reflex: (u.reflex || 0) > 0,  // +100% fire rate for 2s after taking damage
    reflexFireRateMultiplier: 0.5,  // Half fire interval (2x speed)
    reflexDuration: 2000,  // 2 seconds in ms
    reflexCooldown: 10000,  // 10 seconds in ms
    novaTip: (u.nova_tip || 0) > 0,  // Every 12th shot detonates AoE
    novaTipInterval: 12,  // Every 12th shot
    novaTipDamage: 60,  // 60 damage AoE
    siphon: (u.siphon || 0) > 0,  // Every 15 kills reduces ALT cooldown by 25%
    siphonKillInterval: 15,  // Every 15 kills
    siphonCooldownReduction: 0.25,  // 25% reduction
    
    // RARE upgrades (Level 5 boss)
    addHeart: (u.add_heart || 0) > 0,  // +1 max health
    volatile: (u.volatile || 0) > 0,  // Enemies explode on death
    volatileDamage: 30,  // 30 damage explosion
    volatileRadius: 2.0,  // 2m radius
    secondWind: (u.second_wind || 0) > 0,  // Survive fatal hit once per level
    critCore: (u.crit_core || 0) > 0,  // +50% crit damage, +10% crit chance
    cooldownTuner: (u.cooldown_tuner || 0) > 0,  // -30% ALT cooldowns
    altCooldownMultiplier: u.cooldown_tuner ? 0.7 : 1.0,  // 30% reduction
    
    // EPIC upgrades (Level 10 boss)
    neonOverdrive: (u.neon_overdrive || 0) > 0,  // After 30 kills: buff for 8s
    neonOverdriveKillThreshold: 30,  // 30 kills to activate
    neonOverdriveDuration: 8000,  // 8 seconds
    neonOverdriveDamageMultiplier: 1.2,  // +20% damage
    neonOverdriveFireRateMultiplier: 0.833,  // +20% fire rate (1/1.2)
    heavyHunter: (u.heavy_hunter || 0) > 0,  // +35% damage to tanks/bosses
    heavyHunterDamageMultiplier: 1.35,  // +35% damage
    heavyHunterHealAmount: 1,  // Heal 1 HP on boss damage
    
    // ULTRA upgrades (Level 15 boss)
    timeLord: (u.time_lord || 0) > 0,  // ALT usage causes 5s slow-time
    timeLordSlowDuration: 5000,  // 5 seconds
    timeLordSlowFactor: 0.3,  // 30% speed
    deathAura: (u.death_aura || 0) > 0,  // Continuous damage to nearby enemies
    deathAuraRadius: 3.0,  // 3m radius
    deathAuraDamage: 5,  // 5 damage per tick
    deathAuraTickInterval: 500,  // 0.5s ticks
    infinityLoop: (u.infinity_loop || 0) > 0,  // Repeat last ALT at 40% power every 10s
    infinityLoopInterval: 10000,  // 10 seconds
    infinityLoopPowerMultiplier: 0.4,  // 40% power
    hyperCrit: (u.hyper_crit || 0) > 0,  // +50% crit chance, crits create shockwaves
    hyperCritShockwaveRadius: 3.0,  // 3m radius
    hyperCritShockwaveDamage: 40,  // 40 damage
  };
}
