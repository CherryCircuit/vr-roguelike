// ============================================================
//  EVOLVED WEAPON SYSTEMS (Issue #143 — Phase C)
//  Firing functions + persistent update loops for the six
//  evolved weapons. Projectile-based evolutions (Twin Helix,
//  Dragon's Breath, Hive Mind) are dispatched from
//  main.js fireMainWeapon; beam/charge evolutions (Tesla Tower,
//  Singularity Launcher, Obliterator Beam) are driven by
//  intercepts in main.js's hold/release loops.
//  Follows the module pattern of beam-weapons.js: initEvolutions
//  captures the few cross-module deps; everything else is
//  imported directly (no cycles — nothing imports this module
//  except main.js).
// ============================================================

import * as THREE from 'three';
import { game } from './game.js';
import { spawnProjectile, startAccuracyShot, evolvedFxHooks, screenFx } from './projectile-system.js';
import { hitEnemy, applyEffects, getEnemies, getBoss, hitBoss } from './enemies.js';
import {
  playShoothSound, playBuckshotSound, playSeekerBurstSound,
  playChargeFireSound, playExplosionSound, playErrorSound, startLightningSound,
} from './audio.js';

// Per-hand cooldowns for evolved weapons (independent of the base weapon's
// weaponCooldowns[] in main.js — evolved cadences differ from base weapons).
const _evoCooldowns = [0, 0];

let _deps = {
  scene: null,
  enemySpatialHash: null,
  getController: () => null,
  spawnDamageNumber: () => {},
};

export function initEvolutions(deps) {
  _deps = { ..._deps, ...deps };
  // Dragon's Breath pellets call back into this module for trail drops
  evolvedFxHooks.onDragonsBreathTrail = (pos) => spawnFireTrail(pos);
}

// ── Shared helpers ─────────────────────────────────────────

// Enemies returned by the spatial hash are the same objects as getEnemies(),
// so indexOf gives the index hitEnemy() expects.
function _enemyIndex(enemy) {
  const list = getEnemies();
  return list.indexOf(enemy);
}

function _disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) { if (m && m.map) m.map.dispose(); if (m) m.dispose(); }
    }
  });
}

function _pointToSegmentDistSq(p, a, b) {
  const ab = _ptsdAb.subVectors(b, a);
  const ap = _ptsdAp.subVectors(p, a);
  const abLenSq = ab.lengthSq();
  if (abLenSq === 0) return ap.lengthSq();
  const t = THREE.MathUtils.clamp(ap.dot(ab) / abLenSq, 0, 1);
  return ap.clone().sub(ab.clone().multiplyScalar(t)).lengthSq();
}
const _ptsdAb = new THREE.Vector3();
const _ptsdAp = new THREE.Vector3();

// Charge progress 0..1 (matches beam-weapons chargeTimeToProgress semantics)
function _chargeProgress(chargeTimeSec, stats) {
  const maxCharge = stats.chargeTimeMax || 3.0;
  return Math.min(1, chargeTimeSec / (maxCharge / (stats.chargeRateMultiplier || 1)));
}

// ============================================================
// TWIN HELIX (Standard Blaster) — two spiral-woven projectiles
// ============================================================

export function fireTwinHelix(controller, index, stats, evo) {
  const now = performance.now();
  if (now - _evoCooldowns[index] < (evo.fireInterval || stats.fireInterval)) return;
  _evoCooldowns[index] = now;

  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);

  const helixRadius = evo.helixRadius || 0.3;
  const helixSpeed = evo.helixSpeed || 8;
  const damage = evo.damage || stats.damage;
  const shotId = startAccuracyShot(2, index === 0 ? 'left' : 'right');

  // Two projectiles, 180° out of phase — the helix motion lives in
  // projectile-system.js updateProjectiles (isHelix userData branch).
  for (let i = 0; i < 2; i++) {
    const phaseOffset = i * Math.PI;
    const spawnPos = origin.clone().addScaledVector(right, Math.cos(phaseOffset) * helixRadius * 0.3);

    const proj = spawnProjectile(spawnPos, forward, index, {
      ...stats,
      damage,
      projectileCount: 1,
    }, shotId, { suppressSound: true });

    if (proj && proj.userData) {
      proj.userData.isHelix = true;
      proj.userData.helixIndex = i;
      proj.userData.helixPhase = phaseOffset;
      proj.userData.helixRadius = helixRadius;
      proj.userData.helixSpeed = helixSpeed;
      proj.userData.helixForward = forward.clone();
      proj.userData.helixRight = right.clone();
      proj.userData.helixUp = up.clone();
      proj.userData.helixOrigin = spawnPos.clone();
      proj.userData.helixTime = 0;
    }
  }
  playShoothSound(2);
}

