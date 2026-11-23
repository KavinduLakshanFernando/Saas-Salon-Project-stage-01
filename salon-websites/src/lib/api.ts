import { PublicWebsitePayload } from '@/types';

const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000';

export interface FetchWebsiteOptions {
  subdomain?: string | null;
  hostname?: string | null;
  preview?: boolean;
  token?: string | null;
}

export async function fetchPublicSalonData(
  options: FetchWebsiteOptions
): Promise<PublicWebsitePayload | null> {
  const { subdomain, hostname, preview, token } = options;

  if (!subdomain && !hostname) {
    return null;
  }

  const params = new URLSearchParams();
  if (subdomain) {
    params.set('subdomain', subdomain);
  }
  if (hostname) {
    params.set('hostname', hostname);
  }
  if (preview) {
    params.set('preview', 'true');
  }
  if (token) {
    params.set('token', token);
  }

  const endpoint = `${API_BASE_URL}/api/public/websites/data?${params.toString()}`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      // Live updates reflected instantly without stale cache
      cache: 'no-store',
    });

    if (res.status === 404 || res.status === 400 || res.status === 403) {
      return null;
    }

    if (!res.ok) {
      console.error(`[fetchPublicSalonData] API error ${res.status}: ${res.statusText}`);
      return null;
    }

    const data: PublicWebsitePayload = await res.json();
    return data;
  } catch (error) {
    console.error('[fetchPublicSalonData] Network / connection error:', error);
    return null;
  }
}
