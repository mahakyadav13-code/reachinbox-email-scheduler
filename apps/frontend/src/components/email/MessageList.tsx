import { EmailJob } from '../../types';
import { StatusPill } from '../ui/Badge';
import { Avatar } from '../ui/Misc';
import { bodyPreview, cn, formatListTime } from '../../lib/utils';

interface MessageListProps {
  emails: EmailJob[];
  selectedId?: string | null;
  onSelect: (email: EmailJob) => void;
  /** Which timestamp the row should show. */
  timeField: 'scheduledAt' | 'sentAt';
}

/**
 * Mailbox-style rows: sender monogram, recipient, subject, body preview, time.
 *
 * Deliberately denser than a data table - it reads as a message list rather than
 * a spreadsheet, which is what makes the app feel like an email client.
 */
export function MessageList({ emails, selectedId, onSelect, timeField }: MessageListProps) {
  return (
    <ul className="divide-y divide-line">
      {emails.map((email) => {
        const selected = email.id === selectedId;
        const timestamp = timeField === 'sentAt' ? email.sentAt ?? email.scheduledAt : email.scheduledAt;
        const isFailed = email.status === 'failed';

        return (
          <li key={email.id}>
            <button
              type="button"
              onClick={() => onSelect(email)}
              aria-current={selected || undefined}
              className={cn(
                'group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                selected ? 'bg-accent-soft/70' : 'hover:bg-surface-sunken'
              )}
            >
              {/* Selection marker */}
              <span
                className={cn(
                  'absolute inset-y-0 left-0 w-0.5 bg-accent transition-opacity',
                  selected ? 'opacity-100' : 'opacity-0'
                )}
                aria-hidden
              />

              <Avatar email={email.recipientEmail} size="sm" className="mt-0.5" />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm',
                      selected ? 'font-semibold text-fg' : 'font-medium text-fg'
                    )}
                  >
                    {email.recipientEmail}
                  </p>

                  <time
                    className="tabular shrink-0 text-2xs text-fg-subtle"
                    dateTime={new Date(timestamp).toISOString()}
                  >
                    {formatListTime(timestamp)}
                  </time>
                </div>

                <p className="mt-0.5 truncate text-sm text-fg-muted">{email.subject}</p>

                <div className="mt-1.5 flex items-center gap-2">
                  <StatusPill status={email.status} />
                  <p className="min-w-0 flex-1 truncate text-xs text-fg-subtle">
                    {isFailed && email.failureReason
                      ? email.failureReason
                      : bodyPreview(email.body, 90)}
                  </p>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
