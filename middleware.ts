import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if the request is for a dashboard route
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    // Get the token from cookies (we'll need to store it there too)
    const token = request.cookies.get('auth_token')?.value;
    
    // If no token, redirect to login with returnUrl
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('returnUrl', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // TODO: Optionally validate the token here
    // For now, we just check if it exists
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/dashboard/:path*',
};
