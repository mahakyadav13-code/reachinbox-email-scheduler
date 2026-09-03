import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                    */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

/** Placeholder rows shaped like the mailbox list, shown while the first page loads. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 px-5 py-4">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                 */
/* -------------------------------------------------------------------------- */

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex animate-slide-up flex-col items-center px-6 py-20 text-center',
        className
      )}
    >
      {/* Soft gradient halo behind the glyph, so an empty view still feels
          designed rather than broken. */}
      <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-3xl bg-accent-gradient opacity-[0.10] blur-md" />
        <span className="absolute inset-0 rounded-3xl bg-accent-soft" />
        <Icon className="relative h-7 w-7 text-accent" aria-hidden />
      </div>

      <h3 className="text-[0.9375rem] font-semibold text-fg">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-subtle">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inline notice                                                               */
/* -------------------------------------------------------------------------- */

type NoticeTone = 'info' | 'warning' | 'danger' | 'success' | 'brand';

const NOTICE_TONES: Record<NoticeTone, string> = {
  info: 'bg-info-soft text-info-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
  success: 'bg-success-soft text-success-fg',
  brand: 'bg-accent-soft text-accent-fg',
};

export function Notice({
  tone = 'info',
  icon: Icon,
  title,
  children,
  className,
}: {
  tone?: NoticeTone;
  icon?: LucideIcon;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-3 rounded-xl px-4 py-3.5 text-xs', NOTICE_TONES[tone], className)}>
      {Icon && <Icon className="mt-px h-4 w-4 shrink-0" aria-hidden />}
      <div className="min-w-0 leading-relaxed">
        {title && <p className="mb-0.5 font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
