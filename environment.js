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

// ── Wireframe Valley Mountains (Synthwave Style) ───────────────
export function createMountainRing(scene) {
  // Create TWO mountain walls - left and right sides
  // These frame a tunnel/path leading toward the sun AND behind the player
  
  const mountainMeshes = [];
  const wireframeMeshes = [];
  
  // Create mountains on LEFT side (from far behind to far in front)
  createMountainWall(scene, -45, -1, mountainMeshes, wireframeMeshes);
  
  // Create mountains on RIGHT side  
  createMountainWall(scene, 45, 1, mountainMeshes, wireframeMeshes);
  
  mountainRefs = { fillMesh: mountainMeshes, wireframe: wireframeMeshes };
  return mountainRefs;
}

function createMountainWall(scene, xOffset, direction, mountainMeshes, wireframeMeshes) {
  // Create continuous mountain range from far behind to far in front
  const NUM_MOUNTAINS = 20;  // More mountains for longer range
  const SPACING = 20;
  
  for (let i = 0; i < NUM_MOUNTAINS; i++) {
    const zPos = 180 - (i * SPACING);  // From +180 (behind) to -200 (far front)
    
    // Varied heights and widths for natural look
    const heightVariation = Math.sin(i * 0.7) * 10 + Math.sin(i * 1.3) * 5;
    const height = 12 + Math.random() * 15 + heightVariation;
    
    const widthVariation = Math.sin(i * 0.5 + 2) * 8;
    const width = 18 + Math.random() * 12 + widthVariation;
    
    // Some mountains have multiple peaks
    const hasMultiPeak = Math.random() > 0.6;
    
    createMountainMesh(scene, xOffset, zPos, height, width, direction, hasMultiPeak, mountainMeshes, wireframeMeshes);
  }
}

function createMountainMesh(scene, x, z, height, width, direction, hasMultiPeak, mountainMeshes, wireframeMeshes) {
  const positions = [];
  const indices = [];
  
  const hw = width / 2;
  
  if (hasMultiPeak) {
    // Double or triple peak mountain
    const peakCount = Math.random() > 0.5 ? 3 : 2;
    const peakSpacing = width / (peakCount + 1);
    
    // Base vertices
    const baseIdx = 0;
    positions.push(-hw, 0, -hw * 0.6);  // 0 - back left
    positions.push(hw, 0, -hw * 0.6);   // 1 - back right
    positions.push(hw, 0, hw * 0.6);    // 2 - front right
    positions.push(-hw, 0, hw * 0.6);   // 3 - front left
    
    // Add peaks
    for (let p = 0; p < peakCount; p++) {
      const peakX = -hw + (p + 1) * peakSpacing;
      const peakHeight = height * (0.6 + Math.random() * 0.4);
      positions.push(peakX, peakHeight, 0);  // Peak vertex
    }
    
    // Create faces connecting peaks
    // Front face (first peak to front edge)
    indices.push(0, 4, 3);
    
    // Between peaks
    for (let p = 0; p < peakCount - 1; p++) {
      indices.push(4 + p, 4 + p + 1, 0);  // Top ridge
      if (p === 0) indices.push(4 + p, 0, 1);  // Side
    }
    
    // Back face
    indices.push(peakCount + 3, 1, 2);
    indices.push(peakCount + 3, 2, 3);
    
  } else {
    // Single peak mountain
    positions.push(0, height, 0);  // 0 - peak
    positions.push(-hw, 0, -hw * 0.7);  // 1 - back left
    positions.push(hw, 0, -hw * 0.7);   // 2 - back right
    positions.push(hw, 0, hw * 0.7);    // 3 - front right
    positions.push(-hw, 0, hw * 0.7);   // 4 - front left
    
    // Angular faces
    indices.push(0, 4, 3);  // front
    indices.push(0, 3, 2);  // right front
    indices.push(0, 2, 1);  // back
    indices.push(0, 1, 4);  // left
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  // Black fill
  const fillMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide
  });
  const fillMesh = new THREE.Mesh(geometry, fillMat);
  fillMesh.position.set(x, 0, z);
  fillMesh.renderOrder = -5;
  scene.add(fillMesh);
  mountainMeshes.push(fillMesh);
  
  // Thick neon magenta wireframe (using LineSegments with wider lines)
  const edges = new THREE.EdgesGeometry(geometry, 1);
  const wireMat = new THREE.LineBasicMaterial({
    color: 0xff00ff,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    linewidth: 3,  // Thicker lines (note: may not work on all platforms)
  });
  const wireframe = new THREE.LineSegments(edges, wireMat);
  wireframe.position.set(x, 0, z);
  wireframe.renderOrder = -4;
  scene.add(wireframe);
  wireframeMeshes.push(wireframe);
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
    // Stars in a dome high above
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.25; // Upper hemisphere only (smaller angle = higher)
    const r = 100;

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) + 60; // Lift up much higher
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
