import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BuildingModelData } from './generators';

export type RenderTier = 'extreme' | 'gpu' | 'mobile';

export type TierConfig = {
  tier: RenderTier;
  wallSegments: number;
  maxTextureSize: number;
  useHdri: boolean;
  useComposer: boolean;
  useGpuRenderer: boolean;
  aoStrength: number;
  bloomStrength: number;
  displacementScale: number;
  targetFps: number;
};

const projectiveVertex = `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const projectiveFragment = `
precision highp float;
uniform sampler2D facadeA;
uniform sampler2D facadeB;
uniform sampler2D facadeC;
uniform sampler2D facadeD;
uniform sampler2D depthMap;
uniform sampler2D semanticMap;
uniform sampler2D edgeMap;
uniform float displacementScale;
uniform float glassIntensity;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;

vec2 planarUV(vec3 p, int mode) {
  if (mode == 0) return vec2(p.z, p.y);
  if (mode == 1) return vec2(-p.z, p.y);
  if (mode == 2) return vec2(p.x, p.y);
  return vec2(-p.x, p.y);
}

void main() {
  vec3 n = normalize(vWorldNormal);
  vec4 cA = texture2D(facadeA, fract(planarUV(vWorldPos, 0) * 0.05 + 0.5));
  vec4 cB = texture2D(facadeB, fract(planarUV(vWorldPos, 1) * 0.05 + 0.5));
  vec4 cC = texture2D(facadeC, fract(planarUV(vWorldPos, 2) * 0.05 + 0.5));
  vec4 cD = texture2D(facadeD, fract(planarUV(vWorldPos, 3) * 0.05 + 0.5));

  vec4 blend = abs(vec4(n.x, -n.x, n.z, -n.z));
  blend = max(blend, vec4(0.001));
  blend /= dot(blend, vec4(1.0));

  vec4 facade = cA * blend.x + cB * blend.y + cC * blend.z + cD * blend.w;
  float d = texture2D(depthMap, vUv).r;
  vec3 semantic = texture2D(semanticMap, vUv).rgb;
  float e = texture2D(edgeMap, vUv).r;
  float cavity = smoothstep(0.1, 0.9, e);
  vec3 detail = vec3(d * displacementScale) + semantic * 0.15 + vec3(cavity * 0.1);

  float glassMask = smoothstep(0.45, 0.85, semantic.b);
  vec3 finalColor = facade.rgb + detail;
  finalColor = mix(finalColor, finalColor * 0.4 + vec3(0.45, 0.56, 0.72), glassMask * glassIntensity);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

function gpuScore() {
  const nav = navigator as Navigator & { deviceMemory?: number; gpu?: unknown };
  const cores = navigator.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 4;
  const pixelRatio = window.devicePixelRatio || 1;
  const mobileUa = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const score = cores * 0.8 + memory * 1.2 + (mobileUa ? -4 : 1) + (pixelRatio > 2 ? -1 : 0);
  return { score, hasWebGPU: Boolean(nav.gpu), mobileUa };
}

export function detectTier(): TierConfig {
  const { score, hasWebGPU, mobileUa } = gpuScore();
  if (mobileUa || score <= 8) {
    return {
      tier: 'mobile',
      wallSegments: 32,
      maxTextureSize: 2048,
      useHdri: false,
      useComposer: true,
      useGpuRenderer: false,
      aoStrength: 0.45,
      bloomStrength: 0.18,
      displacementScale: 0.08,
      targetFps: 55
    };
  }
  if (hasWebGPU && score >= 18) {
    return {
      tier: 'gpu',
      wallSegments: 192,
      maxTextureSize: 4096,
      useHdri: true,
      useComposer: true,
      useGpuRenderer: true,
      aoStrength: 0.8,
      bloomStrength: 0.42,
      displacementScale: 0.2,
      targetFps: 60
    };
  }
  return {
    tier: 'extreme',
    wallSegments: 256,
    maxTextureSize: 8192,
    useHdri: true,
    useComposer: true,
    useGpuRenderer: false,
    aoStrength: 0.95,
    bloomStrength: 0.52,
    displacementScale: 0.28,
    targetFps: 45
  };
}

function canvasToTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
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

function buildDepthSemanticMaps(image: HTMLImageElement | null, resolution: number) {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.DataTexture(new Uint8Array(resolution * resolution * 4), resolution, resolution);
    fallback.needsUpdate = true;
    return { depth: fallback, semantic: fallback, edge: fallback };
  }

  if (image) {
    ctx.drawImage(image, 0, 0, resolution, resolution);
  } else {
    const grad = ctx.createLinearGradient(0, 0, resolution, resolution);
    grad.addColorStop(0, '#e2e8f0');
    grad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, resolution, resolution);
  }

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

    const semanticR = Math.max(0, g - b);
    const semanticG = Math.max(0, r - b * 0.4);
    const semanticB = Math.max(0, b - r * 0.3);

    d[i * 4] = Math.round(l * 255);
    d[i * 4 + 1] = d[i * 4];
    d[i * 4 + 2] = d[i * 4];
    d[i * 4 + 3] = 255;

    s[i * 4] = Math.round(Math.min(1, semanticR) * 255);
    s[i * 4 + 1] = Math.round(Math.min(1, semanticG) * 255);
    s[i * 4 + 2] = Math.round(Math.min(1, semanticB) * 255);
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

