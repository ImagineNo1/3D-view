'use client';

import { useEffect, useState } from 'react';
import { PropertyForm } from '@/components/PropertyForm';
import { PropertyList } from '@/components/PropertyList';
import { useLanguage } from '@/components/providers/LanguageProvider';
import type { Property } from '@/types/property';

type AdminTab = 'form' | 'list';

type Props = {
  initialTab?: AdminTab;
};

export function AdminDashboard({ initialTab = 'form' }: Props) {
  const { t, locale } = useLanguage();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Property | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

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
    <main className="min-h-screen bg-slate-100 p-4 md:p-6" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-3xl bg-slate-900 p-5 text-white shadow-xl">
          <h2 className="text-xl font-bold">{t.common.appName}</h2>
          <p className="mt-1 text-sm text-slate-300">{t.admin.opsConsole}</p>
          <nav className="mt-6 space-y-2 text-sm">
            <p className="rounded-xl bg-white/10 px-3 py-2">{t.admin.properties}</p>
            <button onClick={logout} className={`w-full rounded-xl border border-white/20 px-3 py-2 hover:bg-white/10 ${locale === 'fa' ? 'text-right' : 'text-left'}`}>{t.admin.logout}</button>
          </nav>
        </aside>

        <section className="space-y-4">
          <header className="rounded-3xl bg-white p-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">{t.admin.dashboardTitle}</h1>
            <p className="mt-1 text-sm text-slate-500">{t.admin.dashboardSubtitle}</p>
          </header>

          <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setActiveTab('form')} className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${activeTab === 'form' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {editing ? t.admin.editForm : t.admin.createForm}
              </button>
              <button onClick={() => setActiveTab('list')} className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${activeTab === 'list' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {t.admin.propertyList}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {activeTab === 'form' && (
              <PropertyForm
                key={editing?._id ?? 'create'}
                editing={editing}
                onCancelEdit={() => setEditing(null)}
                onCreated={(created) => {
                  setProperties((prev) => [created, ...prev]);
                  setEditing(null);
                  setActiveTab('list');
                }}
                onUpdated={(updated) => {
                  setProperties((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
                  setEditing(null);
                  setActiveTab('list');
                }}
              />
            )}

            {activeTab === 'list' && (loading ? <p className="rounded-xl bg-white p-5 shadow-sm">{t.common.loading}</p> : <PropertyList properties={properties} onEdit={(property) => { setEditing(property); setActiveTab('form'); }} onDeleted={(slug) => setProperties((prev) => prev.filter((property) => property.slug !== slug))} />)}
          </div>
        </section>
      </div>
    </main>
  );
}
