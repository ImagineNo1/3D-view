'use client';

import Image from 'next/image';

type UploadItem = {
  id: string;
  url: string;
  file?: File;
};

type Props = {
  label: string;
  helperText: string;
  value: UploadItem[];
  onChange: (items: UploadItem[]) => void;
  multiple?: boolean;
  uploading?: boolean;
  progressLabel?: string;
};

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildUploadItems(files: FileList | null): UploadItem[] {
  if (!files?.length) return [];
  return Array.from(files).map((file) => ({
    id: createId(),
    file,
    url: URL.createObjectURL(file)
  }));
}

export function normalizeExistingImages(urls: string[]) {
  return urls.map((url) => ({ id: createId(), url }));
}

export function ImageUploader({ label, helperText, value, onChange, multiple = true, uploading, progressLabel }: Props) {
  const onFileSelect = (files: FileList | null) => {
    const incoming = buildUploadItems(files);
    if (!incoming.length) return;
    onChange(multiple ? [...value, ...incoming] : incoming.slice(0, 1));
  };

  const moveItem = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIndex = value.findIndex((item) => item.id === fromId);
    const toIndex = value.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...value];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
        <p className="text-xs text-slate-500">{helperText}</p>
      </div>

      <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600 hover:border-slate-400">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple={multiple}
          className="hidden"
          onChange={(event) => {
            onFileSelect(event.target.files);
            event.currentTarget.value = '';
          }}
        />
        Choose {multiple ? 'images' : 'image'}
      </label>

      {uploading && <p className="text-xs font-medium text-blue-700">{progressLabel || 'Uploading images...'}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {value.map((item) => (
          <article
            key={item.id}
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              moveItem(event.dataTransfer.getData('text/plain'), item.id);
            }}
            className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="relative h-28 w-full">
              <Image src={item.url} alt="Preview" fill className="object-cover" sizes="(max-width: 768px) 50vw, 20vw" />
            </div>
            <div className="flex items-center justify-between gap-2 px-2 py-2 text-xs">
              <span className="truncate text-slate-500">{item.file?.name || 'Saved image'}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((entry) => entry.id !== item.id))}
                className="rounded-md bg-red-50 px-2 py-1 text-red-700 hover:bg-red-100"
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export type { UploadItem };
