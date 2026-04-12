// ============================================================
//  SETTINGS MENU - Volume controls for music & SFX
// ============================================================

import * as THREE from 'three';
import {
  makeSprite, updateSpriteText, disposeGroupChildren,
} from './hud.js';
import { getMusicVolume, getSFXVolume, setMusicVolume, setSFXVolume, playMenuClick } from './audio.js';

export const settingsGroup = new THREE.Group();
settingsGroup.name = 'settings-menu';
settingsGroup.visible = false;

// Track which menu we came from so BACK returns correctly
let previousMenu = null; // 'title' | 'pause'

let musicVolSprite = null;
let sfxVolSprite = null;

// Render order: 995 sits above game objects (max ~950) but below HUD (999)
// and below blaster displays (999). This prevents the settings panel from
// drawing on top of the player's weapon visuals.
const SETTINGS_FONT_SIZE = 38;
const SETTINGS_LABEL_FONT_SIZE = 28;
const SETTINGS_SCALE = 0.12;
const SETTINGS_LABEL_SCALE = 0.09;
const SETTINGS_RENDER_ORDER = 995;

// References to button meshes for raycasting
let musicUpBtn = null;
let musicDownBtn = null;
let sfxUpBtn = null;
let sfxDownBtn = null;
let backBtn = null;

function settingsMaterial(color = 0x110033, opacity = 0.85) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
}

