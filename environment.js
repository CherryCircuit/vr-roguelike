// ============================================================
//  ENVIRONMENT — Mountains, Sun, Scrolling Grid Floor
// ============================================================

import * as THREE from 'three';

// ── References for animation and theme updates ─────────────
let sunMeshRef = null;
let sunGlowRef = null;
let gridData = null;
let mountainRefs = null;

// ── Scrolling Grid Floor ──────────────────────────────────
export function createScrollingGrid(scene) {
  // Canvas grid texture
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Dark background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 256);

  // Pink grid lines
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 2;
  const cellSize = 256 / 16;

  for (let i = 0; i <= 16; i++) {
    const pos = i * cellSize;
    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, 256);
    ctx.stroke();
    // Horizontal lines
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(256, pos);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01;

  scene.add(mesh);

  gridData = { mesh, texture, material };
  return gridData;
}

export function updateScrollingGrid(dt, isPlaying) {
  if (!gridData || !isPlaying) return;
  gridData.texture.offset.y += dt * 0.5; // Tune speed here
}

export function regenerateGridTexture(colorStr) {
  if (!gridData) return;
  const canvas = gridData.texture.image;
  const ctx = canvas.getContext('2d');

  // Clear and redraw with new color
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = colorStr;
  ctx.lineWidth = 2;
  const cellSize = 256 / 16;

  for (let i = 0; i <= 16; i++) {
    const pos = i * cellSize;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(256, pos);
    ctx.stroke();
  }

  gridData.texture.needsUpdate = true;
}

// ── Wireframe Mountain Ring (Valley Effect) ───────────────
export function createMountainRing(scene) {
  const RING_RADIUS = 80;
  const RING_SEGMENTS = 64;   // Around the circle
  const HEIGHT_ROWS = 5;      // Vertical resolution
  const MAX_HEIGHT = 25;
  const MIN_HEIGHT = 8;

  const positions = [];
  const indices = [];

  // Generate vertices with layered sine waves for organic peaks
  for (let row = 0; row <= HEIGHT_ROWS; row++) {
    const y = row / HEIGHT_ROWS;
    for (let seg = 0; seg <= RING_SEGMENTS; seg++) {
      const angle = (seg / RING_SEGMENTS) * Math.PI * 2;
      const x = Math.cos(angle) * RING_RADIUS;
      const z = Math.sin(angle) * RING_RADIUS;

      let height = 0;
      if (row > 0) {
        // Layered sine waves for organic peaks
        const noise1 = Math.sin(angle * 3.7 + 1.2) * 0.4;
        const noise2 = Math.sin(angle * 7.3 + 4.5) * 0.2;
        const noise3 = Math.sin(angle * 13.1 + 2.8) * 0.1;
        const peakFactor = Math.sin(y * Math.PI); // Peak in middle rows
        height = (MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * (noise1 + noise2 + noise3 + 0.7)) * peakFactor;
      }
      positions.push(x, height, z);
    }
  }

  // Triangle indices
  for (let row = 0; row < HEIGHT_ROWS; row++) {
    for (let seg = 0; seg < RING_SEGMENTS; seg++) {
      const a = row * (RING_SEGMENTS + 1) + seg;
      const b = a + RING_SEGMENTS + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);

  // Solid dark fill
  const fillMat = new THREE.MeshBasicMaterial({
    color: 0x0a0020,
    side: THREE.DoubleSide
  });
  const fillMesh = new THREE.Mesh(geometry, fillMat);
  fillMesh.renderOrder = -5;
  scene.add(fillMesh);

  // Glowing cyan wireframe
  const edges = new THREE.EdgesGeometry(geometry, 15);
  const wireMat = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const wireframe = new THREE.LineSegments(edges, wireMat);
  wireframe.renderOrder = -4;
  scene.add(wireframe);

  mountainRefs = { fillMesh, wireframe, fillMat, wireMat };
  return mountainRefs;
}

// ── Sun with Enhanced Glow ─────────────────────────────────
export function createSun(scene) {
  // Generate sun texture with horizontal bands
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Brighter gradient colors
  const sunGrad = ctx.createLinearGradient(256, 30, 256, 482);
  sunGrad.addColorStop(0, '#ffff88');    // Bright yellow (was #ffdd33)
  sunGrad.addColorStop(0.3, '#ffdd33');
  sunGrad.addColorStop(0.5, '#ffaa00');
  sunGrad.addColorStop(0.7, '#ff6600');
  sunGrad.addColorStop(1.0, '#ff3300');

  ctx.beginPath();
  ctx.arc(256, 256, 248, 0, Math.PI * 2);
  ctx.fillStyle = sunGrad;
  ctx.fill();

  // Outer glow baked into texture
  ctx.shadowColor = '#ff8800';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(256, 256, 248, 0, Math.PI * 2);
  ctx.fillStyle = sunGrad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Cut horizontal bands
  ctx.globalCompositeOperation = 'destination-out';
  const bandDefs = [
    { y: 0.90, h: 0.065 },
    { y: 0.82, h: 0.050 },
    { y: 0.75, h: 0.038 },
    { y: 0.69, h: 0.028 },
    { y: 0.64, h: 0.020 },
    { y: 0.60, h: 0.013 },
    { y: 0.57, h: 0.008 },
    { y: 0.54, h: 0.004 },
  ];
  for (const b of bandDefs) {
    const cy = b.y * 512;
    const ch = b.h * 512;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, cy - ch / 2, 512, ch);
  }
  ctx.globalCompositeOperation = 'source-over';

  const sunTexture = new THREE.CanvasTexture(canvas);
  const sunMat = new THREE.MeshBasicMaterial({
    map: sunTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  // Main sun mesh
  const sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), sunMat);
  sunMesh.position.set(0, 12, -89);
  sunMesh.renderOrder = -10;
  scene.add(sunMesh);
  sunMeshRef = sunMesh;

  // Primary glow
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(24, 32), glowMat);
  glow.position.set(0, 12, -89.5);
  glow.renderOrder = -11;
  scene.add(glow);
  sunGlowRef = glow;

  // Extra glow layers for more drama
  const extraGlows = [
    { radius: 28, opacity: 0.2, color: 0xff8800 },
    { radius: 36, opacity: 0.08, color: 0xff6600 },
  ];

  extraGlows.forEach(({ radius, opacity, color }) => {
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), mat);
    mesh.position.set(0, 12, -89.8);
    mesh.renderOrder = -12;
    scene.add(mesh);
  });

  return { sunMesh, glowMesh: glow };
}

