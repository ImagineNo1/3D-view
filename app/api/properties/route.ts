import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { connectToDatabase } from '@/lib/mongodb';
import Property from '@/models/Property';
import { parseGoogleMapsUrl } from '@/lib/maps';
import { appendSlugSuffix, createBaseSlug } from '@/lib/slug';
import { getBaseUrl } from '@/lib/url';
import type { PropertyPayload } from '@/types/property';

function validatePayload(payload: Partial<PropertyPayload>) {
  if (!payload.title?.trim()) return 'Title is required';
  if (!payload.description?.trim()) return 'Description is required';
  return null;
}

function sanitizeBoundary(boundary: PropertyPayload['boundary'] | undefined) {
  return (boundary || []).filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng));
}

function sanitizeHotspots(hotspots: PropertyPayload['hotspots'] | undefined) {
  return (hotspots || []).filter(
    (item) =>
      item?.label?.trim() &&
      item?.description?.trim() &&
      Number.isFinite(item?.x) &&
      Number.isFinite(item?.y) &&
      item.x >= -10 &&
      item.x <= 10 &&
      item.y >= -10 &&
      item.y <= 10
  );
}

export async function GET() {
  try {
    await connectToDatabase();
    const properties = await Property.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json(properties);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Partial<PropertyPayload>;
    const validationError = validatePayload(payload);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    await connectToDatabase();

    const mapsCoordinates = payload.googleMapsUrl ? parseGoogleMapsUrl(payload.googleMapsUrl) : null;
    const latitude = typeof payload.latitude === 'number' ? payload.latitude : mapsCoordinates?.lat;
    const longitude = typeof payload.longitude === 'number' ? payload.longitude : mapsCoordinates?.lng;

    const baseSlug = createBaseSlug(payload.title!);
    const slug = appendSlugSuffix(baseSlug || 'property');
    const publicUrl = `${getBaseUrl()}/property/${slug}`;
    const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, { width: 300, margin: 2 });

    const property = await Property.create({
      title: payload.title!.trim(),
      description: payload.description!.trim(),
      images: (payload.images || []).map((url) => url.trim()).filter(Boolean),
      location: payload.location?.trim(),
      googleMapsUrl: payload.googleMapsUrl?.trim(),
      satelliteImageUrl: payload.satelliteImageUrl?.trim(),
      latitude,
      longitude,
      boundary: sanitizeBoundary(payload.boundary),
      hotspots: sanitizeHotspots(payload.hotspots),
      slug,
      qrCodeDataUrl,
      publicUrl
    });

    return NextResponse.json(property, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }
}
