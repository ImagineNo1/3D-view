import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ authenticated: false, role: null });
  return NextResponse.json({ authenticated: true, role: session.role, email: session.email });
}
