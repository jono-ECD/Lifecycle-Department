import { describe, expect, it } from 'vitest';
import { buildSlackMessage, isSlackWebhook, postSlack } from '@/lib/integrations/slack';
import { AsanaClient, buildAsanaReply, buildAsanaTask } from '@/lib/integrations/asana';
import { FigmaClient, parseFigmaUrl } from '@/lib/integrations/figma';
import { postWebhook, signBody } from '@/lib/integrations/webhook';
import { cropBox, describePosition } from '@/lib/integrations/describe';
import { contextLine, headline, type EventPayload } from '@/lib/integrations/types';
import { copyIsClean } from '@/lib/notify/rules';

const base: EventPayload = {
  type: 'pin_created',
  workspace: { id: 'w1', name: 'Blessed Botanicals', slug: 'blessed-botanicals' },
  campaign: { id: 'c1', name: 'Not Sure Where to Begin?', subtitle: 'Four best sellers', status: 'review', version: 2 },
  actor: { role: 'reviewer', name: 'Brittany' },
  text: 'Swap the hero photo.\nThe bottles look dark.',
  em: { index: 1, count: 2 },
  pin: { threadId: 't1', number: 3, position: 'top left', cropUrl: 'https://bank.example.com/files/crop.jpg', x: 0.1, y: 0.1, w: null, h: null },
  links: { admin: 'https://bank.example.com/admin/w/blessed-botanicals?c=c1&pin=3', reviewer: 'https://bank.example.com/bank?c=c1&pin=3' },
  at: '2026-09-25T20:00:00Z',
};

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  }) as typeof fetch;
  return { fn, calls };
}

describe('headline and context', () => {
  it('reads like a sentence with the client name and campaign', () => {
    expect(headline(base)).toBe('Brittany left note 3 on Not Sure Where to Begin?');
    expect(headline({ ...base, type: 'change_request' })).toBe('Brittany requested changes on Not Sure Where to Begin?');
    expect(headline({ ...base, type: 'scheduled', date: 'Oct 3' })).toBe('Brittany scheduled Not Sure Where to Begin? for Oct 3');
    expect(contextLine(base)).toBe('Blessed Botanicals · EM1 of 2 · version 2 · top left, note 3');
  });
});

describe('Slack message', () => {
  it('quotes the client verbatim, adds context, the crop and a button', () => {
    const m = buildSlackMessage(base);
    expect(m.text).toContain('Brittany left note 3');
    const types = m.blocks.map((b) => b.type);
    expect(types).toEqual(['header', 'section', 'context', 'image', 'actions']);
    const section = m.blocks[1] as { text: { text: string } };
    expect(section.text.text).toBe('>Swap the hero photo.\n>The bottles look dark.');
    const actions = m.blocks[4] as { elements: { url: string }[] };
    expect(actions.elements[0].url).toBe(base.links.admin);
  });
  it('keeps status updates to one line', () => {
    const m = buildSlackMessage({ ...base, type: 'approved', text: undefined, pin: undefined });
    expect(m.blocks.map((b) => b.type)).toEqual(['section', 'actions']);
    expect((m.blocks[0] as { text: { text: string } }).text.text).toContain('Brittany approved Not Sure Where to Begin?');
  });
  it('skips the image when the crop is not https', () => {
    const m = buildSlackMessage({ ...base, pin: { ...base.pin!, cropUrl: 'http://localhost:3000/files/x.jpg' } });
    expect(m.blocks.map((b) => b.type)).not.toContain('image');
  });
  it('posts to the webhook and fails loudly', async () => {
    const ok = fakeFetch(() => new Response('ok'));
    await postSlack('https://hooks.slack.com/services/T/B/x', buildSlackMessage(base), ok.fn);
    expect(ok.calls[0].url).toBe('https://hooks.slack.com/services/T/B/x');
    expect(JSON.parse(ok.calls[0].init!.body as string).blocks.length).toBe(5);
    const bad = fakeFetch(() => new Response('invalid_payload', { status: 400 }));
    await expect(postSlack('https://hooks.slack.com/services/T/B/x', buildSlackMessage(base), bad.fn)).rejects.toThrow(/400/);
  });
  it('validates webhook urls', () => {
    expect(isSlackWebhook('https://hooks.slack.com/services/T000/B000/abc')).toBe(true);
    expect(isSlackWebhook('https://example.com/hook')).toBe(false);
  });
});

