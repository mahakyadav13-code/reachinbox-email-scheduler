import { AlertTriangle, Clock, Mail, MailOpen, Send } from 'lucide-react';
import { EmailJob } from '../../types';
import { StatusPill } from '../ui/Badge';
import { Notice } from '../ui/Feedback';
import { Avatar, DetailRow } from '../ui/Misc';
import { formatDate, formatRelativeTime, statusMeta } from '../../lib/utils';

/** Shown in the detail pane before anything is selected. */
export function MessageDetailPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-hover">
        <MailOpen className="h-5 w-5 text-fg-subtle" aria-hidden />
      </span>
      <p className="text-sm font-medium text-fg-muted">No message selected</p>
      <p className="mt-1 max-w-xs text-sm text-fg-subtle">
        Pick a message from the list to see its recipient, delivery timing and full body.
      </p>
    </div>
  );
}

export function MessageDetail({ email }: { email: EmailJob }) {
  const meta = statusMeta(email.status);
  const isSent = Boolean(email.sentAt);

  return (
    <article className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-line px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="min-w-0 text-base font-semibold leading-snug text-fg">
            {email.subject}
          </h2>
          <StatusPill status={email.status} showHint />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Avatar email={email.recipientEmail} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-fg">{email.recipientEmail}</p>
            <p className="truncate text-xs text-fg-subtle">
              {email.sender ? `via ${email.sender.name} Â· ${email.sender.email}` : 'Recipient'}
            </p>
          </div>
        </div>

        {meta.hint && <p className="mt-3 text-xs leading-relaxed text-fg-subtle">{meta.hint}</p>}
      </header>

      {/* Body + metadata */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-slim">
        {email.status === 'failed' && email.failureReason && (
          <div className="px-6 pt-5">
            <Notice tone="danger" icon={AlertTriangle} title="Delivery failed">
              {email.failureReason}
            </Notice>
          </div>
        )}

        <section className="px-6 py-5">
          <dl className="divide-y divide-line">
            <DetailRow label="To">
              <span className="break-all">{email.recipientEmail}</span>
            </DetailRow>

            {email.sender && (
              <DetailRow label="From">
                <span className="break-all">
                  {email.sender.name} &lt;{email.sender.email}&gt;
                </span>
              </DetailRow>
            )}

            <DetailRow label={isSent ? 'Sent at' : 'Scheduled for'}>
              <span className="tabular inline-flex items-center gap-2">
                {isSent ? (
                  <Send className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
                )}
                {formatDate(email.sentAt ?? email.scheduledAt)}
                <span className="text-xs text-fg-subtle">
                  ({formatRelativeTime(email.sentAt ?? email.scheduledAt)})
                </span>
              </span>
            </DetailRow>

            {isSent && (
              <DetailRow label="Originally due">
                <span className="tabular">{formatDate(email.scheduledAt)}</span>
              </DetailRow>
            )}

            {email.campaign && (
              <DetailRow label="Campaign">
                <span className="truncate">{email.campaign.subject}</span>
              </DetailRow>
            )}
          </dl>
        </section>

        {/* Message body, rendered as a letter surface. */}
        <section className="px-6 pb-8">
          <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-fg-subtle">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Message body
          </p>

          <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">
              {email.body}
            </p>
          </div>
        </section>
      </div>
    </article>
  );
}