// ============================================================
// DRAGON'S BREATH (Buckshot) — molten pellets + fire trails
// ============================================================

const fireTrails = []; // { position, createdAt, duration, radius, damage, tickInterval, lastTickTime, visualMesh }

function spawnFireTrail(position, evo = game.weaponEvolution.left || {}) {
  if (!_deps.scene) return;
  // Cap active trails (Quest perf)
  if (fireTrails.length >= 10) {
    const oldest = fireTrails.shift();
    if (oldest.visualMesh) {
      _deps.scene.remove(oldest.visualMesh);
      _disposeObject3D(oldest.visualMesh);
    }
  }
  const trail = {
    position: position.clone(),
    createdAt: performance.now(),
    duration: evo.fireTrailDuration || 2000,
    radius: evo.fireTrailRadius || 0.5,
    damage: evo.fireTrailDamage || 3,
    tickInterval: 500,
    lastTickTime: 0,
  };
  const geo = new THREE.CircleGeometry(trail.radius, 8);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xff4400, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(trail.position);
  mesh.position.y = 0.01; // just above the ground plane
  mesh.rotation.x = -Math.PI / 2;
  mesh.name = 'fire-trail-visual';
  _deps.scene.add(mesh);
  trail.visualMesh = mesh;
  fireTrails.push(trail);
}

function updateFireTrails(now) {
  if (fireTrails.length === 0) return;
  const hash = _deps.enemySpatialHash;
  for (let i = fireTrails.length - 1; i >= 0; i--) {
    const trail = fireTrails[i];
    const elapsed = now - trail.createdAt;

    if (elapsed > trail.duration) {
      if (trail.visualMesh) {
        _deps.scene.remove(trail.visualMesh);
        _disposeObject3D(trail.visualMesh);
      }
      fireTrails.splice(i, 1);
      continue;
    }

    // Fade out over lifetime
    if (trail.visualMesh) {
      trail.visualMesh.material.opacity = 0.6 * (1 - elapsed / trail.duration);
    }

    // Damage tick: ignite enemies standing in the trail
    if (now - trail.lastTickTime >= trail.tickInterval && hash) {
      trail.lastTickTime = now;
      const nearby = hash.query(trail.position.x, trail.position.z, trail.radius);
      for (const enemy of nearby) {
        if (!enemy || !enemy.mesh || enemy.hp <= 0) continue;
        const dx = enemy.mesh.position.x - trail.position.x;
        const dz = enemy.mesh.position.z - trail.position.z;
        if (dx * dx + dz * dz < trail.radius * trail.radius) {
          const eIdx = _enemyIndex(enemy);
          if (eIdx >= 0) {
            hitEnemy(eIdx, trail.damage);
            applyEffects(eIdx, [{ type: 'fire', stacks: 1 }]);
          }
        }
      }
    }
  }
}

export function fireDragonsBreath(controller, index, stats, evo) {
  const now = performance.now();
  if (now - _evoCooldowns[index] < stats.fireInterval) return;
  _evoCooldowns[index] = now;

  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  const count = stats.projectileCount;
  const shotId = startAccuracyShot(count, index === 0 ? 'left' : 'right');

  // Wide cone of molten pellets (wider than base buckshot — it's a flamethrower)
  const halfCone = (stats.spreadAngle || THREE.MathUtils.degToRad(8)) * 0.5;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * halfCone;
    let axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    if (axis.lengthSq() < 0.0001) axis.set(0, 1, 0);
    axis.cross(direction);
    if (axis.lengthSq() < 0.0001) axis.set(1, 0, 0);
    axis.normalize();
    const shotDir = direction.clone().applyAxisAngle(axis, angle);

    const proj = spawnProjectile(origin.clone(), shotDir, index, stats, shotId, { suppressSound: count > 1 });
    if (proj && proj.userData) {
      proj.userData.isDragonsBreath = true;
      proj.userData.dragonsBreathEvo = evo;
    }
  }
  playBuckshotSound(count);
}

