// ============================================================
//  WEAPON SYSTEM - MAIN/ALT/UPGRADE ARCHITECTURE
//  Defines MAIN weapons, ALT weapons, and upgrade system
// ============================================================

// ── MAIN WEAPONS (fired by select/top trigger) ───────────────
export const MAIN_WEAPONS = {
  standard_blaster: {
    id: 'standard_blaster',
    name: 'Standard Blaster',
    desc: 'Balanced all-rounder',
    color: '#00ffff',
    type: 'main',
    baseStats: {
      damage: 15,
      fireInterval: 180,
      projectileCount: 1,
      critChance: 0,
      critMultiplier: 2,
      piercing: false,
      aoeRadius: 0,
      spreadAngle: 0,
    },
  },
  
  buckshot: {
    id: 'buckshot',
    name: 'Buckshot',
    desc: 'Multi-pellet spread, close range',
    color: '#ff8800',
    type: 'main',
    baseStats: {
      damage: 18,
      fireInterval: 540,  // Slower
      projectileCount: 5,
      critChance: 0,
      critMultiplier: 2,
      piercing: false,
      aoeRadius: 0,
      spreadAngle: 0.2618,  // 15 degrees (wider spread for satisfying shotgun feel)
    },
  },
  
  lightning_rod: {
    id: 'lightning_rod',
    name: 'Lightning Rod',
    desc: 'Continuous beam, auto-lock',
    color: '#ff00ff',
    type: 'main',
    baseStats: {
      damage: 10,
      fireInterval: 80,  // Very fast ticks
      projectileCount: 1,
      critChance: 0,
      critMultiplier: 2,
      piercing: false,
      aoeRadius: 0,
      spreadAngle: 0,
      lightning: true,
      lightningRange: 10,
      lightningTickInterval: 0.1,
    },
  },
  
  charge_cannon: {
    id: 'charge_cannon',
    name: 'Charge Cannon',
    desc: 'Hold to charge, release for massive damage',
    color: '#ff4444',
    type: 'main',
    baseStats: {
      damage: 20,  // Base damage (scales with charge)
      fireInterval: 0,  // No cooldown, charge-based
      projectileCount: 1,
      critChance: 0.15,
      critMultiplier: 2.5,
      piercing: false,
      aoeRadius: 0,
      spreadAngle: 0,
      chargeShot: true,
      chargeTimeMax: 3.0,  // Max charge time in seconds (matches CHARGE_SHOT_MAX_TIME)
      chargeDamageMultiplier: 3.0,  // Max damage = base * 3.0
    },
  },
  
  plasma_carbine: {
    id: 'plasma_carbine',
    name: 'Plasma Carbine',
    desc: 'Minigun-style wind-up, ramps to full auto',
    color: '#00ffff',  // Cyan for minigun feel
    type: 'main',
    baseStats: {
      damage: 6,
      fireInterval: 80,  // 25% faster than before (was 100)
      projectileCount: 1,
      critChance: 0.08,
      critMultiplier: 2,
      piercing: false,
      aoeRadius: 0,
      spreadAngle: 0.0262,  // 1.5 degrees
      damageRampUp: true,  // Damage increases with consecutive hits
      damageRampUpMax: 2.0,  // Max 2x damage after ramp-up
      projectileSpeed: 63.25,  // 15% faster (55 * 1.15)
      // Wind-up mechanic (TF2 Heavy minigun style)
      windUp: true,
      windUpSpinTime: 600,  // 0.6 seconds before any firing
      windUpRampTime: 3000,  // 3 seconds to reach max fire rate
      windUpStartInterval: 300,  // Fire rate at start of ramp (slow)
      windUpEndInterval: 80,  // Fire rate at end of ramp (fast, same as fireInterval)
      // Projectile visuals
      projectileColor: 0x00ffff,  // Cyan
      projectileScale: 0.75,  // 25% smaller
      projectileLength: 0.5,  // Short dart-like appearance
    },
  },
  
  seeker_burst: {
    id: 'seeker_burst',
    name: 'Seeker Burst',
    desc: 'Fires 3 homing shots, lower DPS but reliable',
    color: '#aa88ff',
    type: 'main',
    baseStats: {
      damage: 12,
      fireInterval: 450,  // Moderate
      projectileCount: 3,
      critChance: 0.05,
      critMultiplier: 2,
      piercing: false,
      aoeRadius: 0,
      spreadAngle: 0,  // Parallel homing beams
      homing: true,  // Shots track enemies
      homingRange: 8,  // Tracking range (reduced from 15, requires aiming)
      projectileSpeed: 32,
    },
  },
};

