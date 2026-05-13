'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { Estate3DConfig } from './types';
import { createParametricBuilding, resolveBuildingDimensions } from './ParametricBuilding';
import { isLikelyGltfUrl, loadEstateModel } from './ModelLoader';
import { disposeObject3D } from './textureUtils';
import { metersToLatitudeDegrees, metersToLongitudeDegrees } from './geoUtils';

type Props = { config: Estate3DConfig; onFallback: (reason: string) => void };
type ClickedPoint = { latitude: number; longitude: number; elevation?: number | null };

const MAPBOX_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';
const TERRAIN_SOURCE_ID = 'mapbox-dem';
const AERIAL_SOURCE_ID = 'uploaded-aerial-fallback';
const AERIAL_LAYER_ID = 'uploaded-aerial-fallback-layer';

function createAtmosphere(map: mapboxgl.Map) {
  map.setFog({
    color: 'rgb(186, 210, 235)',
    'high-color': 'rgb(36, 92, 155)',
    'horizon-blend': 0.18,
    'space-color': 'rgb(4, 9, 20)',
    'star-intensity': 0.18
  });
}

function addTerrain(map: mapboxgl.Map) {
  if (!map.getSource(TERRAIN_SOURCE_ID)) {
    map.addSource(TERRAIN_SOURCE_ID, {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14
    });
  }
  map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.25 });
}

function aerialCorners(latitude: number, longitude: number, sizeMeters: number): [[number, number], [number, number], [number, number], [number, number]] {
  const halfLat = metersToLatitudeDegrees(sizeMeters / 2);
  const halfLng = metersToLongitudeDegrees(sizeMeters / 2, latitude);
  return [
    [longitude - halfLng, latitude + halfLat],
    [longitude + halfLng, latitude + halfLat],
    [longitude + halfLng, latitude - halfLat],
    [longitude - halfLng, latitude - halfLat]
  ];
}

function addUploadedAerialFallback(map: mapboxgl.Map, config: Estate3DConfig) {
  if (!config.aerialImageUrl || typeof config.latitude !== 'number' || typeof config.longitude !== 'number' || map.getSource(AERIAL_SOURCE_ID)) return;
  const dimensions = resolveBuildingDimensions(config);
  const imageSize = Math.max(80, dimensions.width * 7, dimensions.depth * 7);
  map.addSource(AERIAL_SOURCE_ID, {
    type: 'image',
    url: config.aerialImageUrl,
    coordinates: aerialCorners(config.latitude, config.longitude, imageSize)
  });
  map.addLayer({
    id: AERIAL_LAYER_ID,
    type: 'raster',
    source: AERIAL_SOURCE_ID,
    paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 250 }
  });
}

function createPropertyMarker(title: string) {
  const marker = document.createElement('div');
  marker.className = 'h-5 w-5 rounded-full border-2 border-white bg-orange-500 shadow-[0_0_24px_rgba(249,115,22,0.75)]';
  marker.title = title;
  return marker;
}

