const DEM_PRIMARY = 'https://tile.nextzen.org/tilezen/terrain/v1/512/terrarium/{z}/{x}/{y}.png?api_key=tilezen';
const DEM_FALLBACK = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const FETCH_HEADERS = { 'User-Agent': 'Mozilla/5.0' };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function terrariumToMeters(r, g, b) {
  return (r * 256 + g + (b / 256)) - 32768;
}

function normalizeHeightsToBytes(heights) {
  let min = Infinity;
  let max = -Infinity;
  for (const h of heights) {
    if (h < min) min = h;
    if (h > max) max = h;
  }

  const flat = Number.isFinite(min) && Number.isFinite(max) && Math.abs(max - min) < 1e-6;
  if (flat) {
    return {
      bytes: Uint8Array.from(heights.map(() => 127)),
      min,
      max,
      flat: true
    };
  }

  const span = Math.max(1e-6, max - min);
  const bytes = new Uint8Array(heights.length);
  for (let i = 0; i < heights.length; i += 1) {
    bytes[i] = clamp(Math.round(((heights[i] - min) / span) * 255), 0, 255);
  }

  return { bytes, min, max, flat: false };
}

async function encodeHeightmapPng(heightmapBytes, width, height, options = {}) {
  let sharpLib = options.sharpLib;
  if (!sharpLib) {
    // eslint-disable-next-line global-require
    sharpLib = require('sharp');
  }

  return sharpLib(heightmapBytes, {
    raw: { width, height, channels: 1 }
  }).png().toBuffer();
}

function buildDemUrl(template, z, x, y) {
  return template
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

async function fetchTerrariumTile(z, x, y, sharpLib, retries = 3) {
  const urls = [
    buildDemUrl(DEM_PRIMARY, z, x, y),
    buildDemUrl(DEM_FALLBACK, z, x, y)
  ];

  for (const url of urls) {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          cache: 'no-store',
          headers: FETCH_HEADERS
        });

        if (!res.ok) continue;
        const contentType = String(res.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('image/png')) continue;

        const buffer = Buffer.from(await res.arrayBuffer());
        if (!buffer.length) continue;

        const { data, info } = await sharpLib(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        if (info.width > 0 && info.height > 0) {
          return { ok: true, buffer, rgba: data, width: info.width, height: info.height, source: url };
        }
      } catch {
        // retry/failover
      }
    }
  }

  return { ok: false };
}

async function fetchTerrainHeightmap(tile, options = {}) {
  let sharpLib = options.sharpLib;
  if (!sharpLib) {
    // eslint-disable-next-line global-require
    sharpLib = require('sharp');
  }

  const z = tile.z;
  const x = tile.x;
  const y = tile.y;

  const terrarium = await fetchTerrariumTile(z, x, y, sharpLib, 3);
  if (!terrarium.ok) {
    console.warn('[terrain] DEM unavailable after retries; generating synthetic non-zero flat DEM');
    const width = 512;
    const height = 512;
    const heights = new Array(width * height).fill(5);
    const normalized = normalizeHeightsToBytes(heights);
    return {
      bytes: normalized.bytes,
      width,
      height,
      source: 'synthetic-flat-dem',
      warnings: ['dem-missing-generated-flat']
    };
  }

  const heights = new Array(terrarium.width * terrarium.height);
  for (let i = 0, p = 0; i < heights.length; i += 1, p += 4) {
    heights[i] = terrariumToMeters(terrarium.rgba[p], terrarium.rgba[p + 1], terrarium.rgba[p + 2]);
  }

  const normalized = normalizeHeightsToBytes(heights);
  if (normalized.flat) {
    console.warn('[terrain] DEM appears flat; preserving constant height instead of zero array');
  }

  return {
    bytes: normalized.bytes,
    width: terrarium.width,
    height: terrarium.height,
    source: terrarium.source,
    minElevation: normalized.min,
    maxElevation: normalized.max,
    flat: normalized.flat,
    warnings: []
  };
}

module.exports = {
  encodeHeightmapPng,
  fetchTerrainHeightmap,
  terrariumToMeters,
  DEM_PRIMARY,
  DEM_FALLBACK
};
