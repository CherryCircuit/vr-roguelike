// ============================================================
//  UPGRADE DEFINITIONS & WEAPON STATS (Merged from Babylon.js)
//  Defines the pool of upgrades and computes weapon stats
//  from the player's stacked upgrades.
// ============================================================

// ── Weapon Types ───────────────────────────────────────────
export const WEAPON_TYPES = {
  STANDARD: 'standard',
  BUCKSHOT: 'buckshot',
  LIGHTNING: 'lightning',
  CHARGE: 'charge',
  PLASMA: 'plasma',
  SEEKER: 'seeker',
};

// ── Alt Weapon Types ───────────────────────────────────────
export const ALT_WEAPON_TYPES = {
  ROCKET: 'rocket',
  HELPER_BOT: 'helper_bot',
  SHIELD: 'shield',
  GRAVITY_WELL: 'gravity_well',
  ION_MORTAR: 'ion_mortar',
  HOLOGRAM: 'hologram',
};

// ── Alt Weapon Definitions ─────────────────────────────────
export const ALT_WEAPON_DEFS = {
  rocket: {
    name: 'Rocket Launcher',
    damage: 250,
    splashRadius: 3,
    cooldown: 15000,
    color: '#ff4444',
    iconMesh: 'rocket',
  },
  helper_bot: {
    name: 'Helper Bot',
    duration: 15000,
    damage: 15,
    fireRate: 200,
    cooldown: 30000,
    color: '#44ff44',
    iconMesh: 'robot',
  },
  shield: {
    name: 'Shield',
    maxHits: 5,
    duration: 10000,
    cooldown: 15000,
    color: '#4488ff',
    iconMesh: 'hexagon',
  },
  gravity_well: {
    name: 'Gravity Well',
    duration: 4000,
    pullRadius: 5,
    pullForce: 15,
    cooldown: 25000,
    color: '#aa44ff',
    iconMesh: 'sphere',
  },
  ion_mortar: {
    name: 'Ion Mortar',
    damage: 400,
    splashRadius: 4,
    arcingHeight: 10,
    cooldown: 20000,
    color: '#44ffaa',
    iconMesh: 'mortar',
  },
  hologram: {
    name: 'Hologram Decoy',
    duration: 6000,
    cooldown: 28000,
    color: '#44ffff',
    iconMesh: 'figure',
  },
};

