// Klaviyo REST API over plain fetch. One private key per client account, set in Connections.
// Endpoints and shapes follow revision 2026-07-15.
import { env } from '@/lib/env';

const REVISION = '2026-07-15';
const base = () => env('KLAVIYO_API_BASE', 'https://a.klaviyo.com/api').replace(/\/$/, '');

export interface KlaviyoCampaignInfo {
  id: string;
  name: string;
  status: string;
  sendTime: string | null;
  scheduledAt: string | null;
  subject: string | null;
}

export interface KlaviyoStats {
  recipients: number | null;
  delivered: number | null;
  opens: number | null;
  openRate: number | null;
  clicks: number | null;
  clickRate: number | null;
  unsubscribes: number | null;
  bounceRate: number | null;
  conversions: number | null;
  revenue: number | null;
}

export const SENT_STATUSES = ['Sent', 'Variations Sent', 'Sending', 'Sending Segments'];

export class KlaviyoError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class KlaviyoClient {
  constructor(
    private apiKey: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async call<T>(method: string, pathOrUrl: string, body?: unknown): Promise<T> {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${base()}${pathOrUrl}`;
    const r = await this.fetchImpl(url, {
      method,
      headers: { Authorization: `Klaviyo-API-Key ${this.apiKey}`, revision: REVISION, Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      const detail = text.match(/"detail"\s*:\s*"([^"]+)"/)?.[1];
      const msg = r.status === 401 || r.status === 403 ? 'Klaviyo rejected the key. Check that it is a private key with campaigns, metrics and reporting read access.' : r.status === 429 ? 'Klaviyo asked us to slow down. Metrics refresh again on the next sync.' : `Klaviyo ${r.status}${detail ? `: ${detail}` : ''}`;
      throw new KlaviyoError(r.status, msg);
    }
    return (await r.json()) as T;
  }

  /** Email campaigns, newest first, with subject lines. Follows pagination up to maxPages. */
  async campaigns(maxPages = 5): Promise<KlaviyoCampaignInfo[]> {
    type Page = {
      data: { id: string; attributes: { name: string; status: string; send_time: string | null; scheduled_at: string | null }; relationships?: { 'campaign-messages'?: { data: { id: string }[] } } }[];
      included?: { type: string; id: string; attributes: { definition?: { content?: { subject?: string } }; content?: { subject?: string } } }[];
      links?: { next?: string | null };
    };
    const out: KlaviyoCampaignInfo[] = [];
    let next: string | null = `/campaigns?filter=${encodeURIComponent("equals(messages.channel,'email')")}&include=campaign-messages&sort=-scheduled_at`;
    for (let page = 0; next && page < maxPages; page++) {
      const res: Page = await this.call<Page>('GET', next);
      const subjects = new Map((res.included ?? []).filter((i) => i.type === 'campaign-message').map((i) => [i.id, i.attributes.definition?.content?.subject ?? i.attributes.content?.subject ?? null]));
      for (const c of res.data) {
        const msgId = c.relationships?.['campaign-messages']?.data?.[0]?.id;
        out.push({ id: c.id, name: c.attributes.name, status: c.attributes.status, sendTime: c.attributes.send_time, scheduledAt: c.attributes.scheduled_at, subject: (msgId && subjects.get(msgId)) || null });
      }
      next = res.links?.next ?? null;
    }
    return out;
  }

  /** The metric revenue is attributed to. "Placed Order" when the account has it. */
  async conversionMetricId(): Promise<{ id: string; isOrder: boolean } | null> {
    type Res = { data: { id: string; attributes: { name: string; integration?: { name?: string } } }[] };
    const res = await this.call<Res>('GET', '/metrics');
    const orders = res.data.filter((m) => m.attributes.name === 'Placed Order');
    const preferred = orders.find((m) => /shopify|woocommerce|bigcommerce|magento/i.test(m.attributes.integration?.name ?? '')) ?? orders[0];
    if (preferred) return { id: preferred.id, isOrder: true };
    return res.data[0] ? { id: res.data[0].id, isOrder: false } : null;
  }

  /** Results per campaign for the last 12 months, in one call. Variations are added up. */
  async campaignValues(conversionMetricId: string, hasRevenue = true): Promise<Map<string, KlaviyoStats>> {
    type Res = { data: { attributes: { results: { groupings: { campaign_id?: string }; statistics: Record<string, number | null> }[] } } };
    const res = await this.call<Res>('POST', '/campaign-values-reports', {
      data: {
        type: 'campaign-values-report',
        attributes: {
          timeframe: { key: 'last_12_months' },
          conversion_metric_id: conversionMetricId,
          statistics: ['recipients', 'delivered', 'opens_unique', 'open_rate', 'clicks_unique', 'click_rate', 'unsubscribes', 'bounce_rate', 'conversions', 'conversion_value'],
        },
      },
    });
    const byCampaign = new Map<string, KlaviyoStats & { n: number }>();
    for (const r of res.data.attributes.results ?? []) {
      const id = r.groupings.campaign_id;
      if (!id) continue;
      const s = r.statistics;
      const cur = byCampaign.get(id) ?? { recipients: 0, delivered: 0, opens: 0, openRate: null, clicks: 0, clickRate: null, unsubscribes: 0, bounceRate: null, conversions: 0, revenue: 0, n: 0 };
      const add = (a: number | null, b: number | null | undefined) => (a ?? 0) + (b ?? 0);
      cur.recipients = add(cur.recipients, s.recipients);
      cur.delivered = add(cur.delivered, s.delivered);
      cur.opens = add(cur.opens, s.opens_unique);
      cur.clicks = add(cur.clicks, s.clicks_unique);
      cur.unsubscribes = add(cur.unsubscribes, s.unsubscribes);
      cur.conversions = add(cur.conversions, s.conversions);
      cur.revenue = add(cur.revenue, s.conversion_value);
      cur.bounceRate = cur.n === 0 ? (s.bounce_rate ?? null) : cur.bounceRate;
      cur.n++;
      byCampaign.set(id, cur);
    }
    const out = new Map<string, KlaviyoStats>();
    for (const [id, c] of byCampaign) {
      const delivered = c.delivered ?? 0;
      out.set(id, {
        recipients: c.recipients,
        delivered: c.delivered,
        opens: c.opens,
        openRate: delivered > 0 ? (c.opens ?? 0) / delivered : null,
        clicks: c.clicks,
        clickRate: delivered > 0 ? (c.clicks ?? 0) / delivered : null,
        unsubscribes: c.unsubscribes,
        bounceRate: c.bounceRate,
        conversions: hasRevenue ? c.conversions : null,
        revenue: hasRevenue ? c.revenue : null,
      });
    }
    return out;
  }
}
