import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'https://unpkg.com/three@0.180.0/examples/jsm/postprocessing/SSAOPass.js';
import { buildSurroundingMeshes } from './geo.js';

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
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -300;
sun.shadow.camera.right = 300;
sun.shadow.camera.top = 300;
sun.shadow.camera.bottom = -300;
scene.add(sun, new THREE.AmbientLight(0xffffff, 0.42));

async function loadSceneConfig() {
  const res = await fetch('/viewer-assets/scene.json');
  if (!res.ok) throw new Error('scene.json missing. Run backend /api/reconstruct first.');
  return res.json();
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

  const makeWall = (w, h, tex, x, y, z, ry = 0) => {
    if (!tex) return;
    const map = new THREE.TextureLoader().load(tex);
    map.colorSpace = THREE.SRGBColorSpace;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: 0.65, metalness: 0.03 }));
    wall.position.set(x, y, z);
    wall.rotation.y = ry;
    wall.castShadow = true;
    group.add(wall);
  };

  const tex = mainBuilding.facades || {};
  makeWall(width, height, tex.front, 0, height * 0.5, depth * 0.5 + 0.05, 0);
  makeWall(width, height, tex.back, 0, height * 0.5, -depth * 0.5 - 0.05, Math.PI);
  makeWall(depth, height, tex.left, -width * 0.5 - 0.05, height * 0.5, 0, -Math.PI / 2);
  makeWall(depth, height, tex.right, width * 0.5 + 0.05, height * 0.5, 0, Math.PI / 2);

  return group;
}

function createRoadMeshes(roads, imageWidth, imageHeight, worldSize) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#636a72', roughness: 0.97, metalness: 0.02 });
  for (const road of roads) {
    const pts = road.polygon.map(([x, y]) => new THREE.Vector2(((x / imageWidth) - 0.5) * worldSize, ((y / imageHeight) - 0.5) * worldSize));
    if (pts.length < 4) continue;
    const shape = new THREE.Shape(pts);
    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = 0.05;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

async function init() {
  const cfg = await loadSceneConfig();

  const satTex = new THREE.TextureLoader().load(cfg.satellitePath);
  satTex.colorSpace = THREE.SRGBColorSpace;
  const worldSize = 700;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize, worldSize, 1, 1),
    new THREE.MeshStandardMaterial({ map: satTex, roughness: 1, metalness: 0.0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const [buildRes, roadsRes] = await Promise.all([
    fetch(cfg.footprintsPath),
    fetch(cfg.roadsPath)
  ]);
  const footprints = await buildRes.json();
  const roads = await roadsRes.json();

  const surroundings = buildSurroundingMeshes(footprints, {
    imageWidth: 8192,
    imageHeight: 8192,
    worldSize,
    material: new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9, metalness: 0.05 })
  });
  scene.add(surroundings);
  scene.add(createRoadMeshes(roads, 8192, 8192, worldSize));
  scene.add(createMainBuilding(cfg.mainBuilding));

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
