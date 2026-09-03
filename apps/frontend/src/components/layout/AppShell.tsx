import { ReactNode, useState } from 'react';
import { Menu, PenLine, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { UserMenu } from './UserMenu';
import { Button, IconButton } from '../ui/Button';
import { ComposeDrawer } from '../email/ComposeDrawer';
import { cn } from '../../lib/utils';

interface AppShellProps {
  title: string;
  description?: string;
  /** Toolbar controls, rendered under the page title. */
  actions?: ReactNode;
  /** When true the page owns its own scrolling (mailbox panes). */
  fullBleed?: boolean;
  children: ReactNode;
}

/**
 * Application chrome: light sidebar, frosted sticky top bar, page content.
 *
 * Compose lives here rather than on individual pages so the primary action is
 * reachable from anywhere, as you'd expect from a mail client.
 */
export function AppShell({ title, description, actions, fullBleed, children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Sidebar: static from lg up, slide-over below. */}
      <div className="hidden shrink-0 lg:block">
        <Sidebar />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div className="relative animate-slide-in-right">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="absolute -right-12 top-4 rounded-xl bg-surface/90 p-2.5 text-fg-muted shadow-lift"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Frosted top bar so content scrolling underneath stays legible. */}
        <header className="glass sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-3 border-b border-line px-4 sm:px-6">
          <IconButton
            label="Open navigation"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="h-[18px] w-[18px]" />
          </IconButton>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight text-fg">
              {title}
            </h1>
            {description && <p className="truncate text-xs text-fg-subtle">{description}</p>}
          </div>

          <Button onClick={() => setComposeOpen(true)} className="shrink-0">
            <PenLine className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Compose</span>
          </Button>

          <div className="hidden h-7 w-px shrink-0 bg-surface-hover sm:block" aria-hidden />

          <UserMenu />
        </header>

        <main
          className={cn(
            'min-h-0 flex-1',
            fullBleed ? 'overflow-hidden' : 'overflow-y-auto scrollbar-slim'
          )}
        >
          {fullBleed ? (
            <div className="h-full">{children}</div>
          ) : (
            <div className="mx-auto max-w-7xl animate-slide-up px-4 py-6 sm:px-6 sm:py-8">
              {actions && <div className="mb-6 flex flex-wrap justify-end gap-2">{actions}</div>}
              {children}
            </div>
          )}
        </main>
      </div>

      <ComposeDrawer isOpen={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
