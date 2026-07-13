import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

export function createLevelRoot() {
  const root = new THREE.Group();
  root.name = 'levelRoot';

  const staticGroup = new THREE.Group();
  staticGroup.name = 'static';
  const terrainGroup = new THREE.Group();
  terrainGroup.name = 'terrain';
  const propsGroup = new THREE.Group();
  propsGroup.name = 'props';
  const landmarksGroup = new THREE.Group();
  landmarksGroup.name = 'landmarks';
  const fxGroup = new THREE.Group();
  fxGroup.name = 'fx';
  const skyGroup = new THREE.Group();
  skyGroup.name = 'sky';
  const debugGroup = new THREE.Group();
  debugGroup.name = 'debug';

  root.add(staticGroup, terrainGroup, propsGroup, landmarksGroup, fxGroup, skyGroup, debugGroup);
  return { root, staticGroup, terrainGroup, propsGroup, landmarksGroup, fxGroup, skyGroup, debugGroup };
}

export function createClearanceOverlay(tracker) {
  const group = new THREE.Group();
  group.name = 'clearanceOverlay';

  const radius = 60;
  const segments = 48;
  const positions = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = -Math.PI / 3 + t * (Math.PI * 2 / 3);
    positions.push(Math.sin(angle) * radius, 0.08, -Math.cos(angle) * radius);
  }
  const arcGeometry = tracker.trackGeometry(new THREE.BufferGeometry());
  arcGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const arcMaterial = tracker.trackMaterial(new THREE.LineBasicMaterial({
    color: 0xf9dc72,
    transparent: true,
    opacity: 0.7
  }));
  const arc = tracker.trackObject(new THREE.Line(arcGeometry, arcMaterial));
  group.add(arc);

  const raysGeometry = tracker.trackGeometry(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.08, 0),
    new THREE.Vector3(-Math.sin(Math.PI / 3) * radius, 0.08, -Math.cos(Math.PI / 3) * radius),
    new THREE.Vector3(0, 0.08, 0),
    new THREE.Vector3(Math.sin(Math.PI / 3) * radius, 0.08, -Math.cos(Math.PI / 3) * radius)
  ]));
  const rays = tracker.trackObject(new THREE.LineSegments(raysGeometry, arcMaterial));
  group.add(rays);

  const fill = tracker.trackObject(new THREE.Mesh(
    tracker.trackGeometry(new THREE.CircleGeometry(radius, segments, Math.PI / 6, Math.PI * 2 / 3)),
    tracker.trackMaterial(new THREE.MeshBasicMaterial({
      color: 0xf9dc72,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false
    }))
  ));
  fill.rotation.x = -Math.PI / 2;
  fill.rotation.z = Math.PI / 2;
  fill.position.y = 0.04;
  group.add(fill);

  group.visible = false;
  return group;
}

export function createGradientCanvasTexture(tracker, width, height, stops, horizontal = false) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const gradient = horizontal
    ? ctx.createLinearGradient(0, 0, width, 0)
    : ctx.createLinearGradient(0, 0, 0, height);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  const texture = tracker.trackTexture(new THREE.CanvasTexture(canvas));
  texture.needsUpdate = true;
  return texture;
}

