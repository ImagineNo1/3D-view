'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { CTASection } from '@/components/home/CTASection';
import { HeroSection } from '@/components/home/HeroSection';

export default function Home() {
  const { t } = useLanguage();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-8 md:px-6">
      <HeroSection />
      <section className="rounded-2xl border border-slate-200/70 bg-white/70 px-6 py-5 text-center text-sm text-slate-600 shadow-sm">
        {t.home.badge}
      </section>
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">{t.home.title}</h2>
        <p className="mt-3 text-slate-600">Interactive 3D, secure admin dashboard, file upload pipeline, multilingual user experience, and QR-ready sharing.</p>
      </section>
      <CTASection />
    </main>
  );
}
