import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'subtle';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  isLoading?: boolean;
  /** Render as a span - needed when nesting inside a <label> for file inputs. */
  as?: 'button' | 'span';
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  /** Accent fill with an inner top highlight, so it reads as a lit surface. */
  primary:
    'bg-accent text-fg-onAccent shadow-glow hover:bg-accent-hover active:scale-[0.98]',
  secondary:
    'bg-fg text-canvas hover:opacity-90 active:scale-[0.98]',
  outline:
    'bg-surface text-fg ring-1 ring-inset ring-line-strong hover:bg-surface-hover active:scale-[0.98]',
  subtle: 'bg-accent-soft text-accent-fg hover:brightness-110 active:scale-[0.98]',
  ghost: 'text-fg-muted hover:bg-surface-hover hover:text-fg',
  danger:
    'bg-danger-solid text-white shadow-glow hover:brightness-110 active:scale-[0.98]',
};

const SIZES: Record<Size, string> = {
  xs: 'h-7 gap-1.5 rounded-lg px-2.5 text-xs',
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-sm',
  md: 'h-9 gap-2 rounded-lg px-3.5 text-sm',
  lg: 'h-11 gap-2 rounded-xl px-5 text-[0.9375rem]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      className,
      children,
      isLoading,
      disabled,
      block,
      as: Component = 'button',
      ...props
    },
    ref
  ) => {
    const classes = cn(
      'inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
      'transition-all duration-200 ease-spring',
      'disabled:pointer-events-none disabled:opacity-50',
      VARIANTS[variant],
      SIZES[size],
      block && 'w-full',
      className
    );

    if (Component === 'span') {
      return <span className={cn(classes, 'cursor-pointer')}>{children}</span>;
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

/* -------------------------------------------------------------------------- */

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only controls are invisible to screen readers without it. */
  label: string;
  children: ReactNode;
  variant?: Variant;
  size?: 'sm' | 'md';
  isLoading?: boolean;
}

const ICON_SIZES = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-9 w-9 rounded-lg',
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { label, children, variant = 'ghost', size = 'md', className, isLoading, disabled, ...props },
    ref
  ) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-all duration-200 ease-spring',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        ICON_SIZES[size],
        className
      )}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : children}
    </button>
  )
);

IconButton.displayName = 'IconButton';
