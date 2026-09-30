// Stand in for Asana, for sample mode and tests. Only answers when ENABLE_DEV_MOCKS=1.
// It remembers Stage changes, comments and subtasks in memory, so a test can check what the Bank wrote.
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { addDays, todayYmd } from '@/lib/dates';

type Ctx = { params: Promise<{ path: string[] }> };

const STAGE_FIELD = '900001';
const OLD_STAGE_FIELD = '900002';
const CHANNEL_FIELD = '900003';
const STAGE: Record<string, string> = { '910001': 'Copy', '910002': 'Design', '910003': 'Client Review', '910004': 'Edits In Progress', '910005': 'Build in Klaviyo', '910006': 'Scheduled in Klaviyo', '910007': 'Done', '910008': 'On Hold | Canceled' };
const CHANNEL: Record<string, string> = { '920001': 'Email', '920002': 'SMS', '920003': 'Flow' };

interface State {
  stage: Record<string, string>;
  log: { kind: string; task: string; text?: string; option?: string; name?: string }[];
  next: number;
}
const g = globalThis as unknown as { __asanaMock?: State };
const state = (): State => (g.__asanaMock ??= { stage: {}, log: [], next: 810001 });

const off = () => NextResponse.json({ error: 'Not found' }, { status: 404 });
const authed = (req: Request) => /^Bearer \S+/.test(req.headers.get('authorization') ?? '');
const denied = () => NextResponse.json({ errors: [{ message: 'Not Authorized' }] }, { status: 401 });

function tasks() {
  const today = todayYmd('America/Chicago');
  const t = (gid: string, name: string, stage: string, channel: string, due: number, notes: string) => ({
    gid,
    name,
    notes,
    due_on: addDays(today, due),
    completed: false,
    permalink_url: `https://app.asana.com/0/700001/${gid}`,
    custom_fields: [
      { gid: STAGE_FIELD, name: 'Stage', enum_value: { gid: state().stage[gid] ?? stage, name: STAGE[state().stage[gid] ?? stage] } },
      { gid: OLD_STAGE_FIELD, name: 'Stage', enum_value: { gid: '930001', name: 'Backlog' } },
      { gid: CHANNEL_FIELD, name: 'Channel', enum_value: { gid: channel, name: CHANNEL[channel] } },
    ],
  });
  return [
    t('800001', 'Holiday Gift Guide', '910003', '920001', 6, 'Brief: https://docs.example.com/brief\nCopy doc: https://docs.example.com/copy\nDesign: https://www.figma.com/design/SampleFileKey123/Q4-emails?node-id=20-1\nKlaviyo: https://www.klaviyo.com/campaign/K9/holiday-gift-guide'),
    t('800002', 'Winter Wellness Tips', '910001', '920001', 10, 'Brief: https://docs.example.com/brief2\nDesign:\nKlaviyo:'),
    t('800003', 'Flash Sale Text', '910003', '920002', 4, 'Klaviyo: K10\nCopy: Blessed Botanicals: 20% off everything until midnight.\nShop now: https://bb.example.com/flash'),
    t('800004', 'Welcome Flow, Email 2', '910002', '920003', 12, 'Design: https://www.figma.com/design/SampleFileKey123/Q4-emails?node-id=10-3'),
  ];
}

export async function GET(req: Request, ctx: Ctx) {
  if (env('ENABLE_DEV_MOCKS') !== '1') return off();
  const { path } = await ctx.params;
  if (path[0] === '_log') return NextResponse.json(state());
  if (path[0] === '_reset') {
    g.__asanaMock = { stage: {}, log: [], next: 810001 };
    return NextResponse.json({ ok: true });
  }
  if (!authed(req)) return denied();
  if (path[0] === 'users' && path[1] === 'me') return NextResponse.json({ data: { gid: '1', name: 'ECD Campaign Bank' } });
  if (path[0] === 'projects' && path[2] === 'custom_field_settings') {
    const opts = (m: Record<string, string>) => Object.entries(m).map(([gid, name]) => ({ gid, name, enabled: true }));
    return NextResponse.json({
      data: [
        { custom_field: { gid: STAGE_FIELD, name: 'Stage', resource_subtype: 'enum', enum_options: opts(STAGE) } },
        { custom_field: { gid: OLD_STAGE_FIELD, name: 'Stage', resource_subtype: 'enum', enum_options: [{ gid: '930001', name: 'Backlog', enabled: true }, { gid: '930002', name: 'Doing', enabled: true }] } },
        { custom_field: { gid: CHANNEL_FIELD, name: 'Channel', resource_subtype: 'enum', enum_options: opts(CHANNEL) } },
      ],
    });
  }
  if (path[0] === 'projects') return NextResponse.json({ data: { gid: path[1], name: 'Blessed Botanicals campaigns' } });
  if (path[0] === 'tasks' && path.length === 1) return NextResponse.json({ data: tasks(), next_page: null });
  return off();
}

export async function POST(req: Request, ctx: Ctx) {
  if (env('ENABLE_DEV_MOCKS') !== '1') return off();
  if (!authed(req)) return denied();
  const { path } = await ctx.params;
  const s = state();
  if (path[0] === 'attachments') {
    const form = await req.formData();
    s.log.push({ kind: 'attachment', task: String(form.get('parent')), name: (form.get('file') as File | null)?.name });
    return NextResponse.json({ data: { gid: String(s.next++) } });
  }
  const body = ((await req.json().catch(() => ({}))) as { data?: { text?: string; name?: string } }).data ?? {};
  if (path[0] === 'tasks' && path[2] === 'stories') {
    s.log.push({ kind: 'comment', task: path[1], text: body.text });
    return NextResponse.json({ data: { gid: String(s.next++) } });
  }
  if (path[0] === 'tasks' && path[2] === 'subtasks') {
    const gid = String(s.next++);
    s.log.push({ kind: 'subtask', task: path[1], name: body.name, text: gid });
    return NextResponse.json({ data: { gid } });
  }
  if (path[0] === 'tasks' && path.length === 1) {
    const gid = String(s.next++);
    s.log.push({ kind: 'task', task: gid, name: body.name });
    return NextResponse.json({ data: { gid } });
  }
  return off();
}

export async function PUT(req: Request, ctx: Ctx) {
  if (env('ENABLE_DEV_MOCKS') !== '1') return off();
  if (!authed(req)) return denied();
  const { path } = await ctx.params;
  const body = ((await req.json().catch(() => ({}))) as { data?: { custom_fields?: Record<string, string>; completed?: boolean } }).data ?? {};
  if (path[0] === 'tasks' && path[1]) {
    const option = body.custom_fields?.[STAGE_FIELD];
    if (option) {
      if (!STAGE[option]) return NextResponse.json({ errors: [{ message: 'Unknown enum option' }] }, { status: 400 });
      state().stage[path[1]] = option;
      state().log.push({ kind: 'stage', task: path[1], option, name: STAGE[option] });
    }
    if (typeof body.completed === 'boolean') state().log.push({ kind: body.completed ? 'completed' : 'reopened', task: path[1] });
    return NextResponse.json({ data: { gid: path[1] } });
  }
  return off();
}
