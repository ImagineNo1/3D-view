'use client';

import Image from 'next/image';
import { useState } from 'react';

type Props = {
  label: string;
  category: 'gallery' | 'aerial';
  value: string[];
  onChange: (urls: string[]) => void;
  multiple?: boolean;
};

export function ImageUploader({ label, category, value, onChange, multiple = true }: Props) {
  const [uploading, setUploading] = useState(false);

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('category', category);
    Array.from(files).forEach((file) => formData.append('files', file));

    const response = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await response.json();
    setUploading(false);

    if (!response.ok) {
      alert(data.error || 'Upload failed');
      return;
    }

    const incoming = data.urls as string[];
    onChange(multiple ? [...value, ...incoming] : incoming.slice(0, 1));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input type="file" accept="image/png,image/jpeg,image/webp" multiple={multiple} onChange={(event) => uploadFiles(event.target.files)} />
      {uploading && <p className="text-xs text-slate-500">Uploading...</p>}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {value.map((url) => (
          <div key={url} className="group relative overflow-hidden rounded-xl border">
            <Image src={url} alt="Uploaded" width={220} height={150} className="h-24 w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== url))}
              className="absolute right-1 top-1 rounded bg-black/70 px-2 py-1 text-xs text-white"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
