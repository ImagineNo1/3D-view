'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildMapEmbedUrl } from '@/lib/maps';
import type { LatLngPoint, ViewerHotspot } from '@/types/property';

type CameraPreset = 'top' | 'angled' | 'close';

type Props = {
  imageUrl?: string;
  title: string;
  latitude?: number;
  longitude?: number;
  boundary?: LatLngPoint[];
  hotspots?: ViewerHotspot[];
};

const TERRAIN_SIZE = 20;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toPlanePosition(point: LatLngPoint, centerLat: number, centerLng: number) {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = 111_320 * Math.cos((centerLat * Math.PI) / 180);
  const deltaX = (point.lng - centerLng) * metersPerDegreeLng;
  const deltaY = (point.lat - centerLat) * metersPerDegreeLat;

  return {
    x: clamp((deltaX / 170) * (TERRAIN_SIZE / 2), -TERRAIN_SIZE / 2, TERRAIN_SIZE / 2),
    y: clamp((deltaY / 170) * (TERRAIN_SIZE / 2), -TERRAIN_SIZE / 2, TERRAIN_SIZE / 2)
  };
}

export function ThreeViewer({ imageUrl, title, latitude, longitude, boundary = [], hotspots = [] }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<ViewerHotspot | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(
    typeof latitude === 'number' && typeof longitude === 'number' ? { lat: latitude, lng: longitude } : null
  );

  const [hotspotScreen, setHotspotScreen] = useState<Array<ViewerHotspot & { sx: number; sy: number; visible: boolean }>>([]);

  const hasImage = useMemo(() => Boolean(imageUrl?.trim()), [imageUrl]);

  useEffect(() => {
    if (!containerRef.current || !imageUrl?.trim()) {
      setLoading(false);
      return;
    }

    let disposed = false;
    let frameId = 0;

    const start = async () => {
      try {
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        if (disposed || !containerRef.current) return;

        const container = containerRef.current;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#dbeafe');
        scene.fog = new THREE.Fog(0xdbeafe, 30, 85);

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

        const skyLight = new THREE.HemisphereLight(0xe0f2fe, 0x475569, 0.82);
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

        const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 230, 230);
        const textureLoader = new THREE.TextureLoader();

        const hotspotMeshes: any[] = [];
        let terrain: any = null;
        let cloudLayer: any = null;

        const setCameraPreset = (preset: CameraPreset) => {
          const presetTargets: Record<CameraPreset, { position: [number, number, number]; target: [number, number, number] }> = {
            top: { position: [0, 22, 0.01], target: [0, 0, 0] },
            angled: { position: [0, 12.5, 15], target: [0, 0.35, 0] },
            close: { position: [5, 6.5, 8], target: [1, 0.2, -0.4] }
          };

          const goal = presetTargets[preset];
          camera.userData.targetPosition = new THREE.Vector3(...goal.position);
          camera.userData.targetLookAt = new THREE.Vector3(...goal.target);
        };

        (window as any).__setPropertyCameraPreset = setCameraPreset;

        textureLoader.load(
          imageUrl,
          (rawTexture: any) => {
            if (disposed) return;

            const maxTexture = 1024;
            const source = rawTexture.image as HTMLImageElement;
            const canvas = document.createElement('canvas');
            const ratio = Math.min(1, maxTexture / Math.max(source.width, source.height));
            canvas.width = Math.max(1, Math.floor(source.width * ratio));
            canvas.height = Math.max(1, Math.floor(source.height * ratio));
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
            }

            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

            const displacementTexture = texture.clone();
            displacementTexture.needsUpdate = true;

            const terrainMaterial = new THREE.MeshStandardMaterial({
              map: texture,
              displacementMap: displacementTexture,
              displacementScale: 0.58,
              roughness: 0.92,
              metalness: 0.02,
              envMapIntensity: 0.4
            });

            terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
            terrain.rotation.x = -Math.PI / 2;
            terrain.receiveShadow = true;
            terrain.castShadow = true;
            terrain.position.y = -0.12;
            scene.add(terrain);

            if (boundary.length >= 3 && typeof latitude === 'number' && typeof longitude === 'number') {
              const points = boundary.map((point) => {
                const p = toPlanePosition(point, latitude, longitude);
                return new THREE.Vector3(p.x, 0.22, -p.y);
              });
              points.push(points[0].clone());

              const boundaryGeometry = new THREE.BufferGeometry().setFromPoints(points);
              const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0x22c55e });
              const boundaryLine = new THREE.Line(boundaryGeometry, boundaryMaterial);
              scene.add(boundaryLine);
            }

            hotspots.forEach((hotspot) => {
              const marker = new THREE.Mesh(
                new THREE.SphereGeometry(0.24, 24, 24),
                new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x7c2d12, emissiveIntensity: 0.4 })
              );
              marker.position.set(hotspot.x, 0.48, -hotspot.y);
              marker.castShadow = true;
              scene.add(marker);
              hotspotMeshes.push(marker);
            });

            const cloudMaterial = new THREE.MeshStandardMaterial({
              map: texture,
              transparent: true,
              opacity: 0.1,
              roughness: 1,
              metalness: 0,
              depthWrite: false
            });
            cloudLayer = new THREE.Mesh(new THREE.PlaneGeometry(TERRAIN_SIZE + 0.2, TERRAIN_SIZE + 0.2, 24, 24), cloudMaterial);
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

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();

        const onPointerDown = (event: PointerEvent) => {
          if (!hotspotMeshes.length) return;

          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(pointer, camera);
          const intersects = raycaster.intersectObjects(hotspotMeshes, false);

          if (!intersects.length) return;
          const index = hotspotMeshes.indexOf(intersects[0].object);
          if (index >= 0) {
            setSelectedHotspot(hotspots[index]);
          }
        };

        renderer.domElement.addEventListener('pointerdown', onPointerDown);

        const clock = new THREE.Clock();

        const animate = () => {
          frameId = window.requestAnimationFrame(animate);
          const t = clock.getElapsedTime();

          if (terrain) {
            terrain.position.y = -0.12 + Math.sin(t * 0.6) * 0.025;
          }

          if (cloudLayer) {
            cloudLayer.rotation.z = Math.sin(t * 0.22) * 0.04;
            cloudLayer.material.opacity = 0.08 + Math.sin(t * 0.35) * 0.02;
          }

          sunLight.position.x = 14 + Math.sin(t * 0.33) * 2.1;
          sunLight.position.z = 7 + Math.cos(t * 0.33) * 1.6;
          sunLight.intensity = 1.12 + Math.sin(t * 0.5) * 0.08;

          const targetPosition = camera.userData.targetPosition as any;
          const targetLookAt = camera.userData.targetLookAt as any;
          if (targetPosition && targetLookAt) {
            camera.position.lerp(targetPosition, 0.08);
            controls.target.lerp(targetLookAt, 0.08);
            if (camera.position.distanceTo(targetPosition) < 0.05) {
              camera.userData.targetPosition = null;
              camera.userData.targetLookAt = null;
            }
          }

          if (typeof latitude === 'number' && typeof longitude === 'number') {
            const metersPerDegreeLat = 111_320;
            const metersPerDegreeLng = 111_320 * Math.cos((latitude * Math.PI) / 180);
            const lng = longitude + ((controls.target.x * 170) / (TERRAIN_SIZE / 2)) / metersPerDegreeLng;
            const lat = latitude + ((-controls.target.z * 170) / (TERRAIN_SIZE / 2)) / metersPerDegreeLat;
            setMapCenter({ lat, lng });
          }

          const rect = renderer.domElement.getBoundingClientRect();
          const projected = hotspots.map((item, index) => {
            const mesh = hotspotMeshes[index];
            if (!mesh) return { ...item, sx: 0, sy: 0, visible: false };
            const pos = mesh.position.clone().project(camera);
            return {
              ...item,
              sx: ((pos.x + 1) / 2) * rect.width,
              sy: ((-pos.y + 1) / 2) * rect.height,
              visible: pos.z < 1
            };
          });
          setHotspotScreen(projected);

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
          delete (window as any).__setPropertyCameraPreset;
          window.removeEventListener('resize', onResize);
          window.cancelAnimationFrame(frameId);
          renderer.domElement.removeEventListener('pointerdown', onPointerDown);
          controls.dispose();
          terrainGeometry.dispose();
          renderer.dispose();
          scene.clear();
          container.innerHTML = '';
        };
      } catch {
        setError('Failed to initialize 3D viewer modules.');
        setLoading(false);
        return () => undefined;
      }
    };

    let cleanup: (() => void) | undefined;
    start().then((fn) => {
      cleanup = fn;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [boundary, hotspots, imageUrl, latitude, longitude]);

  const setPreset = (preset: CameraPreset) => {
    const globalSetter = (window as any).__setPropertyCameraPreset as ((view: CameraPreset) => void) | undefined;
    globalSetter?.(preset);
  };

  return (
    <section className="space-y-3 rounded-xl bg-white/75 p-6 shadow backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Fake 3D الأرض Viewer</h2>
        <div className="flex gap-2">
          <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50" onClick={() => setPreset('top')}>
            Top View
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setPreset('angled')}
          >
            Angled View
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setPreset('close')}
          >
            Close Zoom
          </button>
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
      </div>

      {!hasImage && <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">No satellite image found for this property.</p>}

      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="relative h-[460px] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100" ref={containerRef}>
          {loading && hasImage && <div className="absolute inset-0 grid place-content-center text-sm text-slate-600">Loading 3D viewer…</div>}
          {error && <div className="absolute inset-0 grid place-content-center p-3 text-center text-sm text-red-700">{error}</div>}

          {hotspotScreen.map((spot) =>
            spot.visible ? (
              <button
                key={`${spot.label}-${spot.x}-${spot.y}`}
                type="button"
                onClick={() => setSelectedHotspot(spot)}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-orange-500/90 px-2 py-0.5 text-[10px] text-white shadow"
                style={{ left: spot.sx, top: spot.sy }}
              >
                {spot.label}
              </button>
            ) : null
          )}
        </div>

        <aside className="rounded-lg border border-white/50 bg-white/55 p-3 backdrop-blur-md">
          <h3 className="text-sm font-semibold text-slate-900">Mini Map Sync</h3>
          {mapCenter ? (
            <iframe
              title="Mini map"
              src={buildMapEmbedUrl(mapCenter)}
              className="mt-2 h-56 w-full rounded border"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <p className="mt-2 text-xs text-slate-600">Mini map appears when latitude and longitude are available.</p>
          )}
        </aside>
      </div>

      {selectedHotspot && (
        <div className="rounded-lg border border-orange-200 bg-orange-50/80 p-3 text-sm text-orange-900 backdrop-blur-sm">
          <p className="font-semibold">{selectedHotspot.label}</p>
          <p className="mt-1">{selectedHotspot.description}</p>
        </div>
      )}

      <p className="text-xs text-slate-500">{title}: pseudo-terrain displacement + boundary overlay + clickable hotspots.</p>
    </section>
  );
}
