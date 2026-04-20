'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { canvasToBlob, generateOrthographicCanvases, type ProjectionCanvases } from '@/components/building/projectionGenerator';
import { createModelData } from '@/components/building/generators';
import { loadBuildingTextures } from '@/components/building/textureLoader';

function createCoordinateLabelSprite(text: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.95)';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(12, 2.4, 1);
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
  const controlsRef = useRef<InstanceType<typeof OrbitControls> | null>(null);
  const cameraRef = useRef<any>(null);
  const viewModeRef = useRef<'2d' | '3d'>('3d');
  const autoRotateRef = useRef(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [autoRotate, setAutoRotate] = useState(false);
  const [projections, setProjections] = useState<ProjectionCanvases | null>(null);

  const model = useMemo(
    () =>
      createModelData({
        buildingArea,
        buildingHeight,
        floorCount,
        floorHeight,
        latitude,
        longitude,
        facadeImages,
        aerialImage,
        rotation
      }),
    [buildingArea, buildingHeight, floorCount, floorHeight, latitude, longitude, facadeImages, aerialImage, rotation]
  );

  useEffect(() => {
    let active = true;

    generateOrthographicCanvases(model).then((result) => {
      if (!active) return;
      setProjections(result);
    });

    return () => {
      active = false;
    };
  }, [model]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dfe6f1');

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 6000);
    camera.position.set(model.width * 1.8, Math.max(model.buildingHeight * 0.9, 16), model.depth * 1.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    cameraRef.current = camera;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = Math.max(model.width, model.depth) * 0.4;
    controls.maxDistance = Math.max(model.width, model.depth) * 12;
    controls.target.set(0, model.buildingHeight * 0.4, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.25);
    directionalLight.position.set(model.width * 1.7, model.buildingHeight * 2.2, model.depth * 1.5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(2048, 2048);
    scene.add(ambientLight, directionalLight);

    const groundSize = Math.max(model.width, model.depth) * 10;
    const groundMaterial = new THREE.MeshStandardMaterial({ color: '#bfcad9', roughness: 0.92, metalness: 0.02 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const topMaterial = new THREE.MeshStandardMaterial({ color: '#9ca3af', roughness: 0.82, metalness: 0.04 });
    const bottomMaterial = new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.95, metalness: 0.02 });
    const rightMaterial = new THREE.MeshStandardMaterial({ color: '#d1d5db', roughness: 0.84, metalness: 0.06 });
    const leftMaterial = new THREE.MeshStandardMaterial({ color: '#d1d5db', roughness: 0.84, metalness: 0.06 });
    const frontMaterial = new THREE.MeshStandardMaterial({ color: '#e5e7eb', roughness: 0.82, metalness: 0.06 });
    const backMaterial = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.86, metalness: 0.05 });

    const materials: any[] = [rightMaterial, leftMaterial, topMaterial, bottomMaterial, frontMaterial, backMaterial];

    const buildingGeometry = new THREE.BoxGeometry(model.width, model.buildingHeight, model.depth);
    buildingGeometry.translate(0, model.buildingHeight / 2, 0);

    const building = new THREE.Mesh(buildingGeometry, materials);
    building.castShadow = true;
    building.receiveShadow = true;
    building.rotation.y = model.rotationY;
    scene.add(building);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.45, model.width * 0.03), 24, 24),
      new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#7f1d1d', emissiveIntensity: 0.35 })
    );
    marker.position.set(0, model.buildingHeight + 1.4, 0);
    scene.add(marker);

    const label = createCoordinateLabelSprite(`Lat ${model.lat.toFixed(6)}, Lon ${model.lon.toFixed(6)}`);
    if (label) {
      label.position.set(0, model.buildingHeight + 3.2, 0);
      scene.add(label);
    }

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    loadBuildingTextures(textureLoader, model.assets).then(({ groundTexture, rightTexture, leftTexture, frontTexture, backTexture }) => {
      if (groundTexture) {
        groundTexture.wrapS = THREE.ClampToEdgeWrapping;
        groundTexture.wrapT = THREE.ClampToEdgeWrapping;
        groundMaterial.map = groundTexture;
        groundMaterial.needsUpdate = true;
      }

      if (rightTexture) {
        rightMaterial.map = rightTexture;
        rightMaterial.needsUpdate = true;
      }
      if (leftTexture) {
        leftMaterial.map = leftTexture;
        leftMaterial.needsUpdate = true;
      }
      if (frontTexture) {
        frontMaterial.map = frontTexture;
        frontMaterial.needsUpdate = true;
      }
      if (backTexture) {
        backMaterial.map = backTexture;
        backMaterial.needsUpdate = true;
      }
    });

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
      controls.autoRotate = autoRotateRef.current && viewModeRef.current === '3d';
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      controlsRef.current = null;
      cameraRef.current = null;
      controls.dispose();
      scene.traverse((obj: any) => {
        const mesh = obj as any;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat: any) => {
            const standardMat = mat as any;
            if (standardMat.map) standardMat.map.dispose();
            standardMat.dispose();
          });
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [model]);

  useEffect(() => {
    viewModeRef.current = viewMode;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

    if (viewMode === '2d') {
      camera.position.set(0, Math.max(model.buildingHeight * 2.8, 40), 0.001);
      controls.enableRotate = false;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = 0;
    } else {
      camera.position.set(model.width * 1.8, Math.max(model.buildingHeight * 0.9, 16), model.depth * 1.8);
      controls.enableRotate = true;
      controls.minPolarAngle = 0.05;
      controls.maxPolarAngle = Math.PI / 2.02;
    }

    controls.target.set(0, model.buildingHeight * 0.4, 0);
    controls.update();
  }, [model.buildingHeight, model.depth, model.width, viewMode]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  const handleDownloadProjection = async (key: keyof ProjectionCanvases) => {
    if (!projections) return;
    const blob = await canvasToBlob(projections[key]);
    if (!blob) return;

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${key}-orthographic.png`;
    link.click();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-slate-200">
      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
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
        <button type="button" onClick={() => handleDownloadProjection('top')} className="rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-900">
          Export Top PNG
        </button>
        <button type="button" onClick={() => handleDownloadProjection('front')} className="rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-900">
          Export Front PNG
        </button>
        <button type="button" onClick={() => handleDownloadProjection('left')} className="rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-900">
          Export Left PNG
        </button>
      </div>
      <div ref={containerRef} className="h-[700px] w-full" />
      {viewMode === '2d' && projections && (
        <div className="grid gap-3 bg-slate-100 p-3 md:grid-cols-3">
          {(['top', 'front', 'left'] as const).map((key) => (
            <img key={key} src={projections[key].toDataURL('image/png')} alt={`${key} orthographic`} className="w-full rounded-lg border border-slate-300 bg-white" />
          ))}
        </div>
      )}
    </div>
  );
}
