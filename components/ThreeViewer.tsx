'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Props = {
  imageUrl?: string;
  title: string;
};

export function ThreeViewer({ imageUrl, title }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasImage = useMemo(() => Boolean(imageUrl?.trim()), [imageUrl]);

  useEffect(() => {
    if (!containerRef.current || !imageUrl?.trim()) {
      setLoading(false);
      return;
    }

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dbeafe');
    scene.fog = new THREE.Fog(0xdbeafe, 30, 80);

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 150);
    camera.position.set(0, 12.5, 15);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const skyLight = new THREE.HemisphereLight(0xe0f2fe, 0x475569, 0.8);
    scene.add(skyLight);

    const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.2);
    sunLight.position.set(14, 18, 7);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xa5b4fc, 0.35);
    rimLight.position.set(-10, 6, -12);
    scene.add(rimLight);

    const groundGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.45 })
    );
    groundGlow.rotation.x = -Math.PI / 2;
    groundGlow.position.y = -0.65;
    scene.add(groundGlow);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.85;
    controls.panSpeed = 0.75;
    controls.minDistance = 7;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI / 2.12;
    controls.target.set(0, 0.35, 0);
    controls.enablePan = true;
    controls.maxTargetRadius = 5;

    const terrainGeometry = new THREE.PlaneGeometry(20, 20, 220, 220);
    const textureLoader = new THREE.TextureLoader();

    let frameId = 0;
    let disposed = false;
    let terrain: any = null;
    let cloudLayer: any = null;

    textureLoader.load(
      imageUrl,
      (texture: any) => {
        if (disposed) return;

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        const displacementTexture = texture.clone();
        displacementTexture.needsUpdate = true;

        const terrainMaterial = new THREE.MeshStandardMaterial({
          map: texture,
          displacementMap: displacementTexture,
          displacementScale: 1.15,
          roughness: 0.9,
          metalness: 0.03,
          envMapIntensity: 0.45
        });

        terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrain.rotation.x = -Math.PI / 2;
        terrain.receiveShadow = true;
        terrain.castShadow = true;
        terrain.position.y = -0.15;
        scene.add(terrain);

        const cloudMaterial = new THREE.MeshStandardMaterial({
          map: texture,
          transparent: true,
          opacity: 0.1,
          roughness: 1,
          metalness: 0,
          depthWrite: false
        });
        cloudLayer = new THREE.Mesh(new THREE.PlaneGeometry(20.2, 20.2, 24, 24), cloudMaterial);
        cloudLayer.rotation.x = -Math.PI / 2;
        cloudLayer.position.y = 0.6;
        scene.add(cloudLayer);

        setLoading(false);
      },
      undefined,
      () => {
        if (disposed) return;
        setError('Could not load satellite image for 3D viewer.');
        setLoading(false);
      }
    );

    const clock = new THREE.Clock();

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (terrain) {
        terrain.position.y = -0.15 + Math.sin(t * 0.6) * 0.03;
      }

      if (cloudLayer) {
        cloudLayer.rotation.z = Math.sin(t * 0.22) * 0.04;
        cloudLayer.material.opacity = 0.08 + Math.sin(t * 0.35) * 0.02;
      }

      sunLight.position.x = 14 + Math.sin(t * 0.33) * 2.1;
      sunLight.position.z = 7 + Math.cos(t * 0.33) * 1.6;
      sunLight.intensity = 1.12 + Math.sin(t * 0.5) * 0.08;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nextWidth = Math.max(container.clientWidth, 1);
      const nextHeight = Math.max(container.clientHeight, 1);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    };

    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      window.cancelAnimationFrame(frameId);
      controls.dispose();
      terrainGeometry.dispose();
      renderer.dispose();
      scene.clear();
      container.innerHTML = '';
    };
  }, [imageUrl]);

  return (
    <section className="space-y-3 rounded-xl bg-white p-6 shadow">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Fake 3D الأرض Viewer</h2>
        {hasImage && (
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => containerRef.current?.requestFullscreen()}
          >
            Fullscreen
          </button>
        )}
      </div>

      {!hasImage && <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">No satellite image found for this property.</p>}

      <div className="relative h-[420px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100" ref={containerRef}>
        {loading && hasImage && <div className="absolute inset-0 grid place-content-center text-sm text-slate-600">Loading 3D viewer…</div>}
        {error && <div className="absolute inset-0 grid place-content-center p-3 text-center text-sm text-red-700">{error}</div>}
      </div>

      <p className="text-xs text-slate-500">{title}: elevated terrain with smooth lighting and animated atmosphere.</p>
    </section>
  );
}
