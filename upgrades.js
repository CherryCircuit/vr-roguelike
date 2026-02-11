// ============================================================
//  UPGRADE DEFINITIONS & WEAPON STATS
//  Defines the pool of upgrades and computes weapon stats
//  from the player's stacked upgrades.
// ============================================================

export const UPGRADE_POOL = [
  { id: 'scope',       name: 'Scope',       desc: 'Damage +10 per stack',              color: '#00ff44' },
  { id: 'barrel',      name: 'Barrel',      desc: 'Fire rate +15%',                    color: '#ffaa00' },
  { id: 'shock',       name: 'Shock',       desc: 'Electrocutes: slows + shock DoT',   color: '#4488ff' },
  { id: 'fire',        name: 'Fire',        desc: 'Ignites: weakens + fire DoT',       color: '#ff4400' },
  { id: 'big_boom',    name: 'Big Boom',    desc: 'Explodes on impact (AOE)',          color: '#ff8800' },
  { id: 'buckshot',    name: 'Buckshot',    desc: 'Multi-pellet spread shot',          color: '#cccccc', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
  { id: 'piercing',    name: 'Piercing',    desc: 'Shots pass through enemies',        color: '#00ffaa' },
  { id: 'vampiric',    name: 'Vampiric',    desc: 'Heal half-heart every 5 kills',     color: '#cc0044' },
  { id: 'critical',    name: 'Critical',    desc: '+15% chance for 2x damage',         color: '#ffff00' },
  { id: 'double_shot', name: 'Double Shot', desc: 'Fire an extra projectile',          color: '#ff44ff' },
  { id: 'freeze',      name: 'Freeze',      desc: 'Greatly slows enemies',             color: '#88ccff' },
  { id: 'ricochet',    name: 'Ricochet',    desc: 'Shots bounce to nearby enemy',      color: '#aaffaa' },
  { id: 'lightning',   name: 'Lightning',   desc: 'Hold for auto-lock beam',           color: '#ffff44', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
  { id: 'charge_shot', name: 'Charge Shot', desc: 'Hold to charge, release for big beam', color: '#ffffff', sideGrade: true, sideGradeNote: 'Changes SHOT TYPE. Pick another upgrade after.' },
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
  let damage        = 15 + (u.scope || 0) * 10 + (u.mega_scope || 0) * 25;
  let fireInterval  = (300 / (1 + (u.barrel || 0) * 0.15 + (u.turbo_barrel || 0) * 0.3)) * 0.57;
  let projectileCount = 1 + (u.double_shot || 0) + (u.triple_shot || 0) * 2;
  let critChance    = Math.min((u.critical || 0) * 0.15 + (u.super_crit || 0) * 0.25, 0.9);
  let piercing      = (u.piercing || 0) > 0 || (u.overcharge || 0) > 0;
  let aoeRadius     = (u.big_boom || 0) > 0 || (u.mega_boom || 0) > 0
    ? 0.5 + ((u.big_boom || 0) + (u.mega_boom || 0) * 1.5) * 0.3
    : 0;
  let spreadAngle   = 0;

  // Fire effect: enemies take +15% damage per stack
  const fireWeakenMult = 1 + (u.fire || 0) * 0.15;

  // Buckshot replaces normal projectiles with a spread
  if (u.buckshot) {
    const s = u.buckshot;
    projectileCount = s === 1 ? 5 : s === 2 ? 8 : s === 3 ? 11 : 11 + (s - 3);
    spreadAngle = 0.0524; // 3 degrees (PI/180 * 3)
    damage *= 1.25;      // Higher damage per pellet
    fireInterval *= 3.0; // EVEN SLOWER fire rate for heavy shotgun feel
  }


  // Vampiric / Life Steal: heal every N kills
  const vampiricStacks = (u.vampiric || 0) + (u.life_steal || 0) * 2;
  const vampiricInterval = vampiricStacks > 0 ? Math.max(2, (u.life_steal ? 3 : 6) - vampiricStacks) : 0;
  if (u.overcharge) damage *= 1.2;

  // Collect status effects to apply on hit
  const effects = [];
  if (u.fire)   effects.push({ type: 'fire',   stacks: u.fire });
  if (u.shock)  effects.push({ type: 'shock',  stacks: u.shock });
  if (u.freeze) effects.push({ type: 'freeze', stacks: u.freeze });

  const critMultiplier = (u.super_crit || 0) > 0 ? 3 : 2;

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
    lightning:        (u.lightning || 0) > 0,
    lightningRange:   8 + (u.lightning || 0) * 2 + (u.chain_lightning || 0) * 4,
    lightningDamage:  10 + (u.lightning || 0) * 5 + (u.chain_lightning || 0) * 5,
    lightningTickInterval: (u.lightning || 0) > 0 ? Math.max(0.08, 0.2 / (1 + (u.barrel || 0) * 0.15)) : 0.2,
    chargeShot: (u.charge_shot || 0) > 0,
  };
}
