// ============================================================
//  ECLIPSE SYSTEM (Issue #172)
//  The Eclipse Engine's corruption layer: during the back half of
//  the final boss fight the boss "eclipses" player upgrades — they
//  turn against the player for a few seconds. Damage bonuses become
//  penalties, status ammo damages the player, crits can reflect.
//
//  Ownership split (keeps module cycles out):
//  - THIS MODULE: effect definitions, active-eclipse state, the pure
//    applyEclipseToStats() transform, per-frame ticking of durations
//    + self-damage drains, and the HUD/audio callbacks.
//  - enemies.js (EclipseEngineBoss): scheduling — when to trigger,
//    HP escalation, shock counterplay — via pickEclipseTarget(),
//    applyEclipse(), getActiveEclipseCount(), purgeAllEclipses().
//  - main.js: dependency injection (initEclipseSystem), per-frame
//    updateEclipse(), and purge hooks on boss death/reset.
//
//  All callbacks are guarded: the system is a safe no-op if it was
//  never initialized (dev pages, tests). No game state is imported —
//  everything comes in via injected deps.
// ============================================================

const DEBUG = false;
const _log = DEBUG ? console.log.bind(console) : () => {};

// Active eclipses: key `${upgradeId}|${hand}` -> entry
// entry: { id, hand, label, color, durationSec, remainingSec }
const _activeEclipses = new Map();

// Injected dependencies (set once via initEclipseSystem)
let _deps = null;

// Which universal upgrades can be eclipsed. Weapon-specific upgrades and
// mastery cards are excluded — they are build-defining and rare; corrupting
// them would feel arbitrary rather than threatening.
const ECLIPSABLE_IDS = new Set([
  'scope', 'mega_scope',
  'barrel', 'turbo_barrel',
  'double_shot', 'triple_shot',
  'critical', 'super_crit',
  'piercing', 'overcharge',
  'vampiric', 'life_steal',
  'fire', 'shock', 'freeze',
]);

// Human labels + HUD colors per eclipsed upgrade (color doubles as the
// self-damage "wrongness" color family, matching the issue's direction).
const ECLIPSE_LABELS = {
  scope: { label: 'DAMAGE CORRUPTED', color: '#ff0044' },
  mega_scope: { label: 'DAMAGE CORRUPTED', color: '#ff0044' },
  barrel: { label: 'FIRE RATE CORRUPTED', color: '#ff4400' },
  turbo_barrel: { label: 'FIRE RATE CORRUPTED', color: '#ff4400' },
  double_shot: { label: 'PROJECTILES SCATTER', color: '#ffaa00' },
  triple_shot: { label: 'PROJECTILES SCATTER', color: '#ffaa00' },
  critical: { label: 'CRITS REFLECTED', color: '#ff00ff' },
  super_crit: { label: 'CRITS REFLECTED', color: '#ff00ff' },
  piercing: { label: 'PIERCE SEALED', color: '#ff2200' },
  overcharge: { label: 'PIERCE SEALED', color: '#ff2200' },
  vampiric: { label: 'REGEN DRAINS HP', color: '#aa00ff' },
  life_steal: { label: 'REGEN DRAINS HP', color: '#aa00ff' },
  fire: { label: 'FIRE TURNS ON YOU', color: '#ff6600' },
  shock: { label: 'SHOCK TURNS ON YOU', color: '#ffdd00' },
  freeze: { label: 'FREEZE TURNS ON YOU', color: '#00aaff' },
};

// Self-damage drain cadence: every 2s, 1 HP per harmful eclipse (status
// ammo + vampiric), capped at 2/tick so the worst case is ~1 dmg/s —
// annoying, never lethal on its own (issue #172 balance notes).
const SELF_DRAIN_INTERVAL = 2.0;
let _drainTimer = 0;

// Fraction of crits that reflect (0.15): at max fire rate + max crit this
// is ~0.5 dmg/s worst case — survivable for the 10s eclipse with
// defensive play, impossible to ignore.
const CRIT_REFLECT_CHANCE = 0.15;

function _hasDep(name) {
  return !!(_deps && typeof _deps[name] === 'function');
}

