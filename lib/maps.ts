export type ParsedGoogleMaps = {
  lat: number;
  lng: number;
};

const COORDINATE_REGEX = /(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/;

const isValidCoordinate = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

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
