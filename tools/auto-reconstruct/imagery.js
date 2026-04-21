const TILE_SIZE = 256;
const GRID_SIZE = 3;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseGoogleMapsLink(url) {
  const fallback = { lat: 40.7128, lng: -74.006, zoom: 17 };
  if (!url || typeof url !== 'string') return fallback;

  try {
    const decoded = decodeURIComponent(url);
    const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)z/);
    if (atMatch) {
      return {
        lat: Number(atMatch[1]),
        lng: Number(atMatch[2]),
        zoom: Math.round(Number(atMatch[3]))
      };
    }

    const parsed = new URL(decoded);
    const q = parsed.searchParams.get('q') || parsed.searchParams.get('query') || '';
    const qMatch = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (qMatch) {
      return {
        lat: Number(qMatch[1]),
        lng: Number(qMatch[2]),
        zoom: Math.round(Number(parsed.searchParams.get('z') || 17))
      };
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function lngLatToTile(lng, lat, z) {
  const n = 2 ** z;
  const latClamped = clamp(lat, -85.05112878, 85.05112878);
  const latRad = (latClamped * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2 * n);
  return { x: clamp(x, 0, n - 1), y: clamp(y, 0, n - 1) };
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

async function fetchTileWithFallback(z, x, y) {
  const esri = `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  const osm = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  try {
    const esriRes = await fetch(esri);
    if (esriRes.ok) return Buffer.from(await esriRes.arrayBuffer());
  } catch {
    // try OSM below
  }

  try {
    const osmRes = await fetch(osm);
    if (osmRes.ok) return Buffer.from(await osmRes.arrayBuffer());
  } catch {
    // fallback to procedural tile below
  }

  return null;
}

async function buildProceduralFallbackSquare(sharpLib) {
  const side = TILE_SIZE * GRID_SIZE;
  const tile = makeFallbackTile();
  const composites = [];
  for (let gy = 0; gy < GRID_SIZE; gy += 1) {
    for (let gx = 0; gx < GRID_SIZE; gx += 1) {
      composites.push({
        input: tile,
        raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 4 },
        left: gx * TILE_SIZE,
        top: gy * TILE_SIZE
      });
    }
  }

  const image = sharpLib({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: { r: 72, g: 96, b: 75, alpha: 1 }
    }
  }).composite(composites);

  const pngBuffer = await image.png().toBuffer();
  const { data, info } = await sharpLib(pngBuffer).raw().toBuffer({ resolveWithObject: true });
  return { pngBuffer, rgbaBuffer: data, width: info.width, height: info.height, fallback: true };
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

  const { lat, lng, zoom } = parseGoogleMapsLink(googleMapsUrl);
  const tileZoom = clamp(Math.round(zoom - 1), 16, 18);
  const center = lngLatToTile(lng, lat, tileZoom);
  const offset = Math.floor(GRID_SIZE / 2);

  const composites = [];
  let hadRemoteTile = false;

  for (let gy = 0; gy < GRID_SIZE; gy += 1) {
    for (let gx = 0; gx < GRID_SIZE; gx += 1) {
      const tx = center.x + gx - offset;
      const ty = center.y + gy - offset;
      const tile = await fetchTileWithFallback(tileZoom, tx, ty);

      if (tile) {
        hadRemoteTile = true;
        composites.push({ input: tile, left: gx * TILE_SIZE, top: gy * TILE_SIZE });
      } else {
        composites.push({
          input: makeFallbackTile(),
          raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 4 },
          left: gx * TILE_SIZE,
          top: gy * TILE_SIZE
        });
      }
    }
  }

  const side = TILE_SIZE * GRID_SIZE;
  try {
    const stitched = sharpLib({
      create: {
        width: side,
        height: side,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      }
    }).composite(composites);

    const pngBuffer = await stitched.png().toBuffer();
    const { data, info } = await sharpLib(pngBuffer).raw().toBuffer({ resolveWithObject: true });

    return {
      buffer: pngBuffer,
      rgbaBuffer: data,
      width: info.width,
      height: info.height,
      lat,
      lng,
      zoom,
      tileZoom,
      fallback: !hadRemoteTile
    };
  } catch {
    return buildProceduralFallbackSquare(sharpLib);
  }
}

module.exports = {
  TILE_SIZE,
  GRID_SIZE,
  parseGoogleMapsLink,
  lngLatToTile,
  fetchAutoImagery
};
