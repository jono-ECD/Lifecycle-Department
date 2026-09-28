// Figma REST API. With FIGMA_ACCESS_TOKEN set, ECD can browse a file's frames and import them as
// campaigns, or pull a fresh version of a campaign from its frames.
import { env } from '@/lib/env';

const api = () => env('FIGMA_API_BASE', 'https://api.figma.com/v1').replace(/\/$/, '');

export interface FigmaRef {
  fileKey: string;
  nodeId: string | null;
}

export interface FigmaFrame {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  thumbUrl: string | null;
}

export interface FigmaPage {
  id: string;
  name: string;
  frames: FigmaFrame[];
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

/** A file key on its own, or any Figma link. */
export function fileKeyFrom(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9]{10,}$/.test(s)) return s;
  return parseFigmaUrl(s)?.fileKey ?? null;
}

export function frameUrl(fileKey: string, nodeId: string): string {
  return `https://www.figma.com/design/${fileKey}/?node-id=${encodeURIComponent(nodeId.replace(':', '-'))}`;
}

export class FigmaClient {
  constructor(
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async get<T>(path: string): Promise<T> {
    const r = await this.fetchImpl(`${api()}${path}`, { headers: { 'X-Figma-Token': this.token } });
    if (!r.ok) {
      const msg = r.status === 403 ? 'Figma rejected the token, or the token cannot see this file.' : r.status === 404 ? 'Figma could not find that file. Check the link.' : r.status === 429 ? 'Figma asked us to slow down. Try again in a minute.' : `Figma ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`;
      throw new Error(msg);
    }
    return (await r.json()) as T;
  }

  /** Render URLs for many nodes in one call. Figma hosts them for a while. */
  async imageUrls(fileKey: string, nodeIds: string[], scale = 2): Promise<Record<string, string | null>> {
    if (nodeIds.length === 0) return {};
    const res = await this.get<{ err: string | null; images: Record<string, string | null> }>(`/images/${fileKey}?ids=${encodeURIComponent(nodeIds.join(','))}&format=png&scale=${scale}`);
    if (res.err) throw new Error(res.err);
    return res.images;
  }

  /** Renders a node as PNG at 2x and returns the bytes. */
  async nodeImage(fileKey: string, nodeId: string, scale = 2): Promise<Buffer> {
    const url = (await this.imageUrls(fileKey, [nodeId], scale))[nodeId];
    if (!url) throw new Error('Figma did not return an image for that frame.');
    return this.download(url);
  }

  async download(url: string): Promise<Buffer> {
    const img = await this.fetchImpl(url);
    if (!img.ok) throw new Error(`Figma image download ${img.status}`);
    return Buffer.from(await img.arrayBuffer());
  }

  /** Every page with its top level frames, with small thumbnails for the picker. */
  async pages(fileKey: string, withThumbs = true): Promise<{ name: string; pages: FigmaPage[] }> {
    type Node = { id: string; name: string; type: string; children?: Node[]; absoluteBoundingBox?: { width: number; height: number } };
    const res = await this.get<{ name: string; document: { children: Node[] } }>(`/files/${fileKey}?depth=2`);
    const pages: FigmaPage[] = res.document.children.map((p) => ({
      id: p.id,
      name: p.name,
      frames: (p.children ?? [])
        .filter((n) => n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'SECTION')
        .map((n) => ({ id: n.id, name: n.name, width: n.absoluteBoundingBox ? Math.round(n.absoluteBoundingBox.width) : null, height: n.absoluteBoundingBox ? Math.round(n.absoluteBoundingBox.height) : null, thumbUrl: null })),
    }));
    if (withThumbs) {
      const ids = pages.flatMap((p) => p.frames.map((f) => f.id)).slice(0, 120);
      const urls = await this.imageUrls(fileKey, ids, 0.25).catch(() => ({}) as Record<string, string | null>);
      for (const p of pages) for (const f of p.frames) f.thumbUrl = urls[f.id] ?? null;
    }
    return { name: res.name, pages: pages.filter((p) => p.frames.length > 0) };
  }

  /** Top level frames of the first page. Kept for the connection check. */
  async frames(fileKey: string): Promise<{ id: string; name: string }[]> {
    const { pages } = await this.pages(fileKey, false);
    return (pages[0]?.frames ?? []).map((f) => ({ id: f.id, name: f.name }));
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
