// ============================================================
//  WRIST HOLOGRAMS — Upgrade-screen controller-attached HUD
//  Shows weapon name, kills, damage, DPS, and upgrade list
//  on each wrist during the between-levels upgrade context.
//  Layout sourced from layouts/upgrade-wrist-{left,right}.json.
// ============================================================

import * as THREE from 'three';
import { getWeaponStats } from './weapons.js';

// ── Module state ───────────────────────────────────────────
const wristHolograms = [null, null]; // [left, right] THREE.Group references
const wristControllers = [null, null]; // [left, right] controller refs for re-attachment
let _layoutCache = {}; // cached layout JSON data

// ── Layout loading ────────────────────────────────────────
async function loadWristLayout(hand) {
  const key = `upgrade-wrist-${hand}`;
  if (_layoutCache[key]) return _layoutCache[key];
  try {
    const resp = await fetch(`layouts/${key}.json`);
    if (!resp.ok) return null;
    const data = await resp.json();
    _layoutCache[key] = data;
    return data;
  } catch (e) {
    return null;
  }
}

// ── Text helper ───────────────────────────────────────────
function makeTextMesh(text, opts = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = opts.fontSize || 16;
  const fontFamily = opts.fontFamily || 'Arial, sans-serif';
  const maxWidth = opts.maxWidth || 200;

  ctx.font = `bold ${fontSize}px ${fontFamily}`;

  // Word wrap
  let lines = [text];
  if (opts.wrap !== false) {
    lines = [];
    const words = text.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  const lineHeight = fontSize * 1.3;
  const textHeight = lines.length * lineHeight;
  const textWidth = Math.ceil(Math.max(...lines.map(l => ctx.measureText(l).width)));

  const padding = 8;
  canvas.width = textWidth + padding * 2;
  canvas.height = textHeight + padding * 2;

  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Glow effect
  if (opts.glow) {
    ctx.shadowColor = opts.glowColor || opts.color || '#00ffff';
    ctx.shadowBlur = opts.glowSize || 8;
  }

  ctx.fillStyle = opts.color || '#00ffff';
  lines.forEach((line, i) => {
    const y = (canvas.height / 2) - ((lines.length - 1) * lineHeight / 2) + (i * lineHeight);
    ctx.fillText(line, canvas.width / 2, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.premultiplyAlpha = false;

  const scale = opts.scale || 0.04;
  const aspect = canvas.width / canvas.height;
  const geometry = new THREE.PlaneGeometry(aspect * scale, scale);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 600;
  return mesh;
}

function makeRectMesh(el) {
  const w = el.w || 0.21;
  const h = el.h || 0.3;
  const color = el.color || 655411; // dark teal
  const geometry = new THREE.PlaneGeometry(w, h);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 500;
  return mesh;
}

// ── Build wrist hologram from layout JSON + runtime data ──
function buildWristHologram(hand, stats, upgrades, weaponName, weaponId) {
  const group = new THREE.Group();
  group.name = `wrist-hologram-${hand}`;
  group.userData.hand = hand;
  group.userData.lastDataHash = null;

  // Load layout for this hand
  // Note: layout is loaded async in initWristHolograms, but build may be called
  // from update. Use cached layout synchronously.
  const layout = _layoutCache[`upgrade-wrist-${hand}`];
  if (!layout?.elements) {
    // Fallback: create a minimal wrist hologram without layout data
    buildFallbackWristHologram(group, hand, stats, upgrades, weaponName);
    return group;
  }

  const elements = layout.elements;

  // Background rect
  if (elements.wrist_holo_bg?.visible !== false) {
    const bg = makeRectMesh(elements.wrist_holo_bg);
    if (elements.wrist_holo_bg) {
      bg.position.set(
        elements.wrist_holo_bg.x || 0,
        elements.wrist_holo_bg.y || 0,
        elements.wrist_holo_bg.z || 0.003
      );
    }
    group.add(bg);
  }

  // Scanlines (decorative)
  for (let i = 1; i <= 4; i++) {
    const scanKey = `wrist_scanline${i}`;
    if (elements[scanKey]?.visible) {
      const sl = makeRectMesh({ ...elements[scanKey], w: 0.19, h: 0.003 });
      sl.position.set(elements[scanKey].x, elements[scanKey].y, elements[scanKey].z);
      group.add(sl);
    }
  }

  // ── Dynamic text fields ──
  // Weapon name (large, top) — uses dup_18_wrist_header position (larger scale)
  const weaponNameEl = elements.dup_18_wrist_header || elements.wrist_header;
  if (weaponNameEl) {
    const weaponSprite = makeTextMesh(weaponName.toUpperCase(), {
      fontSize: 20,
      scale: weaponNameEl.scale || 0.1,
      color: '#00ffff',
      glow: true,
      glowColor: '#00ffff',
      glowSize: 10,
    });
    weaponSprite.position.set(weaponNameEl.x, weaponNameEl.y, weaponNameEl.z);
    weaponSprite.name = 'weapon-name';
    group.add(weaponSprite);
  }

  // Hand label (smaller, below weapon name)
  const headerEl = elements.wrist_header;
  if (headerEl) {
    const handLabel = makeTextMesh(hand === 'left' ? 'LEFT BLASTER' : 'RIGHT BLASTER', {
      fontSize: 16,
      scale: headerEl.scale || 0.06,
      color: hand === 'left' ? '#00ffff' : '#ff88aa',
    });
    handLabel.position.set(headerEl.x, headerEl.y, headerEl.z);
    handLabel.name = 'hand-label';
    group.add(handLabel);
  }

  // Stats section: KILLS / TOTAL DMG / DPS
  // Labels row
  const killsLabelEl = elements.wrist_kills;
  const dmgLabelEl = elements.wrist_dmg;
  const dpsLabelEl = elements.dup_21_wrist_dmg;

  if (killsLabelEl) {
    const kl = makeTextMesh('KILLS:', {
      fontSize: 16, scale: killsLabelEl.scale || 0.05, color: '#00ffff',
    });
    kl.position.set(killsLabelEl.x, killsLabelEl.y, killsLabelEl.z);
    kl.name = 'kills-label';
    group.add(kl);
  }
  if (dmgLabelEl) {
    const dl = makeTextMesh('TOTAL DMG:', {
      fontSize: 16, scale: dmgLabelEl.scale || 0.05, color: '#00ffff',
    });
    dl.position.set(dmgLabelEl.x, dmgLabelEl.y, dmgLabelEl.z);
    dl.name = 'dmg-label';
    group.add(dl);
  }
  if (dpsLabelEl) {
    const dpl = makeTextMesh('DPS:', {
      fontSize: 16, scale: dpsLabelEl.scale || 0.05, color: '#00ffff',
    });
    dpl.position.set(dpsLabelEl.x, dpsLabelEl.y, dpsLabelEl.z);
    dpl.name = 'dps-label';
    group.add(dpl);
  }

  // Stats values row
  const killsValEl = elements.dup_19_wrist_kills;
  const dmgValEl = elements.dup_20_dup_19_wrist_kills;
  const dpsValEl = elements.dup_22_dup_19_wrist_kills;

  const kills = stats.kills || 0;
  const totalDmg = Math.round(stats.totalDamage || 0);
  const dpsDisplay = computeWeaponDpsDisplay(weaponId, upgrades);

  if (killsValEl) {
    const kv = makeTextMesh(`${kills}`, {
      fontSize: 16, scale: killsValEl.scale || 0.065, color: '#00ffff',
    });
    kv.position.set(killsValEl.x, killsValEl.y, killsValEl.z);
    kv.name = 'kills-value';
    group.add(kv);
  }
  if (dmgValEl) {
    const dv = makeTextMesh(`${totalDmg}`, {
      fontSize: 16, scale: dmgValEl.scale || 0.065, color: '#00ffff',
    });
    dv.position.set(dmgValEl.x, dmgValEl.y, dmgValEl.z);
    dv.name = 'dmg-value';
    group.add(dv);
  }
  if (dpsValEl) {
    const dpv = makeTextMesh(`${dpsDisplay}`, {
      fontSize: 16, scale: dpsValEl.scale || 0.065, color: '#00ffff',
    });
    dpv.position.set(dpsValEl.x, dpsValEl.y, dpsValEl.z);
    dpv.name = 'dps-value';
    group.add(dpv);
  }

  // ── Upgrade list ──
  // Layout shows upgrades in a 2-column grid at y offsets -0.03, -0.06, -0.09, -0.12
  // x offsets: -0.05 (left column) and 0.05 (right column)
  const upgradeEntries = Object.entries(upgrades).filter(([, count]) => count > 0);
  const upgradePositions = [
    { x: -0.05, y: -0.03 },
    { x: 0.05, y: -0.03 },
    { x: -0.05, y: -0.06 },
    { x: 0.05, y: -0.06 },
    { x: -0.05, y: -0.09 },
    { x: 0.05, y: -0.09 },
    { x: -0.05, y: -0.12 },
    { x: 0.05, y: -0.12 },
  ];

  // "UPGRADES:" label
  const upgradeHeaderEl = elements.wrist_upgrade_count;
  if (upgradeHeaderEl && upgradeEntries.length > 0) {
    const uh = makeTextMesh('UPGRADES:', {
      fontSize: 16, scale: upgradeHeaderEl.scale || 0.06, color: '#00ffff',
    });
    uh.position.set(upgradeHeaderEl.x, upgradeHeaderEl.y, upgradeHeaderEl.z);
    uh.name = 'upgrade-header';
    group.add(uh);
  }

  // Format upgrade name with stack count
  upgradeEntries.slice(0, 8).forEach(([id, count], i) => {
    if (i >= upgradePositions.length) return;
    const pos = upgradePositions[i];
    const name = formatUpgradeName(id);
    const label = count > 1 ? `${name} (x${count})` : name;
    const uSprite = makeTextMesh(label, {
      fontSize: 14,
      scale: 0.05,
      color: '#00ffff',
      maxWidth: 150,
    });
    uSprite.position.set(pos.x, pos.y, 0.012);
    uSprite.name = `upgrade-item-${i}`;
    group.add(uSprite);
  });

  return group;
}

function buildFallbackWristHologram(group, hand, stats, upgrades, weaponName) {
  // Minimal wrist hologram when layout JSON is unavailable
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.21, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x0a0a2a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
  );
  bg.position.z = 0.003;
  bg.renderOrder = 500;
  group.add(bg);

  const wn = makeTextMesh(weaponName.toUpperCase(), { fontSize: 18, scale: 0.08, color: '#00ffff', glow: true });
  wn.position.set(0, 0.1, 0.012);
  wn.name = 'weapon-name';
  group.add(wn);

  const hl = makeTextMesh(`${hand.toUpperCase()} BLASTER`, { fontSize: 14, scale: 0.05, color: hand === 'left' ? '#00ffff' : '#ff88aa' });
  hl.position.set(0, 0.06, 0.012);
  hl.name = 'hand-label';
  group.add(hl);

  const kl = makeTextMesh(`KILLS: ${stats.kills || 0}`, { fontSize: 14, scale: 0.05, color: '#00ffff' });
  kl.position.set(0, 0.02, 0.012);
  kl.name = 'kills-value';
  group.add(kl);

  const dl = makeTextMesh(`DMG: ${Math.round(stats.totalDamage || 0)}`, { fontSize: 14, scale: 0.05, color: '#00ffff' });
  dl.position.set(0, -0.02, 0.012);
  dl.name = 'dmg-value';
  group.add(dl);

  const entries = Object.entries(upgrades).filter(([, c]) => c > 0);
  if (entries.length > 0) {
    const uh = makeTextMesh('UPGRADES:', { fontSize: 14, scale: 0.05, color: '#00ffff' });
    uh.position.set(0, -0.06, 0.012);
    group.add(uh);
    entries.slice(0, 6).forEach(([id, count], i) => {
      const name = formatUpgradeName(id);
      const label = count > 1 ? `${name} (x${count})` : name;
      const us = makeTextMesh(label, { fontSize: 12, scale: 0.04, color: '#00ffff', maxWidth: 140 });
      us.position.set(0, -0.09 - i * 0.03, 0.012);
      group.add(us);
    });
  }
}

// Format upgrade ID to display name
function formatUpgradeName(id) {
  const nameMap = {
    scope: 'SCOPE', mega_scope: 'MEGA SCOPE',
    barrel: 'BARREL', turbo_barrel: 'TURBO BARREL',
    double_shot: 'DOUBLE SHOT', triple_shot: 'TRIPLE SHOT',
    critical: 'CRITICAL', super_crit: 'SUPER CRIT',
    vampiric: 'VAMPIRIC', life_steal: 'LIFE STEAL',
    shock: 'SHOCK', fire: 'FIRE', freeze: 'FREEZE',
    ricochet: 'RICOCHET', extra_nuke: 'EXTRA NUKE',
    overcharge: 'OVERCHARGE', mega_boom: 'MEGA BOOM',
    piercing: 'PIERCING', focused_frenzy: 'FOCUSED FRENZY',
    duck_hunt: 'DUCK HUNT', its_electric: "AIN'T NOBODY GOT TIME",
    tesla_coil: 'TESLA COIL', quick_charge: 'QUICK CHARGE',
    excess_heat: 'EXCESS HEAT', death_ray: 'DEATH RAY',
    hold_together: 'HOLD TOGETHER',
    buckshot_gentlemen: 'BUCKSHOT GENTLEMEN',
    gimme_more: 'GIMME MORE',
  };
  return nameMap[id] || id.replace(/_/g, ' ').toUpperCase();
}

// ── Compute data hash for dirty-checking ──────────────────
function computeDataHash(hand, stats, upgrades, weaponName, weaponId) {
  const upgradeCount = Object.values(upgrades).reduce((s, c) => s + c, 0);
  return `${hand}|${weaponId}|${stats.kills}|${Math.round(stats.totalDamage)}|${upgradeCount}|${weaponName}`;
}

// ── Public API ────────────────────────────────────────────

/**
 * Preload layout JSONs so they're cached for synchronous use during build.
 * Call once during init.
 */
export async function initWristHolograms() {
  await Promise.all([
    loadWristLayout('left'),
    loadWristLayout('right'),
  ]);
}

/**
 * Show wrist holograms attached to the given controllers.
 * Called when entering UPGRADE_SELECT state.
 *
 * @param {THREE.Object3D[]} controllers - [left, right] XR controller objects
 * @param {object} handStats - game.handStats
 * @param {object} upgrades - game.upgrades
 * @param {string[]} mainWeapons - game.mainWeapon
 */
export function showWristHolograms(controllers, handStats, upgrades, mainWeapons) {
  if (!controllers || controllers.length < 2) return;

  for (let i = 0; i < 2; i++) {
    const hand = i === 0 ? 'left' : 'right';
    const ctrl = controllers[i];
    if (!ctrl) continue;

    // Remove old wrist hologram if present
    hideWristHologram(i);

    // Get weapon name
    const weaponId = mainWeapons[hand] || 'standard_blaster';
    const weaponName = getWeaponDisplayName(weaponId);

    // Build new wrist hologram
    const stats = handStats[hand] || { kills: 0, totalDamage: 0 };
    const handUpgrades = upgrades[hand] || {};
    const group = buildWristHologram(hand, stats, handUpgrades, weaponName, weaponId);

    // Position: on the wrist, below the controller
    group.position.set(0, -0.02, 0.02);
    group.rotation.x = -Math.PI / 4; // Tilt toward user (same as blaster displays)
    group.frustumCulled = false;

    ctrl.add(group);
    wristHolograms[i] = group;
    wristControllers[i] = ctrl;
  }
}

/**
 * Update wrist holograms with current data (called each frame during UPGRADE_SELECT).
 * Only rebuilds text when data actually changes.
 */
export function updateWristHolograms(handStats, upgrades, mainWeapons) {
  for (let i = 0; i < 2; i++) {
    const group = wristHolograms[i];
    if (!group || !group.parent) continue;

    const hand = i === 0 ? 'left' : 'right';
    const stats = handStats[hand] || { kills: 0, totalDamage: 0 };
    const handUpgrades = upgrades[hand] || {};
    const weaponId = mainWeapons[hand] || 'standard_blaster';
    const weaponName = getWeaponDisplayName(weaponId);
    const hash = computeDataHash(hand, stats, handUpgrades, weaponName, weaponId);

    if (group.userData.lastDataHash === hash) continue;
    group.userData.lastDataHash = hash;

    // Rebuild the wrist hologram with updated data
    const ctrl = wristControllers[i];
    if (ctrl) {
      ctrl.remove(group);
      disposeGroup(group);

      const newGroup = buildWristHologram(hand, stats, handUpgrades, weaponName, weaponId);
      newGroup.position.set(0, -0.02, 0.02);
      newGroup.rotation.x = -Math.PI / 4;
      newGroup.frustumCulled = false;

      ctrl.add(newGroup);
      wristHolograms[i] = newGroup;
    }
  }
}

/**
 * Hide a specific wrist hologram by index.
 */
export function hideWristHologram(index) {
  const group = wristHolograms[index];
  const ctrl = wristControllers[index];
  if (group && ctrl) {
    ctrl.remove(group);
    disposeGroup(group);
  }
  wristHolograms[index] = null;
  wristControllers[index] = null;
}

/**
 * Hide all wrist holograms. Called when exiting UPGRADE_SELECT state.
 */
export function hideAllWristHolograms() {
  hideWristHologram(0);
  hideWristHologram(1);
}

// ── Helpers ────────────────────────────────────────────────

function computeWeaponDpsDisplay(weaponId, upgrades) {
  if (weaponId === 'charge_cannon') return 'YES';

  const stats = getWeaponStats(weaponId, upgrades || {});
  if (!stats) return '0';

  const fireInterval = stats.windUp && stats.windUpEndInterval ? stats.windUpEndInterval : stats.fireInterval;
  if (!fireInterval || fireInterval <= 0) return '0';

  const shotsPerSecond = 1 / fireInterval;
  const damagePerTrigger = (stats.damage || 0) * (stats.projectileCount || 1);
  const dps = Math.round(shotsPerSecond * damagePerTrigger);
  return `${dps}`;
}

function getWeaponDisplayName(weaponId) {
  const names = {
    standard_blaster: 'Standard Blaster',
    buckshot: 'Buckshot',
    charge_cannon: 'Charge Cannon',
    plasma_carbine: 'Plasma Carbine',
    lightning_rod: 'Lightning Rod',
    seeker_burst: 'Seeker Burst',
  };
  return names[weaponId] || weaponId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function disposeGroup(group) {
  group.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (child.material.map) child.material.map.dispose();
      child.material.dispose();
    }
  });
}
