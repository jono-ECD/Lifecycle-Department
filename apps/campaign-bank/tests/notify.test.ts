import { describe, expect, it } from 'vitest';
import { copyIsClean, digestSubject, reminderDue, reminderSubject, selectDigest, selectReminders } from '@/lib/notify/rules';
import { renderMail } from '@/lib/mail/templates';
import { ResendTransport } from '@/lib/mail/resend';
import { signEmailLink, verifyEmailLink, hashToken, newToken, looksLikeToken } from '@/lib/tokens';
import { NOTE_REQUIRED, toastFor, threadLineFor, actionsFor } from '@/lib/transitions';
import { STATUS_KEYS } from '@/lib/status';

const now = new Date('2026-09-25T15:00:00Z');
const min = (n: number) => new Date(now.getTime() - n * 60000);
const c = (id: string, enteredMinAgo: number | null, notified = false, status = 'review') => ({
  id,
  status,
  reviewEnteredAt: enteredMinAgo === null ? null : min(enteredMinAgo),
  reviewNotifiedAt: notified ? min(1) : null,
});

describe('review digest batching', () => {
  it('waits for the batch window, then sends everything that is pending in one go', () => {
    const list = [c('a', 12), c('b', 11), c('c', 2)];
    expect(selectDigest(list, now, 10 * 60000).map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('skips campaigns already notified or no longer in review', () => {
    const list = [c('a', 30, true), c('b', 30, false, 'approved'), c('d', 30)];
    expect(selectDigest(list, now, 10 * 60000).map((x) => x.id)).toEqual(['d']);
  });
  it('force sends pending ones regardless of age', () => {
    expect(selectDigest([c('a', 1)], now, 10 * 60000, true)).toHaveLength(1);
  });
  it('subject counts everything in review', () => {
    expect(digestSubject(1)).toBe('1 campaign ready for your review');
    expect(digestSubject(3)).toBe('3 campaigns ready for your review');
  });
});

describe('reminders', () => {
  it('picks campaigns in review for 3 days or more', () => {
    const list = [c('old', 3 * 1440), c('older', 5 * 1440), c('new', 2 * 1440), c('done', 9 * 1440, false, 'approved')];
    expect(selectReminders(list, now).map((x) => x.id)).toEqual(['old', 'older']);
  });
  it('is due once a day from 9:00 workspace time', () => {
    // 15:00 UTC is 10:00 in Chicago
    expect(reminderDue('America/Chicago', now, false)).toBe(true);
    expect(reminderDue('America/Chicago', now, true)).toBe(false);
    // 13:00 UTC is 8:00 in Chicago
    expect(reminderDue('America/Chicago', new Date('2026-09-25T13:00:00Z'), false)).toBe(false);
  });
  it('subject has no guilt', () => {
    expect(reminderSubject(2)).toBe('2 campaigns are ready when you are');
    expect(copyIsClean(reminderSubject(2))).toBe(true);
  });
});

describe('email template', () => {
  it('renders html and text with the items and the link', () => {
    const { html, text } = renderMail({
      heading: '1 campaign ready for your review',
      intro: 'Approve it, ask for a change, or park it for later.',
      items: [{ name: 'Not Sure <Where> to Begin?', sub: 'Four best sellers', thumbUrl: 'http://x/t.jpg', line: 'Note: swap hero' }],
      cta: { label: 'Open the bank', url: 'http://x/e/abc' },
    });
    expect(html).toContain('Not Sure &lt;Where&gt; to Begin?');
    expect(html).toContain('http://x/t.jpg');
    expect(html).toContain('http://x/e/abc');
    expect(text).toContain('Open the bank: http://x/e/abc');
    expect(text).toContain('Note: swap hero');
  });
});

describe('client facing copy follows section 11', () => {
  it('toasts, thread lines, action labels and captions have no dashes or exclamation marks', () => {
    for (const s of STATUS_KEYS) {
      for (const a of actionsFor(s, 'reviewer')) {
        expect(copyIsClean(a.label)).toBe(true);
        expect(copyIsClean(a.small)).toBe(true);
        expect(copyIsClean(toastFor(a.action, '2026-09-30'))).toBe(true);
        expect(copyIsClean(threadLineFor(a.action, '2026-09-30'))).toBe(true);
      }
    }
    expect(copyIsClean(NOTE_REQUIRED)).toBe(true);
  });
});

describe('resend transport', () => {
  it('posts to the Resend API with the key and returns the id', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return new Response(JSON.stringify({ id: 'em_123' }), { status: 200 });
    }) as typeof fetch;
    const t = new ResendTransport('re_test', fake);
    const res = await t.send({ from: 'bank@ecd.test', to: ['a@b.c'], subject: 'Hi', html: '<p>x</p>', text: 'x' });
    expect(res.id).toBe('em_123');
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ to: ['a@b.c'], subject: 'Hi' });
  });
  it('throws on a non 2xx response', async () => {
    const fake = (async () => new Response('nope', { status: 403 })) as unknown as typeof fetch;
    await expect(new ResendTransport('k', fake).send({ from: 'a', to: ['b'], subject: 's', html: '', text: '' })).rejects.toThrow(/403/);
  });
});

describe('tokens', () => {
  it('personal tokens are random, url safe, and only the hash is comparable', () => {
    const t = newToken();
    expect(looksLikeToken(t)).toBe(true);
    expect(t).not.toBe(newToken());
    expect(hashToken(t)).toHaveLength(64);
    expect(hashToken(t)).toBe(hashToken(t));
  });
  it('email links verify, expire, and reject tampering', () => {
    const sig = signEmailLink('cmuhk9ly00003lk2k0ik2ie3g', 45, now);
    expect(verifyEmailLink(sig, now)).toEqual({ reviewerId: 'cmuhk9ly00003lk2k0ik2ie3g' });
    expect(verifyEmailLink(sig, new Date(now.getTime() + 46 * 86400000))).toBeNull();
    expect(verifyEmailLink(sig.slice(0, -2) + 'zz', now)).toBeNull();
    expect(verifyEmailLink(sig.replace('cmuhk9ly00003lk2k0ik2ie3g', 'cmuhk9ly00003lk2k0ik2ie3h'), now)).toBeNull();
    expect(verifyEmailLink('garbage', now)).toBeNull();
  });
});
