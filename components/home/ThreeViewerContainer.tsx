import { ThreeViewer } from '@/components/ThreeViewer';
import { Reveal } from '@/components/ui/Reveal';

type Props = {
  imageUrl?: string;
};

export function ThreeViewerContainer({ imageUrl }: Props) {
  return (
    <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <Reveal>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">3D Experience</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl dark:text-white">Rotate, zoom, explore</h2>
        <p className="mt-4 text-slate-600 dark:text-slate-300">
          Deliver Matterport-style confidence with an accessible pseudo-3D experience. Let buyers understand layout and context before booking a visit.
        </p>
      </Reveal>
      <Reveal>
        <ThreeViewer title="Demo Project" imageUrl={imageUrl} />
      </Reveal>
    </section>
  );
}
