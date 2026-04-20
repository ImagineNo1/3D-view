'use client';

import { useMemo } from 'react';

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
};

export function ImageUrlInput({ value, onChange }: Props) {
  const normalized = useMemo(() => (value.length ? value : ['']), [value]);

  const updateAt = (index: number, nextValue: string) => {
    const next = [...normalized];
    next[index] = nextValue;
    onChange(next);
  };

  const removeAt = (index: number) => {
    const next = normalized.filter((_, idx) => idx !== index);
    onChange(next.length ? next : ['']);
  };

  const addField = () => onChange([...normalized, '']);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">Image URLs</label>
        <button
          type="button"
          onClick={addField}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          + Add image
        </button>
      </div>

      <div className="space-y-2">
        {normalized.map((url, index) => (
          <div key={`image-input-${index}`} className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(event) => updateAt(index, event.target.value)}
              placeholder={`https://example.com/image-${index + 1}.jpg`}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
            />
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Add as many images as needed. Empty fields are ignored on save.</p>
    </div>
  );
}
