import { Router } from 'express';
import type { Knex } from 'knex';
import { db } from '../../db/knex';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { badRequest, forbidden, notFound } from '../../utils/errors';
import { zodIssuesToDetails } from '../../utils/validation';
import { createEventSchema, updateEventSchema, listEventsQuerySchema } from './events.schemas';
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

function parseEventId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/', optionalAuth, async (req, res, next) => {
  const parsed = listEventsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(badRequest('Validation failed', zodIssuesToDetails(parsed.error)));
    return;
  }
  const { page, limit, search, tag, visibility, from, sort } = parsed.data;

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

router.post('/', requireAuth, async (req, res, next) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    next(badRequest('Validation failed', zodIssuesToDetails(parsed.error)));
    return;
  }
  const { title, description, startsAt, location, visibility, tags } = parsed.data;

  try {
    const event = await db.transaction(async (trx) => {
      const [id] = await trx('events').insert({
        creator_id: req.userId,
        title,
        description: description ?? null,
        starts_at: new Date(startsAt),
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
    if (existing.creator_id !== req.userId) {
      next(forbidden());
      return;
    }

    const { tags, startsAt, ...rest } = parsed.data;
    const updates: Record<string, unknown> = { ...rest };
    if (startsAt) updates.starts_at = new Date(startsAt);

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
    if (existing.creator_id !== req.userId) {
      next(forbidden());
      return;
    }
    await db('events').where({ id }).delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
