# Estate3D SaaS

Production-ready Next.js App Router + MongoDB platform for 3D real estate showcases with secure admin workflows.

## Implemented in this upgrade

- Secure admin auth with hashed password (`scrypt`), signed HTTP-only session cookie, and route middleware protection.
- Single-admin model (`User` with role `admin`) for manual DB insertion.
- SaaS-style admin dashboard with sidebar, top panel, property table, and create/edit/delete flows.
- Multipart file upload API (`/api/upload`) with validation and local storage in `/public/uploads/{gallery|aerial}`.
- Structured property model:
  - `images: { gallery: string[], aerial: string[] }`
  - `hotspots[]`
  - `boundary[]`
  - `googleMapsUrl` with auto lat/lng extraction.
- Public property detail page with:
  - hero
  - Three.js 3D viewer using aerial image texture
  - hotspot + boundary overlay
  - gallery modal
  - map embed
  - QR display + download.
- i18n foundation for English + Persian (RTL) with persistent language switcher.

## Admin setup

1. Set env:
   - `MONGODB_URI`
   - `AUTH_SECRET`
2. On the first admin login request, if there are no users in MongoDB, the app auto-creates this default admin:
   - `email`: `mohammadrezvani2002@gmail.com`
   - `password`: `110682`

Then login at `/admin/login` and change the credentials in DB if needed.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`

## Automatic GIS + CV Urban Reconstruction (Google Maps URL input)

Implemented files:
- `tools/auto-reconstruct/backend.js`
- `tools/auto-reconstruct/imagery.js`
- `tools/auto-reconstruct/segmentation.py`
- `tools/auto-reconstruct/geo.js`
- `tools/auto-reconstruct/viewer.html`
- `tools/auto-reconstruct/viewer.js`

### Run locally

1. Install dependencies:
   - `npm install express canvas`
   - `python3 -m pip install opencv-python numpy`
2. Set env var:
   - `export GOOGLE_MAPS_API_KEY=your_key_here`
3. Start reconstruction backend:
   - `node tools/auto-reconstruct/backend.js`
4. POST one input (`googleMapsUrl`) to generate outputs:
   - `curl -X POST http://localhost:5050/api/reconstruct -H 'content-type: application/json' -d '{"googleMapsUrl":"https://www.google.com/maps/place/...@35.7454902,51.4024507,18z/"}'`
5. Open viewer:
   - `http://localhost:5050/viewer.html`

Generated outputs are written under `tools/auto-reconstruct/output/`:
- `satellite.png`
- `footprints.json`
- `roads.json`
- `footprints_with_height.json`
- `scene.json`

## 3D real-estate viewer architecture

The public QR property page uses a layered viewer so the page never depends on a single 3D provider:

- **Real-world digital twin** (`real_world_digital_twin`): tries to load a Google photorealistic 3D map context when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is configured, flies to the saved latitude/longitude, adds a property marker, and attempts a model overlay when `modelUrl` is available.
- **Standalone uploaded model** (`standalone_model`): loads a public `.glb` or `.gltf` URL in the internal Three.js viewer, centers it, and scales it against the property dimensions.
- **Generated building fallback** (`parametric_fallback`): creates a textured procedural building from footprint width/depth, height, floors, floor height, rotation, facade images, and optional aerial ground image.

Required optional environment variables:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_CESIUM_ION_TOKEN=
```

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` enables the real-world 3D context. `NEXT_PUBLIC_CESIUM_ION_TOKEN` is reserved for a Cesium Ion deployment path; if provider keys, coverage, or bundles are unavailable, the app automatically falls back to the internal Three.js viewer.

Known limitations:

- A Google Maps URL or latitude/longitude alone cannot generate an exact 3D model of a specific building.
- Real-world city 3D depends on provider coverage, browser support, and API configuration.
- Best property-specific accuracy requires a custom GLB/GLTF model or a high-quality reconstruction source.
