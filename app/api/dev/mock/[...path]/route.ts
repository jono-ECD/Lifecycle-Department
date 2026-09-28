// Stand in for Figma, Klaviyo and a content calendar sheet, so the features can be tried and tested
// without any account. Only answers when ENABLE_DEV_MOCKS=1. Never enable in production.
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { env } from '@/lib/env';
import { addDays, todayYmd } from '@/lib/dates';

type Ctx = { params: Promise<{ path: string[] }> };

const FRAMES = [
  { id: '10:1', name: 'October Promo, EM1', color: '#2f5d3a', h: 1900 },
  { id: '10:2', name: 'October Promo, EM2', color: '#c9772b', h: 1700 },
  { id: '10:3', name: 'Sea Moss Spotlight', color: '#2b6f9c', h: 2100 },
  { id: '20:1', name: 'Holiday Gift Guide', color: '#7a2f4f', h: 2400 },
];

function off() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

async function framePng(id: string, scale: number): Promise<Buffer> {
  const f = FRAMES.find((x) => x.id === id) ?? FRAMES[0];
  const w = Math.max(60, Math.round(600 * scale));
  const h = Math.max(100, Math.round(f.h * scale));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 600 ${f.h}">
    <rect width="600" height="${f.h}" fill="#f6f3ec"/>
    <rect width="600" height="54" fill="${f.color}"/>
    <text x="300" y="34" font-family="Helvetica,Arial,sans-serif" font-size="17" fill="#fff" text-anchor="middle">Free shipping for U.S. orders over $98</text>
    <text x="300" y="170" font-family="Georgia,serif" font-size="50" fill="${f.color}" text-anchor="middle">${f.name.replace(/&/g, 'and')}</text>
    <rect x="70" y="240" width="460" height="460" rx="230" fill="${f.color}" opacity=".18"/>
    <rect x="170" y="770" width="260" height="62" rx="31" fill="${f.color}"/>
    <text x="300" y="810" font-family="Georgia,serif" font-size="24" fill="#fff" text-anchor="middle">SHOP NOW</text>
    ${Array.from({ length: 9 }, (_, i) => `<rect x="90" y="${900 + i * 46}" width="${420 - (i % 3) * 60}" height="16" rx="8" fill="#d9d5ca"/>`).join('')}
    <rect y="${f.h - 360}" width="600" height="360" fill="${f.color}"/>
    <text x="300" y="${f.h - 170}" font-family="Georgia,serif" font-size="32" fill="#fff" text-anchor="middle">Sample frame from the Figma stand in</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function GET(req: Request, ctx: Ctx) {
  if (env('ENABLE_DEV_MOCKS') !== '1') return off();
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const origin = env('APP_URL', url.origin).replace(/\/$/, '');
  const [service, ...rest] = path;

  if (service === 'figma') {
    if (rest[0] === 'files' && rest[2] === 'comments') return NextResponse.json({ comments: [] });
    if (rest[0] === 'files') {
      const node = (f: (typeof FRAMES)[number]) => ({ id: f.id, name: f.name, type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 600, height: f.h } });
      return NextResponse.json({
        name: 'Blessed Botanicals, Q4 emails',
        document: { children: [{ id: '10:0', name: 'October', type: 'CANVAS', children: FRAMES.slice(0, 3).map(node) }, { id: '20:0', name: 'Holiday', type: 'CANVAS', children: FRAMES.slice(3).map(node) }] },
      });
    }
    if (rest[0] === 'images') {
      const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean);
      const scale = Number(url.searchParams.get('scale') ?? '1');
      return NextResponse.json({ err: null, images: Object.fromEntries(ids.map((id) => [id, `${origin}/api/dev/mock/figma/render?id=${encodeURIComponent(id)}&scale=${scale}`])) });
    }
    if (rest[0] === 'render') {
      const png = await framePng(url.searchParams.get('id') ?? '10:1', Number(url.searchParams.get('scale') ?? '1'));
      return new NextResponse(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
    }
  }

  if (service === 'klaviyo') {
    if (!/^Klaviyo-API-Key pk_/.test(req.headers.get('authorization') ?? '')) return NextResponse.json({ errors: [{ detail: 'Invalid API key' }] }, { status: 401 });
    if (rest[0] === 'metrics') return NextResponse.json({ data: [{ id: 'METRIC1', attributes: { name: 'Placed Order', integration: { name: 'Shopify' } } }] });
    if (rest[0] === 'campaigns') {
      const c = (id: string, name: string, status: string, when: string, subject: string) => ({ id, type: 'campaign', attributes: { name, status, send_time: when, scheduled_at: when }, relationships: { 'campaign-messages': { data: [{ id: `m-${id}` }] } } , _subject: subject });
      const list = [
        c('K1', 'Liver + Candida Cleanse 20% Off, EM2 (Plain Text)', 'Sent', '2026-09-19T15:00:00Z', 'Your cleanse, 20% off ends tonight'),
        c('K2', '64% of You Come Back. We Asked Why.', 'Sent', '2026-09-12T15:00:00Z', '64% of you come back. Here is why.'),
        c('K3', 'Last Chance: Buy Any 2, Save 15%', 'Sent', '2026-08-01T15:00:00Z', 'Last chance: buy any 2, save 15%'),
        c('K4', 'Moringa Restock Alert', 'Sent', '2026-09-05T15:00:00Z', 'Moringa is back'),
        c('K5', 'Fall Immune Support, EM1', 'Scheduled', '2026-10-02T15:00:00Z', 'Get ready for the first cool week'),
      ];
      return NextResponse.json({
        data: list.map(({ _subject, ...rest2 }) => rest2),
        included: list.map((x) => ({ type: 'campaign-message', id: `m-${x.id}`, attributes: { definition: { content: { subject: x._subject } } } })),
        links: { next: null },
      });
    }
  }

  if (service === 'sheet') {
    const tz = 'America/Chicago';
    const t = todayYmd(tz);
    const us = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}/${ymd.slice(0, 4)}`;
    const rows = [
      ['ECD content calendar', '', '', ''],
      ['Send Date', 'Client', 'Campaign', 'Status'],
      [us(addDays(t, 2)), 'Blessed Botanicals', 'Sea Moss Spotlight', 'Designing'],
      [us(addDays(t, 5)), 'Blessed Botanicals', 'October Promo, EM1', 'Planned'],
      [us(addDays(t, 6)), 'HigherDOSE', 'Sauna Blanket Launch', 'Planned'],
      [us(addDays(t, 9)), 'Blessed Botanicals', 'October Promo, EM2', 'Planned'],
      [us(addDays(t, 11)), 'Blessed Botanicals', 'Cancelled idea', 'Cancelled'],
      [us(addDays(t, 40)), 'Blessed Botanicals', 'Holiday Gift Guide', 'Planned'],
    ];
    const csv = rows.map((r) => r.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  return off();
}

export async function POST(req: Request, ctx: Ctx) {
  if (env('ENABLE_DEV_MOCKS') !== '1') return off();
  const { path } = await ctx.params;
  if (path[0] === 'klaviyo' && path[1] === 'campaign-values-reports') {
    if (!/^Klaviyo-API-Key pk_/.test(req.headers.get('authorization') ?? '')) return NextResponse.json({ errors: [{ detail: 'Invalid API key' }] }, { status: 401 });
    const s = (id: string, recipients: number, open: number, click: number, revenue: number, orders: number) => ({
      groupings: { campaign_id: id, send_channel: 'email', campaign_message_id: `m-${id}` },
      statistics: { recipients, delivered: Math.round(recipients * 0.99), opens_unique: Math.round(recipients * 0.99 * open), open_rate: open, clicks_unique: Math.round(recipients * 0.99 * click), click_rate: click, unsubscribes: Math.round(recipients * 0.002), bounce_rate: 0.01, conversions: orders, conversion_value: revenue },
    });
    return NextResponse.json({ data: { type: 'campaign-values-report', attributes: { results: [s('K1', 18420, 0.46, 0.031, 6210.5, 74), s('K2', 18105, 0.52, 0.024, 3388, 41), s('K3', 17650, 0.41, 0.038, 9120.25, 118), s('K4', 9020, 0.57, 0.061, 4875, 66)] } } });
  }
  return off();
}
