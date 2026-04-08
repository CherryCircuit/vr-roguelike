// ============================================================
//  PAUSE MENU
// ============================================================

import * as THREE from 'three';
import { game } from './game.js';
import {
  makeSprite, updateSpriteText, disposeGroupChildren,
  hudGroup, cameraRef,
  pauseMenuGroup, pauseCountdownGroup,
  loadLayout
} from './hud.js';

let pauseMenuElements = {
  panel: null,
  leftBlasterSection: null,
  rightBlasterSection: null,
  statsSection: null,
  chartCanvas: null,
  resumeButton: null,
};

let pauseMenuAnimation = {
  slideIn: 0,
  targetSlideIn: 0,
  startTime: 0,
  chartAnimation: 0,
  numbersAnimated: false,
};

// Layout loaded from JSON (cached by loadLayout)
let pauseMenuLayout = null;
let pauseMenuLayoutLoaded = false;
async function ensurePauseLayout() {
  if (!pauseMenuLayoutLoaded) {
    pauseMenuLayout = await loadLayout('pause-menu');
    pauseMenuLayoutLoaded = true;
  }
  return pauseMenuLayout;
}

let pauseCountdownHeader = null;
let pauseCountdownText = null;
let pauseCountdownOverlay = null;
let pauseCountdownInitialized = false;

/**
 * Show the pause menu with stats and blaster upgrade info
 */
let pauseMenuBasePosition = new THREE.Vector3();
const PAUSE_MENU_SCALE = 0.78;          // ~40% smaller than previous 1.3 scale
const PAUSE_MENU_DISTANCE = 2.6;        // Slightly farther from player in VR
const PAUSE_MENU_RENDER_ORDER = 10000;  // Draw over floor HUD layers
const PAUSE_MENU_FONT_MULTIPLIER = 2.5;

// Render order constants for pause menu elements (layered back to front)
const PAUSE_PANEL_RENDER_ORDER = 10000;
const PAUSE_BORDER_RENDER_ORDER = 10001;
const PAUSE_SECTION_BG_RENDER_ORDER = 10002;
const PAUSE_TEXT_RENDER_ORDER = 10010;

function scalePauseFont(baseFontSize) {
  return Math.round(baseFontSize * PAUSE_MENU_FONT_MULTIPLIER);
}

function scalePauseText(baseScale) {
  return baseScale * PAUSE_MENU_FONT_MULTIPLIER;
}

function applyPauseMenuRenderPriority(root) {
  if (!root) return;
  root.traverse((child) => {
    if (!child.material) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (!mat) return;
      // CRITICAL: Both must be false for UI to render correctly over scene
      mat.depthTest = false;
      mat.depthWrite = false;
      // Ensure transparency is enabled
      if (mat.opacity !== undefined && mat.opacity < 1) {
        mat.transparent = true;
      }
    });

    // Set render order if not already set
    if (child.renderOrder === 0 || child.renderOrder === undefined) {
      child.renderOrder = PAUSE_TEXT_RENDER_ORDER;
    }
  });
}

/**
 * Create a consistent UI material for pause menu elements
 */
