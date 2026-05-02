'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type Property3DData = {
  id?: string;
  slug?: string;
  title: string;
  googleMapsUrl?: string;
  buildingArea?: number;
  buildingHeight?: number;
  floors?: number;
  floorHeight?: number;
  rotationDeg?: number;
  description?: string;
  facadeFrontUrl?: string;
  facadeBackUrl?: string;
  facadeLeftUrl?: string;
  facadeRightUrl?: string;
  modelUrl?: string;
  footprintWidth?: number;
  footprintDepth?: number;
};

const fallbackMaterial = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.85, metalness: 0.05 });

function deriveDimensions(data: Property3DData) {
  const floors = data.floors && data.floors > 0 ? data.floors : undefined;
  const height = data.buildingHeight && data.buildingHeight > 0 ? data.buildingHeight : floors && data.floorHeight ? floors * data.floorHeight : 12;
  const areaSide = data.buildingArea && data.buildingArea > 0 ? Math.sqrt(data.buildingArea) : 12;
  const width = data.footprintWidth && data.footprintWidth > 0 ? data.footprintWidth : areaSide;
  const depth = data.footprintDepth && data.footprintDepth > 0 ? data.footprintDepth : areaSide;
  return { width, depth, height, floors };
}

async function loadFacadeTexture(loader: InstanceType<typeof THREE.TextureLoader>, url?: string) {
  if (!url) return null;
  try {
    const texture = await loader.loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  } catch {
    return null;
  }
}

