// ============================================================
//  UPGRADE DEFINITIONS & WEAPON STATS (Merged from Babylon.js)
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


export const ALT_WEAPON_TYPES = {
  ROCKET: 'rocket',
  HELPER_BOT: 'helper_bot',
  SHIELD: 'shield',
  GRAVITY_WELL: 'gravity_well',
  ION_MORTAR: 'ion_mortar',
  HOLOGRAM: 'hologram',
};

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
  // Core upgrades
  { id: 'scope', name: 'Scope', desc: 'Damage +10 per stack', color: '#00ff44' },
  { id: 'barrel', name: 'Barrel', desc: 'Fire rate +15%', color: '#ffaa00' },
  { id: 'shock', name: 'Shock', desc: 'Electrocutes: slows + shock DoT', color: '#4488ff' },
  { id: 'fire', name: 'Fire', desc: 'Ignites: weakens + fire DoT', color: '#ff4400' },
  { id: 'big_boom', name: 'Big Boom', desc: 'Explodes on impact (AOE)', color: '#ff8800' },
  
  // Side-grade weapon types
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
  { id: 'neon_overdrive', name: 'NEON OVERDRIVE', desc: 'After 30 kills: +20% damage/fire rate for 8s', color: '#ff00ff', tier: 'epic', level: 10, global: true },
  { id: 'heavy_hunter', name: 'HEAVY HUNTER', desc: '+35% damage to tanks/bosses, heal on boss damage', color: '#00ffff', tier: 'epic', level: 10 },
];

/** ULTRA upgrades offered after Level 15 boss */
export const ULTRA_UPGRADE_POOL = [
  { id: 'time_lord', name: 'TIME LORD', desc: 'ALT usage causes 5s slow-time', color: '#aa00ff', tier: 'ultra', level: 15, global: true },
  { id: 'death_aura', name: 'DEATH AURA', desc: 'Continuous damage to nearby enemies', color: '#ff0000', tier: 'ultra', level: 15, global: true },
  { id: 'infinity_loop', name: 'INFINITY LOOP', desc: 'Repeat last ALT at 40% power every 10s', color: '#8800ff', tier: 'ultra', level: 15, global: true },
  { id: 'hyper_crit', name: 'HYPER CRIT', desc: '+50% crit chance, crits create shockwaves', color: '#ffaa00', tier: 'ultra', level: 15 },
];

/** LEGENDARY upgrades - After Level 20 boss (Tier 4) */
export const LEGENDARY_UPGRADE_POOL = [
  { id: 'god_caliber', name: 'GOD CALIBER', desc: 'ALL attacks deal 3x damage', color: '#ffdd00', global: true, legendary: true },
  { id: 'chrono_shift', name: 'CHRONO SHIFT', desc: 'Teleport on damage, 2s cooldown', color: '#00ffff', global: true, legendary: true },
  { id: 'final_form', name: 'FINAL FORM', desc: 'Start each level at max power', color: '#ff00ff', global: true, legendary: true },
  { id: 'soul_harvest', name: 'SOUL HARVEST', desc: 'Kills permanently add +1 damage', color: '#ff0044', global: true, legendary: true },
  { id: 'reality_tear', name: 'REALITY TEAR', desc: 'Shots rift to hit 3 extra enemies', color: '#aa00ff', legendary: true },
  { id: 'cosmic_shield', name: 'COSMIC SHIELD', desc: 'Block all damage for 2s every 15s', color: '#00ff88', global: true, legendary: true },
];

/** Combined special upgrade pool */
export const SPECIAL_UPGRADE_POOL = [
  ...RARE_UPGRADE_POOL,
  ...EPIC_UPGRADE_POOL,
  ...ULTRA_UPGRADE_POOL,
  ...LEGENDARY_UPGRADE_POOL,
];

/** Get upgrades by tier */
export function getUpgradesByTier(level) {
  if (level >= 15) return ULTRA_UPGRADE_POOL;
  if (level >= 10) return EPIC_UPGRADE_POOL;
  if (level >= 5) return RARE_UPGRADE_POOL;
  return [];
}

