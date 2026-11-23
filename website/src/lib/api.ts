import type { PublicPlan } from '../types/plans.ts';
import { DEFAULT_FALLBACK_PLANS } from './plans.ts';

export const REMOTE_API_BASE_URL = 'https://saloon-server.bc.dartcodes.com/api';

export function getApiBaseUrl(): string {
  const internal = process.env.INTERNAL_API_URL?.replace(/\/$/, '');
  if (internal) return internal;

  const serverApi = process.env.API_URL?.replace(/\/$/, '');
  if (serverApi) return serverApi;

  const publicUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (publicUrl) {
    if (publicUrl.includes('salon-main-website')) {
      return REMOTE_API_BASE_URL;
    }
    return publicUrl;
  }

  return REMOTE_API_BASE_URL;
}

export function getAppUrl(): string {
  let envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    envUrl = envUrl.replace(/\/(salon\/)?login\/?$/i, '').replace(/\/$/, '');
    if (envUrl) return envUrl;
  }
  return 'https://saloon-client.bc.dartcodes.com';
}

export function signupUrl(planId: string, billingCycle?: string): string {
  const base = `${getAppUrl()}/signup/${planId}`;
  if (billingCycle) {
    return `${base}?cycle=${billingCycle.toLowerCase()}`;
  }
  return base;
}

export function loginUrl(): string {
  return `${getAppUrl()}/salon/login`;
}

/**
 * Extracts a safe, human-readable string message from any error.
 * Guaranteed to NEVER return an empty string or raw object, and specifically
 * unwraps AggregateError / Node connect errors safely so Next.js inspect won't crash.
 */
export function formatErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  if (error instanceof Error) {
    if (error.message && error.message.trim()) return error.message.trim();
    if ('code' in error && error.code) return `Connection failed (${error.code})`;
    if ('errors' in error && Array.isArray((error as { errors?: unknown[] }).errors)) {
      const msgs = (error as { errors: unknown[] }).errors
        .map((e) => (e instanceof Error ? e.message || (e as { code?: string }).code : String(e)))
        .filter(Boolean)
        .join(', ');
      if (msgs) return msgs;
    }
    return error.name || 'Request error';
  }
  return String(error);
}

/**
 * Resilient request helper for server-side and client-side fetches.
 * - Protects against hanging sockets and unhandled socket errors in Node.js
 * - Normalizes all errors into clean, standard Error instances (never leaks AggregateError)
 * - Safe timeouts preventing server render stalls
 */
async function requestJson(url: string, timeoutMs: number = 2500): Promise<unknown> {
  if (typeof window === 'undefined') {
    return new Promise((resolve, reject) => {
      let settled = false;
      const safeReject = (err: unknown) => {
        if (settled) return;
        settled = true;
        reject(new Error(formatErrorMessage(err)));
      };
      const safeResolve = (data: unknown) => {
        if (settled) return;
        settled = true;
        resolve(data);
      };

      try {
        const isHttps = url.startsWith('https:');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { request } = isHttps ? require('node:https') : require('node:http');

        const req = request(
          url,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'User-Agent': 'DartSmartSalon-Website/1.0',
            },
            timeout: timeoutMs,
          },
          (res: import('node:http').IncomingMessage) => {
            const statusCode = res.statusCode ?? 500;
            if (statusCode < 200 || statusCode >= 300) {
              return safeReject(new Error(`HTTP ${statusCode}`));
            }
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => {
              body += chunk;
            });
            res.on('end', () => {
              try {
                safeResolve(JSON.parse(body));
              } catch (e) {
                safeReject(e);
              }
            });
          }
        );

        // Guard socket from unhandled errors that can trigger uncaughtException
        req.on('socket', (socket: import('node:net').Socket) => {
          socket.on('error', () => {
            // Error is captured via req.on('error') or safeReject
          });
        });

        req.on('error', (err: Error) => {
          safeReject(err);
        });

        req.on('timeout', () => {
          req.destroy();
          safeReject(new Error(`Request timed out after ${timeoutMs}ms`));
        });

        req.end();
      } catch (err) {
        safeReject(err);
      }
    });
  }

  // Client-side fetch
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPublicPlans(): Promise<PublicPlan[]> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/plans`;
  const isLocalUrl = url.includes('localhost') || url.includes('127.0.0.1');
  const timeoutMs = isLocalUrl ? 1500 : 3000;

  try {
    const data = await requestJson(url, timeoutMs);
    if (Array.isArray(data)) {
      return (data as PublicPlan[])
        .filter((plan) => !plan.status || plan.status === 'ACTIVE')
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    }
    throw new Error('Backend returned an invalid plans response');
  } catch (error) {
    const primaryMsg = formatErrorMessage(error);

    // If local backend was unreachable and we have a secondary remote endpoint, try remote
    if (isLocalUrl && !REMOTE_API_BASE_URL.includes('localhost')) {
      const remoteUrl = `${REMOTE_API_BASE_URL}/plans`;
      try {
        const remoteData = await requestJson(remoteUrl, 3000);
        if (Array.isArray(remoteData)) {
          return (remoteData as PublicPlan[])
            .filter((plan) => !plan.status || plan.status === 'ACTIVE')
            .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        }
      } catch {
        // Both primary local and secondary remote failed; fall through to built-in plans
      }
    }

    // The marketing site must remain usable when the plans service is down or
    // unreachable (for example, during local development without network access).
    console.warn(
      `[Plans API] Note: Could not load plans from ${url} (${primaryMsg}); using built-in plan data.`,
    );
    return DEFAULT_FALLBACK_PLANS;
  }
}
