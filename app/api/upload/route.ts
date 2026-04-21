import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { buildUploadedFileUrl, buildUploadStorageDir } from '@/lib/uploadStorage';

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
  const requestId = randomUUID();
  try {
    const formData = await request.formData();
    const category = formData.get('category');
    const propertyKeyRaw = String(formData.get('propertyKey') || 'general');
    const propertyKey = sanitizeKey(propertyKeyRaw);

    if (category !== 'gallery' && category !== 'aerial') {
      return NextResponse.json({ error: 'Invalid category', code: 'INVALID_CATEGORY', requestId }, { status: 400 });
    }

    const files = formData.getAll('files').filter((item): item is File => item instanceof File);
    if (!files.length) return NextResponse.json({ error: 'No files uploaded', code: 'NO_FILES', requestId }, { status: 400 });

    const uploadDir = buildUploadStorageDir(propertyKey, category);
    await mkdir(uploadDir, { recursive: true });

    const urls: string[] = [];

    for (const file of files) {
      if (!ALLOWED_MIME.has(file.type)) {
        return NextResponse.json({ error: `Unsupported file type: ${file.type}`, code: 'UNSUPPORTED_TYPE', requestId }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large (max 8MB)', code: 'FILE_TOO_LARGE', requestId }, { status: 400 });
      }

      const ext = extensionFromMime(file.type);
      const filename = `${Date.now()}-${randomUUID()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadDir, filename), buffer);
      urls.push(buildUploadedFileUrl(propertyKey, category, filename));
    }

    return NextResponse.json({
      success: true,
      fileUrl: urls[0] || null,
      urls,
      requestId
    }, { status: 201 });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error('Upload API error', { requestId, error });
    return NextResponse.json({ success: false, error: 'Upload failed', code: 'UPLOAD_EXCEPTION', details, requestId }, { status: 500 });
  }
}
