const path = require('node:path');
const fs = require('node:fs/promises');
const express = require('express');
const { fetchCityImagery } = require('./imagery');
const { extractBuildings } = require('./segmentation');
const { addSyntheticBuildings } = require('./urban-generator');
const { generateTerrain } = require('./terrain');
const { transformToWorld } = require('./geo');

const PORT = Number(process.env.PORT || 5050);
const app = express();
const memoryAssets = new Map();
let latestDebug = {
  imagery: { ok: false, resolution: null, noiseFallback: true },
  segmentation: { detected: 0 },
  syntheticBuildings: { added: 0 },
  terrain: { generated: false },
  totalBuildings: 0,
  errors: []
};

app.use(express.json({ limit: '15mb' }));

function setAsset(name, value, contentType) {
  memoryAssets.set(name, { value, contentType });
}

function parseGoogleMapsURL(url) {
  try {
    const decoded = decodeURIComponent(url || '');
    const m = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)z/);
    if (m) return { lat: Number(m[1]), lon: Number(m[2]), zoom: Math.round(Number(m[3])) };
    const u = new URL(decoded);
    const q = u.searchParams.get('q') || u.searchParams.get('query') || '';
    const qm = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (qm) return { lat: Number(qm[1]), lon: Number(qm[2]), zoom: Number(u.searchParams.get('z') || 17) };
  } catch {
    // ignore
  }
  return { lat: 40.7128, lon: -74.006, zoom: 17 };
}

app.get('/viewer-assets/:name', (req, res) => {
  const asset = memoryAssets.get(req.params.name);
  if (!asset) return res.status(404).json({ error: 'missing asset' });
  res.type(asset.contentType).send(asset.value);
});

app.post('/api/reconstruct', async (req, res) => {
  const errors = [];
  try {
    const { googleMapsUrl } = req.body || {};
    const { lat, lon, zoom } = parseGoogleMapsURL(googleMapsUrl);

    let imagery;
    try {
      imagery = await fetchCityImagery(lat, lon, zoom);
    } catch (err) {
      errors.push(`imagery: ${err.message || err}`);
      imagery = await fetchCityImagery(40.7128, -74.006, 17);
    }

    let segmented;
    try {
      segmented = extractBuildings({ buffer: imagery.buffer, width: imagery.width, height: imagery.height });
    } catch (err) {
      errors.push(`segmentation: ${err.message || err}`);
      segmented = { buildings: [] };
    }

    const initialDetected = segmented.buildings.length;
    let cityBuildings = segmented.buildings;
    let syntheticAdded = 0;
    if (cityBuildings.length < 30) {
      const densified = addSyntheticBuildings(cityBuildings, imagery.width, imagery.height, imagery.pixelSizeMeters);
      cityBuildings = densified.buildings;
      syntheticAdded = densified.added;
    }
    if (cityBuildings.length < 80) {
      const densifiedAgain = addSyntheticBuildings(cityBuildings, imagery.width, imagery.height, imagery.pixelSizeMeters);
      cityBuildings = densifiedAgain.buildings;
      syntheticAdded += densifiedAgain.added;
    }

    const terrain = generateTerrain({
      buffer: imagery.buffer,
      width: imagery.width,
      height: imagery.height,
      pixelSizeMeters: imagery.pixelSizeMeters
    });

    const world = transformToWorld({
      buildings: cityBuildings,
      terrain,
      width: imagery.width,
      height: imagery.height,
      pixelSizeMeters: imagery.pixelSizeMeters
    });

    const scene = {
      mapCenter: { lat, lon, zoom },
      imagery: {
        path: '/viewer-assets/imagery.rgba',
        width: imagery.width,
        height: imagery.height,
        pixelSizeMeters: imagery.pixelSizeMeters
      },
      terrain: {
        width: terrain.width,
        height: terrain.height,
        scaleMeters: terrain.scaleMeters,
        heightmap: Array.from(terrain.heightmap)
      },
      buildings: world.buildings,
      roads: [],
      environment: { sky: true, lights: true, ground: true }
    };

    setAsset('imagery.rgba', imagery.buffer, 'application/octet-stream');
    setAsset('scene.json', JSON.stringify(scene), 'application/json');
    await fs.writeFile('/tmp/scene.json', JSON.stringify(scene));

    latestDebug = {
      imagery: { ok: true, resolution: [imagery.width, imagery.height], noiseFallback: imagery.noiseFallback },
      segmentation: { detected: initialDetected },
      syntheticBuildings: { added: syntheticAdded },
      terrain: { generated: true },
      totalBuildings: world.buildings.length,
      errors
    };

    res.json({ ok: true, scenePath: '/viewer-assets/scene.json', totalBuildings: world.buildings.length });
  } catch (err) {
    errors.push(err.message || String(err));
    latestDebug = {
      imagery: { ok: false, resolution: [1280, 1280], noiseFallback: true },
      segmentation: { detected: 0 },
      syntheticBuildings: { added: 0 },
      terrain: { generated: false },
      totalBuildings: 0,
      errors
    };
    res.status(500).json({ ok: false, error: err.message || 'failed' });
  }
});

app.get('/api/debug-report', (_req, res) => {
  res.json(latestDebug);
});

app.get('/viewer.html', async (_req, res) => {
  const html = await fs.readFile(path.join(__dirname, 'viewer.html'), 'utf8');
  res.type('html').send(html);
});

app.get('/viewer.js', async (_req, res) => {
  const js = await fs.readFile(path.join(__dirname, 'viewer.js'), 'utf8');
  res.type('application/javascript').send(js);
});

app.get('/textures.js', async (_req, res) => {
  const js = await fs.readFile(path.join(__dirname, 'textures.js'), 'utf8');
  res.type('application/javascript').send(js);
});

app.listen(PORT, () => {
  console.log(`Auto reconstruction server running on http://localhost:${PORT}`);
});