export function MapboxDigitalTwinViewer({ config, onFallback }: Props) {
  const { t, locale } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [note, setNote] = useState<string>(t.viewer.realWorldNote);
  const [clickedPoint, setClickedPoint] = useState<ClickedPoint | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const footprintRef = useRef<[number, number][]>([]);
  const drawRef = useRef(false);

  useEffect(() => {
    drawRef.current = isDrawing;
  }, [isDrawing]);

  const refreshFootprint = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const points = footprintRef.current;
    const sourceId = 'drawn-footprint';
    const lineId = 'drawn-footprint-line';
    const fillId = 'drawn-footprint-fill';
    const coordinates = points.length > 2 ? [[...points, points[0]]] : [points];
    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: points.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: points.length > 2 ? 'Polygon' : 'LineString', coordinates: points.length > 2 ? coordinates : points } as any }] : []
    };

    const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }

    map.addSource(sourceId, { type: 'geojson', data });
    map.addLayer({ id: fillId, type: 'fill', source: sourceId, filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#f97316', 'fill-opacity': 0.24 } });
    map.addLayer({ id: lineId, type: 'line', source: sourceId, paint: { 'line-color': '#fb923c', 'line-width': 3, 'line-opacity': 0.95 } });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof config.latitude !== 'number' || typeof config.longitude !== 'number') {
      onFallback('Latitude and longitude are required for Mapbox digital twin mode.');
      return;
    }

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      onFallback(t.viewer.missingMapKey);
      return;
    }

    let mounted = true;
    let modelRoot: any = null;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container,
      style: MAPBOX_STYLE,
      center: [config.longitude, config.latitude],
      zoom: 18.2,
      pitch: config.cameraTilt ?? 67,
      bearing: config.cameraHeading ?? -18,
      antialias: true,
      attributionControl: true,
      maxPitch: 85
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), locale === 'fa' ? 'top-left' : 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), locale === 'fa' ? 'bottom-left' : 'bottom-right');

    const propertyMarker = new mapboxgl.Marker({ element: createPropertyMarker(config.title || 'Property'), anchor: 'bottom' })
      .setLngLat([config.longitude, config.latitude])
      .addTo(map);
    const clickMarker = new mapboxgl.Marker({ color: '#f97316' });

    const buildModel = async () => {
      if ((config.modelUrl && isLikelyGltfUrl(config.modelUrl))) {
        try {
          return (await loadEstateModel(config)).object;
        } catch (error) {
          console.warn('Mapbox GLTF overlay failed; using generated building', error);
          setNote(t.viewer.fallbackModel);
        }
      }
      return (await createParametricBuilding(config)).object;
    };

    map.on('style.load', () => {
      if (!mounted) return;
      createAtmosphere(map);
      try {
        addTerrain(map);
      } catch (error) {
        console.warn('Mapbox terrain unavailable; continuing with flat map', error);
        setNote(t.viewer.flatTerrainNote);
      }

      const layer: mapboxgl.CustomLayerInterface = {
        id: 'estate-three-building-layer',
        type: 'custom',
        renderingMode: '3d',
        onAdd: async (_map, gl) => {
          const origin = mapboxgl.MercatorCoordinate.fromLngLat(
            [config.longitude!, config.latitude!],
            map.queryTerrainElevation([config.longitude!, config.latitude!]) ?? 0
          );
          const scene = new THREE.Scene();
          scene.add(new THREE.AmbientLight('#ffffff', 1.25));
          const sun = new THREE.DirectionalLight('#fff7ed', 2.4);
          sun.position.set(60, 120, 40);
          scene.add(sun);

          modelRoot = await buildModel();
          if (!mounted || !modelRoot) return;
          scene.add(modelRoot);

          const camera = new THREE.Camera();
          const renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
          renderer.autoClear = false;
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.1;

          (layer as any).render = (_gl: WebGLRenderingContext, matrix: number[]) => {
            const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
            const scale = origin.meterInMercatorCoordinateUnits();
            const transform = new THREE.Matrix4()
              .makeTranslation(origin.x, origin.y, origin.z)
              .scale(new THREE.Vector3(scale, -scale, scale))
              .multiply(rotationX);
            camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(transform);
            renderer.resetState();
            renderer.render(scene, camera);
            map.triggerRepaint();
          };
          map.triggerRepaint();
        },
        render: () => undefined
      };
      map.addLayer(layer);
    });

    map.on('error', (event) => {
      console.warn('Mapbox map error', event.error);
      if (config.aerialImageUrl && map.isStyleLoaded()) {
        addUploadedAerialFallback(map, config);
        setNote(t.viewer.satelliteFallbackNote);
      }
    });

    map.on('click', (event) => {
      const elevation = map.queryTerrainElevation(event.lngLat) ?? null;
      setClickedPoint({ latitude: event.lngLat.lat, longitude: event.lngLat.lng, elevation });
      clickMarker.setLngLat(event.lngLat).addTo(map);
      if (drawRef.current) {
        footprintRef.current = [...footprintRef.current, [event.lngLat.lng, event.lngLat.lat]];
        refreshFootprint();
      }
    });

    return () => {
      mounted = false;
      if (modelRoot) disposeObject3D(modelRoot);
      propertyMarker.remove();
      clickMarker.remove();
      map.remove();
      mapRef.current = null;
      footprintRef.current = [];
    };
  }, [config, locale, onFallback, refreshFootprint, t.viewer.fallbackModel, t.viewer.flatTerrainNote, t.viewer.missingMapKey, t.viewer.satelliteFallbackNote]);

  const setView = (view: 'reset' | 'top' | 'building' | 'orbit') => {
    const map = mapRef.current;
    if (!map || typeof config.latitude !== 'number' || typeof config.longitude !== 'number') return;
    if (view === 'reset') map.easeTo({ center: [config.longitude, config.latitude], zoom: 18.2, pitch: config.cameraTilt ?? 67, bearing: config.cameraHeading ?? -18, duration: 1100 });
    if (view === 'top') map.easeTo({ center: [config.longitude, config.latitude], zoom: 19, pitch: 0, duration: 900 });
    if (view === 'building') map.easeTo({ center: [config.longitude, config.latitude], zoom: 19.2, pitch: 74, bearing: config.cameraHeading ?? -24, duration: 1000 });
    if (view === 'orbit') map.easeTo({ bearing: map.getBearing() + 45, pitch: Math.max(map.getPitch(), 65), duration: 850 });
  };

  const clearFootprint = () => {
    footprintRef.current = [];
    refreshFootprint();
  };

  return (
    <div className="relative min-h-[620px] overflow-hidden rounded-3xl bg-slate-950 text-white" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <div ref={containerRef} className="h-[620px] w-full" />
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2">
        <span className="rounded-full bg-slate-950/80 px-3 py-2 text-xs font-semibold shadow-lg ring-1 ring-white/10">{t.viewer.mapboxMode}</span>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setView('reset')} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">{t.viewer.reset}</button>
          <button type="button" onClick={() => setView('top')} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">{t.viewer.topView}</button>
          <button type="button" onClick={() => setView('building')} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">{t.viewer.buildingView}</button>
          <button type="button" onClick={() => setView('orbit')} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">{t.viewer.autoRotate}</button>
          <button type="button" onClick={() => setIsDrawing((value) => !value)} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">{isDrawing ? t.viewer.finishFootprint : t.viewer.drawFootprint}</button>
          <button type="button" onClick={clearFootprint} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">{t.viewer.clearFootprint}</button>
        </div>
      </div>
      <div className="absolute bottom-3 right-3 z-10 max-w-sm rounded-2xl border border-white/10 bg-slate-950/75 p-3 text-xs text-slate-100 shadow-xl backdrop-blur">
        <p>{note}</p>
        {clickedPoint ? <p className="mt-2 text-[11px] text-slate-300">{t.viewer.clickedCoordinates}: {clickedPoint.latitude.toFixed(6)}, {clickedPoint.longitude.toFixed(6)}{clickedPoint.elevation !== null && clickedPoint.elevation !== undefined ? ` · ${Math.round(clickedPoint.elevation)}m` : ''}</p> : null}
      </div>
    </div>
  );
}
