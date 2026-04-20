import Image from 'next/image';
import Link from 'next/link';

type Props = {
  title: string;
  location: string;
  image: string;
  href: string;
};

export function PropertyCard({ title, location, image, href }: Props) {
  return (
    <Link href={href} className="group block overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-slate-900/70">
      <div className="relative h-60 w-full overflow-hidden">
        <Image src={image} alt={title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 768px) 100vw, 33vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent" />
        <div className="absolute bottom-4 left-4">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-blue-200">{location}</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{title}</h3>
        </div>
      </div>
    </Link>
  );
}
