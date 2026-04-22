import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchAutoImagery, parseGoogleMapsUrl, imageryBufferToDataUrl } = require('../../../tools/auto-reconstruct/imagery');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { extractBuildings } = require('../../../tools/auto-reconstruct/segmentation');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildSceneGeometry } = require('../../../tools/auto-reconstruct/geo');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { encodeHeightmapPng } = require('../../../tools/auto-reconstruct/terrain');

export const runtime = 'nodejs';

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
  let minY = 0;
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

function createProceduralNoiseHeightmap(width: number, height: number) {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const v = Math.sin(x * 0.05) * 0.5 + Math.cos(y * 0.04) * 0.5 + Math.sin((x + y) * 0.02) * 0.5;
      out[i] = Math.round((v * 0.5 + 0.5) * 255);
    }
  }
  return out;
}

async function generateHeightmapFromImagery(rgbaBuffer: Buffer, width: number, height: number) {
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    gray[i] = 0.299 * rgbaBuffer[p] + 0.587 * rgbaBuffer[p + 1] + 0.114 * rgbaBuffer[p + 2];
  }

  const blur = new Float32Array(gray.length);
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let sum = 0;
      let ki = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          sum += gray[(y + oy) * width + (x + ox)] * kernel[ki++];
        }
      }
      blur[y * width + x] = sum / 16;
    }
  }

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < blur.length; i += 1) {
    if (blur[i] < min) min = blur[i];
    if (blur[i] > max) max = blur[i];
  }

  const span = Math.max(1, max - min);
  const heightmap = new Uint8Array(width * height);
  for (let i = 0; i < blur.length; i += 1) {
    heightmap[i] = Math.max(0, Math.min(255, Math.round(((blur[i] - min) / span) * 255)));
  }

  return { bytes: heightmap, width, height, source: 'js' };
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

    let heightmap;
    try {
      heightmap = await generateHeightmapFromImagery(imagery.rgbaBuffer, imagery.width, imagery.height);
    } catch (err) {
      errors.push(`heightmap failed: ${err instanceof Error ? err.message : String(err)}`);
      const bytes = createProceduralNoiseHeightmap(imagery.width, imagery.height);
      heightmap = { bytes, width: imagery.width, height: imagery.height, source: 'procedural' };
    }

    const terrainPng = await encodeHeightmapPng(heightmap.bytes, heightmap.width, heightmap.height);
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
      heightmapBytes: heightmap.bytes,
      heightmapWidth: heightmap.width,
      heightmapHeight: heightmap.height,
      imageWidth: imagery.width,
      imageHeight: imagery.height,
      pixelScaleMeters: 1
    });

    const roads = normalizeRoads(roadsPayload, imagery.width, imagery.height, 1) as Array<{ id: number; points: number[][] }>;
    const bounds = buildBounds(geometry.terrain, geometry.buildings);

    const scene = {
      mapCenter: { lat: loc.lat, lon: loc.lng, zoom: loc.zoom },
      terrain: geometry.terrain,
      buildings: geometry.buildings,
      diagnostics: {
        imageryMode: imagery.mode || (imagery.fallback ? 'mock' : 'live'),
        fallbackImagery: imagery.fallback,
        heightmapSource: heightmap.source,
        errors
      }
    };

    latestReconstructResult = {
      ok: true,
      scene,
      terrain: imageryBufferToDataUrl(terrainPng),
      imagery: imageryBufferToDataUrl(imagery.buffer),
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
