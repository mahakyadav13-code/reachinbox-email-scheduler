import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
}

interface RootCardProps extends CardProps {
  /** Lift toward the cursor on hover. Use for cards that link somewhere. */
  interactive?: boolean;
}

export function Card({ children, className, interactive }: RootCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface shadow-card',
        interactive && 'hover-lift cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends Omit<CardProps, 'children'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Escape hatch: arbitrary content instead of title/description/actions. */
  children?: ReactNode;
}

export function CardHeader({
  title,
  description,
  actions,
  children,
  className,
}: CardHeaderProps) {
  if (children) {
    return <div className={cn('px-5 pt-4', className)}>{children}</div>;
  }

  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-4', className)}>
      <div className="min-w-0">
        {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
        {description && <p className="mt-1 text-xs text-fg-subtle">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t border-line px-5 py-3',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardDivider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-line', className)} aria-hidden />;
}
