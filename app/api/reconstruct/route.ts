import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchAutoImagery, parseGoogleMapsUrl, imageryBufferToDataUrl, latLngToTile } = require('../../../tools/auto-reconstruct/imagery');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { extractBuildings } = require('../../../tools/auto-reconstruct/segmentation');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildSceneGeometry } = require('../../../tools/auto-reconstruct/geo');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { encodeHeightmapPng, fetchTerrainHeightmap } = require('../../../tools/auto-reconstruct/terrain');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ReconstructPayload = {
  ok: boolean;
  scene: unknown;
  terrain: string;
  imagery: string;
  roads: Array<{ id: number; points: number[][] }>;
  bounds: Record<string, unknown>;
  buildings: unknown[];
};

const TMP_DIR = '/tmp/auto-reconstruct';
let latestReconstructResult: ReconstructPayload | null = null;

function normalizeRoads(roads: Array<{ id?: number; polygon?: number[][] }> = [], imageWidth = 0, imageHeight = 0, pixelScaleMeters = 1) {
  const cx = imageWidth / 2;
  const cy = imageHeight / 2;
  return roads
    .map((road, idx) => {
      const poly = Array.isArray(road?.polygon) ? road.polygon : [];
      const points = poly
        .filter((pt) => Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))
        .map(([x, y]) => [((x - cx) * pixelScaleMeters), ((y - cy) * pixelScaleMeters)]);
      if (points.length < 2) return null;
      return { id: road.id ?? idx, points };
    })
    .filter(Boolean);
}

function buildBounds(terrain: { worldSizeMeters?: number; maxHeightMeters?: number }, buildings: Array<{ height?: number }> = []) {
  const worldSize = Number(terrain?.worldSizeMeters) || 0;
  const half = worldSize / 2;
  const minY = 0;
  let maxY = Number(terrain?.maxHeightMeters) || 12;

  for (const b of buildings) {
    maxY = Math.max(maxY, Number(b?.height) || 0);
  }

  return {
    minX: -half,
    maxX: half,
    minY,
    maxY,
    minZ: -half,
    maxZ: half,
    center: { x: 0, y: (minY + maxY) / 2, z: 0 }
  };
}

export async function GET() {
  if (!latestReconstructResult) {
    return NextResponse.json({ ok: false, error: 'No reconstruction has been generated yet' }, { status: 404 });
  }
  return NextResponse.json(latestReconstructResult);
}

export async function POST(request: NextRequest) {
  const errors: string[] = [];
  await mkdir(TMP_DIR, { recursive: true });

  try {
    const body = await request.json().catch(() => ({}));
    const googleMapsUrl = body?.url || body?.googleMapsUrl;
    const loc = parseGoogleMapsUrl(googleMapsUrl);

    const imagery = await fetchAutoImagery(googleMapsUrl);
    await writeFile(path.join(TMP_DIR, 'satellite.png'), imagery.buffer);

    const centerTile = latLngToTile(loc.lat, loc.lng, loc.zoom);
    const terrainMap = await fetchTerrainHeightmap(centerTile);
    const terrainPng = await encodeHeightmapPng(terrainMap.bytes, terrainMap.width, terrainMap.height);
    await writeFile(path.join(TMP_DIR, 'heightmap.png'), terrainPng);

    const js = extractBuildings({ buffer: imagery.rgbaBuffer, width: imagery.width, height: imagery.height });
    let footprintPayload = js.buildings.map((b: { footprint: number[][]; height: number; type: string }, idx: number) => ({
      id: idx,
      polygon: b.footprint,
      height_m: b.height,
      type: b.type
    }));

    if (!Array.isArray(footprintPayload) || footprintPayload.length === 0) {
      footprintPayload = [{
        id: 0,
        polygon: [[imagery.width * 0.4, imagery.height * 0.4], [imagery.width * 0.6, imagery.height * 0.4], [imagery.width * 0.6, imagery.height * 0.6], [imagery.width * 0.4, imagery.height * 0.6], [imagery.width * 0.4, imagery.height * 0.4]],
        height_m: 18,
        type: 'fallback'
      }];
      errors.push('footprints empty, fallback square used');
    }

    const roadsPayload = [{
      id: 0,
      polygon: [[0, imagery.height * 0.5], [imagery.width, imagery.height * 0.5]]
    }, {
      id: 1,
      polygon: [[imagery.width * 0.5, 0], [imagery.width * 0.5, imagery.height]]
    }];

    await writeFile(path.join(TMP_DIR, 'footprints.json'), JSON.stringify(footprintPayload, null, 2));
    await writeFile(path.join(TMP_DIR, 'roads.json'), JSON.stringify(roadsPayload, null, 2));

    const geometry = buildSceneGeometry({
      footprints: footprintPayload,
      heightmapBytes: terrainMap.bytes,
      heightmapWidth: terrainMap.width,
      heightmapHeight: terrainMap.height,
      imageWidth: imagery.width,
      imageHeight: imagery.height,
      pixelScaleMeters: 1
    });

    const roads = normalizeRoads(roadsPayload, imagery.width, imagery.height, 1) as Array<{ id: number; points: number[][] }>;
    const bounds = buildBounds(geometry.terrain, geometry.buildings);
    const imageryDataUrl = imageryBufferToDataUrl(imagery.buffer);

    const scene = {
      mapCenter: { lat: loc.lat, lon: loc.lng, zoom: loc.zoom },
      terrain: geometry.terrain,
      buildings: geometry.buildings,
      imagery: {
        dataUrl: imageryDataUrl,
        mimeType: 'image/png'
      },
      diagnostics: {
        imageryMode: imagery.mode || (imagery.fallback ? 'mock' : 'live'),
        fallbackImagery: imagery.fallback,
        heightmapSource: terrainMap.source,
        errors
      }
    };

    latestReconstructResult = {
      ok: true,
      scene,
      terrain: imageryBufferToDataUrl(terrainPng),
      imagery: imageryDataUrl,
      roads,
      bounds,
      buildings: geometry.buildings
    };

    await writeFile(path.join(TMP_DIR, 'scene.json'), JSON.stringify(latestReconstructResult, null, 2));
    return NextResponse.json(latestReconstructResult);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
