import path from 'path';

const DEFAULT_PUBLIC_ROOT = path.join(process.cwd(), 'public', 'uploads');

const configuredRoot = process.env.UPLOAD_STORAGE_PATH?.trim();

export const uploadStorageRoot = configuredRoot || DEFAULT_PUBLIC_ROOT;
export const usesPublicUploadsRoot = path.resolve(uploadStorageRoot) === path.resolve(DEFAULT_PUBLIC_ROOT);

export function buildUploadStorageDir(propertyKey: string, _category: 'gallery' | 'aerial') {
  return path.join(uploadStorageRoot, 'properties', propertyKey);
}

export function buildUploadedFileUrl(propertyKey: string, _category: 'gallery' | 'aerial', filename: string) {
  const suffix = `properties/${propertyKey}/${filename}`;
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
