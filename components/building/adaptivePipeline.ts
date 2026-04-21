import * as THREE from 'three';
import type { BuildingModelData } from './generators';

export type RenderTier = 'extreme' | 'gpu' | 'mobile';

export type TierConfig = {
  tier: RenderTier;
  wallSegments: number;
  terrainSegments: number;
  maxTextureSize: number;
  useHdri: boolean;
  useComposer: boolean;
  useSSAO: boolean;
  useGpuRenderer: boolean;
  aoStrength: number;
  bloomStrength: number;
  displacementScale: number;
  terrainDisplacement: number;
  targetFps: number;
};

type RectifyPoints = [
  [number, number],
  [number, number],
  [number, number],
  [number, number]
];

type FacadePack = {
  texture: any;
  secondaryTexture: any;
  depthTexture: any;
  semanticTexture: any;
  edgeTexture: any;
};

export type GeneratedMaps = {
  aerialTexture: any;
  aerialDepth: any;
  facades: Record<'front' | 'back' | 'left' | 'right', FacadePack>;
};

const wallVertexShader = `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const wallFragmentShader = `
precision highp float;
uniform sampler2D facadeMap;
uniform sampler2D secondaryFacadeMap;
uniform sampler2D depthMap;
uniform sampler2D semanticMap;
uniform sampler2D edgeMap;
uniform mat4 primaryProjector;
uniform mat4 secondaryProjector;
uniform float edgeFeather;
uniform float displacementScale;
uniform float glassSuppression;
uniform vec3 wallNormal;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

vec3 projectorUV(vec4 clipPos) {
  vec3 ndc = clipPos.xyz / max(clipPos.w, 1e-5);
  return vec3(ndc.xy * 0.5 + 0.5, ndc.z);
}

float inFrame(vec2 uv) {
  vec2 s = smoothstep(vec2(0.0), vec2(edgeFeather), uv) * (1.0 - smoothstep(vec2(1.0 - edgeFeather), vec2(1.0), uv));
  return s.x * s.y;
}

void main() {
  vec4 world = vec4(vWorldPos, 1.0);

  vec3 uvzPrimary = projectorUV(primaryProjector * world);
  vec3 uvzSecondary = projectorUV(secondaryProjector * world);

  float wPrimary = inFrame(uvzPrimary.xy) * step(-1.0, uvzPrimary.z) * step(uvzPrimary.z, 1.0);
  float wSecondary = inFrame(uvzSecondary.xy) * step(-1.0, uvzSecondary.z) * step(uvzSecondary.z, 1.0);

  vec3 viewFacing = normalize(vWorldNormal);
  float normalConfidence = max(0.2, dot(normalize(wallNormal), viewFacing) * 0.5 + 0.5);
  wPrimary *= normalConfidence;
  wSecondary *= normalConfidence;

  vec4 cPrimary = texture2D(facadeMap, clamp(uvzPrimary.xy, 0.0, 1.0));
  vec4 cSecondary = texture2D(secondaryFacadeMap, clamp(uvzSecondary.xy, 0.0, 1.0));

  float weightSum = max(wPrimary + wSecondary, 1e-4);
  vec3 facade = (cPrimary.rgb * wPrimary + cSecondary.rgb * wSecondary) / weightSum;

  float d = texture2D(depthMap, vUv).r;
  vec3 sem = texture2D(semanticMap, vUv).rgb;
  float edge = texture2D(edgeMap, vUv).r;

  float cavity = smoothstep(0.2, 0.95, edge);
  float windowMask = smoothstep(0.35, 0.82, sem.b);
  vec3 detail = vec3((d - 0.5) * displacementScale) + vec3(cavity * 0.07);

  vec3 finalColor = facade + detail;
  finalColor = mix(finalColor, finalColor * 0.65, windowMask * glassSuppression);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

function gpuScore() {
  const nav = navigator as Navigator & { deviceMemory?: number; gpu?: unknown };
  const cores = navigator.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 4;
  const pixelRatio = window.devicePixelRatio || 1;
  const mobileUa = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const score = cores * 0.8 + memory * 1.1 + (mobileUa ? -4 : 1) + (pixelRatio > 2 ? -1 : 0);
  return { score, hasWebGPU: Boolean(nav.gpu), mobileUa };
}

export function detectTier(forceGpu = false): TierConfig {
  const { score, hasWebGPU, mobileUa } = gpuScore();
  if (mobileUa || score <= 8) {
    return {
      tier: 'mobile',
      wallSegments: 12,
      terrainSegments: 96,
      maxTextureSize: 1024,
      useHdri: false,
      useComposer: true,
      useSSAO: false,
      useGpuRenderer: false,
      aoStrength: 0.35,
      bloomStrength: 0.08,
      displacementScale: 0.04,
      terrainDisplacement: 1.0,
      targetFps: 55
    };
  }
  if ((forceGpu || hasWebGPU) && score >= 16) {
    return {
      tier: 'gpu',
      wallSegments: 28,
      terrainSegments: 256,
      maxTextureSize: 2048,
      useHdri: true,
      useComposer: true,
      useSSAO: true,
      useGpuRenderer: true,
      aoStrength: 0.9,
      bloomStrength: 0.15,
      displacementScale: 0.12,
      terrainDisplacement: 2.2,
      targetFps: 60
    };
  }
  return {
    tier: 'extreme',
    wallSegments: 36,
    terrainSegments: 256,
    maxTextureSize: 2048,
    useHdri: true,
    useComposer: true,
    useSSAO: true,
    useGpuRenderer: forceGpu,
    aoStrength: 0.95,
    bloomStrength: 0.2,
    displacementScale: 0.16,
    terrainDisplacement: 2.8,
    targetFps: 48
  };
}

function canvasToTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

async function imageFromUrl(url: string | null) {
  if (!url) return null;
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function multiply3x3(a: number[], b: number[]) {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
  ];
}

function invert3x3(m: number[]) {
  const det =
    m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6]);
  if (Math.abs(det) < 1e-8) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const invDet = 1 / det;
  return [
    (m[4] * m[8] - m[5] * m[7]) * invDet,
    (m[2] * m[7] - m[1] * m[8]) * invDet,
    (m[1] * m[5] - m[2] * m[4]) * invDet,
    (m[5] * m[6] - m[3] * m[8]) * invDet,
    (m[0] * m[8] - m[2] * m[6]) * invDet,
    (m[2] * m[3] - m[0] * m[5]) * invDet,
    (m[3] * m[7] - m[4] * m[6]) * invDet,
    (m[1] * m[6] - m[0] * m[7]) * invDet,
    (m[0] * m[4] - m[1] * m[3]) * invDet
  ];
}

