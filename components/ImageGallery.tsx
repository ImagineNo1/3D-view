import Image from 'next/image';

type Props = {
  images: string[];
  title: string;
};

export function ImageGallery({ images, title }: Props) {
  if (!images.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-slate-900">Gallery</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((image, index) => (
          <div key={`${image}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-200">
            <Image src={image} alt={`${title} image ${index + 1}`} fill className="object-cover" />
          </div>
        ))}
      </div>
    </section>
  );
}