// ── ALT WEAPONS (fired by squeeze/lower trigger) ─────────────
export const ALT_WEAPONS = {
  shield: {
    id: 'shield',
    name: 'Shield',
    desc: 'Blocks enemy projectiles',
    color: '#4488ff',
    type: 'alt',
    cooldown: 15000,  // 15 seconds
    duration: 3000,   // 3 seconds
  },

  laser_mine: {
    id: 'laser_mine',
    name: 'Laser Mine',
    desc: 'Passive proximity mine - spawns when still',
    color: '#aa00ff',  // Purple
    type: 'alt',
    cooldown: 0,       // No cooldown - passive activation
    damage: 50,
    armTime: 1000,     // 1 second to arm
    triggerRadius: 3,  // Proximity trigger distance
    autoDetonateTime: 4000,  // 4 seconds auto-detonate
    maxActive: 5,      // Max mines per hand
    stillnessTime: 2000,  // 2 seconds of standing still to activate
    mineCount: 3,      // Number of mines spawned (scales with level)
  },
  
  grenade: {
    id: 'grenade',
    name: 'Grenade',
    desc: 'Throwable explosive',
    color: '#ff4444',
    type: 'alt',
    cooldown: 4000,  // 4 seconds
    damage: 40,
    aoeRadius: 2.0,
  },
  
  mine: {
    id: 'mine',
    name: 'Mine',
    desc: 'Placeable explosive trap',
    color: '#ffaa00',
    type: 'alt',
    cooldown: 6000,  // 6 seconds
    damage: 60,
    aoeRadius: 2.5,
    maxActive: 3,
  },
  
  drone: {
    id: 'drone',
    name: 'Drone',
    desc: 'Auto-targeting helper',
    color: '#88ff88',
    type: 'alt',
    cooldown: 8000,  // 8 seconds
    duration: 10000,  // 10 seconds
    damage: 8,
    fireInterval: 200,
  },
  
  emp: {
    id: 'emp',
    name: 'EMP',
    desc: 'Disables nearby enemies',
    color: '#00ffff',
    type: 'alt',
    cooldown: 10000,  // 10 seconds
    duration: 3000,  // 3 seconds
    range: 5,
  },
  
  teleport: {
    id: 'teleport',
    name: 'Teleport',
    desc: 'Instant movement',
    color: '#aa00ff',
    type: 'alt',
    cooldown: 5000,  // 5 seconds
    range: 10,
  },

  stasis_field: {
    id: 'stasis_field',
    name: 'Stasis Field',
    desc: 'Slow-mo bubble for 5 seconds',
    color: '#4488ff',
    type: 'alt',
    cooldown: 20000,  // 20 seconds
    duration: 5000,   // 5 seconds
    radius: 3.0,
    slowFactor: 0.2,  // 20% speed (80% slower)
  },

  plasma_orb: {
    id: 'plasma_orb',
    name: 'Plasma Orb',
    desc: 'Homing orb, 75 damage',
    color: '#aa44ff',
    type: 'alt',
    cooldown: 10000,  // 10 seconds
    damage: 75,
    speed: 5,
    homingRange: 15,
    aoeRadius: 2.0,
    detonateOnHit: true,
  },

  decoy: {
    id: 'decoy',
    name: 'Decoy Hologram',
    desc: 'Spawns a holographic copy that attracts enemies',
    color: '#00ffaa',
    type: 'alt',
    cooldown: 15000,  // 15 seconds
    duration: 8000,  // 8 seconds
    explosionDamage: 30,  // Base explosion damage when destroyed
    explosionDamagePerTarget: 15,  // Extra damage per enemy targeting it
  },

  black_hole: {
    id: 'black_hole',
    name: 'Singularity Mine',
    desc: 'Throwable mine that creates a brief black hole',
    color: '#8800ff',
    type: 'alt',
    cooldown: 18000,  // 18 seconds
    duration: 2000,  // 2 seconds
    damage: 40,  // Damage to enemies sucked in
    pullRadius: 5,  // Radius of gravitational pull
    stunDuration: 1000,  // 1 second stun after release
    triggerRadius: 2,  // Proximity trigger radius
  },

  tether_harpoon: {
    id: 'tether_harpoon',
    name: 'Tether Harpoon',
    desc: 'Fires tether connecting you to enemy, yank or use as wrecking ball',
    color: '#00ff88',
    type: 'alt',
    cooldown: 12000,  // 12 seconds
    damage: 25,  // Damage on collision
    range: 15,  // 15m range
    tetherDuration: 8000,  // 8 seconds max tether duration
    yankForce: 12,  // Force applied when yanking
  },

  nanite_swarm: {
    id: 'nanite_swarm',
    name: 'Nanite Swarm',
    desc: 'Release cloud of nanobots - DoT + reveal enemies, bullets carry nanites',
    color: '#ffd700',  // Gold
    type: 'alt',
    cooldown: 15000,  // 15 seconds
    duration: 10000,   // 10 seconds
    dotDamage: 5,      // 5 damage/sec
    radius: 3.0,       // 3m cloud radius
  },

  phase_dash: {
    id: 'phase_dash',
    name: 'Phase Dash',
    desc: 'Instant teleport, leaves explosive afterimage',
    color: '#4488ff',  // Blue
    type: 'alt',
    cooldown: 8000,  // 8 seconds
    dashDistance: 5,  // 5 meters
    afterimageDamage: 40,
    afterimageDelay: 1000,  // 1 second
  },

  reflector_drone: {
    id: 'reflector_drone',
    name: 'Reflector Drone',
    desc: 'Orbiting drone reflects 50% of projectiles, overcharge for 100%',
    color: '#00ffcc',  // Cyan-green
    type: 'alt',
    cooldown: 20000,  // 20 seconds
    duration: 15000,   // 15 seconds
    reflectChance: 0.5,  // 50% reflect
    overchargeReflect: 1.0,  // 100% reflect when overcharged
    droneHealth: 50,
    orbitRadius: 2.0,  // Distance from player
    orbitSpeed: 1.5,  // Radians per second
  },
};

