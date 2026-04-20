import { CTASection } from '@/components/home/CTASection';
import { FeatureCard } from '@/components/home/FeatureCard';
import { HeroSection } from '@/components/home/HeroSection';
import { PropertyCard } from '@/components/home/PropertyCard';
import { ThreeViewerContainer } from '@/components/home/ThreeViewerContainer';
import { Reveal } from '@/components/ui/Reveal';

const features = [
  {
    title: 'Interactive 3D View',
    description: 'Give buyers a rich, touch-friendly pseudo-3D terrain and project exploration experience.',
    icon: '◉'
  },
  {
    title: 'QR Code Sharing',
    description: 'Generate and share instant property links for brochures, site offices, and campaigns.',
    icon: '⌁'
  },
  {
    title: 'Unlimited Images',
    description: 'Upload complete image stories with modal previews and mobile-optimized lazy loading.',
    icon: '▦'
  },
  {
    title: 'Google Maps Integration',
    description: 'Anchor each project on maps with automatic satellite context and embedded location views.',
    icon: '◎'
  }
];

const sampleProjects = [
  {
    title: 'Palm Horizon Residences',
    location: 'Dubai Marina',
    image: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1600&q=80',
    href: '/admin'
  },
  {
    title: 'Azure Heights',
    location: 'Riyadh Financial District',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
    href: '/admin'
  },
  {
    title: 'Crest Valley Villas',
    location: 'Abu Dhabi',
    image: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1600&q=80',
    href: '/admin'
  }
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-20 px-4 pb-16 pt-8 md:px-6 md:pt-12">
      <HeroSection />

      <Reveal>
        <section className="rounded-2xl border border-slate-200/70 bg-white/70 px-6 py-5 text-center text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
          Used by real estate professionals building immersive launch experiences.
        </section>
      </Reveal>

      <section>
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Features</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl dark:text-white">Everything your sales team needs</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <Reveal key={feature.title}>
              <FeatureCard icon={<span className="text-xl leading-none">{feature.icon}</span>} title={feature.title} description={feature.description} />
            </Reveal>
          ))}
        </div>
      </section>

      <section>
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">How it works</p>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {['Create project', 'Upload images & map', 'Share with QR'].map((step, index) => (
            <Reveal key={step}>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Step {index + 1}</p>
                <p className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{step}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="projects">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">Demo Showcase</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl dark:text-white">Explore property experiences</h2>
        </Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3" id="showcase">
          {sampleProjects.map((project) => (
            <Reveal key={project.title}>
              <PropertyCard {...project} />
            </Reveal>
          ))}
        </div>
      </section>

      <ThreeViewerContainer imageUrl="https://maps.googleapis.com/maps/api/staticmap?center=25.2048,55.2708&zoom=18&size=1280x1280&maptype=satellite&scale=2" />

      <Reveal>
        <CTASection />
      </Reveal>
    </main>
  );
}
