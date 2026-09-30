import { db } from '@/lib/db';
import { hashToken, looksLikeToken } from '@/lib/tokens';
import { redirect } from 'next/navigation';
import { PinForm } from '@/components/PinForm';

export const dynamic = 'force-dynamic';

export default async function PinPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  if (!looksLikeToken(token)) redirect('/link-expired');
  const reviewer = await db.reviewer.findUnique({ where: { tokenHash: hashToken(token) }, include: { workspace: true } });
  if (!reviewer || reviewer.revokedAt) redirect('/link-expired');
  if (!reviewer.pinHash) redirect(`/r/${encodeURIComponent(token)}`);
  return <PinForm field="token" value={token} workspaceName={reviewer.workspace.name} error={!!sp.error} />;
}
