import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, type Locale } from './dictionaries';

export const LOCALE_COOKIE = 'locale';

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  return value === 'fa' ? 'fa' : DEFAULT_LOCALE;
}
