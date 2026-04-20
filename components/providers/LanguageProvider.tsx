'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { dictionaries, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/dictionaries';

type Ctx = { locale: Locale; setLocale: (locale: Locale) => void; t: (typeof dictionaries)[Locale] };

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || DEFAULT_LOCALE);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr';
    document.cookie = `locale=${locale};path=/;max-age=31536000;samesite=lax`;
    localStorage.setItem('locale', locale);
  }, [locale]);

  useEffect(() => {
    const stored = localStorage.getItem('locale');
    if (stored === 'en' || stored === 'fa') {
      setLocaleState(stored);
    }
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale: setLocaleState, t: dictionaries[locale] }),
    [locale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
