import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { requireAdminSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Property from '@/models/Property';
import { parseGoogleMapsUrl } from '@/lib/maps';
import { appendSlugSuffix, createBaseSlug } from '@/lib/slug';
import { getBaseUrl } from '@/lib/url';
import type { PropertyPayload } from '@/types/property';

function validatePayload(payload: Partial<PropertyPayload>) {
  if (!payload.title?.trim()) return 'Title is required';
  if (!payload.description?.trim()) return 'Description is required';
  if (!payload.images || !Array.isArray(payload.images.gallery) || !Array.isArray(payload.images.aerial)) return 'Invalid images payload';
  return null;
}

function normalizeOptionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await connectToDatabase();
    const properties = await Property.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json(properties);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const payload = (await request.json()) as Partial<PropertyPayload>;
    const validationError = validatePayload(payload);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    await connectToDatabase();

    const mapsCoordinates = payload.googleMapsUrl ? parseGoogleMapsUrl(payload.googleMapsUrl) : null;
    const latitude = mapsCoordinates?.lat;
    const longitude = mapsCoordinates?.lng;

    const baseSlug = createBaseSlug(payload.title!);
    const slug = appendSlugSuffix(baseSlug || 'property');
    const encodedMapUrl = encodeURIComponent(payload.googleMapsUrl?.trim() || '');
    const publicUrl = `${getBaseUrl()}/?mapUrl=${encodedMapUrl}`;
    const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, { width: 300, margin: 2 });

    const property = await Property.create({
      title: payload.title!.trim(),
      description: payload.description!.trim(),
      googleMapsUrl: payload.googleMapsUrl?.trim(),
      images: {
        gallery: payload.images?.gallery?.map((url) => url.trim()).filter(Boolean) ?? [],
        aerial: payload.images?.aerial?.map((url) => url.trim()).filter(Boolean) ?? []
      },
      buildingArea: normalizeOptionalNumber(payload.buildingArea),
      buildingHeight: normalizeOptionalNumber(payload.buildingHeight),
      floorCount: normalizeOptionalNumber(payload.floorCount),
      floorHeight: normalizeOptionalNumber(payload.floorHeight),
      rotation: normalizeOptionalNumber(payload.rotation),
      latitude,
      longitude,
      slug,
      qrCodeDataUrl,
      publicUrl
    });

    return NextResponse.json(property, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }
}
