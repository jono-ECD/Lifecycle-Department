import { db } from '@/lib/db';
import { verifyEmailLink } from '@/lib/tokens';
import { redirect } from 'next/navigation';
import { PinForm } from '@/components/PinForm';

export const dynamic = 'force-dynamic';

export default async function EmailPinPage({ params, searchParams }: { params: Promise<{ sig: string }>; searchParams: Promise<{ error?: string }> }) {
  const { sig } = await params;
  const sp = await searchParams;
  const v = verifyEmailLink(sig);
  if (!v) redirect('/link-expired');
  const reviewer = await db.reviewer.findUnique({ where: { id: v.reviewerId }, include: { workspace: true } });
  if (!reviewer || reviewer.revokedAt) redirect('/link-expired');
  if (!reviewer.pinHash) redirect(`/e/${encodeURIComponent(sig)}`);
  return <PinForm field="sig" value={sig} workspaceName={reviewer.workspace.name} error={!!sp.error} />;
}
