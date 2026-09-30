import { NextRequest, NextResponse } from 'next/server';
import { contentTypeFor, getStorage } from '@/lib/storage';
import { PARTS_PREFIX } from '@/lib/parts';

// Serves files from the local and Netlify storage adapters. Keys contain random ids, so responses are immutable.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const parts = key.map((k) => decodeURIComponent(k));
  if (parts.some((p) => p === '..' || p === '' || p.includes('\\'))) return new NextResponse('Not found', { status: 404 });
  const k = parts.join('/');
  // parts of an upload in progress are not files yet
  if (k.startsWith(PARTS_PREFIX)) return new NextResponse('Not found', { status: 404 });
  const buf = await getStorage().getObject(k);
  if (!buf) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': contentTypeFor(k),
      'Content-Length': String(buf.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
