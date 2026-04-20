'use client';

import { useEffect, useState } from 'react';
import { PropertyForm } from '@/components/PropertyForm';
import { PropertyList } from '@/components/PropertyList';
import type { Property } from '@/types/property';

export default function AdminPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProperties = async () => {
      const response = await fetch('/api/properties');
      const data = (await response.json()) as Property[];
      setProperties(data);
      setLoading(false);
    };

    fetchProperties().catch(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl gap-6 px-4 py-8 md:grid-cols-[1.05fr_1.4fr]">
      <section>
        <PropertyForm onCreated={(created) => setProperties((prev) => [created, ...prev])} />
      </section>

      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-slate-900">All Properties</h1>
        {loading ? (
          <p className="rounded-lg bg-white p-5 text-sm text-slate-600 shadow">Loading properties...</p>
        ) : (
          <PropertyList
            properties={properties}
            onDeleted={(slug) => setProperties((prev) => prev.filter((property) => property.slug !== slug))}
          />
        )}
      </section>
    </main>
  );
}