/**
 * Wire the eclipse system's dependencies. Called once from main.js init.
 * deps: { getUpgrades, applyPlayerDamage, triggerHitFlash, triggerStyleFlash,
 *         showEclipseWarning, hideEclipseWarning, showFloatingMessage,
 *         playEclipseCorruptSound, playEclipsePurgeSound,
 *         playEclipsePhase2StartSound, playEclipseSelfDamageSound }
 */
export function initEclipseSystem(deps) {
  _deps = deps || null;
  _activeEclipses.clear();
  _drainTimer = 0;
  _log('[eclipse] system initialized');
}

// ── Queries (used by the boss scheduler and the stats wrapper) ──

export function isEclipseActive() {
  return _activeEclipses.size > 0;
}

export function getActiveEclipseCount() {
  return _activeEclipses.size;
}

/** Upgrade ids currently eclipsed for one hand (empty array when clean). */
export function getActiveEclipseIds(hand) {
  const ids = [];
  _activeEclipses.forEach((entry) => {
    if (entry.hand === hand) ids.push(entry.id);
  });
  return ids;
}

// ── Boss-facing API ──

/**
 * Pick a random (upgradeId, hand) pair the player actually owns that can be
 * eclipsed. Returns null when the player has nothing eclipsable — the boss
 * simply skips the cycle (no effect, no fake warning).
 */
