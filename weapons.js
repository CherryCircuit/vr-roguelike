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
  
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
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
  
  assault_rifle: {
    id: 'assault_rifle',
    name: 'Assault Rifle',
    desc: 'High fire rate, lower damage',
    color: '#ffff00',
    type: 'main',
    baseStats: {
      damage: 8,
      fireInterval: 90,  // Very fast
      projectileCount: 1,
      critChance: 0.05,
      critMultiplier: 2,
      piercing: false,
      aoeRadius: 0,
      spreadAngle: 0,
    },
  },
  
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    desc: 'High damage, slow fire, piercing',
    color: '#00ff00',
    type: 'main',
    baseStats: {
      damage: 50,
      fireInterval: 800,  // Very slow
      projectileCount: 1,
      critChance: 0.25,
      critMultiplier: 3,
      piercing: true,
      aoeRadius: 0,
      spreadAngle: 0,
    },
  },
  
  cannon: {
    id: 'cannon',
    name: 'Cannon',
    desc: 'Explosive shots, AOE damage',
    color: '#ff4444',
    type: 'main',
    baseStats: {
      damage: 25,
      fireInterval: 600,
      projectileCount: 1,
      critChance: 0.1,
      critMultiplier: 2,
      piercing: false,
      aoeRadius: 1.2,
      spreadAngle: 0,
    },
  },
  
  laser_beam: {
    id: 'laser_beam',
    name: 'Laser Beam',
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
  
  // Weapon-specific upgrades
  { id: 'shotgun_choke', name: 'Choke', desc: 'Shotgun: Tighter spread', color: '#ff8800', type: 'weapon_specific', weapon: 'shotgun' },
  { id: 'shotgun_drum', name: 'Drum Mag', desc: 'Shotgun: +3 pellets', color: '#ff8800', type: 'weapon_specific', weapon: 'shotgun' },
  { id: 'rifle_burst', name: 'Burst Fire', desc: 'Assault Rifle: 3-round burst', color: '#ffff00', type: 'weapon_specific', weapon: 'assault_rifle' },
  { id: 'sniper_scope', name: 'Sniper Scope', desc: 'Sniper: +50% crit damage', color: '#00ff00', type: 'weapon_specific', weapon: 'sniper' },
  { id: 'cannon_napalm', name: 'Napalm', desc: 'Cannon: Fire DoT on explosion', color: '#ff4444', type: 'weapon_specific', weapon: 'cannon' },
  { id: 'laser_overcharge', name: 'Overcharge', desc: 'Laser Beam: +20% damage', color: '#ff00ff', type: 'weapon_specific', weapon: 'laser_beam' },
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
