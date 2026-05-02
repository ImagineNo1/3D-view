import { NextRequest, NextResponse } from 'next/server';

type Cache = { t: number; data: any };
const cache = new Map<string, Cache>();

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get('lat'));
  const lng = Number(request.nextUrl.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ roads: [] }, { status: 400 });
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const found = cache.get(key);
  if (found && Date.now() - found.t < 1000 * 60 * 30) return NextResponse.json(found.data);
  try {
    const q = `[out:json][timeout:15];(way["highway"](around:300,${lat},${lng});way["building"](around:220,${lat},${lng}););out center 40;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q, headers: { 'Content-Type': 'text/plain' } });
    if (!res.ok) throw new Error('osm failed');
    const json = await res.json() as any;
    const roads = (json.elements || []).filter((e: any) => e.tags?.highway && e.center).slice(0, 12).map((e: any) => ({ cx: (e.center.lon - lng) * 90000, cz: (e.center.lat - lat) * 111000, length: 30 }));
    const buildings = (json.elements || []).filter((e: any) => e.tags?.building && e.center).slice(0, 20).map((e: any) => ({ cx: (e.center.lon - lng) * 90000, cz: (e.center.lat - lat) * 111000, h: 8 }));
    const data = { roads, buildings };
    cache.set(key, { t: Date.now(), data });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ roads: [], buildings: [] });
  }
}
