// ============================================================
//  DREAM WORLD — Secret mini-dungeon module
// ============================================================

import * as THREE from 'three';
import { spawnEnemy, getEnemies } from './enemies.js';

const DREAM_SIZE = 30;
const TORCH_TRIGGER_DIST = 1.6;

let dreamGroup = null;
let torches = [];
let chestGroup = null;
let chestLid = null;
let slimesSpawned = false;
let bossSpawned = false;
let bossDefeated = false;
let chestOpen = false;

const dreamSpawn = new THREE.Vector3(0, 1.6, 10);
const chestPos = new THREE.Vector3(0, 0, -10);

const dreamConfig = {
  hpMultiplier: 1.1,
  speedMultiplier: 1.0,
  spawnInterval: 999,
  enemyTypes: [],
};

function buildRoom() {
  const group = new THREE.Group();
  group.name = 'dream-world';

  const floorGeo = new THREE.PlaneGeometry(DREAM_SIZE, DREAM_SIZE);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  group.add(floor);

  const wallMat = new THREE.MeshBasicMaterial({ color: 0x3a3a3a });
  const wallThickness = 1;
  const wallHeight = 6;

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(DREAM_SIZE, wallHeight, wallThickness), wallMat);
  backWall.position.set(0, wallHeight / 2, -DREAM_SIZE / 2);
  group.add(backWall);

  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(DREAM_SIZE, wallHeight, wallThickness), wallMat);
  frontWall.position.set(0, wallHeight / 2, DREAM_SIZE / 2);
  group.add(frontWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, DREAM_SIZE), wallMat);
  leftWall.position.set(-DREAM_SIZE / 2, wallHeight / 2, 0);
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, DREAM_SIZE), wallMat);
  rightWall.position.set(DREAM_SIZE / 2, wallHeight / 2, 0);
  group.add(rightWall);

  return group;
}

function buildTorch(position) {
  const torchGroup = new THREE.Group();
  torchGroup.position.copy(position);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 0.6, 6),
    new THREE.MeshBasicMaterial({ color: 0x331100 })
  );
  base.position.y = 0.3;
  torchGroup.add(base);

  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0x222222 })
  );
  flame.position.y = 0.8;
  torchGroup.add(flame);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffaa55,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.position.y = 0.8;
  torchGroup.add(glow);

  return {
    group: torchGroup,
    flame,
    glow,
    lit: false,
  };
}

function buildChest() {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshBasicMaterial({ color: 0x553311 });
  const lidMat = new THREE.MeshBasicMaterial({ color: 0x775522 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.0), baseMat);
  base.position.y = 0.35;
  group.add(base);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 1.0), lidMat);
  lid.position.y = 0.85;
  lid.position.z = -0.05;
  group.add(lid);

  return { group, lid };
}

function lightTorch(torch) {
  if (torch.lit) return;
  torch.lit = true;
  torch.flame.material.color.setHex(0xff8844);
  torch.glow.material.opacity = 0.45;
}

function resetTorches() {
  torches.forEach(torch => {
    torch.lit = false;
    torch.flame.material.color.setHex(0x222222);
    torch.glow.material.opacity = 0.0;
  });
}

function openChest() {
  if (!chestLid) return;
  chestOpen = true;
  chestLid.rotation.x = -0.6;
}

export function getDreamFogSettings() {
  return { color: 0x000000, density: 0 };
}

export function getDreamSpawnPosition() {
  return dreamSpawn.clone();
}

export function initDreamWorld(scene) {
  if (dreamGroup) return;
  dreamGroup = buildRoom();

  const torchPositions = [
    new THREE.Vector3(-10, 0, -8),
    new THREE.Vector3(10, 0, -8),
    new THREE.Vector3(0, 0, 8),
  ];
  torches = torchPositions.map(pos => {
    const torch = buildTorch(pos);
    dreamGroup.add(torch.group);
    return torch;
  });

  const chest = buildChest();
  chestGroup = chest.group;
  chestLid = chest.lid;
  chestGroup.position.copy(chestPos);
  dreamGroup.add(chestGroup);

  dreamGroup.visible = false;
  scene.add(dreamGroup);
}

export function enterDreamWorld() {
  if (!dreamGroup) return;
  dreamGroup.visible = true;
  slimesSpawned = false;
  bossSpawned = false;
  bossDefeated = false;
  chestOpen = false;
  if (chestLid) chestLid.rotation.x = 0;
  resetTorches();
}

export function exitDreamWorld() {
  if (!dreamGroup) return;
  dreamGroup.visible = false;
}

export function handleDreamProjectileHit(projectile) {
  if (!dreamGroup || !dreamGroup.visible) return false;
  const hitRadius = 0.6;
  for (const torch of torches) {
    if (torch.lit) continue;
    const torchPos = torch.group.getWorldPosition(new THREE.Vector3());
    if (projectile.position.distanceTo(torchPos) <= hitRadius) {
      lightTorch(torch);
      return true;
    }
  }
  return false;
}

export function updateDreamWorld(now, dt, playerPos) {
  if (!dreamGroup || !dreamGroup.visible) return { exit: false };

  // Torch proximity lighting
  torches.forEach(torch => {
    if (torch.lit) return;
    const dist = torch.group.position.distanceTo(playerPos);
    if (dist <= TORCH_TRIGGER_DIST) {
      lightTorch(torch);
    }
  });

  const allLit = torches.every(t => t.lit);
  if (allLit && !slimesSpawned) {
    slimesSpawned = true;
    const slimePositions = [
      new THREE.Vector3(-6, 0, 0),
      new THREE.Vector3(6, 0, 0),
      new THREE.Vector3(0, 0, -4),
    ];
    slimePositions.forEach(pos => spawnEnemy('dream_slime', pos, dreamConfig));
  }

  if (slimesSpawned && !bossSpawned) {
    const slimesAlive = getEnemies().some(e => e.type === 'dream_slime');
    if (!slimesAlive) {
      bossSpawned = true;
      const boss = spawnEnemy('dream_eye', new THREE.Vector3(0, 0, -2), dreamConfig);
      if (boss && boss.mesh) {
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(1.4, 10, 10),
          new THREE.MeshBasicMaterial({
            color: 0xcc88ff,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        glow.userData.isDreamGlow = true;
        boss.mesh.add(glow);
      }
    }
  }

  if (bossSpawned && !bossDefeated) {
    const bossAlive = getEnemies().some(e => e.type === 'dream_eye');
    if (!bossAlive) {
      bossDefeated = true;
      openChest();
    }
  }

  if (chestOpen) {
    const chestWorld = chestGroup.getWorldPosition(new THREE.Vector3());
    if (playerPos.distanceTo(chestWorld) <= 2.0) {
      return { exit: true };
    }
  }

  return { exit: false };
}
