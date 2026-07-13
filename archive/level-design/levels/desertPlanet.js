import * as THREE from 'three';

import {
  applyTerrainHeights,
  buildExtrudedProfileMesh,
  buildProfileMesh,
  createClearanceOverlay,
  createGradientCanvasTexture,
  createInstancedMesh,
  createLevelRoot,
  createShot
} from '../shared/biomeUtils.js';

export const levelMeta = {
  id: 'desert-planet',
  name: 'Desert Planet',
  dominantColors: ['#c28a4a', '#e1be84', '#f0dfb5', '#7ec9c6'],
  targetBudgets: '12-18 draws'
};

export async function loadLevel(ctx) {
  const tracker = ctx.resourceTracker;
  const groups = createLevelRoot();

  const sky = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.SphereGeometry(150, 32, 24)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createGradientCanvasTexture(tracker, 8, 1024, [
        [0.00, '#6a4227'],
        [0.20, '#8d5a38'],
        [0.42, '#b3774a'],
        [0.70, '#d4a776'],
        [1.00, '#efd4a2']
      ]),
      side: THREE.BackSide
    })))
  ));
  sky.frustumCulled = false;
  groups.skyGroup.add(sky);

  const sunDisc = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.CircleGeometry(22, 32)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      color: 0xffdf9b,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    })))
  ));
  sunDisc.position.set(-36, 19, -116);
  groups.skyGroup.add(sunDisc);

  const dustHalo = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.CircleGeometry(38, 36)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      color: 0xf0b267,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })))
  ));
  dustHalo.position.set(-36, 19, -118);
  groups.skyGroup.add(dustHalo);

  const terrainGeometry = tracker.trackGeometry(new THREE.PlaneGeometry(150, 150, 78, 78));
  applyTerrainHeights(terrainGeometry, (x, _y, z) => {
    const radial = Math.sqrt((x * 0.92) ** 2 + (z * 0.86) ** 2);
    const bowl = Math.max(0, radial - 10) * 0.032;
    const waves = Math.sin(x * 0.074) * 0.34 + Math.cos(z * 0.058) * 0.26;
    const terrace = Math.floor((bowl + waves + 2.1) * 2.5) / 2.5 - 1.05;
    const sideLift = Math.max(0, Math.abs(x) - 14) * 0.062;
    const frontLip = Math.max(0, z + 18) * 0.04;
    const ridgeLift = Math.max(0, -z - 34) * 0.026;
    const poolValley = Math.max(0, 11 - Math.abs(x + 4)) * Math.max(0, -z - 12) * -0.0026;
    return terrace + sideLift + ridgeLift + frontLip + poolValley;
  });
  const terrain = tracker.trackObject(new THREE.Mesh(
    terrainGeometry,
    tracker.trackMaterial(new THREE.ShaderMaterial({
      uniforms: {
        uLightDir: { value: new THREE.Vector3(-0.6, 1.0, 0.35).normalize() },
        uBase: { value: new THREE.Color('#8c5b35') },
        uHighlight: { value: new THREE.Color('#c58e57') },
        uShadow: { value: new THREE.Color('#57311b') }
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
          float heightTint = clamp((vWorldPosition.y + 1.5) * 0.18, 0.0, 1.0);
          float distanceFade = clamp((-vWorldPosition.z - 6.0) / 118.0, 0.0, 1.0);
          float contour = 0.5 + 0.5 * sin(vWorldPosition.x * 0.07 + vWorldPosition.z * 0.06);
          vec3 color = mix(uShadow, uBase, light * 0.86 + contour * 0.14);
          color = mix(color, uHighlight, heightTint * 0.62 + distanceFade * 0.18);
          color += vec3(0.08, 0.05, 0.02) * distanceFade;
          gl_FragColor = vec4(color, 1.0);
        }
      `
    }))
  ));
  terrain.rotation.x = -Math.PI / 2;
  groups.terrainGroup.add(terrain);

  const terrainTint = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(150, 150)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createGradientCanvasTexture(tracker, 4, 512, [
        [0.0, 'rgba(255,220,180,0.00)'],
        [0.28, 'rgba(255,208,154,0.10)'],
        [0.66, 'rgba(184,122,72,0.14)'],
        [1.0, 'rgba(0,0,0,0.00)']
      ]),
      transparent: true,
      depthWrite: false
    })))
  ));
  terrainTint.rotation.x = -Math.PI / 2;
  terrainTint.position.set(0, 0.08, -8);
  groups.terrainGroup.add(terrainTint);

  const backMesa = tracker.trackObject(buildExtrudedProfileMesh([
    [-84, 12], [-64, 18], [-38, 12], [-14, 16], [10, 24], [40, 16], [68, 18], [84, 13]
  ], -122, 0x8d623d, tracker, { left: -84, right: 84, depth: 16 }));
  const midMesa = tracker.trackObject(buildExtrudedProfileMesh([
    [-84, 16], [-62, 24], [-36, 18], [-8, 22], [18, 31], [46, 24], [72, 20], [84, 14]
  ], -102, 0x694429, tracker, { left: -84, right: 84, depth: 18 }));
  const farShelf = tracker.trackObject(buildExtrudedProfileMesh([
    [-84, 8], [-66, 15], [-44, 13], [-16, 18], [12, 15], [34, 20], [58, 14], [84, 10]
  ], -86, 0xa06a41, tracker, { left: -84, right: 84, depth: 12 }));
  const duneShadow = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(150, 20)),
    ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createGradientCanvasTexture(tracker, 4, 256, [
        [0.0, 'rgba(0,0,0,0.00)'],
        [0.26, 'rgba(82,46,24,0.10)'],
        [0.74, 'rgba(82,46,24,0.18)'],
        [1.0, 'rgba(0,0,0,0.00)']
      ]),
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    })))
  ));
  duneShadow.position.set(0, 4.6, -58);
  groups.landmarksGroup.add(backMesa, midMesa, farShelf, duneShadow);

  buildDesertShelves(tracker, groups.landmarksGroup);
  buildDustBands(tracker, ctx, groups.fxGroup);

  buildPools(tracker, ctx, groups.terrainGroup);
  buildDesertProps(tracker, ctx, groups.propsGroup);
  buildRibcageLandmark(tracker, groups.landmarksGroup);

  const clearanceOverlay = createClearanceOverlay(tracker);
  groups.debugGroup.add(clearanceOverlay);

  return {
    root: groups.root,
    debug: { clearanceOverlay },
    fallbackActive: false,
    sceneOptions: {
      background: 0x85542f,
      fog: new THREE.Fog(0xb17a4c, 38, 154),
      cameraStart: [0, 1.6, 2.5],
      cameraLookAt: [0, 1.8, -28],
      heroShot: createShot([-18, 9.6, 36], [32, 12, -82], 42),
      gameplayShot: createShot([0, 1.6, 0], [0, 1.8, -36], 70)
    },
    update(_dt, elapsed) {
      groups.terrainGroup.children.forEach((child) => {
        if (child.material?.uniforms?.uTime) {
          child.material.uniforms.uTime.value = elapsed;
        }
      });
      dustHalo.material.opacity = 0.12 + Math.sin(elapsed * 0.06 + 0.4) * 0.02;
    },
    dispose() {}
  };
}

function buildPools(tracker, ctx, parent) {
  const poolMaterial = ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color('#7fe1d7') },
      uColorB: { value: new THREE.Color('#f0fff6') },
      uRim: { value: new THREE.Color('#b3fff7') },
      uGlow: { value: new THREE.Color('#68cfc5') }
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
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uRim;
      uniform vec3 uGlow;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p * vec2(1.05, 0.8));
        float swirl = 0.5 + 0.5 * sin((p.x + p.y) * 26.0 - uTime * 0.8);
        float ripple = 0.5 + 0.5 * sin(r * 34.0 - uTime * 1.1);
        float pool = 1.0 - smoothstep(0.36, 0.50, r);
        float rim = smoothstep(0.52, 0.40, r) - smoothstep(0.40, 0.28, r);
        vec3 color = mix(uColorA, uColorB, swirl * 0.65 + ripple * 0.35);
        color += uGlow * ripple * 0.16;
        color += uRim * rim * 0.65;
        float alpha = smoothstep(0.54, 0.46, r);
        gl_FragColor = vec4(color * pool + uRim * rim * 0.75, alpha);
      }
    `
  })));

  const pools = [
    { x: -26, z: -16, sx: 8.0, sz: 4.8, y: 0.16 },
    { x: 18, z: -22, sx: 10.4, sz: 5.9, y: 0.28 },
    { x: -36, z: -46, sx: 9.4, sz: 5.9, y: 0.52 },
    { x: 2, z: -52, sx: 8.5, sz: 4.8, y: 0.62 },
    { x: 28, z: -62, sx: 7.6, sz: 4.2, y: 0.78 },
    { x: -8, z: 10, sx: 6.2, sz: 3.8, y: 0.12 },
    { x: 36, z: -38, sx: 5.6, sz: 3.1, y: 0.44 }
  ];

  pools.forEach((pool, index) => {
    const pit = tracker.trackObject(new THREE.Mesh(
      tracker.trackGeometry(new THREE.CircleGeometry(1, 28)),
      tracker.trackMaterial(new THREE.MeshBasicMaterial({ color: 0x7c5939 }))
    ));
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(pool.x, pool.y - 0.06, pool.z);
    pit.scale.set(pool.sx * 1.16, 1, pool.sz * 1.16);
    parent.add(pit);

    const rim = tracker.trackObject(new THREE.Mesh(
      tracker.trackGeometry(new THREE.CircleGeometry(1, 28)),
      tracker.trackMaterial(new THREE.MeshBasicMaterial({ color: 0xa88154 }))
    ));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(pool.x, pool.y, pool.z);
    rim.scale.set(pool.sx, 1, pool.sz);
    parent.add(rim);

    const surface = tracker.trackObject(new THREE.Mesh(
      tracker.trackGeometry(new THREE.CircleGeometry(1, 28)),
      tracker.trackMaterial(poolMaterial.clone())
    ));
    surface.material.uniforms.uTime.value = index * 0.2;
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(pool.x, pool.y + 0.06, pool.z);
    surface.scale.set(pool.sx * 0.82, 1, pool.sz * 0.82);
    parent.add(surface);
  });
}

