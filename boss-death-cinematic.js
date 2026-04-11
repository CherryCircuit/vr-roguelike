// ============================================================
//  Boss Death Cinematic System
//  Extracted from main.js for modularity
//  Handles the visual cinematic sequence when a boss is defeated
// ============================================================

import * as THREE from 'three';

// Timing constants for the cinematic sequence
export const BOSS_DEATH_FREEZE = 0.18;
export const BOSS_DEATH_EXPLOSION_TIME = 0.9;
export const BOSS_DEATH_WHITE_FADE = 0.35;
export const BOSS_DEATH_BLACK_FADE = 0.55;
export const BOSS_DEATH_EXPLOSION_INTERVAL = 0.12;

// Internal state
let bossDeathFreezeTimer = 0;
let bossDeathWhiteOverlay = null;
let bossDeathBlackOverlay = null;
let bossDeathOverlayDismissed = false;  // True after dismissBossDeathOverlay() is called
let bossDeathWorldText = null;
let bossDeathCinematic = {
  active: false,
  timer: 0,
  explosionTimer: 0,
  bossPos: new THREE.Vector3(),
  boss: null,
  breakPieces: [],
  breakTimer: 0,
  breakIndex: 0,
  wasFinalBoss: false,
  finalSequenceStyle: null,
  finalMessageShown: false,
  finalGroanPlayed: false,
  finalExplosionTriggered: false,
  finalVictoryPlayed: false,
};

// External dependencies (injected via init)
let deps = {
  scene: null,
  camera: null,
  game: null,
  State: null,
  spawnBossDebris: null,
  spawnExplosionVisual: null,
  hideBossHealthBar: null,
  clearBoss: null,
  clearBossProjectiles: null,
  clearAllTelegraphs: null,
  playExplosionSound: null,
  stopMusic: null,
  completeLevel: null,
  endGame: null,
  applyEnvironmentFade: null,
  resetAllSlowMoState: null,
  hideKillsAlert: null,
  unloadBiomeForBossCinematic: null,
  showFloatingMessage: null,
  playFinalBossCollapseGroan: null,
  playFinalBossVictorySting: null,
};

/**
 * Initialize the boss death cinematic system with external dependencies
 * @param {Object} options - Dependency injection
 * @param {THREE.Camera} options.camera - The main camera
 * @param {Object} options.game - The game state object
 * @param {Object} options.State - The game state enum
 * @param {Function} options.spawnBossDebris - Spawn boss debris function
 * @param {Function} options.spawnExplosionVisual - Spawn explosion visual function
 * @param {Function} options.hideBossHealthBar - Hide boss health bar function
 * @param {Function} options.clearBoss - Clear boss function
 * @param {Function} options.clearAllTelegraphs - Clear all telegraphs function
 * @param {Function} options.playExplosionSound - Play explosion sound function
 * @param {Function} options.stopMusic - Stop music function
 * @param {Function} options.completeLevel - Complete level function
 * @param {Function} options.endGame - End game function
 * @param {Function} options.applyEnvironmentFade - Apply environment fade function
 * @param {Function} options.resetAllSlowMoState - Reset slow-mo state function
 * @param {Function} options.hideKillsAlert - Hide kills alert function
 */
export function initBossDeathCinematic(options) {
  deps = { ...deps, ...options };
}

/**
 * Get the current freeze timer value (for main.js render loop)
 * @returns {number} The freeze timer value
 */
export function getBossDeathFreezeTimer() {
  return bossDeathFreezeTimer;
}

/**
 * Check if boss death cinematic is currently active
 * @returns {boolean} True if cinematic is active
 */
export function isBossDeathCinematicActive() {
  return bossDeathCinematic.active;
}

/**
 * Initialize the white and black overlay meshes attached to the camera
 * These are used for the death cinematic fade effects
 */
export function initBossDeathOverlays() {
  if (!deps.camera) {
    console.warn('[boss-cinematic] Camera not set, cannot init overlays');
    return;
  }

  const geo = new THREE.PlaneGeometry(6, 6);
  bossDeathWhiteOverlay = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  bossDeathWhiteOverlay.renderOrder = 1002;
  bossDeathWhiteOverlay.visible = false;
  bossDeathWhiteOverlay.frustumCulled = false;  // Prevent disappearing when looking around
  bossDeathWhiteOverlay.position.set(0, 0, -0.26);
  deps.camera.add(bossDeathWhiteOverlay);

  bossDeathBlackOverlay = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  bossDeathBlackOverlay.renderOrder = 1003;
  bossDeathBlackOverlay.visible = false;
  bossDeathBlackOverlay.frustumCulled = false;  // Prevent disappearing when looking around
  bossDeathBlackOverlay.position.set(0, 0, -0.25);
  deps.camera.add(bossDeathBlackOverlay);
}

