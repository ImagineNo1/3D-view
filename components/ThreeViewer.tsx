'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSatelliteImage } from '@/lib/maps';

type Props = {
  imageUrl?: string;
  title: string;
  latitude?: number;
  longitude?: number;
};

const PLACEHOLDER_TEXTURE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#dbeafe"/>
        <stop offset="55%" stop-color="#bfdbfe"/>
        <stop offset="100%" stop-color="#93c5fd"/>
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#g)"/>
    <g fill="none" stroke="#ffffff55" stroke-width="10">
      <path d="M0 120h1024M0 280h1024M0 480h1024M0 700h1024M0 900h1024"/>
      <path d="M90 0v1024M300 0v1024M540 0v1024M770 0v1024M950 0v1024"/>
    </g>
  </svg>
`);

export function ThreeViewer({ imageUrl, title, latitude, longitude }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'2d' | '3d'>('3d');
  const [intensity, setIntensity] = useState(0.35);

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
      scene.background = new THREE.Color('#e2e8f0');

      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
      camera.position.set(0, 12, 14);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.05);
      directionalLight.position.set(8, 16, 12);
      scene.add(directionalLight);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableZoom = true;
      controls.enableRotate = true;
      controls.enablePan = true;
      controls.enableDamping = true;
      controls.minDistance = 6;
      controls.maxDistance = 35;
      controls.maxPolarAngle = Math.PI / 2.05;
      controls.target.set(0, 0.2, 0);

      const geometry = new THREE.PlaneGeometry(20, 20, 100, 100);
      const material = new THREE.MeshStandardMaterial({
        color: '#e2e8f0',
        roughness: 0.95,
        metalness: 0.02,
        displacementScale: mode === '3d' ? intensity : 0
      });

      const terrain = new THREE.Mesh(geometry, material);
      terrain.rotation.x = -Math.PI / 2;
      scene.add(terrain);

      const textureLoader = new THREE.TextureLoader();
      const loadTexture = async () => {
        for (const candidate of textureCandidates) {
          try {
            const texture = await new Promise<any>((resolve, reject) => {
              textureLoader.load(candidate, resolve, undefined, reject);
            });

            texture.colorSpace = THREE.SRGBColorSpace;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            material.map = texture;
            material.displacementMap = texture;
            material.needsUpdate = true;
            setLoading(false);
            return;
          } catch {
            // silent fallback
          }
        }
        setLoading(false);
      };

      const resize = () => {
        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };

      await loadTexture();
      resize();
      window.addEventListener('resize', resize);

      const animate = () => {
        frameId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', resize);
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
  }, [intensity, mode, textureCandidates]);

  return (
    <section className="space-y-3 rounded-2xl bg-white/75 p-5 shadow backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Property Viewer</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('2d')}
            className={`rounded-lg px-3 py-1.5 text-sm ${mode === '2d' ? 'bg-slate-900 text-white' : 'border bg-white text-slate-700'}`}
          >
            2D
          </button>
          <button
            type="button"
            onClick={() => setMode('3d')}
            className={`rounded-lg px-3 py-1.5 text-sm ${mode === '3d' ? 'bg-slate-900 text-white' : 'border bg-white text-slate-700'}`}
          >
            3D
          </button>
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm text-slate-600">
        <span>3D intensity</span>
        <input
          type="range"
          min={0.2}
          max={0.5}
          step={0.01}
          value={intensity}
          onChange={(event) => setIntensity(Number(event.target.value))}
          className="w-48"
          disabled={mode === '2d'}
        />
        <span>{mode === '2d' ? '0.00' : intensity.toFixed(2)}</span>
      </label>

      <div className="relative h-[500px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100" ref={containerRef}>
        {loading && <div className="absolute inset-0 grid place-content-center text-sm text-slate-600">Loading viewer...</div>}
      </div>

      <p className="text-xs text-slate-500">{title}: always renders using custom aerial, Google satellite fallback, or a local placeholder texture.</p>
    </section>
  );
}
