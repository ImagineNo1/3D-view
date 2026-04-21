'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getSatelliteImage } from '@/lib/maps';

type Props = {
  imageUrl?: string;
  title: string;
  latitude?: number;
  longitude?: number;
};

type BuildingInstance = {
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotationY: number;
  radius: number;
};

type ThreeRuntime = {
  scene: any;
  camera: any;
  renderer: any;
  controls: any;
  terrain: any;
  terrainMaterial: any;
  building: any;
  contextBuildings: any;
  contextMeta: BuildingInstance[];
  clickMarker: any;
  raycaster: any;
  pointer: any;
  THREE: any;
  composer: any;
  cleanupEvents: Array<() => void>;
};

type PixelPoint = { x: number; y: number };

type Footprint = {
  polygon: PixelPoint[];
  centroid: PixelPoint;
  area: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
};

const TERRAIN_SCALE = 4200;
const TERRAIN_SIZE = 22;
const WORLD_METERS = 10;
const CONTEXT_RADIUS = 10.5;
const SOLAR_ANGLE_DEG = 38;

const PLACEHOLDER_TEXTURE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#dbeafe"/><stop offset="55%" stop-color="#bfdbfe"/><stop offset="100%" stop-color="#93c5fd"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/><g fill="none" stroke="#ffffff55" stroke-width="10"><path d="M0 120h1024M0 280h1024M0 480h1024M0 700h1024M0 900h1024"/><path d="M90 0v1024M300 0v1024M540 0v1024M770 0v1024M950 0v1024"/></g></svg>`);

function latLngToPosition(lat: number, lng: number, centerLat: number, centerLng: number, scale: number) {
  const x = (lng - centerLng) * scale;
  const z = (lat - centerLat) * -scale;
  return { x, z };
}

function positionToLatLng(x: number, z: number, centerLat: number, centerLng: number, scale: number) {
  const lng = x / scale + centerLng;
  const lat = -z / scale + centerLat;
  return { lat, lng };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function gaussianBlur(gray: Float32Array, width: number, height: number) {
  const kernel = [1, 4, 6, 4, 1];
  const temp = new Float32Array(width * height);
  const output = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let acc = 0;
      let weight = 0;
      for (let k = -2; k <= 2; k += 1) {
        const sx = clamp(x + k, 0, width - 1);
        const w = kernel[k + 2];
        acc += gray[y * width + sx] * w;
        weight += w;
      }
      temp[y * width + x] = acc / weight;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let acc = 0;
      let weight = 0;
      for (let k = -2; k <= 2; k += 1) {
        const sy = clamp(y + k, 0, height - 1);
        const w = kernel[k + 2];
        acc += temp[sy * width + x] * w;
        weight += w;
      }
      output[y * width + x] = acc / weight;
    }
  }

  return output;
}

function sobelEdges(gray: Float32Array, width: number, height: number) {
  const mag = new Float32Array(width * height);
  const dir = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] - 2 * gray[i - 1] - gray[i + width - 1] +
        gray[i - width + 1] + 2 * gray[i + 1] + gray[i + width + 1];
      const gy =
        -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] +
        gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
      mag[i] = Math.hypot(gx, gy);
      dir[i] = Math.atan2(gy, gx);
    }
  }

  return { mag, dir };
}

function nonMaxSuppression(mag: Float32Array, dir: Float32Array, width: number, height: number) {
  const out = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const angle = ((dir[i] * 180) / Math.PI + 180) % 180;
      let m1 = 0;
      let m2 = 0;
      if (angle < 22.5 || angle >= 157.5) {
        m1 = mag[i - 1];
        m2 = mag[i + 1];
      } else if (angle < 67.5) {
        m1 = mag[i - width + 1];
        m2 = mag[i + width - 1];
      } else if (angle < 112.5) {
        m1 = mag[i - width];
        m2 = mag[i + width];
      } else {
        m1 = mag[i - width - 1];
        m2 = mag[i + width + 1];
      }
      out[i] = mag[i] >= m1 && mag[i] >= m2 ? mag[i] : 0;
    }
  }
  return out;
}

