// Figma REST API groundwork. With FIGMA_ACCESS_TOKEN set, a campaign can pull a frame straight from
// a Figma link as a new version. Comments can be listed for a later import.

const API = 'https://api.figma.com/v1';

export interface FigmaRef {
  fileKey: string;
  nodeId: string | null;
}

/** Accepts file, design and proto links, with or without node-id. Node ids arrive as 12-34 and become 12:34. */
export function parseFigmaUrl(url: string): FigmaRef | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)figma\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/(?:file|design|proto|board)\/([A-Za-z0-9]+)/);
  if (!m) return null;
  const raw = u.searchParams.get('node-id');
  const nodeId = raw ? decodeURIComponent(raw).replace('-', ':') : null;
  return { fileKey: m[1], nodeId };
}

export class FigmaClient {
  constructor(
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async get<T>(path: string): Promise<T> {
    const r = await this.fetchImpl(`${API}${path}`, { headers: { 'X-Figma-Token': this.token } });
    if (!r.ok) throw new Error(`Figma ${r.status}: ${(await r.text().catch(() => '')).slice(0, 300)}`);
    return (await r.json()) as T;
  }

  /** Renders a node as PNG at 2x and returns the bytes. */
  async nodeImage(fileKey: string, nodeId: string, scale = 2): Promise<Buffer> {
    const res = await this.get<{ err: string | null; images: Record<string, string | null> }>(`/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${scale}`);
    const url = res.images[nodeId];
    if (res.err || !url) throw new Error(res.err || 'Figma did not return an image for that frame.');
    const img = await this.fetchImpl(url);
    if (!img.ok) throw new Error(`Figma image download ${img.status}`);
    return Buffer.from(await img.arrayBuffer());
  }

  /** Top level frames of the first page, for a picker later. */
  async frames(fileKey: string): Promise<{ id: string; name: string }[]> {
    const res = await this.get<{ document: { children: { children?: { id: string; name: string; type: string }[] }[] } }>(`/files/${fileKey}?depth=2`);
    const page = res.document.children[0];
    return (page?.children ?? []).filter((n) => n.type === 'FRAME' || n.type === 'COMPONENT').map((n) => ({ id: n.id, name: n.name }));
  }

  /** Existing Figma comments, with their node and position when present. */
  async comments(fileKey: string): Promise<{ id: string; message: string; user: string; createdAt: string; nodeId: string | null; x: number | null; y: number | null; resolved: boolean }[]> {
    const res = await this.get<{ comments: { id: string; message: string; user: { handle: string }; created_at: string; resolved_at: string | null; client_meta: { node_id?: string; node_offset?: { x: number; y: number } } | null }[] }>(`/files/${fileKey}/comments`);
    return res.comments.map((c) => ({
      id: c.id,
      message: c.message,
      user: c.user.handle,
      createdAt: c.created_at,
      nodeId: c.client_meta?.node_id ?? null,
      x: c.client_meta?.node_offset?.x ?? null,
      y: c.client_meta?.node_offset?.y ?? null,
      resolved: !!c.resolved_at,
    }));
  }
}
