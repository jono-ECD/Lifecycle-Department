import { z } from 'zod';

const TZ = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Unknown timezone.');

export const WorkspaceFields = z.object({
  name: z.string().trim().min(1, 'Give the workspace a name.').max(120),
  slug: z.string().trim().max(60).optional(),
  timezone: TZ.default('America/Chicago'),
  windowDays: z.coerce.number().int().min(7).max(60).default(14),
  maxPerDay: z.coerce.number().int().min(1).max(5).default(1),
  brandColor: z.string().trim().max(40).optional(),
});
