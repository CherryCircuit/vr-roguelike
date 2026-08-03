// ============================================================
//  WEAPON SYSTEM - MAIN/ALT/UPGRADE ARCHITECTURE
//  Defines MAIN weapons, ALT weapons, and upgrade system
// ============================================================

import { game } from './game.js';

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
      lightningRange: 14,
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
// NOTE: every def carries a `category` (damage|speed|crit|status|utility)
// used by the Alchemy Bench's Targeted Infusion forge (Issue #185).
export const UPGRADE_POOL = [
  // Universal upgrades (apply to ALL main weapons)
  { id: 'scope', name: 'Scope', desc: 'Damage +10 per stack', color: '#00ff44', type: 'universal', category: 'damage' },
  { id: 'barrel', name: 'Barrel', desc: 'Fire rate +15%', color: '#ffaa00', type: 'universal', category: 'speed' },
  { id: 'piercing', name: 'Piercing', desc: 'Shots pass through enemies', color: '#00ffaa', type: 'universal', category: 'utility' },
  { id: 'critical', name: 'Critical', desc: '+15% chance for 2x damage', color: '#ffff00', type: 'universal', category: 'crit' },
  { id: 'double_shot', name: 'Double Shot', desc: 'Fire an extra projectile', color: '#ff44ff', type: 'universal', category: 'damage' },
  { id: 'vampiric', name: 'Vampiric', desc: 'Heal half-heart every 5 kills', color: '#cc0044', type: 'universal', category: 'utility' },
  
  // Status effect upgrades (universal)
  { id: 'shock', name: 'Shock', desc: 'Electrocutes: slows + shock DoT', color: '#4488ff', type: 'universal', category: 'status' },
  { id: 'fire', name: 'Fire', desc: 'Ignites: weakens + fire DoT', color: '#ff4400', type: 'universal', category: 'status' },
  { id: 'freeze', name: 'Freeze', desc: 'Greatly slows enemies', color: '#88ccff', type: 'universal', category: 'status' },
  { id: 'ricochet', name: 'Ricochet', desc: 'Shots bounce to nearby enemy', color: '#aaffaa', type: 'universal', category: 'status' },

  // Buckshot specific upgrades
  { id: 'focused_frenzy', name: 'Focused Frenzy', desc: 'Buckshot: Tighter spread + faster fire', color: '#ff8800', type: 'weapon_specific', weapon: 'buckshot', category: 'speed' },
  { id: 'buckshot_gentlemen', name: 'Buckshot Gentlemen', desc: 'Buckshot: +4 pellets', color: '#ff8800', type: 'weapon_specific', weapon: 'buckshot', category: 'damage' },
  { id: 'duck_hunt', name: 'Duck Hunt', desc: 'Buckshot: Critical hits stun', color: '#ff8800', type: 'weapon_specific', weapon: 'buckshot', category: 'crit' },
  
  // Lightning Rod specific upgrades
  { id: 'its_electric', name: 'It\'s Electric!', desc: 'Lightning Rod: Chains to +2 enemies', color: '#ff00ff', type: 'weapon_specific', weapon: 'lightning_rod', category: 'damage' },
  { id: 'tesla_coil', name: 'Tesla Coil', desc: 'Lightning Rod: +50% damage, +20% range', color: '#ff00ff', type: 'weapon_specific', weapon: 'lightning_rod', category: 'damage' },
  
  // Charge Cannon specific upgrades
  { id: 'quick_charge', name: 'Ain\'t Nobody Got Time For That', desc: 'Charge Cannon: 2x charge speed', color: '#ff4444', type: 'weapon_specific', weapon: 'charge_cannon', category: 'speed' },
  { id: 'excess_heat', name: 'Excess Heat', desc: 'Charge Cannon: Full charge kills cause AoE explosion + fire DoT', color: '#ff4444', type: 'weapon_specific', weapon: 'charge_cannon', category: 'status' },
  { id: 'death_ray', name: 'Death Ray', desc: 'Charge Cannon: +100% max charge damage', color: '#ff4444', type: 'weapon_specific', weapon: 'charge_cannon', category: 'damage' },
  
  // Plasma Carbine specific upgrades
  { id: 'hold_together', name: 'Hold It Together', desc: 'Plasma Carbine: 40% faster wind-up, higher max damage', color: '#00ffff', type: 'weapon_specific', weapon: 'plasma_carbine', category: 'speed' },
  
  // Seeker Burst specific upgrades
  { id: 'gimme_more', name: 'Gimme Gimme More', desc: 'Seeker Burst: +2 homing shots per burst', color: '#aa88ff', type: 'weapon_specific', weapon: 'seeker_burst', category: 'damage' },

  // Nuke upgrade (universal — grants +1 nuke charge)
  { id: 'extra_nuke', name: 'Extra Nuke', desc: '+1 nuke charge (alt-fire)', color: '#ffff44', type: 'universal', category: 'utility' },
];

