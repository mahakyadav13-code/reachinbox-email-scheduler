import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { emailApi } from '../services/api';
import { redirectUrls } from '../lib/config';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Notice } from '../components/ui/Feedback';
import { StatCard } from '../components/ui/Misc';
import { QueueStats } from '../types';

const TILES: Array<{
  key: keyof QueueStats;
  label: string;
  icon: typeof Clock;
  tone: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
  hint: string;
}> = [
  {
    key: 'delayed',
    label: 'Delayed',
    icon: Clock,
    tone: 'brand',
    hint: 'Holding until their send time',
  },
  {
    key: 'waiting',
    label: 'Waiting',
    icon: Loader2,
    tone: 'warning',
    hint: 'Due now, awaiting a free worker',
  },
  {
    key: 'active',
    label: 'Active',
    icon: Activity,
    tone: 'brand',
    hint: 'Being delivered right now',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    tone: 'success',
    hint: 'Finished successfully',
  },
  {
    key: 'failed',
    label: 'Failed',
    icon: XCircle,
    tone: 'danger',
    hint: 'Exhausted every retry',
  },
];

export function QueueMonitorPage() {
  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: () => emailApi.queueStats(),
    // Queue depth changes constantly; poll while the page is open.
    refetchInterval: 5000,
  });

  const stats = data?.data?.data;

  return (
    <AppShell
      title="Queue monitor"
      description="Live BullMQ counters, refreshed every 5 seconds"
      actions={
        <>
          <Button variant="outline" onClick={() => refetch()} isLoading={isFetching && !isPending}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </Button>

          <a href={redirectUrls.queueDashboard} target="_blank" rel="noopener noreferrer">
            <Button>
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open Bull Board
            </Button>
          </a>
        </>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {TILES.map((tile) => (
            <StatCard
              key={tile.key}
              label={tile.label}
              value={stats?.[tile.key] ?? 0}
              icon={tile.icon}
              tone={tile.tone}
              hint={tile.hint}
              isLoading={isPending}
            />
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Reading these numbers" />
            <CardBody className="space-y-3 text-sm leading-relaxed text-fg-muted">
              <p>
                <strong className="font-medium text-fg">Delayed</strong> is where scheduled
                mail waits until its send time arrives. These survive a restart because the
                delay is held in Redis rather than in process memory.
              </p>
              <p>
                A batch that trips its hourly limit returns to{' '}
                <strong className="font-medium text-fg">Delayed</strong> with a new send
                time inside the next window â€” it is never failed or dropped.
              </p>
              <p>
                <strong className="font-medium text-fg">Waiting</strong> staying high means
                jobs are due but no worker is free. That's the signal to raise{' '}
                <code className="rounded bg-surface-hover px-1 py-0.5 text-xs">WORKER_CONCURRENCY</code>{' '}
                or run another worker process.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Verifying persistence" description="The restart scenario" />
            <CardBody className="space-y-3">
              <ol className="space-y-2.5 text-sm text-fg-muted">
                {[
                  'Schedule a batch a few minutes into the future.',
                  'Note the Delayed count above.',
                  'Stop the API and worker processes.',
                  'Start them again â€” Delayed is unchanged.',
                  'Messages still send at their original time, exactly once.',
                ].map((step, index) => (
                  <li key={step} className="flex gap-2.5">
                    <span className="tabular mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-hover text-2xs font-semibold text-fg-muted">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>

              <Notice tone="info" icon={Info}>
                Nothing is re-enqueued on boot. Re-enqueueing is exactly what would cause
                duplicates â€” the jobs are already in Redis, and the worker simply reconnects and
                keeps draining them.
              </Notice>
            </CardBody>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
