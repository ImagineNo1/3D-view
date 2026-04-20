import { NextRequest, NextResponse } from 'next/server';
import { createAdminSession, verifyPassword } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import { ensureDefaultAdminUser } from '@/lib/defaultAdmin';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string };
    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });

    await connectToDatabase();
    await ensureDefaultAdminUser();
    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' }).lean();
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await createAdminSession(user.email);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
