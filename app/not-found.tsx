import Link from 'next/link';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getServerLocale } from '@/lib/i18n/locale';

export default async function NotFound() {
  const locale = await getServerLocale();
  const t = getDictionary(locale);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center" dir={locale === 'fa' ? 'rtl' : 'ltr'}>
      <h1 className="text-3xl font-bold text-slate-900">{locale === 'fa' ? 'ملک موردنظر یافت نشد' : 'Property not found'}</h1>
      <p className="text-slate-600">{locale === 'fa' ? 'لطفاً به صفحه اصلی بازگردید و دوباره تلاش کنید.' : 'Please return to the homepage and try again.'}</p>
      <Link href="/" className="rounded-xl bg-slate-900 px-4 py-2 text-white">{t.nav.home}</Link>
    </main>
  );
}
