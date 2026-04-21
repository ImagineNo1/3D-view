'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { generateOrthographicCanvases, type ProjectionCanvases } from '@/components/building/projectionGenerator';
import { createModelData } from '@/components/building/generators';
import { createAdaptiveBuildingMesh, detectTier, generateFacadeTextures, type TierConfig } from '@/components/building/adaptivePipeline';

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
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const viewModeRef = useRef<'2d' | '3d'>('3d');
  const autoRotateRef = useRef(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [autoRotate, setAutoRotate] = useState(false);
  const [projections, setProjections] = useState<ProjectionCanvases | null>(null);
  const [tier, setTier] = useState<TierConfig>(() => detectTier());

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
    setTier(detectTier());
  }, []);

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
    let renderer: any = null;
    let composer: any = null;
    let disposeRenderer = () => {};
    let frameId = 0;
    let mounted = true;

    const setup = async () => {
      if (!containerRef.current || !mounted) return;
      const container = containerRef.current;

      if (tier.useGpuRenderer) {
        try {
          const webgpuModule = await import('three/webgpu');
          const webgpuRenderer = new webgpuModule.WebGPURenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
          await webgpuRenderer.init();
          renderer = webgpuRenderer as any;
        } catch {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        }
      } else {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.tier === 'mobile' ? 1.5 : 2));
      renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);
      disposeRenderer = () => {
        renderer?.dispose();
        if (container.contains(renderer!.domElement)) container.removeChild(renderer!.domElement);
      };

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(tier.tier === 'mobile' ? '#dbe4f2' : '#c8d4e4');

      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 8000);
      camera.position.set(model.width * 1.85, Math.max(model.buildingHeight * 0.92, 16), model.depth * 1.8);
      cameraRef.current = camera;

      const controls = new OrbitControls(camera, renderer.domElement);
      controlsRef.current = controls;
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = Math.max(model.width, model.depth) * 0.35;
      controls.maxDistance = Math.max(model.width, model.depth) * 15;
      controls.target.set(0, model.buildingHeight * 0.42, 0);

      const ambientLight = new THREE.AmbientLight(0xffffff, tier.tier === 'mobile' ? 0.8 : 0.55);
      const hemi = new THREE.HemisphereLight(0xc7dbff, 0xb8ada2, tier.tier === 'mobile' ? 0.35 : 0.75);
      const directionalLight = new THREE.DirectionalLight(0xffffff, tier.tier === 'mobile' ? 1.0 : 1.45);
      directionalLight.position.set(model.width * 1.5, model.buildingHeight * 2.5, model.depth * 1.25);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.set(tier.tier === 'mobile' ? 1024 : 4096, tier.tier === 'mobile' ? 1024 : 4096);
      directionalLight.shadow.bias = -0.0001;
      scene.add(ambientLight, hemi, directionalLight);

      if (tier.useHdri) {
        try {
          const hdr = await new RGBELoader().loadAsync('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/urban_alley_01_1k.hdr');
          hdr.mapping = THREE.EquirectangularReflectionMapping;
          scene.environment = hdr;
        } catch {
          scene.environment = null;
        }
      }

      const maps = await generateFacadeTextures(model, tier);
      if (!mounted) return;

      const groundSize = Math.max(model.width, model.depth) * 12;
      const groundMaterial = new THREE.MeshStandardMaterial({
        color: '#acb7c8',
        roughness: tier.tier === 'mobile' ? 0.96 : 0.85,
        metalness: 0.03,
        map: maps.aerialTexture,
        aoMapIntensity: tier.aoStrength
      });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize, tier.wallSegments, tier.wallSegments), groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const building = createAdaptiveBuildingMesh(model, tier, maps);
      building.rotation.y = model.rotationY;
      scene.add(building);

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(0.45, model.width * 0.028), 22, 22),
        new THREE.MeshPhysicalMaterial({ color: '#ef4444', transmission: 0.2, thickness: 0.5, roughness: 0.3 })
      );
      marker.position.set(0, model.buildingHeight + 1.2, 0);
      scene.add(marker);

      const glassPanels = new THREE.Mesh(
        new THREE.BoxGeometry(model.width * 0.35, model.buildingHeight * 0.52, model.depth * 0.02, 8, 8, 1),
        new THREE.MeshPhysicalMaterial({
          color: '#e0f2ff',
          roughness: 0.08,
          metalness: 0.15,
          transmission: tier.tier === 'mobile' ? 0.45 : 0.86,
          thickness: 1.8,
          ior: 1.2
        })
      );
      glassPanels.position.set(0, model.buildingHeight * 0.5, model.depth * 0.501);
      scene.add(glassPanels);

      if (tier.useComposer) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const ssao = new SSAOPass(scene, camera, Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
        ssao.kernelRadius = tier.tier === 'mobile' ? 8 : 20;
        ssao.minDistance = 0.003;
        ssao.maxDistance = 0.12;
        ssao.output = SSAOPass.OUTPUT.Default;
        composer.addPass(ssao);

        const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), tier.bloomStrength, 0.48, 0.85);
        composer.addPass(bloom);

        const fxaa = new ShaderPass(FXAAShader);
        const ratio = renderer.getPixelRatio();
        fxaa.material.uniforms.resolution.value.set(1 / (container.clientWidth * ratio), 1 / (container.clientHeight * ratio));
        composer.addPass(fxaa);
      }

      const onResize = () => {
        if (!renderer) return;
        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        composer?.setSize(width, height);
      };

      window.addEventListener('resize', onResize);
      onResize();

      const render = () => {
        frameId = window.requestAnimationFrame(render);
        controls.autoRotate = autoRotateRef.current && viewModeRef.current === '3d';
        controls.autoRotateSpeed = tier.tier === 'mobile' ? 0.5 : 0.9;
        controls.update();
        if (composer) composer.render();
        else renderer?.render(scene, camera);
      };
      render();

      const cleanup = () => {
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
              const m = mat as any;
              if (m.map) m.map.dispose();
              m.dispose();
            });
          }
        });
        composer?.dispose();
        disposeRenderer();
      };

      (container as any).__cleanup = cleanup;
    };

    setup();

    return () => {
      mounted = false;
      if (containerRef.current && (containerRef.current as any).__cleanup) {
        (containerRef.current as any).__cleanup();
        delete (containerRef.current as any).__cleanup;
      } else {
        window.cancelAnimationFrame(frameId);
        disposeRenderer();
      }
    };
  }, [model, tier]);

  useEffect(() => {
    viewModeRef.current = viewMode;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

    if (viewMode === '2d') {
      camera.position.set(0, Math.max(model.buildingHeight * 2.9, 38), 0.001);
      controls.enableRotate = false;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = 0;
    } else {
      camera.position.set(model.width * 1.8, Math.max(model.buildingHeight * 0.92, 16), model.depth * 1.8);
      controls.enableRotate = true;
      controls.minPolarAngle = 0.05;
      controls.maxPolarAngle = Math.PI / 2.02;
    }

    controls.target.set(0, model.buildingHeight * 0.42, 0);
    controls.update();
  }, [model.buildingHeight, model.depth, model.width, viewMode]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

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
        <span className="rounded-lg bg-black/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white">{tier.tier}</span>
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