function disposeBossDeathWorldText() {
  if (!bossDeathWorldText) return;
  if (bossDeathWorldText.parent) bossDeathWorldText.parent.remove(bossDeathWorldText);
  if (bossDeathWorldText.material?.map) bossDeathWorldText.material.map.dispose();
  if (bossDeathWorldText.material) bossDeathWorldText.material.dispose();
  bossDeathWorldText = null;
}

function createBossDeathWorldText(text) {
  if (!deps.scene || !deps.camera || !text) return null;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 104px Georgia';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 160, 80, 0.95)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = '#fff2cf';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4.6, 1.15, 1);

  const direction = new THREE.Vector3();
  deps.camera.getWorldDirection(direction);
  sprite.position.copy(deps.camera.position).add(direction.multiplyScalar(4.0));
  sprite.position.y = deps.camera.position.y + 0.2;
  sprite.renderOrder = 1001;
  deps.scene.add(sprite);
  bossDeathWorldText = sprite;
  return sprite;
}

/**
 * Start the boss death cinematic sequence
 * @param {Object} boss - The boss object that was killed
 */
export function startBossDeathCinematic(boss) {
  if (!boss || bossDeathCinematic.active) return;

  console.log('[boss-cinematic] Starting boss death cinematic');

  if (deps.resetAllSlowMoState) deps.resetAllSlowMoState();
  bossDeathCinematic.active = true;
  bossDeathCinematic.timer = 0;
  bossDeathCinematic.explosionTimer = 0;
  bossDeathCinematic.bossPos.copy(boss.mesh.position);
  bossDeathCinematic.boss = boss;
  bossDeathCinematic.breakTimer = 0.22;
  bossDeathCinematic.breakIndex = 0;
  bossDeathCinematic.breakPieces = [];
  bossDeathCinematic.wasFinalBoss = deps.game && deps.game.level >= 20;
  bossDeathCinematic.finalSequenceStyle = boss?.def?.finalSequence || null;
  bossDeathCinematic.finalMessageShown = false;
  bossDeathCinematic.finalGroanPlayed = false;
  bossDeathCinematic.finalExplosionTriggered = false;
  bossDeathCinematic.finalVictoryPlayed = false;
  bossDeathFreezeTimer = BOSS_DEATH_FREEZE;
  bossDeathOverlayDismissed = bossDeathCinematic.wasFinalBoss;
  disposeBossDeathWorldText();

  if (bossDeathCinematic.wasFinalBoss) {
    boss.mesh.traverse((child) => {
      if (child.isMesh && (child.userData?.isBossBody || child.userData?.isEclipseHeart)) {
        bossDeathCinematic.breakPieces.push(child);
      }
    });
    bossDeathCinematic.breakPieces.sort((a, b) => b.position.y - a.position.y);
  }

  // Ensure overlays exist and are properly initialized
  if (bossDeathWhiteOverlay) {
    bossDeathWhiteOverlay.material.opacity = 0;
    bossDeathWhiteOverlay.visible = true;  // Set visible so opacity changes take effect
  } else {
    console.warn('[boss-cinematic] White overlay not initialized!');
  }
  if (bossDeathBlackOverlay) {
    bossDeathBlackOverlay.material.opacity = 0;
    bossDeathBlackOverlay.visible = true;  // Set visible so opacity changes take effect
  } else {
    console.warn('[boss-cinematic] Black overlay not initialized!');
  }

  if (!bossDeathCinematic.wasFinalBoss && deps.spawnBossDebris) deps.spawnBossDebris(boss);
  if (typeof window !== 'undefined' && window.playBossDeath) {
    window.playBossDeath();
  }
  // Play death knell for all bosses
  if (deps.playSkullDeathKnell) {
    deps.playSkullDeathKnell();
  }
  if (deps.stopMusic) deps.stopMusic();
  if (deps.playExplosionSound) deps.playExplosionSound();
  if (deps.hideBossHealthBar) deps.hideBossHealthBar();
  if (deps.clearBossProjectiles) deps.clearBossProjectiles();
  if (deps.clearAllTelegraphs) deps.clearAllTelegraphs();

  if (!bossDeathCinematic.wasFinalBoss && deps.clearBoss) {
    deps.clearBoss();
  }

  if (deps.game && deps.State) {
    deps.game.state = deps.State.BOSS_DEATH_CINEMATIC;
  }
  console.log('[boss-cinematic] State set to BOSS_DEATH_CINEMATIC');
}

