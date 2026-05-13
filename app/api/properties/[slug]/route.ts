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

function validatePayload(payload: Partial<PropertyPayload>) {
  if (payload.latitude !== undefined && (Number(payload.latitude) < -90 || Number(payload.latitude) > 90)) return 'Latitude must be between -90 and 90';
  if (payload.longitude !== undefined && (Number(payload.longitude) < -180 || Number(payload.longitude) > 180)) return 'Longitude must be between -180 and 180';
  if (payload.modelUrl?.trim() && !/\.(glb|gltf)(?:$|[?#])/i.test(payload.modelUrl.trim())) return 'Model URL must point to a .glb or .gltf file';
  const positiveValues = [payload.buildingArea, payload.buildingHeight, payload.floorHeight, payload.footprintWidth, payload.footprintDepth, payload.cameraAltitude, payload.cameraRange];
  if (positiveValues.some((value) => value !== undefined && Number(value) <= 0)) return 'Dimensions and camera distances must be positive';
  if (payload.floorCount !== undefined && (!Number.isInteger(Number(payload.floorCount)) || Number(payload.floorCount) < 1)) return 'Floors must be a positive integer';
  return null;
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
    const validationError = validatePayload(payload);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
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
      aerialContext: payload.aerialContext ?? undefined,
      realFacadeTextures: payload.realFacadeTextures ?? undefined,
      viewerRealismMode: payload.viewerRealismMode ?? undefined,
          latitude: normalizeOptionalNumber(payload.latitude) ?? mapsCoordinates?.lat,
          longitude: normalizeOptionalNumber(payload.longitude) ?? mapsCoordinates?.lng,
          viewerMode: payload.viewerMode ?? (payload.modelUrl ? 'standalone_model' : 'parametric_fallback'),
          cameraAltitude: normalizeOptionalNumber(payload.cameraAltitude) ?? 300,
          cameraTilt: normalizeOptionalNumber(payload.cameraTilt) ?? 65,
          cameraHeading: normalizeOptionalNumber(payload.cameraHeading) ?? 0,
          cameraRange: normalizeOptionalNumber(payload.cameraRange) ?? 300,
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
