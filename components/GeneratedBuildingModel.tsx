'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import {
  createAdaptiveBuildingMesh,
  createContactShadowTexture,
  createRadialAlphaTexture,
  createSurroundingBuildings,
  detectTier,
  generateFacadeTextures,
  type TierConfig
} from '@/components/building/adaptivePipeline';

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

type ScenePayload = {
  terrain?: { heights?: number[] };
  imagery?: { dataUrl?: string };
};

async function loadScene(mapUrl: string) {
  console.log("[Viewer] Sending POST /api/reconstruct with:", mapUrl);

  const res = await fetch("/api/reconstruct", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url: mapUrl })
  });

  if (!res.ok) {
    console.error("[Viewer] Reconstruction failed:", res.status);
    throw new Error("Reconstruction failed with status " + res.status);
  }

  const scene = await res.json();

  if (!scene || !scene.terrain || !scene.imagery) {
    console.error("[Viewer] Invalid scene payload:", scene);
    throw new Error("Scene reconstruction returned incomplete data");
  }

  console.log("[Viewer] Imagery length:", scene.imagery.dataUrl?.length);
  console.log("[Viewer] Terrain samples:", scene.terrain.heights?.slice(0, 20));

  return scene;
}

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
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const viewModeRef = useRef<'2d' | '3d'>('3d');
  const autoRotateRef = useRef(false);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');
  const [autoRotate, setAutoRotate] = useState(false);
  const [gpuPreferred, setGpuPreferred] = useState(false);
  const [projections, setProjections] = useState<ProjectionCanvases | null>(null);
  const [scenePayload, setScenePayload] = useState<ScenePayload | null>(null);
  const [tier, setTier] = useState<TierConfig>(() => detectTier(false));

  useEffect(() => {
    const legacyGetPattern = /\/property\//;
    if (legacyGetPattern.test(window.location.pathname)) {
      console.error('❌ GET scene load detected — this must be removed');
      throw new Error('Legacy GET load path executed');
    }
  }, []);

  useEffect(() => {
    console.log('[Viewer] Using ONLY POST /api/reconstruct');
  }, []);

  useEffect(() => {
    const url = searchParams.get('url') || searchParams.get('mapUrl');
    if (!url) return;

    let active = true;
    loadScene(url)
      .then((scene) => {
        if (!active) return;
        setScenePayload(scene as ScenePayload);
      })
      .catch((error) => {
        console.error('[Viewer] Failed to load scene from /api/reconstruct:', error);
      });

    return () => {
      active = false;
    };
  }, [searchParams]);

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
        aerialImage: scenePayload?.imagery?.dataUrl ?? aerialImage,
        rotation
      }),
    [buildingArea, buildingHeight, floorCount, floorHeight, latitude, longitude, facadeImages, aerialImage, rotation, scenePayload]
  );

  useEffect(() => {
    setTier(detectTier(gpuPreferred));
  }, [gpuPreferred]);

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
    let updateSurroundings: ((camera: any) => void) | null = null;

    const setup = async () => {
      if (!containerRef.current || !mounted) return;
      const container = containerRef.current;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: tier.useGpuRenderer ? 'high-performance' : 'default' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.tier === 'mobile' ? 1.25 : 2));
      renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = tier.tier === 'mobile' ? 1.0 : 1.08;
      container.appendChild(renderer.domElement);
      disposeRenderer = () => {
        renderer?.dispose();
        if (renderer && container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      };

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(tier.tier === 'mobile' ? '#cdd8e5' : '#b9c8d8');

      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 12000);
      camera.position.set(model.width * 1.9, Math.max(model.buildingHeight * 0.95, 16), model.depth * 2.0);
      cameraRef.current = camera;

      const controls = new OrbitControls(camera, renderer.domElement);
      controlsRef.current = controls;
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = Math.max(model.width, model.depth) * 0.35;
      controls.maxDistance = Math.max(model.width, model.depth) * 16;
      controls.target.set(0, model.buildingHeight * 0.45, 0);

      const ambientLight = new THREE.AmbientLight(0xffffff, tier.tier === 'mobile' ? 0.72 : 0.6);
      const hemi = new THREE.HemisphereLight(0xd9ebff, 0xa7988e, tier.tier === 'mobile' ? 0.3 : 0.45);
      const directionalLight = new THREE.DirectionalLight(0xfff8ea, tier.tier === 'mobile' ? 1.0 : 1.5);
      directionalLight.position.set(model.width * 1.9, model.buildingHeight * 2.8, model.depth * 1.4);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.set(tier.tier === 'mobile' ? 1024 : 4096, tier.tier === 'mobile' ? 1024 : 4096);
      directionalLight.shadow.bias = -0.00008;
      directionalLight.shadow.radius = 2.2;
      directionalLight.shadow.camera.left = -120;
      directionalLight.shadow.camera.right = 120;
      directionalLight.shadow.camera.top = 120;
      directionalLight.shadow.camera.bottom = -120;
      directionalLight.shadow.camera.near = 1;
      directionalLight.shadow.camera.far = 520;
      scene.add(ambientLight, hemi, directionalLight);

      if (tier.useHdri) {
        try {
          const pmrem = new THREE.PMREMGenerator(renderer);
          pmrem.compileEquirectangularShader();
          const hdr = await new RGBELoader().loadAsync('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/urban_alley_01_1k.hdr');
          const env = pmrem.fromEquirectangular(hdr).texture;
          scene.environment = env;
          hdr.dispose();
          pmrem.dispose();
        } catch {
          scene.environment = null;
        }
      }

      const maps = await generateFacadeTextures(model, tier);
      if (!mounted || !renderer) return;

      const groundSize = Math.max(model.width, model.depth) * 14;
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(groundSize, groundSize, tier.terrainSegments, tier.terrainSegments),
        new THREE.MeshStandardMaterial({
          color: '#aab89a',
          roughness: 0.96,
          metalness: 0.02,
          map: maps.aerialTexture,
          displacementMap: maps.aerialDepth,
          displacementScale: tier.terrainDisplacement,
          alphaMap: createRadialAlphaTexture(),
          transparent: true,
          aoMapIntensity: tier.aoStrength
        })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const building = createAdaptiveBuildingMesh(model, tier, maps);
      building.rotation.y = model.rotationY;
      scene.add(building);

      const contactShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(model.width * 2.6, model.depth * 2.6),
        new THREE.MeshBasicMaterial({ map: createContactShadowTexture(), transparent: true, depthWrite: false })
      );
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.y = 0.04;
      scene.add(contactShadow);

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(0.45, model.width * 0.025), 20, 20),
        new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.4, metalness: 0.08 })
      );
      marker.position.set(0, model.buildingHeight + 1.2, 0);
      marker.castShadow = true;
      scene.add(marker);

      const neighbors = createSurroundingBuildings(model, tier, maps);
      scene.add(neighbors.group);
      updateSurroundings = neighbors.update;

      if (tier.useComposer) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        if (tier.useSSAO) {
          const ssao = new SSAOPass(scene, camera, Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
          ssao.kernelRadius = tier.tier === 'mobile' ? 4 : 14;
          ssao.minDistance = 0.002;
          ssao.maxDistance = 0.14;
          ssao.output = SSAOPass.OUTPUT.Default;
          composer.addPass(ssao);
        }

        const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), tier.bloomStrength, 0.32, 0.92);
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
        controls.autoRotateSpeed = tier.tier === 'mobile' ? 0.5 : 0.85;
        controls.update();
        updateSurroundings?.(camera);
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
              if (m.displacementMap) m.displacementMap.dispose();
              if (m.alphaMap) m.alphaMap.dispose();
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
      camera.position.set(0, Math.max(model.buildingHeight * 3.2, 40), 0.001);
      controls.enableRotate = false;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = 0;
    } else {
      camera.position.set(model.width * 1.9, Math.max(model.buildingHeight * 0.95, 16), model.depth * 2.0);
      controls.enableRotate = true;
      controls.minPolarAngle = 0.05;
      controls.maxPolarAngle = Math.PI / 2.03;
    }

    controls.target.set(0, model.buildingHeight * 0.45, 0);
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
        <button
          type="button"
          onClick={() => setGpuPreferred((prev) => !prev)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${gpuPreferred ? 'bg-emerald-600 text-white' : 'bg-white/90 text-slate-900'}`}
        >
          GPU
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
