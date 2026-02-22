// ============================================================
//  UPGRADE DEFINITIONS & WEAPON STATS
//  Defines the pool of upgrades and computes weapon stats
//  from the player's stacked upgrades.
// ============================================================

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
  
  // Standard Blaster specific
  { id: 'triple_shot', name: 'Triple Shot', desc: 'Fire two extra projectiles', color: '#00ffff' },
  
  // Buckshot specific
  { id: 'focused_frenzy', name: 'Focused Frenzy', desc: 'Buckshot: Tighter spread + faster fire', color: '#ff8800' },
  { id: 'buckshot_gentlemen', name: 'Buckshot Gentlemen', desc: 'Buckshot: +4 pellets', color: '#ff8800' },
  { id: 'duck_hunt', name: 'Duck Hunt', desc: 'Buckshot: Critical hits stun', color: '#ff8800' },
  
  // Lightning Rod specific
  { id: 'its_electric', name: 'It\'s Electric!', desc: 'Lightning Rod: Chains to +2 enemies', color: '#ff00ff' },
  { id: 'tesla_coil', name: 'Tesla Coil', desc: 'Lightning Rod: +50% damage, +20% range', color: '#ff00ff' },
  
  // Charge Cannon specific
  { id: 'quick_charge', name: 'Ain\'t Nobody Got Time For That', desc: 'Charge Cannon: 2x charge speed', color: '#ff4444' },
  { id: 'excess_heat', name: 'Excess Heat', desc: 'Charge Cannon: Adds fire DoT to charged shots', color: '#ff4444' },
  { id: 'death_ray', name: 'Death Ray', desc: 'Charge Cannon: +100% max charge damage', color: '#ff4444' },
  
  // Plasma Carbine specific
  { id: 'hold_together', name: 'Hold It Together', desc: 'Plasma Carbine: Faster ramp-up, higher max', color: '#88ff88' },
  
  // Seeker Burst specific
  { id: 'gimme_more', name: 'Gimme Gimme More', desc: 'Seeker Burst: +2 homing shots per burst', color: '#aa88ff' },
];

/** Special upgrades offered after boss victories (really valuable) */
export const SPECIAL_UPGRADE_POOL = [
  { id: 'mega_scope', name: 'Mega Scope', desc: 'Damage +25 per stack', color: '#00ff88' },
  { id: 'turbo_barrel', name: 'Turbo Barrel', desc: 'Fire rate +30%', color: '#ffcc00' },
  { id: 'triple_shot', name: 'Triple Shot', desc: 'Fire two extra projectiles', color: '#ff66ff' },
  { id: 'mega_boom', name: 'Mega Boom', desc: 'Bigger AOE, +50% explosion dmg', color: '#ffaa00' },
  { id: 'super_crit', name: 'Super Crit', desc: '+25% chance for 3x damage', color: '#ffff88' },
  { id: 'life_steal', name: 'Life Steal', desc: 'Heal 1 HP every 3 kills', color: '#ff0044' },
  { id: 'chain_lightning', name: 'Chain Lightning', desc: 'Lightning chains to +2 enemies', color: '#ffff00' },
  { id: 'overcharge', name: 'Overcharge', desc: 'Piercing + 20% damage', color: '#00ffcc' },
];

/** Pick `count` random special upgrades (for after boss) */
export function getRandomSpecialUpgrades(count) {
  const shuffled = [...SPECIAL_UPGRADE_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Pick `count` random upgrades from the pool, optionally excluding some IDs */
export function getRandomUpgrades(count, excludeIds = []) {
  const excludeSet = new Set(excludeIds);
  const pool = UPGRADE_POOL.filter(u => !excludeSet.has(u.id));
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

  const critMultiplier = (u.super_crit || 0) > 0 ? 3 : 2;

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
  };
}
