'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

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
          scrolled
            ? 'border-slate-200/70 bg-white/80 shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70'
            : 'border-transparent bg-white/40 backdrop-blur-md dark:bg-slate-900/40'
        }`}
      >
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Estate<span className="text-blue-600">3D</span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
          <Link href="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
          <a href="#projects" className="hover:text-slate-900 dark:hover:text-white">Projects</a>
          <Link href="/admin" className="hover:text-slate-900 dark:hover:text-white">Dashboard</Link>
        </div>

        <Link
          href="/admin"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:translate-y-[-1px] hover:bg-slate-700 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          Create Project
        </Link>
      </nav>
    </header>
  );
}
