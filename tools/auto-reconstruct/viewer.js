import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/SSAOPass.js';
import { buildSurroundingMeshes } from './geo.js';
console.log('[viewer] viewer.js loaded');

const root = document.getElementById('root');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#b8c8da');

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 10000);
camera.position.set(180, 140, 180);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 20, 0);

scene.add(new THREE.HemisphereLight(0xd8e8ff, 0xb09f8b, 0.45));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(120, 240, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -300;
sun.shadow.camera.right = 300;
sun.shadow.camera.top = 300;
sun.shadow.camera.bottom = -300;
scene.add(sun, new THREE.AmbientLight(0xffffff, 0.42));

async function loadSceneConfig() {
  console.log('[viewer] fetching scene.json');
  const res = await fetch('/viewer-assets/scene.json');
  if (!res.ok) {
    return {
      safeMode: true,
      mapCenter: { lat: 0, lng: 0, zoom: 2 },
      satellitePath: null,
      footprintsPath: null,
      roadsPath: null,
      mainBuilding: null
    };
  }
  return res.json();
}

function makeGradientTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#7fa2c9');
  g.addColorStop(0.5, '#89aa7f');
  g.addColorStop(1, '#6e8d5e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 30; i += 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect((i * 17) % 256, (i * 31) % 256, 40, 8);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function loadTextureOrFallback(path) {
  return new Promise((resolve) => {
    if (!path) {
      resolve(makeGradientTexture());
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(
      path,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      },
      undefined,
      () => resolve(makeGradientTexture())
    );
  });
}

function createMainBuilding(mainBuilding) {
  if (!mainBuilding) return new THREE.Group();
  const group = new THREE.Group();
  const width = mainBuilding.width || 24;
  const depth = mainBuilding.depth || 20;
  const height = mainBuilding.height || 40;

  const core = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: '#d4dce8', roughness: 0.78, metalness: 0.08 })
  );
  core.position.set(0, height * 0.5, 0);
  core.castShadow = true;
  core.receiveShadow = true;
  group.add(core);
  return group;
}

function defaultRoads() {
  return [{
    polygon: [[0, 250], [700, 250], [700, 280], [0, 280], [0, 250]]
  }];
}

function createRoadMeshes(roads, imageWidth, imageHeight, worldSize) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#636a72', roughness: 0.97, metalness: 0.02 });
  const source = Array.isArray(roads) && roads.length ? roads : defaultRoads();

  for (const road of source) {
    const pts = (road.polygon || []).map(([x, y]) => new THREE.Vector2(((x / imageWidth) - 0.5) * worldSize, ((y / imageHeight) - 0.5) * worldSize));
    if (pts.length < 4) continue;
    const shape = new THREE.Shape(pts);
    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = 0.05;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  if (!group.children.length) {
    const fallback = new THREE.Mesh(new THREE.PlaneGeometry(worldSize, 20), mat);
    fallback.rotation.x = -Math.PI / 2;
    fallback.position.y = 0.05;
    group.add(fallback);
  }

  return group;
}

async function fetchJsonOr(path, fallback) {
  if (!path) return fallback;
  try {
    const res = await fetch(path);
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

function defaultFootprints() {
  return [
    { id: 0, polygon: [[160, 160], [310, 160], [310, 320], [160, 320], [160, 160]], height_m: 18 },
    { id: 1, polygon: [[360, 220], [480, 220], [480, 360], [360, 360], [360, 220]], height_m: 24 }
  ];
}

async function init() {
  const cfg = await loadSceneConfig();

  const satTex = await loadTextureOrFallback(cfg.satellitePath);
  const worldSize = 700;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize, worldSize, 1, 1),
    new THREE.MeshStandardMaterial({ map: satTex, roughness: 1, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const [footprints, roads] = await Promise.all([
    fetchJsonOr(cfg.footprintsPath, defaultFootprints()),
    fetchJsonOr(cfg.roadsPath, defaultRoads())
  ]);

  const surroundings = buildSurroundingMeshes(Array.isArray(footprints) && footprints.length ? footprints : defaultFootprints(), {
    imageWidth: 1024,
    imageHeight: 1024,
    worldSize,
    material: new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9, metalness: 0.05 })
  });
  scene.add(surroundings);
  scene.add(createRoadMeshes(roads, 1024, 1024, worldSize));
  scene.add(createMainBuilding(cfg.mainBuilding));
  const buildingCount = surroundings.children.length;
  console.log(`[viewer] objects after loading=${scene.children.length} buildings=${buildingCount}`);
  if (buildingCount === 0) {
    console.warn('WARNING: scene.json is EMPTY');
    const redPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide })
    );
    redPlane.rotation.x = -Math.PI / 2;
    redPlane.position.y = 0.2;
    scene.add(redPlane);
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
  ssao.kernelRadius = 14;
  ssao.minDistance = 0.002;
  ssao.maxDistance = 0.12;
  composer.addPass(ssao);

  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    composer.render();
  };
  animate();
}

init().catch((err) => {
  console.error(err);
  const hud = document.getElementById('hud');
  hud.textContent = `Failed: ${err.message}`;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
