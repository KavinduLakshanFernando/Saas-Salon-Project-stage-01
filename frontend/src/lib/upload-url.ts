import { resolveApiBaseUrl } from '@/lib/api-base-url';

export function resolveUploadUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path);
      const spacesHost = url.hostname.match(/^(.+)\.([a-z0-9-]+)(\.cdn)?\.digitaloceanspaces\.com$/i);
      if (spacesHost?.[1].includes('.')) {
        const bucketName = spacesHost[1];
        const region = spacesHost[2];
        return `https://${region}.digitaloceanspaces.com/${bucketName}${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      return path;
    }
    return path;
  }

  const apiBase = resolveApiBaseUrl();
  return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
}
