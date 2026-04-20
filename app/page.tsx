import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-4 text-4xl font-bold text-slate-900">Property 3D Viewer MVP</h1>
      <p className="mb-8 text-slate-600">
        Manage properties from the admin dashboard and share immersive public pages via QR code.
      </p>
      <Link
        href="/admin"
        className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-700"
      >
        Go to Admin Dashboard
      </Link>
    </main>
  );
}