function createPauseMaterial(color, opacity = 0.85) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function showPauseMenu() {
  pauseMenuGroup.visible = true;
  pauseMenuGroup.scale.set(PAUSE_MENU_SCALE, PAUSE_MENU_SCALE, PAUSE_MENU_SCALE);

  // Hide floor HUD while pause menu is open
  if (hudGroup) hudGroup.visible = false;

  // Position menu at fixed world position slightly farther from camera when paused.
  // This makes it stay in 3D space so player can walk around it
  if (cameraRef) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraRef.quaternion);
    forward.y = 0;
    forward.normalize();
    pauseMenuBasePosition.set(
      cameraRef.position.x + forward.x * PAUSE_MENU_DISTANCE,
      cameraRef.position.y,
      cameraRef.position.z + forward.z * PAUSE_MENU_DISTANCE
    );
    pauseMenuGroup.position.copy(pauseMenuBasePosition);
    // Face the camera once (billboard on pause, not every frame)
    pauseMenuGroup.lookAt(cameraRef.position.x, cameraRef.position.y, cameraRef.position.z);
  }

  if (pauseMenuElements.panel) {
    // Already initialized - rebuild blaster sections so stats are fresh
    ['left', 'right'].forEach(hand => {
      const oldSection = pauseMenuElements[hand + 'BlasterSection'];
      if (oldSection) {
        // Dispose all children properly
        oldSection.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        });
        pauseMenuGroup.remove(oldSection);
      }
      const newSection = createBlasterSection(hand);
      newSection.position.set(hand === 'left' ? -1.25 : 1.25, 0.4, 0.02);
      pauseMenuGroup.add(newSection);
      pauseMenuElements[hand + 'BlasterSection'] = newSection;
    });

    pauseMenuAnimation.targetSlideIn = 1;
    pauseMenuAnimation.startTime = performance.now();
    pauseMenuAnimation.chartAnimation = 0;
    pauseMenuAnimation.numbersAnimated = false;
    applyPauseMenuRenderPriority(pauseMenuGroup);
    return;
  }

  createPauseMenu(); // async, but fire-and-forget is fine - layout loads lazily
}

/**
 * Hide the pause menu
 */
export function hidePauseMenu() {
  pauseMenuGroup.visible = false;

  // Restore floor HUD
  if (hudGroup) hudGroup.visible = true;
}

/**
 * Update pause menu animations and charts
 */
export function updatePauseMenu(now) {
  if (!pauseMenuGroup.visible) return;

  // Menu stays at fixed world position (set in showPauseMenu)
  // No per-frame repositioning - player can walk around it in 3D space

  // Animate slide-in
  const slideDuration = 500; // ms
  if (pauseMenuAnimation.slideIn < 1) {
    pauseMenuAnimation.slideIn = Math.min(1, (now - pauseMenuAnimation.startTime) / slideDuration);
  }

  // Slide menu in from right (offset X in local space, relative to base position)
  const slideOffset = new THREE.Vector3((1 - pauseMenuAnimation.slideIn) * 4, 0, 0);
  slideOffset.applyQuaternion(pauseMenuGroup.quaternion);
  pauseMenuGroup.position.copy(pauseMenuBasePosition).add(slideOffset);

  // Animate charts
  if (pauseMenuAnimation.chartAnimation < 1) {
    pauseMenuAnimation.chartAnimation += 0.02;
    if (pauseMenuAnimation.chartAnimation > 1) pauseMenuAnimation.chartAnimation = 1;
    updatePauseCharts();
  }

  // Animate numbers
  if (!pauseMenuAnimation.numbersAnimated && pauseMenuAnimation.slideIn > 0.5) {
    pauseMenuAnimation.numbersAnimated = true;
    updatePauseStatsNumbers();
  }
}

/**
 * Create the pause menu UI
 */
