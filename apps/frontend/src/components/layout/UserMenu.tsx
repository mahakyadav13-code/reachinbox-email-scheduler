import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ExternalLink, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '../../services/api';
import { redirectUrls } from '../../lib/config';
import { cn } from '../../lib/utils';
import { useTheme, type ThemePreference } from '../../hooks/useTheme';
import { Avatar } from '../ui/Misc';

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Auto', icon: Monitor },
];

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const { preference, setPreference } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.getMe(),
    staleTime: 5 * 60 * 1000,
  });

  const user = data?.data?.data?.user;

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      // Drop every cached query so the next user starts clean.
      queryClient.clear();
      toast.success('Signed out');
      navigate('/', { replace: true });
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  };

  if (!user) return <div className="skeleton h-10 w-10 rounded-xl" />;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors duration-200',
          open ? 'bg-surface-hover' : 'hover:bg-surface-hover'
        )}
      >
        <Avatar name={user.name} email={user.email} src={user.avatarUrl} size="sm" />

        {/* Name is hidden on narrow screens; the menu still shows it. */}
        <span className="hidden min-w-0 text-left xl:block">
          <span className="block max-w-[9rem] truncate text-sm font-medium leading-tight text-fg">
            {user.name || 'Account'}
          </span>
        </span>

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-200',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-72 animate-scale-in overflow-hidden rounded-2xl border border-line bg-surface shadow-popover"
        >
          <div className="flex items-center gap-3 bg-surface-sunken/70 px-4 py-4">
            <Avatar name={user.name} email={user.email} src={user.avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">
                {user.name || 'Account'}
              </p>
              <p className="truncate text-xs text-fg-subtle">{user.email}</p>
            </div>
          </div>

          {/* Theme picker, matching ReachInbox's light / dark / system options. */}
          <div className="border-b border-line p-2">
            <p className="px-3 pb-1.5 pt-1 text-2xs font-semibold uppercase tracking-widest text-fg-subtle">
              Appearance
            </p>

            <div className="flex gap-1 rounded-xl bg-surface-sunken p-1">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPreference(option.value)}
                  aria-pressed={preference === option.value}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                    preference === option.value
                      ? 'bg-surface text-fg shadow-xs'
                      : 'text-fg-subtle hover:text-fg'
                  )}
                >
                  <option.icon className="h-3.5 w-3.5" aria-hidden />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-2">
            <a
              href={redirectUrls.queueDashboard}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg-muted transition-colors hover:bg-surface-hover"
            >
              <ExternalLink className="h-4 w-4 text-fg-subtle" aria-hidden />
              Bull Board
            </a>

            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-danger-fg transition-colors hover:bg-danger-soft"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
