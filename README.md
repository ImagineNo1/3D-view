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

## Admin setup (manual one-time)

1. Set env:
   - `MONGODB_URI`
   - `AUTH_SECRET`
2. Generate hash in Node REPL:

```js
const crypto = require('crypto');
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync('YOUR_PASSWORD', salt, 64).toString('hex');
console.log(`${salt}:${hash}`);
```

3. Insert a single admin user in MongoDB:

```json
{
  "email": "admin@example.com",
  "passwordHash": "<salt:hash>",
  "role": "admin"
}
```

Then login at `/admin/login`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
