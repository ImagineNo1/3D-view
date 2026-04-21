const TILE_SIZE = 256;
const GRID_SIZE = 5;
const CANVAS_SIZE = TILE_SIZE * GRID_SIZE;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lngLatToTile(lng, lat, z) {
  const n = 2 ** z;
  const latRad = (clamp(lat, -85.05112878, 85.05112878) * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2 * n);
  return { x: clamp(x, 0, n - 1), y: clamp(y, 0, n - 1) };
}

function tileToLngLat(x, y, z) {
  const n = 2 ** z;
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return { lat: (latRad * 180) / Math.PI, lng };
}

function metersPerPixel(lat, zoom) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / (2 ** zoom);
}

function noise2D(x, y, seed = 1337) {
  const n = Math.sin((x * 127.1 + y * 311.7 + seed) * 0.0174533) * 43758.5453;
  return n - Math.floor(n);
}

function fbm(x, y, octaves = 5) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i += 1) {
    value += amplitude * noise2D(x * frequency, y * frequency, 997 + i * 31);
    frequency *= 2;
    amplitude *= 0.5;
  }
  return value;
}

function generateProceduralAerial(width = CANVAS_SIZE, height = CANVAS_SIZE) {
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const n1 = fbm(x / 80, y / 80, 5);
      const n2 = fbm(x / 25, y / 25, 4);
      const vegMask = fbm(x / 150 + 30, y / 150 + 90, 3);
      const roadLine = Math.abs(Math.sin((x * 0.02) + n2 * 2.4)) < 0.03 || Math.abs(Math.cos((y * 0.018) + n1 * 2.2)) < 0.03;

      let r = 60 + n1 * 90;
      let g = 75 + n1 * 95;
      let b = 65 + n1 * 70;

      if (vegMask > 0.58) {
        r = 45 + n2 * 40;
        g = 95 + n2 * 80;
        b = 40 + n2 * 30;
      }

      if (n2 > 0.73 && vegMask < 0.55) {
        r = 120 + n1 * 50;
        g = 110 + n1 * 40;
        b = 105 + n1 * 35;
      }

      if (roadLine) {
        r = g = b = 85 + n1 * 20;
      }

      rgba[i] = Math.round(clamp(r, 0, 255));
      rgba[i + 1] = Math.round(clamp(g, 0, 255));
      rgba[i + 2] = Math.round(clamp(b, 0, 255));
      rgba[i + 3] = 255;
    }
  }

  return {
    buffer: rgba,
    width,
    height,
    noiseFallback: true
  };
}

async function fetchCityImagery(lat, lon, zoom = 17) {
  const z = clamp(Math.round(zoom), 14, 20);
  const centerTile = lngLatToTile(lon, lat, z);
  const startX = centerTile.x - 2;
  const startY = centerTile.y - 2;

  try {
    const sharp = require('sharp');
    const composites = [];

    for (let gy = 0; gy < GRID_SIZE; gy += 1) {
      for (let gx = 0; gx < GRID_SIZE; gx += 1) {
        const tx = startX + gx;
        const ty = startY + gy;
        const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`tile ${tx},${ty} failed: ${res.status}`);
        const tileBuf = Buffer.from(await res.arrayBuffer());
        composites.push({ input: tileBuf, left: gx * TILE_SIZE, top: gy * TILE_SIZE });
      }
    }

    const stitched = sharp({
      create: {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      }
    }).composite(composites);

    const { data, info } = await stitched.raw().toBuffer({ resolveWithObject: true });
    const centerLL = tileToLngLat(centerTile.x + 0.5, centerTile.y + 0.5, z);

    return {
      ok: true,
      buffer: data,
      width: info.width,
      height: info.height,
      pixelSizeMeters: metersPerPixel(centerLL.lat, z),
      tileCenterLat: centerLL.lat,
      tileCenterLon: centerLL.lng,
      zoom: z,
      noiseFallback: false
    };
  } catch (err) {
    const procedural = generateProceduralAerial();
    return {
      ok: true,
      buffer: procedural.buffer,
      width: procedural.width,
      height: procedural.height,
      pixelSizeMeters: metersPerPixel(lat, z),
      tileCenterLat: lat,
      tileCenterLon: lon,
      zoom: z,
      noiseFallback: true,
      error: err.message || String(err)
    };
  }
}

module.exports = {
  fetchCityImagery,
  metersPerPixel
};
