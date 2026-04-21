const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAx0lEQVR4nO3ZQQrCMBRA0US8/5Xui4jgNiWjP4UKfVJr9eMS4z8SeV2X1f0/4D8G2A2wG2A3wG6A3QC7AXYD7AbYDbAbYDfAboDdALsBdgPsBtgNsBtgN8BugN0AuwF2A+wG2A2wG2A3wG6A3QC7AXYD7AbYDbAbYDfAboDdALsBdgPsBtgNsBtgN8BugN0AuwF2A+wG2A2wG2A3wG6A3QC7AXYD7AbYDbAbYDfAboDdALsB9gGxk0sG0U6PjQAAAABJRU5ErkJggg==';

const GOOGLE_URL_RE = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)z/;

function parseGoogleMapsURL(url) {
  try {
    const decoded = decodeURIComponent(url || '');
    const atMatch = decoded.match(GOOGLE_URL_RE);
    if (atMatch) {
      return {
        lat: Number(atMatch[1]),
        lng: Number(atMatch[2]),
        zoom: Math.round(Number(atMatch[3])) || 18
      };
    }

    const u = new URL(decoded);
    const q = u.searchParams.get('q') || u.searchParams.get('query') || '';
    const qMatch = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    const z = Number(u.searchParams.get('z') || 18);
    if (qMatch) {
      return {
        lat: Number(qMatch[1]),
        lng: Number(qMatch[2]),
        zoom: Number.isFinite(z) ? Math.round(z) : 18
      };
    }
  } catch {
    // ignored intentionally
  }

  return { lat: 0, lng: 0, zoom: 2 };
}

function lngLatToTile(lng, lat, zoom) {
  const safeZoom = Math.max(1, Math.min(19, Math.round(zoom || 18)));
  const latClamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const latRad = (latClamped * Math.PI) / 180;
  const n = 2 ** safeZoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
    z: safeZoom
  };
}

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'auto-reconstruct/1.0 (+vercel)'
    }
  });
  if (!res.ok) throw new Error(`Failed request ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function tryTileProviders(center) {
  const tile = lngLatToTile(center.lng, center.lat, Math.min(center.zoom || 18, 18));
  const providers = [
    {
      mode: 'esri',
      url: `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`
    },
    {
      mode: 'osm',
      url: `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`
    }
  ];

  const errors = [];
  for (const provider of providers) {
    try {
      const buffer = await fetchBuffer(provider.url);
      return {
        ok: true,
        mode: provider.mode,
        providerURL: provider.url,
        width: 256,
        height: 256,
        buffer
      };
    } catch (err) {
      errors.push({ provider: provider.mode, message: err.message || String(err) });
    }
  }

  return {
    ok: false,
    mode: 'placeholder',
    providerURL: null,
    width: 64,
    height: 64,
    buffer: Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64'),
    errors
  };
}

async function fetchSatelliteFromGoogleMapsURL(googleMapsUrl, _opts = {}) {
  const center = parseGoogleMapsURL(googleMapsUrl);
  const result = await tryTileProviders(center);

  return {
    mode: result.mode,
    providerURL: result.providerURL,
    imagePath: null,
    center,
    width: result.width,
    height: result.height,
    buffer: result.buffer,
    errors: result.errors || []
  };
}

module.exports = {
  parseGoogleMapsURL,
  lngLatToTile,
  fetchSatelliteFromGoogleMapsURL
};
