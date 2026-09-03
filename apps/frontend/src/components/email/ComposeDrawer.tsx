import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Gauge,
  Info,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { campaignApi, senderApi } from '../../services/api';
import { Drawer } from '../ui/Overlay';
import { Button, IconButton } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Field';
import { Notice } from '../ui/Feedback';
import { Badge } from '../ui/Badge';
import { cn, extractEmails, formatDate, formatDuration, pluralize } from '../../lib/utils';

const schema = z.object({
  senderId: z.string().min(1, 'Choose a sending identity'),
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject is too long'),
  body: z.string().min(1, 'Write something to send'),
  startTime: z.string().min(1, 'Pick when sending should begin'),
  delayBetweenEmails: z
    .number({ invalid_type_error: 'Enter a number' })
    .int()
    .min(0, 'Cannot be negative'),
  hourlyLimit: z
    .number({ invalid_type_error: 'Enter a number' })
    .int()
    .min(1, 'Must be at least 1'),
});

type FormData = z.infer<typeof schema>;

/** `datetime-local` needs a local-time string, not an ISO/UTC one. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function defaultStartTime(): string {
  const inFiveMinutes = new Date(Date.now() + 5 * 60_000);
  inFiveMinutes.setSeconds(0, 0);
  return toLocalInputValue(inFiveMinutes);
}

interface ComposeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComposeDrawer({ isOpen, onClose }: ComposeDrawerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rawRecipients, setRawRecipients] = useState('');
  const [fileType, setFileType] = useState<'csv' | 'txt'>('txt');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: sendersData } = useQuery({
    queryKey: ['senders'],
    queryFn: () => senderApi.list(),
    enabled: isOpen,
  });

  const senders = sendersData?.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      delayBetweenEmails: 2,
      hourlyLimit: 200,
      startTime: defaultStartTime(),
      senderId: '',
      subject: '',
      body: '',
    },
  });

  const stats = useMemo(() => extractEmails(rawRecipients, fileType), [rawRecipients, fileType]);
  const recipientCount = stats.valid.length;

  const delay = watch('delayBetweenEmails');
  const hourlyLimit = watch('hourlyLimit');
  const startTime = watch('startTime');

  /** Delivery projection shown in the footer while the user edits settings. */
  const projection = useMemo(() => {
    if (recipientCount === 0) return null;

    const safeDelay = Number.isFinite(delay) ? Math.max(delay, 0) : 0;
    const safeLimit = Number.isFinite(hourlyLimit) ? Math.max(hourlyLimit, 1) : 1;
    const start = startTime ? new Date(startTime) : null;

    const spanSeconds = Math.max(recipientCount - 1, 0) * safeDelay;
    const lastSend =
      start && !Number.isNaN(start.getTime())
        ? new Date(start.getTime() + spanSeconds * 1000)
        : null;

    // Whether the batch exceeds one hourly window for the chosen sender.
    const windows = Math.ceil(recipientCount / safeLimit);

    return { spanSeconds, lastSend, windows, safeLimit };
  }, [recipientCount, delay, hourlyLimit, startTime]);

  const readFile = (nextFile: File) => {
    setFileType(nextFile.name.toLowerCase().endsWith('.csv') ? 'csv' : 'txt');
    setFile(nextFile);

    const reader = new FileReader();
    reader.onload = (event) => setRawRecipients((event.target?.result as string) ?? '');
    reader.onerror = () => toast.error('Could not read that file');
    reader.readAsText(nextFile);
  };

  const clearFile = () => {
    setFile(null);
    setRawRecipients('');
    setFileType('txt');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    clearFile();
    reset({
      delayBetweenEmails: 2,
      hourlyLimit: 200,
      startTime: defaultStartTime(),
      senderId: '',
      subject: '',
      body: '',
    });
    onClose();
  };

  const createCampaign = useMutation({
    mutationFn: (payload: Parameters<typeof campaignApi.create>[0]) =>
      campaignApi.create(payload),
    onSuccess: (response) => {
      const scheduled = response.data?.data?.stats?.totalScheduled ?? recipientCount;
      toast.success(`Scheduled ${scheduled} ${pluralize(scheduled, 'email')}`);

      // Refresh everything that reflects the new campaign.
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-emails'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });

      handleClose();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error ?? 'Could not schedule this campaign');
    },
  });

  const onSubmit = (data: FormData) => {
    if (recipientCount === 0) {
      toast.error('Upload a recipient file with at least one valid address');
      return;
    }

    createCampaign.mutate({
      ...data,
      // The API validates an ISO timestamp; datetime-local gives local time
      // without a zone, so convert explicitly.
      startTime: new Date(data.startTime).toISOString(),
      recipients: rawRecipients,
      fileType,
    });
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="New campaign"
      description="Queue a personalised batch and let the scheduler pace delivery."
      width="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-fg-subtle">
            {projection ? (
              <span className="tabular">
                {recipientCount.toLocaleString()} {pluralize(recipientCount, 'recipient')} Â·
                finishes {formatDuration(projection.spanSeconds)} after start
                {projection.windows > 1 && ` Â· spans ${projection.windows} hourly windows`}
              </span>
            ) : (
              'Upload recipients to see a delivery estimate'
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={handleClose} disabled={createCampaign.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              isLoading={createCampaign.isPending}
              disabled={recipientCount === 0}
            >
              Schedule campaign
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="divide-y divide-line">
        {/* ------------------------------------------------------------------ */}
        <section className="space-y-4 px-5 py-5">
          <SectionHeading
            icon={Users}
            title="Sender"
            description="Each identity carries its own hourly sending budget."
          />

          <Select
            label="From"
            required
            error={errors.senderId?.message}
            {...register('senderId')}
          >
            <option value="">Select a sending identityâ€¦</option>
            {senders.map((sender) => (
              <option key={sender.id} value={sender.id}>
                {sender.name} Â· {sender.email}
              </option>
            ))}
          </Select>

          {senders.length === 0 && (
            <Notice tone="warning" icon={AlertTriangle}>
              No senders yet. Add one under <strong>Senders</strong> before scheduling.
            </Notice>
          )}
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-4 px-5 py-5">
          <SectionHeading
            icon={FileText}
            title="Message"
            description="Subject and body are sent to every recipient in this batch."
          />

          <Input
            label="Subject"
            required
            placeholder="Quick question about your outreach"
            error={errors.subject?.message}
            {...register('subject')}
          />

          <Textarea
            label="Body"
            required
            rows={8}
            placeholder={'Hi there,\n\nI noticedâ€¦'}
            error={errors.body?.message}
            {...register('body')}
          />
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-4 px-5 py-5">
          <SectionHeading
            icon={Upload}
            title="Recipients"
            description="Upload a CSV or newline-separated list. Duplicates are removed."
          />

          {!file ? (
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const dropped = event.dataTransfer.files?.[0];
                if (dropped) readFile(dropped);
              }}
              className={cn(
                'flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
                isDragging
                  ? 'border-accent bg-accent-soft'
                  : 'border-line-strong bg-surface-sunken/60 hover:border-accent hover:bg-accent-soft/50'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="sr-only"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) readFile(selected);
                }}
              />

              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface shadow-xs ring-1 ring-line">
                <Upload className="h-4 w-4 text-accent" aria-hidden />
              </span>
              <span className="text-sm font-medium text-fg">
                Drop a file here, or click to browse
              </span>
              <span className="mt-1 text-xs text-fg-subtle">CSV or TXT, one address per row</span>
            </label>
          ) : (
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                  <FileText className="h-4 w-4 text-accent" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{file.name}</p>
                  <p className="text-xs text-fg-subtle">
                    {(file.size / 1024).toFixed(1)} KB Â· {fileType.toUpperCase()}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={recipientCount > 0 ? 'success' : 'danger'} dot>
                      {recipientCount.toLocaleString()} valid
                    </Badge>
                    {stats.invalid.length > 0 && (
                      <Badge tone="danger">{stats.invalid.length} invalid</Badge>
                    )}
                    {stats.duplicates > 0 && (
                      <Badge tone="neutral">{stats.duplicates} duplicate removed</Badge>
                    )}
                  </div>

                  {stats.invalid.length > 0 && (
                    <p className="mt-2 truncate text-xs text-fg-subtle">
                      Skipping: {stats.invalid.slice(0, 3).join(', ')}
                      {stats.invalid.length > 3 && ` +${stats.invalid.length - 3} more`}
                    </p>
                  )}
                </div>

                <IconButton label="Remove file" size="sm" onClick={clearFile}>
                  <Trash2 className="h-4 w-4 text-danger-fg" />
                </IconButton>
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-4 px-5 py-5">
          <SectionHeading
            icon={Gauge}
            title="Delivery pacing"
            description="Throttling that keeps sending patterns human."
          />

          <Input
            label="Start sending at"
            type="datetime-local"
            required
            error={errors.startTime?.message}
            {...register('startTime')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Delay between emails"
              type="number"
              min={0}
              suffix="seconds"
              hint="Raised to the server minimum if lower."
              error={errors.delayBetweenEmails?.message}
              {...register('delayBetweenEmails', { valueAsNumber: true })}
            />

            <Input
              label="Hourly limit"
              type="number"
              min={1}
              suffix="per hour"
              hint="Capped by the deployment ceiling."
              error={errors.hourlyLimit?.message}
              {...register('hourlyLimit', { valueAsNumber: true })}
            />
          </div>

          {projection && (
            <div className="rounded-xl border border-line bg-surface-sunken/60 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Projected delivery
              </p>

              <dl className="grid gap-3 sm:grid-cols-3">
                <Projection label="First send" value={startTime ? formatDate(startTime) : 'â€”'} />
                <Projection
                  label="Last send"
                  value={projection.lastSend ? formatDate(projection.lastSend) : 'â€”'}
                />
                <Projection
                  label="Total window"
                  value={formatDuration(projection.spanSeconds)}
                />
              </dl>

              {projection.windows > 1 ? (
                <Notice tone="info" icon={Info} className="mt-3">
                  {recipientCount.toLocaleString()} recipients exceeds the{' '}
                  {projection.safeLimit}/hour limit. The scheduler will send the first{' '}
                  {projection.safeLimit}, then reschedule the rest into later windows in order â€”
                  nothing is dropped, and Slack is notified once per window.
                </Notice>
              ) : (
                <Notice tone="success" icon={CheckCircle2} className="mt-3">
                  This batch fits inside a single hourly window.
                </Notice>
              )}
            </div>
          )}
        </section>
      </form>
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-hover">
        <Icon className="h-3.5 w-3.5 text-fg-muted" aria-hidden />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <p className="text-xs text-fg-subtle">{description}</p>
      </div>
    </div>
  );
}

function Projection({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className="tabular mt-0.5 truncate text-sm font-medium text-fg">{value}</dd>
    </div>
  );
}
