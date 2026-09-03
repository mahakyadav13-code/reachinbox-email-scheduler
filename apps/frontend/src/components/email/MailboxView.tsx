import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LucideIcon, RefreshCw, SearchX, Zap } from 'lucide-react';
import { emailApi } from '../../services/api';
import { EmailJob } from '../../types';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { IconButton } from '../ui/Button';
import { EmptyState, ListSkeleton } from '../ui/Feedback';
import { Pagination, SearchInput, Tabs, type TabItem } from '../ui/Misc';
import { Drawer } from '../ui/Overlay';
import { MessageList } from './MessageList';
import { MessageDetail, MessageDetailPlaceholder } from './MessageDetail';

const PAGE_SIZE = 25;

interface MailboxViewProps {
  /** Which listing endpoint backs this view. */
  mailbox: 'scheduled' | 'sent';
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  /** Optional status filter tabs; values are passed straight to the API. */
  tabs?: TabItem<string>[];
}

/**
 * Two-pane mailbox: a scrollable message list beside a detail reader.
 *
 * Shared by Scheduled and Sent so both views stay identical in behaviour -
 * search, paging, selection and keyboard flow are implemented once. Below `xl`
 * the detail pane becomes a drawer, since two panes don't fit comfortably.
 */
export function MailboxView({
  mailbox,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  tabs,
}: MailboxViewProps) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>(tabs?.[0]?.value ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const isSearching = debouncedQuery.length > 0;

  // Searching spans every mailbox (it hits the Elasticsearch-backed endpoint),
  // so the status tabs don't apply while a query is active.
  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: isSearching
      ? ['email-search', debouncedQuery, page]
      : [`${mailbox}-emails`, status, page],
    queryFn: () => {
      if (isSearching) return emailApi.search(debouncedQuery, page, PAGE_SIZE);
      return mailbox === 'scheduled'
        ? emailApi.scheduled(page, PAGE_SIZE, status || undefined)
        : emailApi.sent(page, PAGE_SIZE);
    },
    placeholderData: (previous) => previous,
  });

  const emails = useMemo<EmailJob[]>(() => data?.data?.data ?? [], [data]);
  const pagination = data?.data?.pagination;
  const searchEngine = data?.data?.searchEngine;

  // Reset paging whenever the query or filter changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, status]);

  // Keep a valid selection: default to the first row, and drop a selection that
  // is no longer in the current result set.
  useEffect(() => {
    if (emails.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !emails.some((email) => email.id === selectedId)) {
      setSelectedId(emails[0].id);
    }
  }, [emails, selectedId]);

  const selected = emails.find((email) => email.id === selectedId) ?? null;

  const handleSelect = (email: EmailJob) => {
    setSelectedId(email.id);
    // Below xl the detail pane is hidden, so surface it as a drawer instead.
    if (window.matchMedia('(max-width: 1279px)').matches) setDrawerOpen(true);
  };

  const showEmpty = !isPending && emails.length === 0;

  return (
    <div className="flex h-full">
      {/* ---------------------------------------------------------------- list */}
      <section
        aria-label="Messages"
        className="flex min-w-0 flex-1 flex-col border-r border-line bg-surface xl:max-w-[26rem]"
      >
        <div className="shrink-0 space-y-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search recipient, subject or bodyâ€¦"
              className="flex-1"
            />
            <IconButton
              label="Refresh"
              variant="outline"
              onClick={() => refetch()}
              isLoading={isFetching && !isPending}
            >
              <RefreshCw className="h-4 w-4" />
            </IconButton>
          </div>

          {isSearching ? (
            <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
              <Zap className="h-3.5 w-3.5 text-accent" aria-hidden />
              Searching all messages
              {searchEngine && (
                <span className="text-fg-subtle">
                  Â· {searchEngine === 'elasticsearch' ? 'Elasticsearch' : 'SQL fallback'}
                </span>
              )}
            </p>
          ) : (
            tabs && <Tabs items={tabs} value={status} onChange={setStatus} className="w-full" />
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-slim">
          {isPending ? (
            <ListSkeleton rows={9} />
          ) : showEmpty ? (
            isSearching ? (
              <EmptyState
                icon={SearchX}
                title="No matches"
                description={`Nothing matched â€œ${debouncedQuery}â€. Try a different term or clear the search.`}
              />
            ) : (
              <EmptyState
                icon={emptyIcon}
                title={emptyTitle}
                description={emptyDescription}
              />
            )
          ) : (
            <MessageList
              emails={emails}
              selectedId={selectedId}
              onSelect={handleSelect}
              timeField={mailbox === 'sent' ? 'sentAt' : 'scheduledAt'}
            />
          )}
        </div>

        {pagination && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            onPageChange={setPage}
          />
        )}
      </section>

      {/* -------------------------------------------------------------- detail */}
      <section
        aria-label="Message detail"
        className="hidden min-w-0 flex-1 bg-surface-sunken/60 xl:block"
      >
        {selected ? <MessageDetail email={selected} /> : <MessageDetailPlaceholder />}
      </section>

      {/* Narrow screens read the message in a drawer. */}
      <Drawer
        isOpen={drawerOpen && Boolean(selected)}
        onClose={() => setDrawerOpen(false)}
        title="Message"
        width="lg"
      >
        {selected && <MessageDetail email={selected} />}
      </Drawer>
    </div>
  );
}
