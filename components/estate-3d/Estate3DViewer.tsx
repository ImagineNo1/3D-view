'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import type { Estate3DConfig, ViewerMode } from './types';
import { normalizeViewerMode } from './types';
import { isLikelyGltfUrl } from './ModelLoader';
import { ThreeStandaloneViewer } from './ThreeStandaloneViewer';

const MapboxDigitalTwinViewer = dynamic(() => import('./MapboxDigitalTwinViewer').then((mod) => mod.MapboxDigitalTwinViewer), {
  ssr: false,
  loading: () => <div className="grid min-h-[620px] place-items-center rounded-3xl bg-slate-950 text-sm text-slate-100">Loading Mapbox digital twin viewer…</div>
});

type Props = { config: Estate3DConfig };

function chooseMode(config: Estate3DConfig): ViewerMode {
  const requested = normalizeViewerMode(config.viewerMode, config.modelUrl);
  if (requested === 'standalone_model' && !isLikelyGltfUrl(config.modelUrl)) return 'parametric_fallback';
  return requested;
}

export function Estate3DViewer({ config }: Props) {
  const mode = useMemo(() => chooseMode(config), [config]);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const handleFallback = useCallback((reason: string) => setFallbackReason(reason), []);

  if (mode === 'real_world_digital_twin' && !fallbackReason) {
    return <MapboxDigitalTwinViewer config={config} onFallback={handleFallback} />;
  }

  const standaloneMode: ViewerMode = mode === 'standalone_model' ? 'standalone_model' : 'parametric_fallback';
  return <ThreeStandaloneViewer config={config} preferredMode={standaloneMode} fallbackNotice={fallbackReason || undefined} />;
}