// ── UPGRADE SYSTEM ───────────────────────────────────────────
export const UPGRADE_POOL = [
  // Universal upgrades (apply to ALL main weapons)
  { id: 'scope', name: 'Scope', desc: 'Damage +10 per stack', color: '#00ff44', type: 'universal' },
  { id: 'barrel', name: 'Barrel', desc: 'Fire rate +15%', color: '#ffaa00', type: 'universal' },
  { id: 'piercing', name: 'Piercing', desc: 'Shots pass through enemies', color: '#00ffaa', type: 'universal' },
  { id: 'critical', name: 'Critical', desc: '+15% chance for 2x damage', color: '#ffff00', type: 'universal' },
  { id: 'double_shot', name: 'Double Shot', desc: 'Fire an extra projectile', color: '#ff44ff', type: 'universal' },
  { id: 'vampiric', name: 'Vampiric', desc: 'Heal half-heart every 5 kills', color: '#cc0044', type: 'universal' },
  
  // Status effect upgrades (universal)
  { id: 'shock', name: 'Shock', desc: 'Electrocutes: slows + shock DoT', color: '#4488ff', type: 'universal' },
  { id: 'fire', name: 'Fire', desc: 'Ignites: weakens + fire DoT', color: '#ff4400', type: 'universal' },
  { id: 'freeze', name: 'Freeze', desc: 'Greatly slows enemies', color: '#88ccff', type: 'universal' },
  { id: 'ricochet', name: 'Ricochet', desc: 'Shots bounce to nearby enemy', color: '#aaffaa', type: 'universal' },

  // Buckshot specific upgrades
  { id: 'focused_frenzy', name: 'Focused Frenzy', desc: 'Buckshot: Tighter spread + faster fire', color: '#ff8800', type: 'weapon_specific', weapon: 'buckshot' },
  { id: 'buckshot_gentlemen', name: 'Buckshot Gentlemen', desc: 'Buckshot: +4 pellets', color: '#ff8800', type: 'weapon_specific', weapon: 'buckshot' },
  { id: 'duck_hunt', name: 'Duck Hunt', desc: 'Buckshot: Critical hits stun', color: '#ff8800', type: 'weapon_specific', weapon: 'buckshot' },
  
  // Lightning Rod specific upgrades
  { id: 'its_electric', name: 'It\'s Electric!', desc: 'Lightning Rod: Chains to +2 enemies', color: '#ff00ff', type: 'weapon_specific', weapon: 'lightning_rod' },
  { id: 'tesla_coil', name: 'Tesla Coil', desc: 'Lightning Rod: +50% damage, +20% range', color: '#ff00ff', type: 'weapon_specific', weapon: 'lightning_rod' },
  
  // Charge Cannon specific upgrades
  { id: 'quick_charge', name: 'Ain\'t Nobody Got Time For That', desc: 'Charge Cannon: 2x charge speed', color: '#ff4444', type: 'weapon_specific', weapon: 'charge_cannon' },
  { id: 'excess_heat', name: 'Excess Heat', desc: 'Charge Cannon: Full charge kills cause AoE explosion + fire DoT', color: '#ff4444', type: 'weapon_specific', weapon: 'charge_cannon' },
  { id: 'death_ray', name: 'Death Ray', desc: 'Charge Cannon: +100% max charge damage', color: '#ff4444', type: 'weapon_specific', weapon: 'charge_cannon' },
  
  // Plasma Carbine specific upgrades
  { id: 'hold_together', name: 'Hold It Together', desc: 'Plasma Carbine: 40% faster wind-up, higher max damage', color: '#00ffff', type: 'weapon_specific', weapon: 'plasma_carbine' },
  
  // Seeker Burst specific upgrades
  { id: 'gimme_more', name: 'Gimme Gimme More', desc: 'Seeker Burst: +2 homing shots per burst', color: '#aa88ff', type: 'weapon_specific', weapon: 'seeker_burst' },

  // Nuke upgrade (universal — grants +1 nuke charge)
  { id: 'extra_nuke', name: 'Extra Nuke', desc: '+1 nuke charge (alt-fire)', color: '#ffff44', type: 'universal' },
];

