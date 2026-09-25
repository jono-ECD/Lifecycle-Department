import { redirect } from 'next/navigation';
import { currentReviewer } from '@/lib/auth';
import { loadBank } from '@/lib/bank';
import { Bank } from '@/components/Bank';

export const dynamic = 'force-dynamic';

// The reviewer's bank. The session cookie was set by /r/<token>.
export default async function ReviewerBankPage() {
  const reviewer = await currentReviewer();
  if (!reviewer) redirect('/link-expired');
  const bank = await loadBank(reviewer.workspace, { role: 'reviewer', reviewer, name: reviewer.name, id: reviewer.id });
  return <Bank initial={bank} />;
}