/**
 * Finish the boss death cinematic and transition to next state.
 * The black overlay is intentionally kept visible to prevent the old biome
 * from popping back while completeLevel sets up the transition.
 */
export function finishBossDeathCinematic() {
  bossDeathCinematic.active = false;
  bossDeathCinematic.timer = 0;
  bossDeathCinematic.explosionTimer = 0;
  bossDeathCinematic.boss = null;
  bossDeathCinematic.breakPieces.length = 0;
  bossDeathCinematic.breakTimer = 0;
  bossDeathCinematic.breakIndex = 0;
  bossDeathCinematic.finalSequenceStyle = null;
  bossDeathCinematic.finalMessageShown = false;
  bossDeathCinematic.finalGroanPlayed = false;
  bossDeathCinematic.finalExplosionTriggered = false;
  bossDeathCinematic.finalVictoryPlayed = false;
  disposeBossDeathWorldText();

  // Hide white overlay (done with), but KEEP black overlay visible.
  // The black overlay prevents any pop-back of the old biome scene.
  // It will be dismissed later via dismissBossDeathOverlay().
  if (bossDeathWhiteOverlay) {
    bossDeathWhiteOverlay.material.opacity = 0;
    bossDeathWhiteOverlay.visible = false;
  }
  // Black overlay stays at opacity 1, visible = true
  bossDeathOverlayDismissed = false;

  // With the black overlay fully opaque, unload the outgoing biome so
  // upgrade cards appear on a true black background before the rebuild.
  if (deps.unloadBiomeForBossCinematic) {
    deps.unloadBiomeForBossCinematic();
  }

  if (bossDeathCinematic.wasFinalBoss) {
    bossDeathCinematic.wasFinalBoss = false;
    bossDeathOverlayDismissed = true;
    if (bossDeathBlackOverlay) {
      bossDeathBlackOverlay.material.opacity = 0;
      bossDeathBlackOverlay.visible = false;
    }
    if (deps.endGame) deps.endGame(true);
    return;
  }

  bossDeathCinematic.wasFinalBoss = false;
  if (deps.completeLevel) deps.completeLevel();
}

/**
 * Check if the boss death black overlay is still active (covering the screen).
 * Used by main.js to know the environment is already fully faded.
 * @returns {boolean} True if the black overlay is still visible
 */
export function isBossDeathOverlayActive() {
  return !bossDeathOverlayDismissed && bossDeathBlackOverlay && bossDeathBlackOverlay.visible;
}

/**
 * Dismiss the boss death black overlay. Call this after the new biome is set up
 * and the environment fade-in has started, so no pop-back can occur.
 */
export function dismissBossDeathOverlay() {
  bossDeathOverlayDismissed = true;
  if (bossDeathBlackOverlay) {
    bossDeathBlackOverlay.material.opacity = 0;
    bossDeathBlackOverlay.visible = false;
  }
}

/**
 * Update the boss death cinematic each frame
 * @param {number} rawDt - Unscaled delta time in seconds
 */
