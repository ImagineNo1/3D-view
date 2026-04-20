'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '@/components/ui/Reveal';
import { useLanguage } from '@/components/providers/LanguageProvider';

export function HeroSection() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-blue-50 px-6 py-14 shadow-xl shadow-slate-900/5 md:px-10 md:py-20">
      <div className="absolute -left-28 -top-28 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />

      <div className="relative grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <p className="mb-4 inline-flex rounded-full border border-slate-200 bg-white/70 px-4 py-1 text-xs font-semibold tracking-[0.15em] text-slate-600">
            {t.home.heroBadge}
          </p>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl">{t.home.heroTitle}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">{t.home.heroDescription}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/admin" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] hover:bg-slate-700">
              {t.home.heroPrimary}
            </Link>
            <a href="#projects" className="rounded-xl border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
              {t.home.heroSecondary}
            </a>
          </div>
        </Reveal>

        <Reveal className="md:justify-self-end">
          <div className="animate-float overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
            <div className="relative h-[320px] w-[360px] max-w-full overflow-hidden rounded-2xl">
              <Image src="https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80" alt={t.home.livePreview} fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent p-5 text-white">
                <p className="text-xs tracking-[0.18em] text-blue-100">{t.home.livePreview}</p>
                <p className="mt-3 text-sm text-blue-100">{t.home.livePreviewHint}</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
