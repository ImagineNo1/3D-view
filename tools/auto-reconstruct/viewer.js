import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { createWallTexture, createRoofTexture, createRoadTexture, createGrassTexture } from '/textures.js';

const root = document.getElementById('root');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.physicallyCorrectLights = true;
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.display = 'block';
(root || document.body).appendChild(renderer.domElement);
console.log('[viewer] renderer initialized and canvas appended');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9ab6d4');
scene.fog = new THREE.Fog(0x9fb3c8, 800, 8000);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 40000);
camera.position.set(500, 380, 500);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableRotate = true;
controls.enableZoom = true;
controls.dampingFactor = 0.06;

const hemi = new THREE.HemisphereLight(0xb8d1ff, 0x6a5f4d, 0.4);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(600, 1000, 450);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -2000;
sun.shadow.camera.right = 2000;
sun.shadow.camera.top = 2000;
sun.shadow.camera.bottom = -2000;
scene.add(sun);

const fillSun = new THREE.DirectionalLight(0xffffff, 0.4);
fillSun.position.set(-600, 500, -550);
scene.add(fillSun);

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function cubicWeight(t) {
  const a = -0.5;
  const absT = Math.abs(t);
  if (absT <= 1) return (a + 2) * absT ** 3 - (a + 3) * absT ** 2 + 1;
  if (absT < 2) return a * absT ** 3 - (5 * a) * absT ** 2 + (8 * a) * absT - (4 * a);
  return 0;
}

function sampleBicubicChannel(src, sw, sh, x, y, channel) {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  let value = 0;
  let weightSum = 0;

  for (let m = -1; m <= 2; m += 1) {
    for (let n = -1; n <= 2; n += 1) {
      const sx = Math.min(sw - 1, Math.max(0, fx + m));
      const sy = Math.min(sh - 1, Math.max(0, fy + n));
      const wx = cubicWeight(m - (x - fx));
      const wy = cubicWeight(n - (y - fy));
      const w = wx * wy;
      const idx = (sy * sw + sx) * 4 + channel;
      value += src[idx] * w;
      weightSum += w;
    }
  }
  return Math.max(0, Math.min(255, Math.round(value / Math.max(weightSum, 1e-6))));
}

function upscaleRgbaBicubic(src, sw, sh, tw, th) {
  if (sw === tw && sh === th) return new Uint8Array(src);
  const out = new Uint8Array(tw * th * 4);
  for (let y = 0; y < th; y += 1) {
    const sy = (y / Math.max(1, th - 1)) * (sh - 1);
    for (let x = 0; x < tw; x += 1) {
      const sx = (x / Math.max(1, tw - 1)) * (sw - 1);
      const outIdx = (y * tw + x) * 4;
      out[outIdx] = sampleBicubicChannel(src, sw, sh, sx, sy, 0);
      out[outIdx + 1] = sampleBicubicChannel(src, sw, sh, sx, sy, 1);
      out[outIdx + 2] = sampleBicubicChannel(src, sw, sh, sx, sy, 2);
      out[outIdx + 3] = sampleBicubicChannel(src, sw, sh, sx, sy, 3);
    }
  }
  return out;
}

function hash2(x, y) {
  const s = Math.sin((x * 127.1 + y * 311.7) * 43758.5453);
  return s - Math.floor(s);
}

function valueNoise2D(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);

  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, ux), THREE.MathUtils.lerp(c, d, ux), uy);
}

