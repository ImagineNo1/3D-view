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

function makeFallbackTileRaw(x = 0, y = 0, z = 0) {
  const rgba = Buffer.alloc(TILE_SIZE * TILE_SIZE * 4);
  const seed = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  const phase = ((seed % 360) * Math.PI) / 180;
  for (let py = 0; py < TILE_SIZE; py += 1) {
    for (let px = 0; px < TILE_SIZE; px += 1) {
      const i = (py * TILE_SIZE + px) * 4;
      const gx = px / TILE_SIZE;
      const gy = py / TILE_SIZE;
      const ripple = Math.sin((gx * 12) + phase) * 8 + Math.cos((gy * 8) - phase) * 8;
      rgba[i] = clamp(Math.round(65 + gx * 100 + ripple), 0, 255);
      rgba[i + 1] = clamp(Math.round(70 + gy * 120 - ripple), 0, 255);
      rgba[i + 2] = clamp(Math.round(55 + ((gx + gy) * 70)), 0, 255);
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

async function makeMockTile(sharpLib, x, y, z) {
  const raw = makeFallbackTileRaw(x, y, z);
  if (!sharpLib) return { buffer: null, raw };
  const buffer = await sharpLib(raw, { raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 4 } }).png().toBuffer();
  return { buffer, raw };
}

function shouldSwitchToMock(status, errorMessage, bodyLength, isImageType, decodable) {
  if (status >= 400 && status < 500) return true;
  if (bodyLength === 0) return true;
  const err = String(errorMessage || '').toLowerCase();
  if (err.includes('connect tunnel') || err.includes('proxy') || err.includes('socket hang up') || err.includes('fetch failed') || err.includes('eai_again') || err.includes('enotfound')) return true;
  if (!isImageType && !decodable) return true;
  return false;
}

async function fetchTile(z, x, y, options = {}) {
  const sharpLib = options.sharpLib;
  const retries = Number(options.retries ?? 2);
  const forceMock = Boolean(options.forceMock);
  const modeState = options.modeState || { mode: forceMock ? 'mock' : 'live' };

  if (forceMock || modeState.mode === 'mock') {
    if (!modeState.mockAnnounced) {
      modeState.mockAnnounced = true;
      console.log('LIVE tile fetch unavailable → entering MOCK imagery mode');
    }
    const mock = await makeMockTile(sharpLib, x, y, z);
    return { ok: true, mock: true, buffer: mock.buffer, raw: mock.raw, z, x, y, mode: 'mock' };
  }

  const sources = [
    `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
  ];

  for (const source of sources) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      let status = 0;
      try {
        const res = await fetch(source, {
          headers: { 'user-agent': USER_AGENT, accept: 'image/*,*/*;q=0.8' }
        });
        status = res.status;
        const buffer = Buffer.from(await res.arrayBuffer());
        const contentType = String(res.headers.get('content-type') || '').toLowerCase();
        const isImageType = contentType.includes('image/');
        const decodable = await decodeImageDimensions(sharpLib, buffer);

        if (res.ok && buffer.length && (isImageType || decodable)) {
          modeState.liveDetected = true;
          return { ok: true, mock: false, buffer, source, status: res.status, z, x, y, mode: 'live' };
        }

        if (shouldSwitchToMock(status, '', buffer.length, isImageType, decodable)) {
          modeState.mode = 'mock';
          if (!modeState.mockAnnounced) {
            modeState.mockAnnounced = true;
            console.log('LIVE tile fetch unavailable → entering MOCK imagery mode');
          }
          const mock = await makeMockTile(sharpLib, x, y, z);
          return { ok: true, mock: true, buffer: mock.buffer, raw: mock.raw, z, x, y, mode: 'mock' };
        }
      } catch (err) {
        if (shouldSwitchToMock(status, err?.message, 0, false, false)) {
          modeState.mode = 'mock';
          if (!modeState.mockAnnounced) {
            modeState.mockAnnounced = true;
            console.log('LIVE tile fetch unavailable → entering MOCK imagery mode');
          }
          const mock = await makeMockTile(sharpLib, x, y, z);
          return { ok: true, mock: true, buffer: mock.buffer, raw: mock.raw, z, x, y, mode: 'mock' };
        }
      }
    }
  }

  if (z > 16 && !modeState.liveDetected) {
    const parent = await fetchTile(z - 1, Math.floor(x / 2), Math.floor(y / 2), { ...options, retries: 1, modeState });
    if (parent?.ok) return { ...parent, z: z - 1, parentFallback: true };
  }

  return { ok: false, buffer: null, z, x, y, mode: modeState.mode || 'live' };
}

async function fetchTileGrid(lat, lng, zoom, options = {}) {
  const center = latLngToTile(lat, lng, zoom);
  const offset = Math.floor(GRID_SIZE / 2);
  const tiles = [];
  const modeState = options.modeState || { mode: options.forceMock ? 'mock' : 'live' };

  for (let gy = 0; gy < GRID_SIZE; gy += 1) {
    for (let gx = 0; gx < GRID_SIZE; gx += 1) {
      const tx = center.x + gx - offset;
      const ty = center.y + gy - offset;
      const tile = await fetchTile(center.z, tx, ty, { ...options, modeState });
      tiles.push({ gx, gy, tx, ty, ...tile });
    }
  }

  return { center, tiles, mode: modeState.liveDetected ? 'live' : 'mock' };
}

async function mergeTiles(tiles, sharpLib) {
  if (!sharpLib) throw new Error('sharp is required for tile merge');
  const side = TILE_SIZE * GRID_SIZE;
  const composites = [];

  for (const tile of tiles) {
    const left = tile.gx * TILE_SIZE;
    const top = tile.gy * TILE_SIZE;
    if (tile.buffer?.length) {
      composites.push({ input: tile.buffer, left, top });
    } else {
      composites.push({
        input: makeFallbackTileRaw(tile.tx, tile.ty, tile.z),
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

async function fetchAutoImagery(googleMapsUrl, options = {}) {
  let sharpLib;
  try {
    // eslint-disable-next-line global-require
    sharpLib = require('sharp');
  } catch {
    throw new Error('sharp is required for tile merging in auto-imagery');
  }

  const parsed = parseGoogleMapsUrl(googleMapsUrl);
  const tileZoom = clamp(Math.round((parsed.zoom || 17) - 1), 16, 18);
  const grid = await fetchTileGrid(parsed.lat, parsed.lng, tileZoom, {
    sharpLib,
    retries: 2,
    forceMock: Boolean(options.forceMock)
  });

  const merged = await mergeTiles(grid.tiles, sharpLib);
  return {
    buffer: merged.pngBuffer,
    rgbaBuffer: merged.rgbaBuffer,
    width: merged.width,
    height: merged.height,
    lat: parsed.lat,
    lng: parsed.lng,
    zoom: parsed.zoom,
    tileZoom,
    fallback: grid.mode !== 'live',
    mode: grid.mode
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
  fetchAutoImagery,
  makeFallbackTileRaw
};
