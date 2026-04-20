'use client';

import { useMemo, useState } from 'react';

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
};

export function ImageUrlInput({ value, onChange }: Props) {
  const [text, setText] = useState('');

  const normalized = useMemo(() => value.filter(Boolean), [value]);

  const addUrls = (raw: string) => {
    const urls = raw
      .split(/\n|,/) 
      .map((item) => item.trim())
      .filter(Boolean);

    if (!urls.length) return;
    onChange(Array.from(new Set([...normalized, ...urls])));
    setText('');
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">Image URLs</label>
      <div
        className="rounded-md border-2 border-dashed border-slate-300 bg-white p-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const droppedText = event.dataTransfer.getData('text');
          addUrls(droppedText);
        }}
      >
        <textarea
          placeholder="Paste one or many image URLs (comma or newline separated)"
          className="h-24 w-full rounded-md border border-slate-300 p-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button
          type="button"
          onClick={() => addUrls(text)}
          className="mt-2 rounded-md bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700"
        >
          Add URLs
        </button>
        <p className="mt-2 text-xs text-slate-500">Bonus: Drag and drop a URL snippet directly into this box.</p>
      </div>

      {normalized.length > 0 && (
        <ul className="space-y-2">
          {normalized.map((url) => (
            <li key={url} className="flex items-center justify-between rounded-md bg-slate-100 p-2 text-sm">
              <span className="mr-2 truncate">{url}</span>
              <button
                type="button"
                onClick={() => onChange(normalized.filter((item) => item !== url))}
                className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
