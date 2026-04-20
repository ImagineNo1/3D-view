'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { Property } from '@/types/property';

type Props = {
  properties: Property[];
  onDeleted: (slug: string) => void;
};

export function PropertyList({ properties, onDeleted }: Props) {
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  const deleteProperty = async (slug: string) => {
    setDeletingSlug(slug);
    try {
      const response = await fetch(`/api/properties/${slug}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Delete failed');
      }
      onDeleted(slug);
    } finally {
      setDeletingSlug(null);
    }
  };

  const copyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    alert('Property link copied');
  };

  if (!properties.length) {
    return <p className="rounded-lg bg-white p-5 text-sm text-slate-600 shadow">No properties yet.</p>;
  }

  return (
    <div className="grid gap-4">
      {properties.map((property) => (
        <article key={property._id} className="rounded-xl bg-white p-4 shadow">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{property.title}</h3>
              <p className="text-sm text-slate-500">/{property.slug}</p>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300"
                onClick={() => copyLink(property.publicUrl)}
                type="button"
              >
                Copy Link
              </button>
              <button
                className="rounded bg-red-100 px-3 py-2 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50"
                onClick={() => deleteProperty(property.slug)}
                type="button"
                disabled={deletingSlug === property.slug}
              >
                {deletingSlug === property.slug ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>

          <p className="mb-4 text-sm text-slate-700">{property.description}</p>

          <div className="mb-4 flex flex-wrap items-center gap-4">
            <Image
              src={property.qrCodeDataUrl}
              alt={`QR for ${property.title}`}
              width={120}
              height={120}
              className="rounded border border-slate-200"
            />
            <a
              href={property.qrCodeDataUrl}
              download={`${property.slug}-qr.png`}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
            >
              Download QR
            </a>
            <Link href={`/property/${property.slug}`} className="text-sm font-medium text-blue-700 hover:underline">
              Open public page
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