function basisToPoints(p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]) {
  const m = [p1[0], p2[0], p3[0], p1[1], p2[1], p3[1], 1, 1, 1];
  const inv = invert3x3(m);
  const v = [p4[0], p4[1], 1];
  const s = [
    inv[0] * v[0] + inv[1] * v[1] + inv[2] * v[2],
    inv[3] * v[0] + inv[4] * v[1] + inv[5] * v[2],
    inv[6] * v[0] + inv[7] * v[1] + inv[8] * v[2]
  ];
  return [
    s[0] * p1[0],
    s[1] * p2[0],
    s[2] * p3[0],
    s[0] * p1[1],
    s[1] * p2[1],
    s[2] * p3[1],
    s[0],
    s[1],
    s[2]
  ];
}

function general2DProjection(src: RectifyPoints, dst: RectifyPoints) {
  const srcMat = basisToPoints(src[0], src[1], src[2], src[3]);
  const dstMat = basisToPoints(dst[0], dst[1], dst[2], dst[3]);
  return multiply3x3(dstMat, invert3x3(srcMat));
}

function detectFallbackCorners(image: HTMLImageElement): RectifyPoints {
  const w = image.width;
  const h = image.height;
  const insetX = Math.round(w * 0.04);
  const insetY = Math.round(h * 0.03);
  return [
    [insetX, insetY],
    [w - insetX, insetY],
    [w - insetX, h - insetY],
    [insetX, h - insetY]
  ];
}

