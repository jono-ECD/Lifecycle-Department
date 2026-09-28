import { redirect } from 'next/navigation';
import { currentReviewer } from '@/lib/auth';
import { loadHistory } from '@/lib/history';
import { History } from '@/components/History';

export const dynamic = 'force-dynamic';

// What has been sent and how it did, for the client.
export default async function ReviewerHistoryPage() {
  const reviewer = await currentReviewer();
  if (!reviewer) redirect('/link-expired');
  return <History data={await loadHistory(reviewer.workspace)} backHref="/bank" admin={false} />;
}
