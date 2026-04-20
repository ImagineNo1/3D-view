'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';

type Props = {
  images: string[];
  title: string;
};

export function ImageGallery({ images, title }: Props) {
  const { t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const sanitizedImages = useMemo(() => images.filter(Boolean), [images]);

  if (!sanitizedImages.length) return null;

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{t.property.gallery}</h2>
      <p className="text-sm text-slate-500">{t.property.galleryHint}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sanitizedImages.map((image, index) => (
          <button type="button" key={`${image}-${index}`} className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-200 text-left" onClick={() => setActiveIndex(index)}>
            <Image src={image} alt={`${title} ${index + 1}`} fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
          </button>
        ))}
      </div>

      {activeIndex !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
          <button className="absolute right-4 top-4 rounded-lg border border-white/30 px-3 py-2 text-sm text-white" onClick={() => setActiveIndex(null)} type="button">
            {t.common.close} ✕
          </button>
          <div className="relative h-[75vh] w-full max-w-5xl">
            <Image src={sanitizedImages[activeIndex]} alt={`${title} ${activeIndex + 1}`} fill sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}
    </section>
  );
}