function rectifyFacadeImage(image: HTMLImageElement | null, size: number, manualPoints?: RectifyPoints) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  if (!image) {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, size, size);
    return canvas;
  }

  const src = manualPoints ?? detectFallbackCorners(image);
  const dst: RectifyPoints = [
    [0, 0],
    [size - 1, 0],
    [size - 1, size - 1],
    [0, size - 1]
  ];

  const h = general2DProjection(dst, src);
  const sample = document.createElement('canvas');
  sample.width = image.width;
  sample.height = image.height;
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
  if (!sampleCtx) return canvas;
  sampleCtx.drawImage(image, 0, 0);
  const srcData = sampleCtx.getImageData(0, 0, image.width, image.height).data;
  const out = ctx.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const tx = h[0] * x + h[1] * y + h[2];
      const ty = h[3] * x + h[4] * y + h[5];
      const tw = h[6] * x + h[7] * y + h[8];
      const sx = Math.max(0, Math.min(image.width - 1, tx / tw));
      const sy = Math.max(0, Math.min(image.height - 1, ty / tw));
      const ix = Math.floor(sx);
      const iy = Math.floor(sy);
      const idx = (iy * image.width + ix) * 4;
      const o = (y * size + x) * 4;
      out.data[o] = srcData[idx];
      out.data[o + 1] = srcData[idx + 1];
      out.data[o + 2] = srcData[idx + 2];
      out.data[o + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

function buildDepthSemanticMaps(image: HTMLCanvasElement, resolution: number) {
  const c = document.createElement('canvas');
  c.width = resolution;
  c.height = resolution;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    const fallback = new THREE.DataTexture(new Uint8Array(resolution * resolution * 4), resolution, resolution);
    fallback.needsUpdate = true;
    return { depth: fallback, semantic: fallback, edge: fallback };
  }

  ctx.drawImage(image, 0, 0, resolution, resolution);
  const data = ctx.getImageData(0, 0, resolution, resolution);
  const d = new Uint8Array(resolution * resolution * 4);
  const s = new Uint8Array(resolution * resolution * 4);
  const e = new Uint8Array(resolution * resolution * 4);
  const luminance = new Float32Array(resolution * resolution);

  for (let i = 0; i < resolution * resolution; i += 1) {
    const r = data.data[i * 4] / 255;
    const g = data.data[i * 4 + 1] / 255;
    const b = data.data[i * 4 + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminance[i] = l;

    d[i * 4] = Math.round(l * 255);
    d[i * 4 + 1] = d[i * 4];
    d[i * 4 + 2] = d[i * 4];
    d[i * 4 + 3] = 255;

    s[i * 4] = Math.round(Math.max(0, g - b * 0.6) * 255);
    s[i * 4 + 1] = Math.round(Math.max(0, r - b * 0.45) * 255);
    s[i * 4 + 2] = Math.round(Math.max(0, b - r * 0.35) * 255);
    s[i * 4 + 3] = 255;
  }

  for (let y = 1; y < resolution - 1; y += 1) {
    for (let x = 1; x < resolution - 1; x += 1) {
      const idx = y * resolution + x;
      const gx =
        -luminance[idx - resolution - 1] - 2 * luminance[idx - 1] - luminance[idx + resolution - 1] +
        luminance[idx - resolution + 1] + 2 * luminance[idx + 1] + luminance[idx + resolution + 1];
      const gy =
        -luminance[idx - resolution - 1] - 2 * luminance[idx - resolution] - luminance[idx - resolution + 1] +
        luminance[idx + resolution - 1] + 2 * luminance[idx + resolution] + luminance[idx + resolution + 1];
      const mag = Math.min(1, Math.sqrt(gx * gx + gy * gy));
      e[idx * 4] = Math.round(mag * 255);
      e[idx * 4 + 1] = e[idx * 4];
      e[idx * 4 + 2] = e[idx * 4];
      e[idx * 4 + 3] = 255;
    }
  }

  const depth = new THREE.DataTexture(d, resolution, resolution);
  depth.needsUpdate = true;
  const semantic = new THREE.DataTexture(s, resolution, resolution);
  semantic.needsUpdate = true;
  const edge = new THREE.DataTexture(e, resolution, resolution);
  edge.needsUpdate = true;
  return { depth, semantic, edge };
}

function makeFacadePack(primary: HTMLCanvasElement, secondary: HTMLCanvasElement, detailRes: number): FacadePack {
  const detail = buildDepthSemanticMaps(primary, detailRes);
  return {
    texture: canvasToTexture(primary),
    secondaryTexture: canvasToTexture(secondary),
    depthTexture: detail.depth,
    semanticTexture: detail.semantic,
    edgeTexture: detail.edge
  };
}

export async function generateFacadeTextures(model: BuildingModelData, tier: TierConfig): Promise<GeneratedMaps> {
  const [front, back, left, right, aerial] = await Promise.all([
    imageFromUrl(model.assets.facadeFront),
    imageFromUrl(model.assets.facadeBack),
    imageFromUrl(model.assets.facadeLeft),
    imageFromUrl(model.assets.facadeRight),
    imageFromUrl(model.assets.aerialImage)
  ]);

  const facadeSize = Math.min(tier.maxTextureSize, tier.tier === 'mobile' ? 1024 : 2048);
  const detailSize = tier.tier === 'mobile' ? 256 : 768;

  const frontRect = rectifyFacadeImage(front, facadeSize);
  const backRect = rectifyFacadeImage(back ?? front, facadeSize);
  const leftRect = rectifyFacadeImage(left ?? front, facadeSize);
  const rightRect = rectifyFacadeImage(right ?? front, facadeSize);

  const aerialCanvas = document.createElement('canvas');
  aerialCanvas.width = facadeSize;
  aerialCanvas.height = facadeSize;
  const aerialCtx = aerialCanvas.getContext('2d');
  if (aerialCtx && aerial) aerialCtx.drawImage(aerial, 0, 0, facadeSize, facadeSize);
  if (aerialCtx && !aerial) {
    const g = aerialCtx.createLinearGradient(0, 0, 0, facadeSize);
    g.addColorStop(0, '#8db0c6');
    g.addColorStop(1, '#7f9a6a');
    aerialCtx.fillStyle = g;
    aerialCtx.fillRect(0, 0, facadeSize, facadeSize);
  }

  return {
    aerialTexture: canvasToTexture(aerialCanvas),
    aerialDepth: buildDepthSemanticMaps(aerialCanvas, detailSize).depth,
    facades: {
      front: makeFacadePack(frontRect, rightRect, detailSize),
      back: makeFacadePack(backRect, leftRect, detailSize),
      left: makeFacadePack(leftRect, frontRect, detailSize),
      right: makeFacadePack(rightRect, backRect, detailSize)
    }
  };
}

type WallName = 'front' | 'back' | 'left' | 'right';

function createProjectorMatrix(position: any, target: any, aspect = 1) {
  const camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 4000);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
}

