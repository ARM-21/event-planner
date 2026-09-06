/**
 * Shared helpers for working with events that don't belong to any single
 * route: shaping a raw database row into the JSON the API returns,
 * looking up which tags belong to which events, and resolving tag names
 * to ids (creating new tags as needed).
 */

import type { Knex } from 'knex';
import { db } from '../../db/knex';

export interface EventRow {
  id: number;
  creator_id: number;
  title: string;
  description: string | null;
  starts_at: Date | string;
  ends_at: Date | string;
  location: string;
  visibility: 'public' | 'private';
  created_at: Date | string;
  updated_at: Date | string;
}

// Converts a raw database row (snake_case columns, e.g. `starts_at`) into
// the camelCase shape the API actually sends back to clients.
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
    tags,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// Looks up the tag names for a batch of events in one query (rather than
// one query per event) and groups them by event id, avoiding an N+1 query
// problem when listing many events at once.
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

export type RsvpStatus = 'going' | 'maybe' | 'not_going';

interface EventRsvpRow {
  event_id: number;
  user_id: number;
  status: RsvpStatus;
}

export interface RsvpSummary {
  goingCount: number;
  myStatus: RsvpStatus | null;
}

// One event's RSVP summary: how many people are going, and (if a caller is
// identified) their own status. `myStatus` is `null` for an anonymous
// caller or one who hasn't RSVP'd yet — those are the same "no answer"
// state from the API's point of view.
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

export interface ListEventsParams {
  page: number;
  limit: number;
  search?: string;
  tag?: string;
  visibility?: 'public' | 'private';
  from?: string;
  status?: 'upcoming' | 'past';
  sort: string;
}

export interface ListEventsResult {
  rows: EventRow[];
  total: number;
}

// Anonymous callers only ever see public events; an authenticated caller
// additionally sees their own private ones. Any further `visibility` query
// filter narrows within this scope — it can never widen it.
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

  let rowsQuery = base.clone().select('events.*');
  if (sortColumn === 'popularity') {
    // "Popularity" = how many people RSVP'd "going" — a `maybe` doesn't
    // count. The subquery is pre-grouped to one row per event_id, so the
    // left join can't fan out and change row counts, only add a count to
    // order by; `COALESCE` treats an event with zero RSVP rows (nothing
    // to join to) as 0 rather than leaving it unordered relative to ties.
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

export async function findEventById(id: number): Promise<EventRow | undefined> {
  return db<EventRow>('events').where({ id }).first();
}

export interface CreateEventInput {
  creatorId: number;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  location: string;
  visibility: 'public' | 'private';
  tags: string[];
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
    const row = await trx<EventRow>('events').where({ id }).first();
    return row!;
  });
}

export interface UpdateEventInput {
  updates: Record<string, unknown>;
  tags?: string[];
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
    const row = await trx<EventRow>('events').where({ id }).first();
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

// Resolves tag names to ids, creating any that don't exist yet. Runs inside
// the caller's transaction so a partial insert can't leave orphan tags.
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
      // Concurrent request inserted the same (case-insensitive) name first.
      const row = await trx('tags').where({ name }).first();
      if (!row) throw new Error(`Failed to resolve tag "${name}"`);
      ids.push(row.id);
    }
  }
  return ids;
}
