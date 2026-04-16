// ============================================================
//  SETTINGS MENU - Volume controls for music & SFX
// ============================================================

import * as THREE from 'three';
import {
  makeSprite, updateSpriteText, disposeGroupChildren,
  pauseMenuGroup, hideTitle, showTitle,
  loadLayout,
} from './hud.js';
import { getMusicVolume, getSFXVolume, setMusicVolume, setSFXVolume, playMenuClick, playMenuHoverSound, getCurrentTrackName, skipToNextTrack, skipToPrevTrack, getPlaylistInfo } from './audio.js';

export const settingsGroup = new THREE.Group();
settingsGroup.name = 'settings-menu';
settingsGroup.visible = false;

// Track which menu we came from so BACK returns correctly
let previousMenu = null; // 'title' | 'pause'

let musicVolSprite = null;
let sfxVolSprite = null;

// Stored layout values for use in executeSettingsAction updates
let musicVolEl = null;
let sfxVolEl = null;
let musicVolColor = '#ffffff';
let sfxVolColor = '#ffffff';
let titleColor = '#00ffff';
let trackNameColor = '#aaaaff';

// Render order: 995 sits above game objects (max ~950) but below HUD (999)
// and below blaster displays (999). This prevents the settings panel from
// drawing on top of the player's weapon visuals.
const SETTINGS_FONT_SIZE = 38;
const SETTINGS_LABEL_FONT_SIZE = 28;
const SETTINGS_SCALE = 0.12;
const SETTINGS_LABEL_SCALE = 0.09;
const SETTINGS_RENDER_ORDER = 995;

// ── Layout cache ──
let _settingsLayout = null;
async function ensureSettingsLayout() {
  if (!_settingsLayout) {
    _settingsLayout = await loadLayout('settings');
  }
  return _settingsLayout;
}

/** Helper: read x/y/z from a layout element, falling back to defaults */
function le(layout, key, defaults) {
  const el = layout?.elements?.[key];
  if (!el) return defaults;
  return {
    x: el.x ?? defaults.x,
    y: el.y ?? defaults.y,
    z: el.z ?? defaults.z,
    w: el.w ?? defaults.w,
    h: el.h ?? defaults.h,
    scale: el.scale ?? defaults.scale,
    color: el.color != null ? el.color : defaults.color,
    fontSize: el.fontSize ?? defaults.fontSize,
    visible: el.visible ?? defaults.visible,
  };
}

// References to button meshes for raycasting
let musicUpBtn = null;
let _lastSettingsHovered = null; // track hover state for sound
let musicDownBtn = null;
let sfxUpBtn = null;
let sfxDownBtn = null;
let backBtn = null;
let prevTrackBtn = null;
let nextTrackBtn = null;
let trackNameSprite = null;

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

// Track name update interval (refreshes the display while settings is open)
let _trackUpdateInterval = null;

function startTrackDisplayUpdate() {
  stopTrackDisplayUpdate();
  _trackUpdateInterval = setInterval(() => {
    if (trackNameSprite && settingsGroup.visible) {
      const info = getPlaylistInfo();
      const displayName = info.name.length > 28 ? info.name.substring(0, 25) + '...' : info.name;
      updateSpriteText(trackNameSprite, displayName, {
        fontSize: 22,
        color: trackNameColor,
        scale: 0.08,
        renderOrder: SETTINGS_RENDER_ORDER + 1,
      });
    }
  }, 1000);
}

