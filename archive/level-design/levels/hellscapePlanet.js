import * as THREE from 'three';

import {
  applyTerrainHeights,
  buildExtrudedProfileMesh,
  buildProfileMesh,
  createClearanceOverlay,
  createGradientCanvasTexture,
  createInstancedMesh,
  createLevelRoot,
  createRibbonGeometry,
  createShot
} from '../shared/biomeUtils.js';

export const levelMeta = {
  id: 'hellscape-planet',
  name: 'Hellscape Planet',
  dominantColors: ['#110706', '#2a0d09', '#ff5b1f', '#ffb347'],
  targetBudgets: '14-18 draws'
};

export async function loadLevel(ctx) {
  const tracker = ctx.resourceTracker;
  const groups = createLevelRoot();
  const ashParticles = buildAshParticles(tracker, ctx.rng);

  const sky = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.SphereGeometry(150, 32, 24)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createGradientCanvasTexture(tracker, 8, 1024, [
        [0.00, '#130505'],
        [0.18, '#300907'],
        [0.42, '#74170d'],
        [0.66, '#e43a15'],
        [0.84, '#ff9540'],
        [1.00, '#ffd37a']
      ]),
      side: THREE.BackSide
    })))
  ));
  sky.frustumCulled = false;
  groups.skyGroup.add(sky);

  const terrainGeometry = tracker.trackGeometry(new THREE.PlaneGeometry(150, 150, 78, 78));
  applyTerrainHeights(terrainGeometry, (x, _y, z) => {
    const ravine = Math.max(0, 12 - Math.abs(x * 0.76)) * -0.04;
    const wallRise = Math.max(0, Math.abs(x) - 12) * 0.1;
    const rough = Math.sin(x * 0.12) * 0.24 + Math.cos(z * 0.08) * 0.18;
    const forwardRise = Math.max(0, -z - 38) * 0.034;
    const sideTeeth = Math.max(0, Math.abs(x) - 20) * Math.max(0, -z - 20) * 0.001;
    return ravine + wallRise + rough + forwardRise + sideTeeth;
  });
  const terrain = tracker.trackObject(new THREE.Mesh(
    terrainGeometry,
    tracker.trackMaterial(new THREE.ShaderMaterial({
      uniforms: {
        uLightDir: { value: new THREE.Vector3(0.25, 1.0, -0.35).normalize() },
        uBase: { value: new THREE.Color('#1a0906') },
        uHighlight: { value: new THREE.Color('#412017') },
        uShadow: { value: new THREE.Color('#080303') }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        uniform vec3 uLightDir;
        uniform vec3 uBase;
        uniform vec3 uHighlight;
        uniform vec3 uShadow;
        void main() {
          float light = clamp(dot(normalize(vWorldNormal), normalize(uLightDir)) * 0.5 + 0.5, 0.0, 1.0);
          float depth = clamp((-vWorldPosition.z - 6.0) / 110.0, 0.0, 1.0);
          vec3 color = mix(uShadow, uBase, light * 0.9);
          color = mix(color, uHighlight, depth * 0.48);
          gl_FragColor = vec4(color, 1.0);
        }
      `
    }))
  ));
  terrain.rotation.x = -Math.PI / 2;
  groups.terrainGroup.add(terrain);

  const emberGlow = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(150, 150)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createGradientCanvasTexture(tracker, 4, 512, [
        [0.0, 'rgba(255,126,60,0.00)'],
        [0.30, 'rgba(255,90,36,0.06)'],
        [0.68, 'rgba(120,20,12,0.20)'],
        [1.0, 'rgba(0,0,0,0.00)']
      ]),
      transparent: true,
      depthWrite: false
    })))
  ));
  emberGlow.rotation.x = -Math.PI / 2;
  emberGlow.position.set(0, 0.08, -8);
  groups.terrainGroup.add(emberGlow);

  const ravineGlow = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(24, 124)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createGradientCanvasTexture(tracker, 4, 512, [
        [0.0, 'rgba(255,160,76,0.00)'],
        [0.20, 'rgba(255,92,34,0.20)'],
        [0.70, 'rgba(255,92,34,0.11)'],
        [1.0, 'rgba(255,160,76,0.00)']
      ]),
      transparent: true,
      depthWrite: false
    })))
  ));
  ravineGlow.rotation.x = -Math.PI / 2;
  ravineGlow.position.set(0, 0.1, -34);
  groups.terrainGroup.add(ravineGlow);

  const lavaMaterial = ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCore: { value: new THREE.Color('#ffd874') },
      uHot: { value: new THREE.Color('#ff6d22') },
      uCrust: { value: new THREE.Color('#4b130d') }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uCore;
      uniform vec3 uHot;
      uniform vec3 uCrust;
      void main() {
        float flow = 0.5 + 0.5 * sin(vUv.y * 28.0 - uTime * 1.3 + vUv.x * 12.0);
        float seam = 0.5 + 0.5 * sin(vUv.y * 12.0 - uTime * 0.6 - vUv.x * 5.0);
        float edge = smoothstep(0.0, 0.16, vUv.x) + (1.0 - smoothstep(0.84, 1.0, vUv.x));
        vec3 color = mix(uCrust, mix(uHot, uCore, flow), 0.86);
        color += uHot * edge * 0.45;
        float alpha = 0.86;
        gl_FragColor = vec4(color, alpha);
      }
    `
  })));
  const lavaRiver = tracker.trackObject(new THREE.Mesh(
    createRibbonGeometry([
      new THREE.Vector3(-6, 0, -14),
      new THREE.Vector3(-2, 0, -24),
      new THREE.Vector3(8, 0, -36),
      new THREE.Vector3(-4, 0, -52),
      new THREE.Vector3(5, 0, -66),
      new THREE.Vector3(-2, 0, -82),
      new THREE.Vector3(0, 0, -98)
    ], [4.8, 10.4], tracker, 0.14),
    lavaMaterial
  ));
  groups.terrainGroup.add(lavaRiver);

  const lavaOcean = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(96, 12)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uHot: { value: new THREE.Color('#ff6f28') },
        uBright: { value: new THREE.Color('#ffd86d') }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uHot;
        uniform vec3 uBright;
        void main() {
          float waves = 0.5 + 0.5 * sin(vUv.x * 16.0 + uTime * 0.8);
          float streak = 0.5 + 0.5 * sin(vUv.x * 42.0 - uTime * 1.4);
          vec3 color = mix(uHot, uBright, waves * 0.55 + streak * 0.45);
          gl_FragColor = vec4(color, 0.76);
        }
      `
    })))
  ));
  lavaOcean.position.set(0, 6.4, -118);
  groups.terrainGroup.add(lavaOcean);

  const farRidge = tracker.trackObject(buildExtrudedProfileMesh([
    [-84, 8], [-60, 15], [-36, 12], [-10, 15], [14, 14], [34, 22], [56, 18], [84, 13]
  ], -122, 0x3f160f, tracker, { left: -84, right: 84, depth: 12 }));
  const calderaRidge = tracker.trackObject(buildExtrudedProfileMesh([
    [-84, 10], [-62, 16], [-38, 14], [-14, 12], [0, 8], [12, 16], [26, 28], [42, 22], [66, 18], [84, 12]
  ], -110, 0x2f100c, tracker, { left: -84, right: 84, depth: 14 }));
  const leftWall = tracker.trackObject(buildExtrudedProfileMesh([
    [-36, 6], [-24, 12], [-12, 18], [6, 14], [20, 10], [36, 8]
  ], -76, 0x34130f, tracker, { left: -36, right: 36, depth: 14 }));
  leftWall.position.x = -48;
  leftWall.rotation.y = 0.22;
  const rightWall = tracker.trackObject(buildExtrudedProfileMesh([
    [-36, 8], [-18, 12], [0, 20], [18, 18], [28, 12], [36, 8]
  ], -76, 0x34130f, tracker, { left: -36, right: 36, depth: 14 }));
  rightWall.position.x = 48;
  rightWall.rotation.y = -0.22;
  groups.landmarksGroup.add(farRidge, calderaRidge, leftWall, rightWall);

  const plume = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(16, 34)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createPlumeTexture(tracker),
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    })))
  ));
  plume.position.set(3, 24, -102);
  groups.landmarksGroup.add(plume);

  const craterGlow = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.CircleGeometry(8, 32)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      color: 0xff7a2a,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })))
  ));
  craterGlow.position.set(3, 11.5, -102);
  groups.landmarksGroup.add(craterGlow);

  buildDeadForest(tracker, ctx, groups.propsGroup);
  buildBasaltTeeth(tracker, ctx, groups.propsGroup);

  const moonA = buildMoon(tracker, 34, [-38, 40, -116], '#ffd873', '#b24f1c');
  const moonB = buildMoon(tracker, 24, [30, 44, -122], '#ffd288', '#c36422');
  const moonC = buildMoon(tracker, 16, [0, 28, -94], '#ffb55c', '#813012');
  groups.skyGroup.add(moonA.group, moonB.group, moonC.group);

  groups.fxGroup.add(ashParticles.points);

  const clearanceOverlay = createClearanceOverlay(tracker);
  groups.debugGroup.add(clearanceOverlay);

  return {
    root: groups.root,
    debug: { clearanceOverlay },
    fallbackActive: false,
    sceneOptions: {
      background: 0x240907,
      fog: new THREE.FogExp2(0x250906, 0.0094),
      cameraStart: [0, 1.6, 2.5],
      cameraLookAt: [0, 1.8, -28],
      heroShot: createShot([2, 6.6, 28], [2, 12, -102], 48),
      gameplayShot: createShot([0, 1.6, 0], [0, 2.0, -34], 70)
    },
    update(dt, elapsed) {
      lavaMaterial.uniforms.uTime.value = elapsed;
      lavaOcean.material.uniforms.uTime.value = elapsed;
      plume.material.opacity = 0.78 + Math.sin(elapsed * 0.24) * 0.05;
      craterGlow.material.opacity = 0.48 + Math.sin(elapsed * 0.4) * 0.06;
      ravineGlow.material.opacity = 0.26 + Math.sin(elapsed * 0.3 + 0.6) * 0.05;
      moonA.glow.material.opacity = 0.22 + Math.sin(elapsed * 0.12) * 0.02;
      moonB.glow.material.opacity = 0.18 + Math.sin(elapsed * 0.15 + 0.8) * 0.02;
      moonC.glow.material.opacity = 0.14 + Math.sin(elapsed * 0.18 + 1.4) * 0.02;
      updateAshParticles(ashParticles, dt);
    },
    dispose() {}
  };
}

function buildDeadForest(tracker, ctx, parent) {
  const transforms = [];
  for (let i = 0; i < 24; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -6 - i * 5.8;
    transforms.push({
      position: [side * (18 + (i % 4) * 4.5), 4.0 + (i % 2) * 0.6, z],
      rotation: [0, ctx.rng.range(-0.9, 0.9), side * 0.12],
      scale: [0.9 + (i % 4) * 0.16, 1.0 + (i % 3) * 0.18, 0.9 + (i % 2) * 0.1]
    });
  }

  const trunk = createInstancedMesh(
    new THREE.CylinderGeometry(0.18, 0.34, 7.4, 5),
    new THREE.MeshBasicMaterial({ color: 0x090404 }),
    transforms,
    tracker
  );
  const branchA = createInstancedMesh(
    new THREE.CylinderGeometry(0.08, 0.16, 3.4, 4),
    new THREE.MeshBasicMaterial({ color: 0x090404 }),
    transforms.map((transform) => ({
      position: [transform.position[0] + 1.0, transform.position[1] + 2.2, transform.position[2]],
      rotation: [0.2, transform.rotation[1] + 0.6, 1.0],
      scale: [0.9, 0.9, 0.9]
    })),
    tracker
  );
  const branchB = createInstancedMesh(
    new THREE.CylinderGeometry(0.08, 0.15, 2.8, 4),
    new THREE.MeshBasicMaterial({ color: 0x090404 }),
    transforms.map((transform) => ({
      position: [transform.position[0] - 0.9, transform.position[1] + 2.8, transform.position[2] + 0.2],
      rotation: [-0.3, transform.rotation[1] - 0.8, -0.9],
      scale: [0.9, 0.9, 0.9]
    })),
    tracker
  );
  parent.add(trunk, branchA, branchB);
}

function buildBasaltTeeth(tracker, ctx, parent) {
  const transforms = [];
  for (let i = 0; i < 28; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -10 - i * 4.6;
    transforms.push({
      position: [side * (10 + (i % 5) * 4.0), 1.8 + (i % 2) * 0.2, z],
      rotation: [0, ctx.rng.range(-Math.PI, Math.PI), side * 0.1],
      scale: [0.9 + (i % 3) * 0.12, 1.1 + (i % 4) * 0.2, 0.9 + (i % 2) * 0.1]
    });
  }
  const teeth = createInstancedMesh(
    new THREE.ConeGeometry(0.9, 4.6, 5),
    new THREE.MeshBasicMaterial({ color: 0x1e0b08 }),
    transforms,
    tracker
  );
  parent.add(teeth);
}

function buildMoon(tracker, size, position, coreColor, craterColor) {
  const disc = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(size, size)),
    tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createMoonTexture(tracker, coreColor, craterColor),
      transparent: true,
      depthWrite: false
    }))
  ));
  disc.position.set(...position);
  const glow = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.CircleGeometry(size * 0.72, 32)),
    tracker.trackMaterial(new THREE.MeshBasicMaterial({
      color: coreColor,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }))
  ));
  glow.position.set(position[0], position[1], position[2] - 1);
  const group = tracker.trackObject(new THREE.Group());
  group.add(disc, glow);
  return { group, glow };
}

function createMoonTexture(tracker, coreColor, craterColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx2d = canvas.getContext('2d');
  const gradient = ctx2d.createRadialGradient(190, 180, 40, 256, 256, 226);
  gradient.addColorStop(0.0, '#fff2ba');
  gradient.addColorStop(0.3, coreColor);
  gradient.addColorStop(1.0, '#e48b3d');
  ctx2d.fillStyle = gradient;
  ctx2d.beginPath();
  ctx2d.arc(256, 256, 220, 0, Math.PI * 2);
  ctx2d.fill();
  const craters = [
    [122, 130, 42], [252, 114, 22], [344, 188, 30], [216, 280, 28], [310, 320, 24]
  ];
  craters.forEach(([x, y, r]) => {
    ctx2d.fillStyle = craterColor;
    ctx2d.globalAlpha = 0.36;
    ctx2d.beginPath();
    ctx2d.arc(x, y, r, 0, Math.PI * 2);
    ctx2d.fill();
  });
  ctx2d.globalAlpha = 1;
  const texture = tracker.trackTexture(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPlumeTexture(tracker) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx2d = canvas.getContext('2d');
  const lobes = [
    [256, 860, 140, 120, 'rgba(255,180,92,0.70)'],
    [246, 700, 120, 130, 'rgba(255,104,46,0.56)'],
    [270, 520, 100, 120, 'rgba(192,44,18,0.40)'],
    [250, 340, 88, 110, 'rgba(120,18,10,0.22)']
  ];
  lobes.forEach(([x, y, w, h, color]) => {
    const gradient = ctx2d.createRadialGradient(x, y, 20, x, y, w);
    gradient.addColorStop(0.0, color);
    gradient.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    ctx2d.fillStyle = gradient;
    ctx2d.beginPath();
    ctx2d.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx2d.fill();
  });
  const texture = tracker.trackTexture(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildAshParticles(tracker, rng) {
  const positions = new Float32Array(180 * 3);
  const velocities = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) {
    const i3 = i * 3;
    positions[i3] = rng.range(-70, 70);
    positions[i3 + 1] = rng.range(4, 44);
    positions[i3 + 2] = rng.range(-108, 18);
    velocities[i3] = rng.range(-0.12, 0.12);
    velocities[i3 + 1] = rng.range(0.1, 0.22);
    velocities[i3 + 2] = rng.range(0.08, 0.18);
  }
  const geometry = tracker.trackGeometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = tracker.trackObject(new THREE.Points(
    geometry,
    tracker.trackMaterial(new THREE.PointsMaterial({
      color: 0xffa759,
      size: 0.26,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    }))
  ));
  return { points, positions, velocities };
}

function updateAshParticles(state, dt) {
  const { positions, velocities } = state;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += velocities[i] * dt;
    positions[i + 1] += velocities[i + 1] * dt;
    positions[i + 2] += velocities[i + 2] * dt;
    if (positions[i + 1] > 46) {
      positions[i] = THREE.MathUtils.randFloatSpread(140);
      positions[i + 1] = THREE.MathUtils.randFloat(2, 10);
      positions[i + 2] = THREE.MathUtils.randFloat(-108, 18);
    }
  }
  state.points.geometry.attributes.position.needsUpdate = true;
}
