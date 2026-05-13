'use client';

import { useEffect, useRef, useState } from 'react';
import type { Estate3DConfig } from './types';

type Props = { config: Estate3DConfig; onFallback: (reason: string) => void };

declare global {
  interface Window { google?: any }
}

function loadGoogleMapsApi(apiKey: string): Promise<void> {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-maps="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps script')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=beta`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
}

export function CesiumDigitalTwinViewer({ config, onFallback }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapElement, setMapElement] = useState<any>(null);
  const [note, setNote] = useState('Loading real-world 3D environment…');

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (typeof config.latitude !== 'number' || typeof config.longitude !== 'number') {
        onFallback('Latitude and longitude are required for real-world digital twin mode.');
        return;
      }

      const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!googleKey) {
        onFallback('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured; using the standalone 3D fallback.');
        return;
      }

      try {
        await loadGoogleMapsApi(googleKey);
        if (!mounted || !containerRef.current || !window.google?.maps?.importLibrary) return;

        const maps3dLib = await window.google.maps.importLibrary('maps3d');
        const markerLib = await window.google.maps.importLibrary('marker');
        const element = new maps3dLib.Map3DElement({
          center: { lat: config.latitude, lng: config.longitude, altitude: config.cameraAltitude ?? 300 },
          range: config.cameraRange ?? 300,
          tilt: config.cameraTilt ?? 65,
          heading: config.cameraHeading ?? 0,
          mode: 'hybrid'
        });

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(element);

        new markerLib.AdvancedMarkerElement({
          map: element,
          position: { lat: config.latitude, lng: config.longitude },
          title: config.title || 'Property'
        });

        if (config.modelUrl) {
          try {
            const model = new maps3dLib.Model3DElement({
              position: { lat: config.latitude, lng: config.longitude, altitude: 0 },
              src: config.modelUrl,
              scale: 1
            });
            element.append(model);
          } catch (error) {
            console.warn('Google 3D model overlay failed', error);
            setNote('Real-world city context is active, but the model overlay could not be added.');
          }
        } else {
          setNote('Real-world city context is active. Generated-building overlay is available in fallback mode.');
        }

        setMapElement(element);
        setNote('Real-world city context is active. Coverage and detail depend on Google Photorealistic 3D availability.');
      } catch (error) {
        console.warn('Real-world 3D viewer failed', error);
        onFallback(error instanceof Error ? error.message : 'Real-world 3D viewer failed; using fallback.');
      }
    };

    void init();

    return () => {
      mounted = false;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [config, onFallback]);

  const setView = (view: 'reset' | 'top' | 'building' | 'orbit') => {
    if (!mapElement || typeof config.latitude !== 'number' || typeof config.longitude !== 'number') return;
    if (view === 'reset') {
      mapElement.center = { lat: config.latitude, lng: config.longitude, altitude: config.cameraAltitude ?? 300 };
      mapElement.range = config.cameraRange ?? 300;
      mapElement.tilt = config.cameraTilt ?? 65;
      mapElement.heading = config.cameraHeading ?? 0;
    } else if (view === 'top') {
      mapElement.tilt = 0;
      mapElement.range = (config.cameraRange ?? 300) * 1.25;
    } else if (view === 'building') {
      mapElement.tilt = 70;
      mapElement.range = Math.max(120, (config.cameraRange ?? 300) * 0.72);
    } else {
      mapElement.heading = ((Number(mapElement.heading) || 0) + 45) % 360;
    }
  };

  return (
    <div className="relative min-h-[620px] overflow-hidden rounded-3xl bg-slate-950 text-white">
      <div ref={containerRef} className="h-[620px] w-full" />
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-900/85 px-3 py-2 text-xs font-semibold shadow-lg ring-1 ring-white/10">Real-world mode</span>
        <button type="button" onClick={() => setView('reset')} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">Reset</button>
        <button type="button" onClick={() => setView('top')} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">Top view</button>
        <button type="button" onClick={() => setView('building')} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">Building view</button>
        <button type="button" onClick={() => setView('orbit')} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold backdrop-blur hover:bg-white/20">Orbit</button>
      </div>
      <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-slate-950/75 p-3 text-xs text-slate-100 shadow-xl backdrop-blur">
        {note} Cesium can be enabled later when the dependency is available; this mode still falls back automatically.
      </div>
    </div>
  );
}
