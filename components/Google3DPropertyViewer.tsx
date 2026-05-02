'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  lat: number;
  lng: number;
  title: string;
  cameraAltitude?: number;
  cameraTilt?: number;
  cameraHeading?: number;
  cameraRange?: number;
  modelUrl?: string;
  onUseFallback?: () => void;
};

declare global {
  interface Window {
    google?: any;
  }
}

const DEFAULTS = {
  altitude: 300,
  tilt: 65,
  heading: 0,
  range: 300
};

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

export function Google3DPropertyViewer({ lat, lng, title, cameraAltitude, cameraTilt, cameraHeading, cameraRange, modelUrl, onUseFallback }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setError('Google Maps API key is missing.');
        setLoading(false);
        return;
      }

      try {
        await loadGoogleMapsApi(apiKey);
        if (!mounted || !containerRef.current || !window.google?.maps?.importLibrary) return;

        const maps3dLib = await window.google.maps.importLibrary('maps3d');
        const markerLib = await window.google.maps.importLibrary('marker');

        const map3DElement = new maps3dLib.Map3DElement({
          center: { lat, lng, altitude: cameraAltitude ?? DEFAULTS.altitude },
          range: cameraRange ?? DEFAULTS.range,
          tilt: cameraTilt ?? DEFAULTS.tilt,
          heading: cameraHeading ?? DEFAULTS.heading,
          mode: 'hybrid'
        });

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(map3DElement);

        const marker = new markerLib.AdvancedMarkerElement({
          map: map3DElement,
          position: { lat, lng },
          title
        });

        if (modelUrl) {
          try {
            const modelEl = new maps3dLib.Model3DElement({
              position: { lat, lng, altitude: 0 },
              src: modelUrl,
              scale: 1
            });
            map3DElement.append(modelEl);
          } catch {
            setNote('Model could not be loaded. Map and marker are still available.');
          }
        }

        setMap({ element: map3DElement, marker });
        setNote('Photorealistic 3D building coverage may not be available for this exact location.');
        setError(null);
      } catch (initError) {
        setError(initError instanceof Error ? initError.message : 'Google 3D map failed to load.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [lat, lng, title, cameraAltitude, cameraHeading, cameraRange, cameraTilt, modelUrl]);

  const setView = (view: 'reset' | 'top' | 'street' | 'orbit') => {
    if (!map?.element) return;

    if (view === 'reset') {
      map.element.center = { lat, lng, altitude: cameraAltitude ?? DEFAULTS.altitude };
      map.element.range = cameraRange ?? DEFAULTS.range;
      map.element.tilt = cameraTilt ?? DEFAULTS.tilt;
      map.element.heading = cameraHeading ?? DEFAULTS.heading;
      return;
    }

    if (view === 'top') {
      map.element.tilt = 0;
      map.element.range = (cameraRange ?? DEFAULTS.range) * 1.25;
      return;
    }

    if (view === 'street') {
      map.element.tilt = 70;
      map.element.range = Math.max(180, (cameraRange ?? DEFAULTS.range) * 0.75);
      return;
    }

    if (view === 'orbit') {
      map.element.heading = ((Number(map.element.heading) || 0) + 45) % 360;
    }
  };

  return (
    <div className="relative min-h-[500px] bg-slate-950 text-white">
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
        <button className="rounded bg-blue-600 px-3 py-1 text-sm hover:bg-blue-500" onClick={() => setView('reset')} type="button">Reset view</button>
        <button className="rounded bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700" onClick={() => setView('orbit')} type="button">Orbit</button>
        <button className="rounded bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700" onClick={() => setView('top')} type="button">Top view</button>
        <button className="rounded bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700" onClick={() => setView('street')} type="button">Street/oblique</button>
        <a className="rounded bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700" href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer">Open in Google Maps</a>
      </div>

      {loading ? <div className="absolute inset-0 grid place-items-center text-slate-200">Loading 3D map…</div> : null}
      {error ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/90 p-4 text-center">
          <div>
            <p className="text-red-300">{error}</p>
            <button type="button" onClick={onUseFallback} className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm">Use internal 3D viewer</button>
          </div>
        </div>
      ) : null}
      {note ? <p className="absolute bottom-2 left-2 z-10 rounded bg-slate-900/80 px-2 py-1 text-xs text-slate-200">{note}</p> : null}

      <div ref={containerRef} className="h-[500px] w-full" />
    </div>
  );
}
