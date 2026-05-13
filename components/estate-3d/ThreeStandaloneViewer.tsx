'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Estate3DConfig, ViewerMode } from './types';
import { createGround, createParametricBuilding, resolveBuildingDimensions } from './ParametricBuilding';
import { isLikelyGltfUrl, loadEstateModel } from './ModelLoader';
import { disposeObject3D } from './textureUtils';

type Props = { config: Estate3DConfig; preferredMode?: ViewerMode; fallbackNotice?: string };

function modeLabel(mode: ViewerMode) {
  if (mode === 'standalone_model') return 'Model mode';
  if (mode === 'real_world_digital_twin') return 'Generated fallback';
  return 'Generated fallback';
}

export function ThreeStandaloneViewer({ config, preferredMode = 'parametric_fallback', fallbackNotice }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const autoRotateRef = useRef(autoRotate);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(fallbackNotice || null);
  const dimensions = useMemo(() => resolveBuildingDimensions(config), [config]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    let animationFrame = 0;
    const disposables: any[] = [];
    setLoading(true);
    setWarning(fallbackNotice || null);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07111f');
    scene.fog = new THREE.Fog('#07111f', 140, 420);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
    const span = Math.max(dimensions.width, dimensions.depth, dimensions.height);
    camera.position.set(span * 1.45, dimensions.height * 0.95 + span * 0.25, span * 1.55);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, dimensions.height * 0.42, 0);
    controls.minDistance = Math.max(8, span * 0.35);
    controls.maxDistance = Math.max(160, span * 8);
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight('#ffffff', 0.58));
    const hemi = new THREE.HemisphereLight('#dbeafe', '#1e293b', 0.72);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#ffffff', 1.45);
    sun.position.set(45, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const grid = new THREE.GridHelper(180, 36, '#64748b', '#1e293b');
    grid.position.y = 0.012;
    scene.add(grid);

    const northGroup = new THREE.Group();
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-span * 1.25, 0.4, span * 1.25), Math.max(8, span * 0.35), '#ef4444', 2.5, 1.4);
    northGroup.add(arrow);
    scene.add(northGroup);

    const resize = () => {
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const buildScene = async () => {
      try {
        const groundSize = Math.max(90, dimensions.width * 5, dimensions.depth * 5);
        const ground = await createGround(config, groundSize, renderer);
        if (!mounted) return;
        scene.add(ground);
        disposables.push(ground);

        if ((preferredMode === 'standalone_model' || config.modelUrl) && isLikelyGltfUrl(config.modelUrl)) {
          try {
            const loaded = await loadEstateModel(config);
            if (!mounted) return;
            scene.add(loaded.object);
            disposables.push(loaded.object);
            setLoading(false);
            return;
          } catch (error) {
            console.warn('Model load failed; using generated building fallback', error);
            setWarning('The uploaded model could not be loaded, so a generated building is shown instead.');
          }
        }

        const building = await createParametricBuilding(config, renderer);
        if (!mounted) return;
        scene.add(building.object);
        disposables.push(building.object);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void buildScene();

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      controls.autoRotate = autoRotateRef.current;
      controls.autoRotateSpeed = 0.85;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      mounted = false;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      disposables.forEach(disposeObject3D);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      scene.clear();
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [config, dimensions, fallbackNotice, preferredMode]);

  const reset = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const span = Math.max(dimensions.width, dimensions.depth, dimensions.height);
    camera.position.set(span * 1.45, dimensions.height * 0.95 + span * 0.25, span * 1.55);
    controls.target.set(0, dimensions.height * 0.42, 0);
    controls.update();
  };

  const top = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const span = Math.max(dimensions.width, dimensions.depth, dimensions.height);
    camera.position.set(0.001, Math.max(60, span * 3), 0.001);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  const buildingView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const span = Math.max(dimensions.width, dimensions.depth, dimensions.height);
    camera.position.set(0, dimensions.height * 0.55, span * 1.8);
    controls.target.set(0, dimensions.height * 0.45, 0);
    controls.update();
  };

  const fullscreen = () => {
    const element = containerRef.current?.parentElement;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void element.requestFullscreen();
  };

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-3xl bg-slate-950 text-white sm:min-h-[620px]">
      <div ref={containerRef} className="h-[520px] w-full touch-none sm:h-[620px]" />
      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
        <span className="rounded-full bg-slate-900/85 px-3 py-1 text-xs font-semibold shadow-lg ring-1 ring-white/10">{modeLabel(preferredMode)}</span>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
          <button type="button" onClick={reset} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">Reset</button>
          <button type="button" onClick={top} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">Top view</button>
          <button type="button" onClick={buildingView} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">Building view</button>
          <button type="button" onClick={() => setAutoRotate((value) => !value)} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">{autoRotate ? 'Stop rotate' : 'Auto-rotate'}</button>
          <button type="button" onClick={fullscreen} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">Fullscreen</button>
        </div>
      </div>
      {loading ? <div className="absolute inset-0 grid place-items-center bg-slate-950/55 text-sm text-slate-100">Loading 3D property…</div> : null}
      {warning ? <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-amber-300/30 bg-amber-950/70 p-3 text-xs text-amber-100 shadow-xl backdrop-blur">{warning}</div> : null}
    </div>
  );
}
