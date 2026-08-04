// ============================================================
//  WEAPON MASTERY (Issue #213)
//  Permanent per-weapon progression persisted in localStorage.
//  Tiers: Novice(0) → Adept(50) → Expert(200) → Master(500)
//  kills with a weapon. Adept+ weapons deal +10% damage (applied
//  in weapons.js getWeaponStats); Expert+ get a subtle weapon-glow
//  pulse (main.js); Master unlocks the weapon's mastery card in
//  the upgrade pool (main.js showUpgradeScreen).
//  Pure storage + tier math — no DOM/three.js. Safe in node.
// ============================================================

const STORAGE_KEY = 'spaceomicide_mastery';

export const MASTERY_THRESHOLDS = [0, 50, 200, 500];
export const MASTERY_TIERS = ['Novice', 'Adept', 'Expert', 'Master'];

// Mastery card id per MAIN weapon (cards live in weapons.js MASTERY_CARDS)
export const MASTERY_CARD_IDS = {
  standard_blaster: 'last_light',
  buckshot: 'point_blank',
  lightning_rod: 'teslas_domain',
  charge_cannon: 'overkill',
  plasma_carbine: 'melting_point',
  seeker_burst: 'swarm_intelligence',
};

// weaponId -> kills (loaded from localStorage)
let mastery = {};
let saveQueued = false;

export function loadMastery() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      mastery = raw ? JSON.parse(raw) : {};
    } else {
      mastery = {};
    }
  } catch (e) {
    // Corrupt storage — start fresh rather than crash the run
    mastery = {};
  }
  return mastery;
}

export function getMasteryKills(weaponId) {
  return mastery[weaponId] || 0;
}

export function getMasteryTierIndex(weaponId) {
  const kills = getMasteryKills(weaponId);
  for (let i = MASTERY_THRESHOLDS.length - 1; i >= 0; i--) {
    if (kills >= MASTERY_THRESHOLDS[i]) return i;
  }
  return 0;
}

export function getMasteryTier(weaponId) {
  return MASTERY_TIERS[getMasteryTierIndex(weaponId)];
}

export function getMasteryCardId(weaponId) {
  return MASTERY_CARD_IDS[weaponId] || null;
}

// Record one kill with a weapon. Called from handleEnemyKilled (main.js)
// when the kill has a hand attribution.
export function addMasteryKill(weaponId) {
  if (!weaponId || !MASTERY_CARD_IDS[weaponId]) return;
  mastery[weaponId] = (mastery[weaponId] || 0) + 1;
  scheduleSave();
}

// Highest mastery tier across the equipped weapons (for the game-over title)
export function getBestMastery(weaponIds) {
  let best = null;
  for (const id of weaponIds) {
    if (!id) continue;
    const idx = getMasteryTierIndex(id);
    if (!best || idx > best.tierIndex) {
      best = { weaponId: id, tierIndex: idx, tier: MASTERY_TIERS[idx], kills: getMasteryKills(id) };
    }
  }
  return best;
}

// Debounced write (at most every 5s) — save() is also called on level
// transitions/game over so a quit never loses more than a few kills.
function scheduleSave() {
  if (saveQueued) return;
  saveQueued = true;
  setTimeout(() => {
    saveQueued = false;
    saveMastery();
  }, 5000);
}

export function saveMastery() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mastery));
    }
  } catch (e) { /* storage full/blocked — non-critical */ }
}

export function resetMastery() {
  mastery = {};
  saveMastery();
}
