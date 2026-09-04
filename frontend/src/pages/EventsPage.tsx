import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { deleteEvent } from '../api/events/event-deletor';
import { useAuth } from '../contexts/auth';
import { useEvents } from '../query/events/use-events';
import { useTags } from '../query/tags/use-tags';
import { Button, Input, Select } from '../components/ui';

const LIMIT = 10;

export default function EventsPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [tag, setTag] = useState('');
  const [visibility, setVisibility] = useState<'' | 'public' | 'private'>('');
  const [sort, setSort] = useState<'starts_at' | '-starts_at'>('starts_at');

  const eventsQuery = useEvents(
    {
      page,
      limit: LIMIT,
      search: search || undefined,
      tag: tag || undefined,
      visibility: visibility || undefined,
      sort,
    },
    token,
  );
  const tagsQuery = useTags();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEvent(id, token as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleDelete(id: number) {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    deleteMutation.mutate(id);
  }

  const events = eventsQuery.data?.data ?? [];
  const pagination = eventsQuery.data?.pagination;
  const tags = tagsQuery.data?.data ?? [];

  const error = deleteMutation.isError
    ? deleteMutation.error instanceof ApiError
      ? deleteMutation.error.message
      : 'Failed to delete event.'
    : eventsQuery.isError
      ? eventsQuery.error instanceof ApiError
        ? eventsQuery.error.message
        : 'Failed to load events.'
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Event Planner</h1>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Button onClick={() => navigate('/events/new')}>New event</Button>
                <span className="text-sm text-gray-600">{user.name}</span>
                <Button variant="secondary" onClick={logout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  Log in
                </Link>
                <Link to="/register" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <form onSubmit={handleSearchSubmit} className="mb-6 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="search" className="mb-1 block text-sm font-medium text-gray-700">
              Search
            </label>
            <Input
              id="search"
              placeholder="Title or location"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="tag-filter" className="mb-1 block text-sm font-medium text-gray-700">
              Tag
            </label>
            <Select
              id="tag-filter"
              value={tag}
              onChange={(event) => {
                setPage(1);
                setTag(event.target.value);
              }}
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="visibility-filter" className="mb-1 block text-sm font-medium text-gray-700">
              Visibility
            </label>
            <Select
              id="visibility-filter"
              value={visibility}
              onChange={(event) => {
                setPage(1);
                setVisibility(event.target.value as '' | 'public' | 'private');
              }}
            >
              <option value="">All</option>
              <option value="public">Public</option>
              {token && <option value="private">Private (mine)</option>}
            </Select>
          </div>
          <div>
            <label htmlFor="sort" className="mb-1 block text-sm font-medium text-gray-700">
              Sort
            </label>
            <Select
              id="sort"
              value={sort}
              onChange={(event) => {
                setPage(1);
                setSort(event.target.value as 'starts_at' | '-starts_at');
              }}
            >
              <option value="starts_at">Upcoming first</option>
              <option value="-starts_at">Latest first</option>
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </form>

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}

        {eventsQuery.isLoading ? (
          <p className="text-gray-500">Loading events…</p>
        ) : events.length === 0 ? (
          <p className="text-gray-500">No events found.</p>
        ) : (
          <ul className="space-y-4">
            {events.map((event) => (
              <li key={event.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-gray-900">{event.title}</h2>
                      {event.visibility === 'private' && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Private
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {new Date(event.startsAt).toLocaleString()} · {event.location}
                    </p>
                    {event.description && <p className="mt-2 text-sm text-gray-700">{event.description}</p>}
                    {event.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {event.tags.map((t) => (
                          <span key={t} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {user?.id === event.creatorId && (
                    <div className="flex shrink-0 gap-2">
                      <Button variant="secondary" onClick={() => navigate(`/events/${event.id}/edit`)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => handleDelete(event.id)} disabled={deleteMutation.isPending}>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button variant="secondary" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
