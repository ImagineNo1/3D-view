import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { ImageGallery } from '@/components/ImageGallery';
import { MapEmbed } from '@/components/MapEmbed';
import { ThreeViewer } from '@/components/ThreeViewer';
import { connectToDatabase } from '@/lib/mongodb';
import Property from '@/models/Property';
import type { Property as PropertyType } from '@/types/property';
import { getServerLocale } from '@/lib/i18n/locale';
import { getDictionary } from '@/lib/i18n/dictionaries';

async function fetchProperty(slug: string): Promise<PropertyType | null> {
  try {
    await connectToDatabase();
    return await Property.findOne({ slug }).lean<PropertyType | null>();
  } catch {
    return null;
  }
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await fetchProperty(slug);
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  if (!property) notFound();

  const aerialImageUrl = property.images.aerial[0] || property.images.gallery[0];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-8 md:px-6">
      <header className="rounded-3xl border bg-white p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{t.property.showcase}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{property.title}</h1>
        <p className="mt-5 max-w-3xl text-base text-slate-600">{property.description}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <a href={property.publicUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{t.property.openLink}</a>
          <CopyLinkButton url={property.publicUrl} />
        </div>
      </header>

      <section className="rounded-3xl border bg-white/75 p-4 shadow-lg md:p-6">
        <ThreeViewer imageUrl={aerialImageUrl} title={property.title} latitude={property.latitude} longitude={property.longitude} boundary={property.boundary || []} hotspots={property.hotspots || []} />
      </section>

      <ImageGallery images={property.images.gallery} title={property.title} />
      <MapEmbed googleMapsUrl={property.googleMapsUrl} />

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{t.property.qr}</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Image src={property.qrCodeDataUrl} alt={`QR for ${property.title}`} width={150} height={150} className="rounded-xl border" />
          <a href={property.qrCodeDataUrl} download={`${property.slug}-qr.png`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            {t.property.downloadQr}
          </a>
        </div>
      </section>
    </main>
  );
}