// ============================================================
// HIVE MIND (Seeker Burst) — orbiting micro-drones
// ============================================================

const hiveDrones = []; // { mesh, state, orbitAngle, orbitSpeed, orbitRadius, orbitHeight, target, diveSpeed, damage, hand, controllerIndex }

export function fireHiveMind(controller, index, stats, evo) {
  const now = performance.now();
  const hand = index === 0 ? 'left' : 'right';

  // At max drones: command them to dive-bomb instead of spawning more
  const handDrones = hiveDrones.filter(d => d.hand === hand);
  const maxDrones = evo.droneCount || 8;
  if (handDrones.length >= maxDrones) {
    commandDiveBomb(hand);
    return;
  }

  const toSpawn = Math.min(3, maxDrones - handDrones.length);
  if (toSpawn <= 0) return;
  if (now - _evoCooldowns[index] < stats.fireInterval) return;
  _evoCooldowns[index] = now;

  const controllerPos = new THREE.Vector3();
  controller.getWorldPosition(controllerPos);

  for (let i = 0; i < toSpawn; i++) {
    const geo = new THREE.SphereGeometry(0.04, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: evo.sigColor || 0xaa44ff,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'hive-drone';
    mesh.position.set(
      controllerPos.x + (Math.random() - 0.5) * 0.3,
      controllerPos.y + (Math.random() - 0.5) * 0.3 + 0.1,
      controllerPos.z + (Math.random() - 0.5) * 0.3
    );
    _deps.scene.add(mesh);

    hiveDrones.push({
      mesh,
      state: 'orbiting',
      orbitAngle: Math.random() * Math.PI * 2,
      orbitSpeed: 2 + Math.random() * 2,
      orbitRadius: 0.4 + Math.random() * 0.3,
      orbitHeight: -0.2 + Math.random() * 0.4,
      target: null,
      diveSpeed: 15 + Math.random() * 5,
      damage: evo.droneDamage || 6,
      hand,
      controllerIndex: index,
    });
  }
  playSeekerBurstSound(false, toSpawn);
}

function commandDiveBomb(hand) {
  const hash = _deps.enemySpatialHash;
  for (const drone of hiveDrones) {
    if (drone.hand !== hand || drone.state !== 'orbiting') continue;
    if (!hash) continue;
    const nearby = hash.query(drone.mesh.position.x, drone.mesh.position.z, 15);
    let nearest = null;
    let nearestDist = Infinity;
    for (const enemy of nearby) {
      if (!enemy || !enemy.mesh || enemy.hp <= 0) continue;
      const dist = drone.mesh.position.distanceTo(enemy.mesh.position);
      if (dist < nearestDist) { nearestDist = dist; nearest = enemy; }
    }
    if (nearest) {
      drone.state = 'diving';
      drone.target = nearest;
    }
  }
}

function updateHiveDrones(now, dt, playerPos) {
  const dtSec = dt / 1000;
  const hash = _deps.enemySpatialHash;

  for (let i = hiveDrones.length - 1; i >= 0; i--) {
    const drone = hiveDrones[i];

    if (drone.state === 'orbiting') {
      const controller = _deps.getController(drone.controllerIndex);
      const hasCtrl = controller && typeof controller.getWorldPosition === 'function';
      if (hasCtrl) {
        const ctrlPos = new THREE.Vector3();
        controller.getWorldPosition(ctrlPos);
        drone.mesh.position.set(
          ctrlPos.x + Math.cos(drone.orbitAngle) * drone.orbitRadius,
          ctrlPos.y + drone.orbitHeight + 0.2,
          ctrlPos.z + Math.sin(drone.orbitAngle) * drone.orbitRadius
        );
      } else {
        // Desktop fallback: orbit the camera position
        drone.mesh.position.set(
          playerPos.x + Math.cos(drone.orbitAngle) * drone.orbitRadius,
          playerPos.y + drone.orbitHeight + 0.3,
          playerPos.z + Math.sin(drone.orbitAngle) * drone.orbitRadius
        );
      }
      drone.orbitAngle += drone.orbitSpeed * dtSec;

      // Passive aggression: dive at enemies that get close
      if (hash) {
        const nearby = hash.query(drone.mesh.position.x, drone.mesh.position.z, 5);
        for (const enemy of nearby) {
          if (!enemy || !enemy.mesh || enemy.hp <= 0) continue;
          if (drone.mesh.position.distanceTo(enemy.mesh.position) < 3) {
            drone.state = 'diving';
            drone.target = enemy;
            break;
          }
        }
      }
    }

    else if (drone.state === 'diving') {
      const target = drone.target;
      if (!target || !target.mesh || target.hp <= 0 || !target.mesh.parent) {
        drone.state = 'returning';
        drone.target = null;
        continue;
      }

      const toTarget = new THREE.Vector3().subVectors(target.mesh.position, drone.mesh.position);
      const dist = toTarget.length();

      if (dist < 0.3) {
        // Impact: damage + status-free hit number, then the drone sacrifices itself
        const eIdx = _enemyIndex(target);
        if (eIdx >= 0) {
          hitEnemy(eIdx, drone.damage);
          _deps.spawnDamageNumber(target.mesh.position.clone(), drone.damage, '#aa44ff');
        }
        _deps.scene.remove(drone.mesh);
        _disposeObject3D(drone.mesh);
        hiveDrones.splice(i, 1);
        continue;
      }

      toTarget.normalize().multiplyScalar(drone.diveSpeed * dtSec);
      drone.mesh.position.add(toTarget);
    }

    else if (drone.state === 'returning') {
      const toPlayer = new THREE.Vector3().subVectors(playerPos, drone.mesh.position);
      if (toPlayer.length() < 0.5) {
        drone.state = 'orbiting';
        drone.target = null;
      } else {
        toPlayer.normalize().multiplyScalar(10 * dtSec);
        drone.mesh.position.add(toPlayer);
      }
    }
  }
}

// ============================================================
// TESLA TOWER (Lightning Rod) — stationary arc coils
// ============================================================

const teslaCoils = []; // { position, mesh, core, ring, createdAt, duration, range, damage, arcInterval, lastArcTime, hand }

// Called from the hold loop instead of updateLightningBeam while the evolved
// lightning rod is firing — places a coil when the trigger is held.
export function updateTeslaTower(controller, index, stats, evo, now) {
  const hand = index === 0 ? 'left' : 'right';
  const handCoils = teslaCoils.filter(c => c.hand === hand);
  const maxCoils = evo.maxCoils || 2;

  if (handCoils.length < maxCoils) {
    // 1s cooldown between placements to prevent spam
    const lastPlaceTime = handCoils.reduce((max, c) => Math.max(max, c.createdAt), 0);
    if (now - lastPlaceTime > 1000) {
      placeTeslaCoil(controller, index, evo, now);
    }
  }

  // Keep the lightning loop sound going while coils are active
  if (teslaCoils.some(c => c.hand === hand)) {
    startLightningSound();
  }
}

function placeTeslaCoil(controller, index, evo, now) {
  const hand = index === 0 ? 'left' : 'right';
  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

  const placePos = origin.clone().addScaledVector(forward, 4);
  placePos.y = 0.5;

  // Visual: glowing orb + pulsing ring
  const group = new THREE.Group();
  group.name = 'tesla-coil';
  const coreGeo = new THREE.SphereGeometry(0.15, 12, 12);
  const coreMat = new THREE.MeshBasicMaterial({ color: evo.sigColor || 0x4488ff, transparent: true, opacity: 0.9 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);
  const ringGeo = new THREE.RingGeometry(0.3, 0.35, 16);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  group.position.copy(placePos);
  _deps.scene.add(group);

  teslaCoils.push({
    position: placePos,
    mesh: group,
    core,
    ring,
    createdAt: now,
    duration: evo.coilDuration || 3000,
    range: evo.coilRange || 6,
    damage: evo.arcDamage || 8,
    arcInterval: evo.arcInterval || 500,
    lastArcTime: 0,
    hand,
  });
  playShoothSound();
}

function updateTeslaCoils(now) {
  if (teslaCoils.length === 0) return;
  const hash = _deps.enemySpatialHash;
  for (let i = teslaCoils.length - 1; i >= 0; i--) {
    const coil = teslaCoils[i];
    const elapsed = now - coil.createdAt;

    if (elapsed > coil.duration) {
      _deps.scene.remove(coil.mesh);
      _disposeObject3D(coil.mesh);
      teslaCoils.splice(i, 1);
      continue;
    }

    // Pulse ring + rotate core
    const pulse = 1 + Math.sin(elapsed * 0.005) * 0.2;
    coil.ring.scale.setScalar(pulse);
    coil.ring.material.opacity = 0.3 + Math.sin(elapsed * 0.008) * 0.2;
    coil.core.rotation.y += 0.02;

    // Fade in the last 30% of lifetime
    if (elapsed > coil.duration * 0.7) {
      const fade = (elapsed - coil.duration * 0.7) / (coil.duration * 0.3);
      coil.core.material.opacity = 0.9 * (1 - fade);
    }

    // Arc damage tick: shock all enemies in range
    if (now - coil.lastArcTime >= coil.arcInterval && hash) {
      coil.lastArcTime = now;
      const nearby = hash.query(coil.position.x, coil.position.z, coil.range);
      for (const enemy of nearby) {
        if (!enemy || !enemy.mesh || enemy.hp <= 0) continue;
        if (enemy.mesh.position.distanceToSquared(coil.position) < coil.range * coil.range) {
          const eIdx = _enemyIndex(enemy);
          if (eIdx >= 0) {
            hitEnemy(eIdx, coil.damage);
            applyEffects(eIdx, [{ type: 'shock', stacks: 1 }]);
          }
        }
      }
    }
  }
}

// ============================================================
// SINGULARITY LAUNCHER (Charge Cannon) — gravity wells
// ============================================================

const singularities = []; // { position, mesh, core, ring, glow, createdAt, duration, pullRadius, pullForce, detonationDamage, progress, phase }

export function fireSingularityShot(controller, index, chargeTimeSec, stats, evo) {
  const progress = _chargeProgress(chargeTimeSec, stats);

  // Weak charge (<50%): just a small projectile — no singularity
  if (progress < 0.5) {
    const weakDamage = Math.round(stats.damage * progress * 2);
    const origin = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    controller.getWorldPosition(origin);
    controller.getWorldQuaternion(quat);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    spawnProjectile(origin, direction, index, { ...stats, damage: weakDamage }, undefined);
    playShoothSound();
    return;
  }

  // Cap concurrent singularities (discard oldest)
  if (singularities.length >= 3) {
    const oldest = singularities.shift();
    _deps.scene.remove(oldest.mesh);
    _disposeObject3D(oldest.mesh);
  }

  playChargeFireSound(progress);

  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const placePos = origin.clone().addScaledVector(forward, 5);
  placePos.y = 1.0;

  // Visual: dark core + event-horizon ring + purple glow
  const group = new THREE.Group();
  group.name = 'singularity-well';
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x220044, transparent: true, opacity: 0.9 })
  );
  group.add(core);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.5, 24),
    new THREE.MeshBasicMaterial({ color: evo.sigColor || 0x8800ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x8800ff, transparent: true, opacity: 0.2 })
  );
  group.add(glow);
  group.position.copy(placePos);
  _deps.scene.add(group);

  singularities.push({
    position: placePos,
    mesh: group,
    core,
    ring,
    glow,
    createdAt: performance.now(),
    duration: evo.singularityDuration || 1500,
    pullRadius: evo.pullRadius || 5,
    pullForce: evo.pullForce || 8,
    detonationDamage: evo.detonationDamage || 60,
    progress,
    phase: 'pull',
  });
}

