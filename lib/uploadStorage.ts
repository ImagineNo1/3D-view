import path from 'path';
import { tmpdir } from 'os';

const DEFAULT_PUBLIC_ROOT = path.join(process.cwd(), 'public', 'uploads');
const DEFAULT_TMP_ROOT = path.join(tmpdir(), '3d-view', 'uploads');

const configuredRoot = process.env.UPLOAD_STORAGE_PATH?.trim();

export const uploadStorageRoot = configuredRoot || DEFAULT_TMP_ROOT;
export const usesPublicUploadsRoot = path.resolve(uploadStorageRoot) === path.resolve(DEFAULT_PUBLIC_ROOT);

export function buildUploadStorageDir(propertyKey: string, category: 'gallery' | 'aerial') {
  return path.join(uploadStorageRoot, 'properties', propertyKey, category);
}

export function buildUploadedFileUrl(propertyKey: string, category: 'gallery' | 'aerial', filename: string) {
  const suffix = `properties/${propertyKey}/${category}/${filename}`;
  return usesPublicUploadsRoot ? `/uploads/${suffix}` : `/api/uploads/${suffix}`;
}

export function resolveUploadFilePath(segments: string[]) {
  const cleanSegments = segments.filter(Boolean);
  const targetPath = path.join(uploadStorageRoot, ...cleanSegments);
  const normalizedRoot = path.resolve(uploadStorageRoot);
  const normalizedTarget = path.resolve(targetPath);

  if (!normalizedTarget.startsWith(normalizedRoot)) {
    return null;
  }

  return normalizedTarget;
}
