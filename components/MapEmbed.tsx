import { buildMapEmbedUrl, parseGoogleMapsUrl } from '@/lib/maps';

type Props = {
  googleMapsUrl?: string;
};

export function MapEmbed({ googleMapsUrl }: Props) {
  if (!googleMapsUrl) return null;

  const parsed = parseGoogleMapsUrl(googleMapsUrl);
  if (!parsed) {
    return (
      <section className="space-y-3 rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">Map</h2>
        <p className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-700">Unable to parse coordinates from this Google Maps URL.</p>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          Open in Google Maps
        </a>
      </section>
    );
  }

  const embedUrl = buildMapEmbedUrl(parsed);

  return (
    <section className="space-y-3 rounded-xl bg-white p-6 shadow">
      <h2 className="text-xl font-semibold text-slate-900">Map Location</h2>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <iframe
          title="Property map"
          src={embedUrl}
          width="100%"
          height="380"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-block rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
      >
        Open in Google Maps
      </a>
    </section>
  );
}
