import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

import { levelMeta as synthMeta, loadLevel as loadSynthwave } from '../levels/synthwavePlanet.js';
import { levelMeta as desertMeta, loadLevel as loadDesert } from '../levels/desertPlanet.js';
import { levelMeta as oozeMeta, loadLevel as loadOoze } from '../levels/oozePlanet.js';
import { levelMeta as hellMeta, loadLevel as loadHellscape } from '../levels/hellscapePlanet.js';

const QUALITY = 'high';
const LEVELS = [
  { meta: synthMeta, loader: loadSynthwave },
  { meta: desertMeta, loader: loadDesert },
  { meta: oozeMeta, loader: loadOoze },
  { meta: hellMeta, loader: loadHellscape }
];
const TEMP_ARRAYS = new Map();
const keyState = Object.create(null);
const urlParams = new URLSearchParams(window.location.search);
const initialLevelIndex = resolveInitialLevelIndex(urlParams.get('level'));
const initialShotMode = resolveInitialShot(urlParams.get('shot'));
const hideUi = urlParams.get('ui') === '0' || urlParams.get('overlay') === '0';

let renderer;
let scene;
let camera;
let controls;
let currentLevelIndex = -1;
let currentLevelHandle = null;
let currentShotMode = 'reset';
let statsVisible = true;
let bannerTimeout = null;
let clearanceVisible = false;
let lastFrameTime = performance.now();
let statsTimer = 0;

const dom = {
  app: document.getElementById('app'),
  levelName: document.getElementById('level-name'),
  levelSubtitle: document.getElementById('level-subtitle'),
  statsPanel: document.getElementById('stats-panel'),
  rightPanel: document.getElementById('right-panel'),
  banner: document.getElementById('banner'),
  prevLevel: document.getElementById('prev-level'),
  nextLevel: document.getElementById('next-level'),
  heroShot: document.getElementById('hero-shot'),
  gameplayShot: document.getElementById('gameplay-shot'),
  resetShot: document.getElementById('reset-shot')
};

init();

function init() {
  if (hideUi) {
    document.getElementById('overlay')?.classList.add('hidden');
    document.getElementById('banner')?.classList.add('hidden');
  }
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 220);
  camera.position.set(0, 1.6, 2.5);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.sortObjects = true;
  dom.app.appendChild(renderer.domElement);

  controls = new PointerLockControls(camera, renderer.domElement);
  renderer.domElement.addEventListener('click', () => {
    if (!controls.isLocked) controls.lock();
  });

  wireDom();
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  loadLevelByIndex(initialLevelIndex);
  renderer.setAnimationLoop(render);
}

function wireDom() {
  dom.prevLevel.addEventListener('click', () => changeLevel(-1));
  dom.nextLevel.addEventListener('click', () => changeLevel(1));
  dom.heroShot.addEventListener('click', () => applyShot('hero'));
  dom.gameplayShot.addEventListener('click', () => applyShot('gameplay'));
  dom.resetShot.addEventListener('click', () => applyShot('reset'));
}

