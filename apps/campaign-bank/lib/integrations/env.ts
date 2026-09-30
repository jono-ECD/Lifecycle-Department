import { env } from '@/lib/env';

/** Which agency level tokens are present. Shown on the Integrations page, never the values. */
export function envStatus() {
  return { asanaToken: !!env('ASANA_ACCESS_TOKEN'), figmaToken: !!env('FIGMA_ACCESS_TOKEN'), resend: !!env('RESEND_API_KEY') };
}
