'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';

type UploadItem = {
  id: string;
  type: 'upload' | 'url';
  url: string;
  file?: File;
};

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

type Props = {
  label: string;
  helperText: string;
  value: UploadItem[];
  onChange: (items: UploadItem[]) => void;
  multiple?: boolean;
  progressById?: Record<string, number>;
  statusById?: Record<string, UploadStatus>;
  errorById?: Record<string, string>;
  onUrlValidationError?: (message: string) => void;
};

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isValidImageUrl(raw: string) {
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const pathname = parsed.pathname.toLowerCase();
    return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

export function buildUploadItems(files: FileList | null): UploadItem[] {
  if (!files?.length) return [];
  return Array.from(files).map((file) => ({
    id: createId(),
    type: 'upload',
    file,
    url: URL.createObjectURL(file)
  }));
}

export function normalizeExistingImages(urls: string[]) {
  return urls.map((url) => ({ id: createId(), type: 'url' as const, url }));
}

export function ImageUploader({
  label,
  helperText,
  value,
  onChange,
  multiple = true,
  progressById = {},
  statusById = {},
  errorById = {},
  onUrlValidationError
}: Props) {
  const { t } = useLanguage();
  const [urlInput, setUrlInput] = useState('');

  const onFileSelect = (files: FileList | null) => {
    const incoming = buildUploadItems(files);
    if (!incoming.length) return;
    onChange(multiple ? [...value, ...incoming] : incoming.slice(0, 1));
  };

  const addUrlImage = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    if (!isValidImageUrl(trimmed)) {
      onUrlValidationError?.('Please provide a valid JPG, PNG, or WEBP URL.');
      return;
    }

    const incoming: UploadItem = {
      id: createId(),
      type: 'url',
      url: trimmed
    };
    onChange(multiple ? [...value, incoming] : [incoming]);
    setUrlInput('');
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= value.length) return;
    const next = [...value];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
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
        {multiple ? t.admin.chooseImages : t.admin.chooseImage}
      </label>

      <div className="flex gap-2">
        <input
          type="url"
          value={urlInput}
          onChange={(event) => setUrlInput(event.target.value)}
          placeholder="Enter image URL"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="button" onClick={addUrlImage} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
          Add Image
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {value.map((item, index) => {
          const progress = progressById[item.id] ?? (item.type === 'upload' ? 0 : 100);
          const status = statusById[item.id] ?? (item.type === 'url' ? 'success' : 'idle');
          return (
            <article key={item.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-28 w-full">
                <Image src={item.url} alt={t.admin.preview} fill className="object-cover" sizes="(max-width: 768px) 50vw, 20vw" unoptimized />
              </div>
              <div className="space-y-2 px-2 py-2 text-xs">
                <span className="block truncate text-slate-500">{item.file?.name || item.url || t.admin.savedImage}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
                </div>
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <span className="truncate text-slate-500">{status === 'uploading' ? 'Uploading…' : status === 'success' ? '✓ Success' : status === 'error' ? '✕ Error' : 'Pending'}</span>
                  <span className="text-slate-500">{t.admin.progress}: {Math.round(progress)}٪</span>
                </div>
                {status === 'error' && errorById[item.id] && <p className="text-[11px] text-red-700">{errorById[item.id]}</p>}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="rounded-md border px-2 py-1 disabled:opacity-40">↑</button>
                    <button type="button" onClick={() => moveItem(index, 1)} disabled={index === value.length - 1} className="rounded-md border px-2 py-1 disabled:opacity-40">↓</button>
                  </div>
                  <button type="button" onClick={() => onChange(value.filter((entry) => entry.id !== item.id))} className="rounded-md bg-red-50 px-2 py-1 text-red-700 hover:bg-red-100">
                    {t.common.remove}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export type { UploadItem, UploadStatus };
