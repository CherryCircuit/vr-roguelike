// ============================================================
//  BIOME: Hellscape Lava
//  Volcanic landscape with lava river, rocks, and flame pillars
//  Extracted from biome-scenes.js (restored version)
// ============================================================

import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

export function buildHellscapeLavaScene(group, deps) {
  const { registerFadeMaterial, floorMaterial, biomeTerrainMaterials } = deps;
  const floorHeight = (floorMaterial && floorMaterial.userData && floorMaterial.userData.floorHeight) || -0.01;
  const floorY = floorHeight;  // Player stands on riverbanks at correct height
  const valleyWidth = 35.0;

  // ========================================
  // 1. LIGHTING (CRITICAL)
  // ========================================
  // Red moonlight with shadows
  const moonLight = new THREE.DirectionalLight(0xff3333, 2.5);
  moonLight.position.set(20, 30, -100);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.width = 512;
  moonLight.shadow.mapSize.height = 512;
  moonLight.shadow.camera.near = 0.5;
  moonLight.shadow.camera.far = 500;
  moonLight.shadow.camera.left = -100;
  moonLight.shadow.camera.right = 100;
  moonLight.shadow.camera.top = 100;
  moonLight.shadow.camera.bottom = -100;
  group.add(moonLight);

  // Ambient light removed (moonLight provides sufficient illumination)

  // Lava glow point light removed (lava river shader provides glow)

  // ========================================
  // TERRAIN (existing logic)
  // ========================================
  // OPTIMIZED: Reduced from 200x200 (40,401 verts) to 100x100 (10,201 verts)
  // Visual impact: Slightly less smooth terrain, but acceptable for hellscape
  const geometry = new THREE.PlaneGeometry(300, 300, 50, 50);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const riverX = Math.sin(z * 0.03) * 15.0;
    const distToRiver = Math.abs(x - riverX);
    const riverWidth = 5.0;
    const distFromCenter = Math.abs(x);
    let height = 0;
    const valleyFloorHeight = 0.0;  // Fixed: was 1.5, causing camera to appear below ground
    if (distFromCenter > valleyWidth) {
      const mountainFactor = (distFromCenter - valleyWidth) / 15.0;
      let mHeight = 0;
      mHeight += Math.abs(Math.sin(x * 0.05) * Math.cos(z * 0.04)) * 15.0;
      mHeight += Math.abs(Math.sin(z * 0.08 + 1.0)) * 10.0;
      mHeight += Math.abs(Math.cos(x * 0.12 - z * 0.08)) * 6.0;
      mHeight += (Math.random() * 3.0);
      height = valleyFloorHeight + mHeight * Math.min(mountainFactor, 1.0);
    } else {
      height = valleyFloorHeight;
      height += (Math.sin(x * 0.5) * Math.cos(z * 0.5)) * 0.3;
      if (distToRiver < riverWidth) {
        height = -1.0;
      } else if (distToRiver < riverWidth + 3.0) {
        height = Math.min(height, valleyFloorHeight - (riverWidth + 3.0 - distToRiver) * 0.5);
      }
    }
    positions.setY(i, height);
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x110505,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true,
    onBeforeCompile: (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vPosition; varying float vElevation; uniform float uTime;`);
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vPosition = position; vElevation = position.y;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vPosition; varying float vElevation; uniform float uTime;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissive_fragment>', `float lavaThreshold = 0.5; if (vElevation < lavaThreshold) { } else { float distToLava = vElevation - lavaThreshold; float glowReflection = smoothstep(5.0, 0.0, distToLava); float pulse = sin(uTime * 0.8 + vPosition.x * 0.5 + vPosition.z * 0.5) * 0.5 + 0.5; totalEmissiveRadiance = vec3(0.6, 0.1, 0.0) * glowReflection * pulse * 1.5; } #include <emissive_fragment>`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', `float lavaThreshold = 0.5; if (vElevation < lavaThreshold) { vec3 lavaColorBase = vec3(1.0, 0.45, 0.05); vec3 lavaColorBright = vec3(1.0, 0.7, 0.3); float pulse = sin(uTime * 0.8 + vPosition.x * 0.5 + vPosition.z * 0.5) * 0.5 + 0.5; float glow = 0.7 + 0.3 * pulse; vec3 finalLavaColor = mix(lavaColorBase, lavaColorBright, glow); gl_FragColor = vec4(finalLavaColor * 1.5, 0.9); } else { gl_FragColor = vec4( outgoingLight, diffuseColor.a ); }`);
      material.userData.shader = shader;
    }
  });

  const terrain = new THREE.Mesh(geometry, material);
  terrain.name = 'hellscape-terrain';
  terrain.receiveShadow = true;
  terrain.frustumCulled = false; // Prevent disappearing when looking down
  terrain.position.y = floorY;
  terrain.position.x = -10.0;  // Shift terrain left so player spawns on riverbank (not riverbed)
  terrain.position.z = 0.0;
  group.add(terrain);

  // ========================================
  // DEDICATED LAVA RIVER PLANE
  // ========================================
  const riverWidth = 25;  // Wide enough to cover bank-to-bank (overflow hidden by terrain)
  const riverLength = 350;
  const riverGeo = new THREE.PlaneGeometry(riverWidth, riverLength, 16, 32);
  riverGeo.rotateX(-Math.PI / 2);

  // Curve the plane to follow the river path
  const riverPositions = riverGeo.attributes.position;
  for (let i = 0; i < riverPositions.count; i++) {
    const localX = riverPositions.getX(i);
    const localZ = riverPositions.getZ(i);
    // River follows sin(z * 0.03) * 15 - 10 (matches terrain offset of -10)
    const worldZ = localZ;
    const riverCenterX = Math.sin(worldZ * 0.03) * 15.0 - 10.0;
    riverPositions.setX(i, localX + riverCenterX);
  }

  const lavaRiverMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        // Flowing lava effect
        float flow = vUv.y * 3.0 + uTime * 0.3;
        float noise1 = sin(flow * 2.0 + vPos.x * 0.5) * 0.5 + 0.5;
        float noise2 = sin(flow * 4.0 - vPos.z * 0.3 + 1.5) * 0.5 + 0.5;
        float noise3 = cos(flow * 1.5 + vPos.x * 0.8 - vPos.z * 0.2) * 0.5 + 0.5;
        float combined = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;

        // Lava colors: dark red base, bright orange-yellow hotspots
        vec3 darkLava = vec3(0.6, 0.05, 0.0);
        vec3 brightLava = vec3(1.0, 0.5, 0.0);
        vec3 hotLava = vec3(1.0, 0.8, 0.2);

        vec3 col = mix(darkLava, brightLava, combined);
        // Add bright hotspots
        float hotspot = pow(noise1, 3.0);
        col = mix(col, hotLava, hotspot * 0.6);

        // No edge fade - solid bank-to-bank, overflow hidden by terrain walls
        float alpha = 0.95;

        gl_FragColor = vec4(col * 1.2, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const lavaRiver = new THREE.Mesh(riverGeo, lavaRiverMat);
  lavaRiver.name = 'hellscape-lava-river';
  lavaRiver.position.y = -0.70; // World Y=-2.25 (group Y=-1.55, so -2.25-(-1.55)=-0.70)
  lavaRiver.position.z = 3.0;   // Shift forward so world range covers z:-130 to z:61 (group z:-88 to z:103)
  lavaRiver.frustumCulled = false; // Prevent disappearing when looking around
  lavaRiver.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200); // Large bounding sphere to prevent culling
  lavaRiver.renderOrder = 1; // Render above terrain
  lavaRiver.onBeforeRender = () => {}; // Force render every frame
  group.add(lavaRiver);

  // Lava river point lights removed

  // =======================================
  // 3. DEAD TREES (GLB models)
  // =======================================




  // ========================================
  // 3. DEAD TREES (GLB models)
  // ========================================
  const gltfLoader = new GLTFLoader();
  const treeMeshes = [];

  function loadAndPlaceTree(url, positions) {
    gltfLoader.load(url, (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      // Base scale correction for Blender export (models often export large)
      model.scale.setScalar(0.005);  // Trees max height should be ~13 world units
      model.updateMatrixWorld(true);

      for (const pos of positions) {
        const clone = model.clone();
        const scale = 0.8 + Math.random() * 1.2;
        clone.position.set(pos.x, pos.y, pos.z);
        clone.rotation.set(
          (Math.random() - 0.5) * 0.2,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.2
        );
        clone.scale.setScalar(scale);
        // Cap tree height at Y=13
        clone.updateMatrixWorld(true);
        const bbox = new THREE.Box3().setFromObject(clone);
        if (bbox.max.y > 13) {
          const shrinkFactor = 13 / bbox.max.y;
          clone.scale.multiplyScalar(shrinkFactor);
        }
        group.add(clone);
        treeMeshes.push(clone);
      }
    });
  }

  // Fixed tree positions in group space (world pos - group.position)
  // DeadTree1: 3 trees
  loadAndPlaceTree('./assets/models/DeadTree1.glb', [
    { x: -45.728, y: 0.321, z: -26.325 },
    { x: -50.390, y: 1.176, z: -63.963 },
    { x: 1.100,   y: 0.822, z: -29.656 },
  ]);
  // DeadTree2: 3 trees
  loadAndPlaceTree('./assets/models/DeadTree2.glb', [
    { x: -7.001,  y: 0.822, z: -56.803 },
    { x: -15.371, y: 0.822, z: -117.774 },
    { x: -50.590, y: 0.822, z: -118.265 },
  ]);

  // (Stars removed - jittery dots not visible from player distance)

  // ========================================
  // 5. LAVA EMBERS (400 rising from lava river, fade at Y:25)
  // ========================================
  const sparkCount = 400;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkVelocities = new Float32Array(sparkCount * 3);
  const sparkColors = new Float32Array(sparkCount * 3);

  const initSpark = (idx) => {
    const i3 = idx * 3;
    const z = (Math.random() - 0.5) * 100 - 50; // Bias toward negative Z (in front of player)
    const riverX = Math.sin(z * 0.03) * 15.0 - 10.0;  // Match terrain world-space river center
    sparkPositions[i3] = riverX + (Math.random() - 0.5) * 8;
    sparkPositions[i3 + 1] = -2.5 + Math.random() * 0.5;  // Start at river level
    sparkPositions[i3 + 2] = z;
    sparkVelocities[i3] = (Math.random() - 0.5) * 0.01;  // Gentle horizontal drift
    sparkVelocities[i3 + 1] = 0.02 + Math.random() * 0.04;  // Very slow dreamy rise
    sparkVelocities[i3 + 2] = (Math.random() - 0.5) * 0.01;
    // Color: mix of orange-red (0xff4400) and bright yellow (0xffaa00)
    const colorMix = Math.random();
    sparkColors[i3] = 1.0;  // R: always 1.0
    sparkColors[i3 + 1] = 0.27 + colorMix * 0.39;  // G: 0.27 (red-ish) to 0.67 (yellow-ish)
    sparkColors[i3 + 2] = colorMix * 0.0;  // B: 0
  };

  for (let i = 0; i < sparkCount; i++) {
    initSpark(i);
    // Stagger initial heights so they don't all start at the bottom
    sparkPositions[i * 3 + 1] = -2.5 + Math.random() * 27.5;
  }

  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.name = 'biome-hellscape-embers';
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeo.setAttribute('aColor', new THREE.BufferAttribute(sparkColors, 3));

  const sparkMat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        float height = position.y;
        vAlpha = 1.0 - smoothstep(15.0, 25.0, height);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (0.15 + vAlpha * 0.15) * (300.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 1.0, 6.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * vAlpha;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.name = 'biome-hellscape-embers';
  group.add(sparks);



  // (Flame pillars removed per Graeme's request)

  // ========================================
  // MOONS with fake glow (canvas radial gradient)
  // ========================================
  const makeRadial = (inner, outer) => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(256,256,0,256,256,256);
    g.addColorStop(0.0, inner);
    g.addColorStop(0.35, inner);
    g.addColorStop(0.6, outer);
    g.addColorStop(1.0, 'rgba(255,34,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,512,512);
    return new THREE.CanvasTexture(c);
  };

  const createMoonWithGlow = (size, color, glowInner, glowOuter, moonIndex) => {
    const mGroup = new THREE.Group();
    mGroup.name = `hellscape-moon-group-${moonIndex}`;
    const moonGeo = new THREE.IcosahedronGeometry(size, 2);
    const moonMat = new THREE.MeshBasicMaterial({ color });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.name = `hellscape-moon-${moonIndex}`;
    mGroup.add(moonMesh);
    // Fake glow via canvas radial gradient
    const glowTex = makeRadial(glowInner, glowOuter);
    const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 4, size * 4), glowMat);
    glowMesh.name = `hellscape-moon-${moonIndex}-fake-glow`;
    glowMesh.frustumCulled = false;
    mGroup.add(glowMesh);
    registerFadeMaterial(glowMat);
    return mGroup;
  };
  const moon1 = createMoonWithGlow(15, 0xaa1111, 'rgba(255,100,30,0.7)', 'rgba(255,34,0,0.3)', 1);
  moon1.position.set(20, 30, -160);
  group.add(moon1);
  const moon2 = createMoonWithGlow(11, 0x880000, 'rgba(200,50,20,0.6)', 'rgba(170,0,0,0.25)', 2);
  moon2.position.set(-50, 25, -160);
  group.add(moon2);
  const moon3 = createMoonWithGlow(8, 0x550000, 'rgba(170,40,10,0.5)', 'rgba(120,0,0,0.2)', 3);
  moon3.position.set(-30, 40, -160);
  group.add(moon3);

  // ========================================
  // SKYDOME (subtle dark red atmosphere)
  // ========================================
  const skyDomeGeo = new THREE.SphereGeometry(2400, 32, 20);
  const skyDomeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    transparent: false,
    uniforms: {},
    vertexShader: `
      varying float vNormalizedY;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormalizedY = normalize(position).y; // -1 at bottom, +1 at top
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying float vNormalizedY;
      void main() {
        // Subtle dark red gradient
        vec3 bottomColor = vec3(0.07, 0.0, 0.0);   // Very dark red at horizon
        vec3 midColor = vec3(0.13, 0.02, 0.02);    // Slightly brighter mid
        vec3 topColor = vec3(0.02, 0.0, 0.0);      // Near black at zenith
        float t = vNormalizedY * 0.5 + 0.5; // Remap to 0-1
        vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.3, t));
        col = mix(col, topColor, smoothstep(0.3, 0.8, t));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
  skyDome.name = 'hellscape-skydome';
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -2;
  group.add(skyDome);

  // ========================================
  // ANIMATION UPDATE
  // ========================================
  group.userData.update = (now, dt) => {
    const time = now * 0.001;

    // Terrain shader
    if (material.userData.shader) {
      material.userData.shader.uniforms.uTime.value = time;
    }

    // Lava river shader animation
    if (lavaRiverMat) lavaRiverMat.uniforms.uTime.value = time;

    // (Star twinkle removed)

    // Lava glow animation removed (lava river shader handles glow)

    // Lava glow intensity pulse removed

    // Update lava embers - rise slowly, respawn at river level when above Y:25
    const sparkPos = sparkGeo.attributes.position.array;
    for (let i = 0; i < sparkCount; i++) {
      const i3 = i * 3;
      sparkPos[i3] += sparkVelocities[i3];
      sparkPos[i3 + 1] += sparkVelocities[i3 + 1];
      sparkPos[i3 + 2] += sparkVelocities[i3 + 2];
      // Respawn at river level when too high
      if (sparkPos[i3 + 1] > 25) {
        initSpark(i);
      }
    }
    sparkGeo.attributes.position.needsUpdate = true;

    // (Flame pillar animation removed)
  };

  // Hellscape floor HUD height: group.position.y = 0.05
  // Shifted -Z so corridor is in front of player (player looks down -Z)
  group.position.set(11.599, -1.55, -42.0);
  group.rotation.y = 0.248; // yaw: 14.21°
}


