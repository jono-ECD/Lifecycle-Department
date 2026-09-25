'use client';

// Small fetch wrapper for client components. JSON in, JSON out, one error string.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown; form?: FormData }): Promise<ApiResult<T>> {
  try {
    const r = await fetch(url, {
      method: init?.method ?? (init?.body || init?.form ? 'POST' : 'GET'),
      headers: init?.form ? undefined : init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.form ?? (init?.body ? JSON.stringify(init.body) : undefined),
      cache: 'no-store',
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return { ok: false, error: j.error || 'Something went wrong. Try again.' };
    return { ok: true, data: j as T };
  } catch {
    return { ok: false, error: 'No connection. Try again.' };
  }
}
