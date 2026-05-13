import type { Property } from '@/types/property';

export type ViewerMode = 'real_world_digital_twin' | 'standalone_model' | 'parametric_fallback';

export type Estate3DConfig = {
  id?: string;
  title?: string;
  description?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  buildingArea?: number;
  buildingHeight?: number;
  floors?: number;
  floorHeight?: number;
  footprintWidth?: number;
  footprintDepth?: number;
  rotationDeg?: number;
  modelUrl?: string;
  facadeFrontUrl?: string;
  facadeBackUrl?: string;
  facadeLeftUrl?: string;
  facadeRightUrl?: string;
  aerialImageUrl?: string;
  viewerMode?: ViewerMode;
  cameraAltitude?: number;
  cameraTilt?: number;
  cameraHeading?: number;
  cameraRange?: number;
};

export type LegacyViewerMode = Property['viewerMode'];

export function normalizeViewerMode(mode?: LegacyViewerMode | ViewerMode, modelUrl?: string): ViewerMode {
  if (mode === 'real_world_digital_twin' || mode === 'standalone_model' || mode === 'parametric_fallback') return mode;
  if (mode === 'cesium_google_3d_tiles' || mode === 'google_3d_maps') return 'real_world_digital_twin';
  if (mode === 'three_procedural') return modelUrl ? 'standalone_model' : 'parametric_fallback';
  return modelUrl ? 'standalone_model' : 'parametric_fallback';
}

function num(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function propertyToEstate3DConfig(property: Partial<Property> & Record<string, any>): Estate3DConfig {
  const gallery = Array.isArray(property.images?.gallery) ? property.images.gallery : [];
  return {
    id: firstString(property._id, property.id),
    title: firstString(property.title),
    description: firstString(property.description),
    googleMapsUrl: firstString(property.googleMapsUrl),
    latitude: num(property.latitude),
    longitude: num(property.longitude),
    buildingArea: num(property.buildingArea),
    buildingHeight: num(property.buildingHeight),
    floors: num(property.floorCount ?? property.floors),
    floorHeight: num(property.floorHeight),
    footprintWidth: num(property.footprintWidth),
    footprintDepth: num(property.footprintDepth),
    rotationDeg: num(property.rotation ?? property.rotationDeg),
    modelUrl: firstString(property.modelUrl),
    facadeFrontUrl: firstString(property.realFacadeTextures?.facadeFront?.rectifiedImageUrl, property.realFacadeTextures?.facadeFront?.imageUrl, gallery[0], property.facadeFrontUrl),
    facadeBackUrl: firstString(property.realFacadeTextures?.facadeBack?.rectifiedImageUrl, property.realFacadeTextures?.facadeBack?.imageUrl, gallery[1], property.facadeBackUrl),
    facadeLeftUrl: firstString(property.realFacadeTextures?.facadeLeft?.rectifiedImageUrl, property.realFacadeTextures?.facadeLeft?.imageUrl, gallery[2], property.facadeLeftUrl),
    facadeRightUrl: firstString(property.realFacadeTextures?.facadeRight?.rectifiedImageUrl, property.realFacadeTextures?.facadeRight?.imageUrl, gallery[3], property.facadeRightUrl),
    aerialImageUrl: firstString(property.aerialContext?.aerialImageUrl, property.images?.aerial?.[0], property.aerialImageUrl),
    viewerMode: normalizeViewerMode(property.viewerMode, property.modelUrl),
    cameraAltitude: num(property.cameraAltitude),
    cameraTilt: num(property.cameraTilt),
    cameraHeading: num(property.cameraHeading),
    cameraRange: num(property.cameraRange)
  };
}