function showBanner(message, sticky = false) {
  dom.banner.textContent = message;
  dom.banner.classList.add('visible');
  if (bannerTimeout) clearTimeout(bannerTimeout);
  if (!sticky) {
    bannerTimeout = window.setTimeout(() => {
      dom.banner.classList.remove('visible');
    }, 2200);
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
  keyState[event.code] = true;

  if (event.code === 'KeyF') {
    statsVisible = !statsVisible;
    dom.rightPanel.classList.toggle('hidden', !statsVisible);
  } else if (event.code === 'KeyC') {
    clearanceVisible = !clearanceVisible;
    if (currentLevelHandle?.debug?.clearanceOverlay) {
      currentLevelHandle.debug.clearanceOverlay.visible = clearanceVisible;
    }
  } else if (event.code === 'KeyR') {
    applyShot('reset');
  } else if (event.code === 'KeyN') {
    changeLevel(1);
  } else if (event.code === 'KeyP') {
    changeLevel(-1);
  } else if (event.code === 'Digit1') {
    loadLevelByIndex(0);
  } else if (event.code === 'Digit2') {
    loadLevelByIndex(1);
  } else if (event.code === 'Digit3') {
    loadLevelByIndex(2);
  } else if (event.code === 'Digit4') {
    loadLevelByIndex(3);
  }
}

function onKeyUp(event) {
  keyState[event.code] = false;
}

function changeLevel(delta) {
  const next = (currentLevelIndex + delta + LEVELS.length) % LEVELS.length;
  loadLevelByIndex(next);
}

async function loadLevelByIndex(index) {
  if (index === currentLevelIndex && currentLevelHandle) return;

  const entry = LEVELS[index];
  if (!entry) return;

  dom.prevLevel.disabled = true;
  dom.nextLevel.disabled = true;
  showBanner(`Loading ${entry.meta.name}...`, true);

  await disposeCurrentLevel();

  const tracker = createResourceTracker();
  const fadeMaterials = [];
  const ctx = {
    scene,
    renderer,
    assetBaseUrl: new URL('../assets/', import.meta.url).href,
    quality: QUALITY,
    rng: createSeededRng(hashString(entry.meta.id)),
    temps: createTempPool(),
    resourceTracker: tracker,
    registerFadeMaterial(material, options = {}) {
      fadeMaterials.push({ material, options });
      return material;
    }
  };

  const loaded = await entry.loader(ctx);
  currentLevelHandle = {
    ...loaded,
    debug: loaded.debug || {},
    fadeMaterials,
    tracker,
    fallbackActive: Boolean(loaded.fallbackActive)
  };
  currentLevelIndex = index;

  scene.background = new THREE.Color(loaded.sceneOptions.background);
  scene.fog = loaded.sceneOptions.fog;
  scene.add(loaded.root);

  if (currentLevelHandle.debug.clearanceOverlay) {
    currentLevelHandle.debug.clearanceOverlay.visible = clearanceVisible;
  }

  applyShot(initialShotMode || 'reset');

  if (typeof renderer.compileAsync === 'function') {
    await renderer.compileAsync(scene, camera);
  } else {
    renderer.compile(scene, camera);
  }

  dom.levelName.textContent = entry.meta.name;
  dom.levelSubtitle.textContent = `${entry.meta.id} • ${entry.meta.dominantColors.join(' ')} • ${entry.meta.targetBudgets}`;
  updateStatsPanel(true);
  dom.prevLevel.disabled = false;
  dom.nextLevel.disabled = false;
  showBanner(`${entry.meta.name} ready`);
}

async function disposeCurrentLevel() {
  if (!currentLevelHandle) return;

  try {
    if (typeof currentLevelHandle.dispose === 'function') {
      await currentLevelHandle.dispose();
    }
  } finally {
    if (currentLevelHandle.root?.parent === scene) {
      scene.remove(currentLevelHandle.root);
    }
    currentLevelHandle.tracker.disposeAll();
    currentLevelHandle = null;
  }
}

function applyShot(mode) {
  if (!currentLevelHandle) return;

  const { sceneOptions } = currentLevelHandle;
  let shot = null;

  if (mode === 'hero') {
    shot = sceneOptions.heroShot;
    currentShotMode = 'hero';
  } else if (mode === 'gameplay') {
    shot = sceneOptions.gameplayShot;
    currentShotMode = 'gameplay';
  } else {
    shot = {
      position: sceneOptions.cameraStart,
      target: sceneOptions.cameraLookAt,
      fov: 70
    };
    currentShotMode = 'reset';
  }

  camera.position.set(shot.position[0], shot.position[1], shot.position[2]);
  camera.fov = shot.fov || 70;
  camera.updateProjectionMatrix();
  camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
}

function render() {
  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 1 / 20);
  lastFrameTime = now;

  updateCamera(dt);
  if (currentLevelHandle?.update) {
    currentLevelHandle.update(dt, now * 0.001);
  }

  renderer.render(scene, camera);
  statsTimer += dt;
  if (statsTimer >= 0.25) {
    updateStatsPanel();
    statsTimer = 0;
  }
}

function updateCamera(dt) {
  if (!controls.isLocked) return;

  const boost = keyState.ShiftLeft || keyState.ShiftRight;
  const speed = boost ? 18 : 8;
  const moveAmount = speed * dt;
  const forward = getTempVector(0);
  const right = getTempVector(1);
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();

  if (keyState.KeyW) camera.position.addScaledVector(forward, moveAmount);
  if (keyState.KeyS) camera.position.addScaledVector(forward, -moveAmount);
  if (keyState.KeyA) camera.position.addScaledVector(right, -moveAmount);
  if (keyState.KeyD) camera.position.addScaledVector(right, moveAmount);
  if (keyState.KeyE) camera.position.y += moveAmount;
  if (keyState.KeyQ) camera.position.y -= moveAmount;
}

