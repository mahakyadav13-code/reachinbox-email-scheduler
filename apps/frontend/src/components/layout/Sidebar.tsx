import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Clock,
  LayoutDashboard,
  LucideIcon,
  Send,
  Slack,
  Users,
} from 'lucide-react';
import { emailApi } from '../../services/api';
import { cn } from '../../lib/utils';
import { BrandLockup } from './BrandMark';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Key into the dashboard stats used for a live count badge. */
  badge?: 'scheduled';
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Mailbox',
    items: [
      { name: 'Scheduled', href: '/emails/scheduled', icon: Clock, badge: 'scheduled' },
      { name: 'Sent', href: '/emails/sent', icon: Send },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { name: 'Senders', href: '/senders', icon: Users },
      { name: 'Slack', href: '/slack', icon: Slack },
      { name: 'Queue', href: '/queue', icon: BarChart3 },
    ],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  // Live count on the Scheduled item, the way a mail client shows unread.
  const { data } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => emailApi.stats(),
    refetchInterval: 20_000,
  });

  const scheduledCount = data?.data?.data?.totalScheduled ?? 0;

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full w-sidebar flex-col border-r border-line bg-surface"
    >
      <div className="px-5 py-5">
        <BrandLockup />
      </div>

      <div className="flex-1 space-y-7 overflow-y-auto px-3 pb-4 scrollbar-slim">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 pb-2 text-2xs font-semibold uppercase tracking-widest text-fg-subtle">
              {section.label}
            </p>

            <ul className="space-y-1">
              {section.items.map((item) => {
                const count = item.badge === 'scheduled' ? scheduledCount : 0;

                return (
                  <li key={item.href}>
                    <NavLink
                      to={item.href}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                          isActive
                            ? // Tinted pill rather than a hard highlight bar.
                              'bg-accent-soft text-accent-fg'
                            : 'text-fg-muted hover:bg-surface-hover/70 hover:text-fg'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={cn(
                              'h-[18px] w-[18px] shrink-0 transition-colors',
                              isActive
                                ? 'text-accent'
                                : 'text-fg-subtle group-hover:text-fg-muted'
                            )}
                            aria-hidden
                          />
                          <span className="flex-1 truncate">{item.name}</span>

                          {count > 0 && (
                            <span
                              className={cn(
                                'tabular rounded-full px-2 py-0.5 text-2xs font-semibold',
                                isActive
                                  ? 'bg-accent text-white'
                                  : 'bg-surface-hover/80 text-fg-muted'
                              )}
                            >
                              {count > 999 ? '999+' : count}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Runtime configuration summary - orients anyone reviewing the app. */}
      <div className="mx-3 mb-3 rounded-xl bg-surface-sunken p-3.5">
        <p className="text-2xs font-semibold uppercase tracking-widest text-fg-subtle">
          Delivery engine
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-subtle">
          BullMQ delayed jobs on Redis. Per-sender hourly limits, order-preserving
          rescheduling.
        </p>
      </div>
    </nav>
  );
}
