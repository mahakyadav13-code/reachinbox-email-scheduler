import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, LucideIcon, Search, X } from 'lucide-react';
import { avatarTint, cn, initials } from '../../lib/utils';
import { IconButton } from './Button';

/* -------------------------------------------------------------------------- */
/* Avatar                                                                      */
/* -------------------------------------------------------------------------- */

interface AvatarProps {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const AVATAR_SIZES = {
  xs: 'h-6 w-6 text-2xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-sm',
} as const;

/** Photo when available, otherwise a deterministically tinted monogram. */
export function Avatar({ name, email, src, size = 'md', className }: AvatarProps) {
  const seed = email || name || '?';
  const label = name || email || 'Unknown';

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={cn(
          'shrink-0 rounded-full object-cover ring-1 ring-line',
          AVATAR_SIZES[size],
          className
        )}
      />
    );
  }

  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset ring-black/[0.04]',
        avatarTint(seed),
        AVATAR_SIZES[size],
        className
      )}
    >
      {initials(name || email)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Search input                                                                */
/* -------------------------------------------------------------------------- */

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Searchâ€¦',
  className,
  autoFocus,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
        aria-hidden
      />

      <input
        type="search"
        role="searchbox"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-9 w-full rounded-lg bg-surface pl-9 pr-9 text-sm text-fg placeholder:text-fg-subtle',
          'ring-1 ring-inset ring-line transition-shadow duration-150',
          'hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-accent',
          // Hide the browser's own clear affordance; we render our own.
          '[&::-webkit-search-cancel-button]:hidden'
        )}
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented tabs                                                              */
/* -------------------------------------------------------------------------- */

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, value, onChange, className }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex items-center gap-1 rounded-lg bg-surface-hover p-1', className)}
    >
      {items.map((item) => {
        const active = item.value === value;

        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-surface text-fg shadow-xs'
                : 'text-fg-muted hover:text-fg'
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'tabular rounded px-1.5 py-0.5 text-2xs font-semibold',
                  active ? 'bg-accent-soft text-accent-fg' : 'bg-surface-hover/70 text-fg-muted'
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                  */
/* -------------------------------------------------------------------------- */

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  total,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-2.5',
        className
      )}
    >
      <p className="tabular text-xs text-fg-subtle">
        Page <span className="font-medium text-fg-muted">{currentPage}</span> of {totalPages}
        {total !== undefined && ` Â· ${total.toLocaleString()} total`}
      </p>

      <div className="flex items-center gap-1">
        <IconButton
          label="Previous page"
          size="sm"
          variant="outline"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Next page"
          size="sm"
          variant="outline"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat card                                                                   */
/* -------------------------------------------------------------------------- */

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
  hint?: string;
  isLoading?: boolean;
}

const STAT_TONES = {
  brand: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
  neutral: 'bg-surface-hover text-fg-muted',
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  hint,
  isLoading,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>

          {isLoading ? (
            <div className="skeleton mt-2 h-8 w-16 rounded-md" />
          ) : (
            <p className="tabular mt-1.5 text-2xl font-semibold text-fg">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          )}
        </div>

        <span
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            STAT_TONES[tone]
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>

      {hint && <p className="mt-2 text-xs leading-relaxed text-fg-subtle">{hint}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Key/value row, used in detail panes                                         */
/* -------------------------------------------------------------------------- */

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-3 py-2">
      <dt className="text-xs font-medium text-fg-subtle">{label}</dt>
      <dd className="min-w-0 text-sm text-fg">{children}</dd>
    </div>
  );
}
