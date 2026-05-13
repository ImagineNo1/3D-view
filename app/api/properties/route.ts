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
  if (payload.latitude !== undefined && (Number(payload.latitude) < -90 || Number(payload.latitude) > 90)) return 'Latitude must be between -90 and 90';
  if (payload.longitude !== undefined && (Number(payload.longitude) < -180 || Number(payload.longitude) > 180)) return 'Longitude must be between -180 and 180';
  if (payload.modelUrl?.trim() && !/\.(glb|gltf)(?:$|[?#])/i.test(payload.modelUrl.trim())) return 'Model URL must point to a .glb or .gltf file';
  const positiveValues = [payload.buildingArea, payload.buildingHeight, payload.floorHeight, payload.footprintWidth, payload.footprintDepth, payload.cameraAltitude, payload.cameraRange];
  if (positiveValues.some((value) => value !== undefined && Number(value) <= 0)) return 'Dimensions and camera distances must be positive';
  if (payload.floorCount !== undefined && (!Number.isInteger(Number(payload.floorCount)) || Number(payload.floorCount) < 1)) return 'Floors must be a positive integer';
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
    const latitude = normalizeOptionalNumber(payload.latitude) ?? mapsCoordinates?.lat;
    const longitude = normalizeOptionalNumber(payload.longitude) ?? mapsCoordinates?.lng;

    const baseSlug = createBaseSlug(payload.title!);
    const slug = appendSlugSuffix(baseSlug || 'property');
    const publicUrl = `${getBaseUrl()}/property/${slug}`;
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
      modelUrl: payload.modelUrl?.trim(),
      footprintWidth: normalizeOptionalNumber(payload.footprintWidth),
      footprintDepth: normalizeOptionalNumber(payload.footprintDepth),
      buildingAppearance: payload.buildingAppearance ?? undefined,
      siteContext: payload.siteContext ?? undefined,
      aerialContext: payload.aerialContext ?? undefined,
      realFacadeTextures: payload.realFacadeTextures ?? undefined,
      viewerRealismMode: payload.viewerRealismMode ?? undefined,
      latitude,
      longitude,
      viewerMode: payload.viewerMode ?? (payload.modelUrl ? 'standalone_model' : 'parametric_fallback'),
      cameraAltitude: normalizeOptionalNumber(payload.cameraAltitude) ?? 300,
      cameraTilt: normalizeOptionalNumber(payload.cameraTilt) ?? 65,
      cameraHeading: normalizeOptionalNumber(payload.cameraHeading) ?? 0,
      cameraRange: normalizeOptionalNumber(payload.cameraRange) ?? 300,
      slug,
      qrCodeDataUrl,
      publicUrl
    });

    return NextResponse.json(property, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }
}
