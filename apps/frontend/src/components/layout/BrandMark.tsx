import { cn } from '../../lib/utils';

const SIZES = {
  sm: { box: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4' },
  md: { box: 'h-9 w-9 rounded-xl', icon: 'h-[18px] w-[18px]' },
  lg: { box: 'h-11 w-11 rounded-2xl', icon: 'h-5 w-5' },
} as const;

/**
 * The product mark: an envelope on the brand gradient with an inner highlight so
 * it reads as a lit surface rather than a flat tile.
 */
export function BrandMark({
  size = 'md',
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { box, icon } = SIZES[size];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-accent-gradient shadow-glow shadow-accent/25',
        box,
        className
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className={cn('text-white', icon)}>
        <path
          d="M3 7.8A1.8 1.8 0 0 1 4.8 6h14.4A1.8 1.8 0 0 1 21 7.8v8.4a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 16.2V7.8Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="m3.7 7.5 8.3 5.9 8.3-5.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Mark plus wordmark, used in the sidebar and on the sign-in screen. */
export function BrandLockup({
  size = 'md',
  subtitle = 'Email Scheduler',
  inverted,
}: {
  size?: keyof typeof SIZES;
  subtitle?: string | null;
  inverted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={size} />
      <div className="min-w-0 leading-tight">
        <p
          className={cn(
            'truncate text-[0.9375rem] font-semibold tracking-tight',
            inverted ? 'text-white' : 'text-fg'
          )}
        >
          ReachInbox
        </p>
        {subtitle && (
          <p className={cn('truncate text-2xs', inverted ? 'text-white/60' : 'text-fg-subtle')}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
