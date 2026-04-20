import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { connectToDatabase } from '@/lib/mongodb';
import Property from '@/models/Property';
import { appendSlugSuffix, createBaseSlug } from '@/lib/slug';
import { getBaseUrl } from '@/lib/url';
import type { PropertyPayload } from '@/types/property';

function validatePayload(payload: Partial<PropertyPayload>) {
  if (!payload.title?.trim()) return 'Title is required';
  if (!payload.description?.trim()) return 'Description is required';
  if (!payload.modelUrl?.trim()) return '3D model URL is required';
  return null;
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

    const baseSlug = createBaseSlug(payload.title!);
    const slug = appendSlugSuffix(baseSlug || 'property');
    const publicUrl = `${getBaseUrl()}/property/${slug}`;
    const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, { width: 300, margin: 2 });

    const property = await Property.create({
      title: payload.title!.trim(),
      description: payload.description!.trim(),
      images: (payload.images || []).filter(Boolean),
      modelUrl: payload.modelUrl!.trim(),
      location: payload.location?.trim(),
      slug,
      qrCodeDataUrl,
      publicUrl
    });

    return NextResponse.json(property, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
  }
}
