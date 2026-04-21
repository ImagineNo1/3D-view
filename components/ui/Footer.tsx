'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="mt-20 border-t border-slate-200/70 bg-white/70 py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
        <p>© {new Date().getFullYear()} {t.common.appName}. {t.footer.tagline}</p>
        <div className="flex gap-5">
          <Link href="/" className="hover:text-slate-900">{t.nav.home}</Link>
          <Link href="/admin" className="hover:text-slate-900">{t.nav.dashboard}</Link>
        </div>
      </div>
    </footer>
  );
}