export const UPGRADE_POOL = [
  // ── Standard Blaster Upgrades ─────────────────────────────
  { id: 'scope',       name: 'Scope',       desc: 'Damage +10 per stack',              color: '#00ff44' },
  { id: 'barrel',      name: 'Barrel',      desc: 'Fire rate +15%',                    color: '#ffaa00' },
  { id: 'double_shot', name: 'Double Shot', desc: 'Fire an extra projectile',          color: '#ff44ff' },
  { id: 'critical',    name: 'Critical',    desc: '+15% chance for 2x damage',         color: '#ffff00' },
  { id: 'piercing',    name: 'Piercing',    desc: 'Shots pass through enemies',        color: '#00ffaa' },

  // ── Status Effects ────────────────────────────────────────
  { id: 'shock',       name: 'Shock',       desc: 'Electrocutes: slows + shock DoT',   color: '#4488ff' },
  { id: 'fire',        name: 'Fire',        desc: 'Ignites: weakens + fire DoT',       color: '#ff4400' },
  { id: 'freeze',      name: 'Freeze',      desc: 'Greatly slows enemies',             color: '#88ccff' },

  // ── Utility Upgrades ──────────────────────────────────────
  { id: 'vampiric',    name: 'Vampiric',    desc: 'Heal half-heart every 5 kills',     color: '#cc0044' },
  { id: 'ricochet',    name: 'Ricochet',    desc: 'Shots bounce to nearby enemy',      color: '#aaffaa' },
  { id: 'big_boom',    name: 'Big Boom',    desc: 'Explodes on impact (AOE)',          color: '#ff8800' },

  // ── Weapon Type: Buckshot (Shotgun) ───────────────────────
  { id: 'buckshot',           name: 'Buckshot',           desc: 'Multi-pellet spread shot',              color: '#cccccc', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
  { id: 'buckshot_focused',   name: 'Focused Frenzy',     desc: '-25% spread for Buckshot',              color: '#88aaff', requiresWeapon: 'buckshot' },
  { id: 'buckshot_pellets',   name: 'Buckshot, Gentlemen', desc: '+50% pellets for Buckshot',            color: '#ffaa88', requiresWeapon: 'buckshot' },
  { id: 'buckshot_damage',    name: 'Duck Hunt',          desc: '+30% pellet damage for Buckshot',       color: '#ff8844', requiresWeapon: 'buckshot' },

  // ── Weapon Type: Lightning Rod ────────────────────────────
  { id: 'lightning',          name: 'Lightning Rod',      desc: 'Hold for auto-lock beam',               color: '#ffff44', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
  { id: 'lightning_chain',    name: "It's Electric!",     desc: '+2 chain targets for Lightning',        color: '#88ffff', requiresWeapon: 'lightning' },
  { id: 'lightning_tesla',    name: 'Tesla Coil',         desc: 'Auto-fire + ball attack',               color: '#ffff88', requiresWeapon: 'lightning' },

  // ── Weapon Type: Charge Cannon ────────────────────────────
  { id: 'charge_shot',        name: 'Charge Cannon',      desc: 'Hold to charge, release for big beam',  color: '#ffffff', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
  { id: 'charge_speed',       name: "Ain't Nobody Got Time For That", desc: '+50% charge speed',       color: '#ffaaff', requiresWeapon: 'charge_shot' },
  { id: 'charge_excess',      name: 'Excess Heat',        desc: '2nd shot free within 2s',               color: '#ff88ff', requiresWeapon: 'charge_shot' },
  { id: 'charge_damage',      name: 'Death Ray',          desc: '+50% charge shot damage',               color: '#ff44ff', requiresWeapon: 'charge_shot' },

  // ── Weapon Type: Plasma Carbine ───────────────────────────
  { id: 'plasma',             name: 'Plasma Carbine',     desc: 'Rapid fire, ramping damage',            color: '#44ff44', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
  { id: 'plasma_spread',      name: 'Hold It Together',   desc: '-30% spread for Plasma',                color: '#88ff88', requiresWeapon: 'plasma' },

  // ── Weapon Type: Seeker Burst ─────────────────────────────
  { id: 'seeker',             name: 'Seeker Burst',       desc: 'Homing shots',                          color: '#ff8844', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
  { id: 'seeker_more',        name: 'Gimme Gimme More',   desc: '+3 shots per burst',                    color: '#ffaa44', requiresWeapon: 'seeker' },

  // ── General Upgrades ──────────────────────────────────────
  { id: 'execute',            name: 'Execute',            desc: '+40% damage below 25% HP',              color: '#ff0044' },
  { id: 'magnetic',           name: 'Magnetic',           desc: 'Tag enemies, pull together',            color: '#4488ff' },
  { id: 'reflex',             name: 'Reflex',             desc: '+100% fire rate after taking damage',   color: '#ffff44' },
  { id: 'hollow_point',       name: 'Hollow-Point',       desc: '+15% damage',                           color: '#ff8844' },
  { id: 'nova_tip',           name: 'Nova Tip',           desc: 'Every 12th shot causes AoE',            color: '#ff44ff' },
  { id: 'siphon',             name: 'Siphon',             desc: '15 kills = 25% cooldown reduction',     color: '#aa44ff' },
];

/** Special upgrades offered after boss victories (really valuable) */
export const SPECIAL_UPGRADE_POOL = [
  { id: 'mega_scope',   name: 'Mega Scope',   desc: 'Damage +25 per stack',           color: '#00ff88' },
  { id: 'turbo_barrel',  name: 'Turbo Barrel', desc: 'Fire rate +30%',                color: '#ffcc00' },
  { id: 'triple_shot',   name: 'Triple Shot',  desc: 'Fire two extra projectiles',     color: '#ff66ff' },
  { id: 'mega_boom',     name: 'Mega Boom',   desc: 'Bigger AOE, +50% explosion dmg', color: '#ffaa00' },
  { id: 'super_crit',   name: 'Super Crit',   desc: '+25% chance for 3x damage',      color: '#ffff88' },
  { id: 'life_steal',   name: 'Life Steal',   desc: 'Heal 1 HP every 3 kills',        color: '#ff0044' },
  { id: 'chain_lightning', name: 'Chain Lightning', desc: 'Lightning chains to +2 enemies', color: '#ffff00' },
  { id: 'overcharge',    name: 'Overcharge',  desc: 'Piercing + 20% damage',          color: '#00ffcc' },
];

// ── TIERED SPECIAL UPGRADES ─────────────────────────────────

/** RARE upgrades - After Level 5 boss (Tier 1) */
export const RARE_UPGRADE_POOL = [
  { id: 'add_heart',       name: 'Add 1 Heart',     desc: '+2 max HP permanently',            color: '#ff0044', global: true },
  { id: 'volatile',        name: 'Volatile',        desc: 'Enemies explode on death',         color: '#ff8800', global: true },
  { id: 'second_wind',     name: 'Second Wind',     desc: 'Survive death once',               color: '#ffff00', global: true },
  { id: 'crit_core',       name: 'Crit Core',       desc: '+50% crit dmg, +10% crit chance',  color: '#ffaa00' },
  { id: 'cooldown_tuner',  name: 'Cooldown Tuner',  desc: '-30% alt-fire cooldowns',          color: '#00ffff' },
];

/** EPIC upgrades - After Level 10 boss (Tier 2) */
export const EPIC_UPGRADE_POOL = [
  { id: 'neon_overdrive',  name: 'Neon Overdrive',  desc: '30 kills = 8s god mode',           color: '#ff00ff', global: true },
  { id: 'heavy_hunter',    name: 'Heavy Hunter',    desc: '+35% damage to tanks/bosses',      color: '#00ff88' },
];

/** ULTRA upgrades - After Level 15 boss (Tier 3) */
export const ULTRA_UPGRADE_POOL = [
  { id: 'time_lord',       name: 'Time Lord',       desc: 'Alt-fire slows time 75% for 5s',   color: '#aa00ff', global: true },
  { id: 'death_aura',      name: 'Death Aura',      desc: '3m aura deals 5 dmg/sec',          color: '#ff4400', global: true },
  { id: 'infinity_loop',   name: 'Infinity Loop',   desc: 'Repeat last alt-fire every 10s',   color: '#4488ff', global: true },
  { id: 'hyper_crit',      name: 'Hyper Crit',      desc: '+50% crit chance, shockwave',      color: '#ffff00' },
];

/** LEGENDARY upgrades - After Level 20 boss (Tier 4 - Final Boss) */
export const LEGENDARY_UPGRADE_POOL = [
  { id: 'god_caliber',     name: 'GOD CALIBER',     desc: 'ALL attacks deal 3x damage',       color: '#ffdd00', global: true, legendary: true },
  { id: 'chrono_shift',    name: 'CHRONO SHIFT',    desc: 'Teleport on damage, 2s cooldown',  color: '#00ffff', global: true, legendary: true },
  { id: 'final_form',      name: 'FINAL FORM',      desc: 'Start each level at max power',    color: '#ff00ff', global: true, legendary: true },
  { id: 'soul_harvest',    name: 'SOUL HARVEST',    desc: 'Kills permanently add +1 damage',  color: '#ff0044', global: true, legendary: true },
  { id: 'reality_tear',    name: 'REALITY TEAR',    desc: 'Shots rift to hit 3 extra enemies', color: '#aa00ff', legendary: true },
  { id: 'cosmic_shield',   name: 'COSMIC SHIELD',   desc: 'Block all damage for 2s every 15s', color: '#00ff88', global: true, legendary: true },
];

/**
 * Get special upgrades based on boss tier.
 * Tier 1 (Level 5): RARE only
 * Tier 2 (Level 10): RARE + EPIC
 * Tier 3 (Level 15): RARE + EPIC + ULTRA
 * Tier 4 (Level 20): All pools including LEGENDARY
 */
export function getSpecialUpgradesForBossTier(tier, count = 3) {
  let pool = [];

  if (tier >= 1) pool = [...pool, ...RARE_UPGRADE_POOL];
  if (tier >= 2) pool = [...pool, ...EPIC_UPGRADE_POOL];
  if (tier >= 3) pool = [...pool, ...ULTRA_UPGRADE_POOL];
  if (tier >= 4) pool = [...pool, ...LEGENDARY_UPGRADE_POOL];

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Pick `count` random special upgrades (for after boss) */
export function getRandomSpecialUpgrades(count) {
  const shuffled = [...SPECIAL_UPGRADE_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
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
  return UPGRADE_POOL.find(u => u.id === id) ||
         SPECIAL_UPGRADE_POOL.find(u => u.id === id) ||
         RARE_UPGRADE_POOL.find(u => u.id === id) ||
         EPIC_UPGRADE_POOL.find(u => u.id === id) ||
         ULTRA_UPGRADE_POOL.find(u => u.id === id) ||
         LEGENDARY_UPGRADE_POOL.find(u => u.id === id) ||
         null;
}

/** Get the current weapon type for a hand based on upgrades */
export function getWeaponType(upgrades) {
  const u = upgrades || {};
  if (u.buckshot) return WEAPON_TYPES.BUCKSHOT;
  if (u.lightning) return WEAPON_TYPES.LIGHTNING;
  if (u.charge_shot) return WEAPON_TYPES.CHARGE;
  if (u.plasma) return WEAPON_TYPES.PLASMA;
  if (u.seeker) return WEAPON_TYPES.SEEKER;
  return WEAPON_TYPES.STANDARD;
}

/**
 * Compute effective weapon stats from the player's upgrade inventory.
 * @param {Object} upgrades  e.g. { scope: 3, fire: 1 }
 * @param {Object} globalUpgrades  Global upgrades from game.js
 * @returns {Object} weapon stats
 */
export function getWeaponStats(upgrades, globalUpgrades = {}) {
  const u = upgrades || {};
  const g = globalUpgrades || {};

  // Base values (include special boss upgrades)
  let damage        = 15 + (u.scope || 0) * 10 + (u.mega_scope || 0) * 25;
  let fireInterval  = (300 / (1 + (u.barrel || 0) * 0.15 + (u.turbo_barrel || 0) * 0.3)) * 0.57;
  let projectileCount = 1 + (u.double_shot || 0) + (u.triple_shot || 0) * 2;
  let critChance    = Math.min((u.critical || 0) * 0.15 + (u.super_crit || 0) * 0.25, 0.9);
  let piercing      = (u.piercing || 0) > 0 || (u.overcharge || 0) > 0;
  let aoeRadius     = (u.big_boom || 0) > 0 || (u.mega_boom || 0) > 0
    ? 0.5 + ((u.big_boom || 0) + (u.mega_boom || 0) * 1.5) * 0.3
    : 0;
  let spreadAngle   = 0;
  let weaponType    = getWeaponType(u);

  // Fire effect: enemies take +15% damage per stack
  const fireWeakenMult = 1 + (u.fire || 0) * 0.15;

  // Hollow-Point: +15% damage
  if (u.hollow_point) {
    damage *= 1 + (u.hollow_point || 0) * 0.15;
  }

  // ── Weapon-Specific Stats ───────────────────────────────────

  // Buckshot (Shotgun)
  if (weaponType === WEAPON_TYPES.BUCKSHOT) {
    const s = u.buckshot || 1;
    let pellets = s === 1 ? 5 : s === 2 ? 8 : s === 3 ? 11 : 11 + (s - 3);
    spreadAngle = 0.0524; // 3 degrees

    // Buckshot, Gentlemen: +50% pellets
    if (u.buckshot_pellets) {
      pellets = Math.floor(pellets * (1 + (u.buckshot_pellets || 0) * 0.5));
    }

    // Focused Frenzy: -25% spread
    if (u.buckshot_focused) {
      spreadAngle *= 1 - (u.buckshot_focused || 0) * 0.25;
    }

    // Duck Hunt: +30% pellet damage
    let pelletDamageMult = 1.25;
    if (u.buckshot_damage) {
      pelletDamageMult *= 1 + (u.buckshot_damage || 0) * 0.30;
    }

    projectileCount = pellets;
    damage *= pelletDamageMult;
    fireInterval *= 3.0; // Slower fire rate for shotgun
  }

  // Lightning Rod
  let lightningRange = 8 + (u.lightning || 0) * 2 + (u.chain_lightning || 0) * 4;
  let lightningDamage = 10 + (u.lightning || 0) * 5 + (u.chain_lightning || 0) * 5;
  let lightningChainTargets = 0;

  if (weaponType === WEAPON_TYPES.LIGHTNING) {
    // It's Electric!: +2 chain targets
    lightningChainTargets = (u.lightning_chain || 0) * 2;

    // Tesla Coil: auto-fire + ball attack
    if (u.lightning_tesla) {
      fireInterval *= 0.5; // Faster for auto-fire
    }
  }

  // Charge Cannon
  let chargeTime = 1000; // 1 second base charge time
  let chargeDamageMult = 3; // 3x damage when fully charged

  if (weaponType === WEAPON_TYPES.CHARGE) {
    // Ain't Nobody Got Time For That: +50% charge speed
    if (u.charge_speed) {
      chargeTime *= 1 - (u.charge_speed || 0) * 0.50;
    }

    // Death Ray: +50% charge shot damage
    if (u.charge_damage) {
      chargeDamageMult *= 1 + (u.charge_damage || 0) * 0.50;
    }
  }

  // Plasma Carbine
  let plasmaRampDamage = 0;
  let plasmaSpread = 0.02;

  if (weaponType === WEAPON_TYPES.PLASMA) {
    fireInterval *= 0.4; // Much faster fire rate
    damage *= 0.6; // Lower base damage, ramps up
    plasmaRampDamage = 0.05; // +5% per consecutive hit

    // Hold It Together: -30% spread
    if (u.plasma_spread) {
      plasmaSpread *= 1 - (u.plasma_spread || 0) * 0.30;
    }

    spreadAngle = plasmaSpread;
  }

  // Seeker Burst
  let seekerShots = 3;
  let seekerHomingStrength = 0.5;

  if (weaponType === WEAPON_TYPES.SEEKER) {
    // Gimme Gimme More: +3 shots per burst
    if (u.seeker_more) {
      seekerShots += (u.seeker_more || 0) * 3;
    }

    projectileCount = seekerShots;
    damage *= 0.7; // Lower damage since homing
    fireInterval *= 2.0; // Slower, burst fire
  }

  // ── General Upgrades ───────────────────────────────────────

  // Execute: +40% damage below 25% HP (handled in combat)
  const executeBonus = (u.execute || 0) * 0.40;

  // Reflex: +100% fire rate after taking damage (handled in combat)
  const reflexBonus = (u.reflex || 0) > 0;

  // Nova Tip: every 12th shot causes AoE
  const novaTipInterval = (u.nova_tip || 0) > 0 ? 12 : 0;

  // Siphon: 15 kills = 25% cooldown reduction
  const siphonKills = 15;
  const siphonCooldownReduction = (u.siphon || 0) * 0.25;

  // Vampiric / Life Steal: heal every N kills
  const vampiricStacks = (u.vampiric || 0) + (u.life_steal || 0) * 2;
  const vampiricInterval = vampiricStacks > 0 ? Math.max(2, (u.life_steal ? 3 : 6) - vampiricStacks) : 0;

  if (u.overcharge) damage *= 1.2;

  // ── NEW TIERED UPGRADES ───────────────────────────────────

  // Crit Core: +50% crit damage, +10% crit chance
  if (u.crit_core) {
    critChance += (u.crit_core || 0) * 0.10;
  }

  // Hyper Crit: +50% crit chance
  if (u.hyper_crit) {
    critChance += (u.hyper_crit || 0) * 0.50;
  }

  // Cap crit chance at 95%
  critChance = Math.min(critChance, 0.95);

  // Heavy Hunter: +35% damage to tanks/bosses (handled in combat)
  const heavyHunterBonus = (u.heavy_hunter || 0) * 0.35;

  // Crit multiplier (from Crit Core and Super Crit)
  let critMultiplier = 2;
  if (u.super_crit || u.crit_core) {
    if (u.super_crit) critMultiplier = 3;
    if (u.crit_core) critMultiplier += 0.5; // +50% crit damage = 1.5x more
  }

  // Collect status effects to apply on hit
  const effects = [];
  if (u.fire)   effects.push({ type: 'fire',   stacks: u.fire });
  if (u.shock)  effects.push({ type: 'shock',  stacks: u.shock });
  if (u.freeze) effects.push({ type: 'freeze', stacks: u.freeze });

  return {
    damage:           Math.round(damage),
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
    ricochetBounces:  u.ricochet || 0,

    // Lightning stats
    lightning:        weaponType === WEAPON_TYPES.LIGHTNING,
    lightningRange,
    lightningDamage,
    lightningTickInterval: weaponType === WEAPON_TYPES.LIGHTNING ? Math.max(0.08, 0.2 / (1 + (u.barrel || 0) * 0.15)) : 0.2,
    lightningChainTargets,
    lightningTesla:   (u.lightning_tesla || 0) > 0,

    // Charge shot stats
    chargeShot:       weaponType === WEAPON_TYPES.CHARGE,
    chargeTime,
    chargeDamageMult,
    chargeExcess:     (u.charge_excess || 0) > 0,

    // Plasma stats
    plasma:           weaponType === WEAPON_TYPES.PLASMA,
    plasmaRampDamage,

    // Seeker stats
    seeker:           weaponType === WEAPON_TYPES.SEEKER,
    seekerHomingStrength,

    // New upgrades
    executeBonus,
    reflexBonus,
    novaTipInterval,
    siphonKills,
    siphonCooldownReduction,
    heavyHunterBonus,
    magnetic:         (u.magnetic || 0) > 0,

    // Global upgrades (from game.js)
    godCaliber:       g.god_caliber || false,
    soulHarvestKills: g.soul_harvest_kills || 0,
  };
}
