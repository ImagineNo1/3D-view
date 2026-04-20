'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ImageUploader, normalizeExistingImages, type UploadItem, type UploadStatus } from '@/components/admin/ImageUploader';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { parseGoogleMapsUrl } from '@/lib/maps';
import type { Property, PropertyPayload } from '@/types/property';

type Props = {
  onCreated: (property: Property) => void;
  editing?: Property | null;
  onUpdated?: (property: Property) => void;
  onCancelEdit?: () => void;
};

type UploadResponse = {
  success?: boolean;
  fileUrl?: string;
  urls?: string[];
  error?: string;
};

async function uploadImageWithProgress(
  category: 'gallery' | 'aerial',
  item: UploadItem,
  propertyKey: string,
  onProgress: (value: number) => void,
  onStatusChange: (status: UploadStatus, message?: string) => void
): Promise<string> {
  if (item.type === 'url' || !item.file) {
    onProgress(100);
    onStatusChange('success');
    return item.url;
  }

  const file = item.file;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onStatusChange('uploading');
      onProgress((event.loaded / event.total) * 100);
    };

    xhr.onload = () => {
      let data: UploadResponse = {};
      try {
        data = JSON.parse(xhr.responseText) as UploadResponse;
      } catch (error) {
        console.error('Upload response parse error', error, xhr.responseText);
      }

      const uploadedUrl = data.fileUrl || data.urls?.[0];
      const hasSuccess = xhr.status >= 200 && xhr.status < 300 && (data.success === true || Boolean(uploadedUrl));

      if (hasSuccess && uploadedUrl) {
        onProgress(100);
        onStatusChange('success');
        resolve(uploadedUrl);
        return;
      }

      const message = data.error || `Upload failed (status ${xhr.status})`;
      console.error('Upload rejected', { status: xhr.status, body: xhr.responseText, parsed: data });
      onStatusChange('error', message);
      reject(new Error(message));
    };

    xhr.onerror = () => {
      const message = 'Network error while uploading image';
      console.error(message, { category, propertyKey, fileName: file.name });
      onStatusChange('error', message);
      reject(new Error(message));
    };

    const formData = new FormData();
    formData.append('category', category);
    formData.append('propertyKey', propertyKey);
    formData.append('files', file);
    xhr.send(formData);
  });
}

export function PropertyForm({ onCreated, editing, onUpdated, onCancelEdit }: Props) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(editing?.title || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(editing?.googleMapsUrl || '');
  const [galleryImages, setGalleryImages] = useState<UploadItem[]>(normalizeExistingImages(editing?.images.gallery || []));
  const [aerialImages, setAerialImages] = useState<UploadItem[]>(normalizeExistingImages(editing?.images.aerial || []));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressById, setProgressById] = useState<Record<string, number>>({});
  const [statusById, setStatusById] = useState<Record<string, UploadStatus>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const parsedFromUrl = useMemo(() => parseGoogleMapsUrl(googleMapsUrl), [googleMapsUrl]);
  const propertyKey = useMemo(() => editing?._id || `temp-${Date.now()}`, [editing?._id]);

  const payload = (gallery: string[], aerial: string[]): PropertyPayload => ({ title, description, googleMapsUrl, images: { gallery, aerial } });

  const uploadBatch = async (category: 'gallery' | 'aerial', items: UploadItem[]) => {
    const result: string[] = [];
    for (const item of items) {
      if (item.file && !['image/jpeg', 'image/png', 'image/webp'].includes(item.file.type)) {
        setStatusById((prev) => ({ ...prev, [item.id]: 'error' }));
        const typeError = t.admin.fileTypeError;
        setErrorById((prev) => ({ ...prev, [item.id]: typeError }));
        throw new Error(typeError);
      }

      const url = await uploadImageWithProgress(
        category,
        item,
        propertyKey,
        (value) => {
          setProgressById((prev) => ({ ...prev, [item.id]: value }));
        },
        (status, message) => {
          setStatusById((prev) => ({ ...prev, [item.id]: status }));
          if (message) setErrorById((prev) => ({ ...prev, [item.id]: message }));
        }
      );
      result.push(url);
    }
    return result;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const [gallery, aerial] = await Promise.all([uploadBatch('gallery', galleryImages), uploadBatch('aerial', aerialImages)]);

      const response = await fetch(editing ? `/api/properties/${editing.slug}` : '/api/properties', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(gallery, aerial))
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t.admin.saveFailed);
      if (editing) onUpdated?.(data as Property);
      else onCreated(data as Property);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t.admin.unexpectedError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
      <div className="space-y-1 border-b border-slate-100 pb-4">
        <h2 className="text-2xl font-semibold text-slate-900">{editing ? t.admin.editProperty : t.admin.createProperty}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{t.admin.title}</span>
          <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.admin.title} className="w-full rounded-xl border px-3 py-2 text-right" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{t.admin.mapsUrl}</span>
          <input type="url" value={googleMapsUrl} onChange={(event) => setGoogleMapsUrl(event.target.value)} placeholder={t.admin.mapsUrl} className="w-full rounded-xl border px-3 py-2 text-right" />
          {parsedFromUrl && <p className="text-xs text-emerald-700">{t.admin.coordsParsed}: {parsedFromUrl.lat}, {parsedFromUrl.lng}</p>}
        </label>
      </div>

      <label className="block space-y-1 text-sm text-slate-700">
        <span className="font-medium">{t.admin.description}</span>
        <textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t.admin.description} className="h-28 w-full rounded-xl border px-3 py-2 text-right" />
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        <ImageUploader
          label={t.admin.gallery}
          helperText={t.admin.uploadHintGallery}
          value={galleryImages}
          onChange={setGalleryImages}
          progressById={progressById}
          statusById={statusById}
          errorById={errorById}
          onUrlValidationError={setError}
          multiple
        />
        <ImageUploader
          label={t.admin.aerial}
          helperText={t.admin.uploadHintAerial}
          value={aerialImages}
          onChange={setAerialImages}
          progressById={progressById}
          statusById={statusById}
          errorById={errorById}
          onUrlValidationError={setError}
          multiple={false}
        />
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-60">
          {loading ? t.admin.savingProperty : editing ? t.admin.updateProperty : t.admin.createProperty}
        </button>
        {editing && (
          <button type="button" onClick={onCancelEdit} className="rounded-xl border px-4 py-2">
            {t.common.cancel}
          </button>
        )}
      </div>
    </form>
  );
}