function makeBtn(label, width = 0.4, height = 0.25, borderColor = 0x00ffff, fontSize = 32, fontScale = 0.1) {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(width, height);
  const mesh = new THREE.Mesh(geo, settingsMaterial(0x0a0020));
  mesh.renderOrder = SETTINGS_RENDER_ORDER;
  group.add(mesh);
  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: borderColor, depthTest: false, depthWrite: false })
  );
  border.renderOrder = SETTINGS_RENDER_ORDER;
  group.add(border);
  const text = makeSprite(label, {
    fontSize,
    color: '#00ffff',
    scale: fontScale,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  text.position.set(0, 0, 0.01);
  group.add(text);
  return { group, mesh };
}

/**
 * Build (or rebuild) the settings panel UI
 */
function buildSettingsPanel() {
  disposeGroupChildren(settingsGroup);

  const musicVol = getMusicVolume();
  const sfxVol = getSFXVolume();

  // ── Panel background ──
  const panelGeo = new THREE.PlaneGeometry(3.2, 2.0);
  const panelMesh = new THREE.Mesh(panelGeo, settingsMaterial(0x0a0015, 0.92));
  panelMesh.renderOrder = SETTINGS_RENDER_ORDER - 2;
  settingsGroup.add(panelMesh);

  // Panel border
  const borderGeo = new THREE.EdgesGeometry(panelGeo);
  const border = new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({
    color: 0x00ffff, depthTest: false, depthWrite: false
  }));
  border.renderOrder = SETTINGS_RENDER_ORDER - 1;
  settingsGroup.add(border);

  // ── Title ──
  const title = makeSprite('SETTINGS', {
    fontSize: 42,
    color: '#00ffff',
    glow: true,
    glowColor: '#00ffff',
    scale: 0.4,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  title.position.set(0, 0.75, 0.02);
  settingsGroup.add(title);

  // ── Column positions ──
  const colX = -0.7;  // Music column center
  const col2X = 0.7;  // SFX column center

  // ── MUSIC label ──
  const musicLabel = makeSprite('MUSIC VOLUME', {
    fontSize: SETTINGS_LABEL_FONT_SIZE,
    color: '#aaaaff',
    scale: 0.4,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  musicLabel.position.set(colX, 0.44, 0.02);
  settingsGroup.add(musicLabel);

  // ── SFX label ──
  const sfxLabel = makeSprite('SOUND EFFECTS VOLUME', {
    fontSize: SETTINGS_LABEL_FONT_SIZE,
    color: '#aaaaff',
    scale: 0.4,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  sfxLabel.position.set(col2X, 0.44, 0.02);
  settingsGroup.add(sfxLabel);

  // ── Music UP button ──
  const mUp = makeBtn('▲', 0.5, 0.28, 0x00ffff, 36, 0.13);
  mUp.group.position.set(colX, 0.18, 0.02);
  mUp.mesh.userData.isSettingsBtn = true;
  mUp.mesh.userData.settingsAction = 'musicUp';
  musicUpBtn = mUp.mesh;
  settingsGroup.add(mUp.group);

  // ── Music volume display ──
  musicVolSprite = makeSprite(`${musicVol}%`, {
    fontSize: SETTINGS_FONT_SIZE,
    color: '#ffffff',
    glow: true,
    glowColor: '#00ffff',
    scale: 0.3,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  musicVolSprite.position.set(colX, -0.08, 0.02);
  settingsGroup.add(musicVolSprite);

  // ── Music DOWN button ──
  const mDown = makeBtn('▼', 0.5, 0.28, 0x00ffff, 36, 0.13);
  mDown.group.position.set(colX, -0.32, 0.02);
  mDown.mesh.userData.isSettingsBtn = true;
  mDown.mesh.userData.settingsAction = 'musicDown';
  musicDownBtn = mDown.mesh;
  settingsGroup.add(mDown.group);

  // ── SFX UP button ──
  const sUp = makeBtn('▲', 0.5, 0.28, 0x00ffff, 36, 0.13);
  sUp.group.position.set(col2X, 0.18, 0.02);
  sUp.mesh.userData.isSettingsBtn = true;
  sUp.mesh.userData.settingsAction = 'sfxUp';
  sfxUpBtn = sUp.mesh;
  settingsGroup.add(sUp.group);

  // ── SFX volume display ──
  sfxVolSprite = makeSprite(`${sfxVol}%`, {
    fontSize: SETTINGS_FONT_SIZE,
    color: '#ffffff',
    glow: true,
    glowColor: '#00ffff',
    scale: 0.3,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  sfxVolSprite.position.set(col2X, -0.08, 0.02);
  settingsGroup.add(sfxVolSprite);

  // ── SFX DOWN button ──
  const sDown = makeBtn('▼', 0.5, 0.28, 0x00ffff, 36, 0.13);
  sDown.group.position.set(col2X, -0.32, 0.02);
  sDown.mesh.userData.isSettingsBtn = true;
  sDown.mesh.userData.settingsAction = 'sfxDown';
  sfxDownBtn = sDown.mesh;
  settingsGroup.add(sDown.group);

  // ── Divider line ── (w=0.02, h=0.65, centered at (0, -0.08, 0.015))
  const divGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -0.08 + 0.325, 0.015),
    new THREE.Vector3(0, -0.08 - 0.325, 0.015),
  ]);
  const divider = new THREE.Line(divGeo, new THREE.LineBasicMaterial({
    color: 0x00ffff, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false
  }));
  divider.renderOrder = SETTINGS_RENDER_ORDER;
  settingsGroup.add(divider);

  // ── BACK button ── (w=0.75, h=0.3)
  const back = makeBtn('BACK', 0.75, 0.3, 0xffff00, 38, 0.12);
  back.group.position.set(0, -0.72, 0.02);
  back.mesh.userData.isSettingsBtn = true;
  back.mesh.userData.settingsAction = 'back';
  backBtn = back.mesh;
  settingsGroup.add(back.group);
}

/**
 * Show settings panel. `from` is 'title' or 'pause'.
 */
export function showSettings(from) {
  previousMenu = from;
  buildSettingsPanel();

  if (from === 'pause') {
    // Position at pause menu location (in front of player)
    settingsGroup.position.set(0, 1.5, -2.6);
    settingsGroup.rotation.set(0, 0, 0);
    settingsGroup.scale.setScalar(0.78); // Match PAUSE_MENU_SCALE
  } else {
    // Position at title screen location
    settingsGroup.position.set(0, 1.2, -3.5);
    settingsGroup.rotation.set(0, 0, 0);
    settingsGroup.scale.setScalar(1);
  }

  settingsGroup.visible = true;
}

export function hideSettings() {
  settingsGroup.visible = false;
  disposeGroupChildren(settingsGroup);
  musicVolSprite = null;
  sfxVolSprite = null;
  musicUpBtn = null;
  musicDownBtn = null;
  sfxUpBtn = null;
  sfxDownBtn = null;
  backBtn = null;
}

export function isSettingsVisible() {
  return settingsGroup.visible;
}

/**
 * Returns which menu to return to when BACK is pressed
 */
export function getPreviousMenu() {
  return previousMenu;
}

/**
 * Handle raycast hits on settings panel
 * Returns the action string or null
 */
export function getSettingsHit(raycaster) {
  if (!settingsGroup.visible) return null;

  // Only raycast against the actual button meshes for precise hit detection
  const buttonMeshes = [musicUpBtn, musicDownBtn, sfxUpBtn, sfxDownBtn, backBtn].filter(Boolean);
  const intersects = raycaster.intersectObjects(buttonMeshes, false);

  for (const intersect of intersects) {
    let obj = intersect.object;
    // Walk up to find userData.settingsAction
    while (obj) {
      if (obj.userData && obj.userData.isSettingsBtn) {
        return obj.userData.settingsAction;
      }
      obj = obj.parent;
    }
  }
  return null;
}

/**
 * Update hover border highlight on settings menu buttons.
 * Visual scale/glow/sound is handled by updateHUDHover() in hud.js.
 * This only handles border color brightening.
 */
export function updateSettingsHover(raycaster) {
  if (!settingsGroup.visible) return;

  const buttonMeshes = [musicUpBtn, musicDownBtn, sfxUpBtn, sfxDownBtn, backBtn].filter(Boolean);
  if (buttonMeshes.length === 0) return;

  const intersects = raycaster.intersectObjects(buttonMeshes, false);
  const hoveredMesh = intersects.length > 0 ? intersects[0].object : null;

  buttonMeshes.forEach(btn => {
    const group = btn.parent;
    if (!group) return;
    const border = group.children.find(c => c instanceof THREE.LineSegments);
    if (!border || !border.material) return;

    const isHovered = btn === hoveredMesh;
    const isBack = btn.userData.settingsAction === 'back';
    const baseColor = isBack ? 0xffff00 : 0x00ffff;
    const hoverColor = isBack ? 0xffff88 : 0x88ffff;
    border.material.color.set(isHovered ? hoverColor : baseColor);
  });
}

/**
 * Returns true if settings should close (BACK was pressed)
 */
export function executeSettingsAction(action) {
  playMenuClick();
  switch (action) {
    case 'musicUp': {
      const vol = setMusicVolume(getMusicVolume() + 5);
      if (musicVolSprite) updateSpriteText(musicVolSprite, `${vol}%`, { fontSize: SETTINGS_FONT_SIZE, scale: SETTINGS_SCALE });
      return false;
    }
    case 'musicDown': {
      const vol = setMusicVolume(getMusicVolume() - 5);
      if (musicVolSprite) updateSpriteText(musicVolSprite, `${vol}%`, { fontSize: SETTINGS_FONT_SIZE, scale: SETTINGS_SCALE });
      return false;
    }
    case 'sfxUp': {
      const vol = setSFXVolume(getSFXVolume() + 5);
      if (sfxVolSprite) updateSpriteText(sfxVolSprite, `${vol}%`, { fontSize: SETTINGS_FONT_SIZE, scale: SETTINGS_SCALE });
      return false;
    }
    case 'sfxDown': {
      const vol = setSFXVolume(getSFXVolume() - 5);
      if (sfxVolSprite) updateSpriteText(sfxVolSprite, `${vol}%`, { fontSize: SETTINGS_FONT_SIZE, scale: SETTINGS_SCALE });
      return false;
    }
    case 'back':
      return true;
    default:
      return false;
  }
}
