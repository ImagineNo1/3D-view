'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Props = {
  modelUrl: string;
};

function hasUsableWebGL(): boolean {
  if (typeof window === 'undefined') return false;

  const canvas = document.createElement('canvas');
  const options: WebGLContextAttributes = {
    powerPreference: 'low-power',
    failIfMajorPerformanceCaveat: true
  };

  const webgl2 = canvas.getContext('webgl2', options);
  if (webgl2) return true;

  const webgl = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options);
  return Boolean(webgl);
}

export function ThreeModelViewer({ modelUrl }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerEnabled, setViewerEnabled] = useState(false);

  const canUseWebGL = useMemo(() => hasUsableWebGL(), []);

  useEffect(() => {
    if (!viewerEnabled) return;
    if (!canUseWebGL) {
      setError('This device/browser does not have stable WebGL support.');
      return;
    }
    if (!mountRef.current) return;

    const container = mountRef.current;
    container.innerHTML = '';
    setLoading(true);
    setError(null);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f1f5f9');

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(2, 2, 3);

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: 'low-power',
        failIfMajorPerformanceCaveat: true
      });
    } catch {
      setError('3D is not supported on this browser/device. Please open this link in Chrome or Safari.');
      setLoading(false);
      return;
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
    directionalLight.position.set(5, 10, 7);
    scene.add(ambientLight, directionalLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.target.set(0, 0.75, 0);

    const loader = new GLTFLoader();
    let mounted = true;

    const stopLoadingWithError = (message: string) => {
      setError(message);
      setLoading(false);
    };

    const renderScene = () => {
      if (!mounted) return;
      renderer.render(scene, camera);
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (!mounted) return;
      stopLoadingWithError('3D rendering crashed on this device. Please open the link in your phone browser.');
    };

    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    controls.addEventListener('change', renderScene);

    loader.load(
      modelUrl,
      (gltf) => {
        if (!mounted) return;
        scene.add(gltf.scene);

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center);

        setLoading(false);
        renderScene();
      },
      undefined,
      () => {
        if (!mounted) return;
        stopLoadingWithError('Failed to load 3D model. Verify the URL and CORS configuration.');
      }
    );

    const onResize = () => {
      const nextWidth = Math.max(container.clientWidth, 1);
      const nextHeight = Math.max(container.clientHeight, 1);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
      renderScene();
    };

    window.addEventListener('resize', onResize);

    return () => {
      mounted = false;
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('change', renderScene);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      renderer.dispose();
      scene.clear();
      container.innerHTML = '';
    };
  }, [canUseWebGL, modelUrl, viewerEnabled]);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-900">3D Tour</h2>

      {!viewerEnabled && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p className="mb-3">To avoid crashes on low-end devices, 3D view is manual.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewerEnabled(true)}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Load 3D Tour
            </button>
            <a
              href={modelUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open model link
            </a>
          </div>
        </div>
      )}

      <div className="relative h-[420px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100" ref={mountRef}>
        {loading && <div className="absolute inset-0 grid place-content-center text-sm text-slate-600">Loading model…</div>}
        {error && <div className="absolute inset-0 grid place-content-center p-4 text-center text-sm text-red-700">{error}</div>}
      </div>
      <p className="text-xs text-slate-500">Mouse controls: left drag rotate, right drag pan, scroll zoom.</p>
    </section>
  );
}
