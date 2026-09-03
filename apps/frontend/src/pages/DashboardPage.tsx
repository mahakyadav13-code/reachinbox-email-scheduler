import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Inbox,
  Layers,
  Send,
  Users,
} from 'lucide-react';
import { campaignApi, emailApi } from '../services/api';
import { AppShell } from '../components/layout/AppShell';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { StatusPill } from '../components/ui/Badge';
import { EmptyState, Skeleton } from '../components/ui/Feedback';
import { StatCard } from '../components/ui/Misc';
import { formatRelativeTime, pluralize } from '../lib/utils';

export function DashboardPage() {
  const { data: statsData, isPending: statsPending } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => emailApi.stats(),
    refetchInterval: 15_000,
  });

  const { data: queueData } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: () => emailApi.queueStats(),
    refetchInterval: 15_000,
  });

  const { data: campaignsData, isPending: campaignsPending } = useQuery({
    queryKey: ['campaigns', 1],
    queryFn: () => campaignApi.list(1, 6),
  });

  const stats = statsData?.data?.data;
  const queue = queueData?.data?.data;
  const campaigns = campaignsData?.data?.data ?? [];

  return (
    <AppShell
      title="Dashboard"
      description="Delivery health across every campaign"
    >
      <div className="space-y-6">
        {/* Headline counters */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Scheduled"
            value={stats?.totalScheduled ?? 0}
            icon={Clock}
            tone="brand"
            hint="Queued, sending or rescheduled"
            isLoading={statsPending}
          />
          <StatCard
            label="Sent today"
            value={stats?.sentToday ?? 0}
            icon={Send}
            tone="success"
            hint="Accepted by the SMTP server"
            isLoading={statsPending}
          />
          <StatCard
            label="Failed"
            value={stats?.failed ?? 0}
            icon={AlertTriangle}
            tone={stats?.failed ? 'danger' : 'neutral'}
            hint="Exhausted every retry"
            isLoading={statsPending}
          />
          <StatCard
            label="Awaiting a worker"
            value={stats?.queueWaiting ?? 0}
            icon={Inbox}
            tone="warning"
            hint="Due now, pending capacity"
            isLoading={statsPending}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ----------------------------------------------------- campaigns */}
          <Card className="lg:col-span-2">
            <CardHeader
              title="Recent campaigns"
              description="The last six batches you queued"
              actions={
                <Link
                  to="/emails/scheduled"
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent-fg hover:text-accent-fg"
                >
                  View mailbox
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />

            {campaignsPending ? (
              <div className="divide-y divide-line">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2 px-5 py-4">
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No campaigns yet"
                description="Use Compose in the top bar to queue your first batch. You'll see delivery progress here."
              />
            ) : (
              <ul className="divide-y divide-line">
                {campaigns.map((campaign) => (
                  <li
                    key={campaign.id}
                    className="flex items-start justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-surface-sunken/70"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {campaign.subject}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
                        <span className="tabular">
                          {campaign.totalEmails.toLocaleString()}{' '}
                          {pluralize(campaign.totalEmails, 'recipient')}
                        </span>
                        <span aria-hidden>Â·</span>
                        <span>{formatRelativeTime(campaign.createdAt)}</span>
                        {campaign.sender && (
                          <>
                            <span aria-hidden>Â·</span>
                            <span className="truncate">from {campaign.sender.email}</span>
                          </>
                        )}
                        <span aria-hidden>Â·</span>
                        <span className="tabular">
                          {campaign.delayBetweenEmails}s apart, {campaign.hourlyLimit}/hr
                        </span>
                      </div>
                    </div>

                    <StatusPill status={campaign.status} className="mt-0.5 shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* --------------------------------------------------------- queue */}
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Queue depth"
                description="Live BullMQ counters"
                actions={
                  <Link
                    to="/queue"
                    className="text-xs font-medium text-accent-fg hover:text-accent-fg"
                  >
                    Details
                  </Link>
                }
              />
              <CardBody className="space-y-1">
                <QueueRow label="Delayed" value={queue?.delayed} hint="Waiting for send time" />
                <QueueRow label="Waiting" value={queue?.waiting} hint="Due now" />
                <QueueRow label="Active" value={queue?.active} hint="Sending" />
                <QueueRow label="Completed" value={queue?.completed} />
                <QueueRow label="Failed" value={queue?.failed} tone="danger" />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Next steps" />
              <CardBody className="space-y-2">
                <QuickLink
                  to="/senders"
                  icon={Users}
                  title="Sending identities"
                  copy="Each has its own hourly budget"
                />
                <QuickLink
                  to="/slack"
                  icon={AlertTriangle}
                  title="Slack alerts"
                  copy="Get notified when a limit is hit"
                />
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */

function QueueRow({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value?: number;
  hint?: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-sm text-fg-muted">{label}</p>
        {hint && <p className="text-2xs text-fg-subtle">{hint}</p>}
      </div>

      {value === undefined ? (
        <Skeleton className="h-5 w-10" />
      ) : (
        <span
          className={
            tone === 'danger' && value > 0
              ? 'tabular text-sm font-semibold text-danger-fg'
              : 'tabular text-sm font-semibold text-fg'
          }
        >
          {value.toLocaleString()}
        </span>
      )}
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  title,
  copy,
}: {
  to: string;
  icon: typeof Users;
  title: string;
  copy: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-sunken"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-hover">
        <Icon className="h-4 w-4 text-fg-muted" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block text-xs text-fg-subtle">{copy}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
    </Link>
  );
}
