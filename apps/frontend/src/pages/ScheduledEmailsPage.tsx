import { Clock } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { MailboxView } from '../components/email/MailboxView';
import type { TabItem } from '../components/ui/Misc';

/**
 * Status values map directly to the API's `status` query parameter, which the
 * repository constrains to the scheduled set (pending | processing | delayed).
 */
const TABS: TabItem<string>[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Queued' },
  { value: 'processing', label: 'Sending' },
  { value: 'delayed', label: 'Rescheduled' },
];

export function ScheduledEmailsPage() {
  return (
    <AppShell
      title="Scheduled"
      description="Messages waiting on the queue"
      fullBleed
    >
      <MailboxView
        mailbox="scheduled"
        tabs={TABS}
        emptyIcon={Clock}
        emptyTitle="Nothing scheduled"
        emptyDescription="Queued messages appear here with their send time. Use Compose to schedule a batch."
      />
    </AppShell>
  );
}
