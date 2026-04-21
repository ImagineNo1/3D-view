'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';

export function CTASection() {
  const { t } = useLanguage();

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-10 text-white shadow-2xl shadow-blue-500/10 md:p-14">
      <p className="text-xs tracking-[0.2em] text-blue-200">{t.home.ctaBadge}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">{t.home.ctaTitle}</h2>
      <p className="mt-4 max-w-2xl text-sm text-blue-100/90 md:text-base">{t.home.ctaDescription}</p>
      <Link href="/admin?tab=form" className="mt-8 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:translate-y-[-1px] hover:bg-blue-50">
        {t.home.ctaAction}
      </Link>
    </section>
  );
}