function createWindowPanels(model: BuildingModelData, tier: TierConfig) {
  const group = new THREE.Group();
  const floors = Math.max(2, Math.floor(model.buildingHeight / 3));
  const winRows = floors;
  const frontCols = Math.max(4, Math.floor(model.width / 2.4));
  const sideCols = Math.max(3, Math.floor(model.depth / 2.4));

  const panelMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.55, metalness: 0.12 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#9ec3e2', roughness: 0.18, metalness: 0.1, transmission: tier.tier === 'mobile' ? 0.15 : 0.35, thickness: 0.12 });

  const addGrid = (wall: 'front' | 'back' | 'left' | 'right', width: number, cols: number, zOrX: number) => {
    const cellW = width / cols;
    const cellH = model.buildingHeight / (winRows + 1);
    for (let row = 0; row < winRows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const winW = cellW * 0.58;
        const winH = cellH * 0.46;
        const inset = 0.15;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, 0.06), panelMat);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(winW * 0.86, winH * 0.82, 0.03), glassMat);

        const x = -width * 0.5 + cellW * (col + 0.5);
        const y = cellH * (row + 1);

        if (wall === 'front' || wall === 'back') {
          const z = zOrX;
          panel.position.set(x, y, z + (wall === 'front' ? inset : -inset));
          glass.position.set(x, y, z + (wall === 'front' ? inset + 0.028 : -inset - 0.028));
        } else {
          const xx = zOrX;
          panel.position.set(xx + (wall === 'right' ? inset : -inset), y, x);
          glass.position.set(xx + (wall === 'right' ? inset + 0.028 : -inset - 0.028), y, x);
        }

        panel.castShadow = true;
        glass.castShadow = true;
        group.add(panel, glass);
      }
    }
  };

  addGrid('front', model.width, frontCols, model.depth * 0.5);
  addGrid('back', model.width, frontCols, -model.depth * 0.5);
  addGrid('left', model.depth, sideCols, -model.width * 0.5);
  addGrid('right', model.depth, sideCols, model.width * 0.5);

  const balcony = new THREE.Mesh(
    new THREE.BoxGeometry(model.width * 0.45, 0.18, 0.9),
    new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.9, metalness: 0.02 })
  );
  balcony.position.set(0, model.buildingHeight * 0.45, model.depth * 0.5 + 0.35);
  balcony.castShadow = true;
  group.add(balcony);

  return group;
}

function createWallMaterial(pack: FacadePack, wallNormal: any, primaryProjector: any, secondaryProjector: any, tier: TierConfig) {
  return new THREE.ShaderMaterial({
    vertexShader: wallVertexShader,
    fragmentShader: wallFragmentShader,
    uniforms: {
      facadeMap: { value: pack.texture },
      secondaryFacadeMap: { value: pack.secondaryTexture },
      depthMap: { value: pack.depthTexture },
      semanticMap: { value: pack.semanticTexture },
      edgeMap: { value: pack.edgeTexture },
      primaryProjector: { value: primaryProjector },
      secondaryProjector: { value: secondaryProjector },
      edgeFeather: { value: 0.08 },
      displacementScale: { value: tier.displacementScale },
      glassSuppression: { value: tier.tier === 'mobile' ? 0.25 : 0.45 },
      wallNormal: { value: wallNormal.clone().normalize() }
    }
  });
}