function updateStatsPanel(force = false) {
  if (!statsVisible && !force) return;
  const info = renderer.info;
  const fallback = currentLevelHandle?.fallbackActive ? 'Fallback active' : 'Primary path';
  const levelId = currentLevelIndex >= 0 ? LEVELS[currentLevelIndex].meta.id : 'none';
  dom.statsPanel.innerHTML = [
    statRow('Biome', levelId),
    statRow('Quality', QUALITY),
    statRow('Shot', currentShotMode),
    statRow('Assets', fallback),
    statRow('Draw Calls', String(info.render.calls)),
    statRow('Triangles', formatNumber(info.render.triangles)),
    statRow('Points', formatNumber(info.render.points)),
    statRow('Lines', formatNumber(info.render.lines)),
    statRow('Geometries', String(info.memory.geometries)),
    statRow('Textures', String(info.memory.textures))
  ].join('');
}

function statRow(label, value) {
  return `<div class="stats-row"><span>${label}</span><span>${value}</span></div>`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed) {
  let state = seed >>> 0;
  return {
    get seed() {
      return state;
    },
    float() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    },
    range(min, max) {
      return min + (max - min) * this.float();
    },
    int(min, maxInclusive) {
      return Math.floor(this.range(min, maxInclusive + 1));
    },
    bool(probability = 0.5) {
      return this.float() < probability;
    },
    pick(items) {
      return items[this.int(0, items.length - 1)];
    },
    reset(nextSeed = seed) {
      state = nextSeed >>> 0;
    }
  };
}

function createTempPool() {
  const vectors = Array.from({ length: 32 }, () => new THREE.Vector3());
  const quaternions = Array.from({ length: 8 }, () => new THREE.Quaternion());
  const colors = Array.from({ length: 16 }, () => new THREE.Color());
  const matrices = Array.from({ length: 32 }, () => new THREE.Matrix4());

  return {
    v3(slot) {
      return vectors[slot];
    },
    q(slot) {
      return quaternions[slot];
    },
    c(slot) {
      return colors[slot];
    },
    m4(slot) {
      return matrices[slot];
    },
    arr(slot, length) {
      const key = `${slot}:${length}`;
      if (!TEMP_ARRAYS.has(key)) {
        TEMP_ARRAYS.set(key, new Float32Array(length));
      }
      return TEMP_ARRAYS.get(key);
    }
  };
}

function createResourceTracker() {
  const resources = new Set();
  return {
    track(resource) {
      if (resource) resources.add(resource);
      return resource;
    },
    trackObject(object) {
      return this.track(object);
    },
    trackGeometry(geometry) {
      return this.track(geometry);
    },
    trackMaterial(material) {
      return this.track(material);
    },
    trackTexture(texture) {
      return this.track(texture);
    },
    trackGLTF(root) {
      root.traverse((child) => {
        if (child.geometry) resources.add(child.geometry);
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((mat) => resources.add(mat));
          else resources.add(child.material);
        }
      });
      return this.track(root);
    },
    untrack(resource) {
      resources.delete(resource);
      return resource;
    },
    counts() {
      let objects = 0;
      let geometries = 0;
      let materials = 0;
      let textures = 0;
      resources.forEach((resource) => {
        if (resource instanceof THREE.Object3D) objects += 1;
        else if (resource instanceof THREE.BufferGeometry) geometries += 1;
        else if (resource instanceof THREE.Material) materials += 1;
        else if (resource instanceof THREE.Texture) textures += 1;
      });
      return { objects, geometries, materials, textures };
    },
    disposeAll() {
      resources.forEach((resource) => {
        if (resource instanceof THREE.Object3D && resource.parent) {
          resource.parent.remove(resource);
        } else if (resource instanceof HTMLVideoElement) {
          resource.pause();
          resource.removeAttribute('src');
          resource.load();
        } else if (resource && typeof resource.dispose === 'function') {
          resource.dispose();
        }
      });
      resources.clear();
    },
    clear() {
      resources.clear();
    }
  };
}

function getTempVector(slot) {
  if (!getTempVector.cache) {
    getTempVector.cache = Array.from({ length: 8 }, () => new THREE.Vector3());
  }
  return getTempVector.cache[slot];
}

function resolveInitialLevelIndex(rawLevel) {
  if (!rawLevel) return 0;
  const lower = rawLevel.toLowerCase();
  const byId = LEVELS.findIndex((entry) => entry.meta.id === lower);
  if (byId >= 0) return byId;
  const byName = LEVELS.findIndex((entry) => entry.meta.name.toLowerCase() === lower);
  if (byName >= 0) return byName;
  const asNumber = Number(rawLevel);
  if (Number.isFinite(asNumber)) {
    return THREE.MathUtils.clamp(Math.floor(asNumber), 0, LEVELS.length - 1);
  }
  return 0;
}

function resolveInitialShot(rawShot) {
  if (rawShot === 'hero' || rawShot === 'gameplay' || rawShot === 'reset') {
    return rawShot;
  }
  return 'reset';
}
