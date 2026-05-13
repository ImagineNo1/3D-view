import { isValidCoordinates, parseCoordinatesFromGoogleMapsUrl } from '@/components/estate-3d/geoUtils';

export type ParsedGoogleMaps = {
  lat: number;
  lng: number;
};

const isValidCoordinate = (lat: number, lng: number) => isValidCoordinates(lat, lng);
const STATIC_SIZE = '1280x1280@2x';

export function parseGoogleMapsUrl(url: string): ParsedGoogleMaps | null {
  const parsed = parseCoordinatesFromGoogleMapsUrl(url);
  return parsed ? { lat: parsed.latitude, lng: parsed.longitude } : null;
}

export function buildMapEmbedUrl({ lat, lng }: ParsedGoogleMaps): string {
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;
}

export function getSatelliteImage(lat?: number, lng?: number, zoom = 19): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !isValidCoordinate(lat, lng)) {
    return null;
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lng},${lat},${zoom},0/${STATIC_SIZE}?access_token=${encodeURIComponent(token)}`;
}