// Special upgrades (after boss victories)
export const SPECIAL_UPGRADE_POOL = [
  { id: 'mega_scope', name: 'Mega Scope', desc: 'Damage +25 per stack', color: '#00ff88', type: 'universal' },
  { id: 'turbo_barrel', name: 'Turbo Barrel', desc: 'Fire rate +30%', color: '#ffcc00', type: 'universal' },
  { id: 'triple_shot', name: 'Triple Shot', desc: 'Fire two extra projectiles', color: '#ff66ff', type: 'universal' },
  { id: 'super_crit', name: 'Super Crit', desc: '+25% chance for 3x damage', color: '#ffff88', type: 'universal' },
  { id: 'life_steal', name: 'Life Steal', desc: 'Heal 1 HP every 3 kills', color: '#ff0044', type: 'universal' },
  // Removed chain_lightning - redundant with 'its_electric' (weapon-specific for lightning_rod)
  { id: 'overcharge', name: 'Overcharge', desc: 'Piercing + 20% damage', color: '#00ffcc', type: 'universal' },
  { id: 'mega_boom', name: 'Mega Boom', desc: 'Bigger AOE, +50% explosion dmg', color: '#ffaa00', type: 'universal' },
];

// ── HELPER FUNCTIONS ─────────────────────────────────────────

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Get a random MAIN weapon (for level 1-2 guaranteed upgrade)
 */
/**
 * Get MAIN weapon definition by ID
 */
export function getMainWeapon(id) {
  return MAIN_WEAPONS[id] || null;
}

/**
 * Get ALT weapon definition by ID
 */
export function getAltWeapon(id) {
  return ALT_WEAPONS[id] || null;
}

/**
 * Get upgrades available for a specific MAIN weapon
 * Includes universal + weapon-specific
 */
