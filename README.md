# Property 3D Viewer MVP

Production-ready MVP built with **Next.js App Router**, **TypeScript**, **MongoDB + Mongoose**, **TailwindCSS**, **Three.js**, and **QR code generation**.

## Features

- Admin dashboard (`/admin`)
  - Create properties
  - Enter image URLs (supports drag/drop text)
  - Enter GLB/GLTF model URL
  - View property list
  - Copy public link
  - Download QR code
  - Delete property
- Public property page (`/property/[slug]`)
  - Title / description / location
  - Image gallery
  - Interactive 3D model viewer (rotate/zoom/pan)
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
│   └── ThreeModelViewer.tsx
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
