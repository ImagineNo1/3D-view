'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const DEFAULT_RATIO = 0.6;

function toPositiveNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function computeDimensions(buildingArea: unknown, widthToDepthRatio = DEFAULT_RATIO) {
  const area = toPositiveNumber(buildingArea, 100);
  const ratio = toPositiveNumber(widthToDepthRatio, DEFAULT_RATIO);
  const depth = Math.sqrt(area / ratio);
  const width = ratio * depth;
  return { width, depth };
}

function normalizeRotationY(rotation: unknown) {
  const raw = Number(rotation);
  if (!Number.isFinite(raw)) return 0;
  return Math.abs(raw) > Math.PI * 2 ? THREE.MathUtils.degToRad(raw) : raw;
}

function createCoordinateLabelSprite(text: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.9)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 34px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(8, 2, 1);
  return sprite;
}

type GeneratedBuildingModelProps = {
  buildingArea?: number;
  buildingHeight?: number;
  floorCount?: number;
  floorHeight?: number;
  latitude?: number;
  longitude?: number;
  facadeImages?: string[];
  aerialImage?: string;
  rotation?: number;
};

export default function GeneratedBuildingModel({
  buildingArea,
  buildingHeight,
  floorCount,
  floorHeight,
  latitude,
  longitude,
  facadeImages = [],
  aerialImage,
  rotation
}: GeneratedBuildingModelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [autoRotate, setAutoRotate] = useState(false);

  const model = useMemo(() => {
    const safeFloorCount = Math.max(1, Math.round(toPositiveNumber(floorCount, 1)));
    const safeBuildingHeight = toPositiveNumber(buildingHeight, safeFloorCount * 3.2);
    const safeFloorHeight = toPositiveNumber(floorHeight, safeBuildingHeight / safeFloorCount);
    const normalizedHeight = safeFloorHeight * safeFloorCount;
    const { width, depth } = computeDimensions(buildingArea, DEFAULT_RATIO);

    return {
      width,
      depth,
      floorCount: safeFloorCount,
      floorHeight: safeFloorHeight,
      buildingHeight: normalizedHeight,
      rotationY: normalizeRotationY(rotation),
      lat: Number.isFinite(Number(latitude)) ? Number(latitude) : 0,
      lon: Number.isFinite(Number(longitude)) ? Number(longitude) : 0,
      facadeUrl: facadeImages?.[0] || null
    };
  }, [buildingArea, buildingHeight, floorCount, floorHeight, latitude, longitude, facadeImages, rotation]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e2e8f0');

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    camera.position.set(model.width * 1.6, model.buildingHeight * 0.8, model.depth * 1.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, model.buildingHeight * 0.35, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.15);
    directionalLight.position.set(model.width * 1.5, model.buildingHeight * 1.8, model.depth * 1.2);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(2048, 2048);
    scene.add(ambientLight, directionalLight);

    const groundSize = Math.max(model.width, model.depth) * 8;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSize, groundSize),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.95, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const buildingGroup = new THREE.Group();

    const floorLineMaterial = new THREE.LineBasicMaterial({ color: 0x94a3b8 });
    for (let i = 1; i < model.floorCount; i += 1) {
      const y = i * model.floorHeight;
      const floorRect = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-model.width / 2, y, -model.depth / 2),
        new THREE.Vector3(model.width / 2, y, -model.depth / 2),
        new THREE.Vector3(model.width / 2, y, model.depth / 2),
        new THREE.Vector3(-model.width / 2, y, model.depth / 2),
        new THREE.Vector3(-model.width / 2, y, -model.depth / 2)
      ]);
      buildingGroup.add(new THREE.Line(floorRect, floorLineMaterial));
    }

    const buildingGeometry = new THREE.BoxGeometry(model.width, model.buildingHeight, model.depth);
    buildingGeometry.translate(0, model.buildingHeight / 2, 0);

    const sideMaterial = new THREE.MeshStandardMaterial({ color: '#d1d5db', roughness: 0.88, metalness: 0.08 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: '#9ca3af', roughness: 0.9, metalness: 0.04 });
    const bottomMaterial = new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.95, metalness: 0.03 });
    const frontMaterial = new THREE.MeshStandardMaterial({ color: '#e5e7eb', roughness: 0.86, metalness: 0.06 });
    const backMaterial = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.9, metalness: 0.05 });

    const materials = [sideMaterial, sideMaterial, roofMaterial, bottomMaterial, frontMaterial, backMaterial];

    const buildingMesh = new THREE.Mesh(buildingGeometry, materials);
    buildingMesh.castShadow = true;
    buildingMesh.receiveShadow = true;
    buildingGroup.add(buildingMesh);

    buildingGroup.rotation.y = model.rotationY;
    scene.add(buildingGroup);

    const coordMarker = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.4, model.width * 0.03), 24, 24),
      new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#7f1d1d', emissiveIntensity: 0.3 })
    );
    coordMarker.position.set(0, model.buildingHeight + 1.4, 0);
    scene.add(coordMarker);

    const labelText = `Lat ${model.lat.toFixed(6)}, Lon ${model.lon.toFixed(6)}`;
    const labelSprite = createCoordinateLabelSprite(labelText);
    if (labelSprite) {
      labelSprite.position.set(0, model.buildingHeight + 3.1, 0);
      scene.add(labelSprite);
    }

    if (model.facadeUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        model.facadeUrl,
        (texture: any) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          frontMaterial.map = texture;
          frontMaterial.needsUpdate = true;
        },
        undefined,
        () => {
          frontMaterial.color.set('#d1d5db');
        }
      );
    }

    const onResize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', onResize);
    onResize();

    let frameId = 0;
    const render = () => {
      frameId = window.requestAnimationFrame(render);
      controls.autoRotate = autoRotate && viewMode === '3d';
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    const applyViewMode = () => {
      if (viewMode === '2d') {
        camera.position.set(0, Math.max(model.buildingHeight * 2.6, 35), 0.01);
        controls.enableRotate = false;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = 0;
      } else {
        camera.position.set(model.width * 1.6, model.buildingHeight * 0.8, model.depth * 1.6);
        controls.enableRotate = true;
        controls.minPolarAngle = 0.1;
        controls.maxPolarAngle = Math.PI / 2.05;
      }
      controls.target.set(0, model.buildingHeight * 0.35, 0);
      controls.update();
    };
    applyViewMode();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      scene.traverse((obj: any) => {
        const mesh = obj as any;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat: any) => {
            if (mat.map) mat.map.dispose();
            mat.dispose();
          });
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [autoRotate, model, viewMode]);

  return (
    <div className="relative h-full min-h-[700px] w-full overflow-hidden rounded-2xl">
      <div className="absolute left-4 top-4 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => setViewMode('2d')}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${viewMode === '2d' ? 'bg-slate-900 text-white' : 'bg-white/90 text-slate-900'}`}
        >
          2D
        </button>
        <button
          type="button"
          onClick={() => setViewMode('3d')}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${viewMode === '3d' ? 'bg-slate-900 text-white' : 'bg-white/90 text-slate-900'}`}
        >
          3D
        </button>
        <button
          type="button"
          onClick={() => setAutoRotate((prev) => !prev)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${autoRotate ? 'bg-blue-600 text-white' : 'bg-white/90 text-slate-900'}`}
        >
          Auto Rotate
        </button>
      </div>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
