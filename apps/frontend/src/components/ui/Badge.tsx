import { ReactNode } from 'react';
import { cn, statusMeta, type Tone } from '../../lib/utils';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-hover text-fg-muted',
  brand: 'bg-accent-soft text-accent-fg',
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
  info: 'bg-info-soft text-info-fg',
};

const DOTS: Record<Tone, string> = {
  neutral: 'bg-ink-400',
  brand: 'bg-primary-500',
  success: 'bg-success-solid',
  warning: 'bg-warning-solid',
  danger: 'bg-danger-solid',
  info: 'bg-info-solid',
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  /** Animate the dot - use for in-progress states only. */
  pulse?: boolean;
  className?: string;
}

export function Badge({ children, tone = 'neutral', dot, pulse, className }: BadgeProps) {
  return (
    <span
      className={cn(
        // Borderless pills: colour alone carries the meaning, which keeps dense
        // lists from filling up with competing outlines.
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold',
        TONES[tone],
        className
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {pulse && (
            <span
              className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', DOTS[tone])}
              aria-hidden
            />
          )}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', DOTS[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}

/**
 * Badge driven by a job/campaign status string. Label wording and colour mapping
 * live in `statusMeta` so every surface agrees.
 */
export function StatusPill({
  status,
  className,
  showHint,
}: {
  status: string;
  className?: string;
  showHint?: boolean;
}) {
  const meta = statusMeta(status);

  return (
    <Badge tone={meta.tone} dot pulse={status === 'processing'} className={className}>
      <span title={showHint ? meta.hint : undefined}>{meta.label}</span>
    </Badge>
  );
}