function updateSingularities(now, dt) {
  if (singularities.length === 0) return;
  const dtSec = dt / 1000;
  const hash = _deps.enemySpatialHash;

  for (let i = singularities.length - 1; i >= 0; i--) {
    const sing = singularities[i];
    const elapsed = now - sing.createdAt;

    if (sing.phase === 'pull') {
      // Pull enemies inward (force scales closer to center)
      if (hash) {
        const nearby = hash.query(sing.position.x, sing.position.z, sing.pullRadius);
        for (const enemy of nearby) {
          if (!enemy || !enemy.mesh || enemy.hp <= 0) continue;
          const toSing = new THREE.Vector3().subVectors(sing.position, enemy.mesh.position);
          const dist = toSing.length();
          if (dist < sing.pullRadius && dist > 0.3) {
            const forceMult = sing.pullForce * dtSec * (1 - dist / sing.pullRadius);
            toSing.normalize().multiplyScalar(forceMult);
            enemy.mesh.position.add(toSing);
          }
        }
      }

      sing.ring.rotation.z += dt * 0.01;
      sing.glow.scale.setScalar(1 + Math.sin(elapsed * 0.01) * 0.3);

      // Detonate at 80% of lifetime
      if (elapsed > sing.duration * 0.8) {
        sing.phase = 'detonate';
        screenFx.cameraShake = 0.2;
        screenFx.cameraShakeIntensity = 0.03;
        screenFx.originalCameraPos.copy(sing.position);
      }
    }

    if (sing.phase === 'detonate') {
      const detRadius = sing.pullRadius * 0.8;
      if (hash) {
        const nearby = hash.query(sing.position.x, sing.position.z, detRadius);
        for (const enemy of nearby) {
          if (!enemy || !enemy.mesh || enemy.hp <= 0) continue;
          const distSq = enemy.mesh.position.distanceToSquared(sing.position);
          if (distSq < detRadius * detRadius) {
            const eIdx = _enemyIndex(enemy);
            if (eIdx >= 0) {
              const dist = Math.sqrt(distSq);
              const falloff = 1 - (dist / detRadius) * 0.5;
              hitEnemy(eIdx, Math.round(sing.detonationDamage * sing.progress * falloff));
            }
          }
        }
      }

      // Expand + fade, then clean up
      sing.mesh.scale.setScalar(3);
      sing.core.material.opacity = 0;
      sing.glow.material.opacity = 0.5;
      sing.ring.material.opacity = 0;
      const meshRef = sing.mesh;
      setTimeout(() => {
        if (!_deps.scene) return;
        _deps.scene.remove(meshRef);
        _disposeObject3D(meshRef);
      }, 200);

      singularities.splice(i, 1);
      playExplosionSound();
      continue;
    }

    // Safety removal
    if (elapsed > sing.duration * 2) {
      _deps.scene.remove(sing.mesh);
      _disposeObject3D(sing.mesh);
      singularities.splice(i, 1);
    }
  }
}

