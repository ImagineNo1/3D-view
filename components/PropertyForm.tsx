'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ImageUploader, normalizeExistingImages, type UploadItem } from '@/components/admin/ImageUploader';
import { parseGoogleMapsUrl } from '@/lib/maps';
import type { Property, PropertyPayload } from '@/types/property';

type Props = {
  onCreated: (property: Property) => void;
  editing?: Property | null;
  onUpdated?: (property: Property) => void;
  onCancelEdit?: () => void;
};

async function uploadPendingImages(category: 'gallery' | 'aerial', items: UploadItem[], onProgress: (label: string) => void) {
  const pending = items.filter((item) => item.file);
  const existing = items.filter((item) => !item.file).map((item) => item.url);

  if (!pending.length) return existing;

  const formData = new FormData();
  formData.append('category', category);
  pending.forEach((item) => item.file && formData.append('files', item.file));

  onProgress(`Uploading ${category} images (${pending.length})...`);

  const response = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to upload ${category} images`);
  }

  const uploaded = data.urls as string[];
  let cursor = 0;

  return items.map((item) => {
    if (!item.file) return item.url;
    const next = uploaded[cursor];
    cursor += 1;
    return next;
  });
}

export function PropertyForm({ onCreated, editing, onUpdated, onCancelEdit }: Props) {
  const [title, setTitle] = useState(editing?.title || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(editing?.googleMapsUrl || '');
  const [galleryImages, setGalleryImages] = useState<UploadItem[]>(normalizeExistingImages(editing?.images.gallery || []));
  const [aerialImages, setAerialImages] = useState<UploadItem[]>(normalizeExistingImages(editing?.images.aerial || []));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');


  const parsedFromUrl = useMemo(() => parseGoogleMapsUrl(googleMapsUrl), [googleMapsUrl]);

  const payload = (gallery: string[], aerial: string[]): PropertyPayload => ({
    title,
    description,
    googleMapsUrl,
    images: { gallery, aerial }
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const [gallery, aerial] = await Promise.all([
        uploadPendingImages('gallery', galleryImages, setUploadProgress),
        uploadPendingImages('aerial', aerialImages, setUploadProgress)
      ]);

      setUploadProgress('Saving property...');

      const response = await fetch(editing ? `/api/properties/${editing.slug}` : '/api/properties', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(gallery, aerial))
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save property');
      if (editing) {
        onUpdated?.(data as Property);
      } else {
        onCreated(data as Property);
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unexpected error');
    } finally {
      setUploadProgress('');
      setLoading(false);
    }
  };

  return (
    <form className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
      <div className="space-y-1 border-b border-slate-100 pb-4">
        <h2 className="text-2xl font-semibold text-slate-900">{editing ? 'Edit Property' : 'Create Property'}</h2>
        <p className="text-sm text-slate-500">Manage content, media, and map coordinates in one flow.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Title</span>
          <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Google Maps URL</span>
          <input type="url" value={googleMapsUrl} onChange={(event) => setGoogleMapsUrl(event.target.value)} placeholder="Google Maps URL" className="w-full rounded-xl border px-3 py-2" />
          {parsedFromUrl && <p className="text-xs text-emerald-700">Coordinates parsed: {parsedFromUrl.lat}, {parsedFromUrl.lng}</p>}
        </label>
      </div>

      <label className="block space-y-1 text-sm text-slate-700">
        <span className="font-medium">Description</span>
        <textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="h-28 w-full rounded-xl border px-3 py-2" />
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        <ImageUploader
          label="Gallery Images"
          helperText="Add multiple images. Reorder by drag & drop. Changes save only when you submit the form."
          value={galleryImages}
          onChange={setGalleryImages}
          uploading={loading}
          progressLabel={uploadProgress}
          multiple
        />
        <ImageUploader
          label="Aerial Image"
          helperText="Use one primary aerial image. If empty, the viewer will fall back to Google Maps satellite imagery."
          value={aerialImages}
          onChange={setAerialImages}
          uploading={loading}
          progressLabel={uploadProgress}
          multiple={false}
        />
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-60">
          {loading ? uploadProgress || 'Saving...' : editing ? 'Update Property' : 'Create Property'}
        </button>
        {editing && (
          <button type="button" onClick={onCancelEdit} className="rounded-xl border px-4 py-2">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
