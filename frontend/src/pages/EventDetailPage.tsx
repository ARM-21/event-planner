import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Clock, Globe, Lock, MapPin, Pencil, Trash2 } from 'lucide-react';
import { ApiError } from '../api/client';
import { deleteEvent } from '../api/events/event-deletor';
import { useAuth } from '../contexts/auth';
import { useEvent } from '../query/events/use-event';
import { formatEventRange } from '../lib/formatEventRange';
import { tagPillClass, coverGradientClass } from '../lib/tagStyle';
import { AppShell } from '../components/AppShell';
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
    return (
      <AppShell>
        <p className="text-gray-500">Loading…</p>
      </AppShell>
    );
  }

  if (eventQuery.isError || !eventQuery.data) {
    const message = eventQuery.error instanceof ApiError ? eventQuery.error.message : 'Event not found.';
    return (
      <AppShell>
        <Card className="mx-auto max-w-sm text-center">
          <p className="text-gray-700">{message}</p>
          <Link to="/events" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Back to events
          </Link>
        </Card>
      </AppShell>
    );
  }

  const event = eventQuery.data;
  const isOwner = user?.id === event.creatorId;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to events
          </Link>
          {isOwner && (
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => navigate(`/events/${event.id}/edit`)} className="gap-1.5">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit event
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending} className="gap-1.5">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete event
              </Button>
            </div>
          )}
        </div>

        <Card>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
            <div
              className={`flex h-48 items-center justify-center rounded-lg bg-gradient-to-br lg:h-full ${coverGradientClass(
                event.title + event.id,
              )}`}
            >
              <Calendar className="h-12 w-12 text-white/40" aria-hidden="true" />
            </div>

            <div className="flex flex-col justify-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
              <div className="space-y-1.5 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                  {formatEventRange(event.startsAt, event.endsAt)}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                  {event.location}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {event.tags.map((tag) => (
                  <span key={tag} className={`rounded-full px-2.5 py-1 text-xs font-medium ${tagPillClass(tag)}`}>
                    {tag}
                  </span>
                ))}
                {event.visibility === 'public' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <Globe className="h-3 w-3" aria-hidden="true" />
                    Public
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    Private
                  </span>
                )}
              </div>
            </div>
          </div>

          {event.description && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h2 className="text-base font-semibold text-gray-900">About this event</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{event.description}</p>
            </div>
          )}

          <div className="mt-6 border-t border-gray-200 pt-4 text-xs text-gray-400">
            Created {new Date(event.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>

          {deleteMutation.isError && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {deleteMutation.error instanceof ApiError ? deleteMutation.error.message : 'Failed to delete event.'}
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
