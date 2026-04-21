const fs = require('node:fs/promises');
const path = require('node:path');

const GOOGLE_URL_RE = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)z/;

function parseGoogleMapsURL(url) {
  try {
    const decoded = decodeURIComponent(url);
    const atMatch = decoded.match(GOOGLE_URL_RE);
    if (atMatch) {
      return {
        lat: Number(atMatch[1]),
        lng: Number(atMatch[2]),
        zoom: Math.round(Number(atMatch[3])) || 19
      };
    }

    const u = new URL(decoded);
    const q = u.searchParams.get('q') || u.searchParams.get('query') || '';
    const qMatch = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    const z = Number(u.searchParams.get('z') || 19);
    if (qMatch) {
      return {
        lat: Number(qMatch[1]),
        lng: Number(qMatch[2]),
        zoom: Number.isFinite(z) ? Math.round(z) : 19
      };
    }
  } catch {
    // ignore
  }
  throw new Error('Failed to parse Google Maps URL. Expected format with @lat,lng,zoomz.');
}

function lngLatToTile(lng, lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed request ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function downloadTile({ apiKey, zoom, x, y, mapType = 'satellite', tileSize = 512 }) {
  const url = `https://tile.googleapis.com/v1/2dtiles/${zoom}/${x}/${y}?session=${encodeURIComponent(mapType)}&key=${apiKey}`;
  const raw = await fetchBuffer(url);
  if (tileSize === 512) return raw;
  return raw;
}

async function downloadStaticImage({ apiKey, lat, lng, zoom, size = 2048 }) {
  const staticUrl = new URL('https://maps.googleapis.com/maps/api/staticmap');
  staticUrl.searchParams.set('center', `${lat},${lng}`);
  staticUrl.searchParams.set('zoom', `${zoom}`);
  staticUrl.searchParams.set('size', `${size}x${size}`);
  staticUrl.searchParams.set('maptype', 'satellite');
  staticUrl.searchParams.set('scale', '2');
  staticUrl.searchParams.set('key', apiKey);
  return fetchBuffer(staticUrl.toString());
}

async function stitchTiles(tiles, outputPath) {
  const { createCanvas, loadImage } = require('canvas');
  const grid = Math.sqrt(tiles.length);
  if (!Number.isInteger(grid)) throw new Error('tiles must be square count');
  const tileImage = await loadImage(tiles[0].buffer);
  const tileW = tileImage.width;
  const tileH = tileImage.height;
  const canvas = createCanvas(tileW * grid, tileH * grid);
  const ctx = canvas.getContext('2d');

  for (const tile of tiles) {
    const img = await loadImage(tile.buffer);
    ctx.drawImage(img, tile.col * tileW, tile.row * tileH, tileW, tileH);
  }
  const out = canvas.toBuffer('image/png');
  await fs.writeFile(outputPath, out);
  return out;
}

async function saveFinalImage(buffer, outputDir) {
  const outPath = path.join(outputDir, 'satellite.png');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outPath, buffer);
  return outPath;
}

async function fetchSatelliteFromGoogleMapsURL(googleMapsUrl, { apiKey, outputDir }) {
  const center = parseGoogleMapsURL(googleMapsUrl);
  if (!apiKey) throw new Error('Google API key is required');

  if (center.zoom >= 18) {
    const centerTile = lngLatToTile(center.lng, center.lat, center.zoom);
    const radius = 2;
    const tiles = [];
    for (let row = -radius; row < radius; row += 1) {
      for (let col = -radius; col < radius; col += 1) {
        const x = centerTile.x + col;
        const y = centerTile.y + row;
        const buffer = await downloadTile({ apiKey, zoom: center.zoom, x, y });
        tiles.push({ row: row + radius, col: col + radius, buffer });
      }
    }
    const stitched = await stitchTiles(tiles, path.join(outputDir, 'satellite.png'));
    return {
      mode: 'tiles',
      imagePath: path.join(outputDir, 'satellite.png'),
      center,
      width: 8192,
      height: 8192,
      buffer: stitched
    };
  }

  const staticBuffer = await downloadStaticImage({
    apiKey,
    lat: center.lat,
    lng: center.lng,
    zoom: center.zoom
  });
  const imagePath = await saveFinalImage(staticBuffer, outputDir);
  return {
    mode: 'static',
    imagePath,
    center,
    width: 4096,
    height: 4096,
    buffer: staticBuffer
  };
}

module.exports = {
  parseGoogleMapsURL,
  downloadTile,
  stitchTiles,
  saveFinalImage,
  fetchSatelliteFromGoogleMapsURL,
  lngLatToTile
};