/** Get special upgrades based on boss tier */
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
  let weaponType = getWeaponType(u);

  // Fire effect: enemies take +15% damage per stack
  const fireWeakenMult = 1 + (u.fire || 0) * 0.15;

  // Hollow-Point: +15% damage
  if (u.hollow_point) {
    damage *= 1.15;
  }

  // Buckshot replaces normal projectiles with a spread
  if (u.buckshot) {
    const s = u.buckshot;
    projectileCount = s === 1 ? 5 : s === 2 ? 8 : s === 3 ? 11 : 11 + (s - 3);
    spreadAngle = 0.0524;
    damage *= 1.25;
    fireInterval *= 3.0;
    if (u.focused_frenzy) {
      spreadAngle *= 0.5;
      fireInterval *= 0.7;
    }
    if (u.buckshot_gentlemen) {
      projectileCount += 4;
    }
  }

  // Plasma Carbine
  if (u.plasma_carbine) {
    damage = 6 + (u.scope || 0) * 10;
    fireInterval = 100 / (1 + (u.barrel || 0) * 0.15);
    spreadAngle = 0.0262;
  }

  // Seeker Burst
  if (u.seeker_burst) {
    damage = 12 + (u.scope || 0) * 10;
    fireInterval = 450 / (1 + (u.barrel || 0) * 0.15);
    projectileCount = 3 + (u.gimme_more || 0) * 2;
    spreadAngle = 0.1745;
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

  // Crit Core: +10% crit chance
  if (u.crit_core) critChance += (u.crit_core || 0) * 0.10;
  // Hyper Crit: +50% crit chance
  if (u.hyper_crit) critChance += (u.hyper_crit || 0) * 0.50;
  critChance = Math.min(critChance, 0.95);

  // Heavy Hunter: +35% damage to tanks/bosses (handled in combat)
  const heavyHunterBonus = (u.heavy_hunter || 0) * 0.35;

  // Crit multiplier
  let critMultiplier = (u.super_crit || 0) > 0 ? 3 : 2;
  if (u.crit_core) critMultiplier *= 1.5;

  // Collect status effects to apply on hit
  const effects = [];
  if (u.fire) effects.push({ type: 'fire', stacks: u.fire });
  if (u.shock) effects.push({ type: 'shock', stacks: u.shock });
  if (u.freeze) effects.push({ type: 'freeze', stacks: u.freeze });

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
    weaponType,

    // Lightning stats
    lightning: (u.lightning || 0) > 0,
    lightningRange: 8 + (u.lightning || 0) * 2 + (u.chain_lightning || 0) * 4 + (u.its_electric || 0) * 2 + (u.tesla_coil || 0) * 2,
    lightningDamage: 10 + (u.lightning || 0) * 5 + (u.chain_lightning || 0) * 5 + (u.tesla_coil || 0) * 5,
    lightningTickInterval: (u.lightning || 0) > 0 ? Math.max(0.08, 0.2 / (1 + (u.barrel || 0) * 0.15)) : 0.2,

    // Charge shot stats
    chargeShot: (u.charge_shot || 0) > 0,
  };
}

// ============================================================
//  ALT WEAPON IMPLEMENTATIONS (Instruction 1)
//  Stub functions for each alt weapon type.
//  These are called from main.js when squeeze button is pressed.
// ============================================================

/**
 * Fire a homing rocket that seeks enemies and explodes on impact.
 * @param {THREE.Controller} controller - The controller that fired
 * @param {string} hand - 'left' or 'right'
 * @param {THREE.Scene} scene - The scene to add the rocket to
 */
export function fireRocket(controller, hand, scene) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  // Create rocket mesh (elongated octahedron)
  const rocketGeo = new THREE.ConeGeometry(0.08, 0.3, 6);
  const rocketMat = new THREE.MeshBasicMaterial({ 
    color: 0xff4444, 
    emissive: 0xff4444,
    transparent: true, 
    opacity: 0.9 
  });
  const rocket = new THREE.Mesh(rocketGeo, rocketMat);
  
  // Orient along direction
  rocket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  rocket.position.copy(origin);
  
  // Rocket data
  rocket.userData = {
    isRocket: true,
    hand: hand,
    velocity: direction.clone().multiplyScalar(20), // Initial velocity
    damage: ALT_WEAPON_DEFS.rocket.damage,
    splashRadius: ALT_WEAPON_DEFS.rocket.splashRadius,
    lifetime: 5000,
    createdAt: performance.now(),
    homingStrength: 8, // How strongly it homes
    target: null,
  };
  
  scene.add(rocket);
  
  // Return rocket so main.js can track it
  return rocket;
}

/**
 * Spawn a helper bot that auto-targets and shoots nearby enemies.
 * @param {THREE.Controller} controller - The controller that spawned it
 * @param {string} hand - 'left' or 'right'
 */
export function spawnHelperBot(controller, hand) {
  const origin = new THREE.Vector3();
  controller.getWorldPosition(origin);
  
  // Create bot mesh (small sphere with wireframe)
  const botGeo = new THREE.IcosahedronGeometry(0.15, 1);
  const botMat = new THREE.MeshBasicMaterial({ 
    color: 0x44ff44, 
    wireframe: true,
    transparent: true,
    opacity: 0.8
  });
  const bot = new THREE.Mesh(botGeo, botMat);
  bot.position.copy(origin);
  bot.position.y += 0.5; // Float above controller
  
  // Bot data
  bot.userData = {
    isHelperBot: true,
    hand: hand,
    damage: ALT_WEAPON_DEFS.helper_bot.damage,
    fireRate: ALT_WEAPON_DEFS.helper_bot.fireRate,
    lastFireTime: 0,
    duration: ALT_WEAPON_DEFS.helper_bot.duration,
    createdAt: performance.now(),
    orbitAngle: 0,
    orbitRadius: 1.5,
  };
  
  return bot;
}

