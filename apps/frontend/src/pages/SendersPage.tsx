import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Gauge, Info, Plus, Trash2, Users } from 'lucide-react';
import { senderApi } from '../services/api';
import { Sender } from '../types';
import { AppShell } from '../components/layout/AppShell';
import { Button, IconButton } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Field';
import { EmptyState, Notice, Skeleton } from '../components/ui/Feedback';
import { Avatar } from '../components/ui/Misc';
import { ConfirmDialog, Modal } from '../components/ui/Overlay';

const schema = z.object({
  name: z.string().min(1, 'Give this identity a display name'),
  email: z.string().email('Enter a valid email address'),
});

type FormData = z.infer<typeof schema>;

export function SendersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Sender | null>(null);
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['senders'],
    queryFn: () => senderApi.list(),
  });

  const senders = data?.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const closeCreate = () => {
    setCreateOpen(false);
    reset();
  };

  const createSender = useMutation({
    mutationFn: (payload: FormData) => senderApi.create(payload),
    onSuccess: () => {
      toast.success('Sending identity added');
      queryClient.invalidateQueries({ queryKey: ['senders'] });
      closeCreate();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error ?? 'Could not add that sender');
    },
  });

  const deleteSender = useMutation({
    mutationFn: (id: string) => senderApi.delete(id),
    onSuccess: () => {
      toast.success('Sending identity removed');
      queryClient.invalidateQueries({ queryKey: ['senders'] });
      setPendingDelete(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error ?? 'Could not remove that sender');
      setPendingDelete(null);
    },
  });

  return (
    <AppShell title="Senders" description="Identities that campaigns send from">
      <div className="mx-auto max-w-3xl space-y-5">
        <Notice tone="info" icon={Gauge} title="Why more than one sender?">
          Rate limits are tracked per identity, keyed by sender and hour window. Spreading a
          large batch across several senders multiplies the hourly throughput without
          loosening any individual limit.
        </Notice>

        <Card>
          <CardHeader
            title="Sending identities"
            description={`${senders.length} configured`}
            actions={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Add sender
              </Button>
            }
          />

          {isPending ? (
            <div className="divide-y divide-line">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-4">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : senders.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No sending identities"
              description="Add at least one identity before scheduling a campaign."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add your first sender
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {senders.map((sender) => (
                <li
                  key={sender.id}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-sunken/70"
                >
                  <Avatar name={sender.name} email={sender.email} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{sender.name}</p>
                    <p className="truncate text-xs text-fg-subtle">{sender.email}</p>
                  </div>

                  <IconButton
                    label={`Remove ${sender.name}`}
                    size="sm"
                    onClick={() => setPendingDelete(sender)}
                  >
                    <Trash2 className="h-4 w-4 text-danger-fg" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------- create */}
      <Modal
        isOpen={createOpen}
        onClose={closeCreate}
        title="Add sending identity"
        description="Used as the From name and address on outgoing mail."
        footer={
          <>
            <Button variant="outline" onClick={closeCreate} disabled={createSender.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit((values) => createSender.mutate(values))}
              isLoading={createSender.isPending}
            >
              Add sender
            </Button>
          </>
        }
      >
        <form
          onSubmit={handleSubmit((values) => createSender.mutate(values))}
          className="space-y-4"
        >
          <Input
            label="Display name"
            required
            placeholder="Priya from Acme"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="Email address"
            type="email"
            required
            placeholder="priya@acme.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Notice tone="info" icon={Info}>
            Delivery runs through the shared test SMTP mailbox, so this address is the From
            identity and rate-limit key rather than a real mailbox.
          </Notice>
        </form>
      </Modal>

      {/* ------------------------------------------------------------- delete */}
      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteSender.mutate(pendingDelete.id)}
        title="Remove sending identity?"
        message={
          pendingDelete
            ? `${pendingDelete.name} (${pendingDelete.email}) will no longer be selectable when composing. Campaigns that already used it are unaffected.`
            : ''
        }
        confirmLabel="Remove sender"
        isLoading={deleteSender.isPending}
      />
    </AppShell>
  );
}
