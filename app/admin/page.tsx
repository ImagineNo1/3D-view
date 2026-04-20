'use client';

import { useEffect, useState } from 'react';
import { PropertyForm } from '@/components/PropertyForm';
import { PropertyList } from '@/components/PropertyList';
import type { Property } from '@/types/property';

export default function AdminPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Property | null>(null);

  useEffect(() => {
    const fetchProperties = async () => {
      const response = await fetch('/api/properties');
      const data = (await response.json()) as Property[];
      setProperties(data);
      setLoading(false);
    };
    fetchProperties().catch(() => setLoading(false));
  }, []);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-[250px_1fr]">
        <aside className="rounded-2xl bg-slate-900 p-4 text-white shadow-xl">
          <h2 className="text-xl font-bold">Estate3D SaaS</h2>
          <nav className="mt-6 space-y-2 text-sm">
            <p className="rounded-xl bg-white/10 px-3 py-2">Properties</p>
            <button onClick={logout} className="w-full rounded-xl border border-white/20 px-3 py-2 text-left">Logout</button>
          </nav>
        </aside>

        <section className="space-y-4">
          <header className="rounded-2xl bg-white p-4 shadow-sm">
            <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          </header>

          <PropertyForm
            key={editing?._id ?? 'create'}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
            onCreated={(created) => setProperties((prev) => [created, ...prev])}
            onUpdated={(updated) => {
              setProperties((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
              setEditing(null);
            }}
          />

          {loading ? (
            <p className="rounded-xl bg-white p-5 shadow-sm">Loading...</p>
          ) : (
            <PropertyList
              properties={properties}
              onEdit={setEditing}
              onDeleted={(slug) => setProperties((prev) => prev.filter((property) => property.slug !== slug))}
            />
          )}
        </section>
      </div>
    </main>
  );
}