function stopTrackDisplayUpdate() {
  if (_trackUpdateInterval) {
    clearInterval(_trackUpdateInterval);
    _trackUpdateInterval = null;
  }
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
async function buildSettingsPanel() {
  disposeGroupChildren(settingsGroup);

  const layout = await ensureSettingsLayout();

  const musicVol = getMusicVolume();
  const sfxVol = getSFXVolume();

  // ── Panel background ──
  const panelEl = le(layout, 'panel', { x: 0, y: 0, z: 0, w: 3.2, h: 2.6, color: 0x0a0015 });
  const panelGeo = new THREE.PlaneGeometry(panelEl.w, panelEl.h);
  const panelMesh = new THREE.Mesh(panelGeo, settingsMaterial(panelEl.color, 0.92));
  panelMesh.renderOrder = SETTINGS_RENDER_ORDER - 2;
  panelMesh.position.set(panelEl.x, panelEl.y, panelEl.z);
  settingsGroup.add(panelMesh);

  // Panel border (only if panel_border is visible)
  const borderEl = le(layout, 'panel_border', { x: 0, y: 0, z: 0.005, w: 3.2, h: 2.6, visible: false });
  if (borderEl.visible) {
    const borderGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(borderEl.w, borderEl.h));
    const border = new THREE.LineSegments(borderGeo, new THREE.LineBasicMaterial({
      color: 0x00ffff, depthTest: false, depthWrite: false
    }));
    border.renderOrder = SETTINGS_RENDER_ORDER - 1;
    border.position.set(borderEl.x, borderEl.y, borderEl.z);
    settingsGroup.add(border);
  }

  // ── Title ──
  const titleEl = le(layout, 'title', { x: 0, y: 0.75, z: 0.02, scale: 0.4, fontSize: 42, color: 0x00ffff });
  titleColor = '#' + (titleEl.color).toString(16).padStart(6, '0');
  const title = makeSprite('SETTINGS', {
    fontSize: titleEl.fontSize,
    color: titleColor,
    glow: true,
    glowColor: titleColor,
    scale: titleEl.scale,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  title.position.set(titleEl.x, titleEl.y, titleEl.z);
  settingsGroup.add(title);

  // ── Column positions (from layout labels) ──
  const musicLabelEl = le(layout, 'music_label', { x: -0.7, y: 0.44, z: 0.02, scale: 0.4 });
  const sfxLabelEl = le(layout, 'sfx_label', { x: 0.7, y: 0.44, z: 0.02, scale: 0.4 });
  const colX = musicLabelEl.x;
  const col2X = sfxLabelEl.x;

  // ── MUSIC label ──
  const musicLabelColor = '#' + (musicLabelEl.color || 0xaaaaff).toString(16).padStart(6, '0');
  const musicLabel = makeSprite('MUSIC', {
    fontSize: musicLabelEl.fontSize || SETTINGS_LABEL_FONT_SIZE,
    color: musicLabelColor,
    scale: musicLabelEl.scale,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  musicLabel.position.set(musicLabelEl.x, musicLabelEl.y, musicLabelEl.z);
  settingsGroup.add(musicLabel);

  // ── SFX label ──
  const sfxLabelColor = '#' + (sfxLabelEl.color || 0xaaaaff).toString(16).padStart(6, '0');
  const sfxLabel = makeSprite('SFX', {
    fontSize: sfxLabelEl.fontSize || SETTINGS_LABEL_FONT_SIZE,
    color: sfxLabelColor,
    scale: sfxLabelEl.scale,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  sfxLabel.position.set(sfxLabelEl.x, sfxLabelEl.y, sfxLabelEl.z);
  settingsGroup.add(sfxLabel);

  // ── Music UP button ──
  const mUpEl = le(layout, 'music_up', { x: colX, y: 0.18, z: 0.02, w: 1.0, h: 0.42, color: 0x00ffff });
  const mUp = makeBtn('▲', mUpEl.w, mUpEl.h, mUpEl.color || 0x00ffff, 56, 0.22);
  mUp.group.position.set(mUpEl.x, mUpEl.y, mUpEl.z);
  mUp.mesh.userData.isSettingsBtn = true;
  mUp.mesh.userData.settingsAction = 'musicUp';
  musicUpBtn = mUp.mesh;
  settingsGroup.add(mUp.group);
  // Apply layout to up text
  const mUpTextEl = le(layout, 'music_up_text', { x: colX, y: 0.18, z: 0.03, scale: 0.22 });
  if (mUp.group.children[2]) mUp.group.children[2].position.set(mUpTextEl.x, mUpTextEl.y, mUpTextEl.z);

  // ── Music volume display ──
  musicVolEl = le(layout, 'music_vol', { x: colX, y: -0.02, z: 0.02, scale: 0.32, fontSize: 38, color: 0xffffff });
  musicVolColor = '#' + (musicVolEl.color).toString(16).padStart(6, '0');
  musicVolSprite = makeSprite(`${musicVol}%`, {
    fontSize: musicVolEl.fontSize || SETTINGS_FONT_SIZE,
    color: musicVolColor,
    glow: true,
    glowColor: titleColor,
    scale: musicVolEl.scale,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  musicVolSprite.position.set(musicVolEl.x, musicVolEl.y, musicVolEl.z);
  settingsGroup.add(musicVolSprite);

  // ── Music DOWN button ──
  const mDownEl = le(layout, 'music_down', { x: colX, y: -0.26, z: 0.02, w: 1.0, h: 0.42, color: 0x00ffff });
  const mDown = makeBtn('▼', mDownEl.w, mDownEl.h, mDownEl.color || 0x00ffff, 56, 0.22);
  mDown.group.position.set(mDownEl.x, mDownEl.y, mDownEl.z);
  mDown.mesh.userData.isSettingsBtn = true;
  mDown.mesh.userData.settingsAction = 'musicDown';
  musicDownBtn = mDown.mesh;
  settingsGroup.add(mDown.group);
  const mDownTextEl = le(layout, 'music_down_text', { x: colX, y: -0.26, z: 0.03, scale: 0.22 });
  if (mDown.group.children[2]) mDown.group.children[2].position.set(mDownTextEl.x, mDownTextEl.y, mDownTextEl.z);

  // ── SFX UP button ──
  const sUpEl = le(layout, 'sfx_up', { x: col2X, y: 0.18, z: 0.02, w: 1.0, h: 0.42, color: 0x00ffff });
  const sUp = makeBtn('▲', sUpEl.w, sUpEl.h, sUpEl.color || 0x00ffff, 56, 0.22);
  sUp.group.position.set(sUpEl.x, sUpEl.y, sUpEl.z);
  sUp.mesh.userData.isSettingsBtn = true;
  sUp.mesh.userData.settingsAction = 'sfxUp';
  sfxUpBtn = sUp.mesh;
  settingsGroup.add(sUp.group);
  const sUpTextEl = le(layout, 'sfx_up_text', { x: col2X, y: 0.18, z: 0.03, scale: 0.22 });
  if (sUp.group.children[2]) sUp.group.children[2].position.set(sUpTextEl.x, sUpTextEl.y, sUpTextEl.z);

  // ── SFX volume display ──
  const sfxVolElLocal = le(layout, 'sfx_vol', { x: col2X, y: -0.02, z: 0.02, scale: 0.32, fontSize: 38, color: 0xffffff });
  sfxVolEl = sfxVolElLocal;
  sfxVolColor = '#' + (sfxVolElLocal.color).toString(16).padStart(6, '0');
  sfxVolSprite = makeSprite(`${sfxVol}%`, {
    fontSize: sfxVolElLocal.fontSize || SETTINGS_FONT_SIZE,
    color: sfxVolColor,
    glow: true,
    glowColor: titleColor,
    scale: sfxVolElLocal.scale,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  sfxVolSprite.position.set(sfxVolEl.x, sfxVolEl.y, sfxVolEl.z);
  settingsGroup.add(sfxVolSprite);

  // ── SFX DOWN button ──
  const sDownEl = le(layout, 'sfx_down', { x: col2X, y: -0.26, z: 0.02, w: 1.0, h: 0.42, color: 0x00ffff });
  const sDown = makeBtn('▼', sDownEl.w, sDownEl.h, sDownEl.color || 0x00ffff, 56, 0.22);
  sDown.group.position.set(sDownEl.x, sDownEl.y, sDownEl.z);
  sDown.mesh.userData.isSettingsBtn = true;
  sDown.mesh.userData.settingsAction = 'sfxDown';
  sfxDownBtn = sDown.mesh;
  settingsGroup.add(sDown.group);
  const sDownTextEl = le(layout, 'sfx_down_text', { x: col2X, y: -0.26, z: 0.03, scale: 0.22 });
  if (sDown.group.children[2]) sDown.group.children[2].position.set(sDownTextEl.x, sDownTextEl.y, sDownTextEl.z);

  // ── Divider line ──
  const divEl = le(layout, 'divider', { x: 0, y: -0.08, z: 0.015, w: 0.02, h: 0.95, visible: false });
  if (divEl.visible) {
    const divGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(divEl.x, divEl.y + divEl.h / 2, divEl.z),
      new THREE.Vector3(divEl.x, divEl.y - divEl.h / 2, divEl.z),
    ]);
    const divider = new THREE.Line(divGeo, new THREE.LineBasicMaterial({
      color: 0x00ffff, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false
    }));
    divider.renderOrder = SETTINGS_RENDER_ORDER;
    settingsGroup.add(divider);
  }

  // ── Track Player Section ──
  const trackLabelEl = le(layout, 'track_label', { x: 0, y: 0.12, z: 0.06, scale: 0.3, fontSize: 22, color: 0x666699 });
  const trackLabelColor = '#' + (trackLabelEl.color).toString(16).padStart(6, '0');
  const trackLabel = makeSprite('NOW PLAYING', {
    fontSize: trackLabelEl.fontSize || 22,
    color: trackLabelColor,
    scale: trackLabelEl.scale,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  trackLabel.position.set(trackLabelEl.x, trackLabelEl.y, trackLabelEl.z);
  settingsGroup.add(trackLabel);

  // Track name display
  const trackNameEl = le(layout, 'track_name', { x: 0, y: 0, z: 0.08, scale: 0.3, fontSize: 36, color: 0xaaaaff });
  trackNameColor = '#' + (trackNameEl.color).toString(16).padStart(6, '0');
  const trackInfo = getPlaylistInfo();
  const displayName = trackInfo.name.length > 28 ? trackInfo.name.substring(0, 25) + '...' : trackInfo.name;
  trackNameSprite = makeSprite(displayName, {
    fontSize: trackNameEl.fontSize || 36,
    color: trackNameColor,
    scale: trackNameEl.scale,
    renderOrder: SETTINGS_RENDER_ORDER + 1,
  });
  trackNameSprite.position.set(trackNameEl.x, trackNameEl.y, trackNameEl.z);
  settingsGroup.add(trackNameSprite);

  // PREV button
  const prevEl = le(layout, 'prev_btn', { x: -0.3, y: -0.26, z: 0.06, w: 0.9, h: 0.25, color: 0x00ffff });
  const prevBtn = makeBtn('◀ PREV', prevEl.w, prevEl.h, prevEl.color || 0x00ffff, 36, 0.12);
  prevBtn.group.position.set(prevEl.x, prevEl.y, prevEl.z);
  prevBtn.mesh.userData.isSettingsBtn = true;
  prevBtn.mesh.userData.settingsAction = 'prevTrack';
  prevTrackBtn = prevBtn.mesh;
  settingsGroup.add(prevBtn.group);
  const prevTextEl = le(layout, 'prev_text', { x: -0.3, y: -0.26, z: 0.08, scale: 0.12 });
  if (prevBtn.group.children[2]) prevBtn.group.children[2].position.set(prevTextEl.x, prevTextEl.y, prevTextEl.z);

  // NEXT button
  const nextEl = le(layout, 'next_btn', { x: 0.3, y: -0.26, z: 0.06, w: 0.9, h: 0.25, color: 0x00ffff });
  const nextBtn = makeBtn('NEXT ▶', nextEl.w, nextEl.h, nextEl.color || 0x00ffff, 36, 0.12);
  nextBtn.group.position.set(nextEl.x, nextEl.y, nextEl.z);
  nextBtn.mesh.userData.isSettingsBtn = true;
  nextBtn.mesh.userData.settingsAction = 'nextTrack';
  nextTrackBtn = nextBtn.mesh;
  settingsGroup.add(nextBtn.group);
  const nextTextEl = le(layout, 'next_text', { x: 0.3, y: -0.26, z: 0.08, scale: 0.12 });
  if (nextBtn.group.children[2]) nextBtn.group.children[2].position.set(nextTextEl.x, nextTextEl.y, nextTextEl.z);

  // ── BACK button ──
  const backEl = le(layout, 'back_btn', { x: 0, y: -0.7, z: 0.02, w: 1.2, h: 0.3, color: 0x997700 });
  const back = makeBtn('BACK', backEl.w, backEl.h, backEl.color || 0x997700, 38, 0.12);
  back.group.position.set(backEl.x, backEl.y, backEl.z);
  back.mesh.userData.isSettingsBtn = true;
  back.mesh.userData.settingsAction = 'back';
  backBtn = back.mesh;
  settingsGroup.add(back.group);
  const backTextEl = le(layout, 'back_text', { x: 0, y: -0.712, z: 0.04, scale: 0.12 });
  if (back.group.children[2]) back.group.children[2].position.set(backTextEl.x, backTextEl.y, backTextEl.z);

  // ── Decorative border rects from layout ──
  // Render the custom border rects (top/bottom/left/right) if present
  const borderRects = ['custom_rect_2', 'dup_3_custom_rect_2', 'dup_4_custom_rect_2', 'dup_5_dup_4_custom_rect_2'];
  borderRects.forEach(key => {
    const rectEl = le(layout, key, { x: 0, y: 0, z: 0, w: 3.2, h: 0.05, color: 65535, visible: true });
    if (rectEl.visible) {
      const rectGeo = new THREE.PlaneGeometry(rectEl.w, rectEl.h);
      const rectMat = new THREE.MeshBasicMaterial({
        color: rectEl.color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      });
      const rectMesh = new THREE.Mesh(rectGeo, rectMat);
      rectMesh.renderOrder = SETTINGS_RENDER_ORDER - 1;
      rectMesh.position.set(rectEl.x, rectEl.y, rectEl.z);
      settingsGroup.add(rectMesh);
    }
  });

  // ── Decorative music icon ──
  const musicIconEl = le(layout, 'dup_1_track_label', { x: 0, y: 0.21, z: 0.06, visible: true, scale: 0.4, fontSize: 22 });
  if (musicIconEl.visible) {
    const musicIconColor = '#' + (musicIconEl.color || 0x666699).toString(16).padStart(6, '0');
    const musicIcon = makeSprite('♬', {
      fontSize: musicIconEl.fontSize || 22,
      color: musicIconColor,
      scale: musicIconEl.scale,
      renderOrder: SETTINGS_RENDER_ORDER + 1,
    });
    musicIcon.position.set(musicIconEl.x, musicIconEl.y, musicIconEl.z);
    settingsGroup.add(musicIcon);
  }
}

/**
 * Show settings panel. `from` is 'title' or 'pause'.
 */
export async function showSettings(from) {
  previousMenu = from;
  _lastSettingsHovered = null;
  await buildSettingsPanel();

  if (from === 'pause' && pauseMenuGroup) {
    // Copy pause menu position/rotation so settings appear at same spot
    settingsGroup.position.copy(pauseMenuGroup.position);
    settingsGroup.rotation.copy(pauseMenuGroup.rotation);
    settingsGroup.scale.copy(pauseMenuGroup.scale);
    // Hide pause menu while settings is open
    pauseMenuGroup.visible = false;
  } else {
    // Position at title screen location
    settingsGroup.position.set(0, 1.2, -3.5);
    settingsGroup.rotation.set(0, 0, 0);
    settingsGroup.scale.setScalar(1);
    // Hide title screen content (same pattern as scoreboard)
    hideTitle();
  }

  settingsGroup.visible = true;
  startTrackDisplayUpdate();
}

export function hideSettings() {
  settingsGroup.visible = false;
  stopTrackDisplayUpdate();
  disposeGroupChildren(settingsGroup);
  musicVolSprite = null;
  sfxVolSprite = null;
  musicUpBtn = null;
  musicDownBtn = null;
  sfxUpBtn = null;
  sfxDownBtn = null;
  backBtn = null;
  prevTrackBtn = null;
  nextTrackBtn = null;
  trackNameSprite = null;
  _lastSettingsHovered = null;
  musicVolEl = null;
  sfxVolEl = null;
  musicVolColor = '#ffffff';
  sfxVolColor = '#ffffff';
  titleColor = '#00ffff';
  trackNameColor = '#aaaaff';

  // Restore pause menu if we came from it
  if (previousMenu === 'pause' && pauseMenuGroup) {
    pauseMenuGroup.visible = true;
  }
  // Restore title screen if we came from it
  if (previousMenu === 'title') {
    showTitle();
  }
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
  const buttonMeshes = [musicUpBtn, musicDownBtn, sfxUpBtn, sfxDownBtn, prevTrackBtn, nextTrackBtn, backBtn].filter(Boolean);
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

  const buttonMeshes = [musicUpBtn, musicDownBtn, sfxUpBtn, sfxDownBtn, prevTrackBtn, nextTrackBtn, backBtn].filter(Boolean);
  if (buttonMeshes.length === 0) return;

  const intersects = raycaster.intersectObjects(buttonMeshes, false);
  const hoveredMesh = intersects.length > 0 ? intersects[0].object : null;

  // Play hover sound on new hover
  if (hoveredMesh && hoveredMesh !== _lastSettingsHovered) {
    playMenuHoverSound();
  }
  _lastSettingsHovered = hoveredMesh;

  buttonMeshes.forEach(btn => {
    const group = btn.parent;
    if (!group) return;
    const border = group.children.find(c => c instanceof THREE.LineSegments);
    if (!border || !border.material) return;

    const isHovered = btn === hoveredMesh;
    const isBack = btn.userData.settingsAction === 'back';
    const baseColor = isBack ? 0x997700 : 0x006666; // Muted when not hovered
    const hoverColor = isBack ? 0xffff00 : 0x00ffff; // Bright when hovered
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
      if (musicVolSprite) updateSpriteText(musicVolSprite, `${vol}%`, { fontSize: musicVolEl?.fontSize || SETTINGS_FONT_SIZE, color: musicVolColor || '#ffffff', glow: true, glowColor: titleColor || '#00ffff', scale: musicVolEl?.scale || 0.3 });
      return false;
    }
    case 'musicDown': {
      const vol = setMusicVolume(getMusicVolume() - 5);
      if (musicVolSprite) updateSpriteText(musicVolSprite, `${vol}%`, { fontSize: musicVolEl?.fontSize || SETTINGS_FONT_SIZE, color: musicVolColor || '#ffffff', glow: true, glowColor: titleColor || '#00ffff', scale: musicVolEl?.scale || 0.3 });
      return false;
    }
    case 'sfxUp': {
      const vol = setSFXVolume(getSFXVolume() + 5);
      if (sfxVolSprite) updateSpriteText(sfxVolSprite, `${vol}%`, { fontSize: sfxVolEl?.fontSize || SETTINGS_FONT_SIZE, color: sfxVolColor || '#ffffff', glow: true, glowColor: titleColor || '#00ffff', scale: sfxVolEl?.scale || 0.3 });
      return false;
    }
    case 'sfxDown': {
      const vol = setSFXVolume(getSFXVolume() - 5);
      if (sfxVolSprite) updateSpriteText(sfxVolSprite, `${vol}%`, { fontSize: sfxVolEl?.fontSize || SETTINGS_FONT_SIZE, color: sfxVolColor || '#ffffff', glow: true, glowColor: titleColor || '#00ffff', scale: sfxVolEl?.scale || 0.3 });
      return false;
    }
    case 'back':
      return true;
    case 'prevTrack': {
      skipToPrevTrack();
      if (trackNameSprite) {
        const info = getPlaylistInfo();
        const dn = info.name.length > 28 ? info.name.substring(0, 25) + '...' : info.name;
        updateSpriteText(trackNameSprite, dn, {
          fontSize: 22, color: trackNameColor, scale: 0.08, renderOrder: SETTINGS_RENDER_ORDER + 1,
        });
      }
      return false;
    }
    case 'nextTrack': {
      skipToNextTrack();
      if (trackNameSprite) {
        const info = getPlaylistInfo();
        const dn = info.name.length > 28 ? info.name.substring(0, 25) + '...' : info.name;
        updateSpriteText(trackNameSprite, dn, {
          fontSize: 22, color: trackNameColor, scale: 0.08, renderOrder: SETTINGS_RENDER_ORDER + 1,
        });
      }
      return false;
    }
    default:
      return false;
  }
}
