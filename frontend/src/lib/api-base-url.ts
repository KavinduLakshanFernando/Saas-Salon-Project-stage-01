/**
 * Production builds default to same-origin `/api` (nginx proxies to BACKEND_UPSTREAM on CapRover).
 * Override with VITE_API_BASE_URL only for local/direct-backend setups.
 */
export function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();

  let base: string;
  if (raw && raw !== '') {
    base = raw;
  } else if (import.meta.env.DEV) {
    base = 'http://localhost:3000/api';
  } else {
    base = '/api';
  }

  base = base.replace(/\/+$/, '');
  base = base.replace(/([^:]\/)\/+/g, '$1');

  if (base !== '/api' && !base.endsWith('/api')) {
    base = `${base}/api`;
  }

  return base.replace(/\/+$/, '');
}