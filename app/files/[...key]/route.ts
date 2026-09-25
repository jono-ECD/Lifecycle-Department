import { NextRequest, NextResponse } from 'next/server';
import { contentTypeFor, getStorage } from '@/lib/storage';

// Serves files from the local storage adapter. Keys contain random ids, so responses are immutable.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const parts = key.map((k) => decodeURIComponent(k));
  if (parts.some((p) => p === '..' || p === '' || p.includes('\\'))) return new NextResponse('Not found', { status: 404 });
  const k = parts.join('/');
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
