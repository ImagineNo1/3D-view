'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { locale, setLocale, t } = useLanguage();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <nav
        className={`mx-auto flex w-full max-w-7xl items-center justify-between rounded-2xl border px-4 py-3 transition-all md:px-6 ${
          scrolled ? 'border-slate-200/70 bg-white/80 shadow-lg backdrop-blur-xl' : 'border-transparent bg-white/40 backdrop-blur-md'
        }`}
      >
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          {locale === 'fa' ? t.common.appName : <>Estate<span className="text-blue-600">3D</span></>}
        </Link>

        <div className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link href="/">{t.nav.home}</Link>
          <a href="#projects">{t.nav.projects}</a>
          <Link href="/admin">{t.nav.dashboard}</Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            aria-label={t.nav.language}
            title={t.nav.language}
          >
            <span aria-hidden>🌐</span>
            <span>{locale === 'fa' ? t.nav.switchToEn : t.nav.switchToFa}</span>
          </button>
          <Link href="/admin" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            {t.nav.createProject}
          </Link>
        </div>
      </nav>
    </header>
  );
}
