import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-content-center gap-4 text-center">
      <h1 className="text-3xl font-bold text-slate-900">Property not found</h1>
      <p className="text-slate-600">The property link may be invalid or deleted.</p>
      <Link href="/" className="text-blue-700 hover:underline">
        Go home
      </Link>
    </main>
  );
}
