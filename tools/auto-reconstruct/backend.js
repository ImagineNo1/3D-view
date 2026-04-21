const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const express = require('express');
const { fetchSatelliteFromGoogleMapsURL } = require('./imagery');

const PORT = Number(process.env.PORT || 5050);
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use('/viewer-assets', express.static(path.join(process.cwd(), 'tools/auto-reconstruct/output')));

function runPythonSegmentation({ imagePath, outputDir, lat, lng, zoom }) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [
      path.join(__dirname, 'segmentation.py'),
      '--image', imagePath,
      '--output-dir', outputDir,
      '--lat', String(lat),
      '--lng', String(lng),
      '--zoom', String(zoom)
    ]);

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
        reject(new Error(`segmentation.py failed (${code}): ${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

app.post('/api/reconstruct', async (req, res) => {
  try {
    const { googleMapsUrl, mainBuilding } = req.body || {};
    if (!googleMapsUrl) {
      res.status(400).json({ error: 'googleMapsUrl is required' });
      return;
    }

    const outputDir = path.join(process.cwd(), 'tools/auto-reconstruct/output');
    await fs.mkdir(outputDir, { recursive: true });

    const imageResult = await fetchSatelliteFromGoogleMapsURL(googleMapsUrl, {
      apiKey: GOOGLE_MAPS_API_KEY,
      outputDir
    });

    await runPythonSegmentation({
      imagePath: imageResult.imagePath,
      outputDir,
      lat: imageResult.center.lat,
      lng: imageResult.center.lng,
      zoom: imageResult.center.zoom
    });

    const sceneConfig = {
      mapCenter: imageResult.center,
      satellitePath: '/viewer-assets/satellite.png',
      footprintsPath: '/viewer-assets/footprints_with_height.json',
      roadsPath: '/viewer-assets/roads.json',
      mainBuilding: mainBuilding || null
    };

    await fs.writeFile(path.join(outputDir, 'scene.json'), JSON.stringify(sceneConfig, null, 2));

    res.json({
      ok: true,
      sceneConfig,
      viewerURL: 'http://localhost:5050/viewer.html'
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
