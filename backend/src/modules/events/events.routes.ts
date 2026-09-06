/**
 * Event routes: create, browse, view, edit, and delete events.
 *
 * Events can be public (anyone can see them) or private (only the person
 * who created them can). Anyone can browse and view public events without
 * logging in; creating, editing, and deleting an event all require being
 * logged in, and editing/deleting only works for the event's own creator.
 */

import { Router } from 'express';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { badRequest, forbidden, notFound } from '../../utils/errors';
import { zodIssuesToDetails } from '../../utils/validation';
import { createEventSchema, updateEventSchema, listEventsQuerySchema, rsvpSchema, MIN_DURATION_MS } from './events.schemas';
import {
  type EventRow,
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

const router = Router();

// Turns a route param like ":id" into a real positive integer, or null if
// it isn't one (e.g. "/events/abc") — callers treat null as "not found".
function parseEventId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// A private event is 404'd for non-owners on GET so its existence isn't
// leaked. PUT/DELETE must preserve that: 403 would confirm the event
// exists to someone who can't even see it, defeating the point.
function ownershipError(existing: Pick<EventRow, 'creator_id' | 'visibility'>, userId: number | undefined) {
  if (existing.creator_id === userId) return null;
  return existing.visibility === 'private' ? notFound('Event not found') : forbidden();
}

// A private event doesn't exist as far as anyone but its creator is
// concerned — used by every route that just needs read access to an
// event (viewing it, or RSVPing to it), as opposed to `ownershipError`
// above which additionally distinguishes "can view" from "can edit".
function isHiddenFromViewer(existing: Pick<EventRow, 'creator_id' | 'visibility'>, userId: number | undefined): boolean {
  return existing.visibility === 'private' && existing.creator_id !== userId;
}

/**
 * GET /api/events (login optional)
 *
 * Lists events, page by page. Supports searching by title/location,
 * filtering by tag or visibility, filtering to upcoming/past events, and
 * sorting by start time. Logged-out visitors only see public events;
 * logging in additionally shows that user's own private events.
 */
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

/**
 * POST /api/events (login required)
 *
 * Creates a new event owned by the logged-in user. Tag names are matched
 * to existing tags or created on the fly if they don't exist yet. The
 * start time must be at least 24 hours away, and the event must run for
 * at least 15 minutes.
 */
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

/**
 * GET /api/events/:id (login optional)
 *
 * Fetches one event by id. If the event is private and the caller isn't
 * its creator, this responds as if it doesn't exist at all (404) rather
 * than saying "not allowed" — that way a stranger can't even tell a
 * private event exists.
 */
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

/**
 * PUT /api/events/:id/rsvp (login required)
 *
 * Sets the caller's own RSVP status for an event (upsert — calling this
 * again just changes the existing answer). Anyone who can view the event
 * can RSVP to it, not just people it was somehow "shared" with; the only
 * gate is the same visibility rule `GET /:id` already applies, so this
 * can't be used to probe for the existence of a private event either.
 */
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

/**
 * DELETE /api/events/:id/rsvp (login required)
 *
 * Clears the caller's own RSVP entirely, back to "no response" — distinct
 * from setting status to "not_going", which is still an answer.
 */
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

/**
 * PUT /api/events/:id (login required, creator only)
 *
 * Updates an existing event. Only fields included in the request body are
 * changed — anything left out keeps its current value. Only the event's
 * creator may do this: a logged-in non-owner gets "not allowed" (403) on a
 * public event, but a "not found" (404) on a private one, matching how
 * GET hides private events from non-owners.
 */
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

    // The schema only catches an insufficient gap when both are present in
    // the same request — when only one is being changed, it has to be
    // checked against the other's existing stored value instead.
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

/**
 * DELETE /api/events/:id (login required, creator only)
 *
 * Permanently removes an event. Same ownership rules as updating: only the
 * creator can delete it, with the same 403-vs-404 split for non-owners
 * depending on whether the event is public or private.
 */
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
