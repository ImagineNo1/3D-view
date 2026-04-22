'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { Property } from '@/types/property';

type Props = {
  properties: Property[];
  onDeleted: (slug: string) => void;
  onEdit: (property: Property) => void;
};

export function PropertyList({ properties, onDeleted, onEdit }: Props) {
  const { t, locale } = useLanguage();
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  const deleteProperty = async (slug: string) => {
    setDeletingSlug(slug);
    try {
      const response = await fetch(`/api/properties/${slug}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(t.admin.deleteFailed);
      onDeleted(slug);
    } finally {
      setDeletingSlug(null);
    }
  };

  if (!properties.length) return <p className="rounded-xl border bg-white p-5 text-sm text-slate-600">{t.admin.noProperties}</p>;

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-right text-slate-600">
          <tr>
            <th className="px-4 py-3">{t.admin.title}</th>
            <th className="px-4 py-3">اسلاگ</th>
            <th className="px-4 py-3">{t.property.qr}</th>
            <th className="px-4 py-3">عملیات</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((property) => (
            <tr key={property._id} className="border-t hover:bg-slate-50/80">
              <td className="px-4 py-3 font-medium">{property.title}</td>
              <td className="px-4 py-3 text-slate-500">/{property.slug}</td>
              <td className="px-4 py-3">
                <Image src={property.qrCodeDataUrl} alt={t.property.qr} width={44} height={44} className="rounded border" />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onEdit(property)} className="rounded-lg border px-3 py-1">{t.admin.editProperty}</button>
                  <button onClick={() => deleteProperty(property.slug)} disabled={deletingSlug === property.slug} className="rounded-lg bg-red-100 px-3 py-1 text-red-700">
                    {deletingSlug === property.slug ? t.admin.deleting : t.common.remove}
                  </button>
                  <Link href={`/property/${property.slug}`} className="rounded-lg bg-slate-900 px-3 py-1 text-white">{t.common.view}</Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
