import { isValidCoordinates, parseCoordinatesFromGoogleMapsUrl } from '@/components/estate-3d/geoUtils';

export type ParsedGoogleMaps = {
  lat: number;
  lng: number;
};

const isValidCoordinate = (lat: number, lng: number) => isValidCoordinates(lat, lng);

const GOOGLE_STATIC_SIZE = '1280x1280';

export function parseGoogleMapsUrl(url: string): ParsedGoogleMaps | null {
  const parsed = parseCoordinatesFromGoogleMapsUrl(url);
  return parsed ? { lat: parsed.latitude, lng: parsed.longitude } : null;
}


export function buildMapEmbedUrl({ lat, lng }: ParsedGoogleMaps): string {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}

export function getSatelliteImage(lat?: number, lng?: number, zoom = 19): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !isValidCoordinate(lat, lng)) {
    return null;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${GOOGLE_STATIC_SIZE}&maptype=satellite&scale=2`;
  }

  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${GOOGLE_STATIC_SIZE}&maptype=satellite&scale=2&key=${apiKey}`;
}
