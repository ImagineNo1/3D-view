import crypto from 'crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = { email: string; role: 'admin'; exp: number };

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not configured');
  return secret;
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const hashBuffer = Buffer.from(key, 'hex');
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(hashBuffer, candidate);
}

function sign(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verify(token: string): SessionPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  if (expected !== signature) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createAdminSession(email: string) {
  const cookieStore = await cookies();
  const payload: SessionPayload = { email, role: 'admin', exp: Date.now() + SESSION_TTL_SECONDS * 1000 };

  cookieStore.set(SESSION_COOKIE, sign(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verify(token);
}

export const ADMIN_COOKIE_NAME = SESSION_COOKIE;