export function createAdaptiveBuildingMesh(model: BuildingModelData, tier: TierConfig, maps: GeneratedMaps) {
  const group = new THREE.Group();

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(model.width * 1.01, 0.45, model.depth * 1.01),
    new THREE.MeshStandardMaterial({ color: '#7c8798', roughness: 0.92, metalness: 0.03 })
  );
  roof.position.y = model.buildingHeight + 0.22;
  roof.castShadow = true;
  roof.receiveShadow = true;

  const core = new THREE.Mesh(
    new THREE.BoxGeometry(model.width, model.buildingHeight, model.depth),
    new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 1, metalness: 0.01 })
  );
  core.position.y = model.buildingHeight * 0.5;
  core.castShadow = true;
  core.receiveShadow = true;

  const wallDefs: Record<WallName, { size: [number, number]; position: [number, number, number]; normal: any; secondary: WallName }> = {
    front: { size: [model.width, model.buildingHeight], position: [0, model.buildingHeight * 0.5, model.depth * 0.5 + 0.02], normal: new THREE.Vector3(0, 0, 1), secondary: 'right' },
    back: { size: [model.width, model.buildingHeight], position: [0, model.buildingHeight * 0.5, -model.depth * 0.5 - 0.02], normal: new THREE.Vector3(0, 0, -1), secondary: 'left' },
    left: { size: [model.depth, model.buildingHeight], position: [-model.width * 0.5 - 0.02, model.buildingHeight * 0.5, 0], normal: new THREE.Vector3(-1, 0, 0), secondary: 'front' },
    right: { size: [model.depth, model.buildingHeight], position: [model.width * 0.5 + 0.02, model.buildingHeight * 0.5, 0], normal: new THREE.Vector3(1, 0, 0), secondary: 'back' }
  };

  (Object.keys(wallDefs) as WallName[]).forEach((name) => {
    const def = wallDefs[name];
    const geometry = new THREE.PlaneGeometry(def.size[0], def.size[1], tier.wallSegments, tier.wallSegments);
    const wall = new THREE.Mesh(geometry);
    wall.position.set(def.position[0], def.position[1], def.position[2]);

    if (name === 'back') wall.rotation.y = Math.PI;
    if (name === 'left') wall.rotation.y = -Math.PI / 2;
    if (name === 'right') wall.rotation.y = Math.PI / 2;

    const primaryPos = def.normal.clone().multiplyScalar(Math.max(model.width, model.depth) * 1.4).setY(model.buildingHeight * 0.55);
    const secondaryNormal = wallDefs[def.secondary].normal;
    const secondaryPos = secondaryNormal.clone().multiplyScalar(Math.max(model.width, model.depth) * 1.5).setY(model.buildingHeight * 0.6);
    const target = new THREE.Vector3(def.position[0], model.buildingHeight * 0.52, def.position[2]);

    wall.material = createWallMaterial(maps.facades[name], def.normal, createProjectorMatrix(primaryPos, target), createProjectorMatrix(secondaryPos, target), tier);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  });

  group.add(core, roof, createWindowPanels(model, tier));
  group.castShadow = true;
  group.receiveShadow = true;
  return group;
}

export function createSurroundingBuildings(model: BuildingModelData, tier: TierConfig) {
  const group = new THREE.Group();
  const radius = Math.max(model.width, model.depth) * 5.5;
  const count = tier.tier === 'mobile' ? 26 : 55;

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.25;
    const dist = radius * (0.4 + Math.random() * 0.9);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    if (Math.abs(x) < model.width * 0.85 && Math.abs(z) < model.depth * 0.85) continue;

    const w = 4 + Math.random() * 10;
    const d = 4 + Math.random() * 10;
    const h = 6 + Math.random() * 38;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d, 1, Math.max(1, Math.floor(h / 4)), 1),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.58, 0.08, 0.52 + Math.random() * 0.15), roughness: 0.95, metalness: 0.02 })
    );
    mesh.position.set(x, h * 0.5, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

export function createContactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(256, 256, 40, 256, 256, 250);
    gradient.addColorStop(0, 'rgba(0,0,0,0.42)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
  }
  return canvasToTexture(c);
}

export function createRadialAlphaTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(512, 512, 250, 512, 512, 510);
    gradient.addColorStop(0, 'rgba(255,255,255,1.0)');
    gradient.addColorStop(0.82, 'rgba(255,255,255,0.98)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);
  }
  const tex = canvasToTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