function fractalNoise(x, y, octaves = 5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise2D(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / Math.max(norm, 1e-6);
}

function ridgeNoise(x, y) {
  const n = fractalNoise(x, y, 4);
  return 1 - Math.abs(2 * n - 1);
}

function makeSky() {
  const geo = new THREE.SphereGeometry(12000, 64, 48);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color('#5f8fc8') },
      bottomColor: { value: new THREE.Color('#e8f0fb') },
      horizonColor: { value: new THREE.Color('#cbdcf0') }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 horizonColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        float horizon = smoothstep(-0.1, 0.2, h);
        vec3 col = mix(bottomColor, horizonColor, horizon);
        col = mix(col, topColor, smoothstep(0.15, 1.0, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `
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
  let lastError = null;

  for (const path of sceneCandidates) {
    try {
      const res = await fetch(path);
      console.log(`[viewer] scene fetch ${path} -> ${res.status}`);
      if (res.ok) {
        sceneRes = res;
        break;
      }
    } catch (err) {
      lastError = err;
      console.error(`[viewer] failed loading ${path}`, err);
    }
  }

  if (!sceneRes) {
    throw new Error(`scene.json not loaded${lastError ? ` (${String(lastError)})` : ''}`);
  }

  const cfg = await sceneRes.json();
  if (!cfg || !cfg.imagery || !Array.isArray(cfg.buildings) || !cfg.terrain || !Array.isArray(cfg.terrain.heightmap)) {
    throw new Error('scene.json invalid: imagery/buildings/terrain missing');
  }

  const imgRes = await fetch(cfg.imagery.path);
  if (!imgRes.ok) throw new Error(`imagery not loaded: ${cfg.imagery.path}`);
  const imageryBuffer = new Uint8Array(await imgRes.arrayBuffer());

  if (!cfg.buildings.length) {
    console.warn('[viewer] scene contains zero buildings');
  }

  return { cfg, imageryBuffer };
}

function createSquareImageryTexture(cfg, imageryBuffer, targetResolution) {
  const sourceWidth = cfg.imagery.width;
  const sourceHeight = cfg.imagery.height;
  const source = new Uint8Array(imageryBuffer);

  let normalized = source;
  let normalizedW = sourceWidth;
  let normalizedH = sourceHeight;

  if (sourceWidth !== sourceHeight) {
    const sq = Math.max(sourceWidth, sourceHeight);
    const padded = new Uint8Array(sq * sq * 4);
    const offX = Math.floor((sq - sourceWidth) / 2);
    const offY = Math.floor((sq - sourceHeight) / 2);
    for (let y = 0; y < sourceHeight; y += 1) {
      for (let x = 0; x < sourceWidth; x += 1) {
        const sIdx = (y * sourceWidth + x) * 4;
        const dIdx = ((y + offY) * sq + (x + offX)) * 4;
        padded[dIdx] = source[sIdx];
        padded[dIdx + 1] = source[sIdx + 1];
        padded[dIdx + 2] = source[sIdx + 2];
        padded[dIdx + 3] = source[sIdx + 3];
      }
    }
    normalized = padded;
    normalizedW = sq;
    normalizedH = sq;
  }

  const texData = upscaleRgbaBicubic(normalized, normalizedW, normalizedH, targetResolution, targetResolution);
  const tex = new THREE.DataTexture(texData, targetResolution, targetResolution, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function buildDisplacementMap(cfg, targetResolution) {
  const srcW = cfg.terrain.width;
  const srcH = cfg.terrain.height;
  const src = cfg.terrain.heightmap;
  const normalized = new Uint8Array(srcW * srcH * 4);

  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 0; i < src.length; i += 1) {
    minH = Math.min(minH, src[i]);
    maxH = Math.max(maxH, src[i]);
  }
  const span = Math.max(1e-6, maxH - minH);

  for (let i = 0; i < src.length; i += 1) {
    const heightNorm = (src[i] - minH) / span;
    const px = Math.round(heightNorm * 255);
    const idx = i * 4;
    normalized[idx] = px;
    normalized[idx + 1] = px;
    normalized[idx + 2] = px;
    normalized[idx + 3] = 255;
  }

  const upscaled = upscaleRgbaBicubic(normalized, srcW, srcH, targetResolution, targetResolution);
  const out = new Uint8Array(targetResolution * targetResolution);

  for (let y = 0; y < targetResolution; y += 1) {
    for (let x = 0; x < targetResolution; x += 1) {
      const idx = y * targetResolution + x;
      const base = upscaled[idx * 4] / 255;
      const nx = x / targetResolution;
      const ny = y / targetResolution;

      const perlinLike = fractalNoise(nx * 9.5, ny * 9.5, 5);
      const ridge = ridgeNoise(nx * 14, ny * 14);
      const micro = fractalNoise(nx * 40, ny * 40, 3);
      const noiseBlend = (perlinLike * 0.55 + ridge * 0.35 + micro * 0.1);

      const edgeX = Math.max(Math.abs(nx * 2 - 1), 0);
      const edgeY = Math.max(Math.abs(ny * 2 - 1), 0);
      const cornerDistance = Math.min(1, Math.sqrt(edgeX * edgeX + edgeY * edgeY));
      const cornerFade = 1 - smoothstep(0.82, 1, cornerDistance);

      const shaped = THREE.MathUtils.clamp((base * 0.75 + noiseBlend * 0.25) * cornerFade, 0, 1);
      out[idx] = Math.round(shaped * 255);
    }
  }

  const dispTex = new THREE.DataTexture(out, targetResolution, targetResolution, THREE.RedFormat, THREE.UnsignedByteType);
  dispTex.format = THREE.RedFormat;
  dispTex.type = THREE.UnsignedByteType;
  dispTex.needsUpdate = true;
  dispTex.magFilter = THREE.LinearFilter;
  dispTex.minFilter = THREE.LinearMipMapLinearFilter;
  return { dispTex, normalizedHeight: out };
}

function generateTerrainAuxMaps(heightBytes, resolution) {
  const aoData = new Uint8Array(resolution * resolution);
  const roughData = new Uint8Array(resolution * resolution);

  for (let y = 1; y < resolution - 1; y += 1) {
    for (let x = 1; x < resolution - 1; x += 1) {
      const i = y * resolution + x;
      const h = heightBytes[i] / 255;
      const hx = ((heightBytes[i + 1] - heightBytes[i - 1]) / 255) * 0.5;
      const hy = ((heightBytes[i + resolution] - heightBytes[i - resolution]) / 255) * 0.5;
      const slope = Math.min(1, Math.sqrt(hx * hx + hy * hy) * 3.6);
      aoData[i] = Math.round((1 - slope * 0.45) * 255);
      roughData[i] = Math.round((0.5 + slope * 0.45 + (1 - h) * 0.1) * 255);
    }
  }

  const aoTex = new THREE.DataTexture(aoData, resolution, resolution, THREE.RedFormat, THREE.UnsignedByteType);
  aoTex.needsUpdate = true;
  const roughTex = new THREE.DataTexture(roughData, resolution, resolution, THREE.RedFormat, THREE.UnsignedByteType);
  roughTex.needsUpdate = true;
  return { aoTex, roughTex };
}

function buildGround(cfg, imageryBuffer) {
  // Terrain block: square city-scale mesh with bicubic imagery and hybrid procedural height.
  const terrainResolution = 1024;
  const imageryTex = createSquareImageryTexture(cfg, imageryBuffer, terrainResolution);
  const { dispTex, normalizedHeight } = buildDisplacementMap(cfg, terrainResolution);
  const { aoTex, roughTex } = generateTerrainAuxMaps(normalizedHeight, terrainResolution);

  const terrainSideMeters = Math.max(cfg.imagery.width, cfg.imagery.height) * cfg.imagery.pixelSizeMeters;

  const terrainGeometry = new THREE.PlaneGeometry(
    terrainSideMeters,
    terrainSideMeters,
    terrainResolution,
    terrainResolution
  );

  // AO maps in Three.js require uv2.
  terrainGeometry.setAttribute('uv2', terrainGeometry.attributes.uv.clone());

  const terrainMaterial = new THREE.MeshStandardMaterial({
    map: imageryTex,
    roughnessMap: roughTex,
    aoMap: aoTex,
    roughness: 0.95,
    metalness: 0.02,
    displacementMap: dispTex,
    displacementScale: 10,
    displacementBias: -1.5
  });

  const ground = new THREE.Mesh(terrainGeometry, terrainMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const green = new THREE.Mesh(
    new THREE.PlaneGeometry(terrainSideMeters * 1.04, terrainSideMeters * 1.04),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 })
  );
  green.rotation.x = -Math.PI / 2;
  green.position.y = -1.2;
  green.receiveShadow = true;
  scene.add(green);

  console.log(`[viewer] terrain bounds side=${terrainSideMeters.toFixed(2)}m resolution=${terrainResolution}x${terrainResolution}`);
}

function createFacadeMaterial() {
  // Facade shader block: combines facade photo base with procedural windows, door bands, and night lighting.
  const baseFacadeTex = wallTex;
  baseFacadeTex.wrapS = THREE.RepeatWrapping;
  baseFacadeTex.wrapT = THREE.RepeatWrapping;

  return new THREE.ShaderMaterial({
    uniforms: {
      baseMap: { value: baseFacadeTex },
      ambientColor: { value: new THREE.Color(0xffffff) },
      ambientIntensity: { value: 0.8 },
      lightDir: { value: sun.position.clone().normalize() },
      lightColor: { value: new THREE.Color(0xffffff) },
      lightIntensity: { value: 1.2 },
      time: { value: 0 },
      nightMix: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D baseMap;
      uniform vec3 ambientColor;
      uniform float ambientIntensity;
      uniform vec3 lightDir;
      uniform vec3 lightColor;
      uniform float lightIntensity;
      uniform float time;
      uniform float nightMix;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;

      float hash21(vec2 p){
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec2 facadeUv = vec2(vUv.x * 7.0, vUv.y * 12.0);
        vec2 cell = floor(facadeUv);
        vec2 local = fract(facadeUv);

        float frame = step(0.08, local.x) * step(0.08, local.y) * step(local.x, 0.92) * step(local.y, 0.92);
        float windowCore = step(0.18, local.x) * step(0.22, local.y) * step(local.x, 0.82) * step(local.y, 0.84);
        float doorBand = step(0.2, local.x) * step(local.x, 0.8) * step(vUv.y, 0.08);

        float litRandom = step(0.56, hash21(cell));
        float flicker = 0.85 + 0.15 * sin(time * 1.8 + hash21(cell) * 12.0);
        float litWindow = windowCore * litRandom * flicker;

        vec3 photoColor = texture2D(baseMap, vUv * vec2(1.5, 2.0)).rgb;
        vec3 concrete = mix(photoColor, vec3(0.48, 0.52, 0.58), 0.25);
        vec3 windowDark = vec3(0.07, 0.1, 0.16);
        vec3 windowLit = vec3(1.0, 0.82, 0.52);

        vec3 facade = concrete;
        facade = mix(facade, windowDark, windowCore * frame * 0.9);
        facade = mix(facade, vec3(0.23, 0.18, 0.14), doorBand * 0.9);

        float ndl = max(dot(normalize(vNormal), normalize(lightDir)), 0.0);
        vec3 direct = lightColor * ndl * lightIntensity;
        vec3 ambient = ambientColor * ambientIntensity;

        vec3 litColor = facade * (ambient + direct);
        vec3 emissive = windowLit * litWindow * nightMix * 1.25;
        gl_FragColor = vec4(litColor + emissive, 1.0);
      }
    `
  });
}

