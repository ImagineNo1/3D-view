const TILE_SIZE = 256;
const GRID_SIZE = 3;
const USER_AGENT = '3d-view-auto-reconstruct/1.0 (+https://localhost)';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseCoordinatePair(raw = '') {
  const match = String(raw).match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function parseGoogleMapsUrl(url) {
  const fallback = { lat: 40.7128, lng: -74.006, zoom: 17, source: 'fallback' };
  if (!url || typeof url !== 'string') return fallback;

  try {
    const decoded = decodeURIComponent(url.trim());

    const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)z/i);
    if (atMatch) {
      return {
        lat: Number(atMatch[1]),
        lng: Number(atMatch[2]),
        zoom: Math.round(Number(atMatch[3])),
        source: '@lat,lng,zoomz'
      };
    }

    const dataMatch = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
    if (dataMatch) {
      return {
        lat: Number(dataMatch[1]),
        lng: Number(dataMatch[2]),
        zoom: 17,
        source: 'data=!3dLAT!4dLNG'
      };
    }

    const parsed = new URL(decoded);
    const qValue = parsed.searchParams.get('q') || parsed.searchParams.get('query') || '';
    const qPair = parseCoordinatePair(qValue);
    if (qPair) {
      const z = Number(parsed.searchParams.get('z'));
      return {
        lat: qPair.lat,
        lng: qPair.lng,
        zoom: Number.isFinite(z) && z > 0 ? Math.round(z) : 17,
        source: 'query-latlng'
      };
    }

    const pathCoord = decoded.match(/\/maps\/(?:place|search)\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
    if (pathCoord) {
      return {
        lat: Number(pathCoord[1]),
        lng: Number(pathCoord[2]),
        zoom: 17,
        source: 'path-latlng'
      };
    }

    // Short links normally require redirect resolution; try pulling coordinates if present in query.
    const ll = parsed.searchParams.get('ll') || parsed.searchParams.get('sll') || '';
    const llPair = parseCoordinatePair(ll);
    if (llPair) {
      return {
        lat: llPair.lat,
        lng: llPair.lng,
        zoom: 17,
        source: 'shortlink-query'
      };
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function latLngToTile(lat, lng, zoom) {
  const z = clamp(Math.round(Number(zoom) || 17), 16, 18);
  const n = 2 ** z;
  const latClamped = clamp(Number(lat) || 0, -85.05112878, 85.05112878);
  const lngNorm = ((((Number(lng) || 0) + 180) % 360) + 360) % 360 - 180;
  const latRad = (latClamped * Math.PI) / 180;
  const x = Math.floor(((lngNorm + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2) * n);
  return { x: clamp(x, 0, n - 1), y: clamp(y, 0, n - 1), z };
}

async function decodeImageDimensions(sharpLib, buffer) {
  if (!sharpLib || !buffer) return false;
  try {
    const meta = await sharpLib(buffer).metadata();
    return Number(meta.width) > 0 && Number(meta.height) > 0;
  } catch {
    return false;
  }
}

async function fetchTile(z, x, y, options = {}) {
  const sharpLib = options.sharpLib;
  const retries = Number(options.retries ?? 2);
  const sources = [
    `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  ];

  for (const source of sources) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await fetch(source, {
          headers: { 'user-agent': USER_AGENT, accept: 'image/*,*/*;q=0.8' }
        });
        if (!res.ok) continue;
        const buffer = Buffer.from(await res.arrayBuffer());
        if (!buffer.length) continue;
        const contentType = String(res.headers.get('content-type') || '').toLowerCase();
        const isImageType = contentType.includes('image/');
        const decodable = await decodeImageDimensions(sharpLib, buffer);
        if (isImageType || decodable) {
          return { ok: true, buffer, source, status: res.status, z, x, y };
        }
      } catch {
        // retry/fallback source
      }
    }
  }

  // zoom fallback for provider saturation: one level lower zoom
  if (z > 16) {
    const parent = await fetchTile(z - 1, Math.floor(x / 2), Math.floor(y / 2), { ...options, retries: 1 });
    if (parent?.ok) return { ...parent, z: z - 1, parentFallback: true };
  }

  return { ok: false, buffer: null, z, x, y };
}

function makeFallbackTile() {
  const rgba = Buffer.alloc(TILE_SIZE * TILE_SIZE * 4);
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const i = (y * TILE_SIZE + x) * 4;
      const base = 70 + Math.floor((x / TILE_SIZE) * 90);
      const green = 80 + Math.floor((y / TILE_SIZE) * 80);
      rgba[i] = base;
      rgba[i + 1] = green;
      rgba[i + 2] = 60;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

async function fetchTileGrid(lat, lng, zoom, options = {}) {
  const sharpLib = options.sharpLib;
  const center = latLngToTile(lat, lng, zoom);
  const offset = Math.floor(GRID_SIZE / 2);
  const tiles = [];

  for (let gy = 0; gy < GRID_SIZE; gy += 1) {
    for (let gx = 0; gx < GRID_SIZE; gx += 1) {
      const tx = center.x + gx - offset;
      const ty = center.y + gy - offset;
      const tile = await fetchTile(center.z, tx, ty, options);
      tiles.push({
        gx,
        gy,
        tx,
        ty,
        ...tile
      });
    }
  }

  return { center, tiles };
}

async function mergeTiles(tiles, sharpLib) {
  if (!sharpLib) throw new Error('sharp is required for tile merge');
  const side = TILE_SIZE * GRID_SIZE;
  const composites = [];

  for (const tile of tiles) {
    const left = tile.gx * TILE_SIZE;
    const top = tile.gy * TILE_SIZE;
    if (tile.ok && tile.buffer?.length) {
      composites.push({ input: tile.buffer, left, top });
    } else {
      composites.push({
        input: makeFallbackTile(),
        raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 4 },
        left,
        top
      });
    }
  }

  const image = sharpLib({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    }
  }).composite(composites);

  const pngBuffer = await image.png().toBuffer();
  const { data, info } = await sharpLib(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { pngBuffer, rgbaBuffer: data, width: info.width, height: info.height };
}

async function fetchAutoImagery(googleMapsUrl) {
  let sharpLib;
  try {
    // optional runtime dependency
    // eslint-disable-next-line global-require
    sharpLib = require('sharp');
  } catch {
    throw new Error('sharp is required for tile merging in auto-imagery');
  }

  const parsed = parseGoogleMapsUrl(googleMapsUrl);
  const tileZoom = clamp(Math.round((parsed.zoom || 17) - 1), 16, 18);
  const { tiles } = await fetchTileGrid(parsed.lat, parsed.lng, tileZoom, { sharpLib, retries: 2 });

  const merged = await mergeTiles(tiles, sharpLib);
  const hadRemoteTile = tiles.some((t) => t.ok);
  return {
    buffer: merged.pngBuffer,
    rgbaBuffer: merged.rgbaBuffer,
    width: merged.width,
    height: merged.height,
    lat: parsed.lat,
    lng: parsed.lng,
    zoom: parsed.zoom,
    tileZoom,
    fallback: !hadRemoteTile
  };
}

module.exports = {
  TILE_SIZE,
  GRID_SIZE,
  parseGoogleMapsUrl,
  parseGoogleMapsLink: parseGoogleMapsUrl,
  latLngToTile,
  lngLatToTile: (lng, lat, zoom) => latLngToTile(lat, lng, zoom),
  fetchTile,
  fetchTileGrid,
  mergeTiles,
  fetchAutoImagery
};
