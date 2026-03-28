// ============================================================
//  BIOME: Hellscape Lava
//  Volcanic landscape with lava rivers and fire particles
// ============================================================
import * as THREE from 'three';

export function buildHellscapeLavaScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
  
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight;
  const sceneColor = 0x1a0505;

  // Sky dome (dark red/black)
  const skyGeo = new THREE.SphereGeometry(500, 32, 24);
  const skyMat = new THREE.MeshBasicMaterial({
    color: sceneColor,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -20;
  group.add(sky);
  registerFadeMaterial(skyMat);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x331111, 0.3);
  group.add(ambientLight);

  // Ground with lava rivers
  const groundGeo = new THREE.PlaneGeometry(200, 200, 100, 100);
  groundGeo.rotateX(-Math.PI / 2);
  const groundPos = groundGeo.attributes.position;
  const groundColors = [];
  for (let i = 0; i < groundPos.count; i++) {
    const x = groundPos.getX(i);
    const z = groundPos.getZ(i);
    // Lava river pattern
    const lavaPattern = Math.sin(x * 0.05) * Math.cos(z * 0.05) + Math.sin(x * 0.1 + z * 0.1) * 0.5;
    const isLava = lavaPattern > 0.3;
    const height = isLava ? -0.5 : Math.sin(x * 0.02) * Math.cos(z * 0.02) * 2;
    groundPos.setY(i, height);
    const color = isLava ? new THREE.Color(0xff2200) : new THREE.Color(0x1a0505);
    groundColors.push(color.r, color.g, color.b);
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3));
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.name = 'hellscape-lava-ground';
  ground.userData.planeName = 'hellscape-lava-ground';
  ground.position.y = floorY;
  ground.frustumCulled = false;
  group.add(ground);
  registerFadeMaterial(groundMat);

  // Flash overlay for damage feedback
  const flashGeo = new THREE.PlaneGeometry(200, 200);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const flashPlane = new THREE.Mesh(flashGeo, flashMat);
  flashPlane.name = 'hellscape-lava-damage-flash-plane';
  flashPlane.userData.planeName = 'hellscape-lava-damage-flash-plane';
  flashPlane.rotation.x = -Math.PI / 2;
  flashPlane.position.y = floorY + 0.1;
  flashPlane.frustumCulled = false;
  group.add(flashPlane);
  biomeTerrainMaterials.push({ type: 'overlay', material: flashMat });

  // Lava glow plane (below ground for glow effect)
  const glowGeo = new THREE.PlaneGeometry(200, 200);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const glowPlane = new THREE.Mesh(glowGeo, glowMat);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = floorY - 0.6;
  glowPlane.frustumCulled = false;
  group.add(glowPlane);
  registerFadeMaterial(glowMat);

  // Fire particles
  const fireCount = 150;
  const firePositions = new Float32Array(fireCount * 3);
  const fireVelocities = [];
  const fireLifetimes = [];
  for (let i = 0; i < fireCount; i++) {
    firePositions[i * 3] = (Math.random() - 0.5) * 80;
    firePositions[i * 3 + 1] = floorY - 0.3;
    firePositions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    fireVelocities.push({
      x: (Math.random() - 0.5) * 0.1,
      y: 0.5 + Math.random() * 1.5,
      z: (Math.random() - 0.5) * 0.1
    });
    fireLifetimes.push(Math.random() * 2);
  }
  const fireGeo = new THREE.BufferGeometry();
  fireGeo.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));
  const fireMat = new THREE.PointsMaterial({
    color: 0xff6600,
    size: 0.8,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });
  const fire = new THREE.Points(fireGeo, fireMat);
  fire.frustumCulled = false;
  group.add(fire);
  registerFadeMaterial(fireMat);

  // Ember particles (smaller, faster)
  const emberCount = 200;
  const emberPositions = new Float32Array(emberCount * 3);
  const emberVelocities = [];
  for (let i = 0; i < emberCount; i++) {
    emberPositions[i * 3] = (Math.random() - 0.5) * 100;
    emberPositions[i * 3 + 1] = floorY + Math.random() * 30;
    emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
    emberVelocities.push({
      x: (Math.random() - 0.5) * 0.2,
      y: 0.3 + Math.random() * 0.5,
      z: (Math.random() - 0.5) * 0.2
    });
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  const emberMat = new THREE.PointsMaterial({
    color: 0xffaa00,
    size: 0.3,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  embers.frustumCulled = false;
  group.add(embers);
  registerFadeMaterial(emberMat);

  // Rocky outcrops (procedural)
  const createRock = () => {
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshBasicMaterial({ color: 0x2a1515, flatShading: true });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.scale.set(
      1 + Math.random() * 2,
      1 + Math.random() * 3,
      1 + Math.random() * 2
    );
    rock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    registerFadeMaterial(rockMat);
    return rock;
  };

  const rockPositions = [
    { x: 15, z: 15 },
    { x: -20, z: 10 },
    { x: 10, z: -25 },
    { x: -15, z: -20 },
    { x: 25, z: -10 },
    { x: -30, z: 25 },
  ];
  rockPositions.forEach((pos) => {
    const rock = createRock();
    rock.position.set(pos.x, floorY + 1, pos.z);
    group.add(rock);
  });

  // Ash particles (floating grey particles)
  const ashCount = 100;
  const ashPositions = new Float32Array(ashCount * 3);
  for (let i = 0; i < ashCount; i++) {
    ashPositions[i * 3] = (Math.random() - 0.5) * 80;
    ashPositions[i * 3 + 1] = Math.random() * 20 + floorY;
    ashPositions[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  const ashGeo = new THREE.BufferGeometry();
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPositions, 3));
  const ashMat = new THREE.PointsMaterial({
    color: 0x666666,
    size: 0.2,
    transparent: true,
    opacity: 0.4
  });
  const ash = new THREE.Points(ashGeo, ashMat);
  ash.frustumCulled = false;
  group.add(ash);
  registerFadeMaterial(ashMat);

  // Geyser particles (periodic bursts)
  const GEYSER_PARTICLE_COUNT = 50;
  const geyserPos = new Float32Array(GEYSER_PARTICLE_COUNT * 3);
  const geyserSizes = new Float32Array(GEYSER_PARTICLE_COUNT);
  const geyserParticleData = [];
  for (let i = 0; i < GEYSER_PARTICLE_COUNT; i++) {
    geyserPos[i * 3] = 0;
    geyserPos[i * 3 + 1] = -1000; // Hidden initially
    geyserPos[i * 3 + 2] = 0;
    geyserSizes[i] = 0;
    geyserParticleData.push({
      active: false,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      life: 0,
      maxLife: 0
    });
  }
  const geyserGeo = new THREE.BufferGeometry();
  geyserGeo.setAttribute('position', new THREE.BufferAttribute(geyserPos, 3));
  geyserGeo.setAttribute('aSize', new THREE.BufferAttribute(geyserSizes, 1));
  const geyserMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xff6600) }
    },
    vertexShader: `
      attribute float aSize;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(uColor, alpha * 0.8);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const geyserParticles = new THREE.Points(geyserGeo, geyserMat);
  geyserParticles.frustumCulled = false;
  group.add(geyserParticles);
  registerFadeMaterial(geyserMat);

  // Flame pillars (3 locations with constant particle streams)
  const FLAME_PILLAR_PARTICLES = 60;
  const TOTAL_FLAME_PILLAR_PARTICLES = FLAME_PILLAR_PARTICLES * 3;
  const flamePillarPos = new Float32Array(TOTAL_FLAME_PILLAR_PARTICLES * 3);
  const flamePillarSizes = new Float32Array(TOTAL_FLAME_PILLAR_PARTICLES);
  const flameParticleData = [];
  const pillarDefs = [
    { x: -20, z: -15, height: 15, speed: 8 },
    { x: 15, z: -20, height: 12, speed: 10 },
    { x: 0, z: 20, height: 18, speed: 7 }
  ];

  const initFlameParticle = (i) => {
    const pillarIdx = Math.floor(i / FLAME_PILLAR_PARTICLES);
    const pillar = pillarDefs[pillarIdx];
    const pd = flameParticleData[i];
    pd.pillarIdx = pillarIdx;
    pd.t = Math.random();
    pd.speed = 0.8 + Math.random() * 0.4;
    pd.driftPhase = Math.random() * Math.PI * 2;
    pd.driftAmp = 0.3 + Math.random() * 0.4;

    const i3 = i * 3;
    flamePillarPos[i3] = pillar.x + (Math.random() - 0.5) * 2;
    flamePillarPos[i3 + 1] = floorY + pd.t * pillar.height;
    flamePillarPos[i3 + 2] = pillar.z + (Math.random() - 0.5) * 2;
    flamePillarSizes[i] = 2.0;
  };

  for (let i = 0; i < TOTAL_FLAME_PILLAR_PARTICLES; i++) {
    flameParticleData.push({
      pillarIdx: 0,
      t: 0,
      speed: 1,
      driftPhase: 0,
      driftAmp: 0
    });
    initFlameParticle(i);
  }

  const flamePillarGeo = new THREE.BufferGeometry();
  flamePillarGeo.setAttribute('position', new THREE.BufferAttribute(flamePillarPos, 3));
  flamePillarGeo.setAttribute('aSize', new THREE.BufferAttribute(flamePillarSizes, 1));
  const flamePillarMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xff4400) }
    },
    vertexShader: `
      attribute float aSize;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (200.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(uColor, alpha * 0.9);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const flamePillars = new THREE.Points(flamePillarGeo, flamePillarMat);
  flamePillars.frustumCulled = false;
  group.add(flamePillars);
  registerFadeMaterial(flamePillarMat);

  // Geyser state
  let lastGeyserTime = 0;
  const geyserInterval = 2000; // ms between bursts
  const activeGeyserParticles = [];

  const createGeyserBurst = (now) => {
    const burstX = (Math.random() - 0.5) * 60;
    const burstZ = (Math.random() - 0.5) * 60;

    for (let i = 0; i < 15; i++) {
      const particleIdx = activeGeyserParticles.length % GEYSER_PARTICLE_COUNT;
      const pd = geyserParticleData[particleIdx];
      pd.active = true;
      pd.x = burstX + (Math.random() - 0.5) * 2;
      pd.y = floorY;
      pd.z = burstZ + (Math.random() - 0.5) * 2;
      pd.vx = (Math.random() - 0.5) * 4;
      pd.vy = 10 + Math.random() * 8;
      pd.vz = (Math.random() - 0.5) * 4;
      pd.life = 0;
      pd.maxLife = 1.5 + Math.random() * 1;

      if (activeGeyserParticles.length < GEYSER_PARTICLE_COUNT) {
        activeGeyserParticles.push(particleIdx);
      }
    }
  };

  // Animation update
  group.userData.update = (now, dt) => {
    const time = now * 0.001;
    const dtSec = dt * 0.001;

    // Fire particles
    const firePos = fireGeo.attributes.position.array;
    for (let i = 0; i < fireCount; i++) {
      const idx = i * 3;
      firePos[idx] += fireVelocities[i].x * dt;
      firePos[idx + 1] += fireVelocities[i].y * dt;
      firePos[idx + 2] += fireVelocities[i].z * dt;
      fireLifetimes[i] += dtSec;

      if (fireLifetimes[i] > 2 || firePos[idx + 1] > floorY + 10) {
        firePos[idx] = (Math.random() - 0.5) * 80;
        firePos[idx + 1] = floorY - 0.3;
        firePos[idx + 2] = (Math.random() - 0.5) * 80;
        fireLifetimes[i] = 0;
      }
    }
    fireGeo.attributes.position.needsUpdate = true;

    // Ember particles
    const emberPosArr = emberGeo.attributes.position.array;
    for (let i = 0; i < emberCount; i++) {
      const idx = i * 3;
      emberPosArr[idx] += emberVelocities[i].x * dt;
      emberPosArr[idx + 1] += emberVelocities[i].y * dt;
      emberPosArr[idx + 2] += emberVelocities[i].z * dt;

      if (emberPosArr[idx + 1] > floorY + 30) {
        emberPosArr[idx] = (Math.random() - 0.5) * 100;
        emberPosArr[idx + 1] = floorY;
        emberPosArr[idx + 2] = (Math.random() - 0.5) * 100;
      }
    }
    emberGeo.attributes.position.needsUpdate = true;

    // Ash particles
    const ashPosArr = ashGeo.attributes.position.array;
    for (let i = 0; i < ashCount; i++) {
      const idx = i * 3;
      ashPosArr[idx] += Math.sin(time + i) * 0.02;
      ashPosArr[idx + 1] += 0.01 * dt;
      ashPosArr[idx + 2] += Math.cos(time + i) * 0.02;

      if (ashPosArr[idx] > 40) ashPosArr[idx] = -40;
      if (ashPosArr[idx] < -40) ashPosArr[idx] = 40;
      if (ashPosArr[idx + 1] > floorY + 20) ashPosArr[idx + 1] = floorY;
      if (ashPosArr[idx + 2] > 40) ashPosArr[idx + 2] = -40;
      if (ashPosArr[idx + 2] < -40) ashPosArr[idx + 2] = 40;
    }
    ashGeo.attributes.position.needsUpdate = true;

    // Geyser trigger and update
    if (now - lastGeyserTime > geyserInterval) {
      createGeyserBurst(now);
      lastGeyserTime = now;
    }

    const geyserPosArr = geyserGeo.attributes.position.array;
    let activeCount = 0;
    for (let i = geyserParticleData.length - 1; i >= 0; i--) {
      const p = geyserParticleData[i];
      if (!p.active) continue;

      p.life += dtSec;

      if (p.life > p.maxLife) {
        p.active = false;
        continue;
      }

      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.z += p.vz * dtSec;
      p.vy -= 18 * dtSec;

      const idx = activeCount * 3;
      geyserPosArr[idx] = p.x;
      geyserPosArr[idx + 1] = p.y;
      geyserPosArr[idx + 2] = p.z;
      activeCount++;
    }
    geyserGeo.setDrawRange(0, activeCount);
    geyserGeo.attributes.position.needsUpdate = true;

    // Flame pillar animation
    const fpPos = flamePillarGeo.attributes.position.array;
    const fpSizes = flamePillarGeo.attributes.aSize.array;
    for (let i = 0; i < TOTAL_FLAME_PILLAR_PARTICLES; i++) {
      const pd = flameParticleData[i];
      const pillar = pillarDefs[pd.pillarIdx];
      const i3 = i * 3;

      pd.t += (pd.speed * dtSec * pillar.speed) / Math.max(1, pillar.height);

      if (pd.t >= 1.0) {
        initFlameParticle(i);
      } else {
        const driftWave = Math.sin(time * 2.2 + pd.driftPhase) * pd.driftAmp * dtSec;
        fpPos[i3] += Math.cos(pd.driftPhase) * driftWave;
        fpPos[i3 + 1] += pd.speed * dtSec * pillar.speed;
        fpPos[i3 + 2] += Math.sin(pd.driftPhase) * driftWave;

        fpSizes[i] = Math.max(0.3, (1.0 - pd.t) * 3.0);
      }
    }
    flamePillarGeo.attributes.position.needsUpdate = true;
    flamePillarGeo.attributes.aSize.needsUpdate = true;
  };

  // Hellscape floor HUD height: group.position.y = 0.05
  group.position.set(26.599, 0.05, -0.486);
  group.rotation.y = 0.248; // yaw: 14.21°
}
