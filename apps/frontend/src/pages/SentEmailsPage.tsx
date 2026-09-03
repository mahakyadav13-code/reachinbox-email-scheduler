import { Send } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { MailboxView } from '../components/email/MailboxView';

/**
 * No status tabs here: the sent listing intentionally returns both `sent` and
 * `failed` together, and the API does not filter that endpoint by status. Each
 * row carries a status pill instead, and search covers the whole history.
 */
export function SentEmailsPage() {
  return (
    <AppShell title="Sent" description="Delivery history and failures" fullBleed>
      <MailboxView
        mailbox="sent"
        emptyIcon={Send}
        emptyTitle="No sent messages yet"
        emptyDescription="Once the worker processes a scheduled batch, every delivery attempt shows up here."
      />
    </AppShell>
  );
}