export function pickEclipseTarget() {
  if (!_hasDep('getUpgrades')) return null;
  const upgrades = _deps.getUpgrades();
  if (!upgrades) return null;

  const candidates = [];
  for (const hand of ['left', 'right']) {
    const map = upgrades[hand] || {};
    for (const id of Object.keys(map)) {
      if (ECLIPSABLE_IDS.has(id) && (map[id] || 0) > 0) {
        candidates.push({ id, hand });
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Start corrupting an upgrade for durationSec seconds. Shows the HUD
 * warning + corruption sound. Returns the entry, or null if that exact
 * upgrade is already eclipsed (never double-eclipse the same upgrade).
 */
export function applyEclipse(target, durationSec) {
  const meta = ECLIPSE_LABELS[target.id] || { label: 'UPGRADE ECLIPSED', color: '#ff0000' };
  const key = `${target.id}|${target.hand}`;
  if (_activeEclipses.has(key)) return null;

  const entry = {
    id: target.id,
    hand: target.hand,
    label: meta.label,
    color: meta.color,
    durationSec: durationSec || 10,
    remainingSec: durationSec || 10,
  };
  _activeEclipses.set(key, entry);
  _log(`[eclipse] ${target.hand} ${target.id} corrupted for ${entry.durationSec}s`);

  if (_hasDep('showEclipseWarning')) {
    _deps.showEclipseWarning(meta.label, meta.color, entry.durationSec * 1000);
  }
  if (_hasDep('playEclipseCorruptSound')) _deps.playEclipseCorruptSound();
  return entry;
}

/** End one eclipse early (purge flash + sound; hides warning when last). */
export function endEclipse(key) {
  const entry = _activeEclipses.get(key);
  if (!entry) return;
  _activeEclipses.delete(key);
  _log(`[eclipse] ${entry.id} purged`);

  if (_hasDep('playEclipsePurgeSound')) _deps.playEclipsePurgeSound();
  if (_hasDep('triggerStyleFlash')) _deps.triggerStyleFlash(0xffffff);
  if (_activeEclipses.size === 0 && _hasDep('hideEclipseWarning')) {
    _deps.hideEclipseWarning();
  }
}

/** Purge everything (boss death, level end, game over, reset). */
export function purgeAllEclipses() {
  if (_activeEclipses.size > 0 && _hasDep('playEclipsePurgeSound')) {
    _deps.playEclipsePurgeSound();
  }
  _activeEclipses.clear();
  _drainTimer = 0;
  if (_hasDep('hideEclipseWarning')) _deps.hideEclipseWarning();
  _log('[eclipse] all eclipses purged');
}

/** One-time callout when the boss first crosses 50% HP (sound + banner). */
export function startEclipseCorruption() {
  if (_hasDep('playEclipsePhase2StartSound')) _deps.playEclipsePhase2StartSound();
  if (_hasDep('showFloatingMessage')) {
    _deps.showFloatingMessage('⚠ UPGRADES CORRUPTED', {
      duration: 2600,
      color: '#ff2266',
      glowColor: '#aa00ff',
      fontSize: 56,
      scale: 0.5,
    });
  }
  _log('[eclipse] corruption phase started');
}

// ── Per-frame update (main.js PLAYING branch) ──

/**
 * Tick active eclipse durations + self-damage drains. Called every frame
 * during PLAYING only (drains pause with the fight).
 */
export function updateEclipse(dt) {
  if (_activeEclipses.size === 0) return;

  // Expire finished eclipses (purge feedback per eclipse)
  const expired = [];
  _activeEclipses.forEach((entry, key) => {
    entry.remainingSec -= dt;
    if (entry.remainingSec <= 0) expired.push(key);
  });
  for (const key of expired) endEclipse(key);

  if (_activeEclipses.size === 0) return;

  // Self-damage drains: status ammo + vampiric turn inward
  _drainTimer += dt;
  if (_drainTimer >= SELF_DRAIN_INTERVAL) {
    _drainTimer = 0;
    let harmful = 0;
    _activeEclipses.forEach((entry) => {
      if (entry.id === 'fire' || entry.id === 'shock' || entry.id === 'freeze' ||
          entry.id === 'vampiric' || entry.id === 'life_steal') {
        harmful++;
      }
    });
    const amount = Math.min(2, harmful);
    if (amount > 0 && _hasDep('applyPlayerDamage')) {
      const dead = _deps.applyPlayerDamage(amount);
      if (_hasDep('playEclipseSelfDamageSound')) _deps.playEclipseSelfDamageSound();
      if (_hasDep('triggerHitFlash')) _deps.triggerHitFlash(true);
      // Player died to their own corruption — stop draining immediately
      if (dead) purgeAllEclipses();
    }
  }
}

// ── Pure stats transform (called at fire time by main.js) ──

/**
 * Apply eclipsed-upgrade effects to a computed stats object.
 * PURE: never mutates the input; returns a new object only when corruption
 * applies. getWeaponStats() itself stays untouched (AGENTS.md §14: keep
 * getters pure).
 */
export function applyEclipseToStats(stats, eclipseIds) {
  if (!stats || !eclipseIds || eclipseIds.length === 0) return stats;
  const ids = new Set(eclipseIds);
  let out = stats;

  const damageUp = ids.has('scope') || ids.has('mega_scope');
  const fireRateUp = ids.has('barrel') || ids.has('turbo_barrel');
  const projectileUp = ids.has('double_shot') || ids.has('triple_shot');
  const critUp = ids.has('critical') || ids.has('super_crit');
  const pierceUp = ids.has('piercing') || ids.has('overcharge');
  const vampUp = ids.has('vampiric') || ids.has('life_steal');
  const statusUp = ids.has('fire') || ids.has('shock') || ids.has('freeze');

  // Damage bonus becomes a 30% damage penalty (issue: -50% of the bonus
  // value; 30% flat keeps it noticeable but survivable across stack counts)
  if (damageUp) out = { ...out, damage: Math.max(1, Math.round(out.damage * 0.7)) };
  // Fire-rate bonus becomes a 70% slower weapon
  if (fireRateUp) out = { ...out, fireInterval: out.fireInterval * 1.7 };
  // Extra projectiles halve and veer at wide random angles (fireMainWeapon
  // reads stats.eclipsedScatter to randomize directions)
  if (projectileUp) {
    out = {
      ...out,
      projectileCount: Math.max(1, Math.round(out.projectileCount * 0.5)),
      eclipsedScatter: true,
    };
  }
  // Crits can reflect back at the player (checked in projectile-system)
  if (critUp) out = { ...out, critReflect: true };
  // Piercing is sealed shut
  if (pierceUp) out = { ...out, piercing: false };
  // Vampiric stops healing (the drain comes from updateEclipse instead)
  if (vampUp) out = { ...out, vampiricInterval: 0 };
  // Status ammo stops applying to enemies; the drain ticks damage YOU
  if (statusUp) {
    out = {
      ...out,
      effects: [],
      hasChargeAoEFire: false,
      hasChargeAoEFreeze: false,
      hasChargeAoEShock: false,
    };
  }

  return out;
}
