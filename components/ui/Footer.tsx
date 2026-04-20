import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-200/70 bg-white/70 py-10 dark:border-white/10 dark:bg-slate-950/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:px-6 dark:text-slate-400">
        <p>© {new Date().getFullYear()} Estate3D. Crafted for premium property storytelling.</p>
        <div className="flex gap-5">
          <Link href="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
          <Link href="/admin" className="hover:text-slate-900 dark:hover:text-white">Dashboard</Link>
          <a href="#projects" className="hover:text-slate-900 dark:hover:text-white">Projects</a>
        </div>
      </div>
    </footer>
  );
}