function updateFinalBossDeathCinematic(rawDt) {
  bossDeathCinematic.timer += rawDt;
  const t = bossDeathCinematic.timer;
  const collapseStart = BOSS_DEATH_FREEZE;
  const collapseEnd = 4.6;
  const flashStart = 4.0;
  const flashEnd = 4.55;
  const fadeStart = 4.2;
  const fadeEnd = 6.1;
  const textStart = 6.0;
  const textFadeInEnd = 6.9;
  const textHoldEnd = 8.15;
  const textEnd = 9.2;
  const finishTime = 9.45;

  const boss = bossDeathCinematic.boss;
  if (boss?.mesh && t >= collapseStart && t < collapseEnd) {
    if (!bossDeathCinematic.finalGroanPlayed && deps.playFinalBossCollapseGroan) {
      deps.playFinalBossCollapseGroan();
      bossDeathCinematic.finalGroanPlayed = true;
    }

    const collapseProgress = Math.min(1, (t - collapseStart) / (collapseEnd - collapseStart));
    boss.mesh.rotation.x = -collapseProgress * 1.05;
    boss.mesh.rotation.z = Math.sin(t * 11.0) * 0.05;
    boss.mesh.rotation.y += rawDt * (0.5 + collapseProgress * 0.2);
    boss.mesh.position.y -= rawDt * (collapseProgress > 0.45 ? 1.15 : 0.28);
    boss.mesh.position.z -= rawDt * collapseProgress * 0.55;
    bossDeathCinematic.bossPos.copy(boss.mesh.position);

    bossDeathCinematic.breakTimer -= rawDt;
    if (bossDeathCinematic.breakTimer <= 0 && bossDeathCinematic.breakIndex < bossDeathCinematic.breakPieces.length) {
      const piece = bossDeathCinematic.breakPieces[bossDeathCinematic.breakIndex++];
      if (piece && piece.visible) {
        const piecePos = new THREE.Vector3();
        piece.getWorldPosition(piecePos);
        piece.visible = false;
        if (deps.spawnExplosionVisual) deps.spawnExplosionVisual(piecePos, 0.45 + Math.random() * 0.35);
        if (deps.playExplosionSound) deps.playExplosionSound();
      }
      bossDeathCinematic.breakTimer = 0.11;
    }

    bossDeathCinematic.explosionTimer -= rawDt;
    if (bossDeathCinematic.explosionTimer <= 0) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 2.8,
        (Math.random() - 0.5) * 3.2,
        (Math.random() - 0.5) * 2.8,
      );
      const explosionPos = bossDeathCinematic.bossPos.clone().add(offset);
      if (deps.spawnExplosionVisual) deps.spawnExplosionVisual(explosionPos, 0.8 + Math.random() * 0.7);
      if (deps.playExplosionSound) deps.playExplosionSound();
      bossDeathCinematic.explosionTimer = 0.12;
    }
  }

  if (!bossDeathCinematic.finalExplosionTriggered && t >= flashStart) {
    bossDeathCinematic.finalExplosionTriggered = true;
    for (let i = 0; i < 10; i++) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 4.0,
        (Math.random() - 0.5) * 4.0,
        (Math.random() - 0.5) * 4.0,
      );
      const explosionPos = bossDeathCinematic.bossPos.clone().add(offset);
      if (deps.spawnExplosionVisual) deps.spawnExplosionVisual(explosionPos, 1.2 + Math.random() * 0.8);
      if (deps.playExplosionSound) deps.playExplosionSound();
    }
    if (deps.spawnBossDebris && boss) deps.spawnBossDebris(boss);
    if (deps.clearBoss) deps.clearBoss();
    bossDeathCinematic.boss = null;
  }

  let whiteOpacity = 0;
  if (t >= flashStart && t < flashEnd) {
    const flashProgress = (t - flashStart) / (flashEnd - flashStart);
    whiteOpacity = flashProgress < 0.35
      ? (flashProgress / 0.35) * 0.92
      : (1 - (flashProgress - 0.35) / 0.65) * 0.92;
  }

  const envFade = t < fadeStart ? 0 : Math.min(1, (t - fadeStart) / (fadeEnd - fadeStart));
  if (deps.applyEnvironmentFade) deps.applyEnvironmentFade(envFade);

  if (!bossDeathCinematic.finalMessageShown && t >= textStart) {
    bossDeathCinematic.finalMessageShown = true;
    createBossDeathWorldText('THE ECLIPSE IS DEAD');
  }

  if (!bossDeathCinematic.finalVictoryPlayed && t >= textStart && deps.playFinalBossVictorySting) {
    bossDeathCinematic.finalVictoryPlayed = true;
    deps.playFinalBossVictorySting();
  }

  if (bossDeathWorldText) {
    let textOpacity = 0;
    if (t >= textStart && t < textFadeInEnd) {
      textOpacity = (t - textStart) / (textFadeInEnd - textStart);
    } else if (t >= textFadeInEnd && t < textHoldEnd) {
      textOpacity = 1;
    } else if (t >= textHoldEnd && t < textEnd) {
      textOpacity = 1 - ((t - textHoldEnd) / (textEnd - textHoldEnd));
    }
    bossDeathWorldText.material.opacity = Math.min(1, Math.max(0, textOpacity));
  }

  if (bossDeathWhiteOverlay) {
    if (bossDeathWhiteOverlay.material?.color) {
      bossDeathWhiteOverlay.material.color.setHex(0xffe3b2);
    }
    bossDeathWhiteOverlay.visible = whiteOpacity > 0;
    bossDeathWhiteOverlay.material.opacity = Math.min(1, Math.max(0, whiteOpacity));
  }
  if (bossDeathBlackOverlay) {
    bossDeathBlackOverlay.visible = false;
    bossDeathBlackOverlay.material.opacity = 0;
  }

  if (t >= finishTime) {
    finishBossDeathCinematic();
  }
}

