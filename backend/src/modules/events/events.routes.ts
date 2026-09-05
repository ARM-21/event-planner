/**
 * Event routes: create, browse, view, edit, and delete events.
 *
 * Events can be public (anyone can see them) or private (only the person
 * who created them can). Anyone can browse and view public events without
 * logging in; creating, editing, and deleting an event all require being
 * logged in, and editing/deleting only works for the event's own creator.
 */

import { Router } from 'express';
import type { Knex } from 'knex';
import { db } from '../../db/knex';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { badRequest, forbidden, notFound } from '../../utils/errors';
import { zodIssuesToDetails } from '../../utils/validation';
import { createEventSchema, updateEventSchema, listEventsQuerySchema, MIN_DURATION_MS } from './events.schemas';
import { type EventRow, toPublicEvent, fetchTagsByEventIds, upsertTagIds } from './events.service';

const router = Router();

// Anonymous callers only ever see public events; an authenticated caller
// additionally sees their own private ones. Any further `visibility` query
// filter (below) narrows within this scope — it can never widen it.
function applyVisibilityScope(query: Knex.QueryBuilder, userId: number | undefined): void {
  if (userId) {
    query.where((qb) => {
      qb.where('events.visibility', 'public').orWhere('events.creator_id', userId);
    });
  } else {
    query.where('events.visibility', 'public');
  }
}

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
    const base = db('events');
    applyVisibilityScope(base, req.userId);
    if (visibility) base.andWhere('events.visibility', visibility);
    if (search) {
      base.andWhere((qb) => {
        qb.where('events.title', 'like', `%${search}%`).orWhere('events.location', 'like', `%${search}%`);
      });
    }
    if (from) base.andWhere('events.starts_at', '>=', new Date(from));

    if (status === 'upcoming') base.andWhere('events.starts_at', '>=', db.fn.now());

    if (status === 'past') base.andWhere('events.ends_at', '<', db.fn.now());
    if (tag) {
      base.andWhere(
        'events.id',
        'in',
        db('event_tags').join('tags', 'tags.id', 'event_tags.tag_id').where('tags.name', tag).select('event_tags.event_id'),
      );
    }

    const countRow = await base.clone().count<{ count: string }>({ count: 'events.id' }).first();
    const total = Number(countRow?.count ?? 0);

    const sortColumn = sort.startsWith('-') ? sort.slice(1) : sort;
    const sortDir = sort.startsWith('-') ? 'desc' : 'asc';
    const rows: EventRow[] = await base
      .clone()
      .select('events.*')
      .orderBy(`events.${sortColumn}`, sortDir)
      .limit(limit)
      .offset((page - 1) * limit);

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
    const event = await db.transaction(async (trx) => {
      const [id] = await trx('events').insert({
        creator_id: req.userId,
        title,
        description: description ?? null,
        starts_at: new Date(startsAt),
        ends_at: new Date(endsAt),
        location,
        visibility,
      });
      if (tags.length > 0) {
        const tagIds = await upsertTagIds(trx, tags);
        await trx('event_tags').insert(tagIds.map((tagId) => ({ event_id: id, tag_id: tagId })));
      }
      return trx<EventRow>('events').where({ id }).first();
    });

    const tagsByEvent = await fetchTagsByEventIds([event!.id]);
    res.status(201).json(toPublicEvent(event!, tagsByEvent.get(event!.id) ?? []));
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
    const row = await db<EventRow>('events').where({ id }).first();
    if (!row || (row.visibility === 'private' && row.creator_id !== req.userId)) {
      next(notFound('Event not found'));
      return;
    }
    const tagsByEvent = await fetchTagsByEventIds([row.id]);
    res.json(toPublicEvent(row, tagsByEvent.get(row.id) ?? []));
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
    const existing = await db<EventRow>('events').where({ id }).first();
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

    const row = await db.transaction(async (trx) => {
      if (Object.keys(updates).length > 0) {
        await trx('events').where({ id }).update(updates);
      }
      if (tags) {
        await trx('event_tags').where({ event_id: id }).delete();
        if (tags.length > 0) {
          const tagIds = await upsertTagIds(trx, tags);
          await trx('event_tags').insert(tagIds.map((tagId) => ({ event_id: id, tag_id: tagId })));
        }
      }
      return trx<EventRow>('events').where({ id }).first();
    });

    const tagsByEvent = await fetchTagsByEventIds([id]);
    res.json(toPublicEvent(row!, tagsByEvent.get(id) ?? []));
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
    const existing = await db<EventRow>('events').where({ id }).first();
    if (!existing) {
      next(notFound('Event not found'));
      return;
    }
    const authzError = ownershipError(existing, req.userId);
    if (authzError) {
      next(authzError);
      return;
    }
    await db('events').where({ id }).delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
