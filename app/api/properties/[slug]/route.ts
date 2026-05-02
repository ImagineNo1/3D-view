import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Property from '@/models/Property';
import type { PropertyPayload } from '@/types/property';
import { parseGoogleMapsUrl } from '@/lib/maps';
import { getBaseUrl } from '@/lib/url';

function normalizeOptionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { slug } = await params;
    await connectToDatabase();

    const property = await Property.findOne({ slug }).lean();
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    return NextResponse.json(property);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch property' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { slug } = await params;
    const payload = (await request.json()) as Partial<PropertyPayload>;
    await connectToDatabase();

    const mapsCoordinates = payload.googleMapsUrl ? parseGoogleMapsUrl(payload.googleMapsUrl) : null;

    const updated = await Property.findOneAndUpdate(
      { slug },
      {
        $set: {
          title: payload.title?.trim(),
          description: payload.description?.trim(),
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
      modelUrl: payload.modelUrl?.trim(),
      footprintWidth: normalizeOptionalNumber(payload.footprintWidth),
      footprintDepth: normalizeOptionalNumber(payload.footprintDepth),
      buildingAppearance: payload.buildingAppearance ?? undefined,
      siteContext: payload.siteContext ?? undefined,
          latitude: mapsCoordinates?.lat,
          longitude: mapsCoordinates?.lng,
          publicUrl: `${getBaseUrl()}/property/${slug}`,
        }
      },
      { new: true }
    );

    if (!updated) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { slug } = await params;
    await connectToDatabase();

    const deleted = await Property.findOneAndDelete({ slug });
    if (!deleted) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
  }
}
