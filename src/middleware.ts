import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  // Check if the hostname starts with www.
  if (hostname.startsWith('www.')) {
    // Remove 'www.' from the hostname
    const newHostname = hostname.replace(/^www\./, '');
    
    // Construct the new URL
    const newUrl = new URL(url.pathname + url.search, `https://${newHostname}`);
    
    // Redirect to the non-www version
    return NextResponse.redirect(newUrl, 301);
  }

  return NextResponse.next();
}

// Match all paths except static files, api routes, and favicon
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
