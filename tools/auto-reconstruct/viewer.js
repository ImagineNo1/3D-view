import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { createWallTexture, createRoofTexture, createRoadTexture, createGrassTexture } from '/textures.js';

const root = document.getElementById('root');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
(root || document.body).appendChild(renderer.domElement);
console.log('[viewer] renderer initialized and canvas appended');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9fb3c8, 0.0012);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 20000);
camera.position.set(500, 380, 500);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;

const hemi = new THREE.HemisphereLight(0xb8d1ff, 0x6a5f4d, 0.55);
scene.add(hemi);
scene.add(new THREE.AmbientLight(0xffffff, 0.7));

const sun = new THREE.DirectionalLight(0xffffff, 1.35);
sun.position.set(600, 900, 400);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -1200;
sun.shadow.camera.right = 1200;
sun.shadow.camera.top = 1200;
sun.shadow.camera.bottom = -1200;
scene.add(sun);
const fillSun = new THREE.DirectionalLight(0xffffff, 1);
fillSun.position.set(-450, 500, -320);
scene.add(fillSun);

function makeSky() {
  const geo = new THREE.SphereGeometry(9000, 48, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color('#7fa8d6') },
      bottomColor: { value: new THREE.Color('#d6e5f5') },
      offset: { value: 350 },
      exponent: { value: 0.85 }
    },
    vertexShader: `varying vec3 vWorldPosition; void main(){ vec4 worldPosition = modelMatrix * vec4(position, 1.0); vWorldPosition = worldPosition.xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);}`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main(){ float h = normalize(vWorldPosition + offset).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h,0.0), exponent), 0.0)),1.0); }`
  });
  scene.add(new THREE.Mesh(geo, mat));
}
makeSky();

const wallTex = createWallTexture();
const roofTex = createRoofTexture();
const roadTex = createRoadTexture();
const grassTex = createGrassTexture();

async function loadSceneData() {
  const sceneCandidates = ['/viewer-assets/scene.json', './scene.json', 'scene.json'];
  let sceneRes = null;
  for (const path of sceneCandidates) {
    const res = await fetch(path);
    console.log(`[viewer] scene fetch ${path} -> ${res.status}`);
    if (res.ok) { sceneRes = res; break; }
  }
  if (!sceneRes) throw new Error('scene.json not loaded');
  const cfg = await sceneRes.json();
  if (!cfg || !Array.isArray(cfg.buildings)) throw new Error('scene.json invalid: missing buildings array');
  const imgRes = await fetch(cfg.imagery.path);
  if (!imgRes.ok) throw new Error(`imagery not loaded: ${cfg.imagery.path}`);
  const imageryBuffer = new Uint8Array(await imgRes.arrayBuffer());
  return { cfg, imageryBuffer };
}

function buildGround(cfg, imageryBuffer) {
  const { width, height } = cfg.imagery;
  const rgba = new Uint8Array(imageryBuffer);
  const tex = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;

  const tw = cfg.terrain.width;
  const th = cfg.terrain.height;
  const terrainArr = cfg.terrain.heightmap;
  const disp = new Uint8Array(tw * th);
  for (let i = 0; i < disp.length; i += 1) disp[i] = Math.max(0, Math.min(255, Math.round((terrainArr[i] / 15) * 255)));
  const dispTex = new THREE.DataTexture(disp, tw, th, THREE.RedFormat, THREE.UnsignedByteType);
  dispTex.format = THREE.RedFormat;
  dispTex.type = THREE.UnsignedByteType;
  dispTex.needsUpdate = true;

  const terrainWidthMeters = cfg.imagery.width * cfg.imagery.pixelSizeMeters;
  const terrainHeightMeters = cfg.imagery.height * cfg.imagery.pixelSizeMeters;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(terrainWidthMeters, terrainHeightMeters, tw - 1, th - 1),
    new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 1,
      metalness: 0,
      displacementMap: dispTex,
      displacementScale: 15
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const green = new THREE.Mesh(
    new THREE.PlaneGeometry(terrainWidthMeters * 1.05, terrainHeightMeters * 1.05),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 })
  );
  green.rotation.x = -Math.PI / 2;
  green.position.y = -0.4;
  green.receiveShadow = true;
  scene.add(green);
}

function makeBuildingMesh(b) {
  const shape = new THREE.Shape();
  b.footprint.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  });
  const geom = new THREE.ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, b.height, 0);

  const mat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.78,
    metalness: 0.05,
    emissive: 0x000000
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const roof = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.9, metalness: 0.04, color: new THREE.Color().setHSL(Math.random(), 0.2, 0.6) })
  );
  roof.rotation.x = -Math.PI / 2;
  roof.position.y = b.height + 0.2;
  roof.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh, roof);
  return group;
}

function buildRoadGrid(cfg) {
  const roads = new THREE.Group();
  const terrainWidthMeters = cfg.imagery.width * cfg.imagery.pixelSizeMeters;
  const terrainHeightMeters = cfg.imagery.height * cfg.imagery.pixelSizeMeters;

  for (let i = -5; i <= 5; i += 1) {
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(12, terrainHeightMeters), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 1 }));
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(i * 90, 0.03, 0);
    roads.add(roadX);

    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(terrainWidthMeters, 12), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 1 }));
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(0, 0.03, i * 90);
    roads.add(roadZ);
  }
  scene.add(roads);
}

function setMode(mode) {
  if (mode === 'night') {
    sun.intensity = 0.18;
    hemi.intensity = 0.18;
    scene.fog.color.set('#28395f');
    renderer.toneMappingExposure = 0.65;
    scene.traverse((obj) => {
      if (obj.material?.emissive) obj.material.emissive.setHex(0x334466);
    });
  } else if (mode === 'sunset') {
    sun.intensity = 0.9;
    hemi.intensity = 0.4;
    scene.fog.color.set('#cc8f66');
    renderer.toneMappingExposure = 0.95;
  } else {
    sun.intensity = 1.35;
    hemi.intensity = 0.55;
    scene.fog.color.set('#9fb3c8');
    renderer.toneMappingExposure = 1.0;
    scene.traverse((obj) => {
      if (obj.material?.emissive) obj.material.emissive.setHex(0x000000);
    });
  }
}

function addModeUI() {
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:10px;right:10px;z-index:10;background:#111a;border-radius:8px;padding:8px;color:#fff;font:12px sans-serif;';
  panel.innerHTML = '<button data-m="day">Day</button> <button data-m="sunset">Sunset</button> <button data-m="night">Night</button>';
  panel.querySelectorAll('button').forEach((b) => {
    b.style.margin = '2px';
    b.onclick = () => setMode(b.getAttribute('data-m'));
  });
  document.body.appendChild(panel);
}

async function init() {
  console.log('[viewer] init started');
  const { cfg, imageryBuffer } = await loadSceneData();
  buildGround(cfg, imageryBuffer);
  buildRoadGrid(cfg);

  const group = new THREE.Group();
  for (const b of cfg.buildings) group.add(makeBuildingMesh(b));
  scene.add(group);
  console.log(`[viewer] terrain added=true buildings added=${group.children.length}`);

  if (cfg.buildings.length === 0) {
    const fail = new THREE.Mesh(new THREE.BoxGeometry(50, 100, 50), new THREE.MeshStandardMaterial({ color: 'red' }));
    fail.position.y = 50;
    scene.add(fail);
  }

  addModeUI();
  setMode('day');

  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());
  camera.position.copy(center).addScalar(size * 0.7);
  camera.lookAt(center);
  controls.target.copy(center);
  camera.updateProjectionMatrix();

  function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
  console.log('[viewer] render loop started');
}

init().catch((e) => {
  console.error('viewer failed', e);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
