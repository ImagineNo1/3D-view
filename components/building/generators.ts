import * as THREE from 'three';

const WIDTH_TO_DEPTH_RATIO = 0.6;

export type FacadeAssets = {
  facadeFront: string | null;
  facadeBack: string | null;
  facadeLeft: string | null;
  facadeRight: string | null;
  aerialImage: string | null;
};

export type BuildingModelData = {
  width: number;
  depth: number;
  buildingHeight: number;
  rotationY: number;
  lat: number;
  lon: number;
  assets: FacadeAssets;
};

function toPositiveNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function normalizeRotationY(rotation: unknown) {
  const raw = Number(rotation);
  if (!Number.isFinite(raw)) return 0;
  return Math.abs(raw) > Math.PI * 2 ? THREE.MathUtils.degToRad(raw) : raw;
}

export function computeDimensions(buildingArea: unknown, widthToDepthRatio = WIDTH_TO_DEPTH_RATIO) {
  const area = toPositiveNumber(buildingArea, 900);
  const ratio = toPositiveNumber(widthToDepthRatio, WIDTH_TO_DEPTH_RATIO);
  const depth = Math.sqrt(area / ratio);
  const width = depth * ratio;
  return { width, depth };
}

export function mapFacadeAssets(facadeImages: string[] = [], aerialImage?: string): FacadeAssets {
  const facadeFront = facadeImages[0] ?? null;
  const facadeBack = facadeImages[1] ?? facadeFront;
  const facadeLeft = facadeImages[2] ?? facadeFront;
  const facadeRight = facadeImages[3] ?? facadeFront;

  return {
    facadeFront,
    facadeBack,
    facadeLeft,
    facadeRight,
    aerialImage: aerialImage ?? null
  };
}

export function createModelData(input: {
  buildingArea?: number;
  buildingHeight?: number;
  floorCount?: number;
  floorHeight?: number;
  latitude?: number;
  longitude?: number;
  facadeImages?: string[];
  aerialImage?: string;
  rotation?: number;
}): BuildingModelData {
  const safeFloorCount = Math.max(1, Math.round(toPositiveNumber(input.floorCount, 6)));
  const safeBuildingHeight = toPositiveNumber(input.buildingHeight, safeFloorCount * 3.2);
  const safeFloorHeight = toPositiveNumber(input.floorHeight, safeBuildingHeight / safeFloorCount);
  const finalHeight = safeFloorHeight * safeFloorCount;
  const { width, depth } = computeDimensions(input.buildingArea);

  return {
    width,
    depth,
    buildingHeight: finalHeight,
    rotationY: normalizeRotationY(input.rotation),
    lat: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : 0,
    lon: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : 0,
    assets: mapFacadeAssets(input.facadeImages, input.aerialImage)
  };
}