function hysteresis(edges: Float32Array, width: number, height: number) {
  let maxVal = 0;
  for (let i = 0; i < edges.length; i += 1) maxVal = Math.max(maxVal, edges[i]);
  const high = maxVal * 0.23;
  const low = high * 0.48;
  const out = new Uint8Array(width * height);
  const stack: number[] = [];

  for (let i = 0; i < edges.length; i += 1) {
    if (edges[i] >= high) {
      out[i] = 1;
      stack.push(i);
    }
  }

  while (stack.length > 0) {
    const idx = stack.pop() as number;
    const x = idx % width;
    const y = Math.floor(idx / width);
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        if (ox === 0 && oy === 0) continue;
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (!out[ni] && edges[ni] >= low) {
          out[ni] = 1;
          stack.push(ni);
        }
      }
    }
  }

  return out;
}

function adaptiveThreshold(gray: Float32Array, width: number, height: number) {
  const integral = new Float32Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    for (let x = 1; x <= width; x += 1) {
      rowSum += gray[(y - 1) * width + (x - 1)];
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum;
    }
  }

  const out = new Uint8Array(width * height);
  const half = 7;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const x0 = clamp(x - half, 0, width - 1);
      const y0 = clamp(y - half, 0, height - 1);
      const x1 = clamp(x + half, 0, width - 1);
      const y1 = clamp(y + half, 0, height - 1);

      const a = integral[y0 * (width + 1) + x0];
      const b = integral[y0 * (width + 1) + (x1 + 1)];
      const c = integral[(y1 + 1) * (width + 1) + x0];
      const d = integral[(y1 + 1) * (width + 1) + (x1 + 1)];
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const mean = (d - b - c + a) / Math.max(1, area);
      out[y * width + x] = gray[y * width + x] < mean * 0.87 ? 1 : 0;
    }
  }

  return out;
}

function detectRoadMask(rgb: Uint8ClampedArray, gray: Float32Array, width: number, height: number) {
  const road = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const r = rgb[i * 4] / 255;
    const g = rgb[i * 4 + 1] / 255;
    const b = rgb[i * 4 + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lum = gray[i];
    road[i] = lum > 0.45 && lum < 0.82 && sat < 0.25 ? 1 : 0;
  }

  return road;
}

function polygonArea(points: PixelPoint[]) {
  if (points.length < 3) return 0;
  let acc = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    acc += p0.x * p1.y - p1.x * p0.y;
  }
  return Math.abs(acc * 0.5);
}

function perpendicularDistance(point: PixelPoint, start: PixelPoint, end: PixelPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const px = start.x + t * dx;
  const py = start.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}

function douglasPeucker(points: PixelPoint[], epsilon: number): PixelPoint[] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (dist > maxDist) {
      index = i;
      maxDist = dist;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [points[0], points[points.length - 1]];
}

function extractFootprints(buildingMask: Uint8Array, roadMask: Uint8Array, width: number, height: number): Footprint[] {
  const visited = new Uint8Array(width * height);
  const footprints: Footprint[] = [];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const start = y * width + x;
      if (visited[start] || buildingMask[start] === 0) continue;

      const queue = [start];
      visited[start] = 1;
      const pixels: PixelPoint[] = [];
      let overlapRoad = false;
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;

      while (queue.length > 0) {
        const idx = queue.pop() as number;
        const px = idx % width;
        const py = Math.floor(idx / width);
        pixels.push({ x: px, y: py });
        if (roadMask[idx]) overlapRoad = true;
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);

        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (ox === 0 && oy === 0) continue;
            const nx = px + ox;
            const ny = py + oy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const ni = ny * width + nx;
            if (!visited[ni] && buildingMask[ni]) {
              visited[ni] = 1;
              queue.push(ni);
            }
          }
        }
      }

      if (overlapRoad || pixels.length < 80) continue;

      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      const outline = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
        { x: minX, y: minY }
      ];
      const simplified = douglasPeucker(outline, 1.1);
      const clean = simplified.slice(0, -1);
      const area = polygonArea(clean);
      if (area < 60) continue;

      footprints.push({
        polygon: clean,
        centroid: { x: cx, y: cy },
        area,
        bbox: { minX, minY, maxX, maxY }
      });
    }
  }

  return footprints;
}

function estimateHeightMeters(footprint: Footprint, gray: Float32Array, width: number, height: number) {
  const sunDir = { x: 0.82, y: 0.57 };
  let bestShadow = 0;

  for (const p of footprint.polygon) {
    let shadowLength = 0;
    for (let s = 1; s < 42; s += 1) {
      const sx = Math.floor(p.x + sunDir.x * s);
      const sy = Math.floor(p.y + sunDir.y * s);
      if (sx < 1 || sy < 1 || sx >= width - 1 || sy >= height - 1) break;
      const lum = gray[sy * width + sx];
      if (lum < 0.26) {
        shadowLength = s;
      } else if (shadowLength > 0) {
        break;
      }
    }
    bestShadow = Math.max(bestShadow, shadowLength);
  }

  if (bestShadow > 2) {
    return clamp(bestShadow / Math.tan((SOLAR_ANGLE_DEG * Math.PI) / 180), 5, 70);
  }

  const normalized = clamp(Math.sqrt(footprint.area) / 18, 0, 1);
  return 5 + normalized * 65;
}

