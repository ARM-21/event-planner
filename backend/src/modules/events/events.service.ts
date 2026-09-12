import type { Knex } from 'knex';
import { db } from '../../db/knex';
import type {
  EventRow,
  EventRowWithEndState,
  RsvpStatus,
  EventRsvpRow,
  RsvpSummary,
  ListEventsParams,
  ListEventsResult,
  CreateEventInput,
  UpdateEventInput,
} from './events.types';

export function toPublicEvent(row: EventRow, tags: string[]) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    location: row.location,
    visibility: row.visibility,
    creatorId: row.creator_id,
    creatorName: row.creator_name,
    tags,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// Batched to avoid an N+1 query when listing many events at once.
export async function fetchTagsByEventIds(eventIds: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (eventIds.length === 0) return map;

  const rows = await db('event_tags')
    .join('tags', 'tags.id', 'event_tags.tag_id')
    .whereIn('event_tags.event_id', eventIds)
    .select('event_tags.event_id as eventId', 'tags.name as name')
    .orderBy('tags.name', 'asc');

  for (const row of rows as { eventId: number; name: string }[]) {
    const list = map.get(row.eventId) ?? [];
    list.push(row.name);
    map.set(row.eventId, list);
  }
  return map;
}

// myStatus is null for both an anonymous caller and one who hasn't RSVP'd.
export async function fetchRsvpSummary(eventId: number, userId: number | undefined): Promise<RsvpSummary> {
  const countRow = await db<EventRsvpRow>('event_rsvps')
    .where({ event_id: eventId, status: 'going' })
    .count<{ count: string }>({ count: '*' })
    .first();
  const goingCount = Number(countRow?.count ?? 0);

  let myStatus: RsvpSummary['myStatus'] = null;
  if (userId) {
    const row = await db<EventRsvpRow>('event_rsvps').where({ event_id: eventId, user_id: userId }).first();
    myStatus = row?.status ?? null;
  }

  return { goingCount, myStatus };
}

// A `visibility` filter can only narrow this scope, never widen it.
function applyVisibilityScope(query: Knex.QueryBuilder, userId: number | undefined): void {
  if (userId) {
    query.where((qb) => {
      qb.where('events.visibility', 'public').orWhere('events.creator_id', userId);
    });
  } else {
    query.where('events.visibility', 'public');
  }
}

export async function listEvents(params: ListEventsParams, userId: number | undefined): Promise<ListEventsResult> {
  const { page, limit, search, tag, visibility, from, status, sort } = params;

  const base = db('events');
  applyVisibilityScope(base, userId);
  if (visibility) base.andWhere('events.visibility', visibility);
  if (search) {
    base.andWhere((qb) => {
      qb.where('events.title', 'like', `%${search}%`)
        .orWhere('events.description', 'like', `%${search}%`)
        .orWhere('events.location', 'like', `%${search}%`);
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

  let rowsQuery = base
    .clone()
    .join('users', 'users.id', 'events.creator_id')
    .select('events.*', 'users.name as creator_name');
  if (sortColumn === 'popularity') {
    // pre-grouped subquery so the left join can't fan out row counts;
    // COALESCE treats zero RSVPs as 0 rather than NULL
    const goingCounts = db('event_rsvps').where('status', 'going').groupBy('event_id').select('event_id', db.raw('COUNT(*) as count'));
    rowsQuery = rowsQuery
      .leftJoin(goingCounts.as('going_counts'), 'going_counts.event_id', 'events.id')
      .orderByRaw(`COALESCE(going_counts.count, 0) ${sortDir}`);
  } else {
    rowsQuery = rowsQuery.orderBy(`events.${sortColumn}`, sortDir);
  }

  const rows: EventRow[] = await rowsQuery.limit(limit).offset((page - 1) * limit);
  return { rows, total };
}

export async function findEventById(id: number): Promise<EventRowWithEndState | undefined> {
  return db<EventRowWithEndState>('events')
    .join('users', 'users.id', 'events.creator_id')
    .select('events.*', 'users.name as creator_name', db.raw('(ends_at < ?) as has_ended', [db.fn.now()]))
    .where('events.id', id)
    .first();
}

export async function createEventRecord(input: CreateEventInput): Promise<EventRow> {
  return db.transaction(async (trx) => {
    const [id] = await trx('events').insert({
      creator_id: input.creatorId,
      title: input.title,
      description: input.description,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location: input.location,
      visibility: input.visibility,
    });
    if (input.tags.length > 0) {
      const tagIds = await upsertTagIds(trx, input.tags);
      await trx('event_tags').insert(tagIds.map((tagId) => ({ event_id: id, tag_id: tagId })));
    }
    const row = await trx<EventRow>('events')
      .join('users', 'users.id', 'events.creator_id')
      .select('events.*', 'users.name as creator_name')
      .where('events.id', id)
      .first();
    return row!;
  });
}

export async function updateEventRecord(id: number, input: UpdateEventInput): Promise<EventRow> {
  return db.transaction(async (trx) => {
    if (Object.keys(input.updates).length > 0) {
      await trx('events').where({ id }).update(input.updates);
    }
    if (input.tags) {
      await trx('event_tags').where({ event_id: id }).delete();
      if (input.tags.length > 0) {
        const tagIds = await upsertTagIds(trx, input.tags);
        await trx('event_tags').insert(tagIds.map((tagId) => ({ event_id: id, tag_id: tagId })));
      }
    }
    const row = await trx<EventRow>('events')
      .join('users', 'users.id', 'events.creator_id')
      .select('events.*', 'users.name as creator_name')
      .where('events.id', id)
      .first();
    return row!;
  });
}

export async function deleteEventRecord(id: number): Promise<void> {
  await db('events').where({ id }).delete();
}

export async function upsertRsvp(eventId: number, userId: number, status: RsvpStatus): Promise<void> {
  await db('event_rsvps')
    .insert({ event_id: eventId, user_id: userId, status })
    .onConflict(['event_id', 'user_id'])
    .merge(['status']);
}

export async function deleteRsvp(eventId: number, userId: number): Promise<void> {
  await db('event_rsvps').where({ event_id: eventId, user_id: userId }).delete();
}

export async function upsertTagIds(trx: Knex.Transaction, names: string[]): Promise<number[]> {
  const unique = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
  const ids: number[] = [];

  for (const name of unique) {
    const existing = await trx('tags').where({ name }).first();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    try {
      const [id] = await trx('tags').insert({ name });
      ids.push(id);
    } catch {
      // concurrent request inserted this name first
      const row = await trx('tags').where({ name }).first();
      if (!row) throw new Error(`Failed to resolve tag "${name}"`);
      ids.push(row.id);
    }
  }
  return ids;
}