async function createPauseMenu() {
  await ensurePauseLayout();
  const group = pauseMenuGroup;

  // Main panel - ONE dark see-through plane
  const panelWidth = 4.6;
  const panelHeight = 3.6;  // Taller to fit blaster sections with enemies killed

  // Background panel - semi-transparent black, no depth interaction
  const panelGeo = new THREE.PlaneGeometry(panelWidth, panelHeight);
  const panelMat = createPauseMaterial(0x0a0015, 0.85);
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.renderOrder = PAUSE_PANEL_RENDER_ORDER;
  group.add(panel);

  // Neon border (cyan) - no depth interaction
  const borderThickness = 0.03;
  const borderMat = createPauseMaterial(0x00ffff, 1.0);
  [
    { w: panelWidth, h: borderThickness, x: 0, y: panelHeight / 2 },
    { w: panelWidth, h: borderThickness, x: 0, y: -panelHeight / 2 },
    { w: borderThickness, h: panelHeight, x: panelWidth / 2, y: 0 },
    { w: borderThickness, h: panelHeight, x: -panelWidth / 2, y: 0 },
  ].forEach(b => {
    const border = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), borderMat);
    border.position.set(b.x, b.y, 0.01);
    border.renderOrder = PAUSE_BORDER_RENDER_ORDER;
    group.add(border);
  });

  pauseMenuElements.panel = panel;

  // Left blaster section (includes stats now)
  const leftSection = createBlasterSection('left');
  leftSection.position.set(-1.25, 0.2, 0.02);
  // Apply layout override if loaded
  if (pauseMenuLayout?.elements?.left_blaster_section) {
    const pos = pauseMenuLayout.elements.left_blaster_section;
    leftSection.position.set(pos.x, pos.y, pos.z ?? 0.02);
  }
  group.add(leftSection);
  pauseMenuElements.leftBlasterSection = leftSection;

  // Right blaster section (includes stats now)
  const rightSection = createBlasterSection('right');
  rightSection.position.set(1.25, 0.2, 0.02);
  // Apply layout override if loaded
  if (pauseMenuLayout?.elements?.right_blaster_section) {
    const pos = pauseMenuLayout.elements.right_blaster_section;
    rightSection.position.set(pos.x, pos.y, pos.z ?? 0.02);
  }
  group.add(rightSection);
  pauseMenuElements.rightBlasterSection = rightSection;

  // Resume button
  const resumeBtn = createResumeButton();
  resumeBtn.position.set(0, -1.35, 0.03);
  // Apply layout override if loaded
  if (pauseMenuLayout?.elements?.resume_button) {
    const pos = pauseMenuLayout.elements.resume_button;
    resumeBtn.position.set(pos.x, pos.y, pos.z ?? 0.03);
  }
  group.add(resumeBtn);
  pauseMenuElements.resumeButton = resumeBtn;

  // Initialize animation
  pauseMenuAnimation.startTime = performance.now();
  pauseMenuAnimation.slideIn = 0;
  pauseMenuAnimation.chartAnimation = 0;
  pauseMenuAnimation.numbersAnimated = false;

  applyPauseMenuRenderPriority(group);
}

// Upgrade icons and colors
const UPGRADE_ICONS = {
  rapid_fire: { icon: '🔥', color: '#ff6600' },
  damage_up: { icon: '⚡', color: '#ffff00' },
  spread_shot: { icon: '💫', color: '#00ffff' },
  piercing: { icon: '🗡️', color: '#ff0000' },
  homing: { icon: '🎯', color: '#00ff00' },
  magnetize: { icon: '🧲', color: '#ff00ff' },
  charge_shot: { icon: '💥', color: '#ff8800' },
  bounce: { icon: '🔄', color: '#88ff00' },
  chain_lightning: { icon: '⚡', color: '#00ffff' },
};

// Enemy type icons for kill tracking
const ENEMY_ICONS = {
  grunt: '👾',
  tank: '🤖',
  speeder: '💨',
  shooter: '🔫',
  bomber: '💣',
  boss: '👹',
};

/**
 * Create a separator line (glowing cyan)
 */
function createSeparator(width = 1.8) {
  const group = new THREE.Group();
  const lineGeo = new THREE.PlaneGeometry(width, 0.02);
  const lineMat = createPauseMaterial(0x00ffff, 0.6);
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.renderOrder = PAUSE_TEXT_RENDER_ORDER;
  group.add(line);
  
  // Glow effect
  const glowGeo = new THREE.PlaneGeometry(width, 0.06);
  const glowMat = createPauseMaterial(0x00ffff, 0.15);
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.z = -0.01;
  glow.renderOrder = PAUSE_TEXT_RENDER_ORDER - 1;
  group.add(glow);
  
  return group;
}

/**
 * Create blaster upgrade section for one hand (no nested background)
 */
