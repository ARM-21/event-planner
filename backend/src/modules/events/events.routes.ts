import { Router } from 'express';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { badRequest, forbidden, notFound } from '../../utils/errors';
import { zodIssuesToDetails } from '../../utils/validation';
import { createEventSchema, updateEventSchema, listEventsQuerySchema, rsvpSchema, MIN_DURATION_MS } from './events.schemas';
import {
  toPublicEvent,
  fetchTagsByEventIds,
  fetchRsvpSummary,
  listEvents,
  findEventById,
  createEventRecord,
  updateEventRecord,
  deleteEventRecord,
  upsertRsvp,
  deleteRsvp,
} from './events.service';
import type { EventRow } from './events.types';

const router = Router();

// null means the param isn't a valid id (e.g. "/events/abc") — callers
// treat that as "not found".
function parseEventId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// 404 (not 403) for a non-owner on a private event, so PUT/DELETE don't
// leak its existence either.
function ownershipError(existing: Pick<EventRow, 'creator_id' | 'visibility'>, userId: number | undefined) {
  if (existing.creator_id === userId) return null;
  return existing.visibility === 'private' ? notFound('Event not found') : forbidden();
}

// Used by read-only routes (view, RSVP); ownershipError above is for
// write routes that also need to distinguish "can view" from "can edit".
function isHiddenFromViewer(existing: Pick<EventRow, 'creator_id' | 'visibility'>, userId: number | undefined): boolean {
  return existing.visibility === 'private' && existing.creator_id !== userId;
}

router.get('/', optionalAuth, async (req, res, next) => {
  const parsed = listEventsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(badRequest('Validation failed', zodIssuesToDetails(parsed.error)));
    return;
  }
  const { page, limit, search, tag, visibility, from, status, sort } = parsed.data;

  try {
    const { rows, total } = await listEvents({ page, limit, search, tag, visibility, from, status, sort }, req.userId);

    const tagsByEvent = await fetchTagsByEventIds(rows.map((row) => row.id));
    const data = rows.map((row) => toPublicEvent(row, tagsByEvent.get(row.id) ?? []));

    res.json({
      data,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    next(badRequest('Validation failed', zodIssuesToDetails(parsed.error)));
    return;
  }
  const { title, description, startsAt, endsAt, location, visibility, tags } = parsed.data;

  try {
    const event = await createEventRecord({
      creatorId: req.userId!,
      title,
      description: description ?? null,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      location,
      visibility,
      tags,
    });

    const tagsByEvent = await fetchTagsByEventIds([event.id]);
    res.status(201).json(toPublicEvent(event, tagsByEvent.get(event.id) ?? []));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  const id = parseEventId(req.params.id);
  if (id === null) {
    next(notFound('Event not found'));
    return;
  }
  try {
    const row = await findEventById(id);
    if (!row || isHiddenFromViewer(row, req.userId)) {
      next(notFound('Event not found'));
      return;
    }
    const tagsByEvent = await fetchTagsByEventIds([row.id]);
    const rsvp = await fetchRsvpSummary(row.id, req.userId);
    res.json({ ...toPublicEvent(row, tagsByEvent.get(row.id) ?? []), rsvp });
  } catch (err) {
    next(err);
  }
});

// Upsert: anyone who can view the event can RSVP, same visibility gate as GET /:id.
router.put('/:id/rsvp', requireAuth, async (req, res, next) => {
  const id = parseEventId(req.params.id);
  if (id === null) {
    next(notFound('Event not found'));
    return;
  }
  const parsed = rsvpSchema.safeParse(req.body);
  if (!parsed.success) {
    next(badRequest('Validation failed', zodIssuesToDetails(parsed.error)));
    return;
  }

  try {
    const existing = await findEventById(id);
    if (!existing || isHiddenFromViewer(existing, req.userId)) {
      next(notFound('Event not found'));
      return;
    }

    await upsertRsvp(id, req.userId!, parsed.data.status);

    const rsvp = await fetchRsvpSummary(id, req.userId);
    res.json(rsvp);
  } catch (err) {
    next(err);
  }
});

// Clears the RSVP to "no response" — distinct from status "not_going".
router.delete('/:id/rsvp', requireAuth, async (req, res, next) => {
  const id = parseEventId(req.params.id);
  if (id === null) {
    next(notFound('Event not found'));
    return;
  }

  try {
    const existing = await findEventById(id);
    if (!existing || isHiddenFromViewer(existing, req.userId)) {
      next(notFound('Event not found'));
      return;
    }

    await deleteRsvp(id, req.userId!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  const id = parseEventId(req.params.id);
  if (id === null) {
    next(notFound('Event not found'));
    return;
  }
  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    next(badRequest('Validation failed', zodIssuesToDetails(parsed.error)));
    return;
  }

  try {
    const existing = await findEventById(id);
    if (!existing) {
      next(notFound('Event not found'));
      return;
    }
    const authzError = ownershipError(existing, req.userId);
    if (authzError) {
      next(authzError);
      return;
    }

    const { tags, startsAt, endsAt, ...rest } = parsed.data;

    // schema only validates the gap when both fields are present together;
    // when only one changes, check it against the other's stored value
    const effectiveStartsAt = startsAt ? new Date(startsAt) : new Date(existing.starts_at);
    const effectiveEndsAt = endsAt ? new Date(endsAt) : new Date(existing.ends_at);
    if (effectiveEndsAt.getTime() - effectiveStartsAt.getTime() < MIN_DURATION_MS) {
      next(
        badRequest('Validation failed', [
          { field: 'endsAt', message: 'endsAt must be at least 15 minutes after startsAt' },
        ]),
      );
      return;
    }

    const updates: Record<string, unknown> = { ...rest };
    if (startsAt) updates.starts_at = new Date(startsAt);
    if (endsAt) updates.ends_at = new Date(endsAt);

    const row = await updateEventRecord(id, { updates, tags });

    const tagsByEvent = await fetchTagsByEventIds([id]);
    res.json(toPublicEvent(row, tagsByEvent.get(id) ?? []));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  const id = parseEventId(req.params.id);
  if (id === null) {
    next(notFound('Event not found'));
    return;
  }
  try {
    const existing = await findEventById(id);
    if (!existing) {
      next(notFound('Event not found'));
      return;
    }
    const authzError = ownershipError(existing, req.userId);
    if (authzError) {
      next(authzError);
      return;
    }
    await deleteEventRecord(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
