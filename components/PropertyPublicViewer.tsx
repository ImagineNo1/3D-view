'use client';

import { useState } from 'react';
import { Google3DPropertyViewer } from '@/components/Google3DPropertyViewer';
import { Property3DViewer } from '@/components/Property3DViewer';
import type { PropertyViewerMode } from '@/types/property';

type Props = {
  property: any;
};

export function PropertyPublicViewer({ property }: Props) {
  const [fallback, setFallback] = useState(false);
  const viewerMode: PropertyViewerMode = property.viewerMode || 'google_3d_maps';
  const hasLatLng = typeof property.latitude === 'number' && typeof property.longitude === 'number';

  if (!fallback && viewerMode === 'google_3d_maps' && hasLatLng) {
    return (
      <Google3DPropertyViewer
        lat={property.latitude}
        lng={property.longitude}
        title={property.title}
        cameraAltitude={property.cameraAltitude}
        cameraTilt={property.cameraTilt}
        cameraHeading={property.cameraHeading}
        cameraRange={property.cameraRange}
        modelUrl={property.modelUrl}
        onUseFallback={() => setFallback(true)}
      />
    );
  }

  return (
    <Property3DViewer
      data={{
        id: String(property._id), slug: property.slug, title: property.title,
        googleMapsUrl: property.googleMapsUrl, buildingArea: property.buildingArea,
        buildingHeight: property.buildingHeight, floors: property.floorCount,
        floorHeight: property.floorHeight, rotationDeg: property.rotation,
        description: property.description, facadeFrontUrl: property.images?.gallery?.[0],
        facadeBackUrl: property.images?.gallery?.[1], facadeLeftUrl: property.images?.gallery?.[2],
        facadeRightUrl: property.images?.gallery?.[3], modelUrl: property.modelUrl,
        footprintWidth: property.footprintWidth, footprintDepth: property.footprintDepth,
        buildingAppearance: property.buildingAppearance, siteContext: property.siteContext,
        aerialContext: property.aerialContext, realFacadeTextures: property.realFacadeTextures,
        viewerRealismMode: property.viewerRealismMode
      }}
    />
  );
}
