import Link from 'next/link';
import { Reveal } from '@/components/ui/Reveal';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-blue-50 px-6 py-14 shadow-xl shadow-slate-900/5 md:px-10 md:py-20 dark:border-white/10 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="absolute -left-28 -top-28 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />

      <div className="relative grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <p className="mb-4 inline-flex rounded-full border border-slate-200 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            Premium real-estate presentation
          </p>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 md:text-6xl dark:text-white">
            Present Your Property in Interactive 3D
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg dark:text-slate-300">
            Create immersive property pages with 3D exploration, live maps, media galleries, and smart QR sharing—all in minutes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/admin" className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] hover:bg-slate-700 dark:bg-blue-600 dark:hover:bg-blue-500">
              Create Project
            </Link>
            <a href="#showcase" className="rounded-xl border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-white/20 dark:bg-white/5 dark:text-slate-100">
              View Demo
            </a>
          </div>
        </Reveal>

        <Reveal className="md:justify-self-end">
          <div className="animate-float rounded-3xl border border-white/70 bg-white/70 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-5 text-white">
              <p className="text-xs uppercase tracking-[0.18em] text-blue-200">Live 3D Preview</p>
              <div className="mt-4 h-48 rounded-xl bg-[radial-gradient(circle_at_30%_20%,#3b82f6_0%,#0f172a_55%)] p-4">
                <div className="h-full rounded-lg border border-white/20 bg-white/5" />
              </div>
              <p className="mt-3 text-sm text-blue-100">Rotate, zoom, and explore every detail.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
