'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { CTASection } from '@/components/home/CTASection';
import { HeroSection } from '@/components/home/HeroSection';
import { FeatureCard } from '@/components/home/FeatureCard';

export default function Home() {
  const { t } = useLanguage();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-8 md:px-6">
      <HeroSection />
      <section className="rounded-2xl border border-slate-200/70 bg-white/70 px-6 py-5 text-center text-sm text-slate-600 shadow-sm">{t.home.badge}</section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm" id="projects">
        <h2 className="text-2xl font-semibold">{t.home.title}</h2>
        <p className="mt-3 text-slate-600">{t.home.subtitle}</p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <FeatureCard icon="🚀" title={t.home.featureOneTitle} description={t.home.featureOneDesc} />
          <FeatureCard icon="🖼️" title={t.home.featureTwoTitle} description={t.home.featureTwoDesc} />
          <FeatureCard icon="🔗" title={t.home.featureThreeTitle} description={t.home.featureThreeDesc} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            'https://images.unsplash.com/photo-1600585154084-4e5fe7c39198?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=80',
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'
          ].map((src, index) => (
            <div key={src} className="h-44 rounded-2xl bg-cover bg-center" style={{ backgroundImage: `url(${src})` }} aria-label={`${t.home.sectionFeatured} ${index + 1}`} />
          ))}
        </div>
      </section>

      <CTASection />
    </main>
  );
}
