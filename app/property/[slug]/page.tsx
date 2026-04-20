import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { ImageGallery } from '@/components/ImageGallery';
import { MapEmbed } from '@/components/MapEmbed';
import { ThreeViewer } from '@/components/ThreeViewer';
import { connectToDatabase } from '@/lib/mongodb';
import Property from '@/models/Property';
import type { Property as PropertyType } from '@/types/property';

async function fetchProperty(slug: string): Promise<PropertyType | null> {
  try {
    await connectToDatabase();
    const property = await Property.findOne({ slug }).lean<PropertyType | null>();
    return property;
  } catch {
    return null;
  }
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await fetchProperty(slug);

  if (!property) {
    notFound();
  }

  const satelliteImageUrl = property.satelliteImageUrl || property.images[0];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8">
      <header className="rounded-xl bg-white p-6 shadow">
        <h1 className="text-3xl font-bold text-slate-900">{property.title}</h1>
        {property.location && <p className="mt-1 text-sm text-slate-500">{property.location}</p>}
        <p className="mt-3 text-slate-700">{property.description}</p>
        <div className="mt-4 flex gap-2">
          <a
            href={property.publicUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Open direct link
          </a>
          <CopyLinkButton url={property.publicUrl} />
        </div>
      </header>

      <ThreeViewer imageUrl={satelliteImageUrl} title={property.title} />
      <ImageGallery images={property.images} title={property.title} />
      <MapEmbed googleMapsUrl={property.googleMapsUrl} />

      <section className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold text-slate-900">QR Code</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Image src={property.qrCodeDataUrl} alt={`QR for ${property.title}`} width={150} height={150} className="rounded border" />
          <a
            href={property.qrCodeDataUrl}
            download={`${property.slug}-qr.png`}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
          >
            Download QR
          </a>
        </div>
      </section>
    </main>
  );
}
