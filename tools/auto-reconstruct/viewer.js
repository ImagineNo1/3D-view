import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
(document.getElementById('root') || document.body).appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#b9d0e8');

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 50000);
camera.position.set(240, 220, 240);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xd9e7ff, 0x6f634e, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.position.set(320, 600, 240);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

function fallbackTerrainTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#7fae6e');
  g.addColorStop(1, '#57785a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`failed ${path}: ${res.status}`);
  return res.json();
}

async function tryLoadScene() {
  const candidates = ['/api/reconstruct', './scene.json', 'scene.json'];
  for (const p of candidates) {
    try {
      return await loadJson(p);
    } catch {}
  }
  return null;
}

async function tryLoadTexture(dataUrl, fallback) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return fallback;
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
    const texture = new THREE.Texture(img);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  } catch {
    return fallback;
  }
}

function buildDisplacementTexture(sceneCfg) {
  const w = sceneCfg?.terrain?.width || 128;
  const h = sceneCfg?.terrain?.height || 128;
  const heights = sceneCfg?.terrain?.heights || [];
  const bytes = new Uint8Array(w * h);

  if (heights.length >= w * h) {
    let max = 0;
    for (const v of heights) max = Math.max(max, Number(v) || 0);
    const inv = max > 0 ? 255 / max : 1;
    for (let i = 0; i < w * h; i += 1) bytes[i] = Math.round((Number(heights[i]) || 0) * inv);
  } else {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        bytes[y * w + x] = Math.round((x / Math.max(1, w - 1)) * 8);
      }
    }
  }

  const tex = new THREE.DataTexture(bytes, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function addBuildings(sceneCfg) {
  const group = new THREE.Group();
  const buildings = Array.isArray(sceneCfg?.buildings) ? sceneCfg.buildings : [];

  for (const building of buildings) {
    if (!Array.isArray(building.footprint) || building.footprint.length < 3) continue;

    const shape = new THREE.Shape();
    building.footprint.forEach(([x, z], i) => {
      if (i === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    });

    const height = Number(building.height) || 10;
    const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, height, 0);

    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({ color: '#d4d6dc', roughness: 0.88, metalness: 0.04 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (group.children.length === 0) {
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(20, 20, 20),
      new THREE.MeshStandardMaterial({ color: 'red' })
    );
    cube.position.y = 10;
    group.add(cube);
  }

  scene.add(group);
  return group;
}

function addRoads(sceneCfg) {
  const roads = Array.isArray(sceneCfg?.roads) ? sceneCfg.roads : [];
  const group = new THREE.Group();
  for (const road of roads) {
    if (!Array.isArray(road?.points) || road.points.length < 2) continue;
    const positions = road.points.map(([x, z]) => new THREE.Vector3(x, 0.25, z));
    const geom = new THREE.BufferGeometry().setFromPoints(positions);
    const line = new THREE.Line(
      geom,
      new THREE.LineBasicMaterial({ color: '#222222' })
    );
    group.add(line);
  }
  scene.add(group);
  return group;
}

async function init() {
  const payload = await tryLoadScene();
  if (!payload) throw new Error('No payload');

  const cfg = {
    ...payload.scene,
    imagery: payload.imagery,
    terrainPng: payload.terrain,
    roads: payload.roads,
    bounds: payload.bounds
  };
  console.log("[viewer] payload scene:", payload?.scene && {
    terrain: payload.scene.terrain && {
      width: payload.scene.terrain.width,
      height: payload.scene.terrain.height,
      worldSizeMeters: payload.scene.terrain.worldSizeMeters,
      maxHeightMeters: payload.scene.terrain.maxHeightMeters,
      resolutionX: payload.scene.terrain.resolutionX,
      resolutionY: payload.scene.terrain.resolutionY
    },
    bounds: payload.scene.bounds
  });
  console.log("[viewer] payload root bounds:", payload?.bounds || null);

  console.log(
    "[viewer] imagery base64 length:",
    typeof payload.imagery === "string" ? payload.imagery.length : null
  );

  const worldSize = cfg?.terrain?.worldSizeMeters || 500;
  const terrainResX = cfg?.terrain?.resolutionX || 128;
  const terrainResY = cfg?.terrain?.resolutionY || 128;
  console.log("[viewer] worldSize:", worldSize);
  console.log("[viewer] terrain resolution:", terrainResX, terrainResY);

  const fallback = fallbackTerrainTexture();
  const texture = await tryLoadTexture(cfg?.imagery, fallback);
  const dispMap = buildDisplacementTexture(cfg || {});

  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize, worldSize, terrainResX, terrainResY),
    new THREE.MeshStandardMaterial({
      map: texture,
      displacementMap: dispMap,
      displacementScale: Number(cfg?.terrain?.maxHeightMeters) || 12,
      roughness: 0.95,
      metalness: 0
    })
  );
  console.log("[viewer] terrain mesh created:", {
    worldSize,
    displacementScale: Number(cfg?.terrain?.maxHeightMeters) || 12,
    hasTexture: !!texture,
    hasDisplacementMap: !!dispMap
  });
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  scene.add(terrain);

  const group = addBuildings(cfg || {});
  addRoads(cfg || {});

  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.isEmpty() ? new THREE.Vector3(0, 0, 0) : bounds.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  camera.lookAt(center);

  function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

init().catch(() => {
  const fail = new THREE.Mesh(
    new THREE.BoxGeometry(30, 30, 30),
    new THREE.MeshStandardMaterial({ color: 'red' })
  );
  fail.position.y = 15;
  scene.add(fail);
  renderer.render(scene, camera);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
