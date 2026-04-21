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
  const formatNumber = (value: number) => new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(value);
  const propertyStats: Array<{ key: string; icon: 'layers' | 'building' | 'height' | 'rotate'; label: string; value: string }> = [
    {
      key: 'area',
      icon: 'layers',
      label: t.property.area,
      value: `${formatNumber(property.buildingArea ?? 900)} ${t.property.squareMeterUnit}`
    },
    {
      key: 'floors',
      icon: 'building',
      label: t.property.floors,
      value: formatNumber(property.floorCount ?? 6)
    },
    {
      key: 'height',
      icon: 'height',
      label: t.property.height,
      value: `${formatNumber(property.buildingHeight ?? 24)} ${t.property.meterUnit}`
    },
    {
      key: 'rotation',
      icon: 'rotate',
      label: t.property.rotation,
      value: `${formatNumber(property.rotation ?? 0)} ${t.property.degreeUnit}`
    }
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-14 pt-6 md:px-6" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{t.property.showcase}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{property.title}</h1>
            <p className="mt-3 max-w-4xl leading-7 text-slate-600">{property.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <CopyLinkButton url={property.publicUrl} />
            <a href={property.qrCodeDataUrl} download={`${property.slug}-qr.png`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              <span aria-hidden>⌁</span>
              {t.property.downloadQr}
            </a>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
          {propertyStats.map((stat) => (
            <div key={stat.key} className="inline-flex items-center gap-1.5">
              <StatIcon type={stat.icon} />
              <span className="font-medium text-slate-700">{stat.value}</span>
              <span>{stat.label}</span>
            </div>
          ))}
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

function StatIcon({ type }: { type: 'layers' | 'building' | 'height' | 'rotate' }) {
  const className = 'h-4 w-4 text-blue-600';
  if (type === 'layers') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
        <path d="m12 4 8 4-8 4-8-4 8-4Z" />
        <path d="m4 12 8 4 8-4" />
        <path d="m4 16 8 4 8-4" />
      </svg>
    );
  }
  if (type === 'building') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
        <path d="M4 20h16" />
        <path d="M7 20V6l5-2 5 2v14" />
        <path d="M10 10h.01M14 10h.01M10 14h.01M14 14h.01" />
      </svg>
    );
  }
  if (type === 'height') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
        <path d="M12 3v18" />
        <path d="m8 7 4-4 4 4" />
        <path d="m8 17 4 4 4-4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M21 12a9 9 0 1 1-3.2-6.9" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