export function getAvailableUpgrades(mainWeaponId) {
  return UPGRADE_POOL.filter(u => 
    u.type === 'universal' || (u.type === 'weapon_specific' && u.weapon === mainWeaponId)
  );
}

/**
 * Pick random upgrades for a given MAIN weapon
 * @param {number} count - Number of upgrades to pick
 * @param {string} mainWeaponId - The equipped MAIN weapon
 * @param {string[]} excludeIds - Upgrade IDs to exclude
 */
export function getRandomUpgrades(count, mainWeaponId = null, excludeIds = []) {
  const excludeSet = new Set(excludeIds);
  let pool;
  
  if (mainWeaponId) {
    // Filter by weapon compatibility
    pool = getAvailableUpgrades(mainWeaponId);
  } else {
    // No weapon equipped yet - show all universal upgrades
    pool = UPGRADE_POOL.filter(u => u.type === 'universal');
  }
  
  const filtered = pool.filter(u => !excludeSet.has(u.id));
  const shuffled = shuffleArray([...filtered]);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Pick random special upgrades (after boss)
 */
export function getRandomSpecialUpgrades(count, mainWeaponId = null) {
  let pool = SPECIAL_UPGRADE_POOL;
  
  if (mainWeaponId) {
    // Filter special upgrades by weapon compatibility
    pool = pool.filter(u => 
      u.type === 'universal' || (u.type === 'weapon_specific' && u.weapon === mainWeaponId)
    );
  }
  
  const shuffled = shuffleArray([...pool]);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Compute effective weapon stats from base weapon + upgrades
 * @param {string} mainWeaponId - The equipped MAIN weapon
 * @param {Object} upgrades - e.g. { scope: 3, fire: 1 }
 * @returns {Object} computed stats
 */
export function getWeaponStats(mainWeaponId, upgrades) {
  const weapon = getMainWeapon(mainWeaponId);
  if (!weapon) {
    console.warn(`Unknown MAIN weapon: ${mainWeaponId}`);
    return MAIN_WEAPONS.standard_blaster.baseStats;
  }
  
  const u = upgrades || {};
  const base = { ...weapon.baseStats };
  
  // Apply universal upgrades
  let damage = base.damage + (u.scope || 0) * 10 + (u.mega_scope || 0) * 25;
  let fireInterval = base.fireInterval / (1 + (u.barrel || 0) * 0.15 + (u.turbo_barrel || 0) * 0.3);
  let projectileCount = base.projectileCount + (u.double_shot || 0) + (u.triple_shot || 0) * 2;
  let critChance = Math.min(base.critChance + (u.critical || 0) * 0.15 + (u.super_crit || 0) * 0.25, 0.9);
  let piercing = base.piercing || (u.piercing || 0) > 0 || (u.overcharge || 0) > 0;
  let aoeRadius = base.aoeRadius;
  const projectileSpeed = base.projectileSpeed;
  
  if ((u.big_boom || 0) > 0 || (u.mega_boom || 0) > 0) {
    aoeRadius = Math.max(aoeRadius, 0.5 + ((u.big_boom || 0) + (u.mega_boom || 0) * 1.5) * 0.3);
  }
  
  // Weapon-specific modifiers
  if (mainWeaponId === 'shotgun') {
    if (u.shotgun_drum) projectileCount += 3;
    if (u.shotgun_choke) base.spreadAngle *= 0.6;  // Tighter spread
  }
  
  if (mainWeaponId === 'sniper') {
    if (u.sniper_scope) critMultiplier = 4.5;  // +50% crit damage (3x -> 4.5x)
  }
  
  if (mainWeaponId === 'assault_rifle') {
    if (u.rifle_burst) {
      // Burst fire: 3 shots at once
      projectileCount *= 3;
      fireInterval *= 2;  // Slower between bursts
    }
  }
  
  if (mainWeaponId === 'cannon') {
    if (u.cannon_napalm) {
      // Add fire DoT to explosions
      // This would be handled in the damage application logic
    }
  }
  
  if (mainWeaponId === 'laser_beam') {
    if (u.laser_overcharge) damage *= 1.2;
  }

  if (mainWeaponId === 'seeker_burst') {
    if (u.gimme_more) projectileCount += 2 * u.gimme_more;
  }

  if (mainWeaponId === 'buckshot') {
    if (u.buckshot_gentlemen) projectileCount += 4 * u.buckshot_gentlemen;
    if (u.focused_frenzy) {
      base.spreadAngle *= 0.6;
      fireInterval *= 0.85;
    }
  }
  
  // Plasma carbine wind-up upgrades
  let windUp = base.windUp || false;
  let windUpSpinTime = base.windUpSpinTime || 0;
  let windUpRampTime = base.windUpRampTime || 0;
  let windUpStartInterval = base.windUpStartInterval || fireInterval;
  let windUpEndInterval = base.windUpEndInterval || fireInterval;
  let projectileColor = base.projectileColor;
  let projectileScale = base.projectileScale || 1;
  let projectileLength = base.projectileLength || 1;
  
  if (mainWeaponId === 'plasma_carbine') {
    if (u.hold_together) {
      // Faster wind-up: 40% faster spin-up and ramp
      windUpSpinTime = Math.round(windUpSpinTime * 0.6);
      windUpRampTime = Math.round(windUpRampTime * 0.6);
      // Higher max damage (existing damageRampUpMax)
      base.damageRampUpMax = (base.damageRampUpMax || 2.0) + 0.5 * u.hold_together;
    }
  }
  
  // Apply universal damage modifiers
  if (u.overcharge) damage *= 1.2;
  
  // Vampiric / Life Steal
  const vampiricStacks = (u.vampiric || 0) + (u.life_steal || 0) * 2;
  const vampiricInterval = vampiricStacks > 0 ? Math.max(2, (u.life_steal ? 3 : 6) - vampiricStacks) : 0;
  
  // Fire weaken
  const fireWeakenMult = 1 + (u.fire || 0) * 0.15;
  
  // Status effects
  const effects = [];
  if (u.fire) effects.push({ type: 'fire', stacks: u.fire });
  if (u.shock) effects.push({ type: 'shock', stacks: u.shock });
  if (u.freeze) effects.push({ type: 'freeze', stacks: u.freeze });
  
  const critMultiplier = (u.super_crit || 0) > 0 ? 3 : base.critMultiplier || 2;
  
  return {
    mainWeaponId,
    damage: Math.round(damage),
    fireInterval,
    projectileCount,
    critChance,
    critMultiplier,
    piercing,
    aoeRadius,
    projectileSpeed,
    spreadAngle: base.spreadAngle || 0,
    homing: base.homing || false,
    homingRange: base.homingRange || 0,
    vampiricInterval,
    fireWeakenMult,
    effects,
    ricochetBounces: u.ricochet || 0,
    lightning: base.lightning || false,
    lightningRange: base.lightningRange || 0,
    lightningTickInterval: base.lightningTickInterval || 0.2,
    lightningDamage: Math.round(damage),
    chargeShot: base.chargeShot || false,
    chargeTimeMax: base.chargeTimeMax || 5.0,
    chargeDamageMultiplier: base.chargeDamageMultiplier || 3.0,
    damageRampUp: base.damageRampUp || false,
    damageRampUpMax: base.damageRampUpMax || 1.0,
    // Wind-up mechanic (plasma carbine)
    windUp,
    windUpSpinTime,
    windUpRampTime,
    windUpStartInterval,
    windUpEndInterval,
    // Projectile visuals
    projectileColor,
    projectileScale,
    projectileLength,
    // Charge cannon upgrades
    chargeRateMultiplier: 1 + (u.quick_charge || 0), // 2x per stack of quick_charge
    chargeDeathRayMultiplier: 1 + (u.death_ray || 0), // 2x max damage per stack of death_ray
    hasExcessHeat: (u.excess_heat || 0) > 0,
    hasChargeAoEFire: (u.fire || 0) > 0,
    hasChargeAoEFreeze: (u.freeze || 0) > 0,
    hasChargeAoEShock: (u.shock || 0) > 0,
  };
}

/**
 * Get upgrade definition by ID
 */
export function getUpgradeDef(id) {
  return UPGRADE_POOL.find(u => u.id === id) || 
         SPECIAL_UPGRADE_POOL.find(u => u.id === id) || 
         null;
}
