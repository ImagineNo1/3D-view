'use client';

import { FormEvent, useState } from 'react';
import { ImageUrlInput } from './ImageUrlInput';
import type { Property } from '@/types/property';

type Props = {
  onCreated: (property: Property) => void;
};

export function PropertyForm({ onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [satelliteImageUrl, setSatelliteImageUrl] = useState('');
  const [images, setImages] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setGoogleMapsUrl('');
    setSatelliteImageUrl('');
    setImages(['']);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          location,
          googleMapsUrl,
          satelliteImageUrl,
          images: images.map((url) => url.trim()).filter(Boolean)
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create property');
      }

      onCreated(data as Property);
      resetForm();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4 rounded-xl bg-white p-5 shadow" onSubmit={handleSubmit}>
      <h2 className="text-xl font-semibold text-slate-900">Create Property</h2>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
        <textarea
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="h-24 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Location (optional)</label>
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Google Maps URL (optional)</label>
        <input
          type="url"
          value={googleMapsUrl}
          onChange={(event) => setGoogleMapsUrl(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="https://maps.google.com/..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Satellite image URL for 3D plane (optional)</label>
        <input
          type="url"
          value={satelliteImageUrl}
          onChange={(event) => setSatelliteImageUrl(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="https://example.com/satellite.jpg"
        />
      </div>

      <ImageUrlInput value={images} onChange={setImages} />

      {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <button
        disabled={loading}
        className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {loading ? 'Creating...' : 'Create Property'}
      </button>
    </form>
  );
}