const facadeMaterial = createFacadeMaterial();

function makeBuildingMesh(b) {
  const shape = new THREE.Shape();
  b.footprint.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  });

  const geom = new THREE.ExtrudeGeometry(shape, { depth: b.height, bevelEnabled: false, curveSegments: 2 });
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, b.height, 0);
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(geom, facadeMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const roof = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshPhysicalMaterial({
      map: roofTex,
      roughness: 0.86,
      metalness: 0.08,
      clearcoat: 0.06,
      clearcoatRoughness: 0.8,
      normalScale: new THREE.Vector2(0.35, 0.35),
      color: new THREE.Color().setHSL(Math.random(), 0.2, 0.58)
    })
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
  const terrainWidthMeters = Math.max(cfg.imagery.width, cfg.imagery.height) * cfg.imagery.pixelSizeMeters;

  for (let i = -6; i <= 6; i += 1) {
    const roadX = new THREE.Mesh(
      new THREE.PlaneGeometry(12, terrainWidthMeters),
      new THREE.MeshStandardMaterial({ map: roadTex, roughness: 1, metalness: 0.02 })
    );
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(i * 90, 0.03, 0);
    roads.add(roadX);

    const roadZ = new THREE.Mesh(
      new THREE.PlaneGeometry(terrainWidthMeters, 12),
      new THREE.MeshStandardMaterial({ map: roadTex, roughness: 1, metalness: 0.02 })
    );
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(0, 0.03, i * 90);
    roads.add(roadZ);
  }
  scene.add(roads);
}