export function Property3DViewer({ data }: { data: Property3DData }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const frameRef = useRef<number | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dimensions = useMemo(() => deriveDimensions(data), [data]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f172a');

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    cameraRef.current = camera;
    camera.position.set(dimensions.width * 1.9, dimensions.height * 1.2, dimensions.depth * 1.9);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.target.set(0, dimensions.height * 0.45, 0);
    controls.minDistance = Math.max(dimensions.width, dimensions.depth) * 0.5;
    controls.maxDistance = Math.max(dimensions.width, dimensions.depth) * 12;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x3f3f46, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.castShadow = true;
    sun.position.set(25, 40, 15);
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    scene.add(new THREE.GridHelper(200, 40, '#64748b', '#334155'));

    const road = new THREE.Mesh(new THREE.PlaneGeometry(220, 18), new THREE.MeshStandardMaterial({ color: '#1f2937' }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, -35);
    scene.add(road);

    const contextGroup = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const h = 2 + Math.random() * 4;
      const m = new THREE.Mesh(new THREE.BoxGeometry(3, h, 3), new THREE.MeshStandardMaterial({ color: '#475569' }));
      m.position.set((Math.random() - 0.5) * 90, h / 2, (Math.random() - 0.5) * 90);
      contextGroup.add(m);
    }
    scene.add(contextGroup);

    const disposableTextures: any[] = [];
    const disposableMaterials: any[] = [];
    const disposableGeometries: any[] = [];

    const makeBuilding = async () => {
      const root = new THREE.Group();

      const canLoadModel = data.modelUrl && /\.(glb|gltf)$/i.test(data.modelUrl);
      if (canLoadModel) {
        try {
          const gltf = await new GLTFLoader().loadAsync(data.modelUrl!);
          const model = gltf.scene;
          model.traverse((obj: any) => {
            const m = obj as any;
            if (m.isMesh) {
              m.castShadow = true;
              m.receiveShadow = true;
            }
          });
          root.add(model);
          scene.add(root);
          setLoading(false);
          return root;
        } catch {
          setError('Model load failed, showing procedural building.');
        }
      }

      const loader = new THREE.TextureLoader();
      loader.crossOrigin = 'anonymous';
      const [right, left, front, back] = await Promise.all([
        loadFacadeTexture(loader, data.facadeRightUrl),
        loadFacadeTexture(loader, data.facadeLeftUrl),
        loadFacadeTexture(loader, data.facadeFrontUrl),
        loadFacadeTexture(loader, data.facadeBackUrl)
      ]);

      [right, left, front, back].forEach((t) => t && disposableTextures.push(t));

      const sideMaterial = (t: any) => t
        ? new THREE.MeshStandardMaterial({ map: t, roughness: 0.88, metalness: 0.04 })
        : fallbackMaterial.clone();

      const materials = [
        sideMaterial(right),
        sideMaterial(left),
        new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.9 }),
        new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.9 }),
        sideMaterial(front),
        sideMaterial(back)
      ];
      disposableMaterials.push(...materials);

      const geometry = new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.depth);
      disposableGeometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, materials);
      mesh.position.y = dimensions.height / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.rotation.y = THREE.MathUtils.degToRad(data.rotationDeg || 0);
      root.add(mesh);

      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: '#0f172a' }));
      edge.position.copy(mesh.position);
      edge.rotation.copy(mesh.rotation);
      root.add(edge);

      const lineMat = new THREE.LineBasicMaterial({ color: '#f8fafc', transparent: true, opacity: 0.45 });
      disposableMaterials.push(lineMat);
      const floorCount = dimensions.floors || (data.floorHeight ? Math.floor(dimensions.height / data.floorHeight) : 0);
      for (let i = 1; i < floorCount; i++) {
        const y = (dimensions.height / floorCount) * i;
        const points = [
          new THREE.Vector3(-dimensions.width / 2, y, -dimensions.depth / 2),
          new THREE.Vector3(dimensions.width / 2, y, -dimensions.depth / 2),
          new THREE.Vector3(dimensions.width / 2, y, dimensions.depth / 2),
          new THREE.Vector3(-dimensions.width / 2, y, dimensions.depth / 2),
          new THREE.Vector3(-dimensions.width / 2, y, -dimensions.depth / 2)
        ];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        disposableGeometries.push(lineGeo);
        const line = new THREE.Line(lineGeo, lineMat);
        line.rotation.y = mesh.rotation.y;
        root.add(line);
      }

      scene.add(root);
      setLoading(false);
      return root;
    };

    let buildingRoot: any = null;
    makeBuilding().then((root) => {
      buildingRoot = root;
    });

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 0.9;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      controls.dispose();
      buildingRoot?.traverse((obj: any) => {
        const mesh = obj as any;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const m = mesh.material;
          (Array.isArray(m) ? m : [m]).forEach((it) => it?.dispose());
        }
      });
      disposableTextures.forEach((t) => t.dispose());
      disposableMaterials.forEach((m) => m.dispose());
      disposableGeometries.forEach((g) => g.dispose());
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [data, dimensions, autoRotate]);

  return (
    <div className="relative h-[56vh] min-h-[360px] w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute left-3 top-3 rounded-lg bg-slate-900/80 px-3 py-2 text-sm text-white">
        <p className="font-semibold">{data.title}</p>
        <p>Area: {Math.round((data.buildingArea || dimensions.width * dimensions.depth) * 10) / 10} m²</p>
        <p>Height: {Math.round(dimensions.height * 10) / 10} m</p>
        {dimensions.floors ? <p>Floors: {dimensions.floors}</p> : null}
      </div>
      <div className="absolute bottom-3 right-3 flex gap-2">
        <button onClick={() => controlsRef.current?.reset()} className="rounded bg-white/90 px-3 py-1 text-sm">Reset</button>
        <button onClick={() => setAutoRotate((v) => !v)} className="rounded bg-white/90 px-3 py-1 text-sm">{autoRotate ? 'Stop rotate' : 'Auto rotate'}</button>
        <button onClick={() => containerRef.current?.requestFullscreen?.()} className="rounded bg-white/90 px-3 py-1 text-sm">Fullscreen</button>
      </div>
      {loading ? <p className="absolute bottom-3 left-3 rounded bg-slate-900/80 px-3 py-1 text-xs text-white">Loading 3D view…</p> : null}
      {error ? <p className="absolute bottom-3 left-3 rounded bg-amber-600/90 px-3 py-1 text-xs text-white">{error}</p> : null}
    </div>
  );
}
