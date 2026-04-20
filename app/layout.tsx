import type { Metadata } from 'next';
import { Footer } from '@/components/ui/Footer';
import { Navbar } from '@/components/ui/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Estate3D — Premium Property Showcase',
  description: 'Premium real estate platform for interactive pseudo-3D experiences, maps, media galleries, and QR sharing.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] font-sans text-[var(--foreground)]">
        <div className="page-bg min-h-screen">
          <Navbar />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