function buildDesertProps(tracker, ctx, parent) {
  const rockTransformsA = [];
  const rockTransformsB = [];
  const coralTransforms = [];
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -8 - i * 6.2;
    rockTransformsA.push({
      position: [side * (26 + (i % 3) * 5), 0.8, z],
      rotation: [0.12, ctx.rng.range(-Math.PI, Math.PI), ctx.rng.range(-0.18, 0.18)],
      scale: [1.3 + (i % 3) * 0.35, 0.8 + (i % 2) * 0.2, 1.0 + (i % 2) * 0.3]
    });
  }
  for (let i = 0; i < 20; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -20 - i * 5.6;
    rockTransformsB.push({
      position: [side * (14 + (i % 4) * 4.2), 0.55, z],
      rotation: [0, ctx.rng.range(-Math.PI, Math.PI), 0],
      scale: [0.8 + (i % 4) * 0.2, 1.0 + (i % 3) * 0.18, 0.7 + (i % 2) * 0.25]
    });
  }
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -4 - i * 4.8;
    coralTransforms.push({
      position: [side * (22 + (i % 5) * 3.6), 1.0, z],
      rotation: [0, ctx.rng.range(-Math.PI, Math.PI), 0],
      scale: [0.75 + (i % 3) * 0.18, 1.0 + (i % 4) * 0.22, 0.75 + (i % 2) * 0.12]
    });
  }

  const rocksA = createInstancedMesh(
    new THREE.DodecahedronGeometry(1.4, 0),
    new THREE.MeshBasicMaterial({ color: 0x8d623c }),
    rockTransformsA,
    tracker
  );
  const rocksB = createInstancedMesh(
    new THREE.BoxGeometry(2.3, 1.3, 1.8),
    new THREE.MeshBasicMaterial({ color: 0x6f4d2f }),
    rockTransformsB,
    tracker
  );
  const corals = createInstancedMesh(
    new THREE.ConeGeometry(0.56, 3.1, 5),
    new THREE.MeshBasicMaterial({ color: 0x915673 }),
    coralTransforms,
    tracker
  );
  const coralsBlue = createInstancedMesh(
    new THREE.ConeGeometry(0.42, 2.1, 5),
    new THREE.MeshBasicMaterial({ color: 0x4db7bc }),
    coralTransforms.map((transform, index) => ({
      position: [transform.position[0] + (index % 2 === 0 ? 0.9 : -0.7), 0.7, transform.position[2] + 0.6],
      rotation: transform.rotation,
      scale: [transform.scale[0] * 0.72, transform.scale[1] * 0.72, transform.scale[2] * 0.72]
    })),
    tracker
  );
  parent.add(rocksA, rocksB, corals, coralsBlue);
}

