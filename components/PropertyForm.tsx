'use client';

import { FormEvent, useMemo, useState } from 'react';
import { parseGoogleMapsUrl, parseJsonArray } from '@/lib/maps';
import { ImageUploader } from '@/components/admin/ImageUploader';
import type { LatLngPoint, Property, PropertyPayload, ViewerHotspot } from '@/types/property';

type Props = {
  onCreated: (property: Property) => void;
  editing?: Property | null;
  onUpdated?: (property: Property) => void;
  onCancelEdit?: () => void;
};

const BOUNDARY_EXAMPLE = `[{"lat": 25.1973, "lng": 55.2744}]`;
const HOTSPOT_EXAMPLE = `[{"label":"Entrance", "description":"Main gate", "x": -2.3, "y": 1.8}]`;

export function PropertyForm({ onCreated, editing, onUpdated, onCancelEdit }: Props) {
  const [title, setTitle] = useState(editing?.title || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(editing?.googleMapsUrl || '');
  const [boundaryJson, setBoundaryJson] = useState(JSON.stringify(editing?.boundary || JSON.parse(BOUNDARY_EXAMPLE), null, 2));
  const [hotspotsJson, setHotspotsJson] = useState(JSON.stringify(editing?.hotspots || JSON.parse(HOTSPOT_EXAMPLE), null, 2));
  const [galleryImages, setGalleryImages] = useState<string[]>(editing?.images.gallery || []);
  const [aerialImages, setAerialImages] = useState<string[]>(editing?.images.aerial || []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const parsedFromUrl = useMemo(() => parseGoogleMapsUrl(googleMapsUrl), [googleMapsUrl]);

  const payload = (): PropertyPayload => ({
    title,
    description,
    googleMapsUrl,
    images: { gallery: galleryImages, aerial: aerialImages },
    boundary: parseJsonArray<LatLngPoint>(boundaryJson, []),
    hotspots: parseJsonArray<ViewerHotspot>(hotspotsJson, [])
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(editing ? `/api/properties/${editing.slug}` : '/api/properties', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload())
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
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm" onSubmit={handleSubmit}>
      <h2 className="text-xl font-semibold text-slate-900">{editing ? 'Edit Property' : 'Create Property'}</h2>
      <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" className="w-full rounded-xl border px-3 py-2" />
      <textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="h-24 w-full rounded-xl border px-3 py-2" />
      <input type="url" value={googleMapsUrl} onChange={(event) => setGoogleMapsUrl(event.target.value)} placeholder="Google Maps URL" className="w-full rounded-xl border px-3 py-2" />
      {parsedFromUrl && <p className="text-xs text-emerald-700">Coordinates parsed: {parsedFromUrl.lat}, {parsedFromUrl.lng}</p>}

      <ImageUploader label="Gallery Images" category="gallery" value={galleryImages} onChange={setGalleryImages} multiple />
      <ImageUploader label="Aerial Images" category="aerial" value={aerialImages} onChange={setAerialImages} multiple={false} />

      <textarea value={boundaryJson} onChange={(event) => setBoundaryJson(event.target.value)} className="h-28 w-full rounded-xl border px-3 py-2 font-mono text-xs" />
      <textarea value={hotspotsJson} onChange={(event) => setHotspotsJson(event.target.value)} className="h-28 w-full rounded-xl border px-3 py-2 font-mono text-xs" />

      {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-60">
          {loading ? 'Saving...' : editing ? 'Update Property' : 'Create Property'}
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