export function updateBossDeathCinematic(rawDt) {
  if (!bossDeathCinematic.active) return;

  const isFinalSequence = bossDeathCinematic.wasFinalBoss && bossDeathCinematic.finalSequenceStyle === 'eclipse-collapse';
  if (isFinalSequence) {
    updateFinalBossDeathCinematic(rawDt);
    return;
  }

  bossDeathCinematic.timer += rawDt;
  const t = bossDeathCinematic.timer;
  const explosionStart = BOSS_DEATH_FREEZE;
  const explosionEnd = explosionStart + BOSS_DEATH_EXPLOSION_TIME;
  const whiteStart = explosionEnd;
  const whiteEnd = whiteStart + BOSS_DEATH_WHITE_FADE;
  const blackEnd = whiteEnd + BOSS_DEATH_BLACK_FADE;

  if (t >= explosionStart && t <= explosionEnd) {
    bossDeathCinematic.explosionTimer -= rawDt;
    if (bossDeathCinematic.explosionTimer <= 0) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 1.8,
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.8,
      );
      const explosionPos = bossDeathCinematic.bossPos.clone().add(offset);
      if (deps.spawnExplosionVisual) deps.spawnExplosionVisual(explosionPos, 0.7 + Math.random() * 0.8);
      if (deps.playExplosionSound) deps.playExplosionSound();
      bossDeathCinematic.explosionTimer = BOSS_DEATH_EXPLOSION_INTERVAL;
    }
  }

  let whiteOpacity = 0;
  let blackOpacity = 0;
  let envFade = 0;
  if (t >= whiteStart && t < whiteEnd) {
    whiteOpacity = (t - whiteStart) / BOSS_DEATH_WHITE_FADE;
  } else if (t >= whiteEnd && t < blackEnd) {
    whiteOpacity = 1;
    const progress = (t - whiteEnd) / BOSS_DEATH_BLACK_FADE;
    blackOpacity = progress;
    envFade = progress;
  } else if (t >= blackEnd) {
    blackOpacity = 1;
    envFade = 1;
  }

  if (deps.applyEnvironmentFade) deps.applyEnvironmentFade(envFade);

  if (bossDeathWhiteOverlay) {
    if (bossDeathWhiteOverlay.material?.color) {
      bossDeathWhiteOverlay.material.color.setHex(0xffffff);
    }
    bossDeathWhiteOverlay.visible = whiteOpacity > 0;
    bossDeathWhiteOverlay.material.opacity = Math.min(1, Math.max(0, whiteOpacity));
  }
  if (bossDeathBlackOverlay) {
    bossDeathBlackOverlay.visible = blackOpacity > 0;
    bossDeathBlackOverlay.material.opacity = Math.min(1, Math.max(0, blackOpacity));
  }

  if (t >= blackEnd) {
    finishBossDeathCinematic();
  }
}

/**
 * Update the freeze timer (called from main.js render loop)
 * @param {number} rawDt - Unscaled delta time in seconds
 * @returns {boolean} True if freeze is active (time should be stopped)
 */
export function updateBossDeathFreeze(rawDt) {
  if (bossDeathFreezeTimer > 0) {
    bossDeathFreezeTimer -= rawDt;
    if (bossDeathFreezeTimer < 0) bossDeathFreezeTimer = 0;
    return true;
  }
  return false;
}

/**
 * Check if the current frame should use zero time scale due to freeze
 * @returns {boolean} True if time should be frozen
 */
export function shouldFreezeTime() {
  return bossDeathFreezeTimer > 0;
}