// ============================================================
// OBLITERATOR BEAM (Plasma Carbine) — continuous overheat beam
// ============================================================

const obliteratorBeams = {}; // index -> { active, startTime, overheated, overheatStart, visual }

export function updateObliteratorBeam(controller, index, evo, stats, now, dt) {
  let beam = obliteratorBeams[index];

  // Overheat cooldown: beam stays off until it recovers
  if (beam && beam.overheated) {
    if (now - beam.overheatStart > (evo.overheatCooldown || 1500)) {
      beam.overheated = false;
    } else {
      if (beam.visual) beam.visual.visible = false;
      return;
    }
  }

  // Overheat after beamDuration of continuous fire
  if (beam && beam.active) {
    const elapsed = now - beam.startTime;
    if (elapsed > (evo.beamDuration || 4000)) {
      beam.overheated = true;
      beam.overheatStart = now;
      beam.active = false;
      if (beam.visual) beam.visual.visible = false;
      playErrorSound();
      return;
    }
  }

  if (!beam || !beam.active) {
    obliteratorBeams[index] = {
      active: true,
      startTime: now,
      overheated: false,
      overheatStart: 0,
      visual: beam ? beam.visual : null,
    };
  }

  const currentBeam = obliteratorBeams[index];
  const elapsed = now - currentBeam.startTime;
  const maxDuration = evo.beamDuration || 4000;
  const progress = elapsed / maxDuration;

  const origin = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  controller.getWorldPosition(origin);
  controller.getWorldQuaternion(quat);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  const beamEnd = origin.clone().addScaledVector(forward, 50);

  // Beam damage: damage-per-second scaled by frame dt (beamDamagePerFrame is DPS)
  const beamWidthSq = (evo.beamWidth || 0.15) * (evo.beamWidth || 0.15);
  const damage = (evo.beamDamagePerFrame || 60) * (dt / 1000);

  getEnemies().forEach((enemy, i) => {
    if (!enemy || !enemy.mesh || enemy.hp <= 0) return;
    if (_pointToSegmentDistSq(enemy.mesh.position, origin, beamEnd) < beamWidthSq * 4) {
      hitEnemy(i, Math.ceil(damage));
    }
  });

  const boss = getBoss();
  if (boss && boss.mesh) {
    if (_pointToSegmentDistSq(boss.mesh.position, origin, beamEnd) < beamWidthSq * 4) {
      hitBoss(Math.ceil(damage * 2), { isObliteratorBeam: true });
    }
  }

  ensureObliteratorBeamVisual(index, origin, beamEnd, progress, evo);
}