/**
 * Activate a protective shield that blocks enemy damage.
 * @param {string} hand - 'left' or 'right'
 */
export function activateShield(hand) {
  // Return shield data - main.js will create the visual and track state
  return {
    type: 'shield',
    hand: hand,
    maxHits: ALT_WEAPON_DEFS.shield.maxHits,
    hitsRemaining: ALT_WEAPON_DEFS.shield.maxHits,
    duration: ALT_WEAPON_DEFS.shield.duration,
    createdAt: performance.now(),
  };
}

/**
 * Create a gravity well that pulls enemies toward its center.
 * @param {THREE.Controller} controller - The controller that created it
 * @param {THREE.Scene} scene - The scene to add the well to
 */
export function createGravityWell(controller, scene) {
  const origin = new THREE.Vector3();
  controller.getWorldPosition(origin);
  
  // Create gravity well mesh (wireframe sphere)
  const wellGeo = new THREE.IcosahedronGeometry(ALT_WEAPON_DEFS.gravity_well.pullRadius, 1);
  const wellMat = new THREE.MeshBasicMaterial({ 
    color: 0xaa44ff, 
    wireframe: true,
    transparent: true,
    opacity: 0.4
  });
  const well = new THREE.Mesh(wellGeo, wellMat);
  
  // Position where controller is pointing (forward a bit)
  const quat = new THREE.Quaternion();
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  well.position.copy(origin).addScaledVector(direction, 3);
  well.position.y = Math.max(0.5, well.position.y); // Don't go below floor
  
  // Well data
  well.userData = {
    isGravityWell: true,
    pullRadius: ALT_WEAPON_DEFS.gravity_well.pullRadius,
    pullForce: ALT_WEAPON_DEFS.gravity_well.pullForce,
    duration: ALT_WEAPON_DEFS.gravity_well.duration,
    createdAt: performance.now(),
  };
  
  scene.add(well);
  
  return well;
}

/**
 * Fire an ion mortar - arcing projectile with large explosion.
 * @param {THREE.Controller} controller - The controller that fired
 * @param {THREE.Scene} scene - The scene to add the mortar to
 */
export function fireIonMortar(controller, scene) {
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  
  // Arc upward then come down
  const direction = new THREE.Vector3(0, 0.7, -1).normalize().applyQuaternion(quat);
  
  // Create mortar mesh (larger sphere)
  const mortarGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const mortarMat = new THREE.MeshBasicMaterial({ 
    color: 0x44ffaa,
    transparent: true,
    opacity: 0.9
  });
  const mortar = new THREE.Mesh(mortarGeo, mortarMat);
  mortar.position.copy(origin);
  
  // Mortar data
  mortar.userData = {
    isIonMortar: true,
    velocity: direction.clone().multiplyScalar(15),
    gravity: -15, // Arcing motion
    damage: ALT_WEAPON_DEFS.ion_mortar.damage,
    splashRadius: ALT_WEAPON_DEFS.ion_mortar.splashRadius,
    lifetime: 4000,
    createdAt: performance.now(),
  };
  
  scene.add(mortar);
  
  return mortar;
}

/**
 * Spawn a holographic decoy that attracts enemy fire.
 * @param {THREE.Controller} controller - The controller that spawned it
 * @param {THREE.Scene} scene - The scene to add the hologram to
 */
export function spawnHologram(controller, scene) {
  const origin = new THREE.Vector3();
  controller.getWorldPosition(origin);
  
  // Create hologram mesh (wireframe humanoid shape - simplified)
  const hologramGroup = new THREE.Group();
  
  // Body (tall box wireframe)
  const bodyGeo = new THREE.BoxGeometry(0.4, 1.2, 0.2);
  const bodyMat = new THREE.MeshBasicMaterial({ 
    color: 0x44ffff, 
    wireframe: true,
    transparent: true,
    opacity: 0.6
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  hologramGroup.add(body);
  
  // Head (small sphere)
  const headGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const headMat = new THREE.MeshBasicMaterial({ 
    color: 0x44ffff,
    transparent: true,
    opacity: 0.7
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.35;
  hologramGroup.add(head);
  
  // Position in front of player
  const quat = new THREE.Quaternion();
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  hologramGroup.position.copy(origin).addScaledVector(direction, 2);
  hologramGroup.position.y = 0; // On floor
  
  // Hologram data
  hologramGroup.userData = {
    isHologram: true,
    duration: ALT_WEAPON_DEFS.hologram.duration,
    createdAt: performance.now(),
    attractRadius: 8, // Enemies within this range target the hologram
  };
  
  scene.add(hologramGroup);
  
  return hologramGroup;
}
