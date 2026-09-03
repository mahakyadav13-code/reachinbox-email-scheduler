import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Mailbox-style timestamp: time for today, weekday within the last week, and a
 * short date beyond that. Keeps the list column narrow and scannable.
 */
export function formatListTime(date: string | Date): string {
  const value = new Date(date);
  const now = new Date();
  const sameDay = value.toDateString() === now.toDateString();

  if (sameDay) return formatTime(value);

  const daysApart = Math.abs(now.getTime() - value.getTime()) / 86_400_000;
  if (daysApart < 7) {
    return value.toLocaleDateString('en-US', { weekday: 'short' });
  }

  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatRelativeTime(date: string | Date): string {
  const then = new Date(date);
  const diffMs = Date.now() - then.getTime();
  const future = diffMs < 0;
  const mins = Math.floor(Math.abs(diffMs) / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  const phrase =
    mins < 1 ? 'just now' : mins < 60 ? `${mins}m` : hours < 24 ? `${hours}h` : `${days}d`;

  if (phrase === 'just now') return phrase;
  return future ? `in ${phrase}` : `${phrase} ago`;
}

/** Human-readable duration, used for "sends over ~2h 15m" style summaries. */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;

  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

/* -------------------------------------------------------------------------- */
/* Status presentation                                                         */
/* -------------------------------------------------------------------------- */

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

export interface StatusMeta {
  label: string;
  tone: Tone;
  /** One-line explanation, surfaced in tooltips and the detail pane. */
  hint: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  pending: {
    label: 'Scheduled',
    tone: 'info',
    hint: 'Waiting in the queue for its send time.',
  },
  processing: {
    label: 'Sending',
    tone: 'brand',
    hint: 'A worker is delivering this message right now.',
  },
  delayed: {
    label: 'Rescheduled',
    tone: 'warning',
    hint: 'Hourly limit reached â€” moved to the next available window, in order.',
  },
  sent: { label: 'Sent', tone: 'success', hint: 'Accepted by the SMTP server.' },
  failed: {
    label: 'Failed',
    tone: 'danger',
    hint: 'Delivery failed after all retry attempts.',
  },
  scheduled: { label: 'Scheduled', tone: 'info', hint: 'Campaign is queued.' },
  completed: { label: 'Completed', tone: 'success', hint: 'Every message was processed.' },
  paused: { label: 'Paused', tone: 'neutral', hint: 'Campaign is not sending.' },
};

export function statusMeta(status: string): StatusMeta {
  return (
    STATUS_META[status] ?? {
      label: status.charAt(0).toUpperCase() + status.slice(1),
      tone: 'neutral',
      hint: '',
    }
  );
}

/* -------------------------------------------------------------------------- */
/* Text                                                                        */
/* -------------------------------------------------------------------------- */

/** Two-letter monogram for avatars, from a name or an email address. */
export function initials(value?: string | null): string {
  if (!value) return '?';

  const cleaned = value.includes('@') ? value.split('@')[0] : value;
  const parts = cleaned.split(/[\s._-]+/).filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic avatar tint so the same person keeps the same colour. */
export function avatarTint(seed: string): string {
  const palette = [
    'bg-accent-soft text-accent-fg',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-sky-100 text-sky-700',
    'bg-violet-100 text-violet-700',
    'bg-teal-100 text-teal-700',
  ];

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100_000;
  }

  return palette[hash % palette.length];
}

/** Collapse an HTML-ish body into a single-line preview for list rows. */
export function bodyPreview(body: string, max = 140): string {
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > max ? `${text.slice(0, max).trimEnd()}â€¦` : text;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}

/* -------------------------------------------------------------------------- */
/* Recipient parsing                                                           */
/* -------------------------------------------------------------------------- */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ExtractedEmails {
  valid: string[];
  invalid: string[];
  duplicates: number;
}

/**
 * Client-side preview of the recipient file. Mirrors the backend parser closely
 * enough to show accurate counts before submitting; the backend remains the
 * source of truth and re-parses on create.
 *
 * Cells are only treated as attempted addresses when they contain "@" (or when
 * the file is a single-column list), so CSV headers and name columns are not
 * reported as invalid.
 */
export function extractEmails(content: string, fileType: 'csv' | 'txt'): ExtractedEmails {
  const rows = content
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  for (const row of rows) {
    const cells = fileType === 'csv' ? row.split(',').map((c) => c.trim()) : [row];
    const singleColumn = cells.length === 1;

    for (const cell of cells) {
      if (!cell) continue;
      const candidate = cell.toLowerCase().replace(/^["']|["']$/g, '');

      if (EMAIL_REGEX.test(candidate)) {
        if (seen.has(candidate)) {
          duplicates += 1;
        } else {
          seen.add(candidate);
          valid.push(candidate);
        }
      } else if (candidate.includes('@') || singleColumn) {
        invalid.push(cell);
      }
    }
  }

  // A single-column file usually carries a header row ("email"); don't flag it.
  if (invalid.length && /^e-?mail/i.test(invalid[0])) {
    invalid.shift();
  }

  return { valid, invalid, duplicates };
}
