'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';

type Props = {
  url: string;
};

export function CopyLinkButton({ url }: Props) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button type="button" onClick={onCopy} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
      {copied ? t.common.copied : t.common.copyLink}
    </button>
  );
}
