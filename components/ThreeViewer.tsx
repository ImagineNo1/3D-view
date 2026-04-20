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

const PLACEHOLDER_TEXTURE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#dbeafe"/><stop offset="55%" stop-color="#bfdbfe"/><stop offset="100%" stop-color="#93c5fd"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/><g fill="none" stroke="#ffffff55" stroke-width="10"><path d="M0 120h1024M0 280h1024M0 480h1024M0 700h1024M0 900h1024"/><path d="M90 0v1024M300 0v1024M540 0v1024M770 0v1024M950 0v1024"/></g></svg>`);

export function ThreeViewer({ imageUrl, title, latitude, longitude }: Props) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'2d' | '3d'>('3d');
  const [intensity, setIntensity] = useState(0.36);
  const [autoRotate, setAutoRotate] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [markerInfo, setMarkerInfo] = useState('');

  const textureCandidates = useMemo(() => {
    const custom = imageUrl?.trim();
    const satellite = getSatelliteImage(latitude, longitude, 18);
    return [custom, satellite, PLACEHOLDER_TEXTURE].filter(Boolean) as string[];
  }, [imageUrl, latitude, longitude]);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let frameId = 0;

    const start = async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (disposed || !containerRef.current) return;

      const container = containerRef.current;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#dbeafe');
      scene.fog = new THREE.Fog('#dbeafe', 16, 48);

      const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1000);
      camera.position.set(0, 16, 16);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      container.appendChild(renderer.domElement);

      const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(10, 22, 10);
      directionalLight.castShadow = true;
      scene.add(directionalLight);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 7;
      controls.maxDistance = 38;
      controls.minPolarAngle = 0.3;
      controls.maxPolarAngle = Math.PI / 2.02;
      controls.target.set(0, 0.5, 0);
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 0.45;
      controlsRef.current = controls;

      const geometry = new THREE.PlaneGeometry(22, 22, 220, 220);
      const material = new THREE.MeshStandardMaterial({ color: '#dbeafe', roughness: 0.82, metalness: 0.06, displacementScale: mode === '3d' ? intensity : 0 });
      const terrain = new THREE.Mesh(geometry, material);
      terrain.rotation.x = -Math.PI / 2;
      terrain.receiveShadow = true;
      terrain.castShadow = true;
      scene.add(terrain);

      const markerData = [
        { label: t.property.markerEntry, position: new THREE.Vector3(-4, 0.7, -3) },
        { label: t.property.markerBuilding, position: new THREE.Vector3(2, 1, 1) },
        { label: t.property.markerParking, position: new THREE.Vector3(5, 0.5, 4) }
      ];

      const markers = markerData.map((item) => {
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.35, 18, 18), new THREE.MeshStandardMaterial({ color: '#ef4444' }));
        sphere.position.copy(item.position);
        sphere.userData = { label: item.label };
        scene.add(sphere);
        return sphere;
      });

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const onClick = (event: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(markers);
        if (hits[0]?.object.userData.label) setMarkerInfo(String(hits[0].object.userData.label));
      };
      renderer.domElement.addEventListener('click', onClick);

      const textureLoader = new THREE.TextureLoader();
      for (const candidate of textureCandidates) {
        try {
          const texture = await new Promise<any>((resolve, reject) => textureLoader.load(candidate, resolve, undefined, reject));
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          material.map = texture;
          material.displacementMap = texture;
          material.needsUpdate = true;
          break;
        } catch {
          // silent fallback chain
        }
      }
      setLoading(false);

      const resize = () => {
        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };
      resize();
      window.addEventListener('resize', resize);

      const animate = () => {
        frameId = requestAnimationFrame(animate);
        controls.autoRotate = autoRotate;
        controls.update();
        setZoomLevel(camera.position.distanceTo(controls.target));
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', resize);
        renderer.domElement.removeEventListener('click', onClick);
        controls.dispose();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        scene.clear();
        container.innerHTML = '';
      };
    };

    let cleanup: (() => void) | undefined;
    start().then((fn) => {
      cleanup = fn;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [autoRotate, intensity, mode, t.property.markerBuilding, t.property.markerEntry, t.property.markerParking, textureCandidates]);

  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 16, 16);
    controlsRef.current.target.set(0, 0.5, 0);
    controlsRef.current.update();
  };

  return (
    <section className="space-y-3 rounded-2xl bg-white/75 p-5 shadow backdrop-blur-md">
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
          <input type="range" min={0.2} max={0.6} step={0.01} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} className="w-44" disabled={mode === '2d'} />
        </label>
        <button type="button" onClick={resetCamera} className="rounded-md border px-3 py-1">{t.property.resetCamera}</button>
        <button type="button" onClick={() => setAutoRotate((prev) => !prev)} className="rounded-md border px-3 py-1">{t.property.autoRotate}: {autoRotate ? 'روشن' : 'خاموش'}</button>
        <span>{t.property.zoom}: {zoomLevel.toFixed(1)}</span>
      </div>

      <div className="relative h-[500px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100" ref={containerRef}>
        {loading && <div className="absolute inset-0 grid place-content-center text-sm text-slate-600">{t.property.loadingViewer}</div>}
        {markerInfo && <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-700 shadow">{t.property.markers}: {markerInfo}</div>}
      </div>

      <p className="text-xs text-slate-500">{title}</p>
    </section>
  );
}
