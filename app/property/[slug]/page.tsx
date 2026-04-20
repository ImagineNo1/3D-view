import Image from 'next/image';
import { notFound } from 'next/navigation';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { ImageGallery } from '@/components/ImageGallery';
import { MapEmbed } from '@/components/MapEmbed';
import { ThreeViewer } from '@/components/ThreeViewer';
import { getSatelliteImage } from '@/lib/maps';
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

  const autoSatellite = getSatelliteImage(property.latitude, property.longitude);
  const satelliteImageUrl = property.satelliteImageUrl || autoSatellite || property.images[0];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-8 md:px-6">
      <header className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-blue-50 p-8 shadow-xl shadow-slate-900/5 dark:border-white/10 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Property Showcase</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl dark:text-white">{property.title}</h1>
        {property.location && <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{property.location}</p>}
        <p className="mt-5 max-w-3xl text-base text-slate-600 dark:text-slate-300">{property.description}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href={property.publicUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Open direct link
          </a>
          <CopyLinkButton url={property.publicUrl} />
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200/70 bg-white/75 p-4 shadow-lg shadow-slate-900/5 dark:border-white/10 dark:bg-slate-900/65 md:p-6">
        <ThreeViewer
          imageUrl={satelliteImageUrl}
          title={property.title}
          latitude={property.latitude}
          longitude={property.longitude}
          boundary={property.boundary || []}
          hotspots={property.hotspots || []}
        />
      </section>

      <ImageGallery images={property.images} title={property.title} />
      <MapEmbed googleMapsUrl={property.googleMapsUrl} />

      <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">QR Code</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Share this project instantly through print, brochures, or WhatsApp.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Image src={property.qrCodeDataUrl} alt={`QR for ${property.title}`} width={150} height={150} className="rounded-xl border border-slate-200 dark:border-white/10" />
          <a
            href={property.qrCodeDataUrl}
            download={`${property.slug}-qr.png`}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Download QR
          </a>
        </div>
      </section>
    </main>
  );
}