// Special upgrades (after boss victories)
export const SPECIAL_UPGRADE_POOL = [
  { id: 'mega_scope', name: 'Mega Scope', desc: 'Damage +25 per stack', color: '#00ff88', type: 'universal', category: 'damage' },
  { id: 'turbo_barrel', name: 'Turbo Barrel', desc: 'Fire rate +30%', color: '#ffcc00', type: 'universal', category: 'speed' },
  { id: 'triple_shot', name: 'Triple Shot', desc: 'Fire two extra projectiles', color: '#ff66ff', type: 'universal', category: 'damage' },
  { id: 'super_crit', name: 'Super Crit', desc: '+25% chance for 3x damage', color: '#ffff88', type: 'universal', category: 'crit' },
  { id: 'life_steal', name: 'Life Steal', desc: 'Heal 1 HP every 3 kills', color: '#ff0044', type: 'universal', category: 'utility' },
  // Removed chain_lightning - redundant with 'its_electric' (weapon-specific for lightning_rod)
  { id: 'overcharge', name: 'Overcharge', desc: 'Piercing + 20% damage', color: '#00ffcc', type: 'universal', category: 'damage' },
  { id: 'mega_boom', name: 'Mega Boom', desc: 'Bigger AOE, +50% explosion dmg', color: '#ffaa00', type: 'universal', category: 'damage' },
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

  // Lightning Rod upgrades are applied here so card text, HUD previews, and
  // gameplay all read from the same computed stat object.
  let lightningRange = base.lightningRange || 0;
  let lightningMaxTargets = base.lightning ? 3 : 0;
  if (mainWeaponId === 'lightning_rod') {
    const teslaStacks = u.tesla_coil || 0;
    if (teslaStacks > 0) {
      damage *= 1 + teslaStacks * 0.5;
      lightningRange *= 1 + teslaStacks * 0.2;
    }
    lightningMaxTargets += (u.its_electric || 0) * 2;
  }
  
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
  
  // Fix: `let` instead of `const` — the (currently dormant) sniper branch above
  // assigns critMultiplier = 4.5; with const it would throw a TDZ ReferenceError
  // the moment that weapon gets wired up
  let critMultiplier = (u.super_crit || 0) > 0 ? 3 : base.critMultiplier || 2;

  // ── SYNERGY ENGINE (Issue #211): stat-level synergies ──
  const synergies = detectSynergies(u);
  // Lethal Precision: 2+ crit upgrades → crits deal 3x instead of 2x
  if (synergies.some(s => s.id === 'lethal_precision')) {
    critMultiplier = Math.max(critMultiplier, 3);
  }
  // Blood Letter: critical + vampiric → heal every 3 kills instead of 5
  const finalVampiricInterval = synergies.some(s => s.id === 'blood_letter')
    ? Math.min(vampiricInterval || 6, 3)
    : vampiricInterval;
  
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
    vampiricInterval: finalVampiricInterval,
    fireWeakenMult,
    effects,
    ricochetBounces: u.ricochet || 0,
    lightning: base.lightning || false,
    lightningRange,
    lightningMaxTargets,
    lightningTickInterval: base.lightningTickInterval || 0.2,
    lightningDamage: Math.round(damage),
    lightningOrbChargeTime: 1.5,
    lightningOrbDamageCap: 280,
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

// ============================================================
// UPGRADE CARD PREVIEW (Issue #215)
// Pure diff between the current loadout and the loadout + one
// more stack of the candidate upgrade. No DOM/three.js — safe
// for hud.js to call on hover change (never inside the render
// loop; results are cached per hovered card by the caller).
// ============================================================

// Stat keys from getWeaponStats() output surfaced as
// "before → after" lines, with display labels and units.
// rate: value is 1000/fireInterval (shots per second)
// pct:  value is a 0..1 fraction, shown as percent
const PREVIEW_STAT_DEFS = [
  { key: 'damage', label: 'DMG', unit: '' },
  { key: 'fireInterval', label: 'FIRE RATE', unit: '/s', rate: true },
  { key: 'projectileCount', label: 'SHOTS', unit: '' },
  { key: 'critChance', label: 'CRIT', unit: '%', pct: true },
  { key: 'critMultiplier', label: 'CRIT MULT', unit: 'x' },
  { key: 'piercing', label: 'PIERCING', unit: '', bool: true },
  { key: 'aoeRadius', label: 'AOE', unit: 'm' },
  { key: 'lightningRange', label: 'RANGE', unit: 'm' },
  { key: 'lightningMaxTargets', label: 'CHAINS', unit: '' },
  { key: 'vampiricInterval', label: 'HEAL', unit: ' kills' },
  { key: 'ricochetBounces', label: 'BOUNCES', unit: '' },
  { key: 'chargeRateMultiplier', label: 'CHARGE SPEED', unit: 'x' },
  { key: 'chargeDeathRayMultiplier', label: 'MAX CHARGE', unit: 'x' },
  { key: 'windUpSpinTime', label: 'WIND-UP', unit: 'ms' },
];

// Status effect stack labels for the effects[] diff
const PREVIEW_EFFECT_LABELS = { fire: 'IGNITE', shock: 'SHOCK', freeze: 'FREEZE' };

// Rough per-second damage estimate from a computed stat object.
// Purely comparative (before vs after) — not a balancing tool.
function estimateDPS(stats) {
  // Charge cannon is charge-based: one max-charge shot per charge cycle.
  // +0.3s accounts for release timing/next-charge windup (magic number documented).
  if (stats.chargeShot) {
    const cycleSec = (stats.chargeTimeMax / (stats.chargeRateMultiplier || 1)) + 0.3;
    const maxDmg = stats.damage * (stats.chargeDamageMultiplier || 1) * (stats.chargeDeathRayMultiplier || 1);
    return maxDmg / cycleSec;
  }
  const interval = stats.fireInterval || 0;
  if (interval <= 0) return 0;
  const rate = 1000 / interval;
  const critFactor = 1 + stats.critChance * ((stats.critMultiplier || 2) - 1);
  return stats.damage * stats.projectileCount * rate * critFactor;
}

/**
 * Build the preview payload for an upgrade card.
 * @param {string} weaponId - MAIN weapon id of the hand receiving the upgrade.
 * @param {Object} upgrades - game.upgrades[hand] (current stacks).
 * @param {Object} upgradeDef - Upgrade/main/alt weapon definition.
 * @param {Object} [opts] - { enemyHp, extraLines } — enemyHp scales the kill
 *   estimate; extraLines append caller-side lines (e.g. NUKES for extra_nuke).
 * @returns {{statLines: Array, newSynergies: Array, activeSynergies: Array,
 *            dps: {before,after}, killsPerSec: {before,after}}|null}
 */
export function getUpgradePreview(weaponId, upgrades, upgradeDef, opts = {}) {
  const u = upgrades || {};
  const id = upgradeDef?.id;
  if (!id) return null;

  let base, next;
  if (upgradeDef.type === 'main') {
    // MAIN weapon choice (level 1→2): compare current weapon → offered weapon
    // with the SAME upgrade stacks so the delta is the weapon swap itself.
    base = getWeaponStats(weaponId, u);
    next = getWeaponStats(upgradeDef.id, u);
  } else if (upgradeDef.type === 'alt') {
    // ALT weapons aren't in getWeaponStats — surface their cooldown/duration.
    const cooldownS = (upgradeDef.cooldown || 0) / 1000;
    const durationS = upgradeDef.duration ? (upgradeDef.duration / 1000) : null;
    return {
      statLines: [
        { label: 'COOLDOWN', before: 0, after: cooldownS, unit: 's' },
        ...(durationS ? [{ label: 'DURATION', before: 0, after: durationS, unit: 's' }] : []),
      ],
      newSynergies: [], activeSynergies: [],
      dps: { before: 0, after: 0 },
      killsPerSec: { before: 0, after: 0 },
    };
  } else {
    // Normal upgrade: hypothetically add one stack and re-derive stats.
    base = getWeaponStats(weaponId, u);
    const hyp = { ...u, [id]: (u[id] || 0) + 1 };
    next = getWeaponStats(weaponId, hyp);
  }

  // Before/after lines from the computed stat diff
  const statLines = [];
  const seenLabels = new Set();
  for (const def of PREVIEW_STAT_DEFS) {
    const before = def.rate ? (base.fireInterval > 0 ? 1000 / base.fireInterval : 0)
                 : def.pct ? (base[def.key] || 0) * 100
                 : (base[def.key] || 0);
    const after = def.rate ? (next.fireInterval > 0 ? 1000 / next.fireInterval : 0)
                : def.pct ? (next[def.key] || 0) * 100
                : (next[def.key] || 0);
    if (before === after || seenLabels.has(def.label)) continue;
    seenLabels.add(def.label);
    // Booleans (piercing) are stored as flags in getWeaponStats — normalize
    // to 0/1 so the HUD always renders numbers, never 'true'/'false'.
    statLines.push({
      label: def.label,
      before: def.bool ? (before ? 1 : 0) : before,
      after: def.bool ? (after ? 1 : 0) : after,
      unit: def.unit,
      bool: def.bool || undefined, // lets the HUD render OFF → ON for flags
    });
  }

  // Status effect stack changes (fire/shock/freeze upgrades don't move
  // damage numbers but they do move the effects[] array).
  for (const eff of next.effects || []) {
    const beforeCount = (base.effects || []).find(e => e.type === eff.type)?.stacks || 0;
    if (eff.stacks === beforeCount) continue;
    const label = PREVIEW_EFFECT_LABELS[eff.type];
    if (!label || seenLabels.has(label)) continue;
    seenLabels.add(label);
    statLines.push({ label, before: beforeCount, after: eff.stacks, unit: '' });
  }

  // Caller-provided lines (extra_nuke nuke counter, etc.)
  for (const line of opts.extraLines || []) {
    if (seenLabels.has(line.label)) continue;
    seenLabels.add(line.label);
    statLines.push(line);
  }

  // Synergy hints: which combos this pick would newly activate
  // (and which are already running) — #211 synergy detection, pure.
  const currentSynergies = detectSynergies(u);
  const nextSynergies = detectSynergies(
    upgradeDef.type === 'main' ? u : { ...u, [id]: (u[id] || 0) + 1 }
  );
  const newSynergies = nextSynergies.filter(s => !currentSynergies.some(c => c.id === s.id));
  const activeSynergies = currentSynergies;

  // DPS + kills-per-second (comparative only). enemyHp defaults to the
  // basic enemy base HP (enemies.js ENEMY_DEFS.basic.baseHp = 30); the
  // caller passes level-scaled hp so the estimate tracks difficulty.
  const dpsBefore = estimateDPS(base);
  const dpsAfter = estimateDPS(next);
  const enemyHp = opts.enemyHp || 30;
  const killsPerSec = {
    before: dpsBefore > 0 ? dpsBefore / enemyHp : 0,
    after: dpsAfter > 0 ? dpsAfter / enemyHp : 0,
  };

  return { statLines, newSynergies, activeSynergies, dps: { before: dpsBefore, after: dpsAfter }, killsPerSec };
}

// ============================================================
// WEAPON EVOLUTIONS (Issue #143)
// Each MAIN weapon has one hidden evolution recipe — 3 specific
// upgrades (mix of universal + weapon-specific). When the final
// recipe piece is SELECTED on the upgrade screen, the weapon
// transforms. Data here is pure; the cinematic + mechanics live
// in main.js / evolutions.js.
// ============================================================

export const WEAPON_EVOLUTIONS = {
  standard_blaster: {
    id: 'twin_helix',
    name: 'Twin Helix',
    from: 'Standard Blaster',
    recipe: ['scope', 'double_shot', 'critical'],
    sigColor: 0x00ffff,
    sigColorAlt: 0xff00ff,
    desc: 'Fires TWO helix-woven projectiles that spiral around each other.',
    baseColor: 0x4488ff,
    auraColors: [0x00ffff, 0xff00ff],
    projectileCount: 2,
    helixRadius: 0.3,
    helixSpeed: 8,
    damage: 10,
    fireInterval: 160,
  },
  buckshot: {
    id: 'dragons_breath',
    name: "Dragon's Breath",
    from: 'Buckshot',
    recipe: ['fire', 'buckshot_gentlemen', 'focused_frenzy'],
    sigColor: 0xff4400,
    sigColorAlt: 0xffaa00,
    desc: 'Molten pellets ignite enemies and leave burning trails.',
    baseColor: 0xff8800,
    auraColors: [0xff4400, 0xffaa00, 0xff6600],
    igniteChance: 1.0,
    igniteDuration: 3000,
    fireTrailDuration: 2000,
    fireTrailDamage: 3,
    fireTrailRadius: 0.5,
  },
  lightning_rod: {
    id: 'tesla_tower',
    name: 'Tesla Tower',
    from: 'Lightning Rod',
    recipe: ['shock', 'its_electric', 'barrel'],
    sigColor: 0x4488ff,
    sigColorAlt: 0x88ccff,
    desc: 'Creates tesla coils that arc electricity to all enemies within 6m.',
    baseColor: 0xff00ff,
    auraColors: [0x4488ff, 0x88ccff, 0xffffff],
    coilDuration: 3000,
    coilRange: 6,
    maxCoils: 2,
    arcDamage: 8,
    arcInterval: 500,
  },
  charge_cannon: {
    id: 'singularity_launcher',
    name: 'Singularity Launcher',
    from: 'Charge Cannon',
    recipe: ['quick_charge', 'death_ray', 'piercing'],
    sigColor: 0x8800ff,
    sigColorAlt: 0xff00ff,
    desc: 'Charged shots create micro-black-holes that pull enemies in then detonate.',
    baseColor: 0xff4444,
    auraColors: [0x8800ff, 0xff00ff, 0x440088],
    singularityDuration: 1500,
    pullRadius: 5,
    pullForce: 8,
    detonationDamage: 60,
  },
  plasma_carbine: {
    id: 'obliterator_beam',
    name: 'Obliterator Beam',
    from: 'Plasma Carbine',
    recipe: ['hold_together', 'barrel', 'scope'],
    sigColor: 0x00ff44,
    sigColorAlt: 0x88ff44,
    desc: 'Wind-up ramps into a CONTINUOUS BEAM. Overheats after 4s.',
    baseColor: 0x00ffff,
    auraColors: [0x00ff44, 0x88ff44, 0x00ff88],
    beamDuration: 4000,
    overheatCooldown: 1500,
    beamDamagePerFrame: 2,
    beamWidth: 0.15,
  },
  seeker_burst: {
    id: 'hive_mind',
    name: 'Hive Mind',
    from: 'Seeker Burst',
    recipe: ['gimme_more', 'ricochet', 'double_shot'],
    sigColor: 0xaa44ff,
    sigColorAlt: 0xff44ff,
    desc: 'Spawns 8 micro-drones that independently seek and dive-bomb enemies.',
    baseColor: 0xaa88ff,
    auraColors: [0xaa44ff, 0xff44ff, 0x8844cc],
    droneCount: 8,
    droneDamage: 6,
    droneRegenTime: 5000,
  },
};

/**
 * Get the evolution definition for a MAIN weapon id (or null).
 */
export function getEvolutionForWeapon(weaponId) {
  return WEAPON_EVOLUTIONS[weaponId] || null;
}

/**
 * True when the hand's upgrade map completes the weapon's recipe.
 * @returns {Object|null} evolution def or null
 */
export function checkEvolutionReady(weaponId, upgrades) {
  const evo = WEAPON_EVOLUTIONS[weaponId];
  if (!evo) return null;
  const allCollected = evo.recipe.every(recipeId => (upgrades[recipeId] || 0) > 0);
  return allCollected ? evo : null;
}

/**
 * Progress toward the weapon's evolution (for the upgrade-screen HUD line).
 * @returns {{evo, collected, total, recipeIds, collectedIds}|null}
 */
export function getEvolutionProgress(weaponId, upgrades) {
  const evo = WEAPON_EVOLUTIONS[weaponId];
  if (!evo) return null;
  const collectedIds = evo.recipe.filter(recipeId => (upgrades[recipeId] || 0) > 0);
  return {
    evo,
    collected: collectedIds.length,
    total: evo.recipe.length,
    recipeIds: evo.recipe,
    collectedIds,
  };
}

// ============================================================
// ALCHEMY BENCH (Issue #185)
// Pure rules for dissolving upgrades into Essence and forging
// new ones. No DOM/three.js; game-state mutation lives in
// main.js's alchemy handlers so these stay unit-testable.
// ============================================================

// Cost of every forge option (issue: 3 Essence)
export const ALCHEMY_FORGE_COST = 3;

// Targeted Infusion categories (issue: Damage / Speed / Crit / Status;
// utility added so sustain upgrades have a home)
export const ALCHEMY_CATEGORIES = {
  damage: 'Damage',
  speed: 'Speed',
  crit: 'Crit',
  status: 'Status',
  utility: 'Utility',
};

/**
 * Essence gained from dissolving ONE stack of an upgrade.
 * Weapon-specific = 2; status effects are 1.5 per the issue table,
 * rounded DOWN per dissolve → 1; standard universals = 1.
 */
export function getEssenceValue(upgradeDef) {
  if (!upgradeDef) return 0;
  if (upgradeDef.type === 'weapon_specific') return 2;
  if (['shock', 'fire', 'freeze', 'ricochet'].includes(upgradeDef.id)) return 1; // 1.5 → 1
  return 1;
}

/**
 * List dissolvable upgrades for a hand's upgrade map.
 * @param {Object} handUpgrades - game.upgrades.left / .right
 * @returns {Array<{id, name, stacks, essencePerStack, color}>}
 */
export function getDissolvableUpgrades(handUpgrades) {
  const out = [];
  for (const [id, count] of Object.entries(handUpgrades || {})) {
    if (count <= 0) continue;
    const def = getUpgradeDef(id);
    if (!def) continue;
    out.push({
      id,
      name: def.name,
      stacks: count,
      essencePerStack: getEssenceValue(def),
      color: def.color || '#00ffff',
    });
  }
  return out;
}

/**
 * Pick the upgrade a forge option would grant. PURE: caller passes the
 * hand's main weapon id and owned upgrade map so tests can be explicit.
 * @param {string} forgeType - mystery_brew|targeted_infusion|weapon_synthesis|desperate_measure
 * @param {Object} opts - { mainWeaponId, owned, category }
 * @returns {{upgrade: Object}|{refund: true}|null}
 *   refund: weapon synthesis has no weapon-specific upgrades for the
 *   main weapon — the issue grants 1 Essence back instead.
 */
export function getForgeUpgrade(forgeType, opts = {}) {
  const mainWeaponId = opts.mainWeaponId || 'standard_blaster';
  const owned = opts.owned || {};
  switch (forgeType) {
    case 'mystery_brew': {
      // Random SPECIAL pool upgrade (normally boss-only), filtered to the
      // main weapon's compatibility like getRandomSpecialUpgrades.
      const pool = SPECIAL_UPGRADE_POOL.filter(u =>
        u.type === 'universal' || (u.type === 'weapon_specific' && u.weapon === mainWeaponId)
      );
      if (pool.length === 0) return null;
      return { upgrade: pool[Math.floor(Math.random() * pool.length)] };
    }
    case 'targeted_infusion': {
      const pool = UPGRADE_POOL.filter(u => u.category === opts.category);
      if (pool.length === 0) return null;
      return { upgrade: pool[Math.floor(Math.random() * pool.length)] };
    }
    case 'weapon_synthesis': {
      const pool = UPGRADE_POOL.filter(u => u.type === 'weapon_specific' && u.weapon === mainWeaponId);
      if (pool.length === 0) return { refund: true };
      return { upgrade: pool[Math.floor(Math.random() * pool.length)] };
    }
    case 'desperate_measure': {
      // Random upgrade the hand does NOT already own (safety net vs dupes).
      // Filtered to the main weapon's compatible pool — an upgrade for a
      // DIFFERENT weapon would be dead weight, worse than 'underwhelming'.
      const pool = UPGRADE_POOL.filter(u =>
        !(owned[u.id] > 0) &&
        (u.type === 'universal' || (u.type === 'weapon_specific' && u.weapon === mainWeaponId))
      );
      if (pool.length === 0) return null;
      return { upgrade: pool[Math.floor(Math.random() * pool.length)] };
    }
    default:
      return null;
  }
}

// ============================================================
// SYNERGY ENGINE (Issue #211)
// Pure detection: given one hand's upgrade map, return the active
// synergies. Elemental combos cap at the highest tier (PRIME STATE
// replaces the pairs — no multiplicative stacking). Stat-level
// synergies (lethal_precision, blood_letter) modify getWeaponStats;
// behavior-level synergies (thermal_shock, plasma_arc, cryo_conduction,
// prime_state) are consumed by enemies.js via isSynergyActive().
// ============================================================

export const SYNERGY_DEFS = {
  prime_state:       { name: 'PRIME STATE',      desc: '3x status damage + chain to ALL non-statused enemies', tier: 3 },
  thermal_shock:     { name: 'Thermal Shock',    desc: 'Frozen enemies taking fire damage shatter for 50% max HP AoE', tier: 2 },
  plasma_arc:        { name: 'Plasma Arc',       desc: 'Electrified enemies burn 50% faster; fire spreads via chains', tier: 2 },
  cryo_conduction:   { name: 'Cryo-Conduction',  desc: 'Electrified enemies slow nearby enemies by 30%', tier: 2 },
  lethal_precision:  { name: 'Lethal Precision', desc: 'Crits deal 3x instead of 2x', tier: 1 },
  blood_letter:      { name: 'Blood Letter',     desc: 'Vampiric heals every 3 kills instead of 5', tier: 1 },
};

/**
 * Detect active synergies for a hand's upgrade map.
 * @param {Object} upgrades - game.upgrades.left / .right
 * @returns {Array<{id, name, tier}>} active synergies (highest elemental tier wins)
 */
export function detectSynergies(upgrades) {
  const u = upgrades || {};
  const synergies = [];
  const hasFire = (u.fire || 0) > 0;
  const hasFreeze = (u.freeze || 0) > 0;
  const hasShock = (u.shock || 0) > 0;

  // Elemental — PRIME STATE replaces all pairs (no stacking)
  if (hasFire && hasFreeze && hasShock) {
    synergies.push({ id: 'prime_state', name: 'PRIME STATE', tier: 3 });
  } else {
    if (hasFire && hasFreeze) synergies.push({ id: 'thermal_shock', name: 'Thermal Shock', tier: 2 });
    if (hasFire && hasShock) synergies.push({ id: 'plasma_arc', name: 'Plasma Arc', tier: 2 });
    if (hasFreeze && hasShock) synergies.push({ id: 'cryo_conduction', name: 'Cryo-Conduction', tier: 2 });
  }

  // Critical mass
  const critCount = (u.critical || 0) + (u.super_crit || 0) * 2;
  if (critCount >= 2) synergies.push({ id: 'lethal_precision', name: 'Lethal Precision', tier: 1 });
  if (critCount >= 1 && (u.vampiric || 0) > 0) synergies.push({ id: 'blood_letter', name: 'Blood Letter', tier: 1 });

  return synergies;
}

/**
 * True if EITHER hand has the given synergy active.
 * Reads the game.synergies snapshot (recomputed on every upgrade pick by
 * main.js) — safe for per-tick/per-frame checks in enemies.js.
 */
export function isSynergyActive(id) {
  const syn = game?.synergies;
  if (!syn) return false;
  return (syn.left && syn.left.some(s => s.id === id)) ||
         (syn.right && syn.right.some(s => s.id === id));
}
