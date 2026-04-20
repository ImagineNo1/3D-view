# Property 3D Viewer MVP

Production-ready MVP built with **Next.js App Router**, **TypeScript**, **MongoDB + Mongoose**, **TailwindCSS**, **Three.js**, and **QR code generation**.

## Features

- Admin dashboard (`/admin`)
  - Create properties
  - Enter image URLs (supports drag/drop text)
  - Enter unlimited image URLs
  - Add optional satellite image URL and Google Maps URL
  - View property list
  - Copy public link
  - Download QR code
  - Delete property
- Public property page (`/property/[slug]`)
  - Title / description / location
  - Image gallery
  - Fake 3D terrain viewer based on satellite texture (rotate/zoom/pan)
  - Google Maps embed + open link
  - QR code display + download
- Backend APIs
  - `POST /api/properties`
  - `GET /api/properties`
  - `GET /api/properties/[slug]`
  - `DELETE /api/properties/[slug]` (bonus)

## Project structure

```text
.
├── app/
│   ├── admin/page.tsx
│   ├── api/properties/route.ts
│   ├── api/properties/[slug]/route.ts
│   ├── property/[slug]/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   ├── not-found.tsx
│   └── page.tsx
├── components/
│   ├── ImageGallery.tsx
│   ├── ImageUrlInput.tsx
│   ├── PropertyForm.tsx
│   ├── PropertyList.tsx
│   ├── ThreeViewer.tsx
│   ├── MapEmbed.tsx
│   └── CopyLinkButton.tsx
├── lib/
│   ├── mongodb.ts
│   ├── slug.ts
│   └── url.ts
├── models/Property.ts
├── types/property.ts
├── .env.example
└── package.json
```

## Environment variables

Create `.env.local`:

```bash
cp .env.example .env.local
```

Set:

```env
MONGODB_URI=mongodb://localhost:27017/property_mvp
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start dev server:
   ```bash
   npm run dev
   ```
3. Open:
   - `http://localhost:3000/admin` (admin)
   - `http://localhost:3000/property/[slug]` (public)

## Notes

- Ensure model URLs are publicly accessible and CORS-enabled.
- QR codes are generated as base64 image data and stored on each property.


## Example boundary + hotspots payload

```json
{
  "boundary": [
    {"lat": 25.1973, "lng": 55.2744},
    {"lat": 25.1977, "lng": 55.2750},
    {"lat": 25.1969, "lng": 55.2753}
  ],
  "hotspots": [
    {"label": "Entrance", "description": "Main gate", "x": -2.3, "y": 1.8},
    {"label": "Clubhouse", "description": "Amenities zone", "x": 1.2, "y": -0.9}
  ]
}
```
