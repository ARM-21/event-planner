import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { deleteEvent } from '../api/events/event-deletor';
import { useAuth } from '../contexts/auth';
import { useEvent } from '../query/events/use-event';
import { formatEventRange } from '../lib/formatEventRange';
import { Button, Card } from '../components/ui';

export default function EventDetailPage() {
  const { id } = useParams();
  const eventId = id ? Number(id) : undefined;
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const eventQuery = useEvent(eventId, token);

  const deleteMutation = useMutation({
    mutationFn: () => deleteEvent(eventId as number, token as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate('/events');
    },
  });

  function handleDelete() {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    deleteMutation.mutate();
  }

  if (eventQuery.isLoading) {
    return <p className="p-8 text-gray-500">Loading…</p>;
  }

  if (eventQuery.isError || !eventQuery.data) {
    const message = eventQuery.error instanceof ApiError ? eventQuery.error.message : 'Event not found.';
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-sm text-center">
          <p className="text-gray-700">{message}</p>
          <Link to="/events" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Back to events
          </Link>
        </Card>
      </div>
    );
  }

  const event = eventQuery.data;
  const isOwner = user?.id === event.creatorId;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Link to="/events" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            ← Back to events
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-gray-900">{event.title}</h1>
                {event.visibility === 'private' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Private</span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {formatEventRange(event.startsAt, event.endsAt)} · {event.location}
              </p>
            </div>
            {isOwner && (
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" onClick={() => navigate(`/events/${event.id}/edit`)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
                  Delete
                </Button>
              </div>
            )}
          </div>

          {event.description && <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{event.description}</p>}

          {event.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {event.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {deleteMutation.isError && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {deleteMutation.error instanceof ApiError ? deleteMutation.error.message : 'Failed to delete event.'}
            </p>
          )}
        </Card>
      </main>
    </div>
  );
}
