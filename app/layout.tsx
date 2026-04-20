import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Property 3D Viewer MVP',
  description: 'Admin-managed property pages with 3D model viewing and QR access.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
