import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 8 * 1024 * 1024;

function extensionFromMime(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function sanitizeKey(input: string) {
  return input.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 64) || 'general';
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const category = formData.get('category');
    const propertyKeyRaw = String(formData.get('propertyKey') || 'general');
    const propertyKey = sanitizeKey(propertyKeyRaw);

    if (category !== 'gallery' && category !== 'aerial') {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const files = formData.getAll('files').filter((item): item is File => item instanceof File);
    if (!files.length) return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'properties', propertyKey, category);
    await mkdir(uploadDir, { recursive: true });

    const urls: string[] = [];

    for (const file of files) {
      if (!ALLOWED_MIME.has(file.type)) {
        return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 });
      }

      const ext = extensionFromMime(file.type);
      const filename = `${Date.now()}-${randomUUID()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadDir, filename), buffer);
      urls.push(`/uploads/properties/${propertyKey}/${category}/${filename}`);
    }

    return NextResponse.json({ urls });
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
