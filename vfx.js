// ============================================================
//  VFX — Voxel Death Explosions, Sparks, Projectile Trails
// ============================================================

import * as THREE from 'three';

// ── Constants ─────────────────────────────────────────────
const VOXEL_POOL_SIZE = 200;
const SPARK_POOL_SIZE = 100;
const GRAVITY = -9.8;

// ── Module State ───────────────────────────────────────────
let sceneRef = null;
const sharedVoxelGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
let voxelPool = [];
let sparkPool = [];
let activeVoxels = [];
let activeSparks = [];
let activeShockwaves = [];

// ── Initialization ─────────────────────────────────────────
export function initVFX(scene) {
  sceneRef = scene;

  // Voxel pool
  for (let i = 0; i < VOXEL_POOL_SIZE; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(sharedVoxelGeo, mat);
    mesh.visible = false;
    scene.add(mesh);
    voxelPool.push({
      mesh,
      velocity: new THREE.Vector3(),
      angularVel: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
      grounded: false,
      groundTimer: 0,
    });
  }

  // Spark sprite pool
  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.width = 8;
  sparkCanvas.height = 8;
  const sCtx = sparkCanvas.getContext('2d');
  sCtx.fillStyle = '#ffaa44';
  sCtx.beginPath();
  sCtx.arc(4, 4, 4, 0, Math.PI * 2);
  sCtx.fill();
  const sparkTex = new THREE.CanvasTexture(sparkCanvas);

  for (let i = 0; i < SPARK_POOL_SIZE; i++) {
    const mat = new THREE.SpriteMaterial({
      map: sparkTex,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.scale.set(0.05, 0.05, 1);
    scene.add(sprite);
    sparkPool.push({
      sprite,
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
    });
  }

  console.log('[vfx] Initialized voxel pool (200) and spark pool (100)');
}

// ── Voxel Explosions ─────────────────────────────────────
export function spawnVoxelExplosion(center, color, voxelCount = 6) {
  for (let i = 0; i < voxelCount; i++) {
    const v = voxelPool.find(v => !v.mesh.visible);
    if (!v) break;

    v.mesh.visible = true;
    v.mesh.material.color.setHex(color);
    v.mesh.position.copy(center);
    v.mesh.position.x += (Math.random() - 0.5) * 0.5;
    v.mesh.position.y += (Math.random() - 0.5) * 0.5;
    v.mesh.position.z += (Math.random() - 0.5) * 0.5;
    v.mesh.scale.setScalar(1);

    v.velocity.set(
      (Math.random() - 0.5) * 6,
      Math.random() * 4 + 2,
      (Math.random() - 0.5) * 6,
    );
    v.angularVel.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
    );
    v.life = 0;
    v.maxLife = 2.0 + Math.random();
    v.grounded = false;
    v.groundTimer = 0;
    activeVoxels.push(v);
  }
}

// ── Sparks ─────────────────────────────────────────────────
function spawnSparks(position, count) {
  for (let i = 0; i < count; i++) {
    const s = sparkPool.find(s => !s.sprite.visible);
    if (!s) break;

    s.sprite.visible = true;
    s.sprite.position.copy(position);
    s.sprite.material.opacity = 1;
    s.velocity.set(
      (Math.random() - 0.5) * 3,
      Math.random() * 3 + 1,
      (Math.random() - 0.5) * 3
    );
    s.life = 0;
    s.maxLife = 0.3 + Math.random() * 0.3;
    activeSparks.push(s);
  }
}

// ── Shockwave (for charge shot) ───────────────────────────
export function spawnShockwave(position, direction, progress) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.05, 8, 24),
    new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  ring.position.copy(position);
  ring.lookAt(position.clone().add(direction));
  ring.userData = {
    life: 0,
    maxLife: 0.3,
    expandRate: 8 + progress * 12,
  };
  sceneRef.add(ring);
  activeShockwaves.push(ring);
}

// ── Update Loop ────────────────────────────────────────────
export function updateVFX(dt) {
  // Voxels
  for (let i = activeVoxels.length - 1; i >= 0; i--) {
    const v = activeVoxels[i];
    v.life += dt;

    if (v.life > v.maxLife) {
      v.mesh.visible = false;
      v.mesh.scale.setScalar(1);
      activeVoxels.splice(i, 1);
      continue;
    }

    if (!v.grounded) {
      // Falling phase
      v.velocity.y += GRAVITY * dt;
      v.mesh.position.addScaledVector(v.velocity, dt);
      v.mesh.rotation.x += v.angularVel.x * dt;
      v.mesh.rotation.y += v.angularVel.y * dt;
      v.mesh.rotation.z += v.angularVel.z * dt;

      // Check ground collision
      if (v.mesh.position.y <= 0.1) {
        v.mesh.position.y = 0.1;
        v.grounded = true;
        v.groundTimer = 0;
        spawnSparks(v.mesh.position, 3);
      }
    } else {
      // Grounded burning phase
      v.groundTimer += dt;
      const burnT = v.groundTimer / 0.8;
      v.mesh.scale.setScalar(Math.max(0, 1 - burnT));

      // Shift to orange/red color
      v.mesh.material.color.lerp(new THREE.Color(0xff4400), dt * 3);

      // Spawn occasional sparks
      if (Math.random() < dt * 5) {
        spawnSparks(v.mesh.position, 1);
      }

      if (burnT >= 1) {
        v.mesh.visible = false;
        v.mesh.scale.setScalar(1);
        activeVoxels.splice(i, 1);
      }
    }
  }

  // Sparks
  for (let i = activeSparks.length - 1; i >= 0; i--) {
    const s = activeSparks[i];
    s.life += dt;

    if (s.life > s.maxLife) {
      s.sprite.visible = false;
      activeSparks.splice(i, 1);
      continue;
    }

    s.sprite.position.addScaledVector(s.velocity, dt);
    s.velocity.y += GRAVITY * 0.5 * dt;

    const t = s.life / s.maxLife;
    s.sprite.material.opacity = 1 - t;
    s.sprite.scale.setScalar(0.05 * (1 - t * 0.5));
  }

  // Shockwaves
  for (let i = activeShockwaves.length - 1; i >= 0; i--) {
    const ring = activeShockwaves[i];
    ring.userData.life += dt;

    if (ring.userData.life > ring.userData.maxLife) {
      sceneRef.remove(ring);
      activeShockwaves.splice(i, 1);
      continue;
    }

    const t = ring.userData.life / ring.userData.maxLife;
    const scale = 1 + t * ring.userData.expandRate * 0.3;
    ring.scale.setScalar(scale);
    ring.material.opacity = 0.6 * (1 - t);
  }
}
