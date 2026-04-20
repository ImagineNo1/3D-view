'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { buildMapEmbedUrl, parseGoogleMapsUrl } from '@/lib/maps';

type Props = {
  googleMapsUrl?: string;
};

export function MapEmbed({ googleMapsUrl }: Props) {
  const { t } = useLanguage();

  if (!googleMapsUrl) return null;

  const parsed = parseGoogleMapsUrl(googleMapsUrl);
  if (!parsed) {
    return (
      <section className="space-y-3 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{t.property.map}</h2>
        <p className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-700">نشانی نقشه معتبر نیست؛ می‌توانید نقشه اصلی را باز کنید.</p>
        <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          {t.common.openInMaps}
        </a>
      </section>
    );
  }

  const embedUrl = buildMapEmbedUrl(parsed);

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{t.property.map}</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200/70">
        <iframe title={t.property.map} src={embedUrl} width="100%" height="380" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      </div>

      <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
        {t.common.openInMaps}
      </a>
    </section>
  );
}
