export type ParsedGoogleMaps = {
  lat: number;
  lng: number;
};

const COORDINATE_REGEX = /(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/;

const isValidCoordinate = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const GOOGLE_STATIC_SIZE = '1280x1280';

export function parseGoogleMapsUrl(url: string): ParsedGoogleMaps | null {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  try {
    const parsed = new URL(trimmedUrl);
    if (!parsed.hostname.includes('google.')) return null;

    const query = parsed.searchParams.get('q') || parsed.searchParams.get('query') || '';

    const searchCandidates = [parsed.href, parsed.pathname, query];

    for (const candidate of searchCandidates) {
      const match = candidate.match(COORDINATE_REGEX);
      if (!match) continue;

      const lat = Number(match[1]);
      const lng = Number(match[2]);

      if (isValidCoordinate(lat, lng)) {
        return { lat, lng };
      }
    }

    return null;
  } catch {
    return null;
  }
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