function createWindowTexture(THREE: any) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#d1d5db';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#94a3b8';
  for (let y = 8; y < 128; y += 16) {
    for (let x = 6; x < 128; x += 14) {
      const lit = (x + y) % 3 === 0;
      ctx.fillStyle = lit ? '#c7d2fe' : '#a8b4c3';
      ctx.fillRect(x, y, 7, 10);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.5, 3.5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createAoTexture(THREE: any) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(32, 32, 10, 32, 32, 32);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(1, '#a0a0a0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

function generateContextBuildingsFromImage(THREE: any, image: HTMLImageElement, mainBuildingPosition: { x: number; z: number }) {
  const maxSize = 512;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(128, Math.floor(image.width * scale));
  const height = Math.max(128, Math.floor(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { mesh: null, meta: [] as BuildingInstance[] };

  ctx.drawImage(image, 0, 0, width, height);
  const img = ctx.getImageData(0, 0, width, height);

  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const r = img.data[i * 4] / 255;
    const g = img.data[i * 4 + 1] / 255;
    const b = img.data[i * 4 + 2] / 255;
    gray[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const blurred = gaussianBlur(gray, width, height);
  const { mag, dir } = sobelEdges(blurred, width, height);
  const suppressed = nonMaxSuppression(mag, dir, width, height);
  const canny = hysteresis(suppressed, width, height);
  const adaptive = adaptiveThreshold(blurred, width, height);
  const roadMask = detectRoadMask(img.data, blurred, width, height);

  const buildingMask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    buildingMask[i] = canny[i] && adaptive[i] && !roadMask[i] ? 1 : 0;
  }

  const footprints = extractFootprints(buildingMask, roadMask, width, height);
  if (!footprints.length) return { mesh: null, meta: [] as BuildingInstance[] };

  const baseShape = new THREE.Shape([
    new THREE.Vector2(-0.5, -0.5),
    new THREE.Vector2(0.5, -0.5),
    new THREE.Vector2(0.5, 0.5),
    new THREE.Vector2(-0.5, 0.5)
  ]);
  const baseGeom = new THREE.ExtrudeGeometry(baseShape, { depth: 1, bevelEnabled: false, steps: 1, curveSegments: 1 });
  baseGeom.rotateX(-Math.PI / 2);
  baseGeom.translate(0, 0.5, 0);

  const windowTexture = createWindowTexture(THREE);
  const aoTexture = createAoTexture(THREE);
  const material = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.9,
    metalness: 0.05,
    map: windowTexture,
    aoMap: aoTexture,
    aoMapIntensity: 1.35
  });

  const instances: BuildingInstance[] = [];
  const aspectScale = width / height;
  for (const fp of footprints) {
    const cx = (fp.centroid.x / width - 0.5) * TERRAIN_SIZE;
    const cz = ((fp.centroid.y / height) - 0.5) * TERRAIN_SIZE * (1 / aspectScale);
    const dx = cx - mainBuildingPosition.x;
    const dz = cz - mainBuildingPosition.z;
    if (Math.hypot(dx, dz) < 1.9 || Math.hypot(cx, cz) > CONTEXT_RADIUS) continue;

    const widthWorld = Math.max(0.45, ((fp.bbox.maxX - fp.bbox.minX) / width) * TERRAIN_SIZE);
    const depthWorld = Math.max(0.45, ((fp.bbox.maxY - fp.bbox.minY) / height) * TERRAIN_SIZE * (1 / aspectScale));
    const hMeters = estimateHeightMeters(fp, blurred, width, height);
    const hWorld = hMeters / WORLD_METERS;

    instances.push({
      position: { x: cx, y: hWorld * 0.5, z: cz },
      scale: { x: widthWorld, y: hWorld, z: depthWorld },
      rotationY: 0,
      radius: Math.hypot(widthWorld, depthWorld) * 0.55
    });
  }

  const mesh = new THREE.InstancedMesh(baseGeom, material, instances.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const rotation = new THREE.Euler();
  const scaleVec = new THREE.Vector3();
  const position = new THREE.Vector3();

  instances.forEach((instance, idx) => {
    rotation.set(0, instance.rotationY, 0);
    quaternion.setFromEuler(rotation);
    position.set(instance.position.x, instance.position.y, instance.position.z);
    scaleVec.set(instance.scale.x, instance.scale.y, instance.scale.z);
    matrix.compose(position, quaternion, scaleVec);
    mesh.setMatrixAt(idx, matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return { mesh, meta: instances };
}

export function ThreeViewer({ imageUrl, title, latitude, longitude }: Props) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<ThreeRuntime | null>(null);
  const animationFrameRef = useRef<number>(0);

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'2d' | '3d'>('3d');
  const [intensity, setIntensity] = useState(0.32);
  const [autoRotate, setAutoRotate] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null);

  const centerLat = latitude ?? 35.6892;
  const centerLng = longitude ?? 51.389;

  const textureCandidates = useMemo(() => {
    const custom = imageUrl?.trim();
    const satellite = getSatelliteImage(latitude, longitude, 18);
    return [custom, satellite, PLACEHOLDER_TEXTURE].filter(Boolean) as string[];
  }, [imageUrl, latitude, longitude]);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;

    const setup = async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js');
      const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js');
      const { SSAOPass } = await import('three/examples/jsm/postprocessing/SSAOPass.js');
      if (disposed || !containerRef.current) return;

      const container = containerRef.current;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#dbeafe');

      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
      camera.position.set(0, 16, 16);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      const composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      const ssaoPass = new SSAOPass(scene, camera, 1, 1);
      ssaoPass.kernelRadius = 12;
      ssaoPass.minDistance = 0.002;
      ssaoPass.maxDistance = 0.075;
      composer.addPass(ssaoPass);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 6;
      controls.maxDistance = 44;
      controls.maxPolarAngle = Math.PI / 2.03;
      controls.target.set(0, 0.2, 0);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight.position.set(18, 22, 9);
      directionalLight.castShadow = true;
      scene.add(ambientLight, directionalLight);

      const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 256, 256);
      const terrainMaterial = new THREE.MeshStandardMaterial({
        color: '#dbeafe',
        roughness: 0.82,
        metalness: 0.06,
        displacementScale: intensity
      });
      const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
      terrain.rotation.x = -Math.PI / 2;
      terrain.receiveShadow = true;
      terrain.castShadow = false;
      scene.add(terrain);

      const buildingGeo = new THREE.BoxGeometry(1.5, 2.2, 1.5);
      const buildingMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.65, metalness: 0.22 });
      const building = new THREE.Mesh(buildingGeo, buildingMat);
      const buildingPos = latLngToPosition(centerLat, centerLng, centerLat, centerLng, TERRAIN_SCALE);
      building.position.set(buildingPos.x, 1.2, buildingPos.z);
      building.castShadow = true;
      scene.add(building);

      const clickMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 24, 24),
        new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#b91c1c', emissiveIntensity: 0.25 })
      );
      clickMarker.visible = false;
      clickMarker.position.set(0, 0.35, 0);
      scene.add(clickMarker);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const onClick = (event: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObject(terrain, false);
        if (!hits[0]) return;

        const point = hits[0].point;
        clickMarker.visible = true;
        clickMarker.position.set(point.x, 0.32, point.z);

        const mapped = positionToLatLng(point.x, point.z, centerLat, centerLng, TERRAIN_SCALE);
        setSelectedPoint(mapped);
      };
      renderer.domElement.addEventListener('click', onClick);

      const resize = () => {
        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        composer.setSize(width, height);
        ssaoPass.setSize(width, height);
      };
      window.addEventListener('resize', resize);
      resize();

      runtimeRef.current = {
        scene,
        camera,
        renderer,
        controls,
        terrain,
        terrainMaterial,
        building,
        contextBuildings: null,
        contextMeta: [],
        clickMarker,
        raycaster,
        pointer,
        THREE,
        composer,
        cleanupEvents: [
          () => renderer.domElement.removeEventListener('click', onClick),
          () => window.removeEventListener('resize', resize)
        ]
      };

      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        controls.autoRotate = autoRotate;
        controls.update();
        setZoomLevel(camera.position.distanceTo(controls.target));

        const runtime = runtimeRef.current;
        if (runtime?.contextBuildings && runtime.contextMeta.length > 0) {
          const frustum = new THREE.Frustum();
          const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
          frustum.setFromProjectionMatrix(viewProjection);
          const matrix = new THREE.Matrix4();
          const quaternion = new THREE.Quaternion();
          const rotation = new THREE.Euler();
          const scale = new THREE.Vector3();
          const position = new THREE.Vector3();

          for (let i = 0; i < runtime.contextMeta.length; i += 1) {
            const meta = runtime.contextMeta[i];
            const distance = Math.hypot(camera.position.x - meta.position.x, camera.position.z - meta.position.z);
            const sphere = new THREE.Sphere(new THREE.Vector3(meta.position.x, meta.position.y, meta.position.z), meta.radius * 1.4);
            const visible = distance < 28 && frustum.intersectsSphere(sphere);

            rotation.set(0, meta.rotationY, 0);
            quaternion.setFromEuler(rotation);
            position.set(meta.position.x, visible ? meta.position.y : -2000, meta.position.z);
            scale.set(meta.scale.x, visible ? meta.scale.y : 0.0001, meta.scale.z);
            matrix.compose(position, quaternion, scale);
            runtime.contextBuildings.setMatrixAt(i, matrix);
          }
          runtime.contextBuildings.instanceMatrix.needsUpdate = true;
        }

        composer.render();
      };
      animate();

      const textureLoader = new THREE.TextureLoader();
      for (const candidate of textureCandidates) {
        const texture = await new Promise<any>((resolve) => {
          textureLoader.load(candidate, resolve, undefined, () => resolve(null));
        });
        if (!texture) continue;

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        terrainMaterial.map = texture;
        terrainMaterial.displacementMap = texture;
        terrainMaterial.needsUpdate = true;

        const source = texture.source?.data;
        if (source instanceof HTMLImageElement) {
          const context = generateContextBuildingsFromImage(THREE, source, { x: building.position.x, z: building.position.z });
          if (context.mesh) {
            scene.add(context.mesh);
            runtimeRef.current!.contextBuildings = context.mesh;
            runtimeRef.current!.contextMeta = context.meta;
          }
        }

        setLoading(false);
        break;
      }

      setLoading(false);
    };

    setup();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameRef.current);
      const runtime = runtimeRef.current;
      if (runtime) {
        runtime.cleanupEvents.forEach((fn) => fn());
        runtime.controls?.dispose?.();
        runtime.composer?.dispose?.();
        runtime.renderer?.dispose?.();
        runtime.scene?.clear?.();
      }
      runtimeRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [centerLat, centerLng, textureCandidates]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.terrainMaterial.displacementScale = mode === '3d' ? intensity : 0;
    runtime.terrainMaterial.needsUpdate = true;
  }, [mode, intensity]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.controls.autoRotate = autoRotate;
  }, [autoRotate]);

  const resetCamera = () => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.camera.position.set(0, 16, 16);
    runtime.controls.target.set(0, 0.2, 0);
    runtime.controls.update();
  };

  return (
    <section className="space-y-4 rounded-2xl bg-white/75 p-5 shadow backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">{t.property.viewerTitle}</h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMode('2d')} className={`rounded-lg px-3 py-1.5 text-sm ${mode === '2d' ? 'bg-slate-900 text-white' : 'border bg-white text-slate-700'}`}>{t.property.mode2d}</button>
          <button type="button" onClick={() => setMode('3d')} className={`rounded-lg px-3 py-1.5 text-sm ${mode === '3d' ? 'bg-slate-900 text-white' : 'border bg-white text-slate-700'}`}>{t.property.mode3d}</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <label className="flex items-center gap-2">
          <span>{t.property.intensity}</span>
          <input type="range" min={0.2} max={0.5} step={0.01} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} className="w-44" disabled={mode === '2d'} />
        </label>
        <button type="button" onClick={resetCamera} className="rounded-md border px-3 py-1">{t.property.resetCamera}</button>
        <button type="button" onClick={() => setAutoRotate((prev) => !prev)} className="rounded-md border px-3 py-1">{t.property.autoRotate}: {autoRotate ? 'روشن' : 'خاموش'}</button>
        <span>{t.property.zoom}: {zoomLevel.toFixed(1)}</span>
      </div>

      <div className="relative h-[500px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100" ref={containerRef}>
        {loading && <div className="absolute inset-0 grid place-content-center text-sm text-slate-600">{t.property.loadingViewer}</div>}
        {selectedPoint && (
          <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-700 shadow">
            Lat: {selectedPoint.lat.toFixed(6)} | Lng: {selectedPoint.lng.toFixed(6)}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">{title}</p>
    </section>
  );
}