// Sun pulse animation
export function updateSunGlow(time) {
  if (!sunGlowRef) return;
  sunGlowRef.material.opacity = 0.3 + Math.sin(time * 0.001) * 0.05;
}

// Regenerate sun texture with new colors (for themes)
export function regenerateSunTexture(sunMesh, colorStops) {
  if (!sunMesh) return;
  const canvas = sunMesh.material.map.image;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 512, 512);
  const grad = ctx.createLinearGradient(256, 30, 256, 482);
  colorStops.forEach((c, i) => grad.addColorStop(i / (colorStops.length - 1), c));

  ctx.beginPath();
  ctx.arc(256, 256, 248, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Outer glow
  ctx.shadowColor = colorStops[0];
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(256, 256, 248, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Cut bands
  ctx.globalCompositeOperation = 'destination-out';
  const bandDefs = [
    { y: 0.90, h: 0.065 },
    { y: 0.82, h: 0.050 },
    { y: 0.75, h: 0.038 },
    { y: 0.69, h: 0.028 },
    { y: 0.64, h: 0.020 },
    { y: 0.60, h: 0.013 },
    { y: 0.57, h: 0.008 },
    { y: 0.54, h: 0.004 },
  ];
  for (const b of bandDefs) {
    const cy = b.y * 512;
    const ch = b.h * 512;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, cy - ch / 2, 512, ch);
  }
  ctx.globalCompositeOperation = 'source-over';

  sunMesh.material.map.needsUpdate = true;
}

// ── Stars ─────────────────────────────────────────────────
export function createStars(scene) {
  const starsGeo = new THREE.BufferGeometry();
  const starCount = 500;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    // Stars in a dome above
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.4; // Upper hemisphere only
    const r = 100;

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) + 20; // Lift up
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const starsMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.15,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const stars = new THREE.Points(starsGeo, starsMat);
  stars.renderOrder = -15;
  scene.add(stars);

  return { stars, starsMat };
}

// ── Atmosphere (Horizon Glow) ─────────────────────────────
export function createAtmosphere(scene) {
  const segments = 48;
  const radius = 92;
  const height = 30;

  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, 'rgba(255, 80, 20, 1.0)');
  grad.addColorStop(0.08, 'rgba(255, 60, 30, 0.85)');
  grad.addColorStop(0.2, 'rgba(220, 50, 40, 0.55)');
  grad.addColorStop(0.4, 'rgba(160, 30, 60, 0.3)');
  grad.addColorStop(0.6, 'rgba(100, 15, 50, 0.12)');
  grad.addColorStop(0.8, 'rgba(50, 5, 40, 0.04)');
  grad.addColorStop(1.0, 'rgba(20, 0, 20, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);

  const atmTexture = new THREE.CanvasTexture(canvas);
  atmTexture.wrapS = THREE.RepeatWrapping;

  const cylGeo = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true);
  const cylMat = new THREE.MeshBasicMaterial({
    map: atmTexture,
    transparent: true,
    opacity: 0.8,
    side: THREE.BackSide,
    depthWrite: false
  });

  const cylinder = new THREE.Mesh(cylGeo, cylMat);
  cylinder.position.set(0, height / 2 - 2, 0);
  cylinder.renderOrder = -13;
  scene.add(cylinder);

  return cylinder;
}

// ── Floor (under grid) ────────────────────────────────────
export function createFloor(scene) {
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x220044 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);
  return { floor, floorMat };
}

// ── Export references for theme updates ───────────────────
export function getEnvironmentRefs() {
  return {
    sunMesh: sunMeshRef,
    sunGlow: sunGlowRef,
    gridData,
    mountainRefs,
  };
}
