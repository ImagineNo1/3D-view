import type { Metadata } from 'next';
import { Footer } from '@/components/ui/Footer';
import { Navbar } from '@/components/ui/Navbar';
import { LanguageProvider } from '@/components/providers/LanguageProvider';
import { getServerLocale } from '@/lib/i18n/locale';
import './globals.css';

export const metadata: Metadata = {
  title: 'Estate3D — Premium Property Showcase',
  description: 'Premium real estate platform for interactive pseudo-3D experiences, maps, media galleries, and QR sharing.'
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();
  return (
    <html lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <LanguageProvider initialLocale={locale}>
          <div className="page-bg min-h-screen">
            <Navbar />
            {children}
            <Footer />
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
