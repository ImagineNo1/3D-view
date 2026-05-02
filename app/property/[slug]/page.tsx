import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { PropertyPublicViewer } from '@/components/PropertyPublicViewer';
import { ImageGallery } from '@/components/ImageGallery';
import { MapEmbed } from '@/components/MapEmbed';
import { connectToDatabase } from '@/lib/mongodb';
import { getBaseUrl } from '@/lib/url';
import Property from '@/models/Property';

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  await connectToDatabase();
  const property = await Property.findOne({ slug }).lean();

  if (!property) {
    notFound();
  }

  const directUrl = `${getBaseUrl()}/property/${property.slug}`;
  const aerialImage = property.images?.aerial?.[0];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-16 pt-8 md:px-6">
      <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{property.title}</h1>
            <p className="mt-3 max-w-3xl text-slate-600">{property.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyLinkButton url={directUrl} />
            <Link href={directUrl} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              باز کردن لینک مستقیم
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          {typeof property.buildingArea === 'number' ? <p>متراژ: {property.buildingArea} متر مربع</p> : null}
          {typeof property.floorCount === 'number' ? <p>طبقه: {property.floorCount}</p> : null}
          {typeof property.buildingHeight === 'number' ? <p>ارتفاع: {property.buildingHeight} متر</p> : null}
          {typeof property.rotation === 'number' ? <p>چرخش: {property.rotation} درجه</p> : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 shadow-sm">
<PropertyPublicViewer property={property} />
      </section>

      {property.googleMapsUrl ? <Link href={property.googleMapsUrl} target="_blank" className="inline-flex w-fit rounded-lg bg-slate-900 px-4 py-2 text-white">Open in Google Maps</Link> : null}
      <ImageGallery images={property.images?.gallery ?? []} title={property.title} />
      <MapEmbed googleMapsUrl={property.googleMapsUrl} />

      {property.qrCodeDataUrl ? (
        <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">کد QR</h2>
          <Image src={property.qrCodeDataUrl} alt="QR code" width={176} height={176} className="mt-4 rounded-xl border border-slate-200/70 bg-white p-2" />
        </section>
      ) : null}
    </main>
  );
}
