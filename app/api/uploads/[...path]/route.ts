import { access, readFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { resolveUploadFilePath } from '@/lib/uploadStorage';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

function mimeFromPath(filePath: string) {
  const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return MIME_BY_EXT[extension] || 'application/octet-stream';
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const resolvedPath = resolveUploadFilePath(path || []);

  if (!resolvedPath) {
    return NextResponse.json({ error: 'Invalid upload path' }, { status: 400 });
  }

  try {
    await access(resolvedPath);
    const file = await readFile(resolvedPath);

    return new NextResponse(file, {
      status: 200,
      headers: {
        'Content-Type': mimeFromPath(resolvedPath),
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
