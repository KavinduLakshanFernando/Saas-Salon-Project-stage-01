import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - static image formats (png, jpg, svg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:jpg|jpeg|gif|png|webp|svg|ico)$).*)',
  ],
};

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const searchParams = request.nextUrl.searchParams;
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Allow explicit dev / preview override via query param only in non-production
  let subdomain = '';
  if (!isProduction) {
    subdomain = searchParams.get('subdomain') || searchParams.get('salon') || '';
  }

  // 2. Extract subdomain or custom domain from Host header
  const cleanHost = host.toLowerCase().split(':')[0]; // strip port

  if (!subdomain) {
    // Check if localhost or local IP
    if (cleanHost.endsWith('.localhost')) {
      const parts = cleanHost.split('.');
      if (parts.length >= 2 && parts[0] !== 'localhost') {
        subdomain = parts[0];
      }
    } else {
      // Check against platform domain (e.g., dartsalon.lk or configured PLATFORM_DOMAIN)
      const platformDomain = (process.env.PLATFORM_DOMAIN || 'dartsalon.com').toLowerCase();
      if (cleanHost.endsWith(`.${platformDomain}`)) {
        subdomain = cleanHost.replace(`.${platformDomain}`, '').split('.')[0];
      } else if (cleanHost !== platformDomain && cleanHost !== 'localhost' && cleanHost !== '127.0.0.1') {
        // Potential custom domain (e.g. www.salonheart.com or my-salon.lk)
        // Handled via hostname
      }
    }
  }

  // Handle draft preview token if requested
  const isPreview = searchParams.get('preview') === 'true';
  const previewToken = searchParams.get('previewToken') || searchParams.get('token') || '';

  // Pass resolved headers forward to Server Components
  const requestHeaders = new Headers(request.headers);
  if (subdomain) {
    requestHeaders.set('x-salon-subdomain', subdomain);
  }
  requestHeaders.set('x-salon-hostname', cleanHost);
  if (isPreview) {
    requestHeaders.set('x-salon-preview', 'true');
    if (previewToken) {
      requestHeaders.set('x-salon-preview-token', previewToken);
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Fallback export for Next.js convention compatibility
export const middleware = proxy;
export default proxy;