function createBlasterSection(hand, panelX) {
  const group = new THREE.Group();
  let yPos = 1.3;

  // Title
  const titleText = makeSprite(`${hand.toUpperCase()} BLASTER`, {
    fontSize: scalePauseFont(44),
    color: '#00ffff',
    scale: scalePauseText(0.13),
    renderOrder: PAUSE_TEXT_RENDER_ORDER
  });
  titleText.position.set(0, yPos, 0.02);
  group.add(titleText);
  yPos -= 0.20;

  // Weapon name
  const weaponId = game.mainWeapon[hand] || 'BLASTER';
  const weaponName = weaponId.replace(/_/g, ' ').toUpperCase();
  const weaponText = makeSprite(weaponName, {
    fontSize: scalePauseFont(32),
    color: '#ffffff',
    scale: scalePauseText(0.08),
    renderOrder: PAUSE_TEXT_RENDER_ORDER
  });
  weaponText.position.set(0, yPos, 0.02);
  group.add(weaponText);
  yPos -= 0.10;

  // Separator after weapon name
  const sep1 = createSeparator(1.8);
  sep1.position.set(0, yPos, 0.02);
  group.add(sep1);
  yPos -= 0.08;

  // Upgrades header
  const upgradesHeader = makeSprite('UPGRADES', {
    fontSize: scalePauseFont(24),
    color: '#888888',
    scale: scalePauseText(0.06),
    renderOrder: PAUSE_TEXT_RENDER_ORDER
  });
  upgradesHeader.position.set(0, yPos, 0.02);
  group.add(upgradesHeader);
  yPos -= 0.10;

  // Upgrades list - 2 columns (exclude dream_fragment - it's a collectible, not an upgrade)
  const upgrades = game.upgrades[hand] || {};
  const upgradeEntries = Object.entries(upgrades).filter(([id]) => id !== 'dream_fragment');

  const colLeft = -0.48;
  const colRight = 0.48;
  const upgScale = 0.05;   // actual scale = 0.05 * 2.5 = 0.125
  const upgRowHeight = 0.14; // must exceed sprite visual height (~0.125)

  if (upgradeEntries.length > 0) {
    upgradeEntries.forEach(([id, count], index) => {
      const iconData = UPGRADE_ICONS[id] || { icon: '•', color: '#ffffff' };
      const displayName = id.replace(/_/g, ' ').toUpperCase();
      const x = index % 2 === 0 ? colLeft : colRight;
      const row = Math.floor(index / 2);
      const upgradeText = makeSprite(`${iconData.icon} ${displayName} x${count}`, {
        fontSize: scalePauseFont(22),
        color: iconData.color,
        scale: scalePauseText(upgScale),
        renderOrder: PAUSE_TEXT_RENDER_ORDER
      });
      upgradeText.position.set(x, yPos - (row * upgRowHeight), 0.02);
      upgradeText.userData = { isUpgradeSprite: true };
      group.add(upgradeText);
    });
    const upgRows = Math.ceil(upgradeEntries.length / 2);
    yPos -= (upgRows * upgRowHeight + 0.10);  // extra gap after upgrades
  } else {
    const noUpgradesText = makeSprite('NO UPGRADES', {
      fontSize: scalePauseFont(22),
      color: '#666666',
      scale: scalePauseText(upgScale),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    noUpgradesText.position.set(0, yPos, 0.02);
    noUpgradesText.userData = { isUpgradeSprite: true };
    group.add(noUpgradesText);
    yPos -= 0.18;
  }

  // Separator after upgrades
  const sep2 = createSeparator(1.8);
  sep2.position.set(0, yPos, 0.02);
  group.add(sep2);
  yPos -= 0.10;

  // Stats: compact 2-column layout
  const handData = game.handStats[hand] || {};
  const stats = {
    kills: handData.kills ?? 0,
    shotsFired: handData.shotsFired ?? 0,
    shotsHit: handData.shotsHit ?? 0
  };
  const accuracy = stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0;

  const statLines = [
    { label: 'KILLS', value: stats.kills, color: '#ff00ff' },
    { label: 'SHOTS', value: stats.shotsFired, color: '#00ffff' },
    { label: 'HITS', value: stats.shotsHit, color: '#00ffff' },
    { label: 'ACC', value: `${accuracy}%`, color: accuracy >= 50 ? '#00ff00' : '#ff4444' },
  ];

  // Render stats in 2 columns: left (KILLS, HITS) and right (SHOTS, ACC)
  const statScale = 0.055;  // actual = 0.055 * 2.5 = 0.1375
  const statRowHeight = 0.15; // must exceed sprite visual height
  statLines.forEach((stat, index) => {
    const x = index % 2 === 0 ? colLeft : colRight;
    const row = Math.floor(index / 2);
    const statText = makeSprite(`${stat.label}: ${stat.value}`, {
      fontSize: scalePauseFont(22),
      color: stat.color,
      scale: scalePauseText(statScale),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    statText.position.set(x, yPos - (row * statRowHeight), 0.02);
    statText.userData = { isStatSprite: true, hand, statKey: stat.label };
    group.add(statText);
  });
  yPos -= (2 * statRowHeight + 0.10);

  // Separator after stats
  const sep3 = createSeparator(1.8);
  sep3.position.set(0, yPos, 0.02);
  group.add(sep3);
  yPos -= 0.10;

  // Enemies Killed section - compact two-column layout
  const enemiesHeader = makeSprite('ENEMIES', {
    fontSize: scalePauseFont(22),
    color: '#888888',
    scale: scalePauseText(0.05),
    renderOrder: PAUSE_TEXT_RENDER_ORDER
  });
  enemiesHeader.position.set(0, yPos, 0.02);
  group.add(enemiesHeader);
  yPos -= 0.10;

  // Enemy kills by type - 2 columns
  const enemyKills = handData.enemyKills || {};
  const enemyEntries = Object.entries(enemyKills).filter(([_, count]) => count > 0);

  if (enemyEntries.length > 0) {
    const enemyRowHeight = 0.14;
    enemyEntries.forEach(([type, count], index) => {
      const icon = ENEMY_ICONS[type] || '💀';
      const x = index % 2 === 0 ? colLeft : colRight;
      const row = Math.floor(index / 2);
      const enemyText = makeSprite(`${icon} ${type.toUpperCase()} x${count}`, {
        fontSize: scalePauseFont(22),
        color: '#ff6666',
        scale: scalePauseText(0.05),
        renderOrder: PAUSE_TEXT_RENDER_ORDER
      });
      enemyText.position.set(x, yPos - (row * enemyRowHeight), 0.02);
      enemyText.userData = { isEnemyKillSprite: true };
      group.add(enemyText);
    });
  } else {
    const noEnemiesText = makeSprite('NO ENEMIES', {
      fontSize: scalePauseFont(22),
      color: '#666666',
      scale: scalePauseText(0.05),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    noEnemiesText.position.set(0, yPos, 0.02);
    noEnemiesText.userData = { isEnemyKillSprite: true };
    group.add(noEnemiesText);
  }

  return group;
}

/**
 * Create stats section with charts
 */
function createStatsSection() {
  const group = new THREE.Group();

  // Background (higher opacity for readability)
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 2.2),
    createPauseMaterial(0x15002a, 0.85)
  );
  bg.renderOrder = PAUSE_SECTION_BG_RENDER_ORDER;
  group.add(bg);

  // Title
  const titleText = makeSprite('RUN TOTALS', {
    fontSize: scalePauseFont(48),
    color: '#ff00ff',
    scale: scalePauseText(0.15),
    renderOrder: PAUSE_TEXT_RENDER_ORDER
  });
  titleText.position.set(0, -1.336, 0.02);
  group.add(titleText);

  // KILLS/SHOTS/HITS centered under the blaster sections
  const primaryStats = [
    `KILLS: ${game.runStats.totalKills || game.totalKills || 0}`,
    `SHOTS: ${game.runStats.shotsFired}`,
    `HITS: ${game.runStats.shotsHit}`,
  ];

  primaryStats.forEach((stat, index) => {
    const text = makeSprite(stat, {
      fontSize: scalePauseFont(36),
      color: '#00ffff',
      scale: scalePauseText(0.1),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    text.position.set(0, -1.316 - (index * 0.24), 0.02);
    text.userData = { isPauseStatText: true };
    group.add(text);
  });

  // Everything else sits below KILLS/SHOTS/HITS
  const secondaryStats = [
    `ACCURACY: ${calculateAccuracy()}%`,
    `STREAK: ${game.runStats.longestKillStreak}`,
    `BOSS: ${game.runStats.bossesKilled}`,
  ];

  secondaryStats.forEach((stat, index) => {
    const text = makeSprite(stat, {
      fontSize: scalePauseFont(36),
      color: '#00ffff',
      scale: scalePauseText(0.1),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    text.position.set(-1.08, -1.54 - (index * 0.22), 0.02);
    text.userData = { isPauseStatText: true };
    group.add(text);
  });

  // Canvas for charts (accuracy donut + damage bars)
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const chartTexture = new THREE.CanvasTexture(canvas);
  const chartMat = new THREE.MeshBasicMaterial({
    map: chartTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const chartMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.9), chartMat);
  chartMesh.position.set(1.1, -0.82, 0.02);
  chartMesh.renderOrder = PAUSE_TEXT_RENDER_ORDER;
  group.add(chartMesh);

  pauseMenuElements.chartCanvas = { canvas, texture: chartTexture, mesh: chartMesh };

  return group;
}

/**
 * Update pause menu charts
 */
function updatePauseCharts() {
  if (!pauseMenuElements.chartCanvas) return;

  const { canvas, texture, mesh } = pauseMenuElements.chartCanvas;
  const ctx = canvas.getContext('2d');
  const anim = pauseMenuAnimation.chartAnimation;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw accuracy donut chart
  const centerX = 80;
  const centerY = canvas.height / 2;
  const radius = 35;
  const accuracy = calculateAccuracy();
  const accuracyAngle = (accuracy / 100) * Math.PI * 2;

  // Outer ring (cyan)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#004444';
  ctx.lineWidth = 8;
  ctx.stroke();

  // Accuracy arc (animated)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + accuracyAngle * anim);
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Accuracy percentage text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.floor(accuracy * anim)}%`, centerX, centerY);

  // Draw damage per hand bar chart
  const barBaseX = 160;
  const barBaseY = canvas.height - 20;
  const barWidth = 20;
  const barSpacing = 25;

  ['left', 'right'].forEach((hand, i) => {
    const damage = game.handStats[hand].totalDamage || 0;
    const maxDamage = Math.max(game.handStats.left.totalDamage, game.handStats.right.totalDamage, 100);
    const barHeight = (damage / maxDamage) * 50 * anim;

    // Bar background
    ctx.fillStyle = '#333333';
    ctx.fillRect(barBaseX + (i * barSpacing), barBaseY - 50, barWidth, 50);

    // Bar (pink for left, cyan for right)
    ctx.fillStyle = hand === 'left' ? '#ff00ff' : '#00ffff';
    ctx.fillRect(barBaseX + (i * barSpacing), barBaseY - barHeight, barWidth, barHeight);

    // Label
    ctx.fillStyle = '#888888';
    ctx.font = `${scalePauseFont(10)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(hand.toUpperCase(), barBaseX + (i * barSpacing) + barWidth / 2, barBaseY + 10);
  });

  // Update texture
  texture.needsUpdate = true;
}

/**
 * Update stats numbers with counting animation
 */
function updatePauseStatsNumbers() {
  if (!pauseMenuElements.leftBlasterSection || !pauseMenuElements.rightBlasterSection) return;

  // Update left blaster section
  updateSectionStats(pauseMenuElements.leftBlasterSection, 'left');
  updateSectionStats(pauseMenuElements.rightBlasterSection, 'right');
  updateStatsSectionText();
  applyPauseMenuRenderPriority(pauseMenuGroup);
}

/**
 * Update stats section text
 */
function updateStatsSectionText() {
  if (!pauseMenuElements.statsSection) return;

  // Remove old stat text sprites, keep panel/title/chart mesh.
  const section = pauseMenuElements.statsSection;
  [...section.children].forEach((child) => {
    if (child.userData && child.userData.isPauseStatText) {
      section.remove(child);
    }
  });

  // Add updated centered KILLS/SHOTS/HITS block.
  const primaryStats = [
    `KILLS: ${game.runStats.totalKills || game.totalKills || 0}`,
    `SHOTS: ${game.runStats.shotsFired}`,
    `HITS: ${game.runStats.shotsHit}`,
  ];

  primaryStats.forEach((stat, index) => {
    const text = makeSprite(stat, {
      fontSize: scalePauseFont(36),
      color: '#00ffff',
      scale: scalePauseText(0.1),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    text.position.set(0, -1.316 - (index * 0.24), 0.03);
    text.userData = { isPauseStatText: true };
    section.add(text);
  });

  // Add the rest of the stats below.
  const secondaryStats = [
    `ACCURACY: ${calculateAccuracy()}%`,
    `STREAK: ${game.runStats.longestKillStreak}`,
    `BOSS: ${game.runStats.bossesKilled}`,
  ];

  secondaryStats.forEach((stat, index) => {
    const text = makeSprite(stat, {
      fontSize: scalePauseFont(36),
      color: '#00ffff',
      scale: scalePauseText(0.1),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    text.position.set(-1.08, -1.54 - (index * 0.22), 0.03);
    text.userData = { isPauseStatText: true };
    section.add(text);
  });
}

/**
 * Update section stats for blasters
 */
function updateSectionStats(section, hand) {
  // Remove old upgrade sprites
  [...section.children].forEach((child) => {
    if (child.userData && child.userData.isUpgradeSprite) {
      section.remove(child);
    }
  });

  // Update blaster section with current stats (exclude dream_fragment)
  const upgrades = game.upgrades[hand] || {};
  const upgradeEntries = Object.entries(upgrades).filter(([id]) => id !== 'dream_fragment');
  const yOffset = 0.08;

  if (upgradeEntries.length > 0) {
    upgradeEntries.forEach(([id, count], index) => {
      const iconData = UPGRADE_ICONS[id] || { icon: '•', color: '#ffffff' };
      const displayName = id.replace(/_/g, ' ').toUpperCase();
      const upgradeText = makeSprite(`${iconData.icon} ${displayName} x${count}`, {
        fontSize: scalePauseFont(36),
        color: iconData.color,
        scale: scalePauseText(0.1),
        renderOrder: PAUSE_TEXT_RENDER_ORDER
      });
      const yPos = yOffset - (index * 0.24);
      upgradeText.position.set(0, yPos, 0.03);
      upgradeText.userData = { isUpgradeSprite: true };
      section.add(upgradeText);
    });
  } else {
    const noUpgradesText = makeSprite('NO UPGRADES', {
      fontSize: scalePauseFont(36),
      color: '#888888',
      scale: scalePauseText(0.1),
      renderOrder: PAUSE_TEXT_RENDER_ORDER
    });
    noUpgradesText.position.set(0, 0.08, 0.03);
    noUpgradesText.userData = { isUpgradeSprite: true };
    section.add(noUpgradesText);
  }
}

/**
 * Create resume button
 */
function createResumeButton() {
  const group = new THREE.Group();

  // Match the title SCOREBOARD button style so pause/resume remains readable in VR.
  const btnGeo = new THREE.PlaneGeometry(1.55, 0.34);
  const btnMat = new THREE.MeshBasicMaterial({
    color: 0x110033,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const btnMesh = new THREE.Mesh(btnGeo, btnMat);
  btnMesh.userData.isResumeButton = true;
  group.add(btnMesh);

  const btnBorder = new THREE.LineSegments(
    new THREE.EdgesGeometry(btnGeo),
    new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
      depthWrite: false,
    })
  );
  btnBorder.renderOrder = PAUSE_TEXT_RENDER_ORDER;
  group.add(btnBorder);

  const text = makeSprite('RESUME', {
    fontSize: scalePauseFont(42),
    color: '#ffff00',
    glow: true,
    glowColor: '#ffff00',
    scale: scalePauseText(0.14),
    renderOrder: PAUSE_TEXT_RENDER_ORDER
  });
  text.position.set(0, 0, 0.02);
  group.add(text);

  // Store button data for raycasting (hitbox is larger than text)
  group.userData = {
    isResumeButton: true,
    width: 2.0,
    height: 0.5
  };

  return group;
}

/**
 * Show pause countdown overlay (3, 2, 1)
 * Rebuilds every time to match the start-of-game ready screen style exactly.
 */
export function showPauseCountdown(seconds) {
  // Clear and rebuild every time (same pattern as showReadyScreen)
  disposeGroupChildren(pauseCountdownGroup);
  pauseCountdownInitialized = false;
  pauseCountdownHeader = null;
  pauseCountdownText = null;

  pauseCountdownGroup.visible = true;
  pauseCountdownGroup.position.set(0, 0, -2.5);

  // Match showReadyScreen exactly: "READY?" header in yellow
  const header = makeSprite('READY?', {
    fontSize: 70, color: '#ffff00', glow: true, scale: 0.6,
  });
  header.position.set(0, 0.8, 0);
  pauseCountdownHeader = header;
  pauseCountdownGroup.add(header);

  // Show only the countdown number so the pause flow always resolves through the RESUME button.
  const text = makeSprite(`${Math.ceil(seconds)}`, {
    fontSize: 120, color: '#ffffff', glow: true, glowColor: '#00ffff', scale: 0.7,
  });
  text.position.set(0, 0.1, 0.01);
  pauseCountdownText = text;
  pauseCountdownGroup.add(text);
  pauseCountdownInitialized = true;
}

/**
 * Hide pause countdown
 */
export function hidePauseCountdown() {
  pauseCountdownGroup.visible = false;
}

/**
 * Update pause countdown display
 */
export function updatePauseCountdownDisplay(seconds) {
  if (!pauseCountdownText) return;

  if (!seconds) {
    pauseCountdownText.visible = false;
    return;
  }

  pauseCountdownText.visible = true;
  const newSeconds = Math.ceil(seconds);
  updateSpriteText(pauseCountdownText, `${newSeconds}`, {
    fontSize: 120,
    color: '#ffffff',
    glow: true,
    glowColor: '#00ffff',
    scale: 0.7,
  });
}

/**
 * Handle raycast hits on pause menu (for desktop clicks)
 */
export function getPauseMenuHit(raycaster) {
  if (!pauseMenuGroup.visible) return null;

  const intersects = raycaster.intersectObjects(pauseMenuGroup.children, true);

  for (const intersect of intersects) {
    let obj = intersect.object;
    while (obj && !obj.userData.isResumeButton) {
      obj = obj.parent;
    }

    if (obj && obj.userData.isResumeButton) {
      return 'resume';
    }
  }

  return null;
}

/**
 * Calculate accuracy percentage
 */
function calculateAccuracy() {
  const fired = game.runStats.shotsFired;
  const hit = game.runStats.shotsHit;
  if (fired === 0) return 0;
  return Math.round((hit / fired) * 100);
}
