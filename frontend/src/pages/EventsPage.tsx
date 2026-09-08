import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, getErrorMessage } from '../api/client';
import { resendVerification } from '../api/auth/resend-verification';
import { deleteEvent } from '../api/events/event-deletor';
import { useAuth } from '../contexts/auth';
import { useDebounce } from '../hooks/use-debounce';
import { useEvents } from '../query/events/use-events';
import { useTags } from '../query/tags/use-tags';
import { Button, Select } from '../components/ui';
import { AppShell } from '../components/AppShell';
import { ROUTES } from '../config/routes';
import { EventCard } from '../components/EventCard';
import { Pagination } from '../components/Pagination';
import { ConfirmDialog } from '../components/ConfirmDialog';

const LIMIT = 10;

interface FiltersFormValues {
  search: string;
  tag: string;
  visibility: '' | 'public' | 'private';
  sort: 'starts_at' | '-starts_at' | 'popularity' | '-popularity' | 'created_at' | '-created_at';
}

export default function EventsPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<'upcoming' | 'past'>('upcoming');
  const [page, setPage] = useState(1);

  const { register, watch, setValue } = useForm<FiltersFormValues>({
    defaultValues: { search: '', tag: '', visibility: '', sort: 'starts_at' },
  });
  const searchInput = watch('search');
  const tag = watch('tag');
  const visibility = watch('visibility');
  const sort = watch('sort');

  const search = useDebounce(searchInput, 400).trim();

  const eventsQuery = useEvents(
    {
      page,
      limit: LIMIT,
      search: search || undefined,
      tag: tag || undefined,
      visibility: visibility || undefined,
      status,
      sort,
    },
    token,
  );

  useEffect(() => {
    setPage(1);
  }, [search, tag, visibility, sort]);

  function handleStatusChange(next: 'upcoming' | 'past') {
    setStatus(next);
    // Only flip the date-sort default — don't overwrite an explicit popularity sort.
    if (sort === 'starts_at' || sort === '-starts_at') {
      setValue('sort', next === 'upcoming' ? 'starts_at' : '-starts_at');
    }
    setPage(1);
  }

  function toggleVisibility(next: 'public' | 'private') {
    setValue('visibility', visibility === next ? '' : next);
  }

  function toggleTag(next: string) {
    setValue('tag', tag === next ? '' : next);
  }

  const tagsQuery = useTags();

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEvent(id, token as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted');
      setPendingDeleteId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to delete event.')),
  });

  const resendMutation = useMutation({
    mutationFn: () => resendVerification(token as string),
  });

  const events = eventsQuery.data?.data ?? [];
  const pagination = eventsQuery.data?.pagination;
  const tags = tagsQuery.data?.data ?? [];

  const error = eventsQuery.isError ? getErrorMessage(eventsQuery.error, 'Failed to load events.') : null;

  const noFilterActive = !visibility && !tag;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          {user && (
            <Button onClick={() => navigate(ROUTES.EVENT_NEW)} className="gap-1.5">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create event
            </Button>
          )}
        </div>

        {user && !user.emailVerified && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {resendMutation.isSuccess ? (
              <span>Verification email sent — check your inbox (or the backend console in dev).</span>
            ) : (
              <>
                <span>Please verify your email address.</span>
                <Button variant="secondary" onClick={() => resendMutation.mutate()} disabled={resendMutation.isPending}>
                  {resendMutation.isPending ? 'Sending…' : 'Resend verification email'}
                </Button>
              </>
            )}
            {resendMutation.isError && (
              <span className="text-red-600">
                {resendMutation.error instanceof ApiError ? resendMutation.error.message : 'Failed to send.'}
              </span>
            )}
          </div>
        )}

        <div className="inline-flex rounded-md border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => handleStatusChange('upcoming')}
            className={`rounded px-4 py-1.5 text-sm font-medium transition ${
              status === 'upcoming' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => handleStatusChange('past')}
            className={`rounded px-4 py-1.5 text-sm font-medium transition ${
              status === 'past' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Past
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              aria-label="Search events"
              placeholder="Search events…"
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-9 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              {...register('search')}
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setValue('search', '')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="w-40">
            {/* Label text (not the option order/values — those stay fixed
                so the selected option's identity can't drift across a
                re-render) describes what `starts_at`/`-starts_at`
                actually produce for the *active* tab: `-starts_at` means
                "farthest away first" on Upcoming but "most recent first"
                on Past, so a single static label pair would describe the
                wrong thing on one of the two tabs. */}
            <Select aria-label="Sort" {...register('sort')}>
              <option value="starts_at">{status === 'upcoming' ? 'Soonest first' : 'Oldest first'}</option>
              <option value="-starts_at">{status === 'upcoming' ? 'Latest first' : 'Most recent first'}</option>
              <option value="-popularity">Most popular</option>
              <option value="popularity">Least popular</option>
              <option value="-created_at">Recently added</option>
              <option value="created_at">Oldest added</option>
            </Select>
          </div>
        </div>

        {/* Scrolls horizontally instead of wrapping — with enough tags this
            row would otherwise wrap to 2-3 lines and grow the page's height
            unpredictably depending on window width. */}
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => {
              setValue('visibility', '');
              setValue('tag', '');
            }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              noFilterActive ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => toggleVisibility('public')}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              visibility === 'public' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Public
          </button>
          {token && (
            <button
              type="button"
              onClick={() => toggleVisibility('private')}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                visibility === 'private' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Private
            </button>
          )}
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTag(t.name)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition ${
                tag === t.name ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div>
          {eventsQuery.isLoading ? (
            <p className="text-gray-500">Loading events…</p>
          ) : events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
              <p className="text-gray-500">No events found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isOwner={user?.id === event.creatorId}
                  onEdit={() => navigate(ROUTES.EVENT_EDIT(event.id))}
                  onDelete={() => setPendingDeleteId(event.id)}
                  deleteDisabled={deleteMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>

        {pagination && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {events.length === 0
                ? '0 events'
                : `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} events`}
            </p>
            <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this event?"
        description="This cannot be undone."
        confirmLabel="Delete event"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => pendingDeleteId !== null && deleteMutation.mutate(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </AppShell>
  );
}
