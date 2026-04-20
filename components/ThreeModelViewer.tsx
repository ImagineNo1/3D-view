'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Props = {
  modelUrl: string;
};

export function ThreeModelViewer({ modelUrl }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    container.innerHTML = '';
    setLoading(true);
    setError(null);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f1f5f9');

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(2, 2, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 10, 7);
    scene.add(ambientLight, directionalLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0.75, 0);

    const loader = new GLTFLoader();
    let mounted = true;

    loader.load(
      modelUrl,
      (gltf) => {
        if (!mounted) return;
        scene.add(gltf.scene);

        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        gltf.scene.position.sub(center);

        setLoading(false);
      },
      undefined,
      () => {
        if (!mounted) return;
        setError('Failed to load 3D model. Verify the URL and CORS configuration.');
        setLoading(false);
      }
    );

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', onResize);

    const animate = () => {
      if (!mounted) return;
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      mounted = false;
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      scene.clear();
      container.innerHTML = '';
    };
  }, [modelUrl]);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-900">3D Tour</h2>
      <div className="relative h-[420px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100" ref={mountRef}>
        {loading && <div className="absolute inset-0 grid place-content-center text-sm text-slate-600">Loading model…</div>}
        {error && <div className="absolute inset-0 grid place-content-center p-4 text-center text-sm text-red-700">{error}</div>}
      </div>
      <p className="text-xs text-slate-500">Mouse controls: left drag rotate, right drag pan, scroll zoom.</p>
    </section>
  );
}
