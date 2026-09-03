import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, CheckCircle2, Info, Slack, Unplug } from 'lucide-react';
import { slackApi } from '../services/api';
import { redirectUrls } from '../lib/config';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Notice, Skeleton } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Overlay';
import { formatDate } from '../lib/utils';

export function SlackPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['slack-status'],
    queryFn: () => slackApi.status(),
  });

  const status = data?.data?.data;
  const connected = Boolean(status?.connected);

  const disconnect = useMutation({
    mutationFn: () => slackApi.disconnect(),
    onSuccess: () => {
      toast.success('Slack disconnected');
      queryClient.invalidateQueries({ queryKey: ['slack-status'] });
      setConfirmOpen(false);
    },
    onError: () => {
      toast.error('Could not disconnect Slack');
      setConfirmOpen(false);
    },
  });

  return (
    <AppShell title="Slack" description="Alerts when a sender hits its hourly limit">
      <div className="mx-auto max-w-3xl space-y-5">
        <Card>
          <CardHeader
            title="Workspace connection"
            actions={
              isPending ? (
                <Skeleton className="h-5 w-20 rounded-full" />
              ) : (
                <Badge tone={connected ? 'success' : 'neutral'} dot>
                  {connected ? 'Connected' : 'Not connected'}
                </Badge>
              )
            }
          />

          <CardBody>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-hover">
                  <Slack className="h-5 w-5 text-fg-muted" aria-hidden />
                </span>

                <div className="min-w-0">
                  {isPending ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  ) : connected ? (
                    <>
                      <p className="text-sm font-medium text-fg">
                        {status?.workspace ?? 'Slack workspace'}
                      </p>
                      <p className="mt-0.5 text-xs text-fg-subtle">
                        {status?.connectedAt
                          ? `Connected ${formatDate(status.connectedAt)}`
                          : 'Rate-limit alerts are active'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-fg">
                        Connect a workspace to receive alerts
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-fg-subtle">
                        Without a connection the scheduler still reschedules capped sends â€” it
                        just won't notify anyone.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                {connected ? (
                  <Button variant="outline" onClick={() => setConfirmOpen(true)}>
                    <Unplug className="h-4 w-4" aria-hidden />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      // Full-page navigation: Slack's authorize screen cannot load via XHR.
                      window.location.href = redirectUrls.slackConnect;
                    }}
                  >
                    <Slack className="h-4 w-4" aria-hidden />
                    Connect Slack
                  </Button>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="What gets sent" description="One message per sender, per hour window" />
          <CardBody className="space-y-4">
            {/* Mock-up of the actual Slack payload, so the behaviour is legible
                without having to trip a rate limit to see it. */}
            <div className="rounded-xl border border-line bg-surface-sunken/60 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft ring-1 ring-inset ring-warning-solid/25">
                  <Bell className="h-4 w-4 text-warning-fg" aria-hidden />
                </span>

                <div className="min-w-0 space-y-1 text-sm">
                  <p className="font-semibold text-fg">Hourly rate limit reached</p>
                  <dl className="tabular space-y-0.5 text-xs text-fg-muted">
                    <div className="flex gap-2">
                      <dt className="w-24 text-fg-subtle">Sender</dt>
                      <dd>sender1@reachinbox.com</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 text-fg-subtle">Hourly limit</dt>
                      <dd>200</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 text-fg-subtle">Emails sent</dt>
                      <dd>200</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 text-fg-subtle">Resumes at</dt>
                      <dd>the next hour window</dd>
                    </div>
                  </dl>
                  <p className="pt-1 text-xs leading-relaxed text-fg-subtle">
                    Remaining queued emails are being rescheduled into the next available
                    window in their original order. Nothing has been dropped.
                  </p>
                </div>
              </div>
            </div>

            <Notice tone="info" icon={Info}>
              Notifications are claimed once per sender and hour window, so a backlog of a
              thousand capped messages produces a single alert rather than hundreds.
            </Notice>

            <Notice tone="success" icon={CheckCircle2}>
              Connect or disconnect at any time â€” the token is read per send, so alerts start
              and stop without a redeploy.
            </Notice>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => disconnect.mutate()}
        title="Disconnect Slack?"
        message="Rate-limit alerts will stop immediately. Scheduling and rescheduling behaviour is unaffected."
        confirmLabel="Disconnect"
        isLoading={disconnect.isPending}
      />
    </AppShell>
  );
}
