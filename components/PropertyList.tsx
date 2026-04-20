'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { Property } from '@/types/property';

type Props = {
  properties: Property[];
  onDeleted: (slug: string) => void;
  onEdit: (property: Property) => void;
};

export function PropertyList({ properties, onDeleted, onEdit }: Props) {
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  const deleteProperty = async (slug: string) => {
    setDeletingSlug(slug);
    try {
      const response = await fetch(`/api/properties/${slug}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      onDeleted(slug);
    } finally {
      setDeletingSlug(null);
    }
  };

  if (!properties.length) return <p className="rounded-xl border bg-white p-5 text-sm text-slate-600">No properties yet.</p>;

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Slug</th>
            <th className="px-4 py-3">QR</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((property) => (
            <tr key={property._id} className="border-t hover:bg-slate-50/80">
              <td className="px-4 py-3 font-medium">{property.title}</td>
              <td className="px-4 py-3 text-slate-500">/{property.slug}</td>
              <td className="px-4 py-3">
                <Image src={property.qrCodeDataUrl} alt={`QR ${property.title}`} width={44} height={44} className="rounded border" />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onEdit(property)} className="rounded-lg border px-3 py-1">Edit</button>
                  <button onClick={() => deleteProperty(property.slug)} disabled={deletingSlug === property.slug} className="rounded-lg bg-red-100 px-3 py-1 text-red-700">
                    {deletingSlug === property.slug ? 'Deleting...' : 'Delete'}
                  </button>
                  <Link href={`/property/${property.slug}`} className="rounded-lg bg-slate-900 px-3 py-1 text-white">View</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
