import Link from 'next/link';

export function CTASection() {
  return (
    <section className="rounded-3xl border border-slate-200/70 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-10 text-white shadow-2xl shadow-blue-500/10 md:p-14">
      <p className="text-xs uppercase tracking-[0.2em] text-blue-200">Launch faster</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Start showcasing your projects today</h2>
      <p className="mt-4 max-w-2xl text-sm text-blue-100/90 md:text-base">
        Build premium property experiences with immersive visuals, live maps, and instant share links.
      </p>
      <Link
        href="/admin"
        className="mt-8 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:translate-y-[-1px] hover:bg-blue-50"
      >
        Create Project
      </Link>
    </section>
  );
}
