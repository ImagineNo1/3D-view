import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_PUBLIC_ROUTES = ['/admin/login'];
const ADMIN_COOKIE_NAME = 'admin_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminApiProtected = pathname.startsWith('/api/properties') || pathname.startsWith('/api/upload');

  if (!isAdminRoute && !isAdminApiProtected) return NextResponse.next();

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (isAdminRoute) {
    const isPublic = ADMIN_PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
    if (!token && !isPublic) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    if (token && pathname === '/admin/login') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  if (isAdminApiProtected && !token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/properties/:path*', '/api/upload/:path*']
};