describe('Asana task', () => {
  it('puts the client words first and every piece of context after', () => {
    const t = buildAsanaTask(base);
    expect(t.name).toBe('Note 3: Not Sure Where to Begin? (EM1) · Blessed Botanicals');
    expect(t.notes.startsWith('Brittany wrote:\n"Swap the hero photo.\nThe bottles look dark."')).toBe(true);
    expect(t.notes).toContain('Email: EM1 of 2, version 2');
    expect(t.notes).toContain('Where: top left of the design, note 3');
    expect(t.notes).toContain(base.links.admin);
    expect(t.notes).toContain('Crop of the area: https://bank.example.com/files/crop.jpg');
  });
  it('names change requests', () => {
    expect(buildAsanaTask({ ...base, type: 'change_request', pin: undefined, em: undefined }).name).toBe('Change request: Not Sure Where to Begin? · Blessed Botanicals');
  });
  it('replies carry the words and the link', () => {
    expect(buildAsanaReply({ ...base, type: 'pin_reply', text: 'Also the footer.' })).toContain('"Also the footer."');
  });
  it('client calls the API with the token and data envelope', async () => {
    const f = fakeFetch((url) => new Response(JSON.stringify({ data: url.includes('/users/me') ? { gid: '1', name: 'Mauricio' } : { gid: '99' } })));
    const c = new AsanaClient('tok', f.fn);
    const task = await c.createTask({ projectGid: '123456', sectionGid: '777777', name: 'n', notes: 'x', assigneeEmail: 'a@b.c' });
    expect(task.gid).toBe('99');
    const body = JSON.parse(f.calls[0].init!.body as string);
    expect(body.data).toMatchObject({ name: 'n', projects: ['123456'], assignee: 'a@b.c', memberships: [{ project: '123456', section: '777777' }] });
    expect((f.calls[0].init!.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    await c.addComment('99', 'hi');
    expect(f.calls[1].url).toContain('/tasks/99/stories');
    await c.setCompleted('99', true);
    expect(JSON.parse(f.calls[2].init!.body as string).data.completed).toBe(true);
    expect((await c.me()).name).toBe('Mauricio');
  });
  it('attachments go as multipart with the parent task', async () => {
    const f = fakeFetch(() => new Response(JSON.stringify({ data: { gid: 'att' } })));
    await new AsanaClient('tok', f.fn).attach('99', Buffer.from('img'), 'note-3.jpg', 'image/jpeg');
    const form = f.calls[0].init!.body as FormData;
    expect(form.get('parent')).toBe('99');
    expect((form.get('file') as File).name).toBe('note-3.jpg');
  });
});

describe('Figma', () => {
  it('parses design, file and proto links and node ids', () => {
    expect(parseFigmaUrl('https://www.figma.com/design/AbC123xyz/Email?node-id=12-34&t=abc')).toEqual({ fileKey: 'AbC123xyz', nodeId: '12:34' });
    expect(parseFigmaUrl('https://www.figma.com/file/AbC123xyz/Email')).toEqual({ fileKey: 'AbC123xyz', nodeId: null });
    expect(parseFigmaUrl('https://figma.com/proto/K1/Name?node-id=1%3A2')).toEqual({ fileKey: 'K1', nodeId: '1:2' });
    expect(parseFigmaUrl('https://example.com/design/x')).toBeNull();
    expect(parseFigmaUrl('not a url')).toBeNull();
  });
  it('renders a node to PNG through the images endpoint', async () => {
    const f = fakeFetch((url) => (url.includes('/images/') ? new Response(JSON.stringify({ err: null, images: { '12:34': 'https://cdn.figma/x.png' } })) : new Response(new Uint8Array([1, 2, 3]))));
    const buf = await new FigmaClient('ft', f.fn).nodeImage('KEY', '12:34');
    expect(buf).toEqual(Buffer.from([1, 2, 3]));
    expect(f.calls[0].url).toBe('https://api.figma.com/v1/images/KEY?ids=12%3A34&format=png&scale=2');
    expect((f.calls[0].init!.headers as Record<string, string>)['X-Figma-Token']).toBe('ft');
  });
  it('lists comments with positions', async () => {
    const f = fakeFetch(() => new Response(JSON.stringify({ comments: [{ id: '1', message: 'Bigger logo', user: { handle: 'Brittany' }, created_at: '2026-09-01', resolved_at: null, client_meta: { node_id: '1:2', node_offset: { x: 10, y: 20 } } }] })));
    const list = await new FigmaClient('ft', f.fn).comments('KEY');
    expect(list[0]).toMatchObject({ message: 'Bigger logo', user: 'Brittany', nodeId: '1:2', x: 10, y: 20, resolved: false });
  });
});

describe('webhook', () => {
  it('signs the body and sets event headers', async () => {
    const f = fakeFetch(() => new Response('ok'));
    await postWebhook('https://hooks.zapier.com/x', 'secret', 'ev1', base, f.fn);
    const h = f.calls[0].init!.headers as Record<string, string>;
    expect(h['X-Bank-Event']).toBe('pin_created');
    expect(h['X-Bank-Signature']).toBe(signBody('secret', f.calls[0].init!.body as string));
    expect(JSON.parse(f.calls[0].init!.body as string).id).toBe('ev1');
  });
});

describe('positions and crops', () => {
  it('describes where on the design a note is', () => {
    expect(describePosition(0.1, 0.1)).toBe('top left');
    expect(describePosition(0.5, 0.5)).toBe('center');
    expect(describePosition(0.9, 0.95)).toBe('bottom right');
    expect(describePosition(0.5, 0.3)).toBe('upper center');
    expect(describePosition(0.2, 0.5)).toBe('middle left');
    expect(describePosition(0.0, 0.0, 0.4, 0.2)).toBe('top left');
  });
  it('crop windows stay inside the image', () => {
    const b = cropBox(0.02, 0.02, null, null, 0.5);
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
    expect(b.w).toBeCloseTo(0.32);
    const c = cropBox(0.9, 0.9, 0.2, 0.2, 1);
    expect(c.x + c.w).toBeLessThanOrEqual(1);
    expect(c.y + c.h).toBeLessThanOrEqual(1);
  });
  it('copy that clients see has no dashes or exclamation marks', () => {
    for (const s of ['Note pinned. ECD will see it.', 'Tap the design where the note goes. Drag to mark an area.', 'What should change here?', 'Leave a note on the design']) expect(copyIsClean(s)).toBe(true);
  });
});