export function createRibbonGeometry(points, widths, tracker, upY = 0.02) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.15);
  const divisions = Math.max(48, points.length * 18);
  const positions = [];
  const uvs = [];
  const indices = [];
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const point = new THREE.Vector3();

  for (let i = 0; i <= divisions; i++) {
    const t = i / divisions;
    curve.getPointAt(t, point);
    curve.getTangentAt(t, tangent);
    side.crossVectors(up, tangent).normalize();
    const width = Array.isArray(widths)
      ? THREE.MathUtils.lerp(widths[0], widths[1], t)
      : widths;
    const left = point.clone().addScaledVector(side, width * 0.5);
    const right = point.clone().addScaledVector(side, -width * 0.5);
    left.y += upY;
    right.y += upY;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    uvs.push(0, t, 1, t);
    if (i < divisions) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  const geometry = tracker.trackGeometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function applyTerrainHeights(geometry, callback) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    position.setY(i, callback(x, y, z));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function buildProfileMesh(profilePoints, z, color, tracker) {
  const shape = new THREE.Shape();
  shape.moveTo(-80, 0);
  for (const [x, y] of profilePoints) {
    shape.lineTo(x, y);
  }
  shape.lineTo(80, 0);
  shape.closePath();

  const geometry = tracker.trackGeometry(new THREE.ShapeGeometry(shape));
  const material = tracker.trackMaterial(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
  const mesh = tracker.trackObject(new THREE.Mesh(geometry, material));
  mesh.position.z = z;
  return mesh;
}

export function buildExtrudedProfileMesh(profilePoints, z, color, tracker, options = {}) {
  const {
    left = -80,
    right = 80,
    depth = 10,
    bevel = false,
    material = null
  } = options;

  const shape = new THREE.Shape();
  shape.moveTo(left, 0);
  for (const [x, y] of profilePoints) {
    shape.lineTo(x, y);
  }
  shape.lineTo(right, 0);
  shape.closePath();

  const geometry = tracker.trackGeometry(new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: bevel,
    bevelThickness: bevel ? 0.4 : 0,
    bevelSize: bevel ? 0.3 : 0,
    bevelSegments: bevel ? 1 : 0
  }));
  geometry.translate(0, 0, -depth * 0.5);

  const meshMaterial = material || tracker.trackMaterial(new THREE.MeshBasicMaterial({ color }));
  const mesh = tracker.trackObject(new THREE.Mesh(geometry, meshMaterial));
  mesh.position.z = z;
  return mesh;
}

export function createStars(tracker, count, color, size, bounds) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = THREE.MathUtils.randFloatSpread(bounds.width);
    positions[i3 + 1] = THREE.MathUtils.randFloat(bounds.minY, bounds.maxY);
    positions[i3 + 2] = THREE.MathUtils.randFloatSpread(bounds.depth);
  }
  const geometry = tracker.trackGeometry(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = tracker.trackMaterial(new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  }));
  return tracker.trackObject(new THREE.Points(geometry, material));
}

export function createShot(position, target, fov = 70) {
  return { position, target, fov };
}

export async function tryLoadGLTF(url, tracker) {
  try {
    const gltf = await gltfLoader.loadAsync(url);
    tracker.trackGLTF(gltf.scene);
    return gltf.scene;
  } catch (error) {
    console.warn(`[biome] GLTF load failed: ${url}`, error);
    return null;
  }
}

export async function createVideoTexture(url, tracker) {
  const video = document.createElement('video');
  video.src = url;
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  tracker.track(video);

  try {
    await video.play();
  } catch (error) {
    console.warn(`[biome] Video playback failed: ${url}`, error);
    return null;
  }

  const texture = tracker.trackTexture(new THREE.VideoTexture(video));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return { video, texture };
}

export function createInstancedMesh(geometry, material, transforms, tracker) {
  const mesh = tracker.trackObject(new THREE.InstancedMesh(
    tracker.trackGeometry(geometry),
    tracker.trackMaterial(material),
    transforms.length
  ));
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  for (let i = 0; i < transforms.length; i++) {
    const transform = transforms[i];
    quaternion.setFromEuler(new THREE.Euler(
      transform.rotation[0],
      transform.rotation[1],
      transform.rotation[2]
    ));
    matrix.compose(
      new THREE.Vector3(transform.position[0], transform.position[1], transform.position[2]),
      quaternion,
      new THREE.Vector3(transform.scale[0], transform.scale[1], transform.scale[2])
    );
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function scatterOutsideWedge(rng, count, radiusRange, xBias = 0) {
  const transforms = [];
  for (let i = 0; i < count; i++) {
    const side = rng.bool() ? -1 : 1;
    const angle = rng.range(Math.PI / 3 + 0.08, Math.PI - 0.35) * side;
    const radius = rng.range(radiusRange[0], radiusRange[1]);
    const x = Math.sin(angle) * radius + xBias;
    const z = -Math.cos(angle) * radius;
    transforms.push({
      position: [x, 0, z],
      rotation: [0, rng.range(-0.5, 0.5), 0],
      scale: [rng.range(0.9, 1.2), rng.range(0.9, 1.25), rng.range(0.9, 1.2)]
    });
  }
  return transforms;
}
