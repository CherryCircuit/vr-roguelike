// ============================================================
//  WEAPON MODELS — Procedural 3D Models for VR Hands
// ============================================================

import * as THREE from 'three';

// ── Main Model Creation Function ───────────────────────────
export function createWeaponModel(weaponId) {
  switch (weaponId) {
    case 'buckshot':
      return createShotgunModel();
    case 'lightning':
      return createLightningRodModel();
    case 'charge_shot':
      return createChargeCannonModel();
    case 'rapid_fire':
      return createRapidFireModel();
    default:
      return createBlasterModel();
  }
}

// ── Blaster Model (Default) ───────────────────────────────
function createBlasterModel() {
  const g = new THREE.Group();

  // Barrel (cylinder)
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.02, 0.25, 8),
    new THREE.MeshBasicMaterial({ color: 0x444466 })
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.15;
  g.add(barrel);

  // Body (box)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.035, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x333355 })
  );
  body.position.z = -0.02;
  g.add(body);

  // Muzzle glow
  const muzzle = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    })
  );
  muzzle.position.z = -0.28;
  g.add(muzzle);

  // Edge glow on body
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.4,
    })
  );
  edges.position.copy(body.position);
  g.add(edges);

  return g;
}

// ── Shotgun Model (Buckshot) ──────────────────────────────
function createShotgunModel() {
  const g = new THREE.Group();

  // Double barrel
  [-0.015, 0.015].forEach(x => {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.015, 0.22, 6),
      new THREE.MeshBasicMaterial({ color: 0x555544 })
    );
    b.rotation.x = Math.PI / 2;
    b.position.set(x, 0, -0.14);
    g.add(b);
  });

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.04, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x554433 })
  );
  g.add(body);

  // Orange accent strip
  const accent = new THREE.Mesh(
    new THREE.BoxGeometry(0.062, 0.005, 0.08),
    new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.6,
    })
  );
  accent.position.y = 0.022;
  g.add(accent);

  // Muzzle glow on both barrels
  [-0.015, 0.015].forEach(x => {
    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 6, 6),
      new THREE.MeshBasicMaterial({
        color: 0xff8800,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      })
    );
    muzzle.position.set(x, 0, -0.26);
    g.add(muzzle);
  });

  return g;
}

// ── Lightning Rod Model ───────────────────────────────────
function createLightningRodModel() {
  const g = new THREE.Group();

  // Rod
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.012, 0.3, 6),
    new THREE.MeshBasicMaterial({ color: 0x666688 })
  );
  rod.rotation.x = Math.PI / 2;
  rod.position.z = -0.18;
  g.add(rod);

  // Tesla coil ring
  const coil = new THREE.Mesh(
    new THREE.TorusGeometry(0.03, 0.005, 6, 12),
    new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    })
  );
  coil.position.z = -0.25;
  g.add(coil);

  // Spark tip
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffff44,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    })
  );
  tip.position.z = -0.33;
  g.add(tip);

  // Handle
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.012, 0.08, 6),
    new THREE.MeshBasicMaterial({ color: 0x444455 })
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.05;
  g.add(handle);

  return g;
}

// ── Charge Cannon Model ───────────────────────────────────
function createChargeCannonModel() {
  const g = new THREE.Group();

  // Wide barrel
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 0.2, 8),
    new THREE.MeshBasicMaterial({ color: 0x553333 })
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.12;
  g.add(barrel);

  // Energy chamber ring
  const chamber = new THREE.Mesh(
    new THREE.TorusGeometry(0.04, 0.008, 8, 16),
    new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    })
  );
  chamber.position.z = -0.04;
  g.add(chamber);

  // Chunky body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.05, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x442222 })
  );
  body.position.set(0, 0, 0.02);
  g.add(body);

  // Muzzle glow
  const muzzle = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    })
  );
  muzzle.position.z = -0.23;
  g.add(muzzle);

  // Glowing lines on barrel
  const barrelLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(barrel.geometry),
    new THREE.LineBasicMaterial({
      color: 0xff6644,
      transparent: true,
      opacity: 0.5,
    })
  );
  barrelLines.position.copy(barrel.position);
  barrelLines.rotation.copy(barrel.rotation);
  g.add(barrelLines);

  return g;
}

// ── Rapid Fire Model ─────────────────────────────────────
function createRapidFireModel() {
  const g = new THREE.Group();

  // Triple barrels
  [-0.02, 0, 0.02].forEach((x, i) => {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.01, 0.18, 6),
      new THREE.MeshBasicMaterial({ color: 0x445566 })
    );
    b.rotation.x = Math.PI / 2;
    b.position.set(x, 0, -0.12);
    g.add(b);
  });

  // Compact body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.04, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x334455 })
  );
  body.position.z = 0;
  g.add(body);

  // Blue accent
  const accent = new THREE.Mesh(
    new THREE.BoxGeometry(0.052, 0.006, 0.06),
    new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.7,
    })
  );
  accent.position.y = 0.023;
  accent.position.z = 0;
  g.add(accent);

  // Muzzle glows
  [-0.02, 0, 0.02].forEach(x => {
    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 6, 6),
      new THREE.MeshBasicMaterial({
        color: 0x44aaff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
      })
    );
    muzzle.position.set(x, 0, -0.22);
    g.add(muzzle);
  });

  return g;
}

// ── Update Weapon Model on Controller ─────────────────────
export function updateControllerWeapon(controller, weaponId) {
  // Remove old model
  const oldModel = controller.getObjectByName('weaponModel');
  if (oldModel) {
    controller.remove(oldModel);
  }

  // Create and add new model
  const model = createWeaponModel(weaponId);
  model.name = 'weaponModel';

  // Position model in controller's hand
  model.position.set(0, -0.02, -0.05);

  controller.add(model);
}