function setMode(mode) {
  if (mode === 'night') {
    sun.intensity = 0.22;
    ambient.intensity = 0.55;
    hemi.intensity = 0.15;
    scene.fog.color.set('#24314a');
    renderer.toneMappingExposure = 0.7;
    facadeMaterial.uniforms.nightMix.value = 1;
  } else if (mode === 'sunset') {
    sun.intensity = 0.9;
    ambient.intensity = 0.8;
    hemi.intensity = 0.35;
    scene.fog.color.set('#c98f67');
    renderer.toneMappingExposure = 0.95;
    facadeMaterial.uniforms.nightMix.value = 0.35;
  } else {
    sun.intensity = 1.2;
    ambient.intensity = 0.8;
    hemi.intensity = 0.4;
    scene.fog.color.set('#9fb3c8');
    renderer.toneMappingExposure = 1.0;
    facadeMaterial.uniforms.nightMix.value = 0.05;
  }
  facadeMaterial.uniforms.lightIntensity.value = sun.intensity;
  facadeMaterial.uniforms.ambientIntensity.value = ambient.intensity;
  facadeMaterial.uniforms.lightDir.value.copy(sun.position).normalize();
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

function frameCameraToCityBounds(targetObject) {
  // Camera framing block: fits full city bounds and applies robust orbit constraints.
  const box = new THREE.Box3().setFromObject(targetObject);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = Math.max(radius / Math.tan(fov * 0.5), radius * 2.3);

  camera.position.set(center.x + distance * 0.85, center.y + distance * 0.6, center.z + distance * 0.85);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.minDistance = radius * 0.2;
  controls.maxDistance = radius * 10;

  console.log(`[viewer] camera position ${camera.position.toArray().map((v) => v.toFixed(2)).join(', ')}`);
}

async function init() {
  console.log('[viewer] init started');
  const { cfg, imageryBuffer } = await loadSceneData();

  buildGround(cfg, imageryBuffer);
  buildRoadGrid(cfg);

  const buildingGroup = new THREE.Group();
  for (const b of cfg.buildings) {
    if (!b?.footprint?.length || !Number.isFinite(b.height)) {
      console.warn('[viewer] skipping invalid building', b);
      continue;
    }
    buildingGroup.add(makeBuildingMesh(b));
  }
  scene.add(buildingGroup);

  console.log(`[viewer] building count=${buildingGroup.children.length}`);

  if (buildingGroup.children.length === 0) {
    const fail = new THREE.Mesh(
      new THREE.BoxGeometry(50, 100, 50),
      new THREE.MeshStandardMaterial({ color: 'red' })
    );
    fail.position.y = 50;
    scene.add(fail);
  }

  addModeUI();
  setMode('day');
  frameCameraToCityBounds(scene);

  // Render loop block: real-time update for controls and animated facade windows.
  const clock = new THREE.Clock();
  function animate() {
    const t = clock.getElapsedTime();
    facadeMaterial.uniforms.time.value = t;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
  console.log('[viewer] render loop started');
}

init().catch((e) => {
  console.error('[viewer] failed to initialize scene', e);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
});
