import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { currentActor, type Actor } from '@/lib/auth';
import { UserError } from '@/lib/errors';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Parses a JSON body with a zod schema. Throws ApiError(400) with a short message on failure. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, 'Body must be JSON.');
  }
  return parseWith(schema, raw);
}

export function parseWith<T>(schema: ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new ApiError(400, issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid input.');
  }
  return r.data;
}

export async function requireActor(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) throw new ApiError(401, 'Sign in again.');
  return actor;
}

export async function requireAdminActor(): Promise<Extract<Actor, { role: 'admin' }>> {
  const actor = await requireActor();
  if (actor.role !== 'admin') throw new ApiError(403, 'Admins only.');
  return actor;
}

/** Team, connections and workspace settings are for full admins. Editors work on campaigns. */
export async function requireFullAdminActor(): Promise<Extract<Actor, { role: 'admin' }>> {
  const actor = await requireAdminActor();
  if (actor.admin.role !== 'admin') throw new ApiError(403, 'Only a full admin can change this.');
  return actor;
}

/** Wraps a route handler so thrown ApiError and zod errors become JSON responses. */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.status, err.message);
      if (err instanceof UserError) return fail(400, err.message);
      if (err instanceof ZodError) return fail(400, err.issues[0]?.message ?? 'Invalid input.');
      console.error(err);
      return fail(500, 'Something went wrong on our side.');
    }
  };
}