function buildRibcageLandmark(tracker, parent) {
  const landmark = tracker.trackObject(new THREE.Group());
  const boneMaterial = tracker.trackMaterial(new THREE.ShaderMaterial({
    uniforms: {
      uLightDir: { value: new THREE.Vector3(-0.4, 1.0, 0.2).normalize() },
      uBase: { value: new THREE.Color('#9f7d59') },
      uHighlight: { value: new THREE.Color('#c7a980') },
      uShadow: { value: new THREE.Color('#6e553e') }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldNormal;
      uniform vec3 uLightDir;
      uniform vec3 uBase;
      uniform vec3 uHighlight;
      uniform vec3 uShadow;
      void main() {
        float light = clamp(dot(normalize(vWorldNormal), normalize(uLightDir)) * 0.5 + 0.5, 0.0, 1.0);
        vec3 color = mix(uShadow, uBase, light);
        color = mix(color, uHighlight, pow(light, 1.8) * 0.45);
        gl_FragColor = vec4(color, 1.0);
      }
    `
  }));

  const spine = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.CylinderGeometry(0.52, 0.74, 38, 8)),
    boneMaterial
  ));
  spine.rotation.z = Math.PI / 2;
  spine.position.set(10, 13.8, -2);
  landmark.add(spine);

  for (let i = 0; i < 10; i++) {
    const rib = tracker.trackObject(new THREE.Mesh(
      tracker.trackGeometry(new THREE.TorusGeometry(9.0 + (i % 2) * 0.8, 0.52, 7, 20, Math.PI * 1.18)),
      boneMaterial
    ));
    rib.rotation.z = Math.PI / 2;
    rib.rotation.y = -0.48 + i * 0.1;
    rib.position.set(i * 3.2 - 7, 8.2 + (i % 2) * 0.8, -1.2 - i * 0.45);
    landmark.add(rib);
  }

  for (let i = 0; i < 4; i++) {
    const leg = tracker.trackObject(new THREE.Mesh(
      tracker.trackGeometry(new THREE.CylinderGeometry(0.32, 0.46, 14 + i * 1.6, 6)),
      boneMaterial
    ));
    leg.position.set(i * 6.0 - 2, 2.8 + i * 0.3, -4.8 + i * 0.8);
    leg.rotation.z = 0.28 - i * 0.08;
    landmark.add(leg);
  }

  const skull = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.DodecahedronGeometry(4.0, 0)),
    boneMaterial
  ));
  skull.position.set(26.5, 13.8, 1.2);
  skull.scale.set(2.0, 1.45, 1.18);
  landmark.add(skull);

  const jaw = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.BoxGeometry(7.2, 1.8, 4.4)),
    boneMaterial
  ));
  jaw.position.set(29.0, 10.2, 1.8);
  jaw.rotation.z = -0.12;
  landmark.add(jaw);

  const shadow = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.CircleGeometry(1, 40)),
    tracker.trackMaterial(new THREE.MeshBasicMaterial({
      map: createShadowTexture(tracker),
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    }))
  ));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -6.8, 0);
  shadow.scale.set(30, 1, 16);
  landmark.add(shadow);

  landmark.position.set(34, 8.0, -84);
  landmark.rotation.y = -0.92;
  landmark.scale.setScalar(2.12);
  parent.add(landmark);
}

function buildDesertShelves(tracker, parent) {
  const shelfMaterial = tracker.trackMaterial(new THREE.MeshBasicMaterial({ color: 0x8d623c }));
  const darkShelfMaterial = tracker.trackMaterial(new THREE.MeshBasicMaterial({ color: 0x6d472b }));
  const shelves = [
    { x: -32, y: 3.8, z: -40, sx: 15, sy: 5.2, sz: 20, ry: 0.18, mat: shelfMaterial },
    { x: -52, y: 5.8, z: -80, sx: 22, sy: 8.0, sz: 28, ry: 0.32, mat: darkShelfMaterial },
    { x: 36, y: 4.2, z: -52, sx: 18, sy: 5.8, sz: 24, ry: -0.24, mat: shelfMaterial },
    { x: 56, y: 7.4, z: -94, sx: 22, sy: 9.0, sz: 30, ry: -0.36, mat: darkShelfMaterial }
  ];

  shelves.forEach((shelf) => {
    const mesa = tracker.trackObject(new THREE.Mesh(
      tracker.trackGeometry(new THREE.CylinderGeometry(1.0, 1.25, 1.0, 6)),
      shelf.mat
    ));
    mesa.scale.set(shelf.sx, shelf.sy, shelf.sz);
    mesa.position.set(shelf.x, shelf.y, shelf.z);
    mesa.rotation.y = shelf.ry;
    parent.add(mesa);
  });
}

function buildDustBands(tracker, ctx, parent) {
  const dustMaterial = ctx.registerFadeMaterial(tracker.trackMaterial(new THREE.MeshBasicMaterial({
    map: createGradientCanvasTexture(tracker, 8, 512, [
      [0.0, 'rgba(255,214,168,0.00)'],
      [0.30, 'rgba(255,220,178,0.18)'],
      [0.68, 'rgba(214,160,102,0.16)'],
      [1.0, 'rgba(255,214,168,0.00)']
    ]),
    transparent: true,
    opacity: 0.78,
    depthWrite: false
  })));
  const bandA = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(122, 20)),
    dustMaterial
  ));
  bandA.position.set(-8, 12, -88);
  const bandB = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.PlaneGeometry(110, 16)),
    tracker.trackMaterial(dustMaterial.clone())
  ));
  bandB.position.set(12, 8, -64);
  bandB.material.opacity = 0.52;
  parent.add(bandA, bandB);
}

function createShadowTexture(tracker) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx2d = canvas.getContext('2d');
  const gradient = ctx2d.createRadialGradient(128, 128, 18, 128, 128, 112);
  gradient.addColorStop(0.0, 'rgba(0,0,0,0.62)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  gradient.addColorStop(1.0, 'rgba(0,0,0,0.0)');
  ctx2d.fillStyle = gradient;
  ctx2d.fillRect(0, 0, 256, 256);
  const texture = tracker.trackTexture(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
