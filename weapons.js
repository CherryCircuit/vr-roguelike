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
      spreadAngle: 0.0873,  // 5 degrees
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
      chargeTimeMax: 5.0,  // Max charge time in seconds
      chargeDamageMultiplier: 3.0,  // Max damage = base * 3.0
    },
  },
  
  plasma_carbine: {
    id: 'plasma_carbine',
    name: 'Plasma Carbine',
    desc: 'Fast shooting, ramps up damage, slight spread',
    color: '#88ff88',
    type: 'main',
    baseStats: {
      damage: 6,
      fireInterval: 100,  // Fast
      projectileCount: 1,
      critChance: 0.08,
      critMultiplier: 2,
      piercing: false,
      aoeRadius: 0,
      spreadAngle: 0.0262,  // 1.5 degrees
      damageRampUp: true,  // Damage increases with consecutive hits
      damageRampUpMax: 2.0,  // Max 2x damage after ramp-up
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
      spreadAngle: 0.1745,  // 10 degrees
      homing: true,  // Shots track enemies
      homingRange: 15,  // Tracking range
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
    cooldown: 3000,  // 3 seconds
    duration: 2000,  // 2 seconds
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
  
  // Standard Blaster specific upgrades
  { id: 'doubleshot', name: 'Doubleshot', desc: 'Standard Blaster: Fire 2 shots at once', color: '#00ffff', type: 'weapon_specific', weapon: 'standard_blaster' },
  { id: 'triple_shot', name: 'Triple Shot', desc: 'Standard Blaster: Fire 3 shots at once', color: '#00ffff', type: 'weapon_specific', weapon: 'standard_blaster' },
  
  // Buckshot specific upgrades
  { id: 'focused_frenzy', name: 'Focused Frenzy', desc: 'Buckshot: Tighter spread + faster fire', color: '#ff8800', type: 'weapon_specific', weapon: 'buckshot' },
  { id: 'buckshot_gentlemen', name: 'Buckshot Gentlemen', desc: 'Buckshot: +4 pellets', color: '#ff8800', type: 'weapon_specific', weapon: 'buckshot' },
  { id: 'duck_hunt', name: 'Duck Hunt', desc: 'Buckshot: Critical hits stun', color: '#ff8800', type: 'weapon_specific', weapon: 'buckshot' },
  
  // Lightning Rod specific upgrades
  { id: 'its_electric', name: 'It\'s Electric!', desc: 'Lightning Rod: Chains to +2 enemies', color: '#ff00ff', type: 'weapon_specific', weapon: 'lightning_rod' },
  { id: 'tesla_coil', name: 'Tesla Coil', desc: 'Lightning Rod: +50% damage, +20% range', color: '#ff00ff', type: 'weapon_specific', weapon: 'lightning_rod' },
  
  // Charge Cannon specific upgrades
  { id: 'quick_charge', name: 'Ain\'t Nobody Got Time For That', desc: 'Charge Cannon: 2x charge speed', color: '#ff4444', type: 'weapon_specific', weapon: 'charge_cannon' },
  { id: 'excess_heat', name: 'Excess Heat', desc: 'Charge Cannon: Adds fire DoT to charged shots', color: '#ff4444', type: 'weapon_specific', weapon: 'charge_cannon' },
  { id: 'death_ray', name: 'Death Ray', desc: 'Charge Cannon: +100% max charge damage', color: '#ff4444', type: 'weapon_specific', weapon: 'charge_cannon' },
  
  // Plasma Carbine specific upgrades
  { id: 'hold_together', name: 'Hold It Together', desc: 'Plasma Carbine: Faster ramp-up, higher max damage', color: '#88ff88', type: 'weapon_specific', weapon: 'plasma_carbine' },
  
  // Seeker Burst specific upgrades
  { id: 'gimme_more', name: 'Gimme Gimme More', desc: 'Seeker Burst: +2 homing shots per burst', color: '#aa88ff', type: 'weapon_specific', weapon: 'seeker_burst' },
];

// Special upgrades (after boss victories)
export const SPECIAL_UPGRADE_POOL = [
  { id: 'mega_scope', name: 'Mega Scope', desc: 'Damage +25 per stack', color: '#00ff88', type: 'universal' },
  { id: 'turbo_barrel', name: 'Turbo Barrel', desc: 'Fire rate +30%', color: '#ffcc00', type: 'universal' },
  { id: 'triple_shot', name: 'Triple Shot', desc: 'Fire two extra projectiles', color: '#ff66ff', type: 'universal' },
  { id: 'super_crit', name: 'Super Crit', desc: '+25% chance for 3x damage', color: '#ffff88', type: 'universal' },
  { id: 'life_steal', name: 'Life Steal', desc: 'Heal 1 HP every 3 kills', color: '#ff0044', type: 'universal' },
  { id: 'chain_lightning', name: 'Chain Lightning', desc: 'Lightning chains to +2 enemies', color: '#ffff00', type: 'universal' },
  { id: 'overcharge', name: 'Overcharge', desc: 'Piercing + 20% damage', color: '#00ffcc', type: 'universal' },
  { id: 'mega_boom', name: 'Mega Boom', desc: 'Bigger AOE, +50% explosion dmg', color: '#ffaa00', type: 'universal' },
];

// ── HELPER FUNCTIONS ─────────────────────────────────────────

/**
 * Get a random MAIN weapon (for level 1-2 guaranteed upgrade)
 */
export function getRandomMainWeapon() {
  const keys = Object.keys(MAIN_WEAPONS);
  return keys[Math.floor(Math.random() * keys.length)];
}

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
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Pick random special upgrades (after boss)
 */
export function getRandomSpecialUpgrades(count, mainWeaponId = null) {
  let pool = SPECIAL_UPGRADE_POOL;
  
  if (mainWeaponId) {
    // Could filter special upgrades by weapon type too if needed
    // For now, all special upgrades are universal
  }
  
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
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
    spreadAngle: base.spreadAngle || 0,
    vampiricInterval,
    fireWeakenMult,
    effects,
    ricochetBounces: u.ricochet || 0,
    lightning: base.lightning || false,
    lightningRange: base.lightningRange || 0,
    lightningTickInterval: base.lightningTickInterval || 0.2,
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
