function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizePolygon(points = []) {
  if (!Array.isArray(points)) return [];
  const cleaned = points
    .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map(([x, y]) => [x, y]);

  if (cleaned.length < 3) return [];

  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) cleaned.push([first[0], first[1]]);
  return cleaned;
}

function polygonToShape(polygon = [], centerX = 0, centerY = 0, pixelScale = 1) {
  const normalized = normalizePolygon(polygon);
  if (normalized.length < 4) return [];

  return normalized.slice(0, -1).map(([x, y]) => [
    (x - centerX) * pixelScale,
    (y - centerY) * pixelScale
  ]);
}

function buildTerrainHeightField(heightmapBytes, width, height, maxHeightMeters = 12) {
  if (!heightmapBytes || !width || !height) {
    return { width: 2, height: 2, heights: [0, 0, 0, 0], maxHeightMeters };
  }

  const heights = new Array(width * height).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const nx = x / Math.max(1, width - 1);
      const ny = y / Math.max(1, height - 1);
      const edge = Math.max(Math.abs(2 * nx - 1), Math.abs(2 * ny - 1));
      const fade = 1 - clamp((edge - 0.72) / 0.28, 0, 1);
      const pixel = heightmapBytes[idx] || 0;
      heights[idx] = ((pixel / 255) * maxHeightMeters) * fade;
    }
  }

  return { width, height, heights, maxHeightMeters };
}


function ensureTerrainVariance(terrain) {
  const heights = Array.isArray(terrain?.heights) ? terrain.heights : [];
  if (heights.length < 4) return terrain;
  let min = Infinity;
  let max = -Infinity;
  for (const h of heights) {
    if (h < min) min = h;
    if (h > max) max = h;
  }

  if ((max - min) > 1e-4) return terrain;

  const varied = heights.map((_, i) => (i % Math.max(2, terrain.width)) * 0.02);
  return { ...terrain, heights: varied };
}

function buildExtrudedBuildings(footprints = [], imageWidth, imageHeight, pixelScaleMeters = 1) {
  const cx = imageWidth / 2;
  const cy = imageHeight / 2;

  const out = [];
  for (const item of footprints) {
    const polygon = item.polygon || item.footprint || [];
    const shape = polygonToShape(polygon, cx, cy, pixelScaleMeters);
    if (shape.length < 3) continue;

    out.push({
      id: item.id ?? out.length,
      type: item.type || 'building',
      height: clamp(Number(item.height_m ?? item.height ?? 12), 4, 120),
      footprint: shape
    });
  }

  if (out.length === 0) {
    out.push({
      id: 0,
      type: 'fallback',
      height: 12,
      footprint: [
        [-10, -10], [10, -10], [10, 10], [-10, 10]
      ]
    });
  }

  return out;
}

function buildSceneGeometry({
  footprints,
  heightmapBytes,
  heightmapWidth,
  heightmapHeight,
  imageWidth,
  imageHeight,
  pixelScaleMeters = 1
}) {
  const terrain = ensureTerrainVariance(buildTerrainHeightField(heightmapBytes, heightmapWidth, heightmapHeight, 12));
  const buildings = buildExtrudedBuildings(footprints, imageWidth, imageHeight, pixelScaleMeters);

  return {
    terrain: {
      type: 'PlaneGeometry',
      width: terrain.width,
      height: terrain.height,
      heights: terrain.heights,
      maxHeightMeters: terrain.maxHeightMeters,
      resolutionX: terrain.width - 1,
      resolutionY: terrain.height - 1,
      worldSizeMeters: Math.max(imageWidth, imageHeight) * pixelScaleMeters
    },
    buildings
  };
}

module.exports = {
  normalizePolygon,
  polygonToShape,
  buildSceneGeometry
};
