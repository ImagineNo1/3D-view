import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { ImageGallery } from '@/components/ImageGallery';
import { MapEmbed } from '@/components/MapEmbed';
import GeneratedBuildingModel from '@/components/GeneratedBuildingModel';
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
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-14 pt-6 md:px-6" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-blue-600">{t.property.showcase}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{property.title}</h1>
        <p className="mt-4 max-w-4xl leading-7 text-slate-600">{property.description}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a href={property.publicUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{t.property.openLink}</a>
          <CopyLinkButton url={property.publicUrl} />
          <a href={property.qrCodeDataUrl} download={`${property.slug}-qr.png`} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900">
            {t.property.downloadQr}
          </a>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <Image src={property.qrCodeDataUrl} alt={t.property.qr} width={84} height={84} className="rounded-lg border bg-white p-1" />
          <p className="text-sm text-slate-600">{t.property.qr}</p>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
        <GeneratedBuildingModel
          buildingArea={property.buildingArea ?? 900}
          buildingHeight={property.buildingHeight ?? 24}
          floorCount={property.floorCount ?? 6}
          floorHeight={property.floorHeight}
          latitude={property.latitude}
          longitude={property.longitude}
          facadeImages={property.images.gallery}
          aerialImage={aerialImageUrl}
          rotation={property.rotation}
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <ImageGallery images={property.images.gallery} title={property.title} />
      </section>

      <MapEmbed googleMapsUrl={property.googleMapsUrl} />
    </main>
  );
}
