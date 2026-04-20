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

type ThreeRuntime = {
  scene: any;
  camera: any;
  renderer: any;
  controls: any;
  terrain: any;
  terrainMaterial: any;
  building: any;
  clickMarker: any;
  raycaster: any;
  pointer: any;
  THREE: any;
  cleanupEvents: Array<() => void>;
};

const TERRAIN_SCALE = 4200;

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
      if (disposed || !containerRef.current) return;

      const container = containerRef.current;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#dbeafe');

      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
      camera.position.set(0, 16, 16);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 6;
      controls.maxDistance = 44;
      controls.maxPolarAngle = Math.PI / 2.03;
      controls.target.set(0, 0.2, 0);

      const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight.position.set(18, 22, 9);
      directionalLight.castShadow = true;
      scene.add(ambientLight, directionalLight);

      const terrainGeometry = new THREE.PlaneGeometry(22, 22, 256, 256);
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
        clickMarker,
        raycaster,
        pointer,
        THREE,
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
        renderer.render(scene, camera);
      };
      animate();

      const textureLoader = new THREE.TextureLoader();
      for (const candidate of textureCandidates) {
        try {
          const texture = await new Promise<any>((resolve, reject) => textureLoader.load(candidate, resolve, undefined, reject));
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          terrainMaterial.map = texture;
          terrainMaterial.displacementMap = texture;
          terrainMaterial.needsUpdate = true;
          setLoading(false);
          break;
        } catch {
          // silent fallback chain
        }
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
