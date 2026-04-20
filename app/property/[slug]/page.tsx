import { notFound } from 'next/navigation';
import { ImageGallery } from '@/components/ImageGallery';
import { ThreeModelViewer } from '@/components/ThreeModelViewer';
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8">
      <header className="rounded-xl bg-white p-6 shadow">
        <h1 className="text-3xl font-bold text-slate-900">{property.title}</h1>
        {property.location && <p className="mt-1 text-sm text-slate-500">{property.location}</p>}
        <p className="mt-3 text-slate-700">{property.description}</p>
      </header>

      <ThreeModelViewer modelUrl={property.modelUrl} />
      <ImageGallery images={property.images} title={property.title} />
    </main>
  );
}
