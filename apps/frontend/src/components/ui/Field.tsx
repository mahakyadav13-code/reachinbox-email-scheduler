import {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
  useId,
} from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Shared control chrome. Taller than a dense dashboard control and using a
 * tinted focus ring rather than a hard border change - both read as current.
 */
const CONTROL = [
  'w-full rounded-xl bg-surface text-sm text-fg placeholder:text-fg-subtle',
  'ring-1 ring-inset ring-line transition-all duration-200',
  'hover:ring-line-strong',
  'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0',
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-subtle',
].join(' ');

/** Invalid state: a tinted ring in the danger tone, kept on focus. */
const INVALID = 'ring-danger-solid/60 focus:ring-danger-solid';

interface FieldShellProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function FieldShell({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="mb-2 flex items-center gap-1 text-sm font-medium text-fg"
        >
          {label}
          {required && (
            <span className="text-accent" aria-hidden>
              *
            </span>
          )}
        </label>
      )}

      {children}

      {/* Error replaces hint so the field never changes height on validation. */}
      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-danger-fg">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  suffix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, icon, suffix, className, required, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;

    return (
      <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
        <div className="relative">
          {icon && (
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle"
              aria-hidden
            >
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            className={cn(
              CONTROL,
              'h-11 px-3.5',
              icon && 'pl-10',
              suffix && 'pr-20',
              error && INVALID,
              className
            )}
            {...props}
          />

          {suffix && (
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-fg-subtle">
              {suffix}
            </span>
          )}
        </div>
      </FieldShell>
    );
  }
);

Input.displayName = 'Input';

/* -------------------------------------------------------------------------- */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, required, id, ...props }, ref) => {
    const autoId = useId();
    const textareaId = id ?? autoId;

    return (
      <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={textareaId}>
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL,
            'resize-y px-3.5 py-3 leading-relaxed',
            error && INVALID,
            className
          )}
          {...props}
        />
      </FieldShell>
    );
  }
);

Textarea.displayName = 'Textarea';

/* -------------------------------------------------------------------------- */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, className, required, id, children, ...props }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;

    return (
      <FieldShell label={label} hint={hint} error={error} required={required} htmlFor={selectId}>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            className={cn(CONTROL, 'h-11 appearance-none pl-3.5 pr-10', error && INVALID, className)}
            {...props}
          >
            {children}
          </select>

          <ChevronDown
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
        </div>
      </FieldShell>
    );
  }
);

Select.displayName = 'Select';
