// Stage binding, shared by the server and the Connections screen. No server imports here.

export interface AsanaEnumField {
  gid: string;
  name: string;
  options: { gid: string; name: string }[];
}

/** What the Bank needs to know about Stage, by option id. */
export interface StageMap {
  review?: string;
  changes?: string;
  approved?: string;
  hold?: string;
  scheduled?: string;
  sent?: string;
}

export const STAGE_KEYS: (keyof StageMap)[] = ['review', 'changes', 'approved', 'hold', 'scheduled', 'sent'];

export const STAGE_LABELS: Record<keyof StageMap, { label: string; hint: string; direction: 'in' | 'out' }> = {
  review: { label: 'Client Review', hint: 'Asana tells the Bank: show this to the client', direction: 'in' },
  changes: { label: 'Edits In Progress', hint: 'the Bank sets this when the client requests changes', direction: 'out' },
  approved: { label: 'Build in Klaviyo', hint: 'the Bank sets this when the client approves', direction: 'out' },
  hold: { label: 'On Hold', hint: 'the Bank sets this when the client puts it on hold', direction: 'out' },
  scheduled: { label: 'Scheduled in Klaviyo', hint: 'Asana tells the Bank: it is really scheduled', direction: 'in' },
  sent: { label: 'Done', hint: 'Asana tells the Bank: it went out', direction: 'in' },
};

const GUESS: Record<keyof StageMap, RegExp> = {
  review: /client\s*review/i,
  changes: /edits?\s*in\s*progress|revisions?/i,
  approved: /build\s*in\s*klaviyo/i,
  hold: /on\s*hold|cancel/i,
  scheduled: /scheduled/i,
  sent: /^done$|^sent$|complete/i,
};

/** A first guess from option names, for ECD to confirm. The stored mapping is by id. */
export function guessStageMap(field: AsanaEnumField): StageMap {
  const map: StageMap = {};
  for (const k of STAGE_KEYS) {
    const hit = field.options.find((o) => GUESS[k].test(o.name));
    if (hit) map[k] = hit.gid;
  }
  return map;
}

export function parseStageMap(json: string | null | undefined): StageMap {
  if (!json) return {};
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const out: StageMap = {};
    for (const k of STAGE_KEYS) if (typeof raw[k] === 'string' && /^\d+$/.test(raw[k] as string)) out[k] = raw[k] as string;
    return out;
  } catch {
    return {};
  }
}
