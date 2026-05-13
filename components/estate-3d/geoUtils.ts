export type ParsedCoordinates = { latitude: number; longitude: number };

const PAIR = /(-?\d{1,2}(?:\.\d+)?|-?90(?:\.0+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?|-?180(?:\.0+)?)/;
const BANG = /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/;
const AT = /@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)(?:,|z|$)/;

export function isValidCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function pairToCoordinates(match: RegExpMatchArray | null): ParsedCoordinates | null {
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return isValidCoordinates(latitude, longitude) ? { latitude, longitude } : null;
}

export function parseCoordinatesFromGoogleMapsUrl(input: string): ParsedCoordinates | null {
  const raw = input.trim();
  if (!raw) return null;

  const rawPair = pairToCoordinates(raw.match(PAIR));
  if (rawPair && !raw.includes('http')) return rawPair;

  try {
    const parsed = new URL(raw);
    const candidates = [
      parsed.searchParams.get('q'),
      parsed.searchParams.get('query'),
      parsed.searchParams.get('ll'),
      parsed.hash,
      decodeURIComponent(parsed.pathname),
      decodeURIComponent(parsed.href)
    ].filter((value): value is string => Boolean(value));

    for (const candidate of candidates) {
      const bang = pairToCoordinates(candidate.match(BANG));
      if (bang) return bang;
      const at = pairToCoordinates(candidate.match(AT));
      if (at) return at;
      const pair = pairToCoordinates(candidate.match(PAIR));
      if (pair) return pair;
    }
  } catch {
    const bang = pairToCoordinates(raw.match(BANG));
    if (bang) return bang;
    const at = pairToCoordinates(raw.match(AT));
    if (at) return at;
  }

  return rawPair;
}

export function metersToLongitudeDegrees(meters: number, latitude: number) {
  const metersPerDegree = 111_320 * Math.cos((latitude * Math.PI) / 180);
  return metersPerDegree === 0 ? 0 : meters / metersPerDegree;
}

export function metersToLatitudeDegrees(meters: number) {
  return meters / 110_540;
}

export function latLngToXZ(latitude: number, longitude: number, centerLatitude: number, centerLongitude: number) {
  const z = -(latitude - centerLatitude) * 110_540;
  const x = (longitude - centerLongitude) * 111_320 * Math.cos((centerLatitude * Math.PI) / 180);
  return { x, z };
}

export function xzToLatLng(x: number, z: number, centerLatitude: number, centerLongitude: number) {
  const latitude = centerLatitude - z / 110_540;
  const denominator = 111_320 * Math.cos((centerLatitude * Math.PI) / 180);
  const longitude = centerLongitude + (denominator === 0 ? 0 : x / denominator);
  return { latitude, longitude };
}
