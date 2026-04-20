'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || 'Login failed');
      return;
    }

    router.push('/admin');
    router.refresh();
  };

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-4">
      <form onSubmit={onSubmit} className="w-full rounded-2xl border bg-white p-6 shadow-lg">
        <h1 className="mb-4 text-2xl font-bold">Admin Login</h1>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="mb-3 w-full rounded-xl border px-3 py-2" />
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="mb-3 w-full rounded-xl border px-3 py-2" />
        {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="w-full rounded-xl bg-slate-900 py-2 text-white">{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </main>
  );
}
