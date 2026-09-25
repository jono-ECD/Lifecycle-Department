import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  const session = await getAdminSession();
  session.destroy();
  return NextResponse.redirect(new URL('/admin/login', env('APP_URL', new URL(req.url).origin)), 303);
}
