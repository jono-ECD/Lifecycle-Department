'use client';

// Small fetch wrapper for client components. JSON in, JSON out, one error string.
import { DIRECT_LIMIT, PART_BYTES, partsFor } from '@/lib/uploadParts';
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const UPLOAD_FAILED = 'The upload did not go through. Try again.';

/**
 * Hosts that run on functions refuse large requests. When the files in a form add up to more than
 * one request can carry, each file is sent in parts first and the form names it instead.
 */
async function sendInParts(form: FormData, field = 'files'): Promise<FormData> {
  const total = form.getAll(field).reduce((n, v) => n + (v instanceof File ? v.size : 0), 0);
  if (total <= DIRECT_LIMIT) return form;
  const out = new FormData();
  for (const [k, v] of form.entries()) {
    if (k !== field || !(v instanceof File)) {
      out.append(k, v);
      continue;
    }
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    const parts = partsFor(v.size);
    for (let i = 0; i < parts; i++) {
      const part = new FormData();
      part.set('id', id);
      part.set('index', String(i));
      part.set('parts', String(parts));
      part.set('part', v.slice(i * PART_BYTES, (i + 1) * PART_BYTES), 'part');
      const r = await fetch('/api/admin/uploads', { method: 'POST', body: part, cache: 'no-store' });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || UPLOAD_FAILED);
    }
    out.append(k, JSON.stringify({ upload: id, name: v.name, type: v.type, size: v.size, parts }));
  }
  return out;
}

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown; form?: FormData }): Promise<ApiResult<T>> {
  let form = init?.form;
  if (form) {
    try {
      form = await sendInParts(form);
    } catch (err) {
      return { ok: false, error: err instanceof TypeError ? 'No connection. Try again.' : (err as Error).message || UPLOAD_FAILED };
    }
  }
  try {
    const r = await fetch(url, {
      method: init?.method ?? (init?.body || init?.form ? 'POST' : 'GET'),
      headers: init?.form ? undefined : init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: form ?? (init?.body ? JSON.stringify(init.body) : undefined),
      cache: 'no-store',
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return { ok: false, error: j.error || 'Something went wrong. Try again.' };
    return { ok: true, data: j as T };
  } catch {
    return { ok: false, error: 'No connection. Try again.' };
  }
}
