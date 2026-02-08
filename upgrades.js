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
  { id: 'buckshot',    name: 'Buckshot',    desc: 'Multi-pellet spread shot',          color: '#cccccc' },
  { id: 'piercing',    name: 'Piercing',    desc: 'Shots pass through enemies',        color: '#00ffaa' },
  { id: 'vampiric',    name: 'Vampiric',    desc: 'Heal half-heart every 5 kills',     color: '#cc0044' },
  { id: 'critical',    name: 'Critical',    desc: '+15% chance for 2x damage',         color: '#ffff00' },
  { id: 'double_shot', name: 'Double Shot', desc: 'Fire an extra projectile',          color: '#ff44ff' },
  { id: 'freeze',      name: 'Freeze',      desc: 'Greatly slows enemies',             color: '#88ccff' },
  { id: 'ricochet',    name: 'Ricochet',    desc: 'Shots bounce to nearby enemy',      color: '#aaffaa' },
  { id: 'lightning',   name: 'Lightning',   desc: 'Hold for auto-lock beam',           color: '#ffff44' },
];

/** Pick `count` random upgrades from the pool */
export function getRandomUpgrades(count) {
  const shuffled = [...UPGRADE_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
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

  // Base values
  let damage        = 15 + (u.scope || 0) * 10;
  // OLD: let fireInterval = 300 / (1 + (u.barrel || 0) * 0.15);
  let fireInterval  = (300 / (1 + (u.barrel || 0) * 0.15)) * 0.57;  // +75% fire rate
  let projectileCount = 1 + (u.double_shot || 0);
  let critChance    = Math.min((u.critical || 0) * 0.15, 0.9);
  let piercing      = (u.piercing || 0) > 0;
  let aoeRadius     = (u.big_boom || 0) > 0 ? 0.5 + (u.big_boom || 0) * 0.3 : 0;
  let spreadAngle   = 0;

  // Fire effect: enemies take +15% damage per stack
  const fireWeakenMult = 1 + (u.fire || 0) * 0.15;

  // Buckshot replaces normal projectiles with a spread
  if (u.buckshot) {
    const s = u.buckshot;
    projectileCount = s === 1 ? 4 : s === 2 ? 7 : s === 3 ? 9 : 9 + (s - 3);
    spreadAngle = 0.25;  // radians
    damage *= 0.5;       // each pellet does less
  }

  // Vampiric: heal every N kills (fewer kills needed with more stacks)
  const vampiricInterval = (u.vampiric || 0) > 0 ? Math.max(2, 6 - (u.vampiric || 0)) : 0;

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
    piercing,
    aoeRadius,
    spreadAngle,
    vampiricInterval,
    fireWeakenMult,
    effects,
    ricochetBounces:  u.ricochet || 0,
    lightning:        (u.lightning || 0) > 0,
    lightningRange:   8 + (u.lightning || 0) * 2,  // 8-14m range
    lightningDamage:  10 + (u.lightning || 0) * 5,  // 10-25 damage per tick
  };
}
