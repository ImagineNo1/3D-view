import { buildMapEmbedUrl, parseGoogleMapsUrl } from '@/lib/maps';

type Props = {
  googleMapsUrl?: string;
};

export function MapEmbed({ googleMapsUrl }: Props) {
  if (!googleMapsUrl) return null;

  const parsed = parseGoogleMapsUrl(googleMapsUrl);
  if (!parsed) {
    return (
      <section className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Map</h2>
        <p className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-200">Unable to parse coordinates from this Google Maps URL.</p>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          Open in Google Maps
        </a>
      </section>
    );
  }

  const embedUrl = buildMapEmbedUrl(parsed);

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Map Location</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/10">
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
        className="inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-blue-600 dark:hover:bg-blue-500"
      >
        Open in Google Maps
      </a>
    </section>
  );
}
