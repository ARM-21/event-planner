import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Check, Clock, Globe, HelpCircle, Lock, MapPin, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, getErrorMessage } from '../api/client';
import type { RsvpStatus } from '../api/events/types';
import { deleteEvent } from '../api/events/event-deletor';
import { clearEventRsvp } from '../api/events/event-rsvp-clearer';
import { setEventRsvp } from '../api/events/event-rsvp-setter';
import { useAuth } from '../contexts/auth';
import { useEvent } from '../query/events/use-event';
import { formatEventRange } from '../lib/formatEventRange';
import { tagPillClass, coverGradientClass } from '../lib/tagStyle';
import { initials } from '../lib/initials';
import { ROUTES } from '../config/routes';
import { Button, Card, PageLoader, Spinner } from '../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';

export default function EventDetailPage() {
  const { id } = useParams();
  const eventId = id ? Number(id) : undefined;
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const eventQuery = useEvent(eventId, token);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteEvent(eventId as number, token as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted');
      navigate(ROUTES.EVENTS);
    },
    onError: (err) => {
      setConfirmingDelete(false);
      toast.error(getErrorMessage(err, 'Failed to delete event.'));
    },
  });

  const setRsvpMutation = useMutation({
    mutationFn: (status: RsvpStatus) => setEventRsvp(eventId as number, status, token as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', eventId] }),
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update RSVP.')),
  });

  const clearRsvpMutation = useMutation({
    mutationFn: () => clearEventRsvp(eventId as number, token as string),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events', eventId] }),
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update RSVP.')),
  });

  // Clicking the already-selected option clears it back to "no response".
  function handleRsvp(status: RsvpStatus, currentStatus: RsvpStatus | null | undefined) {
    if (currentStatus === status) {
      clearRsvpMutation.mutate();
    } else {
      setRsvpMutation.mutate(status);
    }
  }

  // Hand-styled rather than the shared `Button` component — three mutually exclusive states, no matching variant.
  // Full-width equal thirds below sm (so labels get room and don't wrap), natural sizing above it.
  const rsvpButtonBaseClass =
    'inline-flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:gap-1.5 sm:px-4 sm:text-sm';
  const rsvpButtonInactiveClass = 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  const rsvpActiveClassByStatus: Record<RsvpStatus, string> = {
    going: 'bg-indigo-600 text-white',
    maybe: 'bg-amber-500 text-white',
    not_going: 'bg-red-600 text-white',
  };
  function rsvpButtonClass(status: RsvpStatus, myStatus: RsvpStatus | null | undefined): string {
    return `${rsvpButtonBaseClass} ${myStatus === status ? rsvpActiveClassByStatus[status] : rsvpButtonInactiveClass}`;
  }

  if (eventQuery.isLoading) {
    return (
      <>
        <PageLoader label="Loading event…" />
      </>
    );
  }

  if (eventQuery.isError || !eventQuery.data) {
    const message = eventQuery.error instanceof ApiError ? eventQuery.error.message : 'Event not found.';
    return (
      <>
        <Card className="mx-auto max-w-sm text-center">
          <p className="text-gray-700">{message}</p>
          <Link to={ROUTES.EVENTS} className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Back to events
          </Link>
        </Card>
      </>
    );
  }

  const event = eventQuery.data;
  const isOwner = user?.id === event.creatorId;
  // RSVP closes once the event is over. The backend rejects it too, this just
  // keeps the controls from being offered in the first place.
  const hasEnded = new Date(event.endsAt) < new Date();
  // Only the button that was actually clicked spins. Clearing an RSVP re-clicks
  // the currently selected one, so that is the one to mark as pending.
  const pendingRsvp: RsvpStatus | null = setRsvpMutation.isPending
    ? (setRsvpMutation.variables as RsvpStatus)
    : clearRsvpMutation.isPending
      ? event.rsvp?.myStatus ?? null
      : null;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to={ROUTES.EVENTS}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to events
          </Link>
          {isOwner && (
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" onClick={() => navigate(ROUTES.EVENT_EDIT(event.id))} className="gap-1.5">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit event
              </Button>
              <Button
                variant="danger"
                onClick={() => setConfirmingDelete(true)}
                loading={deleteMutation.isPending}
                className="gap-1.5"
              >
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

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">{event.rsvp?.goingCount ?? 0}</span>{' '}
              {hasEnded ? 'went' : 'going'}
            </p>
            {hasEnded && (
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                This event has ended
              </span>
            )}
            {user && !isOwner && !hasEnded && (
              <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleRsvp('going', event.rsvp?.myStatus)}
                  disabled={setRsvpMutation.isPending || clearRsvpMutation.isPending}
                  className={rsvpButtonClass('going', event.rsvp?.myStatus)}
                >
                  {pendingRsvp === 'going' ? <Spinner /> : <Check className="h-4 w-4" aria-hidden="true" />}
                  I&apos;m going
                </button>
                <button
                  type="button"
                  onClick={() => handleRsvp('maybe', event.rsvp?.myStatus)}
                  disabled={setRsvpMutation.isPending || clearRsvpMutation.isPending}
                  className={rsvpButtonClass('maybe', event.rsvp?.myStatus)}
                >
                  {pendingRsvp === 'maybe' ? <Spinner /> : <HelpCircle className="h-4 w-4" aria-hidden="true" />}
                  Maybe
                </button>
                <button
                  type="button"
                  onClick={() => handleRsvp('not_going', event.rsvp?.myStatus)}
                  disabled={setRsvpMutation.isPending || clearRsvpMutation.isPending}
                  className={rsvpButtonClass('not_going', event.rsvp?.myStatus)}
                >
                  {pendingRsvp === 'not_going' ? <Spinner /> : <X className="h-4 w-4" aria-hidden="true" />}
                  Can&apos;t go
                </button>
              </div>
            )}
          </div>

          {event.description && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h2 className="text-base font-semibold text-gray-900">About this event</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{event.description}</p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2.5">
              {/* Initials only. The API exposes the creator's name and nothing
                  else, so there is no image to load and nothing to link to. */}
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700"
              >
                {initials(event.creatorName)}
              </span>
              <span className="text-sm text-gray-600">
                Hosted by <span className="font-medium text-gray-900">{event.creatorName}</span>
              </span>
            </div>
            <span className="text-xs text-gray-400">
              Created {new Date(event.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this event?"
        description="This cannot be undone."
        confirmLabel="Delete event"
        isConfirming={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}