function ensureObliteratorBeamVisual(index, origin, end, progress, evo) {
  const beamEntry = obliteratorBeams[index];
  if (!beamEntry) return;
  let beam = beamEntry.visual;

  if (!beam) {
    beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1, 6),
      new THREE.MeshBasicMaterial({ color: evo.sigColor || 0x00ff44, transparent: true, opacity: 0.8 })
    );
    beam.name = 'obliterator-beam';
    _deps.scene.add(beam);
    beamEntry.visual = beam;
  }

  beam.visible = true;
  const midpoint = origin.clone().add(end).multiplyScalar(0.5);
  beam.position.copy(midpoint);
  beam.lookAt(end);
  beam.rotateX(Math.PI / 2);

  const length = origin.distanceTo(end);
  beam.scale.set(1 + progress * 2, length, 1 + progress * 2);

  // Green → red as heat builds
  const heatColor = new THREE.Color(evo.sigColor || 0x00ff44);
  heatColor.lerp(new THREE.Color(0xff0000), progress * 0.7);
  beam.material.color.copy(heatColor);
  beam.material.opacity = 0.6 + progress * 0.3;
}

export function hideObliteratorBeam(index) {
  const beam = obliteratorBeams[index];
  if (beam) {
    beam.active = false;
    if (beam.visual) beam.visual.visible = false;
  }
}