export async function generateFacadeTextures(model: BuildingModelData, tier: TierConfig) {
  const [front, back, left, right, aerial] = await Promise.all([
    imageFromUrl(model.assets.facadeFront),
    imageFromUrl(model.assets.facadeBack),
    imageFromUrl(model.assets.facadeLeft),
    imageFromUrl(model.assets.facadeRight),
    imageFromUrl(model.assets.aerialImage)
  ]);

  const targetSize = tier.tier === 'mobile' ? 1024 : 2048;
  const toCanvas = (img: HTMLImageElement | null) => {
    const c = document.createElement('canvas');
    c.width = targetSize;
    c.height = targetSize;
    const ctx = c.getContext('2d');
    if (!ctx) return c;
    if (img) ctx.drawImage(img, 0, 0, targetSize, targetSize);
    else {
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(0, 0, targetSize, targetSize);
    }
    return c;
  };

  const frontTexture = canvasToTexture(toCanvas(front));
  const backTexture = canvasToTexture(toCanvas(back));
  const leftTexture = canvasToTexture(toCanvas(left));
  const rightTexture = canvasToTexture(toCanvas(right));
  const aerialTexture = canvasToTexture(toCanvas(aerial));

  const synthesisSource = front || back || left || right;
  const synthesisRes = tier.tier === 'mobile' ? 256 : 1024;
  const synthesized = buildDepthSemanticMaps(synthesisSource, synthesisRes);

  return {
    frontTexture,
    backTexture,
    leftTexture,
    rightTexture,
    aerialTexture,
    ...synthesized
  };
}

export function inferFootprint(model: BuildingModelData) {
  const halfW = model.width * 0.5;
  const halfD = model.depth * 0.5;
  const bevel = Math.min(model.width, model.depth) * 0.08;
  return [
    new THREE.Vector2(-halfW + bevel, -halfD),
    new THREE.Vector2(halfW - bevel, -halfD),
    new THREE.Vector2(halfW, -halfD + bevel),
    new THREE.Vector2(halfW, halfD - bevel),
    new THREE.Vector2(halfW - bevel, halfD),
    new THREE.Vector2(-halfW + bevel, halfD),
    new THREE.Vector2(-halfW, halfD - bevel),
    new THREE.Vector2(-halfW, -halfD + bevel)
  ];
}

export function createAdaptiveBuildingMesh(model: BuildingModelData, tier: TierConfig, maps: Awaited<ReturnType<typeof generateFacadeTextures>>) {
  const shape = new THREE.Shape(inferFootprint(model));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: model.buildingHeight,
    bevelEnabled: false,
    curveSegments: Math.max(8, Math.floor(tier.wallSegments / 8)),
    steps: Math.max(16, Math.floor(tier.wallSegments / 2))
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, model.buildingHeight * 0.5, 0);

  const roofGeometry = new THREE.ConeGeometry(Math.max(model.width, model.depth) * 0.55, model.buildingHeight * 0.16, 4, 1);
  roofGeometry.rotateY(Math.PI * 0.25 + model.rotationY);
  roofGeometry.translate(0, model.buildingHeight * 1.04, 0);

  const merged = mergeGeometries([geometry, roofGeometry], true) ?? geometry;

  const material = new THREE.ShaderMaterial({
    vertexShader: projectiveVertex,
    fragmentShader: projectiveFragment,
    uniforms: {
      facadeA: { value: maps.frontTexture },
      facadeB: { value: maps.backTexture },
      facadeC: { value: maps.leftTexture },
      facadeD: { value: maps.rightTexture },
      depthMap: { value: maps.depth },
      semanticMap: { value: maps.semantic },
      edgeMap: { value: maps.edge },
      displacementScale: { value: tier.displacementScale },
      glassIntensity: { value: tier.tier === 'mobile' ? 0.2 : 0.52 }
    }
  });

  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
