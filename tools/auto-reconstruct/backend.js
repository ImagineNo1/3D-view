const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const express = require('express');
const { fetchSatelliteFromGoogleMapsURL } = require('./imagery');

const PORT = Number(process.env.PORT || 5050);
const app = express();

const memoryAssets = new Map();

app.use(express.json({ limit: '6mb' }));

function setAsset(name, buffer, contentType = 'application/octet-stream') {
  memoryAssets.set(name, { buffer: Buffer.from(buffer), contentType, updatedAt: Date.now() });
}

async function safeWriteTmp(filePath, content) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
    return true;
  } catch {
    return false;
  }
}

function fallbackGeometry() {
  const poly = [
    [64, 64],
    [192, 64],
    [192, 192],
    [64, 192],
    [64, 64]
  ];
  return {
    footprints: [{ id: 0, polygon: poly }],
    roads: [{ id: 0, polygon: [[0, 120], [256, 120], [256, 136], [0, 136], [0, 120]] }],
    footprints_with_height: [{ id: 0, polygon: poly, height_m: 18 }],
    meta: { imageWidth: 256, imageHeight: 256 }
  };
}

function runPythonSegmentation({ imageBuffer, outputDir }) {
  return new Promise((resolve) => {
    const proc = spawn('python3', [
      path.join(__dirname, 'segmentation.py'),
      '--image-base64', imageBuffer.toString('base64'),
      '--output-dir', outputDir,
      '--json-stdout'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({ ok: false, error: `segmentation exit=${code}`, stderr, stdout, payload: fallbackGeometry() });
        return;
      }
      try {
        const payload = JSON.parse(stdout.trim() || '{}');
        resolve({ ok: Boolean(payload.ok), stderr, stdout, payload });
      } catch (err) {
        resolve({ ok: false, error: err.message, stderr, stdout, payload: fallbackGeometry() });
      }
    });
  });
}

app.get('/viewer-assets/:name', (req, res) => {
  const asset = memoryAssets.get(req.params.name);
  if (!asset) {
    res.status(404).json({ error: `asset not found: ${req.params.name}` });
    return;
  }
  res.type(asset.contentType).send(asset.buffer);
});

app.post('/api/reconstruct', async (req, res) => {
  try {
    const { googleMapsUrl, mainBuilding } = req.body || {};
    const outputDir = process.env.VERCEL ? '/tmp/auto-reconstruct' : path.join(process.cwd(), 'tools/auto-reconstruct/output');

    const imageResult = await fetchSatelliteFromGoogleMapsURL(googleMapsUrl || '');
    const imageBuffer = imageResult.buffer && imageResult.buffer.length
      ? imageResult.buffer
      : Buffer.from('');

    const segmentationResult = imageBuffer.length
      ? await runPythonSegmentation({ imageBuffer, outputDir })
      : { ok: false, payload: fallbackGeometry(), error: 'empty imagery buffer' };

    const geo = segmentationResult.payload && segmentationResult.payload.footprints_with_height?.length
      ? segmentationResult.payload
      : fallbackGeometry();

    setAsset('satellite.png', imageBuffer.length ? imageBuffer : Buffer.from(''), 'image/png');
    setAsset('footprints.json', Buffer.from(JSON.stringify(geo.footprints || [], null, 2)), 'application/json');
    setAsset('roads.json', Buffer.from(JSON.stringify(geo.roads || [], null, 2)), 'application/json');
    setAsset('footprints_with_height.json', Buffer.from(JSON.stringify(geo.footprints_with_height || [], null, 2)), 'application/json');

    const sceneConfig = {
      safeMode: true,
      mapCenter: imageResult.center,
      satellitePath: '/viewer-assets/satellite.png',
      footprintsPath: '/viewer-assets/footprints_with_height.json',
      roadsPath: '/viewer-assets/roads.json',
      mainBuilding: mainBuilding || null
    };

    const sceneText = JSON.stringify(sceneConfig, null, 2);
    setAsset('scene.json', Buffer.from(sceneText), 'application/json');
    await safeWriteTmp(path.join(outputDir, 'scene.json'), sceneText);

    res.json({
      ok: true,
      sceneConfig,
      diagnostics: {
        imageryMode: imageResult.mode,
        imageryErrors: imageResult.errors || [],
        segmentationOk: segmentationResult.ok,
        segmentationError: segmentationResult.error || null
      },
      viewerURL: '/viewer.html'
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'reconstruction failed' });
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
  console.log(`Auto reconstruction server running on http://localhost:${PORT}`);
});
