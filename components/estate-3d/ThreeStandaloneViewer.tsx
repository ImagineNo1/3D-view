'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { Estate3DConfig, ViewerMode } from './types';
import { createGround, createParametricBuilding, resolveBuildingDimensions } from './ParametricBuilding';
import { isLikelyGltfUrl, loadEstateModel } from './ModelLoader';
import { disposeObject3D } from './textureUtils';
import { xzToLatLng } from './geoUtils';

type Props = { config: Estate3DConfig; preferredMode?: ViewerMode; fallbackNotice?: string };

type ClickedPoint = { latitude: number; longitude: number; x: number; z: number };

export function ThreeStandaloneViewer({ config, preferredMode = 'parametric_fallback', fallbackNotice }: Props) {
  const { t, locale } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const buildingRootRef = useRef<any>(null);
  const footprintRef = useRef<any>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const autoRotateRef = useRef(autoRotate);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(fallbackNotice || null);
  const [is2d, setIs2d] = useState(false);
  const [intensity, setIntensity] = useState(100);
  const [drawFootprint, setDrawFootprint] = useState(false);
  const drawFootprintRef = useRef(drawFootprint);
  const [clickedPoint, setClickedPoint] = useState<ClickedPoint | null>(null);
  const footprintPointsRef = useRef<any[]>([]);
  const dimensions = useMemo(() => resolveBuildingDimensions(config), [config]);

  const modeLabel = preferredMode === 'standalone_model' ? t.viewer.modelMode : t.viewer.generatedMode;

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    drawFootprintRef.current = drawFootprint;
  }, [drawFootprint]);

  useEffect(() => {
    if (buildingRootRef.current) buildingRootRef.current.scale.y = Math.max(0.12, intensity / 100);
  }, [intensity]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    let animationFrame = 0;
    const disposables: any[] = [];
    setLoading(true);
    setWarning(fallbackNotice || null);
    setClickedPoint(null);
    footprintPointsRef.current = [];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07111f');
    scene.fog = new THREE.Fog('#07111f', 160, 520);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
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
    controls.maxDistance = Math.max(180, span * 8);
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight('#ffffff', 0.56));
    scene.add(new THREE.HemisphereLight('#dbeafe', '#1e293b', 0.78));
    const sun = new THREE.DirectionalLight('#ffffff', 1.65);
    sun.position.set(55, 90, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.MeshBasicMaterial({ color: '#0f2742', side: THREE.BackSide }));
    scene.add(sky);

    const northGroup = new THREE.Group();
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-span * 1.25, 0.4, span * 1.25), Math.max(8, span * 0.35), '#ef4444', 2.5, 1.4);
    northGroup.add(arrow);
    scene.add(northGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const markerMaterial = new THREE.MeshStandardMaterial({ color: '#f97316', emissive: '#7c2d12', emissiveIntensity: 0.2 });
    let groundMesh: any = null;
    let marker: any = null;

    const addOrMoveMarker = (point: any) => {
      if (!marker) {
        marker = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.5, span * 0.018), 24, 16), markerMaterial);
        marker.position.y = Math.max(0.7, span * 0.025);
        scene.add(marker);
        disposables.push(marker);
      }
      marker.position.x = point.x;
      marker.position.z = point.z;
    };

    const refreshFootprint = () => {
      if (footprintRef.current) {
        scene.remove(footprintRef.current);
        disposeObject3D(footprintRef.current);
        footprintRef.current = null;
      }
      const points = footprintPointsRef.current;
      if (points.length < 2) return;
      const group = new THREE.Group();
      const linePoints = points.map((point) => new THREE.Vector3(point.x, 0.08, point.y));
      if (points.length > 2) linePoints.push(new THREE.Vector3(points[0].x, 0.08, points[0].y));
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), new THREE.LineBasicMaterial({ color: '#f97316' })));
      if (points.length >= 3) {
        const shape = new THREE.Shape(points);
        const extrude = new THREE.ExtrudeGeometry(shape, { depth: dimensions.height, bevelEnabled: false });
        const mesh = new THREE.Mesh(extrude, new THREE.MeshStandardMaterial({ color: '#dbeafe', transparent: true, opacity: 0.72, roughness: 0.62 }));
        mesh.rotation.x = Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      footprintRef.current = group;
      scene.add(group);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!groundMesh || event.button !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(groundMesh)[0];
      if (!hit) return;
      const coords = typeof config.latitude === 'number' && typeof config.longitude === 'number'
        ? xzToLatLng(hit.point.x, hit.point.z, config.latitude, config.longitude)
        : { latitude: hit.point.z, longitude: hit.point.x };
      setClickedPoint({ ...coords, x: hit.point.x, z: hit.point.z });
      addOrMoveMarker(hit.point);
      if (drawFootprintRef.current) {
        footprintPointsRef.current.push(new THREE.Vector2(hit.point.x, hit.point.z));
        refreshFootprint();
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

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
        const groundSize = Math.max(120, dimensions.width * 7, dimensions.depth * 7);
        const ground = await createGround(config, groundSize, renderer);
        if (!mounted) return;
        groundMesh = ground;
        scene.add(ground);
        disposables.push(ground);

        const root = new THREE.Group();
        root.scale.y = Math.max(0.12, intensity / 100);
        buildingRootRef.current = root;
        scene.add(root);
        disposables.push(root);

        if ((preferredMode === 'standalone_model' || config.modelUrl) && isLikelyGltfUrl(config.modelUrl)) {
          try {
            const loaded = await loadEstateModel(config);
            if (!mounted) return;
            root.add(loaded.object);
            setLoading(false);
            return;
          } catch (error) {
            console.warn('Model load failed; using generated building fallback', error);
            setWarning(t.viewer.fallbackModel);
          }
        }

        const building = await createParametricBuilding(config, renderer);
        if (!mounted) return;
        root.add(building.object);
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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      disposables.forEach(disposeObject3D);
      if (footprintRef.current) disposeObject3D(footprintRef.current);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      scene.clear();
      cameraRef.current = null;
      controlsRef.current = null;
      buildingRootRef.current = null;
      footprintRef.current = null;
    };
  }, [config, dimensions, fallbackNotice, preferredMode, t.viewer.fallbackModel]);

  const reset = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const span = Math.max(dimensions.width, dimensions.depth, dimensions.height);
    camera.position.set(span * 1.45, dimensions.height * 0.95 + span * 0.25, span * 1.55);
    controls.target.set(0, dimensions.height * 0.42, 0);
    controls.update();
    setIs2d(false);
  };

  const top = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const span = Math.max(dimensions.width, dimensions.depth, dimensions.height);
    camera.position.set(0.001, Math.max(60, span * 3), 0.001);
    controls.target.set(0, 0, 0);
    controls.update();
    setIs2d(true);
  };

  const buildingView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const span = Math.max(dimensions.width, dimensions.depth, dimensions.height);
    camera.position.set(0, dimensions.height * 0.55, span * 1.8);
    controls.target.set(0, dimensions.height * 0.45, 0);
    controls.update();
    setIs2d(false);
  };

  const clearFootprint = () => {
    footprintPointsRef.current = [];
    if (footprintRef.current?.parent) footprintRef.current.parent.remove(footprintRef.current);
    if (footprintRef.current) disposeObject3D(footprintRef.current);
    footprintRef.current = null;
  };

  const fullscreen = () => {
    const element = containerRef.current?.parentElement;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void element.requestFullscreen();
  };

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-3xl bg-slate-950 text-white sm:min-h-[620px]" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <div ref={containerRef} className="h-[520px] w-full touch-none sm:h-[620px]" />
      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
        <span className="rounded-full bg-slate-900/85 px-3 py-1 text-xs font-medium shadow-lg ring-1 ring-white/10">{modeLabel}</span>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
          <button type="button" onClick={reset} className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium backdrop-blur hover:bg-white/20">{t.viewer.reset}</button>
          <button type="button" onClick={top} className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium backdrop-blur hover:bg-white/20">{is2d ? t.viewer.mode3d : t.viewer.mode2d}</button>
          <button type="button" onClick={buildingView} className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium backdrop-blur hover:bg-white/20">{t.viewer.buildingView}</button>
          <button type="button" onClick={() => setAutoRotate((value) => !value)} className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium backdrop-blur hover:bg-white/20">{autoRotate ? t.viewer.stopRotate : t.viewer.autoRotate}</button>
          <button type="button" onClick={() => setDrawFootprint((value) => !value)} className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium backdrop-blur hover:bg-white/20">{drawFootprint ? t.viewer.finishFootprint : t.viewer.drawFootprint}</button>
          <button type="button" onClick={clearFootprint} className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium backdrop-blur hover:bg-white/20">{t.viewer.clearFootprint}</button>
          <button type="button" onClick={fullscreen} className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium backdrop-blur hover:bg-white/20">{t.viewer.fullscreen}</button>
        </div>
      </div>
      <div className="pointer-events-auto absolute bottom-3 right-3 w-52 rounded-2xl border border-white/10 bg-slate-950/75 p-3 text-xs text-slate-100 shadow-xl backdrop-blur">
        <label className="block text-xs text-slate-200">{t.viewer.intensity}</label>
        <input type="range" min="25" max="160" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} className="mt-2 w-full" />
        {clickedPoint ? <p className="mt-2 text-[11px] text-slate-300">{t.viewer.clickedCoordinates}: {clickedPoint.latitude.toFixed(6)}, {clickedPoint.longitude.toFixed(6)}</p> : null}
      </div>
      {loading ? <div className="absolute inset-0 grid place-items-center bg-slate-950/55 text-sm text-slate-100">{t.viewer.loading}</div> : null}
      {warning ? <div className="absolute bottom-3 left-3 max-w-xl rounded-2xl border border-amber-300/30 bg-amber-950/70 p-3 text-xs text-amber-100 shadow-xl backdrop-blur">{warning}</div> : null}
    </div>
  );
}