// ============================================================
// Dispatcher + cleanup
// ============================================================

export function updateEvolvedSystems(now, dt, playerPos) {
  updateFireTrails(now);
  updateHiveDrones(now, dt, playerPos);
  updateTeslaCoils(now);
  updateSingularities(now, dt);
}

export function clearAllEvolvedSystems() {
  for (const drone of hiveDrones) {
    if (drone.mesh && drone.mesh.parent) {
      _deps.scene.remove(drone.mesh);
      _disposeObject3D(drone.mesh);
    }
  }
  hiveDrones.length = 0;
  for (const trail of fireTrails) {
    if (trail.visualMesh) {
      _deps.scene.remove(trail.visualMesh);
      _disposeObject3D(trail.visualMesh);
    }
  }
  fireTrails.length = 0;
  for (const coil of teslaCoils) {
    _deps.scene.remove(coil.mesh);
    _disposeObject3D(coil.mesh);
  }
  teslaCoils.length = 0;
  for (const sing of singularities) {
    _deps.scene.remove(sing.mesh);
    _disposeObject3D(sing.mesh);
  }
  singularities.length = 0;
  for (const key of Object.keys(obliteratorBeams)) {
    const beam = obliteratorBeams[key];
    if (beam.visual) {
      _deps.scene.remove(beam.visual);
      _disposeObject3D(beam.visual);
    }
  }
  Object.keys(obliteratorBeams).forEach(k => delete obliteratorBeams[k]);
}
