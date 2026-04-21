const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const express = require('express');
const { fetchAutoImagery, parseGoogleMapsLink } = require('./imagery');
const { extractBuildings } = require('./segmentation');
const { buildSceneGeometry } = require('./geo');

const PORT = Number(process.env.PORT || 5050);
const TMP_DIR = '/tmp/auto-reconstruct';
const app = express();
const memoryAssets = new Map();

app.use(express.json({ limit: '20mb' }));

function setAsset(name, value, contentType) {
  memoryAssets.set(name, { value, contentType });
}

function createProceduralNoiseHeightmap(width, height) {
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

async function generateHeightmapFromImagery(rgbaBuffer, width, height) {
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

  let sharpLib;
  try {
    // eslint-disable-next-line global-require
    sharpLib = require('sharp');
  } catch {
    return {
      bytes: heightmap,
      png: null,
      width,
      height,
      source: 'js-fallback-no-sharp'
    };
  }

  const png = await sharpLib(heightmap, {
    raw: { width, height, channels: 1 }
  }).png().toBuffer();

  return { bytes: heightmap, png, width, height, source: 'js' };
}

async function runPythonSegmentation(imagePath) {
  const script = path.join(__dirname, 'segmentation.py');
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [script, '--image', imagePath, '--output-dir', TMP_DIR, '--json-stdout'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`segmentation.py exit ${code}: ${stderr}`));
      const jsonLine = stdout.trim().split('\n').reverse().find((line) => line.trim().startsWith('{'));
      if (!jsonLine) return reject(new Error('segmentation.py did not return json payload'));
      try {
        resolve(JSON.parse(jsonLine));
      } catch (err) {
        reject(new Error(`segmentation.py invalid json: ${err.message}`));
      }
    });
  });
}

app.get('/viewer-assets/:name', (req, res) => {
  const asset = memoryAssets.get(req.params.name);
  if (!asset) return res.status(404).json({ error: 'asset not found' });
  return res.type(asset.contentType).send(asset.value);
});

app.post('/api/reconstruct', async (req, res) => {
  const errors = [];
  await fs.mkdir(TMP_DIR, { recursive: true });

  try {
    const { googleMapsUrl, uploadedImage } = req.body || {};
    const loc = parseGoogleMapsLink(googleMapsUrl);

    let imagery;
    if (uploadedImage) {
      const b64 = uploadedImage.includes(',') ? uploadedImage.split(',')[1] : uploadedImage;
      const imageBuffer = Buffer.from(b64, 'base64');
      const sharpLib = require('sharp'); // eslint-disable-line global-require
      const { data, info } = await sharpLib(imageBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      imagery = {
        buffer: imageBuffer,
        rgbaBuffer: data,
        width: info.width,
        height: info.height,
        fallback: false,
        lat: loc.lat,
        lng: loc.lng,
        zoom: loc.zoom
      };
    } else {
      imagery = await fetchAutoImagery(googleMapsUrl);
    }

    setAsset('satellite.png', imagery.buffer, 'image/png');
    await fs.writeFile(path.join(TMP_DIR, 'satellite.png'), imagery.buffer);

    let heightmap;
    try {
      heightmap = await generateHeightmapFromImagery(imagery.rgbaBuffer, imagery.width, imagery.height);
    } catch (err) {
      errors.push(`heightmap failed: ${err.message}`);
      const bytes = createProceduralNoiseHeightmap(imagery.width, imagery.height);
      heightmap = { bytes, width: imagery.width, height: imagery.height, png: null, source: 'procedural' };
    }

    if (heightmap.png) {
      setAsset('heightmap.png', heightmap.png, 'image/png');
      await fs.writeFile(path.join(TMP_DIR, 'heightmap.png'), heightmap.png);
    }

    let footprintPayload;
    try {
      const py = await runPythonSegmentation(path.join(TMP_DIR, 'satellite.png'));
      footprintPayload = py.footprints_with_height || py.footprints || [];
    } catch (err) {
      errors.push(`python segmentation failed: ${err.message}`);
      const js = extractBuildings({ buffer: imagery.rgbaBuffer, width: imagery.width, height: imagery.height });
      footprintPayload = js.buildings.map((b, idx) => ({
        id: idx,
        polygon: b.footprint,
        height_m: b.height,
        type: b.type
      }));
    }

    if (!Array.isArray(footprintPayload) || footprintPayload.length === 0) {
      footprintPayload = [{
        id: 0,
        polygon: [[
          imagery.width * 0.4, imagery.height * 0.4
        ], [imagery.width * 0.6, imagery.height * 0.4], [imagery.width * 0.6, imagery.height * 0.6], [imagery.width * 0.4, imagery.height * 0.6], [imagery.width * 0.4, imagery.height * 0.4]],
        height_m: 18,
        type: 'fallback'
      }];
      errors.push('footprints empty, fallback square used');
    }

    setAsset('footprints.json', JSON.stringify(footprintPayload), 'application/json');
    await fs.writeFile(path.join(TMP_DIR, 'footprints.json'), JSON.stringify(footprintPayload, null, 2));

    const geometry = buildSceneGeometry({
      footprints: footprintPayload,
      heightmapBytes: heightmap.bytes,
      heightmapWidth: heightmap.width,
      heightmapHeight: heightmap.height,
      imageWidth: imagery.width,
      imageHeight: imagery.height,
      pixelScaleMeters: 1
    });

    const scene = {
      mapCenter: { lat: loc.lat, lon: loc.lng, zoom: loc.zoom },
      imagery: { path: '/viewer-assets/satellite.png', width: imagery.width, height: imagery.height },
      heightmap: { path: '/viewer-assets/heightmap.png', width: heightmap.width, height: heightmap.height },
      terrain: geometry.terrain,
      buildings: geometry.buildings,
      diagnostics: { fallbackImagery: imagery.fallback, heightmapSource: heightmap.source, errors }
    };

    setAsset('scene.json', JSON.stringify(scene), 'application/json');
    await fs.writeFile(path.join(TMP_DIR, 'scene.json'), JSON.stringify(scene, null, 2));

    return res.json({ ok: true, assets: ['/viewer-assets/scene.json'], diagnostics: scene.diagnostics });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

app.get('/viewer.html', async (_req, res) => {
  const html = await fs.readFile(path.join(__dirname, 'viewer.html'), 'utf8');
  res.type('html').send(html);
});

app.get('/viewer.js', async (_req, res) => {
  const js = await fs.readFile(path.join(__dirname, 'viewer.js'), 'utf8');
  res.type('application/javascript').send(js);
});

app.listen(PORT, () => {
  console.log(`Auto reconstruction server running at http://localhost:${PORT}`);
});
