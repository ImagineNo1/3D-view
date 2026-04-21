import { NextResponse } from 'next/server';
import { destroyAdminSession, requireAdminSession } from '@/lib/auth';

export async function POST() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await destroyAdminSession();
  return NextResponse.json({ ok: true });
}
