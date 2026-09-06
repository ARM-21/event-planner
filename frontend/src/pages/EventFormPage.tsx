import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '../api/client';
import { createEvent } from '../api/events/event-creator';
import { updateEvent } from '../api/events/event-updater';
import type { EventInput } from '../api/events/types';
import { useAuth } from '../contexts/auth';
import { useEvent } from '../query/events/use-event';
import { useTags } from '../query/tags/use-tags';
import { createEventFormSchema, eventFormSchema, MIN_LEAD_TIME_MS, type EventFormValues } from '../lib/schemas';
import { Button, Card, Field, Input, Select, Textarea } from '../components/ui';
import { AppShell } from '../components/AppShell';
import { TagInput } from '../components/TagInput';

function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const emptyDefaults: EventFormValues = {
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  location: '',
  visibility: 'public',
  tags: [],
};

export default function EventFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const eventId = id ? Number(id) : undefined;
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [originalTags, setOriginalTags] = useState<string[]>([]);
  const [forbidden, setForbidden] = useState(false);

  const eventQuery = useEvent(eventId, token);
  const tagsQuery = useTags();
  const tagSuggestions = tagsQuery.data?.data.map((t) => t.name) ?? [];

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, dirtyFields },
  } = useForm<EventFormValues>({
    resolver: zodResolver(isEdit ? eventFormSchema : createEventFormSchema),
    defaultValues: emptyDefaults,
  });

  const watchedStartsAt = watch('startsAt');
  // Only nudges the native picker on create — an existing event's startsAt
  // may already be under 24h out, and forcing this min in edit mode would
  // make that field impossible to leave alone in the UI (even though
  // submitting it unchanged is still fine, since it won't be re-validated).
  const minStartsAt = isEdit ? undefined : toDatetimeLocal(new Date(Date.now() + MIN_LEAD_TIME_MS).toISOString());

  useEffect(() => {
    if (!eventQuery.data) return;
    const event = eventQuery.data;
    if (event.creatorId !== user?.id) {
      setForbidden(true);
      return;
    }
    setOriginalTags(event.tags);
    reset({
      title: event.title,
      description: event.description ?? '',
      startsAt: toDatetimeLocal(event.startsAt),
      endsAt: toDatetimeLocal(event.endsAt),
      location: event.location,
      visibility: event.visibility,
      tags: event.tags,
    });
  }, [eventQuery.data, user?.id, reset]);

  const createMutation = useMutation({
    mutationFn: (data: EventInput) => createEvent(data, token as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Event created');
      navigate('/events');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<EventInput>) => updateEvent(eventId as number, data, token as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Event updated');
      navigate('/events');
    },
  });

  async function onSubmit(values: EventFormValues) {
    if (!token) return;
    try {
      if (isEdit && eventId) {
        // Only send fields that actually changed — startsAt must be in the
        // future on write, so resubmitting an unchanged past date would
        // otherwise fail validation on an edit that never touched it.
        const payload: Partial<EventInput> = {};
        if (dirtyFields.title) payload.title = values.title;
        if (dirtyFields.description) payload.description = values.description || undefined;
        if (dirtyFields.location) payload.location = values.location;
        if (dirtyFields.visibility) payload.visibility = values.visibility;
        if (dirtyFields.startsAt) payload.startsAt = new Date(values.startsAt).toISOString();
        if (dirtyFields.endsAt) payload.endsAt = new Date(values.endsAt).toISOString();
        if (!arraysEqual(values.tags, originalTags)) payload.tags = values.tags;

        if (Object.keys(payload).length > 0) {
          await updateMutation.mutateAsync(payload);
        } else {
          toast.info('No changes to save');
          navigate('/events');
        }
      } else {
        await createMutation.mutateAsync({
          title: values.title,
          description: values.description || undefined,
          startsAt: new Date(values.startsAt).toISOString(),
          endsAt: new Date(values.endsAt).toISOString(),
          location: values.location,
          visibility: values.visibility,
          tags: values.tags,
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.details && err.details.length > 0) {
        for (const detail of err.details) {
          setError(detail.field as keyof EventFormValues, { message: detail.message });
        }
      } else {
        setError('root', { message: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
      }
    }
  }

  if (isEdit && eventQuery.isLoading) {
    return (
      <AppShell>
        <p className="text-gray-500">Loading…</p>
      </AppShell>
    );
  }

  if (forbidden) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-sm text-center">
          <p className="text-gray-700">You don&apos;t have permission to edit this event.</p>
          <Button className="mt-4" onClick={() => navigate('/events')}>
            Back to events
          </Button>
        </Card>
      </AppShell>
    );
  }

  if (isEdit && eventQuery.isError) {
    const message = eventQuery.error instanceof ApiError ? eventQuery.error.message : 'Failed to load event.';
    return (
      <AppShell>
        <Card className="mx-auto max-w-sm text-center">
          <p className="text-gray-700">{message}</p>
          <Button className="mt-4" onClick={() => navigate('/events')}>
            Back to events
          </Button>
        </Card>
      </AppShell>
    );
  }

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          to="/events"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to events
        </Link>

        <Card>
          <h1 className="mb-6 text-xl font-semibold text-gray-900">{isEdit ? 'Edit event' : 'Create event'}</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Title" htmlFor="title" error={errors.title?.message}>
              <Input id="title" {...register('title')} />
            </Field>
            <Field label="Description" htmlFor="description" error={errors.description?.message}>
              <Textarea id="description" rows={3} {...register('description')} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Starts at" htmlFor="startsAt" error={errors.startsAt?.message}>
                <Input id="startsAt" type="datetime-local" min={minStartsAt} {...register('startsAt')} />
              </Field>
              <Field label="Ends at" htmlFor="endsAt" error={errors.endsAt?.message}>
                <Input id="endsAt" type="datetime-local" min={watchedStartsAt || undefined} {...register('endsAt')} />
              </Field>
            </div>
            <Field label="Location" htmlFor="location" error={errors.location?.message}>
              <Input id="location" {...register('location')} />
            </Field>
            <Field label="Visibility" htmlFor="visibility" error={errors.visibility?.message}>
              <Select id="visibility" {...register('visibility')}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </Select>
            </Field>
            <Field label="Tags" htmlFor="tags" error={errors.tags?.message}>
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <TagInput id="tags" value={field.value} onChange={field.onChange} suggestions={tagSuggestions} />
                )}
              />
            </Field>
            {errors.root && (
              <p role="alert" className="text-sm text-red-600">
                {errors.root.message}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/events')}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
