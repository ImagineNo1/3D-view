'use client';

import { FormEvent, useMemo, useState } from 'react';
import { parseGoogleMapsUrl, parseJsonArray } from '@/lib/maps';
import { ImageUrlInput } from './ImageUrlInput';
import type { LatLngPoint, Property, ViewerHotspot } from '@/types/property';

type Props = {
  onCreated: (property: Property) => void;
};

const BOUNDARY_EXAMPLE = `[
  {"lat": 25.1973, "lng": 55.2744},
  {"lat": 25.1977, "lng": 55.2750},
  {"lat": 25.1969, "lng": 55.2753}
]`;

const HOTSPOT_EXAMPLE = `[
  {"label":"Entrance", "description":"Main gate", "x": -2.3, "y": 1.8},
  {"label":"Clubhouse", "description":"Amenities zone", "x": 1.2, "y": -0.9}
]`;

export function PropertyForm({ onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [satelliteImageUrl, setSatelliteImageUrl] = useState('');
  const [boundaryJson, setBoundaryJson] = useState(BOUNDARY_EXAMPLE);
  const [hotspotsJson, setHotspotsJson] = useState(HOTSPOT_EXAMPLE);
  const [images, setImages] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const parsedFromUrl = useMemo(() => parseGoogleMapsUrl(googleMapsUrl), [googleMapsUrl]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setGoogleMapsUrl('');
    setLatitude('');
    setLongitude('');
    setSatelliteImageUrl('');
    setBoundaryJson(BOUNDARY_EXAMPLE);
    setHotspotsJson(HOTSPOT_EXAMPLE);
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
          latitude: latitude ? Number(latitude) : parsedFromUrl?.lat,
          longitude: longitude ? Number(longitude) : parsedFromUrl?.lng,
          satelliteImageUrl,
          boundary: parseJsonArray<LatLngPoint>(boundaryJson, []),
          hotspots: parseJsonArray<ViewerHotspot>(hotspotsJson, []),
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Latitude (optional)</label>
          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
            placeholder={parsedFromUrl?.lat?.toString() || 'auto from maps URL'}
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Longitude (optional)</label>
          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
            placeholder={parsedFromUrl?.lng?.toString() || 'auto from maps URL'}
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Satellite image URL override (optional)</label>
        <input
          type="url"
          value={satelliteImageUrl}
          onChange={(event) => setSatelliteImageUrl(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
          placeholder="Auto-generated from coordinates if empty"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Boundary polygon JSON (lat/lng points)</label>
        <textarea
          value={boundaryJson}
          onChange={(event) => setBoundaryJson(event.target.value)}
          className="h-28 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Hotspots JSON (label, description, x, y)</label>
        <textarea
          value={hotspotsJson}
          onChange={(event) => setHotspotsJson(event.target.value)}
          className="h-28 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-400"
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
